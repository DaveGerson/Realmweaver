// @vitest-environment jsdom
/**
 * SPEC — Table Pulse (lazy-dm-research.md §4.3): the "Ask the Table" tab in
 * DmCoach.tsx
 * =============================================================================
 * Source: docs/design/lazy-dm-lens.md §5 (no crafted prompt as the entry
 * point) — "The check-in tool never opens on an empty text box."
 *
 * THE CONTRACT
 * ------------
 * 1. A fifth tool tab, "Ask the Table", sits alongside Narrate/Improvise/
 *    Table/Roleplay.
 * 2. Its body has ONE button and, critically, NO typed-prompt textbox at all
 *    — unlike every other tool tab, which renders a "DM Coach prompt"
 *    textarea. This is the zero-prompt rule made structural, not just
 *    documented.
 * 3. Pressing the button calls the AI facade with the campaign (so
 *    `dmCoach.ts` can read `playerFlags` itself) and the dialog's mock-mode
 *    flag, and renders the returned questions as a list.
 * 4. Each question gets its own copy action, and there is one "copy all"
 *    action — both using `navigator.clipboard.writeText`.
 * 5. A generation that resolves after the DM has switched to a different tab
 *    (unmounting the panel) must not touch state on the unmounted component.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { setupTestEnvironment } from './helpers/testStoreFactory';
import type { Campaign } from '../types/index';

setupTestEnvironment();

const h = vi.hoisted(() => ({
    generateNarration: vi.fn(),
    generateImprovisation: vi.fn(),
    generateRollableTable: vi.fn(),
    generateNpcRoleplay: vi.fn(),
    generateCheckInQuestions: vi.fn(),
}));

vi.mock('../services/aiService', () => ({
    generateNarration: h.generateNarration,
    generateImprovisation: h.generateImprovisation,
    generateRollableTable: h.generateRollableTable,
    generateNpcRoleplay: h.generateNpcRoleplay,
    generateCheckInQuestions: h.generateCheckInQuestions,
}));

vi.mock('../services/contextBuilder', () => ({
    buildCampaignContext: vi.fn(() => 'CTX'),
}));

let DmCoach: typeof import('../components/dialogs/DmCoach').DmCoach;

const campaign = {
    id: 'c1',
    title: 'Ashfall',
    settingType: 'custom',
    setting: 'A dying empire',
    articles: [], adventures: [], npcs: [], locations: [], factions: [], items: [],
    sessionLogs: [],
    playerCharacters: [
        {
            id: 'pc-1', playerName: 'Sam',
            playerFlags: ['wants more tactical combat'],
            characterSocial: { characterName: 'Vex' },
            characterStatistics: {},
        },
    ],
    plots: [], notes: [],
} as unknown as Campaign;

const QUESTIONS = [
    'What does your character want most right now?',
    'What moment from last session stuck with you?',
    'Anything you wish had gone differently?',
];

function openCheckInTab() {
    fireEvent.click(screen.getByRole('button', { name: 'Ask the Table' }));
}

beforeEach(async () => {
    h.generateCheckInQuestions.mockReset();
    h.generateCheckInQuestions.mockResolvedValue(QUESTIONS);
    if (!DmCoach) {
        DmCoach = (await import('../components/dialogs/DmCoach')).DmCoach;
    }
    vi.stubGlobal('navigator', {
        ...globalThis.navigator,
        clipboard: { writeText: vi.fn(() => Promise.resolve()) },
    });
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe('DM Coach — "Ask the Table" tab (Table Pulse §4.3)', () => {
    it('shows a fifth tab alongside the existing four tools', () => {
        render(<DmCoach campaign={campaign} onClose={() => {}} isMockMode={true} />);
        expect(screen.getByRole('button', { name: 'Narrate' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Improvise' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Table' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Roleplay' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Ask the Table' })).toBeTruthy();
    });

    it('never opens on an empty text box — no prompt textarea anywhere in the tab', () => {
        render(<DmCoach campaign={campaign} onClose={() => {}} isMockMode={true} />);
        openCheckInTab();

        expect(screen.queryByLabelText('DM Coach prompt')).toBeNull();
        expect(screen.queryAllByRole('textbox')).toHaveLength(0);
        // Exactly one action to press: the generate button. (A second button
        // — "Try Again" — only appears after a failure, not on first render.)
        expect(screen.getAllByRole('button', { name: /generate/i })).toHaveLength(1);
    });

    it('calls the facade with the campaign and the dialog mock-mode flag, with no prompt argument', async () => {
        render(<DmCoach campaign={campaign} onClose={() => {}} isMockMode={true} />);
        openCheckInTab();

        fireEvent.click(screen.getByRole('button', { name: /generate/i }));

        await waitFor(() => expect(h.generateCheckInQuestions).toHaveBeenCalledTimes(1));
        const [request, isMockMode] = h.generateCheckInQuestions.mock.calls[0];
        expect(request.campaign).toBe(campaign);
        expect(request.campaignContext).toBe('CTX');
        expect(isMockMode).toBe(true);
    });

    it('renders the returned questions as a list once generation resolves', async () => {
        render(<DmCoach campaign={campaign} onClose={() => {}} isMockMode={true} />);
        openCheckInTab();
        fireEvent.click(screen.getByRole('button', { name: /generate/i }));

        for (const q of QUESTIONS) {
            await waitFor(() => expect(screen.getByText(q)).toBeTruthy());
        }
    });

    it('copies a single question to the clipboard via its own copy action', async () => {
        render(<DmCoach campaign={campaign} onClose={() => {}} isMockMode={true} />);
        openCheckInTab();
        fireEvent.click(screen.getByRole('button', { name: /generate/i }));
        await waitFor(() => expect(screen.getByText(QUESTIONS[0])).toBeTruthy());

        fireEvent.click(screen.getByRole('button', { name: `Copy question: ${QUESTIONS[0]}` }));

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(QUESTIONS[0]);
    });

    it('copies every question at once via "Copy All"', async () => {
        render(<DmCoach campaign={campaign} onClose={() => {}} isMockMode={true} />);
        openCheckInTab();
        fireEvent.click(screen.getByRole('button', { name: /generate/i }));
        await waitFor(() => expect(screen.getByText(QUESTIONS[0])).toBeTruthy());

        fireEvent.click(screen.getByRole('button', { name: /copy all/i }));

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(QUESTIONS.join('\n'));
    });

    it('shows an error with a Try Again action when generation fails', async () => {
        h.generateCheckInQuestions.mockRejectedValueOnce(new Error('network down'));
        render(<DmCoach campaign={campaign} onClose={() => {}} isMockMode={true} />);
        openCheckInTab();
        fireEvent.click(screen.getByRole('button', { name: /generate/i }));

        await waitFor(() => expect(screen.getByRole('button', { name: 'Try Again' })).toBeTruthy());
    });

    it('discards a generation that resolves after the DM has switched to another tab', async () => {
        let resolveQuestions: (v: string[]) => void = () => {};
        h.generateCheckInQuestions.mockImplementation(
            () => new Promise<string[]>(res => { resolveQuestions = res; })
        );

        render(<DmCoach campaign={campaign} onClose={() => {}} isMockMode={true} />);
        openCheckInTab();
        fireEvent.click(screen.getByRole('button', { name: /generate/i }));
        await waitFor(() => expect(h.generateCheckInQuestions).toHaveBeenCalledTimes(1));

        // Switch away before the promise settles — this unmounts CheckInPanel.
        fireEvent.click(screen.getByRole('button', { name: 'Narrate' }));

        // Resolving now must not throw a "set state on an unmounted
        // component" warning, and must not surface the questions under the
        // Narrate tab.
        await act(async () => {
            resolveQuestions(QUESTIONS);
            await Promise.resolve();
        });

        expect(screen.queryByText(QUESTIONS[0])).toBeNull();
    });

    it('does not carry indigo anywhere in the tab (RealmChat-only accent)', () => {
        const { container } = render(<DmCoach campaign={campaign} onClose={() => {}} isMockMode={true} />);
        openCheckInTab();
        expect(container.innerHTML).not.toMatch(/indigo-/);
    });
});
