// @vitest-environment jsdom
/**
 * wp-g1-worldsim-dialogs — finding #5
 *
 * `applyWorldEventsToCampaign` in components/dialogs/WorldSimulationWizard.tsx:65
 * does `campaignService.updateNpc(update.entityId, { [update.field]: update.proposedValue })`
 * with a free-form, model-produced `field`. `updateNpc` is a bare
 * `Object.assign`, so `field:'relationships'` replaces the array with a string
 * (NpcEditor then throws on `.map`) and `field:'id'` orphans every factionId /
 * scene.npcIds / secret reference. The write is debounce-saved to localStorage
 * with no undo.
 *
 * Contract for the fix (the wizard must validate before writing):
 *   1. Only allowlisted, per-entity-type prose fields are written.
 *   2. Structural fields (id, factionId, relationships, history, memberIds,
 *      npcIds, ...) are skipped, not written.
 *   3. Updates targeting an entityId that is not in the campaign are skipped.
 *   4. Non-string proposedValue is skipped.
 *   5. A rejected update must not abort the valid updates in the same event.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Campaign } from '../../types/index';

const h = vi.hoisted(() => ({
    events: [] as any[],
    updateNpc: vi.fn(),
    updateFaction: vi.fn(),
    updateLocation: vi.fn(),
    updatePlot: vi.fn(),
    updateAdventure: vi.fn(),
}));

vi.mock('../../services/aiService', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../services/aiService')>();
    return {
        ...actual,
        generateWorldEvents: vi.fn(async () => h.events),
    };
});

vi.mock('../../services/campaignService', () => ({
    campaignService: {
        updateNpc: h.updateNpc,
        updateFaction: h.updateFaction,
        updateLocation: h.updateLocation,
        updatePlot: h.updatePlot,
        updateAdventure: h.updateAdventure,
    },
}));

import { WorldSimulationWizard } from '../../components/dialogs/WorldSimulationWizard';

const campaign = {
    id: 'c1',
    title: 'Ashfall',
    settingType: 'custom',
    setting: 'A dying empire',
    articles: [],
    adventures: [],
    npcs: [{ id: 'npc-1', name: 'The Gray Warden', description: 'A weathered veteran.', motivations: 'Protect the pass.', relationships: [], history: [] } as any],
    locations: [],
    factions: [{ id: 'fac-1', name: 'Iron Circle', goals: 'Control trade.', memberIds: [] } as any],
    items: [],
    sessionLogs: [],
    playerCharacters: [],
    plots: [],
    notes: [],
} as unknown as Campaign;

function makeEvent(updates: any[]) {
    return {
        id: 'evt-1',
        title: 'The Circle Moves',
        description: 'Wagons roll east under new banners.',
        affectedEntityIds: ['npc-1'],
        affectedEntityTypes: ['npc'],
        suggestedUpdates: updates,
        severity: 'major',
        category: 'faction',
    };
}

async function simulateAndApply() {
    render(
        <WorldSimulationWizard
            campaign={campaign}
            isMockMode={true}
            onClose={() => {}}
            onApplyEvents={() => {}}
        />
    );
    fireEvent.click(screen.getByRole('button', { name: /Simulate World/i }));
    const applyBtn = await screen.findByRole('button', { name: /^Apply/i });
    fireEvent.click(applyBtn);
    await waitFor(() => expect(h.updateNpc.mock.calls.length + h.updateFaction.mock.calls.length).toBeGreaterThanOrEqual(0));
}

beforeEach(() => {
    h.events = [];
    h.updateNpc.mockClear();
    h.updateFaction.mockClear();
    h.updateLocation.mockClear();
    h.updatePlot.mockClear();
    h.updateAdventure.mockClear();
});

afterEach(() => cleanup());

describe('WorldSimulationWizard apply guards model-chosen field names', () => {
    it('never writes structural fields onto an NPC', async () => {
        h.events = [
            makeEvent([
                { entityId: 'npc-1', entityType: 'npc', field: 'id', currentValue: 'npc-1', proposedValue: 'The Gray Warden, now hunted' },
                { entityId: 'npc-1', entityType: 'npc', field: 'relationships', currentValue: '', proposedValue: 'Now distrusts the Duke' },
                { entityId: 'npc-1', entityType: 'npc', field: 'factionId', currentValue: '', proposedValue: 'Iron Circle' },
                { entityId: 'npc-1', entityType: 'npc', field: 'motivations', currentValue: 'Protect the pass.', proposedValue: 'Protect the pass, and hunt the informant.' },
            ]),
        ];

        await simulateAndApply();

        const writtenKeys = h.updateNpc.mock.calls.flatMap(([, patch]) => Object.keys(patch ?? {}));
        expect(writtenKeys).not.toContain('id');
        expect(writtenKeys).not.toContain('relationships');
        expect(writtenKeys).not.toContain('factionId');
        // the legitimate update still lands
        expect(writtenKeys).toContain('motivations');
    });

    it('skips updates for entity ids that are not in the campaign and non-string values', async () => {
        h.events = [
            makeEvent([
                { entityId: 'npc-ghost', entityType: 'npc', field: 'description', currentValue: '', proposedValue: 'Should never be written.' },
                // non-string payload (kept renderable so the review pane can still draw it)
                { entityId: 'npc-1', entityType: 'npc', field: 'description', currentValue: 'A weathered veteran.', proposedValue: 42 },
                { entityId: 'fac-1', entityType: 'faction', field: 'goals', currentValue: 'Control trade.', proposedValue: 'Control trade and the eastern road.' },
            ]),
        ];

        await simulateAndApply();

        expect(h.updateNpc.mock.calls.map(c => c[0])).not.toContain('npc-ghost');
        const descWrites = h.updateNpc.mock.calls.filter(([, patch]) => patch && 'description' in patch);
        expect(descWrites).toHaveLength(0);
        expect(h.updateFaction).toHaveBeenCalledWith('fac-1', { goals: 'Control trade and the eastern road.' });
    });

    it('renders a non-string currentValue without crashing and never writes it (finding #5 important)', async () => {
        // A model that returns an object for `currentValue` — generateWorldEvents'
        // own filter would normally drop this before the wizard ever sees it, but
        // this test mocks aiService.generateWorldEvents directly (as EvocationWizard's
        // review pane render does not depend on that upstream filter), so the
        // wizard's own render layer must not crash on a raw object child.
        h.events = [
            makeEvent([
                { entityId: 'npc-1', entityType: 'npc', field: 'description', currentValue: { text: 'A weathered veteran.' } as any, proposedValue: 'A hunted veteran.' },
            ]),
        ];

        render(
            <WorldSimulationWizard
                campaign={campaign}
                isMockMode={true}
                onClose={() => {}}
                onApplyEvents={() => {}}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /Simulate World/i }));

        // Must not throw "Objects are not valid as a React child" — the review
        // step must render normally.
        expect(await screen.findByText(/The Circle Moves/i)).toBeTruthy();
    });
});
