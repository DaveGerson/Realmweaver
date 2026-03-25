
import React, { useState, useRef } from 'react';
import type { PlayerCharacter } from '@/types/index';
import { Icons } from '@/components/common/Icons';
import { Button } from '@/components/common/Button';
import { inputBaseClasses, textareaBaseClasses } from '@/components/common/Textarea';

interface PlayerCharacterImporterProps {
  onImport: (file: File) => Promise<void>;
  isMockMode: boolean;
  /**
   * Optional callback for the Quick Add path. When provided, a "Quick Add" tab
   * is shown alongside the PDF import tab. When absent the component behaves
   * exactly as it did before this change.
   */
  onPlayerCharacterCreated?: (pc: Omit<PlayerCharacter, 'id'>) => void;
}

type Tab = 'pdf' | 'manual';

const DEFAULT_ABILITY_SCORES = { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 };

const ABILITY_LABELS: Array<{ key: keyof typeof DEFAULT_ABILITY_SCORES; label: string }> = [
  { key: 'strength',     label: 'STR' },
  { key: 'dexterity',    label: 'DEX' },
  { key: 'constitution', label: 'CON' },
  { key: 'intelligence', label: 'INT' },
  { key: 'wisdom',       label: 'WIS' },
  { key: 'charisma',     label: 'CHA' },
];

const DEFAULT_SKILLS = {
  acrobatics: 'none', animal_handling: 'none', arcana: 'none', athletics: 'none',
  deception: 'none', history: 'none', insight: 'none', intimidation: 'none',
  investigation: 'none', medicine: 'none', nature: 'none', perception: 'none',
  performance: 'none', persuasion: 'none', religion: 'none', sleight_of_hand: 'none',
  stealth: 'none', survival: 'none',
} as const;

export const PlayerCharacterImporter: React.FC<PlayerCharacterImporterProps> = ({
  onImport,
  isMockMode,
  onPlayerCharacterCreated,
}) => {
  // PDF import state
  const [isLoading, setIsLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab state — only show tabs when onPlayerCharacterCreated is provided
  const hasManualPath = Boolean(onPlayerCharacterCreated);
  const [activeTab, setActiveTab] = useState<Tab>('pdf');

  // Quick Add form state
  const [name, setName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [species, setSpecies] = useState('');
  const [charClass, setCharClass] = useState('');
  const [level, setLevel] = useState<number | ''>(1);
  const [abilityScores, setAbilityScores] = useState({ ...DEFAULT_ABILITY_SCORES });
  const [notes, setNotes] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  // PDF handlers
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setPdfError(null);
    try {
      await onImport(file);
    } catch (err) {
      setPdfError('Failed to import character sheet. The PDF might be in an unsupported format.');
      console.error(err);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Quick Add handler
  const handleManualSubmit = () => {
    if (!name.trim()) {
      setManualError('Character name is required.');
      return;
    }
    if (!onPlayerCharacterCreated) return;
    setManualError(null);

    const newPc: Omit<PlayerCharacter, 'id'> = {
      playerName: playerName.trim() || 'Unknown Player',
      characterSocial: {
        characterName: name.trim(),
        species: species.trim(),
        background: '',
        personality: '',
        appearance: '',
        backstory: notes.trim(),
        ideals: '',
        bonds: '',
        flaws: '',
      },
      characterStatistics: {
        classes: {
          charClass: charClass.trim() || 'Unknown',
          level: typeof level === 'number' && level > 0 ? level : 1,
        },
        attributes: { ...abilityScores },
        skills: { ...DEFAULT_SKILLS },
        actions: [],
        specialActions: [],
      },
    };
    onPlayerCharacterCreated(newPc);

    // Reset form
    setName('');
    setPlayerName('');
    setSpecies('');
    setCharClass('');
    setLevel(1);
    setAbilityScores({ ...DEFAULT_ABILITY_SCORES });
    setNotes('');
  };

  const updateAbilityScore = (key: keyof typeof DEFAULT_ABILITY_SCORES, raw: string) => {
    const parsed = parseInt(raw, 10);
    setAbilityScores((prev) => ({ ...prev, [key]: isNaN(parsed) ? 0 : Math.max(1, Math.min(30, parsed)) }));
  };

  return (
    <div className="relative bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4 h-full flex flex-col">
      {isLoading && (
        <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl z-10">
          <Icons.Sparkles className="w-10 h-10 text-amber-400 animate-spin" />
          <p className="mt-4 text-md text-slate-300">Reading Character Sheet...</p>
          <p className="text-xs text-slate-400">(This may take a moment)</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Icons.PlayerCharacters className="w-7 h-7 text-amber-400" />
        <h2 className="text-2xl font-bold font-serif text-slate-100">Add Character</h2>
      </div>

      {/* Tab bar — only rendered when the quick-add callback is available */}
      {hasManualPath && (
        <div className="flex border-b border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab('pdf')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'pdf'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Import PDF
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'manual'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Quick Add
          </button>
        </div>
      )}

      {/* PDF import panel */}
      {activeTab === 'pdf' && (
        <>
          <p className="text-sm text-slate-400 flex-grow">
            Upload a character sheet PDF from D&amp;D Beyond. The AI will parse it and add the character to your campaign.
          </p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="application/pdf"
            disabled={isLoading}
          />
          {pdfError && <p className="text-xs text-red-400 text-center">{pdfError}</p>}
          <Button onClick={handleButtonClick} disabled={isLoading} size="lg" className="w-full mt-auto">
            {isLoading ? 'Importing...' : 'Import from PDF'}
          </Button>
        </>
      )}

      {/* Quick Add panel */}
      {activeTab === 'manual' && hasManualPath && (
        <div className="flex flex-col gap-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm text-slate-400 mb-1">
                Character Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Aldric Ironveil"
                className={`${inputBaseClasses} w-full px-3 py-2 text-sm`}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Player Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="e.g., Alex"
                className={`${inputBaseClasses} w-full px-3 py-2 text-sm`}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Species / Race</label>
              <input
                type="text"
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                placeholder="e.g., Half-Elf"
                className={`${inputBaseClasses} w-full px-3 py-2 text-sm`}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Class</label>
              <input
                type="text"
                value={charClass}
                onChange={(e) => setCharClass(e.target.value)}
                placeholder="e.g., Paladin"
                className={`${inputBaseClasses} w-full px-3 py-2 text-sm`}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Level</label>
              <input
                type="number"
                min={1}
                max={20}
                value={level}
                onChange={(e) => setLevel(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                className={`${inputBaseClasses} w-full px-3 py-2 text-sm`}
              />
            </div>
          </div>

          <div>
            <p className="text-sm text-slate-400 mb-2">Ability Scores</p>
            <div className="grid grid-cols-3 gap-2">
              {ABILITY_LABELS.map(({ key, label }) => (
                <div key={key} className="text-center">
                  <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">
                    {label}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={abilityScores[key]}
                    onChange={(e) => updateAbilityScore(key, e.target.value)}
                    className={`${inputBaseClasses} w-full px-2 py-2 text-sm text-center`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Backstory, personality traits, equipment, or anything else..."
              rows={3}
              className={`${textareaBaseClasses} w-full px-3 py-2 text-sm`}
            />
          </div>

          {manualError && <p className="text-xs text-red-400">{manualError}</p>}

          <Button
            onClick={handleManualSubmit}
            disabled={!name.trim()}
            size="lg"
            className="w-full mt-auto"
          >
            Add Character
          </Button>
        </div>
      )}
    </div>
  );
};
