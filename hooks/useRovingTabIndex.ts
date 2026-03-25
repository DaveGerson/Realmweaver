
import React, { useRef, useCallback } from 'react';

interface RovingProps {
  tabIndex: number;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  ref: (el: HTMLElement | null) => void;
}

interface UseRovingTabIndexOptions {
  /** Direction: 'horizontal' | 'vertical' | 'both'. Defaults to 'both'. */
  direction?: 'horizontal' | 'vertical' | 'both';
  /** Number of columns when direction is 'both'. Defaults to 1 (single column). */
  columns?: number;
}

interface UseRovingTabIndexReturn {
  getRovingProps: (index: number) => RovingProps;
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

      const cols = Math.max(1, columns);

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
      tabIndex: index === 0 ? 0 : -1,
      onKeyDown: handleKeyDown(index),
      ref: setRef(index),
    }),
    [handleKeyDown, setRef]
  );

  return { getRovingProps };
}
