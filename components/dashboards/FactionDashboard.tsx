
import React from 'react';
import type { Faction, NPC, Location } from '../../types/index';
import { FactionGenerator } from '../generators/FactionGenerator';
import { EntityChatGenerator } from '../generators/EntityChatGenerator';
import { FactionEditor } from '../editors/FactionEditor';
import { Icons } from '../common/Icons';
import { EntityCreationPanel } from '../common/EntityCreationPanel';
import { createDefaultFaction } from '../../utils/entityUtils';
import { useEntitySearch } from '../../hooks/useEntitySearch';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';

const FACTION_PROMPT_CHIPS = [
  'A thieves\' guild',
  'A holy order',
  'A merchant consortium',
  'A rebel alliance',
];

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
  const { filteredEntities: filteredFactions, searchTerm, setSearchTerm } = useEntitySearch(factions, ['name', 'description', 'goals']);
  const { getRovingProps } = useRovingTabIndex({ direction: 'both', columns: 3 });

  const handleFactionCreated = (data: any) => {
    const { id, ...factionData } = data;
    onFactionCreated({
      ...factionData,
      leaderId: undefined,
      memberIds: factionData.memberIds ?? [],
    });
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-fade-in">
      {/* Creation Area */}
      <EntityCreationPanel
        entityLabel="Faction"
        chatPanel={
          <EntityChatGenerator
            entityType="faction"
            isMockMode={isMockMode}
            campaignContext={campaignContext}
            onEntityCreated={handleFactionCreated}
            initialData={createDefaultFaction()}
            promptChips={FACTION_PROMPT_CHIPS}
            renderPreview={(data, onUpdate) => (
              <FactionEditor
                faction={{ ...data, id: 'preview' }}
                allNpcs={npcs}
                allLocations={locations}
                onUpdate={(_, updates) => onUpdate(updates)}
                onDelete={() => {}}
                isMockMode={isMockMode}
              />
            )}
          />
        }
        formPanel={
          <FactionGenerator
            onFactionCreated={onFactionCreated}
            isMockMode={isMockMode}
            isOfficialSetting={isOfficialSetting}
            npcs={npcs}
            allLocations={locations}
            campaignContext={campaignContext}
          />
        }
      />

      {/* Entity List */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-2xl font-bold font-serif text-slate-200">Existing Factions ({factions.length})</h2>
          <div className="relative max-w-xs w-full sm:w-auto">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search factions..."
              className="w-full bg-slate-800 border border-slate-700 rounded-md pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredFactions.map((faction, index) => {
            const leader = npcs.find(n => n.id === faction.leaderId);
            const goalsSnippet = faction.goals ? faction.goals.slice(0, 80) + (faction.goals.length > 80 ? '…' : '') : '';
            const memberCount = faction.memberIds?.length ?? 0;
            return (
              <button
                key={faction.id}
                onClick={() => onSelectFaction(faction.id)}
                className="card-parchment p-4 rounded-lg border border-slate-800 border-l-4 border-l-violet-500 text-left hover:border-slate-700 hover:border-l-violet-400 transition-all space-y-2"
                {...getRovingProps(index)}
              >
                <h3 className="font-semibold text-violet-400 leading-tight">{faction.name}</h3>
                {goalsSnippet && (
                  <p className="text-xs text-slate-400 leading-relaxed">{goalsSnippet}</p>
                )}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {memberCount > 0 && (
                    <span className="text-[10px] bg-violet-900/40 text-violet-300 border border-violet-500/30 rounded-full px-2 py-0.5">
                      {memberCount} {memberCount === 1 ? 'member' : 'members'}
                    </span>
                  )}
                  {leader && (
                    <span className="text-[10px] text-slate-500">
                      Led by {leader.name}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          {filteredFactions.length === 0 && factions.length > 0 && (
            <div className="md:col-span-2 xl:col-span-3 text-center py-10">
              <Icons.Search className="w-10 h-10 mx-auto mb-3 text-slate-700" />
              <p className="text-slate-400">No factions match "{searchTerm}"</p>
            </div>
          )}
          {factions.length === 0 && (
            <div className="md:col-span-2 xl:col-span-3 text-center py-16">
              <Icons.Factions className="w-16 h-16 mx-auto mb-4 text-slate-700" />
              <p className="text-lg font-serif text-slate-400 mb-2">Power structures shape every world</p>
              <p className="text-sm text-slate-600">Use the generator to forge guilds, cults, and noble houses.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
