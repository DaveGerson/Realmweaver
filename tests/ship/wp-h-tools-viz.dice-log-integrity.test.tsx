// @vitest-environment jsdom
/**
 * wp-h-tools-viz — finding #113 (components/tools/DiceRoller.tsx:106-119)
 *
 * `handleLogRoll` reuses the *history entry's* `roll.id` for the emitted
 * `DiceRoll`, and `campaignService.addDiceRollToSession` pushes it
 * unconditionally. Logging the same roll twice (the "Log to Session" button
 * plus a click on the same row in the history list) therefore writes two
 * entries with an identical `id` into `session.diceRolls`, making any
 * id-keyed render or delete over that array ambiguous.
 *
 * It also emits `roll.results` (every die) rather than `roll.keptResults`, so a
 * logged `4d6kh3` shows four dice next to a total computed from three.
 *
 * Contract:
 *  1. Every emitted DiceRoll carries a freshly minted id — logging the same
 *     history entry twice yields two distinct ids.
 *  2. The dice recorded on the emitted DiceRoll reconcile with the recorded
 *     total: for a keep formula the logged dice are the kept ones (either as
 *     `results` or an added `keptResults` field), not the full pool.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import type { DiceRoll } from '../../types/index';

const { DiceRoller } = await import('../../components/tools/DiceRoller');

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

const rollFormula = (formula: string) => {
  const input = screen.getByPlaceholderText(/2d6\+4/i);
  fireEvent.change(input, { target: { value: formula } });
  fireEvent.click(screen.getByRole('button', { name: /^roll$/i }));
};

describe('#113 logged dice rolls', () => {
  it('mints a fresh id each time the same roll is logged', () => {
    const onLogRoll = vi.fn();
    render(<DiceRoller onLogRoll={onLogRoll} />);

    rollFormula('2d6+1');

    const logButton = screen.getByRole('button', { name: /log to session/i });
    fireEvent.click(logButton);
    fireEvent.click(logButton);

    expect(onLogRoll).toHaveBeenCalledTimes(2);
    const first: DiceRoll = onLogRoll.mock.calls[0][0];
    const second: DiceRoll = onLogRoll.mock.calls[1][0];
    expect(first.id).toBeTruthy();
    expect(second.id).toBeTruthy();
    // The bug: both entries carry the history entry's id, so the session log
    // ends up with duplicate keys.
    expect(second.id).not.toBe(first.id);
  });

  it('records the kept dice so they add up to the recorded total', () => {
    const onLogRoll = vi.fn();
    render(<DiceRoller onLogRoll={onLogRoll} />);

    rollFormula('4d6kh3');
    fireEvent.click(screen.getByRole('button', { name: /log to session/i }));

    expect(onLogRoll).toHaveBeenCalledTimes(1);
    const logged = onLogRoll.mock.calls[0][0] as DiceRoll & { keptResults?: number[] };
    const recordedDice = logged.keptResults ?? logged.results;

    // 4d6kh3: three dice are kept, and with no modifier they must sum to total.
    expect(recordedDice).toHaveLength(3);
    expect(recordedDice.reduce((sum, v) => sum + v, 0)).toBe(logged.total);
  });
});
