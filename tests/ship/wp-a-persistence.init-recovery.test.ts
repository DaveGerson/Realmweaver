/**
 * wp-a-persistence — findings #1 and #35
 *
 * #1  init() catches a JSON.parse failure by calling storageService.remove() on
 *     BOTH campaign keys — irreversibly destroying the user's entire campaign
 *     library — even though storageService.getBackups()/restoreFromBackup()
 *     exist for exactly this case and are never called from app code.
 *
 * #35 The init() migration mapper backfills sessionLogs[].structuredNotes and
 *     relatedPlotIds but not plannedSceneIds / encounterLog, while the import
 *     path (importExportService.normaliseRequiredArrays) backfills all four.
 *     `SessionLog.plannedSceneIds` is non-optional and is dereferenced without
 *     a guard by goLive(), advanceScene(), SessionLogDashboard and SessionRunner.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const store: Record<string, string> = {};

vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
});

let createCampaignStore: typeof import('../../services/campaignService').createCampaignStore;
let storageService: typeof import('../../services/storageService').storageService;

const CAMPAIGNS_KEY = 'realmweaver-campaigns';
const ACTIVE_ID_KEY = 'realmweaver-active-campaign-id';

const flushMicrotasks = () => new Promise(resolve => setTimeout(resolve, 0));

const makeCampaignJson = (overrides: Record<string, unknown> = {}) => ([{
    id: 'camp-1',
    title: 'Irreplaceable Campaign',
    setting: 'A fantasy world',
    settingType: 'custom',
    npcs: [], locations: [], factions: [], items: [], adventures: [],
    plots: [], notes: [], secrets: [], articles: [], sessionLogs: [], playerCharacters: [],
    ...overrides,
}]);

beforeAll(async () => {
    const campaignMod = await import('../../services/campaignService');
    createCampaignStore = campaignMod.createCampaignStore;
    const storageMod = await import('../../services/storageService');
    storageService = storageMod.storageService;
});

beforeEach(() => {
    for (const k in store) delete store[k];
});

describe('campaignService.init(): corrupt payload recovery (finding #1)', () => {
    it('recovers campaigns from the rotating backup buffer instead of deleting the key', async () => {
        const goodJson = JSON.stringify(makeCampaignJson());

        // Simulate a normal save cycle: the first save writes goodJson as the
        // primary value (nothing to back up yet — first-ever save). A SECOND
        // save with a genuinely different value is what actually rotates
        // goodJson into backup slot 1 (a same-value no-op save deliberately
        // does not rotate — finding idx3 — so re-saving the identical value
        // here would not exercise the scenario this test wants).
        storageService.save(CAMPAIGNS_KEY, goodJson);
        storageService.save(CAMPAIGNS_KEY, goodJson + '\n');
        store[ACTIVE_ID_KEY] = 'camp-1';

        // Now the primary payload gets truncated / hand-mangled.
        store[CAMPAIGNS_KEY] = '[{"id":"camp-1","title":"Irrepla';

        const service = createCampaignStore({ persist: true });
        await flushMicrotasks();

        const state = service.getState();
        expect(state.campaigns.map(c => c.id)).toContain('camp-1');
        expect(state.campaigns.find(c => c.id === 'camp-1')!.title).toBe('Irreplaceable Campaign');
        expect(state.appStatus).not.toBe('welcome');
    });

    it('never destroys the corrupt payload when no backup can be parsed', async () => {
        const corrupt = '{{{ this is not json at all';
        store[CAMPAIGNS_KEY] = corrupt;
        store[ACTIVE_ID_KEY] = 'camp-1';

        const service = createCampaignStore({ persist: true });
        await flushMicrotasks();

        // The unparseable bytes must be preserved somewhere (either left in
        // place or quarantined under a `realmweaver-campaigns-corrupt-<ts>`
        // key) so the GM still has a chance at manual recovery / export.
        const preserved = Object.values(store).some(v => v === corrupt);
        expect(preserved).toBe(true);

        // Sanity: this is the failure branch, so no campaigns were loaded.
        expect(service.getState().campaigns).toHaveLength(0);
    });
});

describe('campaignService.init(): session log migration backfill (finding #35)', () => {
    it('backfills plannedSceneIds and encounterLog on session logs from older saves', async () => {
        store[CAMPAIGNS_KEY] = JSON.stringify(makeCampaignJson({
            sessionLogs: [{
                id: 'log-1',
                title: 'Session 1',
                status: 'planned',
                sessionDate: '',
                prepNotes: '',
                runningNotes: '',
                recap: '',
                notableEvents: '',
                looseEnds: '',
                // Old save: no plannedSceneIds, no encounterLog, no structuredNotes
            }],
        }));
        store[ACTIVE_ID_KEY] = 'camp-1';

        const service = createCampaignStore({ persist: true });
        await flushMicrotasks();

        const log = service.getState().campaigns[0].sessionLogs[0];
        expect(log.plannedSceneIds).toEqual([]);
        expect(log.encounterLog).toEqual([]);
        expect(log.structuredNotes).toEqual([]);
        expect(log.relatedPlotIds).toEqual([]);
    });

    it('goLive() on a migrated legacy session log does not throw on plannedSceneIds', async () => {
        store[CAMPAIGNS_KEY] = JSON.stringify(makeCampaignJson({
            adventures: [{ id: 'adv-1', title: 'Adventure', theme: '', hook: '', level: 1, scenes: [] }],
            sessionLogs: [{
                id: 'log-1',
                title: 'Session 1',
                status: 'planned',
                sessionDate: '',
                // An adventure link is what makes goLive() dereference
                // plannedSceneIds — the field the migration forgets to backfill.
                adventureId: 'adv-1',
                prepNotes: '',
                runningNotes: '',
                recap: '',
                notableEvents: '',
                looseEnds: '',
            }],
        }));
        store[ACTIVE_ID_KEY] = 'camp-1';

        const service = createCampaignStore({ persist: true });
        await flushMicrotasks();

        expect(() => service.goLive('log-1')).not.toThrow();
    });
});
