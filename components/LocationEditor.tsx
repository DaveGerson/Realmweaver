
import React, { useState, useEffect } from 'react';
import type { Location, LocationConnection, PointOfInterest, PoiInteraction, LootItem } from '../types/index';
import { Icons } from './Icons';
import { Button } from './common/Button';
import { AiTextarea } from './common/Textarea';
import { generateEnhancedText, generatePoiFromLoot } from '../services/geminiService';

interface LocationEditorProps {
  location: Location;
  allLocations: Location[]; // To select a parent
  onUpdate: (id: string, updatedData: Partial<Location>) => void;
  onDelete: (id: string) => void;
  isMockMode: boolean;
}

type GenerationField = 'description' | 'secrets';

export const LocationEditor: React.FC<LocationEditorProps> = ({ location, allLocations, onUpdate, onDelete, isMockMode }) => {
  const [formData, setFormData] = useState(location);
  const [isGenerating, setIsGenerating] = useState<GenerationField | null>(null);
  const [generatingPoiFor, setGeneratingPoiFor] = useState<string | null>(null);

  useEffect(() => {
    setFormData(location);
  }, [location]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (formData[e.target.name as keyof Location] !== location[e.target.name as keyof Location]) {
        onUpdate(location.id, { [e.target.name]: e.target.value });
    }
  };

  const handleParentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newParentId = value === "none" ? undefined : value;
    setFormData(prev => ({ ...prev, [name]: newParentId }));
    onUpdate(location.id, { [name]: newParentId });
  };
  
  const handleAiGenerate = async (field: GenerationField) => {
    setIsGenerating(field);
    const context = `Location Name: ${formData.name}\nDescription: ${field === 'description' ? '[GENERATE THIS]' : formData.description}\nSecrets: ${field === 'secrets' ? '[GENERATE THIS]' : formData.secrets}`;
    const prompt = `Based on the following location info, generate a compelling "${field}":\n\n${context}`;

    try {
      const result = await generateEnhancedText(prompt, undefined, isMockMode);
      const updatedData = { [field]: result };
      setFormData(prev => ({ ...prev, ...updatedData }));
      onUpdate(location.id, updatedData);
    } catch (error) {
      console.error("AI generation failed:", error);
    } finally {
      setIsGenerating(null);
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${location.name}? This action cannot be undone.`)) {
        onDelete(location.id);
    }
  };

  // --- Connection Handlers ---
  const handleAddConnection = () => {
    const newConnection: LocationConnection = { id: crypto.randomUUID(), targetLocationId: '', description: '' };
    const newConnections = [...(formData.connections || []), newConnection];
    setFormData(prev => ({ ...prev, connections: newConnections }));
    onUpdate(location.id, { connections: newConnections });
  };

  const handleConnectionChange = (id: string, field: keyof Omit<LocationConnection, 'id'>, value: string) => {
    const newConnections = (formData.connections || []).map(c => c.id === id ? { ...c, [field]: value } : c);
    setFormData(prev => ({ ...prev, connections: newConnections }));
  };

  const handleDeleteConnection = (id: string) => {
    const newConnections = (formData.connections || []).filter(c => c.id !== id);
    setFormData(prev => ({ ...prev, connections: newConnections }));
    onUpdate(location.id, { connections: newConnections });
  };

  const handleConnectionsBlur = () => {
    onUpdate(location.id, { connections: formData.connections });
  };
  
  // --- Point of Interest Handlers ---
  const handlePoisBlur = () => {
    onUpdate(location.id, { pointsOfInterest: formData.pointsOfInterest });
  };
  
  const handleAddPoi = () => {
    const newPoi: PointOfInterest = { id: crypto.randomUUID(), name: 'New Point of Interest', passivePerceptionDC: 10, description: '', investigationChecks: [], interactions: [] };
    const newPois = [...(formData.pointsOfInterest || []), newPoi];
    setFormData(prev => ({...prev, pointsOfInterest: newPois}));
    onUpdate(location.id, { pointsOfInterest: newPois });
  };

  const handleDeletePoi = (id: string) => {
    const newPois = (formData.pointsOfInterest || []).filter(p => p.id !== id);
    setFormData(prev => ({...prev, pointsOfInterest: newPois}));
    onUpdate(location.id, { pointsOfInterest: newPois });
  };

  const handlePoiChange = (id: string, field: keyof Omit<PointOfInterest, 'id' | 'interactions' | 'investigationChecks'>, value: string | number) => {
    const newPois = (formData.pointsOfInterest || []).map(p => p.id === id ? { ...p, [field]: value } : p);
    setFormData(prev => ({ ...prev, pointsOfInterest: newPois }));
  };
  
  const updatePoiInteractions = (poiId: string, updatedInteractions: PoiInteraction[], type: 'interactions' | 'investigationChecks') => {
      const newPois = (formData.pointsOfInterest || []).map(p => p.id === poiId ? { ...p, [type]: updatedInteractions } : p);
      setFormData(prev => ({...prev, pointsOfInterest: newPois}));
      onUpdate(location.id, { pointsOfInterest: newPois });
  };

  const handleAddPoiSubItem = (poiId: string, type: 'interactions' | 'investigationChecks') => {
    const newInteraction: PoiInteraction = { id: crypto.randomUUID(), description: '', outcome: '' };
    const poi = (formData.pointsOfInterest || []).find(p => p.id === poiId);
    if (poi) {
        const newItems = [...poi[type], newInteraction];
        updatePoiInteractions(poiId, newItems, type);
    }
  };

  const handleDeletePoiSubItem = (poiId: string, interactionId: string, type: 'interactions' | 'investigationChecks') => {
    const poi = (formData.pointsOfInterest || []).find(p => p.id === poiId);
    if (poi) {
        const newItems = poi[type].filter(i => i.id !== interactionId);
        updatePoiInteractions(poiId, newItems, type);
    }
  };

  const handlePoiSubItemChange = (poiId: string, interactionId: string, field: keyof Omit<PoiInteraction, 'id'>, value: string, type: 'interactions' | 'investigationChecks') => {
      const newPois = (formData.pointsOfInterest || []).map(p => {
        if (p.id === poiId) {
            const newInteractions = p[type].map(i => i.id === interactionId ? { ...i, [field]: value } : i);
            return { ...p, [type]: newInteractions };
        }
        return p;
      });
      setFormData(prev => ({ ...prev, pointsOfInterest: newPois }));
  };

  // --- Loot Handlers ---
  const handleAddLootItem = () => {
    const newItem: LootItem = { id: crypto.randomUUID(), description: '', pointOfInterestId: undefined };
    const newLoot = [...(formData.loot || []), newItem];
    setFormData(prev => ({ ...prev, loot: newLoot }));
    onUpdate(location.id, { loot: newLoot });
  };

  const handleLootItemChange = (id: string, field: keyof Omit<LootItem, 'id'>, value: string) => {
    const newLoot = (formData.loot || []).map(item =>
        item.id === id ? { ...item, [field]: value === 'none' ? undefined : value } : item
    );
    setFormData(prev => ({ ...prev, loot: newLoot }));
  };

  const handleDeleteLootItem = (id: string) => {
    const newLoot = (formData.loot || []).filter(item => item.id !== id);
    setFormData(prev => ({ ...prev, loot: newLoot }));
    onUpdate(location.id, { loot: newLoot });
  };

  const handleLootBlur = () => {
    if (JSON.stringify(formData.loot) !== JSON.stringify(location.loot)) {
        onUpdate(location.id, { loot: formData.loot });
    }
  };

  const handleGeneratePoi = async (lootItem: LootItem) => {
    if (!lootItem.description) return;
    setGeneratingPoiFor(lootItem.id);
    try {
        const poiData = await generatePoiFromLoot(lootItem.description, undefined, isMockMode);
        const newPoi: PointOfInterest = { ...poiData, id: crypto.randomUUID() };
        
        const newPois = [...(formData.pointsOfInterest || []), newPoi];
        const newLoot = (formData.loot || []).map(item =>
            item.id === lootItem.id ? { ...item, pointOfInterestId: newPoi.id } : item
        );
        
        const updatedData = { pointsOfInterest: newPois, loot: newLoot };
        setFormData(prev => ({ ...prev, ...updatedData }));
        onUpdate(location.id, updatedData);

    } catch (err) {
        console.error("Failed to generate Point of Interest from loot", err);
    } finally {
        setGeneratingPoiFor(null);
    }
  };

  // Filter out the current location and its own children from the list of possible parents
  const possibleParents = allLocations.filter(l => {
    if (l.id === location.id) return false; // Can't be its own parent
    let current = l;
    while(current.parentLocationId) {
        if(current.parentLocationId === location.id) return false; // Avoid circular dependencies
        const parent = allLocations.find(p => p.id === current.parentLocationId);
        if(!parent) break;
        current = parent;
    }
    return true;
  });

  const subLocations = allLocations.filter(l => location.subLocationIds.includes(l.id));
  const possibleConnectionTargets = allLocations.filter(l => l.id !== location.id);
  const inboundConnections = allLocations.filter(l => l.connections?.some(c => c.targetLocationId === location.id));

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-fade-in">
      <header className="flex justify-between items-start">
        <div className="space-y-2">
            <div className="flex items-center gap-3 text-indigo-400">
              <Icons.Locations className="w-8 h-8" />
              <h1 className="text-3xl font-bold font-serif text-slate-100">Location Editor</h1>
            </div>
        </div>
        <Button variant="danger" size="sm" onClick={handleDelete}>
            <Icons.Trash className="w-3.5 h-3.5 mr-2" />
            Delete Location
        </Button>
      </header>
      
      <div className="space-y-6 bg-slate-900/50 p-6 rounded-xl border border-slate-800/50">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Location Name</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} onBlur={handleBlur} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"/>
        </div>

        <AiTextarea label="Description" name="description" value={formData.description} onChange={handleChange} onBlur={handleBlur} rows={5} onAiGenerate={() => handleAiGenerate('description')} isGenerating={isGenerating === 'description'} />

        <AiTextarea label="Secrets & Hidden Details" name="secrets" value={formData.secrets} onChange={handleChange} onBlur={handleBlur} rows={3} onAiGenerate={() => handleAiGenerate('secrets')} isGenerating={isGenerating === 'secrets'} />

        {/* Items & Loot */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-sm font-medium text-slate-400">Items & Loot</label>
            <Button size="sm" variant="ghost" onClick={handleAddLootItem}>
              <Icons.Plus className="w-3 h-3 mr-1.5" /> Add Loot
            </Button>
          </div>
          <div className="space-y-2">
            {(formData.loot || []).map(item => (
              <div key={item.id} className="flex items-center gap-2 bg-slate-950/50 p-2 rounded-md border border-slate-800/50">
                <Icons.Items className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Loot description (e.g., 200gp, Potion of Healing)"
                  value={item.description}
                  onChange={(e) => handleLootItemChange(item.id, 'description', e.target.value)}
                  onBlur={handleLootBlur}
                  className="flex-grow bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <select
                  value={item.pointOfInterestId || 'none'}
                  onChange={(e) => handleLootItemChange(item.id, 'pointOfInterestId', e.target.value)}
                  onBlur={handleLootBlur}
                  className="w-1/3 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="none">-- General Location --</option>
                  {(formData.pointsOfInterest || []).map(poi => (
                    <option key={poi.id} value={poi.id}>{poi.name}</option>
                  ))}
                </select>
                <button 
                  onClick={() => handleGeneratePoi(item)} 
                  disabled={generatingPoiFor === item.id || !item.description}
                  className="text-indigo-400 hover:text-indigo-300 p-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed group relative"
                  aria-label="Generate Point of Interest from loot"
                >
                  {generatingPoiFor === item.id ? <Icons.Sparkles className="w-4 h-4 animate-spin" /> : <Icons.Sparkles className="w-4 h-4" />}
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900 text-slate-300 text-xs rounded-md p-2 border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                    Generate an interactive Point of Interest for this loot item.
                  </span>
                </button>
                <button onClick={() => handleDeleteLootItem(item.id)} className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors">
                  <Icons.Trash className="w-4 h-4" />
                </button>
              </div>
            ))}
            {(!formData.loot || formData.loot.length === 0) && (
              <p className="text-xs text-slate-500 italic px-2 py-1">No loot defined for this location.</p>
            )}
          </div>
        </div>
        
        {/* Points of Interest */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-sm font-medium text-slate-400">Points of Interest</label>
            <Button size="sm" variant="ghost" onClick={handleAddPoi}><Icons.Plus className="w-3 h-3 mr-1.5" /> Add Point of Interest</Button>
          </div>
          <div className="space-y-3">
            {(formData.pointsOfInterest || []).map(poi => 
                <PointOfInterestEditor 
                    key={poi.id} 
                    poi={poi} 
                    onDelete={handleDeletePoi} 
                    onChange={handlePoiChange} 
                    onAddSubItem={handleAddPoiSubItem}
                    onDeleteSubItem={handleDeletePoiSubItem}
                    onChangeSubItem={handlePoiSubItemChange}
                    onBlur={handlePoisBlur} 
                />
            )}
            {(!formData.pointsOfInterest || formData.pointsOfInterest.length === 0) && (<p className="text-xs text-slate-500 italic px-2 py-1">No points of interest defined for this location.</p>)}
          </div>
        </div>

        {/* Connections */}
        <div>
            <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-medium text-slate-400">Connections & Relationships</label>
                <Button size="sm" variant="ghost" onClick={handleAddConnection}><Icons.Plus className="w-3 h-3 mr-1.5" /> Add Connection</Button>
            </div>
            <div className="space-y-2">
                {(formData.connections || []).map((conn) => (
                    <div key={conn.id} className="flex items-center gap-2 bg-slate-950/50 p-2 rounded-md border border-slate-800/50">
                        <Icons.Link className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <input type="text" placeholder="Description of connection" value={conn.description} onChange={(e) => handleConnectionChange(conn.id, 'description', e.target.value)} onBlur={handleConnectionsBlur} className="w-1/2 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500" />
                        <span className="text-slate-500">→</span>
                        <select value={conn.targetLocationId} onChange={(e) => handleConnectionChange(conn.id, 'targetLocationId', e.target.value)} onBlur={handleConnectionsBlur} className="flex-grow bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500">
                            <option value="">-- Select Target --</option>
                            {possibleConnectionTargets.map(loc => (<option key={loc.id} value={loc.id}>{loc.name}</option>))}
                        </select>
                        <button onClick={() => handleDeleteConnection(conn.id)} className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors"><Icons.Trash className="w-4 h-4" /></button>
                    </div>
                ))}
                {(!formData.connections || formData.connections.length === 0) && (<p className="text-xs text-slate-500 italic px-2 py-1">No connections defined for this location.</p>)}
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Parent Location</label>
                <select name="parentLocationId" value={formData.parentLocationId || "none"} onChange={handleParentChange} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all">
                    <option value="none">-- None --</option>
                    {possibleParents.map(loc => (<option key={loc.id} value={loc.id}>{loc.name}</option>))}
                </select>
            </div>
            <div>
                 <label className="block text-sm font-medium text-slate-400 mb-1.5">Sub-Locations</label>
                 {subLocations.length > 0 ? (<ul className="list-disc list-inside text-slate-300 text-sm space-y-1 mt-2 pl-2">{subLocations.map(loc => <li key={loc.id}>{loc.name}</li>)}</ul>) : (<p className="text-sm text-slate-500 italic mt-2">No sub-locations assigned.</p>)}
            </div>
            <div className="md:col-span-2">
                 <label className="block text-sm font-medium text-slate-400 mb-1.5">Connected From</label>
                 {inboundConnections.length > 0 ? (<div className="space-y-1 text-sm text-slate-300 mt-2">{inboundConnections.map(loc => { const conn = loc.connections?.find(c => c.targetLocationId === location.id); return conn ? (<div key={loc.id} className="flex items-center gap-2"><span className="font-semibold">{loc.name}</span><span className="text-xs bg-slate-700 text-slate-300 rounded-full px-2 py-0.5">{conn.description}</span></div>) : null; })}</div>) : (<p className="text-sm text-slate-500 italic mt-2">No other locations connect to this one.</p>)}
            </div>
        </div>
      </div>
    </div>
  );
};


// --- Point of Interest Sub-Component ---
interface PointOfInterestEditorProps {
    poi: PointOfInterest;
    onDelete: (id: string) => void;
    onChange: (id: string, field: keyof Omit<PointOfInterest, 'id' | 'interactions' | 'investigationChecks'>, value: string | number) => void;
    onAddSubItem: (poiId: string, type: 'interactions' | 'investigationChecks') => void;
    onDeleteSubItem: (poiId: string, interactionId: string, type: 'interactions' | 'investigationChecks') => void;
    onChangeSubItem: (poiId: string, interactionId: string, field: keyof Omit<PoiInteraction, 'id'>, value: string, type: 'interactions' | 'investigationChecks') => void;
    onBlur: () => void;
}

const PointOfInterestEditor: React.FC<PointOfInterestEditorProps> = ({ poi, onDelete, onChange, onAddSubItem, onDeleteSubItem, onChangeSubItem, onBlur }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className="bg-slate-950/50 border border-slate-800 rounded-lg">
            <header className="flex items-center justify-between p-2 bg-slate-800/30 rounded-t-lg">
                <button onClick={() => setIsExpanded(p => !p)} className="flex items-center gap-2 flex-grow text-left">
                    <Icons.ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                    <Icons.Puzzle className="w-4 h-4 text-indigo-400" />
                    <span className="font-semibold text-slate-200">{poi.name}</span>
                </button>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">DC {poi.passivePerceptionDC}</span>
                    <button onClick={() => onDelete(poi.id)} className="p-1 text-slate-500 hover:text-red-400"><Icons.Trash className="w-4 h-4" /></button>
                </div>
            </header>
            {isExpanded && (
                <div className="p-3 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-slate-400 mb-1">Name</label>
                            <input type="text" value={poi.name} onChange={e => onChange(poi.id, 'name', e.target.value)} onBlur={onBlur} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Passive Perception</label>
                            <input type="number" value={poi.passivePerceptionDC} onChange={e => onChange(poi.id, 'passivePerceptionDC', parseInt(e.target.value) || 10)} onBlur={onBlur} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Description (Read-Aloud)</label>
                        <textarea value={poi.description} onChange={e => onChange(poi.id, 'description', e.target.value)} onBlur={onBlur} rows={3} placeholder="What players notice if they meet the passive perception DC." className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500 resize-y" />
                    </div>
                    
                    <PoiSubSection
                        title="Investigation Checks"
                        items={poi.investigationChecks}
                        onAdd={() => onAddSubItem(poi.id, 'investigationChecks')}
                        onDelete={(itemId) => onDeleteSubItem(poi.id, itemId, 'investigationChecks')}
                        onChange={(itemId, field, value) => onChangeSubItem(poi.id, itemId, field, value, 'investigationChecks')}
                        onBlur={onBlur}
                        descriptionPlaceholder="Condition / Check (e.g., 'DC 12 Investigation')"
                        outcomePlaceholder="Outcome / Details (e.g., 'The runes are of ancient Dwarven origin.')"
                        emptyText="No special details to find via investigation."
                    />

                    <PoiSubSection
                        title="Player Actions"
                        items={poi.interactions}
                        onAdd={() => onAddSubItem(poi.id, 'interactions')}
                        onDelete={(itemId) => onDeleteSubItem(poi.id, itemId, 'interactions')}
                        onChange={(itemId, field, value) => onChangeSubItem(poi.id, itemId, field, value, 'interactions')}
                        onBlur={onBlur}
                        descriptionPlaceholder="Trigger / Action (e.g., 'If a player pulls the lever')"
                        outcomePlaceholder="Outcome / Result (e.g., 'A secret door grinds open.')"
                        emptyText="No special actions available."
                    />
                </div>
            )}
        </div>
    )
};

interface PoiSubSectionProps {
    title: string;
    items: PoiInteraction[];
    onAdd: () => void;
    onDelete: (id: string) => void;
    onChange: (id: string, field: keyof Omit<PoiInteraction, 'id'>, value: string) => void;
    onBlur: () => void;
    descriptionPlaceholder: string;
    outcomePlaceholder: string;
    emptyText: string;
}

const PoiSubSection: React.FC<PoiSubSectionProps> = ({ title, items, onAdd, onDelete, onChange, onBlur, descriptionPlaceholder, outcomePlaceholder, emptyText }) => (
    <div>
        <div className="flex justify-between items-center mb-1">
            <label className="block text-xs font-medium text-slate-400">{title}</label>
            <Button size="sm" variant="ghost" onClick={onAdd}><Icons.Plus className="w-3 h-3 mr-1" /> Add</Button>
        </div>
        <div className="space-y-2">
            {items.map(item => (
                <div key={item.id} className="bg-slate-900/50 p-2 rounded-md border border-slate-700/50 space-y-1.5">
                    <div className="flex items-start gap-2">
                        <textarea value={item.description} onChange={e => onChange(item.id, 'description', e.target.value)} onBlur={onBlur} rows={2} placeholder={descriptionPlaceholder} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm resize-y outline-none focus:ring-1 focus:ring-indigo-500" />
                        <button onClick={() => onDelete(item.id)} className="p-1 text-slate-500 hover:text-red-400 mt-1"><Icons.Trash className="w-3.5 h-3.5" /></button>
                    </div>
                    <textarea value={item.outcome} onChange={e => onChange(item.id, 'outcome', e.target.value)} onBlur={onBlur} rows={2} placeholder={outcomePlaceholder} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm resize-y outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
            ))}
            {items.length === 0 && <p className="text-xs text-slate-600 italic px-2 py-1">{emptyText}</p>}
        </div>
    </div>
);
