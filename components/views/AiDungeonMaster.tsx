import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Campaign,
  DmAbility,
  DmAction,
  DmActor,
  DungeonMasterState,
  SrdPage,
} from '@/types/index';
import { campaignService } from '@/services/campaignService';
import {
  runDirectDmAction,
  runDungeonMasterTurn,
} from '@/services/dungeonMasterService';
import { narrateDungeonMasterResolution } from '@/services/aiService';
import {
  AUTOMATED_SPELLS,
  createDungeonMasterState,
} from '@/services/rules/engine';
import {
  actorFromCharacter,
  BASIC_WEAPONS,
  createActor,
  demoParty,
} from '@/services/rules/characters';
import { proficiencyBonus } from '@/services/rules/dice';
import {
  loadSrd,
  searchSrd,
  SRD_ATTRIBUTION,
  srdLink,
} from '@/services/rules/srd';
import {
  validateActor,
  validateDungeonMasterState,
} from '@/services/rules/validation';
import { Button } from '@/components/common/Button';
import { Icons } from '@/components/common/Icons';
import {
  inputBaseClasses as baseInputClasses,
  textareaBaseClasses as baseTextareaClasses,
} from '@/components/common/Textarea';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

const inputBaseClasses = `${baseInputClasses} w-full px-3 py-2`;
const textareaBaseClasses = `${baseTextareaClasses} w-full px-3 py-2`;
const ABILITIES: DmAbility[] = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
];
const EMPTY = createDungeonMasterState();
const box = 'rounded-lg border border-slate-700 bg-slate-800/60 p-4';

function CreatureEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: DmActor;
  onSave: (actor: DmActor) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(initial));
  const [raw, setRaw] = useState('');
  const [error, setError] = useState('');
  const number = (
    key:
      'ac' | 'maxHp' | 'hp' | 'speed' | 'level' | 'tempHp' | 'attacksPerAction',
    label: string,
  ) => (
    <label className="text-sm text-slate-300">
      {label}
      <input
        aria-label={label}
        className={`${inputBaseClasses} mt-1`}
        type="number"
        value={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
      />
    </label>
  );
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const next = raw.trim()
        ? JSON.parse(raw)
        : {
            ...draft,
            proficiencyBonus:
              draft.side === 'party'
                ? proficiencyBonus(draft.level)
                : draft.proficiencyBonus,
          };
      validateActor(next);
      onSave(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid creature.');
    }
  };
  return (
    <form
      onSubmit={submit}
      className={`${box} space-y-4`}
      aria-label="Creature setup"
    >
      <div>
        <h3 className="text-lg font-semibold text-slate-100">
          Review creature statistics
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          Confirm these against the character sheet or stat block. Class
          features, masteries, ammunition, and special effects require a ruling
          when they are not automated.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm text-slate-300">
          Name
          <input
            className={`${inputBaseClasses} mt-1`}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label className="text-sm text-slate-300">
          Side
          <select
            className={`${inputBaseClasses} mt-1`}
            value={draft.side}
            onChange={(e) =>
              setDraft({
                ...draft,
                side: e.target.value as DmActor['side'],
                usesDeathSaves: e.target.value === 'party',
              })
            }
          >
            <option value="party">Party</option>
            <option value="opposition">Opposition</option>
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {number('level', 'Level')}
        {number('ac', 'Armor Class')}
        {number('maxHp', 'Maximum HP')}
        {number('hp', 'Current HP')}
        {number('tempHp', 'Temporary HP')}
        {number('speed', 'Speed in feet')}
        {number('attacksPerAction', 'Attacks per action')}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ABILITIES.map((a) => (
          <label key={a} className="text-sm capitalize text-slate-300">
            {a}
            <input
              className={`${inputBaseClasses} mt-1`}
              type="number"
              min={1}
              max={30}
              value={draft.abilities[a]}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  abilities: {
                    ...draft.abilities,
                    [a]: Number(e.target.value),
                  },
                })
              }
            />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-slate-300">
          Position X (feet)
          <input
            className={`${inputBaseClasses} mt-1`}
            type="number"
            step={5}
            value={draft.position.x}
            onChange={(e) =>
              setDraft({
                ...draft,
                position: { ...draft.position, x: Number(e.target.value) },
              })
            }
          />
        </label>
        <label className="text-sm text-slate-300">
          Position Y (feet)
          <input
            className={`${inputBaseClasses} mt-1`}
            type="number"
            step={5}
            value={draft.position.y}
            onChange={(e) =>
              setDraft({
                ...draft,
                position: { ...draft.position, y: Number(e.target.value) },
              })
            }
          />
        </label>
      </div>
      <label className="block text-sm text-slate-300">
        Main weapon
        <select
          className={`${inputBaseClasses} mt-1`}
          value={draft.weapons[0]?.id ?? ''}
          onChange={(e) => {
            const w = BASIC_WEAPONS.find((w) => w.id === e.target.value);
            if (w) setDraft({ ...draft, weapons: [structuredClone(w)] });
          }}
        >
          <option value="" disabled>
            Choose a weapon
          </option>
          {BASIC_WEAPONS.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-slate-300">
        Spellcasting ability
        <select
          className={`${inputBaseClasses} mt-1`}
          value={draft.spellcastingAbility ?? ''}
          onChange={(e) =>
            setDraft({
              ...draft,
              spellcastingAbility: e.target.value
                ? (e.target.value as DmAbility)
                : undefined,
            })
          }
        >
          <option value="">None</option>
          {ABILITIES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <details className="text-sm text-slate-300">
        <summary className="cursor-pointer py-2">
          Full creature data: spells, slots, saves, conditions and resources
        </summary>
        <p className="my-2 text-slate-400">
          Edit the JSON to configure the complete recorded statistics. Pasting
          JSON overrides the fields above. This is also where a reviewed ruling
          can be applied.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setRaw(JSON.stringify(draft, null, 2))}
        >
          Load current data
        </Button>
        <textarea
          aria-label="Full creature JSON"
          className={`${textareaBaseClasses} mt-2 min-h-64 font-mono text-xs`}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="Load current data to edit"
        />
      </details>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit">Save reviewed statistics</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export const AiDungeonMaster: React.FC<{
  campaign: Campaign;
  isMockMode: boolean;
}> = ({ campaign, isMockMode }) => {
  const stateError = useMemo(() => {
    try {
      if (campaign.dungeonMaster)
        validateDungeonMasterState(campaign.dungeonMaster);
      return '';
    } catch (e) {
      return e instanceof Error ? e.message : 'Invalid saved play state.';
    }
  }, [campaign.dungeonMaster]);
  const state = stateError ? EMPTY : (campaign.dungeonMaster ?? EMPTY);
  const [tab, setTab] = useState<'play' | 'party' | 'rules'>('play');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [spellId, setSpellId] = useState('');
  const [slotLevel, setSlotLevel] = useState(1);
  const [pages, setPages] = useState<SrdPage[]>([]);
  const [query, setQuery] = useState('D20 Tests');
  const [editing, setEditing] = useState<DmActor | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [ruling, setRuling] = useState('');
  const [rulingPage, setRulingPage] = useState(176);
  const request = useRef(0);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const { confirm } = useConfirmDialog();
  const active = state.inCombat
    ? state.actors.find((a) => a.id === state.order[state.turnIndex])
    : (state.actors.find((a) => a.id === selectedId) ??
      state.actors.find((a) => a.side === 'party'));
  const target =
    state.actors.find((a) => a.id === targetId) ??
    state.actors.find((a) => a.side !== active?.side && !a.dead);
  const hits = useMemo(() => searchSrd(pages, query, 6), [pages, query]);

  useEffect(() => {
    let alive = true;
    loadSrd()
      .then((p) => {
        if (alive) setPages(p);
      })
      .catch((e) => {
        if (alive) setError(String(e));
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    setInput('');
    setOptions([]);
    setEditing(null);
    setError('');
    setBusy(false);
    setSelectedId('');
    return () => {
      request.current++;
    };
  }, [campaign.id]);
  useEffect(() => {
    const log = messagesEnd.current?.parentElement;
    if (log) log.scrollTop = log.scrollHeight;
  }, [state.messages.length]);

  const commit = (next: DungeonMasterState, expected = state.revision) => {
    validateDungeonMasterState(next);
    if (!campaignService.commitDungeonMaster(campaign.id, expected, next))
      throw new Error(
        'The game changed while this action was running. Your latest state was preserved; try again.',
      );
  };
  const direct = (action: DmAction) => {
    setError('');
    try {
      commit(runDirectDmAction(state, action));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.');
    }
  };
  const send = async (message = input) => {
    if (busy || !message.trim() || !active) return;
    const token = ++request.current;
    const revision = state.revision;
    setBusy(true);
    setError('');
    try {
      const result = await runDungeonMasterTurn(
        campaign,
        state,
        message,
        active.id,
        isMockMode,
      );
      if (request.current !== token) return;
      commit(result.state, revision);
      setOptions(result.proposal.suggestedOptions);
      setInput('');
      if (result.status === 'resolved' && result.events.length) {
        try {
          const narration = await narrateDungeonMasterResolution(
            campaign,
            result.state,
            result.events,
            isMockMode,
          );
          if (request.current !== token) return;
          const narrated = structuredClone(result.state);
          narrated.messages.push({
            id: crypto.randomUUID(),
            role: 'dm',
            text: narration,
            rulePages: [],
          });
          narrated.revision++;
          commit(narrated, result.state.revision);
        } catch (e) {
          if (request.current === token)
            setError(
              `The action was applied and its rolls are in the game log. Outcome narration could not finish: ${e instanceof Error ? e.message : 'Unknown error'}`,
            );
        }
      }
    } catch (e) {
      if (request.current === token)
        setError(
          e instanceof Error
            ? e.message
            : 'The DM could not respond. No action was applied.',
        );
    } finally {
      if (request.current === token) setBusy(false);
    }
  };
  const startDemo = () => {
    const next = createDungeonMasterState(demoParty());
    next.revision = state.revision + 1;
    commit(next);
  };
  const saveActor = (actor: DmActor) => {
    const next = structuredClone(state);
    const index = next.actors.findIndex((a) => a.id === actor.id);
    if (index >= 0) next.actors[index] = actor;
    else next.actors.push(actor);
    next.revision++;
    next.messages.push({
      id: crypto.randomUUID(),
      role: 'system',
      text: `${actor.name}'s statistics were reviewed and saved by the table.`,
      rulePages: [],
    });
    commit(next);
    setEditing(null);
  };
  const saveRuling = () => {
    if (!ruling.trim()) return;
    const next = structuredClone(state);
    next.revision++;
    next.messages.push({
      id: crypto.randomUUID(),
      role: 'system',
      text: `Table ruling (recorded, not automatically executed): ${ruling}`,
      rulePages: [rulingPage],
    });
    commit(next);
    setRuling('');
  };
  const citations = (numbers: number[]) => (
    <span className="flex flex-wrap gap-2">
      {numbers.map((p) => (
        <a
          key={p}
          className="text-xs text-amber-300 underline decoration-amber-600/40 hover:text-amber-200"
          href={srdLink(p)}
          target="_blank"
          rel="noreferrer"
        >
          SRD p. {p}
        </a>
      ))}
    </span>
  );

  return (
    <section
      className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:p-6"
      aria-label="AI Dungeon Master"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-amber-400">
            Realmweaver · SRD 5.2.1
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-100">
            AI Dungeon Master
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {campaign.title} ·{' '}
            {isMockMode ? 'Offline demo narration' : 'Claude Code narration'} ·{' '}
            {state.inCombat ? `Round ${state.round}` : 'Exploration'}
          </p>
        </div>
        <span className="rounded-full border border-amber-700/60 bg-amber-950/40 px-3 py-1 text-xs text-amber-200">
          5.5e rules · Preview
        </span>
      </header>
      <p className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-300">
        The full SRD is searchable. Supported actions use the rules engine;
        unsupported mechanics pause for a ruling. This release does not yet
        automate every SRD feature or spell.
      </p>
      <nav
        className="flex gap-1 border-b border-slate-700"
        aria-label="Dungeon Master views"
      >
        {(['play', 'party', 'rules'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-current={tab === t ? 'page' : undefined}
            className={`min-h-11 rounded-t-lg px-5 py-2 text-sm font-medium ${tab === t ? 'bg-slate-800 text-amber-300' : 'text-slate-400 hover:text-slate-100'}`}
          >
            {t === 'play'
              ? 'Play'
              : t === 'party'
                ? 'Creatures & rulings'
                : 'SRD reference'}
          </button>
        ))}
      </nav>
      {(error || stateError) && (
        <div
          role="alert"
          className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200"
        >
          {error || stateError}
        </div>
      )}
      {!stateError &&
        tab === 'play' &&
        (state.actors.length === 0 ? (
          <div className={`${box} py-12 text-center`}>
            <Icons.Combat className="mx-auto mb-3 h-9 w-9 text-amber-400" />
            <h2 className="text-xl font-semibold text-slate-100">
              Set the table
            </h2>
            <p className="mx-auto my-3 max-w-lg text-slate-400">
              Use three simple demo creatures to try the rules, or review your
              campaign characters before beginning an adventure.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={startDemo}>Start playable demo</Button>
              <Button variant="secondary" onClick={() => setTab('party')}>
                Set up campaign characters
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="flex min-w-0 flex-col gap-3">
              <div
                className={`${box} h-[50vh] min-h-72 overflow-y-auto`}
                role="log"
                aria-label="Adventure transcript"
                aria-live="polite"
              >
                {!state.messages.length && (
                  <div className="py-8 text-center text-slate-400">
                    <p className="text-lg text-slate-200">
                      Your adventure starts here.
                    </p>
                    <p className="mt-2">
                      Describe where you want to begin, or ask the DM to open a
                      scene from this campaign.
                    </p>
                  </div>
                )}
                {state.messages.map((m) => (
                  <article
                    key={m.id}
                    className={`mb-4 rounded-lg p-3 ${m.role === 'player' ? 'border border-slate-600 bg-slate-700/50' : m.role === 'system' ? 'border-l-2 border-slate-600' : 'border-l-2 border-amber-600 bg-slate-900/40'}`}
                  >
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {m.role === 'player'
                        ? 'You'
                        : m.role === 'system'
                          ? 'Game log'
                          : 'Dungeon Master'}
                    </p>
                    <p className="whitespace-pre-line break-words text-sm leading-relaxed text-slate-200">
                      {m.text}
                    </p>
                    <div className="mt-2">{citations(m.rulePages)}</div>
                  </article>
                ))}
                <div ref={messagesEnd} />
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
                className="space-y-2"
              >
                <label
                  htmlFor="dm-input"
                  className="text-sm font-medium text-slate-300"
                >
                  What do you do?
                </label>
                <textarea
                  id="dm-input"
                  className={`${textareaBaseClasses} min-h-24`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={busy}
                  maxLength={6000}
                  placeholder="I ask the guard who was on watch last night…"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">
                    Acting: {active?.name ?? 'Choose a creature'}
                  </span>
                  <Button
                    type="submit"
                    disabled={busy || !input.trim() || !active}
                  >
                    {busy ? 'DM is thinking…' : 'Send to DM'}
                  </Button>
                </div>
              </form>
              {!!options.length && (
                <div className="flex flex-wrap gap-2">
                  {options.map((o) => (
                    <Button
                      key={o}
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => setInput(o)}
                    >
                      {o}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <aside className="min-w-0 space-y-3" aria-label="Live game state">
              <div className={box}>
                <h2 className="mb-3 font-semibold text-slate-100">
                  At the table
                </h2>
                <div className="space-y-3">
                  {state.actors.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      className={`w-full rounded-md border p-3 text-left ${active?.id === a.id ? 'border-amber-600 bg-amber-950/20' : 'border-slate-700 bg-slate-900/40'}`}
                      aria-label={`Select ${a.name}`}
                    >
                      <span className="flex justify-between gap-2 text-sm font-medium text-slate-200">
                        <span>{a.name}</span>
                        <span>
                          {a.hp}/{a.maxHp}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs text-slate-400">
                        AC {a.ac} · {a.side} ·{' '}
                        {a.dead
                          ? 'Dead'
                          : a.conditions.map((c) => c.name).join(', ') ||
                            'Ready'}
                        {a.exhaustion > 0
                          ? ` · Exhaustion ${a.exhaustion}`
                          : ''}
                      </span>
                      <span className="mt-2 block h-1.5 overflow-hidden rounded bg-slate-700">
                        <span
                          className="block h-full rounded bg-amber-500"
                          style={{ width: `${(100 * a.hp) / a.maxHp}%` }}
                        />
                      </span>
                      {Object.keys(a.spellSlots).length > 0 && (
                        <span className="mt-2 block text-xs text-slate-400">
                          Slots:{' '}
                          {Object.entries(a.spellSlots)
                            .map(([l, s]) => `L${l} ${s.current}/${s.max}`)
                            .join(' · ')}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div className={`${box} space-y-3`}>
                <h2 className="font-semibold text-slate-100">Actions</h2>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      direct({
                        kind: state.inCombat ? 'end-combat' : 'start-combat',
                      })
                    }
                  >
                    {state.inCombat ? 'End combat' : 'Roll initiative'}
                  </Button>
                  {active && state.inCombat && (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        direct({ kind: 'end-turn', actorId: active.id })
                      }
                    >
                      End turn
                    </Button>
                  )}
                </div>
                {active && (
                  <>
                    <label className="block text-xs text-slate-400">
                      Target
                      <select
                        className={`${inputBaseClasses} mt-1`}
                        value={target?.id ?? ''}
                        onChange={(e) => setTargetId(e.target.value)}
                      >
                        {state.actors.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy || !target || !active.weapons.length}
                        onClick={() =>
                          target &&
                          direct({
                            kind: 'attack',
                            actorId: active.id,
                            targetId: target.id,
                            weaponId: active.weapons[0].id,
                          })
                        }
                      >
                        Attack
                      </Button>
                      {(['dodge', 'dash', 'disengage', 'stand'] as const).map(
                        (kind) => (
                          <Button
                            key={kind}
                            variant="secondary"
                            size="sm"
                            disabled={busy}
                            onClick={() => direct({ kind, actorId: active.id })}
                          >
                            {kind[0].toUpperCase() + kind.slice(1)}
                          </Button>
                        ),
                      )}
                    </div>
                    {!!active.preparedSpells.length && (
                      <div className="space-y-2 border-t border-slate-700 pt-3">
                        <label className="block text-xs text-slate-400">
                          Prepared spell
                          <select
                            className={`${inputBaseClasses} mt-1`}
                            value={spellId}
                            onChange={(e) => setSpellId(e.target.value)}
                          >
                            <option value="">Choose a spell</option>
                            {active.preparedSpells.map((id) => (
                              <option key={id} value={id}>
                                {AUTOMATED_SPELLS[id]?.name ?? `${id} (ruling)`}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-xs text-slate-400">
                          Slot level (0 for cantrip)
                          <input
                            type="number"
                            min={0}
                            max={9}
                            value={slotLevel}
                            className={`${inputBaseClasses} mt-1`}
                            onChange={(e) =>
                              setSlotLevel(Number(e.target.value))
                            }
                          />
                        </label>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy || !spellId || !target}
                          onClick={() =>
                            target &&
                            direct({
                              kind: 'cast',
                              actorId: active.id,
                              targetIds: [target.id],
                              spellId,
                              slotLevel,
                            })
                          }
                        >
                          Cast spell
                        </Button>
                      </div>
                    )}
                    {active.side === 'opposition' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void send(
                            'Run the current opponent’s next action, using only its recorded statistics. Leave its turn open afterward.',
                          )
                        }
                      >
                        Run opponent action
                      </Button>
                    )}
                    {!state.inCombat && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            direct({
                              kind: 'short-rest',
                              actorId: active.id,
                              hitDice: Math.min(1, active.hitDice.current),
                            })
                          }
                        >
                          Short Rest · spend 1 HD
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            direct({ kind: 'long-rest', actorId: active.id })
                          }
                        >
                          Long Rest
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </aside>
          </div>
        ))}
      {!stateError && tab === 'party' && (
        <div className="space-y-4">
          {editing ? (
            <CreatureEditor
              key={editing.id}
              initial={editing}
              onSave={saveActor}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <>
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={busy}
                  onClick={() =>
                    setEditing(
                      createActor({
                        position: { x: state.actors.length * 5, y: 0 },
                      }),
                    )
                  }
                >
                  Add creature
                </Button>
                {campaign.playerCharacters.length > 0 && (
                  <label className="text-sm text-slate-300">
                    From campaign sheet
                    <select
                      aria-label="Import campaign character"
                      className={`${inputBaseClasses} mt-1`}
                      value=""
                      onChange={(e) => {
                        const pc = campaign.playerCharacters.find(
                          (p) => p.id === e.target.value,
                        );
                        if (pc) setEditing(actorFromCharacter(pc));
                      }}
                    >
                      <option value="">Choose a character to review</option>
                      {campaign.playerCharacters.map((pc) => (
                        <option key={pc.id} value={pc.id}>
                          {pc.characterSocial.characterName}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <p className="text-sm text-slate-400">
                Campaign sheets supply names, abilities and skills. Review
                suggested HP, AC, equipment, spell slots, saves and class
                features before play. These session creatures are independent
                snapshots of your campaign records.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {state.actors.map((a) => (
                  <div key={a.id} className={box}>
                    <h3 className="font-semibold text-slate-100">{a.name}</h3>
                    <p className="my-2 text-sm text-slate-400">
                      Level {a.level} · AC {a.ac} · HP {a.hp}/{a.maxHp}
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => setEditing(structuredClone(a))}
                    >
                      Review / apply ruling
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className={`${box} space-y-3`}>
            <h2 className="font-semibold text-slate-100">
              Record a table ruling
            </h2>
            <p className="text-sm text-slate-400">
              For a rule that needs adjudication, record the decision and its
              source. Apply reviewed mechanical changes through the creature
              editor. Recording a ruling alone does not change statistics.
            </p>
            <textarea
              aria-label="Ruling"
              className={textareaBaseClasses}
              value={ruling}
              onChange={(e) => setRuling(e.target.value)}
              placeholder="The target is behind half cover…"
            />
            <label className="block text-sm text-slate-300">
              SRD page
              <input
                aria-label="Ruling SRD page"
                className={`${inputBaseClasses} mt-1 max-w-28`}
                type="number"
                min={1}
                max={364}
                value={rulingPage}
                onChange={(e) => setRulingPage(Number(e.target.value))}
              />
            </label>
            <Button
              disabled={
                !ruling.trim() ||
                busy ||
                !Number.isInteger(rulingPage) ||
                rulingPage < 1 ||
                rulingPage > 364
              }
              onClick={saveRuling}
            >
              Record ruling
            </Button>
          </div>
        </div>
      )}
      {tab === 'rules' && (
        <div className="space-y-4">
          <div className={box}>
            <label
              htmlFor="srd-search"
              className="mb-2 block text-sm font-medium text-slate-200"
            >
              Search all 364 SRD pages
            </label>
            <input
              id="srd-search"
              type="search"
              className={inputBaseClasses}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Concentration, grappling, Wish, multiclassing…"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                'Concentration',
                'Exhaustion',
                'Multiclassing',
                'Long Rest',
                'Weapon Mastery',
                'Spellcasting',
                'Influence',
                'Magic Items',
              ].map((q) => (
                <Button
                  key={q}
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuery(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
          {pages.length === 0 && (
            <p role="status" className="text-slate-400">
              Loading the SRD…
            </p>
          )}
          {hits.map((p) => (
            <details key={p.id} className={box}>
              <summary className="cursor-pointer font-medium text-slate-100">
                Page {p.page} · {p.section}
                <span className="mt-1 block text-sm font-normal text-slate-400">
                  {p.headings.slice(0, 5).join(' · ')}
                </span>
              </summary>
              <pre className="my-3 max-h-[34rem] overflow-y-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-300">
                {p.text}
              </pre>
              {citations([p.page])}
            </details>
          ))}
          <details className={box}>
            <summary className="cursor-pointer text-sm font-medium text-slate-200">
              Automation coverage
            </summary>
            <p className="mt-3 text-sm text-slate-400">
              The resolver supports ordinary checks, saves, weapon attacks,
              initiative, movement costs, basic actions, grapple/shove, HP,
              death saves, stabilization, damage defenses, rests and spell-slot
              limits. Current automated spell effects:{' '}
              {Object.values(AUTOMATED_SPELLS)
                .map((s) => s.name)
                .join(', ')}
              . Reactions, advanced targeting, timed effects, complete class
              progression, feats, masteries, monster traits and other spells
              need adjudication. Searchable source coverage is not a claim of
              complete rules automation.
            </p>
          </details>
          <p className="text-xs leading-relaxed text-slate-500">
            {SRD_ATTRIBUTION} The bundled reference is a text extraction of the
            official PDF; page links show its original layout.
          </p>
        </div>
      )}
      {campaign.dungeonMaster && (
        <div className="border-t border-slate-800 pt-4">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={async () => {
              if (
                await confirm(
                  'Reset AI DM session?',
                  'This clears this AI DM transcript and its session creatures. Campaign records remain available.',
                  { confirmLabel: 'Reset session', variant: 'danger' },
                )
              ) {
                const next = createDungeonMasterState();
                next.revision = state.revision + 1;
                commit(next);
              }
            }}
          >
            Reset AI DM session
          </Button>
        </div>
      )}
    </section>
  );
};
