
import React, { useState } from 'react';
import type { Faction, NPC, Location } from '../../types/index';
import { FactionGenerator } from '../generators/FactionGenerator';
import { EntityChatGenerator } from '../generators/EntityChatGenerator';
import { FactionEditor } from '../editors/FactionEditor';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { createDefaultFaction } from '../../utils/entityUtils';

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
  const [creationMode, setCreationMode] = useState<'chat' | 'form'>('chat');

  const handleFactionCreated = (data: any) => {
    const { id, ...factionData } = data;
    onFactionCreated({
      ...factionData,
      leaderId: undefined,
      memberIds: factionData.memberIds ?? [],
    });
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
      {/* Creation Area */}
      <div className="space-y-3">
        {/* Mode toggle header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icons.Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold font-serif text-slate-100">
              {creationMode === 'chat' ? 'Create via Chat' : 'Faction Generator'}
            </h2>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCreationMode(creationMode === 'chat' ? 'form' : 'chat')}
          >
            {creationMode === 'chat' ? (
              <>
                <Icons.FileText className="w-4 h-4 mr-2" />
                Switch to form
              </>
            ) : (
              <>
                <Icons.Chat className="w-4 h-4 mr-2" />
                Switch to chat
              </>
            )}
          </Button>
        </div>

        {/* Creation panel */}
        {creationMode === 'chat' ? (
          <div className="h-[480px] border border-slate-800 rounded-xl overflow-hidden">
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
          </div>
        ) : (
          <div className="relative min-h-[400px]">
            <FactionGenerator
              onFactionCreated={onFactionCreated}
              isMockMode={isMockMode}
              isOfficialSetting={isOfficialSetting}
              npcs={npcs}
              allLocations={locations}
              campaignContext={campaignContext}
            />
          </div>
        )}
      </div>

      {/* Entity List */}
      <div>
        <h2 className="text-2xl font-bold font-serif text-slate-200 mb-4">Existing Factions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
