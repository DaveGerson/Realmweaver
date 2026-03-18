
import React, { useState } from 'react';
import type { NPC, Faction } from '../../types/index';
import { generateNpc } from '../../services/geminiService';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { EntityChatGenerator } from './EntityChatGenerator';
import { NpcEditor } from '../editors/NpcEditor';
import { createDefaultNpc } from '../../utils/entityUtils';

interface NpcGeneratorProps {
  onNpcCreated: (npc: Omit<NPC, 'id'>) => void;
  isMockMode: boolean;
  isOfficialSetting?: boolean;
  factions?: Faction[];
  allNpcs?: NPC[];
  campaignContext?: string;
}

export const NpcGenerator: React.FC<NpcGeneratorProps> = ({ onNpcCreated, isMockMode, isOfficialSetting = false, factions = [], allNpcs = [], campaignContext }) => {
  const [mode, setMode] = useState<'quick' | 'chat'>('quick');
  const [prompt, setPrompt] = useState('');
  const [useGroundedSearch, setUseGroundedSearch] = useState(isOfficialSetting);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuickGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const shouldSearch = isOfficialSetting || useGroundedSearch;
      const npcData = await generateNpc(prompt, shouldSearch, isMockMode, campaignContext);
      const newNpc: Omit<NPC, 'id'> = {
          ...npcData,
          factionId: undefined
      }
      onNpcCreated(newNpc);
      setPrompt('');
    } catch (err) {
      setError('Failed to generate NPC. Please check your API key and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (mode === 'chat') {
      return (
          <div className="absolute inset-0 z-20 bg-slate-950 p-6 flex flex-col animate-in fade-in zoom-in-95 duration-200">
             <div className="mb-4 flex justify-between items-center flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={() => setMode('quick')}>
                     <Icons.ChevronDown className="w-4 h-4 mr-2 rotate-90" /> Back to Quick Generator
                </Button>
                <h2 className="text-lg font-bold font-serif text-slate-100">Conversational Creator</h2>
             </div>
             <div className="flex-1 min-h-0 border border-slate-800 rounded-xl shadow-2xl overflow-hidden bg-slate-900">
                 <EntityChatGenerator
                    entityType="npc"
                    isMockMode={isMockMode}
                    campaignContext={campaignContext}
                    onEntityCreated={(data) => {
                        // Clean up data before saving
                        const { id, ...npcData } = data;
                        onNpcCreated(npcData);
                        setMode('quick');
                    }}
                    initialData={createDefaultNpc()}
                    renderPreview={(data, onUpdate) => (
                        // We pass a dummy delete handler since we are in creation mode
                        <NpcEditor 
                            npc={{...data, id: 'preview'}} 
                            factions={factions}
                            allNpcs={allNpcs}
                            onUpdate={(_, updates) => onUpdate(updates)} 
                            onDelete={() => {}} 
                            isMockMode={isMockMode} 
                        />
                    )}
                 />
             </div>
          </div>
      );
  }
  
  return (
    <div className="relative bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4 h-full flex flex-col">
      {isLoading && (
        <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl z-10">
          <Icons.Sparkles className="w-10 h-10 text-indigo-400 animate-spin" />
          <p className="mt-4 text-md text-slate-300">Generating NPC...</p>
        </div>
      )}
      <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icons.Wizard className="w-7 h-7 text-indigo-400" />
            <h2 className="text-2xl font-bold font-serif text-slate-100">NPC Generator</h2>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setMode('chat')}>
             <Icons.Chat className="w-4 h-4 mr-2" /> Create via Chat
          </Button>
      </div>

      <p className="text-sm text-slate-400 flex-grow">
        Describe an NPC and let the AI bring them to life.
      </p>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={useGroundedSearch || isOfficialSetting ? "e.g., Drizzt Do'Urden, Elminster" : "e.g., A gruff dwarven blacksmith..."}
        rows={5}
        className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none resize-y placeholder:text-slate-600"
        disabled={isLoading}
      />
      <div className="flex items-center justify-between">
         <label className="flex items-center text-xs text-slate-400 select-none">
            <input 
                type="checkbox"
                checked={useGroundedSearch}
                onChange={(e) => setUseGroundedSearch(e.target.checked)}
                className="w-4 h-4 mr-2 bg-slate-800 border-slate-600 rounded text-indigo-600 focus:ring-indigo-500"
                disabled={isLoading}
            />
            Use Google Search (Find Canon/Lore)
        </label>
        <div className="group relative">
            <Icons.Help className="w-4 h-4 text-slate-500 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900 text-slate-300 text-xs rounded-md p-2 border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                Check this to generate an NPC based on established lore from official sources (e.g., Forgotten Realms). {isOfficialSetting ? "Recommended for your Official Setting." : ""}
            </div>
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <Button onClick={handleQuickGenerate} disabled={isLoading || !prompt.trim()} size="lg" className="w-full mt-auto">
        {isLoading ? 'Generating...' : 'Generate NPC'}
      </Button>
    </div>
  );
};
