// @vitest-environment jsdom
/**
 * wp-h-tools-viz — findings #79 and #80 (components/tools/CombatTracker.tsx)
 *
 * #79 `sortInitiative` (line ~105) reorders draft.combatants and then does
 *     `draft.turnIndex = 0` unconditionally, leaving `round` untouched. That
 *     contradicts the identity-preserving care in `removeCombatantFromEncounter`:
 *     sorting mid-combat silently rewinds the turn pointer to the top of the
 *     order without incrementing the round, so combatants who already acted
 *     act again in the same round and the active combatant is skipped.
 *
 * #80 The "Increase HP" handler (line ~222) is
 *     `hp: Math.min(combatant.maxHp, combatant.hp + 1)` while the Max input's
 *     onChange coerces an empty field to 0. Clearing Max (an ordinary step
 *     when retyping it) therefore makes the up-arrow snap current HP to 0 and
 *     flag the combatant as downed. The decrease button has no matching clamp,
 *     so the two directions are asymmetric.
 *
 * Contract:
 *  #79 Sorting preserves whose turn it is (by combatant identity) and never
 *      changes `round`. turnIndex falls back to 0 only when there is no
 *      resolvable active combatant.
 *  #80 Incrementing HP never *lowers* current HP. With maxHp unset/0 the
 *      up-arrow must yield hp + 1.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import type { Combatant, Encounter, NPC, PlayerCharacter } from '../../types/index';

const { CombatTracker } = await import('../../components/tools/CombatTracker');
const { ConfirmDialogProvider } = await import('../../hooks/useConfirmDialog');

const makeCombatant = (id: string, initiative: number, over: Partial<Combatant> = {}): Combatant => ({
  id,
  name: id,
  type: 'monster',
  initiative,
  hp: 10,
  maxHp: 10,
  notes: '',
  ...over,
});

const renderTracker = (encounter: Encounter) => {
  const onUpdate = vi.fn();
  render(
    <ConfirmDialogProvider>
      <CombatTracker
        encounter={encounter}
        onUpdate={onUpdate}
        campaignNpcs={[] as NPC[]}
        campaignPcs={[] as PlayerCharacter[]}
      />
    </ConfirmDialogProvider>
  );
  return onUpdate;
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('#79 Sort Initiative preserves the active combatant and the round', () => {
  it('keeps the same combatant active after sorting mid-combat', () => {
    // Round 3, "Slow" (initiative 5) is currently acting at index 0.
    // Sorting puts "Fast" (initiative 20) first — but it is still Slow's turn.
    const encounter: Encounter = {
      id: 'enc-1',
      round: 3,
      turnIndex: 0,
      combatants: [makeCombatant('Slow', 5), makeCombatant('Fast', 20)],
    };
    const onUpdate = renderTracker(encounter);

    fireEvent.click(screen.getByRole('button', { name: /sort initiative/i }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const next: Encounter = onUpdate.mock.calls[0][0];
    expect(next.combatants.map(c => c.id)).toEqual(['Fast', 'Slow']);
    // The bug: turnIndex is reset to 0, handing the turn back to Fast.
    expect(next.combatants[next.turnIndex]?.id).toBe('Slow');
    expect(next.turnIndex).toBe(1);
  });

  it('does not change the round counter when sorting', () => {
    const encounter: Encounter = {
      id: 'enc-2',
      round: 3,
      turnIndex: 2,
      combatants: [
        makeCombatant('A', 12),
        makeCombatant('B', 18),
        makeCombatant('C', 4),
        makeCombatant('D', 9),
      ],
    };
    const onUpdate = renderTracker(encounter);

    fireEvent.click(screen.getByRole('button', { name: /sort initiative/i }));

    const next: Encounter = onUpdate.mock.calls[0][0];
    expect(next.round).toBe(3);
    expect(next.combatants.map(c => c.initiative)).toEqual([18, 12, 9, 4]);
    expect(next.combatants[next.turnIndex]?.id).toBe('C');
  });
});

describe('#80 Increase HP must not drop a combatant to 0 when Max HP is blank', () => {
  it('increments current HP even when maxHp has been cleared to 0', () => {
    const encounter: Encounter = {
      id: 'enc-3',
      round: 1,
      turnIndex: 0,
      // maxHp 0 is exactly what the Max input's `parseInt(value) || 0` produces
      // when the DM clears the field to retype it.
      combatants: [makeCombatant('Ogre', 10, { hp: 12, maxHp: 0 })],
    };
    const onUpdate = renderTracker(encounter);

    fireEvent.click(screen.getByRole('button', { name: /increase hp/i }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const next: Encounter = onUpdate.mock.calls[0][0];
    // The bug: Math.min(0, 13) === 0 — the combatant reads as downed.
    expect(next.combatants[0].hp).toBe(13);
  });
});
