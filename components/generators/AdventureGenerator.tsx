
import React, { useState } from 'react';
import { generateAdventure } from '../../services/geminiService';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import type { AdventureForBatchAdd } from '../../types/index';
import { EntityChatGenerator } from './EntityChatGenerator';
import { createDefaultAdventure } from '../../utils/entityUtils';
import { AdventureEditor } from '../editors/AdventureEditor';
// Mock campaign for the editor preview since we don't have the real campaign object here easily
import type { Campaign } from '../../types/index';

interface AdventureGeneratorProps {
  onAdventureCreated: (adventureData: AdventureForBatchAdd) => void;
  isMockMode: boolean;
  isOfficialSetting?: boolean;
}

export const AdventureGenerator: React.FC<AdventureGeneratorProps> = ({ onAdventureCreated, isMockMode, isOfficialSetting = false }) => {
  const [mode, setMode] = useState<'quick' | 'chat'>('quick');
  const [prompt, setPrompt] = useState('');
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
      const adventureData = await generateAdventure(prompt, isOfficialSetting, isMockMode);
      onAdventureCreated(adventureData);
      setPrompt('');
    } catch (err) {
      setError('Failed to generate adventure. Please check your API key and try again.');
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
                    entityType="adventure"
                    isMockMode={isMockMode}
                    onEntityCreated={(data) => {
                        const { id, ...advData } = data;
                        onAdventureCreated(advData);
                        setMode('quick');
                    }}
                    initialData={createDefaultAdventure()}
                    renderPreview={(data, onUpdate) => {
                         // Create a minimal mock campaign for the preview to avoid crashing
                        const mockCampaign: Campaign = { id: 'preview', title: 'Preview', setting: '', settingType: 'custom', articles: [], adventures: [], npcs: [], locations: [], factions: [], items: [], sessionLogs: [], playerCharacters: [], notes: [], plots: [] };
                        return (
                            <AdventureEditor 
                                adventure={{...data, id: 'preview'}} 
                                campaign={mockCampaign}
                                onUpdate={(_, updates) => onUpdate(updates)} 
                            />
                        )
                    }}
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
          <p className="mt-4 text-md text-slate-300">Weaving Your Adventure...</p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <Icons.Wizard className="w-7 h-7 text-indigo-400" />
            <h2 className="text-2xl font-bold font-serif text-slate-100">Adventure Generator</h2>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setMode('chat')}>
             <Icons.Chat className="w-4 h-4 mr-2" /> Create via Chat
        </Button>
      </div>

      <p className="text-sm text-slate-400 flex-grow">
        Describe a concept for an adventure, and the AI will generate a complete outline with a hook, theme, and multiple scenes to get you started.
        {isOfficialSetting && <span className="block mt-1 text-indigo-400 text-xs">Google Search enabled for canon accuracy.</span>}
      </p>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g., A mystery in a wizard's tower where spells have started to go haywire."
        rows={5}
        className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none resize-y placeholder:text-slate-600"
        disabled={isLoading}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <Button onClick={handleQuickGenerate} disabled={isLoading || !prompt.trim()} size="lg" className="w-full mt-auto">
        {isLoading ? 'Generating...' : 'Generate Adventure'}
      </Button>
    </div>
  );
};
