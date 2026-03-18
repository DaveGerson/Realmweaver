
import React, { useState, useMemo } from 'react';
import type { Campaign, Scene, Adventure, SessionLog, NPC, Location } from '../../types/index';
import { Icons } from '../common/Icons';
import { SceneIcon } from '../common/Icons';
import { twMerge } from 'tailwind-merge';
import { campaignService } from '../../services/campaignService';

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
    const [showRecap, setShowRecap] = useState(true);

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

    const sceneStatusIcon = (scene: Scene) => {
        switch (scene.status) {
            case 'completed': return <Icons.CheckCircle className="w-4 h-4 text-green-400" />;
            case 'in-progress': return <Icons.Play className="w-4 h-4 text-amber-400" />;
            default: return <div className="w-4 h-4 rounded-full border border-slate-500" />;
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
                            {/* Previously... Recap Banner */}
                            {showRecap && previousSession?.recap && (
                                <div className="bg-indigo-900/20 border border-indigo-800/40 rounded-lg p-4 relative">
                                    <button
                                        onClick={() => setShowRecap(false)}
                                        className="absolute top-2 right-2 text-slate-500 hover:text-slate-300"
                                    >
                                        <Icons.X className="w-4 h-4" />
                                    </button>
                                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">Previously...</h3>
                                    <p className="text-sm text-indigo-200 leading-relaxed">{previousSession.recap}</p>
                                    {previousSession.looseEnds && (
                                        <div className="mt-2 pt-2 border-t border-indigo-800/30">
                                            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">Unresolved Threads</h4>
                                            <p className="text-xs text-amber-200">{previousSession.looseEnds}</p>
                                        </div>
                                    )}
                                </div>
                            )}

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
                <div className="w-64 flex-shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col">
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
                            onClick={() => {
                                if (campaign.activeSceneId && adventure) {
                                    const scene = adventure.scenes.find(s => s.id === campaign.activeSceneId);
                                    if (scene?.type === 'combat') {
                                        // TODO: auto-populate combat from scene NPCs
                                    }
                                }
                            }}
                        >
                            <Icons.Combat className="w-4 h-4 text-red-400" />
                            Combat Tracker
                        </button>
                        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors">
                            <Icons.Dice className="w-4 h-4 text-amber-400" />
                            Dice / Tables
                        </button>
                    </div>

                    {/* Active Plots */}
                    <div className="p-3 border-t border-slate-800">
                        <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
                            <Icons.Plot className="w-3 h-3 inline mr-1" />
                            Active Plots
                        </h3>
                        {sessionLog.relatedPlotIds.length > 0 ? (
                            <div className="space-y-2">
                                {sessionLog.relatedPlotIds.map(plotId => {
                                    const plot = campaign.plots?.find(p => p.id === plotId);
                                    return plot ? (
                                        <div key={plot.id} className="border-l-2 border-amber-600/50 pl-2.5 py-1">
                                            <p className="text-sm text-amber-200 font-medium">{plot.title}</p>
                                            {plot.description && (
                                                <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{plot.description.substring(0, 120)}{plot.description.length > 120 ? '...' : ''}</p>
                                            )}
                                        </div>
                                    ) : null;
                                })}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-600 italic">No plots linked to this session</p>
                        )}
                    </div>

                    {/* Prep Notes */}
                    {sessionLog.prepNotes && (
                        <div className="p-3 border-t border-slate-800">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Prep Notes</h3>
                            <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{sessionLog.prepNotes}</p>
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
        </div>
    );
};
