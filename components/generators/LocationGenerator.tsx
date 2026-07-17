
import React, { useState, useRef, useEffect } from 'react';
import type { Location, Faction } from '@/types/index';
import { generateLocation } from '@/services/aiService';
import { Icons } from '@/components/common/Icons';
import { Button } from '@/components/common/Button';
import { DialogShell } from '@/components/common/DialogShell';
import { SkeletonGeneratorOverlay } from '@/components/common/SkeletonCard';
import { EntityChatGenerator } from '@/components/generators/EntityChatGenerator';
import { LocationEditor } from '@/components/editors/LocationEditor';
import { createDefaultLocation } from '@/utils/entityUtils';
import { inputBaseClasses } from '@/components/common/Textarea';

interface LocationGeneratorProps {
  onLocationCreated: (location: Omit<Location, 'id'>) => void;
  isMockMode: boolean;
  isOfficialSetting?: boolean;
  allLocations?: Location[];
  factions?: Faction[];
  campaignContext?: string;
}

const PROMPT_CHIPS = [
  'A haunted forest clearing',
  'A bustling market district',
  'An ancient dwarven forge',
  'A hidden coastal smuggler\'s cove',
];

const BIOME_OPTIONS = [
  '', 'Forest', 'Mountain', 'Desert', 'Urban', 'Coastal',
  'Underground', 'Swamp', 'Arctic', 'Planar',
];

export const LocationGenerator: React.FC<LocationGeneratorProps> = ({
  onLocationCreated,
  isMockMode,
  isOfficialSetting = false,
  allLocations = [],
  factions = [],
  campaignContext,
}) => {
  const [mode, setMode] = useState<'quick' | 'chat'>('quick');
  const [prompt, setPrompt] = useState('');
  const [biome, setBiome] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const buildFullPrompt = (): string => {
    const parts: string[] = [];
    if (biome) parts.push(`[${biome}]`);
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
      const locationData = await generateLocation(fullPrompt, isMockMode, campaignContext);
      // Component may have unmounted (e.g. user navigated away) while this request was in flight.
      if (!isMountedRef.current) return;
      const newLocation: Omit<Location, 'id'> = {
        ...locationData,
        parentLocationId: undefined,
        subLocationIds: [],
        connections: [],
        pointsOfInterest: [],
        loot: [],
      };
      onLocationCreated(newLocation);
      setPrompt('');
      setBiome('');
    } catch (err) {
      if (isMountedRef.current) {
        setError('Failed to generate location. Please check your API key and try again.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  return (
    <>
      <DialogShell
        isOpen={mode === 'chat'}
        onClose={() => setMode('quick')}
        ariaLabel="Conversational Creator"
        className="w-full max-w-6xl mx-4 h-[90vh]"
      >
        <div className="bg-slate-950 border border-slate-800 rounded-xl shadow-2xl h-full p-6 flex flex-col animate-in fade-in zoom-in-95 duration-200">
          <div className="mb-4 flex justify-between items-center flex-shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setMode('quick')}>
              <Icons.ChevronDown className="w-4 h-4 mr-2 rotate-90" /> Back to Quick Generator
            </Button>
            <h2 className="text-lg font-bold font-serif text-slate-100">Conversational Creator</h2>
          </div>
          <div className="flex-1 min-h-0 border border-slate-800 rounded-xl shadow-2xl overflow-hidden bg-slate-900">
            <EntityChatGenerator
              entityType="location"
              isMockMode={isMockMode}
              campaignContext={campaignContext}
              onEntityCreated={(data) => {
                const { id, ...locationData } = data;
                onLocationCreated(locationData);
                setMode('quick');
              }}
              initialData={createDefaultLocation()}
              renderPreview={(data, onUpdate) => (
                <LocationEditor
                  location={{ ...data, id: 'preview' }}
                  allLocations={allLocations}
                  allFactions={factions}
                  onUpdate={(_, updates) => onUpdate(updates)}
                  onDelete={() => {}}
                  isMockMode={isMockMode}
                />
              )}
            />
          </div>
        </div>
      </DialogShell>

      {mode === 'quick' && (
        <div className="relative bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4 h-full flex flex-col">
          {isLoading && <SkeletonGeneratorOverlay />}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icons.Wizard className="w-7 h-7 text-amber-400" />
              <h2 className="text-2xl font-bold font-serif text-slate-100">Location Generator</h2>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setMode('chat')}>
              <Icons.Chat className="w-4 h-4 mr-2" /> Create via Chat
            </Button>
          </div>

          <p className="text-sm text-slate-400">
            Describe a location, and the AI will create a vivid description and hidden secrets.
            {isOfficialSetting && (
              <span className="block mt-1 text-amber-400 text-xs">Official setting context will be used for canon accuracy.</span>
            )}
          </p>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Biome / Setting</label>
            <select
              value={biome}
              onChange={(e) => setBiome(e.target.value)}
              disabled={isLoading}
              className={`${inputBaseClasses} w-full px-3 py-2 text-sm`}
            >
              {BIOME_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === '' ? 'Any Biome' : opt}
                </option>
              ))}
            </select>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., A forgotten library hidden behind a waterfall."
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
            {isLoading ? 'Generating...' : 'Generate Location'}
          </Button>
        </div>
      )}
    </>
  );
};
