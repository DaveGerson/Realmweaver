
import React from 'react';
import type { Item } from '../../types/index';
import { ItemGenerator } from '../generators/ItemGenerator';
import { EntityChatGenerator } from '../generators/EntityChatGenerator';
import { ItemEditor } from '../editors/ItemEditor';
import { Icons } from '../common/Icons';
import { EntityCreationPanel } from '../common/EntityCreationPanel';
import { createDefaultItem } from '../../utils/entityUtils';
import { useEntitySearch } from '../../hooks/useEntitySearch';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';

const ITEM_PROMPT_CHIPS = [
  'A cursed weapon',
  'A healing potion',
  'A mysterious map',
  'A legendary artifact',
];

const RARITY_COLORS: Record<string, string> = {
  common: 'bg-slate-700/60 text-slate-300 border-slate-600/30',
  uncommon: 'bg-green-900/40 text-green-300 border-green-500/30',
  rare: 'bg-blue-900/40 text-blue-300 border-blue-500/30',
  'very rare': 'bg-purple-900/40 text-purple-300 border-purple-500/30',
  legendary: 'bg-orange-900/40 text-orange-300 border-orange-500/30',
  artifact: 'bg-red-900/40 text-red-300 border-red-500/30',
};

interface ItemCardProps {
  item: Item;
  index: number;
  onSelectItem: (id: string) => void;
  getRovingProps: (index: number) => Record<string, unknown>;
}

const ItemCard = React.memo(function ItemCard({ item, index, onSelectItem, getRovingProps }: ItemCardProps) {
  const descSnippet = item.description ? item.description.slice(0, 80) + (item.description.length > 80 ? '…' : '') : '';
  const rarityStyle = RARITY_COLORS[item.rarity] ?? RARITY_COLORS['common'];
  return (
    <button
      onClick={() => onSelectItem(item.id)}
      className="card-parchment p-4 rounded-lg border border-slate-800 border-l-4 border-l-sky-500 text-left hover:border-slate-700 hover:border-l-sky-400 transition-all space-y-2"
      {...getRovingProps(index)}
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
});

interface ItemDashboardProps {
  items: Item[];
  onItemCreated: (data: Omit<Item, 'id'>) => void;
  onSelectItem: (id: string) => void;
  isMockMode: boolean;
  isOfficialSetting?: boolean;
  campaignContext?: string;
}

export const ItemDashboard: React.FC<ItemDashboardProps> = ({ items, onItemCreated, onSelectItem, isMockMode, isOfficialSetting, campaignContext }) => {
  const { filteredEntities: filteredItems, searchTerm, setSearchTerm } = useEntitySearch(items, ['name', 'description', 'properties']);
  const { getRovingProps } = useRovingTabIndex({ direction: 'both', columns: 3 });

  const handleItemCreated = (data: any) => {
    const { id, ...itemData } = data;
    onItemCreated(itemData);
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-fade-in">
      {/* Creation Area */}
      <EntityCreationPanel
        entityLabel="Item"
        chatPanel={
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
        }
        formPanel={
          <ItemGenerator
            onItemCreated={onItemCreated}
            isMockMode={isMockMode}
            isOfficialSetting={isOfficialSetting}
            campaignContext={campaignContext}
          />
        }
      />

      {/* Entity List */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-2xl font-bold font-serif text-slate-200">Existing Items ({items.length})</h2>
          <div className="relative max-w-xs w-full sm:w-auto">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search items..."
              className="w-full bg-slate-800 border border-slate-700 rounded-md pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredItems.map((item, index) => (
            <ItemCard
              key={item.id}
              item={item}
              index={index}
              onSelectItem={onSelectItem}
              getRovingProps={getRovingProps}
            />
          ))}
          {filteredItems.length === 0 && items.length > 0 && (
            <div className="md:col-span-2 xl:col-span-3 text-center py-10">
              <Icons.Search className="w-10 h-10 mx-auto mb-3 text-slate-700" />
              <p className="text-slate-400">No items match "{searchTerm}"</p>
            </div>
          )}
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
