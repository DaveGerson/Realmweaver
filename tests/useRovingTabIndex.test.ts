import { describe, it, expect, afterEach, vi } from 'vitest';
import { resolveColumns } from '../hooks/useRovingTabIndex';

// ---------------------------------------------------------------------------
// resolveColumns — pure column-count resolution used by useRovingTabIndex's
// ArrowUp/ArrowDown handling. Verifies the fix for the roving-tabindex grid
// bug where a hardcoded `columns: 3` diverged from the actual rendered
// `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` breakpoints.
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveColumns', () => {
  it('returns a fixed column count unchanged, regardless of viewport width', () => {
    vi.stubGlobal('window', { innerWidth: 400 });
    expect(resolveColumns(3)).toBe(3);
  });

  it('clamps a fixed column count below 1 up to 1', () => {
    expect(resolveColumns(0)).toBe(1);
    expect(resolveColumns(-5)).toBe(1);
  });

  it('resolves to `base` below the smallest configured breakpoint', () => {
    vi.stubGlobal('window', { innerWidth: 500 });
    expect(resolveColumns({ base: 1, md: 2, xl: 3 })).toBe(1);
  });

  it('resolves to `md` columns at a mid-size viewport (matches Tailwind md: 768px)', () => {
    vi.stubGlobal('window', { innerWidth: 900 });
    expect(resolveColumns({ base: 1, md: 2, xl: 3 })).toBe(2);
  });

  it('resolves to `xl` columns once the xl breakpoint (1280px) is reached', () => {
    vi.stubGlobal('window', { innerWidth: 1280 });
    expect(resolveColumns({ base: 1, md: 2, xl: 3 })).toBe(3);
  });

  it('stays at `md` columns just below the xl breakpoint', () => {
    vi.stubGlobal('window', { innerWidth: 1279 });
    expect(resolveColumns({ base: 1, md: 2, xl: 3 })).toBe(2);
  });

  it('falls back to the next lower defined breakpoint when a wider one is skipped', () => {
    vi.stubGlobal('window', { innerWidth: 2000 });
    // No `2xl` or `xl` entry provided — should fall through to `lg`.
    expect(resolveColumns({ base: 1, lg: 4 })).toBe(4);
  });

  it('treats an unavailable window as the narrowest (base) case', () => {
    vi.stubGlobal('window', undefined as unknown as Window & typeof globalThis);
    expect(resolveColumns({ base: 1, md: 2, xl: 3 })).toBe(1);
  });
});
