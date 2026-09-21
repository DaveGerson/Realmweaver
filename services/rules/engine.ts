import type {
  DamageType,
  DmAbility,
  DmAction,
  DmActor,
  DmCondition,
  DmEvent,
  DmRoll,
  DmTimedEffect,
  DungeonMasterState,
} from '@/types/index';
import { validateDungeonMasterState } from './validation';
import {
  abilityModifier,
  rollD20,
  rollDice,
  secureDie,
  skillBonus,
  SKILL_ABILITIES,
  type DieRoller,
} from './dice';

export class RulingRequired extends Error {
  constructor(
    message: string,
    public readonly rulePages: number[],
  ) {
    super(message);
    this.name = 'RulingRequired';
  }
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const integer = (value: number, min: number, max: number, name: string) => {
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error(`Invalid ${name}.`);
};
export const hasCondition = (a: DmActor, name: DmCondition) =>
  a.conditions.some((c) => c.name === name) ||
  (name === 'poisoned' && !!a.effects?.some((e) => e.kind === 'poisoned'));
const hasEffect = (a: DmActor, kind: DmTimedEffect['kind']) =>
  !!a.effects?.some((e) => e.kind === kind);
export const incapacitated = (a: DmActor) =>
  a.dead ||
  a.hp === 0 ||
  ['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious'].some(
    (c) => hasCondition(a, c as DmCondition),
  );
export const distance = (
  a: { x: number; y: number },
  b: { x: number; y: number },
) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
export const effectiveSpeed = (a: DmActor) =>
  a.dead ||
  a.hp === 0 ||
  ['grappled', 'restrained', 'paralyzed', 'petrified', 'unconscious'].some(
    (c) => hasCondition(a, c as DmCondition),
  )
    ? 0
    : Math.max(
        0,
        a.speed - a.exhaustion * 5 - (hasEffect(a, 'slow-10') ? 10 : 0),
      );
export const freshTurn = (): DmActor['turn'] => ({
  action: true,
  bonus: true,
  reaction: true,
  movement: 0,
  attacks: 0,
  dodging: false,
  disengaged: false,
});
export const createDungeonMasterState = (
  actors: DmActor[] = [],
): DungeonMasterState => ({
  schemaVersion: 1,
  rulesVersion: '5.2.1',
  revision: 0,
  actors,
  inCombat: false,
  order: [],
  turnIndex: 0,
  round: 0,
  turnSerial: 0,
  elapsedMinutes: 0,
  messages: [],
  events: [],
});
export function findActor(state: DungeonMasterState, id: string): DmActor {
  const actor = state.actors.find((a) => a.id === id);
  if (!actor) throw new Error(`Unknown creature: ${id}`);
  return actor;
}
function event(
  events: DmEvent[],
  text: string,
  rulePages: number[],
  roll?: DmRoll,
) {
  events.push({ text, rulePages, ...(roll ? { roll } : {}) });
}
function recordRoll(
  events: DmEvent[],
  actor: DmActor,
  roll: DmRoll,
  pages: number[],
) {
  event(
    events,
    `${actor.name}: ${roll.kind} ${roll.automatic ? 'automatically fails' : `[${roll.dice.join(', ')}] ${roll.modifier >= 0 ? '+' : ''}${roll.modifier} = ${roll.total} vs ${roll.dc}: ${roll.success ? 'success' : 'failure'}`}.`,
    pages,
    roll,
  );
}
export function endConcentration(actor: DmActor, events: DmEvent[]) {
  if (actor.concentration)
    event(
      events,
      `${actor.name} loses Concentration on ${actor.concentration.spellId}.`,
      [179],
    );
  delete actor.concentration;
}
export function addCondition(
  actor: DmActor,
  name: DmCondition,
  events: DmEvent[],
  sourceId?: string,
  escapeDC?: number,
) {
  if (actor.conditionImmunities.includes(name)) {
    event(events, `${actor.name} is immune to ${name}.`, [183]);
    return;
  }
  if (!actor.conditions.some((c) => c.name === name && c.sourceId === sourceId))
    actor.conditions.push({
      name,
      ...(sourceId ? { sourceId } : {}),
      ...(escapeDC ? { escapeDC } : {}),
    });
  if (incapacitated(actor)) endConcentration(actor, events);
}
export function resolveSave(
  actor: DmActor,
  ability: DmAbility,
  dc: number,
  events: DmEvent[],
  die: DieRoller = secureDie,
  ignoreCover = false,
): DmRoll {
  integer(dc, 0, 100, 'save DC');
  const auto =
    (actor.hp === 0 ||
      ['paralyzed', 'petrified', 'stunned', 'unconscious'].some((c) =>
        hasCondition(actor, c as DmCondition),
      )) &&
    ['strength', 'dexterity'].includes(ability);
  const bonus =
    abilityModifier(actor.abilities[ability]) +
    (actor.saves.includes(ability) ? actor.proficiencyBonus : 0) -
    2 * actor.exhaustion +
    (ability === 'dexterity' && !ignoreCover && actor.cover !== 99
      ? actor.cover
      : 0);
  const advantage =
    ability === 'dexterity' &&
    actor.turn.dodging &&
    !incapacitated(actor) &&
    effectiveSpeed(actor) > 0;
  const disadvantage =
    (ability === 'dexterity' && hasCondition(actor, 'restrained')) ||
    (!actor.armorTrained && ['strength', 'dexterity'].includes(ability));
  const roll: DmRoll = auto
    ? {
        kind: `${ability} save`,
        actorId: actor.id,
        dice: [],
        modifier: bonus,
        total: 0,
        dc,
        success: false,
        automatic: true,
        advantage: 'normal',
      }
    : rollD20(
        actor.id,
        `${ability} save`,
        bonus,
        dc,
        advantage,
        disadvantage,
        die,
      );
  recordRoll(events, actor, roll, [7, 179, 181]);
  return roll;
}
export function heal(actor: DmActor, amount: number, events: DmEvent[]) {
  integer(amount, 0, 100000, 'healing');
  if (hasEffect(actor, 'no-healing')) {
    event(
      events,
      `${actor.name} cannot regain HP until Chill Touch ends.`,
      [115],
    );
    return;
  }
  if (actor.dead) {
    event(
      events,
      `${actor.name} is dead; ordinary healing has no effect.`,
      [17, 180],
    );
    return;
  }
  const regained = Math.min(amount, actor.maxHp - actor.hp);
  actor.hp += regained;
  if (actor.hp > 0) {
    actor.deathSaves = { successes: 0, failures: 0 };
    actor.stable = false;
    actor.conditions = actor.conditions.filter(
      (c) =>
        !(
          c.name === 'unconscious' &&
          ['zero-hp', 'knockout'].includes(c.sourceId ?? '')
        ),
    );
  }
  event(
    events,
    `${actor.name} regains ${regained} HP (${actor.hp}/${actor.maxHp}).`,
    [17],
  );
}
export function applyDamage(
  actor: DmActor,
  amount: number,
  type: DamageType,
  events: DmEvent[],
  die: DieRoller = secureDie,
  critical = false,
  nonlethal = false,
) {
  integer(amount, 0, 100000, 'damage');
  let damage = actor.immunities.includes(type) ? 0 : amount;
  if (actor.resistances.includes(type) || hasCondition(actor, 'petrified'))
    damage = Math.floor(damage / 2);
  if (actor.vulnerabilities.includes(type)) damage *= 2;
  const absorbed = Math.min(actor.tempHp, damage);
  actor.tempHp -= absorbed;
  const hpDamage = damage - absorbed;
  const beforeHp = actor.hp;
  actor.hp = Math.max(0, actor.hp - hpDamage);
  event(
    events,
    `${actor.name} takes ${damage} ${type} damage${absorbed ? ` (${absorbed} absorbed by temporary HP)` : ''}; ${actor.hp}/${actor.maxHp} HP.`,
    [16, 17, 18],
  );
  if (damage === 0 || actor.dead) return;
  if (beforeHp === 0) {
    actor.stable = false;
    actor.deathSaves.failures = Math.min(
      3,
      actor.deathSaves.failures + (critical ? 2 : 1),
    );
    if (damage >= actor.maxHp || actor.deathSaves.failures >= 3)
      actor.dead = true;
  } else if (actor.hp === 0) {
    // A melee attacker can choose to leave a creature at 1 HP, Unconscious,
    // beginning a Short Rest (2024 rule, not the 2014 stable-at-zero rule).
    if (nonlethal) {
      actor.hp = 1;
      addCondition(actor, 'unconscious', events, 'knockout');
      addCondition(actor, 'prone', events);
      event(
        events,
        `${actor.name} is knocked out at 1 HP and begins a Short Rest.`,
        [17, 184],
      );
    } else {
      actor.dead = !actor.usesDeathSaves || hpDamage - beforeHp >= actor.maxHp;
      actor.stable = false;
      addCondition(actor, 'unconscious', events, 'zero-hp');
      addCondition(actor, 'prone', events);
    }
  }
  if (actor.dead || incapacitated(actor)) endConcentration(actor, events);
  else if (actor.concentration) {
    const dc = Math.min(30, Math.max(10, Math.floor(damage / 2)));
    if (!resolveSave(actor, 'constitution', dc, events, die).success)
      endConcentration(actor, events);
  }
  if (actor.dead) event(events, `${actor.name} dies.`, [17, 18]);
}
export function deathSave(
  actor: DmActor,
  events: DmEvent[],
  die: DieRoller = secureDie,
) {
  if (actor.hp > 0 || actor.stable || actor.dead) return;
  const roll = rollD20(
    actor.id,
    'death save',
    -2 * actor.exhaustion,
    10,
    false,
    false,
    die,
  );
  recordRoll(events, actor, roll, [18, 181]);
  if (roll.dice[0] === 20) {
    heal(actor, 1, events);
    return;
  }
  if (roll.dice[0] === 1) actor.deathSaves.failures += 2;
  else if (roll.success) actor.deathSaves.successes++;
  else actor.deathSaves.failures++;
  if (actor.deathSaves.failures >= 3) {
    actor.dead = true;
    endConcentration(actor, events);
    event(events, `${actor.name} dies.`, [18]);
  } else if (actor.deathSaves.successes >= 3) {
    actor.stable = true;
    actor.deathSaves = { successes: 0, failures: 0 };
    event(events, `${actor.name} is stable at 0 HP.`, [18]);
  }
}
function requireTurn(state: DungeonMasterState, actor: DmActor) {
  assert(!actor.dead, `${actor.name} is dead.`);
  if (state.inCombat)
    assert(
      state.order[state.turnIndex] === actor.id,
      `It is not ${actor.name}'s turn.`,
    );
}
function spendAction(
  state: DungeonMasterState,
  actor: DmActor,
  type: 'action' | 'bonus' = 'action',
) {
  requireTurn(state, actor);
  assert(!incapacitated(actor), `${actor.name} is Incapacitated.`);
  if (state.inCombat) {
    assert(actor.turn[type], `${actor.name} has already used their ${type}.`);
    actor.turn[type] = false;
  }
}
function spendAttack(state: DungeonMasterState, actor: DmActor) {
  requireTurn(state, actor);
  assert(!incapacitated(actor), `${actor.name} is Incapacitated.`);
  if (!state.inCombat) return;
  if (actor.turn.attacks === 0) {
    spendAction(state, actor);
    actor.turn.attacks = actor.attacksPerAction;
  }
  assert(actor.turn.attacks > 0, 'No attacks remain.');
  actor.turn.attacks--;
}
function releaseInvalidGrapples(state: DungeonMasterState) {
  for (const actor of state.actors)
    actor.conditions = actor.conditions.filter((c) => {
      if (c.name !== 'grappled' || !c.sourceId) return true;
      const source = state.actors.find((a) => a.id === c.sourceId);
      return (
        source &&
        !incapacitated(source) &&
        distance(source.position, actor.position) <= 5
      );
    });
}
function attackRoll(
  state: DungeonMasterState,
  actor: DmActor,
  target: DmActor,
  bonus: number,
  ranged: boolean,
  longRange: boolean,
  events: DmEvent[],
  die: DieRoller,
  attackAbility?: DmAbility,
) {
  assert(target.cover !== 99, 'The target has Total Cover.');
  assert(
    !actor.conditions.some(
      (c) => c.name === 'charmed' && c.sourceId === target.id,
    ),
    'A Charmed creature cannot attack its charmer.',
  );
  const near = distance(actor.position, target.position) <= 5;
  // Unseen/Invisible targets need adjudication of location and special senses.
  if (
    (hasCondition(target, 'invisible') && !hasEffect(target, 'visible-glow')) ||
    (hasCondition(actor, 'invisible') && !hasEffect(actor, 'visible-glow'))
  )
    throw new RulingRequired(
      'Resolve visibility, detection, and special senses before this attack.',
      [14, 184],
    );
  if (hasCondition(actor, 'frightened'))
    throw new RulingRequired(
      'Determine whether the source of fear is in sight before attacking.',
      [182],
    );
  const advantage =
    hasEffect(target, 'next-attack-advantage') ||
    [
      'blinded',
      'paralyzed',
      'petrified',
      'restrained',
      'stunned',
      'unconscious',
    ].some((c) => hasCondition(target, c as DmCondition)) ||
    (hasCondition(target, 'prone') && near);
  const adjacentEnemy = state.actors.some(
    (a) =>
      a.side !== actor.side &&
      !incapacitated(a) &&
      !hasCondition(a, 'blinded') &&
      distance(a.position, actor.position) <= 5,
  );
  const disadvantage =
    (!actor.armorTrained &&
      (attackAbility === 'strength' || attackAbility === 'dexterity')) ||
    hasEffect(actor, 'next-attack-disadvantage') ||
    ['blinded', 'poisoned', 'prone', 'restrained'].some((c) =>
      hasCondition(actor, c as DmCondition),
    ) ||
    (hasCondition(target, 'prone') && !near) ||
    (ranged && adjacentEnemy) ||
    longRange ||
    (target.turn.dodging &&
      !incapacitated(target) &&
      effectiveSpeed(target) > 0 &&
      !hasCondition(target, 'blinded')) ||
    actor.conditions.some(
      (c) => c.name === 'grappled' && c.sourceId !== target.id,
    );
  actor.effects = actor.effects?.filter(
    (e) => e.kind !== 'next-attack-disadvantage',
  );
  target.effects = target.effects?.filter(
    (e) => e.kind !== 'next-attack-advantage',
  );
  const roll = rollD20(
    actor.id,
    'attack',
    bonus - 2 * actor.exhaustion,
    target.ac + target.cover,
    advantage,
    disadvantage,
    die,
  );
  if (
    roll.success &&
    near &&
    (hasCondition(target, 'paralyzed') || hasCondition(target, 'unconscious'))
  )
    roll.critical = true;
  recordRoll(events, actor, roll, [7, 14, 15, 16]);
  return roll;
}

interface SpellProfile {
  name: string;
  level: number;
  page: number;
  range: number;
  die: number;
  dice: number;
  upcast: number;
  type?: DamageType;
  resolution: 'ranged' | 'melee' | 'save' | 'heal' | 'kill';
  save?: DmAbility;
  half?: boolean;
  bonus?: boolean;
  somatic?: boolean;
  visible?: boolean;
  ignoresCover?: boolean;
  beams?: boolean;
  fixedHealing?: number;
  fixedHealingPerLevel?: number;
  endsConditions?: DmCondition[];
  effect?: DmTimedEffect['kind'];
}
/** Each profile is deliberately complete for its single-target creature effect.
 * Other spells are looked up in the complete SRD and return a ruling request.
 */
export const AUTOMATED_SPELLS: Record<string, SpellProfile> = {
  'eldritch-blast': {
    name: 'Eldritch Blast',
    level: 0,
    page: 127,
    range: 120,
    die: 10,
    dice: 1,
    upcast: 0,
    type: 'force',
    resolution: 'ranged',
    somatic: true,
    beams: true,
  },
  'scorching-ray': {
    name: 'Scorching Ray',
    level: 2,
    page: 159,
    range: 120,
    die: 6,
    dice: 2,
    upcast: 1,
    type: 'fire',
    resolution: 'ranged',
    somatic: true,
    beams: true,
  },
  'ray-of-frost': {
    name: 'Ray of Frost',
    level: 0,
    page: 157,
    range: 60,
    die: 8,
    dice: 1,
    upcast: 0,
    type: 'cold',
    resolution: 'ranged',
    somatic: true,
    effect: 'slow-10',
  },
  'ray-of-sickness': {
    name: 'Ray of Sickness',
    level: 1,
    page: 158,
    range: 60,
    die: 8,
    dice: 2,
    upcast: 1,
    type: 'poison',
    resolution: 'ranged',
    somatic: true,
    effect: 'poisoned',
  },
  'guiding-bolt': {
    name: 'Guiding Bolt',
    level: 1,
    page: 138,
    range: 120,
    die: 6,
    dice: 4,
    upcast: 1,
    type: 'radiant',
    resolution: 'ranged',
    somatic: true,
    effect: 'next-attack-advantage',
  },
  'chill-touch': {
    name: 'Chill Touch',
    level: 0,
    page: 115,
    range: 5,
    die: 10,
    dice: 1,
    upcast: 0,
    type: 'necrotic',
    resolution: 'melee',
    somatic: true,
    effect: 'no-healing',
  },
  'shocking-grasp': {
    name: 'Shocking Grasp',
    level: 0,
    page: 162,
    range: 5,
    die: 8,
    dice: 1,
    upcast: 0,
    type: 'lightning',
    resolution: 'melee',
    somatic: true,
    effect: 'no-opportunity-attacks',
  },
  'starry-wisp': {
    name: 'Starry Wisp',
    level: 0,
    page: 165,
    range: 60,
    die: 8,
    dice: 1,
    upcast: 0,
    type: 'radiant',
    resolution: 'ranged',
    somatic: true,
    effect: 'visible-glow',
  },
  'vicious-mockery': {
    name: 'Vicious Mockery',
    level: 0,
    page: 172,
    range: 60,
    die: 6,
    dice: 1,
    upcast: 0,
    type: 'psychic',
    resolution: 'save',
    save: 'wisdom',
    effect: 'next-attack-disadvantage',
  },
  heal: {
    name: 'Heal',
    level: 6,
    page: 139,
    range: 60,
    die: 8,
    dice: 0,
    upcast: 0,
    resolution: 'heal',
    somatic: true,
    visible: true,
    fixedHealing: 70,
    fixedHealingPerLevel: 10,
    endsConditions: ['blinded', 'deafened', 'poisoned'],
  },
  'power-word-kill': {
    name: 'Power Word Kill',
    level: 9,
    page: 154,
    range: 60,
    die: 12,
    dice: 12,
    upcast: 0,
    resolution: 'kill',
    visible: true,
    type: 'psychic',
  },

  'fire-bolt': {
    name: 'Fire Bolt',
    level: 0,
    page: 132,
    range: 120,
    die: 10,
    dice: 1,
    upcast: 0,
    type: 'fire',
    resolution: 'ranged',
    somatic: true,
  },
  'poison-spray': {
    name: 'Poison Spray',
    level: 0,
    page: 153,
    range: 30,
    die: 12,
    dice: 1,
    upcast: 0,
    type: 'poison',
    resolution: 'ranged',
    somatic: true,
  },
  'sacred-flame': {
    name: 'Sacred Flame',
    level: 0,
    page: 159,
    range: 60,
    die: 8,
    dice: 1,
    upcast: 0,
    type: 'radiant',
    resolution: 'save',
    save: 'dexterity',
    visible: true,
    somatic: true,
    ignoresCover: true,
  },
  'cure-wounds': {
    name: 'Cure Wounds',
    level: 1,
    page: 121,
    range: 5,
    die: 8,
    dice: 2,
    upcast: 2,
    resolution: 'heal',
    somatic: true,
  },
  'healing-word': {
    name: 'Healing Word',
    level: 1,
    page: 139,
    range: 60,
    die: 4,
    dice: 2,
    upcast: 2,
    resolution: 'heal',
    bonus: true,
    visible: true,
  },
  'inflict-wounds': {
    name: 'Inflict Wounds',
    level: 1,
    page: 143,
    range: 5,
    die: 10,
    dice: 2,
    upcast: 1,
    type: 'necrotic',
    resolution: 'save',
    save: 'constitution',
    half: true,
    somatic: true,
  },
};
function expireEffects(
  state: DungeonMasterState,
  actorId?: string,
  phase?: 'start' | 'end',
) {
  for (const actor of state.actors)
    actor.effects = actor.effects?.filter((e) => {
      if (actorId === e.expiresOnActorId && phase === e.phase)
        return --e.occurrences > 0;
      if (!state.inCombat && e.expiresAtMinute <= state.elapsedMinutes)
        return false;
      return true;
    });
}
function addSpellEffect(
  state: DungeonMasterState,
  actor: DmActor,
  target: DmActor,
  kind: DmTimedEffect['kind'],
) {
  if (kind === 'poisoned' && target.conditionImmunities.includes('poisoned'))
    return;
  const expiresOnTarget =
    kind === 'no-opportunity-attacks' || kind === 'next-attack-disadvantage';
  const phase =
    kind === 'slow-10' || kind === 'no-opportunity-attacks' ? 'start' : 'end';
  const occurrences =
    phase === 'end' && (!expiresOnTarget || target.id === actor.id) ? 2 : 1;
  // Same spell effects do not stack; replacing the equal effect retains its latest duration.
  target.effects = [
    ...(target.effects ?? []).filter((e) => e.kind !== kind),
    {
      id: crypto.randomUUID(),
      kind,
      sourceId: actor.id,
      expiresOnActorId: expiresOnTarget ? target.id : actor.id,
      phase,
      occurrences,
      expiresAtMinute: state.elapsedMinutes + occurrences * 0.1,
    },
  ];
}
function cast(
  state: DungeonMasterState,
  action: Extract<DmAction, { kind: 'cast' }>,
  events: DmEvent[],
  die: DieRoller,
) {
  const actor = findActor(state, action.actorId);
  const spell = AUTOMATED_SPELLS[action.spellId];
  if (!spell)
    throw new RulingRequired(
      `The effect of ${action.spellId} needs SRD adjudication; no spell slot has been spent.`,
      [104, 105, 106],
    );
  assert(
    actor.preparedSpells.includes(action.spellId),
    'The spell is not prepared.',
  );
  assert(actor.spellcastingAbility, 'No spellcasting ability is configured.');
  assert(actor.armorTrained, 'Cannot cast spells in armor without training.');
  assert(actor.canSpeak, 'The Verbal component is unavailable.');
  assert(
    !spell.somatic || actor.freeHand,
    'The Somatic component requires a free hand.',
  );
  integer(action.slotLevel, 0, 9, 'spell slot level');
  if (spell.level === 0)
    assert(action.slotLevel === 0, 'Cantrips do not use spell slots.');
  else {
    assert(
      action.slotLevel >= spell.level,
      'The slot is too low for this spell.',
    );
    assert(
      actor.spellSlots[String(action.slotLevel)]?.current > 0,
      'No spell slot remains at that level.',
    );
    assert(
      actor.turn.slotSpentOnTurn !== state.turnSerial,
      'Only one spell slot may be spent to cast a spell on a turn.',
    );
  }
  const scale =
    actor.level >= 17 ? 4 : actor.level >= 11 ? 3 : actor.level >= 5 ? 2 : 1;
  const beams = spell.beams
    ? spell.level === 0
      ? scale
      : 3 + action.slotLevel - spell.level
    : 1;
  assert(
    action.targetIds.length === 1 ||
      (spell.beams && action.targetIds.length === beams),
    'Choose one target for all beams, or one target per beam.',
  );
  if (
    action.spellId === 'vicious-mockery' &&
    hasCondition(actor, 'blinded') &&
    hasCondition(actor, 'deafened')
  )
    throw new RulingRequired(
      'Vicious Mockery requires a creature you can see or hear.',
      [171, 172],
    );
  const targets = Array.from({ length: beams }, (_, i) =>
    findActor(
      state,
      action.targetIds.length === 1 ? action.targetIds[0] : action.targetIds[i],
    ),
  );
  for (const target of targets) {
    assert(
      distance(actor.position, target.position) <= spell.range,
      'Target is outside the spell range.',
    );
    assert(target.cover !== 99, 'Target has Total Cover.');
    if (
      spell.visible &&
      (hasCondition(actor, 'blinded') ||
        (hasCondition(target, 'invisible') &&
          !hasEffect(target, 'visible-glow')))
    )
      throw new RulingRequired(
        'This spell requires a visible target; resolve special senses first.',
        [105, 177, 184],
      );
    if (spell.resolution !== 'heal')
      assert(
        !actor.conditions.some(
          (c) => c.name === 'charmed' && c.sourceId === target.id,
        ),
        'Cannot target the charmer with a damaging effect.',
      );
  }
  spendAction(state, actor, spell.bonus ? 'bonus' : 'action');
  if (spell.level > 0) {
    actor.spellSlots[String(action.slotLevel)].current--;
    actor.turn.slotSpentOnTurn = state.turnSerial;
  }
  const ability = abilityModifier(actor.abilities[actor.spellcastingAbility]);
  for (const target of targets) {
    if (spell.resolution === 'kill' && target.hp <= 100) {
      target.dead = true;
      endConcentration(target, events);
      event(events, `${actor.name} casts ${spell.name}: ${target.name} dies.`, [
        spell.page,
      ]);
      continue;
    }
    if (spell.fixedHealing !== undefined) {
      heal(
        target,
        spell.fixedHealing +
          (action.slotLevel - spell.level) * (spell.fixedHealingPerLevel ?? 0),
        events,
      );
      target.conditions = target.conditions.filter(
        (c) => !spell.endsConditions?.includes(c.name),
      );
      target.effects = target.effects?.filter((e) => e.kind !== 'poisoned');
      event(
        events,
        `${spell.name} ends Blinded, Deafened and Poisoned on ${target.name}.`,
        [spell.page],
      );
      continue;
    }
    const count = spell.beams
      ? spell.dice
      : spell.level === 0
        ? scale
        : spell.dice + (action.slotLevel - spell.level) * spell.upcast;
    let critical = false;
    if (spell.resolution === 'ranged' || spell.resolution === 'melee') {
      const roll = attackRoll(
        state,
        actor,
        target,
        ability + actor.proficiencyBonus,
        spell.resolution === 'ranged',
        false,
        events,
        die,
      );
      if (!roll.success) continue;
      critical = !!roll.critical;
    }
    const result = rollDice(`${count}d${spell.die}`, die, critical);
    event(
      events,
      `${actor.name} casts ${spell.name}: [${result.dice.join(', ')}].`,
      [spell.page, 105],
    );
    if (spell.resolution === 'heal') {
      heal(target, Math.max(0, result.total + ability), events);
      continue;
    }
    let damage = result.total;
    let affected = true;
    if (spell.resolution === 'save') {
      const save = resolveSave(
        target,
        spell.save!,
        8 + ability + actor.proficiencyBonus,
        events,
        die,
        spell.ignoresCover,
      );
      if (save.success) {
        damage = spell.half ? Math.floor(damage / 2) : 0;
        affected = false;
      }
    }
    applyDamage(target, damage, spell.type!, events, die, critical);
    if (spell.effect && affected) {
      addSpellEffect(state, actor, target, spell.effect);
      event(
        events,
        `${spell.name}'s ${spell.effect} effect applies to ${target.name}.`,
        [spell.page],
      );
    }
  }
}

/** Pure transaction: illegal/unsupported actions never change the input state. */
export function executeAction(
  input: DungeonMasterState,
  action: DmAction,
  die: DieRoller = secureDie,
): { state: DungeonMasterState; events: DmEvent[] } {
  validateDungeonMasterState(input);
  validateAction(action);
  const state: DungeonMasterState = structuredClone(input);
  const events: DmEvent[] = [];
  const actor =
    'actorId' in action ? findActor(state, action.actorId) : undefined;
  if (
    !state.inCombat &&
    actor &&
    !['short-rest', 'long-rest'].includes(action.kind)
  ) {
    state.turnSerial++;
    state.elapsedMinutes += 0.1;
    actor.turn = freshTurn();
    expireEffects(state);
  }
  switch (action.kind) {
    case 'start-combat': {
      assert(!state.inCombat, 'Combat is already active.');
      const rolls = state.actors
        .filter((a) => !a.dead)
        .map((a, index) => {
          a.turn = freshTurn();
          const r = rollD20(
            a.id,
            'initiative',
            abilityModifier(a.abilities.dexterity) - 2 * a.exhaustion,
            0,
            hasCondition(a, 'invisible'),
            a.surprised || incapacitated(a),
            die,
          );
          recordRoll(events, a, r, [13, 184, 189]);
          return { id: a.id, total: r.total, index };
        })
        .sort((a, b) => b.total - a.total || a.index - b.index);
      assert(rolls.length > 0, 'Add a creature before starting combat.');
      if (rolls.some((r, i) => i > 0 && rolls[i - 1].total === r.total))
        event(
          events,
          'Initiative ties use roster order; the table may adjudicate a different tie order before acting.',
          [13],
        );
      state.order = rolls.map((r) => r.id);
      state.turnIndex = 0;
      state.round = 1;
      state.inCombat = true;
      state.turnSerial++;
      deathSave(findActor(state, state.order[0]), events, die);
      break;
    }
    case 'end-combat':
      assert(state.inCombat, 'No combat is active.');
      state.inCombat = false;
      state.order = [];
      state.turnIndex = 0;
      state.actors.forEach((a) => {
        a.turn = freshTurn();
        a.surprised = false;
      });
      event(events, 'Combat ends.', [13]);
      break;
    case 'end-turn': {
      assert(state.inCombat, 'No combat is active.');
      assert(
        state.order[state.turnIndex] === actor!.id,
        'It is not this creature’s turn.',
      );
      expireEffects(state, actor!.id, 'end');
      let attempts = 0;
      do {
        state.turnIndex = (state.turnIndex + 1) % state.order.length;
        if (state.turnIndex === 0) {
          state.round++;
          state.elapsedMinutes += 0.1;
        }
        attempts++;
        const skipped = findActor(state, state.order[state.turnIndex]);
        if (skipped.dead) {
          expireEffects(state, skipped.id, 'start');
          expireEffects(state, skipped.id, 'end');
        }
      } while (
        findActor(state, state.order[state.turnIndex]).dead &&
        attempts < state.order.length
      );
      if (
        attempts === state.order.length &&
        state.actors.every((a) => a.dead)
      ) {
        state.inCombat = false;
        break;
      }
      state.turnSerial++;
      const next = findActor(state, state.order[state.turnIndex]);
      next.turn = freshTurn();
      expireEffects(state, next.id, 'start');
      if (next.concentration && --next.concentration.remainingRounds <= 0)
        endConcentration(next, events);
      event(events, `Round ${state.round}: ${next.name}'s turn.`, [13]);
      deathSave(next, events, die);
      break;
    }
    case 'check': {
      assert(!actor!.dead, 'A dead creature cannot make an ability check.');
      if (state.inCombat) spendAction(state, actor!);
      if (hasCondition(actor!, 'frightened'))
        throw new RulingRequired(
          'Determine whether the source of fear is visible before the ability check.',
          [182],
        );
      const mod =
        abilityModifier(actor!.abilities[action.ability]) +
        skillBonus(actor!, action.skill) -
        2 * actor!.exhaustion;
      const disadvantage =
        hasCondition(actor!, 'poisoned') ||
        (!actor!.armorTrained &&
          ['strength', 'dexterity'].includes(action.ability));
      const roll = rollD20(
        actor!.id,
        action.skill ?? `${action.ability} check`,
        mod,
        action.dc,
        false,
        disadvantage,
        die,
      );
      recordRoll(events, actor!, roll, [6, 8, 181]);
      break;
    }
    case 'save':
      resolveSave(actor!, action.ability, action.dc, events, die);
      break;
    case 'attack': {
      const target = findActor(state, action.targetId);
      const weapon = actor!.weapons.find((w) => w.id === action.weaponId);
      assert(weapon, 'This weapon is not equipped.');
      const d = distance(actor!.position, target.position);
      const ranged = weapon.range !== undefined;
      assert(
        d <= (weapon.longRange ?? weapon.range ?? weapon.reach),
        'Target is outside weapon range.',
      );
      assert(
        !action.nonlethal || !ranged,
        'Only a melee attack can knock a creature out.',
      );
      spendAttack(state, actor!);
      const mod = abilityModifier(actor!.abilities[weapon.ability]);
      const roll = attackRoll(
        state,
        actor!,
        target,
        weapon.attackBonus ??
          mod + (weapon.proficient ? actor!.proficiencyBonus : 0),
        ranged,
        ranged && d > weapon.range!,
        events,
        die,
        weapon.ability,
      );
      if (roll.success) {
        const result = rollDice(weapon.dice, die, roll.critical);
        event(
          events,
          `${weapon.name} damage dice: [${result.dice.join(', ')}].`,
          [16],
        );
        applyDamage(
          target,
          Math.max(0, result.total + (weapon.damageBonus ?? mod)),
          weapon.damageType,
          events,
          die,
          !!roll.critical,
          !!action.nonlethal,
        );
      }
      break;
    }
    case 'cast':
      cast(state, action, events, die);
      break;
    case 'move': {
      requireTurn(state, actor!);
      assert(effectiveSpeed(actor!) > 0, 'This creature has Speed 0.');
      if (hasCondition(actor!, 'frightened'))
        throw new RulingRequired(
          'Movement toward the source of fear is prohibited; determine the source first.',
          [182],
        );
      const cost =
        distance(actor!.position, action) *
        (1 +
          Number(!!action.difficult) +
          Number(hasCondition(actor!, 'prone')));
      assert(
        cost + actor!.turn.movement <= effectiveSpeed(actor!),
        'Not enough movement remains.',
      );
      const occupied = state.actors.some(
        (a) => a.id !== actor!.id && distance(a.position, action) === 0,
      );
      assert(
        !occupied,
        'Cannot willingly end movement in another creature’s space.',
      );
      const provoking = state.actors.some(
        (a) =>
          a.side !== actor!.side &&
          a.turn.reaction &&
          !hasEffect(a, 'no-opportunity-attacks') &&
          !incapacitated(a) &&
          !hasCondition(a, 'blinded') &&
          distance(a.position, actor!.position) <= 5 &&
          distance(a.position, action) > 5,
      );
      if (state.inCombat && provoking && !actor!.turn.disengaged)
        throw new RulingRequired(
          'Movement opens an Opportunity Attack choice. Resolve the reaction before moving.',
          [15, 185],
        );
      actor!.position = { x: action.x, y: action.y };
      actor!.turn.movement += cost;
      event(
        events,
        `${actor!.name} moves ${cost} feet of movement.`,
        [14, 179],
      );
      break;
    }
    case 'dash':
      spendAction(state, actor!);
      actor!.turn.movement -= effectiveSpeed(actor!);
      event(events, `${actor!.name} Dashes.`, [180]);
      break;
    case 'dodge':
      spendAction(state, actor!);
      actor!.turn.dodging = true;
      event(
        events,
        `${actor!.name} Dodges until the start of their next turn.`,
        [180],
      );
      break;
    case 'disengage':
      spendAction(state, actor!);
      actor!.turn.disengaged = true;
      event(events, `${actor!.name} Disengages.`, [180]);
      break;
    case 'stand': {
      requireTurn(state, actor!);
      assert(!incapacitated(actor!), 'Cannot stand while Incapacitated.');
      assert(hasCondition(actor!, 'prone'), 'Already standing.');
      const speed = effectiveSpeed(actor!);
      assert(
        speed > 0 && actor!.turn.movement + Math.floor(speed / 2) <= speed,
        'Cannot afford the movement to stand.',
      );
      actor!.turn.movement += Math.floor(speed / 2);
      actor!.conditions = actor!.conditions.filter((c) => c.name !== 'prone');
      event(events, `${actor!.name} stands up.`, [186]);
      break;
    }
    case 'drop-concentration':
      endConcentration(actor!, events);
      break;
    case 'grapple':
    case 'shove': {
      const target = findActor(state, action.targetId);
      assert(target.id !== actor!.id, 'Choose another creature.');
      assert(
        distance(actor!.position, target.position) <= 5,
        'Target must be within 5 feet.',
      );
      assert(target.size <= actor!.size + 1, 'Target is too large.');
      assert(
        action.kind !== 'grapple' || actor!.freeHand,
        'A grapple requires a free hand.',
      );
      assert(
        action.kind !== 'grapple' ||
          !state.actors.some(
            (a) =>
              a.id !== target.id &&
              a.conditions.some(
                (c) => c.name === 'grappled' && c.sourceId === actor!.id,
              ),
          ),
        'The recorded free hand is already grappling a creature.',
      );
      spendAttack(state, actor!);
      const dc =
        8 +
        abilityModifier(actor!.abilities.strength) +
        actor!.proficiencyBonus;
      const save = resolveSave(target, action.saveAbility, dc, events, die);
      if (!save.success)
        addCondition(
          target,
          action.kind === 'grapple' ? 'grappled' : 'prone',
          events,
          actor!.id,
          dc,
        );
      event(
        events,
        `${actor!.name} attempts to ${action.kind} ${target.name}${action.kind === 'shove' ? ' prone' : ''}.`,
        [190],
      );
      break;
    }
    case 'escape': {
      const grapple = actor!.conditions.find((c) => c.name === 'grappled');
      assert(grapple?.escapeDC, 'No grapple with a known escape DC.');
      spendAction(state, actor!);
      const skill = action.ability === 'strength' ? 'athletics' : 'acrobatics';
      const roll = rollD20(
        actor!.id,
        'escape grapple',
        abilityModifier(actor!.abilities[action.ability]) +
          skillBonus(actor!, skill) -
          2 * actor!.exhaustion,
        grapple.escapeDC,
        false,
        hasCondition(actor!, 'poisoned'),
        die,
      );
      recordRoll(events, actor!, roll, [182]);
      if (roll.success)
        actor!.conditions = actor!.conditions.filter((c) => c !== grapple);
      break;
    }
    case 'stabilize': {
      const target = findActor(state, action.targetId);
      assert(!target.dead && target.hp === 0, 'Target must be alive at 0 HP.');
      assert(
        distance(actor!.position, target.position) <= 5,
        'Target is out of reach.',
      );
      spendAction(state, actor!);
      const roll = rollD20(
        actor!.id,
        'medicine',
        abilityModifier(actor!.abilities.wisdom) +
          skillBonus(actor!, 'medicine') -
          2 * actor!.exhaustion,
        10,
        false,
        hasCondition(actor!, 'poisoned'),
        die,
      );
      recordRoll(events, actor!, roll, [18]);
      if (roll.success) {
        target.stable = true;
        target.deathSaves = { successes: 0, failures: 0 };
      }
      break;
    }
    case 'short-rest':
    case 'long-rest': {
      assert(!state.inCombat, 'Cannot rest during combat.');
      assert(
        actor!.hp > 0 && !actor!.dead,
        'Must start a rest with at least 1 HP.',
      );
      if (action.kind === 'short-rest') {
        integer(
          action.hitDice,
          0,
          actor!.hitDice.current,
          'Hit Dice expenditure',
        );
        state.elapsedMinutes += 60;
        expireEffects(state);
        for (let i = 0; i < action.hitDice; i++) {
          const rolled = die(actor!.hitDice.die);
          actor!.hitDice.current--;
          event(
            events,
            `${actor!.name} spends a d${actor!.hitDice.die}: ${rolled}.`,
            [187],
          );
          heal(
            actor!,
            Math.max(
              1,
              rolled + abilityModifier(actor!.abilities.constitution),
            ),
            events,
          );
        }
      } else {
        assert(
          actor!.lastLongRestEnd === undefined ||
            state.elapsedMinutes - actor!.lastLongRestEnd >= 960,
          'Wait at least 16 hours after the last Long Rest before starting another.',
        );
        state.elapsedMinutes += 480;
        expireEffects(state);
        actor!.lastLongRestEnd = state.elapsedMinutes;
        heal(actor!, actor!.maxHp, events);
        actor!.hitDice.current = actor!.hitDice.max;
        actor!.tempHp = 0;
        actor!.exhaustion = Math.max(0, actor!.exhaustion - 1);
        Object.values(actor!.spellSlots).forEach((s) => {
          s.current = s.max;
        });
      }
      actor!.conditions = actor!.conditions.filter(
        (c) => c.sourceId !== 'knockout',
      );
      Object.values(actor!.resources)
        .filter((r) => action.kind === 'long-rest' || r.recovery === 'short')
        .forEach((r) => {
          r.current = r.max;
        });
      // A rest advances time for everyone, including spell durations.
      const rounds = action.kind === 'long-rest' ? 4800 : 600;
      state.actors.forEach((a) => {
        if (a.concentration) {
          a.concentration.remainingRounds -= rounds;
          if (a.concentration.remainingRounds <= 0) endConcentration(a, events);
        }
      });
      actor!.turn = freshTurn();
      event(
        events,
        `${actor!.name} completes an uninterrupted ${action.kind === 'long-rest' ? 'Long' : 'Short'} Rest.`,
        [185, 187],
      );
      break;
    }
  }
  expireEffects(state);
  releaseInvalidGrapples(state);
  state.revision++;
  state.events.push(...events);
  return { state, events };
}

/** Runtime validation is mandatory: a provider's JSON-schema promise isn't validation. */
export function validateAction(value: unknown): asserts value is DmAction {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected an action object.');
  const a = value as Record<string, unknown>;
  const shape: Record<string, string[]> = {
    'start-combat': [],
    'end-combat': [],
    'end-turn': ['actorId'],
    check: ['actorId', 'ability', 'dc', 'skill?'],
    save: ['actorId', 'ability', 'dc'],
    attack: ['actorId', 'targetId', 'weaponId', 'nonlethal?'],
    cast: ['actorId', 'targetIds', 'spellId', 'slotLevel'],
    move: ['actorId', 'x', 'y', 'difficult?'],
    dash: ['actorId'],
    dodge: ['actorId'],
    disengage: ['actorId'],
    stand: ['actorId'],
    'drop-concentration': ['actorId'],
    grapple: ['actorId', 'targetId', 'saveAbility'],
    shove: ['actorId', 'targetId', 'saveAbility'],
    escape: ['actorId', 'ability'],
    stabilize: ['actorId', 'targetId'],
    'short-rest': ['actorId', 'hitDice'],
    'long-rest': ['actorId'],
  };
  if (typeof a.kind !== 'string' || !Object.hasOwn(shape, a.kind))
    throw new Error('Unsupported action kind.');
  const fields = shape[a.kind];
  if (
    Object.keys(a).some(
      (k) => k !== 'kind' && !fields.some((f) => f.replace('?', '') === k),
    )
  )
    throw new Error('Unexpected action field.');
  for (const field of fields.filter((f) => !f.endsWith('?')))
    if (a[field] === undefined) throw new Error(`Missing ${field}.`);
  for (const field of ['actorId', 'targetId', 'weaponId', 'spellId'])
    if (
      a[field] !== undefined &&
      (typeof a[field] !== 'string' ||
        !a[field] ||
        (a[field] as string).length > 200)
    )
      throw new Error(`Invalid ${field}.`);
  const abilities = [
    'strength',
    'dexterity',
    'constitution',
    'intelligence',
    'wisdom',
    'charisma',
  ];
  if (a.ability !== undefined && !abilities.includes(a.ability as string))
    throw new Error('Invalid ability.');
  if (
    a.kind === 'escape' &&
    !['strength', 'dexterity'].includes(a.ability as string)
  )
    throw new Error('Escape uses Strength or Dexterity.');
  if (
    a.saveAbility !== undefined &&
    !['strength', 'dexterity'].includes(a.saveAbility as string)
  )
    throw new Error('Invalid grapple/shove save.');
  if (
    a.skill !== undefined &&
    (typeof a.skill !== 'string' || !Object.hasOwn(SKILL_ABILITIES, a.skill))
  )
    throw new Error('Unknown skill.');
  for (const field of ['dc', 'slotLevel', 'hitDice', 'x', 'y'])
    if (a[field] !== undefined)
      integer(
        a[field] as number,
        field === 'x' || field === 'y' ? -10000 : 0,
        field === 'slotLevel' ? 9 : field === 'dc' ? 100 : 10000,
        field,
      );
  for (const field of ['nonlethal', 'difficult'])
    if (a[field] !== undefined && typeof a[field] !== 'boolean')
      throw new Error(`Invalid ${field}.`);
  if (
    a.targetIds !== undefined &&
    (!Array.isArray(a.targetIds) ||
      a.targetIds.length < 1 ||
      a.targetIds.length > 40 ||
      a.targetIds.some(
        (id) => typeof id !== 'string' || !id || id.length > 200,
      ))
  )
    throw new Error('Invalid targets.');
}
