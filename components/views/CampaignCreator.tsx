
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../common/Button';
import { Icons } from '../common/Icons';
import type { SettingType } from '../../types/index';
import type { DmStyle } from '../../types/index';
import { getAllTemplateMeta, loadTemplateData, type TemplateMeta } from '../../data/templates/index';
import type { TestCampaignMeta } from '../../data/testCampaigns';

interface CampaignCreatorProps {
  onCreateCampaign: (title: string, setting: string, settingType: SettingType, officialSetting?: string, dmStyle?: DmStyle) => void;
  onTemplateSelected?: (templateData: Record<string, unknown> | null) => void;
  /**
   * Template picked before the creator opened (e.g. on the Welcome screen).
   * Loaded once on mount through the same path as clicking its card.
   */
  initialTemplateId?: string;
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

// --- Custom World seed questions ---

/** Clickable prompts that scaffold a Custom World description. Exported for tests. */
export const SEED_QUESTIONS: ReadonlyArray<{ label: string; stub: string }> = [
  { label: 'Central conflict', stub: "What's the central conflict?" },
  { label: 'Tone', stub: "What's the tone?" },
  { label: 'Who holds power', stub: 'Who holds power, and who wants it?' },
  { label: 'First hook', stub: "What's the first adventure hook?" },
  { label: 'Something strange', stub: 'What makes this world strange or unique?' },
  { label: 'Starting place', stub: 'Where do the heroes start?' },
];

/** Thresholds (characters) for the setting-description quality nudge. */
export const SETTING_LENGTH_THRESHOLDS = { minimal: 80, solid: 300 } as const;

/**
 * Appends a question stub to the textarea value on its own line, followed by
 * a space so the GM can type the answer right after it.
 */
export function appendSeedQuestion(current: string, stub: string): string {
  const trimmedEnd = current.replace(/\s+$/, '');
  if (!trimmedEnd) return `${stub} `;
  return `${trimmedEnd}\n${stub} `;
}

function getSettingNudge(length: number): { tone: 'low' | 'mid' | 'good'; text: string } {
  if (length < SETTING_LENGTH_THRESHOLDS.minimal) {
    return { tone: 'low', text: 'A sentence or two gives the AI something to build on — try a seed question.' };
  }
  if (length < SETTING_LENGTH_THRESHOLDS.solid) {
    return { tone: 'mid', text: 'Good start. Answer another seed question or two for richer results.' };
  }
  return { tone: 'good', text: 'Plenty of detail for the AI to work with.' };
}

const NUDGE_TONE_CLASSES: Record<'low' | 'mid' | 'good', string> = {
  low: 'text-slate-500',
  mid: 'text-amber-400',
  good: 'text-emerald-400',
};

const GOOD_EXAMPLE = `Central conflict: The Salt Crown has shattered, and three river cities each hold a shard — whoever reunites it commands the tides.
Tone: Gritty and hopeful; low magic, high stakes, lots of banter.
Who holds power: Merchant-princes of Vessa, the drowned-god priesthood, and a smuggler queen nobody has seen in ten years.
First hook: A shard surfaces in a fishing net, and every faction learns about it the same night.`;

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

export const CampaignCreator: React.FC<CampaignCreatorProps> = ({ onCreateCampaign, onTemplateSelected, initialTemplateId }) => {
  const [step, setStep] = useState<CreatorStep>('template-select');
  const [title, setTitle] = useState('');
  const [settingType, setSettingType] = useState<SettingType>('official');
  const [officialSetting, setOfficialSetting] = useState(OFFICIAL_SETTINGS[0]);
  const [settingDescription, setSettingDescription] = useState('');
  const [dmStyle, setDmStyle] = useState<DmStyle>('standard');
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const settingTextareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Auto-load a template chosen before the creator opened (Welcome screen).
  // The ref guard keeps StrictMode's double-invoked effect from loading twice.
  const initialTemplateHandledRef = useRef(false);
  useEffect(() => {
    if (initialTemplateId && !initialTemplateHandledRef.current) {
      initialTemplateHandledRef.current = true;
      void handleTemplateChosen(initialTemplateId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only by design
  }, []);

  const handleInsertSeedQuestion = (stub: string) => {
    const next = appendSeedQuestion(settingDescription, stub);
    setSettingDescription(next);
    // Put the caret at the end so the GM can answer straight away.
    requestAnimationFrame(() => {
      const el = settingTextareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(next.length, next.length);
      }
    });
  };

  // Finding #20 (verifier follow-up): onTemplateSelected(null) stops the
  // bulk-import, but it does not undo the form pre-fill handleTemplateChosen
  // performed (title/settingDescription/settingType/officialSetting). Without
  // this, a GM who backs out of a template and picks "Start From Scratch"
  // still submits with the template's title and world description attached.
  const resetTemplatePrefill = () => {
    setTitle('');
    setSettingDescription('');
    setSettingType('official');
    setOfficialSetting(OFFICIAL_SETTINGS[0]);
  };

  const handleSkipTemplate = () => {
    if (onTemplateSelected) {
      onTemplateSelected(null);
    }
    resetTemplatePrefill();
    setStep('campaign-form');
  };

  const handleBackToTemplates = () => {
    if (onTemplateSelected) {
      onTemplateSelected(null);
    }
    resetTemplatePrefill();
    setStep('template-select');
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
            onClick={handleBackToTemplates}
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
            <label htmlFor="campaign-setting-description" className="block text-sm font-medium text-slate-400 mb-1.5">
              {settingType === 'official' ? 'Supplemental Lore & Artifacts' : 'World Setting Description'}
            </label>
            {settingType === 'custom' && (
              <div className="mb-2 animate-in fade-in duration-200">
                <p id="seed-questions-hint" className="text-xs text-slate-500 mb-1.5">
                  Not sure where to start? Add a question, then answer it:
                </p>
                <div role="group" aria-label="Seed questions" className="flex flex-wrap gap-1.5">
                  {SEED_QUESTIONS.map(q => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => handleInsertSeedQuestion(q.stub)}
                      aria-label={`Add question: ${q.stub}`}
                      className="inline-flex items-center gap-1 text-xs rounded-full border border-slate-700 bg-slate-800 text-slate-300 px-2.5 py-1 hover:border-amber-600/60 hover:text-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 transition-colors"
                    >
                      <Icons.Plus className="w-3 h-3" aria-hidden="true" />
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <textarea
              id="campaign-setting-description"
              ref={settingTextareaRef}
              value={settingDescription}
              onChange={(e) => setSettingDescription(e.target.value)}
              rows={settingType === 'custom' ? 7 : 5}
              aria-describedby={settingType === 'custom' ? 'setting-length-nudge' : undefined}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all placeholder:text-slate-600 resize-y"
              placeholder={settingType === 'official'
                ? "Add your own homebrew lore, artifacts, or deviations from the official canon here..."
                : "A high-level description of the world, its history, and its current state..."}
            />
            {settingType === 'custom' && (() => {
              const nudge = getSettingNudge(settingDescription.trim().length);
              return (
                <>
                  <p
                    id="setting-length-nudge"
                    className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs"
                  >
                    <span className={NUDGE_TONE_CLASSES[nudge.tone]} aria-live="polite" data-testid="setting-quality-nudge">{nudge.text}</span>
                    <span className="text-slate-500 tabular-nums" data-testid="setting-char-count">
                      {settingDescription.length} characters
                    </span>
                  </p>
                  <details className="mt-2 group rounded-md border border-slate-800 bg-slate-900/60">
                    <summary className="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-amber-400">
                      <Icons.ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" aria-hidden="true" />
                      What good looks like
                    </summary>
                    <div className="px-3 pb-3">
                      <p className="text-xs text-slate-500 mb-1.5">
                        Short, specific answers beat long history lessons. Something like:
                      </p>
                      <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed border-l-2 border-amber-600/60 pl-2">
                        {GOOD_EXAMPLE}
                      </p>
                    </div>
                  </details>
                </>
              );
            })()}
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
