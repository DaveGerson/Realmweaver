
import React, { useState } from 'react';
import { Icons } from '@/components/common/Icons';

interface GenerateHerePanelProps {
  /** Label shown on the trigger button */
  buttonLabel: string;
  /** Default value for the prompt textarea */
  defaultPrompt: string;
  /** Whether a generation is currently in progress */
  isGenerating: boolean;
  /** Called when the user submits the prompt */
  onGenerate: (prompt: string) => void;
  /** Optional: disable the trigger button (e.g. no adventures exist) */
  disabled?: boolean;
  /** Optional message shown when disabled */
  disabledReason?: string;
}

/**
 * Contextual "Generate Here" inline panel.
 *
 * Renders a trigger button styled with indigo (AI feature convention).
 * On click it expands an inline prompt editor with a pre-filled context
 * prompt that the GM can edit before submitting.
 */
export const GenerateHerePanel: React.FC<GenerateHerePanelProps> = ({
  buttonLabel,
  defaultPrompt,
  isGenerating,
  onGenerate,
  disabled = false,
  disabledReason,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState(defaultPrompt);

  const handleOpen = () => {
    setPrompt(defaultPrompt);
    setIsOpen(true);
  };

  const handleCancel = () => {
    setIsOpen(false);
  };

  const handleSubmit = () => {
    if (!prompt.trim() || isGenerating) return;
    onGenerate(prompt.trim());
    setIsOpen(false);
  };

  if (disabled && disabledReason) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 italic">
        <Icons.AlertTriangle className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
        {disabledReason}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!isOpen && (
        <button
          onClick={handleOpen}
          disabled={disabled || isGenerating}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-900"
        >
          {isGenerating ? (
            <Icons.Loader className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Icons.Sparkles className="w-3.5 h-3.5" />
          )}
          {isGenerating ? 'Generating...' : buttonLabel}
        </button>
      )}

      {isOpen && (
        <div className="bg-amber-950/40 border border-amber-800/50 rounded-lg p-4 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 mb-1">
            <Icons.Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-300">{buttonLabel}</span>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full bg-slate-950 border border-amber-700/60 rounded-md px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all resize-y"
            placeholder="Describe what to generate..."
            autoFocus
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleSubmit}
              disabled={!prompt.trim() || isGenerating}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              {isGenerating ? (
                <Icons.Loader className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Icons.Wizard className="w-3.5 h-3.5" />
              )}
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isGenerating}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Edit the prompt above to customize what gets generated, then click Generate.
          </p>
        </div>
      )}
    </div>
  );
};
