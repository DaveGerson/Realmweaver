
import React, { useRef, useCallback } from 'react';

export interface RovingProps {
  tabIndex: number;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  ref: (el: HTMLElement | null) => void;
}

/**
 * Column count per Tailwind breakpoint, matching the `grid-cols-*` classes
 * used on the corresponding grid. `base` applies below the smallest listed
 * breakpoint. Keys are checked widest-first against `window.innerWidth`.
 */
export interface ResponsiveColumns {
  base: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
  '2xl'?: number;
}

interface UseRovingTabIndexOptions {
  /** Direction: 'horizontal' | 'vertical' | 'both'. Defaults to 'both'. */
  direction?: 'horizontal' | 'vertical' | 'both';
  /**
   * Number of columns when direction is 'both'. Defaults to 1 (single column).
   * Pass a plain number for a fixed column count, or a `ResponsiveColumns`
   * map to match a grid whose column count changes across breakpoints
   * (e.g. `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` -> `{ base: 1, md: 2, xl: 3 }`).
   */
  columns?: number | ResponsiveColumns;
  /**
   * Logical item count when the caller renders only a prefix of the list
   * (see `useIncrementalList`). When set, End / arrow keys may target an
   * index past the last *rendered* item (but below `itemCount`); the hook
   * then calls `onRequestIndex(index)` so the caller can grow its render
   * window, and moves focus to that item as soon as its ref attaches.
   * Omit both for a fully-rendered list (behaviour unchanged).
   */
  itemCount?: number;
  onRequestIndex?: (index: number) => void;
}

interface UseRovingTabIndexReturn {
  getRovingProps: (index: number) => RovingProps;
}

// Tailwind's default breakpoints, widest first so the first match wins.
const BREAKPOINTS: Array<[keyof Omit<ResponsiveColumns, 'base'>, number]> = [
  ['2xl', 1536],
  ['xl', 1280],
  ['lg', 1024],
  ['md', 768],
  ['sm', 640],
];

/**
 * Resolves a `columns` option to the actual number of columns rendered at
 * the current viewport width. Exported for unit testing.
 */
export function resolveColumns(columns: number | ResponsiveColumns): number {
  if (typeof columns === 'number') return Math.max(1, columns);

  const width = typeof window !== 'undefined' ? window.innerWidth : 0;
  for (const [key, minWidth] of BREAKPOINTS) {
    const value = columns[key];
    if (value !== undefined && width >= minWidth) {
      return Math.max(1, value);
    }
  }
  return Math.max(1, columns.base);
}

/**
 * useRovingTabIndex — roving tabindex for grid/list keyboard navigation.
 *
 * Arrow keys move focus between registered items. Only the currently focused
 * item has tabIndex 0; all others have tabIndex -1.
 *
 * Usage:
 *   const { getRovingProps } = useRovingTabIndex({ columns: 3 });
 *   items.map((item, i) => <button {...getRovingProps(i)}>...</button>)
 */
export function useRovingTabIndex(
  options: UseRovingTabIndexOptions = {}
): UseRovingTabIndexReturn {
  const { direction = 'both', columns = 1, itemCount, onRequestIndex } = options;
  const itemsRef = useRef<(HTMLElement | null)[]>([]);
  const focusedIndexRef = useRef<number>(0);
  // Index whose element should receive focus as soon as it mounts (keyboard
  // navigation past an incrementally-rendered prefix).
  const pendingFocusRef = useRef<number | null>(null);
  // Latest-value refs so the memoized callbacks below don't churn.
  const itemCountRef = useRef<number | undefined>(itemCount);
  itemCountRef.current = itemCount;
  const onRequestIndexRef = useRef(onRequestIndex);
  onRequestIndexRef.current = onRequestIndex;
  // Finding #103: `setRef(index)` used to mint a brand-new closure on every
  // render. Even though `setRef` itself was memoized, React treats a changed
  // ref *callback identity* as "this ref changed" and detaches the old
  // callback (calling it with null) before attaching the new one — for every
  // item, on every commit, including unrelated re-renders (e.g. the two store
  // notifications the autosave cycle emits per edit). The detach branch below
  // trims trailing nulls from the registry; since ALL items get nulled during
  // that detach pass, the registry was briefly emptied and focusedIndexRef
  // got reset to 0. Caching one stable ref callback per index (created lazily,
  // reused across renders) means React only calls it with null when an item
  // actually unmounts (e.g. a search filter shrinking the list), not on every
  // commit.
  const refCallbacksRef = useRef<Map<number, (el: HTMLElement | null) => void>>(new Map());

  const setRef = useCallback((index: number) => {
    const cached = refCallbacksRef.current.get(index);
    if (cached) return cached;
    const cb = (el: HTMLElement | null) => {
      itemsRef.current[index] = el;
      if (el !== null && pendingFocusRef.current === index) {
        // The item keyboard navigation asked for has just been rendered.
        pendingFocusRef.current = null;
        focusedIndexRef.current = index;
        itemsRef.current.forEach((item, i) => {
          if (item) item.tabIndex = i === index ? 0 : -1;
        });
        el.focus();
        return;
      }
      if (el === null) {
        // Item unmounted (e.g. a search filter shrank the list). Trim trailing
        // empty slots and, if the tracked focus position fell off the end,
        // clamp it and re-anchor tabIndex so the grid stays Tab-reachable
        // (otherwise every remaining item would render with tabIndex -1).
        const items = itemsRef.current;
        while (items.length > 0 && items[items.length - 1] === null) items.pop();
        if (focusedIndexRef.current >= items.length) {
          focusedIndexRef.current = Math.max(0, items.length - 1);
          const anchor = items[focusedIndexRef.current];
          if (anchor) anchor.tabIndex = 0;
        }
      }
    };
    refCallbacksRef.current.set(index, cb);
    return cb;
  }, []);

  const moveFocus = useCallback((newIndex: number) => {
    const items = itemsRef.current;
    const total = items.length;
    if (total === 0) return;

    const clamped = Math.max(0, Math.min(newIndex, total - 1));
    focusedIndexRef.current = clamped;

    // Update tabIndex on all items
    items.forEach((el, i) => {
      if (el) el.tabIndex = i === clamped ? 0 : -1;
    });

    items[clamped]?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (index: number) => (e: React.KeyboardEvent<HTMLElement>) => {
      const rendered = itemsRef.current.length;
      if (rendered === 0) return;
      // Logical total: the caller may render only a prefix of the list.
      const logical = itemCountRef.current;
      const total = logical !== undefined && onRequestIndexRef.current
        ? Math.max(rendered, logical)
        : rendered;

      let newIndex = index;
      let handled = false;

      const cols = resolveColumns(columns);

      if (
        (direction === 'horizontal' || direction === 'both') &&
        e.key === 'ArrowRight'
      ) {
        newIndex = index + 1;
        handled = true;
      } else if (
        (direction === 'horizontal' || direction === 'both') &&
        e.key === 'ArrowLeft'
      ) {
        newIndex = index - 1;
        handled = true;
      } else if (
        (direction === 'vertical' || direction === 'both') &&
        e.key === 'ArrowDown'
      ) {
        newIndex = index + cols;
        handled = true;
      } else if (
        (direction === 'vertical' || direction === 'both') &&
        e.key === 'ArrowUp'
      ) {
        newIndex = index - cols;
        handled = true;
      } else if (e.key === 'Home') {
        newIndex = 0;
        handled = true;
      } else if (e.key === 'End') {
        newIndex = total - 1;
        handled = true;
      }

      if (handled) {
        e.preventDefault();
        if (newIndex >= 0 && newIndex < total) {
          if (newIndex < rendered && itemsRef.current[newIndex]) {
            pendingFocusRef.current = null;
            moveFocus(newIndex);
          } else if (onRequestIndexRef.current) {
            // Target is beyond the rendered window: ask the caller to grow
            // it; the ref callback focuses the item once it mounts.
            pendingFocusRef.current = newIndex;
            onRequestIndexRef.current(newIndex);
          }
        }
      }
    },
    [columns, direction, moveFocus]
  );

  const getRovingProps = useCallback(
    (index: number): RovingProps => ({
      tabIndex: index === focusedIndexRef.current ? 0 : -1,
      onKeyDown: handleKeyDown(index),
      ref: setRef(index),
    }),
    [handleKeyDown, setRef]
  );

  return { getRovingProps };
}
