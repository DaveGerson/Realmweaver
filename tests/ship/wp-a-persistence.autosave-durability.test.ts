/**
 * wp-a-persistence — findings #8 (max-wait) and #9 (IDB fallback durability)
 *
 * #8 `scheduleSave()` clears and re-arms a 2000ms timer on EVERY updateState.
 *    Editors call onUpdate on every keystroke, so continuous typing means the
 *    debounce never elapses and persistToStorage() never runs — a GM can type
 *    for minutes with zero writes while the UI shows a 'saving' spinner.
 *    Contract: a bounded max-wait must force a write regardless of activity.
 *
 * #9 On QuotaExceededError, save() fires idbSet() without awaiting and returns
 *    `{ success: true }`, so campaignService stamps lastSavedAt and reports
 *    'quota-warning'. When IndexedDB is unavailable (private browsing, blocked
 *    site data) the write is silently dropped but the UI says "saved".
 *    Contract: never stamp lastSavedAt for a write that was not durably
 *    confirmed; surface an error status instead.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

const store: Record<string, string> = {};
let quotaExceededKeys: string[] = [];

vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
        if (quotaExceededKeys.includes(key)) {
            throw new DOMException('quota', 'QuotaExceededError');
        }
        store[key] = value;
    },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
});

let createCampaignStore: typeof import('../../services/campaignService').createCampaignStore;

const CAMPAIGNS_KEY = 'realmweaver-campaigns';

beforeAll(async () => {
    const mod = await import('../../services/campaignService');
    createCampaignStore = mod.createCampaignStore;
});

beforeEach(() => {
    for (const k in store) delete store[k];
    quotaExceededKeys = [];
});

afterEach(() => {
    vi.useRealTimers();
});

describe('campaignService autosave: bounded max-wait (finding #8)', () => {
    it('flushes to storage during a long burst of edits that never pauses for the full debounce', async () => {
        vi.useFakeTimers();

        const service = createCampaignStore({ persist: true });
        // Let init()'s fire-and-forget async block settle.
        await vi.advanceTimersByTimeAsync(1);
        expect(service.getState().appStatus).toBe('welcome');

        service.createCampaign('Typing Test', 'A fantasy world');

        // 60 seconds of continuous typing: one edit per second, i.e. always
        // faster than the 2000ms debounce window.
        for (let i = 0; i < 60; i++) {
            service.updateCampaign({ setting: `A fantasy world ${i}` });
            await vi.advanceTimersByTimeAsync(1000);
        }

        // Something must have been written well before the 60s mark.
        expect(service.getState().lastSavedAt).not.toBeNull();
        expect(store[CAMPAIGNS_KEY]).toBeTruthy();
        expect(store[CAMPAIGNS_KEY]).toContain('Typing Test');
    });
});

describe('campaignService autosave: honest reporting when the write is not durable (finding #9)', () => {
    it('does not report a successful save when the localStorage quota is hit and IndexedDB is unavailable', async () => {
        // No globalThis.indexedDB in this environment, so idbSet() rejects with
        // 'IndexedDB not available' — exactly the private-browsing scenario.
        expect((globalThis as unknown as { indexedDB?: unknown }).indexedDB).toBeUndefined();

        vi.useFakeTimers();

        const service = createCampaignStore({ persist: true });
        await vi.advanceTimersByTimeAsync(1);

        quotaExceededKeys = [CAMPAIGNS_KEY];

        service.createCampaign('Doomed Campaign', 'A fantasy world');

        // Let the debounce fire and every IDB promise settle.
        await vi.advanceTimersByTimeAsync(5000);
        await vi.advanceTimersByTimeAsync(5000);

        const state = service.getState();
        expect(state.saveStatus).toBe('error');
        expect(state.lastSavedAt).toBeNull();
        expect(store[CAMPAIGNS_KEY]).toBeUndefined();
    });
});
