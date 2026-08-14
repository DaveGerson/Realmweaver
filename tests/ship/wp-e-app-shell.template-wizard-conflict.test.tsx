// @vitest-environment jsdom
/**
 * wp-e-app-shell — finding #55
 *
 * Two App effects run in the same commit after createCampaign flips appStatus
 * to 'editing'. The template-import effect calls
 * campaignService.importTemplateData synchronously, but the resulting state is
 * not visible until the next render. The wizard effect immediately below still
 * sees the pre-import activeCampaign (npcs/adventures/locations all empty) and
 * calls setIsFirstCampaignWizardOpen(true). Its dependency array is only
 * [activeCampaign?.id], so it never re-runs once the imported entities land and
 * the wizard stays open.
 *
 * Repro: pick a template -> submit the campaign form -> the "first campaign"
 * onboarding wizard (whose whole purpose is generating starter NPCs for an
 * EMPTY world) opens on top of a campaign that already has a full cast, and
 * dismissing it also permanently sets wizardDismissed.
 *
 * Contract: creating a campaign from a template must not open the First
 * Campaign Wizard.
 */

import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react';

const templateData = {
    title: "Winter's Daughter",
    setting: 'A frozen barrow on the edge of the moor.',
    settingType: 'custom',
    npcs: [
        { id: 't-npc-1', name: 'Xiximanter', description: 'A draconic lich' },
        { id: 't-npc-2', name: 'Sir Chyde', description: 'A knight' },
    ],
    locations: [{ id: 't-loc-1', name: 'The Barrow', description: 'Cold stone' }],
    adventures: [],
};

vi.mock('../../data/templates/index', () => ({
    getAllTemplateMeta: () => ([{
        id: 'winters-daughter',
        title: "Winter's Daughter",
        subtitle: 'Classic',
        description: 'A frozen barrow.',
        theme: 'Exploration',
        playstyle: 'Exploration',
        entityCounts: { npcs: 2, locations: 1, factions: 0, adventures: 0, scenes: 0, plots: 0 },
        fileName: 'winters-daughter.json',
    }]),
    loadTemplateData: async () => templateData,
}));

// Real store behaviour, no localStorage writes.
vi.mock('../../services/campaignService', async (importOriginal) => {
    const mod = await importOriginal<typeof import('../../services/campaignService')>();
    return { ...mod, campaignService: mod.createCampaignStore({ persist: false }) };
});

vi.mock('../../smokeTest', () => ({ runSmokeTests: async () => {} }));
vi.mock('../../services/aiService', () => ({ analyzeWritingStyle: async () => null }));

import App from '../../App';
import { campaignService } from '../../services/campaignService';
import { ToastProvider } from '../../hooks/useToast';
import { ConfirmDialogProvider } from '../../hooks/useConfirmDialog';

afterEach(cleanup);

// The campaignService mock above shares ONE store instance across every test
// in this file (module-cached), so a campaign created in one test would
// otherwise still be active — and the app already past the welcome screen —
// for the next. Reset back to a clean, campaign-less 'welcome' state first.
beforeEach(() => {
    for (const c of [...campaignService.getState().campaigns]) {
        act(() => { campaignService.deleteCampaign(c.id); });
    }
});

const tick = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

describe('wp-e-app-shell #55 — the onboarding wizard must stay shut for template campaigns', () => {
    it('does not open the First Campaign Wizard over a campaign created from a template', async () => {
        render(
            <ToastProvider>
                <ConfirmDialogProvider>
                    <App />
                </ConfirmDialogProvider>
            </ToastProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: /create a campaign/i }));
        fireEvent.click(await screen.findByRole('button', { name: /use this template/i }));
        await tick();

        fireEvent.click(screen.getByRole('button', { name: /weave campaign/i }));
        await tick();

        // The template landed…
        const campaign = campaignService.getState().campaigns[0];
        expect(campaign.npcs.map(n => n.name)).toEqual(['Xiximanter', 'Sir Chyde']);

        // …so the "your world is empty, let's generate a cast" wizard must not be up.
        expect(screen.queryByText(/tell me about your world/i)).toBeNull();
        expect(screen.queryByLabelText(/campaign setup wizard/i)).toBeNull();
    });

    it('does not re-open once the imported cast is later cleaned out (verifier idx 55 residual)', async () => {
        render(
            <ToastProvider>
                <ConfirmDialogProvider>
                    <App />
                </ConfirmDialogProvider>
            </ToastProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: /create a campaign/i }));
        fireEvent.click(await screen.findByRole('button', { name: /use this template/i }));
        await tick();

        fireEvent.click(screen.getByRole('button', { name: /weave campaign/i }));
        await tick();

        const campaignId = campaignService.getState().campaigns[0].id;
        expect(campaignService.getState().campaigns[0].npcs).toHaveLength(2);
        expect(campaignService.getState().campaigns[0].wizardDismissed).toBeFalsy();

        // GM deletes every NPC/location the template seeded — the campaign's
        // npcs/adventures/locations counts all go back to zero, exactly the
        // condition the auto-open check looks for.
        for (const npc of [...campaignService.getState().campaigns[0].npcs]) {
            act(() => { campaignService.deleteNpc(npc.id); });
        }
        for (const loc of [...campaignService.getState().campaigns[0].locations]) {
            act(() => { campaignService.deleteLocation(loc.id); });
        }
        await tick();

        const cleaned = campaignService.getState().campaigns.find(c => c.id === campaignId)!;
        expect(cleaned.npcs).toHaveLength(0);
        expect(cleaned.locations).toHaveLength(0);

        // Wizard must stay shut — it already made its one auto-open decision
        // for this campaign (to stay closed, because the template had
        // content) and must not reopen just because the GM emptied it out.
        expect(screen.queryByText(/tell me about your world/i)).toBeNull();
        expect(screen.queryByLabelText(/campaign setup wizard/i)).toBeNull();
    });
});
