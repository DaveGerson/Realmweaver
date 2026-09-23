// @vitest-environment jsdom
/**
 * wp-g1-worldsim-dialogs — finding #28
 *
 * DialogShell's `handleBackdropClick` (components/common/DialogShell.tsx:120)
 * closes whenever `e.target === e.currentTarget` on a click. A `click` is
 * dispatched on the nearest common ancestor of the mousedown and mouseup
 * targets, so a text-selection drag that starts inside the panel and releases
 * over the dark backdrop dispatches the click on the backdrop and unmounts the
 * dialog — discarding every generated entity in EvocationWizard / the whole AI
 * recap in SessionEndWizard.
 *
 * Contract: only a press that BEGAN on the backdrop may close the dialog.
 * Record the mousedown target on the backdrop and require it in the click
 * handler, clearing it afterwards.
 */

import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { DialogShell } from '../../components/common/DialogShell';

afterEach(() => cleanup());

function setup() {
    const onClose = vi.fn();
    render(
        <DialogShell isOpen onClose={onClose} ariaLabel="Test dialog">
            <div>
                <textarea data-testid="ingest" defaultValue="a long prompt the DM is selecting" />
            </div>
        </DialogShell>
    );
    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;
    return { onClose, backdrop };
}

describe('DialogShell backdrop dismissal', () => {
    it('does not close when a drag starts inside the panel and releases on the backdrop', () => {
        const { onClose, backdrop } = setup();
        const textarea = screen.getByTestId('ingest');

        // Press inside the panel, release outside it: the browser dispatches the
        // click on the common ancestor — the backdrop.
        fireEvent.mouseDown(textarea, { bubbles: true });
        fireEvent.mouseUp(backdrop, { bubbles: true });
        fireEvent.click(backdrop, { bubbles: true });

        expect(onClose).not.toHaveBeenCalled();
    });

    it('still closes on a genuine backdrop press-and-release', () => {
        const { onClose, backdrop } = setup();

        fireEvent.mouseDown(backdrop, { bubbles: true });
        fireEvent.mouseUp(backdrop, { bubbles: true });
        fireEvent.click(backdrop, { bubbles: true });

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close on a second backdrop click whose press began inside the panel', () => {
        const { onClose, backdrop } = setup();
        const textarea = screen.getByTestId('ingest');

        // A real backdrop click first (arms nothing that should persist)...
        fireEvent.mouseDown(backdrop, { bubbles: true });
        fireEvent.click(backdrop, { bubbles: true });
        expect(onClose).toHaveBeenCalledTimes(1);

        // ...then a drag out of the panel must not close again.
        fireEvent.mouseDown(textarea, { bubbles: true });
        fireEvent.click(backdrop, { bubbles: true });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when a drag starts on the backdrop and releases inside the panel (mirror gesture)', () => {
        const { onClose, backdrop } = setup();
        const textarea = screen.getByTestId('ingest');

        // Press on the backdrop, drag into the panel, release inside it. The
        // click's target is still computed as the common ancestor (the
        // backdrop, since it contains the panel) — a press-origin check
        // alone is not enough to reject this gesture.
        fireEvent.mouseDown(backdrop, { bubbles: true });
        fireEvent.mouseUp(textarea, { bubbles: true });
        fireEvent.click(backdrop, { bubbles: true });

        expect(onClose).not.toHaveBeenCalled();
    });

    it('still closes a subsequent genuine backdrop press-and-release after a rejected mirror-gesture drag', () => {
        const { onClose, backdrop } = setup();
        const textarea = screen.getByTestId('ingest');

        // Rejected mirror-gesture drag first — must leave no armed state behind.
        fireEvent.mouseDown(backdrop, { bubbles: true });
        fireEvent.mouseUp(textarea, { bubbles: true });
        fireEvent.click(backdrop, { bubbles: true });
        expect(onClose).not.toHaveBeenCalled();

        // A genuine backdrop press-and-release must still work afterwards.
        fireEvent.mouseDown(backdrop, { bubbles: true });
        fireEvent.mouseUp(backdrop, { bubbles: true });
        fireEvent.click(backdrop, { bubbles: true });
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
