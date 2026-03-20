
import React, { useState } from 'react';
import { Button } from '../common/Button';
import { Icons } from '../common/Icons';
import type { SettingType } from '../../types/index';

interface CampaignCreatorProps {
  onCreateCampaign: (title: string, setting: string, settingType: SettingType, officialSetting?: string) => void;
}

const OFFICIAL_SETTINGS = [
  "Forgotten Realms",
  "Ravenloft",
  "Eberron",
  "DragonLance",
  "Crooked Moon",
  "Warhammer Old World"
];

export const CampaignCreator: React.FC<CampaignCreatorProps> = ({ onCreateCampaign }) => {
  const [title, setTitle] = useState('');
  const [settingType, setSettingType] = useState<SettingType>('official'); // Default to official
  const [officialSetting, setOfficialSetting] = useState(OFFICIAL_SETTINGS[0]); // Default to Forgotten Realms
  const [settingDescription, setSettingDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onCreateCampaign(title, settingDescription, settingType, settingType === 'official' ? officialSetting : undefined);
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
                        placeholder={settingType === 'official' ? "Add your own homebrew lore, artifacts, or deviations from the official canon here..." : "A high-level description of the world, its history, and its current state..."}
                    />
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
