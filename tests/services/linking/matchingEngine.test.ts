import { describe, it, expect } from 'vitest';
import { TextMatchingEngine } from '../../../services/linking/matchingEngine';
import type { EntityCandidate } from '../../../services/linking/matchingEngine';

const candidates: EntityCandidate[] = [
  { id: '1', name: 'Kalli Alran', type: 'npc' },
  { id: '2', name: 'Salvation', type: 'location' },
  { id: '3', name: 'Kalli', type: 'npc' },
  { id: '4', name: 'The Emerald Claw', type: 'faction' },
  { id: '5', name: 'Al', type: 'npc' },
];

describe('TextMatchingEngine', () => {
  const engine = new TextMatchingEngine();

  it('finds exact entity name matches', () => {
    const matches = engine.findMatches('Kalli Alran leads the party to Salvation.', candidates);
    const names = matches.map(m => m.entityName);
    expect(names).toContain('Kalli Alran');
    expect(names).toContain('Salvation');
  });

  it('returns longest match when names overlap', () => {
    const matches = engine.findMatches('Kalli Alran is here.', candidates);
    expect(matches).toHaveLength(1);
    expect(matches[0].entityName).toBe('Kalli Alran');
  });

  it('is case-insensitive', () => {
    const matches = engine.findMatches('KALLI ALRAN shouts orders.', candidates);
    expect(matches[0].entityName).toBe('Kalli Alran');
  });

  it('respects word boundaries', () => {
    const matches = engine.findMatches('Salvationing is not a word.', candidates);
    expect(matches).toHaveLength(0);
  });

  it('skips names shorter than 3 characters', () => {
    const matches = engine.findMatches('Al is here in Salvation.', candidates);
    const names = matches.map(m => m.entityName);
    expect(names).not.toContain('Al');
    expect(names).toContain('Salvation');
  });

  it('returns confidence 1.0 for all matches', () => {
    const matches = engine.findMatches('Kalli Alran in Salvation.', candidates);
    for (const m of matches) {
      expect(m.confidence).toBe(1.0);
    }
  });

  it('returns correct matchSpan offsets', () => {
    const text = 'Meet Kalli Alran here.';
    const matches = engine.findMatches(text, candidates);
    expect(matches[0].matchSpan).toEqual([5, 16]);
    expect(text.substring(5, 16)).toBe('Kalli Alran');
  });

  it('finds multiple non-overlapping matches', () => {
    const matches = engine.findMatches(
      'The Emerald Claw attacked Salvation where Kalli Alran was resting.',
      candidates
    );
    expect(matches).toHaveLength(3);
  });

  it('returns empty array for text with no matches', () => {
    const matches = engine.findMatches('Nothing relevant here.', candidates);
    expect(matches).toHaveLength(0);
  });

  it('reports engine info', () => {
    const info = engine.info();
    expect(info.name).toBe('TextMatchingEngine');
    expect(info.version).toBeDefined();
  });

  it('does not treat unicode letters as word boundaries (no false substring match)', () => {
    const unicodeCandidates: EntityCandidate[] = [
      { id: '6', name: 'Ana', type: 'npc' },
      { id: '7', name: 'Anaïs', type: 'npc' },
    ];
    const matches = engine.findMatches('Anaïs walked into the room.', unicodeCandidates);
    const names = matches.map(m => m.entityName);
    expect(names).toContain('Anaïs');
    expect(names).not.toContain('Ana');
  });
});
