// @vitest-environment jsdom
/**
 * CombatTracker — structured combat essentials (roadmap X7 + L5 calculator):
 * AC display/edit, HP delta (damage/heal), condition chips with round
 * durations, and the encounter-difficulty readout.
 */
import React, { useState } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, within } from '@testing-library/react';
import type { Combatant, Encounter, NPC, PlayerCharacter } from '../../types/index';
import { CombatTracker } from '../../components/tools/CombatTracker';
import { ConfirmDialogProvider } from '../../hooks/useConfirmDialog';

const makeCombatant = (id: string, over: Partial<Combatant> = {}): Combatant => ({
    id,
    name: id,
    type: 'monster',
    initiative: 10,
    hp: 20,
    maxHp: 20,
    notes: '',
    ...over,
});

/** Stateful harness so onUpdate round-trips back into the rendered tracker. */
const renderTracker = (initial: Encounter, npcs: NPC[] = []) => {
    const updates: Encounter[] = [];
    const Harness = () => {
        const [enc, setEnc] = useState(initial);
        return (
            <CombatTracker
                encounter={enc}
                onUpdate={next => { updates.push(next); setEnc(next); }}
                campaignNpcs={npcs}
                campaignPcs={[] as PlayerCharacter[]}
            />
        );
    };
    render(<ConfirmDialogProvider><Harness /></ConfirmDialogProvider>);
    return { updates, latest: () => updates[updates.length - 1] };
};

const encounterOf = (combatants: Combatant[], over: Partial<Encounter> = {}): Encounter => ({
    id: 'enc', round: 1, turnIndex: 0, combatants, ...over,
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe('AC', () => {
    it('renders the combatant AC and lets the GM edit it', () => {
        const { latest } = renderTracker(encounterOf([makeCombatant('Orc', { ac: 13 })]));
        const ac = screen.getByLabelText('Armor class for Orc') as HTMLInputElement;
        expect(ac.value).toBe('13');

        fireEvent.change(ac, { target: { value: '16' } });
        expect(latest().combatants[0].ac).toBe(16);
        expect((screen.getByLabelText('Armor class for Orc') as HTMLInputElement).value).toBe('16');
    });

    it('renders an empty AC field for legacy combatants without ac, and clears back to undefined', () => {
        const { latest } = renderTracker(encounterOf([makeCombatant('Ghost', { ac: 11 })]));
        const ac = screen.getByLabelText('Armor class for Ghost') as HTMLInputElement;
        fireEvent.change(ac, { target: { value: '' } });
        expect(latest().combatants[0].ac).toBeUndefined();
        expect((screen.getByLabelText('Armor class for Ghost') as HTMLInputElement).value).toBe('');
    });
});

describe('HP delta', () => {
    it('applies typed damage and clears the input', () => {
        const { latest } = renderTracker(encounterOf([makeCombatant('Orc', { hp: 15, maxHp: 15 })]));
        const amount = screen.getByLabelText('HP change amount for Orc') as HTMLInputElement;
        fireEvent.change(amount, { target: { value: '6' } });
        fireEvent.click(screen.getByRole('button', { name: 'Apply damage to Orc' }));
        expect(latest().combatants[0].hp).toBe(9);
        expect(amount.value).toBe('');
    });

    it('clamps damage at 0', () => {
        const { latest } = renderTracker(encounterOf([makeCombatant('Orc', { hp: 4, maxHp: 15 })]));
        fireEvent.change(screen.getByLabelText('HP change amount for Orc'), { target: { value: '30' } });
        fireEvent.click(screen.getByRole('button', { name: 'Apply damage to Orc' }));
        expect(latest().combatants[0].hp).toBe(0);
    });

    it('applies healing capped at max HP', () => {
        const { latest } = renderTracker(encounterOf([makeCombatant('Cleric', { hp: 5, maxHp: 12 })]));
        fireEvent.change(screen.getByLabelText('HP change amount for Cleric'), { target: { value: '10' } });
        fireEvent.click(screen.getByRole('button', { name: 'Apply healing to Cleric' }));
        expect(latest().combatants[0].hp).toBe(12);
    });

    it('Enter applies damage, Shift+Enter heals', () => {
        const { latest } = renderTracker(encounterOf([makeCombatant('Orc', { hp: 10, maxHp: 20 })]));
        const amount = screen.getByLabelText('HP change amount for Orc');
        fireEvent.change(amount, { target: { value: '3' } });
        fireEvent.keyDown(amount, { key: 'Enter' });
        expect(latest().combatants[0].hp).toBe(7);

        fireEvent.change(amount, { target: { value: '5' } });
        fireEvent.keyDown(amount, { key: 'Enter', shiftKey: true });
        expect(latest().combatants[0].hp).toBe(12);
    });

    it('disables the delta buttons until a positive amount is typed', () => {
        const { updates } = renderTracker(encounterOf([makeCombatant('Orc')]));
        const dmg = screen.getByRole('button', { name: 'Apply damage to Orc' }) as HTMLButtonElement;
        expect(dmg.disabled).toBe(true);
        fireEvent.click(dmg);
        expect(updates).toHaveLength(0);
    });

    it('keeps the ±1 steppers', () => {
        const { latest } = renderTracker(encounterOf([makeCombatant('Orc', { hp: 10, maxHp: 20 })]));
        fireEvent.click(screen.getByRole('button', { name: /decrease hp/i }));
        expect(latest().combatants[0].hp).toBe(9);
        fireEvent.click(screen.getByRole('button', { name: /increase hp/i }));
        expect(latest().combatants[0].hp).toBe(10);
    });
});

describe('conditions', () => {
    it('adds a condition chip from the picker and removes it', () => {
        const { latest } = renderTracker(encounterOf([makeCombatant('Orc')]));
        fireEvent.change(screen.getByLabelText('Add condition to Orc'), { target: { value: 'Poisoned' } });

        expect(latest().combatants[0].conditions).toEqual([{ name: 'Poisoned' }]);
        const list = screen.getByRole('list', { name: 'Conditions on Orc' });
        expect(within(list).getByText('Poisoned')).toBeTruthy();
        // Already-applied conditions are not offered again.
        const picker = screen.getByLabelText('Add condition to Orc') as HTMLSelectElement;
        expect(Array.from(picker.options).map(o => o.value)).not.toContain('Poisoned');

        fireEvent.click(screen.getByRole('button', { name: 'Remove Poisoned from Orc' }));
        expect(latest().combatants[0].conditions).toEqual([]);
        expect(within(screen.getByRole('list', { name: 'Conditions on Orc' })).queryByText('Poisoned')).toBeNull();
    });

    it('records a duration and ticks it down when the round advances', () => {
        const { latest } = renderTracker(encounterOf([makeCombatant('Orc'), makeCombatant('Elf')]));
        fireEvent.change(screen.getByLabelText('Condition duration in rounds for Orc'), { target: { value: '2' } });
        fireEvent.change(screen.getByLabelText('Add condition to Orc'), { target: { value: 'Frightened' } });
        expect(latest().combatants[0].conditions).toEqual([{ name: 'Frightened', roundsRemaining: 2 }]);
        expect(screen.getByText(/2 rounds remaining/)).toBeTruthy();

        const next = screen.getByRole('button', { name: /next turn/i });
        fireEvent.click(next); // Orc -> Elf, still round 1
        expect(latest().combatants[0].conditions).toEqual([{ name: 'Frightened', roundsRemaining: 2 }]);
        fireEvent.click(next); // round 2
        expect(latest().round).toBe(2);
        expect(latest().combatants[0].conditions).toEqual([{ name: 'Frightened', roundsRemaining: 1 }]);
        expect(screen.getByText(/1 rounds remaining/)).toBeTruthy();
        fireEvent.click(next);
        fireEvent.click(next); // round 3 — expired
        expect(latest().round).toBe(3);
        expect(latest().combatants[0].conditions).toEqual([]);
        expect(screen.queryByText('Frightened', { selector: 'span' })).toBeNull();
    });

    it('renders conditions already stored on a combatant', () => {
        renderTracker(encounterOf([makeCombatant('Wizard', { conditions: [{ name: 'Concentrating' }, { name: 'Prone', roundsRemaining: 1 }] })]));
        const list = screen.getByRole('list', { name: 'Conditions on Wizard' });
        expect(within(list).getByText('Concentrating')).toBeTruthy();
        expect(within(list).getByText('Prone')).toBeTruthy();
    });
});

describe('encounter difficulty readout', () => {
    it('is hidden when there are no enemies', () => {
        renderTracker(encounterOf([makeCombatant('Hero', { type: 'pc', level: 3 })]));
        expect(screen.queryByRole('region', { name: 'Encounter difficulty' })).toBeNull();
    });

    it('prompts for a CR when enemies lack one', () => {
        renderTracker(encounterOf([makeCombatant('Orc')]));
        expect(screen.getByText(/set a cr on enemies/i)).toBeTruthy();
    });

    it('derives the party from PC levels and rates the fight', () => {
        renderTracker(encounterOf([
            makeCombatant('A', { type: 'pc', level: 3 }),
            makeCombatant('B', { type: 'pc', level: 3 }),
            makeCombatant('C', { type: 'pc', level: 3 }),
            makeCombatant('D', { type: 'pc', level: 3 }),
            makeCombatant('Bugbear', { cr: '1' }),
            makeCombatant('Goblin 1', { cr: '1/4' }),
            makeCombatant('Goblin 2', { cr: '1/4' }),
            makeCombatant('Goblin 3', { cr: '1/4' }),
        ]));
        const readout = screen.getByRole('region', { name: 'Encounter difficulty' });
        expect(within(readout).getByTestId('encounter-difficulty-rating').textContent).toBe('Medium');
        expect(readout.textContent).toContain('700');
        expect(readout.textContent).toContain('4 PCs');
        // All PCs have levels → no fallback level input.
        expect(within(readout).queryByLabelText('Party level')).toBeNull();
    });

    it('uses the party size / level inputs when no PCs are in the fight', () => {
        renderTracker(encounterOf([makeCombatant('Ogre', { cr: '2' })]));
        const readout = screen.getByRole('region', { name: 'Encounter difficulty' });
        // Default party: 4 × level 1 → deadly threshold 400, ogre = 450 XP.
        expect(within(readout).getByTestId('encounter-difficulty-rating').textContent).toBe('Deadly');

        fireEvent.change(within(readout).getByLabelText('Party level'), { target: { value: '5' } });
        expect(within(readout).getByTestId('encounter-difficulty-rating').textContent).toBe('Trivial');

        fireEvent.change(within(readout).getByLabelText('Party level'), { target: { value: '2' } });
        fireEvent.change(within(readout).getByLabelText('Party size'), { target: { value: '2' } });
        // 2 × level 2: medium 200 / hard 300 / deadly 400; 450 × 1.5 (small party) = 675 → deadly
        expect(within(readout).getByTestId('encounter-difficulty-rating').textContent).toBe('Deadly');
    });

    it('updates when a CR is typed on a combatant', () => {
        const { latest } = renderTracker(encounterOf([makeCombatant('Orc')]));
        fireEvent.change(screen.getByLabelText('Challenge rating for Orc'), { target: { value: '1/2' } });
        expect(latest().combatants[0].cr).toBe('1/2');
        expect(screen.getByRole('region', { name: 'Encounter difficulty' })).toBeTruthy();
    });
});

describe('roster add', () => {
    it('pulls HP / AC / CR from an NPC stat string', () => {
        const npc = { id: 'n1', name: 'Captain Vex', stats: 'AC 16, HP 58, CR 3' } as NPC;
        const { latest } = renderTracker(encounterOf([]), [npc]);
        fireEvent.click(screen.getByRole('button', { name: /add combatant/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Roster' }));
        fireEvent.click(screen.getByRole('button', { name: /captain vex/i }));
        expect(latest().combatants[0]).toMatchObject({ name: 'Captain Vex', hp: 58, maxHp: 58, ac: 16, cr: '3' });
        expect((screen.getByLabelText('Armor class for Captain Vex') as HTMLInputElement).value).toBe('16');
    });
});
