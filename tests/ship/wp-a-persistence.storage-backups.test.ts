/**
 * wp-a-persistence — finding #0
 *
 * `_backupKey()` returns a fixed `CAMPAIGNS_BACKUP_<n>` namespace regardless of
 * which primary key is being rotated, and `save()` rotates on EVERY write.
 * `campaignService.persistToStorage` writes two keys per save cycle
 * (`realmweaver-campaigns`, then `realmweaver-active-campaign-id`), so the
 * scalar active-campaign id is rotated into the same slot buffer the campaign
 * JSON uses. Effective backup depth collapses to one, and
 * `restoreFromBackup('realmweaver-campaigns', 1)` writes the bare id string
 * into the campaigns key — which then fails `JSON.parse` on the next init().
 *
 * These tests pin the desired contract: backup slots are per-primary-key, so a
 * restore of the campaigns key always yields a previous *campaigns* payload.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const store: Record<string, string> = {};

vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
});

let createStorageService: typeof import('../../services/storageService').createStorageService;

const CAMPAIGNS_KEY = 'realmweaver-campaigns';
const ACTIVE_ID_KEY = 'realmweaver-active-campaign-id';

const gen = (n: number) => JSON.stringify([{ id: 'c1', title: `Generation ${n}`, npcs: [] }]);

beforeEach(async () => {
    for (const k in store) delete store[k];
    if (!createStorageService) {
        const mod = await import('../../services/storageService');
        createStorageService = mod.createStorageService;
    }
});

/**
 * Runs `count` save cycles that mirror campaignService.persistToStorage:
 * the campaigns JSON first, then the small active-campaign-id scalar.
 */
function runSaveCycles(svc: ReturnType<typeof createStorageService>, count: number) {
    for (let i = 1; i <= count; i++) {
        svc.save(CAMPAIGNS_KEY, gen(i));
        svc.save(ACTIVE_ID_KEY, 'c1');
    }
}

describe('storageService: backup slots must be namespaced per primary key (finding #0)', () => {
    it('restoreFromBackup(campaigns, 1) restores the previous CAMPAIGNS payload, never the active-id scalar', () => {
        const svc = createStorageService();

        runSaveCycles(svc, 3);
        expect(svc.loadSync(CAMPAIGNS_KEY)).toBe(gen(3));

        expect(svc.restoreFromBackup(CAMPAIGNS_KEY, 1)).toBe(true);

        // Slot 1 for the campaigns key must be the generation immediately
        // before the current one — not 'c1' from the active-campaign-id write.
        expect(svc.loadSync(CAMPAIGNS_KEY)).toBe(gen(2));

        // And the restored value must still be parseable campaign JSON; today
        // it is the bare string 'c1', which makes init() throw and wipe storage.
        expect(() => JSON.parse(svc.loadSync(CAMPAIGNS_KEY) as string)).not.toThrow();
    });

    it('keeps a real depth-3 history of the campaigns key across interleaved writes to other keys', () => {
        const svc = createStorageService();

        runSaveCycles(svc, 3);

        expect(svc.restoreFromBackup(CAMPAIGNS_KEY, 2)).toBe(true);
        expect(svc.loadSync(CAMPAIGNS_KEY)).toBe(gen(1));
    });

    it('saving the active-campaign-id key does not disturb the campaigns backup buffer', () => {
        const svc = createStorageService();

        svc.save(CAMPAIGNS_KEY, gen(1));
        svc.save(CAMPAIGNS_KEY, gen(2));
        // Slot 1 for campaigns now holds gen(1).

        // A burst of scalar writes must not shift or overwrite campaign backups.
        svc.save(ACTIVE_ID_KEY, 'c1');
        svc.save(ACTIVE_ID_KEY, 'c2');
        svc.save(ACTIVE_ID_KEY, 'c3');

        expect(svc.restoreFromBackup(CAMPAIGNS_KEY, 1)).toBe(true);
        expect(svc.loadSync(CAMPAIGNS_KEY)).toBe(gen(1));
    });
});
