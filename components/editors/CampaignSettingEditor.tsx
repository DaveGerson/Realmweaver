
import React, { useState, useEffect } from 'react';
import type { Campaign, SettingType } from '../../types/index';
import { Icons } from '../common/Icons';

interface CampaignSettingEditorProps {
  campaign: Campaign;
  onUpdate: (data: Partial<Campaign>) => void;
}

const OFFICIAL_SETTINGS = [
  "Forgotten Realms",
  "Ravenloft",
  "Eberron",
  "DragonLance",
  "Crooked Moon",
  "Warhammer Old World"
];

export const CampaignSettingEditor: React.FC<CampaignSettingEditorProps> = ({ campaign, onUpdate }) => {
  const [formData, setFormData] = useState({ 
      title: campaign.title, 
      setting: campaign.setting,
      settingType: campaign.settingType,
      officialSetting: campaign.officialSetting || OFFICIAL_SETTINGS[0]
  });

  useEffect(() => {
    setFormData({ 
        title: campaign.title, 
        setting: campaign.setting,
        settingType: campaign.settingType,
        officialSetting: campaign.officialSetting || OFFICIAL_SETTINGS[0]
    });
  }, [campaign]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBlur = () => {
    if (
        formData.title !== campaign.title || 
        formData.setting !== campaign.setting ||
        formData.settingType !== campaign.settingType ||
        formData.officialSetting !== campaign.officialSetting
    ) {
      onUpdate(formData);
    }
  };

  const toggleSettingType = (type: SettingType) => {
      setFormData(prev => ({ ...prev, settingType: type }));
      // We don't auto-save here, wait for a blur or specific action, 
      // but since this is a toggle, we might want to trigger update immediately or on next blur.
      // For simplicity, let's trigger update immediately to reflect UI state if needed elsewhere.
      onUpdate({ ...formData, settingType: type });
  }

  return (
    <div className="space-y-6 bg-slate-900/50 p-6 rounded-xl border border-slate-800/50 max-w-2xl">
        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Campaign Title</label>
            <input type="text" name="title" value={formData.title} onChange={handleChange} onBlur={handleBlur} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"/>
        </div>

        <div>
             <label className="block text-sm font-medium text-slate-400 mb-1.5">Setting Configuration</label>
             <div className="flex gap-4 mb-3">
                <button 
                    onClick={() => toggleSettingType('custom')}
                    className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${formData.settingType === 'custom' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
                >
                    Custom World
                </button>
                <button 
                    onClick={() => toggleSettingType('official')}
                    className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${formData.settingType === 'official' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
                >
                    Official Setting
                </button>
             </div>
        </div>

        {formData.settingType === 'official' && (
             <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Official Setting</label>
                <select
                    name="officialSetting"
                    value={formData.officialSetting}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                >
                     {OFFICIAL_SETTINGS.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
                <p className="text-xs text-indigo-400 mt-1.5 flex items-center gap-1">
                    <Icons.Sparkles className="w-3 h-3" />
                    Generators will use Google Search to ensure accuracy with {formData.officialSetting} lore.
                </p>
            </div>
        )}

        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">
                {formData.settingType === 'official' ? 'Supplemental Lore & Artifacts (Overrides Canon)' : 'World Setting Synopsis'}
            </label>
            <textarea name="setting" value={formData.setting} onChange={handleChange} onBlur={handleBlur} rows={12} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600 resize-y" placeholder={formData.settingType === 'official' ? "Add your own homebrew lore, artifacts, or deviations from the official canon here..." : "A high-level description of the world, its history, and its current state..."} />
        </div>
    </div>
  )
};
