
import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import type { Item, ItemRarity, ItemType } from '../../types/index';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { AiTextarea, inputBaseClasses } from '../common/Textarea';
import { RegenerateButton } from '../common/RegenerateButton';
import { BacklinksPanel } from '../common/BacklinksPanel';
import { campaignService } from '@/services/campaignService';
import type { QuickCardEntityType } from '../common/EntityQuickCard';

// ─── Save Status Indicator ────────────────────────────────────────────────────

const SaveStatusIndicator: React.FC = () => {
  const { saveStatus } = useSyncExternalStore(
    campaignService.subscribe,
    campaignService.getState,
  );
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (saveStatus === 'saved') {
      setShowSaved(true);
      const t = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [saveStatus]);

  if (saveStatus === 'saving') {
    return (
      <span className="flex items-center gap-1 text-xs text-slate-400">
        <Icons.Loader className="w-3 h-3 animate-spin" />
        Saving…
      </span>
    );
  }
  if (saveStatus === 'error') {
    return <span className="text-xs text-red-400">Save error</span>;
  }
  if (showSaved) {
    return <span className="text-xs text-slate-400 transition-opacity duration-500">Saved</span>;
  }
  return null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const rarityOptions: ItemRarity[] = ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact'];
const itemTypeOptions: ItemType[] = ['weapon', 'armor', 'potion', 'scroll', 'wondrous', 'tool', 'other'];

// ─── Props ────────────────────────────────────────────────────────────────────

interface ItemEditorProps {
  item: Item;
  onUpdate: (id: string, updatedData: Partial<Item>) => void;
  onDelete: (id: string) => void;
  isMockMode: boolean;
  campaignContext?: string;
  onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
}

// ─── Editor ───────────────────────────────────────────────────────────────────

export const ItemEditor: React.FC<ItemEditorProps> = ({ item, onUpdate, onDelete, isMockMode, campaignContext, onNavigate }) => {
  const [formData, setFormData] = useState(item);
  const { confirm } = useConfirmDialog();

  // Tracks the last `item` prop we've reconciled against, so incoming prop
  // updates can be merged field-by-field instead of overwriting formData wholesale.
  const prevItemRef = useRef(item);

  useEffect(() => {
    const prevItem = prevItemRef.current;
    if (prevItem.id !== item.id) {
      // Switched to viewing a different item entirely — fully adopt it.
      setFormData(item);
    } else if (prevItem !== item) {
      // Same item, but the underlying object changed elsewhere. Only adopt
      // fields the user hasn't started editing since the last sync — any field
      // where formData still matches what we last saw from `item`. Fields the
      // user has locally changed (unblurred edits) are preserved.
      setFormData(prev => {
        const merged = { ...prev };
        (Object.keys(item) as (keyof Item)[]).forEach((key) => {
          if (prev[key] === prevItem[key]) {
            merged[key] = item[key];
          }
        });
        return merged;
      });
    }
    prevItemRef.current = item;
  }, [item]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (formData[e.target.name as keyof Item] !== item[e.target.name as keyof Item]) {
      onUpdate(item.id, { [e.target.name]: e.target.value });
    }
  };

  const handleRarityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value as ItemRarity }));
    onUpdate(item.id, { [name]: value as ItemRarity });
  };

  const handleItemTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as ItemType;
    setFormData(prev => ({ ...prev, itemType: value }));
    onUpdate(item.id, { itemType: value });
  };

  const handleAttunementToggle = () => {
    const newValue = !formData.attunement;
    setFormData(prev => ({ ...prev, attunement: newValue }));
    onUpdate(item.id, { attunement: newValue });
  };

  const handleDelete = async () => {
    const confirmed = await confirm('Delete Item', `Are you sure you want to delete ${item.name}? This action cannot be undone.`, { variant: 'danger' });
    if (confirmed) {
      onDelete(item.id);
    }
  };

  const handleFieldRegenerate = (field: keyof Omit<Item, 'id' | 'rarity' | 'itemType' | 'attunement' | 'weight' | 'value'>) => (newValue: string) => {
    setFormData(prev => ({ ...prev, [field]: newValue }));
    onUpdate(item.id, { [field]: newValue });
  };

  const itemEntityContext = `Item Name: ${formData.name}\nRarity: ${formData.rarity}\nType: ${formData.itemType || 'not specified'}\nDescription: ${formData.description || 'Not specified'}\nProperties: ${formData.properties || 'Not specified'}`;

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-fade-in">
      <header className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-3 text-amber-400">
            <Icons.Items className="w-8 h-8" />
            <h1 className="text-3xl font-bold font-serif text-slate-100">Item Editor</h1>
          </div>
          <SaveStatusIndicator />
        </div>
        <Button variant="danger" size="sm" onClick={handleDelete}>
          <Icons.Trash className="w-3.5 h-3.5 mr-2" />
          Delete Item
        </Button>
      </header>

      <div className="space-y-6 bg-slate-900/50 p-6 rounded-xl border border-slate-800/50">
        {/* Name + Rarity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Item Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              onBlur={handleBlur}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all placeholder:text-slate-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Rarity</label>
            <select
              name="rarity"
              value={formData.rarity}
              onChange={handleRarityChange}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all capitalize"
            >
              {rarityOptions.map(r => (
                <option key={r} value={r} className="capitalize">{r}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Item Type + Attunement + Weight + Value */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Item Type</label>
            <select
              value={formData.itemType ?? ''}
              onChange={handleItemTypeChange}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all capitalize"
            >
              <option value="">-- Select --</option>
              {itemTypeOptions.map(t => (
                <option key={t} value={t} className="capitalize">{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Weight</label>
            <input
              type="text"
              name="weight"
              value={formData.weight ?? ''}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="e.g. 4 lbs"
              className={`${inputBaseClasses} w-full px-3 py-2 text-sm`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Value</label>
            <input
              type="text"
              name="value"
              value={formData.value ?? ''}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="e.g. 50 gp"
              className={`${inputBaseClasses} w-full px-3 py-2 text-sm`}
            />
          </div>

          <div className="flex flex-col justify-end">
            <label className="block text-sm font-medium text-slate-400 mb-2">Requires Attunement</label>
            <button
              type="button"
              onClick={handleAttunementToggle}
              className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                formData.attunement
                  ? 'bg-amber-900/50 border-amber-600 text-amber-300'
                  : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              {formData.attunement ? (
                <><Icons.CheckCircle className="w-4 h-4" /> Yes</>
              ) : (
                <><Icons.X className="w-4 h-4" /> No</>
              )}
            </button>
          </div>
        </div>

        {/* Description */}
        <AiTextarea
          label="Description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={4}
          placeholder="A detailed description of the item's appearance and history."
          regenerateButton={<RegenerateButton fieldName="description" currentValue={formData.description} entityType="Item" entityContext={itemEntityContext} onRegenerate={handleFieldRegenerate('description')} isMockMode={isMockMode} campaignContext={campaignContext} />}
        />

        {/* Properties & Abilities */}
        <AiTextarea
          label="Properties & Abilities"
          name="properties"
          value={formData.properties}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={4}
          placeholder="The item's mechanical properties, abilities, and rules for use."
          regenerateButton={<RegenerateButton fieldName="properties" currentValue={formData.properties} entityType="Item" entityContext={itemEntityContext} onRegenerate={handleFieldRegenerate('properties')} isMockMode={isMockMode} campaignContext={campaignContext} />}
        />

        {/* Backlinks Panel */}
        <BacklinksPanel entityId={item.id} entityType="item" onNavigate={onNavigate} />
      </div>
    </div>
  );
};
