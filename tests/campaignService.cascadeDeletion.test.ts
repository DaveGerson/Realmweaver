import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestEnvironment, makeTestStore, type CreateCampaignStoreFn } from './helpers/testStoreFactory';

// Must set up localStorage before importing campaignService
setupTestEnvironment();

let createCampaignStore: CreateCampaignStoreFn;

beforeAll(async () => {
    const mod = await import('../services/campaignService');
    createCampaignStore = mod.createCampaignStore;
});

describe('Cascade deletion: cross-entity reference cleanup', () => {
    it('deleteNpc removes dangling references from other NPCs\' relationships[]', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);

        const npcAId = service.createNpc({
            name: 'Alice', description: '', traits: '', backstory: '', motivations: '',
            secrets: '', stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
        });
        const npcBId = service.createNpc({
            name: 'Bob', description: '', traits: '', backstory: '', motivations: '',
            secrets: '', stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [],
            history: [],
        });

        service.updateNpc(npcBId, {
            relationships: [{ id: 'rel-1', targetId: npcAId, relationType: 'Ally', description: 'Old friends' }],
        });

        service.deleteNpc(npcAId);

        const bob = campaign().npcs.find(n => n.id === npcBId)!;
        expect(bob.relationships.some(r => r.targetId === npcAId)).toBe(false);
    });

    it('deleteNpc removes the NPC id from Plot.relatedEntityIds', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);

        const npcId = service.createNpc({
            name: 'Alice', description: '', traits: '', backstory: '', motivations: '',
            secrets: '', stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
        });
        const plotId = service.createPlot({
            title: 'The Conspiracy', description: '', status: 'active', relatedEntityIds: [npcId],
        });

        service.deleteNpc(npcId);

        const plot = campaign().plots.find(p => p.id === plotId)!;
        expect(plot.relatedEntityIds).not.toContain(npcId);
    });

    it('deleteLocation and deleteFaction remove the entity id from Article.relatedEntityIds', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);

        const locId = service.createLocation({
            name: 'The Keep', description: '', secrets: '', loot: [], subLocationIds: [], connections: [],
            pointsOfInterest: [], history: [],
        });
        const facId = service.createFaction({
            name: 'The Order', description: '', goals: '', memberIds: [],
        });
        const articleId = service.createArticle({
            title: 'Lore', category: 'lore', content: '', subArticleIds: [], relatedEntityIds: [locId, facId],
        });

        service.deleteLocation(locId);
        service.deleteFaction(facId);

        const article = campaign().articles.find(a => a.id === articleId)!;
        expect(article.relatedEntityIds).not.toContain(locId);
        expect(article.relatedEntityIds).not.toContain(facId);
    });

    it('deletePlot cleans up SessionLog.relatedPlotIds and session.plotProgressions', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);

        const plotId = service.createPlot({
            title: 'The Conspiracy', description: '', status: 'active', relatedEntityIds: [],
        });
        const sessionId = service.createSessionLog({
            title: 'Session 1', status: 'planned', sessionDate: '', plannedSceneIds: [], prepNotes: '',
            relatedPlotIds: [plotId], runningNotes: '', structuredNotes: [], encounterLog: [],
            recap: '', notableEvents: '', looseEnds: '',
        });

        service.goLive(sessionId);
        service.updatePlotProgression(plotId, 'advanced');

        service.deletePlot(plotId);

        const session = campaign().sessionLogs.find(s => s.id === sessionId)!;
        expect(session.relatedPlotIds).not.toContain(plotId);
        expect(session.plotProgressions?.[plotId]).toBeUndefined();
    });

    it('deleteItem removes the item id from Article.relatedEntityIds and Plot.relatedEntityIds', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);

        const itemId = service.createItem({
            name: 'Sword of Truth', description: '', rarity: 'rare', properties: '',
        });
        const articleId = service.createArticle({
            title: 'Artifacts', category: 'lore', content: '', subArticleIds: [], relatedEntityIds: [itemId],
        });
        const plotId = service.createPlot({
            title: 'Quest for the Sword', description: '', status: 'active', relatedEntityIds: [itemId],
        });

        service.deleteItem(itemId);

        expect(campaign().articles.find(a => a.id === articleId)!.relatedEntityIds).not.toContain(itemId);
        expect(campaign().plots.find(p => p.id === plotId)!.relatedEntityIds).not.toContain(itemId);
    });
});

describe('duplicateCampaign: session log reference remapping', () => {
    it('remaps adventureId, plannedSceneIds, relatedPlotIds, and plotProgressions keys to new entity ids', () => {
        const { service } = makeTestStore(createCampaignStore);

        const advId = service.createFullAdventure({
            title: 'Adventure', theme: 'test', hook: '', level: 1,
            scenes: [
                { title: 'Scene 1', type: 'exploration', readAloudText: '', gmNotes: '', rewards: '', skillChecks: [], npcIds: [], status: 'planned' },
            ],
        });
        const originalCampaign = service.getState().campaigns[0];
        const originalAdv = originalCampaign.adventures.find(a => a.id === advId)!;
        const originalSceneId = originalAdv.scenes[0].id;

        const plotId = service.createPlot({
            title: 'Main Plot', description: '', status: 'active', relatedEntityIds: [],
        });

        const sessionId = service.createSessionLog({
            title: 'Session 1', status: 'planned', sessionDate: '', adventureId: advId,
            plannedSceneIds: [originalSceneId], prepNotes: '', relatedPlotIds: [plotId],
            runningNotes: '', structuredNotes: [], encounterLog: [], recap: '', notableEvents: '', looseEnds: '',
            plotProgressions: { [plotId]: 'advanced' },
        });

        const newCampaignId = service.duplicateCampaign(originalCampaign.id);
        const newCampaign = service.getState().campaigns.find(c => c.id === newCampaignId)!;

        const newAdv = newCampaign.adventures[0];
        const newSceneId = newAdv.scenes[0].id;
        const newPlot = newCampaign.plots[0];
        const newSession = newCampaign.sessionLogs.find(l => l.title === 'Session 1')!;

        // IDs must have actually changed (sanity check the remap ran)
        expect(newAdv.id).not.toBe(advId);
        expect(newSceneId).not.toBe(originalSceneId);
        expect(newPlot.id).not.toBe(plotId);

        // The duplicated session log must point at the NEW ids, not the originals
        expect(newSession.adventureId).toBe(newAdv.id);
        expect(newSession.plannedSceneIds).toEqual([newSceneId]);
        expect(newSession.relatedPlotIds).toEqual([newPlot.id]);
        expect(newSession.plotProgressions).toEqual({ [newPlot.id]: 'advanced' });

        // Original campaign's session log must be untouched
        const original = service.getState().campaigns.find(c => c.id === originalCampaign.id)!;
        const originalSession = original.sessionLogs.find(l => l.id === sessionId)!;
        expect(originalSession.adventureId).toBe(advId);
        expect(originalSession.plannedSceneIds).toEqual([originalSceneId]);
        expect(originalSession.relatedPlotIds).toEqual([plotId]);
    });
});

describe('deleteScene and deleteSessionLog: active-pointer cleanup', () => {
    it('deleteScene clears activeSceneId and strips the scene id from every session\'s plannedSceneIds', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);

        const advId = service.createFullAdventure({
            title: 'Adventure', theme: 'test', hook: '', level: 1,
            scenes: [
                { title: 'Scene 1', type: 'exploration', readAloudText: '', gmNotes: '', rewards: '', skillChecks: [], npcIds: [], status: 'planned' },
                { title: 'Scene 2', type: 'combat', readAloudText: '', gmNotes: '', rewards: '', skillChecks: [], npcIds: [], status: 'planned' },
            ],
        });
        const adv = campaign().adventures[0];
        const [scene1, scene2] = adv.scenes;

        const sessionId = service.createSessionLog({
            title: 'Session 1', status: 'planned', sessionDate: '', adventureId: advId,
            plannedSceneIds: [scene1.id, scene2.id], prepNotes: '', relatedPlotIds: [],
            runningNotes: '', structuredNotes: [], encounterLog: [], recap: '', notableEvents: '', looseEnds: '',
        });

        service.goLive(sessionId);
        expect(campaign().activeSceneId).toBe(scene1.id);

        service.deleteScene(advId, scene1.id);

        expect(campaign().activeSceneId).toBeUndefined();
        const session = campaign().sessionLogs.find(s => s.id === sessionId)!;
        expect(session.plannedSceneIds).toEqual([scene2.id]);
    });

    it('deleteScene does not clear activeSceneId when a different scene is deleted', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);

        const advId = service.createFullAdventure({
            title: 'Adventure', theme: 'test', hook: '', level: 1,
            scenes: [
                { title: 'Scene 1', type: 'exploration', readAloudText: '', gmNotes: '', rewards: '', skillChecks: [], npcIds: [], status: 'planned' },
                { title: 'Scene 2', type: 'combat', readAloudText: '', gmNotes: '', rewards: '', skillChecks: [], npcIds: [], status: 'planned' },
            ],
        });
        const adv = campaign().adventures[0];
        const [scene1, scene2] = adv.scenes;

        service.setActiveScene(scene1.id);
        service.deleteScene(advId, scene2.id);

        expect(campaign().activeSceneId).toBe(scene1.id);
    });

    it('deleteSessionLog clears activeSessionId/activeSceneId when deleting the currently-live session', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);

        const advId = service.createFullAdventure({
            title: 'Adventure', theme: 'test', hook: '', level: 1,
            scenes: [
                { title: 'Scene 1', type: 'exploration', readAloudText: '', gmNotes: '', rewards: '', skillChecks: [], npcIds: [], status: 'planned' },
            ],
        });
        const adv = campaign().adventures[0];
        const sessionId = service.createSessionLog({
            title: 'Session 1', status: 'planned', sessionDate: '', adventureId: advId,
            plannedSceneIds: [adv.scenes[0].id], prepNotes: '', relatedPlotIds: [],
            runningNotes: '', structuredNotes: [], encounterLog: [], recap: '', notableEvents: '', looseEnds: '',
        });

        service.goLive(sessionId);
        expect(campaign().activeSessionId).toBe(sessionId);
        expect(campaign().activeSceneId).toBe(adv.scenes[0].id);

        service.deleteSessionLog(sessionId);

        expect(campaign().activeSessionId).toBeUndefined();
        expect(campaign().activeSceneId).toBeUndefined();
        expect(campaign().sessionLogs.find(s => s.id === sessionId)).toBeUndefined();
    });

    it('deleteSessionLog does not clear active pointers when deleting a non-active session', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);

        const activeSessionId = service.createSessionLog({
            title: 'Active Session', status: 'planned', sessionDate: '', plannedSceneIds: [], prepNotes: '',
            relatedPlotIds: [], runningNotes: '', structuredNotes: [], encounterLog: [], recap: '',
            notableEvents: '', looseEnds: '',
        });
        service.goLive(activeSessionId);

        const otherSessionId = service.createSessionLog({
            title: 'Other Session', status: 'planned', sessionDate: '', plannedSceneIds: [], prepNotes: '',
            relatedPlotIds: [], runningNotes: '', structuredNotes: [], encounterLog: [], recap: '',
            notableEvents: '', looseEnds: '',
        });

        service.deleteSessionLog(otherSessionId);

        expect(campaign().activeSessionId).toBe(activeSessionId);
    });
});
