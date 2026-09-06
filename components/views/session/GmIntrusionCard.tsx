
import React, { useRef, useState } from 'react';
import type { Campaign, Scene } from '@/types';
import { Icons } from '@/components/common/Icons';
import { Button } from '@/components/common/Button';
import { campaignService } from '@/services/campaignService';
import { generateGmIntrusion } from '@/services/aiService';
import { buildCampaignContext } from '@/services/contextBuilder';

/**
 * §4.2 — GM Intrusion (Monte Cook / Cypher System), Quick Tools' second
 * live-complication control, sitting next to the Callback Machine's
 * "Complicate This" in `QuickToolsPanel.tsx`. Distinct from Callback:
 * Callback looks *backward* into the campaign's own dormant inventory and
 * throws when it has nothing to spend; this looks *forward* and needs
 * nothing established at all, so it is the one live-complication button that
 * still works in a session-1 campaign. Same zero-prompt, one-request,
 * in-flight-latched idiom as `QuickToolsPanel.tsx`'s `runCallback`
 * (docs/design/lazy-dm-lens.md §5's no-crafted-prompt rule).
 *
 * Split into a hook (`useGmIntrusion`) plus two presentational pieces
 * (`GmIntrusionButton`, `GmIntrusionResult`) rather than one component,
 * because — like every other Quick Tools control — the trigger button lives
 * in the tool button list while its result card renders in a separate spot
 * below; a single component can only render into one place in the tree.
 */

type GmIntrusionPhase =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | {
          status: 'result';
          complication: string;
          /** Set only once `addAutoEvent` actually landed — a false return must not claim success. */
          usedMessage: string | null;
      };

export interface UseGmIntrusionOptions {
    campaign: Campaign;
    isMockMode: boolean;
    /**
     * Unstructured play's derived stage line, when the runner supplies one —
     * takes priority over the scene-only fallback below, same as
     * `QuickToolsPanel.tsx`'s own `runCallback`.
     */
    stageSummary?: string;
    activeScene: Scene | null;
    activeSceneNpcs: { id: string; name: string }[];
}

export interface GmIntrusionApi {
    phase: GmIntrusionPhase;
    run: () => void;
    useIt: () => void;
}

export function useGmIntrusion(options: UseGmIntrusionOptions): GmIntrusionApi {
    const { campaign, isMockMode, stageSummary, activeScene, activeSceneNpcs } = options;
    const [phase, setPhase] = useState<GmIntrusionPhase>({ status: 'idle' });
    // Synchronous in-flight latch: the state-based guard below reads a render
    // closure, so two presses landing before React commits would both pass
    // it — same reasoning as runCallback's own ref latch.
    const inFlightRef = useRef(false);

    const run = () => {
        if (inFlightRef.current || phase.status === 'loading') return;
        inFlightRef.current = true;
        setPhase({ status: 'loading' });

        // Zero-precondition by construction: nothing here is DM-typed, and
        // nothing here is sampled from the campaign's dormant inventory
        // either — that is the whole difference from the Callback Machine.
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

        generateGmIntrusion(isMockMode, campaignContext, sceneSummary)
            .then((complication) => {
                setPhase({ status: 'result', complication, usedMessage: null });
            })
            .catch((err) => {
                setPhase({
                    status: 'error',
                    message: err instanceof Error ? err.message : 'Something went wrong generating that intrusion.',
                });
            })
            .finally(() => {
                inFlightRef.current = false;
            });
    };

    const useIt = () => {
        if (phase.status !== 'result' || phase.usedMessage) return;
        const logged = campaignService.addAutoEvent('coach-used', `GM Intrusion: ${phase.complication}`);
        // The confirmation only appears when the write actually landed — a
        // DM whose session already ended must not be told it was logged.
        setPhase({ ...phase, usedMessage: logged ? 'Logged to the running log.' : null });
    };

    return { phase, run, useIt };
}

export const GmIntrusionButton: React.FC<{ api: GmIntrusionApi }> = ({ api }) => (
    <Button
        variant="secondary"
        size="sm"
        onClick={api.run}
        disabled={api.phase.status === 'loading'}
        className="w-full justify-start"
    >
        <Icons.Sparkles className="w-4 h-4 mr-2 text-amber-400" />
        GM Intrusion
    </Button>
);

export const GmIntrusionResult: React.FC<{ api: GmIntrusionApi }> = ({ api }) => {
    const { phase, run, useIt } = api;
    if (phase.status === 'idle') return null;

    return (
        <div className="border-t border-slate-800 p-3">
            {phase.status === 'loading' && (
                <p className="text-xs text-slate-500 flex items-center gap-2">
                    <Icons.Loader className="w-3.5 h-3.5 animate-spin" />
                    Reaching for a twist...
                </p>
            )}
            {phase.status === 'error' && (
                <p role="alert" className="text-xs text-red-400 flex items-start gap-2">
                    <Icons.AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    {phase.message}
                </p>
            )}
            {phase.status === 'result' && (
                <div className="rounded-md border border-amber-700/40 bg-amber-900/10 p-3 space-y-2">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                        <Icons.Sparkles className="w-3 h-3" />
                        GM Intrusion
                    </h4>
                    <p className="text-sm text-slate-200 leading-relaxed">{phase.complication}</p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button variant="secondary" size="sm" onClick={useIt}>
                            <Icons.Check className="w-3.5 h-3.5 mr-1.5" />
                            Use It
                        </Button>
                        <Button variant="ghost" size="sm" onClick={run}>
                            <Icons.RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                            Another
                        </Button>
                    </div>
                    {phase.usedMessage && (
                        <p className="text-[11px] text-emerald-400">{phase.usedMessage}</p>
                    )}
                </div>
            )}
        </div>
    );
};
