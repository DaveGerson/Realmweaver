/**
 * wp-g2-wizards-coach — finding #74
 *
 * EvocationWizard's "Detailed" mode lets the DM link a generated NPC to an
 * *existing* faction; the wizard attaches that faction's UUID as `npc.factionId`
 * (EvocationWizard.tsx:205) and the same for `location.parentLocationId`
 * (EvocationWizard.tsx:206).
 *
 * `campaignService.batchAddToCampaign` (campaignService.ts:1853-1871) only
 * performs the reverse link (`faction.memberIds.push(...)` /
 * `parent.subLocationIds.push(...)`) inside the
 * `factionNameMap.has(name.toLowerCase())` branch — a *name* lookup that can
 * never match a UUID. So the forward reference survives but the reverse one is
 * silently dropped, violating the bidirectional NPC <-> Faction / Location
 * hierarchy invariant that CLAUDE.md states and that FactionEditor's roster and
 * RelationshipGraph's 'member-of' edges are derived from.
 *
 * Contract for the fix:
 *   1. When `npc.factionId` is already a resolved id of a faction present in the
 *      draft, keep it AND push the npc id into that faction's `memberIds`.
 *   2. Same for `location.parentLocationId` -> `parent.subLocationIds`.
 *   3. The existing name-based resolution must keep working unchanged.
 *   4. Neither push may duplicate an id that is already present.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestEnvironment, makeTestStore, type CreateCampaignStoreFn } from '../helpers/testStoreFactory';

setupTestEnvironment();

let createCampaignStore: CreateCampaignStoreFn;

beforeAll(async () => {
    const mod = await import('../../services/campaignService');
    createCampaignStore = mod.createCampaignStore;
});

const emptyBatch = () => ({ npcs: [], locations: [], factions: [], adventures: [], items: [] } as any);

const npcData = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    description: '',
    traits: '',
    backstory: '',
    motivations: '',
    secrets: '',
    stats: '',
    exampleQuote: '',
    ...extra,
});

const locationData = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    description: '',
    secrets: '',
    loot: [],
    connections: [],
    pointsOfInterest: [],
    ...extra,
});

describe('batchAddToCampaign — wizard-linked entities must produce bidirectional relationships', () => {
    it('pushes the new NPC into the linked existing faction\'s memberIds when factionId is already a resolved id', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);

        const factionId = service.createFaction({
            name: 'Iron Circle', description: '', goals: '', memberIds: [],
        });

        service.batchAddToCampaign({ ...emptyBatch(), npcs: [npcData('Kael Draven', { factionId })] });

        const npc = campaign().npcs.find(n => n.name === 'Kael Draven')!;
        const faction = campaign().factions.find(f => f.id === factionId)!;

        // Forward link is preserved (it already is today)…
        expect(npc.factionId).toBe(factionId);
        // …and the reverse link must exist too (this is the bug).
        expect(faction.memberIds).toContain(npc.id);
    });

    it('pushes the new location into the linked existing parent\'s subLocationIds when parentLocationId is already a resolved id', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);

        const parentId = service.createLocation(locationData('Emberhold', { subLocationIds: [], history: [] }) as any);

        service.batchAddToCampaign({
            ...emptyBatch(),
            locations: [locationData('The Sunken Market', { parentLocationId: parentId })],
        });

        const child = campaign().locations.find(l => l.name === 'The Sunken Market')!;
        const parent = campaign().locations.find(l => l.id === parentId)!;

        expect(child.parentLocationId).toBe(parentId);
        expect(parent.subLocationIds).toContain(child.id);
    });

    it('still resolves name-based links and does not duplicate an id already present in memberIds', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);

        const factionId = service.createFaction({
            name: 'Iron Circle', description: '', goals: '', memberIds: [],
        });

        // Name-based resolution (the path the AI normally produces) must keep working.
        service.batchAddToCampaign({ ...emptyBatch(), npcs: [npcData('Sera Vance', { factionId: 'iron circle' })] });
        const sera = campaign().npcs.find(n => n.name === 'Sera Vance')!;
        expect(sera.factionId).toBe(factionId);
        expect(campaign().factions.find(f => f.id === factionId)!.memberIds).toContain(sera.id);

        // A second batch that re-links the same NPC id must not duplicate the membership.
        service.batchAddToCampaign({ ...emptyBatch(), npcs: [npcData('Bran Holt', { factionId })] });
        const faction = campaign().factions.find(f => f.id === factionId)!;
        const bran = campaign().npcs.find(n => n.name === 'Bran Holt')!;
        expect(faction.memberIds).toContain(bran.id);
        expect(faction.memberIds.filter(id => id === sera.id)).toHaveLength(1);
    });
});
