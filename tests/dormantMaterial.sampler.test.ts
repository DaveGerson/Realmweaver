/**
 * SPEC — utils/dormantMaterial.ts (Wave 1, lane P2: the Callback Machine)
 *
 * The Callback Machine spends the campaign's own unused prep. Before it can
 * ask the AI for anything it has to decide *what to spend*, and that decision
 * is this module: a pure sampler over the campaign, ranking and picking the
 * material the table has established but set down.
 *
 * The contract, in plain sentences:
 *
 * 1. There are exactly four kinds of dormant material, and they are always
 *    reported in the same order: an offstage NPC, an unrevealed secret aimed
 *    at something present, a thread that has stopped moving, and a prepped
 *    scene that never ran. `collectDormantCandidates` always answers with all
 *    four buckets, even when some are empty.
 *
 * 2. **An offstage NPC is a face the table has met and not seen lately.** An
 *    NPC qualifies only if they have been on stage at least once and were not
 *    on stage in the most recent played session. An NPC the table has never
 *    met is not a callback — it is just a name — so a never-seen NPC never
 *    qualifies. Anyone standing in the scene that is live right now is, by
 *    definition, not offstage. The bucket is ranked longest-offstage first,
 *    reusing P1's ranking rather than re-deriving it, and each piece carries
 *    P1's own last-seen wording as its reason.
 *
 * 3. **An unrevealed secret qualifies when it points at something present** —
 *    exactly P1's loaded guns, in P1's order (primed by tonight before primed
 *    by last session, then by title). A secret already told to the players is
 *    never sampled: that shot has been fired, and re-spending it would have
 *    the DM reveal the same thing twice. A secret linked to nothing, or to
 *    nobody on stage, stays out of the sample.
 *
 * 4. **A thread qualifies when it has stopped moving.** An active thread that
 *    no session has advanced since the last one is stale and qualifies,
 *    carrying P1's thread-age wording; a thread advanced in the most recent
 *    played session has not stopped and does not qualify. A thread the DM has
 *    marked dormant always qualifies. A resolved thread never does. Stale
 *    active threads rank first, stalest of them first, and dormant threads
 *    follow in title order.
 *
 * 5. **A scene qualifies when it was prepped and never run** — its status is
 *    still planned, no played session ever put it on stage, and it is not the
 *    scene running right now. Its reason names the adventure it was prepped
 *    for. Scenes rank in the order the campaign already stores them.
 *
 * 6. **The sample is 2–3 pieces, at most one per kind.** A request for fewer
 *    than two is raised to two, a request for more than three is lowered to
 *    three, and no request produces two pieces of the same kind or the same
 *    entity twice. The only reason to return fewer is that fewer kinds have
 *    anything to offer; a campaign with nothing dormant returns nothing at
 *    all rather than inventing material.
 *
 * 7. **Randomness is injected, never reached for.** The sampler draws from
 *    the source it is handed, in a fixed order: one draw chooses where in the
 *    kind order to start, then one draw per chosen kind picks its piece. The
 *    same campaign and the same draws always produce the same sample, so a
 *    test can pin it and a DM pressing "Another" gets variety. A pick never
 *    reaches deeper than the top few of a bucket, so the stalest material is
 *    what actually gets spent. A random source that misbehaves — returning
 *    one, a negative, or a NaN — still produces a real piece rather than an
 *    undefined hole.
 *
 * 8. Reading the campaign never changes it.
 */

import { describe, it, expect } from 'vitest';
import type { Campaign, SessionLog } from '../types/index';
import {
  DORMANT_KIND_ORDER,
  DORMANT_POOL_DEPTH,
  MIN_DORMANT_SAMPLE,
  MAX_DORMANT_SAMPLE,
  collectDormantCandidates,
  sampleDormantMaterial,
} from '../utils/dormantMaterial';
import type { DormantPiece } from '../utils/dormantMaterial';

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

function scene(over: Record<string, unknown>) {
  return {
    type: 'social',
    status: 'planned',
    readAloudText: '',
    gmNotes: '',
    skillChecks: [],
    rewards: '',
    npcIds: [],
    ...over,
  };
}

function secret(over: Record<string, unknown>) {
  return {
    content: 'Something the party does not know.',
    category: 'secret',
    isRevealed: false,
    createdAt: '2026-01-01',
    linkedEntityIds: [],
    ...over,
  };
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

/**
 * A random source that yields the given draws in order, then keeps returning
 * the last one. Every assertion that pins a pick states its draws explicitly.
 */
function seq(draws: number[]): () => number {
  let i = 0;
  return () => {
    const value = draws[Math.min(i, draws.length - 1)];
    i += 1;
    return value;
  };
}

/**
 * The reference world. Three played sessions (s1 → s3) plus one still-planned
 * session (s4), so every bucket has something in it:
 *
 *   NPCs      Serah (last on stage in s1), Brannock (planned into s2),
 *             Torvald (on stage in s3 via scene-1), Ivet (never on stage)
 *   Secrets   one primed by the planned session, two primed by s3, one
 *             already revealed, one linked to nothing, one linked to Ivet
 *   Threads   one active + never advanced, one active + advanced in s1,
 *             one active + advanced in s3, one dormant, one resolved
 *   Scenes    scene-1 (ran in s3), scene-2 (prepped, never run),
 *             scene-3 (completed), scene-live (prepped, never run)
 */
const WORLD = makeCampaign({
  npcs: [
    { id: 'npc-serah', name: 'Serah' },
    { id: 'npc-brannock', name: 'Brannock' },
    { id: 'npc-torvald', name: 'Torvald' },
    { id: 'npc-ivet', name: 'Ivet' },
  ],
  locations: [
    { id: 'loc-gate', name: 'The Ashen Gate' },
    { id: 'loc-hall', name: 'The Salt Hall' },
  ],
  adventures: [
    {
      id: 'adv-1',
      title: 'Salt & Ruin',
      scenes: [
        scene({ id: 'scene-1', title: 'The Ashen Gate', npcIds: ['npc-torvald'], locationId: 'loc-gate' }),
        scene({ id: 'scene-2', title: 'The Drowned Stair' }),
      ],
    },
    {
      id: 'adv-2',
      title: 'The Quiet War',
      scenes: [
        scene({ id: 'scene-3', title: 'The Burned Chapel', status: 'completed' }),
        scene({ id: 'scene-live', title: 'The Salt Hall', npcIds: ['npc-serah'], locationId: 'loc-hall' }),
      ],
    },
  ],
  sessionLogs: [
    session({ id: 's1', sessionDate: '2026-01-01', structuredNotes: [note('n1', ['npc-serah'])], plotProgressions: { 'plot-ember': 'advanced' } }),
    session({ id: 's2', sessionDate: '2026-02-01', plannedNpcIds: ['npc-brannock'] }),
    session({ id: 's3', sessionDate: '2026-03-01', plannedSceneIds: ['scene-1'], plotProgressions: { 'plot-salt': 'advanced' } }),
    session({ id: 's4', sessionDate: '2026-04-01', status: 'planned', plannedNpcIds: ['npc-brannock'] }),
  ],
  plots: [
    { id: 'plot-hollow', title: 'The Hollow Crown', description: '', status: 'active', relatedEntityIds: [] },
    { id: 'plot-salt', title: 'The Salt Road', description: '', status: 'active', relatedEntityIds: [] },
    { id: 'plot-ember', title: 'The Ember Pact', description: '', status: 'active', relatedEntityIds: [] },
    { id: 'plot-quiet', title: 'The Quiet War', description: '', status: 'dormant', relatedEntityIds: [] },
    { id: 'plot-siege', title: 'The Broken Siege', description: '', status: 'resolved', relatedEntityIds: [] },
  ],
  secrets: [
    secret({ id: 'sec-key', title: 'The Ashen Key', linkedEntityIds: ['npc-torvald'] }),
    secret({ id: 'sec-oath', title: 'The Drowned Oath', linkedEntityIds: ['loc-gate'] }),
    secret({ id: 'sec-debt', title: 'The Brannock Debt', linkedEntityIds: ['npc-brannock'] }),
    secret({ id: 'sec-spent', title: 'Spent Powder', isRevealed: true, linkedEntityIds: ['npc-torvald'] }),
    secret({ id: 'sec-loose', title: 'The Silent Ledger', linkedEntityIds: [] }),
    secret({ id: 'sec-far', title: 'Nowhere Near', linkedEntityIds: ['npc-ivet'] }),
  ],
});

const ids = (pieces: DormantPiece[]) => pieces.map(p => p.id);
const kinds = (pieces: DormantPiece[]) => pieces.map(p => p.kind);

// --- 1. shape -------------------------------------------------------------

describe('the four kinds of dormant material', () => {
  it('reads in one fixed order', () => {
    expect(DORMANT_KIND_ORDER).toEqual(['npc', 'secret', 'plot', 'scene']);
  });

  it('always answers with all four buckets, even for an untouched campaign', () => {
    const pools = collectDormantCandidates(EMPTY);
    expect(Object.keys(pools).sort()).toEqual(['npc', 'plot', 'scene', 'secret']);
    expect(pools.npc).toEqual([]);
    expect(pools.secret).toEqual([]);
    expect(pools.plot).toEqual([]);
    expect(pools.scene).toEqual([]);
  });

  it('survives a campaign whose optional arrays are simply absent', () => {
    const bare = makeCampaign({ npcs: undefined, plots: undefined, secrets: undefined, adventures: undefined, sessionLogs: undefined });
    const pools = collectDormantCandidates(bare);
    expect(pools.npc).toEqual([]);
    expect(pools.secret).toEqual([]);
    expect(pools.plot).toEqual([]);
    expect(pools.scene).toEqual([]);
  });

  it('gives every piece a kind, an id, a label and a non-empty reason', () => {
    const pools = collectDormantCandidates(WORLD);
    const all = [...pools.npc, ...pools.secret, ...pools.plot, ...pools.scene];
    expect(all.length).toBeGreaterThan(0);
    for (const piece of all) {
      expect(DORMANT_KIND_ORDER).toContain(piece.kind);
      expect(piece.id).toBeTruthy();
      expect(piece.label).toBeTruthy();
      expect(piece.reason.length).toBeGreaterThan(0);
    }
  });
});

// --- 2. offstage NPCs -----------------------------------------------------

describe('an offstage NPC is one the table has met and not seen lately', () => {
  it('ranks the longest-offstage first and carries P1 last-seen wording', () => {
    const pool = collectDormantCandidates(WORLD).npc;
    expect(ids(pool)).toEqual(['npc-serah', 'npc-brannock']);
    expect(pool[0]).toMatchObject({ kind: 'npc', label: 'Serah', reason: 'Last seen 2 sessions ago' });
    expect(pool[1]).toMatchObject({ kind: 'npc', label: 'Brannock', reason: 'Last seen 1 session ago' });
  });

  it('leaves out an NPC who was on stage in the most recent played session', () => {
    expect(ids(collectDormantCandidates(WORLD).npc)).not.toContain('npc-torvald');
  });

  it('leaves out an NPC the table has never met — a name is not a callback', () => {
    expect(ids(collectDormantCandidates(WORLD).npc)).not.toContain('npc-ivet');
  });

  it('leaves out anyone standing in the scene that is live right now', () => {
    // scene-live has never been played, so Serah is still "2 sessions ago" —
    // but she is in the room, which is the opposite of offstage.
    const pool = collectDormantCandidates(WORLD, 'scene-live').npc;
    expect(ids(pool)).toEqual(['npc-brannock']);
  });

  it('ignores a live-scene id that resolves to nothing', () => {
    expect(ids(collectDormantCandidates(WORLD, 'scene-that-was-deleted').npc)).toEqual(['npc-serah', 'npc-brannock']);
  });

  it('has nothing to offer in a campaign that has never been played', () => {
    const unplayed = makeCampaign({ npcs: [{ id: 'n1', name: 'Anyone' }] });
    expect(collectDormantCandidates(unplayed).npc).toEqual([]);
  });
});

// --- 3. unrevealed secrets ------------------------------------------------

describe('an unrevealed secret qualifies when it points at something present', () => {
  it('keeps P1 loaded-gun order: primed by tonight, then by last session, then by title', () => {
    const pool = collectDormantCandidates(WORLD).secret;
    expect(ids(pool)).toEqual(['sec-debt', 'sec-key', 'sec-oath']);
    expect(pool[0].kind).toBe('secret');
    expect(pool[0].label).toBe('The Brannock Debt');
  });

  it('never re-spends a secret the players have already been told', () => {
    expect(ids(collectDormantCandidates(WORLD).secret)).not.toContain('sec-spent');
  });

  it('leaves out a secret linked to nothing, and one linked to nobody present', () => {
    const pool = ids(collectDormantCandidates(WORLD).secret);
    expect(pool).not.toContain('sec-loose');
    expect(pool).not.toContain('sec-far');
  });

  it('distinguishes a secret primed by tonight from one primed by last session', () => {
    const pool = collectDormantCandidates(WORLD).secret;
    expect(pool[0].reason).not.toBe(pool[1].reason);
    for (const piece of pool) expect(piece.reason.toLowerCase()).toContain('unrevealed');
  });
});

// --- 4. stalled and dormant threads --------------------------------------

describe('a thread qualifies when it has stopped moving', () => {
  it('lists stale active threads stalest-first, then dormant ones by title', () => {
    const pool = collectDormantCandidates(WORLD).plot;
    expect(ids(pool)).toEqual(['plot-hollow', 'plot-ember', 'plot-quiet']);
    expect(pool[0]).toMatchObject({ kind: 'plot', label: 'The Hollow Crown', reason: "Hasn't moved yet" });
    expect(pool[1]).toMatchObject({ label: 'The Ember Pact', reason: "Hasn't moved in 2 sessions" });
    expect(pool[2].label).toBe('The Quiet War');
    expect(pool[2].reason.length).toBeGreaterThan(0);
  });

  it('leaves out a thread the most recent played session advanced', () => {
    expect(ids(collectDormantCandidates(WORLD).plot)).not.toContain('plot-salt');
  });

  it('leaves out a resolved thread', () => {
    expect(ids(collectDormantCandidates(WORLD).plot)).not.toContain('plot-siege');
  });

  it('offers a dormant thread even in a campaign nobody has played yet', () => {
    const unplayed = makeCampaign({
      plots: [
        { id: 'p-active', title: 'Fresh', description: '', status: 'active', relatedEntityIds: [] },
        { id: 'p-dormant', title: 'Shelved', description: '', status: 'dormant', relatedEntityIds: [] },
      ],
    });
    expect(ids(collectDormantCandidates(unplayed).plot)).toEqual(['p-dormant']);
  });
});

// --- 5. unused planned scenes --------------------------------------------

describe('a scene qualifies when it was prepped and never run', () => {
  it('lists unrun planned scenes in campaign order and names their adventure', () => {
    const pool = collectDormantCandidates(WORLD).scene;
    expect(ids(pool)).toEqual(['scene-2', 'scene-live']);
    expect(pool[0]).toMatchObject({ kind: 'scene', label: 'The Drowned Stair' });
    expect(pool[0].reason).toContain('Salt & Ruin');
    expect(pool[1].reason).toContain('The Quiet War');
  });

  it('leaves out a scene a played session already put on stage', () => {
    expect(ids(collectDormantCandidates(WORLD).scene)).not.toContain('scene-1');
  });

  it('leaves out a scene that is no longer planned', () => {
    expect(ids(collectDormantCandidates(WORLD).scene)).not.toContain('scene-3');
  });

  it('leaves out the scene running right now', () => {
    expect(ids(collectDormantCandidates(WORLD, 'scene-live').scene)).toEqual(['scene-2']);
  });
});

// --- 6. the sample --------------------------------------------------------

describe('sampleDormantMaterial — 2 to 3 pieces, at most one per kind', () => {
  it('defaults to three pieces of three different kinds', () => {
    const picked = sampleDormantMaterial({ campaign: WORLD, random: () => 0 });
    expect(picked).toHaveLength(3);
    expect(new Set(kinds(picked)).size).toBe(3);
    expect(new Set(ids(picked)).size).toBe(3);
  });

  it('takes the first three kinds and the top of each bucket when every draw is zero', () => {
    const picked = sampleDormantMaterial({ campaign: WORLD, random: () => 0 });
    expect(kinds(picked)).toEqual(['npc', 'secret', 'plot']);
    expect(ids(picked)).toEqual(['npc-serah', 'sec-debt', 'plot-hollow']);
  });

  it('starts the kind rotation where the first draw points, and still reads in kind order', () => {
    // draw 1 = 0.5 over four available kinds → start at 'plot', wrapping to
    // 'scene' and 'npc'; the sample is then reported in the fixed kind order.
    const picked = sampleDormantMaterial({ campaign: WORLD, random: seq([0.5, 0, 0, 0]) });
    expect(kinds(picked)).toEqual(['npc', 'plot', 'scene']);
    expect(ids(picked)).toEqual(['npc-serah', 'plot-hollow', 'scene-2']);
  });

  it('spends one draw per chosen kind, in kind order', () => {
    // draw 1 = 0 → kinds npc, secret, plot.
    // draw 2 = 0.9 over a two-deep NPC bucket → Brannock.
    // draw 3 = 0.5 over a three-deep secret bucket → The Ashen Key.
    // draw 4 = 0   → The Hollow Crown.
    const picked = sampleDormantMaterial({ campaign: WORLD, random: seq([0, 0.9, 0.5, 0]) });
    expect(ids(picked)).toEqual(['npc-brannock', 'sec-key', 'plot-hollow']);
  });

  it('is deterministic — the same campaign and the same draws give the same sample', () => {
    const a = sampleDormantMaterial({ campaign: WORLD, random: seq([0.3, 0.7, 0.2, 0.9]) });
    const b = sampleDormantMaterial({ campaign: WORLD, random: seq([0.3, 0.7, 0.2, 0.9]) });
    expect(b).toEqual(a);
  });

  it('never reaches deeper than the top of a bucket, however lucky the draw', () => {
    const many = makeCampaign({
      npcs: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(n => ({ id: `npc-${n}`, name: n })),
      sessionLogs: [
        session({ id: 'x1', sessionDate: '2026-01-01', structuredNotes: [note('n', ['npc-A', 'npc-B', 'npc-C', 'npc-D', 'npc-E', 'npc-F', 'npc-G', 'npc-H'])] }),
        session({ id: 'x2', sessionDate: '2026-02-01' }),
      ],
    });
    expect(collectDormantCandidates(many).npc).toHaveLength(8);
    // Only the NPC bucket has anything, so draw 1 chooses it and draw 2 picks
    // within the top DORMANT_POOL_DEPTH entries — never the ninth-stalest.
    const picked = sampleDormantMaterial({ campaign: many, random: seq([0, 0.99]) });
    expect(picked).toHaveLength(1);
    expect(picked[0].label).toBe('E');
    expect(DORMANT_POOL_DEPTH).toBe(5);
  });

  it('raises a request for fewer than two and lowers a request for more than three', () => {
    expect(sampleDormantMaterial({ campaign: WORLD, count: 1, random: () => 0 })).toHaveLength(MIN_DORMANT_SAMPLE);
    expect(sampleDormantMaterial({ campaign: WORLD, count: 0, random: () => 0 })).toHaveLength(MIN_DORMANT_SAMPLE);
    expect(sampleDormantMaterial({ campaign: WORLD, count: 7, random: () => 0 })).toHaveLength(MAX_DORMANT_SAMPLE);
    expect(MIN_DORMANT_SAMPLE).toBe(2);
    expect(MAX_DORMANT_SAMPLE).toBe(3);
  });

  it('returns fewer only because fewer kinds have anything to offer', () => {
    const twoKinds = makeCampaign({
      npcs: [{ id: 'npc-a', name: 'Aldis' }],
      sessionLogs: [
        session({ id: 'y1', sessionDate: '2026-01-01', structuredNotes: [note('n', ['npc-a'])] }),
        session({ id: 'y2', sessionDate: '2026-02-01' }),
      ],
      plots: [{ id: 'p-d', title: 'Shelved', description: '', status: 'dormant', relatedEntityIds: [] }],
    });
    const picked = sampleDormantMaterial({ campaign: twoKinds, random: () => 0 });
    expect(kinds(picked)).toEqual(['npc', 'plot']);
  });

  it('returns a single piece when only one kind has anything', () => {
    const oneKind = makeCampaign({
      plots: [{ id: 'p-d', title: 'Shelved', description: '', status: 'dormant', relatedEntityIds: [] }],
    });
    expect(kinds(sampleDormantMaterial({ campaign: oneKind, random: () => 0 }))).toEqual(['plot']);
  });

  it('returns nothing rather than inventing material for an empty campaign', () => {
    expect(sampleDormantMaterial({ campaign: EMPTY, random: () => 0 })).toEqual([]);
    expect(sampleDormantMaterial({ campaign: EMPTY })).toEqual([]);
  });

  it('returns nothing for a campaign whose only material is already spent', () => {
    const spent = makeCampaign({
      npcs: [{ id: 'npc-a', name: 'Aldis' }],
      sessionLogs: [session({ id: 'z1', sessionDate: '2026-01-01', structuredNotes: [note('n', ['npc-a'])] })],
      plots: [{ id: 'p-r', title: 'Done', description: '', status: 'resolved', relatedEntityIds: [] }],
      secrets: [secret({ id: 's-r', title: 'Told', isRevealed: true, linkedEntityIds: ['npc-a'] })],
    });
    expect(sampleDormantMaterial({ campaign: spent, random: () => 0 })).toEqual([]);
  });

  it('still produces real pieces when the random source misbehaves', () => {
    for (const bad of [() => 1, () => 1.5, () => -0.5, () => NaN]) {
      const picked = sampleDormantMaterial({ campaign: WORLD, random: bad });
      expect(picked.length).toBeGreaterThanOrEqual(2);
      for (const piece of picked) {
        expect(piece).toBeDefined();
        expect(piece.id).toBeTruthy();
        expect(piece.label).toBeTruthy();
      }
      expect(new Set(kinds(picked)).size).toBe(picked.length);
    }
  });

  it('falls back to Math.random when no source is injected', () => {
    const picked = sampleDormantMaterial({ campaign: WORLD });
    expect(picked).toHaveLength(3);
    expect(new Set(kinds(picked)).size).toBe(3);
  });

  it('honours the live scene when sampling, not just when collecting', () => {
    // Serah is in the live scene, so the NPC bucket can only offer Brannock.
    const picked = sampleDormantMaterial({ campaign: WORLD, activeSceneId: 'scene-live', random: () => 0 });
    const npcPiece = picked.find(p => p.kind === 'npc');
    expect(npcPiece?.id).toBe('npc-brannock');
    expect(ids(picked)).not.toContain('scene-live');
  });
});

// --- 7. purity ------------------------------------------------------------

describe('reading the campaign never changes it', () => {
  it('leaves the campaign byte-identical after collecting and sampling', () => {
    const before = JSON.stringify(WORLD);
    collectDormantCandidates(WORLD, 'scene-live');
    sampleDormantMaterial({ campaign: WORLD, random: seq([0.4, 0.4, 0.4, 0.4]) });
    expect(JSON.stringify(WORLD)).toBe(before);
  });
});
