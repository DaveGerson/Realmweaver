import type { AbilityScores, ProficiencyLevel } from './PlayerCharacter';

export type DmAbility = keyof AbilityScores;
export type DamageType =
  | 'acid'
  | 'bludgeoning'
  | 'cold'
  | 'fire'
  | 'force'
  | 'lightning'
  | 'necrotic'
  | 'piercing'
  | 'poison'
  | 'psychic'
  | 'radiant'
  | 'slashing'
  | 'thunder';
export type DmCondition =
  | 'blinded'
  | 'charmed'
  | 'deafened'
  | 'frightened'
  | 'grappled'
  | 'incapacitated'
  | 'invisible'
  | 'paralyzed'
  | 'petrified'
  | 'poisoned'
  | 'prone'
  | 'restrained'
  | 'stunned'
  | 'unconscious';
export interface DmConditionEffect {
  name: DmCondition;
  sourceId?: string;
  escapeDC?: number;
}
export interface DmTimedEffect {
  id: string;
  kind:
    | 'no-healing'
    | 'slow-10'
    | 'poisoned'
    | 'next-attack-advantage'
    | 'no-opportunity-attacks'
    | 'visible-glow'
    | 'next-attack-disadvantage';
  sourceId: string;
  expiresOnActorId: string;
  phase: 'start' | 'end';
  occurrences: number;
  expiresAtMinute: number;
}
export interface DmPool {
  current: number;
  max: number;
}
export interface DmWeapon {
  id: string;
  name: string;
  ability: DmAbility;
  proficient: boolean;
  dice: string;
  damageType: DamageType;
  reach: number;
  range?: number;
  longRange?: number;
  attackBonus?: number;
  damageBonus?: number; // Monster stat-block totals when present.
}
export interface DmActor {
  id: string;
  name: string;
  side: 'party' | 'opposition';
  level: number;
  abilities: AbilityScores;
  proficiencyBonus: number;
  saves: DmAbility[];
  skills: Partial<Record<string, ProficiencyLevel>>;
  ac: number;
  hp: number;
  maxHp: number;
  tempHp: number;
  speed: number;
  position: { x: number; y: number };
  size: number;
  creatureType: string;
  conditions: DmConditionEffect[];
  conditionImmunities: DmCondition[];
  effects?: DmTimedEffect[];
  resistances: DamageType[];
  vulnerabilities: DamageType[];
  immunities: DamageType[];
  exhaustion: number;
  dead: boolean;
  stable: boolean;
  deathSaves: { successes: number; failures: number };
  usesDeathSaves: boolean;
  hitDice: { die: number; current: number; max: number };
  spellSlots: Record<string, DmPool>;
  preparedSpells: string[];
  spellcastingAbility?: DmAbility;
  resources: Record<string, DmPool & { recovery: 'short' | 'long' }>;
  weapons: DmWeapon[];
  attacksPerAction: number;
  heroicInspiration: boolean;
  canSpeak: boolean;
  freeHand: boolean;
  hasFocus: boolean;
  armorTrained: boolean;
  cover: 0 | 2 | 5 | 99;
  surprised: boolean;
  concentration?: {
    spellId: string;
    remainingRounds: number;
    targetIds: string[];
  };
  lastLongRestEnd?: number;
  turn: {
    action: boolean;
    bonus: boolean;
    reaction: boolean;
    movement: number;
    attacks: number;
    slotSpentOnTurn?: number;
    dodging: boolean;
    disengaged: boolean;
  };
}
export interface DmRoll {
  kind: string;
  actorId: string;
  dice: number[];
  modifier: number;
  total: number;
  dc?: number;
  success?: boolean;
  critical?: boolean;
  automatic?: boolean;
  advantage: 'normal' | 'advantage' | 'disadvantage';
}
export interface DmEvent {
  text: string;
  rulePages: number[];
  roll?: DmRoll;
}
export interface DmMessage {
  id: string;
  role: 'player' | 'dm' | 'system';
  text: string;
  rulePages: number[];
}
export interface DungeonMasterState {
  schemaVersion: 1;
  rulesVersion: '5.2.1';
  revision: number;
  actors: DmActor[];
  inCombat: boolean;
  order: string[];
  turnIndex: number;
  round: number;
  turnSerial: number;
  elapsedMinutes: number;
  messages: DmMessage[];
  events: DmEvent[];
}
export type DmAction =
  | { kind: 'start-combat' }
  | { kind: 'end-combat' }
  | { kind: 'end-turn'; actorId: string }
  | {
      kind: 'check';
      actorId: string;
      ability: DmAbility;
      skill?: string;
      dc: number;
    }
  | { kind: 'save'; actorId: string; ability: DmAbility; dc: number }
  | {
      kind: 'attack';
      actorId: string;
      targetId: string;
      weaponId: string;
      nonlethal?: boolean;
    }
  | {
      kind: 'cast';
      actorId: string;
      targetIds: string[];
      spellId: string;
      slotLevel: number;
    }
  | { kind: 'move'; actorId: string; x: number; y: number; difficult?: boolean }
  | {
      kind: 'dash' | 'dodge' | 'disengage' | 'stand' | 'drop-concentration';
      actorId: string;
    }
  | {
      kind: 'grapple' | 'shove';
      actorId: string;
      targetId: string;
      saveAbility: 'strength' | 'dexterity';
    }
  | { kind: 'escape'; actorId: string; ability: 'strength' | 'dexterity' }
  | { kind: 'stabilize'; actorId: string; targetId: string }
  | { kind: 'short-rest'; actorId: string; hitDice: number }
  | { kind: 'long-rest'; actorId: string };
export interface DmProposal {
  narration: string;
  action: DmAction | null;
  rulePages: number[];
  needsRuling: string | null;
  suggestedOptions: string[];
}
export interface DmTurnResult {
  state: DungeonMasterState;
  proposal: DmProposal;
  events: DmEvent[];
  status: 'resolved' | 'needs-ruling';
}
export interface SrdPage {
  id: string;
  page: number;
  section: string;
  headings: string[];
  text: string;
}
