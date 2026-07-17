
import React, { useState, useRef, useEffect } from 'react';
import type { Scene, NPC, Location } from '@/types/index';
import { generateScene } from '@/services/aiService';
import { Icons } from '@/components/common/Icons';
import { Button } from '@/components/common/Button';
import { DialogShell } from '@/components/common/DialogShell';
import { SkeletonGeneratorOverlay } from '@/components/common/SkeletonCard';
import { EntityChatGenerator } from '@/components/generators/EntityChatGenerator';
import { SceneEditor } from '@/components/editors/SceneEditor';
import { createDefaultScene } from '@/utils/entityUtils';

interface SceneGeneratorProps {
  onSceneCreated: (scene: Omit<Scene, 'id'>) => void;
  isMockMode: boolean;
  isOfficialSetting?: boolean;
  allNpcs?: NPC[];
  allLocations?: Location[];
  campaignContext?: string;
}

const PROMPT_CHIPS = [
  'A tense negotiation with a rival faction',
  'An ambush in a narrow mountain pass',
  'A mysterious discovery in ancient ruins',
  'A daring escape from a collapsing dungeon',
];

export const SceneGenerator: React.FC<SceneGeneratorProps> = ({
  onSceneCreated,
  isMockMode,
  isOfficialSetting = false,
  allNpcs = [],
  allLocations = [],
  campaignContext,
}) => {
  const [mode, setMode] = useState<'quick' | 'chat'>('quick');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleQuickGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const sceneData = await generateScene(prompt, isMockMode, campaignContext);
      // Component may have unmounted (e.g. user navigated away) while this request was in flight.
      if (!isMountedRef.current) return;
      const newScene: Omit<Scene, 'id'> = {
        ...sceneData,
        locationId: undefined,
        npcIds: [],
      };
      onSceneCreated(newScene);
      setPrompt('');
    } catch (err) {
      if (isMountedRef.current) {
        setError('Failed to generate scene. Please check your API key and try again.');
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
              entityType="scene"
              isMockMode={isMockMode}
              campaignContext={campaignContext}
              onEntityCreated={(data) => {
                const { id, ...sceneData } = data;
                onSceneCreated(sceneData);
                setMode('quick');
              }}
              initialData={createDefaultScene()}
              renderPreview={(data, onUpdate) => (
                <SceneEditor
                  scene={{ ...data, id: 'preview' }}
                  allNpcs={allNpcs}
                  allLocations={allLocations}
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
              <h2 className="text-2xl font-bold font-serif text-slate-100">Scene Generator</h2>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setMode('chat')}>
              <Icons.Chat className="w-4 h-4 mr-2" /> Create via Chat
            </Button>
          </div>

          <p className="text-sm text-slate-400">
            Describe a situation, and the AI will build a complete scene with read-aloud text and GM notes.
            {isOfficialSetting && (
              <span className="block mt-1 text-amber-400 text-xs">Official setting context will be used for canon accuracy.</span>
            )}
          </p>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., A tense negotiation with a goblin chief"
            rows={5}
            className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 outline-none resize-y placeholder:text-slate-600"
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
            disabled={isLoading || !prompt.trim()}
            size="lg"
            className="w-full mt-auto"
          >
            {isLoading ? 'Generating...' : 'Generate Scene'}
          </Button>
        </div>
      )}
    </>
  );
};
