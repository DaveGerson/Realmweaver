import React, { useState } from 'react';
import type { NPC } from '../../types/index';
import { generateNpc } from '../../services/geminiService';
import { Icons } from '../Icons';
import { Button } from '../common/Button';

interface NpcGeneratorProps {
  onNpcCreated: (npc: Omit<NPC, 'id'>) => void;
  isMockMode: boolean;
}

export const NpcGenerator: React.FC<NpcGeneratorProps> = ({ onNpcCreated, isMockMode }) => {
  const [prompt, setPrompt] = useState('');
  const [useGroundedSearch, setUseGroundedSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const npcData = await generateNpc(prompt, useGroundedSearch, isMockMode);
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
  
  return (
    <div className="relative bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4 h-full flex flex-col">
      {isLoading && (
        <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl z-10">
          <Icons.Sparkles className="w-10 h-10 text-indigo-400 animate-spin" />
          <p className="mt-4 text-md text-slate-300">Generating NPC...</p>
        </div>
      )}
      <div className="flex items-center gap-3">
        <Icons.Wizard className="w-7 h-7 text-indigo-400" />
        <h2 className="text-2xl font-bold font-serif text-slate-100">NPC Generator</h2>
      </div>
      <p className="text-sm text-slate-400 flex-grow">
        Describe an NPC and let the AI bring them to life.
      </p>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={useGroundedSearch ? "e.g., Drizzt Do'Urden, Elminster" : "e.g., A gruff dwarven blacksmith..."}
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
            Generate from existing lore
        </label>
        <div className="group relative">
            <Icons.Help className="w-4 h-4 text-slate-500 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900 text-slate-300 text-xs rounded-md p-2 border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                Check this to generate an NPC based on established lore from official sources (e.g., Forgotten Realms).
            </div>
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <Button onClick={handleGenerate} disabled={isLoading || !prompt.trim()} size="lg" className="w-full mt-auto">
        {isLoading ? 'Generating...' : 'Generate NPC'}
      </Button>
    </div>
  );
};
