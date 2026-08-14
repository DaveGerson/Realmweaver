// @vitest-environment jsdom
/**
 * wp-e-app-shell — wp-j finding #94 residual (App.tsx:100-104, owned by wp-e
 * this round).
 *
 * smokeTest.ts now gates the whole suite behind an explicit
 * VITE_RUN_SMOKE_TESTS opt-in, so a plain `npm run dev` never runs it. But
 * App.tsx's effect still had `[isMockMode]` as its dependency array — so a
 * developer who HAS opted in and then flips the Mock Mode toggle mid-session
 * re-runs the whole suite against the real provider (~21 live generation/
 * chat calls) and re-wipes the campaign save keys.
 *
 * Contract: runSmokeTests is invoked once per mount and does NOT re-run when
 * isMockMode changes.
 */

import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react';

const smokeTestCalls = vi.fn();
vi.mock('../../smokeTest', () => ({
    runSmokeTests: async (isMockMode: boolean) => { smokeTestCalls(isMockMode); },
}));

vi.mock('../../data/templates/index', () => ({
    getAllTemplateMeta: () => ([]),
    loadTemplateData: async () => null,
}));

// Real store behaviour, no localStorage writes.
vi.mock('../../services/campaignService', async (importOriginal) => {
    const mod = await importOriginal<typeof import('../../services/campaignService')>();
    return { ...mod, campaignService: mod.createCampaignStore({ persist: false }) };
});

vi.mock('../../services/aiService', () => ({ analyzeWritingStyle: async () => null }));

import App from '../../App';
import { ToastProvider } from '../../hooks/useToast';
import { ConfirmDialogProvider } from '../../hooks/useConfirmDialog';

afterEach(cleanup);

const tick = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

describe('wp-e-app-shell — the dev-only smoke-test effect must not re-fire when Mock Mode is toggled', () => {
    it('calls runSmokeTests once on mount and not again after toggling Mock Mode', async () => {
        render(
            <ToastProvider>
                <ConfirmDialogProvider>
                    <App />
                </ConfirmDialogProvider>
            </ToastProvider>
        );
        await tick();

        const callsAfterMount = smokeTestCalls.mock.calls.length;
        expect(callsAfterMount).toBeGreaterThanOrEqual(1);

        // Get into 'editing' so the Header (and its Mock Mode toggle) renders.
        fireEvent.click(screen.getByRole('button', { name: /create a campaign/i }));
        fireEvent.click(await screen.findByRole('button', { name: /start from scratch/i }));
        fireEvent.change(screen.getByPlaceholderText(/the sundered crown/i), { target: { value: 'My Campaign' } });
        fireEvent.click(screen.getByRole('button', { name: /weave campaign/i }));
        await tick();

        const mockModeToggle = screen.getByLabelText('Mock Mode');
        fireEvent.click(mockModeToggle);
        fireEvent.click(mockModeToggle);
        fireEvent.click(mockModeToggle);
        await tick();

        // Toggling Mock Mode after mount must not trigger additional runs.
        expect(smokeTestCalls.mock.calls.length).toBe(callsAfterMount);
    });
});
