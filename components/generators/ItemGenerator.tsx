import React, { useState } from 'react';
import type { Item } from '@/types/index';
import { generateItem } from '@/services/aiService';
import { ItemEditor } from '@/components/editors/ItemEditor';
import { createDefaultItem } from '@/utils/entityUtils';
import {
  QuickGeneratorForm,
  GeneratorSelectField,
  OfficialSettingNote,
} from '@/components/generators/QuickGeneratorForm';

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
  const [rarity, setRarity] = useState('');
  const [itemType, setItemType] = useState('');

  const buildFullPrompt = (prompt: string): string => {
    const parts: string[] = [];
    if (rarity) parts.push(`[${rarity}]`);
    if (itemType) parts.push(`[${itemType}]`);
    if (prompt.trim()) parts.push(prompt.trim());
    return parts.join(' ');
  };

  return (
    <QuickGeneratorForm<Omit<Item, 'id'>>
      entityType="item"
      title="Item Generator"
      description={
        <>
          Describe a magical item, and the AI will create its description, rarity, and properties.
          <OfficialSettingNote show={isOfficialSetting} />
        </>
      }
      generateLabel="Generate Item"
      entityNoun="item"
      logTag="ItemGenerator"
      placeholder="e.g., A sword that glows near goblins."
      promptChips={PROMPT_CHIPS}
      isMockMode={isMockMode}
      campaignContext={campaignContext}
      buildPrompt={buildFullPrompt}
      onReset={() => {
        setRarity('');
        setItemType('');
      }}
      renderExtraFields={(isLoading) => (
        <div className="grid grid-cols-2 gap-3">
          <GeneratorSelectField
            label="Rarity"
            value={rarity}
            onChange={setRarity}
            options={RARITY_OPTIONS}
            anyLabel="Any Rarity"
            disabled={isLoading}
          />
          <GeneratorSelectField
            label="Item Type"
            value={itemType}
            onChange={setItemType}
            options={ITEM_TYPE_OPTIONS}
            anyLabel="Any Type"
            disabled={isLoading}
          />
        </div>
      )}
      generate={(fullPrompt, signal) => generateItem(fullPrompt, isMockMode, campaignContext, signal)}
      onGenerated={onItemCreated}
      chatInitialData={createDefaultItem()}
      onChatEntityCreated={(data) => {
        const { id, ...itemData } = data;
        onItemCreated(itemData);
      }}
      renderChatPreview={(data, onUpdate) => (
        <ItemEditor
          item={{ ...data, id: 'preview' }}
          onUpdate={(_, updates) => onUpdate(updates)}
          onDelete={() => {}}
          isMockMode={isMockMode}
        />
      )}
    />
  );
};
