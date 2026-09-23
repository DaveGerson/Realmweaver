import { describe, it, expect, beforeAll, vi } from 'vitest';
import { setupTestEnvironment, makeTestStore, type CreateCampaignStoreFn } from './helpers/testStoreFactory';
import {
    createDefaultNpc, createDefaultLocation, createDefaultFaction, createDefaultItem,
    createDefaultArticle, createDefaultSession, createDefaultPlot, createDefaultPlayerCharacter,
    createDefaultScene,
} from '../utils/entityUtils';
import type { Encounter } from '../types/index';

// Must set up localStorage before importing campaignService
setupTestEnvironment();

let createCampaignStore: CreateCampaignStoreFn;

beforeAll(async () => {
    const mod = await import('../services/campaignService');
    createCampaignStore = mod.createCampaignStore;
});

type Store = ReturnType<typeof makeTestStore>['service'];
type Campaign = ReturnType<Store['getState']>['campaigns'][number];

/** Strips the `id` a default factory mints so it can be passed to `createX`. */
const noId = <T extends { id: string }>(e: T): Omit<T, 'id'> => {
    const { id: _id, ...rest } = e;
    return rest;
};

/**
 * One row per factory-built entity type: how to create one, delete one, and
 * find it in a campaign. Driving every guarantee off this table means a new
 * entity type only has to be added here to be covered.
 */
const ENTITY_TYPES: Array<{
    type: string;
    create: (s: Store) => string;
    update: (s: Store, id: string, updates: Record<string, unknown>) => void;
    remove: (s: Store, id: string) => void;
    list: (c: Campaign) => Array<{ id: string }>;
}> = [
    { type: 'npc', create: s => s.createNpc(noId(createDefaultNpc())), update: (s, id, u) => s.updateNpc(id, u), remove: (s, id) => s.deleteNpc(id), list: c => c.npcs },
    { type: 'location', create: s => s.createLocation(noId(createDefaultLocation())), update: (s, id, u) => s.updateLocation(id, u), remove: (s, id) => s.deleteLocation(id), list: c => c.locations },
    { type: 'faction', create: s => s.createFaction(noId(createDefaultFaction())), update: (s, id, u) => s.updateFaction(id, u), remove: (s, id) => s.deleteFaction(id), list: c => c.factions },
    { type: 'item', create: s => s.createItem(noId(createDefaultItem())), update: (s, id, u) => s.updateItem(id, u), remove: (s, id) => s.deleteItem(id), list: c => c.items },
    { type: 'article', create: s => s.createArticle(noId(createDefaultArticle())), update: (s, id, u) => s.updateArticle(id, u), remove: (s, id) => s.deleteArticle(id), list: c => c.articles },
    { type: 'adventure', create: s => s.createFullAdventure({ title: 'Adv', hook: '', theme: '', level: 1, scenes: [] }), update: (s, id, u) => s.updateAdventure(id, u), remove: (s, id) => s.deleteAdventure(id), list: c => c.adventures },
    { type: 'session-log', create: s => s.createSessionLog(noId(createDefaultSession())), update: (s, id, u) => s.updateSessionLog(id, u), remove: (s, id) => s.deleteSessionLog(id), list: c => c.sessionLogs },
    { type: 'player-character', create: s => s.createPlayerCharacter(createDefaultPlayerCharacter()), update: (s, id, u) => s.updatePlayerCharacter(id, u), remove: (s, id) => s.deletePlayerCharacter(id), list: c => c.playerCharacters },
    { type: 'plot', create: s => s.createPlot(noId(createDefaultPlot())), update: (s, id, u) => s.updatePlot(id, u), remove: (s, id) => s.deletePlot(id), list: c => c.plots },
    { type: 'note', create: s => s.createNote({ title: 'N', content: '', tags: [] }), update: (s, id, u) => s.updateNote(id, u), remove: (s, id) => s.deleteNote(id), list: c => c.notes },
    { type: 'secret', create: s => s.createSecret({ title: 'S', content: '', category: 'secret', isRevealed: false, linkedEntityIds: [] }), update: (s, id, u) => s.updateSecret(id, u), remove: (s, id) => s.deleteSecret(id), list: c => c.secrets ?? [] },
];

describe('Generic entity CRUD factory (X1)', () => {
    describe.each(ENTITY_TYPES)('$type', ({ type, create, update, remove, list }) => {
        it('create returns a fresh id that resolves to a stored entity', () => {
            const { service, campaign } = makeTestStore(createCampaignStore);
            const a = create(service);
            const b = create(service);
            expect(a).not.toBe(b);
            expect(list(campaign()).map(e => e.id)).toEqual([a, b]);
        });

        it('delete always purges cross-entity references (pins, mentions, plot/secret links)', () => {
            const { service, campaign } = makeTestStore(createCampaignStore);
            const id = create(service);
            const plotId = service.createPlot({ ...noId(createDefaultPlot()), relatedEntityIds: [id], mentionedEntityIds: [id] });
            const secretId = service.createSecret({ title: 'S', content: '', category: 'secret', isRevealed: false, linkedEntityIds: [id] });
            const witnessId = service.createNpc({ ...noId(createDefaultNpc()), mentionedEntityIds: [id] });
            service.pinEntity(type, id);

            remove(service, id);

            const c = campaign();
            expect(list(c).some(e => e.id === id)).toBe(false);
            expect(c.pinnedEntities ?? []).not.toContainEqual({ type, id });
            if (type !== 'plot') {
                expect(c.plots.find(p => p.id === plotId)!.relatedEntityIds).not.toContain(id);
                expect(c.plots.find(p => p.id === plotId)!.mentionedEntityIds).not.toContain(id);
            }
            if (type !== 'secret') {
                expect(c.secrets!.find(s => s.id === secretId)!.linkedEntityIds).not.toContain(id);
            }
            if (type !== 'npc') {
                expect(c.npcs.find(n => n.id === witnessId)!.mentionedEntityIds).not.toContain(id);
            }
        });

        it('update / delete of an unknown id leave the campaign unchanged', () => {
            const { service, campaign } = makeTestStore(createCampaignStore);
            create(service);
            const before = campaign();
            update(service, 'no-such-id', { name: 'Ghost', title: 'Ghost' });
            remove(service, 'no-such-id');
            expect(campaign()).toBe(before); // Immer structural sharing: no draft change
        });

        it('update merges the patch into the stored entity', () => {
            const { service, campaign } = makeTestStore(createCampaignStore);
            const id = create(service);
            update(service, id, { description: 'patched' });
            expect((list(campaign()).find(e => e.id === id) as { description?: string }).description).toBe('patched');
        });
    });

    it('create still returns an id with no active campaign, but stores nothing', () => {
        const service = createCampaignStore({ persist: false });
        service.init();
        const id = service.createItem(noId(createDefaultItem()));
        expect(typeof id).toBe('string');
        expect(service.getState().campaigns).toHaveLength(0);
    });

    it('creates optional collections lazily (secrets missing on an old campaign)', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        service._updateState(d => { delete d.campaigns[0].secrets; });
        const id = service.createSecret({ title: 'S', content: '', category: 'secret', isRevealed: false, linkedEntityIds: [] });
        expect(campaign().secrets!.map(s => s.id)).toEqual([id]);
    });

    it('rejected hierarchy updates leave state untouched (location + article)', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const parent = service.createLocation(noId(createDefaultLocation()));
        const child = service.createLocation({ ...noId(createDefaultLocation()), parentLocationId: parent });
        const aParent = service.createArticle(noId(createDefaultArticle()));
        const aChild = service.createArticle({ ...noId(createDefaultArticle()), parentArticleId: aParent });
        const before = campaign();

        service.updateLocation(parent, { parentLocationId: child, name: 'renamed' });
        service.updateArticle(aParent, { parentArticleId: aChild, title: 'renamed' });

        expect(campaign()).toBe(before);
        expect(err).toHaveBeenCalledTimes(2);
        err.mockRestore();
    });

    it('delete runs type-specific unlinking before removal (NPC faction + scene rosters)', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        const factionId = service.createFaction(noId(createDefaultFaction()));
        const npcId = service.createNpc({ ...noId(createDefaultNpc()), factionId });
        const advId = service.createFullAdventure({ title: 'A', hook: '', theme: '', level: 1, scenes: [{ ...noId(createDefaultScene()), npcIds: [npcId] }] });
        expect(campaign().factions[0].memberIds).toEqual([npcId]);

        service.deleteNpc(npcId);

        expect(campaign().factions[0].memberIds).toEqual([]);
        expect(campaign().adventures.find(a => a.id === advId)!.scenes[0].npcIds).toEqual([]);
    });

    it('updateNote stamps lastModified; createNote stamps both timestamps', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        const id = service.createNote({ title: 'N', content: '', tags: [] });
        const created = campaign().notes[0];
        expect(created.createdAt).toBe(created.lastModified);
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));
        try {
            service.updateNote(id, { content: 'x' });
        } finally {
            vi.useRealTimers();
        }
        expect(campaign().notes[0].lastModified).toBe('2030-01-01T00:00:00.000Z');
        expect(campaign().notes[0].createdAt).toBe(created.createdAt);
    });
});

describe('endCombat (X6)', () => {
    const fight = (sessionId?: string): Encounter => ({
        id: 'enc-1',
        sessionId,
        round: 4,
        turnIndex: 2,
        combatants: [
            { id: 'c1', name: 'Goblin', type: 'monster', initiative: 12, hp: 0, maxHp: 7, ac: 15 },
            { id: 'c2', name: 'Aria', type: 'pc', initiative: 18, hp: 9, maxHp: 20 },
        ],
    });

    const liveSession = () => {
        const store = makeTestStore(createCampaignStore);
        const sessionId = store.service.createSessionLog(noId(createDefaultSession()));
        store.service.goLive(sessionId);
        return { ...store, sessionId };
    };

    it('archives the full encounter onto the active session and resets activeEncounter', () => {
        const { service, campaign, sessionId } = liveSession();
        service.updateEncounter(fight(sessionId));

        expect(service.endCombat()).toBe(true);

        const c = campaign();
        const log = c.sessionLogs.find(s => s.id === sessionId)!;
        expect(log.encounterLog).toHaveLength(1);
        expect(log.encounterLog[0]).toEqual({ ...fight(sessionId), sessionId });
        expect(c.activeEncounter).toMatchObject({ round: 1, turnIndex: 0, combatants: [] });
        expect(c.activeEncounter!.id).not.toBe('enc-1');
        // The session itself stays live.
        expect(c.activeSessionId).toBe(sessionId);
    });

    it('keeps every fight when two are ended in one session', () => {
        const { service, campaign, sessionId } = liveSession();
        service.updateEncounter(fight(sessionId));
        service.endCombat();
        service.updateEncounter({ ...fight(sessionId), id: 'enc-2', round: 2 });
        service.endCombat();

        const log = campaign().sessionLogs.find(s => s.id === sessionId)!;
        expect(log.encounterLog.map(e => [e.id, e.round])).toEqual([['enc-1', 4], ['enc-2', 2]]);
    });

    it('honours explicit campaignId / sessionId arguments', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        const sessionId = service.createSessionLog(noId(createDefaultSession())); // not live
        service.updateEncounter(fight());

        expect(service.endCombat(campaign().id, sessionId)).toBe(true);
        expect(campaign().sessionLogs[0].encounterLog[0].sessionId).toBe(sessionId);
    });

    it('does not archive an encounter with no combatants, but still resets it', () => {
        const { service, campaign, sessionId } = liveSession();
        service.updateEncounter({ ...fight(sessionId), combatants: [], round: 3 });

        expect(service.endCombat()).toBe(false);
        expect(campaign().sessionLogs[0].encounterLog).toEqual([]);
        expect(campaign().activeEncounter!.round).toBe(1);
    });

    it('resets without archiving when there is no session to archive into', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        service.updateEncounter(fight());
        expect(service.endCombat()).toBe(false);
        expect(campaign().activeEncounter!.combatants).toEqual([]);
    });

    it('endSession after endCombat does not archive the blank encounter endCombat left behind', () => {
        const { service, campaign, sessionId } = liveSession();
        service.updateEncounter(fight(sessionId));
        service.endCombat();
        service.endSession();

        const log = campaign().sessionLogs.find(s => s.id === sessionId)!;
        expect(log.encounterLog.map(e => e.id)).toEqual(['enc-1']);
        expect(campaign().activeEncounter).toBeUndefined();
    });

    it('endSession still archives a fight that is live when the session ends', () => {
        const { service, campaign, sessionId } = liveSession();
        service.updateEncounter(fight(sessionId));
        service.endSession();
        expect(campaign().sessionLogs.find(s => s.id === sessionId)!.encounterLog).toHaveLength(1);
    });

    it('archived entry is independent of later activeEncounter edits', () => {
        const { service, campaign, sessionId } = liveSession();
        service.updateEncounter(fight(sessionId));
        service.endCombat();
        service.updateEncounter({ ...campaign().activeEncounter!, combatants: [{ id: 'x', name: 'X', type: 'npc', initiative: 1, hp: 1, maxHp: 1 }] });
        expect(campaign().sessionLogs[0].encounterLog[0].combatants.map(c => c.name)).toEqual(['Goblin', 'Aria']);
    });
});
