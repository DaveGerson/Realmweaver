
import React from 'react';
import type { Location, Faction } from '../../types/index';
import { LocationGenerator } from '../generators/LocationGenerator';
import { Icons } from '../common/Icons';

interface LocationDashboardProps {
  locations: Location[];
  factions?: Faction[];
  onLocationCreated: (data: Omit<Location, 'id'>) => void;
  onSelectLocation: (id: string) => void;
  isMockMode: boolean;
  isOfficialSetting?: boolean;
  campaignContext?: string;
}

export const LocationDashboard: React.FC<LocationDashboardProps> = ({ locations, factions = [], onLocationCreated, onSelectLocation, isMockMode, isOfficialSetting, campaignContext }) => {
  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 h-full">
          <LocationGenerator onLocationCreated={onLocationCreated} isMockMode={isMockMode} isOfficialSetting={isOfficialSetting} allLocations={locations} factions={factions} campaignContext={campaignContext} />
        </div>
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold font-serif text-slate-200 mb-4">Existing Locations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {locations.map(location => (
              <button
                key={location.id}
                onClick={() => onSelectLocation(location.id)}
                className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 border-l-4 border-l-emerald-500 text-left hover:bg-slate-800 hover:border-slate-700 hover:border-l-emerald-400 transition-all space-y-2"
              >
                <h3 className="font-semibold text-emerald-400">{location.name}</h3>
                <p className="text-sm text-slate-400 line-clamp-2">{location.description}</p>
              </button>
            ))}
            {locations.length === 0 && (
                <div className="md:col-span-2 text-center py-16">
                    <Icons.Locations className="w-16 h-16 mx-auto mb-4 text-slate-700" />
                    <p className="text-lg font-serif text-slate-400 mb-2">Your world awaits -- where does the adventure begin?</p>
                    <p className="text-sm text-slate-600">Use the generator to create taverns, dungeons, and forgotten ruins.</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
