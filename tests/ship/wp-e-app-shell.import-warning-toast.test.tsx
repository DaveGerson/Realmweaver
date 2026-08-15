// @vitest-environment jsdom
/**
 * wp-e-app-shell — wp-b idx 3 (App.tsx:255), file owned by wp-e this round.
 *
 * handleImportCampaign used to fire one addToast(warning, 'info') per
 * validation warning PLUS a summary toast, all synchronously in the same
 * tick. hooks/useToast.ts enforces MAX_TOASTS = 3 and drops the OLDEST
 * entries first — so with 4+ warnings, the earliest (often the most
 * important, e.g. "N NPC(s) were removed because they were missing a
 * required id field.") is silently evicted from the DOM before the GM ever
 * sees it.
 *
 * Contract: warnings must be aggregated into a single toast (or otherwise
 * shielded from the toast cap) so no warning can be evicted.
 */

import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, act, within } from '@testing-library/react';

const h = vi.hoisted(() => ({
    state: {
        campaigns: [] as unknown[],
        activeCampaignId: null as string | null,
        appStatus: 'welcome' as string,
        saveStatus: 'idle' as string,
        lastSavedAt: null as string | null,
    },
    warnings: [
        '1 NPC(s) were removed because they were missing a required "id" field.',
        '1 Location(s) were removed because they were missing a required "id" field.',
        '1 Faction(s) were removed because they were missing a required "id" field.',
        '1 Item(s) were removed because they were missing a required "id" field.',
    ],
}));

vi.mock('../../services/campaignService', () => ({
    campaignService: new Proxy({
        subscribe: () => () => {},
        getState: () => h.state,
        importCampaign: async () => ({ title: 'Broken Campaign', warnings: h.warnings }),
    } as Record<string, unknown>, {
        get(target, prop: string) {
            if (prop in target) return target[prop];
            return () => {};
        },
    }),
}));

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

describe('wp-e-app-shell — import warnings must survive the 3-toast cap', () => {
    it('surfaces every warning in a single toast instead of one-per-warning', async () => {
        const { container } = renderApp();

        fireEvent.click(screen.getByRole('button', { name: /import an existing campaign/i }));
        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        expect(input).toBeTruthy();

        const file = new File(['{}'], 'broken-campaign.json', { type: 'application/json' });
        Object.defineProperty(input, 'files', { value: [file], configurable: true });

        await act(async () => {
            fireEvent.change(input);
            await new Promise(r => setTimeout(r, 0));
        });

        const alerts = screen.getAllByRole('alert');
        // Exactly one toast for the whole import — not one per warning
        // fighting hooks/useToast.ts's MAX_TOASTS = 3 cap.
        expect(alerts).toHaveLength(1);

        const toastText = within(alerts[0]).getByText(/imported with/i).textContent ?? '';
        for (const warning of h.warnings) {
            expect(toastText).toContain(warning);
        }
    });
});
