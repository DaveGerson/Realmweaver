// @vitest-environment jsdom
/**
 * wp-g2-wizards-coach — finding #78
 *
 * `RollableTableDisplay.findResult` (DmCoach.tsx:791) parses each entry with
 * `entry.range.split('-')`, which only understands the ASCII hyphen. LLM output
 * routinely uses an en dash for numeric ranges, so `'1–2'.split('-')` yields
 * `['1–2']`, `parseInt('1–2') === 1`, and every roll except 1 falls through to
 * "No result found for this roll." on a table that looks perfectly correct on
 * screen.
 *
 * Contract for the fix:
 *   1. Unicode dashes (en/em dash and the rest of U+2010–U+2015) are treated as
 *      range separators, so `3–4` matches a roll of 3 or 4.
 *   2. ASCII ranges and single-value rows keep working.
 *   3. An unparsable range must not silently produce "No result found" — fall
 *      back to matching the entry by its row index (row N answers a roll of N).
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { setupTestEnvironment } from '../helpers/testStoreFactory';
import type { Campaign, RollableTable } from '../../types/index';

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

/** Render the coach, generate the given table on the Table tool, and roll once. */
async function rollOnTable(table: RollableTable, randomValue: number) {
    h.generateRollableTable.mockResolvedValue(table);
    vi.spyOn(Math, 'random').mockReturnValue(randomValue);

    render(<DmCoach campaign={campaign} onClose={() => {}} isMockMode={true} />);

    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    fireEvent.change(screen.getByLabelText('DM Coach prompt'), {
        target: { value: 'A d6 table for random encounters in a spooky forest.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Generate$/ }));

    const rollButton = await screen.findByRole('button', { name: /Roll on Table/ });
    fireEvent.click(rollButton);

    // The roll readout is the amber panel below the table.
    return await waitFor(() => {
        const readout = screen.getByText(/You rolled a/).closest('div') as HTMLElement;
        expect(readout).toBeTruthy();
        return readout;
    });
}

beforeEach(async () => {
    h.generateRollableTable.mockReset();
    if (!DmCoach) {
        DmCoach = (await import('../../components/dialogs/DmCoach')).DmCoach;
    }
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe('DM Coach rollable table — en-dash ranges must resolve (#78)', () => {
    it('matches a roll against an en-dash range produced by the AI', async () => {
        const table = {
            title: 'Forest Encounters',
            dieType: 'd6',
            entries: [
                { range: '1–2', result: 'A pack of dire wolves' },
                { range: '3–4', result: 'A lost pilgrim' },
                { range: '5–6', result: 'Nothing but wind' },
            ],
        } as RollableTable;

        // Math.random() = 0.5 -> floor(0.5 * 6) + 1 = 4, which is inside "3–4".
        const readout = await rollOnTable(table, 0.5);

        expect(within(readout).queryByText(/No result found/)).toBeNull();
        expect(within(readout).getByText('A lost pilgrim')).toBeTruthy();
    });

    it('falls back to the row index when a range cannot be parsed', async () => {
        const table = {
            title: 'Odd Formatting',
            dieType: 'd3',
            entries: [
                { range: 'one', result: 'First row result' },
                { range: 'two', result: 'Second row result' },
                { range: 'three', result: 'Third row result' },
            ],
        } as RollableTable;

        // Math.random() = 0.5 -> floor(0.5 * 3) + 1 = 2 -> second row.
        const readout = await rollOnTable(table, 0.5);

        expect(within(readout).queryByText(/No result found/)).toBeNull();
        expect(within(readout).getByText('Second row result')).toBeTruthy();
    });

    it('keeps matching plain ASCII ranges', async () => {
        const table = {
            title: 'Classic',
            dieType: 'd6',
            entries: [
                { range: '1-3', result: 'Quiet road' },
                { range: '4-6', result: 'Ambush' },
            ],
        } as RollableTable;

        // roll = 4 -> "4-6"
        const readout = await rollOnTable(table, 0.5);

        expect(within(readout).getByText('Ambush')).toBeTruthy();
    });
});
