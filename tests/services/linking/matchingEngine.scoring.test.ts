import { describe, it, expect } from 'vitest';
import {
  TextMatchingEngine,
  scoreMatch,
  expandAmbiguousMatch,
} from '../../../services/linking/matchingEngine';
import type { EntityCandidate } from '../../../services/linking/matchingEngine';
import { autoLinkScenes, autoLinkNpcFactions } from '../../../services/linking/autoLinker';
import { findUnlinkedEntities } from '../../../components/common/SceneSmartLinkBar';

describe('scoreMatch — confidence scoring (roadmap L7)', () => {
  it('scores an exact-case full-name match of a distinctive name at 1.0', () => {
    expect(scoreMatch('Kalli Alran', 'Kalli Alran', false, 1)).toBe(1);
  });

  it('ranks exact-case > case-insensitive > alias', () => {
    const exact = scoreMatch('Kalli Alran', 'Kalli Alran', false, 1);
    const caseless = scoreMatch('KALLI ALRAN', 'Kalli Alran', false, 1);
    const alias = scoreMatch('The Red Hand', 'The Red Hand', true, 1);
    expect(exact).toBeGreaterThan(caseless);
    expect(caseless).toBeGreaterThan(alias);
    expect(caseless).toBe(0.9);
  });

  it('penalises a capitalised single-word name seen all-lowercase more than other case mismatches', () => {
    const shouting = scoreMatch('SALVATION', 'Salvation', false, 1);
    const lower = scoreMatch('salvation', 'Salvation', false, 1);
    expect(lower).toBeLessThan(shouting);
  });

  it('penalises very short names', () => {
    expect(scoreMatch('Mira', 'Mira', false, 1)).toBeLessThan(scoreMatch('Miralda', 'Miralda', false, 1));
  });

  it('penalises common English words', () => {
    expect(scoreMatch('Dawn', 'Dawn', false, 1)).toBeLessThan(0.7);
    expect(scoreMatch('dawn', 'Dawn', false, 1)).toBeLessThan(0.5);
  });

  it('scores ambiguous names below the autoLinker threshold but above the suggestion threshold', () => {
    const s = scoreMatch('Marcus Vell', 'Marcus Vell', false, 2);
    expect(s).toBeLessThan(0.9);
    expect(s).toBeGreaterThanOrEqual(0.5);
  });

  it('always stays within [0.05, 1]', () => {
    const s = scoreMatch('the', 'The', true, 5);
    expect(s).toBeGreaterThanOrEqual(0.05);
    expect(s).toBeLessThanOrEqual(1);
  });
});

describe('TextMatchingEngine — real confidence on matches', () => {
  const engine = new TextMatchingEngine();

  it('reports lower confidence for case-insensitive matches than exact ones', () => {
    const c: EntityCandidate[] = [{ id: 'l', name: 'Salvation', type: 'location' }];
    const [exact] = engine.findMatches('Welcome to Salvation.', c);
    const [lower] = engine.findMatches('seeking salvation.', c);
    expect(exact.confidence).toBe(1);
    expect(lower.confidence).toBeLessThan(exact.confidence);
  });

  it('matches aliases, reports the canonical name, and scores them below full names', () => {
    const c: EntityCandidate[] = [
      { id: 'f', name: 'The Emerald Claw', type: 'faction', aliases: ['Claw Cultists'] },
    ];
    const text = 'The Claw Cultists struck at dawn.';
    const matches = engine.findMatches(text, c);
    expect(matches).toHaveLength(1);
    expect(matches[0].entityId).toBe('f');
    expect(matches[0].entityName).toBe('The Emerald Claw');
    expect(text.slice(...matches[0].matchSpan)).toBe('Claw Cultists');
    expect(matches[0].candidates?.[0].viaAlias).toBe(true);
    expect(matches[0].confidence).toBeLessThan(1);
  });

  it('ignores aliases shorter than the minimum length', () => {
    const c: EntityCandidate[] = [{ id: 'n', name: 'Kalli Alran', type: 'npc', aliases: ['KA'] }];
    expect(engine.findMatches('KA was here', c)).toHaveLength(0);
  });

  it('keeps the longest-match-first rule across names and aliases', () => {
    const c: EntityCandidate[] = [
      { id: 'short', name: 'Kalli', type: 'npc' },
      { id: 'long', name: 'Someone', type: 'npc', aliases: ['Kalli Alran'] },
    ];
    const matches = engine.findMatches('Kalli Alran speaks.', c);
    expect(matches.map(m => m.entityId)).toEqual(['long']);
  });
});

describe('TextMatchingEngine — ambiguity', () => {
  const engine = new TextMatchingEngine();

  it('returns every entity sharing a name instead of silently picking by array order', () => {
    const c: EntityCandidate[] = [
      { id: 'm1', name: 'Marcus Vell', type: 'npc' },
      { id: 'm2', name: 'marcus vell', type: 'npc' },
    ];
    const matches = engine.findMatches('Marcus Vell waits.', c);
    expect(matches).toHaveLength(1);
    const [m] = matches;
    expect(m.ambiguous).toBe(true);
    expect(m.candidates?.map(x => x.entityId)).toEqual(['m1', 'm2']);
    // Backward compatible: primary is still the first candidate.
    expect(m.entityId).toBe('m1');
    expect(m.confidence).toBeLessThan(0.9);
  });

  it('reports cross-type collisions with each candidate type', () => {
    const c: EntityCandidate[] = [
      { id: 'n', name: 'Raven', type: 'npc' },
      { id: 'f', name: 'Raven', type: 'faction' },
    ];
    const [m] = engine.findMatches('Raven watches.', c);
    expect(m.ambiguous).toBe(true);
    expect(m.candidates?.map(x => `${x.entityType}:${x.entityId}`)).toEqual(['npc:n', 'faction:f']);
  });

  it('lists canonical-name owners before alias owners', () => {
    const c: EntityCandidate[] = [
      { id: 'alias-owner', name: 'Lyra Thorne', type: 'npc', aliases: ['Nightjar'] },
      { id: 'name-owner', name: 'Nightjar', type: 'npc' },
    ];
    const [m] = engine.findMatches('The Nightjar sings.', c);
    expect(m.entityId).toBe('name-owner');
    expect(m.candidates?.map(x => x.entityId)).toEqual(['name-owner', 'alias-owner']);
    expect(m.ambiguous).toBe(true);
  });

  it('does not flag an entity as ambiguous with itself (alias equal to its own name / duplicate alias)', () => {
    const c: EntityCandidate[] = [
      { id: 'n', name: 'Brackle', type: 'npc', aliases: ['brackle', 'Old Brackle', 'Old Brackle'] },
    ];
    const matches = engine.findMatches('Brackle and Old Brackle', c);
    expect(matches.every(m => m.ambiguous === false)).toBe(true);
    expect(matches.every(m => m.candidates?.length === 1)).toBe(true);
  });

  it('unambiguous matches carry a single candidate and ambiguous: false', () => {
    const [m] = engine.findMatches('Brackle hides.', [{ id: 'b', name: 'Brackle', type: 'npc' }]);
    expect(m.ambiguous).toBe(false);
    expect(m.candidates).toEqual([{ entityId: 'b', entityType: 'npc', entityName: 'Brackle', viaAlias: false }]);
  });

  it('expandAmbiguousMatch yields one match per candidate and passes others through', () => {
    const c: EntityCandidate[] = [
      { id: 'm1', name: 'Marcus Vell', type: 'npc' },
      { id: 'm2', name: 'Marcus Vell', type: 'npc' },
      { id: 'b', name: 'Brackle', type: 'npc' },
    ];
    const expanded = engine.findMatches('Marcus Vell and Brackle', c).flatMap(expandAmbiguousMatch);
    expect(expanded.map(m => m.entityId)).toEqual(['m1', 'm2', 'b']);
    expect(expanded[0].matchSpan).toEqual(expanded[1].matchSpan);
  });
});

describe('TextMatchingEngine — index cache', () => {
  it('builds the index once per candidate-array identity', () => {
    const engine = new TextMatchingEngine();
    const c: EntityCandidate[] = [{ id: 'b', name: 'Brackle', type: 'npc' }];
    engine.findMatches('Brackle one', c);
    engine.findMatches('Brackle two', c);
    engine.findMatches('nothing', c);
    expect(engine.indexBuilds).toBe(1);

    engine.findMatches('Brackle', [...c]);
    expect(engine.indexBuilds).toBe(2);
  });

  it('rebuilds when a cached array is mutated in place', () => {
    const engine = new TextMatchingEngine();
    const c: EntityCandidate[] = [{ id: 'b', name: 'Brackle', type: 'npc' }];
    expect(engine.findMatches('Salvation', c)).toHaveLength(0);

    c.push({ id: 'l', name: 'Salvation', type: 'location' });
    expect(engine.findMatches('Salvation', c).map(m => m.entityId)).toEqual(['l']);

    c[0].name = 'Brackle the Bold';
    expect(engine.findMatches('Brackle the Bold', c).map(m => m.entityName)).toEqual(['Brackle the Bold']);
    expect(engine.indexBuilds).toBe(3);
  });

  it('shared cached matchers stay correct across interleaved calls', () => {
    const engine = new TextMatchingEngine();
    const c: EntityCandidate[] = [{ id: 'm', name: 'Mira', type: 'npc' }];
    const a = engine.findMatches('Mira and Mira', c);
    const b = engine.findMatches('Mira', c);
    expect(a.map(m => m.matchSpan)).toEqual([[0, 4], [9, 13]]);
    expect(b.map(m => m.matchSpan)).toEqual([[0, 4]]);
  });

  it('tolerates malformed candidates without throwing', () => {
    const engine = new TextMatchingEngine();
    const c = [
      { id: 'x', name: undefined, type: 'npc' },
      null,
      { id: 'b', name: 'Brackle', type: 'npc' },
    ] as unknown as EntityCandidate[];
    expect(engine.findMatches('Brackle', c).map(m => m.entityId)).toEqual(['b']);
  });
});

describe('consumers use ambiguity info', () => {
  it('autoLinkScenes does not add ambiguous NPCs by array order', () => {
    const scene = { id: 's', npcIds: [] as string[], readAloudText: 'Marcus Vell greets you.', gmNotes: '' };
    autoLinkScenes(
      [scene],
      [{ id: 'm1', name: 'Marcus Vell' }, { id: 'm2', name: 'Marcus Vell' }],
      [],
    );
    expect(scene.npcIds).toEqual([]);
  });

  it('autoLinkScenes skips ambiguous matches even with a permissive minConfidence', () => {
    const scene = { id: 's', npcIds: [] as string[], readAloudText: 'Marcus Vell greets you.', gmNotes: '' };
    autoLinkScenes(
      [scene],
      [{ id: 'm1', name: 'Marcus Vell' }, { id: 'm2', name: 'Marcus Vell' }],
      [],
      0,
    );
    expect(scene.npcIds).toEqual([]);
  });

  it('autoLinkNpcFactions does not link an ambiguous faction name', () => {
    const npc = { id: 'n', name: 'Agent', description: 'Serves the Emerald Claw.', backstory: '' } as {
      id: string; name: string; factionId?: string; description: string; backstory: string;
    };
    autoLinkNpcFactions([npc], [{ id: 'f1', name: 'Emerald Claw' }, { id: 'f2', name: 'Emerald Claw' }]);
    expect(npc.factionId).toBeUndefined();
  });

  it('findUnlinkedEntities offers every NPC sharing an ambiguous name', () => {
    const result = findUnlinkedEntities(
      'Marcus Vell arrives.', '', [], null,
      [
        { id: 'm1', name: 'Marcus Vell', type: 'npc' },
        { id: 'm2', name: 'Marcus Vell', type: 'npc' },
      ],
      [],
    );
    expect(result.npcs.map(m => m.entityId)).toEqual(['m1', 'm2']);
    expect(result.npcs.every(m => m.ambiguous)).toBe(true);
  });

  it('findUnlinkedEntities still hides an already-linked candidate of an ambiguous name', () => {
    const result = findUnlinkedEntities(
      'Marcus Vell arrives.', '', ['m1'], null,
      [
        { id: 'm1', name: 'Marcus Vell', type: 'npc' },
        { id: 'm2', name: 'Marcus Vell', type: 'npc' },
      ],
      [],
    );
    expect(result.npcs.map(m => m.entityId)).toEqual(['m2']);
  });
});
