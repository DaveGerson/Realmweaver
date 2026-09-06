
import React, { useState, useCallback, useEffect } from 'react';
import type { Campaign, Scene, Location, NPC, SessionLog, DiceRoll, HistoryEntry, HistoryReferenceType, SessionStage } from '@/types';
import { Icons, SceneIcon } from '@/components/common/Icons';
import { Button } from '@/components/common/Button';
import { twMerge } from 'tailwind-merge';
import { campaignService } from '@/services/campaignService';
import { EntityLink } from '@/components/common/EntityLink';
import { LinkedText } from '@/components/common/LinkedText';
import { textareaBaseClasses } from '@/components/common/Textarea';
import { rollDice } from '@/utils/diceUtils';
import type { QuickCardEntityType } from '@/components/common/EntityQuickCard';
import { StagePanel } from './StagePanel';

// ─── The quote ledger (Wave 2 / P3) ──────────────────────────────────────────
//
// Zero new schema: a logged line is an ordinary `HistoryEntry` on the NPC's
// existing `history[]`, distinguished from a hand-written history row purely by
// the shape of its `summary` — `Said: "…"`. That keeps the whole mechanism
// inside machinery that already exists and already survives the cascade purge
// (`_purgeEntityReferences` blanks a dangling `referenceId` and demotes the row
// to `referenceType: 'manual'`, leaving the words the NPC said intact).
//
// These helpers live here because the scene NPC card is the ledger's primary
// surface; `components/dialogs/DmCoach.tsx` imports them for the roleplay tool's
// "log this line" action so the format is defined exactly once.

/** Prefix that marks a `HistoryEntry` as a logged spoken line. */
export const QUOTE_LEDGER_PREFIX = 'Said: ';

/** How many logged lines an NPC card shows. */
export const QUOTE_LEDGER_DISPLAY_LIMIT = 3;

/** The slice of the campaign store the ledger writes through. */
export interface QuoteLedgerStore {
    getActiveCampaign: () => Campaign | null | undefined;
    updateNpc: (id: string, updatedData: Partial<NPC>) => void;
}

/** The wrapper a formatted line always starts/ends with: `Said: "`…`"`. */
const QUOTE_WRAPPER_OPEN = `${QUOTE_LEDGER_PREFIX}"`;

/** `Hold the line.` → `Said: "Hold the line."` */
export const formatQuoteLedgerSummary = (line: string): string =>
    `${QUOTE_WRAPPER_OPEN}${line.trim()}"`;

/**
 * True when this history row was written by the quote ledger — its summary
 * wraps non-empty text in the ledger's `Said: "…"` shape. Anchored to the
 * START of the string (not a substring match anywhere in it), so an ordinary
 * history row that merely mentions someone saying something ("The captain
 * Said: "run" — but nobody moved") is never mistaken for a logged line.
 */
export const isQuoteLedgerEntry = (entry: HistoryEntry): boolean => {
    const { summary } = entry;
    if (!summary.startsWith(QUOTE_WRAPPER_OPEN) || !summary.endsWith('"')) return false;
    return summary.slice(QUOTE_WRAPPER_OPEN.length, -1).length > 0;
};

/** The spoken words inside a ledger row, or null for any other history row. */
export const extractQuoteLine = (entry: HistoryEntry): string | null => {
    if (!isQuoteLedgerEntry(entry)) return null;
    return entry.summary.slice(QUOTE_WRAPPER_OPEN.length, -1);
};

/** The NPC's most recently logged lines, newest first. */
export const selectRecentQuoteLines = (
    npc: NPC | null | undefined,
    limit: number = QUOTE_LEDGER_DISPLAY_LIMIT,
): string[] => {
    if (!npc || !npc.history || limit <= 0) return [];
    const lines: string[] = [];
    for (let i = npc.history.length - 1; i >= 0 && lines.length < limit; i--) {
        const line = extractQuoteLine(npc.history[i]);
        if (line !== null) lines.push(line);
    }
    return lines;
};

/**
 * Appends a spoken line to the NPC's ledger, reading the NPC's history from the
 * live store rather than from a render-time closure. Returns whether a row was
 * actually written.
 *
 * A fumbled double press must not log the same line twice, but a genuinely new
 * utterance — the same words said again after another line intervened, or in a
 * different session — is real and IS recorded. So the duplicate check compares
 * the proposed line AND its reference (session id, or the manual fallback)
 * against only the most recently logged LEDGER row (skipping any ordinary
 * history rows appended after it), not the row array's literal last entry.
 */
export const logNpcQuote = (
    npcId: string,
    line: string,
    store: QuoteLedgerStore = campaignService,
): boolean => {
    const trimmed = line.trim();
    if (!trimmed) return false;

    const campaign = store.getActiveCampaign();
    if (!campaign) return false;

    const npc = campaign.npcs.find(n => n.id === npcId);
    if (!npc) return false;

    const history = npc.history ?? [];
    const sessionId = campaign.activeSessionId;
    const referenceType: HistoryReferenceType = sessionId ? 'session' : 'manual';

    for (let i = history.length - 1; i >= 0; i--) {
        const priorLine = extractQuoteLine(history[i]);
        if (priorLine === null) continue;
        const priorEntry = history[i];
        const isSameReference = priorEntry.referenceType === referenceType && priorEntry.referenceId === sessionId;
        if (priorLine === trimmed && isSameReference) return false;
        break;
    }

    const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        summary: formatQuoteLedgerSummary(trimmed),
        referenceType,
        ...(sessionId ? { referenceId: sessionId } : {}),
    };

    store.updateNpc(npcId, { history: [...history, entry] });
    return true;
};

/** Copy-to-clipboard button with 2-second visual feedback. */
const CopyButton: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <button
            onClick={handleCopy}
            className={twMerge(
                "p-1.5 rounded-md transition-colors",
                copied
                    ? "text-green-400"
                    : "text-amber-600 hover:text-amber-400 hover:bg-amber-900/30",
                className
            )}
            title={copied ? 'Copied!' : 'Copy read-aloud text'}
            aria-label={copied ? 'Copied!' : 'Copy read-aloud text'}
        >
            {copied ? <Icons.Check className="w-4 h-4" /> : <Icons.Duplicate className="w-4 h-4" />}
        </button>
    );
};

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

    // ── Unstructured play (docs/design/unstructured-play.md) ─────────────────
    // Everything below is optional so a legacy caller (or an older test) that
    // renders the scene-only panel is unaffected. The Stage renders only when
    // `stage` AND all four stage handlers are supplied.
    /** The live where/who/what of the table, independent of the scene. */
    stage?: SessionStage;
    /** NPCs the DM put on the Stage (removable chips). */
    stageNpcs?: NPC[];
    /** Everyone present: scene cast ∪ Stage cast. Falls back to `activeSceneNpcs`. */
    presentNpcs?: NPC[];
    /** The place in effect: the Stage's, else the scene's. `undefined` falls back to `activeSceneLocation`. */
    presentLocation?: Location | null;
    /** The adventure the active scene belongs to, when it is not tonight's main one. */
    activeSceneAdventureTitle?: string | null;
    /** False hides "Next Scene" — there is nothing after this scene in tonight's list. */
    hasNextScene?: boolean;
    /** "Done": the scene is finished; the room persists on the Stage. */
    onFinishScene?: () => void;
    /** "Set Aside": step out without finishing; come back any time. */
    onSetAsideScene?: () => void;
    onSetStageLocation?: (locationId: string | null, place?: string) => void;
    onAddNpcToStage?: (npcId: string) => void;
    onRemoveNpcFromStage?: (npcId: string) => void;
    onSetStageFocus?: (focus: string) => void;
    onSaveFreeformPlace?: () => void;
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
    stage,
    stageNpcs = [],
    presentNpcs,
    presentLocation,
    activeSceneAdventureTitle,
    hasNextScene = true,
    onFinishScene,
    onSetAsideScene,
    onSetStageLocation,
    onAddNpcToStage,
    onRemoveNpcFromStage,
    onSetStageFocus,
    onSaveFreeformPlace,
}) => {
    const [showRecap, setShowRecap] = useState(true);
    const [skillCheckRolls, setSkillCheckRolls] = useState<Record<number, { d20: number; modifier: number; total: number; passed: boolean }>>({});
    const [skillCheckModifiers, setSkillCheckModifiers] = useState<Record<number, number>>({});

    // Quote ledger composer: only one card's composer is open at a time, and its
    // text resets whenever a card's "Log a line" button (re)opens it, so a
    // fumbled second press never re-sends a line still sitting in the box.
    const [quoteComposerNpcId, setQuoteComposerNpcId] = useState<string | null>(null);
    const [quoteComposerText, setQuoteComposerText] = useState('');

    const handleOpenQuoteComposer = useCallback((npcId: string) => {
        setQuoteComposerNpcId(npcId);
        setQuoteComposerText('');
    }, []);

    const handleCloseQuoteComposer = useCallback(() => {
        setQuoteComposerNpcId(null);
        setQuoteComposerText('');
    }, []);

    const handleSaveQuoteLine = useCallback((npcId: string) => {
        // logNpcQuote reads the NPC through campaignService.getActiveCampaign()
        // at press time, not from the `campaign` prop this panel rendered with
        // (finding: a line logged from a second surface in between must survive).
        const wrote = logNpcQuote(npcId, quoteComposerText, campaignService);
        if (wrote) {
            setQuoteComposerNpcId(null);
            setQuoteComposerText('');
        }
    }, [quoteComposerText]);

    // Skill check rolls are keyed by array index, which is only meaningful within a
    // single scene's skillChecks list. Reset them whenever the active scene changes so a
    // stale roll from the previous scene can't display against the new scene's checks.
    useEffect(() => {
        setSkillCheckRolls({});
        setSkillCheckModifiers({});
    }, [activeScene?.id]);

    const handleSkillCheckRoll = useCallback((checkIndex: number, dc: number, skillName: string) => {
        const modifier = skillCheckModifiers[checkIndex] ?? 0;
        const { results, total: d20 } = rollDice({ count: 1, sides: 20, modifier: 0 });
        const total = d20 + modifier;
        const passed = total >= dc;
        setSkillCheckRolls(prev => ({ ...prev, [checkIndex]: { d20, modifier, total, passed } }));

        const roll: DiceRoll = {
            id: crypto.randomUUID(),
            formula: modifier !== 0 ? `1d20${modifier >= 0 ? '+' : ''}${modifier}` : '1d20',
            results,
            total,
            timestamp: new Date().toISOString(),
            note: `${skillName} check (DC ${dc}) - ${passed ? 'Pass' : 'Fail'}`,
        };
        campaignService.addDiceRollToSession(roll);
    }, [skillCheckModifiers]);

    // Who and where, for the cards below: the union the runner derived when it
    // supplied one, otherwise the scene-only sets a legacy caller passed.
    const npcsToShow = presentNpcs ?? activeSceneNpcs;
    const locationToShow = presentLocation === undefined ? activeSceneLocation : presentLocation;
    const stageNpcIdSet = new Set(stageNpcs.map(n => n.id));
    const sceneCastForStage = npcsToShow.filter(n => !stageNpcIdSet.has(n.id));
    const hasStage = !!stage && !!onSetStageLocation && !!onAddNpcToStage && !!onRemoveNpcFromStage && !!onSetStageFocus;

    return (
        <div className={twMerge(
            "flex-1 overflow-y-auto p-4 md:p-6",
            mobileTab === 'active' ? "flex flex-col md:block" : "hidden md:block"
        )}>
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Previously... Recap Banner — shown whether or not a scene is
                    active; a freeform session opens on it too. */}
                {showRecap && previousSession?.recap && (
                    <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-4 relative">
                        <Button
                            variant="icon"
                            onClick={() => setShowRecap(false)}
                            className="absolute top-2 right-2"
                        >
                            <Icons.X className="w-4 h-4" />
                        </Button>
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

                {/* The Stage — the live truth of the table, scene or no scene. */}
                {hasStage && (
                    <StagePanel
                        campaign={campaign}
                        stage={stage!}
                        sceneCast={sceneCastForStage}
                        stageCast={stageNpcs}
                        presentLocation={locationToShow}
                        hasActiveScene={!!activeScene}
                        onSetLocation={onSetStageLocation!}
                        onAddNpc={onAddNpcToStage!}
                        onRemoveNpc={onRemoveNpcFromStage!}
                        onSetFocus={onSetStageFocus!}
                        onSaveFreeformPlace={onSaveFreeformPlace}
                        onNavigate={onNavigate}
                    />
                )}

                {activeScene ? (
                    <>
                        {/* Scene Title */}
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-wrap">
                                <SceneIcon type={activeScene.type} />
                                <h2 className="text-xl md:text-2xl font-bold text-white font-serif">{activeScene.title}</h2>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 uppercase">{activeScene.type}</span>
                                {activeSceneAdventureTitle && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-900/30 text-orange-300 border border-orange-800/40" title="Pulled from another adventure's shelf">
                                        {activeSceneAdventureTitle}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                {onFinishScene && (
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={onFinishScene}
                                        className="min-h-[44px]"
                                        title="Finish this scene — the room stays on stage"
                                    >
                                        <Icons.CheckCircle className="w-4 h-4" />
                                        <span className="hidden sm:inline ml-1.5">Done</span>
                                    </Button>
                                )}
                                {hasNextScene && (
                                    <Button
                                        variant={onFinishScene ? 'secondary' : 'primary'}
                                        size="sm"
                                        onClick={onAdvanceScene}
                                        className="min-h-[44px]"
                                        title="Finish this scene and open the next one in tonight's list"
                                    >
                                        <Icons.SkipForward className="w-4 h-4" />
                                        <span className="hidden sm:inline ml-1.5">Next Scene</span>
                                    </Button>
                                )}
                                {onSetAsideScene && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={onSetAsideScene}
                                        className="min-h-[44px] text-slate-400"
                                        title="Step out without finishing — come back any time"
                                    >
                                        <Icons.Stalled className="w-4 h-4" />
                                        <span className="hidden sm:inline ml-1.5">Set Aside</span>
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Read-Aloud Text */}
                        {activeScene.readAloudText && (
                            <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg p-4 relative">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Read Aloud</h3>
                                    <CopyButton text={activeScene.readAloudText} />
                                </div>
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
                    </>
                ) : !hasStage ? (
                    <div className="flex items-center justify-center h-full text-slate-500 py-16">
                        <div className="text-center">
                            <Icons.Adventures className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>No active scene. Select a scene from the list or advance.</p>
                        </div>
                    </div>
                ) : null}

                {/* Location — the place in effect, scene or Stage */}
                {locationToShow && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            <Icons.Locations className="w-3 h-3 inline mr-1" />
                            Location
                        </h3>
                        <p className="text-white font-semibold">
                            {onNavigate
                                ? <EntityLink entityType="location" entityId={locationToShow.id} label={locationToShow.name} onNavigate={onNavigate} />
                                : locationToShow.name
                            }
                        </p>
                        {/* Aspects (Lazy DM step 5): the sensory one-liners, read before the paragraph. */}
                        {(locationToShow.aspects ?? []).filter(a => a.trim()).length > 0 && (
                            <ul className="mt-2 space-y-0.5" aria-label={`Aspects of ${locationToShow.name}`}>
                                {(locationToShow.aspects ?? []).filter(a => a.trim()).map((aspect, idx) => (
                                    <li key={idx} className="text-emerald-200/90 text-sm italic flex gap-2">
                                        <span aria-hidden="true" className="text-emerald-500/70">•</span>
                                        <span>{aspect}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {locationToShow.description && (
                            <p className="text-slate-300 text-sm mt-1">{locationToShow.description}</p>
                        )}
                    </div>
                )}

                {/* NPCs Present — everyone in the room, scene cast and Stage alike */}
                {npcsToShow.length > 0 && (
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
                            {npcsToShow.map(npc => {
                                const faction = npc.factionId ? campaign.factions.find(f => f.id === npc.factionId) : null;
                                const npcRels = sceneNpcRelationshipMap.get(npc.id) ?? [];
                                const hasVoice = Boolean(npc.voiceNotes && npc.voiceNotes.trim());
                                const recentLines = selectRecentQuoteLines(npc);
                                const isComposerOpen = quoteComposerNpcId === npc.id;
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
                                        {/* Voice (Wave 2 / P3) — leads the card: mid-scene the DM needs to
                                            know how she sounds before who she hates. */}
                                        {hasVoice && (
                                            <p className="text-amber-300 text-xs mt-1">
                                                <span className="font-semibold uppercase tracking-wide text-[10px] text-amber-500/80 mr-1">Voice</span>
                                                {npc.voiceNotes}
                                            </p>
                                        )}
                                        {npc.traits && <p className="text-slate-400 text-xs mt-1">{npc.traits}</p>}
                                        {npc.motivations && <p className="text-slate-500 text-xs mt-1 italic">{npc.motivations}</p>}
                                        {npc.exampleQuote && <p className="text-amber-400/70 text-xs mt-1 italic">"{npc.exampleQuote}"</p>}
                                        {/* The quote ledger (Wave 2 / P3) — the 3 most recent lines actually
                                            heard at the table, next to the aspirational exampleQuote. */}
                                        {recentLines.length > 0 && (
                                            <div className="mt-1 space-y-0.5">
                                                {recentLines.map((line, idx) => (
                                                    <p key={idx} className="text-amber-300/60 text-xs italic">"{line}"</p>
                                                ))}
                                            </div>
                                        )}
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
                                        {/* The quote ledger's "log a line" affordance (Wave 2 / P3) */}
                                        <div className="mt-2 pt-2 border-t border-slate-800/60">
                                            {isComposerOpen ? (
                                                <div className="space-y-1.5">
                                                    <textarea
                                                        aria-label={`Line spoken by ${npc.name}`}
                                                        value={quoteComposerText}
                                                        onChange={e => setQuoteComposerText(e.target.value)}
                                                        rows={2}
                                                        placeholder={`What did ${npc.name} just say?`}
                                                        className={twMerge(textareaBaseClasses, 'w-full px-2 py-1.5 text-xs')}
                                                    />
                                                    <div className="flex gap-1.5 justify-end">
                                                        <Button variant="ghost" size="sm" onClick={handleCloseQuoteComposer} className="text-xs">
                                                            Cancel
                                                        </Button>
                                                        <Button
                                                            variant="primary"
                                                            size="sm"
                                                            onClick={() => handleSaveQuoteLine(npc.id)}
                                                            disabled={!quoteComposerText.trim()}
                                                            aria-label={`Save line for ${npc.name}`}
                                                            className="text-xs"
                                                        >
                                                            Save line
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                // The NPC's name is carried in aria-label rather than the
                                                // visible label so it doesn't duplicate the name text
                                                // already on the card — a duplicate would trip getByText
                                                // and any DOM-position check keyed on the NPC's name.
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleOpenQuoteComposer(npc.id)}
                                                    aria-label={`Log a line for ${npc.name}`}
                                                    className="text-xs text-slate-500 hover:text-amber-400"
                                                >
                                                    <Icons.Mic className="w-3 h-3 mr-1.5" />
                                                    Log a line
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Skill Checks */}
                {activeScene && activeScene.skillChecks.length > 0 && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            <Icons.Dice className="w-3 h-3 inline mr-1" />
                            Skill Checks
                        </h3>
                        <div className="space-y-2">
                            {activeScene.skillChecks.map((check, i) => {
                                const rollResult = skillCheckRolls[i];
                                const modifier = skillCheckModifiers[i] ?? 0;
                                return (
                                    <div key={i} className="flex items-center gap-3 text-sm flex-wrap">
                                        <span className="text-amber-400 font-mono font-bold">DC {check.dc}</span>
                                        <span className="text-white">{check.skill}</span>
                                        {check.description && <span className="text-slate-400">— {check.description}</span>}
                                        <div className="flex items-center gap-1.5">
                                            <label className="text-xs text-slate-400 sr-only" htmlFor={`modifier-${i}`}>Modifier</label>
                                            <input
                                                id={`modifier-${i}`}
                                                type="number"
                                                value={modifier}
                                                onChange={e => setSkillCheckModifiers(prev => ({ ...prev, [i]: parseInt(e.target.value, 10) || 0 }))}
                                                className="w-14 bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-xs text-slate-100 text-center focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                                                title="Modifier (e.g. +5 for proficiency)"
                                                aria-label="Roll modifier"
                                            />
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                onClick={() => handleSkillCheckRoll(i, check.dc, check.skill)}
                                                className="min-h-[44px]"
                                                title={`Roll 1d20${modifier >= 0 ? '+' : ''}${modifier} vs DC ${check.dc}`}
                                            >
                                                <Icons.Dice className="w-3 h-3 mr-1" />
                                                Roll
                                            </Button>
                                        </div>
                                        {rollResult && (
                                            <span className={twMerge(
                                                "text-xs font-mono font-bold px-2 py-0.5 rounded-full",
                                                rollResult.passed
                                                    ? "bg-green-500/20 text-green-400"
                                                    : "bg-red-500/20 text-red-400"
                                            )}>
                                                {rollResult.d20}{rollResult.modifier !== 0 ? (rollResult.modifier > 0 ? `+${rollResult.modifier}` : rollResult.modifier) : ''} = {rollResult.total} — {rollResult.passed ? 'Pass' : 'Fail'}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Rewards */}
                {activeScene?.rewards && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Rewards</h3>
                        <p className="text-slate-200 text-sm whitespace-pre-wrap">{activeScene.rewards}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
