
import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import type { PlayerCharacter, AbilityScores } from '../../types/index';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { BacklinksPanel } from '../common/BacklinksPanel';
import { inputBaseClasses, textareaBaseClasses } from '../common/Textarea';
import { campaignService } from '@/services/campaignService';
import type { QuickCardEntityType } from '../common/EntityQuickCard';

// ─── Save Status Indicator ────────────────────────────────────────────────────

const SaveStatusIndicator: React.FC = () => {
  const { saveStatus } = useSyncExternalStore(
    campaignService.subscribe,
    campaignService.getState,
  );
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (saveStatus === 'saved') {
      setShowSaved(true);
      const t = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [saveStatus]);

  if (saveStatus === 'saving') {
    return (
      <span className="flex items-center gap-1 text-xs text-slate-400">
        <Icons.Loader className="w-3 h-3 animate-spin" />
        Saving…
      </span>
    );
  }
  if (saveStatus === 'error') {
    return <span className="text-xs text-red-400">Save error</span>;
  }
  if (showSaved) {
    return <span className="text-xs text-slate-400 transition-opacity duration-500">Saved</span>;
  }
  return null;
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface PlayerCharacterEditorProps {
  pc: PlayerCharacter;
  onUpdate: (id: string, updatedData: Partial<PlayerCharacter>) => void;
  onDelete: (id: string) => void;
  onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
}

// ─── Editor ───────────────────────────────────────────────────────────────────

export const PlayerCharacterEditor: React.FC<PlayerCharacterEditorProps> = ({ pc, onUpdate, onDelete, onNavigate }) => {
  const [formData, setFormData] = useState(pc);
  const [showEditStats, setShowEditStats] = useState(false);
  const { confirm } = useConfirmDialog();

  // Tracks the last `pc` prop we've reconciled against, so incoming prop
  // updates can be merged field-by-field instead of overwriting formData wholesale.
  const prevPcRef = useRef(pc);

  useEffect(() => {
    const prevPc = prevPcRef.current;
    if (prevPc.id !== pc.id) {
      // Switched to viewing a different character entirely — fully adopt it.
      setFormData(pc);
    } else if (prevPc !== pc) {
      // Same character, but the underlying object changed elsewhere. Only adopt
      // fields the user hasn't started editing since the last sync — any field
      // where formData still matches what we last saw from `pc`. Fields the
      // user has locally changed (unblurred edits) are preserved.
      setFormData(prev => {
        const merged = { ...prev };
        (Object.keys(pc) as (keyof PlayerCharacter)[]).forEach((key) => {
          if (prev[key] === prevPc[key]) {
            merged[key] = pc[key];
          }
        });
        return merged;
      });
    }
    prevPcRef.current = pc;
  }, [pc]);

  const handleDelete = async () => {
    const confirmed = await confirm('Delete Character', `Are you sure you want to delete ${pc.characterSocial.characterName}?`, { variant: 'danger' });
    if (confirmed) {
      onDelete(pc.id);
    }
  };

  // ── Social trait handlers ──────────────────────────────────────────────────

  const handleSocialChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      characterSocial: { ...prev.characterSocial, [name]: value },
    }));
  };

  const handleSocialBlur = (e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const { name } = e.target;
    if (formData.characterSocial[name as keyof typeof formData.characterSocial] !==
        pc.characterSocial[name as keyof typeof pc.characterSocial]) {
      onUpdate(pc.id, { characterSocial: formData.characterSocial });
    }
  };

  // ── Ability score handlers ─────────────────────────────────────────────────

  const handleAbilityChange = (ability: keyof AbilityScores, raw: string) => {
    const value = parseInt(raw, 10);
    if (isNaN(value)) return;
    setFormData(prev => ({
      ...prev,
      characterStatistics: {
        ...prev.characterStatistics,
        attributes: { ...prev.characterStatistics.attributes, [ability]: value },
      },
    }));
  };

  const handleAbilityBlur = () => {
    onUpdate(pc.id, { characterStatistics: formData.characterStatistics });
  };

  const getModifier = (score: number) => {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-fade-in">
      <header className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-3 text-amber-400">
            <Icons.PlayerCharacters className="w-8 h-8" />
            <div>
              <h1 className="text-3xl font-bold font-serif text-slate-100">{formData.characterSocial.characterName}</h1>
              <p className="text-slate-400">{formData.characterSocial.species} {formData.characterStatistics.classes.charClass} {formData.characterStatistics.classes.level}</p>
            </div>
          </div>
          <SaveStatusIndicator />
        </div>
        <Button variant="danger" size="sm" onClick={handleDelete}>
          <Icons.Trash className="w-3.5 h-3.5 mr-2" />
          Delete Character
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Stats & Skills */}
        <div className="lg:col-span-1 space-y-6">
          {/* Ability Scores */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/50">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-slate-200">Ability Scores</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEditStats(v => !v)}
              >
                <Icons.Edit className="w-3.5 h-3.5 mr-1.5" />
                {showEditStats ? 'Done' : 'Edit'}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {(Object.entries(formData.characterStatistics.attributes) as [keyof AbilityScores, number][]).map(([ability, score]) => (
                <div key={ability} className="bg-slate-950 p-2 rounded-md border border-slate-800">
                  <div className="text-xs text-slate-400 uppercase">{ability.substring(0, 3)}</div>
                  {showEditStats ? (
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={score}
                      onChange={e => handleAbilityChange(ability, e.target.value)}
                      onBlur={handleAbilityBlur}
                      className="w-full text-center text-xl font-bold bg-slate-800 border border-slate-700 rounded text-slate-100 focus:ring-1 focus:ring-amber-500 outline-none mt-0.5"
                    />
                  ) : (
                    <div className="text-2xl font-bold text-slate-100">{score}</div>
                  )}
                  <div className="text-sm text-amber-400 font-semibold">{getModifier(score)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Skills */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/50">
            <h3 className="font-semibold text-slate-200 mb-3">Skills</h3>
            <div className="space-y-1.5 text-sm">
              {Object.entries(formData.characterStatistics.skills).map(([skill, proficiency]) => (
                <div key={skill} className="flex justify-between items-center p-1 rounded">
                  <span className="text-slate-300 capitalize">{skill.replace(/_/g, ' ')}</span>
                  <span className={`font-semibold text-xs px-2 py-0.5 rounded-full ${proficiency === 'proficient' ? 'bg-green-800 text-green-200' : proficiency === 'expertise' ? 'bg-amber-800 text-amber-200' : 'text-slate-500'}`}>{proficiency}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Social & Backstory */}
        <div className="lg:col-span-2 space-y-6">
          {/* Social Traits — now editable */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/50">
            <h3 className="font-semibold text-slate-200 mb-3">Social Traits</h3>
            <div className="space-y-4">
              {(
                [
                  { name: 'personality', label: 'Personality' },
                  { name: 'ideals', label: 'Ideals' },
                  { name: 'bonds', label: 'Bonds' },
                  { name: 'flaws', label: 'Flaws' },
                ] as { name: keyof typeof formData.characterSocial; label: string }[]
              ).map(({ name, label }) => (
                <div key={name}>
                  <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">{label}</label>
                  <textarea
                    name={name}
                    value={formData.characterSocial[name] as string}
                    onChange={handleSocialChange}
                    onBlur={handleSocialBlur}
                    rows={2}
                    className={`${textareaBaseClasses} w-full px-3 py-2 text-sm`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Backstory — now editable */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/50">
            <h3 className="font-semibold text-slate-200 mb-2">Backstory</h3>
            <textarea
              name="backstory"
              value={formData.characterSocial.backstory}
              onChange={handleSocialChange}
              onBlur={handleSocialBlur}
              rows={8}
              className={`${textareaBaseClasses} w-full px-3 py-2 text-sm`}
            />
          </div>

          {/* Actions & Features — read-only display */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/50">
            <h3 className="font-semibold text-slate-200 mb-2">Actions & Features</h3>
            <div className="text-sm text-slate-300 space-y-1 list-disc list-inside">
              {formData.characterStatistics.actions.map((action, i) => <li key={i}>{action}</li>)}
              {formData.characterStatistics.specialActions.map((action, i) => <li key={i}>{action}</li>)}
            </div>
          </div>
        </div>
      </div>

      {/* Backlinks Panel */}
      <BacklinksPanel entityId={pc.id} entityType="player-character" onNavigate={onNavigate} />
    </div>
  );
};
