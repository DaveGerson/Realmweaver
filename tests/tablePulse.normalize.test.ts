/**
 * Table Pulse (lazy-dm-research.md §4.3) — `PlayerCharacter.playerFlags`
 * =============================================================================
 * This is storyteller-first-design.md P5's narrowest slice: `playerFlags`
 * only. `Campaign.pillars` and `PlayerCharacter.hooks[]` are NOT built here.
 *
 * `normalizePlayerCharacter` deep-merges the nested `characterSocial` /
 * `characterStatistics` blocks onto `createDefaultPlayerCharacter()` (see
 * utils/entityUtils.ts and finding #63's coverage in tests/entityUtils.test.ts).
 * `playerFlags` is a TOP-LEVEL, non-id-bearing optional field — a sibling of
 * `playerName`, not nested inside either deep-merged block — so it must pass
 * through the `{ ...defaults, ...pc }` spread untouched: `defaults` never sets
 * it, so whatever `pc` carries (an array, or nothing at all) survives verbatim.
 */

import { describe, it, expect } from 'vitest';
import { createDefaultPlayerCharacter, normalizePlayerCharacter } from '../utils/entityUtils';
import type { PlayerCharacter } from '../types/index';

function makeFullPc(overrides: Partial<PlayerCharacter> = {}): PlayerCharacter {
    return {
        id: 'pc-1',
        ...createDefaultPlayerCharacter(),
        playerName: 'Dana',
        characterSocial: {
            characterName: 'Kaelen', background: 'Soldier', species: 'Human',
            personality: 'Stoic', appearance: '', backstory: '', ideals: '', bonds: '', flaws: '',
        },
        characterStatistics: {
            classes: { charClass: 'Fighter', level: 3 },
            attributes: { strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 11, charisma: 8 },
            skills: { ...createDefaultPlayerCharacter().characterStatistics.skills, athletics: 'proficient' },
            actions: ['Longsword'],
            specialActions: ['Second Wind'],
        },
        ...overrides,
    };
}

describe('normalizePlayerCharacter — playerFlags (Table Pulse §4.3)', () => {
    it('keeps a populated playerFlags array through normalization, verbatim', () => {
        const pc = makeFullPc({ playerFlags: ['wants more tactical combat', 'loves a good monologue'] });

        const normalized = normalizePlayerCharacter(pc);

        expect(normalized.playerFlags).toEqual(['wants more tactical combat', 'loves a good monologue']);
    });

    it('leaves playerFlags undefined for a PC that never had the field, rather than defaulting to []', () => {
        const pc = makeFullPc();
        // Sanity: the fixture itself carries no playerFlags key.
        expect('playerFlags' in pc).toBe(false);

        const normalized = normalizePlayerCharacter(pc);

        expect(normalized.playerFlags).toBeUndefined();
        // A consumer reading it defensively renders safely either way.
        expect(normalized.playerFlags ?? []).toEqual([]);
    });

    it('preserves an explicit empty array as an empty array (does not collapse it to undefined)', () => {
        const pc = makeFullPc({ playerFlags: [] });

        const normalized = normalizePlayerCharacter(pc);

        expect(normalized.playerFlags).toEqual([]);
    });

    it('preserves playerFlags alongside backfilling an otherwise-malformed PC missing characterStatistics entirely', () => {
        // Mirrors tests/entityUtils.test.ts's finding #63 malformed-PC case,
        // but with playerFlags present — the two concerns (nested-block
        // backfill, top-level field passthrough) must not interfere.
        const malformed = {
            id: 'pc-ghost',
            playerName: 'Riley',
            characterSocial: { characterName: 'Ghost' },
            playerFlags: ['here for the mystery, not the fighting'],
        } as unknown as PlayerCharacter;

        const normalized = normalizePlayerCharacter(malformed);

        expect(normalized.playerFlags).toEqual(['here for the mystery, not the fighting']);
        // The nested backfill still happens independently.
        expect(normalized.characterStatistics.classes).toEqual({ charClass: '', level: 1 });
        expect(normalized.characterStatistics.actions).toEqual([]);
    });

    it('does not mutate the original playerFlags array reference into a new default', () => {
        const flags = ['wants more horror'];
        const pc = makeFullPc({ playerFlags: flags });

        const normalized = normalizePlayerCharacter(pc);

        expect(normalized.playerFlags).toBe(flags);
    });
});
