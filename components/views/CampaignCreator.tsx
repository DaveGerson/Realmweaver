
import React, { useState } from 'react';
import { Button } from '../common/Button';
import { Icons } from '../common/Icons';
import type { SettingType } from '../../types/index';
import type { DmStyle } from '../../types/index';
import { getAllTemplateMeta, loadTemplateData, type TemplateMeta } from '../../data/templates/index';
import type { TestCampaignMeta } from '../../data/test-campaigns/index';

interface CampaignCreatorProps {
  onCreateCampaign: (title: string, setting: string, settingType: SettingType, officialSetting?: string, dmStyle?: DmStyle) => void;
  onTemplateSelected?: (templateData: Record<string, unknown>) => void;
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

// --- Template Selector Step ---

interface EntityCountBadgeProps {
  count: number;
  label: string;
  icon: React.ReactNode;
}

const EntityCountBadge: React.FC<EntityCountBadgeProps> = ({ count, label, icon }) => {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-slate-700 text-slate-300 rounded px-2 py-0.5">
      {icon}
      {count} {label}
    </span>
  );
};

interface TemplateCardProps {
  meta: TemplateMeta;
  onSelect: (id: string) => void;
  isLoading: boolean;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ meta, onSelect, isLoading }) => {
  const isLocal = 'isTestCampaign' in meta && (meta as TestCampaignMeta).isTestCampaign;
  return (
    <div className={`flex flex-col bg-slate-800 border rounded-lg p-4 gap-3 hover:border-slate-600 transition-colors ${isLocal ? 'border-amber-700/50' : 'border-slate-700'}`}>
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-slate-100 text-sm leading-tight">
              {meta.title}
              {isLocal && <span className="ml-2 text-[10px] font-medium bg-amber-600/20 text-amber-400 border border-amber-600/30 rounded px-1.5 py-0.5 align-middle">Local</span>}
            </h3>
            <p className="text-amber-400 text-xs mt-0.5">{meta.subtitle}</p>
          </div>
          <span className="shrink-0 text-xs bg-slate-700 text-slate-400 rounded px-2 py-0.5 whitespace-nowrap">
            {meta.playstyle}
          </span>
        </div>
        <p className="text-slate-400 text-xs mt-2 leading-relaxed line-clamp-3">{meta.description}</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <EntityCountBadge
          count={meta.entityCounts.npcs}
          label="NPCs"
          icon={<Icons.NPCs className="w-3 h-3" />}
        />
        <EntityCountBadge
          count={meta.entityCounts.locations}
          label="Locations"
          icon={<Icons.Locations className="w-3 h-3" />}
        />
        <EntityCountBadge
          count={meta.entityCounts.factions}
          label="Factions"
          icon={<Icons.Factions className="w-3 h-3" />}
        />
        <EntityCountBadge
          count={meta.entityCounts.adventures}
          label={meta.entityCounts.adventures === 1 ? 'Adventure' : 'Adventures'}
          icon={<Icons.Adventures className="w-3 h-3" />}
        />
        {meta.entityCounts.scenes > 0 && (
          <EntityCountBadge
            count={meta.entityCounts.scenes}
            label="Scenes"
            icon={<Icons.Scenes className="w-3 h-3" />}
          />
        )}
        <EntityCountBadge
          count={meta.entityCounts.plots}
          label="Plots"
          icon={<Icons.Plot className="w-3 h-3" />}
        />
      </div>

      <Button
        size="sm"
        onClick={() => onSelect(meta.id)}
        disabled={isLoading}
        className="w-full mt-auto"
      >
        {isLoading ? (
          <>
            <Icons.Loader className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            Loading...
          </>
        ) : (
          <>
            <Icons.Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Use This Template
          </>
        )}
      </Button>
    </div>
  );
};

interface TemplateSelectorStepProps {
  onTemplateChosen: (templateId: string) => Promise<void>;
  onSkip: () => void;
  loadingTemplateId: string | null;
}

const TemplateSelectorStep: React.FC<TemplateSelectorStepProps> = ({
  onTemplateChosen,
  onSkip,
  loadingTemplateId,
}) => {
  return (
    <div className="w-full max-w-3xl mx-auto animate-in fade-in duration-500">
      <header className="text-center mb-6">
        <Icons.Sparkles className="w-10 h-10 mx-auto text-amber-500" />
        <h1 className="mt-3 text-2xl font-bold font-serif text-slate-100">Start With a Template?</h1>
        <p className="mt-1 text-slate-400 text-sm">
          Jump in with a pre-built world — NPCs, locations, and adventures ready to run.
          Or start from scratch and build your own.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        {getAllTemplateMeta().map(meta => (
          <TemplateCard
            key={meta.id}
            meta={meta}
            onSelect={onTemplateChosen}
            isLoading={loadingTemplateId === meta.id}
          />
        ))}
      </div>

      <div className="flex justify-center">
        <Button
          variant="ghost"
          onClick={onSkip}
          className="underline underline-offset-2 text-slate-400 hover:text-slate-200"
        >
          Start From Scratch — I'll build my own world
        </Button>
      </div>
    </div>
  );
};

// --- Main Campaign Creator ---

type CreatorStep = 'template-select' | 'campaign-form';

export const CampaignCreator: React.FC<CampaignCreatorProps> = ({ onCreateCampaign, onTemplateSelected }) => {
  const [step, setStep] = useState<CreatorStep>('template-select');
  const [title, setTitle] = useState('');
  const [settingType, setSettingType] = useState<SettingType>('official');
  const [officialSetting, setOfficialSetting] = useState(OFFICIAL_SETTINGS[0]);
  const [settingDescription, setSettingDescription] = useState('');
  const [dmStyle, setDmStyle] = useState<DmStyle>('standard');
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const handleTemplateChosen = async (templateId: string) => {
    setLoadingTemplateId(templateId);
    setTemplateError(null);
    try {
      const templateData = await loadTemplateData(templateId);
      if (!templateData) {
        setTemplateError('Failed to load template. Please try again.');
        return;
      }

      // Pre-fill the form fields from the template
      if (templateData.title && typeof templateData.title === 'string') {
        setTitle(templateData.title);
      }
      if (templateData.setting && typeof templateData.setting === 'string') {
        setSettingDescription(templateData.setting);
      }
      // Detect official settings from template data
      if (templateData.settingType === 'official' && typeof templateData.officialSetting === 'string'
        && OFFICIAL_SETTINGS.includes(templateData.officialSetting)) {
        setSettingType('official');
        setOfficialSetting(templateData.officialSetting);
      } else {
        setSettingType('custom');
      }

      // Proceed to the campaign form step with template data attached
      if (onTemplateSelected) {
        onTemplateSelected(templateData);
      }

      setStep('campaign-form');
    } catch (err) {
      console.error('Template load error:', err);
      setTemplateError('Failed to load template. Please try again.');
    } finally {
      setLoadingTemplateId(null);
    }
  };

  const handleSkipTemplate = () => {
    setStep('campaign-form');
  };

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

  if (step === 'template-select') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {templateError && (
          <div className="mb-4 w-full max-w-3xl bg-red-900/30 border border-red-700 rounded-lg px-4 py-2 text-red-300 text-sm flex items-center gap-2">
            <Icons.AlertTriangle className="w-4 h-4 shrink-0" />
            {templateError}
          </div>
        )}
        <TemplateSelectorStep
          onTemplateChosen={handleTemplateChosen}
          onSkip={handleSkipTemplate}
          loadingTemplateId={loadingTemplateId}
        />
      </div>
    );
  }

  // Campaign form step
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
          {/* Back to templates */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setStep('template-select')}
            className="text-slate-400 hover:text-slate-200"
          >
            <Icons.ChevronLeft className="w-3.5 h-3.5 mr-1" />
            Back to templates
          </Button>

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
                Official settings use AI-assisted canon knowledge for lore generation.
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
            <div role="radiogroup" aria-label="DM Style" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {DM_STYLE_OPTIONS.map((option) => {
                const isSelected = dmStyle === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
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
                          : 'bg-amber-600 text-white',
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
