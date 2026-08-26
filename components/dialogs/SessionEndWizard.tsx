
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { Campaign, SessionLog, Plot, PlotSessionStatus, PlotStatus } from '../../types/index';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { twMerge } from 'tailwind-merge';
import { campaignService } from '../../services/campaignService';
import { generateSessionRecap } from '../../services/aiService';
import { DialogShell } from '../common/DialogShell';
import { useToast } from '@/hooks/useToast';

type WizardStep = 'recap' | 'plots' | 'loose-ends' | 'player-recap' | 'confirm';

const STEP_ORDER: WizardStep[] = ['recap', 'plots', 'loose-ends', 'player-recap', 'confirm'];
const STEP_LABELS: Record<WizardStep, string> = {
    'recap': 'AI Recap',
    'plots': 'Plot Status',
    'loose-ends': 'Loose Ends',
    'player-recap': 'Player Recap',
    'confirm': 'Save & End',
};

interface SessionEndWizardProps {
    campaign: Campaign;
    sessionLog: SessionLog;
    isMockMode: boolean;
    onComplete: () => void;
    onCancel: () => void;
}

export const SessionEndWizard: React.FC<SessionEndWizardProps> = ({
    campaign,
    sessionLog,
    isMockMode,
    onComplete,
    onCancel,
}) => {
    const { addToast } = useToast();
    const [currentStep, setCurrentStep] = useState<WizardStep>('recap');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generateError, setGenerateError] = useState<string | null>(null);

    // Recap state
    const [recap, setRecap] = useState(sessionLog.recap || '');
    const [aiLooseEnds, setAiLooseEnds] = useState<string[]>([]);

    // Plot status state -- initialized from existing plotProgressions
    const [plotStatuses, setPlotStatuses] = useState<Record<string, PlotSessionStatus>>(
        () => sessionLog.plotProgressions || {}
    );

    // Loose ends state
    const [looseEnds, setLooseEnds] = useState(sessionLog.looseEnds || '');
    const [manualLooseEnd, setManualLooseEnd] = useState('');

    // R5: unfinished beats carried forward into loose ends. Blank/whitespace
    // titles never count as "something to carry" and never get appended.
    const incompleteBeats = useMemo(
        () => (sessionLog.beats || []).filter(b => !b.isCompleted && b.title.trim() !== ''),
        [sessionLog.beats]
    );

    // One click, idempotent: dedupe against whatever the loose-ends text
    // already has (a prior click, the saved value, or the DM's own typing),
    // matched by trimmed line — never against raw string identity.
    const handleCarryForwardBeats = useCallback(() => {
        if (incompleteBeats.length === 0) return;
        setLooseEnds(prev => {
            const existingTrimmed = new Set(prev.split('\n').map(l => l.trim()));
            const seenThisClick = new Set<string>();
            const toAdd: string[] = [];
            incompleteBeats.forEach(b => {
                const title = b.title.trim();
                if (existingTrimmed.has(title) || seenThisClick.has(title)) return;
                seenThisClick.add(title);
                toAdd.push(title);
            });
            if (toAdd.length === 0) return prev;
            // Absorb a trailing newline instead of doubling it into a blank line.
            const base = prev.replace(/\n+$/, '');
            return base ? `${base}\n${toAdd.join('\n')}` : toAdd.join('\n');
        });
    }, [incompleteBeats]);

    // Player-facing recap state
    // Finding #25 regression fix: seed from the previously saved value, like
    // its `recap`/`looseEnds` siblings, so re-opening the wizard on a log that
    // already has a saved player recap doesn't blank it on the next save.
    const [playerRecap, setPlayerRecap] = useState(sessionLog.playerRecap || '');
    const [showCopied, setShowCopied] = useState(false);

    // Get related plots
    const relatedPlots = useMemo(() => {
        return sessionLog.relatedPlotIds
            .map(id => campaign.plots.find(p => p.id === id))
            .filter((p): p is Plot => !!p);
    }, [sessionLog.relatedPlotIds, campaign.plots]);

    // Build session notes for AI
    const sessionNotesText = useMemo(() => {
        const notes = sessionLog.structuredNotes || [];
        return notes.map(n => {
            const time = new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const typeLabel = n.type && n.type !== 'manual' ? `[${n.type}] ` : '';
            return `${time} ${typeLabel}${n.content}`;
        }).join('\n');
    }, [sessionLog.structuredNotes]);

    const plotSummariesText = useMemo(() => {
        return relatedPlots.map(p => `- ${p.title}: ${p.description || 'No description'}`).join('\n');
    }, [relatedPlots]);

    // Generate AI recap
    const handleGenerateRecap = useCallback(async () => {
        setIsGenerating(true);
        setGenerateError(null);
        try {
            const campaignContext = `Campaign: ${campaign.title}\nSetting: ${campaign.setting}`;
            // E3: the player-facing half of the recap is generated against a
            // separately-derived player-safe context (never the GM
            // `campaignContext` above) so unrevealed secrets, GM notes and
            // hidden NPC motivations can't leak into the text the DM shares
            // with the party. See tests/services/dmCoach.playerSafeRecap.test.ts.
            const result = await generateSessionRecap(
                sessionNotesText || sessionLog.runningNotes || 'No notes recorded.',
                plotSummariesText,
                campaignContext,
                isMockMode,
                {
                    campaign,
                    activeSceneId: campaign.activeSceneId,
                    activeSessionId: campaign.activeSessionId,
                },
            );
            setRecap(result.recap);
            setAiLooseEnds(result.looseEnds);
            setPlayerRecap(result.playerFacingRecap);

            // Pre-populate loose ends from AI
            const combined = [
                ...(sessionLog.looseEnds ? [sessionLog.looseEnds] : []),
                ...result.looseEnds,
            ];
            setLooseEnds(combined.join('\n'));
        } catch (err) {
            setGenerateError(err instanceof Error ? err.message : 'Failed to generate recap');
        } finally {
            setIsGenerating(false);
        }
    }, [sessionNotesText, plotSummariesText, campaign.title, campaign.setting, isMockMode, sessionLog.runningNotes, sessionLog.looseEnds]);

    // M24: Only auto-trigger recap if there are enough notes to produce a quality result.
    // With sparse notes the AI tends to hallucinate; let the DM decide instead.
    const AUTO_TRIGGER_NOTE_THRESHOLD = 5;
    const noteCount = sessionLog.structuredNotes?.length ?? 0;
    const hasEnoughNotesForAutoRecap = noteCount >= AUTO_TRIGGER_NOTE_THRESHOLD;

    useEffect(() => {
        if (!recap && hasEnoughNotesForAutoRecap && (sessionNotesText || sessionLog.runningNotes)) {
            handleGenerateRecap();
        }
        // Run only on mount; handleGenerateRecap is stable via useCallback
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Plot status cycling
    const cyclePlotStatus = useCallback((plotId: string) => {
        setPlotStatuses(prev => {
            const current = prev[plotId] || 'unchanged';
            const next: PlotSessionStatus =
                current === 'unchanged' ? 'advanced' :
                current === 'advanced' ? 'stalled' :
                'unchanged';
            return { ...prev, [plotId]: next };
        });
    }, []);

    // Add manual loose end
    const handleAddLooseEnd = useCallback(() => {
        if (!manualLooseEnd.trim()) return;
        setLooseEnds(prev => prev ? `${prev}\n${manualLooseEnd.trim()}` : manualLooseEnd.trim());
        setManualLooseEnd('');
    }, [manualLooseEnd]);

    // Copy player recap
    const handleCopyPlayerRecap = useCallback(() => {
        if (!navigator.clipboard?.writeText) {
            addToast('Copy failed — select the text and copy manually', 'error');
            return;
        }
        navigator.clipboard.writeText(playerRecap)
            .then(() => {
                setShowCopied(true);
                setTimeout(() => setShowCopied(false), 2000);
            })
            .catch(() => {
                addToast('Copy failed — select the text and copy manually', 'error');
            });
    }, [playerRecap, addToast]);

    // Save and complete
    const handleSaveAndEnd = useCallback(() => {
        // Update session log with recap data, including the per-plot progression for this
        // session (plotProgressions lives on the SessionLog, not on the Plot entities).
        campaignService.updateSessionLog(sessionLog.id, {
            recap,
            looseEnds,
            plotProgressions: plotStatuses,
            playerRecap,
        });

        // End the session (archives encounter, marks completed, clears active state)
        campaignService.endSession();

        onComplete();
    }, [recap, looseEnds, plotStatuses, playerRecap, sessionLog.id, onComplete]);

    // Navigation
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    const canGoNext = currentIndex < STEP_ORDER.length - 1;
    const canGoPrev = currentIndex > 0;
    const goNext = () => { if (canGoNext) setCurrentStep(STEP_ORDER[currentIndex + 1]); };
    const goPrev = () => { if (canGoPrev) setCurrentStep(STEP_ORDER[currentIndex - 1]); };

    const plotStatusBadge = (status: PlotSessionStatus) => {
        switch (status) {
            case 'advanced':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-bold uppercase"><Icons.Advanced className="w-3 h-3" />Advanced</span>;
            case 'stalled':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold uppercase"><Icons.Stalled className="w-3 h-3" />Stalled</span>;
            default:
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 text-xs font-bold uppercase"><Icons.Unchanged className="w-3 h-3" />Unchanged</span>;
        }
    };

    return (
        <DialogShell isOpen={true} onClose={onCancel} ariaLabel="End Session" className="relative w-full max-w-2xl mx-4">
            {/* Modal */}
            <div className="relative w-full max-h-[90vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <Icons.Stop className="w-5 h-5 text-red-400" />
                        <h2 className="text-lg font-bold text-white font-serif">End Session</h2>
                    </div>
                    <Button variant="icon" onClick={onCancel} className="text-slate-400 hover:text-white">
                        <Icons.X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Step Indicators */}
                <div className="flex items-center gap-1 px-6 py-3 border-b border-slate-800" role="navigation" aria-label="Wizard steps">
                    {STEP_ORDER.map((step, i) => (
                        <React.Fragment key={step}>
                            <button
                                onClick={() => setCurrentStep(step)}
                                aria-current={currentStep === step ? 'step' : undefined}
                                className={twMerge(
                                    "text-xs font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors",
                                    currentStep === step
                                        ? "bg-amber-600 text-white"
                                        : i < currentIndex
                                            ? "text-green-400 hover:bg-slate-800"
                                            : "text-slate-500 hover:bg-slate-800"
                                )}
                            >
                                {i < currentIndex && <Icons.CheckCircle className="w-3 h-3 inline mr-1" />}
                                {STEP_LABELS[step]}
                                {currentStep === step && (
                                    <span className="sr-only">, Step {i + 1} of {STEP_ORDER.length}</span>
                                )}
                            </button>
                            {i < STEP_ORDER.length - 1 && <Icons.ChevronDown className="w-3 h-3 text-slate-600 rotate-[-90deg]" />}
                        </React.Fragment>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Step 1: AI Recap */}
                    {currentStep === 'recap' && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-bold text-white mb-1">Session Recap</h3>
                                <p className="text-xs text-slate-400">Generate an AI recap from your session notes, or write your own.</p>
                            </div>

                            {!recap && !isGenerating && (
                                <div className="text-center py-8">
                                    <Icons.Sparkles className="w-8 h-8 text-amber-400 mx-auto mb-3 opacity-60" />
                                    {hasEnoughNotesForAutoRecap ? (
                                        <p className="text-sm text-slate-400 mb-4">
                                            {noteCount} session notes ready for recap.
                                        </p>
                                    ) : (
                                        <p className="text-sm text-slate-400 mb-4">
                                            {noteCount === 0
                                                ? 'No session notes recorded. You can generate a recap from running notes, or write your own below.'
                                                : `Only ${noteCount} note${noteCount !== 1 ? 's' : ''} recorded — for best results, use ${AUTO_TRIGGER_NOTE_THRESHOLD}+ notes. You can still generate a recap manually.`
                                            }
                                        </p>
                                    )}
                                    <Button onClick={handleGenerateRecap} disabled={isGenerating}>
                                        <Icons.Sparkles className="w-4 h-4 mr-2" />
                                        Generate AI Recap
                                    </Button>
                                </div>
                            )}

                            {isGenerating && (
                                <div className="text-center py-8">
                                    <Icons.Loader className="w-6 h-6 text-amber-400 animate-spin mx-auto mb-3" />
                                    <p className="text-sm text-slate-400">Generating session recap...</p>
                                </div>
                            )}

                            {generateError && (
                                <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3">
                                    <p className="text-sm text-red-400">{generateError}</p>
                                    <Button onClick={handleGenerateRecap} variant="secondary" className="mt-2">
                                        Try Again
                                    </Button>
                                </div>
                            )}

                            {recap && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Edit Recap</span>
                                        <Button onClick={handleGenerateRecap} variant="secondary" size="sm" disabled={isGenerating}>
                                            <Icons.Sparkles className="w-3 h-3 mr-1" />
                                            Regenerate
                                        </Button>
                                    </div>
                                    <textarea
                                        value={recap}
                                        onChange={(e) => setRecap(e.target.value)}
                                        rows={10}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white leading-relaxed focus:outline-none focus:border-amber-500 resize-y"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Plot Status Review */}
                    {currentStep === 'plots' && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-bold text-white mb-1">Plot Status Review</h3>
                                <p className="text-xs text-slate-400">Click each plot to cycle its status for this session.</p>
                            </div>

                            {relatedPlots.length > 0 ? (
                                <div className="space-y-2">
                                    {relatedPlots.map(plot => {
                                        const status = plotStatuses[plot.id] || 'unchanged';
                                        return (
                                            <button
                                                key={plot.id}
                                                onClick={() => cyclePlotStatus(plot.id)}
                                                className="w-full text-left bg-slate-800 border border-slate-700 rounded-lg p-4 hover:bg-slate-750 transition-colors group"
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <p className="text-sm font-bold text-amber-200">{plot.title}</p>
                                                    {plotStatusBadge(status)}
                                                </div>
                                                {plot.description && (
                                                    <p className="text-xs text-slate-400 line-clamp-2">{plot.description}</p>
                                                )}
                                                <p className="text-[10px] text-slate-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to cycle status</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <Icons.Plot className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                                    <p className="text-sm text-slate-500">No plots linked to this session.</p>
                                    <p className="text-xs text-slate-600 mt-1">You can link plots in the session planning view.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Loose Ends */}
                    {currentStep === 'loose-ends' && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-bold text-white mb-1">Loose Ends</h3>
                                <p className="text-xs text-slate-400">Unresolved threads and hooks for future sessions.</p>
                            </div>

                            {/* R5: carry forward beats left unchecked at the table. Purely
                                additive — absent entirely when there's nothing to carry. */}
                            {incompleteBeats.length > 0 && (
                                <Button onClick={handleCarryForwardBeats} variant="secondary" size="sm">
                                    <Icons.List className="w-3 h-3 mr-1.5" />
                                    Add {incompleteBeats.length} unfinished beat{incompleteBeats.length !== 1 ? 's' : ''} to loose ends
                                </Button>
                            )}

                            {aiLooseEnds.length > 0 && (
                                <div className="bg-amber-900/10 border border-amber-800/30 rounded-lg p-3">
                                    <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
                                        <Icons.Sparkles className="w-3 h-3 inline mr-1" />
                                        AI Suggested
                                    </p>
                                    <ul className="space-y-1">
                                        {aiLooseEnds.map((end, i) => (
                                            <li key={i} className="text-xs text-amber-200 flex gap-2">
                                                <span className="text-amber-500 flex-shrink-0">-</span>
                                                {end}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <textarea
                                value={looseEnds}
                                onChange={(e) => setLooseEnds(e.target.value)}
                                rows={6}
                                placeholder="Add unresolved threads, cliffhangers, or hooks for next session..."
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white leading-relaxed focus:outline-none focus:border-amber-500 resize-y placeholder-slate-600"
                            />

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={manualLooseEnd}
                                    onChange={(e) => setManualLooseEnd(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddLooseEnd(); }}
                                    placeholder="Add a loose end..."
                                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                                />
                                <Button onClick={handleAddLooseEnd} variant="secondary" size="sm" disabled={!manualLooseEnd.trim()}>
                                    Add
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Player-Facing Recap */}
                    {currentStep === 'player-recap' && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-bold text-white mb-1">Player-Facing Recap</h3>
                                <p className="text-xs text-slate-400">A spoiler-free version to share with your players. Edit or copy as needed.</p>
                            </div>

                            {/* One textarea serves both the empty and filled states — only
                                the helper text and Copy button around it vary. Splitting the
                                states into different subtrees remounted the field on the
                                first keystroke ('' → truthy), dropping focus mid-typing. */}
                            <div className="space-y-3">
                                {!playerRecap && (
                                    <div className="text-center pt-2">
                                        <p className="text-sm text-slate-500">Generate a recap first to get a player-facing version.</p>
                                        <p className="text-xs text-slate-600 mt-1">Or write one manually below.</p>
                                    </div>
                                )}
                                <textarea
                                    value={playerRecap}
                                    onChange={(e) => setPlayerRecap(e.target.value)}
                                    rows={8}
                                    placeholder="Write a player-facing recap..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white leading-relaxed focus:outline-none focus:border-amber-500 resize-y placeholder-slate-600"
                                />
                                {playerRecap && (
                                    <Button onClick={handleCopyPlayerRecap} variant="secondary">
                                        {showCopied ? (
                                            <><Icons.CheckCircle className="w-4 h-4 mr-2 text-green-400" />Copied!</>
                                        ) : (
                                            <><Icons.Clipboard className="w-4 h-4 mr-2" />Copy to Clipboard</>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 5: Confirm & Save */}
                    {currentStep === 'confirm' && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-bold text-white mb-1">Review & End Session</h3>
                                <p className="text-xs text-slate-400">Review your session wrap-up before saving.</p>
                            </div>

                            {/* Summary */}
                            <div className="space-y-3">
                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Recap</h4>
                                    {recap ? (
                                        <p className="text-sm text-slate-300 line-clamp-4 whitespace-pre-wrap">{recap}</p>
                                    ) : (
                                        <p className="text-sm text-slate-600 italic">No recap written</p>
                                    )}
                                </div>

                                {relatedPlots.length > 0 && (
                                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Plot Updates</h4>
                                        <div className="space-y-1">
                                            {relatedPlots.map(plot => (
                                                <div key={plot.id} className="flex items-center justify-between">
                                                    <span className="text-sm text-slate-300">{plot.title}</span>
                                                    {plotStatusBadge(plotStatuses[plot.id] || 'unchanged')}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {looseEnds && (
                                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Loose Ends</h4>
                                        <p className="text-sm text-slate-300 whitespace-pre-wrap line-clamp-4">{looseEnds}</p>
                                    </div>
                                )}
                            </div>

                            <div className="bg-red-900/10 border border-red-800/30 rounded-lg p-4">
                                <p className="text-sm text-red-300">
                                    <Icons.AlertTriangle className="w-4 h-4 inline mr-1" />
                                    This will mark the session as <strong>completed</strong> and clear the active session state. This cannot be undone.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Navigation */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700">
                    <div>
                        {canGoPrev ? (
                            <Button onClick={goPrev} variant="secondary">
                                <Icons.ChevronDown className="w-4 h-4 mr-1 rotate-90" />
                                Back
                            </Button>
                        ) : (
                            <Button onClick={onCancel} variant="ghost" className="text-slate-400">
                                Cancel
                            </Button>
                        )}
                    </div>
                    <div>
                        {currentStep === 'confirm' ? (
                            <Button onClick={handleSaveAndEnd} className="bg-red-600 hover:bg-red-500">
                                <Icons.Stop className="w-4 h-4 mr-2" />
                                End Session
                            </Button>
                        ) : (
                            <Button onClick={goNext}>
                                Next
                                <Icons.ChevronDown className="w-4 h-4 ml-1 rotate-[-90deg]" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </DialogShell>
    );
};
