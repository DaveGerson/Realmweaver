
import React, { useState, useEffect } from 'react';
import type { Campaign } from '../../types/index';

interface CampaignSettingEditorProps {
  campaign: Campaign;
  onUpdate: (data: Partial<Campaign>) => void;
}

export const CampaignSettingEditor: React.FC<CampaignSettingEditorProps> = ({ campaign, onUpdate }) => {
  const [formData, setFormData] = useState({ title: campaign.title, setting: campaign.setting });

  useEffect(() => {
    setFormData({ title: campaign.title, setting: campaign.setting });
  }, [campaign]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBlur = () => {
    if (formData.title !== campaign.title || formData.setting !== campaign.setting) {
      onUpdate(formData);
    }
  };

  return (
    <div className="space-y-6 bg-slate-900/50 p-6 rounded-xl border border-slate-800/50 max-w-2xl">
        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Campaign Title</label>
            <input type="text" name="title" value={formData.title} onChange={handleChange} onBlur={handleBlur} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"/>
        </div>
        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">World Setting Synopsis</label>
            <textarea name="setting" value={formData.setting} onChange={handleChange} onBlur={handleBlur} rows={12} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600 resize-y" placeholder="A high-level description of the world, its history, and its current state..." />
        </div>
    </div>
  )
};
