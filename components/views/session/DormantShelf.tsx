
import React, { useMemo, useRef, useState } from 'react';
import type { Campaign, Scene } from '@/types';
import { Icons } from '@/components/common/Icons';
import { Button } from '@/components/common/Button';
import { twMerge } from 'tailwind-merge';
import { campaignService } from '@/services/campaignService';
import { collectDormantCandidates, DORMANT_KIND_ORDER } from '@/utils/dormantMaterial';
import type { DormantPiece, DormantKind } from '@/utils/dormantMaterial';
import { generateCallbackComplication } from '@/services/aiService';
import { buildCampaignContext } from '@/services/contextBuilder';

/**
 * §4.7 — Browse the Shelf (Monte Cook: "prep what excites you, discard
 * freely" — unused prep is inventory, not a failure). The Callback Machine's
 * own sampler in `QuickToolsPanel.tsx` is random; this is the same
 * inventory, made choosable. A disclosure — collapsed by default, so it
 * costs nothing to a DM who never opens it — listing every bucket
 * `collectDormantCandidates` already computes, each item spendable on its
 * own via the exact same `generateCallbackComplication` facade Callback
 * uses, bypassing the random sampler entirely. `utils/dormantMaterial.ts` is
 * read-only here — nothing in this file changes it.
 *
 * Deliberately self-contained rather than sharing `QuickToolsPanel.tsx`'s own
 * `callback` state: that state lives inside the host component, so this
 * feature keeps a small state machine of its own — result card included —
 * rather than reaching into a sibling component's internals.
 */

const BUCKET_LABELS: Record<DormantKind, string> = {
    npc: 'Offstage cast',
    secret: 'Unrevealed secrets',
    plot: 'Stalled threads',
    scene: 'Unused scenes',
};

type SpendPhase =
    | { status: 'idle' }
    | { status: 'loading'; pieceId: string }
    | { status: 'error'; message: string }
    | {
          status: 'result';
          complication: string;
          /** Set only once `addAutoEvent` actually landed — a false return must not claim success. */
          usedMessage: string | null;
      };

export interface DormantShelfProps {
    campaign: Campaign;
    activeScene: Scene | null;
    activeSceneNpcs: { id: string; name: string }[];
    /** Everyone on stage right now (scene cast ∪ Stage cast) — forwarded verbatim to `collectDormantCandidates`. */
    presentNpcIds?: string[];
    /** Unstructured play's derived stage line, when the runner supplies one. */
    stageSummary?: string;
    isMockMode: boolean;
}

export const DormantShelf: React.FC<DormantShelfProps> = ({
    campaign,
    activeScene,
    activeSceneNpcs,
    presentNpcIds,
    stageSummary,
    isMockMode,
}) => {
    const [expanded, setExpanded] = useState(false);
    const [spend, setSpend] = useState<SpendPhase>({ status: 'idle' });
    const inFlightRef = useRef(false);

    const pools = useMemo(
        () => collectDormantCandidates(campaign, activeScene?.id ?? null, presentNpcIds),
        [campaign, activeScene?.id, presentNpcIds]
    );

    const nonEmptyKinds = DORMANT_KIND_ORDER.filter((kind) => pools[kind].length > 0);

    const handleSpend = (piece: DormantPiece) => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        setSpend({ status: 'loading', pieceId: piece.id });

        const sceneSummary = stageSummary?.trim()
            ? stageSummary.trim()
            : activeScene
                ? `The current scene is "${activeScene.title}"${activeSceneNpcs.length ? `, with ${activeSceneNpcs.map(n => n.name).join(', ')} present` : ''}.`
                : undefined;

        const campaignContext = buildCampaignContext({
            variant: 'coach',
            campaign,
            activeSceneId: campaign.activeSceneId,
            activeSessionId: campaign.activeSessionId,
        });

        generateCallbackComplication({ material: [piece], sceneSummary, campaignContext }, isMockMode)
            .then((complication) => {
                setSpend({ status: 'result', complication, usedMessage: null });
            })
            .catch((err) => {
                setSpend({
                    status: 'error',
                    message: err instanceof Error ? err.message : 'Something went wrong generating that complication.',
                });
            })
            .finally(() => {
                inFlightRef.current = false;
            });
    };

    const handleUseIt = () => {
        if (spend.status !== 'result' || spend.usedMessage) return;
        const logged = campaignService.addAutoEvent('coach-used', `Complication: ${spend.complication}`);
        setSpend({ ...spend, usedMessage: logged ? 'Logged to the running log.' : null });
    };

    return (
        <div className="border-t border-slate-800">
            <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                aria-expanded={expanded}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-slate-400 hover:text-slate-200 uppercase tracking-wider transition-colors"
            >
                <Icons.FolderOpen className="w-3.5 h-3.5" />
                Browse dormant material
                <Icons.ChevronDown className={twMerge('w-3 h-3 ml-auto transition-transform', expanded && 'rotate-180')} />
            </button>

            {expanded && (
                <div className="px-3 pb-3 space-y-3">
                    {nonEmptyKinds.length === 0 && (
                        <p role="status" className="text-xs text-slate-500 italic">
                            Nothing dormant to browse yet — maybe it's time to write something new.
                        </p>
                    )}

                    {nonEmptyKinds.map((kind) => (
                        <div key={kind}>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                {BUCKET_LABELS[kind]}
                            </p>
                            <ul className="space-y-1">
                                {pools[kind].map((piece) => (
                                    <li
                                        key={piece.id}
                                        className="flex items-start justify-between gap-2 bg-slate-800/60 rounded-md px-2 py-1.5"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-xs text-slate-200 font-medium truncate">{piece.label}</p>
                                            <p className="text-[11px] text-slate-500">{piece.reason}</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleSpend(piece)}
                                            disabled={spend.status === 'loading'}
                                            className="flex-shrink-0"
                                            aria-label={`Spend this: ${piece.label}`}
                                        >
                                            {spend.status === 'loading' && spend.pieceId === piece.id ? (
                                                <Icons.Loader className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                'Spend this'
                                            )}
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}

                    {spend.status === 'error' && (
                        <p role="alert" className="text-xs text-red-400 flex items-start gap-2">
                            <Icons.AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            {spend.message}
                        </p>
                    )}

                    {spend.status === 'result' && (
                        <div className="rounded-md border border-amber-700/40 bg-amber-900/10 p-3 space-y-2">
                            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                                <Icons.Zap className="w-3 h-3" />
                                Complication
                            </h4>
                            <p className="text-sm text-slate-200 leading-relaxed">{spend.complication}</p>
                            {/* Named per tool: Complicate This's own Use It can be on screen at the same time. */}
                            <Button variant="secondary" size="sm" onClick={handleUseIt} aria-label="Use it — from the shelf">
                                <Icons.Check className="w-3.5 h-3.5 mr-1.5" />
                                Use It
                            </Button>
                            {spend.usedMessage && (
                                <p className="text-[11px] text-emerald-400">{spend.usedMessage}</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
