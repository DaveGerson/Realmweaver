/**
 * SPEC — utils/storyDerivations.ts (Wave 1, lane P1: Tonight's Table)
 *
 * These are the shared story-shape derivations P1 renders and P2/P6 reuse.
 * They are pure functions over a Campaign: no store access, no clock, no
 * mutation of their argument. Time is counted in **played sessions**, never
 * in days — "three sessions ago" is the unit a GM thinks in.
 *
 * The contract, in plain sentences:
 *
 * 1. A session counts as played once it is completed or live. Played sessions
 *    are ordered oldest-first by their session date; a blank or unparseable
 *    date sorts as the oldest rather than scrambling the order, and two
 *    sessions on the same date keep the order the campaign already had.
 *    Sessions that are still planned have not happened, so they are excluded.
 *
 * 2. "Previously on" reads from the newest completed session. A live session
 *    is skipped, because nobody has written its recap yet.
 *
 * 3. An NPC was on stage in a session when the running log tagged them, when
 *    the session planned them by name, or when a scene the session planned
 *    features them. Every NPC in the campaign gets an answer: the session they
 *    were last on stage in, and how many played sessions have passed since
 *    (zero means the most recent one). The list is ranked most-offstage first;
 *    an NPC who has never been on stage ranks after every NPC who has, because
 *    a face the table has met and forgotten is a story prompt and a face it
 *    has never met is only a name. Equal staleness breaks by name.
 *
 * 4. An open thread moves only when a session records it as advanced. Stalled
 *    and unchanged do not move it, and naming a thread in a session's related
 *    threads does not either. Threads are ranked stalest-first; a thread that
 *    has never moved counts as having sat still for every played session, so
 *    it outranks a thread that moved recently. Only active threads are listed.
 *
 * 5. A loaded gun is a secret still unrevealed that points at something on
 *    stage — planned in an upcoming or live session, or on stage in the most
 *    recent completed session. Planned beats recent when both are true. A
 *    secret already revealed is never a loaded gun: that shot has been fired.
 *    Secrets linked to nothing, or to nobody on stage, stay out of sight.
 *
 * 6. The two label helpers are the single home of the session-age wording, so
 *    every surface says it the same way.
 */

import { describe, it, expect } from 'vitest';
import type { Campaign, SessionLog } from '../types/index';
import {
  getPlayedSessionsInOrder,
  getLastCompletedSession,
  getSessionAppearanceIds,
  getSessionOnStageIds,
  deriveNpcLastAppearances,
  derivePlotThreadAges,
  deriveLoadedGuns,
  formatLastSeenLabel,
  formatThreadAgeLabel,
} from '../utils/storyDerivations';

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

const EMPTY = makeCampaign();

// A three-session campaign used by several suites below.
//   s1 (played, oldest) — Serah tagged in the running log
//   s2 (played)         — Brannock planned by name
//   s3 (played, newest) — scene-1 planned, which features Torvald
// Ivet has never been on stage.
const scene1 = { id: 'scene-1', title: 'The Ashen Gate', npcIds: ['npc-torvald'], locationId: 'loc-gate' };
const scene2 = { id: 'scene-2', title: 'The Salt Stair', npcIds: ['npc-ivet'], locationId: 'loc-stair' };

const played = makeCampaign({
  npcs: [
    { id: 'npc-serah', name: 'Serah' },
    { id: 'npc-brannock', name: 'Brannock' },
    { id: 'npc-torvald', name: 'Torvald' },
    { id: 'npc-ivet', name: 'Ivet' },
  ],
  locations: [{ id: 'loc-gate', name: 'The Ashen Gate' }, { id: 'loc-stair', name: 'The Salt Stair' }],
  adventures: [{ id: 'adv-1', title: 'Salt & Ruin', scenes: [scene1, scene2] }],
  sessionLogs: [
    session({ id: 's1', title: 'The Drowned Gate', sessionDate: '2026-01-01', structuredNotes: [note('n1', ['npc-serah'])] }),
    session({ id: 's2', title: 'The Salt Stair', sessionDate: '2026-02-01', plannedNpcIds: ['npc-brannock'] }),
    session({ id: 's3', title: 'The Ashen Vault', sessionDate: '2026-03-01', plannedSceneIds: ['scene-1'] }),
  ],
});

// --- 1. played-session ordering ------------------------------------------

describe('getPlayedSessionsInOrder — what the table has actually sat down for', () => {
  it('keeps completed and live sessions, drops planned ones, oldest first', () => {
    const campaign = makeCampaign({
      sessionLogs: [
        session({ id: 'c', sessionDate: '2026-03-01', status: 'completed' }),
        session({ id: 'p', sessionDate: '2026-04-01', status: 'planned' }),
        session({ id: 'a', sessionDate: '2026-02-01', status: 'active' }),
        session({ id: 'b', sessionDate: '2026-01-01', status: 'completed' }),
      ],
    });
    expect(getPlayedSessionsInOrder(campaign).map(s => s.id)).toEqual(['b', 'a', 'c']);
  });

  it('returns nothing for a campaign with no sessions at all', () => {
    expect(getPlayedSessionsInOrder(EMPTY)).toEqual([]);
    expect(getPlayedSessionsInOrder(makeCampaign({ sessionLogs: undefined }))).toEqual([]);
  });

  it('sorts an unusable date oldest instead of scrambling the order', () => {
    const campaign = makeCampaign({
      sessionLogs: [
        session({ id: 'dated', sessionDate: '2026-01-01' }),
        session({ id: 'blank', sessionDate: '' }),
        session({ id: 'junk', sessionDate: 'not a date' }),
      ],
    });
    // blank and junk both fall to the epoch and keep their original order.
    expect(getPlayedSessionsInOrder(campaign).map(s => s.id)).toEqual(['blank', 'junk', 'dated']);
  });

  it('keeps the campaign order for sessions sharing a date', () => {
    const campaign = makeCampaign({
      sessionLogs: [
        session({ id: 'first', sessionDate: '2026-05-05' }),
        session({ id: 'second', sessionDate: '2026-05-05' }),
      ],
    });
    expect(getPlayedSessionsInOrder(campaign).map(s => s.id)).toEqual(['first', 'second']);
  });

  it('does not mutate the campaign it reads', () => {
    const campaign = makeCampaign({
      sessionLogs: [session({ id: 'z', sessionDate: '2026-03-01' }), session({ id: 'y', sessionDate: '2026-01-01' })],
    });
    const before = JSON.stringify(campaign);
    getPlayedSessionsInOrder(campaign);
    expect(JSON.stringify(campaign)).toBe(before);
  });
});

// --- 2. previously on -----------------------------------------------------

describe('getLastCompletedSession — the one the recap comes from', () => {
  it('picks the newest completed session', () => {
    const campaign = makeCampaign({
      sessionLogs: [
        session({ id: 'old', sessionDate: '2026-01-01' }),
        session({ id: 'newest', sessionDate: '2026-03-01' }),
        session({ id: 'middle', sessionDate: '2026-02-01' }),
      ],
    });
    expect(getLastCompletedSession(campaign)?.id).toBe('newest');
  });

  it('ignores the live session, whose recap is not written yet', () => {
    const campaign = makeCampaign({
      sessionLogs: [
        session({ id: 'done', sessionDate: '2026-01-01', status: 'completed' }),
        session({ id: 'live', sessionDate: '2026-02-01', status: 'active' }),
      ],
    });
    expect(getLastCompletedSession(campaign)?.id).toBe('done');
  });

  it('returns nothing when the table has not finished a session yet', () => {
    expect(getLastCompletedSession(EMPTY)).toBeNull();
    expect(getLastCompletedSession(makeCampaign({
      sessionLogs: [session({ id: 'p', status: 'planned' })],
    }))).toBeNull();
  });
});

// --- 3. who was on stage --------------------------------------------------

describe('getSessionAppearanceIds — the three ways an NPC gets on stage', () => {
  it('unions tagged log entries, planned names, and planned scenes', () => {
    const s = session({
      id: 's',
      structuredNotes: [note('n1', ['npc-serah']), note('n2', ['npc-serah', 'loc-gate'])],
      plannedNpcIds: ['npc-brannock'],
      plannedSceneIds: ['scene-1'],
    });
    const ids = getSessionAppearanceIds(played, s);
    expect(Array.from(ids).sort()).toEqual(['loc-gate', 'npc-brannock', 'npc-serah', 'npc-torvald'].sort());
  });

  it('survives a session missing the optional arrays entirely', () => {
    const bare = { id: 's', title: 'Bare', status: 'completed', sessionDate: '2026-01-01' } as unknown as SessionLog;
    expect(getSessionAppearanceIds(played, bare).size).toBe(0);
  });

  it('ignores a planned scene id that no adventure holds', () => {
    const s = session({ id: 's', plannedSceneIds: ['scene-ghost'] });
    expect(getSessionAppearanceIds(played, s).size).toBe(0);
  });

  it('does not count the location a planned scene takes place at', () => {
    const s = session({ id: 's', plannedSceneIds: ['scene-1'] });
    expect(getSessionAppearanceIds(played, s).has('loc-gate')).toBe(false);
  });
});

describe('getSessionOnStageIds — the wider net secrets are checked against', () => {
  it('adds planned locations, related threads, and each planned scene\'s place', () => {
    const s = session({
      id: 's',
      structuredNotes: [note('n1', ['npc-serah'])],
      plannedNpcIds: ['npc-brannock'],
      plannedLocationIds: ['loc-stair'],
      plannedSceneIds: ['scene-1'],
      relatedPlotIds: ['plot-crown'],
    });
    expect(Array.from(getSessionOnStageIds(played, s)).sort()).toEqual(
      ['loc-gate', 'loc-stair', 'npc-brannock', 'npc-serah', 'npc-torvald', 'plot-crown'].sort()
    );
  });

  it('is a superset of the appearance ids', () => {
    const s = session({ id: 's', plannedSceneIds: ['scene-1'] });
    const appearance = getSessionAppearanceIds(played, s);
    const stage = getSessionOnStageIds(played, s);
    for (const id of appearance) expect(stage.has(id)).toBe(true);
  });
});

// --- 4. who's been offstage ----------------------------------------------

describe('deriveNpcLastAppearances — who the story has stopped looking at', () => {
  it('counts back from the most recent played session', () => {
    const byId = Object.fromEntries(deriveNpcLastAppearances(played).map(a => [a.npcId, a]));

    expect(byId['npc-torvald'].lastSeen?.id).toBe('s3');
    expect(byId['npc-torvald'].lastSeen?.title).toBe('The Ashen Vault');
    expect(byId['npc-torvald'].lastSeen?.ordinal).toBe(3);
    expect(byId['npc-torvald'].sessionsSinceSeen).toBe(0);

    expect(byId['npc-brannock'].lastSeen?.id).toBe('s2');
    expect(byId['npc-brannock'].lastSeen?.ordinal).toBe(2);
    expect(byId['npc-brannock'].sessionsSinceSeen).toBe(1);

    expect(byId['npc-serah'].lastSeen?.id).toBe('s1');
    expect(byId['npc-serah'].lastSeen?.ordinal).toBe(1);
    expect(byId['npc-serah'].sessionsSinceSeen).toBe(2);

    expect(byId['npc-ivet'].lastSeen).toBeNull();
    expect(byId['npc-ivet'].sessionsSinceSeen).toBeNull();
  });

  it('ranks the longest-absent first and puts never-seen faces last', () => {
    expect(deriveNpcLastAppearances(played).map(a => a.npcId)).toEqual([
      'npc-serah',    // 2 sessions ago
      'npc-brannock', // 1 session ago
      'npc-torvald',  // last session
      'npc-ivet',     // never on stage
    ]);
  });

  it('breaks equal absence by name', () => {
    const campaign = makeCampaign({
      npcs: [{ id: 'b', name: 'Brannock' }, { id: 'a', name: 'Alder' }, { id: 'c', name: 'Cressa' }],
      sessionLogs: [session({ id: 's1', structuredNotes: [note('n', ['a', 'b', 'c'])] })],
    });
    expect(deriveNpcLastAppearances(campaign).map(a => a.npcId)).toEqual(['a', 'b', 'c']);
  });

  it('names every NPC exactly once, and nobody who is not an NPC', () => {
    const result = deriveNpcLastAppearances(played);
    expect(result).toHaveLength(4);
    expect(result.map(a => a.npcName).sort()).toEqual(['Brannock', 'Ivet', 'Serah', 'Torvald']);
  });

  it('reports nothing for a world with nobody in it yet', () => {
    expect(deriveNpcLastAppearances(EMPTY)).toEqual([]);
  });

  it('treats a campaign that has never played as nobody having been on stage', () => {
    const campaign = makeCampaign({
      npcs: [{ id: 'npc-serah', name: 'Serah' }],
      sessionLogs: [session({ id: 'future', status: 'planned', plannedNpcIds: ['npc-serah'] })],
    });
    const [serah] = deriveNpcLastAppearances(campaign);
    expect(serah.lastSeen).toBeNull();
    expect(serah.sessionsSinceSeen).toBeNull();
  });

  it('ignores tagged ids that belong to something other than an NPC', () => {
    const campaign = makeCampaign({
      npcs: [{ id: 'npc-serah', name: 'Serah' }],
      locations: [{ id: 'loc-gate', name: 'The Ashen Gate' }],
      sessionLogs: [session({ id: 's1', structuredNotes: [note('n', ['loc-gate', 'plot-crown'])] })],
    });
    const result = deriveNpcLastAppearances(campaign);
    expect(result).toHaveLength(1);
    expect(result[0].lastSeen).toBeNull();
  });

  it('does not mutate the campaign it reads', () => {
    const before = JSON.stringify(played);
    deriveNpcLastAppearances(played);
    expect(JSON.stringify(played)).toBe(before);
  });
});

// --- 5. open threads ------------------------------------------------------

const threaded = makeCampaign({
  plots: [
    { id: 'plot-crown', title: 'The Crown Beneath', status: 'active', description: '', relatedEntityIds: [] },
    { id: 'plot-salt', title: 'Salt in the Wells', status: 'active', description: '', relatedEntityIds: [] },
    { id: 'plot-ash', title: 'Ashes of the Vow', status: 'active', description: '', relatedEntityIds: [] },
    { id: 'plot-done', title: 'The Burned Ledger', status: 'resolved', description: '', relatedEntityIds: [] },
    { id: 'plot-cold', title: 'The Cold Road', status: 'dormant', description: '', relatedEntityIds: [] },
  ],
  sessionLogs: [
    session({ id: 's1', sessionDate: '2026-01-01', plotProgressions: { 'plot-crown': 'advanced', 'plot-salt': 'advanced' } }),
    session({ id: 's2', sessionDate: '2026-02-01', plotProgressions: { 'plot-salt': 'stalled' } }),
    session({ id: 's3', sessionDate: '2026-03-01', plotProgressions: { 'plot-salt': 'advanced', 'plot-ash': 'unchanged' }, relatedPlotIds: ['plot-crown'] }),
  ],
});

describe('derivePlotThreadAges — which open threads are sagging', () => {
  it('counts back to the last session that actually moved the thread', () => {
    const byId = Object.fromEntries(derivePlotThreadAges(threaded).map(t => [t.plotId, t]));

    expect(byId['plot-salt'].lastAdvanced?.id).toBe('s3');
    expect(byId['plot-salt'].sessionsSinceAdvanced).toBe(0);
    expect(byId['plot-salt'].sessionsStale).toBe(0);

    // 'advanced' in s1 only; naming it in s3's related threads does not move it.
    expect(byId['plot-crown'].lastAdvanced?.id).toBe('s1');
    expect(byId['plot-crown'].lastAdvanced?.ordinal).toBe(1);
    expect(byId['plot-crown'].sessionsSinceAdvanced).toBe(2);
    expect(byId['plot-crown'].sessionsStale).toBe(2);

    // 'unchanged' never moves a thread.
    expect(byId['plot-ash'].lastAdvanced).toBeNull();
    expect(byId['plot-ash'].sessionsSinceAdvanced).toBeNull();
    expect(byId['plot-ash'].sessionsStale).toBe(3);
  });

  it('lists only threads that are still open', () => {
    expect(derivePlotThreadAges(threaded).map(t => t.plotId).sort()).toEqual(['plot-ash', 'plot-crown', 'plot-salt']);
  });

  it('ranks the stalest first, with a thread that never moved at the top', () => {
    expect(derivePlotThreadAges(threaded).map(t => t.plotId)).toEqual(['plot-ash', 'plot-crown', 'plot-salt']);
  });

  it('breaks equal staleness by title', () => {
    const campaign = makeCampaign({
      plots: [
        { id: 'z', title: 'Zephyr Debt', status: 'active', description: '', relatedEntityIds: [] },
        { id: 'a', title: 'A Quiet Betrayal', status: 'active', description: '', relatedEntityIds: [] },
      ],
      sessionLogs: [session({ id: 's1' })],
    });
    expect(derivePlotThreadAges(campaign).map(t => t.plotTitle)).toEqual(['A Quiet Betrayal', 'Zephyr Debt']);
  });

  it('reports nothing when no thread is open', () => {
    expect(derivePlotThreadAges(EMPTY)).toEqual([]);
    expect(derivePlotThreadAges(makeCampaign({ plots: undefined }))).toEqual([]);
  });

  it('leaves an untouched campaign with a thread that has sat still for no sessions', () => {
    const campaign = makeCampaign({
      plots: [{ id: 'p', title: 'The Crown Beneath', status: 'active', description: '', relatedEntityIds: [] }],
    });
    const [thread] = derivePlotThreadAges(campaign);
    expect(thread.lastAdvanced).toBeNull();
    expect(thread.sessionsSinceAdvanced).toBeNull();
    expect(thread.sessionsStale).toBe(0);
  });
});

// --- 6. loaded guns -------------------------------------------------------

function secret(over: Record<string, unknown> & { id: string; title: string }) {
  return {
    content: 'Something nobody has said out loud.',
    category: 'secret',
    isRevealed: false,
    linkedEntityIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

const primed = makeCampaign({
  npcs: [
    { id: 'npc-serah', name: 'Serah' },
    { id: 'npc-brannock', name: 'Brannock' },
    { id: 'npc-ivet', name: 'Ivet' },
  ],
  locations: [{ id: 'loc-gate', name: 'The Ashen Gate' }],
  plots: [{ id: 'plot-crown', title: 'The Crown Beneath', status: 'active', description: '', relatedEntityIds: [] }],
  adventures: [{ id: 'adv-1', title: 'Salt & Ruin', scenes: [scene1] }],
  sessionLogs: [
    session({ id: 'past', sessionDate: '2026-01-01', status: 'completed', structuredNotes: [note('n', ['npc-brannock'])] }),
    session({
      id: 'next', sessionDate: '2026-04-01', status: 'planned',
      plannedNpcIds: ['npc-serah'], plannedLocationIds: ['loc-gate'], relatedPlotIds: ['plot-crown'],
    }),
  ],
  secrets: [
    secret({ id: 'sec-serah', title: 'Serah sold the seal', linkedEntityIds: ['npc-serah'] }),
    secret({ id: 'sec-brannock', title: 'Brannock never left the vault', linkedEntityIds: ['npc-brannock'] }),
    secret({ id: 'sec-gate', title: 'The gate remembers its dead', linkedEntityIds: ['loc-gate'] }),
    secret({ id: 'sec-crown', title: 'The crown was never buried', linkedEntityIds: ['plot-crown'] }),
    secret({ id: 'sec-ivet', title: 'Ivet is waiting somewhere else', linkedEntityIds: ['npc-ivet'] }),
    secret({ id: 'sec-loose', title: 'A secret linked to nobody', linkedEntityIds: [] }),
    secret({ id: 'sec-spent', title: 'The seal was already broken', linkedEntityIds: ['npc-serah'], isRevealed: true }),
  ],
});

describe('deriveLoadedGuns — what is primed and pointing at tonight', () => {
  it('surfaces a secret about someone the next session plans to bring on', () => {
    const gun = deriveLoadedGuns(primed).find(g => g.secretId === 'sec-serah');
    expect(gun).toBeDefined();
    expect(gun?.reason).toBe('planned');
    expect(gun?.triggeringEntityIds).toEqual(['npc-serah']);
    expect(gun?.secretTitle).toBe('Serah sold the seal');
    expect(gun?.category).toBe('secret');
  });

  it('surfaces a secret about someone who was on stage last time', () => {
    const gun = deriveLoadedGuns(primed).find(g => g.secretId === 'sec-brannock');
    expect(gun?.reason).toBe('recent');
    expect(gun?.triggeringEntityIds).toEqual(['npc-brannock']);
  });

  it('follows a link to a place or a thread, not just to a face', () => {
    const ids = deriveLoadedGuns(primed).map(g => g.secretId);
    expect(ids).toContain('sec-gate');
    expect(ids).toContain('sec-crown');
  });

  it('never reloads a secret the table has already been told', () => {
    expect(deriveLoadedGuns(primed).map(g => g.secretId)).not.toContain('sec-spent');
  });

  it('leaves out secrets pointing nowhere near tonight', () => {
    const ids = deriveLoadedGuns(primed).map(g => g.secretId);
    expect(ids).not.toContain('sec-ivet');
    expect(ids).not.toContain('sec-loose');
  });

  it('lists what is planned before what merely happened last time', () => {
    const reasons = deriveLoadedGuns(primed).map(g => g.reason);
    expect(reasons.indexOf('recent')).toBeGreaterThan(reasons.lastIndexOf('planned'));
  });

  it('sorts within a reason by title', () => {
    const plannedTitles = deriveLoadedGuns(primed).filter(g => g.reason === 'planned').map(g => g.secretTitle);
    expect(plannedTitles).toEqual([...plannedTitles].sort((a, b) => a.localeCompare(b)));
  });

  it('calls a secret planned when it is both planned and recent', () => {
    const campaign = makeCampaign({
      npcs: [{ id: 'npc-serah', name: 'Serah' }],
      sessionLogs: [
        session({ id: 'past', sessionDate: '2026-01-01', status: 'completed', structuredNotes: [note('n', ['npc-serah'])] }),
        session({ id: 'next', sessionDate: '2026-04-01', status: 'planned', plannedNpcIds: ['npc-serah'] }),
      ],
      secrets: [secret({ id: 's', title: 'Both', linkedEntityIds: ['npc-serah'] })],
    });
    expect(deriveLoadedGuns(campaign)[0].reason).toBe('planned');
  });

  it('reads a live session as an upcoming one', () => {
    const campaign = makeCampaign({
      npcs: [{ id: 'npc-serah', name: 'Serah' }],
      sessionLogs: [session({ id: 'live', status: 'active', plannedNpcIds: ['npc-serah'] })],
      secrets: [secret({ id: 's', title: 'Live', linkedEntityIds: ['npc-serah'] })],
    });
    expect(deriveLoadedGuns(campaign)[0].reason).toBe('planned');
  });

  it('only looks back at the most recent completed session, not every one', () => {
    const campaign = makeCampaign({
      npcs: [{ id: 'npc-old', name: 'Old Face' }],
      sessionLogs: [
        session({ id: 'older', sessionDate: '2026-01-01', structuredNotes: [note('n', ['npc-old'])] }),
        session({ id: 'newer', sessionDate: '2026-02-01' }),
      ],
      secrets: [secret({ id: 's', title: 'Stale', linkedEntityIds: ['npc-old'] })],
    });
    expect(deriveLoadedGuns(campaign)).toEqual([]);
  });

  it('keeps only the on-stage links, in the order the secret lists them', () => {
    const campaign = makeCampaign({
      npcs: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
      sessionLogs: [session({ id: 'next', status: 'planned', plannedNpcIds: ['c', 'a'] })],
      secrets: [secret({ id: 's', title: 'Ordered', linkedEntityIds: ['a', 'b', 'c'] })],
    });
    expect(deriveLoadedGuns(campaign)[0].triggeringEntityIds).toEqual(['a', 'c']);
  });

  it('reports nothing for a campaign that has planted no secrets', () => {
    expect(deriveLoadedGuns(EMPTY)).toEqual([]);
    expect(deriveLoadedGuns(makeCampaign({ secrets: undefined }))).toEqual([]);
  });

  it('does not mutate the campaign it reads', () => {
    const before = JSON.stringify(primed);
    deriveLoadedGuns(primed);
    expect(JSON.stringify(primed)).toBe(before);
  });
});

// --- 7. the wording -------------------------------------------------------

describe('formatLastSeenLabel — one wording for an absence, everywhere', () => {
  const ref = { id: 's', title: 'The Ashen Vault', sessionDate: '2026-03-01', ordinal: 3 };

  it('says the table has not met them yet', () => {
    expect(formatLastSeenLabel({ npcId: 'n', npcName: 'Ivet', lastSeen: null, sessionsSinceSeen: null }))
      .toBe("Hasn't stepped on stage yet");
  });

  it('says last session for the most recent one', () => {
    expect(formatLastSeenLabel({ npcId: 'n', npcName: 'Torvald', lastSeen: ref, sessionsSinceSeen: 0 }))
      .toBe('Last seen last session');
  });

  it('keeps the singular at one session', () => {
    expect(formatLastSeenLabel({ npcId: 'n', npcName: 'Brannock', lastSeen: ref, sessionsSinceSeen: 1 }))
      .toBe('Last seen 1 session ago');
  });

  it('counts sessions after that', () => {
    expect(formatLastSeenLabel({ npcId: 'n', npcName: 'Serah', lastSeen: ref, sessionsSinceSeen: 4 }))
      .toBe('Last seen 4 sessions ago');
  });
});

describe('formatThreadAgeLabel — one wording for a stalled thread, everywhere', () => {
  const ref = { id: 's', title: 'The Ashen Vault', sessionDate: '2026-03-01', ordinal: 3 };

  it('says a thread has not moved at all yet', () => {
    expect(formatThreadAgeLabel({ plotId: 'p', plotTitle: 'Ashes of the Vow', lastAdvanced: null, sessionsSinceAdvanced: null, sessionsStale: 3 }))
      .toBe("Hasn't moved yet");
  });

  it('says a thread moved last session', () => {
    expect(formatThreadAgeLabel({ plotId: 'p', plotTitle: 'Salt in the Wells', lastAdvanced: ref, sessionsSinceAdvanced: 0, sessionsStale: 0 }))
      .toBe('Moved last session');
  });

  it('keeps the singular at one session', () => {
    expect(formatThreadAgeLabel({ plotId: 'p', plotTitle: 'The Crown Beneath', lastAdvanced: ref, sessionsSinceAdvanced: 1, sessionsStale: 1 }))
      .toBe("Hasn't moved in 1 session");
  });

  it('counts sessions after that', () => {
    expect(formatThreadAgeLabel({ plotId: 'p', plotTitle: 'The Crown Beneath', lastAdvanced: ref, sessionsSinceAdvanced: 4, sessionsStale: 4 }))
      .toBe("Hasn't moved in 4 sessions");
  });

  it('never shows a data-modeling word to the GM', () => {
    const labels = [
      formatThreadAgeLabel({ plotId: 'p', plotTitle: 't', lastAdvanced: null, sessionsSinceAdvanced: null, sessionsStale: 2 }),
      formatThreadAgeLabel({ plotId: 'p', plotTitle: 't', lastAdvanced: ref, sessionsSinceAdvanced: 2, sessionsStale: 2 }),
      formatLastSeenLabel({ npcId: 'n', npcName: 'x', lastSeen: null, sessionsSinceSeen: null }),
      formatLastSeenLabel({ npcId: 'n', npcName: 'x', lastSeen: ref, sessionsSinceSeen: 2 }),
    ];
    for (const label of labels) {
      expect(label).not.toMatch(/entit|schema|field|record|status|progression|null|undefined/i);
    }
  });
});
