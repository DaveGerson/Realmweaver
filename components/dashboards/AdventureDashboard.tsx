
import React, { useState, useMemo } from 'react';
import type { Adventure, AdventureForBatchAdd, Campaign } from '../../types/index';
import { AdventureGenerator } from '../generators/AdventureGenerator';
import { EntityChatGenerator } from '../generators/EntityChatGenerator';
import { AdventureEditor } from '../editors/AdventureEditor';
import { Icons } from '../common/Icons';
import { EntityCreationPanel } from '../common/EntityCreationPanel';
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
  const [searchTerm, setSearchTerm] = useState('');
  const filteredAdventures = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return adventures;
    return adventures.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.hook?.toLowerCase().includes(q) ||
      a.theme?.toLowerCase().includes(q)
    );
  }, [adventures, searchTerm]);

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
      <EntityCreationPanel
        entityLabel="Adventure"
        chatPanel={
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
        }
        formPanel={
          <AdventureGenerator
            onAdventureCreated={onAdventureCreated}
            isMockMode={isMockMode}
            isOfficialSetting={isOfficialSetting}
            campaignContext={campaignContext}
          />
        }
      />

      {/* Entity List */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-2xl font-bold font-serif text-slate-200">Existing Adventures ({adventures.length})</h2>
          <div className="relative max-w-xs w-full sm:w-auto">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search adventures..."
              className="w-full bg-slate-800 border border-slate-700 rounded-md pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAdventures.map(adv => {
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
          {filteredAdventures.length === 0 && adventures.length > 0 && (
            <div className="md:col-span-2 xl:col-span-3 text-center py-10">
              <Icons.Search className="w-10 h-10 mx-auto mb-3 text-slate-700" />
              <p className="text-slate-400">No adventures match "{searchTerm}"</p>
            </div>
          )}
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
