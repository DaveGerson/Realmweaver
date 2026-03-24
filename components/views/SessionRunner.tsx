
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Campaign, Scene, SessionLog, NPC, Combatant, CombatantType, Encounter, PlotSessionStatus, DiceRoll, Beat } from '../../types';
import { Icons, SceneIcon } from '../common/Icons';
import { twMerge } from 'tailwind-merge';
import { campaignService } from '../../services/campaignService';
import { DiceRoller } from '../tools/DiceRoller';
import { CombatTracker } from '../tools/CombatTracker';
import { SecretsTracker } from '../tools/SecretsTracker';
import { generateNpc } from '../../services/aiService';
import { rollDice } from '../../utils/diceUtils';
import { estimatePcHp } from '../../utils/entityUtils';
import { SessionEndWizard } from '../dialogs/SessionEndWizard';
import { MentionInput } from '../common/MentionInput';
import { EntityLink } from '../common/EntityLink';
import { LinkedText } from '../common/LinkedText';
import type { QuickCardEntityType } from '../common/EntityQuickCard';
import { isFeatureVisible } from '../../utils/dmStyleUtils';

// Browser speech recognition API types
declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognition;
        webkitSpeechRecognition: new () => SpeechRecognition;
    }
}

/** Try to extract HP from a freeform NPC stats string. Returns null if not found. */
const parseHpFromStats = (stats: string | undefined): number | null => {
    if (!stats) return null;
    // Match patterns like "HP: 52", "Hit Points 52", "HP 52/52", "hp:52", "HP - 45"
    const match = stats.match(/(?:hp|hit\s*points)\s*[:=\-–—]?\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
};

const NOTE_TAG_OPTIONS = ['Combat', 'NPC', 'Decision', 'Loot', 'Discovery'] as const;

const ENTRY_TYPE_STYLES: Record<string, { text: string; border: string; icon: React.ReactNode }> = {
    'scene-transition': {
        text: 'text-blue-300',
        border: 'border-l-2 border-l-blue-500 pl-2',
        icon: <Icons.Scenes className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />,
    },
    'combat': {
        text: 'text-red-300',
        border: 'border-l-2 border-l-red-500 pl-2',
        icon: <Icons.Combat className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />,
    },
    'npc-created': {
        text: 'text-green-300',
        border: 'border-l-2 border-l-green-500 pl-2',
        icon: <Icons.NPCs className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />,
    },
    'dice-roll': {
        text: 'text-amber-300',
        border: 'border-l-2 border-l-amber-500 pl-2',
        icon: <Icons.Dice className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />,
    },
    'coach-used': {
        text: 'text-indigo-300',
        border: 'border-l-2 border-l-indigo-500 pl-2',
        icon: <Icons.Coach className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />,
    },
};

interface SessionRunnerProps {
    campaign: Campaign;
    sessionLog: SessionLog;
    isMockMode: boolean;
    onEndSession: () => void;
    onOpenCoach: () => void;
    onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
}

export const SessionRunner: React.FC<SessionRunnerProps> = ({
    campaign,
    sessionLog,
    isMockMode,
    onEndSession,
    onOpenCoach,
    onNavigate,
}) => {
    // Derive feature visibility from campaign's DM style settings
    const _dmStyle = campaign.dmStyle ?? 'standard';
    const _featureOverrides = campaign.featureOverrides ?? {};
    const canShowCombatTracker = isFeatureVisible('combat-tracker', _dmStyle, _featureOverrides);
    const canShowSecretsTracker = isFeatureVisible('secrets-tracker', _dmStyle, _featureOverrides);

    const [noteInput, setNoteInput] = useState('');
    const [noteTags, setNoteTags] = useState<string[]>([]);
    const [noteMentionedEntityIds, setNoteMentionedEntityIds] = useState<string[]>([]);
    const [showImportantOnly, setShowImportantOnly] = useState(false);
    const [showEndWizard, setShowEndWizard] = useState(false);
    const [showDiceRoller, setShowDiceRoller] = useState(false);
    const [showRecap, setShowRecap] = useState(true);

    // Combat Tracker slide-out state
    const [showCombatPanel, setShowCombatPanel] = useState(false);

    // Secrets tracker state
    const [showSecrets, setShowSecrets] = useState(false);

    // Quick NPC generator state
    const [showQuickNpc, setShowQuickNpc] = useState(false);
    const [npcPrompt, setNpcPrompt] = useState('');
    const [npcGenerating, setNpcGenerating] = useState(false);
    const [npcError, setNpcError] = useState<string | null>(null);
    const [npcPreview, setNpcPreview] = useState<Omit<NPC, 'id' | 'factionId'> | null>(null);
    const [npcEditMode, setNpcEditMode] = useState(false);
    const [npcEditData, setNpcEditData] = useState<{ name: string; description: string; traits: string }>({ name: '', description: '', traits: '' });

    // Skill check roll results state
    const [skillCheckRolls, setSkillCheckRolls] = useState<Record<number, { total: number; passed: boolean }>>({});

    // Voice capture state
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const hasSpeechRecognition = typeof window !== 'undefined' &&
        (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);

    // Beat input state
    const [beatInput, setBeatInput] = useState('');

    // Stop speech recognition on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
                recognitionRef.current = null;
            }
        };
    }, []);

    // Plot session status tracking (persisted on sessionLog)
    const plotSessionStatus = sessionLog.plotProgressions || {};

    const adventure = useMemo(() =>
        sessionLog.adventureId
            ? campaign.adventures.find(a => a.id === sessionLog.adventureId) || null
            : null,
        [campaign.adventures, sessionLog.adventureId]
    );

    const plannedScenes = useMemo(() => {
        if (!adventure) return [];
        return sessionLog.plannedSceneIds
            .map(id => adventure.scenes.find(s => s.id === id))
            .filter((s): s is Scene => !!s);
    }, [adventure, sessionLog.plannedSceneIds]);

    const activeScene = useMemo(() => {
        if (!campaign.activeSceneId || !adventure) return null;
        return adventure.scenes.find(s => s.id === campaign.activeSceneId) || null;
    }, [campaign.activeSceneId, adventure]);

    const activeSceneLocation = useMemo(() => {
        if (!activeScene?.locationId) return null;
        return campaign.locations.find(l => l.id === activeScene.locationId) || null;
    }, [activeScene, campaign.locations]);

    const activeSceneNpcs = useMemo(() => {
        if (!activeScene) return [];
        return activeScene.npcIds
            .map(id => campaign.npcs.find(n => n.id === id))
            .filter((n): n is NPC => !!n);
    }, [activeScene, campaign.npcs]);

    /**
     * For each NPC in the active scene, collect relationships whose target is
     * also in the scene. Shape: Map<npcId, {rel, targetNpc}[]>
     */
    const sceneNpcRelationshipMap = useMemo(() => {
        const sceneNpcIds = new Set(activeSceneNpcs.map(n => n.id));
        const map = new Map<string, { relationType: string; targetId: string; targetName: string }[]>();
        for (const npc of activeSceneNpcs) {
            const rels = (npc.relationships ?? []).filter(r => sceneNpcIds.has(r.targetId));
            if (rels.length > 0) {
                map.set(npc.id, rels.map(r => ({
                    relationType: r.relationType,
                    targetId: r.targetId,
                    targetName: campaign.npcs.find(n => n.id === r.targetId)?.name ?? r.targetId,
                })));
            }
        }
        return map;
    }, [activeSceneNpcs, campaign.npcs]);

    /** One-line cast dynamics summary for the active scene. */
    const castDynamicsSummary = useMemo(() => {
        if (sceneNpcRelationshipMap.size === 0) return null;
        const parts: string[] = [];
        for (const [npcId, rels] of sceneNpcRelationshipMap) {
            const npcName = activeSceneNpcs.find(n => n.id === npcId)?.name ?? npcId;
            for (const r of rels) {
                parts.push(`${npcName} ${r.relationType.toLowerCase()}s ${r.targetName}`);
            }
        }
        if (parts.length === 0) return null;
        return 'Cast dynamics: ' + parts.join('. ') + '.';
    }, [sceneNpcRelationshipMap, activeSceneNpcs]);

    const previousSession = useMemo(() => {
        const completed = campaign.sessionLogs
            .filter(s => s.status === 'completed')
            .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
        return completed[0] || null;
    }, [campaign.sessionLogs]);

    const handleAddNote = () => {
        if (!noteInput.trim()) return;
        campaignService.addSessionRunnerNote(noteInput.trim(), noteMentionedEntityIds, 'manual', noteTags);
        setNoteInput('');
        setNoteTags([]);
        setNoteMentionedEntityIds([]);
    };

    const toggleTag = (tag: string) => {
        setNoteTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    };

    const filteredNotes = useMemo(() => {
        const notes = sessionLog.structuredNotes || [];
        if (!showImportantOnly) return notes;
        return notes.filter(n => n.isImportant);
    }, [sessionLog.structuredNotes, showImportantOnly]);

    const handleAdvanceScene = () => {
        campaignService.advanceScene();
    };

    const handleSelectScene = (sceneId: string) => {
        if (!adventure) return;
        // Mark current active as completed, set new one as in-progress
        if (campaign.activeSceneId && campaign.activeSceneId !== sceneId) {
            campaignService.setSceneStatus(adventure.id, campaign.activeSceneId, 'completed');
        }
        campaignService.setSceneStatus(adventure.id, sceneId, 'in-progress');
        campaignService.setActiveScene(sceneId);
    };

    const handleEndSession = () => {
        setShowEndWizard(true);
    };

    // Combat Tracker: open panel and auto-populate if needed
    const handleOpenCombat = useCallback(() => {
        const encounter = campaign.activeEncounter;
        if (!encounter || encounter.combatants.length === 0) {
            // Auto-populate combatants from active scene NPCs + player characters
            const autoCombatants: Combatant[] = [
                ...activeSceneNpcs.map(npc => {
                    const parsedHp = parseHpFromStats(npc.stats);
                    return {
                        id: crypto.randomUUID(),
                        name: npc.name,
                        type: 'npc' as CombatantType,
                        initiative: 0,
                        hp: parsedHp ?? 10,
                        maxHp: parsedHp ?? 10,
                        notes: npc.traits || '',
                    };
                }),
                ...(campaign.playerCharacters || []).map(pc => {
                    const pcHp = estimatePcHp(pc);
                    return {
                        id: crypto.randomUUID(),
                        name: pc.characterSocial.characterName,
                        type: 'pc' as CombatantType,
                        initiative: 0,
                        hp: pcHp,
                        maxHp: pcHp,
                        notes: '',
                    };
                })
            ];

            const newEncounter: Encounter = {
                id: encounter ? encounter.id : crypto.randomUUID(),
                round: encounter ? encounter.round : 1,
                turnIndex: 0,
                combatants: autoCombatants,
                sessionId: sessionLog.id,
                sceneId: campaign.activeSceneId || undefined,
            };
            campaignService.updateEncounter(newEncounter);
        }
        setShowCombatPanel(true);
    }, [activeSceneNpcs, campaign.activeEncounter, campaign.playerCharacters, campaign.activeSceneId, sessionLog.id]);

    const handleUpdateEncounter = useCallback((updatedEncounter: Encounter) => {
        campaignService.updateEncounter(updatedEncounter);
    }, []);

    // Quick NPC generation -- generates into preview, does NOT save immediately
    const handleGenerateQuickNpc = useCallback(async () => {
        if (!npcPrompt.trim()) return;
        setNpcGenerating(true);
        setNpcError(null);
        setNpcPreview(null);
        setNpcEditMode(false);
        try {
            const campaignContext = `Campaign: ${campaign.title}\nSetting: ${campaign.setting}`;
            const npcData = await generateNpc(npcPrompt.trim(), isMockMode, campaignContext);
            setNpcPreview(npcData);
        } catch (err) {
            setNpcError(err instanceof Error ? err.message : 'Generation failed');
        } finally {
            setNpcGenerating(false);
        }
    }, [npcPrompt, isMockMode, campaign.title, campaign.setting]);

    // Save the previewed NPC
    const handleSavePreviewNpc = useCallback(() => {
        if (!npcPreview) return;
        const dataToSave = npcEditMode
            ? { ...npcPreview, name: npcEditData.name, description: npcEditData.description, traits: npcEditData.traits }
            : npcPreview;
        const newNpcId = campaignService.createNpc(dataToSave);

        // Auto-link to current scene if there is one
        if (activeScene && adventure) {
            const updatedNpcIds = [...activeScene.npcIds, newNpcId];
            campaignService.updateScene(adventure.id, activeScene.id, { npcIds: updatedNpcIds });
        }

        // Auto-log NPC creation to running log
        const savedName = npcEditMode ? npcEditData.name : npcPreview.name;
        campaignService.addAutoEvent('npc-created', `NPC created: ${savedName}`);

        setNpcPreview(null);
        setNpcEditMode(false);
        setNpcPrompt('');
        setShowQuickNpc(false);
    }, [npcPreview, npcEditMode, npcEditData, activeScene, adventure]);

    // Enter edit mode for previewed NPC
    const handleEditPreviewNpc = useCallback(() => {
        if (!npcPreview) return;
        setNpcEditData({ name: npcPreview.name, description: npcPreview.description, traits: npcPreview.traits });
        setNpcEditMode(true);
    }, [npcPreview]);

    // Roll a skill check inline
    const handleSkillCheckRoll = useCallback((checkIndex: number, dc: number, skillName: string) => {
        const { results, total } = rollDice({ count: 1, sides: 20, modifier: 0 });
        const passed = total >= dc;
        setSkillCheckRolls(prev => ({ ...prev, [checkIndex]: { total, passed } }));

        // Log the roll to the session
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

    // Plot status cycling (persisted via campaignService)
    const cyclePlotStatus = useCallback((plotId: string) => {
        const current = plotSessionStatus[plotId] || 'unchanged';
        const next: PlotSessionStatus =
            current === 'unchanged' ? 'advanced' :
            current === 'advanced' ? 'stalled' :
            'unchanged';
        campaignService.updatePlotProgression(plotId, next);
    }, [plotSessionStatus]);

    // End combat: archive encounter to session log and auto-log event
    const handleEndCombat = useCallback(() => {
        const encounter = campaign.activeEncounter;
        if (!encounter) return;
        const combatantCount = encounter.combatants.length;
        const rounds = encounter.round;
        campaignService.addAutoEvent(
            'combat',
            `Combat ended. ${combatantCount} combatant${combatantCount !== 1 ? 's' : ''}, ${rounds} round${rounds !== 1 ? 's' : ''}.`
        );
        // Archive the encounter
        campaignService.updateEncounter({ ...encounter, combatants: [], round: 1, turnIndex: 0 });
        setShowCombatPanel(false);
    }, [campaign.activeEncounter]);

    // Voice capture toggle
    const handleToggleMic = useCallback(() => {
        if (!hasSpeechRecognition) return;

        if (isRecording) {
            recognitionRef.current?.stop();
            setIsRecording(false);
            return;
        }

        const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    const transcript = event.results[i][0].transcript;
                    setNoteInput(prev => (prev ? prev + ' ' : '') + transcript.trim());
                }
            }
        };

        recognition.onerror = () => {
            setIsRecording(false);
            recognitionRef.current = null;
        };

        recognition.onend = () => {
            setIsRecording(false);
            recognitionRef.current = null;
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsRecording(true);
    }, [isRecording, hasSpeechRecognition]);

    // Mobile tab state for SessionRunner
    const [mobileTab, setMobileTab] = useState<'scenes' | 'active' | 'tools'>('active');

    // Floating Action Button state (mobile only)
    const [fabOpen, setFabOpen] = useState(false);

    // Add a beat to the current session
    const handleAddBeat = useCallback(() => {
        const title = beatInput.trim();
        if (!title) return;
        campaignService.addBeat(title);
        setBeatInput('');
    }, [beatInput]);

    const sceneStatusIcon = (scene: Scene) => {
        switch (scene.status) {
            case 'completed': return <Icons.CheckCircle className="w-4 h-4 text-green-400" />;
            case 'in-progress': return <Icons.Play className="w-4 h-4 text-amber-400" />;
            default: return <div className="w-4 h-4 rounded-full border border-slate-500" />;
        }
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

    return (
        <div className="flex flex-col h-full bg-slate-950 relative">
            {/* Session Header */}
            <div className="flex items-center justify-between px-3 md:px-6 py-2 md:py-3 bg-slate-900 border-b border-slate-700 flex-shrink-0">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <Icons.Live className="w-4 h-4 md:w-5 md:h-5 text-red-400 animate-pulse flex-shrink-0" />
                    <h1 className="text-base md:text-lg font-bold text-white font-serif truncate">{sessionLog.title}</h1>
                    {adventure && (
                        <span className="hidden sm:inline text-sm text-slate-400 truncate">
                            — {adventure.title}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
                    <button
                        onClick={onOpenCoach}
                        className="hidden md:flex items-center gap-2 px-3 py-1.5 min-h-[36px] rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm transition-colors"
                    >
                        <Icons.Coach className="w-4 h-4" />
                        DM Coach
                    </button>
                    <button
                        onClick={handleEndSession}
                        className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 min-h-[36px] rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors"
                    >
                        <Icons.Stop className="w-4 h-4" />
                        <span className="hidden sm:inline">End Session</span>
                    </button>
                </div>
            </div>

            {/* Mobile Tab Bar — visible only below md */}
            <div className="md:hidden flex-shrink-0 flex border-b border-slate-800 bg-slate-900">
                {([
                    { id: 'scenes' as const, label: 'Scenes', icon: <Icons.Scenes className="w-4 h-4" /> },
                    { id: 'active' as const, label: 'Active', icon: <Icons.Play className="w-4 h-4" /> },
                    { id: 'tools' as const, label: 'Tools', icon: <Icons.Sparkles className="w-4 h-4" /> },
                ] as const).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setMobileTab(tab.id)}
                        className={twMerge(
                            'flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors min-h-[44px]',
                            mobileTab === tab.id
                                ? 'text-amber-400 border-b-2 border-amber-400'
                                : 'text-slate-400 hover:text-slate-200'
                        )}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Main 3-Column Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Scene List + Beats */}
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
                            const isActive = campaign.activeSceneId === scene.id;
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
                                        onClick={() => handleSelectScene(scene.id)}
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
                    {previousSession?.recap && (
                        <div className="mt-6">
                            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Last Session</h2>
                            <p className="text-xs text-slate-400 leading-relaxed">{previousSession.recap.substring(0, 300)}{previousSession.recap.length > 300 ? '...' : ''}</p>
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

                {/* Center: Active Scene Panel */}
                <div className={twMerge(
                    "flex-1 overflow-y-auto p-4 md:p-6",
                    mobileTab === 'active' ? "flex flex-col md:block" : "hidden md:block"
                )}>
                    {activeScene ? (
                        <div className="max-w-3xl mx-auto space-y-6">
                            {/* Previously... Recap Banner */}
                            {showRecap && previousSession?.recap && (
                                <div className="bg-stone-800/40 border border-stone-700/40 rounded-lg p-4 relative">
                                    <button
                                        onClick={() => setShowRecap(false)}
                                        className="absolute top-2 right-2 text-slate-500 hover:text-slate-300"
                                    >
                                        <Icons.X className="w-4 h-4" />
                                    </button>
                                    <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Previously...</h3>
                                    <p className="text-sm text-slate-300 leading-relaxed">{previousSession.recap}</p>
                                    {previousSession.looseEnds && (
                                        <div className="mt-2 pt-2 border-t border-stone-700/30">
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
                                    onClick={handleAdvanceScene}
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
                                    {/* Cast dynamics summary — only shown when there are inter-NPC relationships */}
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

                {/* Right: Quick Tools Panel */}
                <div className={twMerge(
                    "flex-shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col overflow-y-auto",
                    "w-full md:w-64",
                    mobileTab === 'tools' ? "flex md:flex" : "hidden md:flex"
                )}>
                    <div className="p-3 border-b border-slate-800">
                        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quick Tools</h2>
                    </div>

                    <div className="p-3 space-y-2">
                        <button
                            onClick={onOpenCoach}
                            className="w-full flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors"
                        >
                            <Icons.Coach className="w-4 h-4 text-indigo-400" />
                            DM Coach
                        </button>
                        {canShowCombatTracker && (
                        <button
                            className="w-full flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors"
                            onClick={handleOpenCombat}
                        >
                            <Icons.Combat className="w-4 h-4 text-red-400" />
                            Combat Tracker
                        </button>
                        )}
                        <button
                            onClick={() => setShowDiceRoller(p => !p)}
                            className="w-full flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors"
                        >
                            <Icons.Dice className="w-4 h-4 text-amber-400" />
                            Dice Roller
                            <Icons.ChevronDown className={twMerge("w-3 h-3 ml-auto text-slate-500 transition-transform", showDiceRoller && "rotate-180")} />
                        </button>
                        {showDiceRoller && (
                            <DiceRoller onLogRoll={(roll) => campaignService.addDiceRollToSession(roll)} />
                        )}
                        <button
                            onClick={() => setShowQuickNpc(!showQuickNpc)}
                            className={twMerge(
                                "w-full flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-lg text-sm transition-colors",
                                showQuickNpc
                                    ? "bg-emerald-900/40 text-emerald-300 border border-emerald-700/50"
                                    : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                            )}
                        >
                            <Icons.UserPlus className="w-4 h-4 text-emerald-400" />
                            Quick NPC
                        </button>
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
                        <div className="px-3 pb-3 space-y-2">
                            {!npcPreview && (
                                <>
                                    <input
                                        type="text"
                                        value={npcPrompt}
                                        onChange={(e) => setNpcPrompt(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !npcGenerating) handleGenerateQuickNpc(); }}
                                        placeholder="A suspicious merchant..."
                                        disabled={npcGenerating}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleGenerateQuickNpc}
                                        disabled={!npcPrompt.trim() || npcGenerating}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm transition-colors"
                                    >
                                        {npcGenerating ? (
                                            <>
                                                <Icons.Loader className="w-4 h-4 animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <Icons.Sparkles className="w-4 h-4" />
                                                Generate
                                            </>
                                        )}
                                    </button>
                                </>
                            )}

                            {/* NPC Preview Card */}
                            {npcPreview && !npcEditMode && (
                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 space-y-2">
                                    <p className="text-sm font-bold text-white">{npcPreview.name}</p>
                                    {npcPreview.traits && <p className="text-xs text-amber-300 italic">{npcPreview.traits}</p>}
                                    {npcPreview.description && <p className="text-xs text-slate-300 line-clamp-3">{npcPreview.description}</p>}
                                    {npcPreview.exampleQuote && <p className="text-xs text-amber-400/70 italic">"{npcPreview.exampleQuote}"</p>}
                                    <div className="flex gap-1.5 pt-1">
                                        <button
                                            onClick={handleSavePreviewNpc}
                                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                                        >
                                            <Icons.CheckCircle className="w-3.5 h-3.5" />
                                            Save
                                        </button>
                                        <button
                                            onClick={handleGenerateQuickNpc}
                                            disabled={npcGenerating}
                                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50"
                                        >
                                            <Icons.Sparkles className="w-3.5 h-3.5" />
                                            {npcGenerating ? 'Generating...' : 'Regenerate'}
                                        </button>
                                        <button
                                            onClick={handleEditPreviewNpc}
                                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition-colors"
                                        >
                                            <Icons.Edit className="w-3.5 h-3.5" />
                                            Edit
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => { setNpcPreview(null); setNpcEditMode(false); }}
                                        className="w-full text-xs text-slate-500 hover:text-slate-400 transition-colors"
                                    >
                                        Discard
                                    </button>
                                </div>
                            )}

                            {/* NPC Edit Mode */}
                            {npcPreview && npcEditMode && (
                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 space-y-2">
                                    <input
                                        type="text"
                                        value={npcEditData.name}
                                        onChange={(e) => setNpcEditData(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="Name"
                                        className="w-full bg-slate-900 border border-slate-600 rounded-md px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                                    />
                                    <textarea
                                        value={npcEditData.traits}
                                        onChange={(e) => setNpcEditData(prev => ({ ...prev, traits: e.target.value }))}
                                        placeholder="Traits"
                                        rows={2}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                                    />
                                    <textarea
                                        value={npcEditData.description}
                                        onChange={(e) => setNpcEditData(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="Description"
                                        rows={3}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                                    />
                                    <div className="flex gap-1.5">
                                        <button
                                            onClick={handleSavePreviewNpc}
                                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                                        >
                                            <Icons.CheckCircle className="w-3.5 h-3.5" />
                                            Save
                                        </button>
                                        <button
                                            onClick={() => setNpcEditMode(false)}
                                            className="flex-1 px-2 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition-colors"
                                        >
                                            Back to Preview
                                        </button>
                                    </div>
                                </div>
                            )}

                            {npcError && (
                                <p className="text-xs text-red-400">{npcError}</p>
                            )}
                        </div>
                    )}

                    {/* Secrets & Clues Panel */}
                    {canShowSecretsTracker && showSecrets && (
                        <div className="border-t border-slate-800 flex-shrink-0" style={{ maxHeight: '400px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
                                            onClick={() => cyclePlotStatus(plot.id)}
                                            className="w-full text-left border-l-2 border-amber-600/50 pl-2.5 py-1 hover:bg-slate-800/50 rounded-r transition-colors group"
                                        >
                                            <p className="text-sm text-amber-200 font-medium">{plot.title}</p>
                                            {plot.description && (
                                                <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{plot.description.substring(0, 120)}{plot.description.length > 120 ? '...' : ''}</p>
                                            )}
                                            <div className="flex items-center justify-between mt-1">
                                                {plotStatusBadge(status)}
                                                <span className="text-[10px] text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">click to change</span>
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
            </div>

            {/* Bottom: Running Log — hidden on mobile tools/scenes tab to maximize screen space */}
            <div className={twMerge(
                "flex-shrink-0 bg-slate-900 border-t border-slate-700 flex flex-col",
                "h-44 md:h-56",
                mobileTab === 'tools' || mobileTab === 'scenes' ? "hidden md:flex" : "flex"
            )}>
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Running Log</h2>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowImportantOnly(prev => !prev)}
                            className={twMerge(
                                "flex items-center gap-1 text-xs px-2 py-0.5 rounded-md transition-colors",
                                showImportantOnly
                                    ? "bg-amber-900/40 text-amber-400 border border-amber-700/50"
                                    : "text-slate-500 hover:text-slate-400"
                            )}
                        >
                            <Icons.Star className="w-3 h-3" />
                            {showImportantOnly ? 'Important Only' : 'Show All'}
                        </button>
                        <span className="text-xs text-slate-600">{sessionLog.structuredNotes?.length || 0} entries</span>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
                    {filteredNotes.map(note => {
                        const typeStyle = note.type && note.type !== 'manual' ? ENTRY_TYPE_STYLES[note.type] : null;
                        return (
                            <div
                                key={note.id}
                                className={twMerge(
                                    "flex items-start gap-2 text-sm py-0.5 group",
                                    typeStyle?.border
                                )}
                            >
                                <span className="text-slate-600 text-xs font-mono flex-shrink-0 mt-0.5">
                                    {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {typeStyle?.icon}
                                <span className={twMerge("flex-1", typeStyle?.text || "text-slate-300")}>
                                    {note.content}
                                </span>
                                {note.tags && note.tags.length > 0 && (
                                    <div className="flex gap-1 flex-shrink-0">
                                        {note.tags.map(tag => (
                                            <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">{tag}</span>
                                        ))}
                                    </div>
                                )}
                                <button
                                    onClick={() => campaignService.toggleNoteImportance(note.id)}
                                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title={note.isImportant ? 'Unmark important' : 'Mark important'}
                                >
                                    <Icons.Star
                                        className={twMerge(
                                            "w-3.5 h-3.5 transition-colors",
                                            note.isImportant
                                                ? "text-amber-400 fill-amber-400"
                                                : "text-slate-600 hover:text-slate-400"
                                        )}
                                    />
                                </button>
                            </div>
                        );
                    })}
                    {filteredNotes.length === 0 && (
                        <p className="text-xs text-slate-600 italic">
                            {showImportantOnly ? 'No important notes. Star a note to mark it important.' : 'No notes yet. Add notes below.'}
                        </p>
                    )}
                </div>
                <div className="px-4 py-2 border-t border-slate-800 space-y-2">
                    <div className="flex gap-1">
                        {NOTE_TAG_OPTIONS.map(tag => (
                            <button
                                key={tag}
                                onClick={() => toggleTag(tag)}
                                className={twMerge(
                                    "text-xs px-2 py-0.5 rounded-md transition-colors border",
                                    noteTags.includes(tag)
                                        ? "bg-amber-900/40 text-amber-300 border-amber-600/50"
                                        : "bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-400 hover:border-slate-600"
                                )}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <MentionInput
                            value={noteInput}
                            onChange={setNoteInput}
                            onMentionedIdsChange={setNoteMentionedEntityIds}
                            onEnterSubmit={handleAddNote}
                            placeholder="Add a quick note... (@ to mention an entity)"
                            singleLine
                            className="flex-1"
                            textareaClassName="bg-slate-800 border-slate-700 placeholder-slate-500 focus:border-amber-500 focus:ring-amber-500/30 py-1.5"
                            aria-label="Session note input"
                        />
                        {hasSpeechRecognition && (
                            <button
                                onClick={handleToggleMic}
                                title={isRecording ? 'Stop recording' : 'Start voice capture'}
                                className={twMerge(
                                    "flex-shrink-0 flex items-center justify-center w-9 rounded-lg transition-colors",
                                    isRecording
                                        ? "bg-red-600 hover:bg-red-500 text-white"
                                        : "bg-slate-700 hover:bg-slate-600 text-slate-300"
                                )}
                            >
                                {isRecording
                                    ? <span className="relative flex items-center justify-center w-full h-full">
                                        <Icons.MicOff className="w-4 h-4" />
                                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                                    </span>
                                    : <Icons.Mic className="w-4 h-4" />
                                }
                            </button>
                        )}
                        <button
                            onClick={handleAddNote}
                            disabled={!noteInput.trim()}
                            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm transition-colors flex-shrink-0"
                        >
                            Add
                        </button>
                    </div>
                </div>
            </div>

            {/* Floating Action Button — mobile only, visible on scenes/active tabs */}
            {mobileTab !== 'tools' && (
                <>
                {fabOpen && (
                    <div
                        className="fixed inset-0 z-20 md:hidden"
                        onClick={() => setFabOpen(false)}
                    />
                )}
                <div className="fixed bottom-4 right-4 md:hidden z-30">
                    {/* FAB menu */}
                    {fabOpen && (
                        <div className="absolute bottom-16 right-0 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-2 space-y-1 min-w-[180px]">
                            <button
                                onClick={() => { onOpenCoach(); setFabOpen(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                            >
                                <Icons.Coach className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                                DM Coach
                            </button>
                            <button
                                onClick={() => { setShowDiceRoller(true); setMobileTab('tools'); setFabOpen(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                            >
                                <Icons.Dice className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                Dice Roller
                            </button>
                            {canShowCombatTracker && (
                            <button
                                onClick={() => { handleOpenCombat(); setMobileTab('tools'); setFabOpen(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                            >
                                <Icons.Combat className="w-4 h-4 text-red-400 flex-shrink-0" />
                                Combat Tracker
                            </button>
                            )}
                            {canShowSecretsTracker && (
                            <button
                                onClick={() => { setShowSecrets(true); setMobileTab('tools'); setFabOpen(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                            >
                                <Icons.Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                Secrets & Clues
                            </button>
                            )}
                        </div>
                    )}
                    {/* FAB button */}
                    <button
                        onClick={() => setFabOpen(p => !p)}
                        className={twMerge(
                            "w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-colors",
                            fabOpen
                                ? "bg-amber-500 text-white"
                                : "bg-amber-600 hover:bg-amber-500 text-white"
                        )}
                        aria-label="Quick tools"
                    >
                        <Icons.Sparkles className={twMerge("w-6 h-6 transition-transform", fabOpen && "rotate-45")} />
                    </button>
                </div>
                </>
            )}

            {/* Session End Wizard */}
            {showEndWizard && (
                <SessionEndWizard
                    campaign={campaign}
                    sessionLog={sessionLog}
                    isMockMode={isMockMode}
                    onComplete={onEndSession}
                    onCancel={() => setShowEndWizard(false)}
                />
            )}

            {/* Combat Tracker Slide-out Panel */}
            {canShowCombatTracker && showCombatPanel && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/50 z-40"
                        onClick={() => setShowCombatPanel(false)}
                    />
                    {/* Panel */}
                    <div className="fixed right-0 top-0 bottom-0 w-[500px] bg-slate-900 border-l border-slate-700 z-50 shadow-2xl flex flex-col">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                            <div className="flex items-center gap-2">
                                <Icons.Combat className="w-5 h-5 text-red-400" />
                                <h2 className="text-lg font-bold text-white font-serif">Combat Tracker</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                {campaign.activeEncounter && campaign.activeEncounter.combatants.length > 0 && (
                                    <button
                                        onClick={handleEndCombat}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm transition-colors"
                                        title="End combat and log summary"
                                    >
                                        <Icons.Stop className="w-4 h-4" />
                                        End Combat
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowCombatPanel(false)}
                                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                                >
                                    <Icons.X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            {campaign.activeEncounter && (
                                <CombatTracker
                                    encounter={campaign.activeEncounter}
                                    onUpdate={handleUpdateEncounter}
                                    campaignNpcs={campaign.npcs}
                                    campaignPcs={campaign.playerCharacters || []}
                                />
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
