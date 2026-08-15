/**
 * wp-j-types-utils — finding #121
 *
 * `utils/entityUtils.ts:32` exports `buildCampaignContext(campaign: Campaign)`
 * while `services/contextBuilder.ts:74` exports a DIFFERENT function of the
 * same name taking an options object. contextBuilder.ts:7 states it "replaces
 * the flat, ad-hoc buildCampaignContext helper in entityUtils.ts", CLAUDE.md
 * mandates the contextBuilder one, and every real call site (App.tsx:24,
 * DmCoach.tsx:11, EvocationWizard.tsx:8, RealmChatWidget.tsx:9) already uses
 * it — the entityUtils copy has zero non-test importers. It stays reachable
 * from a module every dashboard already imports for ENTITY_TYPE_CONFIG, so an
 * editor auto-import resolves the wrong one, and it duplicates ~30 lines of
 * context assembly that will drift from the tiered/budgeted implementation.
 *
 * Contract: `services/contextBuilder.ts` is the single implementation.
 *
 * NOTE for the implementer: the `describe('buildCampaignContext')` block in
 * tests/entityUtils.test.ts:129-240 imports the doomed export and must be
 * deleted with it (that existing file's import will otherwise be `undefined`).
 */
import { describe, it, expect } from 'vitest';
import * as entityUtils from '../../utils/entityUtils';
import { buildCampaignContext as canonicalBuildCampaignContext } from '../../services/contextBuilder';

describe('#121 — the duplicate context builder is gone from entityUtils', () => {
    it('utils/entityUtils no longer exports buildCampaignContext', () => {
        expect(entityUtils).not.toHaveProperty('buildCampaignContext');
    });

    it('entityUtils still exports ENTITY_TYPE_CONFIG (the reason everyone imports it)', () => {
        expect(entityUtils.ENTITY_TYPE_CONFIG.playerCharacter.color).toBe('teal');
    });

    it('contextBuilder remains the single, options-object implementation', () => {
        expect(typeof canonicalBuildCampaignContext).toBe('function');
        const campaign = {
            id: 'c1', title: 'Test', setting: 'A world', settingType: 'custom',
            npcs: [], locations: [], factions: [], items: [], adventures: [],
            articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [],
        } as never;
        expect(canonicalBuildCampaignContext({ variant: 'generation', campaign })).toContain('Test');
    });
});
