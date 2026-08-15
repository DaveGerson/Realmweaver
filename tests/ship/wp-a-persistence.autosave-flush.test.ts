// @vitest-environment jsdom
/**
 * wp-a-persistence — finding #8 (unload flush)
 *
 * There is no `beforeunload` / `pagehide` / `visibilitychange` handler anywhere
 * in the codebase, so closing the tab (or navigating away) while the 2000ms
 * autosave debounce is still pending discards the entire uncommitted burst.
 * localStorage.setItem is synchronous, so a page-lifecycle flush is reliable.
 *
 * Contract: when the page is being hidden/unloaded, any pending save must be
 * flushed synchronously before the handler returns.
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

// tests/CLAUDE.md: every `{ persist: true }` store must be destroyed in
// afterEach — the pagehide/beforeunload/visibilitychange listeners this suite
// depends on are exactly the ones that would otherwise leak into later tests.
const liveStores: Array<{ destroy: () => void }> = [];
const trackStore = <T extends { destroy: () => void }>(service: T): T => {
    liveStores.push(service);
    return service;
};

const CAMPAIGNS_KEY = 'realmweaver-campaigns';

const flushMicrotasks = () => new Promise(resolve => setTimeout(resolve, 0));

beforeAll(async () => {
    const mod = await import('../../services/campaignService');
    createCampaignStore = mod.createCampaignStore;
});

beforeEach(() => {
    for (const k in store) delete store[k];
});

afterEach(() => {
    liveStores.splice(0).forEach(service => service.destroy());
});

/** Simulates the browser tearing the page down. */
function simulatePageTeardown() {
    try {
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => 'hidden',
        });
    } catch {
        // ignore — assertion below does not depend on this succeeding
    }
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('beforeunload'));
}

describe('campaignService autosave: flush on page teardown (finding #8)', () => {
    it('persists pending edits synchronously when the page is hidden/unloaded before the debounce elapses', async () => {
        const service = trackStore(createCampaignStore({ persist: true }));
        await flushMicrotasks();

        service.createCampaign('Unsaved Session Prep', 'A fantasy world');
        service.updateCampaign({ setting: 'Three minutes of backstory typing' });

        // Nothing has been written yet — the 2s debounce is still pending.
        expect(store[CAMPAIGNS_KEY]).toBeUndefined();

        simulatePageTeardown();

        // The flush must be synchronous: by the time the lifecycle handler
        // returns, the data is in localStorage.
        expect(store[CAMPAIGNS_KEY]).toBeTruthy();
        expect(store[CAMPAIGNS_KEY]).toContain('Unsaved Session Prep');
        expect(store[CAMPAIGNS_KEY]).toContain('Three minutes of backstory typing');
    });
});
