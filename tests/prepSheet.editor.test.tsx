// @vitest-environment jsdom
/**
 * SPEC — the Prep Sheet affordance in components/editors/SessionLogEditor.tsx
 *        (Wave 2, lane SHEET / `docs/design/lazy-dm-lens.md` R3).
 *
 * WHERE IT LIVES. The Session Log editor, not the prep wizard. The wizard is
 * where a session gets prepped; the editor is where the DM comes back to it —
 * the evening before, or five minutes before the table sits down — and that is
 * when they want the page. The editor already has a tab strip on its
 * execution column (Log Entries / Scratchpad); the sheet is a third tab in the
 * same idiom, not a new modal.
 *
 * ── THE CONTRACT ────────────────────────────────────────────────────────────
 *
 * 1. WHO GETS IT. A session with status 'planned' or 'active' shows a control
 *    named "Prep Sheet". A 'completed' session does not — the prep is spent,
 *    and the archive view is the recap, not the plan.
 *
 * 2. THE PREVIEW. Activating it shows the assembled markdown verbatim, as a
 *    preformatted block, exactly as `generateSessionPrepSheetMarkdown` returned
 *    it — the DM reads on screen precisely what they will print or paste. The
 *    strong-start delimiters are storage machinery and never appear.
 *
 * 3. COPY. A "Copy" control writes that same markdown to the clipboard. In a
 *    non-secure context `navigator.clipboard` is undefined entirely, so the
 *    call must be guarded before it is made (the `PrepDocumentView` precedent,
 *    finding #107) — a failure surfaces as a toast, never as an alert and never
 *    as an unhandled rejection.
 *
 * 4. DOWNLOAD. A "Download" control saves the sheet through the shipped
 *    `exportSessionPrepSheet` / `downloadFile` pipeline: one `.md` file named
 *    for the session.
 *
 * 5. NOTHING HERE IS A WRITE. Opening the tab, copying, and downloading are all
 *    reads. `onUpdate` is never called, and doing any of them twice produces the
 *    same result twice — no accumulating state, no half-applied second click.
 *
 * 6. IT SURVIVES THE EDITOR'S LIFECYCLE. This editor is not remounted when the
 *    GM navigates between two session logs, and a session's status can change
 *    under it (Start Session / End Session are in its own header). So: when the
 *    open sheet's session becomes 'completed', the editor falls back to a real
 *    tab instead of rendering an orphaned panel; and switching to another log
 *    lands on the default tab, never on a stale sheet.
 *
 * 7. HOUSE STYLE. Slate/amber only — indigo belongs to RealmChat.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Campaign, SessionLog } from '../types/index';
import { composeStrongStartPrepNotes, STRONG_START_OPEN } from './helpers/strongStartFormat';

vi.mock('../services/aiService', () => ({
    generateEnhancedText: vi.fn(async () => 'text'),
    analyzeSessionNotes: vi.fn(async () => ({ entries: [] })),
    startAudioTranscription: vi.fn(async () => ({ stop: async () => {} })),
}));

const { SessionLogEditor } = await import('../components/editors/SessionLogEditor');
const { ToastProvider } = await import('../hooks/useToast');
const { ConfirmDialogProvider } = await import('../hooks/useConfirmDialog');
const { generateSessionPrepSheetMarkdown } = await import('../services/importExportService');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const STRONG_START = 'The bell in the drowned chapel starts ringing by itself.';

const campaign = {
    id: 'camp-1',
    title: 'The Sunken Crown',
    settingType: 'custom',
    setting: 'A drowned empire of brass and salt',
    articles: [],
    npcs: [
        {
            id: 'npc-1',
            name: 'Brannock Vane',
            description: 'A wiry harbourmaster.',
            traits: '',
            backstory: '',
            motivations: '',
            secrets: '',
            stats: '',
            exampleQuote: '',
            voiceNotes: 'Clipped sentences.',
            knowsPlayerHistory: [],
            relationships: [],
            history: [],
        },
    ],
    locations: [
        {
            id: 'loc-1',
            name: 'The Drowned Chapel',
            description: 'A flooded nave.',
            secrets: '',
            subLocationIds: [],
            history: [],
        },
    ],
    factions: [],
    items: [],
    adventures: [
        {
            id: 'adv-1',
            title: 'Bells Below',
            level: 3,
            hook: '',
            theme: '',
            scenes: [
                {
                    id: 'sc-1',
                    title: 'Bell in the Nave',
                    type: 'exploration',
                    status: 'planned',
                    readAloudText: 'The bell is ringing.',
                    gmNotes: '',
                    skillChecks: [],
                    rewards: '',
                    locationId: 'loc-1',
                    npcIds: ['npc-1'],
                },
            ],
        },
    ],
    sessionLogs: [],
    playerCharacters: [],
    plots: [
        {
            id: 'plot-1',
            title: 'The Tide Cult',
            description: 'Someone is feeding the deep.',
            status: 'active',
            relatedEntityIds: [],
        },
    ],
    notes: [],
    secrets: [
        {
            id: 'sec-1',
            title: 'The bell is a lure',
            content: 'Brannock rings it himself.',
            category: 'secret',
            isRevealed: false,
            linkedEntityIds: ['npc-1'],
            createdAt: '2026-04-01T00:00:00.000Z',
        },
    ],
} as unknown as Campaign;

const makeLog = (overrides: Partial<SessionLog> = {}): SessionLog =>
    ({
        id: 'log-1',
        title: 'Session Four',
        status: 'planned',
        sessionDate: '2026-05-01T18:00:00.000Z',
        adventureId: 'adv-1',
        plannedSceneIds: ['sc-1'],
        prepNotes: composeStrongStartPrepNotes(STRONG_START, 'Scottish accent for Angus.'),
        plannedNpcIds: ['npc-1'],
        plannedLocationIds: ['loc-1'],
        relatedPlotIds: ['plot-1'],
        runningNotes: '',
        structuredNotes: [],
        encounterLog: [],
        beats: [{ id: 'b-1', title: 'Ambush at the ford', isCompleted: false }],
        recap: '',
        notableEvents: '',
        looseEnds: '',
        ...overrides,
    }) as unknown as SessionLog;

// ── Harness ───────────────────────────────────────────────────────────────────

let writeText: ReturnType<typeof vi.fn>;
let downloads: Array<{ filename: string; blob: Blob }>;
let blobsByUrl: Map<string, Blob>;
let clickSpy: ReturnType<typeof vi.spyOn>;
let unhandled: unknown[];
const onUnhandled = (e: { reason?: unknown }) => {
    unhandled.push(e.reason ?? e);
};

const setClipboard = (impl: ReturnType<typeof vi.fn> | null) => {
    if (impl === null) {
        Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
        return;
    }
    Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: impl },
        configurable: true,
    });
};

beforeEach(() => {
    unhandled = [];
    process.on('unhandledRejection', onUnhandled);

    writeText = vi.fn(async () => {});
    setClipboard(writeText);

    downloads = [];
    blobsByUrl = new Map();
    let counter = 0;
    (URL as unknown as Record<string, unknown>)['createObjectURL'] = vi.fn((blob: Blob) => {
        const url = `blob:mock/${counter++}`;
        blobsByUrl.set(url, blob);
        return url;
    });
    (URL as unknown as Record<string, unknown>)['revokeObjectURL'] = vi.fn();

    clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(function (this: HTMLAnchorElement) {
            const blob = blobsByUrl.get(this.href);
            if (blob) downloads.push({ filename: this.download, blob });
        });
});

afterEach(() => {
    process.off('unhandledRejection', onUnhandled);
    clickSpy.mockRestore();
    vi.restoreAllMocks();
    cleanup();
});

function renderEditor(log: SessionLog) {
    const onUpdate = vi.fn();
    const result = render(
        <ConfirmDialogProvider>
            <ToastProvider>
                <SessionLogEditor
                    log={log}
                    campaign={campaign}
                    onUpdate={onUpdate}
                    onDelete={vi.fn()}
                    isMockMode={true}
                />
            </ToastProvider>
        </ConfirmDialogProvider>,
    );

    const rerenderWith = (nextLog: SessionLog) =>
        result.rerender(
            <ConfirmDialogProvider>
                <ToastProvider>
                    <SessionLogEditor
                        log={nextLog}
                        campaign={campaign}
                        onUpdate={onUpdate}
                        onDelete={vi.fn()}
                        isMockMode={true}
                    />
                </ToastProvider>
            </ConfirmDialogProvider>,
        );

    return { ...result, onUpdate, rerenderWith };
}

const prepSheetControl = () => screen.queryByRole('button', { name: /prep sheet/i });
const openPrepSheet = () => fireEvent.click(prepSheetControl()!);
const previewText = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('pre'))
        .map(el => el.textContent ?? '')
        .join('\n');

const blobText = async (blob: Blob): Promise<string> =>
    typeof blob.text === 'function'
        ? blob.text()
        : new Promise<string>(resolve => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.readAsText(blob);
          });

// ── 1. Who gets it ────────────────────────────────────────────────────────────

describe('SessionLogEditor — the Prep Sheet affordance', () => {
    it('offers a prep sheet on a planned session', () => {
        renderEditor(makeLog({ status: 'planned' }));

        expect(prepSheetControl()).not.toBeNull();
    });

    it('offers a prep sheet on a live session', () => {
        renderEditor(makeLog({ status: 'active' }));

        expect(prepSheetControl()).not.toBeNull();
    });

    it('offers none on a completed session', () => {
        renderEditor(makeLog({ status: 'completed' }));

        expect(prepSheetControl()).toBeNull();
    });

    it('does not show the sheet until the DM asks for it', () => {
        const { container } = renderEditor(makeLog());

        expect(previewText(container)).not.toContain(STRONG_START);
    });
});

// ── 2. The preview ────────────────────────────────────────────────────────────

describe('SessionLogEditor — the prep sheet preview', () => {
    it('shows the assembled markdown verbatim', () => {
        const log = makeLog();
        const { container } = renderEditor(log);

        openPrepSheet();

        expect(previewText(container)).toContain(generateSessionPrepSheetMarkdown(log, campaign));
    });

    it('shows the prep the DM actually did', () => {
        const { container } = renderEditor(makeLog());

        openPrepSheet();
        const preview = previewText(container);

        expect(preview).toContain(STRONG_START);
        expect(preview).toContain('Ambush at the ford');
        expect(preview).toContain('Bell in the Nave');
        expect(preview).toContain('Brannock Vane');
        expect(preview).toContain('The Tide Cult');
        expect(preview).toContain('The bell is a lure');
    });

    it('never shows the strong-start delimiters on the sheet', () => {
        const { container } = renderEditor(makeLog());

        openPrepSheet();
        const preview = previewText(container);

        expect(preview).toContain(STRONG_START);
        expect(preview).not.toContain(STRONG_START_OPEN);
        expect(preview).not.toContain('===');
    });
});

// ── 3. Copy ───────────────────────────────────────────────────────────────────

describe('SessionLogEditor — copying the prep sheet', () => {
    it('writes the same markdown the preview shows to the clipboard', async () => {
        const log = makeLog();
        renderEditor(log);

        openPrepSheet();
        fireEvent.click(screen.getByRole('button', { name: /copy/i }));

        await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
        expect(writeText.mock.calls[0][0]).toBe(generateSessionPrepSheetMarkdown(log, campaign));
    });

    it('copies the same bytes on a second click', async () => {
        renderEditor(makeLog());

        openPrepSheet();
        const copy = screen.getByRole('button', { name: /copy/i });
        fireEvent.click(copy);
        await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
        fireEvent.click(copy);
        await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));

        expect(writeText.mock.calls[0][0]).toBe(writeText.mock.calls[1][0]);
    });

    it('toasts instead of throwing when the clipboard API is unavailable', async () => {
        setClipboard(null);
        renderEditor(makeLog());

        openPrepSheet();
        expect(() => fireEvent.click(screen.getByRole('button', { name: /copy/i }))).not.toThrow();

        await waitFor(() => {
            expect(screen.getByText(/could not copy|fail|error/i)).toBeTruthy();
        });
    });

    it('toasts and leaks no unhandled rejection when the clipboard write rejects', async () => {
        const rejecting = vi.fn(() => Promise.reject(new Error('denied')));
        setClipboard(rejecting as unknown as ReturnType<typeof vi.fn>);
        renderEditor(makeLog());

        openPrepSheet();
        fireEvent.click(screen.getByRole('button', { name: /copy/i }));

        await waitFor(() => {
            expect(screen.getByText(/could not copy|fail|error/i)).toBeTruthy();
        });
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(unhandled).toEqual([]);
    });
});

// ── 4. Download ───────────────────────────────────────────────────────────────

describe('SessionLogEditor — downloading the prep sheet', () => {
    it('saves one markdown file named for the session', async () => {
        const log = makeLog();
        renderEditor(log);

        openPrepSheet();
        fireEvent.click(screen.getByRole('button', { name: /download/i }));

        await waitFor(() => expect(downloads).toHaveLength(1));
        expect(downloads[0].filename).toBe('Session_Four_Prep.md');
        expect(downloads[0].blob.type).toBe('text/markdown');
        expect(await blobText(downloads[0].blob)).toBe(
            generateSessionPrepSheetMarkdown(log, campaign),
        );
    });

    it('produces an identical file on a second click', async () => {
        renderEditor(makeLog());

        openPrepSheet();
        const download = screen.getByRole('button', { name: /download/i });
        fireEvent.click(download);
        await waitFor(() => expect(downloads).toHaveLength(1));
        fireEvent.click(download);
        await waitFor(() => expect(downloads).toHaveLength(2));

        expect(downloads[0].filename).toBe(downloads[1].filename);
        expect(await blobText(downloads[0].blob)).toBe(await blobText(downloads[1].blob));
    });
});

// ── 5. Nothing here is a write ────────────────────────────────────────────────

describe('SessionLogEditor — the prep sheet is read-only', () => {
    it('writes nothing to the store when opened, copied, or downloaded', async () => {
        const { onUpdate } = renderEditor(makeLog());

        openPrepSheet();
        fireEvent.click(screen.getByRole('button', { name: /copy/i }));
        fireEvent.click(screen.getByRole('button', { name: /download/i }));
        await waitFor(() => expect(writeText).toHaveBeenCalled());

        expect(onUpdate).not.toHaveBeenCalled();
    });
});

// ── 6. Lifecycle ──────────────────────────────────────────────────────────────

describe('SessionLogEditor — the prep sheet and the editor lifecycle', () => {
    it('leaves the existing tabs working', () => {
        renderEditor(makeLog());

        openPrepSheet();
        fireEvent.click(screen.getByRole('button', { name: /log entries/i }));

        expect(screen.getByPlaceholderText('Log an event...')).toBeTruthy();
    });

    it('falls back to a real tab when the session it is showing is ended', () => {
        const { rerenderWith, container } = renderEditor(makeLog({ status: 'planned' }));

        openPrepSheet();
        expect(previewText(container)).toContain(STRONG_START);

        rerenderWith(makeLog({ status: 'completed' }));

        expect(prepSheetControl()).toBeNull();
        expect(previewText(container)).not.toContain(STRONG_START);
        expect(screen.getByPlaceholderText('Log an event...')).toBeTruthy();
    });

    it('does not carry the open sheet across a switch to another session log', () => {
        const { rerenderWith, container } = renderEditor(makeLog());

        openPrepSheet();
        rerenderWith(makeLog({ id: 'log-2', title: 'Session Five' }));

        expect(previewText(container)).not.toContain(STRONG_START);
        expect(screen.getByPlaceholderText('Log an event...')).toBeTruthy();
    });
});

// ── 7. House style ────────────────────────────────────────────────────────────

describe('SessionLogEditor — the prep sheet is on-theme', () => {
    it('uses no indigo — that accent belongs to RealmChat', () => {
        const { container } = renderEditor(makeLog());

        openPrepSheet();

        expect(container.innerHTML).not.toContain('indigo');
    });
});
