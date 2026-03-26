
import React, { useState } from 'react';
import { generateAdventure } from '@/services/aiService';
import { Icons } from '@/components/common/Icons';
import { Button } from '@/components/common/Button';
import { SkeletonGeneratorOverlay } from '@/components/common/SkeletonCard';
import type { AdventureForBatchAdd, Campaign } from '@/types/index';
import { EntityChatGenerator } from '@/components/generators/EntityChatGenerator';
import { createDefaultAdventure } from '@/utils/entityUtils';
import { AdventureEditor } from '@/components/editors/AdventureEditor';
import { inputBaseClasses } from '@/components/common/Textarea';

interface AdventureGeneratorProps {
  onAdventureCreated: (adventureData: AdventureForBatchAdd) => void;
  isMockMode: boolean;
  isOfficialSetting?: boolean;
  campaignContext?: string;
}

const PROMPT_CHIPS = [
  'A heist in a noble\'s manor',
  'An investigation into disappearing townsfolk',
  'A race to stop a ritual before the solstice',
  'A journey through a monster-haunted wilderness',
];

const LEVEL_RANGE_OPTIONS = ['', '1-4', '5-10', '11-16', '17-20'];

export const AdventureGenerator: React.FC<AdventureGeneratorProps> = ({
  onAdventureCreated,
  isMockMode,
  isOfficialSetting = false,
  campaignContext,
}) => {
  const [mode, setMode] = useState<'quick' | 'chat'>('quick');
  const [prompt, setPrompt] = useState('');
  const [levelRange, setLevelRange] = useState('');
  const [partySize, setPartySize] = useState<number | ''>(4);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildFullPrompt = (): string => {
    const parts: string[] = [];
    if (levelRange) parts.push(`[Levels ${levelRange}]`);
    if (partySize !== '') parts.push(`[Party of ${partySize}]`);
    if (prompt.trim()) parts.push(prompt.trim());
    return parts.join(' ');
  };

  const handleQuickGenerate = async () => {
    const fullPrompt = buildFullPrompt();
    if (!fullPrompt.trim()) {
      setError('Please enter a prompt.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const adventureData = await generateAdventure(fullPrompt, isMockMode, campaignContext);
      onAdventureCreated(adventureData);
      setPrompt('');
      setLevelRange('');
      setPartySize(4);
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
            campaignContext={campaignContext}
            onEntityCreated={(data) => {
              const { id, ...advData } = data;
              onAdventureCreated(advData);
              setMode('quick');
            }}
            initialData={createDefaultAdventure()}
            renderPreview={(data, onUpdate) => {
              const mockCampaign: Campaign = {
                id: 'preview',
                title: 'Preview',
                setting: '',
                settingType: 'custom',
                articles: [],
                adventures: [],
                npcs: [],
                locations: [],
                factions: [],
                items: [],
                sessionLogs: [],
                playerCharacters: [],
                notes: [],
                plots: [],
              };
              return (
                <AdventureEditor
                  adventure={{ ...data, id: 'preview' }}
                  campaign={mockCampaign}
                  onUpdate={(_, updates) => onUpdate(updates)}
                />
              );
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4 h-full flex flex-col">
      {isLoading && <SkeletonGeneratorOverlay />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icons.Wizard className="w-7 h-7 text-amber-400" />
          <h2 className="text-2xl font-bold font-serif text-slate-100">Adventure Generator</h2>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setMode('chat')}>
          <Icons.Chat className="w-4 h-4 mr-2" /> Create via Chat
        </Button>
      </div>

      <p className="text-sm text-slate-400">
        Describe a concept for an adventure, and the AI will generate a complete outline with a hook, theme, and multiple scenes to get you started.
        {isOfficialSetting && (
          <span className="block mt-1 text-amber-400 text-xs">Official setting context will be used for canon accuracy.</span>
        )}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Level Range</label>
          <select
            value={levelRange}
            onChange={(e) => setLevelRange(e.target.value)}
            disabled={isLoading}
            className={`${inputBaseClasses} w-full px-3 py-2 text-sm`}
          >
            {LEVEL_RANGE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === '' ? 'Any Level' : `Levels ${opt}`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Party Size</label>
          <input
            type="number"
            min={1}
            max={10}
            value={partySize}
            onChange={(e) => setPartySize(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
            disabled={isLoading}
            className={`${inputBaseClasses} w-full px-3 py-2 text-sm`}
          />
        </div>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g., A mystery in a wizard's tower where spells have started to go haywire."
        rows={4}
        className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 outline-none resize-y placeholder:text-slate-600"
        disabled={isLoading}
      />

      <div className="flex flex-wrap gap-2">
        {PROMPT_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => setPrompt(chip)}
            disabled={isLoading}
            className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-full px-3 py-1 transition-colors disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
      <Button
        onClick={handleQuickGenerate}
        disabled={isLoading || !buildFullPrompt().trim()}
        size="lg"
        className="w-full mt-auto"
      >
        {isLoading ? 'Generating...' : 'Generate Adventure'}
      </Button>
    </div>
  );
};
