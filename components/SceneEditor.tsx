import React, { useState, useEffect } from 'react';
import type { Scene, SceneType, NPC, Location, SkillCheck } from '../types/index';
import { Icons } from './Icons';
import { Button } from './common/Button';
import { AiTextarea } from './common/Textarea';
import { generateEnhancedText } from '../services/aiService';

interface SceneEditorProps {
  scene: Scene;
  allNpcs: NPC[];
  allLocations: Location[];
  onUpdate: (id: string, updatedData: Partial<Scene>) => void;
  onDelete: (id: string) => void;
  isMockMode: boolean;
}

const sceneTypeOptions: SceneType[] = ['combat', 'social', 'exploration', 'puzzle'];

export const SceneEditor: React.FC<SceneEditorProps> = ({ scene, allNpcs, allLocations, onUpdate, onDelete, isMockMode }) => {
  const [formData, setFormData] = useState(scene);
  const [isGenerating, setIsGenerating] = useState<keyof Omit<Scene, 'id' | 'type' | 'locationId' | 'npcIds' | 'skillChecks'> | null>(null);

  useEffect(() => {
    setFormData(scene);
  }, [scene]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (formData[e.target.name as keyof Scene] !== scene[e.target.name as keyof Scene]) {
        onUpdate(scene.id, { [e.target.name]: e.target.value });
    }
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    const finalValue = value === "none" ? undefined : value;
    setFormData(prev => ({ ...prev, [name]: finalValue }));
    onUpdate(scene.id, { [name]: finalValue });
  };
  
  const handleNpcToggle = (npcId: string) => {
    const newNpcIds = formData.npcIds.includes(npcId)
      ? formData.npcIds.filter(id => id !== npcId)
      : [...formData.npcIds, npcId];
    setFormData(prev => ({ ...prev, npcIds: newNpcIds }));
    onUpdate(scene.id, { npcIds: newNpcIds });
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete the scene "${scene.title}"? This action cannot be undone.`)) {
        onDelete(scene.id);
    }
  }
  
  const handleAiGenerate = async (field: keyof Omit<Scene, 'id' | 'type' | 'locationId' | 'npcIds' | 'skillChecks'>) => {
    setIsGenerating(field);
    const sceneContext = `Scene Title: ${formData.title}\nScene Type: ${formData.type}\nRead-Aloud Text: ${formData.readAloudText || 'Not specified'}`;
    const prompt = `Based on the following scene info, generate compelling "${field}":\n\n${sceneContext}`;

    try {
      const result = await generateEnhancedText(prompt, undefined, isMockMode);
      const updatedData = { [field]: result };
      setFormData(prev => ({ ...prev, ...updatedData }));
      onUpdate(scene.id, updatedData);
    } catch (error) {
      console.error("AI generation failed:", error);
    } finally {
      setIsGenerating(null);
    }
  };

  // --- Skill Check Handlers ---
  const handleSkillCheckChange = (id: string, field: keyof Omit<SkillCheck, 'id'>, value: string | number) => {
    const newSkillChecks = formData.skillChecks.map(sc => sc.id === id ? { ...sc, [field]: value } : sc);
    setFormData(prev => ({ ...prev, skillChecks: newSkillChecks }));
  };

  const handleSkillCheckBlur = () => {
      onUpdate(scene.id, { skillChecks: formData.skillChecks });
  };

  const handleAddSkillCheck = () => {
    const newSkillCheck: SkillCheck = { id: crypto.randomUUID(), skill: 'Perception', dc: 10, description: ''};
    const newSkillChecks = [...formData.skillChecks, newSkillCheck];
    setFormData(prev => ({...prev, skillChecks: newSkillChecks}));
    onUpdate(scene.id, { skillChecks: newSkillChecks });
};

  const handleDeleteSkillCheck = (id: string) => {
    const newSkillChecks = formData.skillChecks.filter(sc => sc.id !== id);
    setFormData(prev => ({...prev, skillChecks: newSkillChecks}));
    onUpdate(scene.id, { skillChecks: newSkillChecks });
  }


  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-fade-in">
      <header className="flex justify-between items-start">
        <div className="space-y-2">
            <div className="flex items-center gap-3 text-indigo-400">
              <Icons.Scenes className="w-8 h-8" />
              <h1 className="text-3xl font-bold font-serif text-slate-100">Scene Editor</h1>
            </div>
        </div>
        <Button variant="danger" size="sm" onClick={handleDelete}>
            <Icons.Trash className="w-3.5 h-3.5 mr-2" />
            Delete Scene
        </Button>
      </header>
      
      <div className="space-y-6 bg-slate-900/50 p-6 rounded-xl border border-slate-800/50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Scene Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                onBlur={handleBlur}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"
              />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Type</label>
                <select
                    name="type"
                    value={formData.type}
                    onChange={handleSelectChange}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all capitalize"
                >
                    {sceneTypeOptions.map(t => (
                        <option key={t} value={t} className="capitalize">{t}</option>
                    ))}
                </select>
            </div>
        </div>

        <AiTextarea
          label="Read-Aloud Text"
          name="readAloudText"
          value={formData.readAloudText}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={5}
          placeholder="Evocative 'box text' to read to your players to set the scene."
          onAiGenerate={() => handleAiGenerate('readAloudText')}
          isGenerating={isGenerating === 'readAloudText'}
        />

        <AiTextarea
          label="GM Notes"
          name="gmNotes"
          value={formData.gmNotes}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={8}
          placeholder="GM-only notes: scene goals, character motivations, potential outcomes, hidden details..."
          onAiGenerate={() => handleAiGenerate('gmNotes')}
          isGenerating={isGenerating === 'gmNotes'}
        />

        {/* --- Skill Checks --- */}
        <div>
            <div className="flex justify-between items-center mb-1.5">
                 <label className="block text-sm font-medium text-slate-400">Skill Checks</label>
                 <Button size="sm" variant="ghost" onClick={handleAddSkillCheck}>
                    <Icons.Plus className="w-3 h-3 mr-1.5" /> Add Check
                 </Button>
            </div>
            <div className="space-y-2">
                {formData.skillChecks?.map((sc, index) => (
                    <div key={sc.id} className="grid grid-cols-12 gap-2 items-center bg-slate-950/50 p-2 rounded-md">
                        <input
                            type="text"
                            placeholder="Skill"
                            value={sc.skill}
                            onChange={(e) => handleSkillCheckChange(sc.id, 'skill', e.target.value)}
                            onBlur={handleSkillCheckBlur}
                            className="col-span-3 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <div className="col-span-2 flex items-center">
                           <span className="text-slate-500 text-sm mr-2">DC</span>
                           <input
                                type="number"
                                value={sc.dc}
                                onChange={(e) => handleSkillCheckChange(sc.id, 'dc', parseInt(e.target.value, 10) || 0)}
                                onBlur={handleSkillCheckBlur}
                                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                        <input
                            type="text"
                            placeholder="Description of the check"
                            value={sc.description}
                            onChange={(e) => handleSkillCheckChange(sc.id, 'description', e.target.value)}
                            onBlur={handleSkillCheckBlur}
                            className="col-span-6 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <div className="col-span-1 text-right">
                           <button onClick={() => handleDeleteSkillCheck(sc.id)} className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors">
                             <Icons.Trash className="w-4 h-4" />
                           </button>
                        </div>
                    </div>
                ))}
                 {(!formData.skillChecks || formData.skillChecks.length === 0) && (
                    <p className="text-xs text-slate-500 italic px-2">No skill checks defined for this scene.</p>
                )}
            </div>
        </div>


        <AiTextarea
          label="Rewards"
          name="rewards"
          value={formData.rewards}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={3}
          placeholder="Loot, treasure, gold, experience points, or other rewards."
          onAiGenerate={() => handleAiGenerate('rewards')}
          isGenerating={isGenerating === 'rewards'}
        />


        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Location</label>
            <select
                name="locationId"
                value={formData.locationId || "none"}
                onChange={handleSelectChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
            >
                <option value="none">-- None --</option>
                {allLocations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
            </select>
        </div>
        
        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">NPCs Involved</label>
            <div className="max-h-60 overflow-y-auto bg-slate-950 border border-slate-800 rounded-md p-3 space-y-2 custom-scrollbar">
                {allNpcs.length > 0 ? allNpcs.map(npc => (
                     <label key={npc.id} className="flex items-center text-sm text-slate-300 select-none p-1 rounded-md hover:bg-slate-800/50 transition-colors">
                        <input
                            type="checkbox"
                            checked={formData.npcIds.includes(npc.id)}
                            onChange={() => handleNpcToggle(npc.id)}
                            className="w-4 h-4 mr-3 bg-slate-800 border-slate-600 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        {npc.name}
                    </label>
                )) : <p className="text-xs text-slate-500 italic">No NPCs exist in this campaign yet.</p>}
            </div>
        </div>
      </div>
    </div>
  );
};
