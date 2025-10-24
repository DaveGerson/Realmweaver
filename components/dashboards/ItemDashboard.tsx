import React from 'react';
import type { Item } from '../../types';
import { ItemGenerator } from '../generators/ItemGenerator';
import { Icons } from '../Icons';

interface ItemDashboardProps {
  items: Item[];
  onItemCreated: (data: Omit<Item, 'id'>) => void;
  onSelectItem: (id: string) => void;
  isMockMode: boolean;
}

export const ItemDashboard: React.FC<ItemDashboardProps> = ({ items, onItemCreated, onSelectItem, isMockMode }) => {
  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <ItemGenerator onItemCreated={onItemCreated} isMockMode={isMockMode} />
        </div>
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold font-serif text-slate-200 mb-4">Existing Items</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => onSelectItem(item.id)}
                className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 text-left hover:bg-slate-800 hover:border-indigo-600/50 transition-all space-y-2"
              >
                <h3 className="font-semibold text-indigo-400">{item.name}</h3>
                <p className="text-sm text-slate-400 line-clamp-2">{item.description}</p>
                <span className="text-xs bg-slate-700 text-slate-300 rounded-full px-2 py-0.5 capitalize">{item.rarity}</span>
              </button>
            ))}
            {items.length === 0 && (
                <div className="md:col-span-2 text-center py-10 text-slate-500">
                    <Icons.Items className="w-12 h-12 mx-auto mb-2" />
                    <p>No items created yet. Use the generator to forge some magical artifacts!</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};