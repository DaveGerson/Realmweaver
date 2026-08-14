// @vitest-environment jsdom
/**
 * wp-a-persistence — finding #13
 *
 * init() sets `conflictDetected = true` when another tab writes the campaigns
 * key, but nothing ever reads the flag: not persistToStorage, not scheduleSave,
 * not a single component. The stale tab therefore serialises its own snapshot
 * straight over the other tab's newer data.
 *
 * Contract (satisfied by either remedy the finding proposes — block the write,
 * or reload/merge from storage): after the conflict is signalled, a subsequent
 * local edit must NOT destroy the work the other tab persisted.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

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

const CAMPAIGNS_KEY = 'realmweaver-campaigns';
const ACTIVE_ID_KEY = 'realmweaver-active-campaign-id';

const baseCampaign = (id: string, title: string) => ({
    id,
    title,
    setting: 'A fantasy world',
    settingType: 'custom',
    npcs: [], locations: [], factions: [], items: [], adventures: [],
    plots: [], notes: [], secrets: [], articles: [], sessionLogs: [], playerCharacters: [],
});

beforeAll(async () => {
    const mod = await import('../../services/campaignService');
    createCampaignStore = mod.createCampaignStore;
});

beforeEach(() => {
    for (const k in store) delete store[k];
});

afterEach(() => {
    vi.useRealTimers();
});

describe('campaignService: cross-tab conflict must not silently clobber (finding #13)', () => {
    it('does not overwrite a campaign another tab added after this tab loaded', async () => {
        store[CAMPAIGNS_KEY] = JSON.stringify([baseCampaign('camp-a', 'Shared Campaign')]);
        store[ACTIVE_ID_KEY] = 'camp-a';

        vi.useFakeTimers();
        const service = createCampaignStore({ persist: true });
        await vi.advanceTimersByTimeAsync(1);

        expect(service.getState().campaigns.map(c => c.id)).toEqual(['camp-a']);

        // --- Another tab saves a brand new campaign ---
        const otherTabPayload = JSON.stringify([
            baseCampaign('camp-a', 'Shared Campaign'),
            baseCampaign('camp-b', 'Created In The Other Tab'),
        ]);
        const previous = store[CAMPAIGNS_KEY];
        store[CAMPAIGNS_KEY] = otherTabPayload;
        window.dispatchEvent(new StorageEvent('storage', {
            key: CAMPAIGNS_KEY,
            oldValue: previous,
            newValue: otherTabPayload,
        }));

        expect(service.getState().conflictDetected).toBe(true);

        // --- This (now stale) tab makes an edit and its autosave fires ---
        service.updateCampaign({ setting: 'Edited in the stale tab' });
        await vi.advanceTimersByTimeAsync(5000);

        const persisted = JSON.parse(store[CAMPAIGNS_KEY]) as Array<{ id: string }>;
        expect(persisted.map(c => c.id)).toContain('camp-b');
    });
});
