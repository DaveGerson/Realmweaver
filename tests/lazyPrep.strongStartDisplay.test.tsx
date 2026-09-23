// @vitest-environment jsdom
/**
 * SPEC — components/views/session/SceneListPanel.tsx (Wave 1, lane R1)
 *          + the never-leak rule for the strong start.
 *
 * Source: docs/design/lazy-dm-lens.md §2 step 2 — "nothing re-surfaces it
 * prominently once the session goes live". A strong start written at prep time
 * that the DM then has to hunt for is worth nothing; it is the first thing they
 * say, so it is the first thing on the screen.
 *
 * WHY THIS PANEL. The strong start lives inside the session's `prepNotes`, and
 * SceneListPanel is the Session Runner panel that already receives the whole
 * `sessionLog` prop — it is also where beats already live, so prep and the
 * opening line sit together. ActiveScenePanel receives only `previousSession`,
 * so homing it there would mean rewiring SessionRunner.tsx, which is outside
 * this lane.
 *
 * THE CONTRACT
 *
 * 1. WHEN THERE IS ONE, IT IS FIRST. A session whose `prepNotes` opens with the
 *    delimited strong-start block (tests/helpers/strongStartFormat.ts) renders a
 *    "Strong Start" block at the very top of the panel, above the Scenes
 *    heading. Its text is the DM's own words, verbatim, line breaks intact.
 *
 * 2. THE MACHINERY NEVER SHOWS. The delimiter lines are storage, not prose. They
 *    appear nowhere on screen.
 *
 * 3. THE REST OF THE PREP NOTES STAYS OUT. Only the strong start is promoted.
 *    Everything after the closing delimiter is ordinary prep notes and this
 *    panel does not display it — it never did, and it must not start now.
 *
 * 4. WHEN THERE ISN'T ONE, THERE IS NOTHING. No block at all for: empty prep
 *    notes, absent prep notes, plain prose with no markers, prose that happens
 *    to contain the markers somewhere other than the first line, or an opening
 *    marker with no closing marker. In every one of those cases the DM's prose
 *    is left alone — parsing must never eat a note.
 *
 * 5. IT IS A DISPLAY. Rendering it calls no campaignService method. The beats
 *    list below it keeps working exactly as before.
 *
 * 6. NEVER-LEAK. The strong start is GM prose living in `prepNotes`, and
 *    `buildCampaignContext`'s 'player-safe' variant already excludes prep notes
 *    wholesale. Storing it there must keep that true: the player-safe context
 *    contains neither the strong start nor its delimiters, while the GM-facing
 *    'generation' variant still carries it.
 *
 * 7. Slate/amber only — indigo belongs to RealmChat.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import type { Campaign, SessionLog, Scene } from '../types/index';
import { STRONG_START_OPEN, STRONG_START_CLOSE, composeStrongStartPrepNotes } from './helpers/strongStartFormat';

const h = vi.hoisted(() => ({
    addBeat: vi.fn(() => 'beat-new'),
    toggleBeatComplete: vi.fn(),
    deleteBeat: vi.fn(),
    updateBeat: vi.fn(),
    getActiveCampaign: vi.fn(() => null),
    isPinned: vi.fn(() => false),
}));

vi.mock('@/services/campaignService', () => ({
    campaignService: {
        addBeat: h.addBeat,
        toggleBeatComplete: h.toggleBeatComplete,
        deleteBeat: h.deleteBeat,
        updateBeat: h.updateBeat,
        getActiveCampaign: h.getActiveCampaign,
        isPinned: h.isPinned,
    },
}));

import { SceneListPanel } from '../components/views/session/SceneListPanel';
import { buildCampaignContext } from '../services/contextBuilder';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const STRONG_START = 'The bell in the drowned chapel starts ringing by itself.';
const OTHER_NOTES = 'Scottish accent for Angus. The guild contact arrives at the docks.';

const campaign = {
    id: 'c1',
    title: 'Ashfall',
    settingType: 'custom',
    setting: 'A dying empire',
    articles: [],
    adventures: [],
    npcs: [],
    locations: [],
    factions: [],
    items: [],
    sessionLogs: [],
    playerCharacters: [],
    plots: [],
    notes: [],
} as unknown as Campaign;

const makeSession = (prepNotes: string | undefined, beats: SessionLog['beats'] = []): SessionLog =>
    ({
        id: 'sess-1',
        title: 'Session 4',
        status: 'active',
        sessionDate: '2026-08-26T18:00:00.000Z',
        plannedSceneIds: [],
        prepNotes,
        relatedPlotIds: [],
        runningNotes: '',
        structuredNotes: [],
        encounterLog: [],
        beats,
        recap: '',
        notableEvents: '',
        looseEnds: '',
    }) as unknown as SessionLog;

const renderPanel = (sessionLog: SessionLog, plannedScenes: Scene[] = []) =>
    render(
        <SceneListPanel
            plannedScenes={plannedScenes}
            activeSceneId={null}
            campaign={campaign}
            sessionLog={sessionLog}
            previousSessionRecap={null}
            mobileTab="scenes"
            onSelectScene={() => {}}
        />
    );

const strongStartHeading = () => screen.queryByRole('heading', { name: /strong start/i });
const scenesHeading = () => screen.getByRole('heading', { name: /^scenes$/i });

beforeEach(() => {
    h.addBeat.mockClear();
    h.toggleBeatComplete.mockClear();
    h.deleteBeat.mockClear();
    h.updateBeat.mockClear();
});

afterEach(cleanup);

// ── 1–3. The happy path ───────────────────────────────────────────────────────

describe('SceneListPanel — a session with a strong start opens with it', () => {
    it('renders the strong start block above the scene list', () => {
        renderPanel(makeSession(composeStrongStartPrepNotes(STRONG_START, OTHER_NOTES)));

        const heading = strongStartHeading();
        expect(heading).not.toBeNull();
        expect(screen.getByText(STRONG_START)).toBeTruthy();

        // Prominent means first: the block precedes the Scenes heading in the document.
        const relation = heading!.compareDocumentPosition(scenesHeading());
        expect(relation & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('never renders the delimiters that carry it', () => {
        const { container } = renderPanel(makeSession(composeStrongStartPrepNotes(STRONG_START, OTHER_NOTES)));

        expect(container.textContent).not.toContain(STRONG_START_OPEN);
        expect(container.textContent).not.toContain(STRONG_START_CLOSE);
        expect(container.textContent).not.toContain('===');
    });

    it('promotes only the strong start, never the rest of the prep notes', () => {
        const { container } = renderPanel(makeSession(composeStrongStartPrepNotes(STRONG_START, OTHER_NOTES)));

        expect(container.textContent).toContain(STRONG_START);
        expect(container.textContent).not.toContain('Scottish accent for Angus');
        expect(container.textContent).not.toContain('guild contact');
    });

    it('keeps the line breaks the DM typed', () => {
        const multiline = 'The bell rings.\n\nNobody is in the chapel.';
        renderPanel(makeSession(composeStrongStartPrepNotes(multiline, '')));

        const heading = strongStartHeading();
        expect(heading).not.toBeNull();
        expect(screen.getByText((_, node) => (node?.textContent ?? '') === multiline)).toBeTruthy();
    });

    it('reads a block written with Windows line endings', () => {
        const crlf = composeStrongStartPrepNotes(STRONG_START, OTHER_NOTES).replace(/\n/g, '\r\n');
        renderPanel(makeSession(crlf));

        expect(strongStartHeading()).not.toBeNull();
        expect(screen.getByText(STRONG_START)).toBeTruthy();
    });
});

// ── 4. Everything that is not a strong start ──────────────────────────────────

describe('SceneListPanel — no block when there is no strong start', () => {
    const cases: Array<[string, string | undefined]> = [
        ['prep notes are an empty string', ''],
        ['prep notes are absent entirely', undefined],
        ['prep notes are plain prose', 'Scottish accent for Angus. Remember the docks.'],
        [
            'the markers appear part-way through the prose rather than at the start',
            `Remember the docks.\n${STRONG_START_OPEN}\n${STRONG_START}\n${STRONG_START_CLOSE}`,
        ],
        [
            'the opening marker is never closed',
            `${STRONG_START_OPEN}\n${STRONG_START}\nand then the docks.`,
        ],
    ];

    it.each(cases)('renders no strong start block when %s', (_label, prepNotes) => {
        renderPanel(makeSession(prepNotes));

        expect(strongStartHeading()).toBeNull();
    });

    it('leaves unrecognised prep notes entirely alone — the panel shows none of it', () => {
        const prose = 'Scottish accent for Angus. Remember the docks.';
        const { container } = renderPanel(makeSession(prose));

        expect(container.textContent).not.toContain('Scottish accent for Angus');
    });

    it('does not treat an unterminated marker block as prose to promote', () => {
        const unterminated = `${STRONG_START_OPEN}\n${STRONG_START}\nand then the docks.`;
        const { container } = renderPanel(makeSession(unterminated));

        expect(strongStartHeading()).toBeNull();
        expect(container.textContent).not.toContain(STRONG_START);
        expect(container.textContent).not.toContain(STRONG_START_OPEN);
    });
});

// ── 5 & 7. It is a display, and it is on-theme ────────────────────────────────

describe('SceneListPanel — the strong start block is inert chrome', () => {
    it('writes nothing to the store simply by rendering', () => {
        renderPanel(makeSession(composeStrongStartPrepNotes(STRONG_START, OTHER_NOTES)));

        expect(h.addBeat).not.toHaveBeenCalled();
        expect(h.toggleBeatComplete).not.toHaveBeenCalled();
        expect(h.deleteBeat).not.toHaveBeenCalled();
        expect(h.updateBeat).not.toHaveBeenCalled();
    });

    it('leaves the beats list working underneath it', () => {
        renderPanel(
            makeSession(composeStrongStartPrepNotes(STRONG_START, ''), [
                { id: 'b1', title: 'Ambush at the ford', isCompleted: false },
            ])
        );

        const beatsHeading = screen.getByRole('heading', { name: /^beats$/i });
        expect(beatsHeading).toBeTruthy();
        expect(screen.getByText('Ambush at the ford')).toBeTruthy();

        // Prep first, beats after: the strong start still leads the panel.
        const relation = strongStartHeading()!.compareDocumentPosition(beatsHeading);
        expect(relation & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('uses no indigo — that accent belongs to RealmChat', () => {
        const { container } = renderPanel(makeSession(composeStrongStartPrepNotes(STRONG_START, OTHER_NOTES)));

        expect(container.innerHTML).not.toContain('indigo');
    });
});

// ── 6. Never-leak ─────────────────────────────────────────────────────────────

describe('the strong start never reaches a player-facing context', () => {
    const liveCampaign = {
        ...(campaign as unknown as Record<string, unknown>),
        activeSessionId: 'sess-1',
        sessionLogs: [makeSession(composeStrongStartPrepNotes(STRONG_START, OTHER_NOTES))],
    } as unknown as Campaign;

    it('is absent from the player-safe context, delimiters included', () => {
        const ctx = buildCampaignContext({
            variant: 'player-safe',
            campaign: liveCampaign,
            activeSessionId: 'sess-1',
        });

        expect(ctx).not.toContain(STRONG_START);
        expect(ctx).not.toContain(STRONG_START_OPEN);
        expect(ctx).not.toContain(STRONG_START_CLOSE);
    });

    it('is still available to the GM-facing generation context', () => {
        const ctx = buildCampaignContext({
            variant: 'generation',
            campaign: liveCampaign,
            activeSessionId: 'sess-1',
        });

        expect(ctx).toContain(STRONG_START);
    });
});
