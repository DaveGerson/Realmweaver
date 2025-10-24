import React from 'react';
import type { NPC } from '../../types';
import { NpcGenerator } from '../generators/NpcGenerator';
import { Icons } from '../Icons';

interface NpcDashboardProps {
  npcs: NPC[];
  onNpcCreated: (data: Omit<NPC, 'id'>) => void;
  onSelectNpc: (id: string) => void;
  isMockMode: boolean;
}

export const NpcDashboard: React.FC<NpcDashboardProps> = ({ npcs, onNpcCreated, onSelectNpc, isMockMode }) => {
  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <NpcGenerator onNpcCreated={onNpcCreated} isMockMode={isMockMode} />
        </div>
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold font-serif text-slate-200 mb-4">Existing NPCs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {npcs.map(npc => (
              <button
                key={npc.id}
                onClick={() => onSelectNpc(npc.id)}
                className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 text-left hover:bg-slate-800 hover:border-indigo-600/50 transition-all space-y-2"
              >
                <h3 className="font-semibold text-indigo-400">{npc.name}</h3>
                <p className="text-sm text-slate-400 line-clamp-2">{npc.description}</p>
              </button>
            ))}
            {npcs.length === 0 && (
                <div className="md:col-span-2 text-center py-10 text-slate-500">
                    <Icons.NPCs className="w-12 h-12 mx-auto mb-2" />
                    <p>No NPCs created yet. Use the generator to bring some characters to life!</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};