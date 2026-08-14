// @vitest-environment jsdom
/**
 * wp-a-persistence — finding #13 (and verifier idx0 follow-up)
 *
 * init() sets `conflictDetected = true` when another tab writes the campaigns
 * key. The FIRST fix attempt made things worse: the onConflict callback
 * replaced `draft.campaigns` wholesale with the other tab's snapshot right
 * there, which silently destroyed whatever THIS tab had in memory but had
 * not yet saved (a tab mid-edit could lose everything it typed the instant
 * another tab's write was observed — no debounce even had to elapse).
 *
 * Policy (b), implemented here:
 *   - onConflict only raises the flag; it never touches `draft.campaigns`.
 *   - `persistToStorage` refuses to write while `conflictDetected` is true,
 *     so a stale tab can no longer clobber the other tab's newer data.
 *   - `resolveConflict('reload' | 'overwrite')` is the only way to clear the
 *     flag and resume autosave — 'reload' adopts what's on disk, 'overwrite'
 *     force-saves this tab's in-memory state over it.
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
    it('does not overwrite a campaign another tab added after this tab loaded, and blocks the stale tab from writing at all', async () => {
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

        // The blocked write must leave storage byte-for-byte as the other
        // tab left it — not merely "still contains camp-b", but genuinely
        // untouched by this tab's stale/blocked save attempt.
        expect(store[CAMPAIGNS_KEY]).toBe(otherTabPayload);
        const persisted = JSON.parse(store[CAMPAIGNS_KEY]) as Array<{ id: string; setting: string }>;
        expect(persisted.map(c => c.id)).toContain('camp-b');
        expect(persisted.find(c => c.id === 'camp-a')!.setting).not.toBe('Edited in the stale tab');
    });

    it('does not wipe this tab\'s unsaved in-memory edits the instant a conflict is observed (verifier idx0 probe)', async () => {
        store[CAMPAIGNS_KEY] = JSON.stringify([baseCampaign('camp-a', 'Shared Campaign')]);
        store[ACTIVE_ID_KEY] = 'camp-a';

        vi.useFakeTimers();
        const service = createCampaignStore({ persist: true });
        await vi.advanceTimersByTimeAsync(1);

        // This tab makes an edit that is still sitting inside the 2s debounce
        // window — nothing has been written to storage yet.
        const npcId = service.createNpc({
            name: 'Unsaved NPC', description: '', traits: '', backstory: '', motivations: '',
            secrets: '', stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
        });
        expect(service.getState().campaigns[0].npcs.map(n => n.id)).toContain(npcId);

        // Another tab writes concurrently (a different, older-looking payload —
        // the exact shape doesn't matter, only that a conflict is observed).
        const otherTabPayload = JSON.stringify([baseCampaign('camp-a', 'Shared Campaign')]);
        store[CAMPAIGNS_KEY] = otherTabPayload;
        window.dispatchEvent(new StorageEvent('storage', {
            key: CAMPAIGNS_KEY,
            oldValue: null,
            newValue: otherTabPayload,
        }));

        // The conflict must be flagged WITHOUT discarding the pending, unsaved
        // NPC still sitting in this tab's in-memory state.
        expect(service.getState().conflictDetected).toBe(true);
        expect(service.getState().campaigns[0].npcs.map(n => n.id)).toContain(npcId);
    });

    describe('resolveConflict', () => {
        it("'overwrite' keeps this tab's in-memory state, force-saves it, and resumes autosave", async () => {
            store[CAMPAIGNS_KEY] = JSON.stringify([baseCampaign('camp-a', 'Shared Campaign')]);
            store[ACTIVE_ID_KEY] = 'camp-a';

            vi.useFakeTimers();
            const service = createCampaignStore({ persist: true });
            await vi.advanceTimersByTimeAsync(1);

            service.updateCampaign({ setting: 'Local tab wins' });

            const otherTabPayload = JSON.stringify([baseCampaign('camp-a', 'Other tab wins')]);
            store[CAMPAIGNS_KEY] = otherTabPayload;
            window.dispatchEvent(new StorageEvent('storage', { key: CAMPAIGNS_KEY, oldValue: null, newValue: otherTabPayload }));
            expect(service.getState().conflictDetected).toBe(true);

            service.resolveConflict('overwrite');
            await vi.advanceTimersByTimeAsync(1);

            expect(service.getState().conflictDetected).toBe(false);
            const persisted = JSON.parse(store[CAMPAIGNS_KEY]) as Array<{ setting: string }>;
            expect(persisted[0].setting).toBe('Local tab wins');

            // Autosave must be un-blocked again after resolution.
            service.updateCampaign({ setting: 'Second edit after resolve' });
            await vi.advanceTimersByTimeAsync(5000);
            expect(JSON.parse(store[CAMPAIGNS_KEY])[0].setting).toBe('Second edit after resolve');
        });

        it("'reload' discards this tab's in-memory edits and adopts the persisted snapshot", async () => {
            store[CAMPAIGNS_KEY] = JSON.stringify([baseCampaign('camp-a', 'Shared Campaign')]);
            store[ACTIVE_ID_KEY] = 'camp-a';

            vi.useFakeTimers();
            const service = createCampaignStore({ persist: true });
            await vi.advanceTimersByTimeAsync(1);

            service.updateCampaign({ setting: 'Local tab loses' });

            const otherTabPayload = JSON.stringify([{ ...baseCampaign('camp-a', 'Shared Campaign'), setting: 'Other tab wins' }]);
            store[CAMPAIGNS_KEY] = otherTabPayload;
            window.dispatchEvent(new StorageEvent('storage', { key: CAMPAIGNS_KEY, oldValue: null, newValue: otherTabPayload }));
            expect(service.getState().conflictDetected).toBe(true);

            service.resolveConflict('reload');

            expect(service.getState().conflictDetected).toBe(false);
            expect(service.getState().campaigns[0].setting).toBe('Other tab wins');

            // The reload must not have re-persisted anything — storage still
            // holds exactly what the other tab wrote.
            expect(store[CAMPAIGNS_KEY]).toBe(otherTabPayload);
        });
    });
});
