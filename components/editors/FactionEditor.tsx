
import React, { useState, useEffect } from 'react';
import type { Faction, NPC, Location } from '../../types/index';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { AiTextarea } from '../common/Textarea';
import { generateEnhancedText, generateNpc } from '../../services/geminiService';
import { GenerateHerePanel } from '../common/GenerateHerePanel';
import { RegenerateButton } from '../common/RegenerateButton';
import { EntityLink } from '../common/EntityLink';
import { LinkedText } from '../common/LinkedText';
import { campaignService } from '../../services/campaignService';
import type { QuickCardEntityType } from '../common/EntityQuickCard';
import { BacklinksPanel } from '../common/BacklinksPanel';
import { EntityHistoryManager } from '../common/EntityHistoryManager';
import { TabLayout } from '../common/TabLayout';
import type { TabDefinition } from '../common/TabLayout';

interface FactionEditorProps {
  faction: Faction;
  allNpcs: NPC[];
  allLocations?: Location[];
  onUpdate: (id: string, updatedData: Partial<Faction>) => void;
  onDelete: (id: string) => void;
  isMockMode: boolean;
  campaignContext?: string;
  onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
}

const FACTION_TABS: TabDefinition[] = [
  { id: 'overview',     label: 'Overview',     icon: Icons.Factions },
  { id: 'members',      label: 'Members',      icon: Icons.NPCs },
  { id: 'connections',  label: 'Connections',  icon: Icons.Link },
];

export const FactionEditor: React.FC<FactionEditorProps> = ({ faction, allNpcs, allLocations = [], onUpdate, onDelete, isMockMode, campaignContext, onNavigate }) => {
  const [formData, setFormData] = useState(faction);
  const [isGenerating, setIsGenerating] = useState<keyof Omit<Faction, 'id' | 'leaderId' | 'memberIds'> | null>(null);
  const [isGeneratingMember, setIsGeneratingMember] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const campaign = campaignService.getState().campaigns.find(c => c.id === campaignService.getState().activeCampaignId)!;

  // Reset to first tab when the entity changes
  useEffect(() => {
    setActiveTab('overview');
  }, [faction.id]);

  useEffect(() => {
    setFormData(faction);
  }, [faction]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (formData[e.target.name as keyof Faction] !== faction[e.target.name as keyof Faction]) {
        onUpdate(faction.id, { [e.target.name]: e.target.value });
    }
  };

  const handleHeadquartersChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newLocationId = value === "none" ? undefined : value;
    setFormData(prev => ({ ...prev, [name]: newLocationId }));
    onUpdate(faction.id, { [name]: newLocationId });
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete the faction "${faction.name}"? This will unassign all its members.`)) {
        onDelete(faction.id);
    }
  }

  const handleAiGenerate = async (field: keyof Omit<Faction, 'id' | 'leaderId' | 'memberIds' | 'headquartersLocationId'>) => {
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

  const handleFieldRegenerate = (field: keyof Omit<Faction, 'id' | 'leaderId' | 'memberIds' | 'headquartersLocationId'>) => (newValue: string) => {
    setFormData(prev => ({ ...prev, [field]: newValue }));
    onUpdate(faction.id, { [field]: newValue });
  };

  const factionEntityContext = `Faction Name: ${formData.name}\nDescription: ${formData.description || 'Not specified'}\nGoals: ${formData.goals || 'Not specified'}\nAlignment: ${formData.alignment || 'Not specified'}`;

  // --- Generate Member NPC ---
  const memberGenerationDefaultPrompt = `Generate a member NPC for the "${faction.name}" faction. ${faction.description ? `The faction is: ${faction.description}` : ''} This NPC should have a clear role and motivation within the faction.`.trim();

  const handleGenerateMemberNpc = async (prompt: string) => {
    setIsGeneratingMember(true);
    const contextWithFaction = `${campaignContext || ''}\nFaction: ${faction.name}${faction.description ? ` — ${faction.description}` : ''}${faction.goals ? `\nFaction Goals: ${faction.goals}` : ''}`.trim();
    try {
      const npcData = await generateNpc(prompt, false, isMockMode, contextWithFaction);
      campaignService.createNpc({ ...npcData, factionId: faction.id, relationships: [], history: [] });
    } catch (error) {
      console.error('Failed to generate member NPC:', error);
    } finally {
      setIsGeneratingMember(false);
    }
  };

  const memberNpcs = allNpcs.filter(npc => faction.memberIds.includes(npc.id));

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar animate-fade-in">
      <header className="flex justify-between items-start mb-6">
        <div className="space-y-2">
            <div className="flex items-center gap-3 text-amber-400">
              <Icons.Factions className="w-8 h-8" />
              <h1 className="text-3xl font-bold font-serif text-slate-100">Faction Editor</h1>
            </div>
        </div>
        <Button variant="danger" size="sm" onClick={handleDelete}>
            <Icons.Trash className="w-3.5 h-3.5 mr-2" />
            Delete Faction
        </Button>
      </header>

      <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800/50">
        <TabLayout tabs={FACTION_TABS} activeTab={activeTab} onTabChange={setActiveTab}>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Faction Name</label>
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
                      <label className="block text-sm font-medium text-slate-400 mb-1.5">Alignment</label>
                      <input
                          type="text"
                          name="alignment"
                          value={formData.alignment || ''}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          placeholder="e.g. Neutral Good, Chaotic Evil"
                          className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all placeholder:text-slate-600"
                      />
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
                placeholder="The faction's purpose, public image, and typical members."
                onAiGenerate={() => handleAiGenerate('description')}
                isGenerating={isGenerating === 'description'}
                regenerateButton={<RegenerateButton fieldName="description" currentValue={formData.description} entityType="Faction" entityContext={factionEntityContext} onRegenerate={handleFieldRegenerate('description')} isMockMode={isMockMode} campaignContext={campaignContext} />}
              />
              {formData.description && onNavigate && (
                  <p className="text-sm text-slate-300 leading-relaxed mt-1 px-1">
                      <LinkedText text={formData.description} onNavigate={onNavigate} />
                  </p>
              )}

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
                regenerateButton={<RegenerateButton fieldName="goals" currentValue={formData.goals} entityType="Faction" entityContext={factionEntityContext} onRegenerate={handleFieldRegenerate('goals')} isMockMode={isMockMode} campaignContext={campaignContext} />}
              />
              {formData.goals && onNavigate && (
                  <p className="text-sm text-slate-300 leading-relaxed mt-1 px-1">
                      <LinkedText text={formData.goals} onNavigate={onNavigate} />
                  </p>
              )}

              {/* Resources */}
              <AiTextarea
                label="Resources & Assets"
                name="resources"
                value={formData.resources || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                rows={3}
                placeholder="Wealth, magic items, safehouses, connections, military might."
                onAiGenerate={() => handleAiGenerate('resources')}
                isGenerating={isGenerating === 'resources'}
              />

              {/* Influence */}
              <AiTextarea
                label="Influence & Power"
                name="influence"
                value={formData.influence || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                rows={3}
                placeholder="Where do they hold sway? Who fears or respects them?"
                onAiGenerate={() => handleAiGenerate('influence')}
                isGenerating={isGenerating === 'influence'}
              />
            </div>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && (
            <div className="space-y-6">
              {/* Headquarters */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Headquarters</label>
                <select
                    name="headquartersLocationId"
                    value={formData.headquartersLocationId || "none"}
                    onChange={handleHeadquartersChange}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all"
                >
                    <option value="none">-- None / Unknown --</option>
                    {allLocations.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                </select>
                {formData.headquartersLocationId && onNavigate && (
                    <div className="mt-1.5">
                        <EntityLink
                            entityType="location"
                            entityId={formData.headquartersLocationId}
                            label={allLocations.find(l => l.id === formData.headquartersLocationId)?.name}
                            onNavigate={onNavigate}
                        />
                    </div>
                )}
              </div>

              {/* Members list */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label className="block text-sm font-medium text-slate-400">Members</label>
                  <GenerateHerePanel
                    buttonLabel="Generate member NPC"
                    defaultPrompt={memberGenerationDefaultPrompt}
                    isGenerating={isGeneratingMember}
                    onGenerate={handleGenerateMemberNpc}
                  />
                </div>
                {memberNpcs.length > 0 ? (
                   <div className="bg-slate-950 border border-slate-800 rounded-md p-3 space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                       {memberNpcs.map(npc => (
                           <div key={npc.id} className="text-sm text-slate-300 flex items-center gap-2">
                               <Icons.NPCs className="w-3 h-3 text-slate-500 flex-shrink-0" />
                               {onNavigate ? (
                                   <EntityLink
                                       entityType="npc"
                                       entityId={npc.id}
                                       label={npc.name}
                                       onNavigate={onNavigate}
                                   />
                               ) : npc.name}
                           </div>
                       ))}
                   </div>
                ) : (
                   <p className="text-sm text-slate-500 italic mt-2">No members assigned to this faction. Assign NPCs by setting their faction in the NPC editor, or generate a member above.</p>
                )}
              </div>
            </div>
          )}

          {/* Connections Tab */}
          {activeTab === 'connections' && (
            <div className="space-y-6">
              {/* Backlinks Panel */}
              <BacklinksPanel entityId={faction.id} entityType="faction" onNavigate={onNavigate} />

              {/* History Manager */}
              <EntityHistoryManager
                  subjectId={faction.id}
                  subjectType="faction"
                  campaign={campaign}
                  onUpdateEntity={(type, id, changes) => {
                      if (type === 'npc') campaignService.updateNpc(id, changes);
                      if (type === 'location') campaignService.updateLocation(id, changes);
                  }}
              />
            </div>
          )}

        </TabLayout>
      </div>
    </div>
  );
};
