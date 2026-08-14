
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { reconcileEntityFormData } from '../../utils/formReconciliation';
import type { Location, LocationConnection, PointOfInterest, PoiInteraction, LootItem, Faction, SessionLog, Article, Campaign } from '../../types/index';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { textareaBaseClasses } from '../common/Textarea';
import { MentionInput, resolveMentionCandidates, findMentionedIdsInText } from '../common/MentionInput';
import { generatePoiFromLoot, generateNpc } from '../../services/aiService';
import { EntityHistoryManager } from '../common/EntityHistoryManager';
import { RegenerateButton } from '../common/RegenerateButton';
import { EntityLink } from '../common/EntityLink';
import { LinkedText } from '../common/LinkedText';
import { campaignService } from '../../services/campaignService';
import { GenerateHerePanel } from '../common/GenerateHerePanel';
import type { QuickCardEntityType } from '../common/EntityQuickCard';
import { BacklinksPanel } from '../common/BacklinksPanel';
import { TabLayout } from '../common/TabLayout';
import type { TabDefinition } from '../common/TabLayout';

interface LocationEditorProps {
  location: Location;
  allLocations: Location[];
  allFactions?: Faction[];
  sessionLogs?: SessionLog[];
  articles?: Article[];
  campaign?: Campaign;
  onUpdate: (id: string, updatedData: Partial<Location>) => void;
  onDelete: (id: string) => void;
  isMockMode: boolean;
  campaignContext?: string;
  onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
}

const LOCATION_TABS: TabDefinition[] = [
  { id: 'overview',     label: 'Overview',     icon: Icons.Locations },
  { id: 'details',      label: 'Details',      icon: Icons.Puzzle },
  { id: 'connections',  label: 'Connections',  icon: Icons.Link },
  { id: 'history',      label: 'History',      icon: Icons.Clock },
];

export const LocationEditor: React.FC<LocationEditorProps> = ({ location, allLocations, allFactions = [], campaign, onUpdate, onDelete, isMockMode, campaignContext, onNavigate }) => {
  const [formData, setFormData] = useState(location);
  const [generatingPoiFor, setGeneratingPoiFor] = useState<string | null>(null);
  const [poiGenerationError, setPoiGenerationError] = useState<string | null>(null);
  const [isGeneratingNpc, setIsGeneratingNpc] = useState(false);
  const [npcGenerationError, setNpcGenerationError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const { confirm } = useConfirmDialog();

  // Tracks the last `location` prop we've reconciled against, so incoming prop
  // updates can be merged field-by-field instead of overwriting formData wholesale.
  const prevLocationRef = useRef(location);

  // Reset to first tab when the entity changes
  useEffect(() => {
    setActiveTab('overview');
  }, [location.id]);

  useEffect(() => {
    const prevLocation = prevLocationRef.current;
    if (prevLocation !== location) {
      setFormData(prev => reconcileEntityFormData(prev, prevLocation, location));
    }
    prevLocationRef.current = location;
  }, [location]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (formData[e.target.name as keyof Location] !== location[e.target.name as keyof Location]) {
        onUpdate(location.id, { [e.target.name]: e.target.value });
    }
  };

  const handleParentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newParentId = value === "none" ? undefined : value;
    setFormData(prev => ({ ...prev, [name]: newParentId }));
    onUpdate(location.id, { [name]: newParentId });
  };

  const handleFactionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    const newFactionId = value === "none" ? undefined : value;
    setFormData(prev => ({ ...prev, controllingFactionId: newFactionId }));
    onUpdate(location.id, { controllingFactionId: newFactionId });
  };

  // Used by MentionInput fields (onChange receives string, not event).
  // Local edits commit immediately for responsive typing, but the store write
  // (onUpdate) is debounced so unblurred keystrokes coalesce into a single
  // campaign-wide update instead of one per character.
  const mentionFieldTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Latest not-yet-committed value per field. Flushed (not discarded) on
  // unmount so text typed within the debounce window of e.g. switching
  // entities in the sidebar isn't silently lost (finding #70).
  const mentionFieldPendingRef = useRef<Record<string, string>>({});
  useEffect(() => {
    const timers = mentionFieldTimersRef.current;
    const pending = mentionFieldPendingRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
      Object.entries(pending).forEach(([field, value]) => {
        onUpdate(location.id, { [field]: value });
      });
      Object.keys(pending).forEach(field => { delete pending[field]; });
    };
    // Runs only on mount/unmount by design: onUpdate is campaignService's
    // stable singleton method reference, so capturing it here is safe and
    // guarantees the flush fires exactly once, on real unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handleMentionFieldChange = (field: keyof Location) => (value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    const timers = mentionFieldTimersRef.current;
    mentionFieldPendingRef.current[field] = value;
    if (timers[field]) clearTimeout(timers[field]);
    timers[field] = setTimeout(() => {
      delete mentionFieldPendingRef.current[field];
      onUpdate(location.id, { [field]: value });
    }, 400);
  };

  // --- @-mention tracking across all MentionInput fields ---
  // Candidates already known to be mentioned (from a prior session), used both to
  // hydrate MentionInput's internal map and to seed each field's initial ID set.
  const mentionCandidates = useMemo(
    () => resolveMentionCandidates(campaign, location.mentionedEntityIds),
    [campaign, location.mentionedEntityIds],
  );
  // Per-field mention ID sets. Kept in a ref, not state — nothing renders off
  // of this value directly, it exists purely so handleMentionedIdsChange can
  // compute the merged set without writing to the store from inside a
  // setState updater (React invokes functional updaters during the render
  // phase, and StrictMode intentionally double-invokes them — doing the
  // store write there fired it twice).
  const mentionedIdsByFieldRef = useRef<Record<string, string[]>>({
    description: findMentionedIdsInText(location.description, mentionCandidates),
    secrets: findMentionedIdsInText(location.secrets, mentionCandidates),
  });
  // Last merged id set actually written to the store. MentionInput reports
  // its field's id set on every keystroke even when that set hasn't changed,
  // so without this the store (and every useSyncExternalStore subscriber)
  // would still churn once per character (finding #70).
  const lastMergedIdsKeyRef = useRef<string>(
    Array.from(new Set(Object.values(mentionedIdsByFieldRef.current).flat())).sort().join(String.fromCharCode(0)),
  );
  // Reports the merged set of mentioned IDs (across every mention field) whenever any field changes.
  const handleMentionedIdsChange = (field: string) => (ids: string[]) => {
    const next = { ...mentionedIdsByFieldRef.current, [field]: ids };
    mentionedIdsByFieldRef.current = next;
    const merged = Array.from(new Set(Object.values(next).flat()));
    const mergedKey = merged.slice().sort().join(String.fromCharCode(0));
    if (mergedKey === lastMergedIdsKeyRef.current) return;
    lastMergedIdsKeyRef.current = mergedKey;
    setFormData(fd => ({ ...fd, mentionedEntityIds: merged }));
    onUpdate(location.id, { mentionedEntityIds: merged });
  };

  const handleFieldRegenerate = (field: 'description' | 'secrets') => (newValue: string) => {
    setFormData(prev => ({ ...prev, [field]: newValue }));
    onUpdate(location.id, { [field]: newValue });
  };

  const locationEntityContext = `Location Name: ${formData.name}\nDescription: ${formData.description || 'Not specified'}\nSecrets: ${formData.secrets || 'Not specified'}`;

  const handleDelete = async () => {
    const confirmed = await confirm('Delete Location', `Are you sure you want to delete ${location.name}? This action cannot be undone.`, { variant: 'danger' });
    if (confirmed) {
      onDelete(location.id);
    }
  };

  // --- Connection Handlers ---
  const handleAddConnection = () => {
    const newConnection: LocationConnection = { id: crypto.randomUUID(), targetLocationId: '', description: '' };
    const newConnections = [...(formData.connections || []), newConnection];
    setFormData(prev => ({ ...prev, connections: newConnections }));
    onUpdate(location.id, { connections: newConnections });
  };

  const handleConnectionChange = (id: string, field: keyof Omit<LocationConnection, 'id'>, value: string) => {
    const newConnections = (formData.connections || []).map(c => c.id === id ? { ...c, [field]: value } : c);
    setFormData(prev => ({ ...prev, connections: newConnections }));
  };

  const handleDeleteConnection = (id: string) => {
    const newConnections = (formData.connections || []).filter(c => c.id !== id);
    setFormData(prev => ({ ...prev, connections: newConnections }));
    onUpdate(location.id, { connections: newConnections });
  };

  const handleConnectionsBlur = () => {
    onUpdate(location.id, { connections: formData.connections });
  };

  // --- Point of Interest Handlers ---
  const handlePoisBlur = () => {
    onUpdate(location.id, { pointsOfInterest: formData.pointsOfInterest });
  };

  const handleAddPoi = () => {
    const newPoi: PointOfInterest = { id: crypto.randomUUID(), name: 'New Point of Interest', passivePerceptionDC: 10, description: '', investigationChecks: [], interactions: [] };
    const newPois = [...(formData.pointsOfInterest || []), newPoi];
    setFormData(prev => ({...prev, pointsOfInterest: newPois}));
    onUpdate(location.id, { pointsOfInterest: newPois });
  };

  const handleDeletePoi = (id: string) => {
    const newPois = (formData.pointsOfInterest || []).filter(p => p.id !== id);
    setFormData(prev => ({...prev, pointsOfInterest: newPois}));
    onUpdate(location.id, { pointsOfInterest: newPois });
  };

  const handlePoiChange = (id: string, field: keyof Omit<PointOfInterest, 'id' | 'interactions' | 'investigationChecks'>, value: string | number) => {
    const newPois = (formData.pointsOfInterest || []).map(p => p.id === id ? { ...p, [field]: value } : p);
    setFormData(prev => ({ ...prev, pointsOfInterest: newPois }));
  };

  const updatePoiInteractions = (poiId: string, updatedInteractions: PoiInteraction[], type: 'interactions' | 'investigationChecks') => {
      const newPois = (formData.pointsOfInterest || []).map(p => p.id === poiId ? { ...p, [type]: updatedInteractions } : p);
      setFormData(prev => ({...prev, pointsOfInterest: newPois}));
      onUpdate(location.id, { pointsOfInterest: newPois });
  };

  const handleAddPoiSubItem = (poiId: string, type: 'interactions' | 'investigationChecks') => {
    const newInteraction: PoiInteraction = { id: crypto.randomUUID(), description: '', outcome: '' };
    const poi = (formData.pointsOfInterest || []).find(p => p.id === poiId);
    if (poi) {
        const newItems = [...poi[type], newInteraction];
        updatePoiInteractions(poiId, newItems, type);
    }
  };

  const handleDeletePoiSubItem = (poiId: string, interactionId: string, type: 'interactions' | 'investigationChecks') => {
    const poi = (formData.pointsOfInterest || []).find(p => p.id === poiId);
    if (poi) {
        const newItems = poi[type].filter(i => i.id !== interactionId);
        updatePoiInteractions(poiId, newItems, type);
    }
  };

  const handlePoiSubItemChange = (poiId: string, interactionId: string, field: keyof Omit<PoiInteraction, 'id'>, value: string, type: 'interactions' | 'investigationChecks') => {
      const newPois = (formData.pointsOfInterest || []).map(p => {
        if (p.id === poiId) {
            const newInteractions = p[type].map(i => i.id === interactionId ? { ...i, [field]: value } : i);
            return { ...p, [type]: newInteractions };
        }
        return p;
      });
      setFormData(prev => ({ ...prev, pointsOfInterest: newPois }));
  };

  // --- Loot Handlers ---
  const handleAddLootItem = () => {
    const newItem: LootItem = { id: crypto.randomUUID(), description: '', pointOfInterestId: undefined };
    const newLoot = [...(formData.loot || []), newItem];
    setFormData(prev => ({ ...prev, loot: newLoot }));
    onUpdate(location.id, { loot: newLoot });
  };

  const handleLootItemChange = (id: string, field: keyof Omit<LootItem, 'id'>, value: string) => {
    const newLoot = (formData.loot || []).map(item =>
        item.id === id ? { ...item, [field]: value === 'none' ? undefined : value } : item
    );
    setFormData(prev => ({ ...prev, loot: newLoot }));
  };

  const handleDeleteLootItem = (id: string) => {
    const newLoot = (formData.loot || []).filter(item => item.id !== id);
    setFormData(prev => ({ ...prev, loot: newLoot }));
    onUpdate(location.id, { loot: newLoot });
  };

  const handleLootBlur = () => {
    if (JSON.stringify(formData.loot) !== JSON.stringify(location.loot)) {
        onUpdate(location.id, { loot: formData.loot });
    }
  };

  const handleGeneratePoi = async (lootItem: LootItem) => {
    if (!lootItem.description) return;
    setGeneratingPoiFor(lootItem.id);
    setPoiGenerationError(null);
    try {
        const poiData = await generatePoiFromLoot(lootItem.description, undefined, isMockMode);
        const newPoi: PointOfInterest = { ...poiData, id: crypto.randomUUID() };

        const newPois = [...(formData.pointsOfInterest || []), newPoi];
        const newLoot = (formData.loot || []).map(item =>
            item.id === lootItem.id ? { ...item, pointOfInterestId: newPoi.id } : item
        );

        const updatedData = { pointsOfInterest: newPois, loot: newLoot };
        setFormData(prev => ({ ...prev, ...updatedData }));
        onUpdate(location.id, updatedData);

    } catch (err) {
        console.error("Failed to generate Point of Interest from loot", err);
        setPoiGenerationError('Failed to generate Point of Interest. Please try again.');
    } finally {
        setGeneratingPoiFor(null);
    }
  };

  // --- Generate NPC at this Location ---
  const npcGenerationDefaultPrompt = `Generate an NPC who frequents or is associated with "${location.name}". They should feel at home in this location and have a reason to be here.`;

  const handleGenerateNpcAtLocation = async (prompt: string) => {
    setIsGeneratingNpc(true);
    setNpcGenerationError(null);
    const contextWithLocation = `${campaignContext || ''}\nCurrent Location: ${location.name}${location.description ? ` — ${location.description}` : ''}`.trim();
    try {
      const npcData = await generateNpc(prompt, isMockMode, contextWithLocation);
      campaignService.createNpc({ ...npcData, factionId: undefined, relationships: [], history: [] });
    } catch (error) {
      console.error('Failed to generate NPC at location:', error);
      setNpcGenerationError('Failed to generate NPC. Please try again.');
    } finally {
      setIsGeneratingNpc(false);
    }
  };

  // Filter out the current location and its own children from the list of possible parents
  const possibleParents = allLocations.filter(l => {
    if (l.id === location.id) return false;
    let current = l;
    while(current.parentLocationId) {
        if(current.parentLocationId === location.id) return false;
        const parent = allLocations.find(p => p.id === current.parentLocationId);
        if(!parent) break;
        current = parent;
    }
    return true;
  });

  const subLocations = allLocations.filter(l => (location.subLocationIds || []).includes(l.id));
  const possibleConnectionTargets = allLocations.filter(l => l.id !== location.id);
  const inboundConnections = allLocations.filter(l => l.connections?.some(c => c.targetLocationId === location.id));

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar animate-fade-in">
      <header className="flex justify-between items-start mb-6">
        <div className="space-y-2">
            <div className="flex items-center gap-3 text-amber-400">
              <Icons.Locations className="w-8 h-8" />
              <h1 className="text-3xl font-bold font-serif text-slate-100">Location Editor</h1>
            </div>
        </div>
        <Button variant="danger" size="sm" onClick={handleDelete}>
            <Icons.Trash className="w-3.5 h-3.5 mr-2" />
            Delete Location
        </Button>
      </header>

      <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800/50">
        <TabLayout tabs={LOCATION_TABS} activeTab={activeTab} onTabChange={setActiveTab}>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Location Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all placeholder:text-slate-600"
                  />
                </div>
                <div className="pt-5">
                  <GenerateHerePanel
                    buttonLabel="Generate NPC at this location"
                    defaultPrompt={npcGenerationDefaultPrompt}
                    isGenerating={isGeneratingNpc}
                    onGenerate={handleGenerateNpcAtLocation}
                  />
                  {npcGenerationError && (
                    <p role="alert" className="text-xs text-red-400 mt-1.5">{npcGenerationError}</p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center">
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Description</label>
                    <RegenerateButton fieldName="description" currentValue={formData.description} entityType="Location" entityContext={locationEntityContext} onRegenerate={handleFieldRegenerate('description')} isMockMode={isMockMode} campaignContext={campaignContext} />
                  </div>
                </div>
                <MentionInput
                  value={formData.description}
                  onChange={handleMentionFieldChange('description')}
                  onMentionedIdsChange={handleMentionedIdsChange('description')}
                  initialMentions={mentionCandidates}
                  rows={5}
                  placeholder="Describe this location... (type @ to mention entities)"
                />
              </div>
              {formData.description && onNavigate && (
                  <p className="text-sm text-slate-300 leading-relaxed mt-1 px-1">
                      <LinkedText text={formData.description} onNavigate={onNavigate} />
                  </p>
              )}

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center">
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Secrets &amp; Hidden Details</label>
                    <RegenerateButton fieldName="secrets" currentValue={formData.secrets} entityType="Location" entityContext={locationEntityContext} onRegenerate={handleFieldRegenerate('secrets')} isMockMode={isMockMode} campaignContext={campaignContext} />
                  </div>
                </div>
                <MentionInput
                  value={formData.secrets}
                  onChange={handleMentionFieldChange('secrets')}
                  onMentionedIdsChange={handleMentionedIdsChange('secrets')}
                  initialMentions={mentionCandidates}
                  rows={3}
                  placeholder="Hidden details, secret passages, buried knowledge... (type @ to mention entities)"
                />
              </div>
              {formData.secrets && onNavigate && (
                  <p className="text-sm text-slate-300 leading-relaxed mt-1 px-1">
                      <LinkedText text={formData.secrets} onNavigate={onNavigate} />
                  </p>
              )}
            </div>
          )}

          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Items & Loot */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-sm font-medium text-slate-400">Items & Loot</label>
                  <Button size="sm" variant="ghost" onClick={handleAddLootItem}>
                    <Icons.Plus className="w-3 h-3 mr-1.5" /> Add Loot
                  </Button>
                </div>
                {poiGenerationError && (
                  <p role="alert" className="text-xs text-red-400 mb-1.5">{poiGenerationError}</p>
                )}
                <div className="space-y-2">
                  {(formData.loot || []).map(item => (
                    <div key={item.id} className="flex items-center gap-2 bg-slate-950/50 p-2 rounded-md border border-slate-800/50">
                      <Icons.Items className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <input
                        type="text"
                        placeholder="Loot description (e.g., 200gp, Potion of Healing)"
                        value={item.description}
                        onChange={(e) => handleLootItemChange(item.id, 'description', e.target.value)}
                        onBlur={handleLootBlur}
                        className="flex-grow bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <select
                        value={item.pointOfInterestId || 'none'}
                        onChange={(e) => handleLootItemChange(item.id, 'pointOfInterestId', e.target.value)}
                        onBlur={handleLootBlur}
                        className="w-1/3 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="none">-- General Location --</option>
                        {(formData.pointsOfInterest || []).map(poi => (
                          <option key={poi.id} value={poi.id}>{poi.name}</option>
                        ))}
                      </select>
                      <Button
                        variant="icon"
                        onClick={() => handleGeneratePoi(item)}
                        disabled={generatingPoiFor === item.id || !item.description}
                        className="text-amber-400 hover:text-amber-300 group relative"
                        aria-label="Generate Point of Interest from loot"
                      >
                        {generatingPoiFor === item.id ? <Icons.Sparkles className="w-4 h-4 animate-spin" /> : <Icons.Sparkles className="w-4 h-4" />}
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900 text-slate-300 text-xs rounded-md p-2 border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                          Generate an interactive Point of Interest for this loot item.
                        </span>
                      </Button>
                      <Button variant="icon" onClick={() => handleDeleteLootItem(item.id)} className="text-slate-500 hover:text-red-400" aria-label="Delete loot item">
                        <Icons.Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {(!formData.loot || formData.loot.length === 0) && (
                    <p className="text-xs text-slate-500 italic px-2 py-1">No loot defined for this location.</p>
                  )}
                </div>
              </div>

              {/* Points of Interest */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-sm font-medium text-slate-400">Points of Interest</label>
                  <Button size="sm" variant="ghost" onClick={handleAddPoi}>
                    <Icons.Plus className="w-3 h-3 mr-1.5" /> Add Point of Interest
                  </Button>
                </div>
                <div className="space-y-3">
                  {(formData.pointsOfInterest || []).map(poi =>
                      <PointOfInterestEditor
                          key={poi.id}
                          poi={poi}
                          onDelete={handleDeletePoi}
                          onChange={handlePoiChange}
                          onAddSubItem={handleAddPoiSubItem}
                          onDeleteSubItem={handleDeletePoiSubItem}
                          onChangeSubItem={handlePoiSubItemChange}
                          onBlur={handlePoisBlur}
                      />
                  )}
                  {(!formData.pointsOfInterest || formData.pointsOfInterest.length === 0) && (
                    <p className="text-xs text-slate-500 italic px-2 py-1">No points of interest defined for this location.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Connections Tab */}
          {activeTab === 'connections' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Parent Location */}
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Parent Location</label>
                    <select
                      name="parentLocationId"
                      value={formData.parentLocationId || "none"}
                      onChange={handleParentChange}
                      className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all"
                    >
                        <option value="none">-- None --</option>
                        {possibleParents.map(loc => (<option key={loc.id} value={loc.id}>{loc.name}</option>))}
                    </select>
                    {formData.parentLocationId && onNavigate && (
                        <div className="mt-1.5">
                            <EntityLink
                                entityType="location"
                                entityId={formData.parentLocationId}
                                label={allLocations.find(l => l.id === formData.parentLocationId)?.name}
                                onNavigate={onNavigate}
                            />
                        </div>
                    )}
                </div>

                {/* Controlling Faction */}
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Controlling Faction</label>
                    <select
                      name="controllingFactionId"
                      value={formData.controllingFactionId || "none"}
                      onChange={handleFactionChange}
                      className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all"
                    >
                        <option value="none">-- None --</option>
                        {allFactions.map(f => (<option key={f.id} value={f.id}>{f.name}</option>))}
                    </select>
                    {formData.controllingFactionId && onNavigate && (
                        <div className="mt-1.5">
                            <EntityLink
                                entityType="faction"
                                entityId={formData.controllingFactionId}
                                label={allFactions.find(f => f.id === formData.controllingFactionId)?.name}
                                onNavigate={onNavigate}
                            />
                        </div>
                    )}
                </div>

                {/* Sub-Locations */}
                <div>
                     <label className="block text-sm font-medium text-slate-400 mb-1.5">Sub-Locations</label>
                     {subLocations.length > 0 ? (
                        <ul className="space-y-1 mt-2">
                            {subLocations.map(loc => (
                                <li key={loc.id} className="flex items-center gap-1.5 text-sm text-slate-300">
                                    <Icons.Locations className="w-3 h-3 text-slate-500 flex-shrink-0" />
                                    {onNavigate ? (
                                        <EntityLink
                                            entityType="location"
                                            entityId={loc.id}
                                            label={loc.name}
                                            onNavigate={onNavigate}
                                        />
                                    ) : loc.name}
                                </li>
                            ))}
                        </ul>
                     ) : (<p className="text-sm text-slate-500 italic mt-2">No sub-locations assigned.</p>)}
                </div>

                {/* Connected From */}
                <div>
                     <label className="block text-sm font-medium text-slate-400 mb-1.5">Connected From</label>
                     {inboundConnections.length > 0 ? (
                        <div className="space-y-1 text-sm text-slate-300 mt-2">
                            {inboundConnections.map(loc => {
                                const conn = loc.connections?.find(c => c.targetLocationId === location.id);
                                return conn ? (
                                    <div key={loc.id} className="flex items-center gap-2">
                                        {onNavigate ? (
                                            <EntityLink
                                                entityType="location"
                                                entityId={loc.id}
                                                label={loc.name}
                                                onNavigate={onNavigate}
                                            />
                                        ) : <span className="font-semibold">{loc.name}</span>}
                                        {conn.description && <span className="text-xs bg-slate-700 text-slate-300 rounded-full px-2 py-0.5">{conn.description}</span>}
                                    </div>
                                ) : null;
                            })}
                        </div>
                     ) : (<p className="text-sm text-slate-500 italic mt-2">No other locations connect to this one.</p>)}
                </div>
              </div>

              {/* Outbound Connections */}
              <div>
                  <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-sm font-medium text-slate-400">Connections & Relationships</label>
                      <Button size="sm" variant="ghost" onClick={handleAddConnection}>
                        <Icons.Plus className="w-3 h-3 mr-1.5" /> Add Connection
                      </Button>
                  </div>
                  <div className="space-y-2">
                      {(formData.connections || []).map((conn) => (
                          <div key={conn.id} className="flex items-center gap-2 bg-slate-950/50 p-2 rounded-md border border-slate-800/50">
                              <Icons.Link className="w-4 h-4 text-slate-500 flex-shrink-0" />
                              <input
                                type="text"
                                placeholder="Description of connection"
                                value={conn.description}
                                onChange={(e) => handleConnectionChange(conn.id, 'description', e.target.value)}
                                onBlur={handleConnectionsBlur}
                                className="w-1/2 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-amber-500"
                              />
                              <span className="text-slate-500">→</span>
                              <select
                                value={conn.targetLocationId}
                                onChange={(e) => handleConnectionChange(conn.id, 'targetLocationId', e.target.value)}
                                onBlur={handleConnectionsBlur}
                                className="flex-grow bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-amber-500"
                              >
                                  <option value="">-- Select Target --</option>
                                  {possibleConnectionTargets.map(loc => (<option key={loc.id} value={loc.id}>{loc.name}</option>))}
                              </select>
                              <Button variant="icon" onClick={() => handleDeleteConnection(conn.id)} className="text-slate-500 hover:text-red-400" aria-label="Delete connection">
                                <Icons.Trash className="w-4 h-4" />
                              </Button>
                          </div>
                      ))}
                      {(!formData.connections || formData.connections.length === 0) && (
                        <p className="text-xs text-slate-500 italic px-2 py-1">No connections defined for this location.</p>
                      )}
                  </div>
              </div>

              {/* Backlinks Panel */}
              <BacklinksPanel entityId={location.id} entityType="location" onNavigate={onNavigate} />
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              {campaign && (
                <EntityHistoryManager
                    subjectId={location.id}
                    subjectType="location"
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


// --- Point of Interest Sub-Component ---
interface PointOfInterestEditorProps {
    poi: PointOfInterest;
    onDelete: (id: string) => void;
    onChange: (id: string, field: keyof Omit<PointOfInterest, 'id' | 'interactions' | 'investigationChecks'>, value: string | number) => void;
    onAddSubItem: (poiId: string, type: 'interactions' | 'investigationChecks') => void;
    onDeleteSubItem: (poiId: string, interactionId: string, type: 'interactions' | 'investigationChecks') => void;
    onChangeSubItem: (poiId: string, interactionId: string, field: keyof Omit<PoiInteraction, 'id'>, value: string, type: 'interactions' | 'investigationChecks') => void;
    onBlur: () => void;
}

const PointOfInterestEditor: React.FC<PointOfInterestEditorProps> = ({ poi, onDelete, onChange, onAddSubItem, onDeleteSubItem, onChangeSubItem, onBlur }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className="bg-slate-950/50 border border-slate-800 rounded-lg">
            <header className="flex items-center justify-between p-2 bg-slate-800/30 rounded-t-lg">
                <button onClick={() => setIsExpanded(p => !p)} className="flex items-center gap-2 flex-grow text-left">
                    <Icons.ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                    <Icons.Puzzle className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-slate-200">{poi.name}</span>
                </button>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">DC {poi.passivePerceptionDC}</span>
                    <Button variant="icon" onClick={() => onDelete(poi.id)} className="text-slate-500 hover:text-red-400" aria-label={`Delete ${poi.name}`}><Icons.Trash className="w-4 h-4" /></Button>
                </div>
            </header>
            {isExpanded && (
                <div className="p-3 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-slate-400 mb-1">Name</label>
                            <input type="text" value={poi.name} onChange={e => onChange(poi.id, 'name', e.target.value)} onBlur={onBlur} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-amber-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Passive Perception</label>
                            <input type="number" value={poi.passivePerceptionDC} onChange={e => onChange(poi.id, 'passivePerceptionDC', parseInt(e.target.value) || 10)} onBlur={onBlur} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-amber-500" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Description (Read-Aloud)</label>
                        <textarea value={poi.description} onChange={e => onChange(poi.id, 'description', e.target.value)} onBlur={onBlur} rows={3} placeholder="What players notice if they meet the passive perception DC." className={`w-full px-2 py-1 text-sm resize-y ${textareaBaseClasses}`} />
                    </div>

                    <PoiSubSection
                        title="Investigation Checks"
                        items={poi.investigationChecks}
                        onAdd={() => onAddSubItem(poi.id, 'investigationChecks')}
                        onDelete={(itemId) => onDeleteSubItem(poi.id, itemId, 'investigationChecks')}
                        onChange={(itemId, field, value) => onChangeSubItem(poi.id, itemId, field, value, 'investigationChecks')}
                        onBlur={onBlur}
                        descriptionPlaceholder="Condition / Check (e.g., 'DC 12 Investigation')"
                        outcomePlaceholder="Outcome / Details (e.g., 'The runes are of ancient Dwarven origin.')"
                        emptyText="No special details to find via investigation."
                    />

                    <PoiSubSection
                        title="Player Actions"
                        items={poi.interactions}
                        onAdd={() => onAddSubItem(poi.id, 'interactions')}
                        onDelete={(itemId) => onDeleteSubItem(poi.id, itemId, 'interactions')}
                        onChange={(itemId, field, value) => onChangeSubItem(poi.id, itemId, field, value, 'interactions')}
                        onBlur={onBlur}
                        descriptionPlaceholder="Trigger / Action (e.g., 'If a player pulls the lever')"
                        outcomePlaceholder="Outcome / Result (e.g., 'A secret door grinds open.')"
                        emptyText="No special actions available."
                    />
                </div>
            )}
        </div>
    )
};

interface PoiSubSectionProps {
    title: string;
    items: PoiInteraction[];
    onAdd: () => void;
    onDelete: (id: string) => void;
    onChange: (id: string, field: keyof Omit<PoiInteraction, 'id'>, value: string) => void;
    onBlur: () => void;
    descriptionPlaceholder: string;
    outcomePlaceholder: string;
    emptyText: string;
}

const PoiSubSection: React.FC<PoiSubSectionProps> = ({ title, items, onAdd, onDelete, onChange, onBlur, descriptionPlaceholder, outcomePlaceholder, emptyText }) => (
    <div>
        <div className="flex justify-between items-center mb-1">
            <label className="block text-xs font-medium text-slate-400">{title}</label>
            <Button size="sm" variant="ghost" onClick={onAdd}><Icons.Plus className="w-3 h-3 mr-1" /> Add</Button>
        </div>
        <div className="space-y-2">
            {items.map(item => (
                <div key={item.id} className="bg-slate-900/50 p-2 rounded-md border border-slate-700/50 space-y-1.5">
                    <div className="flex items-start gap-2">
                        <textarea value={item.description} onChange={e => onChange(item.id, 'description', e.target.value)} onBlur={onBlur} rows={2} placeholder={descriptionPlaceholder} className={`w-full px-2 py-1 text-sm resize-y ${textareaBaseClasses}`} />
                        <Button variant="icon" onClick={() => onDelete(item.id)} className="text-slate-500 hover:text-red-400 mt-1" aria-label="Delete item"><Icons.Trash className="w-3.5 h-3.5" /></Button>
                    </div>
                    <textarea value={item.outcome} onChange={e => onChange(item.id, 'outcome', e.target.value)} onBlur={onBlur} rows={2} placeholder={outcomePlaceholder} className={`w-full px-2 py-1 text-sm resize-y ${textareaBaseClasses}`} />
                </div>
            ))}
            {items.length === 0 && <p className="text-xs text-slate-600 italic px-2 py-1">{emptyText}</p>}
        </div>
    </div>
);
