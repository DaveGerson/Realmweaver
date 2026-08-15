/**
 * smokeTestDevGuard.test.ts
 *
 * Regression test for the critical finding: runSmokeTests() must never execute
 * in a production build. It unconditionally wipes the real
 * 'realmweaver-campaigns' / 'realmweaver-active-campaign-id' localStorage keys
 * and fires a full suite of AI calls, so it must be gated behind
 * import.meta.env.DEV (App.tsx's useEffect only calls it there too, but the
 * guard belongs in the function itself as defense-in-depth against any other
 * caller).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mocks -------------------------------------------------------------
// Every aiService export smokeTest.ts uses is stubbed with a fast, inert
// async function via Proxy so the "DEV is on" path can run the real suite
// logic without real (500ms-per-call) mock delays or network/CLI calls.
vi.mock('../services/aiService', () => {
    const inert = async () => ({});
    return new Proxy({}, { get: () => inert });
});

// campaignService.createCampaignStore is stubbed with a lightweight fake
// store: any method not explicitly assigned by the caller (like the test's
// own `testService.init = ...` override) is a no-op returning undefined.
vi.mock('../services/campaignService', () => {
    const makeStore = () => {
        const target: Record<string, unknown> = {};
        return new Proxy(target, {
            get(t, prop: string) {
                if (prop in t) return t[prop as keyof typeof t];
                if (prop === 'getState') return () => ({ campaigns: [], activeCampaignId: null, appStatus: 'welcome' });
                if (prop === 'getActiveCampaign') return () => undefined;
                return () => undefined;
            },
            set(t, prop: string, value) {
                t[prop] = value;
                return true;
            },
        });
    };
    return { createCampaignStore: makeStore };
});

describe('runSmokeTests dev-only guard', () => {
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
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
        vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('does nothing and warns when import.meta.env.DEV is false', async () => {
        vi.stubEnv('DEV', false);
        const { runSmokeTests } = await import('../smokeTest');

        await runSmokeTests(true);

        expect(removeItemSpy).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('Skipped: smoke tests only run in development builds.')
        );
    });

    it('still does nothing when DEV is true but the explicit smoke-test opt-in is unset', async () => {
        // Finding #94: DEV alone is not a safe enough guard — every `npm run
        // dev` session is DEV=true, so the suite must also require an
        // explicit VITE_RUN_SMOKE_TESTS opt-in before touching storage.
        vi.stubEnv('DEV', true);
        vi.stubEnv('VITE_RUN_SMOKE_TESTS', undefined as unknown as string);
        const { runSmokeTests } = await import('../smokeTest');

        await runSmokeTests(true);

        expect(removeItemSpy).not.toHaveBeenCalled();
    });
});
