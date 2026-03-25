
import React, { useState } from 'react';
import type { Campaign, SessionLog, Scene, Adventure, PlotSessionStatus } from '@/types';
import { Icons } from '@/components/common/Icons';
import { Button } from '@/components/common/Button';
import { twMerge } from 'tailwind-merge';
import { campaignService } from '@/services/campaignService';
import { DiceRoller } from '@/components/tools/DiceRoller';
import { SecretsTracker } from '@/components/tools/SecretsTracker';
import { QuickNpcGenerator } from './QuickNpcGenerator';

interface QuickToolsPanelProps {
    campaign: Campaign;
    sessionLog: SessionLog;
    activeScene: Scene | null;
    adventure: Adventure | null;
    activeSceneNpcs: { id: string; name: string }[];
    plotSessionStatus: Record<string, PlotSessionStatus>;
    isMockMode: boolean;
    mobileTab: 'scenes' | 'active' | 'tools';
    canShowCombatTracker: boolean;
    canShowSecretsTracker: boolean;
    onOpenCoach: () => void;
    onOpenCombat: () => void;
    onCyclePlotStatus: (plotId: string) => void;
    onNavigate?: (entityType: string, entityId: string) => void;
}

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

export const QuickToolsPanel: React.FC<QuickToolsPanelProps> = ({
    campaign,
    sessionLog,
    activeScene,
    adventure,
    plotSessionStatus,
    isMockMode,
    mobileTab,
    canShowCombatTracker,
    canShowSecretsTracker,
    onOpenCoach,
    onOpenCombat,
    onCyclePlotStatus,
}) => {
    const [showDiceRoller, setShowDiceRoller] = useState(false);
    const [showSecrets, setShowSecrets] = useState(false);
    const [showQuickNpc, setShowQuickNpc] = useState(false);

    return (
        <div className={twMerge(
            "flex-shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col overflow-y-auto",
            "w-full md:w-64",
            mobileTab === 'tools' ? "flex md:flex" : "hidden md:flex"
        )}>
            <div className="p-3 border-b border-slate-800">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quick Tools</h2>
            </div>

            <div className="p-3 space-y-2">
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={onOpenCoach}
                    className="w-full justify-start"
                >
                    <Icons.Coach className="w-4 h-4 mr-2 text-amber-400" />
                    DM Coach
                </Button>
                {canShowCombatTracker && (
                    <Button
                        variant="secondary"
                        size="sm"
                        className="w-full justify-start"
                        onClick={onOpenCombat}
                    >
                        <Icons.Combat className="w-4 h-4 mr-2 text-red-400" />
                        Combat Tracker
                    </Button>
                )}
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowDiceRoller(p => !p)}
                    className="w-full justify-start"
                >
                    <Icons.Dice className="w-4 h-4 mr-2 text-amber-400" />
                    Dice Roller
                    <Icons.ChevronDown className={twMerge("w-3 h-3 ml-auto text-slate-500 transition-transform", showDiceRoller && "rotate-180")} />
                </Button>
                {showDiceRoller && (
                    <DiceRoller onLogRoll={(roll) => campaignService.addDiceRollToSession(roll)} />
                )}
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowQuickNpc(!showQuickNpc)}
                    className={twMerge(
                        "w-full justify-start",
                        showQuickNpc && "bg-emerald-900/40 text-emerald-300 border border-emerald-700/50 hover:bg-emerald-900/50"
                    )}
                >
                    <Icons.UserPlus className="w-4 h-4 mr-2 text-emerald-400" />
                    Quick NPC
                </Button>
                {canShowSecretsTracker && (
                    <button
                        onClick={() => setShowSecrets(prev => !prev)}
                        className={twMerge(
                            "w-full flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-lg text-sm transition-colors",
                            showSecrets
                                ? "bg-amber-900/30 text-amber-300 border border-amber-700/50"
                                : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                        )}
                    >
                        <Icons.Lock className="w-4 h-4 text-amber-400" />
                        Secrets & Clues
                        <Icons.ChevronDown className={twMerge("w-3 h-3 ml-auto text-slate-500 transition-transform", showSecrets && "rotate-180")} />
                    </button>
                )}
            </div>

            {/* Quick NPC Inline Form */}
            {showQuickNpc && (
                <QuickNpcGenerator
                    campaign={campaign}
                    activeScene={activeScene}
                    adventure={adventure}
                    isMockMode={isMockMode}
                    onNpcSaved={() => setShowQuickNpc(false)}
                />
            )}

            {/* Secrets & Clues Panel */}
            {canShowSecretsTracker && showSecrets && (
                <div className="border-t border-slate-800 flex-shrink-0 max-h-[400px] overflow-hidden flex flex-col">
                    <SecretsTracker
                        campaign={campaign}
                        activeSessionId={campaign.activeSessionId}
                    />
                </div>
            )}

            {/* Active Plots */}
            <div className="p-3 border-t border-slate-800">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
                    <Icons.Plot className="w-3 h-3 inline mr-1" />
                    Active Plots
                </h3>
                {sessionLog.relatedPlotIds.length > 0 ? (
                    <div className="space-y-2">
                        {sessionLog.relatedPlotIds.map(plotId => {
                            const plot = campaign.plots.find(p => p.id === plotId);
                            const status = plotSessionStatus[plotId] || 'unchanged';
                            return plot ? (
                                <button
                                    key={plot.id}
                                    onClick={() => onCyclePlotStatus(plot.id)}
                                    className="w-full text-left border-l-2 border-amber-600/50 pl-2.5 py-1 hover:bg-slate-800/50 rounded-r transition-colors group"
                                >
                                    <p className="text-sm text-amber-200 font-medium">{plot.title}</p>
                                    {plot.description && (
                                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                                            {plot.description.substring(0, 120)}{plot.description.length > 120 ? '...' : ''}
                                        </p>
                                    )}
                                    <div className="flex items-center justify-between mt-1">
                                        {plotStatusBadge(status)}
                                        <span className="text-[10px] text-slate-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                            <Icons.RefreshCw className="w-2.5 h-2.5" />
                                            tap to cycle
                                        </span>
                                    </div>
                                </button>
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
    );
};
