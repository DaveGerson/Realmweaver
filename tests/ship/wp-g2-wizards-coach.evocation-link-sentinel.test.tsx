// @vitest-environment jsdom
/**
 * wp-g2-wizards-coach — finding #27
 *
 * In EvocationWizard's "Detailed" mode the optional link `<select>` uses
 * `value="none"` for its placeholder option (EvocationWizard.tsx:665) and
 * `handleSimplePromptChange` normalises with `item.linkId = linkId || undefined`.
 * The string 'none' is truthy, so re-selecting the placeholder leaves
 * `linkId === 'none'`, which is attached as `factionId` (line 205) /
 * `parentLocationId` (line 206). `batchAddToCampaign` only rewrites the field
 * when the *name* map has a matching key, so the literal 'none' is written
 * through to the saved entity as a dangling reference (ContinuityChecker flags
 * it; the NpcEditor faction dropdown cannot represent it).
 *
 * Contract for the fix:
 *   1. Choosing the placeholder option must leave the entity's `factionId` /
 *      `parentLocationId` undefined — never the sentinel string.
 *   2. Choosing a real faction/parent must still attach that id.
 * The test drives the placeholder option positionally, so the fix is free to
 * change the placeholder's value to "" as suggested.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { setupTestEnvironment } from '../helpers/testStoreFactory';
import type { BatchAddData, Campaign } from '../../types/index';

// EvocationWizard transitively imports the entity editors, which touch the
// campaignService singleton (localStorage on module load).
setupTestEnvironment();

const h = vi.hoisted(() => ({
    generateNpc: vi.fn(async () => ({
        name: 'Captain Vex',
        description: 'A grizzled dock captain.',
        traits: '', backstory: '', motivations: '', secrets: '', stats: '', exampleQuote: '',
    })),
}));

vi.mock('../../services/aiService', () => ({
    generateNpc: h.generateNpc,
    generateCampaignFill: vi.fn(),
    generateLocation: vi.fn(),
    generateFaction: vi.fn(),
    generateItem: vi.fn(),
    generateAdventure: vi.fn(),
    parseDocumentForEntities: vi.fn(),
    generateChatResponse: vi.fn(),
    // Consumed by the editors EvocationWizard imports.
    generateEntityField: vi.fn(),
    suggestEntityLinks: vi.fn(),
}));

vi.mock('../../services/contextBuilder', () => ({
    buildCampaignContext: vi.fn(() => 'CTX'),
}));

let EvocationWizard: typeof import('../../components/dialogs/EvocationWizard').EvocationWizard;

const campaign = {
    id: 'c1',
    title: 'Ashfall',
    settingType: 'custom',
    setting: 'A dying empire',
    articles: [], adventures: [], npcs: [], locations: [],
    factions: [{ id: 'fac-iron', name: 'Iron Circle', description: '', goals: '', memberIds: [] }],
    items: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [],
} as unknown as Campaign;

/**
 * Drive the wizard: Detailed mode -> expand NPCs -> add a prompt -> pick a link
 * option -> Generate -> Add Selected to Campaign. `optionIndex` is positional so
 * the placeholder can keep any value.
 */
async function runDetailedNpcFlow(onAddToCampaign: (d: BatchAddData) => void, optionIndices: number[]) {
    render(
        <EvocationWizard
            campaign={campaign}
            onClose={() => {}}
            onAddToCampaign={onAddToCampaign}
            isMockMode={true}
        />
    );

    fireEvent.click(screen.getByRole('button', { name: /Detailed/ }));
    fireEvent.click(screen.getByRole('button', { name: /^NPCs$/ }));   // expand the section
    fireEvent.click(screen.getByRole('button', { name: /Add NPC/ }));

    fireEvent.change(screen.getByPlaceholderText('Prompt for new NPC...'), {
        target: { value: 'A grizzled dock captain' },
    });

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const options = Array.from(select.querySelectorAll('option'));
    for (const idx of optionIndices) {
        fireEvent.change(select, { target: { value: options[idx].value } });
    }

    fireEvent.click(screen.getByRole('button', { name: /^Generate$/ }));

    const addButton = await screen.findByRole('button', { name: /Add Selected to Campaign/ });
    fireEvent.click(addButton);
}

beforeEach(async () => {
    h.generateNpc.mockClear();
    if (!EvocationWizard) {
        EvocationWizard = (await import('../../components/dialogs/EvocationWizard')).EvocationWizard;
    }
});

afterEach(cleanup);

describe('EvocationWizard — optional link sentinel must never be stored as an id (#27)', () => {
    it('leaves factionId undefined when the DM re-selects the placeholder link option', async () => {
        const onAddToCampaign = vi.fn();

        // Pick "Iron Circle" (option 1), then change your mind back to the placeholder (option 0).
        await runDetailedNpcFlow(onAddToCampaign, [1, 0]);

        await waitFor(() => expect(onAddToCampaign).toHaveBeenCalledTimes(1));
        const data = onAddToCampaign.mock.calls[0][0] as BatchAddData;
        expect(data.npcs).toHaveLength(1);
        expect(data.npcs[0].factionId).toBeUndefined();
    });

    it('still attaches a real faction id when one is selected', async () => {
        const onAddToCampaign = vi.fn();

        await runDetailedNpcFlow(onAddToCampaign, [1]);

        await waitFor(() => expect(onAddToCampaign).toHaveBeenCalledTimes(1));
        const data = onAddToCampaign.mock.calls[0][0] as BatchAddData;
        expect(data.npcs[0].factionId).toBe('fac-iron');
    });
});
