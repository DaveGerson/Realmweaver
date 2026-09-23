
import React, { useState } from 'react';
import type { Encounter, Combatant, CombatCondition, NPC, PlayerCharacter, CombatantType } from '../../types/index';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { twMerge } from 'tailwind-merge';
import { produce, type Draft } from 'immer';
import { estimatePcHp } from '../../utils/entityUtils';
import {
  calculateEncounterDifficulty,
  parseChallengeRating,
  type EncounterRating,
} from '../../utils/encounterDifficulty';

interface CombatTrackerProps {
  encounter: Encounter;
  onUpdate: (encounter: Encounter) => void;
  campaignNpcs: NPC[];
  campaignPcs: PlayerCharacter[];
}

/** The standard 5e conditions (plus exhaustion and concentration) offered by the condition picker. */
export const STANDARD_CONDITIONS = [
  'Blinded',
  'Charmed',
  'Deafened',
  'Frightened',
  'Grappled',
  'Incapacitated',
  'Invisible',
  'Paralyzed',
  'Petrified',
  'Poisoned',
  'Prone',
  'Restrained',
  'Stunned',
  'Unconscious',
  'Exhaustion',
  'Concentrating',
] as const;

/**
 * Removes a combatant from the encounter, preserving whose turn it actually is.
 * Filtering the array shifts every subsequent index down by one, so we re-locate
 * the combatant that was active *before* the removal by identity rather than by
 * index, and only fall back to clamping/resetting turnIndex when the active
 * combatant itself was the one removed (or the index was already out of bounds).
 */
export const removeCombatantFromEncounter = (encounter: Encounter, id: string): Encounter => {
  return produce(encounter, draft => {
    const activeCombatantId = draft.combatants[draft.turnIndex]?.id;
    draft.combatants = draft.combatants.filter(c => c.id !== id);

    if (draft.combatants.length === 0) {
      draft.turnIndex = 0;
      return;
    }

    if (activeCombatantId !== undefined && activeCombatantId !== id) {
      const newIndex = draft.combatants.findIndex(c => c.id === activeCombatantId);
      draft.turnIndex = newIndex >= 0 ? newIndex : 0;
    } else if (draft.turnIndex >= draft.combatants.length) {
      draft.turnIndex = 0;
    }
  });
};

/**
 * Decrements every timed condition by one round and drops any that reach 0.
 * Conditions without `roundsRemaining` are indefinite and left untouched.
 */
const tickConditionsDraft = (draft: Draft<Encounter>) => {
  for (const combatant of draft.combatants) {
    if (!combatant.conditions || combatant.conditions.length === 0) continue;
    combatant.conditions = combatant.conditions
      .map(c => (typeof c.roundsRemaining === 'number' ? { ...c, roundsRemaining: c.roundsRemaining - 1 } : c))
      .filter(c => typeof c.roundsRemaining !== 'number' || c.roundsRemaining > 0);
  }
};

/** Pure wrapper around the round-tick: decrements timed conditions and expires those at 0. */
export const tickConditionDurations = (encounter: Encounter): Encounter => {
  return produce(encounter, draft => {
    tickConditionsDraft(draft);
  });
};

/**
 * Advances to the next combatant's turn, wrapping around to the top of the
 * order and incrementing the round when it moves past the last combatant.
 * When the round increments, timed condition durations tick down by one.
 * No-op when there are no combatants.
 */
export const advanceTurn = (encounter: Encounter): Encounter => {
  return produce(encounter, draft => {
    if (draft.combatants.length === 0) return;
    draft.turnIndex++;
    if (draft.turnIndex >= draft.combatants.length) {
      draft.turnIndex = 0;
      draft.round++;
      tickConditionsDraft(draft);
    }
  });
};

/**
 * Rewinds to the previous combatant's turn, wrapping around to the bottom of
 * the order and decrementing the round (floored at 1) when it moves before
 * the first combatant. No-op when there are no combatants. Condition
 * durations are not restored — an expired condition stays expired.
 */
export const rewindTurn = (encounter: Encounter): Encounter => {
  return produce(encounter, draft => {
    if (draft.combatants.length === 0) return;
    draft.turnIndex--;
    if (draft.turnIndex < 0) {
      draft.turnIndex = draft.combatants.length - 1;
      draft.round = Math.max(1, draft.round - 1);
    }
  });
};

/**
 * Sorts combatants descending by initiative while preserving whose turn it
 * is by identity — mirrors removeCombatantFromEncounter's approach so that
 * sorting mid-combat never silently rewinds or skips a turn. `round` is
 * never touched. No-op when there are no combatants.
 */
export const sortByInitiative = (encounter: Encounter): Encounter => {
  return produce(encounter, draft => {
    if (draft.combatants.length === 0) return;
    const activeCombatantId = draft.combatants[draft.turnIndex]?.id;
    draft.combatants.sort((a, b) => b.initiative - a.initiative);
    if (activeCombatantId !== undefined) {
      const newIndex = draft.combatants.findIndex(c => c.id === activeCombatantId);
      draft.turnIndex = newIndex >= 0 ? newIndex : 0;
    } else {
      draft.turnIndex = 0;
    }
  });
};

export type HpDeltaMode = 'damage' | 'heal';

/**
 * Applies N points of damage or healing to a combatant's current HP.
 * - Damage floors at 0.
 * - Healing starts from max(hp, 0) and caps at maxHp when maxHp > 0 — but never
 *   lowers HP that is already above max (temporary/over-max HP recorded by hand).
 * Non-positive or non-finite amounts are a no-op.
 */
export const applyHpDelta = (combatant: Pick<Combatant, 'hp' | 'maxHp'>, amount: number, mode: HpDeltaMode): number => {
  const { hp, maxHp } = combatant;
  if (!Number.isFinite(amount) || amount <= 0) return hp;
  const n = Math.floor(amount);
  if (mode === 'damage') return Math.max(0, hp - n);
  const healed = Math.max(0, hp) + n;
  if (maxHp > 0) return Math.max(hp, Math.min(maxHp, healed));
  return healed;
};

/** Encounter-level wrapper for applyHpDelta. Unknown ids are a no-op. */
export const applyHpDeltaToCombatant = (encounter: Encounter, id: string, amount: number, mode: HpDeltaMode): Encounter => {
  return produce(encounter, draft => {
    const combatant = draft.combatants.find(c => c.id === id);
    if (combatant) combatant.hp = applyHpDelta(combatant, amount, mode);
  });
};

/**
 * Adds a condition to a combatant. Re-applying an existing condition (matched
 * case-insensitively) replaces its duration rather than adding a duplicate.
 * A `rounds` value that is not a positive integer means "until removed".
 */
export const addConditionToCombatant = (encounter: Encounter, id: string, name: string, rounds?: number): Encounter => {
  const trimmed = name.trim();
  if (!trimmed) return encounter;
  return produce(encounter, draft => {
    const combatant = draft.combatants.find(c => c.id === id);
    if (!combatant) return;
    const condition: CombatCondition = { name: trimmed };
    if (typeof rounds === 'number' && Number.isFinite(rounds) && rounds >= 1) {
      condition.roundsRemaining = Math.floor(rounds);
    }
    const existing = (combatant.conditions ?? []).filter(c => c.name.toLowerCase() !== trimmed.toLowerCase());
    combatant.conditions = [...existing, condition];
  });
};

/** Removes a condition (matched case-insensitively) from a combatant. */
export const removeConditionFromCombatant = (encounter: Encounter, id: string, name: string): Encounter => {
  return produce(encounter, draft => {
    const combatant = draft.combatants.find(c => c.id === id);
    if (!combatant || !combatant.conditions) return;
    combatant.conditions = combatant.conditions.filter(c => c.name.toLowerCase() !== name.toLowerCase());
  });
};

/**
 * Pulls HP / AC / CR out of a freeform NPC stat string ("AC 15, HP 22, CR 1/2").
 * Each field is null when not found.
 */
export const parseNpcCombatStats = (stats: string | undefined): { hp: number | null; ac: number | null; cr: string | null } => {
  if (!stats) return { hp: null, ac: null, cr: null };
  const hpMatch = stats.match(/(?:hp|hit\s*points)\s*[:=\-–—]?\s*(\d+)/i);
  const acMatch = stats.match(/(?:\bac|armou?r\s*class)\s*[:=\-–—]?\s*(\d+)/i);
  const crMatch = stats.match(/(?:\bcr|challenge(?:\s*rating)?)\s*[:=\-–—]?\s*(\d+\s*\/\s*\d+|\d+(?:\.\d+)?)/i);
  return {
    hp: hpMatch ? parseInt(hpMatch[1], 10) : null,
    ac: acMatch ? parseInt(acMatch[1], 10) : null,
    cr: crMatch && parseChallengeRating(crMatch[1]) !== null ? crMatch[1].replace(/\s+/g, '') : null,
  };
};

/**
 * Derives calculator inputs from the combatant list. PCs supply party levels
 * (falling back to `fallbackLevel` when a PC has no level); with no PCs in the
 * fight, a party of `fallbackPartySize` at `fallbackLevel` is assumed.
 * Enemies are every non-PC combatant with a recognised CR.
 */
export const deriveDifficultyInputs = (combatants: Combatant[], fallbackLevel: number, fallbackPartySize: number) => {
  const pcs = combatants.filter(c => c.type === 'pc');
  const hasPcs = pcs.length > 0;
  const partyLevels = hasPcs
    ? pcs.map(c => (typeof c.level === 'number' && c.level > 0 ? c.level : fallbackLevel))
    : Array.from({ length: Math.max(0, fallbackPartySize) }, () => fallbackLevel);
  const monsterCRs = combatants
    .filter(c => c.type !== 'pc' && c.cr !== undefined && parseChallengeRating(c.cr) !== null)
    .map(c => c.cr as string);
  const needsFallbackLevel = !hasPcs || pcs.some(c => !(typeof c.level === 'number' && c.level > 0));
  return { partyLevels, monsterCRs, hasPcs, needsFallbackLevel };
};

const parseOptionalInt = (value: string): number | undefined => {
  if (value.trim() === '') return undefined;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
};

const RATING_CLASSES: Record<EncounterRating, string> = {
  none: 'text-slate-400',
  trivial: 'text-slate-300',
  easy: 'text-green-400',
  medium: 'text-yellow-400',
  hard: 'text-orange-400',
  deadly: 'text-red-400',
};

const RATING_LABELS: Record<EncounterRating, string> = {
  none: '—',
  trivial: 'Trivial',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  deadly: 'Deadly',
};

const CONDITION_CHIP_CLASSES: Record<string, string> = {
  concentrating: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
  unconscious: 'bg-red-500/15 border-red-500/40 text-red-300',
  paralyzed: 'bg-red-500/15 border-red-500/40 text-red-300',
  petrified: 'bg-red-500/15 border-red-500/40 text-red-300',
  stunned: 'bg-red-500/15 border-red-500/40 text-red-300',
  incapacitated: 'bg-red-500/15 border-red-500/40 text-red-300',
};
const DEFAULT_CONDITION_CHIP_CLASS = 'bg-slate-700/60 border-slate-600 text-slate-200';

const smallInputClass =
  'bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-amber-500';

const formatXp = (n: number) => n.toLocaleString('en-US');

export const CombatTracker: React.FC<CombatTrackerProps> = ({ encounter, onUpdate, campaignNpcs, campaignPcs }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [partyLevel, setPartyLevel] = useState(1);
  const [partySize, setPartySize] = useState(4);
  const { confirm } = useConfirmDialog();

  // Handlers for Combatant State
  const updateCombatant = (id: string, updates: Partial<Combatant>) => {
      const nextEncounter = produce(encounter, draft => {
          const combatant = draft.combatants.find(c => c.id === id);
          if (combatant) {
              Object.assign(combatant, updates);
          }
      });
      onUpdate(nextEncounter);
  };

  const addCombatant = (data: NewCombatantData) => {
      const newCombatant: Combatant = {
          id: crypto.randomUUID(),
          name: data.name,
          type: data.type,
          hp: data.hp,
          maxHp: data.hp,
          initiative: data.initiative,
          notes: '',
          conditions: [],
      };
      if (data.ac !== undefined) newCombatant.ac = data.ac;
      if (data.cr) newCombatant.cr = data.cr;
      if (data.level !== undefined) newCombatant.level = data.level;
      const nextEncounter = produce(encounter, draft => {
          draft.combatants.push(newCombatant);
      });
      onUpdate(nextEncounter);
      setIsAdding(false);
  };

  const removeCombatant = (id: string) => {
      onUpdate(removeCombatantFromEncounter(encounter, id));
  };

  // Handlers for Encounter Flow
  const nextTurn = () => {
      onUpdate(advanceTurn(encounter));
  };

  const sortInitiative = () => {
      onUpdate(sortByInitiative(encounter));
  };

  const clearEncounter = async () => {
      const confirmed = await confirm('Clear Encounter', 'Clear all combatants and reset rounds?', { variant: 'danger', confirmLabel: 'Clear' });
      if (confirmed) {
          onUpdate({ id: encounter.id, round: 1, turnIndex: 0, combatants: [] });
      }
  };

  const sortedCombatants = encounter.combatants; // Already sorted if user clicked sort, but we display as is for manual reordering support in future.

  return (
    <div className="p-6 md:p-8 h-full flex flex-col overflow-hidden animate-fade-in">
        <header className="flex justify-between items-center mb-6 flex-shrink-0">
            <div className="flex items-center gap-3 text-amber-400">
                <Icons.Combat className="w-8 h-8" />
                <h1 className="text-3xl font-bold font-serif text-slate-100">Combat Tracker</h1>
            </div>
            <div className="flex items-center gap-4">
                 <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
                    <span className="text-slate-400 text-xs uppercase tracking-wider font-bold mr-2">Round</span>
                    <span className="text-2xl font-bold text-white">{encounter.round}</span>
                </div>
                <Button onClick={nextTurn} size="lg" className="shadow-lg shadow-amber-500/20">
                    Next Turn <Icons.ChevronDown className="ml-2 w-4 h-4 rotate-[-90deg]" />
                </Button>
            </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900/50 rounded-xl border border-slate-800 mb-4 relative">
            {/* Table Header */}
            <div className="sticky top-0 bg-slate-900 z-10 grid grid-cols-12 gap-4 p-4 border-b border-slate-800 text-xs font-medium text-slate-400 uppercase tracking-wider">
                <div className="col-span-2 text-center">Init</div>
                <div className="col-span-3">Name</div>
                <div className="col-span-1 text-center">AC</div>
                <div className="col-span-4 text-center">HP</div>
                <div className="col-span-2 text-right">Actions</div>
            </div>

            {/* Combatant Rows */}
            <div className="divide-y divide-slate-800">
                {sortedCombatants.map((combatant, index) => (
                    <CombatantRow
                        key={combatant.id}
                        combatant={combatant}
                        isActive={index === encounter.turnIndex}
                        onChange={updates => updateCombatant(combatant.id, updates)}
                        onApplyDelta={(amount, mode) => onUpdate(applyHpDeltaToCombatant(encounter, combatant.id, amount, mode))}
                        onAddCondition={(name, rounds) => onUpdate(addConditionToCombatant(encounter, combatant.id, name, rounds))}
                        onRemoveCondition={name => onUpdate(removeConditionFromCombatant(encounter, combatant.id, name))}
                        onRemove={() => removeCombatant(combatant.id)}
                    />
                ))}
                {encounter.combatants.length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                        <p>The battlefield is empty.</p>
                        <p className="text-sm">Add combatants to begin.</p>
                    </div>
                )}
            </div>
        </div>

        <EncounterDifficultyReadout
            combatants={encounter.combatants}
            partyLevel={partyLevel}
            partySize={partySize}
            onPartyLevelChange={setPartyLevel}
            onPartySizeChange={setPartySize}
        />

        {/* Footer Controls */}
        <div className="flex items-center justify-between gap-4 flex-shrink-0">
             <div className="flex gap-2">
                <Button variant="secondary" onClick={sortInitiative} disabled={encounter.combatants.length === 0}>
                    <Icons.Dice className="w-4 h-4 mr-2" /> Sort Initiative
                </Button>
                <Button variant="ghost" onClick={clearEncounter} className="text-red-400 hover:bg-red-900/20 hover:text-red-300">
                    Reset
                </Button>
             </div>
             <div className="flex gap-2">
                <AddCombatantMenu
                    npcs={campaignNpcs}
                    pcs={campaignPcs}
                    onAdd={addCombatant}
                    isOpen={isAdding}
                    onToggle={() => setIsAdding(!isAdding)}
                />
             </div>
        </div>
    </div>
  );
};

interface CombatantRowProps {
    combatant: Combatant;
    isActive: boolean;
    onChange: (updates: Partial<Combatant>) => void;
    onApplyDelta: (amount: number, mode: HpDeltaMode) => void;
    onAddCondition: (name: string, rounds?: number) => void;
    onRemoveCondition: (name: string) => void;
    onRemove: () => void;
}

const CombatantRow: React.FC<CombatantRowProps> = ({
    combatant, isActive, onChange, onApplyDelta, onAddCondition, onRemoveCondition, onRemove,
}) => {
    const [delta, setDelta] = useState('');
    const [conditionRounds, setConditionRounds] = useState('');
    const conditions = combatant.conditions ?? [];
    const appliedNames = new Set(conditions.map(c => c.name.toLowerCase()));
    const availableConditions = STANDARD_CONDITIONS.filter(c => !appliedNames.has(c.toLowerCase()));
    const deltaAmount = parseInt(delta, 10);
    const deltaValid = Number.isFinite(deltaAmount) && deltaAmount > 0;
    const crInvalid = combatant.cr !== undefined && combatant.cr.trim() !== '' && parseChallengeRating(combatant.cr) === null;

    const applyDelta = (mode: HpDeltaMode) => {
        if (!deltaValid) return;
        onApplyDelta(deltaAmount, mode);
        setDelta('');
    };

    return (
        <div
            className={twMerge(
                "p-4 transition-colors",
                isActive ? "bg-amber-500/10 border-l-4 border-amber-500" : "hover:bg-slate-800/30 border-l-4 border-transparent"
            )}
        >
            <div className="grid grid-cols-12 gap-4 items-center">
                {/* Initiative */}
                <div className="col-span-2 flex justify-center">
                    <input
                        type="number"
                        value={combatant.initiative}
                        onChange={(e) => onChange({ initiative: parseInt(e.target.value) || 0 })}
                        aria-label={`Initiative for ${combatant.name}`}
                        className="w-12 text-center bg-slate-800 border border-slate-700 rounded p-1 text-lg font-bold text-slate-200 focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                </div>

                {/* Name, Type, CR / Level */}
                <div className="col-span-3 min-w-0">
                    <input
                        type="text"
                        value={combatant.name}
                        onChange={(e) => onChange({ name: e.target.value })}
                        className="w-full bg-transparent border-none p-0 text-base font-medium text-slate-200 focus:ring-0 placeholder:text-slate-600"
                        placeholder="Combatant Name"
                    />
                    <div className="flex items-center gap-2 mt-1">
                        <span className={twMerge("text-[10px] uppercase px-1.5 py-0.5 rounded",
                            combatant.type === 'pc' ? 'bg-blue-500/20 text-blue-300' :
                            combatant.type === 'npc' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                        )}>
                            {combatant.type}
                        </span>
                        {combatant.type === 'pc' ? (
                            <label className="flex items-center gap-1 text-[10px] uppercase text-slate-500">
                                Lv
                                <input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={combatant.level ?? ''}
                                    onChange={(e) => onChange({ level: parseOptionalInt(e.target.value) })}
                                    aria-label={`Level for ${combatant.name}`}
                                    className={twMerge(smallInputClass, 'w-10 text-center')}
                                />
                            </label>
                        ) : (
                            <label className="flex items-center gap-1 text-[10px] uppercase text-slate-500">
                                CR
                                <input
                                    type="text"
                                    value={combatant.cr ?? ''}
                                    onChange={(e) => onChange({ cr: e.target.value.trim() === '' ? undefined : e.target.value })}
                                    aria-label={`Challenge rating for ${combatant.name}`}
                                    aria-invalid={crInvalid || undefined}
                                    placeholder="—"
                                    className={twMerge(smallInputClass, 'w-10 text-center', crInvalid && 'border-red-500')}
                                />
                            </label>
                        )}
                    </div>
                </div>

                {/* Armor Class */}
                <div className="col-span-1 flex justify-center">
                    <input
                        type="number"
                        min={0}
                        value={combatant.ac ?? ''}
                        onChange={(e) => onChange({ ac: parseOptionalInt(e.target.value) })}
                        aria-label={`Armor class for ${combatant.name}`}
                        placeholder="—"
                        className="w-12 text-center bg-slate-800 border border-slate-600 rounded p-1 text-base font-bold text-slate-200 outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-slate-600"
                    />
                </div>

                {/* HP Controls */}
                <div className="col-span-4 flex flex-col items-center gap-2">
                    <div className="flex items-center justify-center gap-2">
                        <Button variant="icon" onClick={() => onChange({ hp: combatant.hp - 1 })} className="text-red-400 hover:bg-red-500/20" aria-label="Decrease HP">
                            <Icons.ChevronDown className="w-4 h-4" />
                        </Button>
                        <div className="relative">
                            <input
                                type="number"
                                value={combatant.hp}
                                onChange={(e) => onChange({ hp: parseInt(e.target.value) || 0 })}
                                aria-label={`Current HP for ${combatant.name}`}
                                className={twMerge(
                                    "w-16 text-center bg-slate-800 border border-slate-700 rounded p-1 text-lg font-bold outline-none focus:ring-1 focus:ring-amber-500",
                                    combatant.hp <= 0 ? "text-red-500" : combatant.hp < combatant.maxHp / 2 ? "text-yellow-500" : "text-green-400"
                                )}
                            />
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 bg-slate-900 px-1">Current</span>
                        </div>
                        <span className="text-slate-500">/</span>
                        <div className="relative">
                            <input
                                type="number"
                                value={combatant.maxHp}
                                onChange={(e) => onChange({ maxHp: parseInt(e.target.value) || 0 })}
                                aria-label={`Max HP for ${combatant.name}`}
                                className="w-16 text-center bg-slate-800 border border-slate-700 rounded p-1 text-sm text-slate-400 outline-none focus:ring-1 focus:ring-amber-500"
                            />
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 bg-slate-900 px-1">Max</span>
                        </div>
                        <Button variant="icon" onClick={() => onChange({ hp: combatant.hp + 1 })} className="text-green-400 hover:bg-green-500/20" aria-label="Increase HP">
                            <Icons.ChevronUp className="w-4 h-4" />
                        </Button>
                    </div>
                    <div className="flex items-center gap-1">
                        <input
                            type="number"
                            min={1}
                            inputMode="numeric"
                            value={delta}
                            onChange={(e) => setDelta(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    applyDelta(e.shiftKey ? 'heal' : 'damage');
                                }
                            }}
                            aria-label={`HP change amount for ${combatant.name}`}
                            title="Enter applies damage, Shift+Enter heals"
                            placeholder="±N"
                            className={twMerge(smallInputClass, 'w-14 text-center py-1')}
                        />
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => applyDelta('damage')}
                            disabled={!deltaValid}
                            aria-label={`Apply damage to ${combatant.name}`}
                            className="px-2 py-1 text-xs text-red-400 hover:bg-red-500/20 hover:text-red-300"
                        >
                            Dmg
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => applyDelta('heal')}
                            disabled={!deltaValid}
                            aria-label={`Apply healing to ${combatant.name}`}
                            className="px-2 py-1 text-xs text-green-400 hover:bg-green-500/20 hover:text-green-300"
                        >
                            Heal
                        </Button>
                    </div>
                </div>

                {/* Actions */}
                <div className="col-span-2 flex justify-end">
                    <Button variant="icon" onClick={onRemove} className="text-slate-600 hover:text-red-400 hover:bg-slate-800" aria-label={`Remove ${combatant.name}`}>
                        <Icons.Trash className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Conditions + Notes */}
            <div className="mt-2 flex flex-wrap items-center gap-2 pl-[16.66%]">
                <ul role="list" className="contents" aria-label={`Conditions on ${combatant.name}`}>
                    {conditions.map(condition => (
                        <li
                            key={condition.name}
                            className={twMerge(
                                "inline-flex items-center gap-1 rounded-full border pl-2 pr-1 py-0.5 text-xs",
                                CONDITION_CHIP_CLASSES[condition.name.toLowerCase()] ?? DEFAULT_CONDITION_CHIP_CLASS
                            )}
                        >
                            <span>{condition.name}</span>
                            {typeof condition.roundsRemaining === 'number' && (
                                <span className="text-[10px] opacity-75" title={`${condition.roundsRemaining} rounds remaining`}>
                                    <span aria-hidden="true">{condition.roundsRemaining}r</span>
                                    <span className="sr-only">{`, ${condition.roundsRemaining} rounds remaining`}</span>
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => onRemoveCondition(condition.name)}
                                aria-label={`Remove ${condition.name} from ${combatant.name}`}
                                className="rounded-full p-0.5 hover:bg-slate-900/60 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            >
                                <Icons.X className="w-3 h-3" />
                            </button>
                        </li>
                    ))}
                </ul>
                {availableConditions.length > 0 && (
                    <div className="flex items-center gap-1">
                        <select
                            value=""
                            onChange={(e) => {
                                if (!e.target.value) return;
                                onAddCondition(e.target.value, parseOptionalInt(conditionRounds));
                                setConditionRounds('');
                            }}
                            aria-label={`Add condition to ${combatant.name}`}
                            className={twMerge(smallInputClass, 'py-1 text-slate-400')}
                        >
                            <option value="">+ Condition</option>
                            {availableConditions.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                        <input
                            type="number"
                            min={1}
                            value={conditionRounds}
                            onChange={(e) => setConditionRounds(e.target.value)}
                            aria-label={`Condition duration in rounds for ${combatant.name}`}
                            title="Duration in rounds (blank = until removed)"
                            placeholder="rds"
                            className={twMerge(smallInputClass, 'w-12 text-center py-1')}
                        />
                    </div>
                )}
                <input
                    type="text"
                    value={combatant.notes || ''}
                    onChange={(e) => onChange({ notes: e.target.value })}
                    placeholder="Notes..."
                    aria-label={`Notes for ${combatant.name}`}
                    className="flex-1 min-w-[8rem] bg-transparent border-none p-0 text-xs text-slate-500 focus:ring-0"
                />
            </div>
        </div>
    );
};

const EncounterDifficultyReadout: React.FC<{
    combatants: Combatant[];
    partyLevel: number;
    partySize: number;
    onPartyLevelChange: (level: number) => void;
    onPartySizeChange: (size: number) => void;
}> = ({ combatants, partyLevel, partySize, onPartyLevelChange, onPartySizeChange }) => {
    const hasEnemies = combatants.some(c => c.type !== 'pc');
    if (!hasEnemies) return null;

    const { partyLevels, monsterCRs, hasPcs, needsFallbackLevel } = deriveDifficultyInputs(combatants, partyLevel, partySize);

    if (monsterCRs.length === 0) {
        return (
            <p className="mb-4 flex-shrink-0 text-xs text-slate-500">
                Set a CR on enemies to see encounter difficulty.
            </p>
        );
    }

    const result = calculateEncounterDifficulty({ partyLevels, monsterCRs });
    const { thresholds } = result;

    return (
        <section
            aria-label="Encounter difficulty"
            className="mb-4 flex-shrink-0 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2 text-xs text-slate-400"
        >
            <span className="flex items-center gap-2">
                <span className="uppercase tracking-wider font-bold">Difficulty</span>
                <span className={twMerge("text-sm font-bold", RATING_CLASSES[result.rating])} data-testid="encounter-difficulty-rating">
                    {RATING_LABELS[result.rating]}
                </span>
            </span>
            <span>
                <span className="text-slate-200 font-semibold">{formatXp(result.adjustedXp)}</span> adj. XP
                <span className="text-slate-500"> ({formatXp(result.baseXp)} × {result.multiplier})</span>
            </span>
            <span className="text-slate-500" title="Party XP thresholds: Easy / Medium / Hard / Deadly">
                E {formatXp(thresholds.easy)} · M {formatXp(thresholds.medium)} · H {formatXp(thresholds.hard)} · D {formatXp(thresholds.deadly)}
            </span>
            <span className="ml-auto flex items-center gap-2">
                {hasPcs ? (
                    <span>{partyLevels.length} PC{partyLevels.length === 1 ? '' : 's'}</span>
                ) : (
                    <label className="flex items-center gap-1">
                        Party
                        <input
                            type="number"
                            min={1}
                            max={10}
                            value={partySize}
                            onChange={(e) => onPartySizeChange(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))}
                            aria-label="Party size"
                            className={twMerge(smallInputClass, 'w-10 text-center')}
                        />
                    </label>
                )}
                {needsFallbackLevel && (
                    <label className="flex items-center gap-1" title={hasPcs ? 'Used for PCs without a level' : undefined}>
                        Lv
                        <input
                            type="number"
                            min={1}
                            max={20}
                            value={partyLevel}
                            onChange={(e) => onPartyLevelChange(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))}
                            aria-label="Party level"
                            className={twMerge(smallInputClass, 'w-10 text-center')}
                        />
                    </label>
                )}
            </span>
        </section>
    );
};

interface NewCombatantData {
    name: string;
    type: CombatantType;
    hp: number;
    initiative: number;
    ac?: number;
    cr?: string;
    level?: number;
}

const EMPTY_MANUAL_FORM = { name: '', hp: 10, init: 10, ac: '', cr: '', type: 'monster' as CombatantType };

const AddCombatantMenu: React.FC<{
    npcs: NPC[],
    pcs: PlayerCharacter[],
    onAdd: (data: NewCombatantData) => void,
    isOpen: boolean,
    onToggle: () => void
}> = ({ npcs, pcs, onAdd, isOpen, onToggle }) => {
    const [activeTab, setActiveTab] = useState<'manual' | 'roster'>('manual');
    const [manualForm, setManualForm] = useState(EMPTY_MANUAL_FORM);

    return (
        <div className="relative">
            <Button onClick={onToggle} className={isOpen ? 'bg-slate-700' : ''}>
                <Icons.Plus className="w-4 h-4 mr-2" /> Add Combatant
            </Button>

            {isOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 animate-in fade-in slide-in-from-bottom-2 z-20">
                    <div className="flex space-x-2 border-b border-slate-700 pb-2 mb-4">
                        <button onClick={() => setActiveTab('manual')} className={twMerge("text-xs font-bold uppercase tracking-wider pb-1 border-b-2 transition-colors", activeTab === 'manual' ? "border-amber-500 text-amber-400" : "border-transparent text-slate-500 hover:text-slate-300")}>Manual</button>
                        <button onClick={() => setActiveTab('roster')} className={twMerge("text-xs font-bold uppercase tracking-wider pb-1 border-b-2 transition-colors", activeTab === 'roster' ? "border-amber-500 text-amber-400" : "border-transparent text-slate-500 hover:text-slate-300")}>Roster</button>
                    </div>

                    {activeTab === 'manual' ? (
                        <div className="space-y-3">
                             <input
                                type="text"
                                placeholder="Name (e.g. Goblin Archer)"
                                value={manualForm.name}
                                onChange={e => setManualForm({...manualForm, name: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-amber-500"
                                autoFocus
                             />
                             <div className="grid grid-cols-4 gap-2">
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase">HP</label>
                                    <input
                                        type="number"
                                        value={manualForm.hp}
                                        onChange={e => setManualForm({...manualForm, hp: parseInt(e.target.value) || 0})}
                                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase">Init</label>
                                    <input
                                        type="number"
                                        value={manualForm.init}
                                        onChange={e => setManualForm({...manualForm, init: parseInt(e.target.value) || 0})}
                                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase">AC</label>
                                    <input
                                        type="number"
                                        value={manualForm.ac}
                                        onChange={e => setManualForm({...manualForm, ac: e.target.value})}
                                        aria-label="New combatant armor class"
                                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase">CR</label>
                                    <input
                                        type="text"
                                        value={manualForm.cr}
                                        placeholder="1/4"
                                        onChange={e => setManualForm({...manualForm, cr: e.target.value})}
                                        aria-label="New combatant challenge rating"
                                        disabled={manualForm.type === 'pc'}
                                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-40"
                                    />
                                </div>
                             </div>
                             <div className="flex gap-2">
                                {(['pc', 'npc', 'monster'] as const).map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setManualForm({...manualForm, type: t})}
                                        className={twMerge("flex-1 py-1 text-xs uppercase rounded border transition-colors", manualForm.type === t ? "bg-amber-600 border-amber-600 text-white" : "border-slate-600 text-slate-400 hover:border-slate-500")}
                                    >
                                        {t}
                                    </button>
                                ))}
                             </div>
                             <Button
                                onClick={() => {
                                    onAdd({
                                        name: manualForm.name || 'Unknown',
                                        type: manualForm.type,
                                        hp: manualForm.hp,
                                        initiative: manualForm.init,
                                        ac: parseOptionalInt(manualForm.ac),
                                        cr: manualForm.type !== 'pc' && manualForm.cr.trim() ? manualForm.cr.trim() : undefined,
                                    });
                                    setManualForm(EMPTY_MANUAL_FORM);
                                }}
                                className="w-full"
                                disabled={!manualForm.name}
                            >Add</Button>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                            <p className="text-xs text-slate-500 mb-2">Click to add to combat.</p>
                            {pcs.map(pc => {
                                const pcHp = estimatePcHp(pc);
                                const level = pc.characterStatistics?.classes?.level;
                                return (
                                    <button
                                        key={pc.id}
                                        onClick={() => onAdd({
                                            name: pc.characterSocial.characterName,
                                            type: 'pc',
                                            hp: pcHp,
                                            initiative: 0,
                                            level: typeof level === 'number' && level > 0 ? level : undefined,
                                        })}
                                        className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-700 text-sm text-blue-300 truncate"
                                    >
                                        {pc.characterSocial.characterName} ({pcHp} HP)
                                    </button>
                                );
                            })}
                            {npcs.map(npc => {
                                const parsed = parseNpcCombatStats(npc.stats);
                                const hp = parsed.hp ?? 10;
                                return (
                                    <button
                                        key={npc.id}
                                        onClick={() => onAdd({
                                            name: npc.name,
                                            type: 'npc',
                                            hp,
                                            initiative: 0,
                                            ac: parsed.ac ?? undefined,
                                            cr: parsed.cr ?? undefined,
                                        })}
                                        className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-700 text-sm text-green-300 truncate"
                                    >
                                        {npc.name}{parsed.hp !== null ? ` (${hp} HP)` : ''}
                                    </button>
                                );
                            })}
                             {pcs.length === 0 && npcs.length === 0 && <p className="text-xs text-slate-600 italic">No campaign characters found.</p>}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
