
import React, { useState, useCallback, useMemo } from 'react';
import type { Campaign, SessionLog, Scene, Beat } from '@/types';
import { Icons } from '@/components/common/Icons';
import { Button } from '@/components/common/Button';
import { twMerge } from 'tailwind-merge';
import { campaignService } from '@/services/campaignService';
import { EntityLink } from '@/components/common/EntityLink';
import type { QuickCardEntityType } from '@/components/common/EntityQuickCard';
// Strong start (docs/design/lazy-dm-lens.md §4 R1) is zero-new-schema: it is
// written by the Session Prep Wizard as a leading delimited section of
// `prepNotes`. Reuse the wizard's own encoder/decoder so the write side and
// this, the read side, can never drift apart.
import { parseStrongStartPrepNotes } from '@/utils/strongStartFormat';
// The scene menu (docs/design/unstructured-play.md): tonight's scenes may come
// from any adventure, and any prepped scene can be pulled off the shelf live.
import { deriveSceneShelf, resolveSceneById } from '@/utils/storyDerivations';

/** One player character's share of tonight's spotlight, for the strip at the bottom. */
export interface SpotlightTonightEntry {
    pcId: string;
    pcName: string;
    /** Running-log entries tonight that named or tagged this character. */
    count: number;
}

interface SceneListPanelProps {
    plannedScenes: Scene[];
    activeSceneId: string | null | undefined;
    campaign: Campaign;
    sessionLog: SessionLog;
    previousSessionRecap: string | null;
    mobileTab: 'scenes' | 'active' | 'tools';
    onSelectScene: (sceneId: string) => void;
    onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
    // ── Unstructured play (all optional; legacy callers render the list as before) ──
    /** Pulls a prepped scene from any adventure into tonight's list. Enables the shelf picker. */
    onAddScene?: (sceneId: string) => void;
    /** Puts a scene back on the shelf. Enables the per-scene remove control. */
    onRemoveScene?: (sceneId: string) => void;
    /** Makes a beat the Stage's "what's happening right now". Enables the per-beat play control. */
    onPlayBeat?: (beat: Beat) => void;
    /** Who has had a moment tonight — shown as a compact strip when supplied. */
    spotlightTonight?: SpotlightTonightEntry[];
}

/**
 * The status glyph reads the scene MENU, not a track: a started scene that is
 * not the one on stage shows as paused (come back any time), not as done.
 */
const sceneStatusIcon = (scene: Scene, isActive: boolean) => {
    if (isActive) return <Icons.Play className="w-4 h-4 text-amber-400" />;
    switch (scene.status) {
        case 'completed': return <Icons.CheckCircle className="w-4 h-4 text-green-400" />;
        case 'in-progress': return <Icons.Stalled className="w-4 h-4 text-slate-400" aria-label="Started — come back any time" />;
        default: return <div className="w-4 h-4 rounded-full border border-slate-500" />;
    }
};

export const SceneListPanel: React.FC<SceneListPanelProps> = ({
    plannedScenes,
    activeSceneId,
    campaign,
    sessionLog,
    previousSessionRecap,
    mobileTab,
    onSelectScene,
    onNavigate,
    onAddScene,
    onRemoveScene,
    onPlayBeat,
    spotlightTonight,
}) => {
    const [beatInput, setBeatInput] = useState('');
    const [shelfOpen, setShelfOpen] = useState(false);

    const handleAddBeat = useCallback(() => {
        const title = beatInput.trim();
        if (!title) return;
        campaignService.addBeat(title);
        setBeatInput('');
    }, [beatInput]);

    // A strong start written at prep time is the first thing the DM says, so it
    // is the first thing on this screen — surfaced above Scenes, never hunted
    // for. Parsing is defensive by construction: anything that isn't exactly
    // the wizard's delimited block is left as ordinary (unrendered-here) prep
    // notes, never partially displayed.
    const { strongStart } = useMemo(
        () => parseStrongStartPrepNotes(sessionLog.prepNotes),
        [sessionLog.prepNotes]
    );

    const shelf = useMemo(
        () => (onAddScene ? deriveSceneShelf(campaign, sessionLog) : []),
        [campaign, sessionLog, onAddScene]
    );

    /** The owning adventure's title when a scene was pulled from a different adventure than tonight's. */
    const foreignAdventureTitle = (sceneId: string): string | null => {
        const resolved = resolveSceneById(campaign, sceneId);
        if (!resolved) return null;
        if (sessionLog.adventureId && resolved.adventure.id === sessionLog.adventureId) return null;
        if (!sessionLog.adventureId && campaign.adventures.length <= 1) return null;
        return resolved.adventure.title;
    };

    return (
        <div className={twMerge(
            "flex-shrink-0 bg-slate-900 border-r border-slate-800 overflow-y-auto p-3",
            "w-full md:w-56",
            mobileTab === 'scenes' ? "flex flex-col md:flex" : "hidden md:flex md:flex-col"
        )}>
            {strongStart && (
                <div className="mb-4 pb-4 border-b border-slate-800">
                    <h2 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Icons.Zap className="w-3.5 h-3.5" /> Strong Start
                    </h2>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{strongStart}</p>
                </div>
            )}
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Scenes</h2>
            {onAddScene && plannedScenes.length > 0 && (
                <p className="text-[10px] text-slate-600 mb-2">Play them in any order</p>
            )}
            <div className="space-y-1">
                {plannedScenes.map((scene) => {
                    const sceneLocation = scene.locationId
                        ? campaign.locations.find(l => l.id === scene.locationId)
                        : null;
                    const sceneNpcCount = scene.npcIds.length;
                    const isActive = activeSceneId === scene.id;
                    const owner = foreignAdventureTitle(scene.id);
                    return (
                        <div
                            key={scene.id}
                            className={twMerge(
                                "flex items-stretch rounded-lg text-sm transition-all group/scene",
                                isActive
                                    ? "bg-amber-900/30 border border-amber-700/50"
                                    : "hover:bg-slate-800"
                            )}
                        >
                            {/* Main scene button — click to enter */}
                            <button
                                onClick={() => onSelectScene(scene.id)}
                                className={twMerge(
                                    "flex-1 flex items-start gap-2 px-2 py-2 min-h-[44px] text-left min-w-0",
                                    isActive
                                        ? "text-amber-200"
                                        : scene.status === 'completed'
                                        ? "text-slate-500"
                                        : "text-slate-300"
                                )}
                            >
                                <span className="flex-shrink-0 mt-0.5">{sceneStatusIcon(scene, isActive)}</span>
                                <span className="flex flex-col min-w-0">
                                    <span className="truncate">{scene.title}</span>
                                    {owner && (
                                        <span className="text-[10px] text-orange-300/70 truncate" title={`From ${owner}`}>
                                            {owner}
                                        </span>
                                    )}
                                    {(sceneLocation || sceneNpcCount > 0) && (
                                        <span className="flex items-center gap-1.5 mt-0.5">
                                            {sceneLocation && (
                                                <span className="text-[10px] text-emerald-400/70 truncate max-w-[80px]" title={sceneLocation.name}>
                                                    {sceneLocation.name}
                                                </span>
                                            )}
                                            {sceneNpcCount > 0 && (
                                                <span className="text-[10px] px-1 py-0.5 rounded bg-slate-700/80 text-slate-400 flex-shrink-0">
                                                    {sceneNpcCount} NPC{sceneNpcCount !== 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </span>
                                    )}
                                </span>
                            </button>
                            {/* Info icon — hover to show EntityQuickCard tooltip */}
                            <div className="flex items-center pr-1 flex-shrink-0 gap-0.5">
                                <EntityLink
                                    entityType="scene"
                                    entityId={scene.id}
                                    label={<Icons.Help className="w-3.5 h-3.5 text-slate-500 hover:text-blue-400 transition-colors" />}
                                    onNavigate={onNavigate ?? (() => {})}
                                    className="p-1 rounded no-underline"
                                />
                                {onRemoveScene && scene.status !== 'completed' && (
                                    <button
                                        type="button"
                                        onClick={() => onRemoveScene(scene.id)}
                                        aria-label={`Put "${scene.title}" back on the shelf`}
                                        title="Not tonight — back on the shelf"
                                        className="p-1 rounded text-slate-600 hover:text-red-400 opacity-100 md:opacity-0 md:group-hover/scene:opacity-100 md:focus:opacity-100 transition-opacity"
                                    >
                                        <Icons.X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
                {plannedScenes.length === 0 && (
                    <p className="text-xs text-slate-500 italic px-2">No scenes planned</p>
                )}
            </div>

            {/* The shelf — every prepped scene in the campaign, from any adventure */}
            {onAddScene && (
                <div className="mt-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShelfOpen(o => !o)}
                        aria-expanded={shelfOpen}
                        className="w-full justify-start text-xs text-slate-400 hover:text-amber-300"
                    >
                        <Icons.Plus className="w-3.5 h-3.5 mr-1.5" />
                        Pull a scene from the shelf
                    </Button>
                    {shelfOpen && (
                        <div className="mt-1 rounded-md border border-slate-800 bg-slate-950/40 p-2 space-y-0.5">
                            {shelf.length === 0 ? (
                                <p className="text-[11px] text-slate-500 italic px-1">
                                    Nothing on the shelf — every prepped scene is already in tonight's list.
                                </p>
                            ) : (
                                shelf.map(({ scene, adventureTitle }) => (
                                    <button
                                        key={scene.id}
                                        type="button"
                                        onClick={() => { onAddScene(scene.id); }}
                                        aria-label={`Add "${scene.title}" to tonight`}
                                        className="w-full text-left px-2 py-1.5 rounded text-xs text-slate-300 hover:bg-slate-800 transition-colors"
                                    >
                                        <span className="block truncate">{scene.title}</span>
                                        <span className="block text-[10px] text-slate-500 truncate">{adventureTitle}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Previous Session Recap */}
            {previousSessionRecap && (
                <div className="mt-6">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Last Session</h2>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        {previousSessionRecap.substring(0, 300)}{previousSessionRecap.length > 300 ? '...' : ''}
                    </p>
                </div>
            )}

            {/* Beats Section */}
            <div className="mt-6">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Beats</h2>
                <div className="space-y-1">
                    {(sessionLog.beats || []).map((beat: Beat) => (
                        <div
                            key={beat.id}
                            className="flex items-start gap-2 group rounded-md px-1 py-1 hover:bg-slate-800/50"
                        >
                            <button
                                onClick={() => campaignService.toggleBeatComplete(beat.id)}
                                className="flex-shrink-0 mt-0.5 text-slate-400 hover:text-amber-400 transition-colors"
                                title={beat.isCompleted ? 'Mark incomplete' : 'Mark complete'}
                            >
                                {beat.isCompleted
                                    ? <Icons.CheckCircle className="w-4 h-4 text-green-400" />
                                    : <div className="w-4 h-4 rounded border border-slate-600 hover:border-amber-500" />
                                }
                            </button>
                            <span className={twMerge(
                                "flex-1 text-xs leading-snug",
                                beat.isCompleted ? "line-through text-slate-600" : "text-slate-300"
                            )}>
                                {beat.title}
                                {beat.notes && (
                                    <span className="block text-slate-500 not-italic mt-0.5">{beat.notes}</span>
                                )}
                            </span>
                            {onPlayBeat && !beat.isCompleted && (
                                <button
                                    type="button"
                                    onClick={() => onPlayBeat(beat)}
                                    aria-label={`Play beat: ${beat.title}`}
                                    title="Make this what's happening right now"
                                    className="flex-shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 transition-opacity text-slate-600 hover:text-amber-400"
                                >
                                    <Icons.Play className="w-3 h-3" />
                                </button>
                            )}
                            <button
                                onClick={() => campaignService.deleteBeat(beat.id)}
                                className="flex-shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-slate-600 hover:text-red-400"
                                title="Delete beat"
                            >
                                <Icons.X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                    {(sessionLog.beats || []).length === 0 && (
                        <p className="text-xs text-slate-600 italic px-1">No beats yet</p>
                    )}
                </div>
                <div className="flex gap-1 mt-2">
                    <input
                        type="text"
                        value={beatInput}
                        onChange={(e) => setBeatInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddBeat(); }}
                        placeholder="Add a beat..."
                        className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleAddBeat}
                        disabled={!beatInput.trim()}
                        className="flex-shrink-0"
                        title="Add beat"
                    >
                        <Icons.Plus className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>

            {/* Spotlight tonight — who has had a moment, read off the running log */}
            {spotlightTonight && spotlightTonight.length > 0 && (
                <div className="mt-6">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Spotlight Tonight</h2>
                    <ul className="space-y-1" aria-label="Spotlight tonight">
                        {spotlightTonight.map(entry => (
                            <li key={entry.pcId} className="flex items-center justify-between gap-2 px-1 text-xs">
                                <span className={twMerge('truncate', entry.count === 0 ? 'text-slate-300' : 'text-slate-400')}>
                                    {entry.pcName}
                                </span>
                                <span
                                    className={twMerge(
                                        'flex-shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold',
                                        entry.count === 0
                                            ? 'bg-amber-900/30 text-amber-300 border border-amber-700/40'
                                            : 'bg-slate-800 text-slate-400'
                                    )}
                                    title={entry.count === 0 ? 'No moment yet tonight' : `${entry.count} moment${entry.count === 1 ? '' : 's'} tonight`}
                                >
                                    {entry.count === 0 ? 'quiet so far' : `${entry.count} moment${entry.count === 1 ? '' : 's'}`}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
