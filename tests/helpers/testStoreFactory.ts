import { vi } from 'vitest';

// Provide a minimal localStorage polyfill before importing campaignService.
// The module-level singleton (persist: true) accesses localStorage on init.
// Call setupTestEnvironment() before any dynamic import of campaignService.
const store: Record<string, string> = {};

export function setupTestEnvironment() {
    vi.stubGlobal('localStorage', {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { for (const k in store) delete store[k]; },
        get length() { return Object.keys(store).length; },
        key: (i: number) => Object.keys(store)[i] ?? null,
    });
}

// Type for the factory function (resolved after dynamic import in beforeAll)
export type CreateCampaignStoreFn = typeof import('../../services/campaignService').createCampaignStore;

/**
 * Creates a fresh, isolated test store with a single campaign already set up.
 * Accepts the factory function resolved from a dynamic import in beforeAll.
 */
export function makeTestStore(createCampaignStore: CreateCampaignStoreFn, campaignTitle = 'Test Campaign', setting = 'A fantasy world', settingType: 'custom' | 'official' = 'custom') {
    const service = createCampaignStore({ persist: false });
    service.init();
    service.prepareNewCampaign();
    service.createCampaign(campaignTitle, setting, settingType);

    const campaign = () => service.getState().campaigns[0];

    return { service, campaign };
}
