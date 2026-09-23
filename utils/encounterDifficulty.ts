/**
 * D&D 5e encounter-difficulty calculator (DMG 2014, "Creating a Combat Encounter").
 *
 * Pure, dependency-free. Given party levels and monster challenge ratings it
 * returns the raw monster XP, the count-adjusted XP, the party's
 * easy/medium/hard/deadly thresholds and the resulting rating.
 *
 * Method:
 *  1. Sum each character's per-level XP thresholds.
 *  2. Sum the XP of every monster (by CR).
 *  3. Multiply by the encounter multiplier for the monster count, shifted one
 *     step up for parties of fewer than 3 characters and one step down for
 *     parties of 6 or more.
 *  4. The rating is the highest threshold the adjusted XP meets; below "easy"
 *     is "trivial".
 */

export type EncounterRating = 'none' | 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly';

export interface XpThresholds {
  easy: number;
  medium: number;
  hard: number;
  deadly: number;
}

export interface EncounterDifficultyInput {
  /** Character levels, one entry per party member. Clamped to 1–20. */
  partyLevels: number[];
  /** Challenge ratings, one per monster: 2, 0.25, "1/4", "CR 1/2", ... */
  monsterCRs: (number | string)[];
}

export interface EncounterDifficultyResult {
  /** Sum of monster XP before the multiplier. */
  baseXp: number;
  /** baseXp × multiplier — compare this against the thresholds. */
  adjustedXp: number;
  multiplier: number;
  /** Number of monsters with a recognised CR (counts toward the multiplier). */
  monsterCount: number;
  /** CR values that could not be parsed and were left out. */
  ignoredCRs: (number | string)[];
  partySize: number;
  thresholds: XpThresholds;
  /** 'none' when there are no party members or no recognised monsters. */
  rating: EncounterRating;
}

/** XP award by challenge rating. Fractional CRs are keyed by their decimal value. */
export const XP_BY_CR: Readonly<Record<string, number>> = {
  '0': 10,
  '0.125': 25,
  '0.25': 50,
  '0.5': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
  '6': 2300,
  '7': 2900,
  '8': 3900,
  '9': 5000,
  '10': 5900,
  '11': 7200,
  '12': 8400,
  '13': 10000,
  '14': 11500,
  '15': 13000,
  '16': 15000,
  '17': 18000,
  '18': 20000,
  '19': 22000,
  '20': 25000,
  '21': 33000,
  '22': 41000,
  '23': 50000,
  '24': 62000,
  '25': 75000,
  '26': 90000,
  '27': 105000,
  '28': 120000,
  '29': 135000,
  '30': 155000,
};

/** Per-character XP thresholds, index = level - 1. */
export const XP_THRESHOLDS_BY_LEVEL: readonly XpThresholds[] = [
  { easy: 25, medium: 50, hard: 75, deadly: 100 },
  { easy: 50, medium: 100, hard: 150, deadly: 200 },
  { easy: 75, medium: 150, hard: 225, deadly: 400 },
  { easy: 125, medium: 250, hard: 375, deadly: 500 },
  { easy: 250, medium: 500, hard: 750, deadly: 1100 },
  { easy: 300, medium: 600, hard: 900, deadly: 1400 },
  { easy: 350, medium: 750, hard: 1100, deadly: 1700 },
  { easy: 450, medium: 900, hard: 1400, deadly: 2100 },
  { easy: 550, medium: 1100, hard: 1600, deadly: 2400 },
  { easy: 600, medium: 1200, hard: 1900, deadly: 2800 },
  { easy: 800, medium: 1600, hard: 2400, deadly: 3600 },
  { easy: 1000, medium: 2000, hard: 3000, deadly: 4500 },
  { easy: 1100, medium: 2200, hard: 3400, deadly: 5100 },
  { easy: 1250, medium: 2500, hard: 3800, deadly: 5700 },
  { easy: 1400, medium: 2800, hard: 4300, deadly: 6400 },
  { easy: 1600, medium: 3200, hard: 4800, deadly: 7200 },
  { easy: 2000, medium: 3900, hard: 5900, deadly: 8800 },
  { easy: 2100, medium: 4200, hard: 6300, deadly: 9500 },
  { easy: 2400, medium: 4900, hard: 7300, deadly: 10900 },
  { easy: 2800, medium: 5700, hard: 8500, deadly: 12700 },
];

/** The multiplier ladder. Party-size adjustments move one step along it. */
const MULTIPLIER_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5] as const;

/** Index into MULTIPLIER_STEPS for a monster count, before party-size adjustment. */
const multiplierStepForCount = (count: number): number => {
  if (count <= 1) return 1; // ×1
  if (count === 2) return 2; // ×1.5
  if (count <= 6) return 3; // ×2
  if (count <= 10) return 4; // ×2.5
  if (count <= 14) return 5; // ×3
  return 6; // ×4
};

/**
 * Encounter multiplier for `monsterCount` monsters facing a party of `partySize`.
 * Fewer than 3 characters → one step higher; 6 or more → one step lower.
 */
export const getEncounterMultiplier = (monsterCount: number, partySize: number): number => {
  if (monsterCount <= 0) return 1;
  let step = multiplierStepForCount(monsterCount);
  if (partySize > 0 && partySize < 3) step += 1;
  else if (partySize >= 6) step -= 1;
  step = Math.max(0, Math.min(MULTIPLIER_STEPS.length - 1, step));
  return MULTIPLIER_STEPS[step];
};

/**
 * Parses a challenge rating into its numeric value. Accepts numbers (0.25),
 * fractions ("1/4"), decimals ("0.5"), and prefixed forms ("CR 1/2",
 * "Challenge 3"). Returns null for anything that is not a CR in the 0–30 table.
 */
export const parseChallengeRating = (cr: number | string | null | undefined): number | null => {
  if (cr === null || cr === undefined) return null;
  let value: number;
  if (typeof cr === 'number') {
    value = cr;
  } else {
    const cleaned = cr.trim().replace(/^(?:cr|challenge(?:\s+rating)?)\s*[:=]?\s*/i, '').trim();
    if (cleaned === '') return null;
    const fraction = cleaned.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (fraction) {
      const denominator = parseInt(fraction[2], 10);
      if (denominator === 0) return null;
      value = parseInt(fraction[1], 10) / denominator;
    } else if (/^\d+(?:\.\d+)?$/.test(cleaned)) {
      value = parseFloat(cleaned);
    } else {
      return null;
    }
  }
  if (!Number.isFinite(value)) return null;
  return String(value) in XP_BY_CR ? value : null;
};

/** XP for a single monster of the given CR, or null if the CR is not recognised. */
export const xpForChallengeRating = (cr: number | string): number | null => {
  const value = parseChallengeRating(cr);
  return value === null ? null : XP_BY_CR[String(value)];
};

/** Formats a numeric CR the way a stat block prints it: 0.25 → "1/4". */
export const formatChallengeRating = (cr: number): string => {
  if (cr === 0.125) return '1/8';
  if (cr === 0.25) return '1/4';
  if (cr === 0.5) return '1/2';
  return String(cr);
};

const clampLevel = (level: number): number => {
  if (!Number.isFinite(level)) return 1;
  return Math.max(1, Math.min(20, Math.round(level)));
};

/** Sums the per-character thresholds for a party. */
export const getPartyThresholds = (partyLevels: number[]): XpThresholds => {
  return partyLevels.reduce<XpThresholds>(
    (acc, level) => {
      const t = XP_THRESHOLDS_BY_LEVEL[clampLevel(level) - 1];
      return {
        easy: acc.easy + t.easy,
        medium: acc.medium + t.medium,
        hard: acc.hard + t.hard,
        deadly: acc.deadly + t.deadly,
      };
    },
    { easy: 0, medium: 0, hard: 0, deadly: 0 }
  );
};

export const rateEncounter = (adjustedXp: number, thresholds: XpThresholds): EncounterRating => {
  if (adjustedXp >= thresholds.deadly) return 'deadly';
  if (adjustedXp >= thresholds.hard) return 'hard';
  if (adjustedXp >= thresholds.medium) return 'medium';
  if (adjustedXp >= thresholds.easy) return 'easy';
  return 'trivial';
};

export const calculateEncounterDifficulty = ({
  partyLevels,
  monsterCRs,
}: EncounterDifficultyInput): EncounterDifficultyResult => {
  const ignoredCRs: (number | string)[] = [];
  let baseXp = 0;
  let monsterCount = 0;
  for (const cr of monsterCRs) {
    const xp = xpForChallengeRating(cr);
    if (xp === null) {
      ignoredCRs.push(cr);
      continue;
    }
    baseXp += xp;
    monsterCount++;
  }

  const partySize = partyLevels.length;
  const thresholds = getPartyThresholds(partyLevels);
  const multiplier = getEncounterMultiplier(monsterCount, partySize);
  const adjustedXp = Math.round(baseXp * multiplier);
  const rating: EncounterRating =
    partySize === 0 || monsterCount === 0 ? 'none' : rateEncounter(adjustedXp, thresholds);

  return { baseXp, adjustedXp, multiplier, monsterCount, ignoredCRs, partySize, thresholds, rating };
};
