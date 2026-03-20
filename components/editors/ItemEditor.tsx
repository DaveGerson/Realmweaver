
import React, { useState, useEffect } from 'react';
import type { Item, ItemRarity } from '../../types/index';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { AiTextarea } from '../common/Textarea';
import { generateEnhancedText } from '../../services/geminiService';

interface ItemEditorProps {
  item: Item;
  onUpdate: (id: string, updatedData: Partial<Item>) => void;
  onDelete: (id: string) => void;
  isMockMode: boolean;
}

const rarityOptions: ItemRarity[] = ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact'];

export const ItemEditor: React.FC<ItemEditorProps> = ({ item, onUpdate, onDelete, isMockMode }) => {
  const [formData, setFormData] = useState(item);
  const [isGenerating, setIsGenerating] = useState<keyof Omit<Item, 'id' | 'rarity'> | null>(null);

  useEffect(() => {
    setFormData(item);
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

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value as ItemRarity }));
    onUpdate(item.id, { [name]: value as ItemRarity });
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${item.name}? This action cannot be undone.`)) {
        onDelete(item.id);
    }
  }

  const handleAiGenerate = async (field: keyof Omit<Item, 'id' | 'rarity'>) => {
    setIsGenerating(field);
    const context = `Item Name: ${formData.name}\nRarity: ${formData.rarity}`;
    const prompt = `Based on the following item info, generate a compelling "${field}":\n\n${context}`;

    try {
      const result = await generateEnhancedText(prompt, undefined, isMockMode);
      const updatedData = { [field]: result };
      setFormData(prev => ({ ...prev, ...updatedData }));
      onUpdate(item.id, updatedData);
    } catch (error) {
      console.error("AI generation failed:", error);
    } finally {
      setIsGenerating(null);
    }
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
      <header className="flex justify-between items-start">
        <div className="space-y-2">
            <div className="flex items-center gap-3 text-amber-400">
              <Icons.Items className="w-8 h-8" />
              <h1 className="text-3xl font-bold font-serif text-slate-100">Item Editor</h1>
            </div>
        </div>
        <Button variant="danger" size="sm" onClick={handleDelete}>
            <Icons.Trash className="w-3.5 h-3.5 mr-2" />
            Delete Item
        </Button>
      </header>
      
      <div className="space-y-6 bg-slate-900/50 p-6 rounded-xl border border-slate-800/50">
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
                    onChange={handleSelectChange}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all capitalize"
                >
                    {rarityOptions.map(r => (
                        <option key={r} value={r} className="capitalize">{r}</option>
                    ))}
                </select>
            </div>
        </div>

        <AiTextarea
          label="Description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={4}
          placeholder="A detailed description of the item's appearance and history."
          onAiGenerate={() => handleAiGenerate('description')}
          isGenerating={isGenerating === 'description'}
        />

        <AiTextarea
          label="Properties & Abilities"
          name="properties"
          value={formData.properties}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={4}
          placeholder="The item's mechanical properties, abilities, and rules for use."
          onAiGenerate={() => handleAiGenerate('properties')}
          isGenerating={isGenerating === 'properties'}
        />
      </div>
    </div>
  );
};
