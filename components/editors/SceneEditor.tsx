
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
import { useDebouncedFieldCommit } from '../../hooks/useDebouncedFieldCommit';

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
  const [npcGenerationError, setNpcGenerationError] = useState<string | null>(null);
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<Set<string>>(new Set());
  const { confirm } = useConfirmDialog();

  // Mirrors formData.npcIds so async handlers (e.g. NPC generation, which spans
  // an await) can read the CURRENT npcIds without a store write inside a
  // setFormData updater — React (and StrictMode double-invocation) requires
  // updaters to be pure, so `onUpdate` must never be called from inside one.
  const npcIdsRef = useRef(formData.npcIds);
  useEffect(() => {
    npcIdsRef.current = formData.npcIds;
  }, [formData.npcIds]);

  // Tracks the last `scene` prop we've reconciled against, so incoming prop
  // updates can be merged field-by-field instead of overwriting formData wholesale.
  const prevSceneRef = useRef(scene);

  // Reset to first tab and clear dismissed suggestions / stale errors when
  // the entity changes (this editor is not remounted per entity)
  useEffect(() => {
    setActiveTab('narrative');
    setDismissedSuggestionIds(new Set());
    setNpcGenerationError(null);
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

  // Store writes are debounced per field and keyed to the entity id by
  // useDebouncedFieldCommit, which flushes pending edits when the edited
  // entity changes under this same mounted editor or on unmount, so text
  // typed inside the debounce window is committed to the entity it was
  // typed against (finding #70).
  const { commit: commitMentionField } = useDebouncedFieldCommit<Scene>(scene.id, onUpdate);
  // Used by MentionInput fields (onChange receives string, not event)
  const handleMentionFieldChange = (field: keyof Scene) => (value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    commitMentionField(field, value);
  };

  // --- @-mention tracking across all MentionInput fields ---
  // Candidates already known to be mentioned (from a prior session), used both to
  // hydrate MentionInput's internal map and to seed each field's initial ID set.
  const mentionCandidates = useMemo(
    () => resolveMentionCandidates(campaign, scene.mentionedEntityIds),
    [campaign, scene.mentionedEntityIds],
  );
  // Per-field mention ID sets. Kept in a ref, not state — nothing renders off
  // of this value directly, it exists purely so handleMentionedIdsChange can
  // compute the merged set without writing to the store from inside a
  // setState updater (React invokes functional updaters during the render
  // phase, and StrictMode intentionally double-invokes them — doing the
  // store write there fired it twice).
  const mentionedIdsByFieldRef = useRef<Record<string, string[]>>({
    readAloudText: findMentionedIdsInText(scene.readAloudText, mentionCandidates),
    gmNotes: findMentionedIdsInText(scene.gmNotes, mentionCandidates),
  });
  // Last merged id set actually written to the store. MentionInput reports
  // its field's id set on every keystroke even when that set hasn't changed,
  // so without this the store (and every useSyncExternalStore subscriber)
  // would still churn once per character (finding #70).
  const lastMergedIdsKeyRef = useRef<string>(
    Array.from(new Set(Object.values(mentionedIdsByFieldRef.current).flat())).sort().join(String.fromCharCode(0)),
  );
  // Both refs above are initialised on first mount only, but this editor is
  // reused across scene switches — rebuild them from the incoming scene so the
  // previous scene's per-field sets can neither be merged into the next
  // scene's writes nor suppress its legitimate first write.
  useEffect(() => {
    mentionedIdsByFieldRef.current = {
      readAloudText: findMentionedIdsInText(scene.readAloudText, mentionCandidates),
      gmNotes: findMentionedIdsInText(scene.gmNotes, mentionCandidates),
    };
    lastMergedIdsKeyRef.current = Array.from(new Set(Object.values(mentionedIdsByFieldRef.current).flat())).sort().join(String.fromCharCode(0));
    // keyed on the id ONLY — resetting on every mentionCandidates recompute would
    // discard in-session tracked mentions (same rationale as MentionInput's seedKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);
  // Reports the merged set of mentioned IDs (across every mention field) whenever any field changes.
  const handleMentionedIdsChange = (field: string) => (ids: string[]) => {
    const next = { ...mentionedIdsByFieldRef.current, [field]: ids };
    mentionedIdsByFieldRef.current = next;
    const merged = Array.from(new Set(Object.values(next).flat()));
    const mergedKey = merged.slice().sort().join(String.fromCharCode(0));
    if (mergedKey === lastMergedIdsKeyRef.current) return;
    lastMergedIdsKeyRef.current = mergedKey;
    setFormData(fd => ({ ...fd, mentionedEntityIds: merged }));
    onUpdate(scene.id, { mentionedEntityIds: merged });
  };

  const handleFieldRegenerate = (field: 'readAloudText' | 'gmNotes' | 'rewards') => (newValue: string) => {
    setFormData(prev => ({ ...prev, [field]: newValue }));
    onUpdate(scene.id, { [field]: newValue });
  };

  const sceneEntityContext = `Scene Title: ${formData.title}\nScene Type: ${formData.type}\nRead-Aloud Text: ${formData.readAloudText || 'Not specified'}\nGM Notes: ${formData.gmNotes || 'Not specified'}`;

  // Stable candidate arrays for the linking panels below. These are useMemo
  // deps (LinkSuggestionsPanel.tsx) for its matching-engine memo — building
  // fresh array literals inline on every render defeats that memo entirely,
  // so `findMatches` would re-run on every keystroke (finding #50).
  const npcCandidates = useMemo<EntityCandidate[]>(
    () => allNpcs.map((n): EntityCandidate => ({ id: n.id, name: n.name, type: 'npc' })),
    [allNpcs],
  );
  const locationCandidates = useMemo<EntityCandidate[]>(
    () => allLocations.map((l): EntityCandidate => ({ id: l.id, name: l.name, type: 'location' })),
    [allLocations],
  );
  const allLinkCandidates = useMemo<EntityCandidate[]>(
    () => [...npcCandidates, ...locationCandidates],
    [npcCandidates, locationCandidates],
  );

  // ── Generate NPC for Scene ─────────────────────────────────────────────────
  const sceneLocation = allLocations.find(l => l.id === scene.locationId);
  const npcGenerationDefaultPrompt = sceneLocation
    ? `Generate an NPC for the scene "${scene.title}" (${scene.type}) set in "${sceneLocation.name}". The NPC should fit naturally into this ${scene.type} encounter.`
    : `Generate an NPC for the scene "${scene.title}" (${scene.type}). The NPC should fit naturally into this ${scene.type} encounter.`;

  const handleGenerateNpcForScene = async (prompt: string) => {
    setIsGeneratingNpc(true);
    setNpcGenerationError(null);
    try {
      const npcData = await generateNpc(prompt, isMockMode, campaignContext);
      const newNpcId = campaignService.createNpc({ ...npcData, factionId: undefined, relationships: [], history: [] });
      // Derive the payload from the CURRENT npcIds via the ref (kept in sync by
      // the effect above), not the `formData` captured in this closure at click
      // time — generation takes seconds and the NPC checkbox list stays
      // interactive, so any NPC ticked while this was in flight must not be
      // dropped. `onUpdate` is called here, outside the setFormData updater, so
      // the updater itself stays a pure function of `prev` (safe under
      // StrictMode's double-invocation of updaters).
      const next = [...npcIdsRef.current, newNpcId];
      npcIdsRef.current = next;
      setFormData(prev => ({ ...prev, npcIds: next }));
      onUpdate(scene.id, { npcIds: next });
    } catch (error) {
      console.error('Failed to generate NPC for scene:', error);
      setNpcGenerationError('Failed to generate NPC. Please try again.');
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
                allNpcs={npcCandidates}
                allLocations={locationCandidates}
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
                allCandidates={allLinkCandidates}
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
                {npcGenerationError && (
                  <p role="alert" className="text-xs text-red-400 mb-1.5">{npcGenerationError}</p>
                )}
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
