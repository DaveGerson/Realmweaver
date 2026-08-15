// @vitest-environment jsdom
/**
 * wp-g2-wizards-coach — finding #77
 *
 * `DmCoach.handleGenerate` (DmCoach.tsx:184) has no cancellation or request-id
 * guard, and `handleSwitchTool` clears prompt/result/error but leaves
 * `isLoading` true and does not invalidate the in-flight call. Switching from
 * Narrate to Table while a narration is generating therefore (a) wedges the
 * Table tab's Generate button in the disabled "Generating..." state forever and
 * (b) renders the narration under the Table tool when it resolves — and pushes
 * that mislabelled text into the session log through `onResultGenerated`.
 *
 * Contract for the fix:
 *   1. `handleSwitchTool` resets the loading state, so the new tool's Generate
 *      button is immediately usable.
 *   2. A generation that resolves after the tool changed is discarded: no
 *      `setResult`, no `onResultGenerated`, no `setError`.
 *   3. A generation that resolves while its own tool is still active is applied
 *      as before.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { setupTestEnvironment } from '../helpers/testStoreFactory';
import type { Campaign } from '../../types/index';

// MentionInput (used for the prompt box) imports the campaignService singleton.
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
    h.generateNarration.mockReset();
    h.generateRollableTable.mockReset();
    if (!DmCoach) {
        DmCoach = (await import('../../components/dialogs/DmCoach')).DmCoach;
    }
});

afterEach(cleanup);

/** Start a narration generation the test controls, then switch to the Table tool. */
async function startNarrationThenSwitchToTable(onResultGenerated: Mock<(content: string) => void>) {
    let resolveNarration: (v: string) => void = () => {};
    h.generateNarration.mockImplementation(
        () => new Promise<string>(res => { resolveNarration = res; })
    );

    render(
        <DmCoach
            campaign={campaign}
            onClose={() => {}}
            onResultGenerated={onResultGenerated}
            isMockMode={true}
        />
    );

    fireEvent.change(screen.getByLabelText('DM Coach prompt'), {
        target: { value: 'Describe the tavern as the players enter.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Generate$/ }));
    await waitFor(() => expect(h.generateNarration).toHaveBeenCalledTimes(1));

    // Switch to the Table tool while the narration is still in flight.
    fireEvent.click(screen.getByRole('button', { name: 'Table' }));

    return () => resolveNarration('The tavern reeks of pitch and wet wool.');
}

describe('DM Coach — switching tools mid-generation (#77)', () => {
    it('does not leave the new tool\'s Generate button stuck in the loading state', async () => {
        await startNarrationThenSwitchToTable(vi.fn());

        // (matches both the idle "Generate" and the stuck "Generating..." label)
        const generateButton = screen.getByRole('button', { name: /Generat/ }) as HTMLButtonElement;
        expect(generateButton.disabled).toBe(false);
    });

    it('discards a generation that resolves after the tool was switched', async () => {
        const onResultGenerated = vi.fn();
        const resolveNarration = await startNarrationThenSwitchToTable(onResultGenerated);

        await act(async () => {
            resolveNarration();
            await Promise.resolve();
        });

        // The abandoned narration must not surface under the Rollable Table tool,
        // nor be pushed into the session log mislabelled as a table.
        expect(screen.queryByText(/The tavern reeks of pitch and wet wool\./)).toBeNull();
        expect(onResultGenerated).not.toHaveBeenCalled();
    });

    it('still applies a result that resolves while its own tool is active', async () => {
        h.generateNarration.mockResolvedValue('Rain hammers the shutters.');

        const onResultGenerated = vi.fn();
        render(
            <DmCoach
                campaign={campaign}
                onClose={() => {}}
                onResultGenerated={onResultGenerated}
                isMockMode={true}
            />
        );

        fireEvent.change(screen.getByLabelText('DM Coach prompt'), {
            target: { value: 'Describe the storm.' },
        });
        fireEvent.click(screen.getByRole('button', { name: /^Generate$/ }));

        await waitFor(() => expect(screen.getByText(/Rain hammers the shutters\./)).toBeTruthy());
        expect(onResultGenerated).toHaveBeenCalledWith('Rain hammers the shutters.');
    });
});
