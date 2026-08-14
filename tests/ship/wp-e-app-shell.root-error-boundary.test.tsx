// @vitest-environment jsdom
/**
 * wp-e-app-shell — finding #19
 *
 * index.tsx renders <ToastProvider><ConfirmDialogProvider><App/></…></…> with
 * NO ErrorBoundary at the root. Inside App the boundary only wraps ViewRouter
 * and the lazy dialogs — Header, the sidebar container + CampaignSidebar,
 * Breadcrumbs, RealmChatWidget, CommandPalette and App's own render/hook code
 * are all outside any boundary. A throw in any of them (e.g. the unguarded
 * JSON.parse in CampaignSidebar.handleDrop — see the sidebar-drop-guard test)
 * unmounts the entire tree and leaves a white page with no "Try Again" button.
 * The ErrorBoundary's own copy ("this error is isolated to the current view")
 * is only true for the ViewRouter subtree.
 *
 * Contract: the root render is wrapped in an ErrorBoundary, so a throw from
 * anywhere in the app — App itself included — still paints the recovery screen.
 *
 * Verifier follow-up (idx 19 residual): the fallback copy must not claim
 * "isolated to the current view" when it is painted by the ROOT boundary —
 * that claim is only true for the ViewRouter-subtree boundary. index.tsx must
 * pass a distinguishing scope so the root fallback's copy is honest.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../App', () => ({
    default: () => { throw new Error('sidebar drop exploded'); },
}));

describe('wp-e-app-shell #19 — the app root is wrapped in an ErrorBoundary', () => {
    it('paints the recovery screen instead of a white page when App throws', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        document.body.innerHTML = '<div id="root"></div>';

        await import('../../index');
        // createRoot().render is concurrent — let React commit.
        await new Promise(r => setTimeout(r, 50));

        const text = document.body.textContent ?? '';
        expect(text).toMatch(/something went wrong/i);

        // The root boundary's copy must not claim "isolated to the current
        // view" — a throw here means the WHOLE app is down, not one view.
        expect(text).not.toMatch(/isolated to the current view/i);
    });
});
