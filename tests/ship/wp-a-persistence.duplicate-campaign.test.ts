/**
 * wp-a-persistence — findings #11 and #38 (duplicate half)
 *
 * duplicateCampaign builds a full old-id → new-id remap table but the entity
 * mappers skip several reference fields:
 *   - locations: controllingFactionId, connections[].targetLocationId
 *   - secrets:   linkedEntityIds, revealedInSessionId
 *   - every entity type: mentionedEntityIds
 *   - sessionLogs: structuredNotes[].taggedEntityIds
 *
 * Those stale ids coincidentally resolve to live entities in the ORIGINAL
 * campaign, so _purgeEntityReferences there will never clean them up and the
 * copy carries permanently unresolvable references.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestEnvironment, makeTestStore, type CreateCampaignStoreFn } from '../helpers/testStoreFactory';

setupTestEnvironment();

let createCampaignStore: CreateCampaignStoreFn;

beforeAll(async () => {
    const mod = await import('../../services/campaignService');
    createCampaignStore = mod.createCampaignStore;
});

function seedSource(service: ReturnType<CreateCampaignStoreFn>) {
    const npcId = service.createNpc({
        name: 'Alice', description: '', traits: '', backstory: '', motivations: '',
        secrets: '', stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
    });
    const keepId = service.createLocation({
        name: 'The Keep', description: '', secrets: '', loot: [], subLocationIds: [],
        connections: [], pointsOfInterest: [], history: [],
    });
    const villageId = service.createLocation({
        name: 'The Village', description: '', secrets: '', loot: [], subLocationIds: [],
        connections: [], pointsOfInterest: [], history: [],
    });
    const factionId = service.createFaction({
        name: 'The Order', description: '', goals: '', memberIds: [],
    });

    service.updateLocation(villageId, {
        controllingFactionId: factionId,
        connections: [{ id: 'conn-1', targetLocationId: keepId, description: 'A muddy road' }],
        mentionedEntityIds: [npcId],
    });

    const secretId = service.createSecret({
        title: 'The Betrayal', content: '', category: 'secret', isRevealed: false,
        linkedEntityIds: [npcId, keepId],
    });

    const sessionId = service.createSessionLog({
        title: 'Session 1', status: 'planned', sessionDate: '', plannedSceneIds: [], prepNotes: '',
        relatedPlotIds: [], runningNotes: '', encounterLog: [], recap: '', notableEvents: '', looseEnds: '',
        structuredNotes: [
            { id: 'entry-1', timestamp: '2026-01-01T00:00:00.000Z', content: 'Met Alice', taggedEntityIds: [npcId, keepId] },
        ],
    });

    return { npcId, keepId, villageId, factionId, secretId, sessionId };
}

describe('duplicateCampaign: reference remapping gaps (finding #11)', () => {
    it('remaps location controllingFactionId and connection targets into the copy', () => {
        const { service } = makeTestStore(createCampaignStore);
        const ids = seedSource(service);
        const sourceId = service.getState().campaigns[0].id;

        const copyId = service.duplicateCampaign(sourceId);
        const copy = service.getState().campaigns.find(c => c.id === copyId)!;

        const copyVillage = copy.locations.find(l => l.name === 'The Village')!;
        const copyKeep = copy.locations.find(l => l.name === 'The Keep')!;
        const copyFaction = copy.factions[0];

        // Sanity: the remap did run.
        expect(copyFaction.id).not.toBe(ids.factionId);
        expect(copyKeep.id).not.toBe(ids.keepId);

        expect(copyVillage.controllingFactionId).toBe(copyFaction.id);
        expect(copyVillage.connections![0].targetLocationId).toBe(copyKeep.id);
        expect(copyVillage.mentionedEntityIds).toEqual([copy.npcs[0].id]);
    });

    it('remaps secret linkedEntityIds and session-log taggedEntityIds into the copy', () => {
        const { service } = makeTestStore(createCampaignStore);
        seedSource(service);
        const sourceId = service.getState().campaigns[0].id;

        const copyId = service.duplicateCampaign(sourceId);
        const copy = service.getState().campaigns.find(c => c.id === copyId)!;

        const copyNpcId = copy.npcs[0].id;
        const copyKeepId = copy.locations.find(l => l.name === 'The Keep')!.id;

        const copySecret = copy.secrets![0];
        expect(copySecret.linkedEntityIds).toEqual([copyNpcId, copyKeepId]);

        const copySession = copy.sessionLogs[0];
        expect(copySession.structuredNotes[0].taggedEntityIds).toEqual([copyNpcId, copyKeepId]);
    });

    it('contains no id belonging to the source campaign anywhere in the copy', () => {
        const { service } = makeTestStore(createCampaignStore);
        seedSource(service);
        const source = service.getState().campaigns[0];
        const sourceId = source.id;

        const sourceIds = [
            source.id,
            ...source.npcs.map(e => e.id),
            ...source.locations.map(e => e.id),
            ...source.factions.map(e => e.id),
            ...source.items.map(e => e.id),
            ...(source.secrets ?? []).map(e => e.id),
            ...source.sessionLogs.map(e => e.id),
        ];

        const copyId = service.duplicateCampaign(sourceId);
        const copy = service.getState().campaigns.find(c => c.id === copyId)!;
        const serialized = JSON.stringify(copy);

        const leaked = sourceIds.filter(id => serialized.includes(id));
        expect(leaked).toEqual([]);
    });
});
