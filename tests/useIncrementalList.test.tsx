// @vitest-environment jsdom
/**
 * Roadmap N4 — useIncrementalList (threshold-gated incremental rendering)
 * and its integration with useRovingTabIndex.
 */
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, renderHook, act, cleanup, fireEvent, screen } from '@testing-library/react';
import {
  useIncrementalList,
  computeVisibleCount,
  windowSizeForIndex,
} from '../hooks/useIncrementalList';
import { useRovingTabIndex } from '../hooks/useRovingTabIndex';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('computeVisibleCount / windowSizeForIndex (pure)', () => {
  it('renders everything at or below the threshold', () => {
    expect(computeVisibleCount(0, 60)).toBe(0);
    expect(computeVisibleCount(100, 60)).toBe(100);
    expect(computeVisibleCount(40, 10, 50)).toBe(40);
  });

  it('caps to the requested window above the threshold', () => {
    expect(computeVisibleCount(101, 60)).toBe(60);
    expect(computeVisibleCount(300, 120)).toBe(120);
    expect(computeVisibleCount(130, 500)).toBe(130);
  });

  it('grows page-aligned so the target index is included, never shrinking', () => {
    expect(windowSizeForIndex(10, 60, 60, 60)).toBe(60);
    expect(windowSizeForIndex(60, 60, 60, 60)).toBe(120);
    expect(windowSizeForIndex(299, 60, 60, 60)).toBe(300);
    expect(windowSizeForIndex(5, 240, 60, 60)).toBe(240);
  });
});

describe('useIncrementalList', () => {
  it('is not engaged for small lists — returns the same array', () => {
    const items = range(100);
    const { result } = renderHook(() => useIncrementalList(items));
    expect(result.current.isEngaged).toBe(false);
    expect(result.current.visibleItems).toBe(items);
    expect(result.current.hasMore).toBe(false);
  });

  it('renders the initial window above the threshold and grows via showMore / ensureIndexVisible', () => {
    const items = range(300);
    const { result } = renderHook(() => useIncrementalList(items));
    expect(result.current.isEngaged).toBe(true);
    expect(result.current.visibleCount).toBe(60);
    expect(result.current.remaining).toBe(240);

    act(() => result.current.showMore());
    expect(result.current.visibleCount).toBe(120);

    act(() => result.current.ensureIndexVisible(299));
    expect(result.current.visibleCount).toBe(300);
    expect(result.current.hasMore).toBe(false);
  });

  it('resets the window when resetKey changes', () => {
    const items = range(300);
    const { result, rerender } = renderHook(({ k }) => useIncrementalList(items, { resetKey: k }), {
      initialProps: { k: 'a' },
    });
    act(() => result.current.showMore());
    expect(result.current.visibleCount).toBe(120);
    rerender({ k: 'b' });
    expect(result.current.visibleCount).toBe(60);
  });

  it('auto-grows when the sentinel intersects (IntersectionObserver)', () => {
    let trigger: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null;
    const disconnect = vi.fn();
    class FakeIO {
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) { trigger = cb; }
      observe() {}
      disconnect() { disconnect(); }
    }
    vi.stubGlobal('IntersectionObserver', FakeIO);

    const items = range(300);
    const { result } = renderHook(() => useIncrementalList(items));
    const el = document.createElement('div');
    act(() => result.current.sentinelRef(el));
    expect(trigger).not.toBeNull();
    act(() => trigger!([{ isIntersecting: true }]));
    expect(result.current.visibleCount).toBe(120);
    act(() => trigger!([{ isIntersecting: false }]));
    expect(result.current.visibleCount).toBe(120);
    act(() => result.current.sentinelRef(null));
    expect(disconnect).toHaveBeenCalled();
  });
});

describe('useIncrementalList + useRovingTabIndex', () => {
  const Grid: React.FC<{ n: number }> = ({ n }) => {
    const items = React.useMemo(() => range(n), [n]);
    const inc = useIncrementalList(items);
    const { getRovingProps } = useRovingTabIndex({
      direction: 'both',
      columns: 1,
      itemCount: items.length,
      onRequestIndex: inc.ensureIndexVisible,
    });
    return (
      <div>
        {inc.visibleItems.map(i => (
          <button key={i} data-testid={`card-${i}`} {...getRovingProps(i)}>Card {i}</button>
        ))}
      </div>
    );
  };

  it('End jumps to the logical last item, growing the window and focusing it', () => {
    render(<Grid n={300} />);
    expect(screen.queryByTestId('card-299')).toBeNull();
    const first = screen.getByTestId('card-0');
    act(() => first.focus());
    fireEvent.keyDown(first, { key: 'End' });
    const last = screen.getByTestId('card-299');
    expect(document.activeElement).toBe(last);
    expect(last.tabIndex).toBe(0);
    expect(first.tabIndex).toBe(-1);
  });

  it('ArrowDown past the last rendered card grows the window by one page and focuses the next card', () => {
    render(<Grid n={300} />);
    const edge = screen.getByTestId('card-59');
    expect(screen.queryByTestId('card-60')).toBeNull();
    act(() => edge.focus());
    fireEvent.keyDown(edge, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByTestId('card-60'));
    expect(screen.queryByTestId('card-119')).not.toBeNull();
    expect(screen.queryByTestId('card-120')).toBeNull();
  });

  it('small lists behave exactly as before (End goes to the last card)', () => {
    render(<Grid n={20} />);
    const first = screen.getByTestId('card-0');
    act(() => first.focus());
    fireEvent.keyDown(first, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByTestId('card-19'));
  });
});
