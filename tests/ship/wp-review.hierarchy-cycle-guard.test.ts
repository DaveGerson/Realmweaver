/**
 * wp-review — hierarchy cycle guards, store half (review finding U5)
 *
 * The ancestor walks behind updateLocation/updateArticle
 * (`_isLocationParentingAllowed` / `_isArticleParentingAllowed`) followed
 * parent pointers with no visited set, and batchAddToCampaign's
 * location-parent resolution guarded only DIRECT self-parenting
 * (`resolvedParentId !== loc.id`). A pre-existing parent cycle is reachable
 * data: validateImportedCampaign checks ids/titles/dedup but never referential
 * integrity, so an imported JSON with A.parentLocationId=B /
 * B.parentLocationId=A is accepted verbatim — and once present, any
 * re-parenting edit whose ancestor walk entered the cycle spun forever on the
 * main thread. Two batched locations naming each other as parents likewise
 * committed a brand-new cycle.
 *
 * These tests inject the corrupt two-node cycle through the test-only
 * `_updateState` hook (the same state a bad import produces) and then drive
 * ONLY the public API. Termination is the primary assertion: before the
 * guards, each "terminates" case below hung until the suite timeout killed it.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestEnvironment, makeTestStore, type CreateCampaignStoreFn } from '../helpers/testStoreFactory';

setupTestEnvironment();

let createCampaignStore: CreateCampaignStoreFn;

beforeAll(async () => {
    const mod = await import('../../services/campaignService');
    createCampaignStore = mod.createCampaignStore;
});

const locationData = (name: string) => ({
    name, description: '', secrets: '', loot: [], subLocationIds: [],
    connections: [], pointsOfInterest: [], history: [],
});

const articleData = (title: string) => ({
    title, category: 'lore' as const, content: '', subArticleIds: [],
});

const emptyBatch = () => ({ npcs: [], locations: [], factions: [], adventures: [], items: [] } as any);

/** Injects a raw A↔B parent cycle, exactly as a bad import would persist it. */
function injectLocationCycle(service: ReturnType<CreateCampaignStoreFn>, aId: string, bId: string) {
    service._updateState(draft => {
        const campaign = draft.campaigns[0];
        campaign.locations.find(l => l.id === aId)!.parentLocationId = bId;
        campaign.locations.find(l => l.id === bId)!.parentLocationId = aId;
    });
}

/** Follows parentLocationId from every location, asserting no id-level cycle is reachable. */
function expectAcyclicLocationParents(locations: Array<{ id: string; parentLocationId?: string }>) {
    const byId = new Map(locations.map(l => [l.id, l]));
    for (const start of locations) {
        const visited = new Set<string>();
        let current: { id: string; parentLocationId?: string } | undefined = start;
        while (current) {
            expect(visited.has(current.id)).toBe(false);
            visited.add(current.id);
            current = current.parentLocationId ? byId.get(current.parentLocationId) : undefined;
        }
    }
}

describe('updateLocation with a pre-existing two-location parent cycle (review finding U5)', () => {
    it('terminates and applies a re-parent onto a cycle member when the child is not part of the cycle', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        const aId = service.createLocation(locationData('Alpha'));
        const bId = service.createLocation(locationData('Beta'));
        const cId = service.createLocation(locationData('Gamma'));
        injectLocationCycle(service, aId, bId);

        // Before the visited guard, this walked Alpha → Beta → Alpha → … forever.
        service.updateLocation(cId, { parentLocationId: aId });

        expect(campaign().locations.find(l => l.id === cId)!.parentLocationId).toBe(aId);
        expect(campaign().locations.find(l => l.id === aId)!.subLocationIds).toContain(cId);
    });

    it('still rejects an edit that would create a NEW cycle through the child', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        const aId = service.createLocation(locationData('Alpha'));
        const bId = service.createLocation(locationData('Beta'));
        const cId = service.createLocation(locationData('Gamma'));
        injectLocationCycle(service, aId, bId);
        service.updateLocation(cId, { parentLocationId: aId });

        // Gamma's ancestors include Alpha, so Alpha → Gamma would close a new loop.
        service.updateLocation(aId, { parentLocationId: cId });

        expect(campaign().locations.find(l => l.id === aId)!.parentLocationId).toBe(bId);
    });

    it('lets the GM break the cycle by clearing a parent (continuityChecker\'s suggested fix)', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        const aId = service.createLocation(locationData('Alpha'));
        const bId = service.createLocation(locationData('Beta'));
        injectLocationCycle(service, aId, bId);

        service.updateLocation(aId, { parentLocationId: undefined });

        expect(campaign().locations.find(l => l.id === aId)!.parentLocationId).toBeUndefined();
        expectAcyclicLocationParents(campaign().locations);
    });
});

describe('updateArticle with a pre-existing two-article parent cycle (review finding U5)', () => {
    function injectArticleCycle(service: ReturnType<CreateCampaignStoreFn>, aId: string, bId: string) {
        service._updateState(draft => {
            const campaign = draft.campaigns[0];
            campaign.articles.find(a => a.id === aId)!.parentArticleId = bId;
            campaign.articles.find(a => a.id === bId)!.parentArticleId = aId;
        });
    }

    it('terminates and applies a re-parent onto a cycle member when the child is not part of the cycle', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        const aId = service.createArticle(articleData('Creation Myth'));
        const bId = service.createArticle(articleData('The First Age'));
        const cId = service.createArticle(articleData('The Sundering'));
        injectArticleCycle(service, aId, bId);

        service.updateArticle(cId, { parentArticleId: aId });

        expect(campaign().articles.find(a => a.id === cId)!.parentArticleId).toBe(aId);
    });

    it('still rejects an edit that would create a NEW cycle through the child', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        const aId = service.createArticle(articleData('Creation Myth'));
        const bId = service.createArticle(articleData('The First Age'));
        const cId = service.createArticle(articleData('The Sundering'));
        injectArticleCycle(service, aId, bId);
        service.updateArticle(cId, { parentArticleId: aId });

        service.updateArticle(aId, { parentArticleId: cId });

        expect(campaign().articles.find(a => a.id === aId)!.parentArticleId).toBe(bId);
    });
});

describe('batchAddToCampaign location-parent resolution (review finding U5)', () => {
    it('terminates when a batched location parents by name into a pre-existing cycle', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);
        const aId = service.createLocation(locationData('Alpha'));
        const bId = service.createLocation(locationData('Beta'));
        injectLocationCycle(service, aId, bId);

        service.batchAddToCampaign({
            ...emptyBatch(),
            locations: [{ ...locationData('Gamma'), parentLocationId: 'Alpha' }],
        });

        const gamma = campaign().locations.find(l => l.name === 'Gamma')!;
        expect(gamma.parentLocationId).toBe(aId);
        expect(campaign().locations.find(l => l.id === aId)!.subLocationIds).toContain(gamma.id);
    });

    it('does not commit a cycle when two batched locations name each other as parents', () => {
        const { service, campaign } = makeTestStore(createCampaignStore);

        service.batchAddToCampaign({
            ...emptyBatch(),
            locations: [
                { ...locationData('North Ward'), parentLocationId: 'South Ward' },
                { ...locationData('South Ward'), parentLocationId: 'North Ward' },
            ],
        });

        const north = campaign().locations.find(l => l.name === 'North Ward')!;
        const south = campaign().locations.find(l => l.name === 'South Ward')!;
        // At most one direction of the mutual link may land as a resolved id…
        expect(north.parentLocationId === south.id && south.parentLocationId === north.id).toBe(false);
        // …but the guard must not have blocked BOTH directions.
        expect([north, south].filter(l => l.parentLocationId === north.id || l.parentLocationId === south.id)).toHaveLength(1);
        expectAcyclicLocationParents(campaign().locations);
    });
});
