
import React, { useState, useMemo } from 'react';
import type { Campaign, Scene, Adventure, SessionLog, SessionLogEntry, SessionLogEntryType, NPC, Location } from '../../types/index';
import { Icons } from '../common/Icons';
import { SceneIcon } from '../common/Icons';
import { twMerge } from 'tailwind-merge';
import { campaignService } from '../../services/campaignService';
import { DiceRoller } from '../tools/DiceRoller';

const NOTE_TAG_OPTIONS = ['Combat', 'NPC', 'Decision', 'Loot', 'Discovery'] as const;

const ENTRY_TYPE_STYLES: Record<string, { text: string; border: string; icon: React.ReactNode }> = {
    'scene-transition': {
        text: 'text-blue-300',
        border: 'border-l-2 border-l-blue-500 pl-2',
        icon: <Icons.Scenes className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />,
    },
    'combat': {
        text: 'text-red-300',
        border: 'border-l-2 border-l-red-500 pl-2',
        icon: <Icons.Combat className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />,
    },
    'npc-created': {
        text: 'text-green-300',
        border: 'border-l-2 border-l-green-500 pl-2',
        icon: <Icons.NPCs className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />,
    },
    'dice-roll': {
        text: 'text-amber-300',
        border: 'border-l-2 border-l-amber-500 pl-2',
        icon: <Icons.Dice className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />,
    },
    'coach-used': {
        text: 'text-indigo-300',
        border: 'border-l-2 border-l-indigo-500 pl-2',
        icon: <Icons.Coach className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />,
    },
};

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
    const [noteTags, setNoteTags] = useState<string[]>([]);
    const [showImportantOnly, setShowImportantOnly] = useState(false);
    const [showEndConfirm, setShowEndConfirm] = useState(false);
    const [showDiceRoller, setShowDiceRoller] = useState(false);

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
        campaignService.addSessionRunnerNote(noteInput.trim(), [], 'manual', noteTags);
        setNoteInput('');
        setNoteTags([]);
    };

    const toggleTag = (tag: string) => {
        setNoteTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    };

    const filteredNotes = useMemo(() => {
        const notes = sessionLog.structuredNotes || [];
        if (!showImportantOnly) return notes;
        return notes.filter(n => n.isImportant);
    }, [sessionLog.structuredNotes, showImportantOnly]);

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
                        <button
                            onClick={() => setShowDiceRoller(p => !p)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors"
                        >
                            <Icons.Dice className="w-4 h-4 text-amber-400" />
                            Dice Roller
                            <Icons.ChevronDown className={twMerge("w-3 h-3 ml-auto text-slate-500 transition-transform", showDiceRoller && "rotate-180")} />
                        </button>
                        {showDiceRoller && (
                            <DiceRoller onLogRoll={(roll) => campaignService.addDiceRollToSession(roll)} />
                        )}
                    </div>

                    {/* Prep Notes */}
                    {sessionLog.prepNotes && (
                        <div className="p-3 border-t border-slate-800">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Prep Notes</h3>
                            <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{sessionLog.prepNotes}</p>
                        </div>
                    )}

                    {/* Active Plots */}
                    {sessionLog.relatedPlotIds.length > 0 && (
                        <div className="p-3 border-t border-slate-800">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Active Plots</h3>
                            <div className="space-y-1">
                                {sessionLog.relatedPlotIds.map(plotId => {
                                    const plot = campaign.plots?.find(p => p.id === plotId);
                                    return plot ? (
                                        <div key={plot.id} className="text-xs text-slate-300 flex items-center gap-1.5">
                                            <Icons.Plot className="w-3 h-3 text-amber-500" />
                                            {plot.title}
                                        </div>
                                    ) : null;
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom: Running Log */}
            <div className="h-56 flex-shrink-0 bg-slate-900 border-t border-slate-700 flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Running Log</h2>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowImportantOnly(prev => !prev)}
                            className={twMerge(
                                "flex items-center gap-1 text-xs px-2 py-0.5 rounded-md transition-colors",
                                showImportantOnly
                                    ? "bg-amber-900/40 text-amber-400 border border-amber-700/50"
                                    : "text-slate-500 hover:text-slate-400"
                            )}
                        >
                            <Icons.Star className="w-3 h-3" />
                            {showImportantOnly ? 'Important Only' : 'Show All'}
                        </button>
                        <span className="text-xs text-slate-600">{sessionLog.structuredNotes?.length || 0} entries</span>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
                    {filteredNotes.map(note => {
                        const typeStyle = note.type && note.type !== 'manual' ? ENTRY_TYPE_STYLES[note.type] : null;
                        return (
                            <div
                                key={note.id}
                                className={twMerge(
                                    "flex items-start gap-2 text-sm py-0.5 group",
                                    typeStyle?.border
                                )}
                            >
                                <span className="text-slate-600 text-xs font-mono flex-shrink-0 mt-0.5">
                                    {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {typeStyle?.icon}
                                <span className={twMerge("flex-1", typeStyle?.text || "text-slate-300")}>
                                    {note.content}
                                </span>
                                {note.tags && note.tags.length > 0 && (
                                    <div className="flex gap-1 flex-shrink-0">
                                        {note.tags.map(tag => (
                                            <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">{tag}</span>
                                        ))}
                                    </div>
                                )}
                                <button
                                    onClick={() => campaignService.toggleNoteImportance(note.id)}
                                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title={note.isImportant ? 'Unmark important' : 'Mark important'}
                                >
                                    <Icons.Star
                                        className={twMerge(
                                            "w-3.5 h-3.5 transition-colors",
                                            note.isImportant
                                                ? "text-amber-400 fill-amber-400"
                                                : "text-slate-600 hover:text-slate-400"
                                        )}
                                    />
                                </button>
                            </div>
                        );
                    })}
                    {filteredNotes.length === 0 && (
                        <p className="text-xs text-slate-600 italic">
                            {showImportantOnly ? 'No important notes. Star a note to mark it important.' : 'No notes yet. Add notes below.'}
                        </p>
                    )}
                </div>
                <div className="px-4 py-2 border-t border-slate-800 space-y-2">
                    <div className="flex gap-1">
                        {NOTE_TAG_OPTIONS.map(tag => (
                            <button
                                key={tag}
                                onClick={() => toggleTag(tag)}
                                className={twMerge(
                                    "text-xs px-2 py-0.5 rounded-md transition-colors border",
                                    noteTags.includes(tag)
                                        ? "bg-indigo-900/40 text-indigo-300 border-indigo-600/50"
                                        : "bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-400 hover:border-slate-600"
                                )}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2">
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
        </div>
    );
};
