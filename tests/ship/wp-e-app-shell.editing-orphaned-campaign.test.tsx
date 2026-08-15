// @vitest-environment jsdom
/**
 * wp-e-app-shell — finding #3 (verifier follow-up: the 'editing' half)
 *
 * App.tsx's appContent() switch used to share a branch between 'loading' and
 * 'editing': `if (activeCampaign) { ... } return null;`. Splitting 'loading'
 * out fixed the startup case, but appStatus 'editing' with an
 * activeCampaignId that no longer resolves to a campaign (e.g. a cross-tab
 * storage-conflict snapshot that no longer contains the campaign this tab
 * was editing, per services/campaignService.ts's conflict handler) still hit
 * the bare `return null;` — an unrecoverable blank/black screen.
 *
 * Contract:
 *   1. appStatus 'editing' with an unresolvable activeCampaignId renders a
 *      visible, non-empty recovery state, never a blank page;
 *   2. App reacts to that state by calling
 *      campaignService.switchToCampaignSelector() to recover automatically,
 *      instead of leaving the user stuck.
 */

import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({
    state: {
        campaigns: [] as unknown[],
        activeCampaignId: 'deleted-by-other-tab' as string | null,
        appStatus: 'editing' as string,
        saveStatus: 'idle' as string,
        lastSavedAt: null as string | null,
    },
    calls: [] as string[],
}));

vi.mock('../../services/campaignService', () => ({
    campaignService: new Proxy({
        subscribe: () => () => {},
        getState: () => h.state,
        switchToCampaignSelector: () => { h.calls.push('switchToCampaignSelector'); },
    } as Record<string, unknown>, {
        get(target, prop: string) {
            if (prop in target) return target[prop];
            return () => {};
        },
    }),
}));

// Never let the dev-only smoke tests or any AI call run from a unit test.
vi.mock('../../smokeTest', () => ({ runSmokeTests: async () => {} }));
vi.mock('../../services/aiService', () => ({ analyzeWritingStyle: async () => null }));

import App from '../../App';
import { ToastProvider } from '../../hooks/useToast';
import { ConfirmDialogProvider } from '../../hooks/useConfirmDialog';

afterEach(() => {
    cleanup();
    h.calls.length = 0;
});

function renderApp() {
    return render(
        <ToastProvider>
            <ConfirmDialogProvider>
                <App />
            </ConfirmDialogProvider>
        </ToastProvider>
    );
}

describe("wp-e-app-shell #3 — appStatus 'editing' with an orphaned activeCampaignId must not blank the page", () => {
    it('renders a visible recovery state instead of nothing', () => {
        const { container } = renderApp();

        const text = (container.textContent ?? '').trim();
        expect(text).not.toBe('');
        expect(text).toMatch(/campaign/i);
    });

    it('calls campaignService.switchToCampaignSelector() to recover automatically', () => {
        renderApp();
        expect(h.calls).toContain('switchToCampaignSelector');
    });
});
