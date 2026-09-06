/**
 * SPEC — the Stage and plot clocks in services/contextBuilder.ts and
 * services/continuityChecker.ts (docs/design/unstructured-play.md)
 *
 * The AI that helps at the table must know what the table knows: with no
 * prepped scene active, a freeform session's Stage is the only "where/who"
 * there is. And a plot's pressure — its clock and its move when ignored — is
 * exactly what an improvising GM wants the model to have in hand.
 *
 *  - 'coach' / 'generation' contexts carry an "On Stage Now" section (place,
 *    present cast, what's happening), the Stage's cast joins the
 *    "NPCs in Scene" list, and the Stage's ids count as scene-relevant for
 *    the GM-ONLY secrets section.
 *  - 'player-safe' keeps the place and the names but never the DM's
 *    "Happening" line, which can carry GM truth.
 *  - Active plot lines carry `[clock n/m]` and `— if ignored: …`, never in
 *    the player-safe variant (which has no plot section at all).
 *  - The continuity checker emits an `info` `clock-expired` issue for an
 *    active plot whose clock is full, and nothing for a partial or absent clock.
 */

import { describe, it, expect } from 'vitest';
import type { Campaign, SessionLog } from '../types/index';
import { buildCampaignContext } from '../services/contextBuilder';
import { checkContinuity } from '../services/continuityChecker';

function session(over: Partial<SessionLog> & { id: string }): SessionLog {
  return {
    title: `Session ${over.id}`,
    status: 'active',
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

function npc(id: string, name: string) {
  return { id, name, description: '', traits: 'watchful', backstory: '', motivations: '', secrets: '', stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [] };
}

function makeCampaign(over: Partial<Campaign> = {}): Campaign {
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
  } as Campaign;
}

const stagedCampaign = makeCampaign({
  npcs: [npc('npc-1', 'Serah Vane'), npc('npc-2', 'Gundren Mott')],
  locations: [{ id: 'loc-1', name: 'The Gull and Gallows', description: 'A crooked tavern on stilts.', secrets: '', subLocationIds: [], history: [] }],
  secrets: [
    { id: 'sec-1', title: 'Serah is the harbourmaster\'s daughter', content: 'She ran away at fourteen.', category: 'secret', isRevealed: false, linkedEntityIds: ['npc-1'], createdAt: '2026-01-01' },
    { id: 'sec-2', title: 'The chapel bell is bronze from a sunken ship', content: '', category: 'clue', isRevealed: false, linkedEntityIds: ['loc-9'], createdAt: '2026-01-01' },
  ],
  sessionLogs: [
    session({
      id: 'live',
      stage: { locationId: 'loc-1', npcIds: ['npc-1'], focus: 'Serah quietly warns them the tide cult is listening' },
    }),
  ],
  activeSessionId: 'live',
});

describe('contextBuilder — On Stage Now', () => {
  it('coach context carries the place, the present cast, and what is happening, with no scene active', () => {
    const ctx = buildCampaignContext({ variant: 'coach', campaign: stagedCampaign, activeSessionId: 'live' });
    expect(ctx).toContain('On Stage Now:');
    expect(ctx).toContain('Place: The Gull and Gallows');
    expect(ctx).toContain('Present: Serah Vane');
    expect(ctx).toContain('Happening: Serah quietly warns them the tide cult is listening');
    expect(ctx).toContain('NPCs in Scene:');
    expect(ctx).toMatch(/NPCs in Scene:\n  - Serah Vane/);
  });

  it('the Stage cast counts as scene-relevant for the GM-ONLY secrets section', () => {
    const ctx = buildCampaignContext({ variant: 'coach', campaign: stagedCampaign, activeSessionId: 'live' });
    expect(ctx).toContain('GM-ONLY — UNREVEALED SECRETS');
    expect(ctx).toContain("Serah is the harbourmaster's daughter");
    expect(ctx).not.toContain('The chapel bell is bronze');
  });

  it('player-safe keeps the place and the names but never the DM\'s Happening line', () => {
    const ctx = buildCampaignContext({ variant: 'player-safe', campaign: stagedCampaign, activeSessionId: 'live' });
    expect(ctx).toContain('Place: The Gull and Gallows');
    expect(ctx).toContain('Present: Serah Vane');
    expect(ctx).not.toContain('Happening:');
    expect(ctx).not.toContain('tide cult is listening');
    expect(ctx).not.toContain('GM-ONLY');
  });

  it('a freeform place with no linked location is reported as typed', () => {
    const campaign = makeCampaign({
      sessionLogs: [session({ id: 'live', stage: { place: 'a nameless roadside shrine', npcIds: [] } })],
      activeSessionId: 'live',
    });
    const ctx = buildCampaignContext({ variant: 'generation', campaign, activeSessionId: 'live' });
    expect(ctx).toContain('Place: a nameless roadside shrine');
  });

  it('an empty Stage adds no section at all', () => {
    const campaign = makeCampaign({
      sessionLogs: [session({ id: 'live', stage: { npcIds: [] } })],
      activeSessionId: 'live',
    });
    const ctx = buildCampaignContext({ variant: 'coach', campaign, activeSessionId: 'live' });
    expect(ctx).not.toContain('On Stage Now');
    expect(ctx).not.toContain('NPCs in Scene');
  });

  it('with a scene active, the Stage cast joins the scene cast without duplicates and the Stage place wins', () => {
    const campaign = makeCampaign({
      npcs: [npc('npc-1', 'Serah Vane'), npc('npc-2', 'Gundren Mott')],
      locations: [
        { id: 'loc-1', name: 'The Gull and Gallows', description: 'Tavern.', secrets: '', subLocationIds: [], history: [] },
        { id: 'loc-2', name: 'The Causeway', description: 'A drowned road.', secrets: '', subLocationIds: [], history: [] },
      ],
      adventures: [{
        id: 'adv-1', title: 'Tides', level: 1, hook: '', theme: '',
        scenes: [{ id: 'sc-1', title: 'Ambush', type: 'combat', status: 'in-progress', readAloudText: '', gmNotes: '', skillChecks: [], rewards: '', locationId: 'loc-2', npcIds: ['npc-2', 'npc-1'] }],
      }],
      sessionLogs: [session({ id: 'live', stage: { locationId: 'loc-1', npcIds: ['npc-1'] } })],
      activeSessionId: 'live',
      activeSceneId: 'sc-1',
    });
    const ctx = buildCampaignContext({ variant: 'coach', campaign, activeSessionId: 'live', activeSceneId: 'sc-1' });
    // Exactly one "NPCs in Scene" line for Serah even though she is in both casts.
    expect((ctx.match(/^  - Serah Vane/gm) ?? []).length).toBe(1);
    expect(ctx).toContain('Present: Serah Vane');
    expect(ctx).toMatch(/NPCs in Scene:\n  - Gundren Mott[^\n]*\n  - Serah Vane/);
    expect(ctx).toContain('Place: The Gull and Gallows');
    expect(ctx).not.toContain('Scene Location: The Causeway');
  });
});

describe('contextBuilder — player appetites (Table Pulse)', () => {
  it('folds playerFlags into the Player Characters roster line, and leaves a flag-less character bare', () => {
    const campaign = makeCampaign({
      playerCharacters: [
        { id: 'pc-1', playerName: 'Dana', playerFlags: ['tactical combat', ' romance plots '], characterSocial: { characterName: 'Torvald' } },
        { id: 'pc-2', playerName: 'Lee', characterSocial: { characterName: 'Mira' } },
      ] as unknown as Campaign['playerCharacters'],
    });
    const ctx = buildCampaignContext({ variant: 'generation', campaign });
    expect(ctx).toContain('Player Characters: Torvald (player wants more of: tactical combat; romance plots), Mira');
  });
});

describe('contextBuilder — plot pressure', () => {
  const pressured = makeCampaign({
    plots: [
      { id: 'p-1', title: 'The Tide Cult', description: 'They want the bell.', status: 'active', relatedEntityIds: [], clock: { segments: 6, filled: 6 }, ifIgnored: 'The chapel floods for good and the bell is lost.' },
      { id: 'p-2', title: 'Quiet Debt', description: '', status: 'active', relatedEntityIds: [] },
    ],
  });

  it('GM variants carry the clock reading and the if-ignored move', () => {
    const ctx = buildCampaignContext({ variant: 'generation', campaign: pressured });
    expect(ctx).toContain('The Tide Cult [active] [clock 6/6 — run out]: They want the bell. — if ignored: The chapel floods for good and the bell is lost.');
    expect(ctx).toContain('  - Quiet Debt [active]');
    expect(ctx).not.toContain('Quiet Debt [active] [clock');
  });

  it('player-safe carries neither (no plot section at all)', () => {
    const ctx = buildCampaignContext({ variant: 'player-safe', campaign: pressured });
    expect(ctx).not.toContain('if ignored');
    expect(ctx).not.toContain('Active Plot Threads');
  });
});

describe('continuityChecker — clock-expired', () => {
  it('flags an active plot whose clock is full, as info, naming the move when there is one', () => {
    const campaign = makeCampaign({
      plots: [
        { id: 'p-1', title: 'The Tide Cult', description: '', status: 'active', relatedEntityIds: [], clock: { segments: 4, filled: 4 }, ifIgnored: 'The chapel floods.' },
        { id: 'p-2', title: 'Slow Burn', description: '', status: 'active', relatedEntityIds: [], clock: { segments: 4, filled: 2 } },
        { id: 'p-3', title: 'Done Deal', description: '', status: 'resolved', relatedEntityIds: [], clock: { segments: 4, filled: 4 } },
        { id: 'p-4', title: 'No Clock', description: '', status: 'active', relatedEntityIds: [] },
      ],
    });
    const issues = checkContinuity(campaign).filter(i => i.ruleId === 'clock-expired');
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('info');
    expect(issues[0].entityIds).toEqual(['p-1']);
    expect(issues[0].entityTypes).toEqual(['plot']);
    expect(issues[0].description).toContain('Its move is due: The chapel floods.');
  });

  it('phrases the nudge without a move when none was written', () => {
    const campaign = makeCampaign({
      plots: [{ id: 'p-1', title: 'The Tide Cult', description: '', status: 'active', relatedEntityIds: [], clock: { segments: 4, filled: 4 } }],
    });
    const [issue] = checkContinuity(campaign).filter(i => i.ruleId === 'clock-expired');
    expect(issue.description).toContain('still active');
    expect(issue.suggestedFix).toContain('if ignored');
  });

  it('a malformed clock never fires', () => {
    const campaign = makeCampaign({
      plots: [{ id: 'p-1', title: 'Broken', description: '', status: 'active', relatedEntityIds: [], clock: { segments: 0, filled: 3 } }],
    });
    expect(checkContinuity(campaign).filter(i => i.ruleId === 'clock-expired')).toHaveLength(0);
  });
});
