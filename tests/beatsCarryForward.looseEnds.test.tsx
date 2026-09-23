// @vitest-environment jsdom
/**
 * SPEC — components/dialogs/SessionEndWizard.tsx (Wave 1, lane R5: beats carry forward)
 *
 * A beat the table never reached currently dies with the session: the next
 * SessionLog opens with an empty `beats` array and nothing remembers what was
 * left on the table. The Loose Ends step already collects exactly this kind of
 * "unfinished, bring it back" text, so the unfinished beats are offered there
 * — as one click, never as a chore.
 *
 * 1. **The offer appears only when there is something to carry.** On the Loose
 *    Ends step, when the session being closed has at least one beat with
 *    `isCompleted: false`, a button whose accessible name contains the phrase
 *    "unfinished beat" (e.g. "Add 2 unfinished beats to loose ends") is
 *    rendered. With no `beats` array, an empty one, or every beat
 *    completed, the button is absent — not disabled, absent. It belongs to the
 *    Loose Ends step and appears on no other step.
 *
 * 2. **One click folds the titles in, as plain lines.** Pressing it appends
 *    each incomplete beat's title to the loose-ends text, one per line, in the
 *    order the beats are stored, with no bullet, prefix, or decoration. A
 *    completed beat's title is never appended. Whatever the DM (or the AI
 *    recap) had already written stays exactly where it was, above the new
 *    lines, and no blank line is introduced — a trailing newline on the
 *    existing text is absorbed, not doubled.
 *
 * 3. **Clicking twice is the same as clicking once.** Dedup is by line: a
 *    title that already stands as a line of the loose-ends text is not
 *    appended again, whether it got there from a previous click, from the
 *    session's saved loose ends, or from the DM typing it. Two identical beat
 *    titles fold to one line. A blank or whitespace-only beat title
 *    contributes nothing.
 *
 * 4. **Purely additive.** A DM who ignores the button loses nothing: the saved
 *    `looseEnds` is byte-identical to what it would have been without the
 *    feature, and the manual "Add a loose end" field keeps working before and
 *    after a click. A DM who presses it has the merged text persisted through
 *    the existing `updateSessionLog` call at Save & End.
 *
 * 5. **Never leaks to the players.** Beat titles are the GM's prep. They go to
 *    `looseEnds` and to nothing else — never into `recap`, and above all never
 *    into `playerRecap`, the one field written to be handed to the table.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import type { Campaign, SessionLog, Beat } from '../types/index';
import { ToastProvider } from '../hooks/useToast';

const h = vi.hoisted(() => ({
  updateSessionLog: vi.fn(),
  endSession: vi.fn(),
}));

vi.mock('@/services/campaignService', () => ({
  campaignService: {
    updateSessionLog: h.updateSessionLog,
    endSession: h.endSession,
  },
}));

vi.mock('@/services/aiService', () => ({
  generateSessionRecap: vi.fn(async () => ({ recap: '', looseEnds: [], playerFacingRecap: '' })),
}));

import { SessionEndWizard } from '../components/dialogs/SessionEndWizard';

// --- Fixture -------------------------------------------------------------

const campaign = {
  id: 'camp-1',
  title: 'The Sunken Crown',
  settingType: 'custom',
  setting: 'A drowned empire',
  articles: [], adventures: [], npcs: [], locations: [], factions: [], items: [],
  sessionLogs: [], playerCharacters: [], plots: [], notes: [],
} as unknown as Campaign;

const DONE_BEAT = 'The heist at the Salt Lantern';
const OPEN_BEAT_A = 'Bram confronts the tide cult';
const OPEN_BEAT_B = 'Find the drowned ledger';

const BEATS: Beat[] = [
  { id: 'b1', title: DONE_BEAT, isCompleted: true },
  { id: 'b2', title: OPEN_BEAT_A, isCompleted: false },
  { id: 'b3', title: OPEN_BEAT_B, isCompleted: false },
];

const makeLog = (over: Partial<SessionLog> = {}): SessionLog => ({
  id: 'sess-1',
  title: 'Session 4',
  status: 'active',
  sessionDate: new Date('2026-05-01').toISOString(),
  plannedSceneIds: [],
  prepNotes: '',
  relatedPlotIds: [],
  runningNotes: '',
  structuredNotes: [],
  encounterLog: [],
  recap: '',
  notableEvents: '',
  looseEnds: '',
  beats: BEATS,
  ...over,
} as unknown as SessionLog);

const renderWizard = (log: SessionLog = makeLog()) =>
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

const gotoLooseEnds = () => fireEvent.click(screen.getByRole('button', { name: /Loose Ends/i }));

const looseEndsField = () =>
  screen.getByPlaceholderText(/unresolved threads, cliffhangers, or hooks/i) as HTMLTextAreaElement;

const carryButton = () => screen.getByRole('button', { name: /unfinished beat/i });
const queryCarryButton = () => screen.queryByRole('button', { name: /unfinished beat/i });

const saveAndEnd = () => {
  fireEvent.click(screen.getByRole('button', { name: /Save & End/i }));
  fireEvent.click(screen.getByRole('button', { name: /^End Session$/i }));
  return h.updateSessionLog.mock.calls[0][1] as Partial<SessionLog>;
};

beforeEach(() => {
  h.updateSessionLog.mockClear();
  h.endSession.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('SessionEndWizard — the carry-forward offer appears only when there is something to carry', () => {
  it('offers the action when the session has an incomplete beat', () => {
    renderWizard();
    gotoLooseEnds();

    expect(queryCarryButton()).not.toBeNull();
  });

  it('offers nothing when the session log has no beats array', () => {
    renderWizard(makeLog({ beats: undefined }));
    gotoLooseEnds();

    expect(queryCarryButton()).toBeNull();
  });

  it('offers nothing when the beats array is empty', () => {
    renderWizard(makeLog({ beats: [] }));
    gotoLooseEnds();

    expect(queryCarryButton()).toBeNull();
  });

  it('offers nothing when every beat was completed', () => {
    renderWizard(makeLog({ beats: BEATS.map(b => ({ ...b, isCompleted: true })) }));
    gotoLooseEnds();

    expect(queryCarryButton()).toBeNull();
  });

  it('belongs to the Loose Ends step and appears on no other step', () => {
    renderWizard();

    // Step 1 (AI Recap) is the mount step.
    expect(queryCarryButton()).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Plot Status/i }));
    expect(queryCarryButton()).toBeNull();

    gotoLooseEnds();
    expect(queryCarryButton()).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Player Recap/i }));
    expect(queryCarryButton()).toBeNull();
  });
});

describe('SessionEndWizard — one click folds the unfinished beats into the loose ends', () => {
  it('appends only the incomplete titles, one plain line each, in beat order', () => {
    renderWizard();
    gotoLooseEnds();

    fireEvent.click(carryButton());

    expect(looseEndsField().value).toBe(`${OPEN_BEAT_A}\n${OPEN_BEAT_B}`);
    expect(looseEndsField().value).not.toContain(DONE_BEAT);
  });

  it('keeps the text the DM already had, above the new lines', () => {
    renderWizard(makeLog({ looseEnds: 'The regent still watches the harbour.' }));
    gotoLooseEnds();

    fireEvent.click(carryButton());

    expect(looseEndsField().value).toBe(
      `The regent still watches the harbour.\n${OPEN_BEAT_A}\n${OPEN_BEAT_B}`
    );
  });

  it('absorbs a trailing newline instead of doubling it into a blank line', () => {
    renderWizard(makeLog({ looseEnds: 'The regent still watches the harbour.\n' }));
    gotoLooseEnds();

    fireEvent.click(carryButton());

    const lines = looseEndsField().value.split('\n');
    expect(lines.filter(l => l.trim() === '')).toHaveLength(0);
    expect(lines).toEqual([
      'The regent still watches the harbour.',
      OPEN_BEAT_A,
      OPEN_BEAT_B,
    ]);
  });

  it('skips beats whose title is blank or whitespace only', () => {
    renderWizard(makeLog({
      beats: [
        { id: 'b2', title: OPEN_BEAT_A, isCompleted: false },
        { id: 'b-blank', title: '   ', isCompleted: false },
        { id: 'b-empty', title: '', isCompleted: false },
      ],
    }));
    gotoLooseEnds();

    fireEvent.click(carryButton());

    expect(looseEndsField().value).toBe(OPEN_BEAT_A);
  });
});

describe('SessionEndWizard — carrying forward twice is the same as carrying forward once', () => {
  it('does not duplicate lines on a repeat click', () => {
    renderWizard();
    gotoLooseEnds();

    fireEvent.click(carryButton());
    const afterFirst = looseEndsField().value;
    fireEvent.click(carryButton());

    expect(looseEndsField().value).toBe(afterFirst);
  });

  it('does not re-append a title the saved loose ends already carried', () => {
    renderWizard(makeLog({ looseEnds: `${OPEN_BEAT_B}\nSomething the DM wrote.` }));
    gotoLooseEnds();

    fireEvent.click(carryButton());

    expect(looseEndsField().value).toBe(
      `${OPEN_BEAT_B}\nSomething the DM wrote.\n${OPEN_BEAT_A}`
    );
  });

  it('does not re-append a title the DM typed into the textarea by hand', () => {
    renderWizard();
    gotoLooseEnds();

    fireEvent.change(looseEndsField(), { target: { value: `  ${OPEN_BEAT_A}  ` } });
    fireEvent.click(carryButton());

    expect(looseEndsField().value.split('\n').filter(l => l.trim() === OPEN_BEAT_A)).toHaveLength(1);
    expect(looseEndsField().value).toContain(OPEN_BEAT_B);
  });

  it('folds two identically titled beats into one line', () => {
    renderWizard(makeLog({
      beats: [
        { id: 'b2', title: OPEN_BEAT_A, isCompleted: false },
        { id: 'b2-dup', title: OPEN_BEAT_A, isCompleted: false },
      ],
    }));
    gotoLooseEnds();

    fireEvent.click(carryButton());

    expect(looseEndsField().value).toBe(OPEN_BEAT_A);
  });
});

describe('SessionEndWizard — carry-forward is purely additive', () => {
  it('changes nothing about the saved loose ends when the DM never presses it', () => {
    renderWizard(makeLog({ looseEnds: 'The regent still watches the harbour.' }));
    gotoLooseEnds();

    const payload = saveAndEnd();

    expect(payload.looseEnds).toBe('The regent still watches the harbour.');
    expect(payload.looseEnds).not.toContain(OPEN_BEAT_A);
    expect(h.endSession).toHaveBeenCalled();
  });

  it('persists the merged text through the existing updateSessionLog call', () => {
    renderWizard(makeLog({ looseEnds: 'The regent still watches the harbour.' }));
    gotoLooseEnds();
    fireEvent.click(carryButton());

    const payload = saveAndEnd();

    expect(payload.looseEnds).toBe(
      `The regent still watches the harbour.\n${OPEN_BEAT_A}\n${OPEN_BEAT_B}`
    );
    expect(h.updateSessionLog).toHaveBeenCalledTimes(1);
    expect(h.updateSessionLog.mock.calls[0][0]).toBe('sess-1');
  });

  it('leaves the manual "Add a loose end" field working afterwards', () => {
    renderWizard();
    gotoLooseEnds();
    fireEvent.click(carryButton());

    fireEvent.change(screen.getByPlaceholderText(/add a loose end/i), {
      target: { value: 'The ledger was a forgery.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Add$/i }));

    expect(looseEndsField().value).toBe(
      `${OPEN_BEAT_A}\n${OPEN_BEAT_B}\nThe ledger was a forgery.`
    );
  });
});

describe('SessionEndWizard — unfinished beats never reach the players', () => {
  it('writes the beat titles to looseEnds and to nothing else', () => {
    renderWizard(makeLog({ recap: 'The party lost the ledger.', playerRecap: 'You lost the ledger.' }));
    gotoLooseEnds();
    fireEvent.click(carryButton());

    const payload = saveAndEnd();

    expect(payload.looseEnds).toContain(OPEN_BEAT_A);
    expect(payload.recap).toBe('The party lost the ledger.');
    expect(payload.playerRecap).toBe('You lost the ledger.');
    expect(payload.playerRecap ?? '').not.toContain(OPEN_BEAT_A);
    expect(payload.playerRecap ?? '').not.toContain(OPEN_BEAT_B);
  });

  it('does not put beat titles into the player-facing textarea', () => {
    renderWizard();
    gotoLooseEnds();
    fireEvent.click(carryButton());

    fireEvent.click(screen.getByRole('button', { name: /Player Recap/i }));
    const playerField = screen.getByPlaceholderText(/write a player-facing recap/i) as HTMLTextAreaElement;

    expect(playerField.value).toBe('');
  });
});
