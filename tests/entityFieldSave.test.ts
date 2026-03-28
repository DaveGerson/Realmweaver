import { describe, it, expect, vi, beforeAll } from 'vitest';
import { setupTestEnvironment } from './helpers/testStoreFactory';

// Must set up localStorage before importing campaignService
setupTestEnvironment();

let saveEntityField: typeof import('../utils/entityFieldSave').saveEntityField;

// We need to dynamically import both modules because:
// 1. campaignService accesses localStorage on module load
// 2. entityFieldSave imports campaignService as a singleton
// Instead, we test through the service integration.
beforeAll(async () => {
    // entityFieldSave uses the singleton campaignService, so we need to
    // verify behavior through the singleton. But since tests use createCampaignStore
    // with persist:false, we'll mock the service methods instead.
    const fieldSaveMod = await import('../utils/entityFieldSave');
    saveEntityField = fieldSaveMod.saveEntityField;
});

// ---------------------------------------------------------------------------
// Since saveEntityField calls the global campaignService singleton, we spy
// on the singleton's methods to verify dispatch without needing full campaign
// state setup through the singleton (tests should use the factory pattern).
// ---------------------------------------------------------------------------

describe('saveEntityField', () => {
    it('calls updateNpc for npc entity type', async () => {
        const { campaignService } = await import('../services/campaignService');
        const spy = vi.spyOn(campaignService, 'updateNpc').mockImplementation(() => {});
        saveEntityField('npc', 'npc-1', 'description', 'A tall warrior');
        expect(spy).toHaveBeenCalledWith('npc-1', { description: 'A tall warrior' });
        spy.mockRestore();
    });

    it('calls updateLocation for location entity type', async () => {
        const { campaignService } = await import('../services/campaignService');
        const spy = vi.spyOn(campaignService, 'updateLocation').mockImplementation(() => {});
        saveEntityField('location', 'loc-1', 'name', 'Dark Forest');
        expect(spy).toHaveBeenCalledWith('loc-1', { name: 'Dark Forest' });
        spy.mockRestore();
    });

    it('calls updateFaction for faction entity type', async () => {
        const { campaignService } = await import('../services/campaignService');
        const spy = vi.spyOn(campaignService, 'updateFaction').mockImplementation(() => {});
        saveEntityField('faction', 'fac-1', 'goals', 'World domination');
        expect(spy).toHaveBeenCalledWith('fac-1', { goals: 'World domination' });
        spy.mockRestore();
    });

    it('calls updateItem for item entity type', async () => {
        const { campaignService } = await import('../services/campaignService');
        const spy = vi.spyOn(campaignService, 'updateItem').mockImplementation(() => {});
        saveEntityField('item', 'item-1', 'properties', '+2 to hit');
        expect(spy).toHaveBeenCalledWith('item-1', { properties: '+2 to hit' });
        spy.mockRestore();
    });

    it('calls updateAdventure for adventure entity type', async () => {
        const { campaignService } = await import('../services/campaignService');
        const spy = vi.spyOn(campaignService, 'updateAdventure').mockImplementation(() => {});
        saveEntityField('adventure', 'adv-1', 'hook', 'A dark portal opens');
        expect(spy).toHaveBeenCalledWith('adv-1', { hook: 'A dark portal opens' });
        spy.mockRestore();
    });

    it('calls updateArticle for article entity type', async () => {
        const { campaignService } = await import('../services/campaignService');
        const spy = vi.spyOn(campaignService, 'updateArticle').mockImplementation(() => {});
        saveEntityField('article', 'art-1', 'content', 'New lore content');
        expect(spy).toHaveBeenCalledWith('art-1', { content: 'New lore content' });
        spy.mockRestore();
    });

    it('calls updatePlot for plot entity type', async () => {
        const { campaignService } = await import('../services/campaignService');
        const spy = vi.spyOn(campaignService, 'updatePlot').mockImplementation(() => {});
        saveEntityField('plot', 'plot-1', 'description', 'Revised plan');
        expect(spy).toHaveBeenCalledWith('plot-1', { description: 'Revised plan' });
        spy.mockRestore();
    });

    it('calls updateSessionLog for session-log entity type', async () => {
        const { campaignService } = await import('../services/campaignService');
        const spy = vi.spyOn(campaignService, 'updateSessionLog').mockImplementation(() => {});
        saveEntityField('session-log', 'sl-1', 'recap', 'Party rested');
        expect(spy).toHaveBeenCalledWith('sl-1', { recap: 'Party rested' });
        spy.mockRestore();
    });

    it('calls updateScene for scene entity type, finding the parent adventure', async () => {
        const { campaignService } = await import('../services/campaignService');

        // Mock getActiveCampaign to return a campaign with an adventure containing the scene
        const mockCampaign = {
            adventures: [
                {
                    id: 'adv-1',
                    scenes: [{ id: 'sc-1', title: 'Scene 1' }],
                },
            ],
        };
        const getCampaignSpy = vi.spyOn(campaignService, 'getActiveCampaign').mockReturnValue(mockCampaign as any);
        const updateSceneSpy = vi.spyOn(campaignService, 'updateScene').mockImplementation(() => {});

        saveEntityField('scene', 'sc-1', 'readAloudText', 'You enter a dungeon');

        expect(updateSceneSpy).toHaveBeenCalledWith('adv-1', 'sc-1', { readAloudText: 'You enter a dungeon' });

        getCampaignSpy.mockRestore();
        updateSceneSpy.mockRestore();
    });

    it('does not crash for player-character (no-op)', () => {
        // player-character has no inline editing support
        expect(() => saveEntityField('player-character', 'pc-1', 'name', 'New Name')).not.toThrow();
    });

    it('does not crash for unknown entity type', () => {
        expect(() => saveEntityField('unknown' as any, 'x', 'field', 'value')).not.toThrow();
    });

    it('passes the fieldKey as a dynamic property name', async () => {
        const { campaignService } = await import('../services/campaignService');
        const spy = vi.spyOn(campaignService, 'updateNpc').mockImplementation(() => {});

        saveEntityField('npc', 'npc-1', 'motivations', 'Power and glory');
        expect(spy).toHaveBeenCalledWith('npc-1', { motivations: 'Power and glory' });

        saveEntityField('npc', 'npc-1', 'traits', 'Cunning');
        expect(spy).toHaveBeenCalledWith('npc-1', { traits: 'Cunning' });

        spy.mockRestore();
    });
});
