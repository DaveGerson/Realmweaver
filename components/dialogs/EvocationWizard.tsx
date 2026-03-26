
import React, { useState, useRef, useEffect } from 'react';
import { DialogShell } from '../common/DialogShell';

import type { Campaign, SceneType, NPC, Location, Faction, Item, Adventure, AdventureForBatchAdd, Scene } from '../../types/index';
import type { BatchAddData } from '../../types/index';
import { generateCampaignFill, generateNpc, generateLocation, generateFaction, generateItem, generateAdventure, parseDocumentForEntities, generateChatResponse } from '../../services/aiService';
import { buildCampaignContext } from '../../services/contextBuilder';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { twMerge } from 'tailwind-merge';
import { produce } from 'immer';

// Editors
import { NpcEditor } from '../editors/NpcEditor';
import { LocationEditor } from '../editors/LocationEditor';
import { FactionEditor } from '../editors/FactionEditor';
import { ItemEditor } from '../editors/ItemEditor';
import { AdventureEditor } from '../editors/AdventureEditor';
import { ArticleEditor } from '../editors/ArticleEditor';

interface EvocationWizardProps {
  campaign: Campaign;
  onClose: () => void;
  onAddToCampaign: (data: BatchAddData) => void;
  isMockMode: boolean;
}

type Mode = 'simple' | 'detailed' | 'ingest' | 'chat';
type EntityType = 'npcs' | 'locations' | 'factions' | 'items'; // Adventures handled separately now

// Extended types to include IDs for local editing state
interface WizardStateData {
    npcs: NPC[];
    locations: Location[];
    factions: Faction[];
    adventures: Adventure[];
    items: Item[];
}

type SimpleDetailedPrompt = {
    id: string;
    prompt: string;
    linkId?: string;
};

// New types for detailed adventure creation
type SceneDetailedPrompt = {
    id: string;
    prompt: string;
    type?: SceneType;
};

type AdventureDetailedPrompt = {
    id: string;
    prompt: string;
    scenes: SceneDetailedPrompt[];
};

type DetailedPrompts = {
    npcs: SimpleDetailedPrompt[];
    locations: SimpleDetailedPrompt[];
    factions: SimpleDetailedPrompt[];
    adventures: AdventureDetailedPrompt[];
    items: SimpleDetailedPrompt[];
};

type SelectionState = {
    npcs: boolean[];
    locations: boolean[];
    factions: boolean[];
    adventures: boolean[];
    items: boolean[];
}

type ChatMessage = {
    role: 'user' | 'model';
    text: string;
};


const initialDetailedPrompts: DetailedPrompts = {
    npcs: [], locations: [], factions: [], adventures: [], items: []
};

const initialGenerationOptions = {
    npcs: true, locations: true, factions: true, adventures: true, items: true
};

export const EvocationWizard: React.FC<EvocationWizardProps> = ({ campaign, onClose, onAddToCampaign, isMockMode }) => {
    const [mode, setMode] = useState<Mode>('simple');
    const [useCampaignContext, setUseCampaignContext] = useState(true);

    // Mode-specific State
    const [simplePrompt, setSimplePrompt] = useState('');
    const [qualifiers, setQualifiers] = useState({ theme: '', conflict: '', locations: '' });
    const [detailedPrompts, setDetailedPrompts] = useState<DetailedPrompts>(initialDetailedPrompts);
    const [ingestedText, setIngestedText] = useState('');
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    
    // Generation State
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Evoking...');
    const [detailedProgress, setDetailedProgress] = useState<{ completed: number; total: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [generatedData, setGeneratedData] = useState<WizardStateData | null>(null);
    const [selection, setSelection] = useState<SelectionState | null>(null);

    // Editing State
    const [editingEntity, setEditingEntity] = useState<{ type: keyof WizardStateData, index: number } | null>(null);


    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetGenerationState = () => {
        setIsLoading(true);
        setError(null);
        setGeneratedData(null);
        setSelection(null);
        setDetailedProgress(null);
    };

    const processGeneratedData = (data: BatchAddData) => {
        // Hydrate with temporary IDs for editing
        const hydratedData: WizardStateData = {
            npcs: data.npcs.map(n => ({ ...n, id: crypto.randomUUID(), factionId: n.factionId, knowsPlayerHistory: [], relationships: [], history: [] })),
            locations: data.locations.map(l => ({ ...l, id: crypto.randomUUID(), parentLocationId: l.parentLocationId, subLocationIds: [], loot: l.loot || [], connections: l.connections || [], pointsOfInterest: l.pointsOfInterest || [] })),
            factions: data.factions.map(f => ({ ...f, id: crypto.randomUUID(), leaderId: undefined, memberIds: [] })),
            items: data.items.map(i => ({ ...i, id: crypto.randomUUID() })),
            adventures: data.adventures.map(a => ({ 
                ...a, 
                id: crypto.randomUUID(), 
                scenes: (a.scenes || []).map(s => ({ ...s, id: crypto.randomUUID(), npcIds: s.npcIds || [], locationId: s.locationId })) as Scene[] 
            })),
        };

        setGeneratedData(hydratedData);
        setSelection({
            npcs: Array(hydratedData.npcs.length).fill(true),
            locations: Array(hydratedData.locations.length).fill(true),
            factions: Array(hydratedData.factions.length).fill(true),
            adventures: Array(hydratedData.adventures.length).fill(true),
            items: Array(hydratedData.items.length).fill(true),
        });
    }

    const handleGenerate = async () => {
        resetGenerationState();
        const campaignContext = useCampaignContext ? buildCampaignContext({ variant: 'generation', campaign }) : undefined;

        try {
            let data: BatchAddData | null = null;
            switch (mode) {
                case 'simple':
                    setLoadingMessage('Generating from theme...');
                    if (!simplePrompt.trim()) { throw new Error("Please enter a theme for your campaign."); }
                    let fullPrompt = `Theme: ${simplePrompt}\n`;
                    if (qualifiers.theme) fullPrompt += `Genre/Specific Themes: ${qualifiers.theme}\n`;
                    if (qualifiers.conflict) fullPrompt += `Central Conflict: ${qualifiers.conflict}\n`;
                    if (qualifiers.locations) fullPrompt += `Key Locations: ${qualifiers.locations}\n`;
                    data = await generateCampaignFill(fullPrompt, initialGenerationOptions, isMockMode, campaignContext);
                    break;

                case 'detailed': {
                    setLoadingMessage('Generating from prompts...');
                    const detailedData: BatchAddData = { npcs: [], locations: [], factions: [], adventures: [], items: [] };
                    const validAdventures = detailedPrompts.adventures.filter(adv => adv.prompt.trim() !== '' && adv.scenes.length > 0 && adv.scenes.some(s => s.prompt.trim() !== ''));
                    const totalDetailed =
                        detailedPrompts.npcs.length +
                        detailedPrompts.locations.length +
                        detailedPrompts.factions.length +
                        detailedPrompts.items.length +
                        validAdventures.length;
                    setDetailedProgress({ completed: 0, total: totalDetailed });
                    const trackProgress = <T,>(p: Promise<T>): Promise<T> =>
                        p.then(res => { setDetailedProgress(prev => prev ? { ...prev, completed: prev.completed + 1 } : prev); return res; });

                    const npcPromises = detailedPrompts.npcs.map(p => trackProgress(generateNpc(p.prompt, isMockMode, campaignContext).then(res => ({ ...res, factionId: p.linkId }))));
                    const locationPromises = detailedPrompts.locations.map(p => trackProgress(generateLocation(p.prompt, isMockMode, campaignContext).then(res => ({ ...res, parentLocationId: p.linkId }))));
                    const factionPromises = detailedPrompts.factions.map(p => trackProgress(generateFaction(p.prompt, isMockMode, campaignContext)));
                    const itemPromises = detailedPrompts.items.map(p => trackProgress(generateItem(p.prompt, isMockMode, campaignContext)));
                    const adventurePromises = validAdventures.map(adv => {
                        const scenesDescription = adv.scenes.filter(s => s.prompt.trim() !== '').map(s => `- Scene Prompt: "${s.prompt}"${s.type ? ` (Suggested Type: ${s.type})` : ''}`).join('\n');
                        const fullAdvPrompt = `Based on the following adventure concept, generate a complete adventure outline.\nAdventure Concept: "${adv.prompt}"\n\nThe adventure's structure must be built around the following user-provided scenes. Generate full, detailed scenes based on these prompts:\n${scenesDescription}`;
                        return trackProgress(generateAdventure(fullAdvPrompt, isMockMode, campaignContext));
                    });

                    const [npcsResult, locationsResult, factionsResult, itemsResult, adventuresResult] = await Promise.all([Promise.all(npcPromises), Promise.all(locationPromises), Promise.all(factionPromises), Promise.all(itemPromises), Promise.all(adventurePromises)]);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    detailedData.npcs = npcsResult.map(({ knowsPlayerHistory, ...restOfNpc }: any) => restOfNpc);
                    detailedData.locations = locationsResult;
                    detailedData.factions = factionsResult;
                    detailedData.items = itemsResult;
                    detailedData.adventures = adventuresResult;
                    data = detailedData;
                    break;
                }
                
                case 'ingest':
                    setLoadingMessage('Parsing document...');
                    if (!ingestedText.trim()) { throw new Error("Please provide some text to ingest."); }
                    data = await parseDocumentForEntities(ingestedText, isMockMode, campaignContext);
                    break;
                
                case 'chat':
                     setLoadingMessage('Generating from chat...');
                    if (chatHistory.length === 0) { throw new Error("Please have a conversation with the assistant first."); }
                    const chatTranscript = chatHistory.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n\n');
                    const chatPrompt = `Based on the following conversation transcript, generate a cohesive set of TTRPG world entities. Extract all the NPCs, locations, factions, items, and adventures we discussed.\n\n<Transcript>\n${chatTranscript}\n</Transcript>`;
                    data = await generateCampaignFill(chatPrompt, initialGenerationOptions, isMockMode, campaignContext);
                    break;
            }
            if (data) processGeneratedData(data);

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "An error occurred during generation.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddToCampaign = () => {
        if (!generatedData || !selection) return;

        const finalData: BatchAddData = {
            npcs: generatedData.npcs.filter((_, i) => selection.npcs[i]),
            locations: generatedData.locations.filter((_, i) => selection.locations[i]),
            factions: generatedData.factions.filter((_, i) => selection.factions[i]),
            adventures: generatedData.adventures.filter((_, i) => selection.adventures[i]),
            items: generatedData.items.filter((_, i) => selection.items[i]),
        };
        onAddToCampaign(finalData);
    };

    const handleSelectionChange = (type: keyof SelectionState, index: number, isChecked: boolean) => {
        if (!selection) return;
        setSelection(produce(draft => {
            if (draft) {
                draft[type][index] = isChecked;
            }
        }));
    };

    const handleSelectAll = (type: keyof SelectionState, checked: boolean) => {
        if (!selection) return;
        setSelection(produce(draft => {
            if (draft) {
                draft[type] = draft[type].map(() => checked);
            }
        }));
    };

    const handleUpdateEntity = (type: keyof WizardStateData, index: number, updates: any) => {
        if (!generatedData) return;
        setGeneratedData(produce(generatedData, draft => {
            // @ts-ignore - Index signature access safety is assumed here
            Object.assign(draft[type][index], updates);
        }));
    }
    
    const handleDeleteEntity = (type: keyof WizardStateData, index: number) => {
         if (!generatedData || !selection) return;
         setGeneratedData(produce(generatedData, draft => {
            // @ts-ignore
            draft[type].splice(index, 1);
         }));
         setSelection(produce(selection, draft => {
            if (draft) {
                 draft[type].splice(index, 1);
            }
         }));
         setEditingEntity(null);
    }

    const hasPrompts = 
        (mode === 'simple' && !!simplePrompt.trim()) ||
        (mode === 'detailed' && (
            detailedPrompts.npcs.some(p => p.prompt.trim() !== '') ||
            detailedPrompts.locations.some(p => p.prompt.trim() !== '') ||
            detailedPrompts.factions.some(p => p.prompt.trim() !== '') ||
            detailedPrompts.items.some(p => p.prompt.trim() !== '') ||
            detailedPrompts.adventures.some(a => a.prompt.trim() !== '' && a.scenes.length > 0 && a.scenes.some(s => s.prompt.trim() !== ''))
        )) ||
        (mode === 'ingest' && !!ingestedText.trim()) ||
        (mode === 'chat' && chatHistory.length > 0);
        
    const hasGeneratedData = generatedData && selection;
    
    // Combined lists for dropdowns in editors
    const combinedNpcs = [...campaign.npcs, ...(generatedData?.npcs || [])];
    const combinedLocations = [...campaign.locations, ...(generatedData?.locations || [])];
    const combinedFactions = [...campaign.factions, ...(generatedData?.factions || [])];
    const combinedArticles = [...campaign.articles]; // Articles not generated here yet

    return (
        <DialogShell isOpen={true} onClose={onClose} ariaLabel="Evocation Wizard" className="w-full max-w-5xl mx-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-300 relative">
                <header className="flex items-center justify-between p-4 border-b border-slate-800 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <Icons.Wizard className="w-7 h-7 text-amber-400" />
                        <h2 className="text-xl font-bold font-serif">Evocation Wizard</h2>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <span className={`text-xs font-medium ${useCampaignContext ? 'text-amber-400' : 'text-slate-500'}`}>Use Campaign Context</span>
                            <button onClick={() => setUseCampaignContext(p => !p)} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${useCampaignContext ? 'bg-amber-600' : 'bg-slate-700'}`} role="switch" aria-checked={useCampaignContext}>
                                <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${useCampaignContext ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        <Button variant="icon" onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close Wizard"><Icons.X className="w-5 h-5" /></Button>
                    </div>
                </header>

                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                    {/* --- Left Panel: Controls --- */}
                    <div className="w-full lg:w-1/2 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col">
                        <div className="p-4 border-b border-slate-800">
                            <div className="grid grid-cols-4 gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800/50">
                                <ModeButton label="Simple" icon={Icons.Sparkles} isActive={mode === 'simple'} onClick={() => setMode('simple')} />
                                <ModeButton label="Detailed" icon={Icons.Setting} isActive={mode === 'detailed'} onClick={() => setMode('detailed')} />
                                <ModeButton label="Ingest" icon={Icons.FileText} isActive={mode === 'ingest'} onClick={() => setMode('ingest')} />
                                <ModeButton label="Chat" icon={Icons.Social} isActive={mode === 'chat'} onClick={() => setMode('chat')} />
                            </div>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                            {mode === 'simple' && <SimpleModeView prompt={simplePrompt} onPromptChange={setSimplePrompt} qualifiers={qualifiers} onQualifiersChange={setQualifiers} />}
                            {mode === 'detailed' && <DetailedModeView campaign={campaign} prompts={detailedPrompts} onPromptsChange={setDetailedPrompts} />}
                            {mode === 'ingest' && <IngestModeView text={ingestedText} onTextChange={setIngestedText} fileInputRef={fileInputRef} />}
                            {mode === 'chat' && <ChatModeView history={chatHistory} onHistoryChange={setChatHistory} input={chatInput} onInputChange={setChatInput} campaignContext={useCampaignContext ? buildCampaignContext({ variant: 'generation', campaign }) : undefined} isMockMode={isMockMode} />}
                        </div>
                        <div className="p-4 border-t border-slate-800">
                             {error && <p className="text-xs text-red-400 mb-2 text-center">{error}</p>}
                            <Button onClick={handleGenerate} disabled={isLoading || !hasPrompts} className="w-full" size="lg">
                                {isLoading ? <><Icons.Coach className="w-5 h-5 mr-2 animate-spin" />{loadingMessage}</> : <><Icons.Sparkles className="w-5 h-5 mr-2" />{mode === 'chat' ? 'Generate Entities from Chat' : 'Generate'}</>}
                            </Button>
                        </div>
                    </div>

                    {/* --- Right Panel: Results --- */}
                    <div className="w-full lg:w-1/2 flex flex-col">
                        <div className="p-4 border-b border-slate-800 flex-shrink-0">
                            <h3 className="text-lg font-semibold font-serif text-slate-200">Generated Entities</h3>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                            {isLoading && (
                                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                    <Icons.Wizard className="w-16 h-16 mb-4 animate-pulse" />
                                    <p className="text-lg">The mists of creation swirl...</p>
                                    <p className="text-sm">{loadingMessage}</p>
                                    {detailedProgress && detailedProgress.total > 0 && (
                                        <div className="mt-4 w-48 space-y-2">
                                            <p className="text-xs text-center text-amber-400">
                                                Generating... {detailedProgress.completed} of {detailedProgress.total} complete
                                            </p>
                                            <div className="w-full bg-slate-800 rounded-full h-1.5">
                                                <div
                                                    className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
                                                    style={{ width: `${Math.round((detailedProgress.completed / detailedProgress.total) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {!isLoading && !hasGeneratedData && (
                                <div className="flex flex-col items-center justify-center h-full text-slate-500 text-center px-4">
                                    <Icons.FileCode className="w-16 h-16 mb-4" />
                                    <p>Your generated world entities will appear here once the evocation is complete.</p>
                                </div>
                            )}
                            {hasGeneratedData && (
                                <div className="space-y-4 animate-fade-in">
                                    <ResultsSection title="NPCs" items={generatedData.npcs} selection={selection.npcs} onSelect={(i, c) => handleSelectionChange('npcs', i, c)} onSelectAll={(c) => handleSelectAll('npcs', c)} onEdit={(i) => setEditingEntity({ type: 'npcs', index: i })} />
                                    <ResultsSection title="Locations" items={generatedData.locations} selection={selection.locations} onSelect={(i, c) => handleSelectionChange('locations', i, c)} onSelectAll={(c) => handleSelectAll('locations', c)} onEdit={(i) => setEditingEntity({ type: 'locations', index: i })} />
                                    <ResultsSection title="Factions" items={generatedData.factions} selection={selection.factions} onSelect={(i, c) => handleSelectionChange('factions', i, c)} onSelectAll={(c) => handleSelectAll('factions', c)} onEdit={(i) => setEditingEntity({ type: 'factions', index: i })} />
                                    <ResultsSection title="Items" items={generatedData.items} selection={selection.items} onSelect={(i, c) => handleSelectionChange('items', i, c)} onSelectAll={(c) => handleSelectAll('items', c)} onEdit={(i) => setEditingEntity({ type: 'items', index: i })} />
                                    <ResultsSection title="Adventures" items={generatedData.adventures} selection={selection.adventures} onSelect={(i, c) => handleSelectionChange('adventures', i, c)} onSelectAll={(c) => handleSelectAll('adventures', c)} onEdit={(i) => setEditingEntity({ type: 'adventures', index: i })} />
                                </div>
                            )}
                        </div>
                        {hasGeneratedData && (
                            <div className="p-4 border-t border-slate-800">
                                <Button onClick={handleAddToCampaign} className="w-full" size="lg">
                                    <Icons.Plus className="w-5 h-5 mr-2" />Add Selected to Campaign
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- Editing Modal --- */}
                {editingEntity && generatedData && (
                    <div className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                         <div className="bg-slate-900 border border-slate-700 rounded-xl w-full h-full flex flex-col shadow-2xl relative overflow-hidden">
                             <div className="absolute top-2 right-2 z-10 flex gap-2">
                                <Button size="sm" onClick={() => setEditingEntity(null)} className="bg-green-600 hover:bg-green-500">
                                    <Icons.CheckCircle className="w-4 h-4 mr-2" /> Done
                                </Button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 pt-12">
                                {editingEntity.type === 'npcs' && (
                                    <NpcEditor 
                                        npc={generatedData.npcs[editingEntity.index]} 
                                        factions={combinedFactions}
                                        allNpcs={combinedNpcs}
                                        playerCharacters={campaign.playerCharacters} 
                                        onUpdate={(id, data) => handleUpdateEntity('npcs', editingEntity.index, data)} 
                                        onDelete={() => handleDeleteEntity('npcs', editingEntity.index)} 
                                        isMockMode={isMockMode} 
                                    />
                                )}
                                {editingEntity.type === 'locations' && (
                                    <LocationEditor 
                                        location={generatedData.locations[editingEntity.index]} 
                                        allLocations={combinedLocations}
                                        allFactions={combinedFactions}
                                        onUpdate={(id, data) => handleUpdateEntity('locations', editingEntity.index, data)} 
                                        onDelete={() => handleDeleteEntity('locations', editingEntity.index)} 
                                        isMockMode={isMockMode} 
                                    />
                                )}
                                {editingEntity.type === 'factions' && (
                                    <FactionEditor 
                                        faction={generatedData.factions[editingEntity.index]} 
                                        allNpcs={combinedNpcs}
                                        onUpdate={(id, data) => handleUpdateEntity('factions', editingEntity.index, data)} 
                                        onDelete={() => handleDeleteEntity('factions', editingEntity.index)} 
                                        isMockMode={isMockMode} 
                                    />
                                )}
                                {editingEntity.type === 'items' && (
                                    <ItemEditor 
                                        item={generatedData.items[editingEntity.index]} 
                                        onUpdate={(id, data) => handleUpdateEntity('items', editingEntity.index, data)} 
                                        onDelete={() => handleDeleteEntity('items', editingEntity.index)} 
                                        isMockMode={isMockMode} 
                                    />
                                )}
                                {editingEntity.type === 'adventures' && (
                                    <AdventureEditor 
                                        adventure={generatedData.adventures[editingEntity.index]} 
                                        campaign={campaign}
                                        onUpdate={(id, data) => handleUpdateEntity('adventures', editingEntity.index, data)} 
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DialogShell>
    );
};

// ... Mode Components and Helpers remain unchanged ...
const SimpleModeView = ({ prompt, onPromptChange, qualifiers, onQualifiersChange }) => (
    <div className="space-y-4">
        <h3 className="text-lg font-semibold font-serif">Simple Generation</h3>
        <p className="text-sm text-slate-400">Provide a central theme or idea. The AI will generate a cohesive set of entities to flesh out your world based on this concept.</p>
        <textarea value={prompt} onChange={(e) => onPromptChange(e.target.value)} placeholder="e.g., A floating city powered by a trapped storm elemental." rows={4} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 outline-none resize-y" />
        <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Optional Qualifiers</label>
            <div className="space-y-2">
                <input type="text" value={qualifiers.theme} onChange={e => onQualifiersChange(p => ({...p, theme: e.target.value}))} placeholder="Theme/Genre (e.g., Political Intrigue, Cosmic Horror)" className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 text-sm placeholder:text-slate-600 focus:ring-1 focus:ring-amber-500 outline-none" />
                <input type="text" value={qualifiers.conflict} onChange={e => onQualifiersChange(p => ({...p, conflict: e.target.value}))} placeholder="Central Conflict (e.g., A brewing civil war)" className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 text-sm placeholder:text-slate-600 focus:ring-1 focus:ring-amber-500 outline-none" />
                <input type="text" value={qualifiers.locations} onChange={e => onQualifiersChange(p => ({...p, locations: e.target.value}))} placeholder="Key Locations (e.g., The Obsidian Spire, Sunken Market)" className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 text-sm placeholder:text-slate-600 focus:ring-1 focus:ring-amber-500 outline-none" />
            </div>
        </div>
    </div>
);

const DetailedModeView = ({ campaign, prompts, onPromptsChange }) => {
    // --- Detailed Prompt Handlers ---
    // FIX: Explicitly type the `draft` object in `produce` callbacks to resolve type inference issues. This fixes errors and removes the need for type casting.
    const handleAddSimplePrompt = (type: EntityType) => onPromptsChange(produce((draft: DetailedPrompts) => { draft[type].push({ id: crypto.randomUUID(), prompt: '' }); }));
    const handleRemoveSimplePrompt = (type: EntityType, id: string) => onPromptsChange(produce((draft: DetailedPrompts) => {
        const items = draft[type];
        const index = items.findIndex(p => p.id === id);
        if (index > -1) {
            items.splice(index, 1);
        }
    }));
    const handleSimplePromptChange = (type: EntityType, id: string, prompt: string, linkId?: string) => {
        onPromptsChange(produce((draft: DetailedPrompts) => {
            const item = draft[type].find(p => p.id === id);
            if (item) {
                item.prompt = prompt;
                if (linkId !== undefined) {
                    item.linkId = linkId || undefined;
                }
            }
        }));
    };
    const handleAddAdventure = () => onPromptsChange(produce((draft: DetailedPrompts) => { draft.adventures.push({ id: crypto.randomUUID(), prompt: '', scenes: [{ id: crypto.randomUUID(), prompt: '' }] }); }));
    const handleRemoveAdventure = (id: string) => onPromptsChange(produce((draft: DetailedPrompts) => { draft.adventures = draft.adventures.filter(a => a.id !== id); }));
    const handleAdventureChange = (id: string, prompt: string) => onPromptsChange(produce((draft: DetailedPrompts) => { const adv = draft.adventures.find(a => a.id === id); if(adv) adv.prompt = prompt; }));
    const handleAddScene = (adventureId: string) => onPromptsChange(produce((draft: DetailedPrompts) => { const adv = draft.adventures.find(a => a.id === adventureId); if(adv) adv.scenes.push({ id: crypto.randomUUID(), prompt: '' }); }));
    const handleRemoveScene = (adventureId: string, sceneId: string) => onPromptsChange(produce((draft: DetailedPrompts) => { const adv = draft.adventures.find(a => a.id === adventureId); if(adv) adv.scenes = adv.scenes.filter(s => s.id !== sceneId); }));
    const handleSceneChange = (adventureId: string, sceneId: string, prompt: string, type: SceneType | 'none') => {
        onPromptsChange(produce((draft: DetailedPrompts) => {
            const adv = draft.adventures.find(a => a.id === adventureId);
            if(adv) { const scene = adv.scenes.find(s => s.id === sceneId); if(scene) { scene.prompt = prompt; scene.type = type === 'none' ? undefined : type; } }
        }));
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold font-serif">Detailed Generation</h3>
            <p className="text-sm text-slate-400">Add specific prompts for each entity you want to create. You can link new NPCs to existing factions and new locations to parent locations.</p>
            <SimpleDetailedSection title="NPCs" items={prompts.npcs} onAdd={() => handleAddSimplePrompt('npcs')} onRemove={(id) => handleRemoveSimplePrompt('npcs', id)} onChange={(id, p, l) => handleSimplePromptChange('npcs', id, p, l)} linkOptions={campaign.factions.map(f => ({ value: f.id, label: f.name }))} linkNoun="Faction" />
            <SimpleDetailedSection title="Locations" items={prompts.locations} onAdd={() => handleAddSimplePrompt('locations')} onRemove={(id) => handleRemoveSimplePrompt('locations', id)} onChange={(id, p, l) => handleSimplePromptChange('locations', id, p, l)} linkOptions={campaign.locations.map(l => ({ value: l.id, label: l.name }))} linkNoun="Parent" />
            <SimpleDetailedSection title="Factions" items={prompts.factions} onAdd={() => handleAddSimplePrompt('factions')} onRemove={(id) => handleRemoveSimplePrompt('factions', id)} onChange={(id, p) => handleSimplePromptChange('factions', id, p)} />
            <SimpleDetailedSection title="Items" items={prompts.items} onAdd={() => handleAddSimplePrompt('items')} onRemove={(id) => handleRemoveSimplePrompt('items', id)} onChange={(id, p) => handleSimplePromptChange('items', id, p)} />
            <AdventureDetailedSection items={prompts.adventures} onAdd={handleAddAdventure} onRemove={handleRemoveAdventure} onChange={handleAdventureChange} onAddScene={handleAddScene} onRemoveScene={handleRemoveScene} onSceneChange={handleSceneChange} />
        </div>
    );
};

const IngestModeView = ({ text, onTextChange, fileInputRef }) => {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => onTextChange(event.target?.result as string);
            reader.readAsText(file);
        }
    };
    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold font-serif">Ingest Document</h3>
            <p className="text-sm text-slate-400">Paste your existing campaign notes or upload a text file (.txt, .md, .json). The AI will read the document and extract any recognizable entities like NPCs, locations, and adventures.</p>
            <textarea value={text} onChange={(e) => onTextChange(e.target.value)} placeholder="Paste your campaign notes here..." rows={12} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 outline-none resize-y" />
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".txt,.md,.json" className="hidden" />
            <Button onClick={() => fileInputRef.current?.click()} variant="secondary" className="w-full"><Icons.FileUp className="w-4 h-4 mr-2" />Upload File</Button>
        </div>
    );
};

const ChatModeView = ({ history, onHistoryChange, input, onInputChange, campaignContext, isMockMode }) => {
    const [isChatting, setIsChatting] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);
    
    const handleSendChat = async () => {
        if (!input.trim()) return;
        const newUserMessage: ChatMessage = { role: 'user', text: input };
        const newHistory = [...history, newUserMessage];
        onHistoryChange(newHistory);
        onInputChange('');
        setIsChatting(true);
        try {
            const response = await generateChatResponse(newHistory, campaignContext, isMockMode);
            onHistoryChange(prev => [...prev, { role: 'model', text: response }]);
        } catch (e) {
            onHistoryChange(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error. Please try again." }]);
        } finally {
            setIsChatting(false);
        }
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            <h3 className="text-lg font-semibold font-serif">Chat Assistant</h3>
            <p className="text-sm text-slate-400">Describe your ideas conversationally. The assistant will help you brainstorm and develop them. When you're ready, click "Generate Entities from Chat" below.</p>
            <div className="flex-1 bg-slate-950 border border-slate-700 rounded-md p-2 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                {history.map((msg, index) => (
                    <div key={index} className={twMerge("p-3 rounded-lg max-w-[85%] w-fit", msg.role === 'user' ? 'bg-amber-600 self-end' : 'bg-slate-700 self-start')}>
                        <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    </div>
                ))}
                {isChatting && <div className="bg-slate-700 self-start p-3 rounded-lg"><Icons.Sparkles className="w-5 h-5 animate-pulse" /></div>}
                <div ref={chatEndRef} />
            </div>
            <div className="flex items-center gap-2">
                <input type="text" value={input} onChange={e => onInputChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendChat()} disabled={isChatting} placeholder="Let's create a mysterious forest..." className="flex-grow bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 outline-none" />
                <Button onClick={handleSendChat} disabled={isChatting || !input.trim()}><Icons.Plus className="w-4 h-4" /> Send</Button>
            </div>
        </div>
    )
}


const ModeButton = ({ label, icon: Icon, isActive, onClick }: { label: string; icon: React.ElementType, isActive: boolean; onClick: () => void; }) => (
    <button onClick={onClick} className={twMerge('flex items-center justify-center gap-2 w-full px-3 py-2 text-sm font-semibold rounded-md transition-colors', isActive ? 'bg-amber-600 text-white' : 'text-slate-300 hover:bg-slate-800')}>
        <Icon className="w-4 h-4" />
        {label}
    </button>
);

interface SimpleDetailedSectionProps {
    title: string;
    items: SimpleDetailedPrompt[];
    onAdd: () => void;
    onRemove: (id: string) => void;
    onChange: (id: string, prompt: string, linkId?: string) => void;
    linkOptions?: { value: string; label: string }[];
    linkNoun?: string;
}

const SimpleDetailedSection: React.FC<SimpleDetailedSectionProps> = ({ title, items, onAdd, onRemove, onChange, linkOptions, linkNoun }) => {
    const [isExpanded, setIsExpanded] = useState(items.length > 0);
    return (
        <div className="bg-slate-950/50 border border-slate-800 rounded-lg">
            <button onClick={() => setIsExpanded(p => !p)} className="w-full flex items-center justify-between p-3 text-left">
                <h4 className="font-semibold text-slate-200">{title}</h4>
                <div className="flex items-center gap-2">
                    {items.length > 0 && <span className="text-xs bg-slate-700 text-slate-300 rounded-full px-2 py-0.5">{items.length}</span>}
                    <Icons.ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                </div>
            </button>
            {isExpanded && (
                <div className="p-3 border-t border-slate-800 space-y-2">
                    {items.map(p => (
                        <div key={p.id} className="bg-slate-800/50 p-2 rounded-md space-y-1.5">
                            <div className="flex items-start gap-2">
                                <textarea value={p.prompt} onChange={(e) => onChange(p.id, e.target.value)} placeholder={`Prompt for new ${title.slice(0, -1)}...`} rows={2} className="flex-grow bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-sm resize-y outline-none focus:ring-1 focus:ring-amber-500" />
                                <Button variant="icon" onClick={() => onRemove(p.id)} className="text-slate-500 hover:text-red-400 mt-1"><Icons.Trash className="w-4 h-4" /></Button>
                            </div>
                            {linkOptions && linkNoun && (
                                <div className="flex items-center gap-2">
                                    <Icons.Link className="w-3 h-3 text-slate-400" />
                                    <select value={p.linkId || 'none'} onChange={(e) => onChange(p.id, p.prompt, e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-500">
                                        <option value="none">-- Link to {linkNoun} (Optional) --</option>
                                        {linkOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    ))}
                    <Button onClick={onAdd} variant="secondary" size="sm" className="w-full"><Icons.Plus className="w-3.5 h-3.5 mr-1.5" />Add {title.slice(0, -1)}</Button>
                </div>
            )}
        </div>
    );
};

// --- New Components for Adventure Detailed View ---
const sceneTypeOptions: SceneType[] = ['combat', 'social', 'exploration', 'puzzle'];

const ScenePromptItem: React.FC<{
    scene: SceneDetailedPrompt;
    onRemove: () => void;
    onChange: (prompt: string, type: SceneType | 'none') => void;
}> = ({ scene, onRemove, onChange }) => {
    return (
        <div className="bg-slate-800/50 p-2 rounded-md space-y-1.5">
            <div className="flex items-start gap-2">
                <textarea value={scene.prompt} onChange={(e) => onChange(e.target.value, scene.type || 'none')} placeholder="Scene prompt..." rows={2} className="flex-grow bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-sm resize-y outline-none focus:ring-1 focus:ring-amber-500" />
                <Button variant="icon" onClick={onRemove} className="text-slate-500 hover:text-red-400 mt-1"><Icons.Trash className="w-4 h-4" /></Button>
            </div>
            <div className="flex items-center gap-2">
                <select value={scene.type || 'none'} onChange={(e) => onChange(scene.prompt, e.target.value as SceneType | 'none')} className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-500">
                    <option value="none">-- Scene Type (Optional) --</option>
                    {sceneTypeOptions.map(opt => <option key={opt} value={opt} className="capitalize">{opt}</option>)}
                </select>
            </div>
        </div>
    );
};

interface AdventureDetailedSectionProps {
    items: AdventureDetailedPrompt[];
    onAdd: () => void;
    onRemove: (id: string) => void;
    onChange: (id: string, prompt: string) => void;
    onAddScene: (adventureId: string) => void;
    onRemoveScene: (adventureId: string, sceneId: string) => void;
    onSceneChange: (adventureId: string, sceneId: string, prompt: string, type: SceneType | 'none') => void;
}

const AdventureDetailedSection: React.FC<AdventureDetailedSectionProps> = ({ items, onAdd, onRemove, onChange, onAddScene, onRemoveScene, onSceneChange }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const title = "Adventures";
    return (
        <div className="bg-slate-950/50 border border-slate-800 rounded-lg">
            <button onClick={() => setIsExpanded(p => !p)} className="w-full flex items-center justify-between p-3 text-left">
                <h4 className="font-semibold text-slate-200">{title}</h4>
                <div className="flex items-center gap-2">
                    {items.length > 0 && <span className="text-xs bg-slate-700 text-slate-300 rounded-full px-2 py-0.5">{items.length}</span>}
                    <Icons.ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                </div>
            </button>
            {isExpanded && (
                <div className="p-3 border-t border-slate-800 space-y-2">
                    {items.map(adventure => (
                        <div key={adventure.id} className="bg-slate-800/50 p-2 rounded-md space-y-2 border border-slate-700/50">
                            <div className="flex items-start gap-2">
                                <textarea value={adventure.prompt} onChange={(e) => onChange(adventure.id, e.target.value)} placeholder="Adventure concept prompt..." rows={2} className="flex-grow bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-sm resize-y outline-none focus:ring-1 focus:ring-amber-500" />
                                <Button variant="icon" onClick={() => onRemove(adventure.id)} className="text-slate-500 hover:text-red-400 mt-1"><Icons.Trash className="w-4 h-4" /></Button>
                            </div>
                            <div className="pl-4 border-l-2 border-slate-700 ml-2 space-y-2 pt-2">
                                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scenes</h5>
                                {adventure.scenes.length === 0 && <p className="text-xs text-amber-400 bg-amber-950 border border-amber-500/20 p-2 rounded-md">At least one scene is required for the adventure.</p>}
                                {adventure.scenes.map(scene => (
                                    <ScenePromptItem
                                        key={scene.id}
                                        scene={scene}
                                        onRemove={() => onRemoveScene(adventure.id, scene.id)}
                                        onChange={(prompt, type) => onSceneChange(adventure.id, scene.id, prompt, type)}
                                    />
                                ))}
                                <Button onClick={() => onAddScene(adventure.id)} variant="ghost" size="sm" className="w-full"><Icons.Plus className="w-3.5 h-3.5 mr-1.5" />Add Scene</Button>
                            </div>
                        </div>
                    ))}
                    <Button onClick={onAdd} variant="secondary" size="sm" className="w-full"><Icons.Plus className="w-3.5 h-3.5 mr-1.5" />Add Adventure</Button>
                </div>
            )}
        </div>
    );
};


interface ResultsSectionProps {
    title: string;
    items: { name?: string, title?: string }[];
    selection: boolean[];
    onSelect: (index: number, isChecked: boolean) => void;
    onSelectAll: (checked: boolean) => void;
    onEdit: (index: number) => void;
}
const ResultsSection: React.FC<ResultsSectionProps> = ({ title, items, selection, onSelect, onSelectAll, onEdit }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    if (items.length === 0) return null;
    const selectedCount = selection.filter(Boolean).length;
    const allSelected = selectedCount === items.length;
    return (
        <div>
            <button onClick={() => setIsExpanded(p => !p)} className="w-full flex items-center justify-between p-2 text-left bg-slate-800/50 rounded-t-md">
                <h4 className="font-semibold text-slate-200">{title}</h4>
                <div className="flex items-center gap-2">
                    <span className="text-xs bg-slate-700 text-slate-300 rounded-full px-2 py-0.5">{selectedCount}/{items.length}</span>
                    <Icons.ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                </div>
            </button>
            {isExpanded && (
                <div className="bg-slate-950/30 border border-t-0 border-slate-800/50 rounded-b-md p-2 space-y-1">
                    {/* Select all / Deselect all toggle */}
                    <div className="flex justify-end pb-1 border-b border-slate-800/60 mb-1">
                        <button
                            type="button"
                            onClick={() => onSelectAll(!allSelected)}
                            className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                        >
                            {allSelected ? 'Deselect all' : 'Select all'}
                        </button>
                    </div>
                    {items.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-1.5 rounded-md hover:bg-slate-800/50 transition-colors group">
                            <label className="flex items-center text-sm text-slate-300 select-none flex-grow cursor-pointer">
                                <input type="checkbox" checked={selection[index]} onChange={(e) => onSelect(index, e.target.checked)} className="w-4 h-4 mr-3 bg-slate-800 border-slate-600 rounded text-amber-600 focus:ring-amber-500" />
                                <span className="truncate" title={item.name || item.title}>{item.name || item.title}</span>
                            </label>
                             <Button variant="icon" onClick={() => onEdit(index)} className="text-slate-500 hover:text-white opacity-100 md:opacity-0 md:group-hover:opacity-100" aria-label="Edit">
                                <Icons.FileText className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
