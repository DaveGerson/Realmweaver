import React, { useRef, useState } from 'react';
import { Icons } from '@/components/common/Icons';
import { Button } from '@/components/common/Button';
import { DialogShell } from '@/components/common/DialogShell';
import { SkeletonGeneratorOverlay } from '@/components/common/SkeletonCard';
import { EntityChatGenerator } from '@/components/generators/EntityChatGenerator';
import { useAiRequest } from '@/hooks/useAiRequest';
import { inputBaseClasses } from '@/components/common/Textarea';

type ChatEntityType = React.ComponentProps<typeof EntityChatGenerator>['entityType'];

export interface QuickGeneratorFormProps<T> {
  /** Entity type for the "Create via Chat" dialog. */
  entityType: ChatEntityType;
  /** Heading, e.g. "NPC Generator". */
  title: string;
  /** Intro copy under the heading. */
  description: React.ReactNode;
  /** Label of the submit button, e.g. "Generate NPC". */
  generateLabel: string;
  /** Lower-case noun used in the failure message, e.g. "NPC". */
  entityNoun: string;
  /** Console tag for failure diagnostics, e.g. "NpcGenerator". */
  logTag: string;
  placeholder: string;
  rows?: number;
  promptChips: readonly string[];
  isMockMode: boolean;
  campaignContext?: string;

  /**
   * Extra structured fields (CR, rarity, biome, ...) rendered above the
   * prompt textarea. Receives `isLoading` so the fields can disable.
   */
  renderExtraFields?: (isLoading: boolean) => React.ReactNode;
  /**
   * Combines the free-text prompt with the extra fields. Defaults to the
   * trimmed prompt. An empty result disables Generate.
   */
  buildPrompt?: (prompt: string) => string;
  /** Resets the extra fields after a successful generation. */
  onReset?: () => void;

  /**
   * Calls the aiService facade. MUST forward `signal` so Cancel / unmount
   * aborts the real request (and the proxy kills the CLI child).
   */
  generate: (fullPrompt: string, signal: AbortSignal) => Promise<T>;
  /** Commits a completed generation. Never called after cancel/unmount. */
  onGenerated: (data: T) => void;

  /** Chat-dialog wiring (EntityChatGenerator). */
  chatInitialData: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderChatPreview: (data: any, onUpdate: (data: any) => void) => React.ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChatEntityCreated: (data: any) => void;
}

const defaultBuildPrompt = (prompt: string) => prompt.trim();

/** "Official setting" hint appended to a generator's description. */
export const OfficialSettingNote: React.FC<{ show: boolean }> = ({ show }) =>
  show ? (
    <span className="block mt-1 text-amber-400 text-xs">Official setting context will be used for canon accuracy.</span>
  ) : null;

interface GeneratorSelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Options; the empty string is the "any" option. */
  options: readonly string[];
  /** Label for the empty option, e.g. "Any CR". */
  anyLabel: string;
  formatOption?: (option: string) => string;
  disabled?: boolean;
}

/** Labelled dropdown used for a generator's structured prompt fields. */
export const GeneratorSelectField: React.FC<GeneratorSelectFieldProps> = ({
  label, value, onChange, options, anyLabel, formatOption, disabled,
}) => (
  <div>
    <label className="block text-sm text-slate-400 mb-1">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`${inputBaseClasses} w-full px-3 py-2 text-sm`}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt === '' ? anyLabel : formatOption ? formatOption(opt) : opt}
        </option>
      ))}
    </select>
  </div>
);

/**
 * Shared "quick generate" form behind the seven entity generators
 * (roadmap L1). Owns the prompt text, the chat dialog toggle, and the AI
 * request lifecycle via `useAiRequest`: an in-flight generation is aborted
 * on unmount and via the visible Cancel button, and a result that arrives
 * after that is dropped rather than creating an entity through a stale
 * closure.
 */
export function QuickGeneratorForm<T>(props: QuickGeneratorFormProps<T>): React.ReactElement {
  const {
    entityType,
    title,
    description,
    generateLabel,
    entityNoun,
    logTag,
    placeholder,
    rows = 4,
    promptChips,
    isMockMode,
    campaignContext,
    renderExtraFields,
    buildPrompt = defaultBuildPrompt,
    chatInitialData,
    renderChatPreview,
    onChatEntityCreated,
  } = props;

  const [mode, setMode] = useState<'quick' | 'chat'>('quick');
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { run, cancel, isLoading } = useAiRequest<T>();

  // Read callbacks through a ref at commit time so a completed request always
  // reports to the latest parent handlers, never a closure captured at click.
  const latestPropsRef = useRef(props);
  latestPropsRef.current = props;

  const fullPrompt = buildPrompt(prompt);

  const handleQuickGenerate = async () => {
    const requestPrompt = buildPrompt(prompt);
    if (!requestPrompt.trim()) {
      setError('Please enter a prompt.');
      return;
    }
    setError(null);
    const outcome = await run(signal => latestPropsRef.current.generate(requestPrompt, signal));
    if (outcome.status === 'success') {
      latestPropsRef.current.onGenerated(outcome.data);
      setPrompt('');
      latestPropsRef.current.onReset?.();
    } else if (outcome.status === 'error') {
      console.error(`[${logTag}] generation failed`, outcome.error);
      setError(`Failed to generate ${entityNoun}. Please check your API key and try again.`);
    }
    // 'cancelled': the user cancelled or the component unmounted — do nothing.
  };

  return (
    <>
      <DialogShell
        isOpen={mode === 'chat'}
        onClose={() => setMode('quick')}
        ariaLabel="Conversational Creator"
        className="w-full max-w-6xl mx-4 h-[90vh]"
      >
        <div className="bg-slate-950 border border-slate-800 rounded-xl shadow-2xl h-full p-6 flex flex-col animate-in fade-in zoom-in-95 duration-200">
          <div className="mb-4 flex justify-between items-center flex-shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setMode('quick')}>
              <Icons.ChevronDown className="w-4 h-4 mr-2 rotate-90" /> Back to Quick Generator
            </Button>
            <h2 className="text-lg font-bold font-serif text-slate-100">Conversational Creator</h2>
          </div>
          <div className="flex-1 min-h-0 border border-slate-800 rounded-xl shadow-2xl overflow-hidden bg-slate-900">
            <EntityChatGenerator
              entityType={entityType}
              isMockMode={isMockMode}
              campaignContext={campaignContext}
              onEntityCreated={(data) => {
                onChatEntityCreated(data);
                setMode('quick');
              }}
              initialData={chatInitialData}
              renderPreview={renderChatPreview}
            />
          </div>
        </div>
      </DialogShell>

      {mode === 'quick' && (
        <div className="relative bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4 h-full flex flex-col">
          {isLoading && <SkeletonGeneratorOverlay />}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icons.Wizard className="w-7 h-7 text-amber-400" />
              <h2 className="text-2xl font-bold font-serif text-slate-100">{title}</h2>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setMode('chat')}>
              <Icons.Chat className="w-4 h-4 mr-2" /> Create via Chat
            </Button>
          </div>

          <p className="text-sm text-slate-400">{description}</p>

          {renderExtraFields?.(isLoading)}

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 outline-none resize-y placeholder:text-slate-600"
            disabled={isLoading}
          />

          <div className="flex flex-wrap gap-2">
            {promptChips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setPrompt(chip)}
                disabled={isLoading}
                className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-full px-3 py-1 transition-colors disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
          {/* z-20 lifts the actions above the z-10 loading overlay so Cancel stays clickable. */}
          <div className="relative z-20 flex gap-2 mt-auto">
            <Button
              onClick={handleQuickGenerate}
              disabled={isLoading || !fullPrompt.trim()}
              size="lg"
              className="w-full"
            >
              {isLoading ? 'Generating...' : generateLabel}
            </Button>
            {isLoading && (
              <Button variant="secondary" size="lg" onClick={cancel} aria-label={`Cancel ${entityNoun} generation`}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
