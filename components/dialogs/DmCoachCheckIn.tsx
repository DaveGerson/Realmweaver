
import React, { useEffect, useRef, useState } from 'react';
import type { Campaign } from '../../types/index';
import { generateCheckInQuestions } from '../../services/aiService';
import { buildCampaignContext } from '../../services/contextBuilder';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';

/**
 * Table Pulse (lazy-dm-research.md §4.3) — the "Ask the Table" tab body for
 * `DmCoach.tsx`. Split into its own file rather than grown inline so
 * `DmCoach.tsx` stays a thin tab host (tab wiring only) and this panel can be
 * rendered and tested on its own.
 *
 * Zero-prompt by construction (docs/design/lazy-dm-lens.md §5 — no crafted
 * prompt as the entry point): there is no text box here, typed or otherwise.
 * One button produces 4-5 short between-session questions the DM can copy
 * and send to their players. When the roster has any recorded
 * `PlayerCharacter.playerFlags` (Table Pulse's own editor field),
 * `generateCheckInQuestions` reads them straight off `campaign` and folds
 * them into the prompt — this component only has to hand the campaign over.
 *
 * Matches the rest of `DmCoach.tsx` today: results are copy-only. Nothing
 * here calls `campaignService.addAutoEvent` — the dialog's other tools don't
 * auto-log their output either (see `App.tsx`'s comment on `onSendToNotes`),
 * so this tool doesn't invent a new precedent.
 */

interface CheckInPanelProps {
  campaign: Campaign;
  isMockMode: boolean;
}

export const CheckInPanel: React.FC<CheckInPanelProps> = ({ campaign, isMockMode }) => {
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mirrors the generator-guard convention (components/CLAUDE.md): set in an
  // effect body so it survives StrictMode's mount -> cleanup -> remount, and
  // checked before every setState below so a press that resolves after this
  // tab has been switched away from (unmounting the panel) never touches
  // state on an unmounted component.
  const isMountedRef = useRef(false);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);

    const campaignContext = buildCampaignContext({
      variant: 'coach',
      campaign,
      activeSceneId: campaign.activeSceneId,
      activeSessionId: campaign.activeSessionId,
      maxTokenEstimate: 2000,
    });

    try {
      const result = await generateCheckInQuestions({ campaign, campaignContext }, isMockMode);
      if (!isMountedRef.current) return;
      setQuestions(result);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError('Failed to get a response from the AI. Please try again.');
      console.error(err);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 pt-0 overflow-y-auto custom-scrollbar">
      <div className="space-y-4">
        <div>
          <h3 className="text-md font-semibold font-serif text-slate-200">Ask the Table</h3>
          <p className="text-sm text-slate-400">Get a few warm questions worth sending your players between sessions — you don't have to come up with your own.</p>
        </div>

        {error && (
          <div className="flex items-start gap-3 text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg p-3">
            <Icons.AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-snug">{error}</p>
            </div>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleGenerate}
              disabled={isLoading}
              className="flex-shrink-0 text-xs"
            >
              Try Again
            </Button>
          </div>
        )}

        <Button onClick={handleGenerate} disabled={isLoading} className="w-full">
          {isLoading ? (
            <><Icons.Coach className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
          ) : (
            <><Icons.Chat className="w-4 h-4 mr-2" /> Generate</>
          )}
        </Button>
      </div>

      {questions && questions.length > 0 && (
        <div className="mt-6">
          <CheckInQuestionsList questions={questions} />
        </div>
      )}
    </div>
  );
};

const CheckInQuestionsList: React.FC<{ questions: string[] }> = ({ questions }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [hasCopiedAll, setHasCopiedAll] = useState(false);

  const handleCopyLine = (line: string, index: number) => {
    if (!navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(line)
      .then(() => {
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(current => (current === index ? null : current)), 2000);
      })
      .catch(() => { /* copy failed silently; no success state shown */ });
  };

  const handleCopyAll = () => {
    if (!navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(questions.join('\n'))
      .then(() => {
        setHasCopiedAll(true);
        setTimeout(() => setHasCopiedAll(false), 2000);
      })
      .catch(() => { /* copy failed silently; no success state shown */ });
  };

  return (
    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
      <ul className="space-y-2">
        {questions.map((question, index) => (
          <li key={index} className="flex items-start justify-between gap-2">
            <span className="flex-1 text-sm text-slate-300 leading-relaxed">{question}</span>
            <Button
              variant="icon"
              onClick={() => handleCopyLine(question, index)}
              className="flex-shrink-0 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              aria-label={`Copy question: ${question}`}
            >
              {copiedIndex === index ? <Icons.Check className="w-3.5 h-3.5 text-green-400" /> : <Icons.Clipboard className="w-3.5 h-3.5" />}
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="secondary" size="sm" onClick={handleCopyAll} className="w-full">
        {hasCopiedAll ? (
          <><Icons.Check className="w-3.5 h-3.5 mr-1.5 text-green-400" /> Copied All</>
        ) : (
          <><Icons.Clipboard className="w-3.5 h-3.5 mr-1.5" /> Copy All</>
        )}
      </Button>
    </div>
  );
};
