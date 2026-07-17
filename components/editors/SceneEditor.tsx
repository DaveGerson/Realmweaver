
import React, { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { reconcileEntityFormData } from '../../utils/formReconciliation';
import type { Scene, SceneType, NPC, Location, SkillCheck } from '../../types/index';
import type { Campaign } from '../../types/index';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { AiTextarea } from '../common/Textarea';
import { MentionInput, resolveMentionCandidates, findMentionedIdsInText } from '../common/MentionInput';
import { generateNpc } from '../../services/aiService';
import { GenerateHerePanel } from '../common/GenerateHerePanel';
import { RegenerateButton } from '../common/RegenerateButton';
import { EntityLink } from '../common/EntityLink';
import { LinkedText } from '../common/LinkedText';
import { campaignService } from '../../services/campaignService';
import { TabLayout } from '../common/TabLayout';
import type { TabDefinition } from '../common/TabLayout';
import type { QuickCardEntityType } from '../common/EntityQuickCard';
import { SceneResourcesPanel } from '../common/SceneResourcesPanel';
import { SceneSmartLinkBar } from '../common/SceneSmartLinkBar';
import { LinkSuggestionsPanel } from '../common/LinkSuggestionsPanel';
import type { EntityCandidate } from '../../services/linking/matchingEngine';

// ─── Save Status Indicator ────────────────────────────────────────────────────

const SaveStatusIndicator: React.FC = () => {
  const { saveStatus } = useSyncExternalStore(
    campaignService.subscribe,
    campaignService.getState,
  );
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (saveStatus === 'saved') {
      setShowSaved(true);
      const t = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [saveStatus]);

  if (saveStatus === 'saving') {
    return (
      <span className="flex items-center gap-1 text-xs text-slate-400">
        <Icons.Loader className="w-3 h-3 animate-spin" />
        Saving…
      </span>
    );
  }
  if (saveStatus === 'error') {
    return <span className="text-xs text-red-400">Save error</span>;
  }
  if (showSaved) {
    return <span className="text-xs text-slate-400 transition-opacity duration-500">Saved</span>;
  }
  return null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const sceneTypeOptions: SceneType[] = ['combat', 'social', 'exploration', 'puzzle'];

const SCENE_TABS: TabDefinition[] = [
  { id: 'narrative',    label: 'Narrative',    icon: Icons.Scenes },
  { id: 'mechanics',   label: 'Mechanics',    icon: Icons.Combat },
  { id: 'connections', label: 'Connections',  icon: Icons.Link },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface SceneEditorProps {
  scene: Scene;
  allNpcs: NPC[];
  allLocations: Location[];
  campaign?: Campaign;
  onUpdate: (id: string, updatedData: Partial<Scene>) => void;
  onDelete: (id: string) => void;
  isMockMode: boolean;
  campaignContext?: string;
  isActiveScene?: boolean;
  onSetActive?: (id: string | null) => void;
  onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
}

// ─── Editor ───────────────────────────────────────────────────────────────────

export const SceneEditor: React.FC<SceneEditorProps> = ({
  scene,
  allNpcs,
  allLocations,
  campaign,
  onUpdate,
  onDelete,
  isMockMode,
  campaignContext,
  isActiveScene,
  onSetActive,
  onNavigate,
}) => {
  const [formData, setFormData] = useState(scene);
  const [activeTab, setActiveTab] = useState('narrative');
  const [isGeneratingNpc, setIsGeneratingNpc] = useState(false);
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<Set<string>>(new Set());
  const { confirm } = useConfirmDialog();

  // Tracks the last `scene` prop we've reconciled against, so incoming prop
  // updates can be merged field-by-field instead of overwriting formData wholesale.
  const prevSceneRef = useRef(scene);

  // Reset to first tab and clear dismissed suggestions when entity changes
  useEffect(() => {
    setActiveTab('narrative');
    setDismissedSuggestionIds(new Set());
  }, [scene.id]);

  useEffect(() => {
    const prevScene = prevSceneRef.current;
    if (prevScene !== scene) {
      setFormData(prev => reconcileEntityFormData(prev, prevScene, scene));
    }
    prevSceneRef.current = scene;
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
    const finalValue = value === 'none' ? undefined : value;
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

  const handleDelete = async () => {
    const confirmed = await confirm('Delete Scene', `Are you sure you want to delete the scene "${scene.title}"? This action cannot be undone.`, { variant: 'danger' });
    if (confirmed) {
      onDelete(scene.id);
    }
  };

  // Used by MentionInput fields (onChange receives string, not event)
  const handleMentionFieldChange = (field: keyof Scene) => (value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    onUpdate(scene.id, { [field]: value });
  };

  // --- @-mention tracking across all MentionInput fields ---
  // Candidates already known to be mentioned (from a prior session), used both to
  // hydrate MentionInput's internal map and to seed each field's initial ID set.
  const mentionCandidates = useMemo(
    () => resolveMentionCandidates(campaign, scene.mentionedEntityIds),
    [campaign, scene.mentionedEntityIds],
  );
  const [mentionedIdsByField, setMentionedIdsByField] = useState<Record<string, string[]>>(() => ({
    readAloudText: findMentionedIdsInText(scene.readAloudText, mentionCandidates),
    gmNotes: findMentionedIdsInText(scene.gmNotes, mentionCandidates),
  }));
  // Reports the merged set of mentioned IDs (across every mention field) whenever any field changes.
  const handleMentionedIdsChange = (field: string) => (ids: string[]) => {
    setMentionedIdsByField(prev => {
      const next = { ...prev, [field]: ids };
      const merged = Array.from(new Set(Object.values(next).flat()));
      setFormData(fd => ({ ...fd, mentionedEntityIds: merged }));
      onUpdate(scene.id, { mentionedEntityIds: merged });
      return next;
    });
  };

  const handleFieldRegenerate = (field: 'readAloudText' | 'gmNotes' | 'rewards') => (newValue: string) => {
    setFormData(prev => ({ ...prev, [field]: newValue }));
    onUpdate(scene.id, { [field]: newValue });
  };

  const sceneEntityContext = `Scene Title: ${formData.title}\nScene Type: ${formData.type}\nRead-Aloud Text: ${formData.readAloudText || 'Not specified'}\nGM Notes: ${formData.gmNotes || 'Not specified'}`;

  // ── Generate NPC for Scene ─────────────────────────────────────────────────
  const sceneLocation = allLocations.find(l => l.id === scene.locationId);
  const npcGenerationDefaultPrompt = sceneLocation
    ? `Generate an NPC for the scene "${scene.title}" (${scene.type}) set in "${sceneLocation.name}". The NPC should fit naturally into this ${scene.type} encounter.`
    : `Generate an NPC for the scene "${scene.title}" (${scene.type}). The NPC should fit naturally into this ${scene.type} encounter.`;

  const handleGenerateNpcForScene = async (prompt: string) => {
    setIsGeneratingNpc(true);
    try {
      const npcData = await generateNpc(prompt, isMockMode, campaignContext);
      const newNpcId = campaignService.createNpc({ ...npcData, factionId: undefined, relationships: [], history: [] });
      const newNpcIds = [...formData.npcIds, newNpcId];
      setFormData(prev => ({ ...prev, npcIds: newNpcIds }));
      onUpdate(scene.id, { npcIds: newNpcIds });
    } catch (error) {
      console.error('Failed to generate NPC for scene:', error);
    } finally {
      setIsGeneratingNpc(false);
    }
  };

  // ── Skill Check Handlers ───────────────────────────────────────────────────
  const handleSkillCheckChange = (id: string, field: keyof Omit<SkillCheck, 'id'>, value: string | number) => {
    const newSkillChecks = formData.skillChecks.map(sc => sc.id === id ? { ...sc, [field]: value } : sc);
    setFormData(prev => ({ ...prev, skillChecks: newSkillChecks }));
  };

  const handleSkillCheckBlur = () => {
    onUpdate(scene.id, { skillChecks: formData.skillChecks });
  };

  const handleAddSkillCheck = () => {
    const newSkillCheck: SkillCheck = { id: crypto.randomUUID(), skill: 'Perception', dc: 10, description: '' };
    const newSkillChecks = [...formData.skillChecks, newSkillCheck];
    setFormData(prev => ({ ...prev, skillChecks: newSkillChecks }));
    onUpdate(scene.id, { skillChecks: newSkillChecks });
  };

  const handleDeleteSkillCheck = (id: string) => {
    const newSkillChecks = formData.skillChecks.filter(sc => sc.id !== id);
    setFormData(prev => ({ ...prev, skillChecks: newSkillChecks }));
    onUpdate(scene.id, { skillChecks: newSkillChecks });
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar animate-fade-in">
      <header className="flex justify-between items-start mb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3 text-amber-400">
            <Icons.Scenes className="w-8 h-8" />
            <h1 className="text-3xl font-bold font-serif text-slate-100">Scene Editor</h1>
          </div>
          <SaveStatusIndicator />
        </div>
        <div className="flex gap-3">
          {onSetActive && (
            <Button
              variant={isActiveScene ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => onSetActive(isActiveScene ? null : scene.id)}
              className={isActiveScene ? 'ring-2 ring-offset-2 ring-offset-slate-900 ring-amber-500' : ''}
            >
              {isActiveScene ? (
                <>
                  <Icons.Sparkles className="w-4 h-4 mr-2 animate-pulse" />
                  Active Session Scene
                </>
              ) : 'Start Session Here'}
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={handleDelete}>
            <Icons.Trash className="w-3.5 h-3.5 mr-2" />
            Delete Scene
          </Button>
        </div>
      </header>

      <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800/50">
        <TabLayout tabs={SCENE_TABS} activeTab={activeTab} onTabChange={setActiveTab}>

          {/* ── Narrative Tab ─────────────────────────────────────────────── */}
          {activeTab === 'narrative' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Scene Title</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all placeholder:text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Type</label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleSelectChange}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all capitalize"
                  >
                    {sceneTypeOptions.map(t => (
                      <option key={t} value={t} className="capitalize">{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center">
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Read-Aloud Text</label>
                    <RegenerateButton fieldName="readAloudText" currentValue={formData.readAloudText} entityType="Scene" entityContext={sceneEntityContext} onRegenerate={handleFieldRegenerate('readAloudText')} isMockMode={isMockMode} campaignContext={campaignContext} />
                  </div>
                </div>
                <MentionInput
                  value={formData.readAloudText}
                  onChange={handleMentionFieldChange('readAloudText')}
                  onMentionedIdsChange={handleMentionedIdsChange('readAloudText')}
                  initialMentions={mentionCandidates}
                  rows={5}
                  placeholder="Evocative 'box text' to read to your players to set the scene. (type @ to mention entities)"
                />
              </div>
              {formData.readAloudText && onNavigate && (
                <p className="text-lg italic text-amber-100/90 leading-relaxed font-serif border-l-4 border-amber-700/40 pl-4 mt-1">
                  <LinkedText text={formData.readAloudText} onNavigate={onNavigate} />
                </p>
              )}

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center">
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">GM Notes</label>
                    <RegenerateButton fieldName="gmNotes" currentValue={formData.gmNotes} entityType="Scene" entityContext={sceneEntityContext} onRegenerate={handleFieldRegenerate('gmNotes')} isMockMode={isMockMode} campaignContext={campaignContext} />
                  </div>
                </div>
                <MentionInput
                  value={formData.gmNotes}
                  onChange={handleMentionFieldChange('gmNotes')}
                  onMentionedIdsChange={handleMentionedIdsChange('gmNotes')}
                  initialMentions={mentionCandidates}
                  rows={8}
                  placeholder="GM-only notes: scene goals, character motivations, potential outcomes, hidden details... (type @ to mention entities)"
                />
              </div>

            </div>
          )}

          {/* ── Mechanics Tab ─────────────────────────────────────────────── */}
          {activeTab === 'mechanics' && (
            <div className="space-y-6">
              {/* Skill Checks */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-sm font-medium text-slate-400">Skill Checks</label>
                  <Button size="sm" variant="ghost" onClick={handleAddSkillCheck}>
                    <Icons.Plus className="w-3 h-3 mr-1.5" /> Add Check
                  </Button>
                </div>
                <div className="space-y-2">
                  {formData.skillChecks?.map(sc => (
                    <div key={sc.id} className="grid grid-cols-12 gap-2 items-center bg-slate-950/50 p-2 rounded-md">
                      <input
                        type="text"
                        placeholder="Skill"
                        value={sc.skill}
                        onChange={(e) => handleSkillCheckChange(sc.id, 'skill', e.target.value)}
                        onBlur={handleSkillCheckBlur}
                        className="col-span-3 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <div className="col-span-2 flex items-center">
                        <span className="text-slate-500 text-sm mr-2">DC</span>
                        <input
                          type="number"
                          value={sc.dc}
                          onChange={(e) => handleSkillCheckChange(sc.id, 'dc', parseInt(e.target.value, 10) || 0)}
                          onBlur={handleSkillCheckBlur}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Description of the check"
                        value={sc.description}
                        onChange={(e) => handleSkillCheckChange(sc.id, 'description', e.target.value)}
                        onBlur={handleSkillCheckBlur}
                        className="col-span-6 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <div className="col-span-1 text-right">
                        <Button variant="icon" onClick={() => handleDeleteSkillCheck(sc.id)} className="text-slate-500 hover:text-red-400" aria-label="Delete skill check">
                          <Icons.Trash className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(!formData.skillChecks || formData.skillChecks.length === 0) && (
                    <p className="text-xs text-slate-500 italic px-2">No skill checks defined for this scene.</p>
                  )}
                </div>
              </div>

              {/* Rewards */}
              <AiTextarea
                label="Rewards"
                name="rewards"
                value={formData.rewards}
                onChange={handleChange}
                onBlur={handleBlur}
                rows={3}
                placeholder="Loot, treasure, gold, experience points, or other rewards."
                regenerateButton={<RegenerateButton fieldName="rewards" currentValue={formData.rewards} entityType="Scene" entityContext={sceneEntityContext} onRegenerate={handleFieldRegenerate('rewards')} isMockMode={isMockMode} campaignContext={campaignContext} />}
              />
            </div>
          )}

          {/* ── Connections Tab ───────────────────────────────────────────── */}
          {activeTab === 'connections' && (
            <div className="space-y-6">
              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Location</label>
                <select
                  name="locationId"
                  value={formData.locationId || 'none'}
                  onChange={handleSelectChange}
                  className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all"
                >
                  <option value="none">-- None --</option>
                  {allLocations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
                {formData.locationId && onNavigate && (
                  <div className="mt-1.5">
                    <EntityLink
                      entityType="location"
                      entityId={formData.locationId}
                      label={allLocations.find(l => l.id === formData.locationId)?.name}
                      onNavigate={onNavigate}
                    />
                  </div>
                )}
              </div>

              {/* Smart Link Bar — detects unlinked entity mentions in scene text */}
              <SceneSmartLinkBar
                readAloudText={formData.readAloudText}
                gmNotes={formData.gmNotes}
                currentNpcIds={formData.npcIds}
                currentLocationId={formData.locationId ?? null}
                allNpcs={allNpcs.map((n): EntityCandidate => ({ id: n.id, name: n.name, type: 'npc' }))}
                allLocations={allLocations.map((l): EntityCandidate => ({ id: l.id, name: l.name, type: 'location' }))}
                onAddNpc={handleNpcToggle}
                onSetLocation={(locationId) => {
                  setFormData(prev => ({ ...prev, locationId }));
                  onUpdate(scene.id, { locationId });
                }}
              />

              {/* Link Suggestions Panel — broader entity suggestions with user review */}
              <LinkSuggestionsPanel
                textFields={[formData.readAloudText, formData.gmNotes]}
                linkedNpcIds={formData.npcIds}
                linkedLocationId={formData.locationId ?? null}
                allCandidates={[
                  ...allNpcs.map((n): EntityCandidate => ({ id: n.id, name: n.name, type: 'npc' })),
                  ...allLocations.map((l): EntityCandidate => ({ id: l.id, name: l.name, type: 'location' })),
                ]}
                onAccept={(entityId, action) => {
                  const npcMatch = allNpcs.find(n => n.id === entityId);
                  if (npcMatch) {
                    handleNpcToggle(entityId);
                    return;
                  }
                  const locationMatch = allLocations.find(l => l.id === entityId);
                  if (locationMatch) {
                    setFormData(prev => ({ ...prev, locationId: entityId }));
                    onUpdate(scene.id, { locationId: entityId });
                    return;
                  }
                  // Generic fallback: log unhandled action for future entity types
                  console.warn('[LinkSuggestionsPanel] Unhandled accept action:', action, entityId);
                }}
                onDismiss={(entityId) => {
                  setDismissedSuggestionIds(prev => new Set([...prev, entityId]));
                }}
                onNavigate={onNavigate}
                dismissedIds={dismissedSuggestionIds}
              />

              {/* NPCs Involved */}
              <div>
                <div className="flex flex-wrap justify-between items-center gap-2 mb-1.5">
                  <label className="block text-sm font-medium text-slate-400">NPCs Involved</label>
                  <GenerateHerePanel
                    buttonLabel="Generate NPC for this scene"
                    defaultPrompt={npcGenerationDefaultPrompt}
                    isGenerating={isGeneratingNpc}
                    onGenerate={handleGenerateNpcForScene}
                  />
                </div>
                <div className="max-h-60 overflow-y-auto bg-slate-950 border border-slate-800 rounded-md p-3 space-y-2 custom-scrollbar">
                  {allNpcs.length > 0 ? allNpcs.map(npc => (
                    <label key={npc.id} className="flex items-center text-sm text-slate-300 select-none p-1 rounded-md hover:bg-slate-800/50 transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.npcIds.includes(npc.id)}
                        onChange={() => handleNpcToggle(npc.id)}
                        className="w-4 h-4 mr-3 bg-slate-800 border-slate-600 rounded text-amber-600 focus:ring-amber-500 flex-shrink-0"
                      />
                      {formData.npcIds.includes(npc.id) && onNavigate ? (
                        <EntityLink
                          entityType="npc"
                          entityId={npc.id}
                          label={npc.name}
                          onNavigate={onNavigate}
                        />
                      ) : npc.name}
                    </label>
                  )) : <p className="text-xs text-slate-500 italic">No NPCs exist in this campaign yet.</p>}
                </div>
              </div>

              {/* Scene Resources Panel */}
              {campaign && (
                <SceneResourcesPanel
                  npcIds={formData.npcIds}
                  locationId={formData.locationId}
                  campaign={campaign}
                  onNavigate={onNavigate}
                />
              )}
            </div>
          )}

        </TabLayout>
      </div>
    </div>
  );
};
