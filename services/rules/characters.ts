import type { DmActor, DmWeapon, PlayerCharacter } from '@/types/index';
import { abilityModifier, proficiencyBonus } from './dice';
import { freshTurn } from './engine';

export const CLASS_HIT_DICE: Record<string, number> = {
  barbarian: 12,
  bard: 8,
  cleric: 8,
  druid: 8,
  fighter: 10,
  monk: 8,
  paladin: 10,
  ranger: 10,
  rogue: 8,
  sorcerer: 6,
  warlock: 8,
  wizard: 6,
};
export const BASIC_WEAPONS: DmWeapon[] = [
  {
    id: 'longsword',
    name: 'Longsword',
    ability: 'strength',
    proficient: true,
    dice: '1d8',
    damageType: 'slashing',
    reach: 5,
  },
  {
    id: 'shortsword',
    name: 'Shortsword',
    ability: 'dexterity',
    proficient: true,
    dice: '1d6',
    damageType: 'piercing',
    reach: 5,
  },
  {
    id: 'mace',
    name: 'Mace',
    ability: 'strength',
    proficient: true,
    dice: '1d6',
    damageType: 'bludgeoning',
    reach: 5,
  },
  {
    id: 'shortbow',
    name: 'Shortbow',
    ability: 'dexterity',
    proficient: true,
    dice: '1d6',
    damageType: 'piercing',
    reach: 5,
    range: 80,
    longRange: 320,
  },
  {
    id: 'greatsword',
    name: 'Greatsword',
    ability: 'strength',
    proficient: true,
    dice: '2d6',
    damageType: 'slashing',
    reach: 5,
  },
  {
    id: 'quarterstaff',
    name: 'Quarterstaff',
    ability: 'strength',
    proficient: true,
    dice: '1d6',
    damageType: 'bludgeoning',
    reach: 5,
  },
];
export function createActor(overrides: Partial<DmActor> = {}): DmActor {
  return {
    id: crypto.randomUUID(),
    name: 'Adventurer',
    side: 'party',
    level: 1,
    abilities: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    proficiencyBonus: 2,
    saves: [],
    skills: {},
    ac: 10,
    hp: 8,
    maxHp: 8,
    tempHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    size: 2,
    creatureType: 'humanoid',
    conditions: [],
    conditionImmunities: [],
    resistances: [],
    vulnerabilities: [],
    immunities: [],
    exhaustion: 0,
    dead: false,
    stable: false,
    deathSaves: { successes: 0, failures: 0 },
    usesDeathSaves: true,
    hitDice: { die: 8, current: 1, max: 1 },
    spellSlots: {},
    preparedSpells: [],
    resources: {},
    weapons: [structuredClone(BASIC_WEAPONS[0])],
    attacksPerAction: 1,
    heroicInspiration: false,
    canSpeak: true,
    freeHand: true,
    hasFocus: false,
    armorTrained: true,
    cover: 0,
    surprised: false,
    turn: freshTurn(),
    ...overrides,
  };
}
/** Imported sheets do not contain HP/AC in Realmweaver's legacy PC model.
 * These are suggested starting values; the setup form requires review.
 */
export function actorFromCharacter(pc: PlayerCharacter): DmActor {
  const stats = pc.characterStatistics;
  const level = stats.classes.level;
  const die = CLASS_HIT_DICE[stats.classes.charClass.toLowerCase()] ?? 8;
  const con = abilityModifier(stats.attributes.constitution);
  const hp =
    Math.max(1, die + con) + (level - 1) * Math.max(1, die / 2 + 1 + con);
  return createActor({
    name: pc.characterSocial.characterName,
    level,
    abilities: structuredClone(stats.attributes),
    skills: { ...stats.skills },
    proficiencyBonus: proficiencyBonus(level),
    maxHp: hp,
    hp,
    ac: 10 + abilityModifier(stats.attributes.dexterity),
    hitDice: { die, current: level, max: level },
  });
}
/** Deliberately simple, original demo actors; not complete class builds. */
export function demoParty(): DmActor[] {
  return [
    createActor({
      id: 'demo-warden',
      name: 'Warden',
      ac: 16,
      maxHp: 12,
      hp: 12,
      abilities: {
        strength: 16,
        dexterity: 12,
        constitution: 14,
        intelligence: 10,
        wisdom: 13,
        charisma: 8,
      },
      saves: ['strength', 'constitution'],
      skills: { athletics: 'proficient', perception: 'proficient' },
      hitDice: { die: 10, current: 1, max: 1 },
    }),
    createActor({
      id: 'demo-acolyte',
      name: 'Acolyte',
      ac: 14,
      maxHp: 10,
      hp: 10,
      position: { x: 0, y: 5 },
      abilities: {
        strength: 12,
        dexterity: 10,
        constitution: 14,
        intelligence: 10,
        wisdom: 16,
        charisma: 13,
      },
      saves: ['wisdom', 'charisma'],
      spellcastingAbility: 'wisdom',
      spellSlots: { '1': { current: 2, max: 2 } },
      preparedSpells: [
        'sacred-flame',
        'cure-wounds',
        'healing-word',
        'inflict-wounds',
      ],
      weapons: [structuredClone(BASIC_WEAPONS[2])],
    }),
    createActor({
      id: 'demo-raider',
      name: 'Watchhouse Raider',
      side: 'opposition',
      ac: 12,
      maxHp: 9,
      hp: 9,
      usesDeathSaves: false,
      position: { x: 5, y: 0 },
      abilities: {
        strength: 12,
        dexterity: 14,
        constitution: 12,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      weapons: [structuredClone(BASIC_WEAPONS[1])],
    }),
  ];
}
