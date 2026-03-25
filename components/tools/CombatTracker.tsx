
import React, { useState, useEffect } from 'react';
import type { Encounter, Combatant, NPC, PlayerCharacter, CombatantType } from '../../types/index';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { twMerge } from 'tailwind-merge';
import { produce } from 'immer';
import { estimatePcHp } from '../../utils/entityUtils';

interface CombatTrackerProps {
  encounter: Encounter;
  onUpdate: (encounter: Encounter) => void;
  campaignNpcs: NPC[];
  campaignPcs: PlayerCharacter[];
}

export const CombatTracker: React.FC<CombatTrackerProps> = ({ encounter, onUpdate, campaignNpcs, campaignPcs }) => {
  const [isAdding, setIsAdding] = useState(false);
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

  const addCombatant = (name: string, type: CombatantType, hp: number, initiative: number) => {
      const newCombatant: Combatant = {
          id: crypto.randomUUID(),
          name,
          type,
          hp,
          maxHp: hp,
          initiative,
          notes: ''
      };
      const nextEncounter = produce(encounter, draft => {
          draft.combatants.push(newCombatant);
      });
      onUpdate(nextEncounter);
      setIsAdding(false);
  };

  const removeCombatant = (id: string) => {
      const nextEncounter = produce(encounter, draft => {
          draft.combatants = draft.combatants.filter(c => c.id !== id);
          // Adjust turn index if removing active or previous combatant
          if (encounter.turnIndex >= draft.combatants.length) {
              draft.turnIndex = 0;
          }
      });
      onUpdate(nextEncounter);
  };

  // Handlers for Encounter Flow
  const nextTurn = () => {
      const nextEncounter = produce(encounter, draft => {
          if (draft.combatants.length === 0) return;
          draft.turnIndex++;
          if (draft.turnIndex >= draft.combatants.length) {
              draft.turnIndex = 0;
              draft.round++;
          }
      });
      onUpdate(nextEncounter);
  };

  const prevTurn = () => {
      const nextEncounter = produce(encounter, draft => {
        if (draft.combatants.length === 0) return;
          draft.turnIndex--;
          if (draft.turnIndex < 0) {
              draft.turnIndex = draft.combatants.length - 1;
              draft.round = Math.max(1, draft.round - 1);
          }
      });
      onUpdate(nextEncounter);
  };

  const sortInitiative = () => {
      const nextEncounter = produce(encounter, draft => {
          draft.combatants.sort((a, b) => b.initiative - a.initiative);
          draft.turnIndex = 0; // Reset turn to start
      });
      onUpdate(nextEncounter);
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

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900/50 rounded-xl border border-slate-800 mb-6 relative">
            {/* Table Header */}
            <div className="sticky top-0 bg-slate-900 z-10 grid grid-cols-12 gap-4 p-4 border-b border-slate-800 text-xs font-medium text-slate-400 uppercase tracking-wider">
                <div className="col-span-2 text-center">Init</div>
                <div className="col-span-4">Name</div>
                <div className="col-span-4 text-center">HP</div>
                <div className="col-span-2 text-right">Actions</div>
            </div>

            {/* Combatant Rows */}
            <div className="divide-y divide-slate-800">
                {sortedCombatants.map((combatant, index) => (
                    <div 
                        key={combatant.id} 
                        className={twMerge(
                            "grid grid-cols-12 gap-4 p-4 items-center transition-colors",
                            index === encounter.turnIndex ? "bg-amber-500/10 border-l-4 border-amber-500" : "hover:bg-slate-800/30 border-l-4 border-transparent"
                        )}
                    >
                         {/* Initiative */}
                        <div className="col-span-2 flex justify-center">
                            <input 
                                type="number" 
                                value={combatant.initiative} 
                                onChange={(e) => updateCombatant(combatant.id, { initiative: parseInt(e.target.value) || 0 })}
                                className="w-12 text-center bg-slate-800 border border-slate-700 rounded p-1 text-lg font-bold text-slate-200 focus:ring-1 focus:ring-amber-500 outline-none"
                            />
                        </div>

                        {/* Name & Type */}
                        <div className="col-span-4">
                            <input 
                                type="text" 
                                value={combatant.name} 
                                onChange={(e) => updateCombatant(combatant.id, { name: e.target.value })}
                                className="w-full bg-transparent border-none p-0 text-base font-medium text-slate-200 focus:ring-0 placeholder:text-slate-600"
                                placeholder="Combatant Name"
                            />
                            <div className="flex gap-2 mt-1">
                                <span className={twMerge("text-[10px] uppercase px-1.5 py-0.5 rounded", 
                                    combatant.type === 'pc' ? 'bg-blue-500/20 text-blue-300' : 
                                    combatant.type === 'npc' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                                )}>
                                    {combatant.type}
                                </span>
                                <input 
                                    type="text" 
                                    value={combatant.notes || ''} 
                                    onChange={(e) => updateCombatant(combatant.id, { notes: e.target.value })}
                                    placeholder="Notes..."
                                    className="bg-transparent border-none p-0 text-xs text-slate-500 focus:ring-0 w-full"
                                />
                            </div>
                        </div>

                        {/* HP Controls */}
                        <div className="col-span-4 flex items-center justify-center gap-2">
                            <Button variant="icon" onClick={() => updateCombatant(combatant.id, { hp: combatant.hp - 1 })} className="text-red-400 hover:bg-red-500/20" aria-label="Decrease HP">
                                <Icons.ChevronDown className="w-4 h-4" />
                            </Button>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={combatant.hp}
                                    onChange={(e) => updateCombatant(combatant.id, { hp: parseInt(e.target.value) || 0 })}
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
                                    onChange={(e) => updateCombatant(combatant.id, { maxHp: parseInt(e.target.value) || 0 })}
                                    className="w-16 text-center bg-slate-800 border border-slate-700 rounded p-1 text-sm text-slate-400 outline-none focus:ring-1 focus:ring-amber-500"
                                />
                                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 bg-slate-900 px-1">Max</span>
                            </div>
                            <Button variant="icon" onClick={() => updateCombatant(combatant.id, { hp: Math.min(combatant.maxHp, combatant.hp + 1) })} className="text-green-400 hover:bg-green-500/20" aria-label="Increase HP">
                                <Icons.ChevronUp className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Actions */}
                        <div className="col-span-2 flex justify-end">
                            <Button variant="icon" onClick={() => removeCombatant(combatant.id)} className="text-slate-600 hover:text-red-400 hover:bg-slate-800" aria-label={`Remove ${combatant.name}`}>
                                <Icons.Trash className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                ))}
                {encounter.combatants.length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                        <p>The battlefield is empty.</p>
                        <p className="text-sm">Add combatants to begin.</p>
                    </div>
                )}
            </div>
        </div>

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

const AddCombatantMenu: React.FC<{ 
    npcs: NPC[], 
    pcs: PlayerCharacter[], 
    onAdd: (name: string, type: CombatantType, hp: number, init: number) => void,
    isOpen: boolean,
    onToggle: () => void
}> = ({ npcs, pcs, onAdd, isOpen, onToggle }) => {
    const [activeTab, setActiveTab] = useState<'manual' | 'roster'>('manual');
    const [manualForm, setManualForm] = useState({ name: '', hp: 10, init: 10, type: 'monster' as CombatantType });

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
                             <div className="grid grid-cols-2 gap-2">
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
                                onClick={() => { onAdd(manualForm.name || 'Unknown', manualForm.type, manualForm.hp, manualForm.init); setManualForm({name: '', hp: 10, init: 10, type: 'monster'}); }} 
                                className="w-full"
                                disabled={!manualForm.name}
                            >Add</Button>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                            <p className="text-xs text-slate-500 mb-2">Click to add to combat.</p>
                            {pcs.map(pc => {
                                const pcHp = estimatePcHp(pc);
                                return (
                                    <button
                                        key={pc.id}
                                        onClick={() => onAdd(pc.characterSocial.characterName, 'pc', pcHp, 0)}
                                        className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-700 text-sm text-blue-300 truncate"
                                    >
                                        {pc.characterSocial.characterName} ({pcHp} HP)
                                    </button>
                                );
                            })}
                            {npcs.map(npc => {
                                const hpMatch = npc.stats?.match(/(?:hp|hit\s*points)\s*[:=\-–—]?\s*(\d+)/i);
                                const hp = hpMatch ? parseInt(hpMatch[1], 10) : 10;
                                return (
                                    <button
                                        key={npc.id}
                                        onClick={() => onAdd(npc.name, 'npc', hp, 0)}
                                        className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-700 text-sm text-green-300 truncate"
                                    >
                                        {npc.name}{hpMatch ? ` (${hp} HP)` : ''}
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
