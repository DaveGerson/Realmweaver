import React, { useRef } from 'react';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { getAllTemplateMeta } from '../../data/templates/index';

interface WelcomeScreenProps {
  /** Primary CTA — opens the campaign creator (template picker → form). */
  onStart: () => void;
  onImportCampaign?: (file: File) => void;
  /**
   * Secondary path — jump straight into a starter template. When omitted,
   * picking a template falls back to `onStart`, which lands on the creator's
   * template picker so the GM can choose it there.
   */
  onStartFromTemplate?: (templateId: string) => void;
  /**
   * Lazy DM on-ramp — create a campaign, then land on Tonight's Table
   * (strong start, a few scenes, or straight to the table with no prep).
   */
  onStartLazy?: () => void;
  /** When true, a small hint explains that AI content is simulated. */
  isMockMode?: boolean;
}

interface ValueStep {
  title: string;
  body: string;
  icon: React.ReactNode;
}

const VALUE_STEPS: ValueStep[] = [
  {
    title: 'Build your world',
    body: 'Sketch the big picture — a conflict, a tone, a few people with power. The AI fills in NPCs, places, and factions that fit.',
    icon: <Icons.WorldSim className="w-6 h-6" />,
  },
  {
    title: 'Prep sessions',
    body: 'A strong start, a few secrets, a handful of scenes. Prep in 15 minutes the Lazy DM way — only what tonight needs.',
    icon: <Icons.Calendar className="w-6 h-6" />,
  },
  {
    title: 'Run the table',
    body: 'Keep notes, initiative, and improvised names one click away while the story happens live.',
    icon: <Icons.Combat className="w-6 h-6" />,
  },
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStart,
  onImportCampaign,
  onStartFromTemplate,
  onStartLazy,
  isMockMode = false,
}) => {
  const importInputRef = useRef<HTMLInputElement>(null);
  // Reuse the same template registry the CampaignCreator picker uses —
  // metadata only; full JSON is still loaded lazily via loadTemplateData.
  const templates = getAllTemplateMeta();

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportCampaign) {
      onImportCampaign(file);
    }
    // Reset so the same file can be re-imported if needed
    if (importInputRef.current) {
      importInputRef.current.value = '';
    }
  };

  const handleTemplateClick = (templateId: string) => {
    if (onStartFromTemplate) {
      onStartFromTemplate(templateId);
    } else {
      onStart();
    }
  };

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:py-12" aria-labelledby="welcome-heading">
      <div className="w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-500">
        {/* Hero */}
        <header className="text-center">
          <Icons.Campaign className="w-14 h-14 sm:w-16 sm:h-16 mx-auto text-amber-500" aria-hidden="true" />
          <h1 id="welcome-heading" className="mt-5 text-3xl sm:text-4xl font-bold font-serif text-slate-100">
            Welcome to RealmWeaver
          </h1>
          <p className="mt-2 text-base sm:text-lg text-slate-400 max-w-xl mx-auto">
            Your AI-powered companion for crafting unforgettable tabletop RPG campaigns.
          </p>
        </header>

        {/* 3-step value explainer */}
        <section aria-labelledby="welcome-how-heading" className="mt-10">
          <h2 id="welcome-how-heading" className="sr-only">How RealmWeaver helps</h2>
          <ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {VALUE_STEPS.map((step, index) => (
              <li
                key={step.title}
                className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-amber-400" aria-hidden="true">{step.icon}</span>
                  <h3 className="font-semibold text-slate-100">
                    <span className="text-amber-400 mr-1.5">{index + 1}.</span>
                    {step.title}
                  </h3>
                </div>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Primary CTA */}
        <div className="mt-10 flex flex-col items-center">
          <Button onClick={onStart} size="lg" className="w-full sm:w-auto">
            Create a Campaign
          </Button>
          <p className="mt-2 text-xs text-slate-500">Takes about a minute. You can change everything later.</p>

          {onStartLazy && (
            <div className="mt-5 w-full max-w-md rounded-lg border border-amber-600/40 bg-amber-600/10 p-4 text-left">
              <Button
                type="button"
                variant="secondary"
                onClick={onStartLazy}
                className="w-full"
              >
                <Icons.Zap className="w-4 h-4 mr-2" aria-hidden="true" />
                Prep in 15 minutes the Lazy DM way
              </Button>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Name your world, then land on Tonight&apos;s Table: draft a strong start and a few
                scenes — or skip prep and go straight to the table.
              </p>
            </div>
          )}

          {onImportCampaign && (
            <>
              <input
                ref={importInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelected}
                className="hidden"
                aria-hidden="true"
              />
              <Button
                type="button"
                variant="ghost"
                onClick={handleImportClick}
                className="mt-3 underline underline-offset-4 text-slate-400 hover:text-amber-400"
              >
                Import an existing campaign
              </Button>
            </>
          )}

          {isMockMode && (
            <p
              role="note"
              className="mt-4 max-w-md text-xs text-slate-400 bg-slate-800/60 border border-slate-700 rounded-md px-3 py-2 flex items-start gap-2 text-left"
            >
              <Icons.Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
              <span>
                Mock mode is on — AI results are sample content, so you can explore freely.
                Once your AI backend is running, turn off the Mock Mode toggle in the campaign header.
              </span>
            </p>
          )}
        </div>

        {/* Secondary path: starter templates */}
        {templates.length > 0 && (
          <section aria-labelledby="welcome-templates-heading" className="mt-12">
            <div className="text-center">
              <h2 id="welcome-templates-heading" className="text-xl font-semibold font-serif text-slate-100">
                Or start from a template
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                A ready-to-run world with NPCs, locations, and adventures already in place.
              </p>
            </div>
            <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {templates.map(meta => (
                <li key={meta.id}>
                  <button
                    type="button"
                    onClick={() => handleTemplateClick(meta.id)}
                    aria-label={`Start from template: ${meta.title}`}
                    className="w-full h-full text-left bg-slate-800/60 border border-slate-700 rounded-lg p-4 hover:border-amber-600/60 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 transition-colors"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-sm text-slate-100">{meta.title}</span>
                      <span className="shrink-0 text-[11px] bg-slate-700 text-slate-300 rounded px-2 py-0.5">
                        {meta.playstyle}
                      </span>
                    </span>
                    <span className="block text-xs text-amber-400 mt-0.5">{meta.subtitle}</span>
                    <span className="block text-xs text-slate-400 mt-2 leading-relaxed line-clamp-2">
                      {meta.description}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
};
