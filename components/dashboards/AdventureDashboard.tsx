
import React from 'react';
import type { Adventure, AdventureForBatchAdd } from '../../types/index';
import { AdventureGenerator } from '../generators/AdventureGenerator';
import { Icons } from '../common/Icons';

interface AdventureDashboardProps {
  adventures: Adventure[];
  onAdventureCreated: (data: AdventureForBatchAdd) => void;
  onSelectAdventure: (id: string) => void;
  isMockMode: boolean;
}

export const AdventureDashboard: React.FC<AdventureDashboardProps> = ({ adventures, onAdventureCreated, onSelectAdventure, isMockMode }) => {
  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <AdventureGenerator onAdventureCreated={onAdventureCreated} isMockMode={isMockMode} />
        </div>
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold font-serif text-slate-200 mb-4">Existing Adventures</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {adventures.map(adv => (
              <button 
                key={adv.id} 
                onClick={() => onSelectAdventure(adv.id)}
                className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 text-left hover:bg-slate-800 hover:border-indigo-600/50 transition-all space-y-2"
              >
                <h3 className="font-semibold text-indigo-400">{adv.title}</h3>
                <p className="text-sm text-slate-400 line-clamp-2">{adv.hook}</p>
                <span className="text-xs bg-slate-700 text-slate-300 rounded-full px-2 py-0.5">Level {adv.level}</span>
              </button>
            ))}
            {adventures.length === 0 && (
                <div className="md:col-span-2 text-center py-10 text-slate-500">
                    <Icons.Adventures className="w-12 h-12 mx-auto mb-2" />
                    <p>No adventures created yet. Use the generator to start one!</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
