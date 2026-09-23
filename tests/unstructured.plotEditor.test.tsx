// @vitest-environment jsdom
/**
 * SPEC — the Pressure block in components/editors/PlotEditor.tsx
 * (docs/design/unstructured-play.md)
 *
 * A plot can carry the world's own move for when the party looks away and a
 * countdown that says when it is due. Both are optional, both commit through
 * the editor's ordinary onUpdate, and neither nags.
 *
 *  1. "What happens if the party ignores this?" commits on blur.
 *  2. Choosing a clock size creates the clock at zero; "No clock" removes it.
 *  3. Tick fills one segment; a pip sets the count; the last filled pip
 *     empties itself (the undo); Tick is disabled and a plain status line
 *     appears when the clock has run out — never a red warning.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import type { Campaign, Plot } from '../types/index';

vi.mock('@/services/aiService', () => ({
    generateScene: vi.fn(),
    generateEnhancedText: vi.fn(),
}));

const storeState = { campaigns: [], activeCampaignId: null, saveStatus: 'idle', lastSavedAt: null, appStatus: 'editing' };
vi.mock('@/services/campaignService', () => ({
    campaignService: {
        createScene: vi.fn(() => 'scene-generated'),
        subscribe: () => () => {},
        getState: () => storeState,
        getActiveCampaign: () => undefined,
    },
}));

const { PlotEditor } = await import('../components/editors/PlotEditor');
const { ConfirmDialogProvider } = await import('../hooks/useConfirmDialog');

afterEach(cleanup);

const basePlot = {
    id: 'plot-1', title: 'The Drowned Crown', status: 'active', description: '', relatedEntityIds: [], mentionedEntityIds: [],
} as unknown as Plot;

const campaign = {
    id: 'camp-1', title: 'Test Campaign',
    npcs: [], locations: [], factions: [], items: [], adventures: [], articles: [], sessionLogs: [], playerCharacters: [],
    plots: [basePlot], notes: [], secrets: [],
} as unknown as Campaign;

type OnUpdate = (id: string, updatedData: Partial<Plot>) => void;

function renderEditor(plot: Plot = basePlot) {
    const onUpdate = vi.fn<OnUpdate>();
    render(
        <ConfirmDialogProvider>
            <PlotEditor plot={plot} campaign={campaign} onUpdate={onUpdate} onDelete={() => {}} isMockMode />
        </ConfirmDialogProvider>
    );
    return { onUpdate };
}

describe('1. If ignored', () => {
    it('commits the move on blur and not on keystrokes', () => {
        const { onUpdate } = renderEditor();
        const field = screen.getByLabelText('What happens if the party ignores this?') as HTMLTextAreaElement;
        fireEvent.change(field, { target: { value: 'The chapel floods for good.' } });
        expect(onUpdate).not.toHaveBeenCalled();
        fireEvent.blur(field);
        expect(onUpdate).toHaveBeenCalledWith('plot-1', { ifIgnored: 'The chapel floods for good.' });
    });
});

describe('2. Choosing a clock', () => {
    it('creates a clock at zero and removes it again', () => {
        const { onUpdate } = renderEditor();
        const select = screen.getByLabelText('Countdown clock') as HTMLSelectElement;
        fireEvent.change(select, { target: { value: '6' } });
        expect(onUpdate).toHaveBeenLastCalledWith('plot-1', { clock: { segments: 6, filled: 0 } });
        expect(screen.getByRole('group', { name: 'The Drowned Crown: clock 0 of 6' })).toBeTruthy();
        fireEvent.change(screen.getByLabelText('Countdown clock'), { target: { value: '' } });
        expect(onUpdate).toHaveBeenLastCalledWith('plot-1', { clock: undefined });
    });

    it('shrinking the clock keeps filled within the new size', () => {
        const { onUpdate } = renderEditor({ ...basePlot, clock: { segments: 8, filled: 7 } });
        fireEvent.change(screen.getByLabelText('Countdown clock'), { target: { value: '4' } });
        expect(onUpdate).toHaveBeenLastCalledWith('plot-1', { clock: { segments: 4, filled: 4 } });
    });
});

describe('3. Ticking', () => {
    it('Tick fills one segment; a pip sets the count; the last filled pip empties itself', () => {
        const { onUpdate } = renderEditor({ ...basePlot, clock: { segments: 6, filled: 2 } });
        fireEvent.click(screen.getByRole('button', { name: /^Tick$/ }));
        expect(onUpdate).toHaveBeenLastCalledWith('plot-1', { clock: { segments: 6, filled: 3 } });
        const fifth = screen.getByRole('button', { name: 'The Drowned Crown: segment 5 of 6' });
        expect(fifth.getAttribute('aria-pressed')).toBe('false');
        fireEvent.click(fifth);
        expect(onUpdate).toHaveBeenLastCalledWith('plot-1', { clock: { segments: 6, filled: 5 } });
        // The fifth pip is now the last filled one; pressing it again empties it.
        const fifthAgain = screen.getByRole('button', { name: 'The Drowned Crown: segment 5 of 6' });
        expect(fifthAgain.getAttribute('aria-pressed')).toBe('true');
        fireEvent.click(fifthAgain);
        expect(onUpdate).toHaveBeenLastCalledWith('plot-1', { clock: { segments: 6, filled: 4 } });
    });

    it('a full clock disables Tick and shows a plain status line, never an alert', () => {
        renderEditor({ ...basePlot, clock: { segments: 4, filled: 4 } });
        expect((screen.getByRole('button', { name: /^Tick$/ }) as HTMLButtonElement).disabled).toBe(true);
        const status = screen.getByRole('status');
        expect(status.textContent).toContain('The clock has run out');
        expect(screen.queryByRole('alert')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /^Reset$/ }));
    });
});
