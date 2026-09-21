import type { DmAbility, DmActor, DmRoll } from '@/types/index';

export type DieRoller = (sides: number) => number;
/** Rejection sampling avoids modulo bias. Tests inject a deterministic die roller. */
export const secureDie: DieRoller = (sides) => {
  if (!Number.isInteger(sides) || sides < 2 || sides > 1000)
    throw new Error('Invalid die.');
  const range = 0x100000000;
  const limit = range - (range % sides);
  const buffer = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return (buffer[0] % sides) + 1;
};
export const abilityModifier = (score: number) => Math.floor((score - 10) / 2);
export const proficiencyBonus = (level: number) =>
  2 + Math.floor((level - 1) / 4);
export const SKILL_ABILITIES: Record<string, DmAbility> = {
  acrobatics: 'dexterity',
  animal_handling: 'wisdom',
  arcana: 'intelligence',
  athletics: 'strength',
  deception: 'charisma',
  history: 'intelligence',
  insight: 'wisdom',
  intimidation: 'charisma',
  investigation: 'intelligence',
  medicine: 'wisdom',
  nature: 'intelligence',
  perception: 'wisdom',
  performance: 'charisma',
  persuasion: 'charisma',
  religion: 'intelligence',
  sleight_of_hand: 'dexterity',
  stealth: 'dexterity',
  survival: 'wisdom',
};
export function skillBonus(actor: DmActor, skill?: string): number {
  const p = skill ? actor.skills[skill] : 'none';
  return p === 'expertise'
    ? 2 * actor.proficiencyBonus
    : p === 'proficient'
      ? actor.proficiencyBonus
      : p === 'half'
        ? Math.floor(actor.proficiencyBonus / 2)
        : 0;
}
export function rollD20(
  actorId: string,
  kind: string,
  modifier: number,
  dc: number,
  advantage = false,
  disadvantage = false,
  die: DieRoller = secureDie,
): DmRoll {
  const mode =
    advantage === disadvantage
      ? 'normal'
      : advantage
        ? 'advantage'
        : 'disadvantage';
  const dice = mode === 'normal' ? [die(20)] : [die(20), die(20)];
  if (dice.some((n) => !Number.isInteger(n) || n < 1 || n > 20))
    throw new Error('Die roller returned an invalid d20.');
  const natural =
    mode === 'advantage'
      ? Math.max(...dice)
      : mode === 'disadvantage'
        ? Math.min(...dice)
        : dice[0];
  const attack = kind === 'attack';
  return {
    kind,
    actorId,
    dice,
    modifier,
    total: natural + modifier,
    dc,
    success:
      attack && natural === 1
        ? false
        : attack && natural === 20
          ? true
          : natural + modifier >= dc,
    critical: attack && natural === 20,
    advantage: mode,
  };
}
export function rollDice(
  expression: string,
  die: DieRoller = secureDie,
  critical = false,
): { total: number; dice: number[] } {
  const match = /^(\d{1,2})d(4|6|8|10|12|20)([+-]\d{1,3})?$/.exec(
    expression.replace(/\s/g, ''),
  );
  if (!match) throw new Error(`Unsupported dice expression: ${expression}`);
  const count = Number(match[1]) * (critical ? 2 : 1);
  if (count < 1 || count > 80) throw new Error('Dice count out of bounds.');
  const sides = Number(match[2]);
  const dice = Array.from({ length: count }, () => die(sides));
  if (dice.some((n) => !Number.isInteger(n) || n < 1 || n > sides))
    throw new Error('Invalid die result.');
  return {
    total: Math.max(0, dice.reduce((a, b) => a + b, 0) + Number(match[3] ?? 0)),
    dice,
  };
}
