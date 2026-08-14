// @vitest-environment jsdom
/**
 * wp-g1-worldsim-dialogs — finding #75
 *
 * DialogShell's Tab handler (components/common/DialogShell.tsx:87) collects
 * every FOCUSABLE_SELECTORS match inside the dialog and only filters
 * descendants of `[aria-hidden="true"]`. Dialogs here render full-cover child
 * overlays (EvocationWizard's entity-edit modal is `absolute inset-0 z-30` over
 * the still-mounted mode buttons and textareas), so Tab walks into controls
 * that are invisible to a sighted keyboard user and unreachable-looking to a
 * screen-reader user.
 *
 * Contract: the trap's focusable set must exclude elements that are hidden or
 * inside an inert/hidden subtree, so the wrap boundaries are the first and last
 * *reachable* controls.
 *
 * GOTCHA for the implementer: jsdom performs no layout, so `el.offsetParent`
 * is always null and `el.getClientRects()` is always empty. A visibility filter
 * built solely on those APIs would filter EVERY element under test (and under
 * jsdom-based tests generally). Use attribute/computed-style checks —
 * `el.closest('[inert], [hidden], [aria-hidden="true"]')` plus
 * `getComputedStyle(el).display === 'none' || visibility === 'hidden'` — and
 * treat layout-based checks as an optional extra only when layout is available.
 */

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { DialogShell } from '../../components/common/DialogShell';

afterEach(() => cleanup());

function renderWithHiddenEdges() {
    return render(
        <DialogShell isOpen onClose={() => {}} ariaLabel="Wizard">
            <div>
                {/* covered layer — beneath a full-cover in-dialog overlay */}
                <div {...({ inert: true } as any)}>
                    <button data-testid="covered-mode">Ingest mode</button>
                </div>
                <button data-testid="first-visible">Done</button>
                <button data-testid="last-visible">Regenerate</button>
                <button data-testid="display-none" style={{ display: 'none' }}>Hidden control</button>
            </div>
        </DialogShell>
    );
}

describe('DialogShell focus trap skips unreachable controls', () => {
    it('wraps forward from the last visible control to the first visible control', () => {
        const { container } = renderWithHiddenEdges();
        const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
        const first = screen.getByTestId('first-visible');
        const last = screen.getByTestId('last-visible');

        last.focus();
        expect(document.activeElement).toBe(last);

        fireEvent.keyDown(dialog, { key: 'Tab' });

        // Today the trap thinks the display:none button is "last", so no wrap
        // happens and focus stays put.
        expect(document.activeElement).toBe(first);
    });

    it('wraps backward from the first visible control to the last visible control', () => {
        const { container } = renderWithHiddenEdges();
        const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
        const first = screen.getByTestId('first-visible');
        const last = screen.getByTestId('last-visible');

        first.focus();
        expect(document.activeElement).toBe(first);

        fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });

        // Today the trap thinks the inert-covered button is "first", so no wrap
        // happens and focus stays put.
        expect(document.activeElement).toBe(last);
    });
});
