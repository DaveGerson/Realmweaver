
import React, { useState, useMemo, useCallback } from 'react';
import type { Campaign, Scene, Adventure, SessionLog, NPC, Location, Combatant, CombatantType, Encounter } from '../../types/index';
import { Icons } from '../common/Icons';
import { SceneIcon } from '../common/Icons';
import { twMerge } from 'tailwind-merge';
import { campaignService } from '../../services/campaignService';
import { CombatTracker } from '../tools/CombatTracker';
import { generateNpc } from '../../services/geminiService';

type PlotSessionStatus = 'advanced' | 'stalled' | 'unchanged';

interface SessionRunnerProps {
    campaign: Campaign;
    sessionLog: SessionLog;
    isMockMode: boolean;
    onEndSession: () => void;
    onOpenCoach: () => void;
}

export const SessionRunner: React.FC<SessionRunnerProps> = ({
    campaign,
    sessionLog,
    isMockMode,
    onEndSession,
    onOpenCoach,
}) => {
    const [noteInput, setNoteInput] = useState('');
    const [showEndConfirm, setShowEndConfirm] = useState(false);

    // Combat Tracker slide-out state
    const [showCombatPanel, setShowCombatPanel] = useState(false);

    // Quick NPC generator state
    const [showQuickNpc, setShowQuickNpc] = useState(false);
    const [npcPrompt, setNpcPrompt] = useState('');
    const [npcGenerating, setNpcGenerating] = useState(false);
    const [npcError, setNpcError] = useState<string | null>(null);

    // Plot session status tracking (local only)
    const [plotSessionStatus, setPlotSessionStatus] = useState<Record<string, PlotSessionStatus>>({});

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

    const previousSession = useMemo(() => {
        const completed = campaign.sessionLogs
            .filter(s => s.status === 'completed')
            .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
        return completed[0] || null;
    }, [campaign.sessionLogs]);

    const handleAddNote = () => {
        if (!noteInput.trim()) return;
        campaignService.addSessionRunnerNote(noteInput.trim());
        setNoteInput('');
    };

    const handleAdvanceScene = () => {
        campaignService.advanceScene();
    };

    const handleSelectScene = (sceneId: string) => {
        if (!adventure) return;
        // Mark current active as completed, set new one as in-progress
        if (campaign.activeSceneId && campaign.activeSceneId !== sceneId) {
            campaignService.setSceneStatus(adventure.id, campaign.activeSceneId, 'completed');
        }
        campaignService.setSceneStatus(adventure.id, sceneId, 'in-progress');
        campaignService.setActiveScene(sceneId);
    };

    const handleEndSession = () => {
        if (!showEndConfirm) {
            setShowEndConfirm(true);
            return;
        }
        onEndSession();
    };

    // Combat Tracker: open panel and auto-populate if needed
    const handleOpenCombat = useCallback(() => {
        const encounter = campaign.activeEncounter;
        if (!encounter || encounter.combatants.length === 0) {
            // Auto-populate combatants from active scene NPCs + player characters
            const autoCombatants: Combatant[] = [
                ...activeSceneNpcs.map(npc => ({
                    id: crypto.randomUUID(),
                    name: npc.name,
                    type: 'npc' as CombatantType,
                    initiative: 0,
                    hp: 10,
                    maxHp: 10,
                    notes: npc.traits || ''
                })),
                ...(campaign.playerCharacters || []).map(pc => ({
                    id: crypto.randomUUID(),
                    name: pc.characterSocial.characterName,
                    type: 'pc' as CombatantType,
                    initiative: 0,
                    hp: 20,
                    maxHp: 20,
                    notes: ''
                }))
            ];

            const newEncounter: Encounter = {
                id: encounter?.id || crypto.randomUUID(),
                round: 1,
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

    // Quick NPC generation
    const handleGenerateQuickNpc = useCallback(async () => {
        if (!npcPrompt.trim()) return;
        setNpcGenerating(true);
        setNpcError(null);
        try {
            const campaignContext = `Campaign: ${campaign.title}\nSetting: ${campaign.setting}`;
            const npcData = await generateNpc(npcPrompt.trim(), false, isMockMode, campaignContext);
            const newNpcId = campaignService.createNpc(npcData);

            // Auto-link to current scene if there is one
            if (activeScene && adventure) {
                const updatedNpcIds = [...activeScene.npcIds, newNpcId];
                campaignService.updateScene(adventure.id, activeScene.id, { npcIds: updatedNpcIds });
            }

            setNpcPrompt('');
            setShowQuickNpc(false);
        } catch (err) {
            setNpcError(err instanceof Error ? err.message : 'Generation failed');
        } finally {
            setNpcGenerating(false);
        }
    }, [npcPrompt, isMockMode, campaign.title, campaign.setting, activeScene, adventure]);

    // Plot status cycling
    const cyclePlotStatus = useCallback((plotId: string) => {
        setPlotSessionStatus(prev => {
            const current = prev[plotId] || 'unchanged';
            const next: PlotSessionStatus =
                current === 'unchanged' ? 'advanced' :
                current === 'advanced' ? 'stalled' :
                'unchanged';
            return { ...prev, [plotId]: next };
        });
    }, []);

    const sceneStatusIcon = (scene: Scene) => {
        switch (scene.status) {
            case 'completed': return <Icons.CheckCircle className="w-4 h-4 text-green-400" />;
            case 'in-progress': return <Icons.Play className="w-4 h-4 text-amber-400" />;
            default: return <div className="w-4 h-4 rounded-full border border-slate-500" />;
        }
    };

    const plotStatusBadge = (status: PlotSessionStatus) => {
        switch (status) {
            case 'advanced':
                return (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold uppercase">
                        <Icons.Advanced className="w-3 h-3" />
                        Advanced
                    </span>
                );
            case 'stalled':
                return (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold uppercase">
                        <Icons.Stalled className="w-3 h-3" />
                        Stalled
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400 text-[10px] font-bold uppercase">
                        <Icons.Unchanged className="w-3 h-3" />
                        Unchanged
                    </span>
                );
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-950">
            {/* Session Header */}
            <div className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-700">
                <div className="flex items-center gap-3">
                    <Icons.Live className="w-5 h-5 text-red-400 animate-pulse" />
                    <h1 className="text-lg font-bold text-white font-serif">{sessionLog.title}</h1>
                    {adventure && (
                        <span className="text-sm text-slate-400">
                            — {adventure.title}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onOpenCoach}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm transition-colors"
                    >
                        <Icons.Coach className="w-4 h-4" />
                        DM Coach
                    </button>
                    <button
                        onClick={handleEndSession}
                        className={twMerge(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
                            showEndConfirm
                                ? "bg-red-600 hover:bg-red-500 text-white"
                                : "bg-slate-700 hover:bg-slate-600 text-slate-200"
                        )}
                    >
                        <Icons.Stop className="w-4 h-4" />
                        {showEndConfirm ? 'Confirm End Session' : 'End Session'}
                    </button>
                </div>
            </div>

            {/* Main 3-Column Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Scene List */}
                <div className="w-56 flex-shrink-0 bg-slate-900 border-r border-slate-800 overflow-y-auto p-3">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Scenes</h2>
                    <div className="space-y-1">
                        {plannedScenes.map((scene, index) => (
                            <button
                                key={scene.id}
                                onClick={() => handleSelectScene(scene.id)}
                                className={twMerge(
                                    "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-all",
                                    campaign.activeSceneId === scene.id
                                        ? "bg-amber-900/30 text-amber-200 border border-amber-700/50"
                                        : scene.status === 'completed'
                                        ? "text-slate-500 hover:bg-slate-800"
                                        : "text-slate-300 hover:bg-slate-800"
                                )}
                            >
                                {sceneStatusIcon(scene)}
                                <span className="truncate">{scene.title}</span>
                            </button>
                        ))}
                        {plannedScenes.length === 0 && (
                            <p className="text-xs text-slate-500 italic px-2">No scenes planned</p>
                        )}
                    </div>

                    {/* Previous Session Recap */}
                    {previousSession?.recap && (
                        <div className="mt-6">
                            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Last Session</h2>
                            <p className="text-xs text-slate-400 leading-relaxed">{previousSession.recap.substring(0, 300)}{previousSession.recap.length > 300 ? '...' : ''}</p>
                        </div>
                    )}
                </div>

                {/* Center: Active Scene Panel */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeScene ? (
                        <div className="max-w-3xl mx-auto space-y-6">
                            {/* Scene Title */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <SceneIcon type={activeScene.type} />
                                    <h2 className="text-2xl font-bold text-white font-serif">{activeScene.title}</h2>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 uppercase">{activeScene.type}</span>
                                </div>
                                <button
                                    onClick={handleAdvanceScene}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm transition-colors"
                                >
                                    <Icons.SkipForward className="w-4 h-4" />
                                    Next Scene
                                </button>
                            </div>

                            {/* Read-Aloud Text */}
                            {activeScene.readAloudText && (
                                <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg p-4">
                                    <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Read Aloud</h3>
                                    <p className="text-amber-100 italic leading-relaxed whitespace-pre-wrap">{activeScene.readAloudText}</p>
                                </div>
                            )}

                            {/* GM Notes */}
                            {activeScene.gmNotes && (
                                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">GM Notes</h3>
                                    <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{activeScene.gmNotes}</p>
                                </div>
                            )}

                            {/* Location */}
                            {activeSceneLocation && (
                                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                        <Icons.Locations className="w-3 h-3 inline mr-1" />
                                        Location
                                    </h3>
                                    <p className="text-white font-semibold">{activeSceneLocation.name}</p>
                                    {activeSceneLocation.description && (
                                        <p className="text-slate-300 text-sm mt-1">{activeSceneLocation.description}</p>
                                    )}
                                </div>
                            )}

                            {/* NPCs Present */}
                            {activeSceneNpcs.length > 0 && (
                                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                                        <Icons.NPCs className="w-3 h-3 inline mr-1" />
                                        NPCs Present
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {activeSceneNpcs.map(npc => (
                                            <div key={npc.id} className="bg-slate-900/50 rounded-md p-3">
                                                <p className="text-white font-semibold text-sm">{npc.name}</p>
                                                {npc.traits && <p className="text-slate-400 text-xs mt-1">{npc.traits}</p>}
                                                {npc.motivations && <p className="text-slate-500 text-xs mt-1 italic">{npc.motivations}</p>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Skill Checks */}
                            {activeScene.skillChecks.length > 0 && (
                                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                        <Icons.Dice className="w-3 h-3 inline mr-1" />
                                        Skill Checks
                                    </h3>
                                    <div className="space-y-2">
                                        {activeScene.skillChecks.map((check, i) => (
                                            <div key={i} className="flex items-center gap-3 text-sm">
                                                <span className="text-amber-400 font-mono font-bold">DC {check.dc}</span>
                                                <span className="text-white">{check.skill}</span>
                                                {check.description && <span className="text-slate-400">— {check.description}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Rewards */}
                            {activeScene.rewards && (
                                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Rewards</h3>
                                    <p className="text-slate-200 text-sm whitespace-pre-wrap">{activeScene.rewards}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-500">
                            <div className="text-center">
                                <Icons.Adventures className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p>No active scene. Select a scene from the list or advance.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Quick Tools Panel */}
                <div className="w-64 flex-shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col overflow-y-auto">
                    <div className="p-3 border-b border-slate-800">
                        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quick Tools</h2>
                    </div>

                    <div className="p-3 space-y-2">
                        <button
                            onClick={onOpenCoach}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors"
                        >
                            <Icons.Coach className="w-4 h-4 text-indigo-400" />
                            DM Coach
                        </button>
                        <button
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors"
                            onClick={handleOpenCombat}
                        >
                            <Icons.Combat className="w-4 h-4 text-red-400" />
                            Combat Tracker
                        </button>
                        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors">
                            <Icons.Dice className="w-4 h-4 text-amber-400" />
                            Dice / Tables
                        </button>
                        <button
                            onClick={() => setShowQuickNpc(!showQuickNpc)}
                            className={twMerge(
                                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                                showQuickNpc
                                    ? "bg-emerald-900/40 text-emerald-300 border border-emerald-700/50"
                                    : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                            )}
                        >
                            <Icons.UserPlus className="w-4 h-4 text-emerald-400" />
                            Quick NPC
                        </button>
                    </div>

                    {/* Quick NPC Inline Form */}
                    {showQuickNpc && (
                        <div className="px-3 pb-3 space-y-2">
                            <input
                                type="text"
                                value={npcPrompt}
                                onChange={(e) => setNpcPrompt(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !npcGenerating) handleGenerateQuickNpc(); }}
                                placeholder="A suspicious merchant..."
                                disabled={npcGenerating}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                                autoFocus
                            />
                            <button
                                onClick={handleGenerateQuickNpc}
                                disabled={!npcPrompt.trim() || npcGenerating}
                                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm transition-colors"
                            >
                                {npcGenerating ? (
                                    <>
                                        <Icons.Loader className="w-4 h-4 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Icons.Sparkles className="w-4 h-4" />
                                        Generate
                                    </>
                                )}
                            </button>
                            {npcError && (
                                <p className="text-xs text-red-400">{npcError}</p>
                            )}
                        </div>
                    )}

                    {/* Prep Notes */}
                    {sessionLog.prepNotes && (
                        <div className="p-3 border-t border-slate-800">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Prep Notes</h3>
                            <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{sessionLog.prepNotes}</p>
                        </div>
                    )}

                    {/* Active Plots with Status Tracker */}
                    {sessionLog.relatedPlotIds.length > 0 && (
                        <div className="p-3 border-t border-slate-800">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Active Plots</h3>
                            <div className="space-y-2">
                                {sessionLog.relatedPlotIds.map(plotId => {
                                    const plot = campaign.plots?.find(p => p.id === plotId);
                                    const status = plotSessionStatus[plotId] || 'unchanged';
                                    return plot ? (
                                        <button
                                            key={plot.id}
                                            onClick={() => cyclePlotStatus(plot.id)}
                                            className="w-full text-left bg-slate-800/50 hover:bg-slate-800 rounded-lg p-2 transition-colors group"
                                        >
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Icons.Plot className="w-3 h-3 text-amber-500 flex-shrink-0" />
                                                <span className="text-xs text-slate-300 truncate">{plot.title}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                {plotStatusBadge(status)}
                                                <span className="text-[10px] text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">click to change</span>
                                            </div>
                                        </button>
                                    ) : null;
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom: Running Log */}
            <div className="h-48 flex-shrink-0 bg-slate-900 border-t border-slate-700 flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Running Log</h2>
                    <span className="text-xs text-slate-600">{sessionLog.structuredNotes?.length || 0} entries</span>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
                    {(sessionLog.structuredNotes || []).map(note => (
                        <div key={note.id} className="flex items-start gap-2 text-sm">
                            <span className="text-slate-600 text-xs font-mono flex-shrink-0">
                                {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-slate-300">{note.content}</span>
                        </div>
                    ))}
                    {(!sessionLog.structuredNotes || sessionLog.structuredNotes.length === 0) && (
                        <p className="text-xs text-slate-600 italic">No notes yet. Add notes below.</p>
                    )}
                </div>
                <div className="px-4 py-2 border-t border-slate-800 flex gap-2">
                    <input
                        type="text"
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(); }}
                        placeholder="Add a quick note..."
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                        onClick={handleAddNote}
                        disabled={!noteInput.trim()}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm transition-colors"
                    >
                        Add
                    </button>
                </div>
            </div>

            {/* Combat Tracker Slide-out Panel */}
            {showCombatPanel && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/50 z-40"
                        onClick={() => setShowCombatPanel(false)}
                    />
                    {/* Panel */}
                    <div className="fixed right-0 top-0 bottom-0 w-[500px] bg-slate-900 border-l border-slate-700 z-50 shadow-2xl flex flex-col">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                            <div className="flex items-center gap-2">
                                <Icons.Combat className="w-5 h-5 text-red-400" />
                                <h2 className="text-lg font-bold text-white font-serif">Combat Tracker</h2>
                            </div>
                            <button
                                onClick={() => setShowCombatPanel(false)}
                                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            >
                                <Icons.X className="w-5 h-5" />
                            </button>
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
                    </div>
                </>
            )}
        </div>
    );
};
