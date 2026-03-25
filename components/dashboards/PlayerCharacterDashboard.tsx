
import React, { useState, useMemo } from 'react';
import type { PlayerCharacter } from '../../types/index';
import { PlayerCharacterImporter } from '../generators/PlayerCharacterImporter';
import { Icons } from '../common/Icons';

interface PlayerCharacterDashboardProps {
  playerCharacters: PlayerCharacter[];
  onImport: (file: File) => Promise<void>;
  onPlayerCharacterCreated?: (pc: PlayerCharacter) => void;
  onSelectPlayerCharacter: (id: string) => void;
  isMockMode: boolean;
}

export const PlayerCharacterDashboard: React.FC<PlayerCharacterDashboardProps> = ({ playerCharacters, onImport, onPlayerCharacterCreated, onSelectPlayerCharacter, isMockMode }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const filteredPCs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return playerCharacters || [];
    return (playerCharacters || []).filter(pc =>
      pc.characterSocial.characterName?.toLowerCase().includes(q) ||
      pc.characterSocial.species?.toLowerCase().includes(q) ||
      pc.characterStatistics.classes.charClass?.toLowerCase().includes(q) ||
      pc.playerName?.toLowerCase().includes(q)
    );
  }, [playerCharacters, searchTerm]);

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <PlayerCharacterImporter onImport={onImport} onPlayerCharacterCreated={onPlayerCharacterCreated} isMockMode={isMockMode} />
          {/* A "Create from Scratch" component could be added here in the future */}
        </div>
        <div className="lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-2xl font-bold font-serif text-slate-200">Player Characters ({(playerCharacters || []).length})</h2>
            <div className="relative max-w-xs w-full sm:w-auto">
              <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search characters..."
                className="w-full bg-slate-800 border border-slate-700 rounded-md pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredPCs.map(pc => {
              const charClass = pc.characterStatistics.classes.charClass;
              const subclass = pc.characterStatistics.classes.subclass;
              const level = pc.characterStatistics.classes.level;
              const species = pc.characterSocial.species;
              const background = pc.characterSocial.background;
              return (
                <button
                  key={pc.id}
                  onClick={() => onSelectPlayerCharacter(pc.id)}
                  className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 border-l-4 border-l-amber-500 text-left hover:bg-slate-800 hover:border-slate-700 hover:border-l-amber-400 transition-all space-y-2"
                >
                  <h3 className="font-semibold text-amber-400 leading-tight">{pc.characterSocial.characterName}</h3>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] bg-amber-900/40 text-amber-300 border border-amber-500/30 rounded-full px-2 py-0.5">
                      {species}
                    </span>
                    <span className="text-[10px] bg-slate-700/60 text-slate-300 border border-slate-600/30 rounded-full px-2 py-0.5">
                      {subclass ? `${subclass} ` : ''}{charClass} {level}
                    </span>
                  </div>
                  {background && (
                    <p className="text-xs text-slate-500 italic line-clamp-1">{background}</p>
                  )}
                  {pc.playerName && (
                    <p className="text-xs text-slate-600">Player: {pc.playerName}</p>
                  )}
                </button>
              );
            })}
            {filteredPCs.length === 0 && (playerCharacters || []).length > 0 && (
                <div className="md:col-span-2 xl:col-span-3 text-center py-10">
                    <Icons.Search className="w-10 h-10 mx-auto mb-3 text-slate-700" />
                    <p className="text-slate-400">No characters match "{searchTerm}"</p>
                </div>
            )}
            {(!playerCharacters || playerCharacters.length === 0) && (
                <div className="md:col-span-2 xl:col-span-3 text-center py-16">
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
