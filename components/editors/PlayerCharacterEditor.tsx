
import React, { useState, useEffect } from 'react';
import type { PlayerCharacter, AbilityScores, Skills, ProficiencyLevel } from '../../types/index';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';

interface PlayerCharacterEditorProps {
  pc: PlayerCharacter;
  onUpdate: (id: string, updatedData: Partial<PlayerCharacter>) => void;
  onDelete: (id: string) => void;
}

export const PlayerCharacterEditor: React.FC<PlayerCharacterEditorProps> = ({ pc, onUpdate, onDelete }) => {
  const [formData, setFormData] = useState(pc);

  useEffect(() => {
    setFormData(pc);
  }, [pc]);

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${pc.characterSocial.characterName}?`)) {
        onDelete(pc.id);
    }
  };

  const getModifier = (score: number) => {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-fade-in">
      <header className="flex justify-between items-start">
        <div className="space-y-2">
            <div className="flex items-center gap-3 text-amber-400">
              <Icons.PlayerCharacters className="w-8 h-8" />
              <div>
                <h1 className="text-3xl font-bold font-serif text-slate-100">{formData.characterSocial.characterName}</h1>
                <p className="text-slate-400">{formData.characterSocial.species} {formData.characterStatistics.classes.charClass} {formData.characterStatistics.classes.level}</p>
              </div>
            </div>
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
                    <h3 className="font-semibold text-slate-200 mb-3 text-center">Ability Scores</h3>
                    <div className="grid grid-cols-3 gap-3 text-center">
                        {Object.entries(formData.characterStatistics.attributes).map(([ability, score]) => (
                             <div key={ability} className="bg-slate-950 p-2 rounded-md border border-slate-800">
                                <div className="text-xs text-slate-400 uppercase">{ability.substring(0,3)}</div>
                                <div className="text-2xl font-bold text-slate-100">{score}</div>
                                <div className="text-sm text-amber-400 font-semibold">{getModifier(score as number)}</div>
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
                                <span className={`font-semibold text-xs px-2 py-0.5 rounded-full ${proficiency === 'proficient' ? 'bg-green-800 text-green-200' : proficiency === 'expertise' ? 'bg-indigo-800 text-indigo-200' : 'text-slate-500'}`}>{proficiency}</span>
                            </div>
                        ))}
                     </div>
                </div>
            </div>

            {/* Right Column: Social & Backstory */}
            <div className="lg:col-span-2 space-y-6">
                 <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/50">
                     <h3 className="font-semibold text-slate-200 mb-2">Social Traits</h3>
                     <div className="space-y-3">
                        <InfoField label="Personality" text={formData.characterSocial.personality} />
                        <InfoField label="Ideals" text={formData.characterSocial.ideals} />
                        <InfoField label="Bonds" text={formData.characterSocial.bonds} />
                        <InfoField label="Flaws" text={formData.characterSocial.flaws} />
                     </div>
                </div>
                 <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/50">
                     <h3 className="font-semibold text-slate-200 mb-2">Backstory</h3>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{formData.characterSocial.backstory}</p>
                </div>
                 <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/50">
                     <h3 className="font-semibold text-slate-200 mb-2">Actions & Features</h3>
                     <div className="text-sm text-slate-300 space-y-1 list-disc list-inside">
                        {formData.characterStatistics.actions.map((action, i) => <li key={i}>{action}</li>)}
                        {formData.characterStatistics.specialActions.map((action, i) => <li key={i}>{action}</li>)}
                     </div>
                </div>
            </div>
        </div>
    </div>
  );
};


const InfoField = ({label, text} : {label: string, text: string}) => (
    <div>
        <h4 className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{label}</h4>
        <p className="text-sm text-slate-300">{text}</p>
    </div>
)
