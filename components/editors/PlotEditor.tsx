
import React, { useState, useEffect } from 'react';
import type { Plot, PlotStatus } from '../../types/index';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { AiTextarea } from '../common/Textarea';
import { generateEnhancedText } from '../../services/geminiService';
import { campaignService } from '../../services/campaignService';

interface PlotEditorProps {
  plot: Plot;
  onUpdate: (id: string, updatedData: Partial<Plot>) => void;
  onDelete: (id: string) => void;
  isMockMode: boolean;
}

export const PlotEditor: React.FC<PlotEditorProps> = ({ plot, onUpdate, onDelete, isMockMode }) => {
  const [formData, setFormData] = useState(plot);
  const [isGenerating, setIsGenerating] = useState(false);
  const campaign = campaignService.getState().campaigns.find(c => c.id === campaignService.getState().activeCampaignId)!;

  useEffect(() => {
    setFormData(plot);
  }, [plot]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (formData[e.target.name as keyof Plot] !== plot[e.target.name as keyof Plot]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onUpdate(plot.id, { [e.target.name]: e.target.value } as any);
    }
  };

  const handleEntityToggle = (entityId: string) => {
      const current = formData.relatedEntityIds || [];
      const updated = current.includes(entityId) ? current.filter(id => id !== entityId) : [...current, entityId];
      setFormData(prev => ({ ...prev, relatedEntityIds: updated }));
      onUpdate(plot.id, { relatedEntityIds: updated });
  }

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete this plot arc?`)) {
        onDelete(plot.id);
    }
  }
  
  const handleAiGenerate = async () => {
    setIsGenerating(true);
    const context = `Plot Title: ${formData.title}\nExisting Description: ${formData.description}`;
    const prompt = `Expand on the following plot outline. Suggest twists, complications, and potential resolutions:\n\n${context}`;

    try {
      const result = await generateEnhancedText(prompt, undefined, isMockMode);
      setFormData(prev => ({ ...prev, description: result }));
      onUpdate(plot.id, { description: result });
    } catch (error) {
      console.error("AI generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const allEntities = [
      ...campaign.npcs.map(n => ({ id: n.id, name: n.name, type: 'NPC' })),
      ...campaign.locations.map(l => ({ id: l.id, name: l.name, type: 'Location' })),
      ...campaign.factions.map(f => ({ id: f.id, name: f.name, type: 'Faction' }))
  ];

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
      <header className="flex justify-between items-start">
        <div className="space-y-2">
            <div className="flex items-center gap-3 text-indigo-400">
              <Icons.Plot className="w-8 h-8" />
              <h1 className="text-3xl font-bold font-serif text-slate-100">Plot Arc</h1>
            </div>
        </div>
        <Button variant="danger" size="sm" onClick={handleDelete}>
            <Icons.Trash className="w-3.5 h-3.5 mr-2" />
            Delete Plot
        </Button>
      </header>
      
      <div className="space-y-6 bg-slate-900/50 p-6 rounded-xl border border-slate-800/50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Title</label>
                <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all font-semibold text-lg placeholder:text-slate-600"
                    placeholder="Plot Title..."
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Status</label>
                <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all capitalize"
                >
                    <option value="active">Active</option>
                    <option value="dormant">Dormant</option>
                    <option value="resolved">Resolved</option>
                </select>
            </div>
        </div>

        <AiTextarea
          label="Description & Notes"
          name="description"
          value={formData.description}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={10}
          placeholder="Describe the main conflict, key beats, and current state of this plot arc."
          onAiGenerate={handleAiGenerate}
          isGenerating={isGenerating}
        />

        {/* Entity Tagging */}
        <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800/50">
            <label className="block text-sm font-medium text-slate-400 mb-3">Related Entities</label>
            <div className="max-h-60 overflow-y-auto custom-scrollbar grid grid-cols-1 md:grid-cols-3 gap-2">
                {allEntities.map(entity => (
                    <label key={entity.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-800 cursor-pointer transition-colors">
                        <input 
                            type="checkbox" 
                            checked={formData.relatedEntityIds.includes(entity.id)} 
                            onChange={() => handleEntityToggle(entity.id)}
                            className="rounded border-slate-600 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
                        />
                        <div className="flex flex-col min-w-0">
                            <span className="text-sm text-slate-300 truncate">{entity.name}</span>
                            <span className="text-[10px] text-slate-500 uppercase">{entity.type}</span>
                        </div>
                    </label>
                ))}
            </div>
             {allEntities.length === 0 && <p className="text-xs text-slate-500 italic">No entities to link.</p>}
        </div>
      </div>
    </div>
  );
};
