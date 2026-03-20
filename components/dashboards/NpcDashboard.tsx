
import React from 'react';
import type { NPC, Faction } from '../../types/index';
import { NpcGenerator } from '../generators/NpcGenerator';
import { Icons } from '../common/Icons';

interface NpcDashboardProps {
  npcs: NPC[];
  factions?: Faction[];
  onNpcCreated: (data: Omit<NPC, 'id'>) => void;
  onSelectNpc: (id: string) => void;
  isMockMode: boolean;
  isOfficialSetting?: boolean;
  campaignContext?: string;
}

export const NpcDashboard: React.FC<NpcDashboardProps> = ({ npcs, factions = [], onNpcCreated, onSelectNpc, isMockMode, isOfficialSetting, campaignContext }) => {
  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 h-full">
          <NpcGenerator onNpcCreated={onNpcCreated} isMockMode={isMockMode} isOfficialSetting={isOfficialSetting} factions={factions} campaignContext={campaignContext} />
        </div>
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold font-serif text-slate-200 mb-4">Existing NPCs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {npcs.map(npc => (
              <button
                key={npc.id}
                onClick={() => onSelectNpc(npc.id)}
                className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 border-l-4 border-l-amber-500 text-left hover:bg-slate-800 hover:border-slate-700 hover:border-l-amber-400 transition-all space-y-2"
              >
                <h3 className="font-semibold text-amber-400">{npc.name}</h3>
                <p className="text-sm text-slate-400 line-clamp-2">{npc.description}</p>
              </button>
            ))}
            {npcs.length === 0 && (
                <div className="md:col-span-2 text-center py-16">
                    <Icons.NPCs className="w-16 h-16 mx-auto mb-4 text-slate-700" />
                    <p className="text-lg font-serif text-slate-400 mb-2">Every great story needs its cast of characters</p>
                    <p className="text-sm text-slate-600">Use the generator to bring your world's inhabitants to life.</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
