// @vitest-environment jsdom
/**
 * wp-g1-worldsim-dialogs — finding #112
 *
 * `confirm()` in hooks/useConfirmDialog.ts:40 overwrites `resolveRef.current`
 * with the newest resolver; `handleConfirm`/`handleCancel` only settle that
 * one. A second confirm() opened while a dialog is up therefore orphans the
 * first promise forever — `await confirm(...)` in CombatTracker.clearEncounter
 * or SecretCard.handleDeleteClick never returns, so the action silently never
 * happens. Provider unmount leaks the pending promise the same way.
 *
 * Contract: every promise returned by confirm() must settle.
 *   1. A superseded confirm resolves false.
 *   2. A pending confirm resolves false when the provider unmounts.
 */

import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react';
import { ConfirmDialogProvider, useConfirmDialog } from '../../hooks/useConfirmDialog';

afterEach(() => cleanup());

const PENDING = Symbol('pending');

/** Resolves to PENDING if the promise has not settled after the microtask/timer drain. */
function settledOr(promise: Promise<boolean>): Promise<boolean | typeof PENDING> {
    return Promise.race([
        promise,
        new Promise<typeof PENDING>(resolve => setTimeout(() => resolve(PENDING), 20)),
    ]);
}

let confirmFn: ((title: string, message: string) => Promise<boolean>) | null = null;

const Probe: React.FC = () => {
    const { confirm } = useConfirmDialog();
    confirmFn = confirm;
    return <div data-testid="probe" />;
};

describe('useConfirmDialog settles every promise it hands out', () => {
    it('resolves a superseded confirm with false instead of orphaning it', async () => {
        render(
            <ConfirmDialogProvider>
                <Probe />
            </ConfirmDialogProvider>
        );

        let firstResult!: Promise<boolean | typeof PENDING>;
        let secondPromise!: Promise<boolean>;

        await act(async () => {
            firstResult = settledOr(confirmFn!('Clear encounter?', 'This removes all combatants.'));
            secondPromise = confirmFn!('Delete secret?', 'This cannot be undone.');
        });

        // The second dialog is the visible one.
        expect(screen.getByText('Delete secret?')).toBeTruthy();

        // Settling the second must not leave the first hanging.
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /^Confirm$/i }));
        });

        await expect(firstResult).resolves.toBe(false);
        await expect(secondPromise).resolves.toBe(true);
    });

    it('resolves a pending confirm with false when the provider unmounts', async () => {
        const { unmount } = render(
            <ConfirmDialogProvider>
                <Probe />
            </ConfirmDialogProvider>
        );

        let pending!: Promise<boolean>;
        await act(async () => {
            pending = confirmFn!('Clear encounter?', 'This removes all combatants.');
        });

        await act(async () => { unmount(); });

        // Start the PENDING timer only after unmount: racing from the confirm()
        // call made the 20ms window include render/unmount time, which flaked
        // under load even though the promise does settle on unmount.
        await expect(settledOr(pending)).resolves.toBe(false);
    });
});
