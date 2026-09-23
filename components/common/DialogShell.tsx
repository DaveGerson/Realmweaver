
import React, { useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { twMerge } from 'tailwind-merge';
import { pushModalLayer } from '@/utils/modalStack';

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Whether an element inside the dialog is actually reachable by a keyboard
 * user — i.e. not hidden behind an in-dialog overlay (inert/hidden/
 * aria-hidden ancestor) and not itself display:none / visibility:hidden.
 *
 * NOTE: deliberately does NOT rely on `el.offsetParent` or
 * `el.getClientRects()` alone — jsdom performs no layout, so those are
 * always null/empty even for elements that are genuinely visible, which
 * would filter out every element under any jsdom-based test. Attribute and
 * computed-style checks work correctly in both jsdom and real browsers.
 *
 * `layoutAware` opts into an additional stacking check (see
 * `hasRealLayout` below) for dialogs whose in-dialog overlays don't
 * cooperate by marking the covered layer inert/aria-hidden (e.g.
 * EvocationWizard's `absolute inset-0` edit overlay — wp-g1-worldsim-dialogs
 * finding #75). It is skipped entirely when layout isn't real, so it never
 * changes behavior under jsdom-based tests.
 */
function isReachable(el: HTMLElement, layoutAware: boolean): boolean {
  if (el.closest('[inert], [hidden], [aria-hidden="true"]')) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;

  if (layoutAware) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      // A control merely scrolled outside a scrollable ancestor's visible
      // box is NOT covered — focusing it makes the browser scroll it into
      // view. Without this exemption, elementFromPoint at the control's
      // (clipped) center hits whatever paints there instead, and Tab-wrap
      // would skip every below-the-fold control in a scrolling dialog.
      if (isScrollClipped(el, rect)) return true;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const topEl = document.elementFromPoint(cx, cy);
      // If some other element is visually on top at this control's own
      // center point (e.g. a same-DOM-level full-cover overlay div), the
      // control is covered and unreachable even though nothing marked it
      // inert/aria-hidden.
      if (topEl && topEl !== el && !el.contains(topEl)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * True when `el`'s box lies (partially) outside the visible box of a
 * scrollable ancestor — i.e. it is clipped by overflow scrolling rather than
 * covered by an overlay. Such an element is keyboard-reachable: focus() will
 * scroll it into view.
 */
function isScrollClipped(el: HTMLElement, rect: DOMRect): boolean {
  let parent = el.parentElement;
  while (parent && parent !== document.body) {
    const style = window.getComputedStyle(parent);
    if (/(auto|scroll)/.test(style.overflowY + ' ' + style.overflowX)) {
      const box = parent.getBoundingClientRect();
      if (
        rect.bottom > box.bottom || rect.top < box.top ||
        rect.right > box.right || rect.left < box.left
      ) {
        return true;
      }
    }
    parent = parent.parentElement;
  }
  return false;
}

/**
 * Detects whether the current environment performs real layout (an actual
 * browser / Playwright) as opposed to jsdom, which always reports a zeroed
 * `getBoundingClientRect()` and has no `elementFromPoint`. Recomputed fresh
 * on every call (cheap — one throwaway probe element, invoked only on
 * dialog-open and Tab presses) rather than memoized at module scope, so a
 * test that swaps in a real-layout-like environment mid-suite is never
 * defeated by a stale cached answer from an earlier test.
 */
function hasRealLayout(): boolean {
  if (typeof document === 'undefined' || typeof document.elementFromPoint !== 'function') {
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:37px;height:41px;visibility:hidden;pointer-events:none;';
  document.body.appendChild(probe);
  const rect = probe.getBoundingClientRect();
  document.body.removeChild(probe);
  return rect.width > 0 && rect.height > 0;
}

interface DialogShellProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

/**
 * DialogShell — accessible modal wrapper.
 *
 * Provides:
 *   - role="dialog" aria-modal="true"
 *   - Focus trap (Tab / Shift+Tab stay within dialog)
 *   - Escape key to close
 *   - Backdrop click to close
 *   - Body scroll lock while open
 *   - Dark backdrop (bg-black/60)
 *   - Portaled into `document.body` (roadmap X4), so an ancestor with
 *     `overflow-hidden` / `transform` / `filter` can never clip or
 *     re-anchor the `fixed inset-0` backdrop. Stacking follows the z-index
 *     ladder: content < header z-[60] < drawer z-[70] < dialogs z-[80] <
 *     toasts z-[90].
 *   - Background inert: while open, every other top-level node in <body>
 *     (the app root, lower dialogs) gets `inert` + `aria-hidden="true"` via
 *     `utils/modalStack` — only the TOPMOST dialog's background is hidden,
 *     attributes are restored exactly on close, and nodes marked
 *     `data-modal-inert-exempt` (the toast region, the conflict / backup
 *     StatusBanners) stay reachable — even when nested inside the app root.
 *   - Nested DialogShells each portal to <body> as siblings; React events
 *     still bubble through the React tree, so the inner dialog's
 *     `stopPropagation()` on Escape keeps the outer one open.
 */
export const DialogShell: React.FC<DialogShellProps> = ({
  isOpen,
  onClose,
  children,
  className,
  ariaLabel,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus the first focusable element when opened; restore focus when closed.
  const previousFocusRef = useRef<Element | null>(null);

  // Tracks whether the mousedown that started the current press landed
  // directly on the backdrop (not inside the panel). A `click` event fires
  // on the nearest common ancestor of the mousedown/mouseup targets, so a
  // text-selection drag that starts inside the panel and is released over
  // the backdrop would otherwise dispatch its click on the backdrop and
  // close the dialog, discarding unsaved in-progress state.
  const backdropPressStartedRef = useRef(false);
  // Mirror image of backdropPressStartedRef: set true only when a mouseup
  // is positively observed landing on panel content (not the backdrop
  // itself). The click's own `e.target` is computed as the common ancestor
  // of the mousedown/mouseup targets, so a press that starts on the
  // backdrop, drags into the panel, and releases inside it *also* dispatches
  // a click whose target is the backdrop (the backdrop is an ancestor of
  // the panel) — without this separate mouseup-target check, that drag-in
  // gesture would still close the dialog even though the release genuinely
  // landed on panel content. Defaults to false (release presumed fine) so
  // a genuine backdrop press+click with no synthetic mouseup in between
  // (browsers always fire one; some callers/tests may not) still closes.
  const backdropReleaseMissedBackdropRef = useRef(false);

  const backdropRef = useRef<HTMLDivElement>(null);

  // Background inert + focus capture/restore. A LAYOUT effect on purpose:
  //  - the previously-focused element must be captured BEFORE the app root
  //    goes inert (browsers blur focus inside a subtree that becomes inert);
  //  - on close, the background must be un-inerted BEFORE focus is handed
  //    back to it, or `.focus()` on an inert element silently no-ops.
  useLayoutEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement;
    const release = backdropRef.current ? pushModalLayer(backdropRef.current) : () => {};

    return () => {
      release();
      const prev = previousFocusRef.current;
      if (prev && 'focus' in prev && (prev as HTMLElement).isConnected) {
        (prev as HTMLElement).focus();
      }
    };
  }, [isOpen]);

  // Focus the first reachable element once the dialog has painted.
  useEffect(() => {
    if (!isOpen) return;

    const frame = requestAnimationFrame(() => {
      if (!dialogRef.current) return;
      const allFocusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      );
      const layoutAware = hasRealLayout();
      const focusable = allFocusable.filter(el => isReachable(el, layoutAware));
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        dialogRef.current.focus();
      }
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [isOpen]);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Keyboard handler: Escape closes, Tab traps focus
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        // A child that already consumed this Escape (e.g. MentionInput
        // closing its suggestion dropdown) marks it defaultPrevented —
        // the dialog must stay open in that case (finding #52).
        if (e.defaultPrevented) return;
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        if (!dialogRef.current) return;
        const allFocusable: HTMLElement[] = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
        );
        const layoutAware = hasRealLayout();
        const focusable: HTMLElement[] = allFocusable.filter(el => isReachable(el, layoutAware));

        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first: HTMLElement = focusable[0];
        const last: HTMLElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [onClose]
  );

  const handleBackdropMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    backdropPressStartedRef.current = e.target === e.currentTarget;
  }, []);

  const handleBackdropMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    backdropReleaseMissedBackdropRef.current = e.target !== e.currentTarget;
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const pressStartedOnBackdrop = backdropPressStartedRef.current;
      const releaseMissedBackdrop = backdropReleaseMissedBackdropRef.current;
      backdropPressStartedRef.current = false;
      backdropReleaseMissedBackdropRef.current = false;
      // Require the press to have started on the backdrop AND (when a
      // mouseup was observed) the release to have also landed on the
      // backdrop — a drag starting or ending inside the panel must never
      // close the dialog, in either direction.
      if (e.target === e.currentTarget && pressStartedOnBackdrop && !releaseMissedBackdrop) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
      onClick={handleBackdropClick}
      // React synthetic events still bubble through the React tree (not
      // the DOM tree) across the portal boundary, so a nested DialogShell's
      // clicks/keys reach this backdrop's handlers exactly as they did when
      // dialogs rendered inline — the target checks below keep that inert.
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={twMerge('outline-none', className)}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};
