import React, { useState } from 'react';
import type { Faction } from '../../types/index';
import { generateFaction } from '../../services/geminiService';
import { Icons } from '../Icons';
import { Button } from '../common/Button';

interface FactionGeneratorProps {
  onFactionCreated: (faction: Omit<Faction, 'id'>) => void;
  isMockMode: boolean;
}

export const FactionGenerator: React.FC<FactionGeneratorProps> = ({ onFactionCreated, isMockMode }) => {
  const [prompt, setPrompt] = useState('');
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
      const factionData = await generateFaction(prompt, isMockMode);
      const newFaction: Omit<Faction, 'id'> = {
          ...factionData,
          leaderId: undefined,
          memberIds: []
      }
      onFactionCreated(newFaction);
      setPrompt('');
    } catch (err) {
      setError('Failed to generate faction. Please check your API key and try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="relative bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4 h-full flex flex-col">
      {isLoading && (
        <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl z-10">
          <Icons.Sparkles className="w-10 h-10 text-indigo-400 animate-spin" />
          <p className="mt-4 text-md text-slate-300">Generating Faction...</p>
        </div>
      )}
      <div className="flex items-center gap-3">
        <Icons.Wizard className="w-7 h-7 text-indigo-400" />
        <h2 className="text-2xl font-bold font-serif text-slate-100">Faction Generator</h2>
      </div>
      <p className="text-sm text-slate-400 flex-grow">
        Describe a faction or organization, and the AI will define its goals and purpose.
      </p>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g., A shadowy assassins guild that communicates via coded messages."
        rows={5}
        className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none resize-y placeholder:text-slate-600"
        disabled={isLoading}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <Button onClick={handleGenerate} disabled={isLoading || !prompt.trim()} size="lg" className="w-full mt-auto">
        {isLoading ? 'Generating...' : 'Generate Faction'}
      </Button>
    </div>
  );
};
