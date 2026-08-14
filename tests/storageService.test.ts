/**
 * storageService.test.ts
 *
 * Unit tests for Phase 5 storage robustness features:
 *   5.3 — Storage quota detection
 *   5.4 — IndexedDB fallback
 *   5.5 — Multi-tab conflict detection
 *   5.6 — Auto-backup rotating buffer
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// localStorage polyfill (must be set before dynamic import)
// ---------------------------------------------------------------------------

const store: Record<string, string> = {};

vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
});

// ---------------------------------------------------------------------------
// Dynamic import (after polyfill is in place)
// ---------------------------------------------------------------------------

let createStorageService: typeof import('../services/storageService').createStorageService;

beforeEach(async () => {
    // Clear polyfill store between tests
    for (const k in store) delete store[k];

    if (!createStorageService) {
        const mod = await import('../services/storageService');
        createStorageService = mod.createStorageService;
    }
});

// ---------------------------------------------------------------------------
// 5.3 — Basic save / load / remove
// ---------------------------------------------------------------------------

describe('storageService: basic save and load', () => {
    it('saves and loads a value via localStorage', () => {
        const svc = createStorageService();
        const result = svc.save('test-key', 'hello');
        expect(result.success).toBe(true);
        expect(result.backend).toBe('localStorage');
        expect(result.quotaWarning).toBe(false);
        expect(svc.loadSync('test-key')).toBe('hello');
    });

    it('returns null for a missing key', () => {
        const svc = createStorageService();
        expect(svc.loadSync('nonexistent')).toBeNull();
    });

    it('remove deletes the key from localStorage', () => {
        const svc = createStorageService();
        svc.save('del-key', 'value');
        svc.remove('del-key');
        expect(svc.loadSync('del-key')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// 5.3 — Quota detection
// ---------------------------------------------------------------------------

describe('storageService: quota detection (5.3)', () => {
    it('returns quotaWarning:true when localStorage throws QuotaExceededError', () => {
        const svc = createStorageService();

        // Simulate quota exceeded on the primary key write
        const quotaError = new DOMException('quota', 'QuotaExceededError');
        const origSetItem = localStorage.setItem.bind(localStorage);
        let callCount = 0;
        vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
            callCount++;
            // Only throw on the first call (primary key), succeed on backup rotation writes
            if (callCount === 1 && key === 'primary-key') {
                throw quotaError;
            }
            origSetItem(key, value);
        });

        const result = svc.save('primary-key', 'some data');
        expect(result.quotaWarning).toBe(true);
        // Even though localStorage failed, save is considered succeeded via IDB fallback
        expect(result.success).toBe(true);
        expect(result.backend).toBe('indexedDB');

        vi.restoreAllMocks();
    });
});

// ---------------------------------------------------------------------------
// 5.4 — IndexedDB fallback read-back
// ---------------------------------------------------------------------------

/** Minimal fake indexedDB backed by a plain object, async like the real one. */
function makeFakeIndexedDb(backing: Record<string, string>) {
    const makeRequest = (result: unknown, effect?: () => void) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const req: any = { result };
        setTimeout(() => {
            effect?.();
            req.onsuccess?.();
        }, 0);
        return req;
    };
    const db = {
        objectStoreNames: { contains: () => true },
        transaction: () => ({
            objectStore: () => ({
                put: (value: string, key: string) => makeRequest(undefined, () => { backing[key] = value; }),
                get: (key: string) => makeRequest(backing[key] ?? null),
                delete: (key: string) => makeRequest(undefined, () => { delete backing[key]; }),
            }),
        }),
        close: () => {},
    };
    return {
        open: () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const req: any = {};
            setTimeout(() => {
                req.result = db;
                req.onsuccess?.();
            }, 0);
            return req;
        },
    };
}

describe('storageService: IndexedDB fallback read-back (5.4)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.stubGlobal('indexedDB', undefined);
    });

    it('drops the stale localStorage copy after a quota-fallback IDB write so load() returns the fresh value', async () => {
        const idbBacking: Record<string, string> = {};
        vi.stubGlobal('indexedDB', makeFakeIndexedDb(idbBacking));

        const svc = createStorageService();
        svc.save('data-key', 'old value'); // lands in localStorage

        // Next write to the primary key hits the quota
        const quotaError = new DOMException('quota', 'QuotaExceededError');
        const origSetItem = localStorage.setItem.bind(localStorage);
        vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
            if (key === 'data-key') throw quotaError;
            origSetItem(key, value);
        });

        const result = svc.save('data-key', 'new value');
        expect(result.success).toBe(true);
        expect(result.backend).toBe('indexedDB');

        // Let the fire-and-forget IDB write + stale-copy removal settle
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(idbBacking['data-key']).toBe('new value');
        // The stale localStorage copy must be gone, otherwise load() would
        // shadow the fresher IndexedDB value on the next startup.
        expect(localStorage.getItem('data-key')).toBeNull();
        await expect(svc.load('data-key')).resolves.toBe('new value');
    });
});

// ---------------------------------------------------------------------------
// 5.5 — Multi-tab conflict detection
// ---------------------------------------------------------------------------
//
// The node test environment has no DOM / window events, so we test the
// conflict detection subscriber mechanism directly by capturing the storage
// event handler that storageService registers via window.addEventListener
// (we stub window before creating the service).
// ---------------------------------------------------------------------------

describe('storageService: conflict detection (5.5)', () => {
    // Restore globals after each conflict test so localStorage stays stubbed
    // for subsequent test suites.
    afterEach(() => {
        // Only remove the window stub; re-apply the localStorage stub so
        // later tests in this file still have access to it.
        vi.stubGlobal('window', undefined);
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => store[key] ?? null,
            setItem: (key: string, value: string) => { store[key] = value; },
            removeItem: (key: string) => { delete store[key]; },
            clear: () => { for (const k in store) delete store[k]; },
            get length() { return Object.keys(store).length; },
            key: (i: number) => Object.keys(store)[i] ?? null,
        });
    });

    it('calls onConflict subscribers when a storage event fires for a tracked key', () => {
        // Capture the storage listener registered by _initConflictDetection
        let capturedListener: ((e: { key: string | null }) => void) | null = null;
        const fakeWindow = {
            addEventListener: (_type: string, handler: (e: { key: string | null }) => void) => {
                capturedListener = handler;
            },
        };
        vi.stubGlobal('window', fakeWindow);

        const svc = createStorageService();
        const callback = vi.fn();
        svc.onConflict(callback);

        // Simulate the browser firing the 'storage' event from another tab
        capturedListener?.({ key: 'realmweaver-campaigns' });

        expect(callback).toHaveBeenCalledWith('realmweaver-campaigns');
    });

    it('unsubscribe prevents further conflict callbacks', () => {
        let capturedListener: ((e: { key: string | null }) => void) | null = null;
        const fakeWindow = {
            addEventListener: (_type: string, handler: (e: { key: string | null }) => void) => {
                capturedListener = handler;
            },
        };
        vi.stubGlobal('window', fakeWindow);

        const svc = createStorageService();
        const callback = vi.fn();
        const unsubscribe = svc.onConflict(callback);
        unsubscribe();

        capturedListener?.({ key: 'realmweaver-campaigns' });

        expect(callback).not.toHaveBeenCalled();
    });

    it('does NOT fire conflict callback for backup slot keys', () => {
        let capturedListener: ((e: { key: string | null }) => void) | null = null;
        const fakeWindow = {
            addEventListener: (_type: string, handler: (e: { key: string | null }) => void) => {
                capturedListener = handler;
            },
        };
        vi.stubGlobal('window', fakeWindow);

        const svc = createStorageService();
        const callback = vi.fn();
        svc.onConflict(callback);

        // Backup keys should be ignored by the filter. Finding #0 renamed
        // backup keys to be namespaced per primary key
        // (`${primaryKey}__backup_${index}`) instead of the old fixed
        // `CAMPAIGNS_BACKUP_<n>`; the conflict-detection filter was updated
        // in lockstep, so this exercises the new naming scheme.
        capturedListener?.({ key: 'realmweaver-campaigns__backup_1' });

        expect(callback).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// 5.6 — Auto-backup rotating buffer
// ---------------------------------------------------------------------------

describe('storageService: auto-backup (5.6)', () => {
    it('creates a backup of the existing value before overwriting', () => {
        const svc = createStorageService();
        svc.save('data-key', 'first value');
        svc.save('data-key', 'second value'); // should rotate first → backup_1

        const backups = svc.getBackups();
        expect(backups.length).toBeGreaterThanOrEqual(1);
        expect(backups[0].index).toBe(1);
        expect(backups[0].data).toBe('first value');
        expect(backups[0].timestamp).toBeTruthy();
    });

    it('rotates backups: _1 → _2 → _3 on successive saves', () => {
        const svc = createStorageService();
        svc.save('data-key', 'v1');
        svc.save('data-key', 'v2'); // v1 → backup_1
        svc.save('data-key', 'v3'); // v2 → backup_1, v1 → backup_2
        svc.save('data-key', 'v4'); // v3 → backup_1, v2 → backup_2, v1 → backup_3

        const backups = svc.getBackups();
        const byIndex = Object.fromEntries(backups.map(b => [b.index, b.data]));

        expect(byIndex[1]).toBe('v3');
        expect(byIndex[2]).toBe('v2');
        expect(byIndex[3]).toBe('v1');
    });

    it('keeps at most 3 backup slots', () => {
        const svc = createStorageService();
        for (let i = 1; i <= 6; i++) {
            svc.save('data-key', `v${i}`);
        }
        const backups = svc.getBackups();
        expect(backups.length).toBe(3);
    });

    it('restoreFromBackup writes backup data back to the primary key', () => {
        const svc = createStorageService();
        svc.save('data-key', 'original');
        svc.save('data-key', 'overwritten'); // original → backup_1

        const restored = svc.restoreFromBackup('data-key', 1);
        expect(restored).toBe(true);
        expect(svc.loadSync('data-key')).toBe('original');
    });

    it('restoreFromBackup returns false for a missing backup slot', () => {
        const svc = createStorageService();
        const restored = svc.restoreFromBackup('data-key', 2);
        expect(restored).toBe(false);
    });

    it('getBackups returns empty array when no backups exist', () => {
        const svc = createStorageService();
        expect(svc.getBackups()).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Integration: campaignService honours persist:false (existing contract)
// ---------------------------------------------------------------------------

describe('campaignService integration: persist:false still works', () => {
    it('stores nothing in localStorage when persist:false', async () => {
        const { createCampaignStore } = await import('../services/campaignService');
        const service = createCampaignStore({ persist: false });
        service.init();
        service.prepareNewCampaign();
        service.createCampaign('Test', 'A world', 'custom');

        // No localStorage writes should have occurred
        expect(store['realmweaver-campaigns']).toBeUndefined();
    });
});
