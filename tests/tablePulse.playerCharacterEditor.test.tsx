// @vitest-environment jsdom
/**
 * SPEC — Table Pulse (lazy-dm-research.md §4.3): the "What This Player Wants
 * More Of" field in PlayerCharacterEditor.tsx
 * =============================================================================
 * Source: docs/design/storyteller-first-design.md P5 (narrowest slice —
 * `PlayerCharacter.playerFlags` only) · docs/design/lazy-dm-lens.md §2 step 1.
 *
 * THE CONTRACT
 * ------------
 * 1. A PC that predates this field renders an empty textarea, not a crash.
 * 2. A PC with existing `playerFlags` renders them, one per line.
 * 3. Typing several lines and blurring commits a trimmed, blank-dropped array
 *    via the existing `onUpdate(id, { playerFlags })` — no new store method.
 * 4. Clearing the field entirely and blurring commits `playerFlags: undefined`,
 *    never `[]` — an unset field stays unset, not "set to empty."
 * 5. Blurring with no actual change makes no store write at all (mirrors the
 *    existing per-field blur-diff convention already used for characterSocial
 *    fields in this same editor).
 * 6. The field is optional and un-nagged: nothing about it looks like an
 *    error or a required field, and there is no enum anywhere near it.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import type { PlayerCharacter } from '../types/index';

const storeState = { campaigns: [], activeCampaignId: null, saveStatus: 'idle', lastSavedAt: null, appStatus: 'editing' };
vi.mock('@/services/campaignService', () => ({
    campaignService: {
        subscribe: () => () => {},
        getState: () => storeState,
        getActiveCampaign: () => undefined,
    },
}));

const { PlayerCharacterEditor } = await import('../components/editors/PlayerCharacterEditor');
const { ConfirmDialogProvider } = await import('../hooks/useConfirmDialog');

afterEach(cleanup);

function makePc(overrides: Partial<PlayerCharacter> = {}): PlayerCharacter {
    return {
        id: 'pc-1',
        playerName: 'Sam',
        characterSocial: {
            characterName: 'Vex', background: '', species: 'Human', personality: '',
            appearance: '', backstory: '', ideals: '', bonds: '', flaws: '',
        },
        characterStatistics: {
            classes: { charClass: 'Rogue', level: 3 },
            attributes: { strength: 10, dexterity: 16, constitution: 12, intelligence: 10, wisdom: 10, charisma: 10 },
            skills: {
                acrobatics: 'none', animal_handling: 'none', arcana: 'none', athletics: 'none',
                deception: 'none', history: 'none', insight: 'none', intimidation: 'none',
                investigation: 'none', medicine: 'none', nature: 'none', perception: 'none',
                performance: 'none', persuasion: 'none', religion: 'none', sleight_of_hand: 'none',
                stealth: 'none', survival: 'none',
            },
            actions: [], specialActions: [],
        },
        ...overrides,
    };
}

function renderEditor(pc: PlayerCharacter, onUpdate = vi.fn()) {
    const utils = render(
        <ConfirmDialogProvider>
            <PlayerCharacterEditor pc={pc} onUpdate={onUpdate} onDelete={() => {}} />
        </ConfirmDialogProvider>,
    );
    const field = screen.getByLabelText('What this player wants more of') as HTMLTextAreaElement;
    return { ...utils, field, onUpdate };
}

describe('PlayerCharacterEditor — "What This Player Wants More Of" (Table Pulse §4.3)', () => {
    it('renders an empty textarea for a PC that predates the field, without crashing', () => {
        const pc = makePc();
        expect('playerFlags' in pc).toBe(false);

        const { field } = renderEditor(pc);

        expect(field.value).toBe('');
    });

    it('renders existing playerFlags, one per line', () => {
        const pc = makePc({ playerFlags: ['wants more tactical combat', 'came for the mystery'] });

        const { field } = renderEditor(pc);

        expect(field.value).toBe('wants more tactical combat\ncame for the mystery');
    });

    it('commits a trimmed, blank-dropped array on blur', () => {
        const onUpdate = vi.fn();
        const pc = makePc();
        const { field } = renderEditor(pc, onUpdate);

        fireEvent.change(field, { target: { value: '  wants more tactical combat  \n\nloves a good monologue\n' } });
        fireEvent.blur(field);

        expect(onUpdate).toHaveBeenCalledWith('pc-1', {
            playerFlags: ['wants more tactical combat', 'loves a good monologue'],
        });
    });

    it('commits undefined, not [], when the field is cleared entirely', () => {
        const onUpdate = vi.fn();
        const pc = makePc({ playerFlags: ['wants more tactical combat'] });
        const { field } = renderEditor(pc, onUpdate);

        fireEvent.change(field, { target: { value: '' } });
        fireEvent.blur(field);

        expect(onUpdate).toHaveBeenCalledWith('pc-1', { playerFlags: undefined });
        const [, updates] = onUpdate.mock.calls[onUpdate.mock.calls.length - 1];
        expect(Array.isArray((updates as { playerFlags?: unknown }).playerFlags)).toBe(false);
    });

    it('commits undefined (not []) when an existing value is replaced with only blank lines', () => {
        const onUpdate = vi.fn();
        const pc = makePc({ playerFlags: ['wants more tactical combat'] });
        const { field } = renderEditor(pc, onUpdate);

        fireEvent.change(field, { target: { value: '   \n\n  ' } });
        fireEvent.blur(field);

        expect(onUpdate).toHaveBeenCalledWith('pc-1', { playerFlags: undefined });
    });

    it('makes no store write when the textarea was never touched and stays unset', () => {
        // A PC that predates the field, blurred without ever being edited,
        // must never manufacture a write out of thin air.
        const onUpdate = vi.fn();
        const pc = makePc();
        const { field } = renderEditor(pc, onUpdate);

        fireEvent.focus(field);
        fireEvent.blur(field);

        expect(onUpdate).not.toHaveBeenCalled();
    });

    it('makes no store write on blur when nothing changed', () => {
        const onUpdate = vi.fn();
        const pc = makePc({ playerFlags: ['wants more tactical combat'] });
        const { field } = renderEditor(pc, onUpdate);

        // Focus and blur without typing anything.
        fireEvent.focus(field);
        fireEvent.blur(field);

        expect(onUpdate).not.toHaveBeenCalled();
    });

    it('is optional, plain free text — no enum, no required-field styling near it', () => {
        const pc = makePc();
        renderEditor(pc);

        const field = screen.getByLabelText('What this player wants more of') as HTMLTextAreaElement;
        expect(field.tagName).toBe('TEXTAREA');
        expect(field.hasAttribute('required')).toBe(false);
        // The example copy names Robin Laws' player types only as an
        // illustration in the placeholder — never as a select/options list.
        expect(screen.queryByRole('combobox')).toBeNull();
        expect(document.querySelector('select[name="playerFlags"]')).toBeNull();
    });
});
