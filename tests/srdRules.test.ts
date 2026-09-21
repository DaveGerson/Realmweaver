import { describe, it, expect } from 'vitest';
import { createActor, demoParty } from '../services/rules/characters';
import { rollD20, rollDice, abilityModifier } from '../services/rules/dice';
import {
  createDungeonMasterState,
  executeAction,
  applyDamage,
  heal,
  deathSave,
  effectiveSpeed,
  resolveSave,
  RulingRequired,
} from '../services/rules/engine';
import { validateDungeonMasterState } from '../services/rules/validation';
import {
  armorClass,
  multiclassSlots,
  pointBuyCost,
  levelForExperience,
} from '../services/rules/characterRules';
import type { DmEvent, DungeonMasterState } from '../types/index';

function dice(...values: number[]) {
  let i = 0;
  return (_sides: number) => {
    if (i >= values.length) throw new Error('Unexpected additional die roll');
    return values[i++];
  };
}
function combat(): DungeonMasterState {
  const s = createDungeonMasterState(demoParty());
  s.inCombat = true;
  s.order = s.actors.map((a) => a.id);
  s.round = 1;
  s.turnSerial = 1;
  return s;
}
describe('SRD 5.2.1 d20 tests, pp. 6–8', () => {
  it('cancels any advantage against any disadvantage', () =>
    expect(rollD20('pc', 'attack', 5, 13, true, true, dice(8))).toMatchObject({
      dice: [8],
      total: 13,
      success: true,
      advantage: 'normal',
    }));
  it('does not auto-succeed a check on 20 or auto-fail on 1', () => {
    expect(rollD20('pc', 'check', 0, 25, false, false, dice(20)).success).toBe(
      false,
    );
    expect(rollD20('pc', 'save', 12, 10, false, false, dice(1)).success).toBe(
      true,
    );
  });
  it('does apply natural 1 and 20 to attacks', () => {
    expect(rollD20('pc', 'attack', 30, 10, false, false, dice(1)).success).toBe(
      false,
    );
    expect(
      rollD20('pc', 'attack', -5, 30, false, false, dice(20)),
    ).toMatchObject({ success: true, critical: true });
  });
  it('doubles only dice on a critical hit', () =>
    expect(rollDice('2d6+3', dice(1, 2, 3, 4), true).total).toBe(13));
  it('floors negative ability modifiers', () =>
    expect(abilityModifier(9)).toBe(-1));
});
describe('Damage, unconsciousness and death, SRD pp. 16–18', () => {
  it('applies resistance then vulnerability with intermediate rounding', () => {
    const a = createActor({
      maxHp: 50,
      hp: 50,
      resistances: ['fire'],
      vulnerabilities: ['fire'],
    });
    applyDamage(a, 23, 'fire', [], dice());
    expect(a.hp).toBe(28);
  });
  it('absorbs damage with temp HP after defenses', () => {
    const a = createActor({ hp: 8, tempHp: 5, resistances: ['fire'] });
    applyDamage(a, 14, 'fire', [], dice());
    expect(a).toMatchObject({ hp: 6, tempHp: 0 });
  });
  it('does not make a concentration save for immune damage', () => {
    const a = createActor({
      immunities: ['fire'],
      concentration: { spellId: 'bless', remainingRounds: 10, targetIds: [] },
    });
    applyDamage(a, 30, 'fire', [], dice());
    expect(a.concentration).toBeDefined();
  });
  it('checks concentration even when temporary HP absorb all damage', () => {
    const a = createActor({
      tempHp: 20,
      concentration: { spellId: 'bless', remainingRounds: 10, targetIds: [] },
    });
    applyDamage(a, 4, 'fire', [], dice(1));
    expect(a.hp).toBe(8);
    expect(a.concentration).toBeUndefined();
  });
  it('caps concentration DC at 30', () => {
    const a = createActor({
      maxHp: 200,
      hp: 200,
      concentration: { spellId: 'bless', remainingRounds: 10, targetIds: [] },
    });
    const events: DmEvent[] = [];
    applyDamage(a, 80, 'fire', events, dice(20));
    expect(events.find((e) => e.roll)?.roll?.dc).toBe(30);
  });
  it('kills on massive damage, including equality', () => {
    const a = createActor({ maxHp: 10, hp: 3 });
    applyDamage(a, 13, 'fire', [], dice());
    expect(a.dead).toBe(true);
  });
  it('drops a PC unconscious and prone without killing on ordinary damage', () => {
    const a = createActor();
    applyDamage(a, 8, 'fire', [], dice());
    expect(a.dead).toBe(false);
    expect(a.conditions.map((c) => c.name)).toEqual(
      expect.arrayContaining(['unconscious', 'prone']),
    );
  });
  it('uses 2024 knockout: 1 HP, Unconscious, rather than stable at zero', () => {
    const a = createActor();
    applyDamage(a, 100, 'slashing', [], dice(), false, true);
    expect(a).toMatchObject({ hp: 1, dead: false, stable: false });
    expect(a.conditions.some((c) => c.name === 'unconscious')).toBe(true);
    heal(a, 1, []);
    expect(a.conditions.some((c) => c.name === 'unconscious')).toBe(false);
  });
  it('healing at zero restores consciousness and resets saves, retaining Prone', () => {
    const a = createActor();
    applyDamage(a, 8, 'fire', [], dice());
    a.deathSaves.failures = 2;
    heal(a, 3, []);
    expect(a).toMatchObject({
      hp: 3,
      deathSaves: { successes: 0, failures: 0 },
    });
    expect(a.conditions.map((c) => c.name)).toEqual(['prone']);
  });
  it('ordinary healing never revives a dead creature', () => {
    const a = createActor({ dead: true, hp: 0 });
    heal(a, 20, []);
    expect(a.hp).toBe(0);
  });
  it('a natural 20 death save restores 1 HP despite exhaustion', () => {
    const a = createActor({ hp: 0, exhaustion: 5 });
    deathSave(a, [], dice(20));
    expect(a.hp).toBe(1);
  });
  it('critical damage at 0 causes two failures', () => {
    const a = createActor({ hp: 0 });
    applyDamage(a, 1, 'piercing', [], dice(), true);
    expect(a.deathSaves.failures).toBe(2);
  });
  it('stabilizes after three successes and resets counters', () => {
    const a = createActor({ hp: 0 });
    deathSave(a, [], dice(10));
    deathSave(a, [], dice(10));
    deathSave(a, [], dice(10));
    expect(a).toMatchObject({
      stable: true,
      deathSaves: { successes: 0, failures: 0 },
    });
  });
});
describe('Conditions and action economy', () => {
  it('untrained armor disadvantages weapon attacks using Strength or Dexterity', () => {
    const s = combat();
    s.actors[0].armorTrained = false;
    const r = executeAction(
      s,
      {
        kind: 'attack',
        actorId: 'demo-warden',
        targetId: 'demo-raider',
        weaponId: 'longsword',
      },
      dice(19, 1),
    );
    expect(r.events.find((e) => e.roll)?.roll).toMatchObject({
      dice: [19, 1],
      advantage: 'disadvantage',
      success: false,
    });
    expect(r.state.actors[2].hp).toBe(s.actors[2].hp);
  });
  it('uses 2024 exhaustion penalties, not 2014 thresholds', () => {
    const a = createActor({ exhaustion: 3 });
    expect(effectiveSpeed(a)).toBe(15);
    expect(resolveSave(a, 'wisdom', 10, [], dice(15)).total).toBe(9);
  });
  it('paralysis automatically fails STR/DEX saves without rolling', () => {
    const a = createActor({ conditions: [{ name: 'paralyzed' }] });
    expect(resolveSave(a, 'dexterity', 1, [], dice())).toMatchObject({
      success: false,
      automatic: true,
    });
  });
  it('poisoned does not disadvantage saving throws', () => {
    const a = createActor({ conditions: [{ name: 'poisoned' }] });
    expect(resolveSave(a, 'constitution', 10, [], dice(10)).advantage).toBe(
      'normal',
    );
  });
  it('surprise gives disadvantage to initiative without skipping the first turn', () => {
    const s = createDungeonMasterState([
      createActor({ id: 'a', surprised: true }),
    ]);
    const r = executeAction(s, { kind: 'start-combat' }, dice(18, 3));
    expect(r.events[0].roll?.total).toBe(3);
    expect(r.state.actors[0].turn.action).toBe(true);
  });
  it('prevents a second Attack action and preserves the input transaction', () => {
    const s = combat();
    const action = {
      kind: 'attack',
      actorId: 'demo-warden',
      targetId: 'demo-raider',
      weaponId: 'longsword',
    } as const;
    const after = executeAction(s, action, dice(1)).state;
    expect(() => executeAction(after, action, dice())).toThrow('already used');
    expect(s.actors[0].turn.action).toBe(true);
  });
  it('allows multiple attacks only when recorded Extra Attack grants them', () => {
    const s = combat();
    s.actors[0].attacksPerAction = 2;
    const a = {
      kind: 'attack',
      actorId: 'demo-warden',
      targetId: 'demo-raider',
      weaponId: 'longsword',
    } as const;
    const x = executeAction(s, a, dice(1)).state;
    expect(() => executeAction(x, a, dice(1))).not.toThrow();
  });
  it('enforces initiative order', () =>
    expect(() =>
      executeAction(
        combat(),
        { kind: 'dodge', actorId: 'demo-raider' },
        dice(),
      ),
    ).toThrow('not Watchhouse Raider'));
  it('allows movement while merely Incapacitated (no speed restriction in that condition)', () => {
    const s = combat();
    s.actors[0].conditions = [{ name: 'incapacitated' }];
    expect(
      executeAction(
        s,
        { kind: 'move', actorId: 'demo-warden', x: 0, y: -5 },
        dice(),
      ).state.actors[0].position.y,
    ).toBe(-5);
  });
  it('charges difficult crawling additively', () => {
    const s = combat();
    s.actors[0].conditions = [{ name: 'prone' }];
    s.actors[0].turn.disengaged = true;
    const r = executeAction(
      s,
      { kind: 'move', actorId: 'demo-warden', x: -5, y: 0, difficult: true },
      dice(),
    );
    expect(r.state.actors[0].turn.movement).toBe(15);
  });
  it('does not silently skip opportunity attacks', () =>
    expect(() =>
      executeAction(
        combat(),
        { kind: 'move', actorId: 'demo-warden', x: -10, y: 0 },
        dice(),
      ),
    ).toThrow(RulingRequired));
  it('grapples with a target saving throw instead of a contested skill check', () => {
    const s = combat();
    const r = executeAction(
      s,
      {
        kind: 'grapple',
        actorId: 'demo-warden',
        targetId: 'demo-raider',
        saveAbility: 'dexterity',
      },
      dice(1),
    );
    expect(r.state.actors[2].conditions[0]).toMatchObject({
      name: 'grappled',
      escapeDC: 13,
    });
  });
});
describe('2024 spellcasting and rests', () => {
  it('Cure Wounds heals 2d8 plus ability and upcasts by 2d8 per level', () => {
    const s = combat();
    s.turnIndex = 1;
    s.actors[0].hp = 1;
    s.actors[1].spellSlots['2'] = { current: 1, max: 1 };
    const r = executeAction(
      s,
      {
        kind: 'cast',
        actorId: 'demo-acolyte',
        targetIds: ['demo-warden'],
        spellId: 'cure-wounds',
        slotLevel: 2,
      },
      dice(1, 1, 1, 1),
    );
    expect(r.state.actors[0].hp).toBe(8);
    expect(r.state.actors[1].spellSlots['2'].current).toBe(0);
  });
  it('allows Healing Word plus a cantrip, but not another slotted spell', () => {
    const s = combat();
    s.turnIndex = 1;
    const first = executeAction(
      s,
      {
        kind: 'cast',
        actorId: 'demo-acolyte',
        targetIds: ['demo-warden'],
        spellId: 'healing-word',
        slotLevel: 1,
      },
      dice(1, 1),
    ).state;
    expect(() =>
      executeAction(
        first,
        {
          kind: 'cast',
          actorId: 'demo-acolyte',
          targetIds: ['demo-warden'],
          spellId: 'cure-wounds',
          slotLevel: 1,
        },
        dice(),
      ),
    ).toThrow('one spell slot');
    expect(() =>
      executeAction(
        first,
        {
          kind: 'cast',
          actorId: 'demo-acolyte',
          targetIds: ['demo-raider'],
          spellId: 'sacred-flame',
          slotLevel: 0,
        },
        dice(4, 1),
      ),
    ).not.toThrow();
  });
  it('does not spend a slot for an unimplemented spell', () => {
    const s = combat();
    s.turnIndex = 1;
    s.actors[1].preparedSpells.push('bless');
    const before = JSON.stringify(s);
    expect(() =>
      executeAction(
        s,
        {
          kind: 'cast',
          actorId: 'demo-acolyte',
          targetIds: ['demo-warden'],
          spellId: 'bless',
          slotLevel: 1,
        },
        dice(),
      ),
    ).toThrow(RulingRequired);
    expect(JSON.stringify(s)).toBe(before);
  });
  it('requires actual prepared spells and components', () => {
    const s = combat();
    s.turnIndex = 1;
    s.actors[1].canSpeak = false;
    expect(() =>
      executeAction(
        s,
        {
          kind: 'cast',
          actorId: 'demo-acolyte',
          targetIds: ['demo-warden'],
          spellId: 'healing-word',
          slotLevel: 1,
        },
        dice(),
      ),
    ).toThrow('Verbal');
  });
  it('Inflict Wounds uses a CON save and half damage on success', () => {
    const s = combat();
    s.turnIndex = 1;
    const r = executeAction(
      s,
      {
        kind: 'cast',
        actorId: 'demo-acolyte',
        targetIds: ['demo-raider'],
        spellId: 'inflict-wounds',
        slotLevel: 1,
      },
      dice(3, 4, 20),
    );
    expect(r.state.actors[2].hp).toBe(6);
  });
  it('Long Rest restores all spent Hit Dice, slots, HP, removes one Exhaustion and temp HP', () => {
    const s = createDungeonMasterState(demoParty());
    s.actors[1].hp = 1;
    s.actors[1].hitDice.current = 0;
    s.actors[1].exhaustion = 2;
    s.actors[1].tempHp = 9;
    s.actors[1].spellSlots['1'].current = 0;
    const r = executeAction(
      s,
      { kind: 'long-rest', actorId: 'demo-acolyte' },
      dice(),
    );
    expect(r.state.actors[1]).toMatchObject({
      hp: 10,
      tempHp: 0,
      exhaustion: 1,
      hitDice: { current: 1 },
      spellSlots: { '1': { current: 2 } },
    });
    expect(() =>
      executeAction(
        r.state,
        { kind: 'long-rest', actorId: 'demo-acolyte' },
        dice(),
      ),
    ).toThrow('16 hours');
  });
  it('Short Rest healing has a minimum of 1 and requires positive starting HP', () => {
    const a = createActor({
      hp: 1,
      abilities: {
        strength: 10,
        dexterity: 10,
        constitution: 1,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
    });
    const s = createDungeonMasterState([a]);
    const r = executeAction(
      s,
      { kind: 'short-rest', actorId: a.id, hitDice: 1 },
      dice(1),
    );
    expect(r.state.actors[0].hp).toBe(2);
    s.actors[0].hp = 0;
    expect(() =>
      executeAction(
        s,
        { kind: 'short-rest', actorId: a.id, hitDice: 1 },
        dice(),
      ),
    ).toThrow('at least 1 HP');
  });
});
describe('Character calculations and untrusted state', () => {
  it('uses the 27-point-buy cost curve', () =>
    expect(pointBuyCost([15, 15, 15, 8, 8, 8])).toBe(27));
  it('keeps Pact Magic separate and rounds Paladin/Ranger contributions up', () =>
    expect(
      multiclassSlots([
        { name: 'paladin', level: 3 },
        { name: 'wizard', level: 2 },
        { name: 'warlock', level: 2 },
      ]),
    ).toEqual({ spellcasting: [4, 3], pact: { level: 1, slots: 2 } }));
  it('does not apply DEX to heavy armor and caps medium DEX', () => {
    expect(armorClass(20, 'plate', true)).toBe(20);
    expect(armorClass(20, 'half-plate')).toBe(17);
  });
  it('levels by XP thresholds', () => {
    expect(levelForExperience(299)).toBe(1);
    expect(levelForExperience(355000)).toBe(20);
  });
  it('rejects unknown commands, invented modifiers, negative costs, and non-finite values', () => {
    const s = combat();
    for (const a of [
      { kind: 'erase-world' },
      {
        kind: 'check',
        actorId: 'demo-warden',
        ability: 'strength',
        dc: 10,
        modifier: 100,
      },
      { kind: 'move', actorId: 'demo-warden', x: Infinity, y: 0 },
      { kind: 'short-rest', actorId: 'demo-warden', hitDice: -1 },
    ])
      expect(() => executeAction(s, a as never, dice())).toThrow();
  });
  it('rejects duplicate IDs and malformed restored state', () => {
    const s = combat();
    expect(() => validateDungeonMasterState(s)).not.toThrow();
    s.actors.push(structuredClone(s.actors[0]));
    expect(() => validateDungeonMasterState(s)).toThrow('duplicate creature');
  });
});
