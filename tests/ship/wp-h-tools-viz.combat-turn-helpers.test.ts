/**
 * wp-h-tools-viz — finding #84 (components/tools/CombatTracker.tsx:81-110)
 *
 * `nextTurn`, `prevTurn` and `sortInitiative` are inline closures inside the
 * component. They own the round counter, the wrap-around at both ends and the
 * `Math.max(1, round - 1)` floor, and nothing tests them —
 * tests/components/CombatTracker.test.ts covers only the already-extracted
 * `removeCombatantFromEncounter`. `prevTurn` is not even reachable from the
 * rendered UI (there is no "Previous Turn" control), so it cannot be exercised
 * through the component at all.
 *
 * Contract (the finding's suggested fix): export pure `produce`-based helpers
 * next to `removeCombatantFromEncounter` —
 *
 *   export const advanceTurn = (encounter: Encounter): Encounter
 *   export const rewindTurn  = (encounter: Encounter): Encounter
 *   export const sortByInitiative = (encounter: Encounter): Encounter
 *
 * and have the component call them. The tests below pin the behaviour those
 * helpers must have. They use a namespace import and property access (rather
 * than a named import) so that today they fail with a readable assertion
 * instead of a module-resolution error.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { Combatant, Encounter } from '../../types/Encounter';

type EncounterFn = (encounter: Encounter) => Encounter;

let mod: Record<string, unknown>;

beforeAll(async () => {
  mod = (await import('../../components/tools/CombatTracker')) as unknown as Record<string, unknown>;
});

const helper = (name: string): EncounterFn => {
  const fn = mod[name];
  expect(typeof fn, `CombatTracker must export a pure \`${name}\` helper`).toBe('function');
  return fn as EncounterFn;
};

const makeCombatant = (id: string, initiative: number): Combatant => ({
  id,
  name: id,
  type: 'monster',
  initiative,
  hp: 10,
  maxHp: 10,
  notes: '',
});

const encounterOf = (round: number, turnIndex: number, combatants: Combatant[]): Encounter => ({
  id: 'enc-1',
  round,
  turnIndex,
  combatants,
});

const roster = () => [
  makeCombatant('A', 20),
  makeCombatant('B', 15),
  makeCombatant('C', 10),
];

describe('#84 advanceTurn', () => {
  it('moves to the next combatant without touching the round', () => {
    const next = helper('advanceTurn')(encounterOf(2, 0, roster()));
    expect(next.turnIndex).toBe(1);
    expect(next.round).toBe(2);
  });

  it('wraps past the last combatant and increments the round', () => {
    const next = helper('advanceTurn')(encounterOf(2, 2, roster()));
    expect(next.turnIndex).toBe(0);
    expect(next.round).toBe(3);
  });

  it('is a no-op on an empty encounter', () => {
    const next = helper('advanceTurn')(encounterOf(1, 0, []));
    expect(next.turnIndex).toBe(0);
    expect(next.round).toBe(1);
  });
});

describe('#84 rewindTurn', () => {
  it('steps back one combatant without touching the round', () => {
    const next = helper('rewindTurn')(encounterOf(2, 2, roster()));
    expect(next.turnIndex).toBe(1);
    expect(next.round).toBe(2);
  });

  it('wraps back to the last combatant and decrements the round', () => {
    const next = helper('rewindTurn')(encounterOf(3, 0, roster()));
    expect(next.turnIndex).toBe(2);
    expect(next.round).toBe(2);
  });

  it('floors the round at 1 when rewinding from the very first turn', () => {
    const next = helper('rewindTurn')(encounterOf(1, 0, roster()));
    expect(next.turnIndex).toBe(2);
    expect(next.round).toBe(1);
  });

  it('is a no-op on an empty encounter', () => {
    const next = helper('rewindTurn')(encounterOf(1, 0, []));
    expect(next.turnIndex).toBe(0);
    expect(next.round).toBe(1);
  });
});

describe('#84 sortByInitiative', () => {
  it('sorts descending while keeping the active combatant active (see #79)', () => {
    const encounter = encounterOf(3, 0, [
      makeCombatant('Slow', 5),
      makeCombatant('Fast', 20),
    ]);
    const next = helper('sortByInitiative')(encounter);
    expect(next.combatants.map(c => c.id)).toEqual(['Fast', 'Slow']);
    expect(next.combatants[next.turnIndex]?.id).toBe('Slow');
    expect(next.round).toBe(3);
  });

  it('is a no-op on an empty encounter', () => {
    const next = helper('sortByInitiative')(encounterOf(1, 0, []));
    expect(next.combatants).toEqual([]);
    expect(next.turnIndex).toBe(0);
  });
});
