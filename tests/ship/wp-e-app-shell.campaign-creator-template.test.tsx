// @vitest-environment jsdom
/**
 * wp-e-app-shell — finding #20
 *
 * CampaignCreator calls onTemplateSelected(templateData) as soon as a template
 * card is clicked, and App stashes it in pendingTemplateData, which is bulk
 * imported the moment appStatus becomes 'editing'. But neither of the two
 * escape hatches clears it: handleSkipTemplate only does
 * setStep('campaign-form'), and the "Back to templates" button only does
 * setStep('template-select').
 *
 * Repro: "Use This Template" -> "Back to templates" -> "Start From Scratch" ->
 * submit. The supposedly empty campaign is silently populated with the
 * template's NPCs, locations, factions and adventures.
 *
 * Contract: leaving the template behind must retract the pending template —
 * CampaignCreator emits the cleared selection (onTemplateSelected(null), or the
 * dedicated onTemplateCleared callback the fix may introduce) from BOTH the
 * "Back to templates" button and the "Start From Scratch" skip.
 */

import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react';

const templateData = {
    title: 'Winter\'s Daughter',
    setting: 'A frozen barrow',
    npcs: [{ id: 't-npc-1', name: 'Zorgamazoo' }],
};

vi.mock('../../data/templates/index', () => ({
    getAllTemplateMeta: () => ([{
        id: 'winters-daughter',
        title: "Winter's Daughter",
        subtitle: 'Classic',
        description: 'A frozen barrow.',
        theme: 'Exploration',
        playstyle: 'Exploration',
        entityCounts: { npcs: 1, locations: 0, factions: 0, adventures: 0, scenes: 0, plots: 0 },
        fileName: 'winters-daughter.json',
    }]),
    loadTemplateData: async () => templateData,
}));

import { CampaignCreator } from '../../components/views/CampaignCreator';

afterEach(cleanup);

/** Records every value CampaignCreator hands to App, including clears. */
function renderCreator() {
    const emitted: Array<Record<string, unknown> | null> = [];
    const cleared: number[] = [];
    render(
        <CampaignCreator
            onCreateCampaign={() => {}}
            onTemplateSelected={(data: Record<string, unknown> | null) => { emitted.push(data); }}
            // The fix may instead introduce a dedicated clear callback; either
            // satisfies the contract. Extra props are ignored by the component.
            {...{ onTemplateCleared: () => { cleared.push(1); } } as Record<string, unknown>}
        />
    );
    return { emitted, cleared };
}

const pickTemplate = async () => {
    fireEvent.click(screen.getByRole('button', { name: /use this template/i }));
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
};

const wasRetracted = (emitted: Array<Record<string, unknown> | null>, cleared: number[]) =>
    cleared.length > 0 || emitted[emitted.length - 1] === null;

describe('wp-e-app-shell #20 — abandoning a template must not leak its data into a scratch campaign', () => {
    it('retracts the pending template when the GM goes back to the template list', async () => {
        const { emitted, cleared } = renderCreator();

        await pickTemplate();
        expect(emitted[0]).toEqual(templateData);

        fireEvent.click(screen.getByRole('button', { name: /back to templates/i }));

        expect(wasRetracted(emitted, cleared)).toBe(true);
    });

    it('retracts the pending template when the GM then picks "Start From Scratch"', async () => {
        const { emitted, cleared } = renderCreator();

        await pickTemplate();
        fireEvent.click(screen.getByRole('button', { name: /back to templates/i }));
        emitted.length = 0;
        cleared.length = 0;

        fireEvent.click(screen.getByRole('button', { name: /start from scratch/i }));

        expect(wasRetracted(emitted, cleared)).toBe(true);
    });
});
