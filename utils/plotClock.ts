// utils/plotClock.ts
//
// Pure helpers for a plot's countdown clock (`types/Plot.ts` `PlotClock`) —
// the front / progress-clock idea from Apocalypse World and Blades in the
// Dark, used here to let the world move on its own when the party looks the
// other way. Shared by the Plot editor, the Session Runner's plot panel,
// Tonight's Table, the context builder and the continuity checker so every
// surface clamps and reads a clock the same way.

import type { PlotClock } from '../types/index';

/** The clock sizes the UI offers. Any positive integer is still valid data. */
export const PLOT_CLOCK_SIZES: readonly number[] = [4, 6, 8];

/**
 * Returns a well-formed copy of a clock — integer `segments >= 1`, `filled`
 * clamped to `[0, segments]` — or null when there is no usable clock at all
 * (missing, or a non-positive / non-numeric segment count from a hand-edited
 * save). Never mutates its argument.
 */
export function normalizePlotClock(clock: PlotClock | null | undefined): PlotClock | null {
  if (!clock) return null;
  const segments = Number.isFinite(clock.segments) ? Math.floor(clock.segments) : 0;
  if (segments < 1) return null;
  const rawFilled = Number.isFinite(clock.filled) ? Math.floor(clock.filled) : 0;
  const filled = Math.min(Math.max(rawFilled, 0), segments);
  return { segments, filled };
}

/** True when every segment is filled — the plot's "if ignored" move is due. */
export function isPlotClockExpired(clock: PlotClock | null | undefined): boolean {
  const normalized = normalizePlotClock(clock);
  return !!normalized && normalized.filled >= normalized.segments;
}

/** `3/6` — the compact reading every surface prints. */
export function formatPlotClock(clock: PlotClock | null | undefined): string {
  const normalized = normalizePlotClock(clock);
  return normalized ? `${normalized.filled}/${normalized.segments}` : '';
}
