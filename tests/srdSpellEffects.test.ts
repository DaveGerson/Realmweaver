import { describe, expect, it } from 'vitest';
import { loadSrd } from '../services/rules/srd';
import { createActor } from '../services/rules/characters';
import {
  AUTOMATED_SPELLS,
  createDungeonMasterState,
  effectiveSpeed,
  executeAction,
  heal,
  hasCondition,
} from '../services/rules/engine';
import type { DmAction, DungeonMasterState } from '../types/index';

function dice(...v: number[]) {
  let i = 0;
  return () => {
    if (i === v.length) throw new Error('Unexpected die');
    return v[i++];
  };
}
function fixture(spell: string, level = 1): DungeonMasterState {
  const a = createActor({
    id: 'caster',
    level,
    name: 'Caster',
    hp: 100,
    maxHp: 100,
    spellcastingAbility: 'intelligence',
    preparedSpells: [spell],
    spellSlots: Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => [
        String(i + 1),
        { current: 1, max: 1 },
      ]),
    ),
  });
  const b = createActor({
    id: 'target',
    name: 'Target',
    side: 'opposition',
    hp: 100,
    maxHp: 100,
    position: { x: 5, y: 0 },
    usesDeathSaves: true,
  });
  const s = createDungeonMasterState([a, b]);
  s.inCombat = true;
  s.order = ['caster', 'target'];
  s.round = 1;
  s.turnSerial = 1;
  return s;
}
const cast = (spellId: string, slotLevel = 0): DmAction => ({
  kind: 'cast',
  actorId: 'caster',
  targetIds: ['target'],
  spellId,
  slotLevel,
});
function turn(s: DungeonMasterState) {
  return executeAction(
    s,
    { kind: 'end-turn', actorId: s.order[s.turnIndex] },
    dice(),
  ).state;
}

describe('Source-checked 5.5e spell effects and timing', () => {
  it('Eldritch Blast at level 5 makes two independent attacks and damage rolls', () => {
    const s = fixture('eldritch-blast', 5);
    s.actors[1].position.x = 30;
    const r = executeAction(s, cast('eldritch-blast'), dice(15, 3, 1));
    expect(r.state.actors[1].hp).toBe(97);
    expect(r.events.filter((e) => e.roll?.kind === 'attack')).toHaveLength(2);
  });
  it('Scorching Ray upcasts by adding rays, not damage dice to every ray', () => {
    const s = fixture('scorching-ray');
    s.actors[1].position.x = 30;
    const r = executeAction(
      s,
      cast('scorching-ray', 3),
      dice(15, 1, 2, 15, 1, 2, 15, 1, 2, 15, 1, 2),
    );
    expect(r.state.actors[1].hp).toBe(88);
    expect(r.events.filter((e) => e.roll?.kind === 'attack')).toHaveLength(4);
  });
  it('Ray of Frost slows once and expires at the start of the caster’s next turn', () => {
    const s = fixture('ray-of-frost');
    s.actors[1].position.x = 30;
    let r = executeAction(s, cast('ray-of-frost'), dice(15, 3)).state;
    expect(effectiveSpeed(r.actors[1])).toBe(20);
    r = turn(r);
    expect(effectiveSpeed(r.actors[1])).toBe(20);
    r = turn(r);
    expect(effectiveSpeed(r.actors[1])).toBe(30);
  });
  it('Chill Touch is melee, blocks healing through the caster’s next turn, then expires', () => {
    let s = executeAction(
      fixture('chill-touch'),
      cast('chill-touch'),
      dice(15, 3),
    ).state;
    heal(s.actors[1], 50, []);
    expect(s.actors[1].hp).toBe(97);
    s = turn(turn(s));
    heal(s.actors[1], 50, []);
    expect(s.actors[1].hp).toBe(97);
    s = turn(s);
    heal(s.actors[1], 50, []);
    expect(s.actors[1].hp).toBe(100);
  });
  it('Shocking Grasp denies Opportunity Attacks, not every Reaction', () => {
    const s = executeAction(
      fixture('shocking-grasp'),
      cast('shocking-grasp'),
      dice(15, 3),
    ).state;
    expect(s.actors[1].turn.reaction).toBe(true);
    expect(
      executeAction(
        s,
        { kind: 'move', actorId: 'caster', x: -10, y: 0 },
        dice(),
      ).state.actors[0].position.x,
    ).toBe(-10);
    const next = turn(s);
    expect(next.actors[1].effects).toHaveLength(0);
  });
  it('Ray of Sickness applies Poisoned on a hit without the old extra CON save', () => {
    const s = fixture('ray-of-sickness');
    s.actors[1].position.x = 30;
    let r = executeAction(s, cast('ray-of-sickness', 1), dice(15, 2, 3)).state;
    expect(hasCondition(r.actors[1], 'poisoned')).toBe(true);
    r = turn(turn(turn(r)));
    expect(hasCondition(r.actors[1], 'poisoned')).toBe(false);
  });
  it('condition immunity prevents Ray of Sickness poisoning', () => {
    const s = fixture('ray-of-sickness');
    s.actors[1].position.x = 30;
    s.actors[1].conditionImmunities = ['poisoned'];
    expect(
      hasCondition(
        executeAction(s, cast('ray-of-sickness', 1), dice(15, 2, 3)).state
          .actors[1],
        'poisoned',
      ),
    ).toBe(false);
  });
  it('Guiding Bolt grants advantage to exactly one subsequent attack', () => {
    const s = fixture('guiding-bolt');
    s.actors[1].position.x = 30;
    let r = executeAction(
      s,
      cast('guiding-bolt', 1),
      dice(15, 1, 1, 1, 1),
    ).state;
    r = turn(turn(r));
    r.actors[1].position.x = 5;
    const hit = executeAction(
      r,
      {
        kind: 'attack',
        actorId: 'caster',
        targetId: 'target',
        weaponId: 'longsword',
      },
      dice(2, 15, 1),
    );
    expect(hit.events[0].roll?.advantage).toBe('advantage');
    expect(hit.state.actors[1].effects).toHaveLength(0);
  });
  it('Vicious Mockery deals d6 and penalizes the next attack even if that attack misses', () => {
    let s = executeAction(
      fixture('vicious-mockery'),
      cast('vicious-mockery'),
      dice(3, 1),
    ).state;
    expect(s.actors[1].hp).toBe(97);
    s = turn(s);
    const r = executeAction(
      s,
      {
        kind: 'attack',
        actorId: 'target',
        targetId: 'caster',
        weaponId: 'longsword',
      },
      dice(1, 15),
    );
    expect(r.events[0].roll?.advantage).toBe('disadvantage');
    expect(r.state.actors[1].effects).toHaveLength(0);
  });
  it('Starry Wisp records its visibility/light effect until the end of the caster’s next turn', () => {
    const s = fixture('starry-wisp');
    s.actors[1].position.x = 30;
    let r = executeAction(s, cast('starry-wisp'), dice(15, 1)).state;
    expect(r.actors[1].effects?.[0].kind).toBe('visible-glow');
    r = turn(turn(turn(r)));
    expect(r.actors[1].effects).toHaveLength(0);
  });
  it('Heal upcasts by 10 HP and ends the specified conditions', () => {
    const s = fixture('heal');
    s.actors[1].hp = 1;
    s.actors[1].conditions = [{ name: 'poisoned' }, { name: 'prone' }];
    const r = executeAction(s, cast('heal', 7), dice());
    expect(r.state.actors[1].hp).toBe(81);
    expect(r.state.actors[1].conditions).toEqual([{ name: 'prone' }]);
  });
  it('Power Word Kill kills at 100 HP without an attack, save or damage roll', () => {
    const r = executeAction(
      fixture('power-word-kill'),
      cast('power-word-kill', 9),
      dice(),
    );
    expect(r.state.actors[1].dead).toBe(true);
  });
  it('Power Word Kill deals 12d12 psychic above the threshold', () => {
    const s = fixture('power-word-kill');
    s.actors[1].hp = 101;
    s.actors[1].maxHp = 101;
    const r = executeAction(
      s,
      cast('power-word-kill', 9),
      dice(...Array(12).fill(1)),
    );
    expect(r.state.actors[1].hp).toBe(89);
    expect(r.state.actors[1].dead).toBe(false);
  });
  it('anchors every automated spell in its official source page or preceding continuation', async () => {
    const pages = await loadSrd();
    for (const spell of Object.values(AUTOMATED_SPELLS)) {
      const source = pages
        .filter((p) => p.page === spell.page || p.page === spell.page - 1)
        .map((p) => p.text)
        .join('\n');
      expect(source, spell.name).toContain(spell.name + '\n');
    }
  });
});
