// @vitest-environment jsdom
/**
 * SPEC — components/views/session/QuickTablesPanel.tsx (§4.9 of the
 * lazy-dm-lens research report; Quick Tables)
 *
 * 1. **Collapsed by default**, using the exact toggle pattern as Quick
 *    Tools' own Dice Roller — no table rows, no result, until expanded.
 * 2. **No AI, no backend, no latency** — rolling never touches a mocked or
 *    real AI service; it works purely off `utils/diceUtils.ts`'s `rollDice`
 *    and the hand-authored tables in `data/randomTables.ts`.
 * 3. **One tap rolls and shows the result** immediately (no loading state is
 *    possible — everything here is synchronous).
 * 4. **"Log it" writes a note** via `campaignService.addSessionRunnerNote`
 *    (a `'manual'`-type entry by that method's own default) naming the
 *    table, the die, the roll, and the result text; a second click doesn't
 *    duplicate the note (the button disables once logged).
 * 5. **Rolling a different table resets the logged state**, so the new
 *    result can be logged on its own.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';

const h = vi.hoisted(() => ({
  addSessionRunnerNote: vi.fn(),
}));

vi.mock('@/services/campaignService', () => ({
  campaignService: {
    addSessionRunnerNote: h.addSessionRunnerNote,
  },
}));

const { QuickTablesPanel } = await import('../components/views/session/QuickTablesPanel');

const toggle = () => screen.getByRole('button', { name: /quick tables/i });
const tableRow = (title: RegExp) => screen.getByRole('button', { name: title });

beforeEach(() => {
  vi.clearAllMocks();
  // Every roll on a 1-indexed die lands on 1 with Math.random pinned to 0
  // (Math.floor(0 * sides) + 1 === 1) — deterministic without touching
  // utils/diceUtils.ts, which is read-only for this lane.
  vi.spyOn(Math, 'random').mockReturnValue(0);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// --- 1. collapsed by default -------------------------------------------------

describe('collapsed by default', () => {
  it('shows only the toggle until expanded', () => {
    render(<QuickTablesPanel />);
    expect(toggle()).toBeTruthy();
    expect(screen.queryByRole('button', { name: /the watch notices/i })).toBeNull();
  });
});

// --- 2 & 3. no AI, one tap rolls and shows the result -------------------------

describe('one tap rolls with no AI and no latency', () => {
  it('lists every table once expanded', () => {
    render(<QuickTablesPanel />);
    fireEvent.click(toggle());

    expect(tableRow(/tavern interruption/i)).toBeTruthy();
    expect(tableRow(/the watch notices/i)).toBeTruthy();
    expect(tableRow(/a rumor making the rounds/i)).toBeTruthy();
    expect(tableRow(/complication on the road/i)).toBeTruthy();
    expect(tableRow(/what.s in the pocket/i)).toBeTruthy();
  });

  it('shows the rolled result immediately, synchronously, on click', () => {
    render(<QuickTablesPanel />);
    fireEvent.click(toggle());
    fireEvent.click(tableRow(/the watch notices/i));

    // Math.random pinned to 0 -> roll 1 on a d6 -> the table's first entry.
    expect(screen.getByText(/rolled 1/i)).toBeTruthy();
    expect(screen.getByText(/a weapon, not quite hidden well enough/i)).toBeTruthy();
  });

  it('replaces the result when a different table is rolled', () => {
    render(<QuickTablesPanel />);
    fireEvent.click(toggle());
    fireEvent.click(tableRow(/the watch notices/i));
    expect(screen.getByText(/a weapon, not quite hidden well enough/i)).toBeTruthy();

    fireEvent.click(tableRow(/tavern interruption/i));
    expect(screen.queryByText(/a weapon, not quite hidden well enough/i)).toBeNull();
    expect(screen.getByText(/a drunk mistakes one of you/i)).toBeTruthy();
  });
});

// --- 4. Log it -----------------------------------------------------------------

describe('Log it writes a manual note, once', () => {
  it('writes the table, die, roll, and result into a session note', () => {
    render(<QuickTablesPanel />);
    fireEvent.click(toggle());
    fireEvent.click(tableRow(/the watch notices/i));

    fireEvent.click(screen.getByRole('button', { name: /log it/i }));

    expect(h.addSessionRunnerNote).toHaveBeenCalledTimes(1);
    const content = h.addSessionRunnerNote.mock.calls[0][0] as string;
    expect(content).toContain('The Watch Notices');
    expect(content).toContain('d6');
    expect(content).toContain('rolled 1');
    expect(content).toContain('A weapon, not quite hidden well enough.');
  });

  it('disables further logging of the same roll', () => {
    render(<QuickTablesPanel />);
    fireEvent.click(toggle());
    fireEvent.click(tableRow(/the watch notices/i));
    fireEvent.click(screen.getByRole('button', { name: /log it/i }));

    expect(h.addSessionRunnerNote).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/^logged$/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /logged/i }));
    expect(h.addSessionRunnerNote).toHaveBeenCalledTimes(1);
  });

  it('resets the logged state when a new table is rolled', () => {
    render(<QuickTablesPanel />);
    fireEvent.click(toggle());
    fireEvent.click(tableRow(/the watch notices/i));
    fireEvent.click(screen.getByRole('button', { name: /log it/i }));
    expect(screen.getByText(/^logged$/i)).toBeTruthy();

    fireEvent.click(tableRow(/tavern interruption/i));
    expect(screen.getByRole('button', { name: /^log it$/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^log it$/i }));
    expect(h.addSessionRunnerNote).toHaveBeenCalledTimes(2);
  });
});
