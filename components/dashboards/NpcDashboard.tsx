
import React from 'react';
import type { NPC, Faction } from '../../types/index';
import { NpcGenerator } from '../generators/NpcGenerator';
import { EntityChatGenerator } from '../generators/EntityChatGenerator';
import { NpcEditor } from '../editors/NpcEditor';
import { Icons } from '../common/Icons';
import { EntityCreationPanel } from '../common/EntityCreationPanel';
import { createDefaultNpc } from '../../utils/entityUtils';
import { useEntitySearch } from '../../hooks/useEntitySearch';
import { useRovingTabIndex, type RovingProps } from '../../hooks/useRovingTabIndex';
import { useIncrementalList } from '../../hooks/useIncrementalList';
import { IncrementalListFooter } from '../common/IncrementalListFooter';

const NPC_PROMPT_CHIPS = [
  'A mysterious merchant',
  'A guard captain with a secret',
  'A wise old sage',
  'A rival adventurer',
];

interface NpcCardProps {
  npc: NPC;
  faction?: Faction;
  index: number;
  onSelectNpc: (id: string) => void;
  getRovingProps: (index: number) => RovingProps;
}

const NpcCard = React.memo(function NpcCard({ npc, faction, index, onSelectNpc, getRovingProps }: NpcCardProps) {
  const descSnippet = npc.description ? npc.description.slice(0, 80) + (npc.description.length > 80 ? '…' : '') : '';
  return (
    <button
      key={npc.id}
      onClick={() => onSelectNpc(npc.id)}
      className="card-parchment p-4 rounded-lg border border-slate-800 border-l-4 border-l-amber-500 text-left hover:border-slate-700 hover:border-l-amber-400 transition-all space-y-2"
      {...getRovingProps(index)}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-amber-400 leading-tight">{npc.name}</h3>
        {faction && (
          <span className="flex-shrink-0 text-[10px] bg-violet-900/50 text-violet-300 border border-violet-500/30 rounded-full px-2 py-0.5 truncate max-w-[120px]">
            {faction.name}
          </span>
        )}
      </div>
      {descSnippet && (
        <p className="text-xs text-slate-400 leading-relaxed">{descSnippet}</p>
      )}
      {npc.traits && (
        <p className="text-xs text-slate-500 italic line-clamp-1">{npc.traits}</p>
      )}
    </button>
  );
});

interface NpcDashboardProps {
  npcs: NPC[];
  factions?: Faction[];
  onNpcCreated: (data: Omit<NPC, 'id'>) => void;
  onSelectNpc: (id: string) => void;
  isMockMode: boolean;
  isOfficialSetting?: boolean;
  campaignContext?: string;
}

export const NpcDashboard: React.FC<NpcDashboardProps> = ({ npcs, factions = [], onNpcCreated, onSelectNpc, isMockMode, isOfficialSetting, campaignContext }) => {
  const { filteredEntities: filteredNpcs, searchTerm, setSearchTerm } = useEntitySearch(npcs, ['name', 'description', 'traits']);
  const incremental = useIncrementalList(filteredNpcs, { resetKey: searchTerm });
  const { getRovingProps } = useRovingTabIndex({
    direction: 'both', columns: { base: 1, md: 2, xl: 3 },
    // N4: above ~100 cards the grid renders a growing prefix; let arrow /
    // End navigation reach past it (the window grows, then focus lands).
    itemCount: filteredNpcs.length,
    onRequestIndex: incremental.ensureIndexVisible,
  });
  const factionsById = React.useMemo(() => new Map(factions.map(f => [f.id, f])), [factions]);

  const handleNpcCreated = (data: any) => {
    const { id, ...npcData } = data;
    onNpcCreated(npcData);
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-fade-in">
      {/* Creation Area */}
      <EntityCreationPanel
        entityLabel="NPC"
        chatPanel={
          <EntityChatGenerator
            entityType="npc"
            isMockMode={isMockMode}
            campaignContext={campaignContext}
            onEntityCreated={handleNpcCreated}
            initialData={createDefaultNpc()}
            promptChips={NPC_PROMPT_CHIPS}
            renderPreview={(data, onUpdate) => (
              <NpcEditor
                npc={{ ...data, id: 'preview' }}
                factions={factions}
                allNpcs={npcs}
                onUpdate={(_, updates) => onUpdate(updates)}
                onDelete={() => {}}
                isMockMode={isMockMode}
              />
            )}
          />
        }
        formPanel={
          <NpcGenerator
            onNpcCreated={onNpcCreated}
            isMockMode={isMockMode}
            isOfficialSetting={isOfficialSetting}
            factions={factions}
            campaignContext={campaignContext}
          />
        }
      />

      {/* Entity List */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-2xl font-bold font-serif text-slate-200">Existing NPCs ({npcs.length})</h2>
          <div className="relative max-w-xs w-full sm:w-auto">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search NPCs..."
              className="w-full bg-slate-800 border border-slate-700 rounded-md pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {incremental.visibleItems.map((npc, index) => {
            const faction = npc.factionId ? factionsById.get(npc.factionId) : undefined;
            return (
              <NpcCard
                key={npc.id}
                npc={npc}
                faction={faction}
                index={index}
                onSelectNpc={onSelectNpc}
                getRovingProps={getRovingProps}
              />
            );
          })}
          {filteredNpcs.length === 0 && npcs.length > 0 && (
            <div className="md:col-span-2 xl:col-span-3 text-center py-10">
              <Icons.Search className="w-10 h-10 mx-auto mb-3 text-slate-700" />
              <p className="text-slate-400">No NPCs match "{searchTerm}"</p>
            </div>
          )}
          {npcs.length === 0 && (
            <div className="md:col-span-2 xl:col-span-3 text-center py-16">
              <Icons.NPCs className="w-16 h-16 mx-auto mb-4 text-slate-700" />
              <p className="text-lg font-serif text-slate-400 mb-2">Every great story needs its cast of characters</p>
              <p className="text-sm text-slate-600">Use the generator to bring your world's inhabitants to life.</p>
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
          noun="NPCs"
        />
      </div>
    </div>
  );
};
