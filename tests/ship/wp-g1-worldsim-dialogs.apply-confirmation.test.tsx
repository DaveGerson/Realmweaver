// @vitest-environment jsdom
/**
 * wp-g1-worldsim-dialogs — finding #24
 *
 * `handleApply` (components/dialogs/WorldSimulationWizard.tsx:162) mutates the
 * campaign, calls `onApplyEvents(approved)` and only then `setStep('applied')`.
 * App.tsx:563 wires `onApplyEvents={() => setIsWorldSimOpen(false)}`, so the
 * wizard unmounts in the same batch and the 'applied' confirmation branch plus
 * its "Done" button are dead code: the DM sees the modal vanish with no
 * feedback that three entities were just mutated and persisted.
 *
 * Contract for the fix (keeping App.tsx's existing close-on-apply wiring):
 *   1. `handleApply` applies the events and shows the 'applied' confirmation.
 *   2. `onApplyEvents` (which the parent uses to close the wizard) is NOT
 *      called during handleApply — it is deferred until the DM acknowledges.
 *   3. Clicking "Done" then notifies the parent with the approved events.
 */

import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import type { Campaign } from '../../types/index';

const h = vi.hoisted(() => ({ events: [] as any[], updateNpc: vi.fn() }));

vi.mock('../../services/aiService', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../services/aiService')>();
    return {
        ...actual,
        generateWorldEvents: vi.fn(async () => h.events),
    };
});

vi.mock('../../services/campaignService', () => ({
    campaignService: {
        updateNpc: h.updateNpc, updateFaction: vi.fn(), updateLocation: vi.fn(),
        updatePlot: vi.fn(), updateAdventure: vi.fn(),
    },
}));

import { WorldSimulationWizard } from '../../components/dialogs/WorldSimulationWizard';

const campaign = {
    id: 'c1', title: 'Ashfall', settingType: 'custom', setting: 'A dying empire',
    articles: [], adventures: [],
    npcs: [{ id: 'npc-1', name: 'The Gray Warden', motivations: 'Protect the pass.', relationships: [], history: [] } as any],
    locations: [], factions: [], items: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [],
} as unknown as Campaign;

afterEach(() => {
    h.events = [];
    h.updateNpc.mockClear();
    cleanup();
});

/** Mirrors App.tsx: the parent closes (unmounts) the wizard on onApplyEvents. */
const AppLikeHost: React.FC<{ onApply: (e: any[]) => void }> = ({ onApply }) => {
    const [open, setOpen] = React.useState(true);
    if (!open) return <div data-testid="closed" />;
    return (
        <WorldSimulationWizard
            campaign={campaign}
            isMockMode={true}
            onClose={() => setOpen(false)}
            onApplyEvents={(events) => { onApply(events); setOpen(false); }}
        />
    );
};

describe('WorldSimulationWizard confirms a destructive apply before closing', () => {
    it('shows the applied confirmation instead of closing immediately, and notifies the parent on Done', async () => {
        h.events = [{
            id: 'evt-1',
            title: 'The Circle Moves',
            description: 'Wagons roll east under new banners.',
            affectedEntityIds: ['npc-1'],
            affectedEntityTypes: ['npc'],
            suggestedUpdates: [{ entityId: 'npc-1', entityType: 'npc', field: 'motivations', currentValue: 'Protect the pass.', proposedValue: 'Protect the pass, and hunt the informant.' }],
            severity: 'major',
            category: 'faction',
        }];

        const onApply = vi.fn();
        render(<AppLikeHost onApply={onApply} />);

        fireEvent.click(screen.getByRole('button', { name: /Simulate World/i }));
        fireEvent.click(await screen.findByRole('button', { name: /^Apply/i }));

        // The mutation happened...
        expect(h.updateNpc).toHaveBeenCalled();
        // ...and the DM is told so, rather than the modal vanishing silently.
        expect(screen.getByText(/World Updated/i)).toBeTruthy();
        expect(screen.getByText(/1 event applied to your campaign\./i)).toBeTruthy();
        expect(onApply).not.toHaveBeenCalled();
        expect(screen.queryByTestId('closed')).toBeNull();

        // Acknowledging hands the approved events to the parent, which closes.
        fireEvent.click(screen.getByRole('button', { name: /^Done$/i }));
        expect(onApply).toHaveBeenCalledTimes(1);
        expect(onApply.mock.calls[0][0]).toHaveLength(1);
        expect(screen.getByTestId('closed')).toBeTruthy();
    });

    it('still notifies the parent if the applied confirmation is dismissed via the header close button instead of Done (finding #24a)', async () => {
        h.events = [{
            id: 'evt-1',
            title: 'The Circle Moves',
            description: 'Wagons roll east under new banners.',
            affectedEntityIds: ['npc-1'],
            affectedEntityTypes: ['npc'],
            suggestedUpdates: [{ entityId: 'npc-1', entityType: 'npc', field: 'motivations', currentValue: 'Protect the pass.', proposedValue: 'Protect the pass, and hunt the informant.' }],
            severity: 'major',
            category: 'faction',
        }];

        const onApply = vi.fn();
        render(<AppLikeHost onApply={onApply} />);

        fireEvent.click(screen.getByRole('button', { name: /Simulate World/i }));
        fireEvent.click(await screen.findByRole('button', { name: /^Apply/i }));
        expect(screen.getByText(/World Updated/i)).toBeTruthy();
        expect(onApply).not.toHaveBeenCalled();

        // Dismiss via the header X instead of clicking "Done" — the DM's
        // acknowledgement of the mutation must not be lost.
        fireEvent.click(screen.getByRole('button', { name: /^Close$/i }));

        expect(onApply).toHaveBeenCalledTimes(1);
        expect(onApply.mock.calls[0][0]).toHaveLength(1);
        expect(screen.getByTestId('closed')).toBeTruthy();
    });

    it('reports the number of entity fields actually written, not just the approved event count (finding #24b)', async () => {
        h.events = [{
            id: 'evt-1',
            title: 'The Circle Moves',
            description: 'Wagons roll east under new banners.',
            affectedEntityIds: ['npc-1'],
            affectedEntityTypes: ['npc'],
            // Every suggested update here names a structural field, so the
            // allowlist drops all of them — the event is still applied
            // (approved), but zero fields are actually written.
            suggestedUpdates: [{ entityId: 'npc-1', entityType: 'npc', field: 'id', currentValue: 'npc-1', proposedValue: 'renamed' }],
            severity: 'major',
            category: 'faction',
        }];

        const onApply = vi.fn();
        render(<AppLikeHost onApply={onApply} />);

        fireEvent.click(screen.getByRole('button', { name: /Simulate World/i }));
        fireEvent.click(await screen.findByRole('button', { name: /^Apply/i }));

        expect(h.updateNpc).not.toHaveBeenCalled();
        expect(screen.getByText(/1 event applied to your campaign\./i)).toBeTruthy();
        expect(screen.getByText(/No entity fields were changed\./i)).toBeTruthy();
    });
});
