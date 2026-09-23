
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Faction, NPC, Location, Campaign } from '../../types/index';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { AiTextarea } from '../common/Textarea';
import { MentionInput, resolveMentionCandidates, findMentionedIdsInText } from '../common/MentionInput';
import { reconcileEntityFormData } from '../../utils/formReconciliation';
import { generateNpc } from '../../services/aiService';
import { GenerateHerePanel } from '../common/GenerateHerePanel';
import { RegenerateButton } from '../common/RegenerateButton';
import { buildEntityContext } from '../../utils/entityUtils';
import { EntityLink } from '../common/EntityLink';
import { LinkedText } from '../common/LinkedText';
import { campaignService } from '../../services/campaignService';
import type { QuickCardEntityType } from '../common/EntityQuickCard';
import { BacklinksPanel } from '../common/BacklinksPanel';
import { EntityHistoryManager } from '../common/EntityHistoryManager';
import { TabLayout } from '../common/TabLayout';
import type { TabDefinition } from '../common/TabLayout';
import { useDebouncedFieldCommit } from '../../hooks/useDebouncedFieldCommit';

interface FactionEditorProps {
  faction: Faction;
  allNpcs: NPC[];
  allLocations?: Location[];
  campaign?: Campaign;
  onUpdate: (id: string, updatedData: Partial<Faction>) => void;
  onDelete: (id: string) => void;
  isMockMode: boolean;
  campaignContext?: string;
  onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
  /**
   * True when this editor is rendering an unsaved chat-generator draft (e.g.
   * FactionDashboard's live preview), not a real, saved faction. The
   * synthetic `faction.id === 'preview'` id used by those previews is also
   * treated as this signal, so either one disables "generate here" affordances
   * that would otherwise write a real NPC pointing at a faction that doesn't exist yet.
   */
  isPreview?: boolean;
}

const FACTION_TABS: TabDefinition[] = [
  { id: 'overview',     label: 'Overview',     icon: Icons.Factions },
  { id: 'members',      label: 'Members',      icon: Icons.NPCs },
  { id: 'connections',  label: 'Connections',  icon: Icons.Link },
];

export const FactionEditor: React.FC<FactionEditorProps> = ({ faction, allNpcs, allLocations = [], campaign, onUpdate, onDelete, isMockMode, campaignContext, onNavigate, isPreview = false }) => {
  const [formData, setFormData] = useState(faction);
  const [isGeneratingMember, setIsGeneratingMember] = useState(false);
  const [memberGenerationError, setMemberGenerationError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const { confirm } = useConfirmDialog();
  const isDraftPreview = isPreview || faction.id === 'preview';

  // Tracks the last `faction` prop we've reconciled against, so incoming prop
  // updates can be merged field-by-field instead of overwriting formData wholesale.
  const prevFactionRef = useRef(faction);

  // Reset to first tab when the entity changes
  useEffect(() => {
    setActiveTab('overview');
  }, [faction.id]);

  useEffect(() => {
    const prevFaction = prevFactionRef.current;
    if (prevFaction !== faction) {
      setFormData(prev => reconcileEntityFormData(prev, prevFaction, faction));
    }
    prevFactionRef.current = faction;
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

  const handleDelete = async () => {
    const confirmed = await confirm('Delete Faction', `Are you sure you want to delete the faction "${faction.name}"? This will unassign all its members.`, { variant: 'danger' });
    if (confirmed) {
      onDelete(faction.id);
    }
  }

  // Store writes are debounced per field and keyed to the entity id by
  // useDebouncedFieldCommit, which flushes pending edits when the edited
  // entity changes under this same mounted editor or on unmount, so text
  // typed inside the debounce window is committed to the entity it was
  // typed against (finding #70).
  const { commit: commitMentionField } = useDebouncedFieldCommit<Faction>(faction.id, onUpdate);
  const handleMentionFieldChange = (field: keyof Faction) => (value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    commitMentionField(field, value);
  };

  // --- @-mention tracking across all MentionInput fields ---
  // Candidates already known to be mentioned (from a prior session), used both to
  // hydrate MentionInput's internal map and to seed each field's initial ID set.
  const mentionCandidates = useMemo(
    () => resolveMentionCandidates(campaign, faction.mentionedEntityIds),
    [campaign, faction.mentionedEntityIds],
  );
  // Per-field mention ID sets. Kept in a ref, not state — nothing renders off
  // of this value directly, it exists purely so handleMentionedIdsChange can
  // compute the merged set without writing to the store from inside a
  // setState updater (React invokes functional updaters during the render
  // phase, and StrictMode intentionally double-invokes them — doing the
  // store write there fired it twice).
  const mentionedIdsByFieldRef = useRef<Record<string, string[]>>({
    description: findMentionedIdsInText(faction.description, mentionCandidates),
    goals: findMentionedIdsInText(faction.goals, mentionCandidates),
  });
  // Last merged id set actually written to the store. MentionInput reports
  // its field's id set on every keystroke even when that set hasn't changed,
  // so without this the store (and every useSyncExternalStore subscriber)
  // would still churn once per character (finding #70).
  const lastMergedIdsKeyRef = useRef<string>(
    Array.from(new Set(Object.values(mentionedIdsByFieldRef.current).flat())).sort().join(String.fromCharCode(0)),
  );
  // Editors are not remounted when the GM navigates A -> B (ViewRouter renders
  // this editor at a fixed position with no key), so the useRef initialisers
  // above only ever ran for the FIRST entity. Rebuild both refs from the
  // incoming entity on every id change, mirroring the mount-time seeding —
  // otherwise B's first keystroke merges A's stale per-field sets into B's
  // mentionedEntityIds (or A's stale merged key suppresses B's first
  // legitimate write). Keyed on the id ONLY — resetting on every
  // mentionCandidates recompute would discard in-session tracked mentions
  // (same rationale as MentionInput's seedKey resync).
  useEffect(() => {
    mentionedIdsByFieldRef.current = {
      description: findMentionedIdsInText(faction.description, mentionCandidates),
      goals: findMentionedIdsInText(faction.goals, mentionCandidates),
    };
    lastMergedIdsKeyRef.current =
      Array.from(new Set(Object.values(mentionedIdsByFieldRef.current).flat())).sort().join(String.fromCharCode(0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faction.id]);
  // Reports the merged set of mentioned IDs (across every mention field) whenever any field changes.
  const handleMentionedIdsChange = (field: string) => (ids: string[]) => {
    const next = { ...mentionedIdsByFieldRef.current, [field]: ids };
    mentionedIdsByFieldRef.current = next;
    const merged = Array.from(new Set(Object.values(next).flat()));
    const mergedKey = merged.slice().sort().join(String.fromCharCode(0));
    if (mergedKey === lastMergedIdsKeyRef.current) return;
    lastMergedIdsKeyRef.current = mergedKey;
    setFormData(fd => ({ ...fd, mentionedEntityIds: merged }));
    onUpdate(faction.id, { mentionedEntityIds: merged });
  };

  const handleFieldRegenerate = (field: keyof Omit<Faction, 'id' | 'leaderId' | 'memberIds' | 'headquartersLocationId' | 'alignment'>) => (newValue: string) => {
    setFormData(prev => ({ ...prev, [field]: newValue }));
    onUpdate(faction.id, { [field]: newValue });
  };

  const factionEntityContext = buildEntityContext('faction', formData);

  // --- Generate Member NPC ---
  const memberGenerationDefaultPrompt = `Generate a member NPC for the "${faction.name}" faction. ${faction.description ? `The faction is: ${faction.description}` : ''} This NPC should have a clear role and motivation within the faction.`.trim();

  const handleGenerateMemberNpc = async (prompt: string) => {
    setIsGeneratingMember(true);
    setMemberGenerationError(null);
    const contextWithFaction = `${campaignContext || ''}\nFaction: ${faction.name}${faction.description ? ` — ${faction.description}` : ''}${faction.goals ? `\nFaction Goals: ${faction.goals}` : ''}`.trim();
    try {
      const npcData = await generateNpc(prompt, isMockMode, contextWithFaction);
      campaignService.createNpc({ ...npcData, factionId: faction.id, relationships: [], history: [] });
    } catch (error) {
      console.error('Failed to generate member NPC:', error);
      setMemberGenerationError('Failed to generate member NPC. Please try again.');
    } finally {
      setIsGeneratingMember(false);
    }
  };

  const memberNpcs = allNpcs.filter(npc => (faction.memberIds || []).includes(npc.id));

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
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center">
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Description</label>
                    <RegenerateButton fieldName="description" currentValue={formData.description} entityType="Faction" entityContext={factionEntityContext} onRegenerate={handleFieldRegenerate('description')} isMockMode={isMockMode} campaignContext={campaignContext} />
                  </div>
                </div>
                <MentionInput
                  value={formData.description}
                  onChange={handleMentionFieldChange('description')}
                  onMentionedIdsChange={handleMentionedIdsChange('description')}
                  initialMentions={mentionCandidates}
                  rows={4}
                  placeholder="The faction's purpose, public image, and typical members. (type @ to mention entities)"
                />
              </div>
              {formData.description && onNavigate && (
                  <p className="text-sm text-slate-300 leading-relaxed mt-1 px-1">
                      <LinkedText text={formData.description} onNavigate={onNavigate} />
                  </p>
              )}

              {/* Goals */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center">
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Goals</label>
                    <RegenerateButton fieldName="goals" currentValue={formData.goals} entityType="Faction" entityContext={factionEntityContext} onRegenerate={handleFieldRegenerate('goals')} isMockMode={isMockMode} campaignContext={campaignContext} />
                  </div>
                </div>
                <MentionInput
                  value={formData.goals}
                  onChange={handleMentionFieldChange('goals')}
                  onMentionedIdsChange={handleMentionedIdsChange('goals')}
                  initialMentions={mentionCandidates}
                  rows={3}
                  placeholder="The faction's primary short-term and long-term objectives. (type @ to mention entities)"
                />
              </div>
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
                regenerateButton={<RegenerateButton fieldName="resources" currentValue={formData.resources || ''} entityType="Faction" entityContext={factionEntityContext} onRegenerate={handleFieldRegenerate('resources')} isMockMode={isMockMode} campaignContext={campaignContext} />}
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
                regenerateButton={<RegenerateButton fieldName="influence" currentValue={formData.influence || ''} entityType="Faction" entityContext={factionEntityContext} onRegenerate={handleFieldRegenerate('influence')} isMockMode={isMockMode} campaignContext={campaignContext} />}
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
                    disabled={isDraftPreview}
                    disabledReason={isDraftPreview ? 'Save this faction before generating members.' : undefined}
                  />
                </div>
                {memberGenerationError && (
                  <p role="alert" className="text-xs text-red-400 mb-1.5">{memberGenerationError}</p>
                )}
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
              {campaign && (
                <EntityHistoryManager
                    subjectId={faction.id}
                    subjectType="faction"
                    campaign={campaign}
                    onUpdateEntity={(type, id, changes) => {
                        if (type === 'npc') campaignService.updateNpc(id, changes);
                        if (type === 'location') campaignService.updateLocation(id, changes);
                    }}
                />
              )}
            </div>
          )}

        </TabLayout>
      </div>
    </div>
  );
};
