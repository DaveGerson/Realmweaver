
import React, { useState, useEffect } from 'react';
import type { Faction, NPC } from '../../types/index';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { AiTextarea } from '../common/Textarea';
import { generateEnhancedText } from '../../services/geminiService';

interface FactionEditorProps {
  faction: Faction;
  allNpcs: NPC[];
  onUpdate: (id: string, updatedData: Partial<Faction>) => void;
  onDelete: (id: string) => void;
  isMockMode: boolean;
}

export const FactionEditor: React.FC<FactionEditorProps> = ({ faction, allNpcs, onUpdate, onDelete, isMockMode }) => {
  const [formData, setFormData] = useState(faction);
  const [isGenerating, setIsGenerating] = useState<keyof Omit<Faction, 'id' | 'leaderId' | 'memberIds'> | null>(null);

  useEffect(() => {
    setFormData(faction);
  }, [faction]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (formData[e.target.name as keyof Faction] !== faction[e.target.name as keyof Faction]) {
        onUpdate(faction.id, { [e.target.name]: e.target.value });
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete the faction "${faction.name}"? This will unassign all its members.`)) {
        onDelete(faction.id);
    }
  }

  const handleAiGenerate = async (field: keyof Omit<Faction, 'id' | 'leaderId' | 'memberIds'>) => {
    setIsGenerating(field);
    const context = `Faction Name: ${formData.name}\nDescription: ${field === 'description' ? '[GENERATE THIS]' : formData.description || 'Not specified'}\nGoals: ${field === 'goals' ? '[GENERATE THIS]' : formData.goals || 'Not specified'}`;
    const prompt = `Based on the following faction info, generate a compelling "${field}":\n\n${context}`;

    try {
      const result = await generateEnhancedText(prompt, undefined, isMockMode);
      const updatedData = { [field]: result };
      setFormData(prev => ({ ...prev, ...updatedData }));
      onUpdate(faction.id, updatedData);
    } catch (error) {
      console.error("AI generation failed:", error);
    } finally {
      setIsGenerating(null);
    }
  };

  const memberNpcs = allNpcs.filter(npc => faction.memberIds.includes(npc.id));

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
      <header className="flex justify-between items-start">
        <div className="space-y-2">
            <div className="flex items-center gap-3 text-indigo-400">
              <Icons.Factions className="w-8 h-8" />
              <h1 className="text-3xl font-bold font-serif text-slate-100">Faction Editor</h1>
            </div>
        </div>
        <Button variant="danger" size="sm" onClick={handleDelete}>
            <Icons.Trash className="w-3.5 h-3.5 mr-2" />
            Delete Faction
        </Button>
      </header>
      
      <div className="space-y-6 bg-slate-900/50 p-6 rounded-xl border border-slate-800/50">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Faction Name</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"
          />
        </div>

        {/* Description */}
        <AiTextarea
          label="Description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={4}
          placeholder="The faction's purpose, public image, and typical members."
          onAiGenerate={() => handleAiGenerate('description')}
          isGenerating={isGenerating === 'description'}
        />

        {/* Goals */}
        <AiTextarea
          label="Goals"
          name="goals"
          value={formData.goals}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={3}
          placeholder="The faction's primary short-term and long-term objectives."
          onAiGenerate={() => handleAiGenerate('goals')}
          isGenerating={isGenerating === 'goals'}
        />

         <div>
             <label className="block text-sm font-medium text-slate-400 mb-1.5">Members</label>
             {memberNpcs.length > 0 ? (
                <div className="bg-slate-950 border border-slate-800 rounded-md p-3 space-y-2">
                    {memberNpcs.map(npc => (
                        <div key={npc.id} className="text-sm text-slate-300">{npc.name}</div>
                    ))}
                </div>
             ) : (
                <p className="text-sm text-slate-500 italic mt-2">No members assigned to this faction.</p>
             )}
        </div>
      </div>
    </div>
  );
};
