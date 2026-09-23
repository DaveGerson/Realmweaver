
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { reconcileEntityFormData } from '../../utils/formReconciliation';
import type { NPC, Faction, EntityRelationship, PlayerCharacter, Campaign } from '../../types/index';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { AiTextarea } from '../common/Textarea';
import { MentionInput, resolveMentionCandidates, findMentionedIdsInText } from '../common/MentionInput';
import { EntityHistoryManager } from '../common/EntityHistoryManager';
import { RegenerateButton } from '../common/RegenerateButton';
import { EntityLink } from '../common/EntityLink';
import { LinkedText } from '../common/LinkedText';
import { campaignService } from '../../services/campaignService';
import type { QuickCardEntityType } from '../common/EntityQuickCard';
import { BacklinksPanel } from '../common/BacklinksPanel';
import { TabLayout } from '../common/TabLayout';
import type { TabDefinition } from '../common/TabLayout';
import { useDebouncedFieldCommit } from '../../hooks/useDebouncedFieldCommit';

interface NpcEditorProps {
  npc: NPC;
  factions: Faction[];
  allNpcs?: NPC[];
  playerCharacters?: PlayerCharacter[];
  sessionLogs?: any[];
  articles?: any[];
  campaign?: Campaign;
  onUpdate: (id: string, updatedData: Partial<NPC>) => void;
  onDelete: (id: string) => void;
  isMockMode: boolean;
  campaignContext?: string;
  onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
}

const NPC_TABS: TabDefinition[] = [
  { id: 'identity',     label: 'Identity',      icon: Icons.NPCs },
  { id: 'personality',  label: 'Personality',   icon: Icons.Chat },
  { id: 'stats',        label: 'Stats & Combat', icon: Icons.Combat },
  { id: 'connections',  label: 'Connections',   icon: Icons.Link },
];

export const NpcEditor: React.FC<NpcEditorProps> = ({ npc, factions, allNpcs = [], playerCharacters = [], campaign: campaignProp, onUpdate, onDelete, isMockMode, campaignContext, onNavigate }) => {
  const [formData, setFormData] = useState(npc);
  const [activeTab, setActiveTab] = useState('identity');
  const { confirm } = useConfirmDialog();

  // Tracks the last `npc` prop we've reconciled against, so incoming prop
  // updates can be merged field-by-field instead of overwriting formData wholesale.
  const prevNpcRef = useRef(npc);

  // Reset to first tab when the entity changes
  useEffect(() => {
    setActiveTab('identity');
  }, [npc.id]);

  useEffect(() => {
    const prevNpc = prevNpcRef.current;
    if (prevNpc !== npc) {
      setFormData(prev => reconcileEntityFormData(prev, prevNpc, npc));
    }
    prevNpcRef.current = npc;
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

  const handleDelete = async () => {
    const confirmed = await confirm('Delete NPC', `Are you sure you want to delete ${npc.name}? This action cannot be undone.`, { variant: 'danger' });
    if (confirmed) {
      onDelete(npc.id);
    }
  }

  // Store writes are debounced per field and keyed to the entity id by
  // useDebouncedFieldCommit, which flushes pending edits when the edited
  // entity changes under this same mounted editor or on unmount, so text
  // typed inside the debounce window is committed to the entity it was
  // typed against (finding #70).
  const { commit: commitMentionField } = useDebouncedFieldCommit<NPC>(npc.id, onUpdate);
  const handleMentionFieldChange = (field: keyof NPC) => (value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    commitMentionField(field, value);
  };

  // --- @-mention tracking across all MentionInput fields ---
  // Candidates already known to be mentioned (from a prior session), used both to
  // hydrate MentionInput's internal map and to seed each field's initial ID set.
  const mentionCandidates = useMemo(
    () => resolveMentionCandidates(campaignProp, npc.mentionedEntityIds),
    [campaignProp, npc.mentionedEntityIds],
  );
  // Per-field mention ID sets. Kept in a ref, not state — nothing renders off
  // of this value directly, it exists purely so handleMentionedIdsChange can
  // compute the merged set without writing to the store from inside a
  // setState updater (React invokes functional updaters during the render
  // phase, and StrictMode intentionally double-invokes them — doing the
  // store write there fired it twice).
  const mentionedIdsByFieldRef = useRef<Record<string, string[]>>({
    description: findMentionedIdsInText(npc.description, mentionCandidates),
    traits: findMentionedIdsInText(npc.traits, mentionCandidates),
    motivations: findMentionedIdsInText(npc.motivations, mentionCandidates),
    secrets: findMentionedIdsInText(npc.secrets, mentionCandidates),
    backstory: findMentionedIdsInText(npc.backstory, mentionCandidates),
  });
  // Last merged id set actually written to the store. MentionInput reports
  // its field's id set on every keystroke even when that set hasn't changed,
  // so without this the store (and every useSyncExternalStore subscriber)
  // would still churn once per character (finding #70).
  const lastMergedIdsKeyRef = useRef<string>(
    Array.from(new Set(Object.values(mentionedIdsByFieldRef.current).flat())).sort().join('\u0000'),
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
      description: findMentionedIdsInText(npc.description, mentionCandidates),
      traits: findMentionedIdsInText(npc.traits, mentionCandidates),
      motivations: findMentionedIdsInText(npc.motivations, mentionCandidates),
      secrets: findMentionedIdsInText(npc.secrets, mentionCandidates),
      backstory: findMentionedIdsInText(npc.backstory, mentionCandidates),
    };
    lastMergedIdsKeyRef.current =
      Array.from(new Set(Object.values(mentionedIdsByFieldRef.current).flat())).sort().join(String.fromCharCode(0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [npc.id]);
  // Reports the merged set of mentioned IDs (across every mention field) whenever any field changes.
  const handleMentionedIdsChange = (field: string) => (ids: string[]) => {
    const next = { ...mentionedIdsByFieldRef.current, [field]: ids };
    mentionedIdsByFieldRef.current = next;
    const merged = Array.from(new Set(Object.values(next).flat()));
    const mergedKey = merged.slice().sort().join('\u0000');
    if (mergedKey === lastMergedIdsKeyRef.current) return;
    lastMergedIdsKeyRef.current = mergedKey;
    setFormData(fd => ({ ...fd, mentionedEntityIds: merged }));
    onUpdate(npc.id, { mentionedEntityIds: merged });
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
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar animate-fade-in">
      <header className="flex justify-between items-start mb-6">
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

      <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800/50">
        <TabLayout tabs={NPC_TABS} activeTab={activeTab} onTabChange={setActiveTab}>

          {/* Identity Tab */}
          {activeTab === 'identity' && (
            <div className="space-y-6">
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
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center">
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Description</label>
                    <RegenerateButton fieldName="description" currentValue={formData.description} entityType="NPC" entityContext={npcEntityContext} onRegenerate={handleFieldRegenerate('description')} isMockMode={isMockMode} campaignContext={campaignContext} />
                  </div>
                </div>
                <MentionInput
                  value={formData.description}
                  onChange={handleMentionFieldChange('description')}
                  onMentionedIdsChange={handleMentionedIdsChange('description')}
                  initialMentions={mentionCandidates}
                  rows={4}
                  placeholder="Physical appearance, typical attire, mannerisms... (type @ to mention entities)"
                />
              </div>
              {formData.description && onNavigate && (
                  <p className="text-sm text-slate-300 leading-relaxed mt-1 px-1">
                      <LinkedText text={formData.description} onNavigate={onNavigate} />
                  </p>
              )}

              {/* Traits */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center">
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Personality Traits</label>
                    <RegenerateButton fieldName="traits" currentValue={formData.traits} entityType="NPC" entityContext={npcEntityContext} onRegenerate={handleFieldRegenerate('traits')} isMockMode={isMockMode} campaignContext={campaignContext} />
                  </div>
                </div>
                <MentionInput
                  value={formData.traits}
                  onChange={handleMentionFieldChange('traits')}
                  onMentionedIdsChange={handleMentionedIdsChange('traits')}
                  initialMentions={mentionCandidates}
                  rows={2}
                  placeholder="e.g., 'Taps fingers when impatient, speaks in riddles.' (type @ to mention entities)"
                />
              </div>
            </div>
          )}

          {/* Personality Tab */}
          {activeTab === 'personality' && (
            <div className="space-y-6">
              {/* Motivations */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center">
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Motivations</label>
                    <RegenerateButton fieldName="motivations" currentValue={formData.motivations} entityType="NPC" entityContext={npcEntityContext} onRegenerate={handleFieldRegenerate('motivations')} isMockMode={isMockMode} campaignContext={campaignContext} />
                  </div>
                </div>
                <MentionInput
                  value={formData.motivations}
                  onChange={handleMentionFieldChange('motivations')}
                  onMentionedIdsChange={handleMentionedIdsChange('motivations')}
                  initialMentions={mentionCandidates}
                  rows={2}
                  placeholder="What drives this character? (type @ to mention entities)"
                />
              </div>
              {formData.motivations && onNavigate && (
                  <p className="text-sm text-slate-300 leading-relaxed mt-1 px-1">
                      <LinkedText text={formData.motivations} onNavigate={onNavigate} />
                  </p>
              )}

              {/* Secrets */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center">
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Secrets</label>
                    <RegenerateButton fieldName="secrets" currentValue={formData.secrets} entityType="NPC" entityContext={npcEntityContext} onRegenerate={handleFieldRegenerate('secrets')} isMockMode={isMockMode} campaignContext={campaignContext} />
                  </div>
                </div>
                <MentionInput
                  value={formData.secrets}
                  onChange={handleMentionFieldChange('secrets')}
                  onMentionedIdsChange={handleMentionedIdsChange('secrets')}
                  initialMentions={mentionCandidates}
                  rows={3}
                  placeholder="What are they hiding? What important information do they know? (type @ to mention entities)"
                />
              </div>
              {formData.secrets && onNavigate && (
                  <p className="text-sm text-slate-300 leading-relaxed mt-1 px-1">
                      <LinkedText text={formData.secrets} onNavigate={onNavigate} />
                  </p>
              )}

              {/* Example Quote */}
              <AiTextarea
                label="Example Quote"
                name="exampleQuote"
                value={formData.exampleQuote}
                onChange={handleChange}
                onBlur={handleBlur}
                rows={2}
                placeholder="A memorable line of dialogue that captures their personality."
                regenerateButton={<RegenerateButton fieldName="exampleQuote" currentValue={formData.exampleQuote} entityType="NPC" entityContext={npcEntityContext} onRegenerate={handleFieldRegenerate('exampleQuote')} isMockMode={isMockMode} campaignContext={campaignContext} />}
              />

              {/* Voice (Wave 2 / P3) — how they sound, next to what they say.
                  `AiTextarea`'s <label> isn't linked via htmlFor/id, so an explicit
                  aria-label is required for an accessible name of "Voice". */}
              <AiTextarea
                label="Voice"
                name="voiceNotes"
                aria-label="Voice"
                value={formData.voiceNotes ?? ''}
                onChange={handleChange}
                onBlur={handleBlur}
                rows={2}
                placeholder="How do they sound? Accent, cadence, verbal tics, a phrase they always fall back on — the details that keep their voice the same session to session."
              />

              {/* Backstory */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center">
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Backstory</label>
                    <RegenerateButton fieldName="backstory" currentValue={formData.backstory} entityType="NPC" entityContext={npcEntityContext} onRegenerate={handleFieldRegenerate('backstory')} isMockMode={isMockMode} campaignContext={campaignContext} />
                  </div>
                </div>
                <MentionInput
                  value={formData.backstory}
                  onChange={handleMentionFieldChange('backstory')}
                  onMentionedIdsChange={handleMentionedIdsChange('backstory')}
                  initialMentions={mentionCandidates}
                  rows={5}
                  placeholder="The character's history and background... (type @ to mention entities)"
                />
              </div>
            </div>
          )}

          {/* Stats & Combat Tab */}
          {activeTab === 'stats' && (
            <div className="space-y-6">
              <AiTextarea
                label="Stats / Game Info"
                name="stats"
                value={formData.stats}
                onChange={handleChange}
                onBlur={handleBlur}
                rows={6}
                placeholder="e.g., 'Veteran warrior (use Knight stat block)' or 'Skilled archer, but clumsy.'"
                regenerateButton={<RegenerateButton fieldName="stats" currentValue={formData.stats} entityType="NPC" entityContext={npcEntityContext} onRegenerate={handleFieldRegenerate('stats')} isMockMode={isMockMode} campaignContext={campaignContext} />}
              />
            </div>
          )}

          {/* Connections Tab */}
          {activeTab === 'connections' && (
            <div className="space-y-6">
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
                              <Button variant="icon" onClick={() => handleDeleteRelationship(index)} className="text-slate-500 hover:text-red-400" aria-label="Delete relationship">
                                  <Icons.Trash className="w-4 h-4" />
                              </Button>
                          </div>
                      ))}
                      {(!formData.relationships || formData.relationships.length === 0) && (
                          <p className="text-xs text-slate-500 italic px-2 py-1">No relationships defined.</p>
                      )}
                  </div>
              </div>

              {/* History Manager */}
              {campaignProp && (
                <EntityHistoryManager
                    subjectId={npc.id}
                    subjectType="npc"
                    campaign={campaignProp}
                    onUpdateEntity={(type, id, changes) => {
                        if (type === 'npc') campaignService.updateNpc(id, changes);
                        if (type === 'location') campaignService.updateLocation(id, changes);
                    }}
                />
              )}

              {/* Backlinks Panel */}
              <BacklinksPanel entityId={npc.id} entityType="npc" onNavigate={onNavigate} />
            </div>
          )}

        </TabLayout>
      </div>
    </div>
  );
};
