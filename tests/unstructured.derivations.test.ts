/**
 * SPEC — utils/storyDerivations.ts additions and utils/plotClock.ts
 * (docs/design/unstructured-play.md)
 *
 *  - resolveSceneById finds a scene in ANY adventure, with its owner.
 *  - deriveSceneShelf lists every runnable scene not already in tonight's list.
 *  - The PC spotlight is read off running-log TEXT (and tags), quietest first;
 *    it never over-counts a name inside a longer word and never counts a
 *    name shorter than three letters.
 *  - Plot clocks are normalised and clamped identically everywhere.
 *  - The dormant sampler treats the Stage's cast as present, not offstage.
 */

import { describe, it, expect } from 'vitest';
import type { Campaign, SessionLog, PlayerCharacter } from '../types/index';
import {
  resolveSceneById,
  deriveSceneShelf,
  textNamesCharacter,
  countPcSpotlightInSession,
  derivePcSpotlight,
  formatSpotlightLabel,
} from '../utils/storyDerivations';
import { normalizePlotClock, isPlotClockExpired, formatPlotClock } from '../utils/plotClock';
import { collectDormantCandidates } from '../utils/dormantMaterial';
import { createDefaultPlayerCharacter, createDefaultScene } from '../utils/entityUtils';

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

function pc(id: string, characterName: string, playerName = 'Someone'): PlayerCharacter {
  const base = createDefaultPlayerCharacter();
  return { ...base, id, playerName, characterSocial: { ...base.characterSocial, characterName } };
}

function note(id: string, content: string, taggedEntityIds: string[] = []) {
  return { id, timestamp: '2026-01-01T20:00:00.000Z', content, taggedEntityIds };
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

const sceneA1 = { ...createDefaultScene(), id: 's-a1', title: 'Arrival', status: 'planned' as const };
const sceneA2 = { ...createDefaultScene(), id: 's-a2', title: 'The Bell', status: 'completed' as const };
const sceneB1 = { ...createDefaultScene(), id: 's-b1', title: 'Ambush', status: 'in-progress' as const };
const withAdventures = makeCampaign({
  adventures: [
    { id: 'adv-a', title: 'Tides of Ash', level: 3, hook: '', theme: '', scenes: [sceneA1, sceneA2] },
    { id: 'adv-b', title: 'Side Roads', level: 3, hook: '', theme: '', scenes: [sceneB1] },
  ],
});

describe('resolveSceneById', () => {
  it('finds a scene in any adventure and names its owner', () => {
    expect(resolveSceneById(withAdventures, 's-b1')?.adventure.title).toBe('Side Roads');
    expect(resolveSceneById(withAdventures, 's-a2')?.scene.title).toBe('The Bell');
  });
  it('returns null for blank or unknown ids', () => {
    expect(resolveSceneById(withAdventures, undefined)).toBeNull();
    expect(resolveSceneById(withAdventures, null)).toBeNull();
    expect(resolveSceneById(withAdventures, 'nope')).toBeNull();
  });
});

describe('deriveSceneShelf', () => {
  it('lists runnable scenes from every adventure that are not already in tonight\'s list, skipping completed ones', () => {
    const shelf = deriveSceneShelf(withAdventures, { plannedSceneIds: ['s-a1'] });
    expect(shelf.map(s => s.scene.id)).toEqual(['s-b1']);
    expect(shelf[0].adventureTitle).toBe('Side Roads');
  });
  it('treats a missing session as an empty list', () => {
    expect(deriveSceneShelf(withAdventures, null).map(s => s.scene.id)).toEqual(['s-a1', 's-b1']);
  });
});

describe('textNamesCharacter', () => {
  it('matches the full name and a first name of three or more letters, case-insensitively, on word boundaries', () => {
    expect(textNamesCharacter('torvald swings first', 'Torvald Ironfist')).toBe(true);
    expect(textNamesCharacter('TORVALD IRONFIST falls', 'Torvald Ironfist')).toBe(true);
    expect(textNamesCharacter('The Torvaldians riot', 'Torvald Ironfist')).toBe(false);
    expect(textNamesCharacter('Ironfist alone', 'Torvald Ironfist')).toBe(false);
  });
  it('never matches a name shorter than three letters', () => {
    expect(textNamesCharacter('Bo ran', 'Bo')).toBe(false);
    expect(textNamesCharacter('Bo Wren ran', 'Bo Wren')).toBe(true);
  });
  it('handles accented names on Unicode boundaries', () => {
    expect(textNamesCharacter('Annë laughed', 'Annë')).toBe(true);
    expect(textNamesCharacter('Annëlise laughed', 'Annë')).toBe(false);
  });
});

describe('countPcSpotlightInSession', () => {
  it('counts notes naming or tagging each character, and gives every character a key', () => {
    const campaign = makeCampaign({ playerCharacters: [pc('pc-1', 'Torvald Ironfist'), pc('pc-2', 'Mira')] });
    const s = session({
      id: 's1',
      structuredNotes: [
        note('n1', 'Torvald kicks the door in.'),
        note('n2', 'Somebody tags her', ['pc-2']),
        note('n3', 'Mira and Torvald argue about the plan.'),
        note('n4', 'A quiet moment for nobody.'),
      ],
    });
    const counts = countPcSpotlightInSession(campaign, s);
    expect(counts.get('pc-1')).toBe(2);
    expect(counts.get('pc-2')).toBe(2);
  });
  it('returns zeros for a session with no notes', () => {
    const campaign = makeCampaign({ playerCharacters: [pc('pc-1', 'Torvald Ironfist')] });
    expect(countPcSpotlightInSession(campaign, session({ id: 's1' })).get('pc-1')).toBe(0);
  });
});

describe('derivePcSpotlight', () => {
  const campaign = makeCampaign({
    playerCharacters: [pc('pc-1', 'Torvald Ironfist', 'Dana'), pc('pc-2', 'Mira', 'Lee'), pc('pc-3', 'Quill', 'Sam')],
    sessionLogs: [
      session({ id: 's1', sessionDate: '2026-01-01', structuredNotes: [note('a', 'Torvald and Mira argue.')] }),
      session({ id: 's2', sessionDate: '2026-01-08', structuredNotes: [note('b', 'Mira steals the ledger.')] }),
      session({ id: 's3', sessionDate: '2026-01-15', status: 'active', structuredNotes: [note('c', 'Nothing named here.')] }),
    ],
  });

  it('ranks the never-named character first, then the longest-quiet, and labels each in sessions', () => {
    const rows = derivePcSpotlight(campaign);
    expect(rows.map(r => r.pcName)).toEqual(['Quill', 'Torvald Ironfist', 'Mira']);
    expect(rows[0].sessionsSinceSpotlight).toBeNull();
    expect(formatSpotlightLabel(rows[0])).toBe("Hasn't had a moment yet");
    expect(rows[1].sessionsSinceSpotlight).toBe(2);
    expect(formatSpotlightLabel(rows[1])).toBe('Quiet for 2 sessions');
    expect(rows[2].sessionsSinceSpotlight).toBe(1);
    expect(formatSpotlightLabel(rows[2])).toBe('Quiet for 1 session');
    expect(rows[1].playerName).toBe('Dana');
  });

  it('is empty for a campaign with no player characters', () => {
    expect(derivePcSpotlight(makeCampaign())).toEqual([]);
  });

  it('reads "last session" for a character named in the most recent played session', () => {
    const c = makeCampaign({
      playerCharacters: [pc('pc-1', 'Mira')],
      sessionLogs: [session({ id: 's1', structuredNotes: [note('a', 'Mira wins.')] })],
    });
    expect(formatSpotlightLabel(derivePcSpotlight(c)[0])).toBe('In the spotlight last session');
  });
});

describe('plotClock helpers', () => {
  it('normalises, clamps and formats', () => {
    expect(normalizePlotClock({ segments: 6, filled: 9 })).toEqual({ segments: 6, filled: 6 });
    expect(normalizePlotClock({ segments: 6, filled: -2 })).toEqual({ segments: 6, filled: 0 });
    expect(normalizePlotClock({ segments: 4.7, filled: 2.2 })).toEqual({ segments: 4, filled: 2 });
    expect(normalizePlotClock({ segments: 0, filled: 0 })).toBeNull();
    expect(normalizePlotClock({ segments: Number.NaN, filled: 0 })).toBeNull();
    expect(normalizePlotClock(undefined)).toBeNull();
    expect(formatPlotClock({ segments: 8, filled: 3 })).toBe('3/8');
    expect(formatPlotClock(null)).toBe('');
  });
  it('reports expiry only when every segment is filled', () => {
    expect(isPlotClockExpired({ segments: 4, filled: 4 })).toBe(true);
    expect(isPlotClockExpired({ segments: 4, filled: 3 })).toBe(false);
    expect(isPlotClockExpired(undefined)).toBe(false);
  });
});

describe('dormant sampler — the Stage cast is present, not offstage', () => {
  it('excludes presentNpcIds from the offstage bucket', () => {
    const campaign = makeCampaign({
      npcs: [
        { id: 'npc-1', name: 'Serah', description: '', traits: '', backstory: '', motivations: '', secrets: '', stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [] },
        { id: 'npc-2', name: 'Gundren', description: '', traits: '', backstory: '', motivations: '', secrets: '', stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [] },
      ],
      sessionLogs: [
        session({ id: 's1', sessionDate: '2026-01-01', plannedNpcIds: ['npc-1', 'npc-2'] }),
        session({ id: 's2', sessionDate: '2026-01-08', plannedNpcIds: [] }),
      ],
    });
    const without = collectDormantCandidates(campaign, null);
    expect(without.npc.map(p => p.id).sort()).toEqual(['npc-1', 'npc-2']);
    const withStage = collectDormantCandidates(campaign, null, ['npc-1']);
    expect(withStage.npc.map(p => p.id)).toEqual(['npc-2']);
  });
});
