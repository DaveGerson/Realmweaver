
import React, { useState } from 'react';
import type { Item } from '@/types/index';
import { generateItem } from '@/services/aiService';
import { Icons } from '@/components/common/Icons';
import { Button } from '@/components/common/Button';
import { SkeletonGeneratorOverlay } from '@/components/common/SkeletonCard';
import { EntityChatGenerator } from '@/components/generators/EntityChatGenerator';
import { ItemEditor } from '@/components/editors/ItemEditor';
import { createDefaultItem } from '@/utils/entityUtils';
import { inputBaseClasses } from '@/components/common/Textarea';

interface ItemGeneratorProps {
  onItemCreated: (item: Omit<Item, 'id'>) => void;
  isMockMode: boolean;
  isOfficialSetting?: boolean;
  campaignContext?: string;
}

const PROMPT_CHIPS = [
  'A cursed weapon with a tragic history',
  'A healing potion with unusual side effects',
  'An ancient map to a lost treasure',
  'A ring that grants wishes with unexpected costs',
];

const RARITY_OPTIONS = ['', 'Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];

const ITEM_TYPE_OPTIONS = [
  '', 'Weapon', 'Armor', 'Potion', 'Scroll', 'Wondrous Item', 'Ring', 'Rod', 'Staff', 'Wand',
];

export const ItemGenerator: React.FC<ItemGeneratorProps> = ({
  onItemCreated,
  isMockMode,
  isOfficialSetting = false,
  campaignContext,
}) => {
  const [mode, setMode] = useState<'quick' | 'chat'>('quick');
  const [prompt, setPrompt] = useState('');
  const [rarity, setRarity] = useState('');
  const [itemType, setItemType] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildFullPrompt = (): string => {
    const parts: string[] = [];
    if (rarity) parts.push(`[${rarity}]`);
    if (itemType) parts.push(`[${itemType}]`);
    if (prompt.trim()) parts.push(prompt.trim());
    return parts.join(' ');
  };

  const handleQuickGenerate = async () => {
    const fullPrompt = buildFullPrompt();
    if (!fullPrompt.trim()) {
      setError('Please enter a prompt.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const itemData = await generateItem(fullPrompt, isMockMode, campaignContext);
      onItemCreated(itemData);
      setPrompt('');
      setRarity('');
      setItemType('');
    } catch (err) {
      setError('Failed to generate item. Please check your API key and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (mode === 'chat') {
    return (
      <div className="absolute inset-0 z-20 bg-slate-950 p-6 flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="mb-4 flex justify-between items-center flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setMode('quick')}>
            <Icons.ChevronDown className="w-4 h-4 mr-2 rotate-90" /> Back to Quick Generator
          </Button>
          <h2 className="text-lg font-bold font-serif text-slate-100">Conversational Creator</h2>
        </div>
        <div className="flex-1 min-h-0 border border-slate-800 rounded-xl shadow-2xl overflow-hidden bg-slate-900">
          <EntityChatGenerator
            entityType="item"
            isMockMode={isMockMode}
            campaignContext={campaignContext}
            onEntityCreated={(data) => {
              const { id, ...itemData } = data;
              onItemCreated(itemData);
              setMode('quick');
            }}
            initialData={createDefaultItem()}
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
      </div>
    );
  }

  return (
    <div className="relative bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4 h-full flex flex-col">
      {isLoading && <SkeletonGeneratorOverlay />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icons.Wizard className="w-7 h-7 text-amber-400" />
          <h2 className="text-2xl font-bold font-serif text-slate-100">Item Generator</h2>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setMode('chat')}>
          <Icons.Chat className="w-4 h-4 mr-2" /> Create via Chat
        </Button>
      </div>

      <p className="text-sm text-slate-400">
        Describe a magical item, and the AI will create its description, rarity, and properties.
        {isOfficialSetting && (
          <span className="block mt-1 text-amber-400 text-xs">Official setting context will be used for canon accuracy.</span>
        )}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Rarity</label>
          <select
            value={rarity}
            onChange={(e) => setRarity(e.target.value)}
            disabled={isLoading}
            className={`${inputBaseClasses} w-full px-3 py-2 text-sm`}
          >
            {RARITY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === '' ? 'Any Rarity' : opt}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Item Type</label>
          <select
            value={itemType}
            onChange={(e) => setItemType(e.target.value)}
            disabled={isLoading}
            className={`${inputBaseClasses} w-full px-3 py-2 text-sm`}
          >
            {ITEM_TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === '' ? 'Any Type' : opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g., A sword that glows near goblins."
        rows={4}
        className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 outline-none resize-y placeholder:text-slate-600"
        disabled={isLoading}
      />

      <div className="flex flex-wrap gap-2">
        {PROMPT_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => setPrompt(chip)}
            disabled={isLoading}
            className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-full px-3 py-1 transition-colors disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
      <Button
        onClick={handleQuickGenerate}
        disabled={isLoading || !buildFullPrompt().trim()}
        size="lg"
        className="w-full mt-auto"
      >
        {isLoading ? 'Generating...' : 'Generate Item'}
      </Button>
    </div>
  );
};
