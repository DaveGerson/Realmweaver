
import React, { useMemo } from 'react';
import type { PlayerCharacter } from '../../types/index';
import { useEntitySearch } from '@/hooks/useEntitySearch';
import { PlayerCharacterImporter } from '../generators/PlayerCharacterImporter';
import { Icons } from '../common/Icons';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';
import { useIncrementalList } from '../../hooks/useIncrementalList';
import { IncrementalListFooter } from '../common/IncrementalListFooter';
import { ENTITY_TYPE_CONFIG } from '../../utils/entityUtils';

const PC_COLOR = ENTITY_TYPE_CONFIG['playerCharacter'].color;

/**
 * Static Tailwind class lookup for the PC card accent, keyed by the same
 * Tailwind color name ENTITY_TYPE_CONFIG uses for `playerCharacter`.
 *
 * This project compiles Tailwind at build time via `@tailwindcss/vite`
 * (index.css does `@import "tailwindcss"`), not the old CDN JIT — so a
 * dynamic `border-l-${color}-500` template literal is invisible to the
 * build-time class scanner and never makes it into the compiled stylesheet.
 * Every class variant that can actually render must exist as a literal
 * string somewhere in source. Extend this map if
 * ENTITY_TYPE_CONFIG['playerCharacter'].color ever changes to something
 * other than 'teal'.
 */
const PC_ACCENT_CLASSES: Record<string, {
  border: string;
  borderHover: string;
  name: string;
  chipBg: string;
  chipText: string;
  chipBorder: string;
}> = {
  teal: {
    border: 'border-l-teal-500',
    borderHover: 'hover:border-l-teal-400',
    name: 'text-teal-400',
    chipBg: 'bg-teal-900/40',
    chipText: 'text-teal-300',
    chipBorder: 'border-teal-500/30',
  },
};

const PC_ACCENT = PC_ACCENT_CLASSES[PC_COLOR] ?? PC_ACCENT_CLASSES.teal;

/** Returns a Tailwind color class for a completeness dot given a percentage 0-100. */
function completenessColor(pct: number): string {
  if (pct >= 67) return 'bg-green-500';
  if (pct >= 33) return 'bg-amber-500';
  return 'bg-red-500';
}

/** Key fields for PC completeness: name, species, charClass, background, playerName. */
function pcCompleteness(pc: PlayerCharacter): number {
  const checks = [
    !!(pc.characterSocial?.characterName?.trim()),
    !!(pc.characterSocial?.species?.trim()),
    !!(pc.characterStatistics?.classes?.charClass?.trim()),
    !!(pc.characterSocial?.background?.trim()),
    !!(pc.playerName?.trim()),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

interface PlayerCharacterDashboardProps {
  playerCharacters: PlayerCharacter[];
  onImport: (file: File) => Promise<void>;
  onPlayerCharacterCreated?: (pc: PlayerCharacter) => void;
  onSelectPlayerCharacter: (id: string) => void;
  isMockMode: boolean;
}

export const PlayerCharacterDashboard: React.FC<PlayerCharacterDashboardProps> = ({ playerCharacters, onImport, onPlayerCharacterCreated, onSelectPlayerCharacter, isMockMode }) => {

  // Normalize PlayerCharacter nested fields into flat search strings
  const normalizedPCs = useMemo(
    () => (playerCharacters || []).map(pc => ({
      ...pc,
      // name is required by the hook
      name: pc.characterSocial?.characterName ?? '',
      // expose nested fields as flat strings for search
      _species: pc.characterSocial?.species ?? '',
      _charClass: pc.characterStatistics?.classes?.charClass ?? '',
      _playerName: pc.playerName ?? '',
    })),
    [playerCharacters],
  );

  const { filteredEntities: filteredNormalized, searchTerm, setSearchTerm } = useEntitySearch(
    normalizedPCs,
    ['name', '_species', '_charClass', '_playerName'],
  );

  const filteredPCs = useMemo(() => {
    const ids = new Set(filteredNormalized.map(pc => pc.id));
    return (playerCharacters || []).filter(pc => ids.has(pc.id));
  }, [filteredNormalized, playerCharacters]);
  const incremental = useIncrementalList(filteredPCs, { resetKey: searchTerm });
  const { getRovingProps } = useRovingTabIndex({
    direction: 'both', columns: { base: 1, md: 2, xl: 3 },
    // N4: above ~100 cards the grid renders a growing prefix; let arrow /
    // End navigation reach past it (the window grows, then focus lands).
    itemCount: filteredPCs.length,
    onRequestIndex: incremental.ensureIndexVisible,
  });

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
            {incremental.visibleItems.map((pc, index) => {
              const charClass = pc.characterStatistics?.classes?.charClass;
              const subclass = pc.characterStatistics?.classes?.subclass;
              const level = pc.characterStatistics?.classes?.level;
              const species = pc.characterSocial?.species;
              const background = pc.characterSocial?.background;
              const characterName = pc.characterSocial?.characterName;
              const pct = pcCompleteness(pc);
              return (
                <button
                  key={pc.id}
                  onClick={() => onSelectPlayerCharacter(pc.id)}
                  className={`relative bg-slate-900/50 p-4 rounded-lg border border-slate-800 border-l-4 ${PC_ACCENT.border} text-left hover:bg-slate-800 hover:border-slate-700 ${PC_ACCENT.borderHover} transition-all space-y-2`}
                  {...getRovingProps(index)}
                >
                  <span className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${completenessColor(pct)}`} title={`${pct}% complete`} />
                  <h3 className={`font-semibold ${PC_ACCENT.name} leading-tight pr-4`}>{characterName}</h3>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {species && (
                      <span className={`text-[10px] ${PC_ACCENT.chipBg} ${PC_ACCENT.chipText} border ${PC_ACCENT.chipBorder} rounded-full px-2 py-0.5`}>
                        {species}
                      </span>
                    )}
                    {charClass && (
                      <span className="text-[10px] bg-slate-700/60 text-slate-300 border border-slate-600/30 rounded-full px-2 py-0.5">
                        {subclass ? `${subclass} ` : ''}{charClass} {level}
                      </span>
                    )}
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
          <IncrementalListFooter
            hasMore={incremental.hasMore}
            remaining={incremental.remaining}
            visibleCount={incremental.visibleCount}
            totalCount={incremental.totalCount}
            showMore={incremental.showMore}
            sentinelRef={incremental.sentinelRef}
            noun="characters"
          />
        </div>
      </div>
    </div>
  );
};
