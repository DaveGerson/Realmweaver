import { describe, it, expect } from 'vitest';
import {
    removeCombatantFromEncounter,
    advanceTurn,
    rewindTurn,
    applyHpDelta,
    applyHpDeltaToCombatant,
    addConditionToCombatant,
    removeConditionFromCombatant,
    tickConditionDurations,
    parseNpcCombatStats,
    deriveDifficultyInputs,
    STANDARD_CONDITIONS,
} from '../../components/tools/CombatTracker';
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

describe('applyHpDelta', () => {
    it('subtracts damage and floors at 0', () => {
        expect(applyHpDelta({ hp: 10, maxHp: 10 }, 4, 'damage')).toBe(6);
        expect(applyHpDelta({ hp: 3, maxHp: 10 }, 12, 'damage')).toBe(0);
    });

    it('adds healing and caps at maxHp', () => {
        expect(applyHpDelta({ hp: 3, maxHp: 10 }, 4, 'heal')).toBe(7);
        expect(applyHpDelta({ hp: 8, maxHp: 10 }, 20, 'heal')).toBe(10);
    });

    it('heals from 0 when HP was driven negative by the stepper', () => {
        expect(applyHpDelta({ hp: -3, maxHp: 10 }, 2, 'heal')).toBe(2);
    });

    it('does not cap healing when maxHp is unset (0)', () => {
        expect(applyHpDelta({ hp: 5, maxHp: 0 }, 10, 'heal')).toBe(15);
    });

    it('never lowers HP already above max when healing', () => {
        expect(applyHpDelta({ hp: 14, maxHp: 10 }, 3, 'heal')).toBe(14);
    });

    it('ignores zero, negative and non-finite amounts', () => {
        expect(applyHpDelta({ hp: 5, maxHp: 10 }, 0, 'damage')).toBe(5);
        expect(applyHpDelta({ hp: 5, maxHp: 10 }, -4, 'heal')).toBe(5);
        expect(applyHpDelta({ hp: 5, maxHp: 10 }, NaN, 'damage')).toBe(5);
    });

    it('applyHpDeltaToCombatant only touches the target combatant', () => {
        const next = applyHpDeltaToCombatant(makeEncounter(0), 'B', 7, 'damage');
        expect(next.combatants.map(c => c.hp)).toEqual([10, 3, 10, 10]);
    });
});

describe('conditions', () => {
    it('offers the 5e condition list plus exhaustion and concentration', () => {
        expect(STANDARD_CONDITIONS).toHaveLength(16);
        expect(STANDARD_CONDITIONS).toContain('Concentrating');
        expect(STANDARD_CONDITIONS).toContain('Exhaustion');
    });

    it('adds a condition to a combatant with no conditions field (legacy data)', () => {
        const next = addConditionToCombatant(makeEncounter(0), 'A', 'Poisoned', 3);
        expect(next.combatants[0].conditions).toEqual([{ name: 'Poisoned', roundsRemaining: 3 }]);
    });

    it('treats a missing or invalid duration as indefinite', () => {
        let enc = addConditionToCombatant(makeEncounter(0), 'A', 'Prone');
        enc = addConditionToCombatant(enc, 'A', 'Blinded', 0);
        expect(enc.combatants[0].conditions).toEqual([{ name: 'Prone' }, { name: 'Blinded' }]);
    });

    it('re-applying a condition replaces its duration instead of duplicating it', () => {
        let enc = addConditionToCombatant(makeEncounter(0), 'A', 'Stunned', 1);
        enc = addConditionToCombatant(enc, 'A', 'stunned', 4);
        expect(enc.combatants[0].conditions).toEqual([{ name: 'stunned', roundsRemaining: 4 }]);
    });

    it('removes a condition by name', () => {
        let enc = addConditionToCombatant(makeEncounter(0), 'A', 'Prone');
        enc = addConditionToCombatant(enc, 'A', 'Charmed');
        enc = removeConditionFromCombatant(enc, 'A', 'prone');
        expect(enc.combatants[0].conditions).toEqual([{ name: 'Charmed' }]);
    });

    it('tickConditionDurations decrements timed conditions and expires those that hit 0', () => {
        let enc = addConditionToCombatant(makeEncounter(0), 'A', 'Poisoned', 2);
        enc = addConditionToCombatant(enc, 'A', 'Frightened', 1);
        enc = addConditionToCombatant(enc, 'A', 'Concentrating');
        const next = tickConditionDurations(enc);
        expect(next.combatants[0].conditions).toEqual([
            { name: 'Poisoned', roundsRemaining: 1 },
            { name: 'Concentrating' },
        ]);
    });

    it('advanceTurn ticks durations only when the round increments', () => {
        const enc = addConditionToCombatant(makeEncounter(0), 'C', 'Restrained', 1);
        const midRound = advanceTurn(enc); // A -> B, same round
        expect(midRound.round).toBe(1);
        expect(midRound.combatants[2].conditions).toEqual([{ name: 'Restrained', roundsRemaining: 1 }]);

        const endOfRound = advanceTurn({ ...enc, turnIndex: 3 }); // D -> A, round 2
        expect(endOfRound.round).toBe(2);
        expect(endOfRound.combatants[2].conditions).toEqual([]);
    });

    it('rewindTurn leaves condition durations alone', () => {
        const enc = addConditionToCombatant({ ...makeEncounter(0), round: 2 }, 'A', 'Prone', 2);
        const prev = rewindTurn(enc);
        expect(prev.round).toBe(1);
        expect(prev.combatants[0].conditions).toEqual([{ name: 'Prone', roundsRemaining: 2 }]);
    });
});

describe('parseNpcCombatStats', () => {
    it('extracts HP, AC and CR from a freeform stat string', () => {
        expect(parseNpcCombatStats('AC 15, HP 22, CR 1/2')).toEqual({ hp: 22, ac: 15, cr: '1/2' });
        expect(parseNpcCombatStats('Armor Class: 17; Hit Points 110; Challenge 7')).toEqual({ hp: 110, ac: 17, cr: '7' });
    });

    it('returns nulls for missing fields and ignores invalid CRs', () => {
        expect(parseNpcCombatStats(undefined)).toEqual({ hp: null, ac: null, cr: null });
        expect(parseNpcCombatStats('A cunning spy. CR 45')).toEqual({ hp: null, ac: null, cr: null });
    });
});

describe('deriveDifficultyInputs', () => {
    const pc = (id: string, level?: number): Combatant => ({ ...makeCombatant(id, 10), type: 'pc', level });

    it('uses PC levels and enemy CRs, skipping enemies without a valid CR', () => {
        const combatants: Combatant[] = [
            pc('Hero', 3),
            pc('Sidekick', 2),
            { ...makeCombatant('Orc', 10), cr: '1/2' },
            { ...makeCombatant('Rat', 10) },
            { ...makeCombatant('Boss', 10), cr: '??' },
        ];
        const out = deriveDifficultyInputs(combatants, 5, 4);
        expect(out.partyLevels).toEqual([3, 2]);
        expect(out.monsterCRs).toEqual(['1/2']);
        expect(out.hasPcs).toBe(true);
        expect(out.needsFallbackLevel).toBe(false);
    });

    it('falls back to the party level for PCs without one', () => {
        const out = deriveDifficultyInputs([pc('Hero', 3), pc('Unknown')], 6, 4);
        expect(out.partyLevels).toEqual([3, 6]);
        expect(out.needsFallbackLevel).toBe(true);
    });

    it('assumes a party of fallbackPartySize × fallbackLevel when no PCs are in the fight', () => {
        const out = deriveDifficultyInputs([{ ...makeCombatant('Ogre', 10), cr: '2' }], 2, 3);
        expect(out.partyLevels).toEqual([2, 2, 2]);
        expect(out.hasPcs).toBe(false);
    });
});
