
import React, { useState, useEffect } from 'react';
import type { NPC, Faction, EntityRelationship, PlayerCharacter } from '../../types/index';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { AiTextarea } from '../common/Textarea';
import { generateEnhancedText } from '../../services/geminiService';
import { EntityHistoryManager } from '../common/EntityHistoryManager';
import { campaignService } from '../../services/campaignService'; // Import store for access to full state

interface NpcEditorProps {
  npc: NPC;
  factions: Faction[];
  allNpcs?: NPC[];
  playerCharacters?: PlayerCharacter[];
  // sessionLogs and articles are no longer needed directly as props if we access via store, but kept for prop compatibility if needed
  sessionLogs?: any[]; 
  articles?: any[];
  onUpdate: (id: string, updatedData: Partial<NPC>) => void;
  onDelete: (id: string) => void;
  isMockMode: boolean;
}

export const NpcEditor: React.FC<NpcEditorProps> = ({ npc, factions, allNpcs = [], playerCharacters = [], onUpdate, onDelete, isMockMode }) => {
  const [formData, setFormData] = useState(npc);
  const [isGenerating, setIsGenerating] = useState<keyof Omit<NPC, 'id' | 'factionId' | 'knowsPlayerHistory' | 'relationships' | 'history'> | null>(null);

  // We need access to the full campaign for the HistoryManager to resolve links
  const campaign = campaignService.getState().campaigns.find(c => c.id === campaignService.getState().activeCampaignId)!;

  useEffect(() => {
    setFormData(npc);
  }, [npc]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

  const handleAiGenerate = async (field: keyof Omit<NPC, 'id' | 'factionId' | 'knowsPlayerHistory' | 'relationships' | 'history'>) => {
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

  // --- Relationship Handlers ---
  const handleAddRelationship = () => {
      const newRel: EntityRelationship = { id: crypto.randomUUID(), targetId: '', relationType: '', description: '' };
      const newRelationships = [...(formData.relationships || []), newRel];
      setFormData(prev => ({...prev, relationships: newRelationships}));
      onUpdate(npc.id, { relationships: newRelationships });
  };

  const handleRelationshipChange = (index: number, field: keyof EntityRelationship, value: string) => {
      const newRelationships = [...(formData.relationships || [])];
      newRelationships[index] = { ...newRelationships[index], [field]: value };
      setFormData(prev => ({...prev, relationships: newRelationships}));
  };

  const handleRelationshipBlur = () => {
      onUpdate(npc.id, { relationships: formData.relationships });
  };

  const handleDeleteRelationship = (index: number) => {
      const newRelationships = (formData.relationships || []).filter((_, i) => i !== index);
      setFormData(prev => ({...prev, relationships: newRelationships}));
      onUpdate(npc.id, { relationships: newRelationships });
  };

  const possibleTargets = [
      ...playerCharacters.map(pc => ({ id: pc.id, name: `${pc.characterSocial.characterName} (PC)` })),
      ...allNpcs.filter(n => n.id !== npc.id).map(n => ({ id: n.id, name: n.name }))
  ];

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
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
        
        {/* Relationships Section */}
        <div>
            <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-medium text-slate-400">Relationships</label>
                <Button size="sm" variant="ghost" onClick={handleAddRelationship}>
                    <Icons.Plus className="w-3 h-3 mr-1.5" /> Add Relationship
                </Button>
            </div>
            <div className="space-y-2">
                {(formData.relationships || []).map((rel, index) => (
                    <div key={rel.id} className="flex items-start gap-2 bg-slate-950/50 p-2 rounded-md border border-slate-800/50">
                        <div className="flex flex-col gap-2 w-full">
                            <div className="flex gap-2">
                                <select 
                                    value={rel.targetId}
                                    onChange={(e) => handleRelationshipChange(index, 'targetId', e.target.value)}
                                    onBlur={handleRelationshipBlur}
                                    className="w-1/2 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                                >
                                    <option value="">-- Select Target --</option>
                                    {possibleTargets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                                <input 
                                    type="text" 
                                    placeholder="Type (e.g. Rival)" 
                                    value={rel.relationType}
                                    onChange={(e) => handleRelationshipChange(index, 'relationType', e.target.value)}
                                    onBlur={handleRelationshipBlur}
                                    className="w-1/2 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            <textarea
                                placeholder="Details about the relationship..."
                                value={rel.description}
                                onChange={(e) => handleRelationshipChange(index, 'description', e.target.value)}
                                onBlur={handleRelationshipBlur}
                                rows={1}
                                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
                            />
                        </div>
                        <button onClick={() => handleDeleteRelationship(index)} className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors">
                            <Icons.Trash className="w-4 h-4" />
                        </button>
                    </div>
                ))}
                {(!formData.relationships || formData.relationships.length === 0) && (
                    <p className="text-xs text-slate-500 italic px-2 py-1">No relationships defined.</p>
                )}
            </div>
        </div>

        {/* History Manager */}
        <EntityHistoryManager 
            subjectId={npc.id}
            subjectType="npc"
            campaign={campaign}
            onUpdateEntity={(type, id, changes) => {
                if (type === 'npc') campaignService.updateNpc(id, changes);
                if (type === 'location') campaignService.updateLocation(id, changes);
            }}
        />

      </div>
    </div>
  );
};
