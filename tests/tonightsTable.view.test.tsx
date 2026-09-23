// @vitest-environment jsdom
/**
 * SPEC — components/views/TonightsTable.tsx (Wave 1, lane P1)
 *
 * Tonight's Table is the story-first campaign home. Opening a mid-campaign
 * world should answer "what matters tonight?", so the view assembles four
 * derived panels and one button, with no clicks and no upkeep:
 *
 * 1. **Previously on** — the last completed session's recap and loose ends,
 *    printed as they were written. The text itself, not a link to the session
 *    log, and nothing inside that panel is clickable. The recap shown is the
 *    GM's own; the player recap belongs to the players and is never shown
 *    here in its place.
 *
 * 2. **Open threads** — every active thread, stalest first, each with how long
 *    it has sat still in sessions. A row takes the GM to the thread.
 *
 * 3. **Who's been offstage** — the cast ranked by how long since the table saw
 *    them, longest first, capped at six so the panel stays readable. A row
 *    takes the GM to the NPC.
 *
 * 4. **Loaded guns** — unrevealed secrets pointing at someone or somewhere
 *    tonight will touch, named alongside what primed them. A secret the table
 *    has already been told never appears; the panel is the GM's private
 *    inventory of shots not yet fired.
 *
 * 5. **One button** — "Prep tonight's session" opens the Session Prep Wizard
 *    the same way the Session Manager does: the wizard is handed the campaign,
 *    finishing it hands the new session id back through onGoLive, and closing
 *    it changes nothing. Pressing the button twice opens one wizard, not two.
 *    While a session is already live the button is disabled, exactly as the
 *    Session Manager's is.
 *
 * Every empty panel is an invitation to write the next thing, never a report
 * of what is missing. Accent colours come from ENTITY_TYPE_CONFIG and nowhere
 * else, and indigo — RealmChat's colour — appears nowhere on this screen.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, screen, within, fireEvent, waitFor } from '@testing-library/react';
import type { Campaign, SessionLog } from '../types/index';
import { ENTITY_TYPE_CONFIG } from '../utils/entityUtils';
import { ToastProvider } from '../hooks/useToast';
import { ConfirmDialogProvider } from '../hooks/useConfirmDialog';

const h = vi.hoisted(() => ({
  wizardProps: [] as Record<string, unknown>[],
}));

vi.mock('@/components/dialogs/SessionPrepWizard', () => ({
  SessionPrepWizard: (props: Record<string, unknown>) => {
    h.wizardProps.push(props);
    return (
      <div role="dialog" aria-label="Session Prep Wizard">
        <button onClick={() => (props.onComplete as (id: string) => void)('sess-new')}>Stub go live</button>
        <button onClick={() => (props.onClose as () => void)()}>Stub close</button>
      </div>
    );
  },
}));

const { TonightsTable } = await import('../components/views/TonightsTable');

// --- fixtures -------------------------------------------------------------

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

function note(id: string, taggedEntityIds: string[]) {
  return { id, timestamp: '2026-01-01T20:00:00.000Z', content: 'A thing happened.', taggedEntityIds };
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

const RECAP = 'The party burned the ledger and walked out of the Ashen Gate before dawn.';
const LOOSE_ENDS = 'Nobody has explained where Brannock went, and the seal is still missing.';
const PLAYER_RECAP = 'You escaped the gate. Roll for the road ahead.';

const full = makeCampaign({
  npcs: [
    { id: 'npc-serah', name: 'Serah' },
    { id: 'npc-brannock', name: 'Brannock' },
    { id: 'npc-torvald', name: 'Torvald' },
    { id: 'npc-ivet', name: 'Ivet' },
  ],
  locations: [{ id: 'loc-gate', name: 'The Ashen Gate' }],
  plots: [
    { id: 'plot-crown', title: 'The Crown Beneath', status: 'active', description: '', relatedEntityIds: [] },
    { id: 'plot-salt', title: 'Salt in the Wells', status: 'active', description: '', relatedEntityIds: [] },
    { id: 'plot-done', title: 'The Burned Ledger', status: 'resolved', description: '', relatedEntityIds: [] },
    { id: 'plot-cold', title: 'The Cold Road', status: 'dormant', description: '', relatedEntityIds: [] },
  ],
  sessionLogs: [
    session({
      id: 's1', title: 'The Drowned Gate', sessionDate: '2026-01-01',
      structuredNotes: [note('n1', ['npc-serah'])],
      plotProgressions: { 'plot-crown': 'advanced' },
    }),
    session({
      id: 's2', title: 'The Ashen Vault', sessionDate: '2026-02-01',
      structuredNotes: [note('n2', ['npc-brannock'])],
      recap: RECAP,
      looseEnds: LOOSE_ENDS,
      playerRecap: PLAYER_RECAP,
    }),
    session({
      id: 's3', title: 'The Salt Stair', sessionDate: '2026-04-01', status: 'planned',
      plannedNpcIds: ['npc-serah'],
      plannedLocationIds: ['loc-gate'],
    }),
  ],
  secrets: [
    {
      id: 'sec-serah', title: 'Serah sold the seal', content: 'She took coin from the Vault.',
      category: 'secret', isRevealed: false, linkedEntityIds: ['npc-serah'], createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'sec-gate', title: 'The gate remembers its dead', content: 'It counts them by name.',
      category: 'clue', isRevealed: false, linkedEntityIds: ['loc-gate'], createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'sec-spent', title: 'The seal was already broken', content: 'Told at the table in session two.',
      category: 'revelation', isRevealed: true, linkedEntityIds: ['npc-serah'], createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'sec-ivet', title: 'Ivet is waiting somewhere else', content: 'Far from tonight.',
      category: 'clue', isRevealed: false, linkedEntityIds: ['npc-ivet'], createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
});

const noop = () => {};

/** Toast / confirm providers are available to the view, as in the real app. */
const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ToastProvider><ConfirmDialogProvider>{children}</ConfirmDialogProvider></ToastProvider>
);

function renderTable(over: { campaign?: Campaign; onNavigate?: typeof noop; onGoLive?: (id: string) => void } = {}) {
  const onNavigate = vi.fn();
  const onGoLive = vi.fn();
  render(
    <Providers>
      <TonightsTable
        campaign={over.campaign ?? full}
        onNavigate={over.onNavigate ?? onNavigate}
        onGoLive={over.onGoLive ?? onGoLive}
      />
    </Providers>
  );
  return { onNavigate, onGoLive };
}

function region(name: RegExp) {
  return screen.getByRole('region', { name });
}

const accentPattern = (type: string) =>
  new RegExp(`-${ENTITY_TYPE_CONFIG[type].color}-\\d{3}`);

beforeEach(() => { h.wizardProps.length = 0; });
afterEach(cleanup);

// --- the screen itself ----------------------------------------------------

describe('TonightsTable — the front door', () => {
  it('names itself', () => {
    renderTable();
    expect(screen.getByRole('heading', { level: 1, name: /tonight.s table/i })).toBeTruthy();
  });

  it('lays out the four panels', () => {
    renderTable();
    expect(region(/previously on/i)).toBeTruthy();
    expect(region(/open threads/i)).toBeTruthy();
    expect(region(/offstage/i)).toBeTruthy();
    expect(region(/loaded guns/i)).toBeTruthy();
  });

  it('leaves indigo to RealmChat', () => {
    const { container } = render(
      <Providers><TonightsTable campaign={full} onNavigate={noop} onGoLive={noop} /></Providers>
    );
    expect(container.innerHTML).not.toMatch(/indigo/);
  });
});

// --- previously on --------------------------------------------------------

describe('Previously on — the last session, in its own words', () => {
  it('prints the recap and the loose ends as they were written', () => {
    renderTable();
    const panel = region(/previously on/i);
    expect(panel.textContent).toContain(RECAP);
    expect(panel.textContent).toContain(LOOSE_ENDS);
  });

  it('names the session the words came from', () => {
    renderTable();
    expect(region(/previously on/i).textContent).toContain('The Ashen Vault');
  });

  it('reads the last completed session, not a planned one', () => {
    renderTable();
    expect(region(/previously on/i).textContent).not.toContain('The Salt Stair');
  });

  it('shows the words themselves, with nothing to click', () => {
    renderTable();
    const panel = region(/previously on/i);
    expect(within(panel).queryAllByRole('button')).toHaveLength(0);
    expect(within(panel).queryAllByRole('link')).toHaveLength(0);
  });

  it('never puts the players\' recap where the GM\'s belongs', () => {
    renderTable();
    expect(document.body.textContent).not.toContain(PLAYER_RECAP);
  });

  it('invites the first session when the table has not played yet', () => {
    renderTable({ campaign: makeCampaign() });
    expect(
      screen.getByText("Your table hasn't sat down yet. Prep tonight's session and the story starts here.")
    ).toBeTruthy();
  });

  it('invites a recap when the last session was left blank', () => {
    const campaign = makeCampaign({
      sessionLogs: [session({ id: 's1', title: 'The Drowned Gate', recap: '', looseEnds: '' })],
    });
    renderTable({ campaign });
    expect(
      screen.getByText('Last session ended without a word written down. Jot the recap in the session log and it will greet you here next time.')
    ).toBeTruthy();
  });

  it('does not crash on a legacy save missing recap/looseEnds entirely (Stage 1 review finding #3)', () => {
    const legacySession = session({ id: 's1', title: 'The Drowned Gate' });
    // Simulate a hand-edited/legacy save: `migrateCampaignsData` back-fills
    // `structuredNotes`/`relatedPlotIds`/etc but never `recap`/`looseEnds`, so
    // a real import can leave these fields undefined despite the SessionLog
    // type saying they are required strings.
    delete legacySession.recap;
    delete legacySession.looseEnds;

    const campaign = makeCampaign({ sessionLogs: [legacySession] });
    expect(() => renderTable({ campaign })).not.toThrow();
    expect(
      screen.getByText('Last session ended without a word written down. Jot the recap in the session log and it will greet you here next time.')
    ).toBeTruthy();
  });

  it('shows loose ends alone when only the recap is blank', () => {
    const campaign = makeCampaign({
      sessionLogs: [session({ id: 's1', title: 'The Drowned Gate', recap: '', looseEnds: LOOSE_ENDS })],
    });
    renderTable({ campaign });
    expect(region(/previously on/i).textContent).toContain(LOOSE_ENDS);
  });
});

// --- open threads ---------------------------------------------------------

describe('Open threads — sorted by how long they have sagged', () => {
  it('lists the open threads stalest first', () => {
    renderTable();
    const rows = within(region(/open threads/i)).getAllByRole('button');
    expect(rows[0].textContent).toContain('Salt in the Wells');   // never moved
    expect(rows[1].textContent).toContain('The Crown Beneath');   // moved once, two sessions back
  });

  it('says how long each has sat still, in sessions', () => {
    renderTable();
    const panel = region(/open threads/i);
    expect(within(panel).getByText("Hasn't moved yet")).toBeTruthy();
    expect(within(panel).getByText("Hasn't moved in 1 session")).toBeTruthy();
  });

  it('leaves resolved and dormant threads out', () => {
    renderTable();
    const panel = region(/open threads/i);
    expect(panel.textContent).not.toContain('The Burned Ledger');
    expect(panel.textContent).not.toContain('The Cold Road');
  });

  it('takes the GM to the thread', () => {
    const { onNavigate } = renderTable();
    fireEvent.click(within(region(/open threads/i)).getByRole('button', { name: /The Crown Beneath/ }));
    expect(onNavigate).toHaveBeenCalledWith('plot', 'plot-crown');
  });

  it('wears the thread accent from ENTITY_TYPE_CONFIG', () => {
    renderTable();
    expect(within(region(/open threads/i)).getByText('The Crown Beneath').className)
      .toMatch(accentPattern('plot'));
  });

  it('invites a thread when nothing is pulling yet', () => {
    renderTable({ campaign: makeCampaign() });
    expect(
      screen.getByText('Nothing is pulling at the party yet. Open a thread when a question starts to itch.')
    ).toBeTruthy();
  });
});

// --- who's been offstage --------------------------------------------------

describe("Who's been offstage — the faces the story stopped looking at", () => {
  it('ranks the longest absence first and never-met faces last', () => {
    renderTable();
    const rows = within(region(/offstage/i)).getAllByRole('button');
    // Serah last appeared a session before Brannock; Ivet and Torvald have
    // never been on stage, so they fall to the end and break by name.
    expect(rows.map(r => r.textContent)).toEqual([
      expect.stringContaining('Serah'),
      expect.stringContaining('Brannock'),
      expect.stringContaining('Ivet'),
      expect.stringContaining('Torvald'),
    ]);
  });

  it('says when each was last on stage, in sessions', () => {
    renderTable();
    const panel = region(/offstage/i);
    expect(within(panel).getByText('Last seen 1 session ago')).toBeTruthy();  // Serah, session one of two
    expect(within(panel).getByText('Last seen last session')).toBeTruthy();   // Brannock, session two
    expect(within(panel).getAllByText("Hasn't stepped on stage yet")).toHaveLength(2); // Torvald, Ivet
  });

  it('takes the GM to the NPC', () => {
    const { onNavigate } = renderTable();
    fireEvent.click(within(region(/offstage/i)).getByRole('button', { name: /Serah/ }));
    expect(onNavigate).toHaveBeenCalledWith('npc', 'npc-serah');
  });

  it('wears the NPC accent from ENTITY_TYPE_CONFIG', () => {
    renderTable();
    expect(within(region(/offstage/i)).getByText('Serah').className)
      .toMatch(accentPattern('npc'));
  });

  it('stops at six so the panel stays readable', () => {
    const campaign = makeCampaign({
      npcs: Array.from({ length: 12 }, (_, i) => ({ id: `npc-${i}`, name: `Face ${String(i).padStart(2, '0')}` })),
    });
    renderTable({ campaign });
    expect(within(region(/offstage/i)).getAllByRole('button')).toHaveLength(6);
  });

  it('invites the first face when nobody lives here yet', () => {
    renderTable({ campaign: makeCampaign() });
    expect(screen.getByText('No one lives here yet. Who does the party meet first?')).toBeTruthy();
  });
});

// --- loaded guns ----------------------------------------------------------

describe('Loaded guns — what is primed and pointing at tonight', () => {
  it('names the secret', () => {
    renderTable();
    expect(region(/loaded guns/i).textContent).toContain('Serah sold the seal');
  });

  it('names what put it in range', () => {
    renderTable();
    // The gate is planned for the next session; the secret concerns it.
    const panel = region(/loaded guns/i);
    expect(panel.textContent).toContain('The gate remembers its dead');
    expect(panel.textContent).toContain('The Ashen Gate');
  });

  it('never reloads a secret the table has already been told', () => {
    renderTable();
    expect(document.body.textContent).not.toContain('The seal was already broken');
  });

  it('leaves out a secret pointing nowhere near tonight', () => {
    renderTable();
    expect(region(/loaded guns/i).textContent).not.toContain('Ivet is waiting somewhere else');
  });

  it('invites a secret when nothing is primed', () => {
    renderTable({ campaign: makeCampaign() });
    expect(
      screen.getByText('Nothing is primed yet. Plant a secret near someone the party is about to meet.')
    ).toBeTruthy();
  });
});

// --- the one button -------------------------------------------------------

describe('Prep tonight\'s session — the one button', () => {
  it('offers a single way into the Session Prep Wizard', () => {
    renderTable();
    const button = screen.getByRole('button', { name: /prep tonight.s session/i });
    expect(button.tagName).toBe('BUTTON');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the wizard with the campaign', async () => {
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: /prep tonight.s session/i }));
    await screen.findByRole('dialog');
    expect(h.wizardProps).toHaveLength(1);
    expect(h.wizardProps[0].campaign).toBe(full);
    expect(typeof h.wizardProps[0].onComplete).toBe('function');
    expect(typeof h.wizardProps[0].onClose).toBe('function');
  });

  it('opens one wizard however many times the button is pressed', async () => {
    renderTable();
    const button = screen.getByRole('button', { name: /prep tonight.s session/i });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    await screen.findByRole('dialog');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('hands the finished session on and closes', async () => {
    const { onGoLive } = renderTable();
    fireEvent.click(screen.getByRole('button', { name: /prep tonight.s session/i }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Stub go live' }));
    expect(onGoLive).toHaveBeenCalledTimes(1);
    expect(onGoLive).toHaveBeenCalledWith('sess-new');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('changes nothing when the wizard is closed', async () => {
    const { onGoLive } = renderTable();
    fireEvent.click(screen.getByRole('button', { name: /prep tonight.s session/i }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Stub close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onGoLive).not.toHaveBeenCalled();
  });

  it('stands down while a session is already live', () => {
    const campaign = makeCampaign({
      activeSessionId: 'sess-live',
      sessionLogs: [session({ id: 'sess-live', title: 'Tonight', status: 'active' })],
    });
    renderTable({ campaign });
    const button = screen.getByRole('button', { name: /prep tonight.s session/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('title')).toBe('A session is already live');
    fireEvent.click(button);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.wizardProps).toHaveLength(0);
  });
});

// --- voice ----------------------------------------------------------------

describe('The writing-room voice', () => {
  it('keeps data-modeling words off the screen', () => {
    renderTable();
    expect(document.body.textContent).not.toMatch(/\bentit(y|ies)\b|\bschema\b|\bmetadata\b|\bfield\b|\brecords?\b/i);
  });

  it('keeps them off the empty screen too', () => {
    renderTable({ campaign: makeCampaign() });
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/\bentit(y|ies)\b|\bschema\b|\bmetadata\b|\bfield\b|\brecords?\b/i);
    expect(text).not.toMatch(/\bno (npcs|plots|secrets|sessions|data|results)\b/i);
    expect(text).not.toMatch(/!/);
  });
});
