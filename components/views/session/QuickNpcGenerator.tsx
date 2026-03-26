
import React, { useState, useCallback } from 'react';
import type { Campaign, Scene, NPC } from '@/types';
import type { Adventure } from '@/types';
import { Icons } from '@/components/common/Icons';
import { Button } from '@/components/common/Button';
import { campaignService } from '@/services/campaignService';
import { generateNpc } from '@/services/aiService';

interface QuickNpcGeneratorProps {
    campaign: Campaign;
    activeScene: Scene | null;
    adventure: Adventure | null;
    isMockMode: boolean;
    onNpcSaved: () => void;
}

export const QuickNpcGenerator: React.FC<QuickNpcGeneratorProps> = ({
    campaign,
    activeScene,
    adventure,
    isMockMode,
    onNpcSaved,
}) => {
    const [npcPrompt, setNpcPrompt] = useState('');
    const [npcGenerating, setNpcGenerating] = useState(false);
    const [npcError, setNpcError] = useState<string | null>(null);
    const [npcPreview, setNpcPreview] = useState<Omit<NPC, 'id' | 'factionId'> | null>(null);
    const [npcEditMode, setNpcEditMode] = useState(false);
    const [npcEditData, setNpcEditData] = useState<{ name: string; description: string; traits: string }>({ name: '', description: '', traits: '' });

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
        onNpcSaved();
    }, [npcPreview, npcEditMode, npcEditData, activeScene, adventure, onNpcSaved]);

    const handleEditPreviewNpc = useCallback(() => {
        if (!npcPreview) return;
        setNpcEditData({ name: npcPreview.name, description: npcPreview.description, traits: npcPreview.traits });
        setNpcEditMode(true);
    }, [npcPreview]);

    return (
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
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={handleGenerateQuickNpc}
                        disabled={!npcPrompt.trim() || npcGenerating}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 focus:ring-emerald-500"
                    >
                        {npcGenerating ? (
                            <>
                                <Icons.Loader className="w-4 h-4 animate-spin mr-2" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Icons.Sparkles className="w-4 h-4 mr-2" />
                                Generate
                            </>
                        )}
                    </Button>
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
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleSavePreviewNpc}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 focus:ring-emerald-500"
                        >
                            <Icons.CheckCircle className="w-3.5 h-3.5 mr-1" />
                            Save
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleGenerateQuickNpc}
                            disabled={npcGenerating}
                            className="flex-1"
                        >
                            <Icons.Sparkles className="w-3.5 h-3.5 mr-1" />
                            {npcGenerating ? 'Generating...' : 'Regenerate'}
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleEditPreviewNpc}
                            className="flex-1"
                        >
                            <Icons.Edit className="w-3.5 h-3.5 mr-1" />
                            Edit
                        </Button>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setNpcPreview(null); setNpcEditMode(false); }}
                        className="w-full text-slate-500 hover:text-slate-400"
                    >
                        Discard
                    </Button>
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
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleSavePreviewNpc}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 focus:ring-emerald-500"
                        >
                            <Icons.CheckCircle className="w-3.5 h-3.5 mr-1" />
                            Save
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setNpcEditMode(false)}
                            className="flex-1"
                        >
                            Back to Preview
                        </Button>
                    </div>
                </div>
            )}

            {npcError && (
                <p className="text-xs text-red-400">{npcError}</p>
            )}
        </div>
    );
};
