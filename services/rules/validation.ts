import type { DungeonMasterState, DmActor } from '@/types/index';

const conditions = [
  'blinded',
  'charmed',
  'deafened',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious',
];
const damageTypes = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
];
const abilities = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
];
function fail(message: string): never {
  throw new Error(`Invalid play state: ${message}`);
}
function object(v: unknown): asserts v is Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v))
    fail('expected an object');
}
function number(
  v: unknown,
  min: number,
  max: number,
  label: string,
  whole = true,
) {
  if (
    typeof v !== 'number' ||
    !Number.isFinite(v) ||
    v < min ||
    v > max ||
    (whole && !Number.isInteger(v))
  )
    fail(label);
}
function string(v: unknown, label: string, max = 200) {
  if (typeof v !== 'string' || !v.trim() || v.length > max) fail(label);
}
function list(v: unknown, label: string, max = 10000): asserts v is unknown[] {
  if (!Array.isArray(v) || v.length > max) fail(label);
}
function bool(v: unknown, label: string) {
  if (typeof v !== 'boolean') fail(label);
}
function pool(v: unknown) {
  object(v);
  number(v.max, 0, 1000, 'resource maximum');
  number(v.current, 0, v.max as number, 'resource value');
}

export function validateActor(value: unknown): asserts value is DmActor {
  object(value);
  const a = value;
  string(a.id, 'creature ID');
  string(a.name, 'creature name');
  if (!['party', 'opposition'].includes(a.side as string))
    fail('creature side');
  number(a.level, 1, 20, 'level');
  number(a.proficiencyBonus, 0, 12, 'proficiency');
  object(a.abilities);
  for (const ability of abilities) number(a.abilities[ability], 1, 30, ability);
  list(a.saves, 'save proficiencies', 6);
  if (a.saves.some((s) => !abilities.includes(s as string)))
    fail('save proficiency');
  object(a.skills);
  if (
    Object.values(a.skills).some(
      (s) => !['none', 'half', 'proficient', 'expertise'].includes(s as string),
    )
  )
    fail('skill proficiency');
  number(a.ac, 0, 40, 'Armor Class');
  number(a.maxHp, 1, 100000, 'maximum HP');
  number(a.hp, 0, a.maxHp as number, 'HP');
  number(a.tempHp, 0, 100000, 'temporary HP');
  number(a.speed, 0, 1000, 'speed');
  number(a.size, 0, 5, 'size');
  string(a.creatureType, 'creature type');
  object(a.position);
  number(a.position.x, -10000, 10000, 'x');
  number(a.position.y, -10000, 10000, 'y');
  list(a.conditions, 'conditions', 100);
  for (const c of a.conditions) {
    object(c);
    if (!conditions.includes(c.name as string)) fail('condition name');
    if (c.sourceId !== undefined) string(c.sourceId, 'condition source');
    if (c.escapeDC !== undefined) number(c.escapeDC, 1, 100, 'escape DC');
  }
  for (const key of [
    'conditionImmunities',
    'resistances',
    'vulnerabilities',
    'immunities',
  ]) {
    list(a[key], key, 30);
    const choices = key === 'conditionImmunities' ? conditions : damageTypes;
    if ((a[key] as unknown[]).some((v) => !choices.includes(v as string)))
      fail(key);
  }
  if (a.effects !== undefined) {
    list(a.effects, 'timed effects', 100);
    for (const e of a.effects) {
      object(e);
      string(e.id, 'effect ID');
      string(e.sourceId, 'effect source');
      string(e.expiresOnActorId, 'expiry creature');
      if (
        ![
          'no-healing',
          'slow-10',
          'poisoned',
          'next-attack-advantage',
          'no-opportunity-attacks',
          'visible-glow',
          'next-attack-disadvantage',
        ].includes(e.kind as string)
      )
        fail('timed effect kind');
      if (!['start', 'end'].includes(e.phase as string)) fail('expiry phase');
      number(e.occurrences, 1, 1000, 'expiry count');
      number(e.expiresAtMinute, 0, 1e9, 'effect time', false);
    }
  }
  number(a.exhaustion, 0, 6, 'Exhaustion');
  for (const k of [
    'dead',
    'stable',
    'usesDeathSaves',
    'heroicInspiration',
    'canSpeak',
    'freeHand',
    'hasFocus',
    'armorTrained',
    'surprised',
  ])
    bool(a[k], k);
  if (a.exhaustion === 6 && !a.dead) fail('six Exhaustion levels cause death');
  object(a.deathSaves);
  number(a.deathSaves.successes, 0, 3, 'death-save successes');
  number(a.deathSaves.failures, 0, 4, 'death-save failures');
  pool(a.hitDice);
  if (
    ![4, 6, 8, 10, 12, 20].includes((a.hitDice as Record<string, number>).die)
  )
    fail('Hit Die');
  object(a.spellSlots);
  for (const [key, value] of Object.entries(a.spellSlots)) {
    if (!/^[1-9]$/.test(key)) fail('spell slot level');
    pool(value);
  }
  list(a.preparedSpells, 'prepared spells', 500);
  for (const s of a.preparedSpells) string(s, 'spell');
  if (
    a.spellcastingAbility !== undefined &&
    !abilities.includes(a.spellcastingAbility as string)
  )
    fail('spellcasting ability');
  object(a.resources);
  for (const r of Object.values(a.resources)) {
    pool(r);
    if (!['short', 'long'].includes((r as Record<string, string>).recovery))
      fail('resource recovery');
  }
  list(a.weapons, 'weapons', 30);
  const weaponIds = new Set<string>();
  for (const w of a.weapons) {
    object(w);
    string(w.id, 'weapon ID');
    string(w.name, 'weapon name');
    if (weaponIds.has(w.id as string)) fail('duplicate weapon ID');
    weaponIds.add(w.id as string);
    if (
      !abilities.includes(w.ability as string) ||
      !damageTypes.includes(w.damageType as string)
    )
      fail('weapon ability/type');
    bool(w.proficient, 'weapon proficiency');
    if (
      typeof w.dice !== 'string' ||
      !/^(?:[1-9]|[1-3][0-9]|40)d(?:4|6|8|10|12|20)$/.test(w.dice)
    )
      fail('weapon dice (use separate damageBonus)');
    number(w.reach, 0, 1000, 'weapon reach');
    for (const key of ['range', 'longRange'])
      if (w[key] !== undefined) number(w[key], 0, 10000, key);
    if (
      w.longRange !== undefined &&
      (w.range === undefined || (w.longRange as number) < (w.range as number))
    )
      fail('long range');
    for (const key of ['attackBonus', 'damageBonus'])
      if (w[key] !== undefined) number(w[key], -20, 100, key);
  }
  number(a.attacksPerAction, 1, 8, 'attacks per action');
  if (![0, 2, 5, 99].includes(a.cover as number)) fail('cover');
  object(a.turn);
  for (const k of ['action', 'bonus', 'reaction', 'dodging', 'disengaged'])
    bool(a.turn[k], k);
  number(a.turn.movement, -10000, 10000, 'movement');
  number(a.turn.attacks, 0, 8, 'remaining attacks');
  if (a.turn.slotSpentOnTurn !== undefined)
    number(a.turn.slotSpentOnTurn, 0, 1e9, 'spell turn');
  if (a.lastLongRestEnd !== undefined)
    number(a.lastLongRestEnd, 0, 1e9, 'rest time', false);
  if (a.concentration !== undefined) {
    object(a.concentration);
    string(a.concentration.spellId, 'concentration effect');
    number(a.concentration.remainingRounds, 1, 1e7, 'duration');
    list(a.concentration.targetIds, 'concentration targets', 100);
    a.concentration.targetIds.forEach((id) => string(id, 'target ID'));
  }
}
export function validateDungeonMasterState(
  value: unknown,
): asserts value is DungeonMasterState {
  object(value);
  const s = value;
  if (s.schemaVersion !== 1 || s.rulesVersion !== '5.2.1')
    fail('unsupported schema or rules version');
  number(s.revision, 0, 1e9, 'revision');
  number(s.turnIndex, 0, 200, 'turn index');
  number(s.round, 0, 1e9, 'round');
  number(s.turnSerial, 0, 1e9, 'turn serial');
  number(s.elapsedMinutes, 0, 1e9, 'time', false);
  bool(s.inCombat, 'combat flag');
  list(s.actors, 'creatures', 200);
  s.actors.forEach(validateActor);
  const ids = (s.actors as DmActor[]).map((a) => a.id);
  if (new Set(ids).size !== ids.length) fail('duplicate creature ID');
  list(s.order, 'initiative order', 200);
  if (
    new Set(s.order).size !== s.order.length ||
    s.order.some((id) => !ids.includes(id as string))
  )
    fail('initiative order');
  if (
    s.inCombat &&
    (!(s.order as unknown[]).length ||
      (s.turnIndex as number) >= s.order.length)
  )
    fail('current turn');
  list(s.messages, 'messages', 100000);
  for (const m of s.messages) {
    object(m);
    string(m.id, 'message ID');
    string(m.text, 'message text', 50000);
    if (!['player', 'dm', 'system'].includes(m.role as string))
      fail('message role');
    list(m.rulePages, 'message citations', 364);
    m.rulePages.forEach((p) => number(p, 1, 364, 'SRD page'));
  }
  list(s.events, 'events', 500000);
  for (const e of s.events) {
    object(e);
    string(e.text, 'event text', 50000);
    list(e.rulePages, 'event citations', 364);
    e.rulePages.forEach((p) => number(p, 1, 364, 'SRD page'));
  }
}
