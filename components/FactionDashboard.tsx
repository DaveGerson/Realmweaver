import React from 'react';
import type { Faction } from '../types';
import { FactionGenerator } from './FactionGenerator';
import { Icons } from './Icons';

interface FactionDashboardProps {
  factions: Faction[];
  onFactionCreated: (data: Omit<Faction, 'id'>) => void;
  onSelectFaction: (id: string) => void;
  isMockMode: boolean;
}

export const FactionDashboard: React.FC<FactionDashboardProps> = ({ factions, onFactionCreated, onSelectFaction, isMockMode }) => {
  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <FactionGenerator onFactionCreated={onFactionCreated} isMockMode={isMockMode} />
        </div>
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold font-serif text-slate-200 mb-4">Existing Factions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {factions.map(faction => (
              <button
                key={faction.id}
                onClick={() => onSelectFaction(faction.id)}
                className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 text-left hover:bg-slate-800 hover:border-indigo-600/50 transition-all space-y-2"
              >
                <h3 className="font-semibold text-indigo-400">{faction.name}</h3>
                <p className="text-sm text-slate-400 line-clamp-2">{faction.description}</p>
              </button>
            ))}
            {factions.length === 0 && (
                <div className="md:col-span-2 text-center py-10 text-slate-500">
                    <Icons.Factions className="w-12 h-12 mx-auto mb-2" />
                    <p>No factions created yet. Use the generator to create organizations for your world!</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
