// @vitest-environment jsdom
/**
 * wp-h-tools-viz — finding #82
 *
 * Every interactive surface of the plot timeline is a bare `<div onClick>`:
 * the plot label rows (PlotTimeline.tsx:346), the session header columns
 * (:382), the session cells (:442) and the health-warning banners (:510).
 * None carries `role="button"`, `tabIndex` or an `onKeyDown`, so a keyboard or
 * screen-reader user cannot open a plot or a session from the timeline at all.
 * The DiceRoller history list has the same defect
 * (components/tools/DiceRoller.tsx:245 — a `cursor-pointer` div whose onClick
 * is the only way to log a past roll).
 *
 * Contract: each of these surfaces must expose role="button" (native <button>
 * preferred), be reachable by Tab (tabIndex >= 0), keep working on click, and
 * — when it is NOT a native <button> — activate on Enter and Space.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import type { Plot, SessionLog } from '../../types/index';

// PlotTimeline observes its scroll container for overflow arrows; jsdom has no
// ResizeObserver, so stub it before the component mounts.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;

const { PlotTimeline } = await import('../../components/visualizers/PlotTimeline');
const { DiceRoller } = await import('../../components/tools/DiceRoller');

afterEach(() => {
  cleanup();
});

/**
 * Asserts an element is genuinely keyboard-operable. A native <button> gets
 * Enter/Space handling from the browser; anything else must implement it.
 */
const expectKeyboardOperable = (el: HTMLElement, activated: () => boolean, reset: () => void) => {
  expect(el.tabIndex, `${el.tagName} must be reachable with Tab`).toBeGreaterThanOrEqual(0);
  if (el.tagName !== 'BUTTON') {
    reset();
    fireEvent.keyDown(el, { key: 'Enter', code: 'Enter' });
    expect(activated(), 'non-native button must activate on Enter').toBe(true);
    reset();
    fireEvent.keyDown(el, { key: ' ', code: 'Space' });
    expect(activated(), 'non-native button must activate on Space').toBe(true);
  }
};

const plots: Plot[] = [
  {
    id: 'plot-1',
    title: 'The Drowned Heir',
    description: 'A lost claimant surfaces.',
    status: 'active',
    relatedEntityIds: [],
  },
];

const sessions: SessionLog[] = [
  {
    id: 'session-1',
    title: 'Salt and Silence',
    status: 'completed',
    sessionDate: '2026-05-01T00:00:00.000Z',
    plannedSceneIds: [],
    prepNotes: '',
    relatedPlotIds: ['plot-1'],
    runningNotes: '',
    structuredNotes: [],
    encounterLog: [],
  } as unknown as SessionLog,
];

describe('#82 PlotTimeline keyboard access', () => {
  it('exposes each plot row as a keyboard-operable button', () => {
    const onSelectPlot = vi.fn();
    render(<PlotTimeline plots={plots} sessionLogs={sessions} onSelectPlot={onSelectPlot} />);

    const rows = screen.queryAllByRole('button', { name: /The Drowned Heir/i });
    expect(rows.length, 'plot rows must expose role="button"').toBeGreaterThan(0);

    const row = rows[0];
    fireEvent.click(row);
    expect(onSelectPlot).toHaveBeenCalledWith('plot-1');

    expectKeyboardOperable(
      row,
      () => onSelectPlot.mock.calls.length > 0,
      () => onSelectPlot.mockClear()
    );
  });

  it('exposes each session header as a keyboard-operable button', () => {
    const onSelectSession = vi.fn();
    render(<PlotTimeline plots={plots} sessionLogs={sessions} onSelectSession={onSelectSession} />);

    const headers = screen.queryAllByRole('button', { name: /Salt and Silence/i });
    expect(headers.length, 'session headers must expose role="button"').toBeGreaterThan(0);

    const header = headers[0];
    fireEvent.click(header);
    expect(onSelectSession).toHaveBeenCalledWith('session-1');

    expectKeyboardOperable(
      header,
      () => onSelectSession.mock.calls.length > 0,
      () => onSelectSession.mockClear()
    );
  });
});

describe('#82 DiceRoller history keyboard access', () => {
  it('exposes each history row as a keyboard-operable button', () => {
    const onLogRoll = vi.fn();
    render(<DiceRoller onLogRoll={onLogRoll} />);

    const input = screen.getByPlaceholderText(/2d6\+4/i);
    fireEvent.change(input, { target: { value: '1d20' } });
    fireEvent.click(screen.getByRole('button', { name: /^roll$/i }));

    // The history row shows "1d20 [n] = n" — it must be a real control, not a
    // cursor-pointer div, since clicking it is the only way to log a past roll.
    const historyRows = screen
      .queryAllByRole('button')
      .filter(b => /1d20/.test(b.textContent ?? '') && /=/.test(b.textContent ?? ''));
    expect(historyRows.length, 'history rows must expose role="button"').toBeGreaterThan(0);

    const row = historyRows[0];
    fireEvent.click(row);
    expect(onLogRoll).toHaveBeenCalledTimes(1);

    expectKeyboardOperable(
      row,
      () => onLogRoll.mock.calls.length > 0,
      () => onLogRoll.mockClear()
    );
  });
});
