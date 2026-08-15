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

    it('deleteNpc/deleteLocation clear plannedNpcIds/plannedLocationIds on prepped session logs (verifier idx1/idx2, #26)', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        const npcId = service.createNpc({
            name: 'Bob', description: '', traits: '', backstory: '', motivations: '',
            secrets: '', stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
        });
        const locId = service.createLocation({
            name: 'The Docks', description: '', secrets: '', loot: [], subLocationIds: [],
            connections: [], pointsOfInterest: [], history: [],
        });
        const sessionId = service.createSessionLog({
            title: 'Prepped Session', status: 'planned', sessionDate: '', plannedSceneIds: [], prepNotes: '',
            relatedPlotIds: [], runningNotes: '', encounterLog: [], recap: '', notableEvents: '', looseEnds: '',
            structuredNotes: [],
        });
        service.updateSessionLog(sessionId, { plannedNpcIds: [npcId], plannedLocationIds: [locId] });

        service.deleteNpc(npcId);
        service.deleteLocation(locId);

        const session = campaign().sessionLogs.find(l => l.id === sessionId)!;
        expect(session.plannedNpcIds).not.toContain(npcId);
        expect(session.plannedLocationIds).not.toContain(locId);
    });
});

/**
 * Verifier follow-up on #10 (problem idx1): five sibling delete paths in the
 * same file never called `_purgeEntityReferences` at all —
 * deleteScene/deleteSessionLog/deletePlayerCharacter/deleteNote/deleteSecret
 * — so pinned ghost entries (and, for scenes/session-logs, other specific
 * dangling fields) survived those deletions indefinitely.
 */
describe('Cascade deletion: the five delete paths the ship suite never exercised (verifier idx1)', () => {
    it('deleteScene purges the scene id from mentionedEntityIds and pinnedEntities', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        const advId = service.createFullAdventure({ title: 'The Heist', hook: '', theme: '', level: 1, scenes: [] });
        const sceneId = service.createScene(advId, {
            title: 'The Vault', type: 'exploration', status: 'planned', readAloudText: '', gmNotes: '',
            skillChecks: [], rewards: '', npcIds: [],
        });
        const npcId = service.createNpc({
            name: 'Fence', description: '', traits: '', backstory: '', motivations: '',
            secrets: '', stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
            mentionedEntityIds: [sceneId],
        });
        service.pinEntity('scene', sceneId);

        service.deleteScene(advId, sceneId);

        const npc = campaign().npcs.find(n => n.id === npcId)!;
        expect(npc.mentionedEntityIds ?? []).not.toContain(sceneId);
        expect(campaign().pinnedEntities!.some(p => p.id === sceneId)).toBe(false);
    });

    it('deleteSessionLog purges Secret.revealedInSessionId and pinnedEntities', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        const sessionId = service.createSessionLog({
            title: 'The Reveal', status: 'planned', sessionDate: '', plannedSceneIds: [], prepNotes: '',
            relatedPlotIds: [], runningNotes: '', encounterLog: [], recap: '', notableEvents: '', looseEnds: '',
            structuredNotes: [],
        });
        const secretId = service.createSecret({
            title: 'The Betrayal', content: '', category: 'secret', isRevealed: true, linkedEntityIds: [],
        });
        service.revealSecret(secretId, sessionId);
        service.pinEntity('session-log', sessionId);

        expect(campaign().secrets!.find(s => s.id === secretId)!.revealedInSessionId).toBe(sessionId);

        service.deleteSessionLog(sessionId);

        const secret = campaign().secrets!.find(s => s.id === secretId)!;
        expect(secret.revealedInSessionId).toBeUndefined();
        expect(campaign().pinnedEntities!.some(p => p.id === sessionId)).toBe(false);
    });

    it('deletePlayerCharacter purges pinnedEntities', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        const pcId = service.createPlayerCharacter({
            name: 'Aria', class: '', race: '', level: 1, background: '', alignment: '',
            playerName: '', backstory: '', notes: '',
        } as any);
        service.pinEntity('player-character', pcId);

        service.deletePlayerCharacter(pcId);

        expect(campaign().pinnedEntities!.some(p => p.id === pcId)).toBe(false);
    });

    it('deleteNote purges pinnedEntities', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        const noteId = service.createNote({ title: 'Loose thread', content: '', tags: [] });
        service.pinEntity('note', noteId);

        service.deleteNote(noteId);

        expect(campaign().pinnedEntities!.some(p => p.id === noteId)).toBe(false);
    });

    it('deleteSecret purges pinnedEntities and linkedEntityIds elsewhere', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        const npcId = service.createNpc({
            name: 'Keeper', description: '', traits: '', backstory: '', motivations: '',
            secrets: '', stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
        });
        const secretId = service.createSecret({
            title: 'The Vault Combo', content: '', category: 'secret', isRevealed: false, linkedEntityIds: [npcId],
        });
        service.pinEntity('secret', secretId);

        service.deleteSecret(secretId);

        expect(campaign().secrets!.some(s => s.id === secretId)).toBe(false);
        expect(campaign().pinnedEntities!.some(p => p.id === secretId)).toBe(false);
    });

    it('leaves no trace of the deleted id anywhere in the campaign for all five paths (deep sweep)', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        const advId = service.createFullAdventure({ title: 'Adv', hook: '', theme: '', level: 1, scenes: [] });
        const sceneId = service.createScene(advId, {
            title: 'Scene', type: 'exploration', status: 'planned', readAloudText: '', gmNotes: '',
            skillChecks: [], rewards: '', npcIds: [],
        });
        const sessionId = service.createSessionLog({
            title: 'Session', status: 'planned', sessionDate: '', plannedSceneIds: [], prepNotes: '',
            relatedPlotIds: [], runningNotes: '', encounterLog: [], recap: '', notableEvents: '', looseEnds: '',
            structuredNotes: [],
        });
        const pcId = service.createPlayerCharacter({
            name: 'Rin', class: '', race: '', level: 1, background: '', alignment: '',
            playerName: '', backstory: '', notes: '',
        } as any);
        const noteId = service.createNote({ title: 'Note', content: '', tags: [] });
        const secretId = service.createSecret({
            title: 'Secret', content: '', category: 'secret', isRevealed: false, linkedEntityIds: [],
        });
        service.pinEntity('scene', sceneId);
        service.pinEntity('session-log', sessionId);
        service.pinEntity('player-character', pcId);
        service.pinEntity('note', noteId);
        service.pinEntity('secret', secretId);

        service.deleteScene(advId, sceneId);
        service.deleteSessionLog(sessionId);
        service.deletePlayerCharacter(pcId);
        service.deleteNote(noteId);
        service.deleteSecret(secretId);

        const serialized = JSON.stringify(campaign());
        expect(serialized).not.toContain(sceneId);
        expect(serialized).not.toContain(sessionId);
        expect(serialized).not.toContain(pcId);
        expect(serialized).not.toContain(noteId);
        expect(serialized).not.toContain(secretId);
    });
});

/**
 * Ship-review follow-up (finding C2): deleteAdventure deletes an adventure AND
 * all of its scenes, but ran `_purgeEntityReferences` for the adventure id only
 * — never per contained scene, unlike deleteScene (covered above). A scene
 * pinned from its EntityQuickCard and then deleted via its parent adventure
 * therefore survived in `campaign.pinnedEntities` forever: the sidebar resolves
 * its name to null and renders no row (so no unpin button), and the invisible
 * ghost permanently consumed one of the 15 capped pin slots.
 */
describe('Cascade deletion: deleteAdventure must sweep its contained scenes\' ids too (review finding C2)', () => {
    function buildAdventureWithLinkedScene(service: ReturnType<CreateCampaignStoreFn>) {
        const advId = service.createFullAdventure({ title: 'The Siege', hook: '', theme: '', level: 1, scenes: [] });
        const sceneId = service.createScene(advId, {
            title: 'The Gatehouse', type: 'combat', status: 'planned', readAloudText: '', gmNotes: '',
            skillChecks: [], rewards: '', npcIds: [],
        });
        const npcId = service.createNpc({
            name: 'Watch Captain', description: '', traits: '', backstory: '', motivations: '',
            secrets: '', stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
            mentionedEntityIds: [sceneId],
        });
        const sessionId = service.createSessionLog({
            title: 'Assault Prep', status: 'planned', sessionDate: '', plannedSceneIds: [sceneId], prepNotes: '',
            relatedPlotIds: [], runningNotes: '', encounterLog: [], recap: '', notableEvents: '', looseEnds: '',
            structuredNotes: [],
        });
        service.pinEntity('scene', sceneId);
        return { advId, sceneId, npcId, sessionId };
    }

    it('deleteAdventure purges each deleted scene id from mentionedEntityIds and pinnedEntities (mirroring deleteScene)', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        const { advId, sceneId, npcId, sessionId } = buildAdventureWithLinkedScene(service);

        service.deleteAdventure(advId);

        const npc = campaign().npcs.find(n => n.id === npcId)!;
        expect(npc.mentionedEntityIds ?? []).not.toContain(sceneId);
        expect(campaign().pinnedEntities!.some(p => p.id === sceneId)).toBe(false);
        // The pre-existing hand-rolled plannedSceneIds cleanup must survive the fix.
        const session = campaign().sessionLogs.find(l => l.id === sessionId)!;
        expect(session.plannedSceneIds).not.toContain(sceneId);
    });

    it('leaves no trace of the adventure id or its scene ids anywhere in the campaign (deep sweep)', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        const { advId, sceneId } = buildAdventureWithLinkedScene(service);

        service.deleteAdventure(advId);

        const serialized = JSON.stringify(campaign());
        expect(serialized).not.toContain(sceneId);
        expect(serialized).not.toContain(advId);
    });
});
