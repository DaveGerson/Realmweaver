
import React, { useState } from 'react';
import type { Item } from '../../types/index';
import { ItemGenerator } from '../generators/ItemGenerator';
import { EntityChatGenerator } from '../generators/EntityChatGenerator';
import { ItemEditor } from '../editors/ItemEditor';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { createDefaultItem } from '../../utils/entityUtils';

const ITEM_PROMPT_CHIPS = [
  'A cursed weapon',
  'A healing potion',
  'A mysterious map',
  'A legendary artifact',
];

interface ItemDashboardProps {
  items: Item[];
  onItemCreated: (data: Omit<Item, 'id'>) => void;
  onSelectItem: (id: string) => void;
  isMockMode: boolean;
  isOfficialSetting?: boolean;
  campaignContext?: string;
}

export const ItemDashboard: React.FC<ItemDashboardProps> = ({ items, onItemCreated, onSelectItem, isMockMode, isOfficialSetting, campaignContext }) => {
  const [creationMode, setCreationMode] = useState<'chat' | 'form'>('chat');

  const handleItemCreated = (data: any) => {
    const { id, ...itemData } = data;
    onItemCreated(itemData);
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
              {creationMode === 'chat' ? 'Create via Chat' : 'Item Generator'}
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
              entityType="item"
              isMockMode={isMockMode}
              campaignContext={campaignContext}
              onEntityCreated={handleItemCreated}
              initialData={createDefaultItem()}
              promptChips={ITEM_PROMPT_CHIPS}
              renderPreview={(data, onUpdate) => (
                <ItemEditor
                  item={{ ...data, id: 'preview' }}
                  onUpdate={(_, updates) => onUpdate(updates)}
                  onDelete={() => {}}
                  isMockMode={isMockMode}
                />
              )}
            />
          </div>
        ) : (
          <div className="relative min-h-[400px]">
            <ItemGenerator
              onItemCreated={onItemCreated}
              isMockMode={isMockMode}
              isOfficialSetting={isOfficialSetting}
              campaignContext={campaignContext}
            />
          </div>
        )}
      </div>

      {/* Entity List */}
      <div>
        <h2 className="text-2xl font-bold font-serif text-slate-200 mb-4">Existing Items ({items.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map(item => {
            const descSnippet = item.description ? item.description.slice(0, 80) + (item.description.length > 80 ? '…' : '') : '';
            const rarityColors: Record<string, string> = {
              common: 'bg-slate-700/60 text-slate-300 border-slate-600/30',
              uncommon: 'bg-green-900/40 text-green-300 border-green-500/30',
              rare: 'bg-blue-900/40 text-blue-300 border-blue-500/30',
              'very rare': 'bg-purple-900/40 text-purple-300 border-purple-500/30',
              legendary: 'bg-orange-900/40 text-orange-300 border-orange-500/30',
              artifact: 'bg-red-900/40 text-red-300 border-red-500/30',
            };
            const rarityStyle = rarityColors[item.rarity] ?? rarityColors['common'];
            return (
              <button
                key={item.id}
                onClick={() => onSelectItem(item.id)}
                className="card-parchment p-4 rounded-lg border border-slate-800 border-l-4 border-l-sky-500 text-left hover:border-slate-700 hover:border-l-sky-400 transition-all space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sky-400 leading-tight">{item.name}</h3>
                  <span className={`flex-shrink-0 text-[10px] border rounded-full px-2 py-0.5 capitalize ${rarityStyle}`}>
                    {item.rarity}
                  </span>
                </div>
                {descSnippet && (
                  <p className="text-xs text-slate-400 leading-relaxed">{descSnippet}</p>
                )}
                {item.properties && (
                  <p className="text-xs text-slate-500 italic line-clamp-1">{item.properties}</p>
                )}
              </button>
            );
          })}
          {items.length === 0 && (
            <div className="md:col-span-2 xl:col-span-3 text-center py-16">
              <Icons.Items className="w-16 h-16 mx-auto mb-4 text-slate-700" />
              <p className="text-lg font-serif text-slate-400 mb-2">Every hero needs the right tools for the quest</p>
              <p className="text-sm text-slate-600">Use the generator to forge magical artifacts, cursed relics, and mundane gear.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
