// @vitest-environment jsdom
/**
 * wp-a-persistence — finding #38 (import half)
 *
 * `campaignService.importCampaign` has zero test coverage, and the import
 * ingestion path disagrees with the init() ingestion path about legacy plot
 * data. init() migrates `plots[].name → title` and `plots[].keyNpcIds →
 * relatedEntityIds`; the import path's validator instead auto-names the plot
 * "Unnamed Plot 1" and resets relatedEntityIds to [], silently dropping the
 * plot's title and every linked entity.
 *
 * Contract: both ingestion paths must apply the same legacy backfills.
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

const flushMicrotasks = () => new Promise(resolve => setTimeout(resolve, 0));

const jsonFile = (data: unknown) =>
    new File([JSON.stringify(data)], 'campaign.json', { type: 'application/json' });

beforeAll(async () => {
    const mod = await import('../../services/campaignService');
    createCampaignStore = mod.createCampaignStore;
});

beforeEach(() => {
    for (const k in store) delete store[k];
});

describe('campaignService.importCampaign: legacy plot fields (finding #38)', () => {
    it('migrates legacy plot name/keyNpcIds exactly as init() does', async () => {
        const service = createCampaignStore({ persist: false });
        await flushMicrotasks();

        const file = jsonFile({
            id: 'imported-1',
            title: 'Imported Campaign',
            setting: 'A fantasy world',
            npcs: [{ id: 'npc-1', name: 'Alice' }],
            locations: [], factions: [], items: [], adventures: [],
            articles: [], sessionLogs: [], playerCharacters: [], notes: [], secrets: [],
            // Legacy shape: `name` instead of `title`, `keyNpcIds` instead of
            // `relatedEntityIds` — the exact shape init() knows how to migrate.
            plots: [{ id: 'plot-1', name: 'The Conspiracy', description: '', status: 'active', keyNpcIds: ['npc-1'] }],
        });

        await service.importCampaign(file);

        const imported = service.getState().campaigns.find(c => c.id === 'imported-1')!;
        expect(imported).toBeDefined();

        const plot = imported.plots[0];
        expect(plot.title).toBe('The Conspiracy');
        expect(plot.relatedEntityIds).toEqual(['npc-1']);
    });
});
