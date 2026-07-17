import { describe, it, expect } from 'vitest';
import { removeCombatantFromEncounter } from '../../components/tools/CombatTracker';
import type { Combatant, Encounter } from '../../types/Encounter';

const makeCombatant = (id: string, initiative: number): Combatant => ({
    id,
    name: id,
    type: 'monster',
    initiative,
    hp: 10,
    maxHp: 10,
    notes: '',
});

const makeEncounter = (turnIndex: number): Encounter => ({
    id: 'enc1',
    round: 1,
    turnIndex,
    combatants: [
        makeCombatant('A', 20),
        makeCombatant('B', 15),
        makeCombatant('C', 10),
        makeCombatant('D', 5),
    ],
});

describe('removeCombatantFromEncounter', () => {
    it('keeps the active combatant active when someone before them is removed', () => {
        // [A(0), B(1), C(2,active), D(3)] -> remove B -> [A, C, D], C must stay active
        const encounter = makeEncounter(2);
        const next = removeCombatantFromEncounter(encounter, 'B');
        expect(next.combatants.map(c => c.id)).toEqual(['A', 'C', 'D']);
        expect(next.combatants[next.turnIndex].id).toBe('C');
    });

    it('keeps the active combatant active when someone after them is removed', () => {
        const encounter = makeEncounter(1); // B is active
        const next = removeCombatantFromEncounter(encounter, 'D');
        expect(next.combatants.map(c => c.id)).toEqual(['A', 'B', 'C']);
        expect(next.combatants[next.turnIndex].id).toBe('B');
    });

    it('does not change the active index when the active combatant removes itself', () => {
        const encounter = makeEncounter(2); // C is active
        const next = removeCombatantFromEncounter(encounter, 'C');
        expect(next.combatants.map(c => c.id)).toEqual(['A', 'B', 'D']);
        // Original behavior preserved: index stays put (now pointing at D, the combatant
        // that slides into the vacated slot), since turnIndex(2) is still in bounds.
        expect(next.turnIndex).toBe(2);
        expect(next.combatants[next.turnIndex].id).toBe('D');
    });

    it('resets turnIndex to 0 when the active combatant at the end of the list is removed', () => {
        const encounter = makeEncounter(3); // D is active, last in list
        const next = removeCombatantFromEncounter(encounter, 'D');
        expect(next.combatants.map(c => c.id)).toEqual(['A', 'B', 'C']);
        expect(next.turnIndex).toBe(0);
    });

    it('resets turnIndex to 0 when the last combatant is removed', () => {
        const encounter: Encounter = { id: 'enc1', round: 1, turnIndex: 0, combatants: [makeCombatant('A', 20)] };
        const next = removeCombatantFromEncounter(encounter, 'A');
        expect(next.combatants).toHaveLength(0);
        expect(next.turnIndex).toBe(0);
    });

    it('is a no-op on turnIndex when removing an id that is not present', () => {
        const encounter = makeEncounter(2);
        const next = removeCombatantFromEncounter(encounter, 'not-real');
        expect(next.combatants.map(c => c.id)).toEqual(['A', 'B', 'C', 'D']);
        expect(next.turnIndex).toBe(2);
    });
});
