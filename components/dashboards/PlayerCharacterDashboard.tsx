
import React from 'react';
import type { PlayerCharacter } from '../../types/index';
import { PlayerCharacterImporter } from '../generators/PlayerCharacterImporter';
import { Icons } from '../Icons';

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
                className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 text-left hover:bg-slate-800 hover:border-indigo-600/50 transition-all space-y-2"
              >
                <h3 className="font-semibold text-indigo-400">{pc.characterSocial.characterName}</h3>
                <p className="text-sm text-slate-400">{pc.characterStatistics.classes.charClass} {pc.characterStatistics.classes.level} / {pc.characterSocial.species}</p>
                 <p className="text-xs text-slate-500">Player: {pc.playerName}</p>
              </button>
            ))}
            {(!playerCharacters || playerCharacters.length === 0) && (
                <div className="md:col-span-2 text-center py-10 text-slate-500">
                    <Icons.PlayerCharacters className="w-12 h-12 mx-auto mb-2" />
                    <p>No player characters added yet. Import a character sheet to get started!</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
