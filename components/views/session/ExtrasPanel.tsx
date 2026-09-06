
import React, { useRef, useState } from 'react';
import type { Campaign, Scene, Adventure } from '@/types';
import { Icons } from '@/components/common/Icons';
import { Button } from '@/components/common/Button';
import { twMerge } from 'tailwind-merge';
import { campaignService } from '@/services/campaignService';
import { generateExtras, type ExtraNpc } from '@/services/aiService';
import { buildCampaignContext } from '@/services/contextBuilder';
import { createDefaultNpc } from '@/utils/entityUtils';

/**
 * §4.8 — Extras & spear-carriers (Sly Flourish step 6, scoped to the truly
 * disposable case the shipped Quick NPC Generator doesn't target). A
 * disclosure using the same toggle pattern as Quick Tools' Dice Roller: one
 * click generates 4-6 throwaway name + one-line-detail pairs for a crowd
 * scene, shown as plain copy-ready text. Each line can optionally be
 * promoted to a real NPC — everything else defaulted via the existing
 * `createDefaultNpc()` factory (read-only import) — and, the way
 * `QuickNpcGenerator.tsx` already does, linked to the active scene when one
 * is prepped and reported to the host via `onNpcCreated` when supplied.
 */

const EXTRAS_COUNT = 5;

export interface ExtrasPanelProps {
    campaign: Campaign;
    activeScene: Scene | null;
    adventure: Adventure | null;
    isMockMode: boolean;
    /** Forwarded to the caller after each promotion, same contract as `QuickNpcGenerator`'s prop of the same name. */
    onNpcCreated?: (npcId: string) => void;
}

export const ExtrasPanel: React.FC<ExtrasPanelProps> = ({ campaign, activeScene, adventure, isMockMode, onNpcCreated }) => {
    const [expanded, setExpanded] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [extras, setExtras] = useState<ExtraNpc[] | null>(null);
    const [promoted, setPromoted] = useState<Set<number>>(new Set());
    const [copied, setCopied] = useState(false);
    const inFlightRef = useRef(false);

    const handleGenerate = () => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        setGenerating(true);
        setError(null);
        setCopied(false);

        const campaignContext = buildCampaignContext({ variant: 'generation', campaign });

        generateExtras(EXTRAS_COUNT, campaignContext, false, isMockMode)
            .then((result) => {
                if (result.length === 0) {
                    setExtras(null);
                    setError('Nothing came back — try again.');
                } else {
                    setExtras(result);
                    setPromoted(new Set());
                }
            })
            .catch((err) => {
                setExtras(null);
                setError(err instanceof Error ? err.message : 'Generation failed.');
            })
            .finally(() => {
                inFlightRef.current = false;
                setGenerating(false);
            });
    };

    const handleCopyAll = () => {
        if (!extras || !navigator.clipboard?.writeText) return;
        const text = extras.map((e) => `${e.name} — ${e.detail}`).join('\n');
        navigator.clipboard.writeText(text)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            })
            .catch(() => { /* copy failed silently; no success state shown */ });
    };

    const handlePromote = (index: number) => {
        if (!extras || promoted.has(index)) return;
        const extra = extras[index];
        const { id: _defaultId, ...npcDefaults } = createDefaultNpc();
        const newNpcId = campaignService.createNpc({
            ...npcDefaults,
            name: extra.name,
            description: extra.detail,
        });

        // Auto-link to the current scene if there is one — same as QuickNpcGenerator.
        if (activeScene && adventure) {
            campaignService.updateScene(adventure.id, activeScene.id, {
                npcIds: [...activeScene.npcIds, newNpcId],
            });
        }

        campaignService.addAutoEvent('npc-created', `NPC created: ${extra.name}`);
        onNpcCreated?.(newNpcId);

        setPromoted((prev) => new Set(prev).add(index));
    };

    return (
        <>
            <Button
                variant="secondary"
                size="sm"
                onClick={() => setExpanded((prev) => !prev)}
                className="w-full justify-start"
            >
                <Icons.UserPlus className="w-4 h-4 mr-2 text-amber-400" />
                Extras
                <Icons.ChevronDown className={twMerge('w-3 h-3 ml-auto text-slate-500 transition-transform', expanded && 'rotate-180')} />
            </Button>

            {expanded && (
                <div className="space-y-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleGenerate}
                        disabled={generating}
                        className="w-full"
                    >
                        {generating ? (
                            <Icons.Loader className="w-4 h-4 animate-spin mr-1.5" />
                        ) : (
                            <Icons.Sparkles className="w-4 h-4 mr-1.5" />
                        )}
                        {extras ? 'Generate more' : 'Generate extras'}
                    </Button>

                    {error && <p className="text-xs text-red-400">{error}</p>}

                    {extras && extras.length > 0 && (
                        <div className="rounded-md border border-slate-700 bg-slate-800/60 p-2 space-y-1.5">
                            <div className="flex justify-end">
                                <Button variant="ghost" size="sm" onClick={handleCopyAll}>
                                    {copied ? (
                                        <Icons.Check className="w-3.5 h-3.5 mr-1 text-green-400" />
                                    ) : (
                                        <Icons.Clipboard className="w-3.5 h-3.5 mr-1" />
                                    )}
                                    {copied ? 'Copied' : 'Copy all'}
                                </Button>
                            </div>
                            <ul className="space-y-1">
                                {extras.map((extra, i) => (
                                    <li key={`${extra.name}-${i}`} className="flex items-start justify-between gap-2 px-1 py-0.5">
                                        <p className="text-xs text-slate-200 min-w-0">
                                            <span className="font-semibold">{extra.name}</span>
                                            <span className="text-slate-500"> — {extra.detail}</span>
                                        </p>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handlePromote(i)}
                                            disabled={promoted.has(i)}
                                            className="flex-shrink-0"
                                        >
                                            {promoted.has(i) ? (
                                                <>
                                                    <Icons.Check className="w-3.5 h-3.5 mr-1 text-green-400" />
                                                    Added
                                                </>
                                            ) : (
                                                'Promote to NPC'
                                            )}
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};
