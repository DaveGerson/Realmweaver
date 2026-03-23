import React, { useState, useEffect } from 'react';
import type { NPC, Faction } from '../types/index';
import { Icons } from './Icons';
import { Button } from './common/Button';
import { AiTextarea } from './common/Textarea';
import { generateEnhancedText } from '../services/geminiService';

interface NpcEditorProps {
  npc: NPC;
  factions: Faction[];
  onUpdate: (id: string, updatedData: Partial<NPC>) => void;
  onDelete: (id: string) => void;
  isMockMode: boolean;
}

export const NpcEditor: React.FC<NpcEditorProps> = ({ npc, factions, onUpdate, onDelete, isMockMode }) => {
  const [formData, setFormData] = useState(npc);
  const [isGenerating, setIsGenerating] = useState<keyof Omit<NPC, 'id' | 'factionId' | 'knowsPlayerHistory'> | null>(null);

  useEffect(() => {
    setFormData(npc);
  }, [npc]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Check if data actually changed before calling onUpdate
    if (formData[e.target.name as keyof NPC] !== npc[e.target.name as keyof NPC]) {
        onUpdate(npc.id, { [e.target.name]: e.target.value });
    }
  };

  const handleFactionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newFactionId = value === "none" ? undefined : value;
    setFormData(prev => ({ ...prev, [name]: newFactionId }));
    onUpdate(npc.id, { [name]: newFactionId });
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${npc.name}? This action cannot be undone.`)) {
        onDelete(npc.id);
    }
  }

  const handleAiGenerate = async (field: keyof Omit<NPC, 'id' | 'factionId' | 'knowsPlayerHistory'>) => {
    setIsGenerating(field);
    const npcContext = `NPC Name: ${formData.name}\nDescription: ${formData.description || 'Not specified'}\nTraits: ${formData.traits || 'Not specified'}`;
    const prompt = `Based on the following NPC info, generate a compelling "${field}":\n\n${npcContext}`;

    try {
      const result = await generateEnhancedText(prompt, undefined, isMockMode);
      const updatedData = { [field]: result };
      setFormData(prev => ({ ...prev, ...updatedData }));
      onUpdate(npc.id, updatedData);
    } catch (error) {
      console.error("AI generation failed:", error);
    } finally {
      setIsGenerating(null);
    }
  };

  // --- Player History Handlers ---
  const handleHistoryChange = (index: number, field: 'playerId' | 'details', value: string) => {
    const newHistory = [...(formData.knowsPlayerHistory || [])];
    newHistory[index] = { ...newHistory[index], [field]: value };
    setFormData(prev => ({ ...prev, knowsPlayerHistory: newHistory }));
  };

  const handleHistoryBlur = () => {
    onUpdate(npc.id, { knowsPlayerHistory: formData.knowsPlayerHistory });
  };

  const handleAddHistory = () => {
    const newHistory = [...(formData.knowsPlayerHistory || []), { playerId: '', details: '' }];
    setFormData(prev => ({ ...prev, knowsPlayerHistory: newHistory }));
    onUpdate(npc.id, { knowsPlayerHistory: newHistory });
  };

  const handleDeleteHistory = (index: number) => {
    const newHistory = (formData.knowsPlayerHistory || []).filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, knowsPlayerHistory: newHistory }));
    onUpdate(npc.id, { knowsPlayerHistory: newHistory });
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-fade-in">
      <header className="flex justify-between items-start">
        <div className="space-y-2">
            <div className="flex items-center gap-3 text-indigo-400">
              <Icons.NPCs className="w-8 h-8" />
              <h1 className="text-3xl font-bold font-serif text-slate-100">NPC Editor</h1>
            </div>
        </div>
        <Button variant="danger" size="sm" onClick={handleDelete}>
            <Icons.Trash className="w-3.5 h-3.5 mr-2" />
            Delete NPC
        </Button>
      </header>
      
      <div className="space-y-6 bg-slate-900/50 p-6 rounded-xl border border-slate-800/50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">NPC Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                onBlur={handleBlur}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"
              />
            </div>
             {/* Faction */}
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Faction</label>
                <select
                    name="factionId"
                    value={formData.factionId || "none"}
                    onChange={handleFactionChange}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                >
                    <option value="none">-- None --</option>
                    {factions.map(faction => (
                        <option key={faction.id} value={faction.id}>{faction.name}</option>
                    ))}
                </select>
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
          placeholder="Physical appearance, typical attire, mannerisms..."
          onAiGenerate={() => handleAiGenerate('description')}
          isGenerating={isGenerating === 'description'}
        />

        {/* Traits */}
        <AiTextarea
          label="Personality Traits"
          name="traits"
          value={formData.traits}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={2}
          placeholder="e.g., 'Taps fingers when impatient, speaks in riddles.'"
          onAiGenerate={() => handleAiGenerate('traits')}
          isGenerating={isGenerating === 'traits'}
        />

         {/* Example Quote */}
        <AiTextarea
          label="Example Quote"
          name="exampleQuote"
          value={formData.exampleQuote}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={2}
          placeholder="A memorable line of dialogue that captures their personality."
          onAiGenerate={() => handleAiGenerate('exampleQuote')}
          isGenerating={isGenerating === 'exampleQuote'}
        />

        {/* Backstory */}
        <AiTextarea
          label="Backstory"
          name="backstory"
          value={formData.backstory}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={5}
          onAiGenerate={() => handleAiGenerate('backstory')}
          isGenerating={isGenerating === 'backstory'}
        />

        {/* Motivations */}
        <AiTextarea
          label="Motivations"
          name="motivations"
          value={formData.motivations}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={2}
          placeholder="What drives this character?"
          onAiGenerate={() => handleAiGenerate('motivations')}
          isGenerating={isGenerating === 'motivations'}
        />

        {/* Secrets */}
        <AiTextarea
          label="Secrets"
          name="secrets"
          value={formData.secrets}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={3}
          placeholder="What are they hiding? What important information do they know?"
          onAiGenerate={() => handleAiGenerate('secrets')}
          isGenerating={isGenerating === 'secrets'}
        />

        {/* Stats */}
        <AiTextarea
          label="Stats / Game Info"
          name="stats"
          value={formData.stats}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={2}
          placeholder="e.g., 'Veteran warrior (use Knight stat block)' or 'Skilled archer, but clumsy.'"
          onAiGenerate={() => handleAiGenerate('stats')}
          isGenerating={isGenerating === 'stats'}
        />
        
        {/* Player History */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-sm font-medium text-slate-400">Player History & Relationships</label>
            <Button size="sm" variant="ghost" onClick={handleAddHistory}>
              <Icons.Plus className="w-3 h-3 mr-1.5" /> Add History
            </Button>
          </div>
          <div className="space-y-2">
            {formData.knowsPlayerHistory?.map((history, index) => (
              <div key={index} className="flex items-start gap-2 bg-slate-950/50 p-2 rounded-md border border-slate-800/50">
                <div className="flex-grow space-y-2">
                  <input
                    type="text"
                    placeholder="Player Name/Alias"
                    value={history.playerId}
                    onChange={(e) => handleHistoryChange(index, 'playerId', e.target.value)}
                    onBlur={handleHistoryBlur}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <textarea
                    placeholder="Details about their relationship, shared history, secrets, etc."
                    value={history.details}
                    onChange={(e) => handleHistoryChange(index, 'details', e.target.value)}
                    onBlur={handleHistoryBlur}
                    rows={2}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
                  />
                </div>
                <button onClick={() => handleDeleteHistory(index)} className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors mt-1">
                  <Icons.Trash className="w-4 h-4" />
                </button>
              </div>
            ))}
            {(!formData.knowsPlayerHistory || formData.knowsPlayerHistory.length === 0) && (
              <p className="text-xs text-slate-500 italic px-2 py-1">No specific history with players recorded.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
