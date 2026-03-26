
import React, { useState, useCallback } from 'react';
import type { NPC, Location } from '@/types/index';
import type { AdventureForBatchAdd } from '@/types/index';
import { Icons } from '@/components/common/Icons';
import { Button } from '@/components/common/Button';
import {
    generateStarterNpcs,
    generateStarterLocations,
    generateStarterAdventure,
} from '@/services/aiService';
import { campaignService } from '@/services/campaignService';
import { DialogShell } from '@/components/common/DialogShell';
import { getWintersDaughterTemplate } from '@/utils/demoTemplates';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useToast } from '@/hooks/useToast';

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
    const pct = Math.round((step / totalSteps) * 100);
    return (
        <div className="w-full bg-slate-700 rounded-full h-1.5 mb-6">
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
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                    <input
                        value={npc.name}
                        onChange={e => onUpdate(npc._key, 'name', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-1.5 text-slate-100 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                        placeholder="NPC name"
                    />
                </div>
                <Button
                    variant="icon"
                    onClick={() => setExpanded(p => !p)}
                    className="flex-shrink-0"
                    title={expanded ? 'Collapse' : 'Expand'}
                >
                    {expanded ? <Icons.ChevronUp className="w-4 h-4" /> : <Icons.ChevronDown className="w-4 h-4" />}
                </Button>
                <Button
                    variant="icon"
                    onClick={() => onRemove(npc._key)}
                    className="flex-shrink-0 hover:text-red-400"
                    title="Remove NPC"
                >
                    <Icons.Trash className="w-4 h-4" />
                </Button>
            </div>

            <textarea
                value={npc.description}
                onChange={e => onUpdate(npc._key, 'description', e.target.value)}
                rows={2}
                className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-1.5 text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 resize-none"
                placeholder="Physical description..."
            />

            {expanded && (
                <div className="space-y-2 pt-1">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Traits</label>
                        <input
                            value={npc.traits}
                            onChange={e => onUpdate(npc._key, 'traits', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-1.5 text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            placeholder="Distinctive personality traits..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Motivations</label>
                        <input
                            value={npc.motivations}
                            onChange={e => onUpdate(npc._key, 'motivations', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-1.5 text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            placeholder="What do they want?"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Secret</label>
                        <input
                            value={npc.secrets}
                            onChange={e => onUpdate(npc._key, 'secrets', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-1.5 text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            placeholder="What are they hiding?"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Example Quote</label>
                        <input
                            value={npc.exampleQuote}
                            onChange={e => onUpdate(npc._key, 'exampleQuote', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-1.5 text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
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
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                    <input
                        value={loc.name}
                        onChange={e => onUpdate(loc._key, 'name', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-1.5 text-slate-100 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                        placeholder="Location name"
                    />
                </div>
                <Button
                    variant="icon"
                    onClick={() => setExpanded(p => !p)}
                    className="flex-shrink-0"
                    title={expanded ? 'Collapse' : 'Expand'}
                >
                    {expanded ? <Icons.ChevronUp className="w-4 h-4" /> : <Icons.ChevronDown className="w-4 h-4" />}
                </Button>
                <Button
                    variant="icon"
                    onClick={() => onRemove(loc._key)}
                    className="flex-shrink-0 hover:text-red-400"
                    title="Remove location"
                >
                    <Icons.Trash className="w-4 h-4" />
                </Button>
            </div>

            <textarea
                value={loc.description}
                onChange={e => onUpdate(loc._key, 'description', e.target.value)}
                rows={2}
                className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-1.5 text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 resize-none"
                placeholder="Describe this location..."
            />

            {expanded && (
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Secret / Hidden Detail</label>
                    <input
                        value={loc.secrets}
                        onChange={e => onUpdate(loc._key, 'secrets', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-1.5 text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
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
    // ── Hooks ──────────────────────────────────────────────────────────────
    const { confirm } = useConfirmDialog();
    const { addToast } = useToast();

    // ── State ──────────────────────────────────────────────────────────────
    const [step, setStep] = useState<WizardStep>(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
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

        // If step 3 already has data, ask before regenerating
        if (locationDrafts.length > 0) {
            const shouldRegenerate = await confirm(
                'Regenerate locations?',
                'You already have generated locations. Do you want to regenerate them and lose your current edits?',
                { confirmLabel: 'Regenerate', cancelLabel: 'Keep current', variant: 'danger' }
            );
            if (!shouldRegenerate) {
                setStep(3);
                return;
            }
        }

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

        // If step 4 already has adventure data, ask before regenerating
        if (adventureDraft !== null) {
            const shouldRegenerate = await confirm(
                'Regenerate adventure?',
                'You already have a generated adventure. Do you want to regenerate it and lose your current edits?',
                { confirmLabel: 'Regenerate', cancelLabel: 'Keep current', variant: 'danger' }
            );
            if (!shouldRegenerate) {
                setStep(4);
                return;
            }
        }

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

    const handleStep4Next = async () => {
        setIsSaving(true);
        setError(null);

        try {
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
            addToast('Campaign content saved successfully!', 'success');
            setStep(5);
        } catch (e) {
            console.error('Failed to save campaign content:', e);
            const message = e instanceof Error ? e.message : 'An unexpected error occurred.';
            addToast(`Save failed: ${message}`, 'error');
            setError('Could not save your campaign content. Please try again.');
        } finally {
            setIsSaving(false);
        }
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

    const handleSceneRemove = useCallback((index: number) => {
        setAdventureDraft(d => d ? { ...d, scenes: d.scenes.filter((_, i) => i !== index) } : d);
    }, []);

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
        <DialogShell isOpen={true} onClose={onDismiss} ariaLabel="Campaign Setup Wizard" className="relative w-full max-w-2xl mx-4">
            <div className="relative w-full max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700 rounded-xl shadow-2xl">

                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-2 flex-shrink-0">
                    <div>
                        <p className="text-xs font-medium text-amber-400 uppercase tracking-widest mb-1" aria-current="step">
                            Step {step} of 5
                        </p>
                        <h2 className="text-xl font-bold font-serif text-slate-100">
                            {stepLabels[step]}
                        </h2>
                    </div>
                    <Button
                        variant="icon"
                        onClick={onDismiss}
                        className="ml-4 flex-shrink-0"
                        title="Skip wizard"
                    >
                        <Icons.X className="w-5 h-5" />
                    </Button>
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
                            <p className="text-slate-400 text-sm">
                                Describe your world in a few sentences. The more vivid, the better — themes, tone, conflicts, and atmosphere all help the AI generate content that fits.
                            </p>

                            {/* Demo template quick-fill */}
                            <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-0.5">
                                            Try a Demo World
                                        </p>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            Load <span className="text-slate-300 font-medium">Winter's Daughter</span> — a dark fairy-tale dungeon crawl set in Dolmenwood.
                                            Pre-fills the description so you can explore the full workflow.
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setWorldDescription(getWintersDaughterTemplate().setting)}
                                        className="flex-shrink-0"
                                    >
                                        <Icons.Sparkles className="w-3.5 h-3.5 text-amber-400 mr-1.5" />
                                        Load
                                    </Button>
                                </div>
                            </div>

                            <textarea
                                value={worldDescription}
                                onChange={e => setWorldDescription(e.target.value)}
                                rows={7}
                                autoFocus
                                className={`w-full bg-slate-800 border rounded-lg px-4 py-3 text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none transition-colors ${
                                    worldDescription.trim().length > 0 && worldDescription.trim().length < 20
                                        ? 'border-red-600 focus:border-red-500'
                                        : 'border-slate-600 focus:border-amber-500'
                                }`}
                                placeholder="A dark medieval kingdom where ancient dragons stir beneath forgotten mountains..."
                            />

                            {/* Character counter row */}
                            <div className="flex items-center justify-between">
                                {worldDescription.trim().length > 0 && worldDescription.trim().length < 20 ? (
                                    <p className="text-xs text-red-400 flex items-center gap-1">
                                        <Icons.AlertTriangle className="w-3.5 h-3.5" />
                                        Minimum 20 characters required
                                    </p>
                                ) : (
                                    <p className="text-xs text-slate-500">
                                        Your campaign setting description is pre-filled above if you set one during creation.
                                    </p>
                                )}
                                <p className={`text-xs ml-4 flex-shrink-0 ${
                                    worldDescription.trim().length < 20 ? 'text-slate-500' : 'text-slate-400'
                                }`}>
                                    {worldDescription.trim().length} / 20 min
                                </p>
                            </div>

                            {/* Persistent writing prompts */}
                            <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg px-4 py-3 space-y-1.5">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ideas to include:</p>
                                <ul className="space-y-1">
                                    {[
                                        'Tone & atmosphere (gritty, heroic, horror, whimsical...)',
                                        'Central conflict or tension',
                                        'What makes magic or technology unique here?',
                                        'Key factions or power groups',
                                    ].map(hint => (
                                        <li key={hint} className="flex items-start gap-2 text-xs text-slate-400">
                                            <span className="text-slate-600 mt-0.5 flex-shrink-0">•</span>
                                            {hint}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2 ─────────────────────────────────────────── */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <p className="text-slate-400 text-sm">
                                Here are your starter NPCs. Edit any fields directly, remove NPCs you don't want, or regenerate for a fresh set.
                            </p>
                            {npcDrafts.length === 0 && (
                                <p className="text-slate-500 text-sm italic text-center py-4">
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
                            <p className="text-slate-400 text-sm">
                                These locations were chosen to fit your world and cast. Edit or remove as needed.
                            </p>
                            {locationDrafts.length === 0 && (
                                <p className="text-slate-500 text-sm italic text-center py-4">
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
                            <p className="text-slate-400 text-sm">
                                Your first adventure. Edit the title and hook, then approve it to save everything.
                            </p>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Adventure Title</label>
                                    <input
                                        value={adventureDraft.title}
                                        onChange={e => setAdventureDraft(d => d ? { ...d, title: e.target.value } : d)}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Hook</label>
                                    <textarea
                                        value={adventureDraft.hook}
                                        onChange={e => setAdventureDraft(d => d ? { ...d, hook: e.target.value } : d)}
                                        rows={3}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 resize-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-2">
                                        Scenes ({adventureDraft.scenes?.length ?? 0})
                                    </label>
                                    <div className="space-y-2">
                                        {(adventureDraft.scenes ?? []).map((scene, i) => (
                                            <div
                                                key={i}
                                                className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3"
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs text-slate-500 font-mono">
                                                        {i + 1}
                                                    </span>
                                                    <span className="text-sm font-medium text-slate-200 flex-1 min-w-0 truncate">
                                                        {scene.title}
                                                    </span>
                                                    <span className="text-xs text-slate-500 capitalize bg-slate-700 px-2 py-0.5 rounded-full flex-shrink-0">
                                                        {scene.type}
                                                    </span>
                                                    <Button
                                                        variant="icon"
                                                        onClick={() => handleSceneRemove(i)}
                                                        className="flex-shrink-0 hover:text-red-400"
                                                        title="Remove scene"
                                                    >
                                                        <Icons.Trash className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                                <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
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
                            <p className="text-center text-slate-300 text-sm">
                                Your world is ready. Here's what was added to your campaign:
                            </p>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-center">
                                    <p className="text-3xl font-bold text-amber-400">{savedCounts.npcs}</p>
                                    <p className="text-xs text-slate-400 mt-1">NPCs</p>
                                </div>
                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-center">
                                    <p className="text-3xl font-bold text-amber-400">{savedCounts.locations}</p>
                                    <p className="text-xs text-slate-400 mt-1">Locations</p>
                                </div>
                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-center">
                                    <p className="text-3xl font-bold text-amber-400">{savedCounts.scenes}</p>
                                    <p className="text-xs text-slate-400 mt-1">Scenes</p>
                                </div>
                            </div>
                            <p className="text-center text-xs text-slate-500">
                                1 adventure created. You can edit everything from the sidebar.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer — actions */}
                <div className="flex-shrink-0 px-6 py-4 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-3">

                    {/* Cancel / skip — shown on all steps except 5.
                        On step 1 this reads as "Back to campaigns" (explicit cancel).
                        On later steps it becomes a softer skip link. */}
                    {step !== 5 && (
                        step === 1 ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onDismiss}
                                className="sm:mr-auto text-slate-400 hover:text-slate-200"
                            >
                                <Icons.ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                                Back to campaigns
                            </Button>
                        ) : (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onDismiss}
                                className="sm:mr-auto text-slate-500 hover:text-slate-300"
                            >
                                Skip — I'll build my own
                            </Button>
                        )
                    )}

                    {/* Back button — steps 2-4 */}
                    {step > 1 && step < 5 && (
                        <Button
                            variant="secondary"
                            onClick={() => setStep(s => (s - 1) as WizardStep)}
                            disabled={isLoading}
                        >
                            <Icons.ChevronLeft className="w-4 h-4 mr-1.5" />
                            Back
                        </Button>
                    )}

                    {/* Primary action */}
                    {step === 1 && (
                        <Button
                            variant="primary"
                            onClick={handleStep1Next}
                            disabled={isLoading || worldDescription.trim().length < 20}
                        >
                            {isLoading ? (
                                <>
                                    <Icons.Loader className="w-4 h-4 animate-spin mr-2" />
                                    Generating cast...
                                </>
                            ) : (
                                <>
                                    Next
                                    <Icons.ChevronRight className="w-4 h-4 ml-2" />
                                </>
                            )}
                        </Button>
                    )}

                    {step === 2 && (
                        <div className="flex gap-2 sm:ml-auto">
                            <Button
                                variant="secondary"
                                onClick={handleRegenerateNpcs}
                                disabled={isLoading}
                                title="Regenerate all NPCs"
                            >
                                {isLoading ? (
                                    <Icons.Loader className="w-4 h-4 animate-spin mr-1.5" />
                                ) : (
                                    <Icons.Sparkles className="w-4 h-4 mr-1.5" />
                                )}
                                Regenerate
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleStep2Next}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Icons.Loader className="w-4 h-4 animate-spin mr-2" />
                                        Generating locations...
                                    </>
                                ) : (
                                    <>
                                        Next
                                        <Icons.ChevronRight className="w-4 h-4 ml-2" />
                                    </>
                                )}
                            </Button>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="flex gap-2 sm:ml-auto">
                            <Button
                                variant="secondary"
                                onClick={handleRegenerateLocations}
                                disabled={isLoading}
                                title="Regenerate all locations"
                            >
                                {isLoading ? (
                                    <Icons.Loader className="w-4 h-4 animate-spin mr-1.5" />
                                ) : (
                                    <Icons.Sparkles className="w-4 h-4 mr-1.5" />
                                )}
                                Regenerate
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleStep3Next}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Icons.Loader className="w-4 h-4 animate-spin mr-2" />
                                        Generating adventure...
                                    </>
                                ) : (
                                    <>
                                        Next
                                        <Icons.ChevronRight className="w-4 h-4 ml-2" />
                                    </>
                                )}
                            </Button>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="flex gap-2 sm:ml-auto">
                            <Button
                                variant="secondary"
                                onClick={handleRegenerateAdventure}
                                disabled={isLoading}
                                title="Regenerate adventure"
                            >
                                {isLoading ? (
                                    <Icons.Loader className="w-4 h-4 animate-spin mr-1.5" />
                                ) : (
                                    <Icons.Sparkles className="w-4 h-4 mr-1.5" />
                                )}
                                Regenerate
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleStep4Next}
                                disabled={isLoading || isSaving || !adventureDraft}
                            >
                                {isSaving ? (
                                    <>
                                        <Icons.Loader className="w-4 h-4 animate-spin mr-2" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Icons.CheckCircle className="w-4 h-4 mr-2" />
                                        Save All & Finish
                                    </>
                                )}
                            </Button>
                        </div>
                    )}

                    {step === 5 && (
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:ml-auto">
                            <Button
                                variant="secondary"
                                onClick={() => onComplete('npcs')}
                            >
                                <Icons.NPCs className="w-4 h-4 mr-2" />
                                Explore Your World
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => onComplete('adventures')}
                            >
                                <Icons.Adventures className="w-4 h-4 mr-2" />
                                Go to Adventure
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </DialogShell>
    );
};
