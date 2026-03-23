
import React, { useState } from 'react';
import type { Adventure, AdventureForBatchAdd, Campaign } from '../../types/index';
import { AdventureGenerator } from '../generators/AdventureGenerator';
import { EntityChatGenerator } from '../generators/EntityChatGenerator';
import { AdventureEditor } from '../editors/AdventureEditor';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { createDefaultAdventure } from '../../utils/entityUtils';

const ADVENTURE_PROMPT_CHIPS = [
  'A dungeon crawl',
  'A political intrigue',
  'A rescue mission',
  'A mystery to solve',
];

interface AdventureDashboardProps {
  adventures: Adventure[];
  onAdventureCreated: (data: AdventureForBatchAdd) => void;
  onSelectAdventure: (id: string) => void;
  isMockMode: boolean;
  isOfficialSetting?: boolean;
  campaignContext?: string;
}

export const AdventureDashboard: React.FC<AdventureDashboardProps> = ({ adventures, onAdventureCreated, onSelectAdventure, isMockMode, isOfficialSetting, campaignContext }) => {
  const [creationMode, setCreationMode] = useState<'chat' | 'form'>('chat');

  const handleAdventureCreated = (data: any) => {
    const { id, ...advData } = data;
    onAdventureCreated(advData);
  };

  // Minimal mock campaign for the preview editor
  const previewCampaign: Campaign = {
    id: 'preview',
    title: 'Preview',
    setting: '',
    settingType: 'custom',
    articles: [],
    adventures: [],
    npcs: [],
    locations: [],
    factions: [],
    items: [],
    sessionLogs: [],
    playerCharacters: [],
    notes: [],
    plots: [],
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-fade-in">
      {/* Creation Area */}
      <div className="space-y-3">
        {/* Mode toggle header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icons.Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold font-serif text-slate-100">
              {creationMode === 'chat' ? 'Create via Chat' : 'Adventure Generator'}
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
              entityType="adventure"
              isMockMode={isMockMode}
              campaignContext={campaignContext}
              onEntityCreated={handleAdventureCreated}
              initialData={createDefaultAdventure()}
              promptChips={ADVENTURE_PROMPT_CHIPS}
              renderPreview={(data, onUpdate) => (
                <AdventureEditor
                  adventure={{ ...data, id: 'preview' }}
                  campaign={previewCampaign}
                  onUpdate={(_, updates) => onUpdate(updates)}
                />
              )}
            />
          </div>
        ) : (
          <div className="relative min-h-[400px]">
            <AdventureGenerator
              onAdventureCreated={onAdventureCreated}
              isMockMode={isMockMode}
              isOfficialSetting={isOfficialSetting}
              campaignContext={campaignContext}
            />
          </div>
        )}
      </div>

      {/* Entity List */}
      <div>
        <h2 className="text-2xl font-bold font-serif text-slate-200 mb-4">Existing Adventures ({adventures.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {adventures.map(adv => {
            const totalScenes = adv.scenes?.length ?? 0;
            const completedScenes = adv.scenes?.filter(s => s.status === 'completed').length ?? 0;
            const completionPct = totalScenes > 0 ? Math.round((completedScenes / totalScenes) * 100) : 0;
            const hookSnippet = adv.hook ? adv.hook.slice(0, 80) + (adv.hook.length > 80 ? '…' : '') : '';
            return (
              <button
                key={adv.id}
                onClick={() => onSelectAdventure(adv.id)}
                className="card-parchment p-4 rounded-lg border border-slate-800 border-l-4 border-l-orange-500 text-left hover:border-slate-700 hover:border-l-orange-400 transition-all space-y-2"
              >
                <h3 className="font-semibold text-orange-400 leading-tight">{adv.title}</h3>
                {hookSnippet && (
                  <p className="text-xs text-slate-400 leading-relaxed">{hookSnippet}</p>
                )}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] bg-slate-700/60 text-slate-300 border border-slate-600/30 rounded-full px-2 py-0.5">
                    Lvl {adv.level}
                  </span>
                  {totalScenes > 0 && (
                    <span className="text-[10px] bg-orange-900/40 text-orange-300 border border-orange-500/30 rounded-full px-2 py-0.5">
                      {completedScenes}/{totalScenes} scenes ({completionPct}%)
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          {adventures.length === 0 && (
            <div className="md:col-span-2 xl:col-span-3 text-center py-16">
              <Icons.Adventures className="w-16 h-16 mx-auto mb-4 text-slate-700" />
              <p className="text-lg font-serif text-slate-400 mb-2">The quest begins with a single scene</p>
              <p className="text-sm text-slate-600">Use the generator to create your first adventure with hooks, scenes, and encounters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
