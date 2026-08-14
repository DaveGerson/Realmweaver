/**
 * wp-j-types-utils — finding #94
 *
 * `runSmokeTests` wipes 'realmweaver-campaigns' /
 * 'realmweaver-active-campaign-id' the moment it gets past the
 * `import.meta.env.DEV` guard, and App.tsx:100-104 invokes it from a
 * useEffect on every mount. A developer running `npm run dev` with real
 * campaign data loses the persisted copy on every page load — and because
 * `campaignService.init()` uses `_internalUpdate` (no debounced save), a
 * second reload without a mutating edit loses the data for good.
 *
 * Contract pinned here:
 *   1. DEV alone is NOT enough — the suite runs only when explicitly opted
 *      in (import.meta.env.VITE_RUN_SMOKE_TESTS). Without the opt-in it must
 *      touch no storage and fire no AI calls.
 *   2. When it does run, it must clear the saved campaigns through
 *      `storageService.remove()` (which drops the IndexedDB copy too), not
 *      raw `localStorage.removeItem` — otherwise a machine that fell back to
 *      IDB on a quota error resurrects the campaigns from `load()`.
 *
 * NOTE for the implementer: the second case of the existing
 * tests/smokeTestDevGuard.test.ts ("proceeds past the guard and touches
 * localStorage when DEV is true") encodes the OLD contract and must be
 * updated to set the opt-in flag as part of this fix.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Every aiService export smokeTest.ts uses, stubbed inert — and counted, so we
// can assert the suite fired no generation calls when not opted in.
//
// NOTE: `get` must special-case `then` — a Proxy that answers every property
// access with a function makes the mocked module look "thenable" to the
// module loader's own Promise-resolution machinery, which then calls
// `mod.then(resolve, reject)` once while awaiting the dynamic `import(...)`
// below. Without this guard that phantom call is indistinguishable from a
// real (bad) AI call and fails the "does nothing" assertion regardless of
// runSmokeTests' own logic — this is a mock-setup artifact, not a change in
// contract under test.
const aiCalls = vi.fn();
vi.mock('../../services/aiService', () => {
    const inert = async (...args: unknown[]) => { aiCalls(...args); return {}; };
    return new Proxy({}, { get: (_t, prop) => (prop === 'then' ? undefined : inert) });
});

vi.mock('../../services/campaignService', () => {
    const makeStore = () => {
        const target: Record<string, unknown> = {};
        return new Proxy(target, {
            get(t, prop: string) {
                if (prop in t) return t[prop as keyof typeof t];
                if (prop === 'getState') return () => ({ campaigns: [], activeCampaignId: null, appStatus: 'welcome' });
                if (prop === 'getActiveCampaign') return () => undefined;
                return () => undefined;
            },
            set(t, prop: string, value) { t[prop] = value; return true; },
        });
    };
    return { createCampaignStore: makeStore };
});

const storageRemove = vi.fn();
vi.mock('../../services/storageService', () => ({
    storageService: {
        remove: (...args: unknown[]) => storageRemove(...(args as [])),
        save: vi.fn(async () => ({ ok: true })),
        load: vi.fn(async () => null),
        loadSync: vi.fn(() => null),
    },
    createStorageService: () => ({ remove: storageRemove }),
}));

let removeItemSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
    removeItemSpy = vi.fn();
    vi.stubGlobal('localStorage', {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: removeItemSpy,
        clear: vi.fn(),
        length: 0,
        key: vi.fn(() => null),
    });
    for (const m of ['log', 'warn', 'error', 'group', 'groupCollapsed', 'groupEnd'] as const) {
        vi.spyOn(console, m).mockImplementation(() => {});
    }
    aiCalls.mockClear();
    storageRemove.mockClear();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe('#94 — smoke tests require an explicit opt-in, not just DEV', () => {
    it('does nothing in a plain `npm run dev` session (DEV=true, opt-in unset)', async () => {
        vi.stubEnv('DEV', true);
        vi.stubEnv('VITE_RUN_SMOKE_TESTS', undefined as unknown as string);
        const { runSmokeTests } = await import('../../smokeTest');

        await runSmokeTests(true);

        expect(removeItemSpy).not.toHaveBeenCalled();
        expect(storageRemove).not.toHaveBeenCalled();
        expect(aiCalls).not.toHaveBeenCalled();
    });

    it('clears saved campaigns through storageService (localStorage + IDB) when opted in', async () => {
        vi.stubEnv('DEV', true);
        vi.stubEnv('VITE_RUN_SMOKE_TESTS', 'true');
        const { runSmokeTests } = await import('../../smokeTest');

        await runSmokeTests(true);

        expect(storageRemove).toHaveBeenCalledWith('realmweaver-campaigns');
        expect(storageRemove).toHaveBeenCalledWith('realmweaver-active-campaign-id');
    });
});
