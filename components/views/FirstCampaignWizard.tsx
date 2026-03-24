
import React, { useState, useCallback } from 'react';
import type { NPC, Location } from '@/types/index';
import type { AdventureForBatchAdd } from '@/types/index';
import { Icons } from '@/components/common/Icons';
import {
    generateStarterNpcs,
    generateStarterLocations,
    generateStarterAdventure,
} from '@/services/geminiService';
import { campaignService } from '@/services/campaignService';

// ── Types ──────────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface NpcDraft extends Omit<NPC, 'id' | 'factionId'> {
    _key: string; // local stable key for list rendering
}

interface LocationDraft extends Omit<Location, 'id' | 'parentLocationId' | 'subLocationIds'> {
    _key: string;
}

interface AdventureDraft {
    title: string;
    hook: string;
    theme: string;
    level: number;
    scenes: AdventureForBatchAdd['scenes'];
}

// ── Props ──────────────────────────────────────────────────────────────────

interface FirstCampaignWizardProps {
    worldSetting: string;            // Pre-filled from the campaign's setting field
    isMockMode: boolean;
    onDismiss: () => void;           // Marks wizard dismissed without completing
    onComplete: (view: 'npcs' | 'adventures') => void; // Navigate after completion
}

// ── Utility ────────────────────────────────────────────────────────────────

const key = () => Math.random().toString(36).slice(2);

// ── Sub-components ────────────────────────────────────────────────────────

interface ProgressBarProps {
    step: WizardStep;
    totalSteps: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ step, totalSteps }) => {
    const pct = Math.round(((step - 1) / (totalSteps - 1)) * 100);
    return (
        <div className="w-full bg-stone-700 rounded-full h-1.5 mb-6">
            <div
                className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
            />
        </div>
    );
};

interface NpcCardProps {
    npc: NpcDraft;
    onUpdate: (key: string, field: keyof NpcDraft, value: string) => void;
    onRemove: (key: string) => void;
}

const NpcCard: React.FC<NpcCardProps> = ({ npc, onUpdate, onRemove }) => {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className="bg-stone-800 border border-stone-700 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                    <input
                        value={npc.name}
                        onChange={e => onUpdate(npc._key, 'name', e.target.value)}
                        className="w-full bg-stone-900 border border-stone-600 rounded-md px-3 py-1.5 text-stone-100 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                        placeholder="NPC name"
                    />
                </div>
                <button
                    onClick={() => setExpanded(p => !p)}
                    className="text-stone-400 hover:text-stone-200 p-1 flex-shrink-0"
                    title={expanded ? 'Collapse' : 'Expand'}
                >
                    {expanded ? <Icons.ChevronUp className="w-4 h-4" /> : <Icons.ChevronDown className="w-4 h-4" />}
                </button>
                <button
                    onClick={() => onRemove(npc._key)}
                    className="text-stone-500 hover:text-red-400 p-1 flex-shrink-0"
                    title="Remove NPC"
                >
                    <Icons.Trash className="w-4 h-4" />
                </button>
            </div>

            <textarea
                value={npc.description}
                onChange={e => onUpdate(npc._key, 'description', e.target.value)}
                rows={2}
                className="w-full bg-stone-900 border border-stone-600 rounded-md px-3 py-1.5 text-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 resize-none"
                placeholder="Physical description..."
            />

            {expanded && (
                <div className="space-y-2 pt-1">
                    <div>
                        <label className="block text-xs text-stone-400 mb-1">Traits</label>
                        <input
                            value={npc.traits}
                            onChange={e => onUpdate(npc._key, 'traits', e.target.value)}
                            className="w-full bg-stone-900 border border-stone-600 rounded-md px-3 py-1.5 text-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            placeholder="Distinctive personality traits..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-stone-400 mb-1">Motivations</label>
                        <input
                            value={npc.motivations}
                            onChange={e => onUpdate(npc._key, 'motivations', e.target.value)}
                            className="w-full bg-stone-900 border border-stone-600 rounded-md px-3 py-1.5 text-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            placeholder="What do they want?"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-stone-400 mb-1">Secret</label>
                        <input
                            value={npc.secrets}
                            onChange={e => onUpdate(npc._key, 'secrets', e.target.value)}
                            className="w-full bg-stone-900 border border-stone-600 rounded-md px-3 py-1.5 text-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            placeholder="What are they hiding?"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-stone-400 mb-1">Example Quote</label>
                        <input
                            value={npc.exampleQuote}
                            onChange={e => onUpdate(npc._key, 'exampleQuote', e.target.value)}
                            className="w-full bg-stone-900 border border-stone-600 rounded-md px-3 py-1.5 text-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            placeholder='"A memorable line of dialogue..."'
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

interface LocationCardProps {
    loc: LocationDraft;
    onUpdate: (key: string, field: keyof LocationDraft, value: string) => void;
    onRemove: (key: string) => void;
}

const LocationCard: React.FC<LocationCardProps> = ({ loc, onUpdate, onRemove }) => {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className="bg-stone-800 border border-stone-700 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                    <input
                        value={loc.name}
                        onChange={e => onUpdate(loc._key, 'name', e.target.value)}
                        className="w-full bg-stone-900 border border-stone-600 rounded-md px-3 py-1.5 text-stone-100 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                        placeholder="Location name"
                    />
                </div>
                <button
                    onClick={() => setExpanded(p => !p)}
                    className="text-stone-400 hover:text-stone-200 p-1 flex-shrink-0"
                    title={expanded ? 'Collapse' : 'Expand'}
                >
                    {expanded ? <Icons.ChevronUp className="w-4 h-4" /> : <Icons.ChevronDown className="w-4 h-4" />}
                </button>
                <button
                    onClick={() => onRemove(loc._key)}
                    className="text-stone-500 hover:text-red-400 p-1 flex-shrink-0"
                    title="Remove location"
                >
                    <Icons.Trash className="w-4 h-4" />
                </button>
            </div>

            <textarea
                value={loc.description}
                onChange={e => onUpdate(loc._key, 'description', e.target.value)}
                rows={2}
                className="w-full bg-stone-900 border border-stone-600 rounded-md px-3 py-1.5 text-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 resize-none"
                placeholder="Describe this location..."
            />

            {expanded && (
                <div>
                    <label className="block text-xs text-stone-400 mb-1">Secret / Hidden Detail</label>
                    <input
                        value={loc.secrets}
                        onChange={e => onUpdate(loc._key, 'secrets', e.target.value)}
                        className="w-full bg-stone-900 border border-stone-600 rounded-md px-3 py-1.5 text-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        placeholder="What's hidden here?"
                    />
                </div>
            )}
        </div>
    );
};

// ── Main Component ─────────────────────────────────────────────────────────

export const FirstCampaignWizard: React.FC<FirstCampaignWizardProps> = ({
    worldSetting,
    isMockMode,
    onDismiss,
    onComplete,
}) => {
    // ── State ──────────────────────────────────────────────────────────────
    const [step, setStep] = useState<WizardStep>(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Step 1
    const [worldDescription, setWorldDescription] = useState(worldSetting || '');

    // Step 2 — NPCs
    const [npcDrafts, setNpcDrafts] = useState<NpcDraft[]>([]);

    // Step 3 — Locations
    const [locationDrafts, setLocationDrafts] = useState<LocationDraft[]>([]);

    // Step 4 — Adventure
    const [adventureDraft, setAdventureDraft] = useState<AdventureDraft | null>(null);

    // Step 5 — saved entity counts
    const [savedCounts, setSavedCounts] = useState({ npcs: 0, locations: 0, scenes: 0 });

    // ── Step transitions ───────────────────────────────────────────────────

    const handleStep1Next = async () => {
        if (worldDescription.trim().length < 20) return;
        setError(null);
        setIsLoading(true);
        try {
            const npcs = await generateStarterNpcs(worldDescription, isMockMode);
            setNpcDrafts(npcs.map(n => ({ ...n, _key: key() })));
            setStep(2);
        } catch (e) {
            setError('Could not generate NPCs. Please try again.');
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStep2Next = async () => {
        if (npcDrafts.length === 0) return;
        setError(null);
        setIsLoading(true);
        try {
            const locs = await generateStarterLocations(worldDescription, npcDrafts, isMockMode);
            setLocationDrafts(locs.map(l => ({ ...l, _key: key() })));
            setStep(3);
        } catch (e) {
            setError('Could not generate locations. Please try again.');
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStep3Next = async () => {
        if (locationDrafts.length === 0) return;
        setError(null);
        setIsLoading(true);
        try {
            const adv = await generateStarterAdventure(worldDescription, npcDrafts, locationDrafts, isMockMode);
            setAdventureDraft({
                title: adv.title,
                hook: adv.hook,
                theme: adv.theme,
                level: adv.level,
                scenes: adv.scenes,
            });
            setStep(4);
        } catch (e) {
            setError('Could not generate adventure. Please try again.');
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStep4Next = () => {
        // Save everything to the campaign
        let npcCount = 0;
        let locCount = 0;

        // Save NPCs
        for (const draft of npcDrafts) {
            const { _key: _k, ...npcData } = draft;
            campaignService.createNpc({ ...npcData, factionId: undefined });
            npcCount++;
        }

        // Save Locations
        for (const draft of locationDrafts) {
            const { _key: _k, ...locData } = draft;
            campaignService.createLocation({
                ...locData,
                subLocationIds: [],
                loot: locData.loot || [],
                connections: locData.connections || [],
                pointsOfInterest: locData.pointsOfInterest || [],
                history: locData.history || [],
            });
            locCount++;
        }

        // Save Adventure
        let sceneCount = 0;
        if (adventureDraft) {
            campaignService.createFullAdventure({
                title: adventureDraft.title,
                hook: adventureDraft.hook,
                theme: adventureDraft.theme,
                level: adventureDraft.level,
                scenes: adventureDraft.scenes,
            });
            sceneCount = adventureDraft.scenes?.length ?? 0;
        }

        setSavedCounts({ npcs: npcCount, locations: locCount, scenes: sceneCount });
        campaignService.dismissWizard();
        setStep(5);
    };

    // ── NPC draft mutations ────────────────────────────────────────────────

    const handleNpcUpdate = useCallback((draftKey: string, field: keyof NpcDraft, value: string) => {
        setNpcDrafts(prev => prev.map(n => n._key === draftKey ? { ...n, [field]: value } : n));
    }, []);

    const handleNpcRemove = useCallback((draftKey: string) => {
        setNpcDrafts(prev => prev.filter(n => n._key !== draftKey));
    }, []);

    const handleRegenerateNpcs = async () => {
        setError(null);
        setIsLoading(true);
        try {
            const npcs = await generateStarterNpcs(worldDescription, isMockMode);
            setNpcDrafts(npcs.map(n => ({ ...n, _key: key() })));
        } catch (e) {
            setError('Regeneration failed. Please try again.');
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    // ── Location draft mutations ──────────────────────────────────────────

    const handleLocUpdate = useCallback((draftKey: string, field: keyof LocationDraft, value: string) => {
        setLocationDrafts(prev => prev.map(l => l._key === draftKey ? { ...l, [field]: value } : l));
    }, []);

    const handleLocRemove = useCallback((draftKey: string) => {
        setLocationDrafts(prev => prev.filter(l => l._key !== draftKey));
    }, []);

    const handleRegenerateLocations = async () => {
        setError(null);
        setIsLoading(true);
        try {
            const locs = await generateStarterLocations(worldDescription, npcDrafts, isMockMode);
            setLocationDrafts(locs.map(l => ({ ...l, _key: key() })));
        } catch (e) {
            setError('Regeneration failed. Please try again.');
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    // ── Adventure draft mutations ─────────────────────────────────────────

    const handleRegenerateAdventure = async () => {
        setError(null);
        setIsLoading(true);
        try {
            const adv = await generateStarterAdventure(worldDescription, npcDrafts, locationDrafts, isMockMode);
            setAdventureDraft({
                title: adv.title,
                hook: adv.hook,
                theme: adv.theme,
                level: adv.level,
                scenes: adv.scenes,
            });
        } catch (e) {
            setError('Regeneration failed. Please try again.');
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    // ── Step labels ────────────────────────────────────────────────────────

    const stepLabels: Record<WizardStep, string> = {
        1: 'Tell me about your world',
        2: "Let's build your cast",
        3: 'Key locations',
        4: 'Your first adventure',
        5: 'Ready!',
    };

    // ── Render ────────────────────────────────────────────────────────────

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-stone-900 border border-stone-700 rounded-xl shadow-2xl">

                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-2 flex-shrink-0">
                    <div>
                        <p className="text-xs font-medium text-amber-400 uppercase tracking-widest mb-1">
                            Step {step} of 5
                        </p>
                        <h2 className="text-xl font-bold font-serif text-stone-100">
                            {stepLabels[step]}
                        </h2>
                    </div>
                    <button
                        onClick={onDismiss}
                        className="text-stone-500 hover:text-stone-300 transition-colors ml-4 flex-shrink-0"
                        title="Skip wizard"
                    >
                        <Icons.X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 pb-2 flex-shrink-0">
                    <ProgressBar step={step} totalSteps={5} />
                </div>

                {/* Body — scrollable */}
                <div className="flex-1 overflow-y-auto px-6 pb-2">

                    {/* Error banner */}
                    {error && (
                        <div className="mb-4 flex items-center gap-2 bg-red-900/30 border border-red-700 rounded-lg px-4 py-2 text-red-300 text-sm">
                            <Icons.AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* ── STEP 1 ─────────────────────────────────────────── */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <p className="text-stone-400 text-sm">
                                Describe your world in a few sentences. The more vivid, the better — themes, tone, conflicts, and atmosphere all help the AI generate content that fits.
                            </p>
                            <textarea
                                value={worldDescription}
                                onChange={e => setWorldDescription(e.target.value)}
                                rows={7}
                                autoFocus
                                className="w-full bg-stone-800 border border-stone-600 rounded-lg px-4 py-3 text-stone-100 text-sm placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 resize-none"
                                placeholder="A dark medieval kingdom where ancient dragons stir beneath forgotten mountains..."
                            />
                            <p className="text-xs text-stone-500">
                                Minimum 20 characters. Your campaign setting description is pre-filled above if you set one during creation.
                            </p>
                        </div>
                    )}

                    {/* ── STEP 2 ─────────────────────────────────────────── */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <p className="text-stone-400 text-sm">
                                Here are your starter NPCs. Edit any fields directly, remove NPCs you don't want, or regenerate for a fresh set.
                            </p>
                            {npcDrafts.length === 0 && (
                                <p className="text-stone-500 text-sm italic text-center py-4">
                                    No NPCs — regenerate to add some, or click Next to skip.
                                </p>
                            )}
                            <div className="space-y-3">
                                {npcDrafts.map(npc => (
                                    <NpcCard
                                        key={npc._key}
                                        npc={npc}
                                        onUpdate={handleNpcUpdate}
                                        onRemove={handleNpcRemove}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── STEP 3 ─────────────────────────────────────────── */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <p className="text-stone-400 text-sm">
                                These locations were chosen to fit your world and cast. Edit or remove as needed.
                            </p>
                            {locationDrafts.length === 0 && (
                                <p className="text-stone-500 text-sm italic text-center py-4">
                                    No locations — regenerate to add some, or click Next to skip.
                                </p>
                            )}
                            <div className="space-y-3">
                                {locationDrafts.map(loc => (
                                    <LocationCard
                                        key={loc._key}
                                        loc={loc}
                                        onUpdate={handleLocUpdate}
                                        onRemove={handleLocRemove}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── STEP 4 ─────────────────────────────────────────── */}
                    {step === 4 && adventureDraft && (
                        <div className="space-y-4">
                            <p className="text-stone-400 text-sm">
                                Your first adventure. Edit the title and hook, then approve it to save everything.
                            </p>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-stone-400 mb-1">Adventure Title</label>
                                    <input
                                        value={adventureDraft.title}
                                        onChange={e => setAdventureDraft(d => d ? { ...d, title: e.target.value } : d)}
                                        className="w-full bg-stone-800 border border-stone-600 rounded-md px-3 py-2 text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-stone-400 mb-1">Hook</label>
                                    <textarea
                                        value={adventureDraft.hook}
                                        onChange={e => setAdventureDraft(d => d ? { ...d, hook: e.target.value } : d)}
                                        rows={3}
                                        className="w-full bg-stone-800 border border-stone-600 rounded-md px-3 py-2 text-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 resize-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-stone-400 mb-2">
                                        Scenes ({adventureDraft.scenes?.length ?? 0})
                                    </label>
                                    <div className="space-y-2">
                                        {(adventureDraft.scenes ?? []).map((scene, i) => (
                                            <div
                                                key={i}
                                                className="bg-stone-800 border border-stone-700 rounded-lg px-4 py-3"
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs text-stone-500 font-mono">
                                                        {i + 1}
                                                    </span>
                                                    <span className="text-sm font-medium text-stone-200">
                                                        {scene.title}
                                                    </span>
                                                    <span className="ml-auto text-xs text-stone-500 capitalize bg-stone-700 px-2 py-0.5 rounded-full">
                                                        {scene.type}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-stone-400 leading-relaxed line-clamp-2">
                                                    {scene.readAloudText}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 5 ─────────────────────────────────────────── */}
                    {step === 5 && (
                        <div className="space-y-6 py-2">
                            <div className="flex justify-center">
                                <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center">
                                    <Icons.CheckCircle className="w-8 h-8 text-amber-400" />
                                </div>
                            </div>
                            <p className="text-center text-stone-300 text-sm">
                                Your world is ready. Here's what was added to your campaign:
                            </p>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-stone-800 border border-stone-700 rounded-lg p-4 text-center">
                                    <p className="text-3xl font-bold text-amber-400">{savedCounts.npcs}</p>
                                    <p className="text-xs text-stone-400 mt-1">NPCs</p>
                                </div>
                                <div className="bg-stone-800 border border-stone-700 rounded-lg p-4 text-center">
                                    <p className="text-3xl font-bold text-amber-400">{savedCounts.locations}</p>
                                    <p className="text-xs text-stone-400 mt-1">Locations</p>
                                </div>
                                <div className="bg-stone-800 border border-stone-700 rounded-lg p-4 text-center">
                                    <p className="text-3xl font-bold text-amber-400">{savedCounts.scenes}</p>
                                    <p className="text-xs text-stone-400 mt-1">Scenes</p>
                                </div>
                            </div>
                            <p className="text-center text-xs text-stone-500">
                                1 adventure created. You can edit everything from the sidebar.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer — actions */}
                <div className="flex-shrink-0 px-6 py-4 border-t border-stone-800 flex flex-col sm:flex-row items-center gap-3">

                    {/* Skip link — shown on all steps except 5 */}
                    {step !== 5 && (
                        <button
                            onClick={onDismiss}
                            className="text-xs text-stone-500 hover:text-stone-300 sm:mr-auto"
                        >
                            Skip — I'll build my own
                        </button>
                    )}

                    {/* Back button — steps 2-4 */}
                    {step > 1 && step < 5 && (
                        <button
                            onClick={() => setStep(s => (s - 1) as WizardStep)}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm text-stone-300 bg-stone-800 hover:bg-stone-700 border border-stone-600 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <Icons.ChevronLeft className="w-4 h-4" />
                            Back
                        </button>
                    )}

                    {/* Primary action */}
                    {step === 1 && (
                        <button
                            onClick={handleStep1Next}
                            disabled={isLoading || worldDescription.trim().length < 20}
                            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <>
                                    <Icons.Loader className="w-4 h-4 animate-spin" />
                                    Generating cast...
                                </>
                            ) : (
                                <>
                                    Next
                                    <Icons.ChevronRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    )}

                    {step === 2 && (
                        <div className="flex gap-2 sm:ml-auto">
                            <button
                                onClick={handleRegenerateNpcs}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm text-stone-300 bg-stone-800 hover:bg-stone-700 border border-stone-600 rounded-lg transition-colors disabled:opacity-50"
                                title="Regenerate all NPCs"
                            >
                                {isLoading ? (
                                    <Icons.Loader className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Icons.Sparkles className="w-4 h-4" />
                                )}
                                Regenerate
                            </button>
                            <button
                                onClick={handleStep2Next}
                                disabled={isLoading}
                                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <>
                                        <Icons.Loader className="w-4 h-4 animate-spin" />
                                        Generating locations...
                                    </>
                                ) : (
                                    <>
                                        Next
                                        <Icons.ChevronRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="flex gap-2 sm:ml-auto">
                            <button
                                onClick={handleRegenerateLocations}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm text-stone-300 bg-stone-800 hover:bg-stone-700 border border-stone-600 rounded-lg transition-colors disabled:opacity-50"
                                title="Regenerate all locations"
                            >
                                {isLoading ? (
                                    <Icons.Loader className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Icons.Sparkles className="w-4 h-4" />
                                )}
                                Regenerate
                            </button>
                            <button
                                onClick={handleStep3Next}
                                disabled={isLoading}
                                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <>
                                        <Icons.Loader className="w-4 h-4 animate-spin" />
                                        Generating adventure...
                                    </>
                                ) : (
                                    <>
                                        Next
                                        <Icons.ChevronRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="flex gap-2 sm:ml-auto">
                            <button
                                onClick={handleRegenerateAdventure}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm text-stone-300 bg-stone-800 hover:bg-stone-700 border border-stone-600 rounded-lg transition-colors disabled:opacity-50"
                                title="Regenerate adventure"
                            >
                                {isLoading ? (
                                    <Icons.Loader className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Icons.Sparkles className="w-4 h-4" />
                                )}
                                Regenerate
                            </button>
                            <button
                                onClick={handleStep4Next}
                                disabled={isLoading || !adventureDraft}
                                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <Icons.CheckCircle className="w-4 h-4" />
                                Save All & Finish
                            </button>
                        </div>
                    )}

                    {step === 5 && (
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:ml-auto">
                            <button
                                onClick={() => onComplete('npcs')}
                                className="flex items-center justify-center gap-2 px-4 py-2 text-sm text-stone-300 bg-stone-800 hover:bg-stone-700 border border-stone-600 rounded-lg transition-colors"
                            >
                                <Icons.NPCs className="w-4 h-4" />
                                Explore Your World
                            </button>
                            <button
                                onClick={() => onComplete('adventures')}
                                className="flex items-center justify-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors"
                            >
                                <Icons.Adventures className="w-4 h-4" />
                                Go to Adventure
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
