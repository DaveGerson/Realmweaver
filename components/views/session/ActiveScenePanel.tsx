
import React, { useState, useCallback } from 'react';
import type { Campaign, Scene, Location, NPC, SessionLog, DiceRoll } from '@/types';
import { Icons, SceneIcon } from '@/components/common/Icons';
import { twMerge } from 'tailwind-merge';
import { campaignService } from '@/services/campaignService';
import { EntityLink } from '@/components/common/EntityLink';
import { LinkedText } from '@/components/common/LinkedText';
import { rollDice } from '@/utils/diceUtils';
import type { QuickCardEntityType } from '@/components/common/EntityQuickCard';

interface ActiveScenePanelProps {
    activeScene: Scene | null;
    activeSceneLocation: Location | null;
    activeSceneNpcs: NPC[];
    sceneNpcRelationshipMap: Map<string, { relationType: string; targetId: string; targetName: string }[]>;
    castDynamicsSummary: string | null;
    campaign: Campaign;
    previousSession: SessionLog | null;
    mobileTab: 'scenes' | 'active' | 'tools';
    onAdvanceScene: () => void;
    onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
}

export const ActiveScenePanel: React.FC<ActiveScenePanelProps> = ({
    activeScene,
    activeSceneLocation,
    activeSceneNpcs,
    sceneNpcRelationshipMap,
    castDynamicsSummary,
    campaign,
    previousSession,
    mobileTab,
    onAdvanceScene,
    onNavigate,
}) => {
    const [showRecap, setShowRecap] = useState(true);
    const [skillCheckRolls, setSkillCheckRolls] = useState<Record<number, { total: number; passed: boolean }>>({});

    const handleSkillCheckRoll = useCallback((checkIndex: number, dc: number, skillName: string) => {
        const { results, total } = rollDice({ count: 1, sides: 20, modifier: 0 });
        const passed = total >= dc;
        setSkillCheckRolls(prev => ({ ...prev, [checkIndex]: { total, passed } }));

        const roll: DiceRoll = {
            id: crypto.randomUUID(),
            formula: '1d20',
            results,
            total,
            timestamp: new Date().toISOString(),
            note: `${skillName} check (DC ${dc}) - ${passed ? 'Pass' : 'Fail'}`,
        };
        campaignService.addDiceRollToSession(roll);
    }, []);

    return (
        <div className={twMerge(
            "flex-1 overflow-y-auto p-4 md:p-6",
            mobileTab === 'active' ? "flex flex-col md:block" : "hidden md:block"
        )}>
            {activeScene ? (
                <div className="max-w-3xl mx-auto space-y-6">
                    {/* Previously... Recap Banner */}
                    {showRecap && previousSession?.recap && (
                        <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-4 relative">
                            <button
                                onClick={() => setShowRecap(false)}
                                className="absolute top-2 right-2 text-slate-500 hover:text-slate-300"
                            >
                                <Icons.X className="w-4 h-4" />
                            </button>
                            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Previously...</h3>
                            <p className="text-sm text-slate-300 leading-relaxed">{previousSession.recap}</p>
                            {previousSession.looseEnds && (
                                <div className="mt-2 pt-2 border-t border-slate-700/30">
                                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">Unresolved Threads</h4>
                                    <p className="text-xs text-amber-200">{previousSession.looseEnds}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Scene Title */}
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-wrap">
                            <SceneIcon type={activeScene.type} />
                            <h2 className="text-xl md:text-2xl font-bold text-white font-serif">{activeScene.title}</h2>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 uppercase">{activeScene.type}</span>
                        </div>
                        <button
                            onClick={onAdvanceScene}
                            className="flex-shrink-0 flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-2 min-h-[44px] rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm transition-colors"
                        >
                            <Icons.SkipForward className="w-4 h-4" />
                            <span className="hidden sm:inline">Next Scene</span>
                        </button>
                    </div>

                    {/* Read-Aloud Text */}
                    {activeScene.readAloudText && (
                        <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg p-4">
                            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Read Aloud</h3>
                            <p className="text-lg italic text-amber-100/90 leading-relaxed font-serif border-l-4 border-amber-700/40 pl-4 whitespace-pre-wrap">
                                {onNavigate
                                    ? <LinkedText text={activeScene.readAloudText} onNavigate={onNavigate} />
                                    : activeScene.readAloudText
                                }
                            </p>
                        </div>
                    )}

                    {/* GM Notes */}
                    {activeScene.gmNotes && (
                        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">GM Notes</h3>
                            <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">
                                {onNavigate
                                    ? <LinkedText text={activeScene.gmNotes} onNavigate={onNavigate} />
                                    : activeScene.gmNotes
                                }
                            </p>
                        </div>
                    )}

                    {/* Location */}
                    {activeSceneLocation && (
                        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                <Icons.Locations className="w-3 h-3 inline mr-1" />
                                Location
                            </h3>
                            <p className="text-white font-semibold">
                                {onNavigate
                                    ? <EntityLink entityType="location" entityId={activeSceneLocation.id} label={activeSceneLocation.name} onNavigate={onNavigate} />
                                    : activeSceneLocation.name
                                }
                            </p>
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
                            {/* Cast dynamics summary */}
                            {castDynamicsSummary && (
                                <p className="text-slate-500 text-xs italic mb-3">{castDynamicsSummary}</p>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {activeSceneNpcs.map(npc => {
                                    const faction = npc.factionId ? campaign.factions.find(f => f.id === npc.factionId) : null;
                                    const npcRels = sceneNpcRelationshipMap.get(npc.id) ?? [];
                                    return (
                                        <div key={npc.id} className="bg-slate-900/50 rounded-md p-3">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-white font-semibold text-sm">
                                                    {onNavigate
                                                        ? <EntityLink entityType="npc" entityId={npc.id} label={npc.name} onNavigate={onNavigate} />
                                                        : npc.name
                                                    }
                                                </p>
                                                {faction && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 uppercase font-bold">
                                                        {onNavigate
                                                            ? <EntityLink entityType="faction" entityId={faction.id} label={faction.name} onNavigate={onNavigate} className="text-[10px] uppercase font-bold no-underline" />
                                                            : faction.name
                                                        }
                                                    </span>
                                                )}
                                            </div>
                                            {npc.traits && <p className="text-slate-400 text-xs mt-1">{npc.traits}</p>}
                                            {npc.motivations && <p className="text-slate-500 text-xs mt-1 italic">{npc.motivations}</p>}
                                            {npc.exampleQuote && <p className="text-amber-400/70 text-xs mt-1 italic">"{npc.exampleQuote}"</p>}
                                            {/* Inter-NPC relationship badges */}
                                            {npcRels.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {npcRels.map((r, idx) => {
                                                        const relLower = r.relationType.toLowerCase();
                                                        const badgeClass = relLower.includes('rival') || relLower.includes('enemy') || relLower.includes('foe')
                                                            ? 'bg-red-500/15 text-red-400 border-red-500/30'
                                                            : relLower.includes('ally') || relLower.includes('friend') || relLower.includes('allied')
                                                                ? 'bg-green-500/15 text-green-400 border-green-500/30'
                                                                : relLower.includes('family') || relLower.includes('sibling') || relLower.includes('parent') || relLower.includes('child')
                                                                    ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                                                                    : 'bg-slate-500/15 text-slate-400 border-slate-500/30';
                                                        return (
                                                            <span
                                                                key={idx}
                                                                className={twMerge('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', badgeClass)}
                                                            >
                                                                {r.relationType} of{' '}
                                                                {onNavigate
                                                                    ? <EntityLink entityType="npc" entityId={r.targetId} label={r.targetName} onNavigate={onNavigate} className="text-[10px] font-medium no-underline" />
                                                                    : r.targetName
                                                                }
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
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
                                {activeScene.skillChecks.map((check, i) => {
                                    const rollResult = skillCheckRolls[i];
                                    return (
                                        <div key={i} className="flex items-center gap-3 text-sm flex-wrap">
                                            <span className="text-amber-400 font-mono font-bold">DC {check.dc}</span>
                                            <span className="text-white">{check.skill}</span>
                                            {check.description && <span className="text-slate-400">— {check.description}</span>}
                                            <button
                                                onClick={() => handleSkillCheckRoll(i, check.dc, check.skill)}
                                                className="px-2 py-0.5 rounded-md bg-amber-700 hover:bg-amber-600 text-white text-xs font-semibold transition-colors flex items-center gap-1"
                                                title={`Roll 1d20 vs DC ${check.dc}`}
                                            >
                                                <Icons.Dice className="w-3 h-3" />
                                                Roll
                                            </button>
                                            {rollResult && (
                                                <span className={twMerge(
                                                    "text-xs font-mono font-bold px-2 py-0.5 rounded-full",
                                                    rollResult.passed
                                                        ? "bg-green-500/20 text-green-400"
                                                        : "bg-red-500/20 text-red-400"
                                                )}>
                                                    Rolled: {rollResult.total} — {rollResult.passed ? 'Pass' : 'Fail'}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
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
    );
};
