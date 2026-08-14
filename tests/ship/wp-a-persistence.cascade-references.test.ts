/**
 * wp-a-persistence — findings #10 and #38 (cascade half)
 *
 * `_purgeEntityReferences` sweeps NPC relationships/mentionedEntityIds, the
 * various mentionedEntityIds/relatedEntityIds arrays and SessionLog plot links,
 * but never touches:
 *   - Faction.leaderId
 *   - Faction.headquartersLocationId
 *   - Location.connections[].targetLocationId
 *   - Secret.linkedEntityIds
 *   - SessionLog.structuredNotes[].taggedEntityIds
 *   - Campaign.pinnedEntities
 *
 * Dangling ids here are user-visible: continuityChecker reports an unfixable
 * error for a missing faction leader, FactionDashboard silently renders no
 * leader, and ghost pins occupy slots in the 15-entry pin cap while rendering
 * nothing (so they can never be unpinned).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestEnvironment, makeTestStore, type CreateCampaignStoreFn } from '../helpers/testStoreFactory';

setupTestEnvironment();

let createCampaignStore: CreateCampaignStoreFn;

beforeAll(async () => {
    const mod = await import('../../services/campaignService');
    createCampaignStore = mod.createCampaignStore;
});

/**
 * Builds a campaign in which every cross-entity reference field the cascade
 * sweep is supposed to cover is populated.
 */
function buildFullyLinkedCampaign(service: ReturnType<CreateCampaignStoreFn>) {
    const npcId = service.createNpc({
        name: 'Alice', description: '', traits: '', backstory: '', motivations: '',
        secrets: '', stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
    });
    const hqId = service.createLocation({
        name: 'The Keep', description: '', secrets: '', loot: [], subLocationIds: [],
        connections: [], pointsOfInterest: [], history: [],
    });
    const neighbourId = service.createLocation({
        name: 'The Village', description: '', secrets: '', loot: [], subLocationIds: [],
        connections: [], pointsOfInterest: [], history: [],
    });
    const factionId = service.createFaction({
        name: 'The Order', description: '', goals: '', memberIds: [],
        leaderId: npcId, headquartersLocationId: hqId,
    });

    service.updateLocation(neighbourId, {
        connections: [{ id: 'conn-1', targetLocationId: hqId, description: 'A muddy road' }],
    });

    const secretId = service.createSecret({
        title: 'The Betrayal', content: '', category: 'secret', isRevealed: false,
        linkedEntityIds: [npcId, hqId, factionId],
    });

    const sessionId = service.createSessionLog({
        title: 'Session 1', status: 'planned', sessionDate: '', plannedSceneIds: [], prepNotes: '',
        relatedPlotIds: [], runningNotes: '', encounterLog: [], recap: '', notableEvents: '', looseEnds: '',
        structuredNotes: [
            { id: 'entry-1', timestamp: '2026-01-01T00:00:00.000Z', content: 'Met the leader', taggedEntityIds: [npcId, hqId] },
        ],
    });

    service.pinEntity('npc', npcId);
    service.pinEntity('location', hqId);
    service.pinEntity('faction', factionId);

    return { npcId, hqId, neighbourId, factionId, secretId, sessionId };
}

describe('Cascade deletion: reference fields the sweep currently misses (finding #10)', () => {
    it('deleteNpc clears Faction.leaderId, Secret.linkedEntityIds, taggedEntityIds and pinnedEntities', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        const { npcId, factionId, secretId, sessionId } = buildFullyLinkedCampaign(service);

        service.deleteNpc(npcId);

        const faction = campaign().factions.find(f => f.id === factionId)!;
        expect(faction.leaderId).toBeUndefined();

        const secret = campaign().secrets!.find(s => s.id === secretId)!;
        expect(secret.linkedEntityIds).not.toContain(npcId);

        const session = campaign().sessionLogs.find(l => l.id === sessionId)!;
        expect(session.structuredNotes[0].taggedEntityIds).not.toContain(npcId);

        expect(campaign().pinnedEntities!.some(p => p.id === npcId)).toBe(false);
    });

    it('deleteLocation clears Faction.headquartersLocationId and inbound Location.connections', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        const { hqId, neighbourId, factionId, secretId } = buildFullyLinkedCampaign(service);

        service.deleteLocation(hqId);

        const faction = campaign().factions.find(f => f.id === factionId)!;
        expect(faction.headquartersLocationId).toBeUndefined();

        const neighbour = campaign().locations.find(l => l.id === neighbourId)!;
        expect((neighbour.connections ?? []).some(c => c.targetLocationId === hqId)).toBe(false);

        const secret = campaign().secrets!.find(s => s.id === secretId)!;
        expect(secret.linkedEntityIds).not.toContain(hqId);

        expect(campaign().pinnedEntities!.some(p => p.id === hqId)).toBe(false);
    });

    it('leaves no trace of a deleted entity id anywhere in the campaign (deep sweep)', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        const { npcId, hqId, factionId } = buildFullyLinkedCampaign(service);

        service.deleteNpc(npcId);
        service.deleteLocation(hqId);
        service.deleteFaction(factionId);

        const serialized = JSON.stringify(campaign());
        expect(serialized).not.toContain(npcId);
        expect(serialized).not.toContain(hqId);
        expect(serialized).not.toContain(factionId);
    });
});
