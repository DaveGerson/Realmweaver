// @vitest-environment jsdom
/**
 * wp-g2-wizards-coach — findings #25 and #81
 *
 * #25 (data loss): SessionEndWizard step 4 collects a player-facing recap in an
 * editable textarea, but `handleSaveAndEnd` (SessionEndWizard.tsx:149) writes
 * only `{ recap, looseEnds, plotProgressions }` to `updateSessionLog` before
 * calling `endSession()`. `SessionLog.playerRecap?: string` already exists
 * (types/SessionLog.ts:68) and nothing in the repo ever assigns it, so the DM's
 * edited recap is discarded the moment the session ends.
 *   Contract: `updateSessionLog` must receive `playerRecap` with the current
 *   textarea contents (alongside recap / looseEnds / plotProgressions).
 *
 * #81 (error handling): `handleCopyPlayerRecap` (SessionEndWizard.tsx:142) calls
 * `navigator.clipboard.writeText(...)` with no `.catch` and sets the "Copied!"
 * success state synchronously, so a denied permission (rejected promise) or a
 * non-secure context (`navigator.clipboard === undefined`, e.g. the app served
 * over plain http on a LAN address) still reports success.
 *   Contract: the success state may only be shown after the write resolves; a
 *   missing clipboard API or a rejection must be handled (no unhandled
 *   rejection, no crash) and must NOT render "Copied!".
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Campaign, SessionLog } from '../../types/index';
import { ToastProvider } from '../../hooks/useToast';

const h = vi.hoisted(() => ({
    updateSessionLog: vi.fn(),
    endSession: vi.fn(),
}));

vi.mock('../../services/campaignService', () => ({
    campaignService: {
        updateSessionLog: h.updateSessionLog,
        endSession: h.endSession,
    },
}));

vi.mock('../../services/aiService', () => ({
    generateSessionRecap: vi.fn(async () => ({ recap: '', looseEnds: [], playerFacingRecap: '' })),
}));

import { SessionEndWizard } from '../../components/dialogs/SessionEndWizard';

const campaign = {
    id: 'c1',
    title: 'Ashfall',
    settingType: 'custom',
    setting: 'A dying empire',
    articles: [], adventures: [], npcs: [], locations: [], factions: [], items: [],
    sessionLogs: [], playerCharacters: [], plots: [], notes: [],
} as unknown as Campaign;

const sessionLog = {
    id: 'sess-1',
    title: 'Session 1',
    status: 'active',
    sessionDate: new Date('2026-01-01').toISOString(),
    plannedSceneIds: [],
    prepNotes: '',
    relatedPlotIds: [],
    runningNotes: '',
    structuredNotes: [],
    encounterLog: [],
    recap: '',
    notableEvents: '',
    looseEnds: '',
} as unknown as SessionLog;

const renderWizard = (log: SessionLog = sessionLog) =>
    render(
        <ToastProvider>
            <SessionEndWizard
                campaign={campaign}
                sessionLog={log}
                isMockMode={true}
                onComplete={() => {}}
                onCancel={() => {}}
            />
        </ToastProvider>
    );

/** Navigate to step 4 and type a player-facing recap. */
const typePlayerRecap = (text: string) => {
    fireEvent.click(screen.getByRole('button', { name: /Player Recap/i }));
    const textarea = screen.getByPlaceholderText('Write a player-facing recap...');
    fireEvent.change(textarea, { target: { value: text } });
};

beforeEach(() => {
    h.updateSessionLog.mockClear();
    h.endSession.mockClear();
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe('SessionEndWizard — player-facing recap persistence (#25)', () => {
    it('persists the hand-written player recap through updateSessionLog when the session ends', () => {
        renderWizard();

        typePlayerRecap('The heroes escaped the vault with the ledger.');

        fireEvent.click(screen.getByRole('button', { name: /Save & End/i }));
        fireEvent.click(screen.getByRole('button', { name: /^End Session$/i }));

        expect(h.updateSessionLog).toHaveBeenCalledTimes(1);
        expect(h.updateSessionLog).toHaveBeenCalledWith(
            'sess-1',
            expect.objectContaining({ playerRecap: 'The heroes escaped the vault with the ledger.' })
        );
        // The rest of the wrap-up payload must still be written.
        const payload = h.updateSessionLog.mock.calls[0][1];
        expect(payload).toHaveProperty('recap');
        expect(payload).toHaveProperty('looseEnds');
        expect(payload).toHaveProperty('plotProgressions');
        expect(h.endSession).toHaveBeenCalled();
    });

    it('does not blank a previously saved player recap when the DM re-runs the wizard without editing it (verifier problem 2)', () => {
        // Regression: `playerRecap` state was `useState('')`, unseeded from
        // sessionLog.playerRecap unlike its recap/looseEnds siblings — so
        // clicking straight through to Save & End on a log that already has a
        // saved player recap silently overwrote it with ''.
        const logWithSavedRecap = {
            ...sessionLog,
            playerRecap: 'PREVIOUSLY SAVED PLAYER RECAP',
        } as SessionLog;

        renderWizard(logWithSavedRecap);

        // Click straight through to Save & End without touching the textarea.
        fireEvent.click(screen.getByRole('button', { name: /Save & End/i }));
        fireEvent.click(screen.getByRole('button', { name: /^End Session$/i }));

        expect(h.updateSessionLog).toHaveBeenCalledWith(
            'sess-1',
            expect.objectContaining({ playerRecap: 'PREVIOUSLY SAVED PLAYER RECAP' })
        );
    });
});

describe('SessionEndWizard — clipboard failures must not report success (#81)', () => {
    it('does not show "Copied!" when the clipboard write is rejected', async () => {
        const writeText = vi.fn(() => Promise.reject(new Error('permission denied')));
        vi.stubGlobal('navigator', { ...globalThis.navigator, clipboard: { writeText } });

        renderWizard();
        typePlayerRecap('Spoiler-free recap.');

        fireEvent.click(screen.getByRole('button', { name: /Copy to Clipboard/i }));

        await waitFor(() => expect(writeText).toHaveBeenCalledWith('Spoiler-free recap.'));
        // Flush the rejected promise's microtask queue.
        await Promise.resolve();
        await Promise.resolve();

        expect(screen.queryByText(/Copied!/i)).toBeNull();
    });

    it('shows "Copied!" only after a successful clipboard write resolves', async () => {
        let resolveWrite: () => void = () => {};
        const writeText = vi.fn(() => new Promise<void>(res => { resolveWrite = res; }));
        vi.stubGlobal('navigator', { ...globalThis.navigator, clipboard: { writeText } });

        renderWizard();
        typePlayerRecap('Spoiler-free recap.');

        fireEvent.click(screen.getByRole('button', { name: /Copy to Clipboard/i }));

        // Still pending — no success state yet.
        expect(screen.queryByText(/Copied!/i)).toBeNull();

        resolveWrite();
        await waitFor(() => expect(screen.getByText(/Copied!/i)).toBeTruthy());
    });

    it('does not throw when navigator.clipboard is unavailable (non-secure context)', () => {
        vi.stubGlobal('navigator', { ...globalThis.navigator, clipboard: undefined });

        renderWizard();
        typePlayerRecap('Spoiler-free recap.');

        const copyButton = screen.getByRole('button', { name: /Copy to Clipboard/i });

        // React reports handler exceptions through the window 'error' event rather
        // than rethrowing out of dispatch, so capture them here instead of try/catch.
        const uncaught: unknown[] = [];
        const onError = (e: ErrorEvent) => { uncaught.push(e.error ?? e.message); e.preventDefault(); };
        window.addEventListener('error', onError);
        try {
            fireEvent.click(copyButton);
        } catch (err) {
            uncaught.push(err);
        } finally {
            window.removeEventListener('error', onError);
        }

        expect(uncaught).toEqual([]);
        expect(screen.queryByText(/Copied!/i)).toBeNull();
    });

    it('surfaces a failure toast when the clipboard write is rejected (verifier problem 6)', async () => {
        const writeText = vi.fn(() => Promise.reject(new Error('permission denied')));
        vi.stubGlobal('navigator', { ...globalThis.navigator, clipboard: { writeText } });

        renderWizard();
        typePlayerRecap('Spoiler-free recap.');

        fireEvent.click(screen.getByRole('button', { name: /Copy to Clipboard/i }));

        await waitFor(() => expect(screen.getByRole('alert').textContent ?? '').toMatch(/copy failed/i));
    });

    it('surfaces a failure toast when navigator.clipboard is unavailable (verifier problem 6)', async () => {
        vi.stubGlobal('navigator', { ...globalThis.navigator, clipboard: undefined });

        renderWizard();
        typePlayerRecap('Spoiler-free recap.');

        fireEvent.click(screen.getByRole('button', { name: /Copy to Clipboard/i }));

        await waitFor(() => expect(screen.getByRole('alert').textContent ?? '').toMatch(/copy failed/i));
    });
});
