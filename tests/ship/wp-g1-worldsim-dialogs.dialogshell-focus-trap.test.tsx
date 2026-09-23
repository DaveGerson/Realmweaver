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
 *
 * Roadmap X4 note: DialogShell now portals into `document.body`, so the
 * dialog element is looked up on `document` rather than inside RTL's
 * `container`. The focus-trap contract and assertions are unchanged.
 */

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react';
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
        renderWithHiddenEdges();
        const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
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
        renderWithHiddenEdges();
        const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
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

/**
 * wp-g1-worldsim-dialogs — finding #75 (important, cross-package follow-up)
 *
 * EvocationWizard's full-cover in-dialog edit overlay (`absolute inset-0
 * z-30`) does NOT mark the layer it covers inert/aria-hidden, so the
 * attribute-only filter above lets Tab walk onto controls that are visually
 * covered by the overlay. DialogShell handles this itself with a layout-aware
 * stacking check (`document.elementFromPoint` at each candidate's own center)
 * that only activates when the environment performs real layout — jsdom
 * always reports a zeroed `getBoundingClientRect()` and has no
 * `elementFromPoint`, so this suite fakes both for the duration of the test
 * to exercise that code path without depending on a real browser.
 */
describe('DialogShell focus trap excludes visually-covered controls when real layout is available', () => {
    const RECTS: Record<string, { left: number; top: number; width: number; height: number }> = {
        covered: { left: 0, top: 0, width: 100, height: 20 },
        overlay: { left: 0, top: 0, width: 300, height: 100 },
        'reachable-1': { left: 0, top: 150, width: 100, height: 20 },
        'reachable-2': { left: 0, top: 200, width: 100, height: 20 },
    };

    function makeRect(r: { left: number; top: number; width: number; height: number }): DOMRect {
        return {
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
            right: r.left + r.width,
            bottom: r.top + r.height,
            x: r.left,
            y: r.top,
            toJSON() { return this; },
        } as DOMRect;
    }

    it('excludes a button covered by a same-level, non-inert overlay from the Tab cycle', () => {
        const originalGBCR = Element.prototype.getBoundingClientRect;
        const originalEFP = (document as any).elementFromPoint;

        // Fake real layout: every known testid gets a plausible non-zero
        // rect (including the throwaway probe DialogShell uses to detect
        // real layout, which has no testid and falls through to the
        // default case below).
        Element.prototype.getBoundingClientRect = function (this: HTMLElement) {
            const id = this.getAttribute && this.getAttribute('data-testid');
            if (id && RECTS[id]) return makeRect(RECTS[id]);
            return makeRect({ left: 0, top: 0, width: 37, height: 41 });
        };

        let overlayEl!: HTMLElement;
        let reachable1El!: HTMLElement;
        let reachable2El!: HTMLElement;

        (document as any).elementFromPoint = (x: number, y: number) => {
            const within = (r: { left: number; top: number; width: number; height: number }) =>
                x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height;
            // Overlay is checked first — it visually sits on top of "covered".
            if (within(RECTS.overlay)) return overlayEl;
            if (within(RECTS['reachable-1'])) return reachable1El;
            if (within(RECTS['reachable-2'])) return reachable2El;
            return document.body;
        };

        try {
            render(
                <DialogShell isOpen onClose={() => {}} ariaLabel="Wizard">
                    <div>
                        <button data-testid="covered">Behind overlay</button>
                        <div data-testid="overlay" />
                        <button data-testid="reachable-1">Mode buttons</button>
                        <button data-testid="reachable-2">Done</button>
                    </div>
                </DialogShell>
            );
            overlayEl = screen.getByTestId('overlay');
            reachable1El = screen.getByTestId('reachable-1');
            reachable2El = screen.getByTestId('reachable-2');

            const dialog = document.querySelector('[role="dialog"]') as HTMLElement;

            // Tab forward from the last reachable control wraps to the first
            // reachable one — never onto the covered button.
            reachable2El.focus();
            fireEvent.keyDown(dialog, { key: 'Tab' });
            expect(document.activeElement).toBe(reachable1El);

            // Shift+Tab backward from the first reachable control wraps to the
            // last reachable one — again skipping the covered button.
            reachable1El.focus();
            fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
            expect(document.activeElement).toBe(reachable2El);
        } finally {
            Element.prototype.getBoundingClientRect = originalGBCR;
            if (originalEFP === undefined) {
                delete (document as any).elementFromPoint;
            } else {
                (document as any).elementFromPoint = originalEFP;
            }
        }
    });
});

/**
 * wp-g1-worldsim-dialogs — finding #75 (minor sibling defect)
 *
 * The open-time initial-focus effect queried FOCUSABLE_SELECTORS unfiltered
 * and focused focusable[0], so it could drop focus onto an element the Tab
 * handler's own isReachable() filter deliberately excludes (e.g. a dialog
 * whose first focusable element sits inside an inert/hidden subtree). It
 * must reuse the same reachability filter so a dialog never opens with focus
 * on a control a keyboard/screen-reader user cannot otherwise reach.
 */
describe('DialogShell initial focus skips unreachable controls on open', () => {
    it('focuses the first reachable control instead of an inert-covered one', async () => {
        render(
            <DialogShell isOpen onClose={() => {}} ariaLabel="Wizard">
                <div>
                    <div {...({ inert: true } as any)}>
                        <button data-testid="covered-mode">Ingest mode</button>
                    </div>
                    <button data-testid="first-visible">Done</button>
                    <button data-testid="last-visible">Regenerate</button>
                </div>
            </DialogShell>
        );

        // Flush the requestAnimationFrame the open-time focus effect schedules.
        await act(async () => { await new Promise(r => setTimeout(r, 20)); });

        const covered = screen.getByTestId('covered-mode');
        const firstVisible = screen.getByTestId('first-visible');
        expect(document.activeElement).toBe(firstVisible);
        expect(document.activeElement).not.toBe(covered);
    });
});
