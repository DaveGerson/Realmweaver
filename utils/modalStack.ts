/**
 * modalStack — module-level registry of open modal layers that keeps the
 * content *behind* the topmost modal out of reach of assistive tech and the
 * keyboard (roadmap X4).
 *
 * While at least one modal is registered, everything in <body> that is not
 * the topmost modal, and not on the path to a "kept" element, is marked
 * `inert` + `aria-hidden="true"`. With `DialogShell` portaling straight into
 * `document.body`, that means "the app root and any lower dialogs". Only
 * the TOPMOST modal's background is hidden: opening a nested dialog inerts
 * the parent dialog; closing it un-inerts the parent again.
 *
 * Kept elements: the topmost modal plus every element carrying
 * `data-modal-inert-exempt` — the toast region (z-[90], above dialogs) and
 * the data-safety StatusBanners. An exempt element nested inside the app
 * root is handled by walking INTO its ancestors and hiding their other
 * children instead of hiding the ancestor wholesale (the approach of the
 * `aria-hidden` package). An exempt element that appears while a modal is
 * already open (e.g. the multi-tab conflict banner raised mid-dialog) is
 * split out of the hidden region by a MutationObserver.
 *
 * Attributes are restored EXACTLY: the pre-existing `inert` presence and
 * `aria-hidden` value of every element we touch are captured the first time
 * we touch it and written back when it leaves the hidden set, so an element
 * that was already `aria-hidden="true"` (or `inert`) stays that way.
 */

export const MODAL_INERT_EXEMPT_ATTR = 'data-modal-inert-exempt';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE']);

interface OriginalAttrs {
  inert: boolean;
  ariaHidden: string | null;
}

const stack: HTMLElement[] = [];
const touched = new Map<Element, OriginalAttrs>();
let observer: MutationObserver | null = null;

function keptElements(top: HTMLElement): Element[] {
  const exempt = Array.from(document.querySelectorAll(`[${MODAL_INERT_EXEMPT_ATTR}]`));
  return [top, ...exempt];
}

/** Every element that should be hidden while `top` is the topmost modal. */
function collectBackground(top: HTMLElement): Set<Element> {
  const result = new Set<Element>();
  if (typeof document === 'undefined' || !top.isConnected) return result;
  const keep = keptElements(top);

  const walk = (parent: Element) => {
    for (const child of Array.from(parent.children)) {
      if (SKIP_TAGS.has(child.tagName)) continue;
      if (keep.includes(child)) continue;
      if (keep.some(k => child.contains(k))) {
        walk(child);
        continue;
      }
      result.add(child);
    }
  };
  walk(document.body);
  return result;
}

function hide(el: Element): void {
  if (touched.has(el)) return;
  touched.set(el, {
    inert: el.hasAttribute('inert'),
    ariaHidden: el.getAttribute('aria-hidden'),
  });
  el.setAttribute('inert', '');
  el.setAttribute('aria-hidden', 'true');
}

function restore(el: Element): void {
  const orig = touched.get(el);
  if (!orig) return;
  touched.delete(el);
  if (!orig.inert) el.removeAttribute('inert');
  if (orig.ariaHidden === null) el.removeAttribute('aria-hidden');
  else el.setAttribute('aria-hidden', orig.ariaHidden);
}

/** Full recompute — used whenever the stack changes. */
function apply(): void {
  const top = stack[stack.length - 1];
  const desired = top ? collectBackground(top) : new Set<Element>();

  for (const el of Array.from(touched.keys())) {
    if (!desired.has(el)) restore(el);
  }
  for (const el of desired) hide(el);

  syncObserver();
}

/**
 * Split-only refresh after DOM mutations: un-hide any hidden element that
 * now CONTAINS a kept element and hide its other children instead. Never
 * hides anything that wasn't already covered by a hidden ancestor — so a
 * popover portaled into <body> from inside the open dialog (e.g.
 * EntityQuickCard) is left alone.
 */
function splitAroundNewlyKept(): void {
  const top = stack[stack.length - 1];
  if (!top || !top.isConnected) return;
  const keep = keptElements(top);
  const toSplit = Array.from(touched.keys()).filter(el => keep.some(k => el === k || el.contains(k)));
  if (toSplit.length === 0) return;

  for (const el of toSplit) restore(el);
  const desired = collectBackground(top);
  for (const el of desired) {
    if (toSplit.some(split => split !== el && split.contains(el))) hide(el);
  }
}

function syncObserver(): void {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
  if (stack.length > 0 && !observer) {
    observer = new MutationObserver(splitAroundNewlyKept);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [MODAL_INERT_EXEMPT_ATTR],
    });
  } else if (stack.length === 0 && observer) {
    observer.disconnect();
    observer = null;
  }
}

/**
 * Register `node` as the new topmost modal layer. Returns a release function
 * (idempotent) that unregisters it — from wherever it sits in the stack, so
 * out-of-order closes are handled — and re-applies the background state.
 */
export function pushModalLayer(node: HTMLElement): () => void {
  stack.push(node);
  apply();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const idx = stack.lastIndexOf(node);
    if (idx !== -1) stack.splice(idx, 1);
    apply();
  };
}

/** Number of currently registered modal layers (for tests / diagnostics). */
export function getModalLayerCount(): number {
  return stack.length;
}
