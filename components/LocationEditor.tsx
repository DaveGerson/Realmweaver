import React, { useState, useEffect } from 'react';
import type { Location } from '../types';
import { Icons } from './Icons';
import { AiTextarea } from './common/Textarea';
import { generateEnhancedText } from '../services/geminiService';

interface LocationEditorProps {
  location: Location;
  allLocations: Location[]; // To select a parent
  onUpdate: (id: string, updatedData: Partial<Location>) => void;
  isMockMode: boolean;
}

export const LocationEditor: React.FC<LocationEditorProps> = ({ location, allLocations, onUpdate, isMockMode }) => {
  const [formData, setFormData] = useState(location);
  const [isGenerating, setIsGenerating] = useState<keyof Omit<Location, 'id' | 'parentLocationId' | 'subLocationIds'> | null>(null);

  useEffect(() => {
    setFormData(location);
  }, [location]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (formData.name !== location.name || formData.description !== location.description || formData.secrets !== location.secrets) {
        onUpdate(location.id, { [e.target.name]: e.target.value });
    }
  };

  const handleParentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newParentId = value === "none" ? undefined : value;
    setFormData(prev => ({ ...prev, [name]: newParentId }));
    onUpdate(location.id, { [name]: newParentId });
  };
  
  const handleAiGenerate = async (field: keyof Omit<Location, 'id' | 'parentLocationId' | 'subLocationIds'>) => {
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

  // Filter out the current location and its own children from the list of possible parents
  const possibleParents = allLocations.filter(l => {
    if (l.id === location.id) return false; // Can't be its own parent
    // Traverse up from the potential parent to see if it's a child of the current location
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

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
      <header className="space-y-2">
        <div className="flex items-center gap-3 text-indigo-400">
          <Icons.Locations className="w-8 h-8" />
          <h1 className="text-3xl font-bold font-serif text-slate-100">Location Editor</h1>
        </div>
      </header>
      
      <div className="space-y-6 bg-slate-900/50 p-6 rounded-xl border border-slate-800/50">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Location Name</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"
          />
        </div>

        {/* Description */}
        <AiTextarea
          label="Description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={5}
          onAiGenerate={() => handleAiGenerate('description')}
          isGenerating={isGenerating === 'description'}
        />

        {/* Secrets */}
        <AiTextarea
          label="Secrets & Hidden Details"
          name="secrets"
          value={formData.secrets}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={3}
          onAiGenerate={() => handleAiGenerate('secrets')}
          isGenerating={isGenerating === 'secrets'}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Parent Location */}
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Parent Location</label>
                <select
                    name="parentLocationId"
                    value={formData.parentLocationId || "none"}
                    onChange={handleParentChange}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                >
                    <option value="none">-- None --</option>
                    {possibleParents.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                </select>
            </div>

            {/* Sub-Locations (Display Only) */}
            <div>
                 <label className="block text-sm font-medium text-slate-400 mb-1.5">Sub-Locations</label>
                 {subLocations.length > 0 ? (
                    <ul className="list-disc list-inside text-slate-300 text-sm space-y-1 mt-2 pl-2">
                        {subLocations.map(loc => <li key={loc.id}>{loc.name}</li>)}
                    </ul>
                 ) : (
                    <p className="text-sm text-slate-500 italic mt-2">No sub-locations assigned.</p>
                 )}
            </div>
        </div>
      </div>
    </div>
  );
};