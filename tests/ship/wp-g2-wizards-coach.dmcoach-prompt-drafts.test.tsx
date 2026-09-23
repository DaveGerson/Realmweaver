// @vitest-environment jsdom
/**
 * wp-g2-wizards-coach — roadmap X9 sub-item (1)
 *
 * `DmCoach.handleSwitchTool` called `setPrompt('')` on every tool-tab switch,
 * so a DM who half-typed a narration prompt, peeked at the Table tool, and
 * came back found their typing gone.
 *
 * Contract: prompt drafts are kept per tool (Record<CoachTool, string>).
 *   1. Switching away and back restores that tool's draft.
 *   2. Each tool has its own independent draft (a new tool starts empty).
 *   3. Generate sends the ACTIVE tool's draft, not another tool's.
 *   4. The #77 guarantees (result/error cleared on switch) are unchanged.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { setupTestEnvironment } from '../helpers/testStoreFactory';
import type { Campaign } from '../../types/index';

setupTestEnvironment();

const h = vi.hoisted(() => ({
    generateNarration: vi.fn(),
    generateImprovisation: vi.fn(),
    generateRollableTable: vi.fn(),
    generateNpcRoleplay: vi.fn(),
}));

vi.mock('../../services/aiService', () => ({
    generateNarration: h.generateNarration,
    generateImprovisation: h.generateImprovisation,
    generateRollableTable: h.generateRollableTable,
    generateNpcRoleplay: h.generateNpcRoleplay,
}));

vi.mock('../../services/contextBuilder', () => ({
    buildCampaignContext: vi.fn(() => 'CTX'),
}));

let DmCoach: typeof import('../../components/dialogs/DmCoach').DmCoach;

const campaign = {
    id: 'c1',
    title: 'Ashfall',
    settingType: 'custom',
    setting: 'A dying empire',
    articles: [], adventures: [], npcs: [], locations: [], factions: [], items: [],
    sessionLogs: [], playerCharacters: [], plots: [], notes: [],
} as unknown as Campaign;

beforeEach(async () => {
    // jsdom has no layout; the roleplay tab scrolls its message list on mount.
    Element.prototype.scrollIntoView = vi.fn();
    h.generateNarration.mockReset();
    h.generateImprovisation.mockReset();
    if (!DmCoach) {
        DmCoach = (await import('../../components/dialogs/DmCoach')).DmCoach;
    }
});

afterEach(cleanup);

const promptBox = () => screen.getByLabelText('DM Coach prompt') as HTMLTextAreaElement;
const switchTo = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

function renderCoach() {
    render(<DmCoach campaign={campaign} onClose={() => {}} isMockMode={true} />);
}

describe('DM Coach — per-tool prompt drafts (X9)', () => {
    it('restores a tool\'s draft after switching away and back', () => {
        renderCoach();
        fireEvent.change(promptBox(), { target: { value: 'Describe the ruined chapel' } });

        switchTo('Table');
        expect(promptBox().value).toBe('');

        switchTo('Narrate');
        expect(promptBox().value).toBe('Describe the ruined chapel');
    });

    it('keeps an independent draft for each tool, including across the roleplay tab', () => {
        renderCoach();
        fireEvent.change(promptBox(), { target: { value: 'narration draft' } });
        switchTo('Improvise');
        fireEvent.change(promptBox(), { target: { value: 'improv draft' } });
        switchTo('Roleplay');
        switchTo('Table');
        fireEvent.change(promptBox(), { target: { value: 'table draft' } });

        switchTo('Improvise');
        expect(promptBox().value).toBe('improv draft');
        switchTo('Narrate');
        expect(promptBox().value).toBe('narration draft');
        switchTo('Table');
        expect(promptBox().value).toBe('table draft');
    });

    it('generates with the active tool\'s own draft', async () => {
        h.generateImprovisation.mockResolvedValue('The mayor calls the guard.');
        renderCoach();
        fireEvent.change(promptBox(), { target: { value: 'narration draft' } });
        switchTo('Improvise');
        fireEvent.change(promptBox(), { target: { value: 'They threaten the mayor' } });

        fireEvent.click(screen.getByRole('button', { name: /^Generate$/ }));
        await waitFor(() => expect(h.generateImprovisation).toHaveBeenCalledTimes(1));
        expect(h.generateImprovisation.mock.calls[0][0]).toBe('They threaten the mayor');
        expect(h.generateNarration).not.toHaveBeenCalled();
    });

    it('still clears the previous tool\'s result on switch (#77 unchanged)', async () => {
        h.generateNarration.mockResolvedValue('Candles gutter in the nave.');
        renderCoach();
        fireEvent.change(promptBox(), { target: { value: 'Describe the chapel' } });
        fireEvent.click(screen.getByRole('button', { name: /^Generate$/ }));
        await screen.findByText(/Candles gutter in the nave\./);

        switchTo('Table');
        switchTo('Narrate');
        expect(screen.queryByText(/Candles gutter in the nave\./)).toBeNull();
        expect(promptBox().value).toBe('Describe the chapel');
    });
});
