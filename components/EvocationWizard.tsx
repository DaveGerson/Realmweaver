import React, { useState } from 'react';
import type { Campaign, SceneType } from '../types';
import type { BatchAddData } from '../types';
import { generateCampaignFill, generateNpc, generateLocation, generateFaction, generateItem, generateAdventure } from '../services/geminiService';
import { Icons } from './Icons';
import { Button } from './common/Button';
import { twMerge } from 'tailwind-merge';
import { produce } from 'immer';

interface EvocationWizardProps {
  campaign: Campaign;
  onClose: () => void;
  onAddToCampaign: (data: BatchAddData) => void;
  isMockMode: boolean;
}

type Mode = 'simple' | 'detailed';
type EntityType = 'npcs' | 'locations' | 'factions' | 'items'; // Adventures handled separately now

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

const serializeCampaign = (campaign: Campaign): string => {
    let context = `Title: ${campaign.title}\nSetting: ${campaign.setting}\n`;
    if (campaign.npcs.length > 0) context += `NPCs: ${campaign.npcs.map(e => e.name).join(', ')}\n`;
    if (campaign.locations.length > 0) context += `Locations: ${campaign.locations.map(e => e.name).join(', ')}\n`;
    if (campaign.factions.length > 0) context += `Factions: ${campaign.factions.map(e => e.name).join(', ')}\n`;
    if (campaign.items.length > 0) context += `Items: ${campaign.items.map(e => e.name).join(', ')}\n`;
    if (campaign.adventures.length > 0) context += `Adventures: ${campaign.adventures.map(e => e.title).join(', ')}\n`;
    return context;
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

    // Simple Mode State
    const [simplePrompt, setSimplePrompt] = useState('');
    const [qualifiers, setQualifiers] = useState({ theme: '', conflict: '', locations: '' });

    // Detailed Mode State
    const [detailedPrompts, setDetailedPrompts] = useState<DetailedPrompts>(initialDetailedPrompts);

    // Generation State
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedData, setGeneratedData] = useState<BatchAddData | null>(null);
    const [selection, setSelection] = useState<SelectionState | null>(null);

    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);
        setGeneratedData(null);
        setSelection(null);

        const campaignContext = useCampaignContext ? serializeCampaign(campaign) : undefined;

        try {
            if (mode === 'simple') {
                if (!simplePrompt.trim()) {
                    setError("Please enter a theme for your campaign.");
                    setIsLoading(false);
                    return;
                }
                let fullPrompt = `Theme: ${simplePrompt}\n`;
                if (qualifiers.theme) fullPrompt += `Genre/Specific Themes: ${qualifiers.theme}\n`;
                if (qualifiers.conflict) fullPrompt += `Central Conflict: ${qualifiers.conflict}\n`;
                if (qualifiers.locations) fullPrompt += `Key Locations: ${qualifiers.locations}\n`;

                const data = await generateCampaignFill(fullPrompt, initialGenerationOptions, isMockMode, campaignContext);
                setGeneratedData(data);
                setSelection({
                    npcs: Array(data.npcs.length).fill(true),
                    locations: Array(data.locations.length).fill(true),
                    factions: Array(data.factions.length).fill(true),
                    adventures: Array(data.adventures.length).fill(true),
                    items: Array(data.items.length).fill(true),
                });
            } else { // Detailed Mode
                const data: BatchAddData = { npcs: [], locations: [], factions: [], adventures: [], items: [] };
                
                const npcPromises = detailedPrompts.npcs.map(p => 
                    generateNpc(p.prompt, false, isMockMode, campaignContext).then(res => ({ ...res, factionId: p.linkId }))
                );
                const locationPromises = detailedPrompts.locations.map(p => 
                    generateLocation(p.prompt, isMockMode, campaignContext).then(res => ({ ...res, parentLocationId: p.linkId }))
                );
                const factionPromises = detailedPrompts.factions.map(p => generateFaction(p.prompt, isMockMode, campaignContext));
                const itemPromises = detailedPrompts.items.map(p => generateItem(p.prompt, isMockMode, campaignContext));
                
                const adventurePromises = detailedPrompts.adventures
                    .filter(adv => adv.prompt.trim() !== '' && adv.scenes.length > 0 && adv.scenes.some(s => s.prompt.trim() !== ''))
                    .map(adv => {
                        const scenesDescription = adv.scenes
                            .filter(s => s.prompt.trim() !== '')
                            .map(s => `- Scene Prompt: "${s.prompt}"${s.type ? ` (Suggested Type: ${s.type})` : ''}`)
                            .join('\n');
                        
                        const fullPrompt = `Based on the following adventure concept, generate a complete adventure outline.
Adventure Concept: "${adv.prompt}"

The adventure's structure must be built around the following user-provided scenes. Generate full, detailed scenes based on these prompts:
${scenesDescription}
`;
                        
                        return generateAdventure(fullPrompt, isMockMode, campaignContext);
                    });


                const [
                    npcsResult,
                    locationsResult,
                    factionsResult,
                    itemsResult,
                    adventuresResult
                ] = await Promise.all([
                    Promise.all(npcPromises),
                    Promise.all(locationPromises),
                    Promise.all(factionPromises),
                    Promise.all(itemPromises),
                    Promise.all(adventurePromises)
                ]);
                
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data.npcs = npcsResult.map(({ knowsPlayerHistory, ...restOfNpc }: any) => restOfNpc);
                data.locations = locationsResult;
                data.factions = factionsResult;
                data.items = itemsResult;
                data.adventures = adventuresResult;
                
                setGeneratedData(data);
                setSelection({
                    npcs: Array(data.npcs.length).fill(true),
                    locations: Array(data.locations.length).fill(true),
                    factions: Array(data.factions.length).fill(true),
                    adventures: Array(data.adventures.length).fill(true),
                    items: Array(data.items.length).fill(true),
                });
            }
        } catch (err) {
            console.error(err);
            setError("An error occurred during generation. Please try again.");
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

    // --- Detailed Prompt Handlers ---
    const handleAddSimplePrompt = (type: EntityType) => {
        setDetailedPrompts(produce(draft => {
            draft[type].push({ id: crypto.randomUUID(), prompt: '' });
        }));
    };

    const handleRemoveSimplePrompt = (type: EntityType, id: string) => {
        setDetailedPrompts(produce(draft => {
            draft[type] = draft[type].filter(p => p.id !== id) as any;
        }));
    };

    const handleSimplePromptChange = (type: EntityType, id: string, prompt: string, linkId?: string) => {
        setDetailedPrompts(produce(draft => {
            const item = draft[type].find(p => p.id === id);
            if (item) {
                item.prompt = prompt;
                if (linkId !== undefined) {
                    item.linkId = linkId || undefined;
                }
            }
        }));
    };

    const handleAddAdventure = () => {
        setDetailedPrompts(produce(draft => {
            draft.adventures.push({
                id: crypto.randomUUID(),
                prompt: '',
                scenes: [{ id: crypto.randomUUID(), prompt: '' }]
            });
        }));
    };

    const handleRemoveAdventure = (id: string) => {
        setDetailedPrompts(produce(draft => {
            draft.adventures = draft.adventures.filter(a => a.id !== id);
        }));
    };

    const handleAdventureChange = (id: string, prompt: string) => {
        setDetailedPrompts(produce(draft => {
            const adventure = draft.adventures.find(a => a.id === id);
            if (adventure) adventure.prompt = prompt;
        }));
    };

    const handleAddScene = (adventureId: string) => {
        setDetailedPrompts(produce(draft => {
            const adventure = draft.adventures.find(a => a.id === adventureId);
            if (adventure) adventure.scenes.push({ id: crypto.randomUUID(), prompt: '' });
        }));
    };

    const handleRemoveScene = (adventureId: string, sceneId: string) => {
        setDetailedPrompts(produce(draft => {
            const adventure = draft.adventures.find(a => a.id === adventureId);
            if (adventure) adventure.scenes = adventure.scenes.filter(s => s.id !== sceneId);
        }));
    };
    
    const handleSceneChange = (adventureId: string, sceneId: string, prompt: string, type: SceneType | 'none') => {
        setDetailedPrompts(produce(draft => {
            const adventure = draft.adventures.find(a => a.id === adventureId);
            if (adventure) {
                const scene = adventure.scenes.find(s => s.id === sceneId);
                if (scene) {
                    scene.prompt = prompt;
                    scene.type = type === 'none' ? undefined : type;
                }
            }
        }));
    };
    
    const hasSimplePrompts = !!simplePrompt.trim();
    const hasDetailedPrompts = 
        detailedPrompts.npcs.some(p => p.prompt.trim() !== '') ||
        detailedPrompts.locations.some(p => p.prompt.trim() !== '') ||
        detailedPrompts.factions.some(p => p.prompt.trim() !== '') ||
        detailedPrompts.items.some(p => p.prompt.trim() !== '') ||
        detailedPrompts.adventures.some(a => a.prompt.trim() !== '' && a.scenes.length > 0 && a.scenes.some(s => s.prompt.trim() !== ''));
    const hasPrompts = mode === 'simple' ? hasSimplePrompts : hasDetailedPrompts;

    const hasGeneratedData = generatedData && selection;

    return (
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-20 flex items-center justify-center p-4" aria-modal="true" role="dialog">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-300">
                <header className="flex items-center justify-between p-4 border-b border-slate-800 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <Icons.Wizard className="w-7 h-7 text-indigo-400" />
                        <h2 className="text-xl font-bold font-serif">Evocation Wizard</h2>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <span className={`text-xs font-medium ${useCampaignContext ? 'text-indigo-400' : 'text-slate-500'}`}>Use Campaign Context</span>
                            <button onClick={() => setUseCampaignContext(p => !p)} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${useCampaignContext ? 'bg-indigo-600' : 'bg-slate-700'}`} role="switch" aria-checked={useCampaignContext}>
                                <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${useCampaignContext ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors" aria-label="Close Wizard"><Icons.X className="w-5 h-5" /></button>
                    </div>
                </header>

                <div className="flex-1 flex overflow-hidden">
                    {/* --- Left Panel: Controls --- */}
                    <div className="w-1/2 border-r border-slate-800 flex flex-col">
                        <div className="p-4 border-b border-slate-800">
                            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800/50">
                                <ModeButton label="Simple Mode" isActive={mode === 'simple'} onClick={() => setMode('simple')} />
                                <ModeButton label="Detailed Mode" isActive={mode === 'detailed'} onClick={() => setMode('detailed')} />
                            </div>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6">
                            {mode === 'simple' ? (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold font-serif">Simple Generation</h3>
                                    <p className="text-sm text-slate-400">Provide a central theme or idea. The AI will generate a cohesive set of entities to flesh out your world based on this concept.</p>
                                    <textarea value={simplePrompt} onChange={(e) => setSimplePrompt(e.target.value)} placeholder="e.g., A floating city powered by a trapped storm elemental." rows={4} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none resize-y" />
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Optional Qualifiers</label>
                                        <div className="space-y-2">
                                            <input type="text" value={qualifiers.theme} onChange={e => setQualifiers(p => ({...p, theme: e.target.value}))} placeholder="Theme/Genre (e.g., Political Intrigue, Cosmic Horror)" className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 text-sm placeholder:text-slate-600 focus:ring-1 focus:ring-indigo-500 outline-none" />
                                            <input type="text" value={qualifiers.conflict} onChange={e => setQualifiers(p => ({...p, conflict: e.target.value}))} placeholder="Central Conflict (e.g., A brewing civil war)" className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 text-sm placeholder:text-slate-600 focus:ring-1 focus:ring-indigo-500 outline-none" />
                                            <input type="text" value={qualifiers.locations} onChange={e => setQualifiers(p => ({...p, locations: e.target.value}))} placeholder="Key Locations (e.g., The Obsidian Spire, Sunken Market)" className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 text-sm placeholder:text-slate-600 focus:ring-1 focus:ring-indigo-500 outline-none" />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold font-serif">Detailed Generation</h3>
                                    <p className="text-sm text-slate-400">Add specific prompts for each entity you want to create. You can link new NPCs to existing factions and new locations to parent locations.</p>
                                    <SimpleDetailedSection title="NPCs" items={detailedPrompts.npcs} onAdd={() => handleAddSimplePrompt('npcs')} onRemove={(id) => handleRemoveSimplePrompt('npcs', id)} onChange={(id, p, l) => handleSimplePromptChange('npcs', id, p, l)} linkOptions={campaign.factions.map(f => ({ value: f.id, label: f.name }))} linkNoun="Faction" />
                                    <SimpleDetailedSection title="Locations" items={detailedPrompts.locations} onAdd={() => handleAddSimplePrompt('locations')} onRemove={(id) => handleRemoveSimplePrompt('locations', id)} onChange={(id, p, l) => handleSimplePromptChange('locations', id, p, l)} linkOptions={campaign.locations.map(l => ({ value: l.id, label: l.name }))} linkNoun="Parent" />
                                    <SimpleDetailedSection title="Factions" items={detailedPrompts.factions} onAdd={() => handleAddSimplePrompt('factions')} onRemove={(id) => handleRemoveSimplePrompt('factions', id)} onChange={(id, p) => handleSimplePromptChange('factions', id, p)} />
                                    <SimpleDetailedSection title="Items" items={detailedPrompts.items} onAdd={() => handleAddSimplePrompt('items')} onRemove={(id) => handleRemoveSimplePrompt('items', id)} onChange={(id, p) => handleSimplePromptChange('items', id, p)} />
                                    <AdventureDetailedSection items={detailedPrompts.adventures} onAdd={handleAddAdventure} onRemove={handleRemoveAdventure} onChange={handleAdventureChange} onAddScene={handleAddScene} onRemoveScene={handleRemoveScene} onSceneChange={handleSceneChange} />
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-800">
                             {error && <p className="text-xs text-red-400 mb-2 text-center">{error}</p>}
                            <Button onClick={handleGenerate} disabled={isLoading || !hasPrompts} className="w-full" size="lg">
                                {isLoading ? <><Icons.Coach className="w-5 h-5 mr-2 animate-spin" />Evoking...</> : <><Icons.Sparkles className="w-5 h-5 mr-2" />Generate</>}
                            </Button>
                        </div>
                    </div>

                    {/* --- Right Panel: Results --- */}
                    <div className="w-1/2 flex flex-col">
                        <div className="p-4 border-b border-slate-800 flex-shrink-0">
                            <h3 className="text-lg font-semibold font-serif text-slate-200">Generated Entities</h3>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                            {isLoading && (
                                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                    <Icons.Wizard className="w-16 h-16 mb-4 animate-pulse" />
                                    <p className="text-lg">The mists of creation swirl...</p>
                                    <p className="text-sm">Please wait while the entities are being generated.</p>
                                </div>
                            )}
                            {!isLoading && !hasGeneratedData && (
                                <div className="flex flex-col items-center justify-center h-full text-slate-500 text-center px-4">
                                    <Icons.FileCode className="w-16 h-16 mb-4" />
                                    <p>Your generated world entities will appear here once the evocation is complete.</p>
                                </div>
                            )}
                            {hasGeneratedData && (
                                <div className="space-y-4 animate-in fade-in duration-300">
                                    <ResultsSection title="NPCs" items={generatedData.npcs.map(i => i.name)} selection={selection.npcs} onSelect={(i, c) => handleSelectionChange('npcs', i, c)} />
                                    <ResultsSection title="Locations" items={generatedData.locations.map(i => i.name)} selection={selection.locations} onSelect={(i, c) => handleSelectionChange('locations', i, c)} />
                                    <ResultsSection title="Factions" items={generatedData.factions.map(i => i.name)} selection={selection.factions} onSelect={(i, c) => handleSelectionChange('factions', i, c)} />
                                    <ResultsSection title="Items" items={generatedData.items.map(i => i.name)} selection={selection.items} onSelect={(i, c) => handleSelectionChange('items', i, c)} />
                                    <ResultsSection title="Adventures" items={generatedData.adventures.map(i => i.title)} selection={selection.adventures} onSelect={(i, c) => handleSelectionChange('adventures', i, c)} />
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
            </div>
        </div>
    );
};


const ModeButton = ({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void; }) => (
    <button onClick={onClick} className={twMerge('w-full px-3 py-2 text-sm font-semibold rounded-md transition-colors', isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800')}>
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
                                <textarea value={p.prompt} onChange={(e) => onChange(p.id, e.target.value)} placeholder={`Prompt for new ${title.slice(0, -1)}...`} rows={2} className="flex-grow bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-sm resize-y outline-none focus:ring-1 focus:ring-indigo-500" />
                                <button onClick={() => onRemove(p.id)} className="p-1 text-slate-500 hover:text-red-400 transition-colors mt-1"><Icons.Trash className="w-4 h-4" /></button>
                            </div>
                            {linkOptions && linkNoun && (
                                <div className="flex items-center gap-2">
                                    <Icons.Link className="w-3 h-3 text-slate-400" />
                                    <select value={p.linkId || 'none'} onChange={(e) => onChange(p.id, p.prompt, e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500">
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
                <textarea value={scene.prompt} onChange={(e) => onChange(e.target.value, scene.type || 'none')} placeholder="Scene prompt..." rows={2} className="flex-grow bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-sm resize-y outline-none focus:ring-1 focus:ring-indigo-500" />
                <button onClick={onRemove} className="p-1 text-slate-500 hover:text-red-400 transition-colors mt-1"><Icons.Trash className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-2">
                <select value={scene.type || 'none'} onChange={(e) => onChange(scene.prompt, e.target.value as SceneType | 'none')} className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500">
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
                                <textarea value={adventure.prompt} onChange={(e) => onChange(adventure.id, e.target.value)} placeholder="Adventure concept prompt..." rows={2} className="flex-grow bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-sm resize-y outline-none focus:ring-1 focus:ring-indigo-500" />
                                <button onClick={() => onRemove(adventure.id)} className="p-1 text-slate-500 hover:text-red-400 transition-colors mt-1"><Icons.Trash className="w-4 h-4" /></button>
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
    items: string[];
    selection: boolean[];
    onSelect: (index: number, isChecked: boolean) => void;
}
const ResultsSection: React.FC<ResultsSectionProps> = ({ title, items, selection, onSelect }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    if (items.length === 0) return null;
    return (
        <div>
            <button onClick={() => setIsExpanded(p => !p)} className="w-full flex items-center justify-between p-2 text-left bg-slate-800/50 rounded-t-md">
                <h4 className="font-semibold text-slate-200">{title}</h4>
                <div className="flex items-center gap-2">
                    <span className="text-xs bg-slate-700 text-slate-300 rounded-full px-2 py-0.5">{selection.filter(Boolean).length}/{items.length}</span>
                    <Icons.ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                </div>
            </button>
            {isExpanded && (
                <div className="bg-slate-950/30 border border-t-0 border-slate-800/50 rounded-b-md p-2 space-y-1">
                    {items.map((item, index) => (
                        <label key={index} className="flex items-center text-sm text-slate-300 select-none p-1.5 rounded-md hover:bg-slate-800/50 transition-colors">
                            <input type="checkbox" checked={selection[index]} onChange={(e) => onSelect(index, e.target.checked)} className="w-4 h-4 mr-3 bg-slate-800 border-slate-600 rounded text-indigo-600 focus:ring-indigo-500" />
                            <span className="truncate" title={item}>{item}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    )
}
