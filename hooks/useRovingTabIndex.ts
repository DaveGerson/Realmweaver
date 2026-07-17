
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
  const { direction = 'both', columns = 1 } = options;
  const itemsRef = useRef<(HTMLElement | null)[]>([]);
  const focusedIndexRef = useRef<number>(0);

  const setRef = useCallback((index: number) => (el: HTMLElement | null) => {
    itemsRef.current[index] = el;
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
      const total = itemsRef.current.length;
      if (total === 0) return;

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
          moveFocus(newIndex);
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
