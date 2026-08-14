
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { reconcileEntityFormData } from '../../utils/formReconciliation';
import type { Plot, PlotStatus, SessionLog, Campaign } from '../../types/index';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { MentionInput, resolveMentionCandidates, findMentionedIdsInText } from '../common/MentionInput';
import { generateScene } from '../../services/aiService';
import { RegenerateButton } from '../common/RegenerateButton';
import { GenerateHerePanel } from '../common/GenerateHerePanel';
import { EntityLink } from '../common/EntityLink';
import { LinkedText } from '../common/LinkedText';
import { campaignService } from '../../services/campaignService';
import type { QuickCardEntityType } from '../common/EntityQuickCard';
import { BacklinksPanel } from '../common/BacklinksPanel';

interface PlotEditorProps {
  plot: Plot;
  campaign: Campaign;
  onUpdate: (id: string, updatedData: Partial<Plot>) => void;
  onDelete: (id: string) => void;
  isMockMode: boolean;
  campaignContext?: string;
  onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
}

export const PlotEditor: React.FC<PlotEditorProps> = ({ plot, campaign, onUpdate, onDelete, isMockMode, campaignContext, onNavigate }) => {
  const [formData, setFormData] = useState(plot);
  const [isGeneratingScene, setIsGeneratingScene] = useState(false);
  const [sceneGenerationError, setSceneGenerationError] = useState<string | null>(null);
  const { confirm } = useConfirmDialog();

  // Tracks the last `plot` prop we've reconciled against, so incoming prop
  // updates can be merged field-by-field instead of overwriting formData wholesale.
  const prevPlotRef = useRef(plot);

  useEffect(() => {
    const prevPlot = prevPlotRef.current;
    if (prevPlot !== plot) {
      setFormData(prev => reconcileEntityFormData(prev, prevPlot, plot));
    }
    prevPlotRef.current = plot;
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

  const handleDelete = async () => {
    const confirmed = await confirm('Delete Plot Arc', 'Are you sure you want to delete this plot arc?', { variant: 'danger' });
    if (confirmed) {
      onDelete(plot.id);
    }
  }
  
  // Used by MentionInput fields (onChange receives string, not event).
  // Local edits commit immediately for responsive typing, but the store write
  // (onUpdate) is debounced so unblurred keystrokes coalesce into a single
  // campaign-wide update instead of one per character (finding #70).
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
        onUpdate(plot.id, { [field]: value } as Partial<Plot>);
      });
      Object.keys(pending).forEach(field => { delete pending[field]; });
    };
    // Runs only on mount/unmount by design: onUpdate is campaignService's
    // stable singleton method reference, so capturing it here is safe and
    // guarantees the flush fires exactly once, on real unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handleMentionFieldChange = (field: keyof Plot) => (value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    const timers = mentionFieldTimersRef.current;
    mentionFieldPendingRef.current[field] = value;
    if (timers[field]) clearTimeout(timers[field]);
    timers[field] = setTimeout(() => {
      delete mentionFieldPendingRef.current[field];
      onUpdate(plot.id, { [field]: value } as Partial<Plot>);
    }, 400);
  };

  // --- @-mention tracking across all MentionInput fields ---
  // Candidates already known to be mentioned (from a prior session), used both to
  // hydrate MentionInput's internal map and to seed each field's initial ID set.
  const mentionCandidates = useMemo(
    () => resolveMentionCandidates(campaign, plot.mentionedEntityIds),
    [campaign, plot.mentionedEntityIds],
  );
  // Per-field mention ID sets. Kept in a ref, not state — nothing renders off
  // of this value directly, it exists purely so handleMentionedIdsChange can
  // compute the merged set without writing to the store from inside a
  // setState updater (React invokes functional updaters during the render
  // phase, and StrictMode intentionally double-invokes them — doing the
  // store write there fired it twice, and doing a store write during React's
  // render phase at all is invalid — finding #69).
  const mentionedIdsByFieldRef = useRef<Record<string, string[]>>({
    description: findMentionedIdsInText(plot.description, mentionCandidates),
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
    onUpdate(plot.id, { mentionedEntityIds: merged });
  };

  const handleFieldRegenerate = (field: 'description') => (newValue: string) => {
    setFormData(prev => ({ ...prev, [field]: newValue }));
    onUpdate(plot.id, { [field]: newValue });
  };

  const plotEntityContext = `Title: ${formData.title}\nStatus: ${formData.status}${formData.description ? `\nDescription: ${formData.description}` : ''}`;

  // --- Generate Scene Advancing this Plot ---
  const targetAdventure = campaign.adventures[campaign.adventures.length - 1] ?? null;
  const sceneGenerationDefaultPrompt = targetAdventure
    ? `Generate a scene that advances the plot "${plot.title}". ${plot.description ? `Plot summary: ${plot.description}` : ''} This scene should create meaningful progress or complication for this story arc. It will be added to the adventure "${targetAdventure.title}".`.trim()
    : '';

  const handleGeneratePlotScene = async (prompt: string) => {
    if (!targetAdventure) return;
    setIsGeneratingScene(true);
    setSceneGenerationError(null);
    try {
      const sceneData = await generateScene(prompt, isMockMode, campaignContext);
      campaignService.createScene(targetAdventure.id, {
        ...sceneData,
        locationId: undefined,
        npcIds: [],
      });
    } catch (error) {
      console.error('Failed to generate scene for plot:', error);
      setSceneGenerationError('Failed to generate scene. Please try again.');
    } finally {
      setIsGeneratingScene(false);
    }
  };

  const allEntities = [
      ...campaign.npcs.map(n => ({ id: n.id, name: n.name, type: 'NPC' })),
      ...campaign.locations.map(l => ({ id: l.id, name: l.name, type: 'Location' })),
      ...campaign.factions.map(f => ({ id: f.id, name: f.name, type: 'Faction' }))
  ];

  // Derive Timeline from Session Logs
  const narrativeTimeline = useMemo(() => {
      return (campaign.sessionLogs || [])
        .filter(session => session.relatedPlotIds?.includes(plot.id))
        .sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime());
  }, [campaign.sessionLogs, plot.id]);

  return (
    <div className="p-6 md:p-8 h-full flex flex-col overflow-hidden animate-fade-in">
      <header className="flex flex-wrap justify-between items-start mb-6 flex-shrink-0 gap-3">
        <div className="space-y-2">
            <div className="flex items-center gap-3 text-amber-400">
              <Icons.Plot className="w-8 h-8" />
              <h1 className="text-3xl font-bold font-serif text-slate-100">Plot Arc Editor</h1>
            </div>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <div className="flex flex-col items-end gap-1.5">
            <GenerateHerePanel
              buttonLabel="Generate scene for this plot"
              defaultPrompt={sceneGenerationDefaultPrompt}
              isGenerating={isGeneratingScene}
              onGenerate={handleGeneratePlotScene}
              disabled={!targetAdventure}
              disabledReason="Create an adventure first to generate scenes."
            />
            {sceneGenerationError && (
              <p role="alert" className="text-xs text-red-400">{sceneGenerationError}</p>
            )}
          </div>
          <Button variant="danger" size="sm" onClick={handleDelete}>
              <Icons.Trash className="w-3.5 h-3.5 mr-2" />
              Delete Plot
          </Button>
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
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
                        className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all font-semibold text-lg placeholder:text-slate-600"
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
                        className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all capitalize"
                    >
                        <option value="active">Active</option>
                        <option value="dormant">Dormant</option>
                        <option value="resolved">Resolved</option>
                    </select>
                </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center">
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Description &amp; Notes</label>
                  <RegenerateButton fieldName="description" currentValue={formData.description} entityType="Plot" entityContext={plotEntityContext} onRegenerate={handleFieldRegenerate('description')} isMockMode={isMockMode} campaignContext={campaignContext} />
                </div>
              </div>
              <MentionInput
                value={formData.description}
                onChange={handleMentionFieldChange('description')}
                onMentionedIdsChange={handleMentionedIdsChange('description')}
                initialMentions={mentionCandidates}
                rows={8}
                placeholder="Describe the main conflict, key beats, and current state of this plot arc. (type @ to mention entities)"
              />
            </div>
            {formData.description && onNavigate && (
                <p className="text-sm text-slate-300 leading-relaxed mt-1 px-1">
                    <LinkedText text={formData.description} onNavigate={onNavigate} />
                </p>
            )}

            {/* Entity Tagging */}
            <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800/50">
                <label className="block text-sm font-medium text-slate-400 mb-3">Related Entities</label>
                {/* EntityLink chips for selected entities */}
                {(formData.relatedEntityIds || []).length > 0 && onNavigate && (() => {
                    const TYPE_MAP: Record<string, QuickCardEntityType> = {
                        NPC: 'npc', Location: 'location', Faction: 'faction',
                    };
                    const chips: React.ReactNode[] = [];
                    for (const id of formData.relatedEntityIds || []) {
                        const entity = allEntities.find(e => e.id === id);
                        if (!entity) continue;
                        const entityType = TYPE_MAP[entity.type];
                        if (!entityType) continue;
                        chips.push(
                            <EntityLink key={id} entityType={entityType} entityId={id} label={entity.name} onNavigate={onNavigate!} />
                        );
                    }
                    return chips.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-slate-800">
                            {chips}
                        </div>
                    ) : null;
                })()}
                <div className="max-h-40 overflow-y-auto custom-scrollbar grid grid-cols-1 md:grid-cols-3 gap-2">
                    {allEntities.map(entity => (
                        <label key={entity.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-800 cursor-pointer transition-colors">
                            <input
                                type="checkbox"
                                checked={(formData.relatedEntityIds || []).includes(entity.id)}
                                onChange={() => handleEntityToggle(entity.id)}
                                className="rounded border-slate-600 bg-slate-900 text-amber-600 focus:ring-amber-500 focus:ring-offset-slate-900"
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

        {/* Narrative Timeline */}
        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800/50">
            <h2 className="text-lg font-bold font-serif text-slate-200 mb-4 flex items-center gap-2">
                <Icons.List className="w-5 h-5 text-amber-400" /> Narrative Timeline
            </h2>
            <div className="space-y-6 pl-4 border-l-2 border-slate-800 ml-2">
                {narrativeTimeline.map((session, index) => (
                    <div key={session.id} className="relative pl-6 group">
                        {/* Timeline Node */}
                        <div className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-slate-800 border-2 border-slate-600 group-hover:border-amber-500 group-hover:bg-amber-900 transition-colors"></div>
                        
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-500 font-mono mb-1">{new Date(session.sessionDate).toLocaleDateString()}</span>
                            <h3 className="text-sm font-bold text-amber-300 mb-2">{session.title}</h3>
                            <div className="bg-slate-950/50 p-3 rounded-md border border-slate-800 text-sm text-slate-300 italic">
                                {session.notableEvents || session.recap ? (
                                    <>
                                        {session.notableEvents && <div className="mb-2"><strong className="text-slate-500 text-xs uppercase tracking-wider block mb-1">Notable Events</strong>{session.notableEvents}</div>}
                                        {session.recap && !session.notableEvents && <div className="line-clamp-3">{session.recap}</div>}
                                    </>
                                ) : (
                                    <span className="text-slate-600">No details recorded for this session.</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                {narrativeTimeline.length === 0 && (
                    <div className="pl-6 text-slate-500 italic text-sm">
                        No sessions linked to this plot yet. Tag this plot in a Session Log to see it here.
                    </div>
                )}
            </div>
        </div>

        {/* Backlinks Panel */}
        <BacklinksPanel entityId={plot.id} entityType="plot" onNavigate={onNavigate} />

      </div>
    </div>
  );
};
