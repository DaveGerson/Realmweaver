import { describe, it, expect, beforeAll, vi } from 'vitest';

// Provide a minimal localStorage polyfill before importing campaignService.
// The module-level singleton (persist: true) accesses localStorage on init.
const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
});

let createCampaignStore: typeof import('../services/campaignService').createCampaignStore;
let storageService: typeof import('../services/storageService').storageService;

beforeAll(async () => {
    const campaignMod = await import('../services/campaignService');
    createCampaignStore = campaignMod.createCampaignStore;
    const storageMod = await import('../services/storageService');
    storageService = storageMod.storageService;
});

// Flush pending microtasks (the Promise.all + _internalUpdate chain inside
// campaignService.init()'s fire-and-forget async block).
const flushMicrotasks = () => new Promise(resolve => setTimeout(resolve, 0));

describe('campaignService.init(): migration backfill for older saved data', () => {
    it('backfills faction.memberIds and adventure scene npcIds when missing from a persisted save', async () => {
        for (const k in store) delete store[k];

        const legacyCampaign = {
            id: 'camp-1',
            title: 'Legacy Campaign',
            setting: 'A fantasy world',
            npcs: [],
            locations: [],
            // Old save predating the memberIds field — no `memberIds` key at all
            factions: [{ id: 'fac-1', name: 'The Order', description: '', goals: '' }],
            items: [],
            // Old save predating a scene field — scene is missing `npcIds`
            adventures: [{
                id: 'adv-1',
                title: 'Adventure',
                level: 1,
                hook: '',
                theme: '',
                scenes: [{ id: 'scene-1', title: 'Scene 1', type: 'exploration', status: 'planned', readAloudText: '', gmNotes: '', skillChecks: [], rewards: '' }],
            }],
            plots: [],
            notes: [],
            secrets: [],
            articles: [],
            sessionLogs: [],
            playerCharacters: [],
        };
        store['realmweaver-campaigns'] = JSON.stringify([legacyCampaign]);
        store['realmweaver-active-campaign-id'] = 'camp-1';

        const service = createCampaignStore({ persist: true });
        await flushMicrotasks();

        const campaign = service.getState().campaigns.find(c => c.id === 'camp-1')!;
        expect(campaign).toBeDefined();
        expect(campaign.factions[0].memberIds).toEqual([]);
        expect(campaign.adventures[0].scenes[0].npcIds).toEqual([]);

        // The backfilled arrays must be safe to mutate without throwing —
        // exercising the exact crash path the migration gap allowed
        // (_synchronizeNpcFactionLink does oldFaction.memberIds.filter(...)).
        expect(() => {
            service.createNpc({
                name: 'Test NPC', description: '', traits: '', backstory: '', motivations: '',
                secrets: '', stats: '', exampleQuote: '', factionId: 'fac-1',
                knowsPlayerHistory: [], relationships: [], history: [],
            });
        }).not.toThrow();
    });
});

describe('campaignService.init(): IndexedDB fallback recovery', () => {
    it('recovers campaign data via storageService.load() when localStorage has none (data only reached IndexedDB)', async () => {
        for (const k in store) delete store[k];

        const recoveredCampaign = {
            id: 'camp-idb',
            title: 'Recovered From IndexedDB',
            setting: 'A world that outgrew localStorage',
            npcs: [], locations: [], factions: [], items: [], adventures: [],
            plots: [], notes: [], secrets: [], articles: [], sessionLogs: [], playerCharacters: [],
        };

        // Simulate the real-world quota-fallback scenario: localStorage has
        // nothing for this key, but storageService.load() (the async,
        // IndexedDB-aware read) is able to recover it from IDB.
        const loadSpy = vi.spyOn(storageService, 'load').mockImplementation(async (key: string) => {
            if (key === 'realmweaver-campaigns') return JSON.stringify([recoveredCampaign]);
            if (key === 'realmweaver-active-campaign-id') return 'camp-idb';
            return null;
        });

        const service = createCampaignStore({ persist: true });
        await flushMicrotasks();

        expect(service.getState().campaigns.some(c => c.id === 'camp-idb')).toBe(true);
        expect(service.getState().activeCampaignId).toBe('camp-idb');
        expect(service.getState().appStatus).toBe('editing');

        loadSpy.mockRestore();
    });
});
