// @vitest-environment jsdom
/**
 * wp-e-app-shell — finding #3 (UI half)
 *
 * App.tsx's appContent() switch handles 'editing' and 'loading' in the same
 * branch: `if (activeCampaign) { ... } return null;`. During startup
 * activeCampaignId is null, so the app renders `null` — a blank black screen.
 * campaignService.init()'s comment claims "the UI already renders a loading
 * state for" appStatus 'loading'; it does not. If the storage read is slow —
 * or, per the companion init-resilience test, never resolves at all — the GM
 * stares at an empty page with no spinner, no error and no recovery path.
 *
 * Contract: appStatus 'loading' renders an explicit loading/splash state, split
 * out of the 'editing' branch, even when there is no active campaign yet.
 */

import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({
    state: {
        campaigns: [] as unknown[],
        activeCampaignId: null as string | null,
        appStatus: 'loading' as string,
        saveStatus: 'idle' as string,
        lastSavedAt: null as string | null,
    },
}));

vi.mock('../../services/campaignService', () => ({
    campaignService: new Proxy({
        subscribe: () => () => {},
        getState: () => h.state,
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

afterEach(cleanup);

function renderApp() {
    return render(
        <ToastProvider>
            <ConfirmDialogProvider>
                <App />
            </ConfirmDialogProvider>
        </ToastProvider>
    );
}

describe('wp-e-app-shell #3 — appStatus "loading" must render something', () => {
    it('renders a visible loading state instead of a blank page', () => {
        const { container } = renderApp();

        const text = (container.textContent ?? '').trim();
        expect(text).not.toBe('');
        expect(text).toMatch(/loading|realmweaver/i);
    });
});
