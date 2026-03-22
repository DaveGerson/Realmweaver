
import React, { useState, useEffect } from 'react';
import type { NPC, Faction, EntityRelationship, PlayerCharacter } from '../../types/index';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { AiTextarea } from '../common/Textarea';
import { generateEnhancedText } from '../../services/geminiService';
import { EntityHistoryManager } from '../common/EntityHistoryManager';
import { RegenerateButton } from '../common/RegenerateButton';
import { EntityLink } from '../common/EntityLink';
import { LinkedText } from '../common/LinkedText';
import { campaignService } from '../../services/campaignService'; // Import store for access to full state
import type { QuickCardEntityType } from '../common/EntityQuickCard';

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
  campaignContext?: string;
  onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
}

export const NpcEditor: React.FC<NpcEditorProps> = ({ npc, factions, allNpcs = [], playerCharacters = [], onUpdate, onDelete, isMockMode, campaignContext, onNavigate }) => {
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

  const handleFieldRegenerate = (field: keyof Omit<NPC, 'id' | 'factionId' | 'knowsPlayerHistory' | 'relationships' | 'history'>) => (newValue: string) => {
    setFormData(prev => ({ ...prev, [field]: newValue }));
    onUpdate(npc.id, { [field]: newValue });
  };

  const npcEntityContext = `NPC Name: ${formData.name}\nDescription: ${formData.description || 'Not specified'}\nTraits: ${formData.traits || 'Not specified'}\nBackstory: ${formData.backstory || 'Not specified'}\nMotivations: ${formData.motivations || 'Not specified'}`;

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
            <div className="flex items-center gap-3 text-amber-400">
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
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all placeholder:text-slate-600"
              />
            </div>
             {/* Faction */}
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Faction</label>
                <select
                    name="factionId"
                    value={formData.factionId || "none"}
                    onChange={handleFactionChange}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all"
                >
                    <option value="none">-- None --</option>
                    {factions.map(faction => (
                        <option key={faction.id} value={faction.id}>{faction.name}</option>
                    ))}
                </select>
                {formData.factionId && onNavigate && (
                    <div className="mt-1.5">
                        <EntityLink
                            entityType="faction"
                            entityId={formData.factionId}
                            label={factions.find(f => f.id === formData.factionId)?.name}
                            onNavigate={onNavigate}
                        />
                    </div>
                )}
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
          regenerateButton={<RegenerateButton fieldName="description" currentValue={formData.description} entityType="NPC" entityContext={npcEntityContext} onRegenerate={handleFieldRegenerate('description')} isMockMode={isMockMode} campaignContext={campaignContext} />}
        />
        {formData.description && onNavigate && (
            <p className="text-sm text-slate-300 leading-relaxed mt-1 px-1">
                <LinkedText text={formData.description} onNavigate={onNavigate} />
            </p>
        )}

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
          regenerateButton={<RegenerateButton fieldName="traits" currentValue={formData.traits} entityType="NPC" entityContext={npcEntityContext} onRegenerate={handleFieldRegenerate('traits')} isMockMode={isMockMode} campaignContext={campaignContext} />}
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
          regenerateButton={<RegenerateButton fieldName="exampleQuote" currentValue={formData.exampleQuote} entityType="NPC" entityContext={npcEntityContext} onRegenerate={handleFieldRegenerate('exampleQuote')} isMockMode={isMockMode} campaignContext={campaignContext} />}
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
          regenerateButton={<RegenerateButton fieldName="backstory" currentValue={formData.backstory} entityType="NPC" entityContext={npcEntityContext} onRegenerate={handleFieldRegenerate('backstory')} isMockMode={isMockMode} campaignContext={campaignContext} />}
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
          regenerateButton={<RegenerateButton fieldName="motivations" currentValue={formData.motivations} entityType="NPC" entityContext={npcEntityContext} onRegenerate={handleFieldRegenerate('motivations')} isMockMode={isMockMode} campaignContext={campaignContext} />}
        />
        {formData.motivations && onNavigate && (
            <p className="text-sm text-slate-300 leading-relaxed mt-1 px-1">
                <LinkedText text={formData.motivations} onNavigate={onNavigate} />
            </p>
        )}

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
          regenerateButton={<RegenerateButton fieldName="secrets" currentValue={formData.secrets} entityType="NPC" entityContext={npcEntityContext} onRegenerate={handleFieldRegenerate('secrets')} isMockMode={isMockMode} campaignContext={campaignContext} />}
        />
        {formData.secrets && onNavigate && (
            <p className="text-sm text-slate-300 leading-relaxed mt-1 px-1">
                <LinkedText text={formData.secrets} onNavigate={onNavigate} />
            </p>
        )}

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
          regenerateButton={<RegenerateButton fieldName="stats" currentValue={formData.stats} entityType="NPC" entityContext={npcEntityContext} onRegenerate={handleFieldRegenerate('stats')} isMockMode={isMockMode} campaignContext={campaignContext} />}
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
                            <div className="flex gap-2 flex-wrap items-center">
                                <select
                                    value={rel.targetId}
                                    onChange={(e) => handleRelationshipChange(index, 'targetId', e.target.value)}
                                    onBlur={handleRelationshipBlur}
                                    className="w-1/2 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-amber-500"
                                >
                                    <option value="">-- Select Target --</option>
                                    {possibleTargets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                                {rel.targetId && onNavigate && (() => {
                                    const isPc = playerCharacters.some(pc => pc.id === rel.targetId);
                                    return isPc ? null : (
                                        <EntityLink
                                            entityType="npc"
                                            entityId={rel.targetId}
                                            label={possibleTargets.find(t => t.id === rel.targetId)?.name}
                                            onNavigate={onNavigate}
                                        />
                                    );
                                })()}
                                <input 
                                    type="text" 
                                    placeholder="Type (e.g. Rival)" 
                                    value={rel.relationType}
                                    onChange={(e) => handleRelationshipChange(index, 'relationType', e.target.value)}
                                    onBlur={handleRelationshipBlur}
                                    className="w-1/2 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-amber-500"
                                />
                            </div>
                            <textarea
                                placeholder="Details about the relationship..."
                                value={rel.description}
                                onChange={(e) => handleRelationshipChange(index, 'description', e.target.value)}
                                onBlur={handleRelationshipBlur}
                                rows={1}
                                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-amber-500 resize-y"
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
