
import React, { useState, useCallback } from 'react';
import type { Campaign, SessionLog, Scene, Beat } from '@/types';
import { Icons } from '@/components/common/Icons';
import { twMerge } from 'tailwind-merge';
import { campaignService } from '@/services/campaignService';
import { EntityLink } from '@/components/common/EntityLink';
import type { QuickCardEntityType } from '@/components/common/EntityQuickCard';

interface SceneListPanelProps {
    plannedScenes: Scene[];
    activeSceneId: string | null | undefined;
    campaign: Campaign;
    sessionLog: SessionLog;
    previousSessionRecap: string | null;
    mobileTab: 'scenes' | 'active' | 'tools';
    onSelectScene: (sceneId: string) => void;
    onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
}

const sceneStatusIcon = (scene: Scene) => {
    switch (scene.status) {
        case 'completed': return <Icons.CheckCircle className="w-4 h-4 text-green-400" />;
        case 'in-progress': return <Icons.Play className="w-4 h-4 text-amber-400" />;
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
}) => {
    const [beatInput, setBeatInput] = useState('');

    const handleAddBeat = useCallback(() => {
        const title = beatInput.trim();
        if (!title) return;
        campaignService.addBeat(title);
        setBeatInput('');
    }, [beatInput]);

    return (
        <div className={twMerge(
            "flex-shrink-0 bg-slate-900 border-r border-slate-800 overflow-y-auto p-3",
            "w-full md:w-56",
            mobileTab === 'scenes' ? "flex flex-col md:flex" : "hidden md:flex md:flex-col"
        )}>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Scenes</h2>
            <div className="space-y-1">
                {plannedScenes.map((scene) => {
                    const sceneLocation = scene.locationId
                        ? campaign.locations.find(l => l.id === scene.locationId)
                        : null;
                    const sceneNpcCount = scene.npcIds.length;
                    const isActive = activeSceneId === scene.id;
                    return (
                        <div
                            key={scene.id}
                            className={twMerge(
                                "flex items-stretch rounded-lg text-sm transition-all",
                                isActive
                                    ? "bg-amber-900/30 border border-amber-700/50"
                                    : "hover:bg-slate-800"
                            )}
                        >
                            {/* Main scene button — click to activate */}
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
                                <span className="flex-shrink-0 mt-0.5">{sceneStatusIcon(scene)}</span>
                                <span className="flex flex-col min-w-0">
                                    <span className="truncate">{scene.title}</span>
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
                            <div className="flex items-center pr-1.5 flex-shrink-0">
                                <EntityLink
                                    entityType="scene"
                                    entityId={scene.id}
                                    label={<Icons.Help className="w-3.5 h-3.5 text-slate-500 hover:text-blue-400 transition-colors" />}
                                    onNavigate={onNavigate ?? (() => {})}
                                    className="p-1 rounded no-underline"
                                />
                            </div>
                        </div>
                    );
                })}
                {plannedScenes.length === 0 && (
                    <p className="text-xs text-slate-500 italic px-2">No scenes planned</p>
                )}
            </div>

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
                            <button
                                onClick={() => campaignService.deleteBeat(beat.id)}
                                className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-red-400"
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
                    <button
                        onClick={handleAddBeat}
                        disabled={!beatInput.trim()}
                        className="flex-shrink-0 p-1 rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300 transition-colors"
                        title="Add beat"
                    >
                        <Icons.Plus className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
};
