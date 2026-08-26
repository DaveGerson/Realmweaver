// @vitest-environment jsdom
/**
 * SPEC — the Moments reel (Wave 2, lane MOMENTS / P4, consumer 1)
 * =============================================================================
 * Source: docs/design/storyteller-first-design.md P4. File under test:
 * components/views/TonightsTable.tsx.
 *
 * WHY THIS EXISTS
 * ---------------
 * The star on a running-log entry already exists. What has never existed is the
 * payoff for pressing it: the moments a table will retell for years sink into
 * the same stream as "bought three torches" and are never played back. The reel
 * is that payback — the campaign's emotional spine, readable in two minutes.
 *
 * THE CONTRACT, IN PLAIN SENTENCES
 * --------------------------------
 * 1. **Zero schema.** A moment is a running-log entry the DM starred
 *    (`SessionLogEntry.isImportant`). No new flag is minted, on that type or
 *    any other — the design says so explicitly, and this suite guards it.
 *
 * 2. **Every star, in the order they happened.** The reel is a new panel on
 *    Tonight's Table listing every starred entry across every session, oldest
 *    first. Sessions are ordered by their date; within one session the entries
 *    keep the order they were logged in, because that IS the order they
 *    happened and a timestamp can be missing or wrong on an old save. Unstarred
 *    entries never appear, and a star with no words in it is not a moment.
 *
 * 3. **Each moment says where it came from, and goes back there.** Every row
 *    names the session the moment was logged in and takes the GM to that
 *    session log. The session name wears the session-log accent from
 *    ENTITY_TYPE_CONFIG, and nothing on this screen is indigo.
 *
 * 4. **The panel is one of the family.** It looks like the four panels already
 *    on the screen — same card, same heading treatment — and it is a labelled
 *    region like they are.
 *
 * 5. **The empty state is an invitation**, in the view's own voice: "Star a
 *    moment during play and it lands here." Never a report of missing rows.
 *
 * 6. **Nothing is truncated.** The offstage panel caps at six because a cast
 *    list is a glance; the reel is the spine of the campaign and shows all of
 *    it.
 *
 * 7. **Tonight's Table is not a second home for the cold open.** The cold open
 *    is offered in the Session Prep Wizard and only there
 *    (tests/coldOpen.prepWizard.test.tsx); no generate/draft action appears on
 *    this screen.
 *
 * 8. **Old saves do not crash it.** A session log with no `structuredNotes`
 *    array, or entries with no `isImportant` field at all, reads as "no
 *    moments".
 */

import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen, within, fireEvent } from '@testing-library/react';
import type { Campaign, SessionLog, SessionLogEntry } from '../types/index';
import { ENTITY_TYPE_CONFIG } from '../utils/entityUtils';
import { ToastProvider } from '../hooks/useToast';
import { ConfirmDialogProvider } from '../hooks/useConfirmDialog';

const h = vi.hoisted(() => ({ wizardProps: [] as Record<string, unknown>[] }));

vi.mock('@/components/dialogs/SessionPrepWizard', () => ({
  SessionPrepWizard: (props: Record<string, unknown>) => {
    h.wizardProps.push(props);
    return <div role="dialog" aria-label="Session Prep Wizard" />;
  },
}));

const { TonightsTable } = await import('../components/views/TonightsTable');

// --- fixtures -------------------------------------------------------------

function entry(over: Partial<SessionLogEntry> & { id: string }): SessionLogEntry {
  return {
    timestamp: '2026-01-01T20:00:00.000Z',
    content: 'Something happened.',
    taggedEntityIds: [],
    ...over,
  } as SessionLogEntry;
}

function session(over: Partial<SessionLog> & { id: string }): SessionLog {
  return {
    title: `Session ${over.id}`,
    status: 'completed',
    sessionDate: '2026-01-01',
    plannedSceneIds: [],
    prepNotes: '',
    relatedPlotIds: [],
    runningNotes: '',
    structuredNotes: [],
    encounterLog: [],
    recap: '',
    notableEvents: '',
    looseEnds: '',
    ...over,
  } as SessionLog;
}

function makeCampaign(over: Record<string, unknown> = {}): Campaign {
  return {
    id: 'camp-1',
    title: 'Ashfall',
    setting: 'A dying empire',
    settingType: 'custom',
    npcs: [],
    locations: [],
    factions: [],
    items: [],
    adventures: [],
    articles: [],
    sessionLogs: [],
    playerCharacters: [],
    plots: [],
    notes: [],
    secrets: [],
    ...over,
  } as unknown as Campaign;
}

const M1 = 'The bridge went down with Ivet still on it.';
const M2 = 'Torvald gave the ring back without being asked.';
const M3 = 'Brannock swore on the ledger, and lied.';
const CHATTER = 'Bought three torches and a length of rope.';

const starred = makeCampaign({
  sessionLogs: [
    // Deliberately out of date order in the array: the reel sorts by date.
    session({
      id: 's2',
      title: 'The Ashen Vault',
      sessionDate: '2026-02-01',
      structuredNotes: [entry({ id: 'n3', content: M3, isImportant: true })],
    }),
    session({
      id: 's1',
      title: 'The Drowned Gate',
      sessionDate: '2026-01-01',
      structuredNotes: [
        // n1 is logged first but carries the LATER timestamp: the order the
        // entries were written is the order they happened, not the clock.
        entry({ id: 'n1', content: M1, isImportant: true, timestamp: '2026-01-01T23:00:00.000Z' }),
        entry({ id: 'n2', content: CHATTER }),
        entry({ id: 'n2b', content: M2, isImportant: true, timestamp: '2026-01-01T19:00:00.000Z' }),
      ],
    }),
  ],
});

const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ToastProvider><ConfirmDialogProvider>{children}</ConfirmDialogProvider></ToastProvider>
);

function renderTable(campaign: Campaign = starred) {
  const onNavigate = vi.fn();
  const onGoLive = vi.fn();
  const view = render(
    <Providers>
      <TonightsTable campaign={campaign} onNavigate={onNavigate} onGoLive={onGoLive} />
    </Providers>
  );
  return { onNavigate, onGoLive, container: view.container };
}

const reel = () => screen.getByRole('region', { name: /moments/i });
const rows = () => within(reel()).getAllByRole('button');

beforeEach(() => { h.wizardProps.length = 0; });
afterEach(cleanup);

// --- 1. zero schema --------------------------------------------------------

describe('the star that already exists', () => {
  it('mints no new flag on the session log types', () => {
    const source = readFileSync(resolve(__dirname, '../types/SessionLog.ts'), 'utf-8');
    expect(source).toContain('isImportant');
    expect(source).not.toMatch(/\bengraved|isEngraved|isMoment|momentOf|engravedAt\b/i);
  });
});

// --- 2. the reel itself ----------------------------------------------------

describe('The Moments reel — every star, in the order they happened', () => {
  it('is a panel of its own on Tonight\'s Table', () => {
    renderTable();
    expect(reel()).toBeTruthy();
  });

  it('plays the moments back oldest first, across every session', () => {
    renderTable();
    // s1 (January) before s2 (February); inside s1, the order they were logged.
    expect(rows().map(r => r.textContent)).toEqual([
      expect.stringContaining(M1),
      expect.stringContaining(M2),
      expect.stringContaining(M3),
    ]);
  });

  it('leaves the unstarred stream out', () => {
    renderTable();
    expect(reel().textContent).not.toContain(CHATTER);
  });

  it('leaves out a star with no words in it', () => {
    const campaign = makeCampaign({
      sessionLogs: [
        session({
          id: 's1',
          structuredNotes: [
            entry({ id: 'n1', content: '   ', isImportant: true }),
            entry({ id: 'n2', content: M1, isImportant: true }),
          ],
        }),
      ],
    });
    renderTable(campaign);
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain(M1);
  });

  it('treats an unstarred or never-starred entry the same way', () => {
    const campaign = makeCampaign({
      sessionLogs: [
        session({
          id: 's1',
          structuredNotes: [
            entry({ id: 'n1', content: 'Explicitly unstarred.', isImportant: false }),
            entry({ id: 'n2', content: 'Never starred at all.' }),
          ],
        }),
      ],
    });
    renderTable(campaign);
    expect(within(reel()).queryAllByRole('button')).toHaveLength(0);
  });

  it('shows every moment, however many there are', () => {
    const campaign = makeCampaign({
      sessionLogs: [
        session({
          id: 's1',
          structuredNotes: Array.from({ length: 11 }, (_, i) =>
            entry({ id: `n${i}`, content: `Moment number ${i}`, isImportant: true })
          ),
        }),
      ],
    });
    renderTable(campaign);
    expect(rows()).toHaveLength(11);
  });

  it('takes stars from the session being played right now too', () => {
    const campaign = makeCampaign({
      activeSessionId: 's-live',
      sessionLogs: [
        session({
          id: 's-live',
          title: 'Tonight',
          status: 'active',
          sessionDate: '2026-03-01',
          structuredNotes: [entry({ id: 'n1', content: M1, isImportant: true })],
        }),
      ],
    });
    renderTable(campaign);
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain(M1);
  });
});

// --- 3. where each moment came from ---------------------------------------

describe('Each moment carries its session with it', () => {
  it('names the session the moment was logged in', () => {
    renderTable();
    expect(rows()[0].textContent).toContain('The Drowned Gate');
    expect(rows()[2].textContent).toContain('The Ashen Vault');
  });

  it('takes the GM back to that session log', () => {
    const { onNavigate } = renderTable();
    fireEvent.click(rows()[2]);
    expect(onNavigate).toHaveBeenCalledWith('session-log', 's2');
  });

  it('wears the session-log accent from ENTITY_TYPE_CONFIG', () => {
    renderTable();
    const accent = new RegExp(`-${ENTITY_TYPE_CONFIG['session-log'].color}-\\d{3}`);
    expect(within(reel()).getByText('The Ashen Vault').className).toMatch(accent);
  });

  it('leaves indigo to RealmChat', () => {
    const { container } = renderTable();
    expect(container.innerHTML).not.toMatch(/indigo/);
  });
});

// --- 4. one of the family --------------------------------------------------

describe('The panel belongs to the screen it sits on', () => {
  it('is built like the panels beside it', () => {
    renderTable();
    const previously = screen.getByRole('region', { name: /previously on/i });
    const shared = ['bg-slate-800/60', 'border-slate-700', 'rounded-xl'];
    for (const cls of shared) {
      expect(previously.className).toContain(cls);
      expect(reel().className).toContain(cls);
    }
  });

  it('heads itself the way the other panels do', () => {
    renderTable();
    const heading = within(reel()).getByRole('heading');
    expect(heading.textContent?.trim().toLowerCase()).toContain('moments');
    expect(heading.className).toContain('uppercase');
  });
});

// --- 5. the empty state ----------------------------------------------------

describe('Nothing starred yet', () => {
  it('invites the first star instead of reporting an absence', () => {
    renderTable(makeCampaign());
    expect(screen.getByText('Star a moment during play and it lands here.')).toBeTruthy();
  });

  it('says the same when sessions exist but nothing was ever starred', () => {
    const campaign = makeCampaign({
      sessionLogs: [session({ id: 's1', structuredNotes: [entry({ id: 'n1', content: CHATTER })] })],
    });
    renderTable(campaign);
    expect(screen.getByText('Star a moment during play and it lands here.')).toBeTruthy();
    expect(within(reel()).queryAllByRole('button')).toHaveLength(0);
  });

  it('keeps the writing-room voice', () => {
    renderTable(makeCampaign());
    const text = reel().textContent ?? '';
    expect(text).not.toMatch(/\bentit(y|ies)\b|\bschema\b|\bmetadata\b|\bfield\b|\brecords?\b|\bflag(ged)?\b/i);
    expect(text).not.toMatch(/!/);
  });
});

// --- 7. no parallel home for the cold open ---------------------------------

describe('The cold open lives in the prep wizard, not here', () => {
  it('offers no draft or generate action on this screen', () => {
    renderTable();
    expect(screen.queryByRole('button', { name: /cold open/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /draft it from last session/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /previously on/i })).toBeNull();
  });

  it('still offers exactly one way into prep', () => {
    renderTable();
    expect(screen.getByRole('button', { name: /prep tonight.s session/i })).toBeTruthy();
  });
});

// --- 8. old saves ----------------------------------------------------------

describe('A save written by an older build', () => {
  it('reads a session with no running log at all as no moments', () => {
    const legacy = session({ id: 's1', title: 'The Drowned Gate' });
    delete (legacy as Partial<SessionLog>).structuredNotes;
    expect(() => renderTable(makeCampaign({ sessionLogs: [legacy] }))).not.toThrow();
    expect(screen.getByText('Star a moment during play and it lands here.')).toBeTruthy();
  });

  it('survives a session with no date on it', () => {
    const campaign = makeCampaign({
      sessionLogs: [
        session({
          id: 's1',
          title: 'The Drowned Gate',
          sessionDate: '',
          structuredNotes: [entry({ id: 'n1', content: M1, isImportant: true })],
        }),
      ],
    });
    expect(() => renderTable(campaign)).not.toThrow();
    expect(rows()[0].textContent).toContain(M1);
  });
});
