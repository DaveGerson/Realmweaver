import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useIncrementalList — dependency-free, threshold-gated incremental rendering
 * for large card grids and lists (roadmap N4).
 *
 * Why incremental rendering rather than true windowing: the dashboards are
 * responsive CSS grids of variable-height cards wired to `useRovingTabIndex`,
 * whose registry maps render index → DOM node. A true window (unmounting
 * cards scrolled *above* the viewport) would need per-row measurement and
 * would punch holes in that registry. Rendering a growing PREFIX keeps every
 * index contiguous — roving keyboard navigation works unchanged over the
 * rendered prefix — while still bounding DOM size and per-keystroke render
 * cost to `visibleCount` cards instead of the whole campaign.
 *
 * Behaviour:
 *   - `items.length <= threshold` (default 100): NOT engaged. Every item is
 *     returned; small campaigns render exactly as before.
 *   - above the threshold: the first `initialCount` (default 60) render, and
 *     the window grows by `pageSize` when the sentinel scrolls near the
 *     viewport (IntersectionObserver), when `showMore()` is called (the
 *     "Show more" button), or when `ensureIndexVisible(i)` is called (keyboard
 *     navigation reaching past the rendered prefix — wire it to
 *     `useRovingTabIndex`'s `onRequestIndex`).
 *   - `resetKey` changing (e.g. the search term) shrinks the window back to
 *     `initialCount`, so filtering keeps the DOM bounded.
 */
export interface UseIncrementalListOptions {
  /** Engage only when the list is longer than this. Default 100. */
  threshold?: number;
  /** Items rendered initially once engaged. Default 60. */
  initialCount?: number;
  /** Items added per growth step. Default 60. */
  pageSize?: number;
  /** When this value changes, the window resets to `initialCount`. */
  resetKey?: unknown;
  /** IntersectionObserver rootMargin for the auto-grow sentinel. Default '600px'. */
  rootMargin?: string;
}

export interface UseIncrementalListResult<T> {
  /** The prefix of `items` to render. */
  visibleItems: T[];
  /** Length of `visibleItems`. */
  visibleCount: number;
  /** Total number of items. */
  totalCount: number;
  /** Items not yet rendered. */
  remaining: number;
  /** True when some items are not rendered yet. */
  hasMore: boolean;
  /** True when the list is above the threshold (windowing engaged). */
  isEngaged: boolean;
  /** Grow the window by one page. */
  showMore: () => void;
  /** Grow the window (page-aligned) so that `index` is rendered. */
  ensureIndexVisible: (index: number) => void;
  /** Callback ref for an element placed after the list; auto-grows on intersection. */
  sentinelRef: (el: Element | null) => void;
}

export const INCREMENTAL_LIST_DEFAULTS = {
  threshold: 100,
  initialCount: 60,
  pageSize: 60,
} as const;

/**
 * Pure sizing rule, exported for unit tests: how many of `total` items to
 * render given the requested window size.
 */
export function computeVisibleCount(
  total: number,
  requested: number,
  threshold: number = INCREMENTAL_LIST_DEFAULTS.threshold,
): number {
  if (total <= threshold) return total;
  return Math.max(0, Math.min(total, requested));
}

/**
 * Pure growth rule, exported for unit tests: the page-aligned window size
 * needed so that `index` is rendered (never shrinks `current`).
 */
export function windowSizeForIndex(
  index: number,
  current: number,
  initialCount: number,
  pageSize: number,
): number {
  if (index < current) return current;
  const needed = index + 1;
  const pages = Math.ceil(Math.max(0, needed - initialCount) / Math.max(1, pageSize));
  return Math.max(current, initialCount + pages * Math.max(1, pageSize));
}

export function useIncrementalList<T>(
  items: readonly T[],
  options: UseIncrementalListOptions = {},
): UseIncrementalListResult<T> {
  const {
    threshold = INCREMENTAL_LIST_DEFAULTS.threshold,
    initialCount = INCREMENTAL_LIST_DEFAULTS.initialCount,
    pageSize = INCREMENTAL_LIST_DEFAULTS.pageSize,
    resetKey,
    rootMargin = '600px',
  } = options;

  const [requested, setRequested] = useState(initialCount);

  // Reset the window when the caller's reset key changes (render-phase
  // derived-state pattern — no extra effect pass, no flash of the old size).
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (!Object.is(lastResetKey, resetKey)) {
    setLastResetKey(resetKey);
    setRequested(initialCount);
  }

  const total = items.length;
  const isEngaged = total > threshold;
  const visibleCount = computeVisibleCount(total, requested, threshold);
  const hasMore = visibleCount < total;

  const showMore = useCallback(() => {
    setRequested(prev => prev + Math.max(1, pageSize));
  }, [pageSize]);

  const ensureIndexVisible = useCallback((index: number) => {
    setRequested(prev => windowSizeForIndex(index, prev, initialCount, pageSize));
  }, [initialCount, pageSize]);

  // Auto-grow when the sentinel approaches the viewport. The observer is
  // (re)attached through a callback ref so it follows the sentinel's
  // mount/unmount (it only renders while `hasMore`).
  const observerRef = useRef<IntersectionObserver | null>(null);
  const showMoreRef = useRef(showMore);
  showMoreRef.current = showMore;

  const sentinelRef = useCallback((el: Element | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) showMoreRef.current();
      },
      { rootMargin },
    );
    observer.observe(el);
    observerRef.current = observer;
  }, [rootMargin]);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return {
    visibleItems: visibleCount === total ? (items as T[]) : items.slice(0, visibleCount),
    visibleCount,
    totalCount: total,
    remaining: total - visibleCount,
    hasMore,
    isEngaged,
    showMore,
    ensureIndexVisible,
    sentinelRef,
  };
}
