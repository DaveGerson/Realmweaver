/**
 * wp-f2-entity-editors — findings #22 (store half) and #71 (store half)
 *
 * #22 `createLocation` only backfills `history`; `createFaction` backfills
 *     nothing. AI-produced entities deliberately omit the relationship arrays
 *     (`aiService.generateLocation` is typed
 *     `Omit<Location, 'id' | 'parentLocationId' | 'subLocationIds'>`) and the
 *     RealmChat approve path hands raw draft JSON straight to
 *     `campaignService.createLocation` / `createFaction`. The stored entity
 *     therefore has `subLocationIds === undefined` / `memberIds === undefined`,
 *     which is what makes LocationEditor:292 and FactionEditor:137 throw
 *     `Cannot read properties of undefined (reading 'includes')` the instant
 *     App.tsx selects the freshly approved entity.
 *
 *     Note the localStorage load migration already backfills `memberIds`
 *     (campaignService.ts:365) — creation must do the same so an entity is
 *     never in a shape only a reload can repair.
 *
 * #71 FactionEditor's "Generate member NPC" panel runs while the editor is the
 *     chat-generator PREVIEW (FactionDashboard renders it with
 *     `faction={{ ...data, id: 'preview' }}`), so it calls
 *     `campaignService.createNpc({ ..., factionId: 'preview' })`. No faction
 *     with that id exists, `_synchronizeNpcFactionLink` records no membership,
 *     and the NPC keeps a dangling foreign key forever.
 *
 * Contract: creating an entity must never leave a required array field
 * undefined, and must never persist a `factionId` that does not resolve to an
 * existing faction.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestEnvironment, makeTestStore, type CreateCampaignStoreFn } from '../helpers/testStoreFactory';

setupTestEnvironment();

let createCampaignStore: CreateCampaignStoreFn;

beforeAll(async () => {
    const mod = await import('../../services/campaignService');
    createCampaignStore = mod.createCampaignStore;
});

describe('wp-f2-entity-editors #22 — created entities always have their relationship arrays', () => {
    it('createLocation backfills subLocationIds when the AI draft omits it', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);

        // Exactly the shape aiService.generateLocation returns (no id,
        // parentLocationId or subLocationIds) plus what RealmChat forwards.
        const draft = {
            name: 'The Sunken Ward',
            description: 'A flooded district',
            secrets: '',
            loot: [],
            connections: [],
            pointsOfInterest: [],
        } as unknown as Parameters<typeof service.createLocation>[0];

        const id = service.createLocation(draft);
        const stored = campaign().locations.find(l => l.id === id)!;

        expect(stored).toBeDefined();
        expect(Array.isArray(stored.subLocationIds)).toBe(true);
        expect(stored.subLocationIds).toEqual([]);
        // history is already defaulted today — assert it stays defaulted.
        expect(Array.isArray(stored.history)).toBe(true);
    });

    it('createFaction backfills memberIds when the AI draft omits it', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);

        const draft = {
            name: 'The Ashen Compact',
            description: 'Brokers of burnt bargains',
            goals: 'Control the harbour',
            alignment: 'Lawful Evil',
        } as unknown as Parameters<typeof service.createFaction>[0];

        const id = service.createFaction(draft);
        const stored = campaign().factions.find(f => f.id === id)!;

        expect(stored).toBeDefined();
        expect(Array.isArray(stored.memberIds)).toBe(true);
        expect(stored.memberIds).toEqual([]);
    });
});

describe('wp-f2-entity-editors #71 — createNpc must not persist a dangling factionId', () => {
    it('drops a factionId that does not resolve to an existing faction', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);

        const npcId = service.createNpc({
            name: 'Guildsworn Runner',
            description: '', traits: '', backstory: '', motivations: '', secrets: '',
            stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
            // 'preview' is the synthetic id FactionDashboard gives the unsaved draft.
            factionId: 'preview',
        } as unknown as Parameters<typeof service.createNpc>[0]);

        const stored = campaign().npcs.find(n => n.id === npcId)!;
        expect(stored).toBeDefined();
        expect(stored.factionId).toBeUndefined();
    });

    it('keeps a factionId that does resolve, and records the membership', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);

        const factionId = service.createFaction({
            name: 'Harbour Watch', description: '', goals: '', alignment: 'Lawful Neutral',
            memberIds: [],
        } as unknown as Parameters<typeof service.createFaction>[0]);

        const npcId = service.createNpc({
            name: 'Watch Captain',
            description: '', traits: '', backstory: '', motivations: '', secrets: '',
            stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
            factionId,
        } as unknown as Parameters<typeof service.createNpc>[0]);

        const npc = campaign().npcs.find(n => n.id === npcId)!;
        const faction = campaign().factions.find(f => f.id === factionId)!;

        expect(npc.factionId).toBe(factionId);
        expect(faction.memberIds).toContain(npcId);
    });
});
