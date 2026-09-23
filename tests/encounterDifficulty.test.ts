import { describe, it, expect } from 'vitest';
import {
  calculateEncounterDifficulty,
  formatChallengeRating,
  getEncounterMultiplier,
  getPartyThresholds,
  parseChallengeRating,
  rateEncounter,
  xpForChallengeRating,
  XP_BY_CR,
  XP_THRESHOLDS_BY_LEVEL,
} from '../utils/encounterDifficulty';

describe('parseChallengeRating', () => {
  it.each([
    [0, 0],
    [2, 2],
    [0.25, 0.25],
    ['1/8', 0.125],
    ['1/4', 0.25],
    ['1 / 2', 0.5],
    ['0.5', 0.5],
    ['CR 1/2', 0.5],
    ['cr: 5', 5],
    ['Challenge 3', 3],
    ['Challenge Rating 30', 30],
    [' 7 ', 7],
  ] as const)('parses %p as %p', (input, expected) => {
    expect(parseChallengeRating(input)).toBe(expected);
  });

  it.each([['abc'], [''], ['31'], [-1], ['1/3'], ['1/0'], [NaN], [null], [undefined]])(
    'rejects %p',
    input => {
      expect(parseChallengeRating(input as never)).toBeNull();
    }
  );
});

describe('xpForChallengeRating / formatChallengeRating', () => {
  it('returns the DMG XP award by CR', () => {
    expect(xpForChallengeRating(0)).toBe(10);
    expect(xpForChallengeRating('1/8')).toBe(25);
    expect(xpForChallengeRating('1/4')).toBe(50);
    expect(xpForChallengeRating('1/2')).toBe(100);
    expect(xpForChallengeRating(1)).toBe(200);
    expect(xpForChallengeRating(5)).toBe(1800);
    expect(xpForChallengeRating(20)).toBe(25000);
    expect(xpForChallengeRating(30)).toBe(155000);
    expect(xpForChallengeRating('nope')).toBeNull();
  });

  it('covers every CR 0–30 plus the three fractions', () => {
    expect(Object.keys(XP_BY_CR)).toHaveLength(34);
  });

  it('formats fractional CRs as stat blocks do', () => {
    expect(formatChallengeRating(0.125)).toBe('1/8');
    expect(formatChallengeRating(0.25)).toBe('1/4');
    expect(formatChallengeRating(0.5)).toBe('1/2');
    expect(formatChallengeRating(12)).toBe('12');
  });
});

describe('getEncounterMultiplier', () => {
  it.each([
    [1, 1],
    [2, 1.5],
    [3, 2],
    [6, 2],
    [7, 2.5],
    [10, 2.5],
    [11, 3],
    [14, 3],
    [15, 4],
    [40, 4],
  ])('%i monsters vs a party of 4 → ×%p', (count, expected) => {
    expect(getEncounterMultiplier(count, 4)).toBe(expected);
  });

  it('shifts one step up for parties smaller than 3', () => {
    expect(getEncounterMultiplier(1, 2)).toBe(1.5);
    expect(getEncounterMultiplier(3, 1)).toBe(2.5);
    expect(getEncounterMultiplier(15, 2)).toBe(5);
  });

  it('shifts one step down for parties of 6 or more', () => {
    expect(getEncounterMultiplier(1, 6)).toBe(0.5);
    expect(getEncounterMultiplier(2, 6)).toBe(1);
    expect(getEncounterMultiplier(15, 8)).toBe(3);
  });

  it('is ×1 with no monsters', () => {
    expect(getEncounterMultiplier(0, 4)).toBe(1);
  });
});

describe('getPartyThresholds', () => {
  it('has a row for every level 1–20', () => {
    expect(XP_THRESHOLDS_BY_LEVEL).toHaveLength(20);
  });

  it('sums per-character thresholds', () => {
    // DMG example: four 3rd-level characters → easy 300 / medium 600 / hard 900 / deadly 1600
    expect(getPartyThresholds([3, 3, 3, 3])).toEqual({ easy: 300, medium: 600, hard: 900, deadly: 1600 });
    expect(getPartyThresholds([1, 5])).toEqual({ easy: 275, medium: 550, hard: 825, deadly: 1200 });
  });

  it('clamps out-of-range levels to 1–20', () => {
    expect(getPartyThresholds([0])).toEqual(XP_THRESHOLDS_BY_LEVEL[0]);
    expect(getPartyThresholds([25])).toEqual(XP_THRESHOLDS_BY_LEVEL[19]);
    expect(getPartyThresholds([4.6])).toEqual(XP_THRESHOLDS_BY_LEVEL[4]);
  });
});

describe('rateEncounter', () => {
  const t = { easy: 100, medium: 200, hard: 300, deadly: 400 };
  it.each([
    [0, 'trivial'],
    [99, 'trivial'],
    [100, 'easy'],
    [200, 'medium'],
    [299, 'medium'],
    [300, 'hard'],
    [400, 'deadly'],
    [10_000, 'deadly'],
  ] as const)('%i XP → %s', (xp, rating) => {
    expect(rateEncounter(xp, t)).toBe(rating);
  });
});

describe('calculateEncounterDifficulty', () => {
  it('rates a bugbear and three goblins against four level-3 PCs as medium', () => {
    // Four level-3 PCs vs 1 bugbear (CR 1) + 3 goblins (CR 1/4):
    // base 200 + 150 = 350; 4 monsters → ×2 = 700 → medium (600 ≤ 700 < 900)
    const result = calculateEncounterDifficulty({ partyLevels: [3, 3, 3, 3], monsterCRs: [1, '1/4', '1/4', '1/4'] });
    expect(result.baseXp).toBe(350);
    expect(result.multiplier).toBe(2);
    expect(result.adjustedXp).toBe(700);
    expect(result.monsterCount).toBe(4);
    expect(result.partySize).toBe(4);
    expect(result.thresholds).toEqual({ easy: 300, medium: 600, hard: 900, deadly: 1600 });
    expect(result.rating).toBe('medium');
  });

  it('rates a single ogre against a level-1 party as deadly', () => {
    const result = calculateEncounterDifficulty({ partyLevels: [1, 1, 1, 1], monsterCRs: ['2'] });
    expect(result.adjustedXp).toBe(450);
    expect(result.rating).toBe('deadly');
  });

  it('rates a lone goblin against a level-5 party as trivial', () => {
    const result = calculateEncounterDifficulty({ partyLevels: [5, 5, 5, 5], monsterCRs: ['1/4'] });
    expect(result.rating).toBe('trivial');
  });

  it('applies the small-party adjustment', () => {
    const result = calculateEncounterDifficulty({ partyLevels: [2, 2], monsterCRs: ['1/2', '1/2'] });
    // 200 base, 2 monsters ×1.5 → shifted up to ×2 for a party of 2
    expect(result.multiplier).toBe(2);
    expect(result.adjustedXp).toBe(400);
    expect(result.rating).toBe('deadly');
  });

  it('ignores unparseable CRs and does not count them toward the multiplier', () => {
    const result = calculateEncounterDifficulty({ partyLevels: [3, 3, 3, 3], monsterCRs: [1, 'boss', ''] });
    expect(result.monsterCount).toBe(1);
    expect(result.multiplier).toBe(1);
    expect(result.baseXp).toBe(200);
    expect(result.ignoredCRs).toEqual(['boss', '']);
  });

  it("returns rating 'none' without monsters or without a party", () => {
    expect(calculateEncounterDifficulty({ partyLevels: [3], monsterCRs: [] }).rating).toBe('none');
    expect(calculateEncounterDifficulty({ partyLevels: [], monsterCRs: [5] }).rating).toBe('none');
  });
});
