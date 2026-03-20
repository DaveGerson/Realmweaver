
import React from 'react';
import type { PlayerCharacter } from '../../types/index';
import { PlayerCharacterImporter } from '../generators/PlayerCharacterImporter';
import { Icons } from '../common/Icons';

interface PlayerCharacterDashboardProps {
  playerCharacters: PlayerCharacter[];
  onImport: (file: File) => Promise<void>;
  onSelectPlayerCharacter: (id: string) => void;
  isMockMode: boolean;
}

export const PlayerCharacterDashboard: React.FC<PlayerCharacterDashboardProps> = ({ playerCharacters, onImport, onSelectPlayerCharacter, isMockMode }) => {
  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <PlayerCharacterImporter onImport={onImport} isMockMode={isMockMode} />
          {/* A "Create from Scratch" component could be added here in the future */}
        </div>
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold font-serif text-slate-200 mb-4">Player Characters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(playerCharacters || []).map(pc => (
              <button 
                key={pc.id} 
                onClick={() => onSelectPlayerCharacter(pc.id)}
                className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 border-l-4 border-l-teal-500 text-left hover:bg-slate-800 hover:border-slate-700 hover:border-l-teal-400 transition-all space-y-2"
              >
                <h3 className="font-semibold text-teal-400">{pc.characterSocial.characterName}</h3>
                <p className="text-sm text-slate-400">{pc.characterStatistics.classes.charClass} {pc.characterStatistics.classes.level} / {pc.characterSocial.species}</p>
                 <p className="text-xs text-slate-500">Player: {pc.playerName}</p>
              </button>
            ))}
            {(!playerCharacters || playerCharacters.length === 0) && (
                <div className="md:col-span-2 text-center py-16">
                    <Icons.PlayerCharacters className="w-16 h-16 mx-auto mb-4 text-slate-700" />
                    <p className="text-lg font-serif text-slate-400 mb-2">Your adventuring party awaits assembly</p>
                    <p className="text-sm text-slate-600">Import character sheets to track your players' heroes.</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
