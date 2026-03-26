
import React, { useState, useEffect } from 'react';
import type { Campaign, SettingType } from '../../types/index';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { analyzeWritingStyle } from '../../services/aiService';

interface CampaignSettingEditorProps {
  campaign: Campaign;
  onUpdate: (data: Partial<Campaign>) => void;
  isMockMode?: boolean;
  campaignContext?: string;
  onSetStyleProfile?: (profile: string) => void;
  onClearStyleProfile?: () => void;
}

const OFFICIAL_SETTINGS = [
  "Forgotten Realms",
  "Ravenloft",
  "Eberron",
  "DragonLance",
  "Crooked Moon",
  "Warhammer Old World"
];

const STYLE_THRESHOLD = 5;

export const CampaignSettingEditor: React.FC<CampaignSettingEditorProps> = ({
  campaign,
  onUpdate,
  isMockMode = false,
  campaignContext,
  onSetStyleProfile,
  onClearStyleProfile,
}) => {
  const [formData, setFormData] = useState({
    title: campaign.title,
    setting: campaign.setting,
    settingType: campaign.settingType,
    officialSetting: campaign.officialSetting || OFFICIAL_SETTINGS[0],
    gcpApiKey: campaign.gcpApiKey || '',
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  useEffect(() => {
    setFormData({
      title: campaign.title,
      setting: campaign.setting,
      settingType: campaign.settingType,
      officialSetting: campaign.officialSetting || OFFICIAL_SETTINGS[0],
      gcpApiKey: campaign.gcpApiKey || '',
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
      formData.officialSetting !== campaign.officialSetting ||
      formData.gcpApiKey !== (campaign.gcpApiKey || '')
    ) {
      onUpdate(formData);
    }
  };

  const toggleSettingType = (type: SettingType) => {
    setFormData(prev => ({ ...prev, settingType: type }));
    onUpdate({ ...formData, settingType: type });
  };

  const totalEntities =
    campaign.npcs.length +
    campaign.locations.length +
    campaign.factions.length +
    campaign.items.length +
    campaign.articles.length +
    campaign.adventures.length;

  const canGenerateStyle = totalEntities >= STYLE_THRESHOLD;

  const handleRegenerateStyle = async () => {
    if (!onSetStyleProfile) return;
    setIsAnalyzing(true);
    setAnalyzeError(null);
    try {
      const samples: string[] = [
        ...campaign.npcs.slice(0, 10).map(n => n.description).filter(Boolean),
        ...campaign.locations.slice(0, 5).map(l => l.description).filter(Boolean),
        ...campaign.adventures.slice(0, 3).map(a => a.hook).filter(Boolean),
      ] as string[];

      if (samples.length === 0) {
        setAnalyzeError('No descriptive text found in entities. Add descriptions to NPCs, locations, or adventures first.');
        return;
      }

      const profile = await analyzeWritingStyle(samples, isMockMode, campaignContext);
      if (profile) {
        onSetStyleProfile(profile);
      } else {
        setAnalyzeError('Analysis returned an empty result. Try again after adding more content.');
      }
    } catch (err) {
      console.error('[StyleMatching] Regeneration failed:', err);
      setAnalyzeError('Analysis failed. Check your connection or try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClearStyle = () => {
    if (onClearStyleProfile) {
      onClearStyleProfile();
    }
    setAnalyzeError(null);
  };

  return (
    <div className="space-y-6 bg-slate-900/50 p-6 rounded-xl border border-slate-800/50 max-w-2xl">
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">Campaign Title</label>
        <input
          type="text"
          name="title"
          value={formData.title}
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all placeholder:text-slate-600"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">Setting Configuration</label>
        <div className="flex gap-4 mb-3">
          <button
            onClick={() => toggleSettingType('custom')}
            className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${formData.settingType === 'custom' ? 'bg-amber-600/20 border-amber-500 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
          >
            Custom World
          </button>
          <button
            onClick={() => toggleSettingType('official')}
            className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${formData.settingType === 'official' ? 'bg-amber-600/20 border-amber-500 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
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
            className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all"
          >
            {OFFICIAL_SETTINGS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1">
            <Icons.Sparkles className="w-3 h-3" />
            Generators will use official setting context to ensure accuracy with {formData.officialSetting} lore.
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">
          {formData.settingType === 'official' ? 'Supplemental Lore & Artifacts (Overrides Canon)' : 'World Setting Synopsis'}
        </label>
        <textarea
          name="setting"
          value={formData.setting}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={12}
          className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all placeholder:text-slate-600 resize-y"
          placeholder={formData.settingType === 'official' ? "Add your own homebrew lore, artifacts, or deviations from the official canon here..." : "A high-level description of the world, its history, and its current state..."}
        />
      </div>

      {/* Google Cloud API Key (for audio transcription only) */}
      <div className="border-t border-slate-800 pt-6">
        <div className="flex items-center gap-2 mb-3">
          <Icons.Mic className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-slate-300">Google Cloud API Key (optional)</h3>
        </div>
        <input
          type="password"
          name="gcpApiKey"
          value={formData.gcpApiKey}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="Paste your GCP API key here..."
          className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all placeholder:text-slate-600 font-mono text-sm"
        />
        <p className="text-xs text-slate-500 mt-1.5">
          Enables real-time audio transcription in Session Logs. Your key is stored locally and never sent to our servers.
        </p>
      </div>

      {/* Writing Style Section */}
      <div className="border-t border-slate-800 pt-6">
        <div className="flex items-center gap-2 mb-3">
          <Icons.Edit className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-slate-300">Writing Style Profile</h3>
        </div>

        {campaign.styleProfile ? (
          <div className="space-y-3">
            <blockquote className="border-l-2 border-amber-600 pl-4 py-2 bg-slate-800/50 rounded-r-md text-sm text-slate-300 italic leading-relaxed">
              {campaign.styleProfile}
            </blockquote>
            <p className="text-xs text-slate-500">
              This profile is injected into all AI generation prompts to match your writing voice.
            </p>
            {analyzeError && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <Icons.AlertTriangle className="w-3 h-3 flex-shrink-0" />
                {analyzeError}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRegenerateStyle}
                disabled={isAnalyzing || !canGenerateStyle}
              >
                {isAnalyzing ? (
                  <Icons.Loader className="w-3 h-3 animate-spin mr-1.5" />
                ) : (
                  <Icons.Sparkles className="w-3 h-3 mr-1.5" />
                )}
                {isAnalyzing ? 'Analyzing...' : 'Regenerate'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleClearStyle}
                disabled={isAnalyzing}
              >
                <Icons.X className="w-3 h-3 mr-1.5" />
                Clear
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {canGenerateStyle ? (
              <p className="text-sm text-slate-400">
                No style profile yet. Generate one to have the AI match your writing voice in all future content.
              </p>
            ) : (
              <p className="text-sm text-slate-500 italic">
                Style profile will generate automatically after {STYLE_THRESHOLD}+ entities are created.
                You currently have {totalEntities}.
              </p>
            )}
            {analyzeError && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <Icons.AlertTriangle className="w-3 h-3 flex-shrink-0" />
                {analyzeError}
              </p>
            )}
            {canGenerateStyle && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleRegenerateStyle}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <Icons.Loader className="w-3 h-3 animate-spin mr-1.5" />
                ) : (
                  <Icons.Sparkles className="w-3 h-3 mr-1.5" />
                )}
                {isAnalyzing ? 'Analyzing your writing...' : 'Generate Style Profile'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
