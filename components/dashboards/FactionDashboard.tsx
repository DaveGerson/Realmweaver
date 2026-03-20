
import React from 'react';
import type { Faction, NPC, Location } from '../../types/index';
import { FactionGenerator } from '../generators/FactionGenerator';
import { Icons } from '../common/Icons';

interface FactionDashboardProps {
  factions: Faction[];
  npcs?: NPC[];
  locations?: Location[];
  onFactionCreated: (data: Omit<Faction, 'id'>) => void;
  onSelectFaction: (id: string) => void;
  isMockMode: boolean;
  isOfficialSetting?: boolean;
  campaignContext?: string;
}

export const FactionDashboard: React.FC<FactionDashboardProps> = ({ factions, npcs = [], locations = [], onFactionCreated, onSelectFaction, isMockMode, isOfficialSetting, campaignContext }) => {
  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 h-full">
          <FactionGenerator onFactionCreated={onFactionCreated} isMockMode={isMockMode} isOfficialSetting={isOfficialSetting} npcs={npcs} allLocations={locations} campaignContext={campaignContext} />
        </div>
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold font-serif text-slate-200 mb-4">Existing Factions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {factions.map(faction => (
              <button
                key={faction.id}
                onClick={() => onSelectFaction(faction.id)}
                className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 border-l-4 border-l-violet-500 text-left hover:bg-slate-800 hover:border-slate-700 hover:border-l-violet-400 transition-all space-y-2"
              >
                <h3 className="font-semibold text-violet-400">{faction.name}</h3>
                <p className="text-sm text-slate-400 line-clamp-2">{faction.description}</p>
              </button>
            ))}
            {factions.length === 0 && (
                <div className="md:col-span-2 text-center py-16">
                    <Icons.Factions className="w-16 h-16 mx-auto mb-4 text-slate-700" />
                    <p className="text-lg font-serif text-slate-400 mb-2">Power structures shape every world</p>
                    <p className="text-sm text-slate-600">Use the generator to forge guilds, cults, and noble houses.</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
