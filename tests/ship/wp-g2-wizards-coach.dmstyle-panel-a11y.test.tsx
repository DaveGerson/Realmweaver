// @vitest-environment jsdom
/**
 * wp-g2-wizards-coach — finding #73
 *
 * `DmStylePanel` (components/common/DmStylePanel.tsx:37) hand-rolls a modal:
 * `<div className="fixed inset-0 z-[200] ..." role="dialog" aria-modal="true">`
 * with a click-through backdrop, instead of `DialogShell` — which CLAUDE.md
 * mandates for all modals precisely because it supplies the focus trap,
 * Escape-to-close, ARIA wiring and body scroll lock. A keyboard user hits this
 * immediately: Escape does nothing, Tab walks out of the "modal" into the page
 * behind it, and the background still scrolls.
 *
 * Contract for the fix (re-implement the panel body inside
 * `<DialogShell isOpen onClose={onClose} ariaLabel="DM Style Settings">`):
 *   1. Escape from inside the panel calls `onClose`.
 *   2. The body is scroll-locked while the panel is open and restored on unmount.
 *   3. Tab from the last focusable control wraps back to the first (focus trap).
 *   4. The dialog keeps role="dialog" + aria-modal + an accessible label.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { DmStylePanel } from '../../components/common/DmStylePanel';

const renderPanel = (onClose = vi.fn()) => {
    const utils = render(
        <DmStylePanel
            dmStyle="standard"
            featureOverrides={{}}
            onSetDmStyle={() => {}}
            onSetFeatureOverride={() => {}}
            onClearFeatureOverride={() => {}}
            onClose={onClose}
        />
    );
    return { ...utils, onClose };
};

beforeEach(() => {
    document.body.style.overflow = '';
});

afterEach(cleanup);

describe('DmStylePanel — must be a real modal (#73)', () => {
    it('closes on Escape pressed inside the panel', () => {
        const { onClose } = renderPanel();

        fireEvent.keyDown(screen.getByRole('button', { name: 'Close' }), { key: 'Escape' });

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('locks body scroll while open and restores it on close', () => {
        const { unmount } = renderPanel();

        expect(document.body.style.overflow).toBe('hidden');

        unmount();
        expect(document.body.style.overflow).not.toBe('hidden');
    });

    it('traps Tab focus inside the dialog', () => {
        renderPanel();

        const dialog = screen.getByRole('dialog');
        const focusable = Array.from(
            dialog.querySelectorAll<HTMLElement>('button:not([disabled])')
        );
        expect(focusable.length).toBeGreaterThan(1);

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        last.focus();
        fireEvent.keyDown(last, { key: 'Tab' });

        expect(document.activeElement).toBe(first);
    });
});
