/**
 * wp-e-app-shell — finding #3 (service half)
 *
 * campaignService.init() resolves the storage read inside
 * `void (async () => { const [a, b] = await Promise.all([storageService.load(...), ...]) ... })()`
 * with no try/catch and no .catch(). storageService.load() reads
 * `globalThis.localStorage` via `_ls()` OUTSIDE any try block, so in a browser
 * that throws on localStorage access (Firefox with all cookies blocked, Safari
 * private mode) the IIFE's promise rejects unhandled and appStatus is never
 * advanced past 'loading'.
 *
 * Contract: a storage failure during init must never strand the store in
 * 'loading' — init falls back to a usable state ('welcome', since nothing could
 * be loaded) so the app has somewhere to render.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createCampaignStore } from '../../services/campaignService';

const flush = () => new Promise(resolve => setTimeout(resolve, 10));

const hostileStorage = {
    getItem: () => { throw new DOMException('The operation is insecure.', 'SecurityError'); },
    setItem: () => { throw new DOMException('The operation is insecure.', 'SecurityError'); },
    removeItem: () => {},
    clear: () => {},
    length: 0,
    key: () => null,
};

// tests/CLAUDE.md: every `{ persist: true }` store must be destroyed in
// afterEach — init() registers real page-lifecycle listeners plus a
// storageService conflict subscription that would otherwise outlive the test.
const liveStores: Array<{ destroy: () => void }> = [];
const trackStore = <T extends { destroy: () => void }>(service: T): T => {
    liveStores.push(service);
    return service;
};

beforeEach(() => {
    vi.stubGlobal('localStorage', hostileStorage);
});

afterEach(() => {
    liveStores.splice(0).forEach(service => service.destroy());
    vi.unstubAllGlobals();
});

describe('wp-e-app-shell #3 — init() must not strand the app in appStatus "loading"', () => {
    it('falls back out of "loading" when localStorage access throws', async () => {
        const service = trackStore(createCampaignStore({ persist: true }));

        await flush();

        expect(service.getState().appStatus).not.toBe('loading');
        expect(service.getState().appStatus).toBe('welcome');
    });
});
