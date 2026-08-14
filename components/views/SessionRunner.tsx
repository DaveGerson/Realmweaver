
import React, { useState, useMemo, useCallback, useEffect, useRef, Suspense } from 'react';
import type { Campaign, Scene, SessionLog, NPC, Combatant, CombatantType, Encounter, PlotSessionStatus } from '@/types';
import { Icons } from '@/components/common/Icons';
import { Button } from '@/components/common/Button';
import { twMerge } from 'tailwind-merge';
import { campaignService } from '@/services/campaignService';
import { CombatTracker } from '@/components/tools/CombatTracker';
import { DialogShell } from '@/components/common/DialogShell';
// Lazy-loaded — only bundled when the session end flow is triggered
const SessionEndWizard = React.lazy(() => import('@/components/dialogs/SessionEndWizard').then(m => ({ default: m.SessionEndWizard })));
import { estimatePcHp } from '@/utils/entityUtils';
import { isFeatureVisible } from '@/utils/dmStyleUtils';
import type { QuickCardEntityType } from '@/components/common/EntityQuickCard';
import { SceneListPanel } from './session/SceneListPanel';
import { ActiveScenePanel } from './session/ActiveScenePanel';
import { QuickToolsPanel } from './session/QuickToolsPanel';
import { RunningLog } from './session/RunningLog';

/** Try to extract HP from a freeform NPC stats string. Returns null if not found. */
const parseHpFromStats = (stats: string | undefined): number | null => {
    if (!stats) return null;
    const match = stats.match(/(?:hp|hit\s*points)\s*[:=\-–—]?\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
};

interface SessionRunnerProps {
    campaign: Campaign;
    sessionLog: SessionLog;
    isMockMode: boolean;
    onEndSession: () => void;
    onOpenCoach: () => void;
    onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
}

export const SessionRunner: React.FC<SessionRunnerProps> = ({
    campaign,
    sessionLog,
    isMockMode,
    onEndSession,
    onOpenCoach,
    onNavigate,
}) => {
    // Derive feature visibility from campaign's DM style settings
    const _dmStyle = campaign.dmStyle ?? 'standard';
    const _featureOverrides = campaign.featureOverrides ?? {};
    const canShowCombatTracker = isFeatureVisible('combat-tracker', _dmStyle, _featureOverrides);
    const canShowSecretsTracker = isFeatureVisible('secrets-tracker', _dmStyle, _featureOverrides);

    // Session timer — M21: use persisted startedAt from sessionLog so the timer
    // survives navigation away and back. Fall back to Date.now() only if not set yet.
    const startedAtRef = useRef<number>(
        sessionLog.startedAt
            ? new Date(sessionLog.startedAt).getTime()
            : Date.now()
    );
    const [elapsedMinutes, setElapsedMinutes] = useState(0);

    // Persist the start timestamp on first mount when it is not already saved
    useEffect(() => {
        if (!sessionLog.startedAt) {
            campaignService.setSessionStartedAt(sessionLog.id, new Date(startedAtRef.current).toISOString());
        }
    // Run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const tick = () => {
            setElapsedMinutes(Math.floor((Date.now() - startedAtRef.current) / 60000));
        };
        tick();
        const id = setInterval(tick, 60000);
        return () => clearInterval(id);
    }, []);

    const elapsedDisplay = (() => {
        const h = Math.floor(elapsedMinutes / 60);
        const m = elapsedMinutes % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    })();

    // Top-level UI state
    const [showEndWizard, setShowEndWizard] = useState(false);
    const [showCombatPanel, setShowCombatPanel] = useState(false);
    const [mobileTab, setMobileTab] = useState<'scenes' | 'active' | 'tools'>('active');
    const [fabOpen, setFabOpen] = useState(false);
    const fabMenuRef = useRef<HTMLDivElement>(null);
    const fabButtonRef = useRef<HTMLButtonElement>(null);

    // Finding #57: the FAB menu's arrow-key/Escape handler lives on the menu
    // <div> itself, so it only fires once focus is already inside the menu.
    // Nothing moved focus there on open — mirror Header's requestAnimationFrame
    // pattern here, and return focus to the FAB button when the menu closes.
    useEffect(() => {
        if (!fabOpen) return;
        const frame = requestAnimationFrame(() => {
            const first = fabMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
            first?.focus();
        });
        return () => {
            cancelAnimationFrame(frame);
            fabButtonRef.current?.focus();
        };
    }, [fabOpen]);

    // Finding #56: the Combat Tracker slide-out is a full modal but had no
    // Escape handling. DialogShell's own Escape handler only fires when the
    // event bubbles up through its own subtree; a document-level listener
    // (mirroring DmCoach's pattern) also catches an Escape dispatched
    // directly at `document`.
    //
    // Verifier follow-up: this listener fired for ANY Escape while
    // showCombatPanel was true, with no defaultPrevented check — bypassing
    // DialogShell's own cross-package guard (a child that already consumed
    // Escape marks it defaultPrevented, and the dialog must stay open) and
    // closing the combat panel out from under a modal opened on top of it
    // (e.g. Escape dismissing the SessionEndWizard would also close the
    // combat tracker underneath). Guard it the same way DialogShell does.
    useEffect(() => {
        if (!showCombatPanel) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (e.defaultPrevented) return;
            setShowCombatPanel(false);
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [showCombatPanel]);

    // Plot session status tracking (persisted on sessionLog)
    const plotSessionStatus = sessionLog.plotProgressions || {};

    // --- Derived data ---

    const adventure = useMemo(() =>
        sessionLog.adventureId
            ? campaign.adventures.find(a => a.id === sessionLog.adventureId) || null
            : null,
        [campaign.adventures, sessionLog.adventureId]
    );

    const plannedScenes = useMemo(() => {
        if (!adventure) return [];
        return sessionLog.plannedSceneIds
            .map(id => adventure.scenes.find(s => s.id === id))
            .filter((s): s is Scene => !!s);
    }, [adventure, sessionLog.plannedSceneIds]);

    const activeScene = useMemo(() => {
        if (!campaign.activeSceneId || !adventure) return null;
        return adventure.scenes.find(s => s.id === campaign.activeSceneId) || null;
    }, [campaign.activeSceneId, adventure]);

    const activeSceneLocation = useMemo(() => {
        if (!activeScene?.locationId) return null;
        return campaign.locations.find(l => l.id === activeScene.locationId) || null;
    }, [activeScene, campaign.locations]);

    const activeSceneNpcs = useMemo(() => {
        if (!activeScene) return [];
        return activeScene.npcIds
            .map(id => campaign.npcs.find(n => n.id === id))
            .filter((n): n is NPC => !!n);
    }, [activeScene, campaign.npcs]);

    const sceneNpcRelationshipMap = useMemo(() => {
        const sceneNpcIds = new Set(activeSceneNpcs.map(n => n.id));
        const map = new Map<string, { relationType: string; targetId: string; targetName: string }[]>();
        for (const npc of activeSceneNpcs) {
            const rels = (npc.relationships ?? []).filter(r => sceneNpcIds.has(r.targetId));
            if (rels.length > 0) {
                map.set(npc.id, rels.map(r => ({
                    relationType: r.relationType,
                    targetId: r.targetId,
                    targetName: campaign.npcs.find(n => n.id === r.targetId)?.name ?? r.targetId,
                })));
            }
        }
        return map;
    }, [activeSceneNpcs, campaign.npcs]);

    const castDynamicsSummary = useMemo(() => {
        if (sceneNpcRelationshipMap.size === 0) return null;
        const parts: string[] = [];
        for (const [npcId, rels] of sceneNpcRelationshipMap) {
            const npcName = activeSceneNpcs.find(n => n.id === npcId)?.name ?? npcId;
            for (const r of rels) {
                parts.push(`${npcName} ${r.relationType.toLowerCase()}s ${r.targetName}`);
            }
        }
        if (parts.length === 0) return null;
        return 'Cast dynamics: ' + parts.join('. ') + '.';
    }, [sceneNpcRelationshipMap, activeSceneNpcs]);

    const previousSession = useMemo(() => {
        const completed = campaign.sessionLogs
            .filter(s => s.status === 'completed')
            .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
        return completed[0] || null;
    }, [campaign.sessionLogs]);

    // --- Handlers ---

    const handleSelectScene = (sceneId: string) => {
        if (!adventure) return;
        if (campaign.activeSceneId && campaign.activeSceneId !== sceneId) {
            campaignService.setSceneStatus(adventure.id, campaign.activeSceneId, 'completed');
        }
        campaignService.setSceneStatus(adventure.id, sceneId, 'in-progress');
        campaignService.setActiveScene(sceneId);
    };

    const handleAdvanceScene = () => {
        campaignService.advanceScene();
    };

    const handleEndSession = () => {
        setShowEndWizard(true);
    };

    const handleOpenCombat = useCallback(() => {
        const encounter = campaign.activeEncounter;
        if (!encounter || encounter.combatants.length === 0) {
            const autoCombatants: Combatant[] = [
                ...activeSceneNpcs.map(npc => {
                    const parsedHp = parseHpFromStats(npc.stats);
                    return {
                        id: crypto.randomUUID(),
                        name: npc.name,
                        type: 'npc' as CombatantType,
                        initiative: 0,
                        hp: parsedHp ?? 10,
                        maxHp: parsedHp ?? 10,
                        notes: npc.traits || '',
                    };
                }),
                ...(campaign.playerCharacters || []).map(pc => {
                    const pcHp = estimatePcHp(pc);
                    return {
                        id: crypto.randomUUID(),
                        name: pc.characterSocial.characterName,
                        type: 'pc' as CombatantType,
                        initiative: 0,
                        hp: pcHp,
                        maxHp: pcHp,
                        notes: '',
                    };
                })
            ];
            const newEncounter: Encounter = {
                id: encounter ? encounter.id : crypto.randomUUID(),
                round: encounter ? encounter.round : 1,
                turnIndex: 0,
                combatants: autoCombatants,
                sessionId: sessionLog.id,
                sceneId: campaign.activeSceneId || undefined,
            };
            campaignService.updateEncounter(newEncounter);
        }
        setShowCombatPanel(true);
    }, [activeSceneNpcs, campaign.activeEncounter, campaign.playerCharacters, campaign.activeSceneId, sessionLog.id]);

    const handleUpdateEncounter = useCallback((updatedEncounter: Encounter) => {
        campaignService.updateEncounter(updatedEncounter);
    }, []);

    const handleEndCombat = useCallback(() => {
        const encounter = campaign.activeEncounter;
        if (!encounter) return;
        const combatantCount = encounter.combatants.length;
        const rounds = encounter.round;
        campaignService.addAutoEvent(
            'combat',
            `Combat ended. ${combatantCount} combatant${combatantCount !== 1 ? 's' : ''}, ${rounds} round${rounds !== 1 ? 's' : ''}.`
        );
        campaignService.updateEncounter({ ...encounter, combatants: [], round: 1, turnIndex: 0 });
        setShowCombatPanel(false);
    }, [campaign.activeEncounter]);

    const cyclePlotStatus = useCallback((plotId: string) => {
        const current = plotSessionStatus[plotId] || 'unchanged';
        const next: PlotSessionStatus =
            current === 'unchanged' ? 'advanced' :
            current === 'advanced' ? 'stalled' :
            'unchanged';
        campaignService.updatePlotProgression(plotId, next);
    }, [plotSessionStatus]);

    return (
        <div className="flex flex-col h-full bg-slate-950 relative">
            {/* Session Header */}
            <div className="flex items-center justify-between px-3 md:px-6 py-2 md:py-3 bg-slate-900 border-b border-slate-700 flex-shrink-0">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <Icons.Live className="w-4 h-4 md:w-5 md:h-5 text-red-400 animate-pulse flex-shrink-0" />
                    <h1 className="text-base md:text-lg font-bold text-white font-serif truncate">{sessionLog.title}</h1>
                    {adventure && (
                        <span className="hidden sm:inline text-sm text-slate-400 truncate">
                            — {adventure.title}
                        </span>
                    )}
                    <span className="hidden sm:inline text-sm font-mono text-amber-400 flex-shrink-0" title="Elapsed session time">
                        {elapsedDisplay}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={onOpenCoach}
                        className="hidden md:inline-flex"
                    >
                        <Icons.Coach className="w-4 h-4 mr-2" />
                        DM Coach
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleEndSession}
                    >
                        <Icons.Stop className="w-4 h-4" />
                        <span className="hidden sm:inline ml-1.5">End Session</span>
                    </Button>
                </div>
            </div>

            {/* Mobile Tab Bar */}
            <div className="md:hidden flex-shrink-0 flex border-b border-slate-800 bg-slate-900">
                {([
                    { id: 'scenes' as const, label: 'Scenes', icon: <Icons.Scenes className="w-4 h-4" /> },
                    { id: 'active' as const, label: 'Active', icon: <Icons.Play className="w-4 h-4" /> },
                    { id: 'tools' as const, label: 'Tools', icon: <Icons.Sparkles className="w-4 h-4" /> },
                ] as const).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setMobileTab(tab.id)}
                        className={twMerge(
                            'flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors min-h-[44px]',
                            mobileTab === tab.id
                                ? 'text-amber-400 border-b-2 border-amber-400'
                                : 'text-slate-400 hover:text-slate-200'
                        )}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Main 3-Column Layout */}
            <div className="flex-1 flex overflow-hidden">
                <SceneListPanel
                    plannedScenes={plannedScenes}
                    activeSceneId={campaign.activeSceneId}
                    campaign={campaign}
                    sessionLog={sessionLog}
                    previousSessionRecap={previousSession?.recap ?? null}
                    mobileTab={mobileTab}
                    onSelectScene={handleSelectScene}
                    onNavigate={onNavigate}
                />

                <ActiveScenePanel
                    activeScene={activeScene}
                    activeSceneLocation={activeSceneLocation}
                    activeSceneNpcs={activeSceneNpcs}
                    sceneNpcRelationshipMap={sceneNpcRelationshipMap}
                    castDynamicsSummary={castDynamicsSummary}
                    campaign={campaign}
                    previousSession={previousSession}
                    mobileTab={mobileTab}
                    onAdvanceScene={handleAdvanceScene}
                    onNavigate={onNavigate}
                />

                <QuickToolsPanel
                    campaign={campaign}
                    sessionLog={sessionLog}
                    activeScene={activeScene}
                    adventure={adventure}
                    activeSceneNpcs={activeSceneNpcs}
                    plotSessionStatus={plotSessionStatus}
                    isMockMode={isMockMode}
                    mobileTab={mobileTab}
                    canShowCombatTracker={canShowCombatTracker}
                    canShowSecretsTracker={canShowSecretsTracker}
                    onOpenCoach={onOpenCoach}
                    onOpenCombat={handleOpenCombat}
                    onCyclePlotStatus={cyclePlotStatus}
                    onNavigate={onNavigate}
                />
            </div>

            <RunningLog
                sessionLog={sessionLog}
                mobileTab={mobileTab}
            />

            {/* Floating Action Button — mobile only */}
            {mobileTab !== 'tools' && (
                <>
                    {fabOpen && (
                        <div
                            className="fixed inset-0 z-20 md:hidden"
                            onClick={() => setFabOpen(false)}
                        />
                    )}
                    <div className="fixed bottom-4 right-4 md:hidden z-30">
                        {fabOpen && (
                            <div
                                ref={fabMenuRef}
                                className="absolute bottom-16 right-0 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-2 space-y-1 min-w-[180px]"
                                role="menu"
                                aria-label="Quick tools"
                                onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                                    if (e.key === 'Escape') {
                                        e.preventDefault();
                                        setFabOpen(false);
                                    }
                                    const items = Array.from(
                                        (e.currentTarget as HTMLDivElement).querySelectorAll<HTMLElement>('[role="menuitem"]')
                                    );
                                    const focused = document.activeElement as HTMLElement;
                                    const currentIdx = items.indexOf(focused);
                                    if (e.key === 'ArrowDown') {
                                        e.preventDefault();
                                        const next = currentIdx < items.length - 1 ? currentIdx + 1 : 0;
                                        items[next]?.focus();
                                    } else if (e.key === 'ArrowUp') {
                                        e.preventDefault();
                                        const prev = currentIdx > 0 ? currentIdx - 1 : items.length - 1;
                                        items[prev]?.focus();
                                    }
                                }}
                            >
                                <button
                                    role="menuitem"
                                    onClick={() => { onOpenCoach(); setFabOpen(false); }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-sm text-slate-200 hover:bg-slate-700 transition-colors focus:outline-none focus:bg-slate-700"
                                >
                                    <Icons.Coach className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                    DM Coach
                                </button>
                                <button
                                    role="menuitem"
                                    onClick={() => { setMobileTab('tools'); setFabOpen(false); }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-sm text-slate-200 hover:bg-slate-700 transition-colors focus:outline-none focus:bg-slate-700"
                                >
                                    <Icons.Dice className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                    Dice Roller
                                </button>
                                {canShowCombatTracker && (
                                    <button
                                        role="menuitem"
                                        onClick={() => { handleOpenCombat(); setMobileTab('tools'); setFabOpen(false); }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-sm text-slate-200 hover:bg-slate-700 transition-colors focus:outline-none focus:bg-slate-700"
                                    >
                                        <Icons.Combat className="w-4 h-4 text-red-400 flex-shrink-0" />
                                        Combat Tracker
                                    </button>
                                )}
                                {canShowSecretsTracker && (
                                    <button
                                        role="menuitem"
                                        onClick={() => { setMobileTab('tools'); setFabOpen(false); }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-sm text-slate-200 hover:bg-slate-700 transition-colors focus:outline-none focus:bg-slate-700"
                                    >
                                        <Icons.Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                        Secrets & Clues
                                    </button>
                                )}
                            </div>
                        )}
                        <button
                            ref={fabButtonRef}
                            onClick={() => setFabOpen(p => !p)}
                            aria-haspopup="menu"
                            aria-expanded={fabOpen}
                            className={twMerge(
                                "w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-colors",
                                fabOpen
                                    ? "bg-amber-500 text-white"
                                    : "bg-amber-600 hover:bg-amber-500 text-white"
                            )}
                            aria-label="Quick tools"
                        >
                            <Icons.Sparkles className={twMerge("w-6 h-6 transition-transform", fabOpen && "rotate-45")} />
                        </button>
                    </div>
                </>
            )}

            {/* Session End Wizard */}
            {showEndWizard && (
                <Suspense fallback={null}>
                    <SessionEndWizard
                        campaign={campaign}
                        sessionLog={sessionLog}
                        isMockMode={isMockMode}
                        onComplete={onEndSession}
                        onCancel={() => setShowEndWizard(false)}
                    />
                </Suspense>
            )}

            {/* Combat Tracker Slide-out Panel — Finding #56: previously raw divs
                with no role="dialog"/aria-modal/focus trap/scroll lock/Escape
                handling. DialogShell provides all of that; the panel keeps its
                slide-out look via `fixed` positioning (which escapes
                DialogShell's centering flex layout) and gains a responsive
                max-width instead of a hard-coded 500px. */}
            {canShowCombatTracker && (
                <DialogShell
                    isOpen={showCombatPanel}
                    onClose={() => setShowCombatPanel(false)}
                    ariaLabel="Combat Tracker"
                    className="fixed right-0 top-0 bottom-0 w-full max-w-[500px] bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col"
                >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                        <div className="flex items-center gap-2">
                            <Icons.Combat className="w-5 h-5 text-red-400" />
                            <h2 className="text-lg font-bold text-white font-serif">Combat Tracker</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            {campaign.activeEncounter && campaign.activeEncounter.combatants.length > 0 && (
                                <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={handleEndCombat}
                                    title="End combat and log summary"
                                >
                                    <Icons.Stop className="w-4 h-4 mr-1.5" />
                                    End Combat
                                </Button>
                            )}
                            <Button
                                variant="icon"
                                onClick={() => setShowCombatPanel(false)}
                            >
                                <Icons.X className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        {campaign.activeEncounter && (
                            <CombatTracker
                                encounter={campaign.activeEncounter}
                                onUpdate={handleUpdateEncounter}
                                campaignNpcs={campaign.npcs}
                                campaignPcs={campaign.playerCharacters || []}
                            />
                        )}
                    </div>
                </DialogShell>
            )}
        </div>
    );
};
