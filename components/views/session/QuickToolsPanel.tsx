
import React, { useRef, useState } from 'react';
import type { Campaign, SessionLog, Scene, Adventure, PlotSessionStatus } from '@/types';
import { Icons } from '@/components/common/Icons';
import { Button } from '@/components/common/Button';
import { twMerge } from 'tailwind-merge';
import { campaignService } from '@/services/campaignService';
import { DiceRoller } from '@/components/tools/DiceRoller';
import { SecretsTracker } from '@/components/tools/SecretsTracker';
import { QuickNpcGenerator } from './QuickNpcGenerator';
import { sampleDormantMaterial } from '@/utils/dormantMaterial';
import type { DormantPiece } from '@/utils/dormantMaterial';
import { generateCallbackComplication } from '@/services/aiService';
import { buildCampaignContext } from '@/services/contextBuilder';

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

/**
 * P2 — the Callback Machine. Distinct from `onOpenCoach`'s DM Coach (which
 * looks *forward* from a DM-typed situation): this looks *backward* into the
 * campaign's own dormant inventory and spends it, with nothing typed. See
 * `docs/design/storyteller-first-design.md` P2 and `lazy-dm-lens.md` §5's
 * no-crafted-prompt rule.
 */
type CallbackPhase =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'empty'; message: string }
    | { status: 'error'; message: string }
    | {
          status: 'result';
          material: DormantPiece[];
          complication: string;
          /** True once "Use It" has been pressed at least once — gates the reveal flip. */
          usedPressed: boolean;
          /** Set only once `addAutoEvent` actually landed — a false return must not claim success. */
          usedMessage: string | null;
          secretRevealed: boolean;
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

export const QuickToolsPanel: React.FC<QuickToolsPanelProps> = ({
    campaign,
    sessionLog,
    activeScene,
    adventure,
    activeSceneNpcs,
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
    const [callback, setCallback] = useState<CallbackPhase>({ status: 'idle' });
    // Synchronous in-flight latch: the state-based guard below reads a render
    // closure, so two presses landing before React commits would both pass it.
    const callbackInFlightRef = useRef(false);

    // Zero-prompt by construction: nothing here is DM-typed. The panel samples
    // the campaign's own dormant material and derives the scene summary and
    // campaign context itself.
    const runCallback = async () => {
        if (callbackInFlightRef.current || callback.status === 'loading') return;
        callbackInFlightRef.current = true;
        setCallback({ status: 'loading' });

        const sample = sampleDormantMaterial({
            campaign,
            activeSceneId: activeScene?.id ?? null,
        });

        if (sample.length === 0) {
            callbackInFlightRef.current = false;
            setCallback({
                status: 'empty',
                message: "Nothing dormant to spend right now — maybe it's time to write something new.",
            });
            return;
        }

        const sceneSummary = activeScene
            ? `The current scene is "${activeScene.title}"${activeSceneNpcs.length ? `, with ${activeSceneNpcs.map(n => n.name).join(', ')} present` : ''}.`
            : undefined;

        const campaignContext = buildCampaignContext({
            variant: 'coach',
            campaign,
            activeSceneId: campaign.activeSceneId,
            activeSessionId: campaign.activeSessionId,
        });

        try {
            const complication = await generateCallbackComplication(
                { material: sample, sceneSummary, campaignContext },
                isMockMode
            );
            setCallback({
                status: 'result',
                material: sample,
                complication,
                usedPressed: false,
                usedMessage: null,
                secretRevealed: false,
            });
        } catch (err) {
            setCallback({
                status: 'error',
                message: err instanceof Error ? err.message : 'Something went wrong generating that complication.',
            });
        } finally {
            callbackInFlightRef.current = false;
        }
    };

    const handleUseIt = () => {
        if (callback.status !== 'result' || callback.usedMessage) return;
        const logged = campaignService.addAutoEvent('coach-used', `Complication: ${callback.complication}`);
        // The reveal flip is gated on usedPressed, so only latch it when the
        // entry actually landed — otherwise a DM whose session already ended
        // would be offered a reveal against a session that never logged it.
        setCallback({ ...callback, usedPressed: logged, usedMessage: logged ? 'Logged to the running log.' : null });
    };

    const handleRevealSecret = () => {
        if (callback.status !== 'result' || callback.secretRevealed) return;
        const secretPiece = callback.material.find(p => p.kind === 'secret');
        if (!secretPiece) return;
        campaignService.revealSecret(secretPiece.id, campaign.activeSessionId);
        setCallback({ ...callback, secretRevealed: true });
    };

    const spentSecret = callback.status === 'result' ? callback.material.find(p => p.kind === 'secret') : undefined;

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
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={runCallback}
                    disabled={callback.status === 'loading'}
                    className="w-full justify-start"
                >
                    <Icons.Zap className="w-4 h-4 mr-2 text-amber-400" />
                    Complicate This
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
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowSecrets(prev => !prev)}
                        className={twMerge(
                            "w-full justify-start",
                            showSecrets && "bg-amber-900/30 text-amber-300 border border-amber-700/50 hover:bg-amber-900/40"
                        )}
                    >
                        <Icons.Lock className="w-4 h-4 mr-2 text-amber-400" />
                        Secrets & Clues
                        <Icons.ChevronDown className={twMerge("w-3 h-3 ml-auto text-slate-500 transition-transform", showSecrets && "rotate-180")} />
                    </Button>
                )}
            </div>

            {/* Callback Machine — zero-prompt reincorporation (P2) */}
            {callback.status !== 'idle' && (
                <div className="border-t border-slate-800 p-3">
                    {callback.status === 'loading' && (
                        <p className="text-xs text-slate-500 flex items-center gap-2">
                            <Icons.Loader className="w-3.5 h-3.5 animate-spin" />
                            Sampling the world for something to spend...
                        </p>
                    )}
                    {callback.status === 'empty' && (
                        <p role="status" className="text-xs text-slate-400 italic">{callback.message}</p>
                    )}
                    {callback.status === 'error' && (
                        <p role="alert" className="text-xs text-red-400 flex items-start gap-2">
                            <Icons.AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            {callback.message}
                        </p>
                    )}
                    {callback.status === 'result' && (
                        <div className="rounded-md border border-amber-700/40 bg-amber-900/10 p-3 space-y-2">
                            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                                <Icons.Zap className="w-3 h-3" />
                                Complication
                            </h4>
                            <p className="text-sm text-slate-200 leading-relaxed">{callback.complication}</p>
                            <ul className="space-y-0.5">
                                {/* A piece the complication already names outright needs no
                                    restating here — this list calls out what got spent that
                                    isn't otherwise visible in the read-aloud text above. */}
                                {callback.material.filter(piece => !callback.complication.includes(piece.label)).map(piece => (
                                    <li key={piece.id} className="text-[11px] text-slate-500">
                                        <span className="text-slate-300 font-medium">{piece.label}</span>
                                        {' — '}{piece.reason}
                                    </li>
                                ))}
                            </ul>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <Button variant="secondary" size="sm" onClick={handleUseIt}>
                                    <Icons.Check className="w-3.5 h-3.5 mr-1.5" />
                                    Use It
                                </Button>
                                <Button variant="ghost" size="sm" onClick={runCallback}>
                                    <Icons.RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                                    Another
                                </Button>
                                {callback.usedPressed && spentSecret && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleRevealSecret}
                                        disabled={callback.secretRevealed}
                                    >
                                        <Icons.Eye className="w-3.5 h-3.5 mr-1.5" />
                                        {callback.secretRevealed ? 'Secret revealed' : 'Mark secret revealed'}
                                    </Button>
                                )}
                            </div>
                            {callback.usedMessage && (
                                <p className="text-[11px] text-emerald-400">{callback.usedMessage}</p>
                            )}
                        </div>
                    )}
                </div>
            )}

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
                <div className="border-t border-slate-800 flex-shrink-0 max-h-[40vh] overflow-hidden flex flex-col">
                    <SecretsTracker
                        campaign={campaign}
                        activeSessionId={campaign.activeSessionId}
                        isMockMode={isMockMode}
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
                                            Click to cycle
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
