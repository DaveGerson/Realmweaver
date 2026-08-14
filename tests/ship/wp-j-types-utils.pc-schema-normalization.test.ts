/**
 * wp-j-types-utils — finding #34 (service half)
 *
 * `CharacterStatistics` declares `actions` / `specialActions` (and
 * `classes` / `attributes` / `skills`) as REQUIRED, but the PDF-parsing
 * schema (services/ai/evocationWizard.ts:8) only marks
 * `['classes','attributes','skills']` required, and
 * `parseCharacterSheetPdf` returns the model response verbatim.
 * `campaignService.createPlayerCharacterFromPdf` forwards that object into
 * `createPlayerCharacter`, which just spreads it with a fresh id — no
 * normalization anywhere. A sheet whose Features & Traits page is blank
 * therefore lands in the campaign (and in localStorage) missing
 * `specialActions`, and opening it explodes in PlayerCharacterEditor:241
 * (`.actions.map` on undefined).
 *
 * Contract pinned here: whatever a PDF parse returns, the PlayerCharacter
 * that reaches the store is structurally complete — every field the
 * `CharacterStatistics` / `CharacterSocial` types declare as required
 * exists, with parsed values preserved verbatim.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { setupTestEnvironment, makeTestStore, type CreateCampaignStoreFn } from '../helpers/testStoreFactory';

setupTestEnvironment();

// The store calls parseCharacterSheetPdf through the aiService facade — stub it
// with a deliberately under-populated parse result (the real-world failure mode).
const parseCharacterSheetPdf = vi.fn();
vi.mock('../../services/aiService', () => ({
    parseCharacterSheetPdf: (...args: unknown[]) => parseCharacterSheetPdf(...(args as [])),
}));

let createCampaignStore: CreateCampaignStoreFn;

beforeAll(async () => {
    const mod = await import('../../services/campaignService');
    createCampaignStore = mod.createCampaignStore;
});

const ALL_SKILLS = [
    'acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception', 'history',
    'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception',
    'performance', 'persuasion', 'religion', 'sleight_of_hand', 'stealth', 'survival',
];

describe('createPlayerCharacterFromPdf normalizes an incomplete parse result', () => {
    it('backfills missing actions/specialActions so the PC is never structurally broken', async () => {
        const { service, campaign } = makeTestStore(createCampaignStore);

        // Model omitted `specialActions` entirely (blank Features & Traits page).
        parseCharacterSheetPdf.mockResolvedValueOnce({
            playerName: 'Dana',
            characterSocial: {
                characterName: 'Kaelen', background: 'Soldier', species: 'Human',
                personality: '', appearance: '', backstory: '', ideals: '', bonds: '', flaws: '',
            },
            characterStatistics: {
                classes: { charClass: 'Fighter', level: 3 },
                attributes: { strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 11, charisma: 8 },
                skills: { athletics: 'proficient' },
                actions: ['Longsword'],
            },
        });

        const id = await service.createPlayerCharacterFromPdf('BASE64', false);
        const pc = campaign().playerCharacters.find(p => p.id === id)!;

        expect(pc).toBeDefined();
        // The crash vector: PlayerCharacterEditor does `.actions.map` / `.specialActions.map`.
        expect(Array.isArray(pc.characterStatistics.actions)).toBe(true);
        expect(Array.isArray(pc.characterStatistics.specialActions)).toBe(true);
        expect(pc.characterStatistics.specialActions).toEqual([]);
        // Parsed values must survive normalization untouched.
        expect(pc.characterStatistics.actions).toEqual(['Longsword']);
        expect(pc.characterStatistics.classes.charClass).toBe('Fighter');
        expect(pc.characterSocial.characterName).toBe('Kaelen');
    });

    it('backfills whole missing sub-objects (characterSocial / classes / attributes / skills)', async () => {
        const { service, campaign } = makeTestStore(createCampaignStore);

        // Worst case: the model returned almost nothing.
        parseCharacterSheetPdf.mockResolvedValueOnce({ playerName: 'Dana' });

        const id = await service.createPlayerCharacterFromPdf('BASE64', false);
        const pc = campaign().playerCharacters.find(p => p.id === id)!;

        expect(pc.characterSocial).toBeDefined();
        expect(typeof pc.characterSocial.characterName).toBe('string');
        expect(typeof pc.characterSocial.species).toBe('string');
        expect(pc.characterStatistics).toBeDefined();
        expect(pc.characterStatistics.classes).toBeDefined();
        expect(typeof pc.characterStatistics.classes.charClass).toBe('string');
        expect(typeof pc.characterStatistics.classes.level).toBe('number');
        expect(pc.characterStatistics.attributes).toBeDefined();
        expect(typeof pc.characterStatistics.attributes.strength).toBe('number');
        expect(pc.characterStatistics.skills).toBeDefined();
        for (const skill of ALL_SKILLS) {
            expect(pc.characterStatistics.skills).toHaveProperty(skill);
        }
        expect(pc.characterStatistics.actions).toEqual([]);
        expect(pc.characterStatistics.specialActions).toEqual([]);
    });
});
