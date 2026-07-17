
import React, { useState, useRef, useEffect } from 'react';
import type { NPC, Faction } from '@/types/index';
import { generateNpc } from '@/services/aiService';
import { Icons } from '@/components/common/Icons';
import { Button } from '@/components/common/Button';
import { DialogShell } from '@/components/common/DialogShell';
import { SkeletonGeneratorOverlay } from '@/components/common/SkeletonCard';
import { EntityChatGenerator } from '@/components/generators/EntityChatGenerator';
import { NpcEditor } from '@/components/editors/NpcEditor';
import { createDefaultNpc } from '@/utils/entityUtils';
import { inputBaseClasses } from '@/components/common/Textarea';

interface NpcGeneratorProps {
  onNpcCreated: (npc: Omit<NPC, 'id'>) => void;
  isMockMode: boolean;
  isOfficialSetting?: boolean;
  factions?: Faction[];
  allNpcs?: NPC[];
  campaignContext?: string;
}

const PROMPT_CHIPS = [
  'A mysterious tavern keeper',
  'A corrupt noble with a secret',
  'A battle-scarred veteran seeking redemption',
  "A young wizard's apprentice",
];

const CR_OPTIONS = [
  '', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', 'Non-combat',
];

const ALIGNMENT_OPTIONS = [
  '',
  'Lawful Good', 'Neutral Good', 'Chaotic Good',
  'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
  'Lawful Evil', 'Neutral Evil', 'Chaotic Evil',
  'Unaligned',
];

export const NpcGenerator: React.FC<NpcGeneratorProps> = ({
  onNpcCreated,
  isMockMode,
  isOfficialSetting = false,
  factions = [],
  allNpcs = [],
  campaignContext,
}) => {
  const [mode, setMode] = useState<'quick' | 'chat'>('quick');
  const [prompt, setPrompt] = useState('');
  const [cr, setCr] = useState('');
  const [alignment, setAlignment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    // Set true in the effect body (not just via the initial ref value) so the
    // guard survives StrictMode's mount -> cleanup -> remount cycle in dev.
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const buildFullPrompt = (): string => {
    const parts: string[] = [];
    if (cr) parts.push(`[CR ${cr}]`);
    if (alignment) parts.push(`[${alignment}]`);
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
      const npcData = await generateNpc(fullPrompt, isMockMode, campaignContext);
      // Component may have unmounted (e.g. user navigated away) while this request was in flight.
      if (!isMountedRef.current) return;
      const newNpc: Omit<NPC, 'id'> = {
        ...npcData,
        factionId: undefined,
      };
      onNpcCreated(newNpc);
      setPrompt('');
      setCr('');
      setAlignment('');
    } catch (err) {
      if (isMountedRef.current) {
        setError('Failed to generate NPC. Please check your API key and try again.');
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
              entityType="npc"
              isMockMode={isMockMode}
              campaignContext={campaignContext}
              onEntityCreated={(data) => {
                const { id, ...npcData } = data;
                onNpcCreated(npcData);
                setMode('quick');
              }}
              initialData={createDefaultNpc()}
              renderPreview={(data, onUpdate) => (
                <NpcEditor
                  npc={{ ...data, id: 'preview' }}
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
      </DialogShell>

      {mode === 'quick' && (
        <div className="relative bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4 h-full flex flex-col">
          {isLoading && <SkeletonGeneratorOverlay />}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icons.Wizard className="w-7 h-7 text-amber-400" />
              <h2 className="text-2xl font-bold font-serif text-slate-100">NPC Generator</h2>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setMode('chat')}>
              <Icons.Chat className="w-4 h-4 mr-2" /> Create via Chat
            </Button>
          </div>

          <p className="text-sm text-slate-400">
            Describe an NPC and let the AI bring them to life.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Challenge Rating</label>
              <select
                value={cr}
                onChange={(e) => setCr(e.target.value)}
                disabled={isLoading}
                className={`${inputBaseClasses} w-full px-3 py-2 text-sm`}
              >
                {CR_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === '' ? 'Any CR' : opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Alignment</label>
              <select
                value={alignment}
                onChange={(e) => setAlignment(e.target.value)}
                disabled={isLoading}
                className={`${inputBaseClasses} w-full px-3 py-2 text-sm`}
              >
                {ALIGNMENT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === '' ? 'Any Alignment' : opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              isOfficialSetting ? "e.g., Drizzt Do'Urden, Elminster" : 'e.g., A gruff dwarven blacksmith...'
            }
            rows={4}
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
            disabled={isLoading || !buildFullPrompt().trim()}
            size="lg"
            className="w-full mt-auto"
          >
            {isLoading ? 'Generating...' : 'Generate NPC'}
          </Button>
        </div>
      )}
    </>
  );
};
