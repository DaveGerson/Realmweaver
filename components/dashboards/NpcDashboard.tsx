
import React, { useState } from 'react';
import type { NPC, Faction } from '../../types/index';
import { NpcGenerator } from '../generators/NpcGenerator';
import { EntityChatGenerator } from '../generators/EntityChatGenerator';
import { NpcEditor } from '../editors/NpcEditor';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { createDefaultNpc } from '../../utils/entityUtils';

const NPC_PROMPT_CHIPS = [
  'A mysterious merchant',
  'A guard captain with a secret',
  'A wise old sage',
  'A rival adventurer',
];

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
  const [creationMode, setCreationMode] = useState<'chat' | 'form'>('chat');

  const handleNpcCreated = (data: any) => {
    const { id, ...npcData } = data;
    onNpcCreated(npcData);
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
              {creationMode === 'chat' ? 'Create via Chat' : 'NPC Generator'}
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
          </div>
        ) : (
          <div className="relative min-h-[400px]">
            <NpcGenerator
              onNpcCreated={onNpcCreated}
              isMockMode={isMockMode}
              isOfficialSetting={isOfficialSetting}
              factions={factions}
              campaignContext={campaignContext}
            />
          </div>
        )}
      </div>

      {/* Entity List */}
      <div>
        <h2 className="text-2xl font-bold font-serif text-slate-200 mb-4">Existing NPCs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {npcs.map(npc => (
            <button
              key={npc.id}
              onClick={() => onSelectNpc(npc.id)}
              className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 border-l-4 border-l-amber-500 text-left hover:bg-slate-800 hover:border-slate-700 hover:border-l-amber-400 transition-all space-y-2"
            >
              <h3 className="font-semibold text-amber-400">{npc.name}</h3>
              <p className="text-sm text-slate-400 line-clamp-2">{npc.description}</p>
            </button>
          ))}
          {npcs.length === 0 && (
            <div className="md:col-span-2 xl:col-span-3 text-center py-16">
              <Icons.NPCs className="w-16 h-16 mx-auto mb-4 text-slate-700" />
              <p className="text-lg font-serif text-slate-400 mb-2">Every great story needs its cast of characters</p>
              <p className="text-sm text-slate-600">Use the generator to bring your world's inhabitants to life.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
