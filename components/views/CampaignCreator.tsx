
import React, { useState } from 'react';
import { Button } from '../common/Button';
import { Icons } from '../common/Icons';
import type { SettingType } from '../../types/index';
import type { DmStyle } from '../../types/index';

interface CampaignCreatorProps {
  onCreateCampaign: (title: string, setting: string, settingType: SettingType, officialSetting?: string, dmStyle?: DmStyle) => void;
}

const OFFICIAL_SETTINGS = [
  "Forgotten Realms",
  "Ravenloft",
  "Eberron",
  "DragonLance",
  "Crooked Moon",
  "Warhammer Old World"
];

const DM_STYLE_OPTIONS: Array<{
  value: DmStyle;
  label: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
}> = [
  {
    value: 'guided',
    label: "I'm New to DMing",
    description: "Focus on the essentials. Advanced tools are hidden until you need them.",
    icon: <Icons.Adventures className="w-7 h-7" />,
    badge: 'Guided',
  },
  {
    value: 'standard',
    label: "I Keep It Simple",
    description: "A balanced toolkit for experienced DMs. All the core tools, nothing overwhelming.",
    icon: <Icons.Exploration className="w-7 h-7" />,
    badge: 'Recommended',
  },
  {
    value: 'power',
    label: "Give Me Everything",
    description: "Every tool, every panel, every option — nothing hidden.",
    icon: <Icons.Zap className="w-7 h-7" />,
    badge: 'Power',
  },
];

export const CampaignCreator: React.FC<CampaignCreatorProps> = ({ onCreateCampaign }) => {
  const [title, setTitle] = useState('');
  const [settingType, setSettingType] = useState<SettingType>('official');
  const [officialSetting, setOfficialSetting] = useState(OFFICIAL_SETTINGS[0]);
  const [settingDescription, setSettingDescription] = useState('');
  const [dmStyle, setDmStyle] = useState<DmStyle>('standard');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onCreateCampaign(
        title,
        settingDescription,
        settingType,
        settingType === 'official' ? officialSetting : undefined,
        dmStyle
      );
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl mx-auto animate-in fade-in duration-500">
        <header className="text-center mb-8">
          <Icons.Sparkles className="w-12 h-12 mx-auto text-amber-500" />
          <h1 className="mt-4 text-3xl font-bold font-serif text-slate-100">Create Your Campaign</h1>
          <p className="mt-1 text-slate-400">
            Start with the big picture. You can add adventures and details later.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="bg-slate-900/50 p-8 rounded-xl border border-slate-800 space-y-6">
          {/* Campaign Title */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Campaign Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all placeholder:text-slate-600"
              placeholder="The Sundered Crown"
              required
            />
          </div>

          {/* Setting Type */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Setting Type</label>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="settingType"
                  value="official"
                  checked={settingType === 'official'}
                  onChange={() => setSettingType('official')}
                  className="mr-2 text-amber-500 focus:ring-amber-500 bg-slate-800 border-slate-600"
                />
                <span className="text-sm text-slate-300">Official Setting</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="settingType"
                  value="custom"
                  checked={settingType === 'custom'}
                  onChange={() => setSettingType('custom')}
                  className="mr-2 text-amber-500 focus:ring-amber-500 bg-slate-800 border-slate-600"
                />
                <span className="text-sm text-slate-300">Custom World</span>
              </label>
            </div>
          </div>

          {settingType === 'official' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Select Setting</label>
              <select
                value={officialSetting}
                onChange={(e) => setOfficialSetting(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all"
              >
                {OFFICIAL_SETTINGS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1">
                <Icons.Sparkles className="w-3 h-3" />
                Official settings use Google Search to find canon lore.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">
              {settingType === 'official' ? 'Supplemental Lore & Artifacts' : 'World Setting Description'}
            </label>
            <textarea
              value={settingDescription}
              onChange={(e) => setSettingDescription(e.target.value)}
              rows={5}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all placeholder:text-slate-600 resize-y"
              placeholder={settingType === 'official'
                ? "Add your own homebrew lore, artifacts, or deviations from the official canon here..."
                : "A high-level description of the world, its history, and its current state..."}
            />
          </div>

          {/* DM Style Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-3">How do you like to run your games?</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {DM_STYLE_OPTIONS.map((option) => {
                const isSelected = dmStyle === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDmStyle(option.value)}
                    className={[
                      'relative flex flex-col items-start gap-2 p-4 rounded-lg border-2 text-left transition-all duration-150',
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10 text-white'
                        : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800',
                    ].join(' ')}
                  >
                    {option.badge && (
                      <span className={[
                        'absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide',
                        option.value === 'standard'
                          ? 'bg-amber-600 text-white'
                          : option.value === 'guided'
                          ? 'bg-slate-600 text-slate-300'
                          : 'bg-indigo-600 text-white',
                      ].join(' ')}>
                        {option.badge}
                      </span>
                    )}
                    <span className={isSelected ? 'text-amber-400' : 'text-slate-400'}>
                      {option.icon}
                    </span>
                    <span className="font-semibold text-sm leading-tight pr-8">{option.label}</span>
                    <span className="text-xs text-slate-400 leading-snug">{option.description}</span>
                    {isSelected && (
                      <span className="absolute bottom-2 right-2">
                        <Icons.CheckCircle className="w-4 h-4 text-amber-400" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-2">You can change this anytime from the campaign settings.</p>
          </div>

          <Button type="submit" size="lg" className="w-full">
            <Icons.Campaign className="w-4 h-4 mr-2" />
            Weave Campaign
          </Button>
        </form>
      </div>
    </div>
  );
};
