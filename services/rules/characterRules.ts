import type { DmAbility } from '@/types/index';
import { abilityModifier } from './dice';

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;
const POINT_BUY: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};
export function pointBuyCost(scores: number[]): number {
  if (scores.length !== 6 || scores.some((s) => !Object.hasOwn(POINT_BUY, s)))
    throw new Error('Point buy requires six scores from 8 to 15.');
  return scores.reduce((sum, score) => sum + POINT_BUY[score], 0);
}
export const EXPERIENCE_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000,
  120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
] as const;
export function levelForExperience(xp: number): number {
  if (!Number.isInteger(xp) || xp < 0)
    throw new Error('XP must be a nonnegative integer.');
  return EXPERIENCE_THRESHOLDS.filter((n) => xp >= n).length;
}
export const FULL_CASTER_SLOTS: readonly number[][] = [
  [],
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];
export function multiclassSlots(classes: { name: string; level: number }[]): {
  spellcasting: number[];
  pact: { level: number; slots: number };
} {
  if (
    !classes.length ||
    classes.some((c) => !Number.isInteger(c.level) || c.level < 1) ||
    classes.reduce((s, c) => s + c.level, 0) > 20 ||
    new Set(classes.map((c) => c.name)).size !== classes.length
  )
    throw new Error('Invalid class levels.');
  const allowed = [
    'barbarian',
    'bard',
    'cleric',
    'druid',
    'fighter',
    'monk',
    'paladin',
    'ranger',
    'rogue',
    'sorcerer',
    'warlock',
    'wizard',
  ];
  if (classes.some((c) => !allowed.includes(c.name)))
    throw new Error('Class is not in the SRD.');
  const full = ['bard', 'cleric', 'druid', 'sorcerer', 'wizard'];
  const casterLevel = classes.reduce(
    (sum, c) =>
      sum +
      (full.includes(c.name)
        ? c.level
        : ['paladin', 'ranger'].includes(c.name)
          ? Math.ceil(c.level / 2)
          : 0),
    0,
  );
  const warlock = classes.find((c) => c.name === 'warlock')?.level ?? 0;
  return {
    spellcasting: [...FULL_CASTER_SLOTS[casterLevel]],
    pact: {
      level: Math.min(5, Math.ceil(warlock / 2)),
      slots:
        warlock === 0
          ? 0
          : warlock === 1
            ? 1
            : warlock < 11
              ? 2
              : warlock < 17
                ? 3
                : 4,
    },
  };
}
export function armorClass(
  dexterity: number,
  armor:
    | 'none'
    | 'padded'
    | 'leather'
    | 'studded-leather'
    | 'hide'
    | 'chain-shirt'
    | 'scale-mail'
    | 'breastplate'
    | 'half-plate'
    | 'ring-mail'
    | 'chain-mail'
    | 'splint'
    | 'plate',
  shield = false,
): number {
  const dex = abilityModifier(dexterity);
  const base: Record<typeof armor, number> = {
    none: 10 + dex,
    padded: 11 + dex,
    leather: 11 + dex,
    'studded-leather': 12 + dex,
    hide: 12 + Math.min(2, dex),
    'chain-shirt': 13 + Math.min(2, dex),
    'scale-mail': 14 + Math.min(2, dex),
    breastplate: 14 + Math.min(2, dex),
    'half-plate': 15 + Math.min(2, dex),
    'ring-mail': 14,
    'chain-mail': 16,
    splint: 17,
    plate: 18,
  };
  if (
    !Number.isInteger(dexterity) ||
    dexterity < 1 ||
    dexterity > 30 ||
    !Object.hasOwn(base, armor)
  )
    throw new Error('Invalid armor calculation.');
  return base[armor] + (shield ? 2 : 0);
}
export const MULTICLASS_PREREQUISITES: Record<string, DmAbility[]> = {
  barbarian: ['strength'],
  bard: ['charisma'],
  cleric: ['wisdom'],
  druid: ['wisdom'],
  monk: ['dexterity', 'wisdom'],
  paladin: ['strength', 'charisma'],
  ranger: ['dexterity', 'wisdom'],
  rogue: ['dexterity'],
  sorcerer: ['charisma'],
  warlock: ['charisma'],
  wizard: ['intelligence'],
};
export function meetsMulticlassPrerequisite(
  name: string,
  scores: Record<DmAbility, number>,
): boolean {
  if (name === 'fighter')
    return scores.strength >= 13 || scores.dexterity >= 13;
  if (!Object.hasOwn(MULTICLASS_PREREQUISITES, name))
    throw new Error('Unknown SRD class.');
  return MULTICLASS_PREREQUISITES[name].every((a) => scores[a] >= 13);
}
