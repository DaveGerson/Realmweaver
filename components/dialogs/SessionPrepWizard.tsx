
import React, { useState, useMemo, useCallback, useRef } from 'react';
import type { Campaign, Adventure, Scene, Plot, NPC, Location, SessionLog, Beat, Secret } from '../../types/index';
import { Icons, SceneIcon } from '../common/Icons';
import { Button } from '../common/Button';
import { twMerge } from 'tailwind-merge';
import { campaignService } from '../../services/campaignService';
import { DialogShell } from '../common/DialogShell';
import { textareaBaseClasses } from '../common/Textarea';
import { useEntitySearch } from '@/hooks/useEntitySearch';
import { generateColdOpen, hasColdOpenMaterial } from '@/services/aiService';
import { buildCampaignContext } from '@/services/contextBuilder';

type WizardStep = 'adventure' | 'scenes' | 'entities' | 'plots' | 'strongStart' | 'beats' | 'secretsCheck' | 'review';

// Standard flow (lazy prep OFF, adventure selected).
const STEP_ORDER: WizardStep[] = ['adventure', 'scenes', 'entities', 'plots', 'review'];
// Lazy prep path (docs/design/lazy-dm-lens.md §4 R1): a strong start, a loose
// list of beats, a glance at the unrevealed secrets, then go. It composes with
// whatever adventure is selected rather than forking on it — Scenes, NPCs &
// Locations and Plot Threads simply drop out of the visible flow while their
// underlying selections (auto-gathered cast/places, auto-selected scenes)
// keep feeding Go Live and the Secrets Check step untouched.
const LAZY_STEP_ORDER: WizardStep[] = ['adventure', 'strongStart', 'beats', 'secretsCheck', 'review'];
const STEP_LABELS: Record<WizardStep, string> = {
    adventure: 'Adventure',
    scenes: 'Scenes',
    entities: 'NPCs & Locations',
    plots: 'Plot Threads',
    strongStart: 'Strong Start',
    beats: 'Beats',
    secretsCheck: 'Secrets Check',
    review: 'Go Live',
};

// The strong start is persisted with ZERO new schema, as a clearly-delimited
// leading section of `prepNotes` — the encoding lives in the leaf module
// `utils/strongStartFormat.ts` so `SceneListPanel` can parse it back without
// pulling this whole wizard into the Session Runner's chunk.
import { composeStrongStartPrepNotes } from '@/utils/strongStartFormat';

export interface SessionPrepWizardProps {
    campaign: Campaign;
    onComplete: (sessionLogId: string) => void;
    onClose: () => void;
    /**
     * P4 (cold open): routes the one AI action this wizard offers through the
     * facade's mock switch. Threaded from both call sites (`SessionLogDashboard`,
     * `TonightsTable`); kept optional (default `false`, the real provider path)
     * so a caller that legitimately has no mock-mode concept of its own still
     * compiles.
     */
    isMockMode?: boolean;
}

export const SessionPrepWizard: React.FC<SessionPrepWizardProps> = ({
    campaign,
    onComplete,
    onClose,
    isMockMode = false,
}) => {
    // ── Step tracking ─────────────────────────────────────────────────────────
    const [currentStep, setCurrentStep] = useState<WizardStep>('adventure');

    // ── Step 1: Adventure selection ───────────────────────────────────────────
    const [selectedAdventureId, setSelectedAdventureId] = useState<string | null>(null);

    // Lazy prep path toggle (docs/design/lazy-dm-lens.md §4 R1) — off by default,
    // sits alongside the adventure choice on step 1. It COMPOSES with the
    // adventure selection rather than replacing it; see computeStepOrder below.
    const [lazyPrepOn, setLazyPrepOn] = useState(false);

    // ── Step 2: Scene selection ───────────────────────────────────────────────
    const selectedAdventure = useMemo(
        () => campaign.adventures.find(a => a.id === selectedAdventureId) ?? null,
        [campaign.adventures, selectedAdventureId]
    );

    const [selectedSceneIds, setSelectedSceneIds] = useState<Set<string>>(new Set());

    // Sync scene defaults whenever the adventure changes
    const handleSelectAdventure = useCallback((id: string | null) => {
        setSelectedAdventureId(id);
        if (id) {
            const adv = campaign.adventures.find(a => a.id === id);
            if (adv) {
                setSelectedSceneIds(
                    new Set(
                        adv.scenes
                            .filter(s => s.status === 'planned' || s.status === 'in-progress')
                            .map(s => s.id)
                    )
                );
            }
        } else {
            setSelectedSceneIds(new Set());
        }
    }, [campaign.adventures]);

    const toggleScene = (id: string) => {
        setSelectedSceneIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAllScenes = () => {
        if (!selectedAdventure) return;
        setSelectedSceneIds(new Set(selectedAdventure.scenes.map(s => s.id)));
    };

    const deselectAllScenes = () => {
        setSelectedSceneIds(new Set());
    };

    // ── Step 3: NPCs & Locations ──────────────────────────────────────────────
    // Auto-gather from selected scenes
    const sceneLinkedNpcIds = useMemo<Set<string>>(() => {
        if (!selectedAdventure) return new Set();
        const ids = new Set<string>();
        selectedAdventure.scenes
            .filter(s => selectedSceneIds.has(s.id))
            .forEach(s => s.npcIds.forEach(id => ids.add(id)));
        return ids;
    }, [selectedAdventure, selectedSceneIds]);

    const sceneLinkedLocationIds = useMemo<Set<string>>(() => {
        if (!selectedAdventure) return new Set();
        const ids = new Set<string>();
        selectedAdventure.scenes
            .filter(s => selectedSceneIds.has(s.id))
            .forEach(s => { if (s.locationId) ids.add(s.locationId); });
        return ids;
    }, [selectedAdventure, selectedSceneIds]);

    // Additional manually added NPC/Location IDs
    const [extraNpcIds, setExtraNpcIds] = useState<Set<string>>(new Set());
    const [removedNpcIds, setRemovedNpcIds] = useState<Set<string>>(new Set());
    const [extraLocationIds, setExtraLocationIds] = useState<Set<string>>(new Set());
    const [removedLocationIds, setRemovedLocationIds] = useState<Set<string>>(new Set());

    const activeNpcIds = useMemo<Set<string>>(() => {
        const ids = new Set(sceneLinkedNpcIds);
        extraNpcIds.forEach(id => ids.add(id));
        removedNpcIds.forEach(id => ids.delete(id));
        return ids;
    }, [sceneLinkedNpcIds, extraNpcIds, removedNpcIds]);

    const activeLocationIds = useMemo<Set<string>>(() => {
        const ids = new Set(sceneLinkedLocationIds);
        extraLocationIds.forEach(id => ids.add(id));
        removedLocationIds.forEach(id => ids.delete(id));
        return ids;
    }, [sceneLinkedLocationIds, extraLocationIds, removedLocationIds]);

    const resolvedNpcs = useMemo<Array<{ npc: NPC | null; id: string }>>(
        () =>
            Array.from(activeNpcIds).map(id => ({
                id,
                npc: campaign.npcs.find(n => n.id === id) ?? null,
            })),
        [activeNpcIds, campaign.npcs]
    );

    const resolvedLocations = useMemo<Array<{ loc: Location | null; id: string }>>(
        () =>
            Array.from(activeLocationIds).map(id => ({
                id,
                loc: campaign.locations.find(l => l.id === id) ?? null,
            })),
        [activeLocationIds, campaign.locations]
    );

    // Missing reference detection
    const missingNpcs = resolvedNpcs.filter(r => r.npc === null);
    const missingLocations = resolvedLocations.filter(r => r.loc === null);

    const toggleNpc = (id: string, wasAutoLinked: boolean) => {
        if (wasAutoLinked) {
            // Toggle removal from auto set
            setRemovedNpcIds(prev => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
            });
        } else {
            // Toggle extra
            setExtraNpcIds(prev => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
            });
        }
    };

    const toggleLocation = (id: string, wasAutoLinked: boolean) => {
        if (wasAutoLinked) {
            setRemovedLocationIds(prev => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
            });
        } else {
            setExtraLocationIds(prev => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
            });
        }
    };

    // ── Step 3: Extra entity search ───────────────────────────────────────────
    // Entities not already auto-linked via scenes — used in the "add extra" lists
    const extraNpcPool = useMemo(
        () => campaign.npcs.filter(n => !sceneLinkedNpcIds.has(n.id)),
        [campaign.npcs, sceneLinkedNpcIds]
    );
    const extraLocationPool = useMemo(
        () => campaign.locations.filter(l => !sceneLinkedLocationIds.has(l.id)),
        [campaign.locations, sceneLinkedLocationIds]
    );

    const {
        filteredEntities: filteredExtraNpcs,
        searchTerm: npcSearchTerm,
        setSearchTerm: setNpcSearchTerm,
    } = useEntitySearch(extraNpcPool, ['name', 'description']);

    const {
        filteredEntities: filteredExtraLocations,
        searchTerm: locationSearchTerm,
        setSearchTerm: setLocationSearchTerm,
    } = useEntitySearch(extraLocationPool, ['name', 'description']);

    // ── Step 4: Plot threads ──────────────────────────────────────────────────
    const activePlots = useMemo<Plot[]>(
        () => campaign.plots.filter(p => p.status === 'active'),
        [campaign.plots]
    );

    const [selectedPlotIds, setSelectedPlotIds] = useState<Set<string>>(new Set());

    const togglePlot = (id: string) => {
        setSelectedPlotIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // ── Lazy path: Strong Start ───────────────────────────────────────────────
    const [strongStart, setStrongStart] = useState('');

    // ── P4: the cold open (docs/design/storyteller-first-design.md P4) ────────
    // "Draft it from last session" surfaces wherever the wizard is already
    // asking "what are you opening with tonight?" — the lazy path's Strong
    // Start step fills `strongStart` above; with lazy prep off, the same
    // action fills a Go Live-step field of its own (`goLiveColdOpen`), which
    // Go Live later folds into `prepNotes` with the exact same encoding. Never
    // both — whichever step is asking the question owns the button. The DM
    // types nothing: the request is the campaign, nothing else.
    const canDraftColdOpen = useMemo(() => hasColdOpenMaterial(campaign), [campaign]);
    const [goLiveColdOpen, setGoLiveColdOpen] = useState<string | null>(null);
    const [coldOpenPhase, setColdOpenPhase] = useState<'idle' | 'loading' | 'error'>('idle');
    // Synchronous in-flight latch — same idiom as QuickToolsPanel's Callback
    // Machine (`callbackInFlightRef`): a state-based guard alone reads a
    // render closure, so two clicks landing before React commits would both
    // pass it and fire two generations.
    const coldOpenInFlightRef = useRef(false);

    const handleDraftColdOpen = useCallback((applyDraft: (text: string) => void) => {
        if (coldOpenInFlightRef.current) return;
        coldOpenInFlightRef.current = true;
        setColdOpenPhase('loading');
        const campaignContext = buildCampaignContext({ variant: 'generation', campaign });
        generateColdOpen({ campaign, campaignContext }, isMockMode)
            .then(text => {
                applyDraft(text);
                setColdOpenPhase('idle');
            })
            .catch(() => {
                // Quiet failure: no throw, no state torn down — what was
                // already in the field (if anything) is left untouched and
                // the button stays pressable.
                setColdOpenPhase('error');
            })
            .finally(() => {
                coldOpenInFlightRef.current = false;
            });
    }, [campaign, isMockMode]);

    // ── Lazy path: Beats ──────────────────────────────────────────────────────
    // Local title-only list; turned into real Beat[] (unique ids, isCompleted:
    // false, trimmed, blanks dropped) at Go Live and attached to the created
    // SessionLog — the same array components/views/session/SceneListPanel.tsx
    // already renders and checks off.
    const [lazyBeats, setLazyBeats] = useState<Array<{ id: string; title: string }>>([]);
    const [beatDraft, setBeatDraft] = useState('');

    const addLazyBeat = useCallback(() => {
        const title = beatDraft.trim();
        if (!title) return;
        setLazyBeats(prev => [...prev, { id: crypto.randomUUID(), title }]);
        setBeatDraft('');
    }, [beatDraft]);

    const updateLazyBeatTitle = useCallback((id: string, title: string) => {
        setLazyBeats(prev => prev.map(b => (b.id === id ? { ...b, title } : b)));
    }, []);

    const removeLazyBeat = useCallback((id: string) => {
        setLazyBeats(prev => prev.filter(b => b.id !== id));
    }, []);

    // ── Lazy path: Secrets Check ──────────────────────────────────────────────
    // A read-only glance, not an editor (docs/design/lazy-dm-lens.md §2 step 4).
    // Narrows to tonight's roster — the same activeNpcIds/activeLocationIds the
    // standard path already persists as plannedNpcIds/plannedLocationIds — and
    // falls back to showing everything unrevealed when that roster is empty
    // (a freeform lazy session, or an adventure whose scenes carry no cast).
    const unrevealedSecrets = useMemo<Secret[]>(
        () => (campaign.secrets ?? []).filter(s => !s.isRevealed),
        [campaign.secrets]
    );

    const tonightsRoster = useMemo<Set<string>>(
        () => new Set([...activeNpcIds, ...activeLocationIds]),
        [activeNpcIds, activeLocationIds]
    );

    const secretsCheckList = useMemo<Secret[]>(() => {
        if (tonightsRoster.size === 0) return unrevealedSecrets;
        return unrevealedSecrets.filter(s => (s.linkedEntityIds ?? []).some(id => tonightsRoster.has(id)));
    }, [unrevealedSecrets, tonightsRoster]);

    // ── Step 5: Review / title ────────────────────────────────────────────────
    const sessionNumber = (campaign.sessionLogs?.length ?? 0) + 1;
    const defaultTitle = selectedAdventure
        ? `Session ${sessionNumber} — ${selectedAdventure.title}`
        : `Session ${sessionNumber}`;

    const [sessionTitle, setSessionTitle] = useState('');
    const [prepNotes, setPrepNotes] = useState('');
    const effectiveTitle = sessionTitle.trim() || defaultTitle;

    // ── Navigation ────────────────────────────────────────────────────────────
    const computeStepOrder = useCallback((): WizardStep[] => {
        // Lazy prep is a modifier, not a fork: it composes with the adventure
        // choice, so the shortened order applies whether or not one is picked.
        if (lazyPrepOn) {
            return LAZY_STEP_ORDER;
        }
        // If no adventure selected, skip scenes and entities steps
        if (!selectedAdventureId) {
            return ['adventure', 'plots', 'review'];
        }
        return STEP_ORDER;
    }, [lazyPrepOn, selectedAdventureId]);

    const goNext = useCallback(() => {
        const steps = computeStepOrder();
        const idx = steps.indexOf(currentStep);
        if (idx < steps.length - 1) setCurrentStep(steps[idx + 1]);
    }, [computeStepOrder, currentStep]);

    const goPrev = useCallback(() => {
        const steps = computeStepOrder();
        const idx = steps.indexOf(currentStep);
        if (idx > 0) setCurrentStep(steps[idx - 1]);
    }, [computeStepOrder, currentStep]);

    const isLastStep = useCallback(() => {
        const steps = computeStepOrder();
        return steps.indexOf(currentStep) === steps.length - 1;
    }, [computeStepOrder, currentStep]);

    // Display dot for a step — check if it's in the active flow
    const activeSteps = useMemo(() => computeStepOrder(), [computeStepOrder]);
    const displayIndex = activeSteps.indexOf(currentStep);
    // Derived from the active (possibly adventure-less, shortened) step order rather than
    // the fixed STEP_ORDER, so Back/Next reflect the flow actually being shown.
    const canGoPrev = displayIndex > 0;
    const canGoNext = displayIndex < activeSteps.length - 1;

    // ── Go Live ───────────────────────────────────────────────────────────────
    // CROSS-PACKAGE CONTRACT (verifier problem 3 / finding #26): plannedNpcIds
    // and plannedLocationIds below are the curated result of step 3 (extra +
    // auto-linked NPCs/locations minus anything the DM removed), persisted
    // onto the SessionLog. SessionRunner.tsx is the consumer: it prefers
    // these fields when present (arrays, possibly empty for a deliberate
    // all-removed curation) and falls back to the scene-derived sets only
    // when the fields are absent (`undefined`, for session logs created
    // before the fields existed) so older logs are unaffected.
    // Guards against a double-click minting two session logs — Go Live is a
    // one-way door (it also calls campaignService.goLive), so firing it twice
    // must never create a second session.
    const hasGoneLiveRef = useRef(false);

    const handleGoLive = useCallback(() => {
        if (hasGoneLiveRef.current) return;

        // Zero new schema: with the lazy path on, the strong start is folded
        // into prepNotes as a leading delimited section (see
        // composeStrongStartPrepNotes above); with it off, neither the strong
        // start nor the beats ship, even if the fields were filled in earlier.
        // The Go Live step's own cold open (P4) follows the identical rule in
        // the other direction: it folds in via the SAME encoding when lazy
        // prep is off, and is dropped exactly as the strong start is dropped
        // when lazy prep is on — `composeStrongStartPrepNotes('', prepNotes)`
        // is just `prepNotes.trim()`, so a `null`/blank draft here already
        // ships no markers at all.
        const finalPrepNotes = lazyPrepOn
            ? composeStrongStartPrepNotes(strongStart, prepNotes)
            : composeStrongStartPrepNotes(goLiveColdOpen ?? '', prepNotes);
        const finalBeats: Beat[] = lazyPrepOn
            ? lazyBeats
                .map(b => ({ id: b.id, title: b.title.trim(), isCompleted: false }))
                .filter(b => b.title.length > 0)
            : [];

        const sessionData: Omit<SessionLog, 'id'> = {
            title: effectiveTitle,
            status: 'planned' as const,
            sessionDate: new Date().toISOString(),
            adventureId: selectedAdventureId ?? undefined,
            plannedSceneIds: Array.from(selectedSceneIds),
            prepNotes: finalPrepNotes,
            plannedNpcIds: Array.from(activeNpcIds),
            plannedLocationIds: Array.from(activeLocationIds),
            runningNotes: '',
            structuredNotes: [],
            relatedPlotIds: Array.from(selectedPlotIds),
            encounterLog: [],
            beats: finalBeats,
            recap: '',
            notableEvents: '',
            looseEnds: '',
        };

        const newId = campaignService.createSessionLog(sessionData);
        // Latch only after the session actually exists: if createSessionLog
        // throws (storage/Immer), Go Live stays pressable instead of dying
        // silently until the dialog remounts.
        hasGoneLiveRef.current = true;
        campaignService.goLive(newId);
        onComplete(newId);
    }, [effectiveTitle, selectedAdventureId, selectedSceneIds, selectedPlotIds, prepNotes, activeNpcIds, activeLocationIds, lazyPrepOn, strongStart, goLiveColdOpen, lazyBeats, onComplete]);

    // ── Status badge colour ───────────────────────────────────────────────────
    const sceneStatusBadge = (status: Scene['status']) => {
        switch (status) {
            case 'in-progress':
                return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-600/30 text-amber-300 font-bold uppercase">In Progress</span>;
            case 'completed':
                return <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-500 font-bold uppercase">Done</span>;
            default:
                return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 font-bold uppercase">Planned</span>;
        }
    };

    const plotStatusBadge = (status: Plot['status']) => {
        switch (status) {
            case 'resolved':
                return <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/40 text-green-400 font-bold uppercase">Resolved</span>;
            case 'dormant':
                return <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-500 font-bold uppercase">Dormant</span>;
            default:
                return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-600/30 text-amber-300 font-bold uppercase">Active</span>;
        }
    };

    return (
        <DialogShell isOpen={true} onClose={onClose} ariaLabel="Session Prep Wizard" className="relative w-full max-w-2xl mx-4">
            {/* Modal */}
            <div className="relative w-full max-h-[90vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <Icons.Live className="w-5 h-5 text-amber-400" />
                        <h2 className="text-lg font-bold text-white font-serif">Session Prep Wizard</h2>
                    </div>
                    <Button variant="icon" onClick={onClose} className="text-slate-400 hover:text-white">
                        <Icons.X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Step Indicators */}
                <div className="flex items-center gap-1 px-6 py-3 border-b border-slate-800 overflow-x-auto" role="navigation" aria-label="Wizard steps">
                    {activeSteps.map((step, i) => (
                        <React.Fragment key={step}>
                            <button
                                onClick={() => setCurrentStep(step)}
                                aria-current={currentStep === step ? 'step' : undefined}
                                className={twMerge(
                                    'text-xs font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors whitespace-nowrap',
                                    currentStep === step
                                        ? 'bg-amber-600 text-white'
                                        : i < displayIndex
                                            ? 'text-green-400 hover:bg-slate-800'
                                            : 'text-slate-500 hover:bg-slate-800'
                                )}
                            >
                                {i < displayIndex && (
                                    <Icons.CheckCircle className="w-3 h-3 inline mr-1" />
                                )}
                                {STEP_LABELS[step]}
                                {currentStep === step && (
                                    <span className="sr-only">, Step {i + 1} of {activeSteps.length}</span>
                                )}
                            </button>
                            {i < activeSteps.length - 1 && (
                                <Icons.ChevronDown className="w-3 h-3 text-slate-600 rotate-[-90deg] flex-shrink-0" />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                {/* Content area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">

                    {/* ── STEP 1: Adventure ─────────────────────────────── */}
                    {currentStep === 'adventure' && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-bold text-white mb-1">Select an Adventure</h3>
                                <p className="text-xs text-slate-400">Choose the adventure this session will follow, or run a freeform session.</p>
                            </div>

                            {/* Lazy prep toggle — composes with whichever adventure choice is made below;
                                see docs/design/lazy-dm-lens.md §4 R1. */}
                            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800/60 p-3">
                                <div>
                                    <p className="text-sm font-semibold text-slate-200">Lazy prep</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Just a strong start, a few beats, and a glance at your secrets.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setLazyPrepOn(v => !v)}
                                    aria-pressed={lazyPrepOn}
                                    className={twMerge(
                                        'flex-shrink-0 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border transition-colors',
                                        lazyPrepOn
                                            ? 'bg-amber-600 text-white border-amber-500'
                                            : 'bg-slate-800 text-slate-400 border-slate-600 hover:border-slate-500'
                                    )}
                                >
                                    {lazyPrepOn ? 'Lazy prep: on' : 'Lazy prep: off'}
                                </button>
                            </div>

                            {/* Freeform option */}
                            <button
                                onClick={() => handleSelectAdventure(null)}
                                className={twMerge(
                                    'w-full text-left rounded-lg border p-4 transition-all',
                                    selectedAdventureId === null
                                        ? 'border-amber-500 bg-amber-900/20 ring-1 ring-amber-500/40'
                                        : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={twMerge(
                                        'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                                        selectedAdventureId === null ? 'border-amber-400 bg-amber-400' : 'border-slate-500'
                                    )}>
                                        {selectedAdventureId === null && <div className="w-2 h-2 rounded-full bg-slate-900" />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-200">No adventure (freeform session)</p>
                                        <p className="text-xs text-slate-500 mt-0.5">Run an unstructured session without pre-planned scenes.</p>
                                    </div>
                                </div>
                            </button>

                            {/* Adventure cards */}
                            {campaign.adventures.length === 0 && (
                                <div className="text-center py-6 bg-slate-800/40 rounded-lg border border-dashed border-slate-700">
                                    <Icons.Adventures className="w-7 h-7 text-slate-600 mx-auto mb-2" />
                                    <p className="text-sm text-slate-500">No adventures yet. Create one from the Adventures section.</p>
                                </div>
                            )}

                            {campaign.adventures.map(adventure => (
                                <button
                                    key={adventure.id}
                                    onClick={() => handleSelectAdventure(adventure.id)}
                                    className={twMerge(
                                        'w-full text-left rounded-lg border p-4 transition-all',
                                        selectedAdventureId === adventure.id
                                            ? 'border-amber-500 bg-amber-900/20 ring-1 ring-amber-500/40'
                                            : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={twMerge(
                                            'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                                            selectedAdventureId === adventure.id ? 'border-amber-400 bg-amber-400' : 'border-slate-500'
                                        )}>
                                            {selectedAdventureId === adventure.id && <div className="w-2 h-2 rounded-full bg-slate-900" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-semibold text-amber-200 truncate">{adventure.title}</p>
                                                <span className="text-xs text-slate-500 flex-shrink-0">
                                                    {adventure.scenes.length} scene{adventure.scenes.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            {adventure.hook && (
                                                <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{adventure.hook}</p>
                                            )}
                                            {adventure.theme && (
                                                <p className="text-xs text-slate-600 mt-1 italic">{adventure.theme}</p>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── LAZY STEP: Strong Start ───────────────────────── */}
                    {currentStep === 'strongStart' && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-bold text-white mb-1">Strong Start</h3>
                                <p className="text-xs text-slate-400">
                                    One good opening line covers a multitude of scenes you never got around to prepping.
                                </p>
                            </div>
                            <div>
                                <label
                                    htmlFor="strong-start-field"
                                    className="block text-sm text-slate-300 mb-2"
                                >
                                    Write the first thing you'll say when the session starts
                                </label>
                                <textarea
                                    id="strong-start-field"
                                    value={strongStart}
                                    onChange={e => setStrongStart(e.target.value)}
                                    rows={6}
                                    placeholder={'e.g. "The bell in the drowned chapel starts ringing by itself."'}
                                    className={`${textareaBaseClasses} w-full px-3 py-2 text-sm`}
                                />
                            </div>

                            {/* P4: draft it instead of staring at the blank field. */}
                            {canDraftColdOpen ? (
                                <div>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handleDraftColdOpen(setStrongStart)}
                                        disabled={coldOpenPhase === 'loading'}
                                    >
                                        <Icons.Sparkles className="w-4 h-4 mr-1.5" />
                                        Draft it from last session
                                    </Button>
                                    {coldOpenPhase === 'error' && (
                                        <p role="status" className="text-xs text-red-400 mt-2">
                                            That didn't come through. Try it again in a moment.
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500 italic">
                                    Star a moment at the table or write a recap when the session ends, and this drafts itself.
                                </p>
                            )}
                        </div>
                    )}

                    {/* ── LAZY STEP: Beats ──────────────────────────────── */}
                    {currentStep === 'beats' && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-bold text-white mb-1">Beats</h3>
                                <p className="text-xs text-slate-400">
                                    A loose list of scenes you might hit tonight — not a script. Check them off or drop them live in the Session Runner.
                                </p>
                            </div>

                            <div className="space-y-2">
                                {lazyBeats.map((beat, idx) => (
                                    <div key={beat.id} className="flex items-center gap-2">
                                        <span className="text-xs text-slate-600 font-mono w-5 flex-shrink-0">{idx + 1}</span>
                                        <input
                                            type="text"
                                            value={beat.title}
                                            onChange={e => updateLazyBeatTitle(beat.id, e.target.value)}
                                            aria-label={`Beat ${idx + 1}`}
                                            className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                                        />
                                        <Button
                                            variant="icon"
                                            onClick={() => removeLazyBeat(beat.id)}
                                            aria-label={`Remove beat ${idx + 1}`}
                                            title={`Remove beat ${idx + 1}`}
                                            className="text-slate-500 hover:text-red-400 flex-shrink-0"
                                        >
                                            <Icons.X className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                ))}
                                {lazyBeats.length === 0 && (
                                    <p className="text-xs text-slate-600 italic">No beats yet — add one below.</p>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <label htmlFor="add-beat-field" className="sr-only">Add a beat</label>
                                <input
                                    id="add-beat-field"
                                    type="text"
                                    value={beatDraft}
                                    onChange={e => setBeatDraft(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') addLazyBeat(); }}
                                    placeholder="Add a beat..."
                                    className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                                />
                                <Button
                                    variant="secondary"
                                    onClick={addLazyBeat}
                                    disabled={!beatDraft.trim()}
                                    className="flex-shrink-0"
                                    title="Add beat"
                                >
                                    <Icons.Plus className="w-4 h-4 mr-1" />
                                    Add beat
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ── LAZY STEP: Secrets Check ──────────────────────── */}
                    {currentStep === 'secretsCheck' && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-bold text-white mb-1">Secrets Check</h3>
                                <p className="text-xs text-slate-400">
                                    A last glance at what's still unrevealed before the table sits down. Nothing here can be edited — open the Secrets & Clues Tracker for that.
                                </p>
                            </div>

                            {secretsCheckList.length === 0 ? (
                                <div className="text-center py-8 bg-slate-800/40 rounded-lg border border-dashed border-slate-700">
                                    <Icons.Eye className="w-7 h-7 text-slate-600 mx-auto mb-2" />
                                    <p className="text-sm text-slate-500">No secrets to glance at right now.</p>
                                </div>
                            ) : (
                                <ul className="space-y-2">
                                    {secretsCheckList.map(secret => (
                                        <li key={secret.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                                            <p className="text-sm font-medium text-slate-200">{secret.title}</p>
                                            {secret.content && (
                                                <p className="text-xs text-slate-500 mt-0.5">{secret.content}</p>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {/* ── STEP 2: Scenes ───────────────────────────────── */}
                    {currentStep === 'scenes' && selectedAdventure && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-white mb-1">Select Scenes</h3>
                                    <p className="text-xs text-slate-400">
                                        Choose which scenes from <span className="text-amber-300 font-medium">{selectedAdventure.title}</span> to run this session.
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={selectAllScenes} variant="secondary" size="sm">All</Button>
                                    <Button onClick={deselectAllScenes} variant="secondary" size="sm">None</Button>
                                </div>
                            </div>

                            {selectedAdventure.scenes.length === 0 ? (
                                <div className="text-center py-8 bg-slate-800/40 rounded-lg border border-dashed border-slate-700">
                                    <Icons.Scenes className="w-7 h-7 text-slate-600 mx-auto mb-2" />
                                    <p className="text-sm text-slate-500">This adventure has no scenes yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {selectedAdventure.scenes.map((scene, idx) => {
                                        const checked = selectedSceneIds.has(scene.id);
                                        return (
                                            <button
                                                key={scene.id}
                                                onClick={() => toggleScene(scene.id)}
                                                className={twMerge(
                                                    'w-full text-left rounded-lg border p-3 transition-all flex items-center gap-3',
                                                    checked
                                                        ? 'border-amber-500/60 bg-amber-900/10'
                                                        : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                                                )}
                                            >
                                                <div className={twMerge(
                                                    'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0',
                                                    checked ? 'border-amber-400 bg-amber-500' : 'border-slate-500 bg-transparent'
                                                )}>
                                                    {checked && <Icons.Check className="w-3 h-3 text-white" />}
                                                </div>
                                                <span className="text-xs text-slate-600 font-mono w-5 flex-shrink-0">{idx + 1}</span>
                                                <SceneIcon type={scene.type} className="w-4 h-4 mr-0 text-slate-400 flex-shrink-0" />
                                                <span className="flex-1 text-sm font-medium text-slate-200 truncate">{scene.title}</span>
                                                {sceneStatusBadge(scene.status)}
                                                {scene.npcIds.length > 0 && (
                                                    <span className="text-xs text-slate-600 flex items-center gap-0.5 flex-shrink-0">
                                                        <Icons.NPCs className="w-3 h-3" /> {scene.npcIds.length}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            <p className="text-xs text-slate-600 text-right">
                                {selectedSceneIds.size} of {selectedAdventure.scenes.length} selected
                            </p>
                        </div>
                    )}

                    {/* ── STEP 3: NPCs & Locations ─────────────────────── */}
                    {currentStep === 'entities' && (
                        <div className="space-y-5">
                            <div>
                                <h3 className="text-sm font-bold text-white mb-1">NPCs & Locations</h3>
                                <p className="text-xs text-slate-400">These are gathered automatically from your selected scenes. Add or remove as needed.</p>
                            </div>

                            {/* Missing references warning */}
                            {(missingNpcs.length > 0 || missingLocations.length > 0) && (
                                <div className="bg-red-900/10 border border-red-800/40 rounded-lg p-3 space-y-1">
                                    <p className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1">
                                        <Icons.AlertTriangle className="w-3 h-3" /> Missing References
                                    </p>
                                    {missingNpcs.map(r => (
                                        <p key={r.id} className="text-xs text-red-300">NPC ID <code className="font-mono bg-red-900/20 px-1 rounded">{r.id}</code> not found in campaign.</p>
                                    ))}
                                    {missingLocations.map(r => (
                                        <p key={r.id} className="text-xs text-red-300">Location ID <code className="font-mono bg-red-900/20 px-1 rounded">{r.id}</code> not found in campaign.</p>
                                    ))}
                                </div>
                            )}

                            {/* NPCs */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <Icons.NPCs className="w-3.5 h-3.5" /> NPCs ({resolvedNpcs.filter(r => r.npc !== null).length})
                                </h4>
                                <div className="space-y-2 mb-2">
                                    {resolvedNpcs.filter(r => r.npc !== null).map(({ npc, id }) => {
                                        const wasAuto = sceneLinkedNpcIds.has(id);
                                        const isActive = activeNpcIds.has(id);
                                        return (
                                            <div
                                                key={id}
                                                className={twMerge(
                                                    'flex items-center gap-3 rounded-lg border p-3',
                                                    isActive ? 'border-slate-700 bg-slate-800' : 'border-slate-800 bg-slate-900 opacity-50'
                                                )}
                                            >
                                                <div className="w-7 h-7 rounded-full bg-amber-900/40 border border-amber-700/40 flex items-center justify-center flex-shrink-0">
                                                    <Icons.NPCs className="w-3.5 h-3.5 text-amber-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-200 truncate">{npc!.name}</p>
                                                    {npc!.description && <p className="text-xs text-slate-500 truncate">{npc!.description}</p>}
                                                </div>
                                                {wasAuto && (
                                                    <span className="text-[10px] text-slate-600 uppercase tracking-wider flex-shrink-0">auto</span>
                                                )}
                                                <button
                                                    onClick={() => toggleNpc(id, wasAuto)}
                                                    className={twMerge(
                                                        'p-1 rounded transition-colors',
                                                        isActive
                                                            ? 'text-slate-500 hover:text-red-400 hover:bg-red-900/20'
                                                            : 'text-green-500 hover:bg-green-900/20'
                                                    )}
                                                    title={isActive ? 'Remove from session' : 'Add back to session'}
                                                >
                                                    {isActive ? <Icons.Minus className="w-3.5 h-3.5" /> : <Icons.Plus className="w-3.5 h-3.5" />}
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {resolvedNpcs.filter(r => r.npc !== null).length === 0 && (
                                        <p className="text-xs text-slate-600 italic">No NPCs from selected scenes.</p>
                                    )}
                                </div>

                                {/* Add extra NPCs */}
                                {extraNpcPool.length > 0 && (
                                    <div className="space-y-1.5">
                                        <div className="relative">
                                            <Icons.Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                                            <input
                                                type="text"
                                                value={npcSearchTerm}
                                                onChange={e => setNpcSearchTerm(e.target.value)}
                                                placeholder="Search NPCs to add..."
                                                className="w-full bg-slate-800 border border-slate-700 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                                            />
                                        </div>
                                        {filteredExtraNpcs.length === 0 ? (
                                            <p className="text-xs text-slate-600 italic px-1">No NPCs match your search.</p>
                                        ) : (
                                            filteredExtraNpcs.map(npc => {
                                                const isAdded = extraNpcIds.has(npc.id);
                                                return (
                                                    <button
                                                        key={npc.id}
                                                        onClick={() => toggleNpc(npc.id, false)}
                                                        className={twMerge(
                                                            'w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors',
                                                            isAdded
                                                                ? 'bg-slate-700 text-amber-300'
                                                                : 'bg-slate-800/50 text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                                                        )}
                                                    >
                                                        {isAdded
                                                            ? <Icons.Check className="w-3 h-3 text-amber-400 flex-shrink-0" />
                                                            : <Icons.Plus className="w-3 h-3 flex-shrink-0" />
                                                        }
                                                        {npc.name}
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Locations */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <Icons.Locations className="w-3.5 h-3.5" /> Locations ({resolvedLocations.filter(r => r.loc !== null).length})
                                </h4>
                                <div className="space-y-2 mb-2">
                                    {resolvedLocations.filter(r => r.loc !== null).map(({ loc, id }) => {
                                        const wasAuto = sceneLinkedLocationIds.has(id);
                                        const isActive = activeLocationIds.has(id);
                                        return (
                                            <div
                                                key={id}
                                                className={twMerge(
                                                    'flex items-center gap-3 rounded-lg border p-3',
                                                    isActive ? 'border-slate-700 bg-slate-800' : 'border-slate-800 bg-slate-900 opacity-50'
                                                )}
                                            >
                                                <div className="w-7 h-7 rounded-full bg-blue-900/40 border border-blue-700/40 flex items-center justify-center flex-shrink-0">
                                                    <Icons.MapPin className="w-3.5 h-3.5 text-blue-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-200 truncate">{loc!.name}</p>
                                                    {loc!.description && <p className="text-xs text-slate-500 truncate">{loc!.description}</p>}
                                                </div>
                                                {wasAuto && (
                                                    <span className="text-[10px] text-slate-600 uppercase tracking-wider flex-shrink-0">auto</span>
                                                )}
                                                <button
                                                    onClick={() => toggleLocation(id, wasAuto)}
                                                    className={twMerge(
                                                        'p-1 rounded transition-colors',
                                                        isActive
                                                            ? 'text-slate-500 hover:text-red-400 hover:bg-red-900/20'
                                                            : 'text-green-500 hover:bg-green-900/20'
                                                    )}
                                                    title={isActive ? 'Remove from session' : 'Add back to session'}
                                                >
                                                    {isActive ? <Icons.Minus className="w-3.5 h-3.5" /> : <Icons.Plus className="w-3.5 h-3.5" />}
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {resolvedLocations.filter(r => r.loc !== null).length === 0 && (
                                        <p className="text-xs text-slate-600 italic">No locations from selected scenes.</p>
                                    )}
                                </div>

                                {/* Add extra locations */}
                                {extraLocationPool.length > 0 && (
                                    <div className="space-y-1.5">
                                        <div className="relative">
                                            <Icons.Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                                            <input
                                                type="text"
                                                value={locationSearchTerm}
                                                onChange={e => setLocationSearchTerm(e.target.value)}
                                                placeholder="Search locations to add..."
                                                className="w-full bg-slate-800 border border-slate-700 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                                            />
                                        </div>
                                        {filteredExtraLocations.length === 0 ? (
                                            <p className="text-xs text-slate-600 italic px-1">No locations match your search.</p>
                                        ) : (
                                            filteredExtraLocations.map(loc => {
                                                const isAdded = extraLocationIds.has(loc.id);
                                                return (
                                                    <button
                                                        key={loc.id}
                                                        onClick={() => toggleLocation(loc.id, false)}
                                                        className={twMerge(
                                                            'w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors',
                                                            isAdded
                                                                ? 'bg-slate-700 text-amber-300'
                                                                : 'bg-slate-800/50 text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                                                        )}
                                                    >
                                                        {isAdded
                                                            ? <Icons.Check className="w-3 h-3 text-amber-400 flex-shrink-0" />
                                                            : <Icons.Plus className="w-3 h-3 flex-shrink-0" />
                                                        }
                                                        {loc.name}
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── STEP 4: Plot Threads ──────────────────────────── */}
                    {currentStep === 'plots' && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-bold text-white mb-1">Plot Threads</h3>
                                <p className="text-xs text-slate-400">Mark which plot arcs are relevant to this session.</p>
                            </div>

                            {activePlots.length === 0 && (
                                <div className="text-center py-8 bg-slate-800/40 rounded-lg border border-dashed border-slate-700">
                                    <Icons.Plot className="w-7 h-7 text-slate-600 mx-auto mb-2" />
                                    <p className="text-sm text-slate-500">No active plot threads.</p>
                                    <p className="text-xs text-slate-600 mt-1">Create plots from the Plots section.</p>
                                </div>
                            )}

                            {activePlots.map(plot => {
                                const selected = selectedPlotIds.has(plot.id);
                                return (
                                    <button
                                        key={plot.id}
                                        onClick={() => togglePlot(plot.id)}
                                        className={twMerge(
                                            'w-full text-left rounded-lg border p-4 transition-all flex items-start gap-3',
                                            selected
                                                ? 'border-amber-500/60 bg-amber-900/10'
                                                : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                                        )}
                                    >
                                        <div className={twMerge(
                                            'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                                            selected ? 'border-amber-400 bg-amber-500' : 'border-slate-500 bg-transparent'
                                        )}>
                                            {selected && <Icons.Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <p className="text-sm font-semibold text-amber-200 truncate">{plot.title}</p>
                                                {plotStatusBadge(plot.status)}
                                            </div>
                                            {plot.description && (
                                                <p className="text-xs text-slate-400 line-clamp-2">{plot.description}</p>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}

                            {/* All plots (dormant/resolved) if user wants to pick them */}
                            {campaign.plots.filter(p => p.status !== 'active').length > 0 && (
                                <details className="group">
                                    <summary className="cursor-pointer text-xs text-slate-600 hover:text-slate-400 transition-colors">
                                        Show resolved / dormant plots ({campaign.plots.filter(p => p.status !== 'active').length})
                                    </summary>
                                    <div className="mt-2 space-y-2">
                                        {campaign.plots.filter(p => p.status !== 'active').map(plot => {
                                            const selected = selectedPlotIds.has(plot.id);
                                            return (
                                                <button
                                                    key={plot.id}
                                                    onClick={() => togglePlot(plot.id)}
                                                    className={twMerge(
                                                        'w-full text-left rounded-lg border p-3 transition-all flex items-start gap-3 opacity-60 hover:opacity-80',
                                                        selected
                                                            ? 'border-amber-500/60 bg-amber-900/10'
                                                            : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                                                    )}
                                                >
                                                    <div className={twMerge(
                                                        'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                                                        selected ? 'border-amber-400 bg-amber-500' : 'border-slate-600 bg-transparent'
                                                    )}>
                                                        {selected && <Icons.Check className="w-3 h-3 text-white" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <p className="text-sm font-medium text-slate-300 truncate">{plot.title}</p>
                                                            {plotStatusBadge(plot.status)}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </details>
                            )}
                        </div>
                    )}

                    {/* ── STEP 5: Review & Go Live ─────────────────────── */}
                    {currentStep === 'review' && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-bold text-white mb-1">Review & Go Live</h3>
                                <p className="text-xs text-slate-400">Confirm your session setup, set a title, then start the session.</p>
                            </div>

                            {/* Title input */}
                            <div>
                                <label htmlFor="session-title-field" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Session Title</label>
                                <input
                                    id="session-title-field"
                                    type="text"
                                    value={sessionTitle}
                                    onChange={e => setSessionTitle(e.target.value)}
                                    placeholder={defaultTitle}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                                />
                            </div>

                            {/* Summary cards */}
                            <div className="space-y-3">
                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <Icons.Adventures className="w-3.5 h-3.5" /> Adventure
                                    </h4>
                                    {selectedAdventure ? (
                                        <p className="text-sm text-amber-200 font-medium">{selectedAdventure.title}</p>
                                    ) : (
                                        <p className="text-sm text-slate-500 italic">Freeform session — no adventure selected</p>
                                    )}
                                </div>

                                {selectedAdventure && (
                                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                            <Icons.Scenes className="w-3.5 h-3.5" /> Scenes Planned
                                        </h4>
                                        {selectedSceneIds.size > 0 ? (
                                            <ul className="space-y-1">
                                                {selectedAdventure.scenes
                                                    .filter(s => selectedSceneIds.has(s.id))
                                                    .map(s => (
                                                        <li key={s.id} className="flex items-center gap-2 text-sm text-slate-300">
                                                            <SceneIcon type={s.type} className="w-3.5 h-3.5 mr-0 text-slate-500 flex-shrink-0" />
                                                            {s.title}
                                                        </li>
                                                    ))
                                                }
                                            </ul>
                                        ) : (
                                            <p className="text-sm text-slate-500 italic">No scenes selected</p>
                                        )}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                            <Icons.NPCs className="w-3 h-3" /> NPCs
                                        </h4>
                                        <p className="text-2xl font-bold text-amber-300">{resolvedNpcs.filter(r => r.npc !== null).length}</p>
                                    </div>
                                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                            <Icons.Locations className="w-3 h-3" /> Locations
                                        </h4>
                                        <p className="text-2xl font-bold text-blue-300">{resolvedLocations.filter(r => r.loc !== null).length}</p>
                                    </div>
                                </div>

                                {selectedPlotIds.size > 0 && (
                                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                            <Icons.Plot className="w-3.5 h-3.5" /> Active Plot Threads
                                        </h4>
                                        <ul className="space-y-1">
                                            {Array.from(selectedPlotIds).map(id => {
                                                const plot = campaign.plots.find(p => p.id === id);
                                                return plot ? (
                                                    <li key={id} className="text-sm text-slate-300 flex items-center gap-2">
                                                        <Icons.Target className="w-3 h-3 text-slate-600 flex-shrink-0" />
                                                        {plot.title}
                                                    </li>
                                                ) : null;
                                            })}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {/* P4: the cold open — off the lazy path, this step owns the question
                                instead of the Strong Start step. Never both at once. */}
                            {!lazyPrepOn && (
                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                        <Icons.Sparkles className="w-3.5 h-3.5" /> Cold open
                                    </h4>
                                    {canDraftColdOpen ? (
                                        <>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => handleDraftColdOpen(setGoLiveColdOpen)}
                                                disabled={coldOpenPhase === 'loading'}
                                            >
                                                <Icons.Sparkles className="w-4 h-4 mr-1.5" />
                                                Draft it from last session
                                            </Button>
                                            {coldOpenPhase === 'error' && (
                                                <p role="status" className="text-xs text-red-400">
                                                    That didn't come through. Try it again in a moment.
                                                </p>
                                            )}
                                            {goLiveColdOpen !== null && (
                                                <div>
                                                    <label htmlFor="cold-open-field" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                                        Read this to open the session
                                                    </label>
                                                    <textarea
                                                        id="cold-open-field"
                                                        value={goLiveColdOpen}
                                                        onChange={e => setGoLiveColdOpen(e.target.value)}
                                                        rows={4}
                                                        className={`${textareaBaseClasses} w-full px-3 py-2 text-sm`}
                                                    />
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-xs text-slate-500 italic">
                                            Star a moment at the table or write a recap when the session ends, and this drafts itself.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Prep Notes */}
                            <div>
                                <label htmlFor="prep-notes-field" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    Prep Notes <span className="font-normal text-slate-600 normal-case tracking-normal">(optional)</span>
                                </label>
                                <textarea
                                    id="prep-notes-field"
                                    value={prepNotes}
                                    onChange={e => setPrepNotes(e.target.value)}
                                    rows={4}
                                    placeholder={'e.g. "Use a Scottish accent for Angus"\n"The thieves\' guild contact arrives at the docks"\n"Players may skip the dungeon — prep the shortcut path"'}
                                    className={`${textareaBaseClasses} w-full px-3 py-2 text-sm`}
                                />
                                <p className="text-xs text-slate-600 mt-1">
                                    Personal reminders, accents, contingencies — only you see this.
                                </p>
                            </div>

                            <div className="bg-amber-900/10 border border-amber-800/30 rounded-lg p-4">
                                <p className="text-sm text-amber-200">
                                    <Icons.Live className="w-4 h-4 inline mr-1.5 text-amber-400" />
                                    Clicking <strong>Go Live</strong> will create the session log and start tracking immediately.
                                </p>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Navigation */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700">
                    <div>
                        {canGoPrev ? (
                            <Button onClick={goPrev} variant="secondary">
                                <Icons.ChevronDown className="w-4 h-4 mr-1 rotate-90" />
                                Back
                            </Button>
                        ) : (
                            <Button onClick={onClose} variant="ghost" className="text-slate-400">
                                Cancel
                            </Button>
                        )}
                    </div>
                    <div>
                        {isLastStep() ? (
                            <Button onClick={handleGoLive} className="bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-500/20">
                                <Icons.Play className="w-4 h-4 mr-2" />
                                Go Live
                            </Button>
                        ) : (
                            <Button onClick={goNext}>
                                Next
                                <Icons.ChevronDown className="w-4 h-4 ml-1 rotate-[-90deg]" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </DialogShell>
    );
};
