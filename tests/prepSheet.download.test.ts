// @vitest-environment jsdom
/**
 * SPEC — `exportSessionPrepSheet` in services/importExportService.ts
 *        (Wave 2, lane SHEET / `docs/design/lazy-dm-lens.md` R3).
 *
 * The sheet has to leave the app. This is the download half: the same
 * `downloadFile` pipeline every other export in this module already uses
 * (Blob → object URL → detached anchor → click → revoke), pointed at one
 * session's markdown.
 *
 * ── THE CONTRACT ────────────────────────────────────────────────────────────
 *
 * 1. WHAT LANDS ON DISK. A `text/markdown` blob whose content is exactly what
 *    `generateSessionPrepSheetMarkdown(sessionLog, campaign)` returns. There is
 *    no second, divergent assembly path — the preview the DM read and the file
 *    they saved are the same bytes.
 *
 * 2. THE FILENAME. Derived from the session title, in this order: strip
 *    `\ / : * ? " < > |` (a title is prose and may contain any of them, and a
 *    path separator in a download name is a real hazard), trim, collapse each
 *    remaining whitespace run to a single `_`, then append `_Prep.md`. A title
 *    that is empty — or that is nothing but stripped characters — falls back to
 *    `Session_Prep.md`. The extension is always `.md`.
 *
 * 3. IT CLEANS UP AFTER ITSELF. The object URL is revoked and the anchor is
 *    removed from the document, exactly as `downloadFile` already does. A DM
 *    who exports a sheet ten times in a row leaves ten revoked URLs and no
 *    anchors behind.
 *
 * 4. ONE CLICK IS ONE CLICK, AND TWO ARE IDEMPOTENT. Exporting twice produces
 *    two identical downloads — same filename, same bytes — and mutates neither
 *    the session nor the campaign. Nothing about exporting is a write.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Campaign, SessionLog } from '../types/index';
import {
    exportSessionPrepSheet,
    generateSessionPrepSheetMarkdown,
} from '../services/importExportService';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const campaign = {
    id: 'camp-1',
    title: 'The Sunken Crown',
    settingType: 'custom',
    setting: 'A drowned empire',
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
            knowsPlayerHistory: [],
            relationships: [],
            history: [],
        },
    ],
    locations: [],
    factions: [],
    items: [],
    adventures: [],
    sessionLogs: [],
    playerCharacters: [],
    plots: [],
    notes: [],
    secrets: [],
} as unknown as Campaign;

const makeSession = (title: string): SessionLog =>
    ({
        id: 'log-1',
        title,
        status: 'planned',
        sessionDate: '2026-05-01T18:00:00.000Z',
        plannedSceneIds: [],
        prepNotes: '',
        plannedNpcIds: ['npc-1'],
        plannedLocationIds: [],
        relatedPlotIds: [],
        runningNotes: '',
        structuredNotes: [],
        encounterLog: [],
        beats: [{ id: 'b-1', title: 'Ambush at the ford', isCompleted: false }],
        recap: '',
        notableEvents: '',
        looseEnds: '',
    }) as unknown as SessionLog;

// ── Download harness ──────────────────────────────────────────────────────────

interface CapturedDownload {
    filename: string;
    blob: Blob;
}

let downloads: CapturedDownload[] = [];
let blobsByUrl: Map<string, Blob>;
let revoked: string[] = [];
let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;
let clickSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    downloads = [];
    revoked = [];
    blobsByUrl = new Map();
    let counter = 0;

    createObjectURL = vi.fn((blob: Blob) => {
        const url = `blob:mock/${counter++}`;
        blobsByUrl.set(url, blob);
        return url;
    });
    revokeObjectURL = vi.fn((url: string) => {
        revoked.push(url);
    });

    (URL as unknown as Record<string, unknown>)['createObjectURL'] = createObjectURL;
    (URL as unknown as Record<string, unknown>)['revokeObjectURL'] = revokeObjectURL;

    clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(function (this: HTMLAnchorElement) {
            const blob = blobsByUrl.get(this.href);
            downloads.push({ filename: this.download, blob: blob as Blob });
        });
});

afterEach(() => {
    clickSpy.mockRestore();
    vi.restoreAllMocks();
});

const blobText = async (blob: Blob): Promise<string> => {
    // jsdom's Blob implements text() in recent versions; fall back to FileReader.
    if (typeof blob.text === 'function') return blob.text();
    return new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsText(blob);
    });
};

// ── 1. The payload ────────────────────────────────────────────────────────────

describe('exportSessionPrepSheet — what lands on disk', () => {
    it('downloads exactly the markdown the generator produced', async () => {
        const log = makeSession('Session One');

        exportSessionPrepSheet(log, campaign);

        expect(downloads).toHaveLength(1);
        const text = await blobText(downloads[0].blob);
        expect(text).toBe(generateSessionPrepSheetMarkdown(log, campaign));
        expect(text).toContain('# Session One');
        expect(text).toContain('- [ ] Ambush at the ford');
    });

    it('declares the blob as markdown', () => {
        exportSessionPrepSheet(makeSession('Session One'), campaign);

        expect(downloads[0].blob.type).toBe('text/markdown');
    });
});

// ── 2. The filename ───────────────────────────────────────────────────────────

describe('exportSessionPrepSheet — the filename', () => {
    const cases: Array<[string, string]> = [
        ['Session One', 'Session_One_Prep.md'],
        ['Session 3: The Drowned/Chapel', 'Session_3_The_DrownedChapel_Prep.md'],
        ['  Padded   Title  ', 'Padded_Title_Prep.md'],
        ['', 'Session_Prep.md'],
        ['   ', 'Session_Prep.md'],
        ['///', 'Session_Prep.md'],
        ['A "Quoted" <Session>?', 'A_Quoted_Session_Prep.md'],
    ];

    it.each(cases)('names the file for the session titled %j', (title, expected) => {
        exportSessionPrepSheet(makeSession(title), campaign);

        expect(downloads[0].filename).toBe(expected);
    });

    it('always ends in .md', () => {
        exportSessionPrepSheet(makeSession('Whatever'), campaign);

        expect(downloads[0].filename.endsWith('.md')).toBe(true);
    });
});

// ── 3. Cleanup ────────────────────────────────────────────────────────────────

describe('exportSessionPrepSheet — it cleans up after itself', () => {
    it('revokes the object URL it minted', () => {
        exportSessionPrepSheet(makeSession('Session One'), campaign);

        expect(createObjectURL).toHaveBeenCalledTimes(1);
        expect(revoked).toHaveLength(1);
        expect(revoked[0]).toBe(createObjectURL.mock.results[0].value);
    });

    it('leaves no anchor behind in the document', () => {
        exportSessionPrepSheet(makeSession('Session One'), campaign);

        expect(document.querySelectorAll('a[download]')).toHaveLength(0);
    });
});

// ── 4. Idempotence ────────────────────────────────────────────────────────────

describe('exportSessionPrepSheet — exporting twice', () => {
    it('produces two byte-identical downloads', async () => {
        const log = makeSession('Session One');

        exportSessionPrepSheet(log, campaign);
        exportSessionPrepSheet(log, campaign);

        expect(downloads).toHaveLength(2);
        expect(downloads[0].filename).toBe(downloads[1].filename);
        expect(await blobText(downloads[0].blob)).toBe(await blobText(downloads[1].blob));
    });

    it('mutates neither the session nor the campaign', () => {
        const log = makeSession('Session One');
        const logBefore = JSON.parse(JSON.stringify(log));
        const campaignBefore = JSON.parse(JSON.stringify(campaign));

        exportSessionPrepSheet(log, campaign);
        exportSessionPrepSheet(log, campaign);

        expect(JSON.parse(JSON.stringify(log))).toEqual(logBefore);
        expect(JSON.parse(JSON.stringify(campaign))).toEqual(campaignBefore);
    });
});
