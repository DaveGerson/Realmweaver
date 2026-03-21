
import React, { useState, useRef, useEffect } from 'react';
import { Icons } from '@/components/common/Icons';
import { generateEnhancedText } from '@/services/geminiService';

interface RegenerateButtonProps {
  fieldName: string;
  currentValue: string;
  entityType: string;
  entityContext: string;
  onRegenerate: (newValue: string) => void;
  isMockMode: boolean;
  campaignContext?: string;
}

type PanelState = 'closed' | 'expanded' | 'loading' | 'preview';

const mockRegenerate = (fieldName: string, currentValue: string): string => {
  return `[Regenerated ${fieldName}] ${currentValue.split(' ').reverse().join(' ')}`;
};

/**
 * A per-field AI regeneration button with a preview/accept/reject workflow.
 *
 * Renders as a small indigo sparkle button inline with the field label.
 * When clicked, a panel appears below the button (absolute positioned, z-50)
 * with an optional tweak input, regenerate trigger, and accept/reject preview.
 *
 * Layout: the trigger button is inline in the label row; the panel overlays
 * the content below using absolute positioning to avoid disrupting layout.
 */
export const RegenerateButton: React.FC<RegenerateButtonProps> = ({
  fieldName,
  currentValue,
  entityType,
  entityContext,
  onRegenerate,
  isMockMode,
  campaignContext,
}) => {
  const [panelState, setPanelState] = useState<PanelState>('closed');
  const [tweakInstruction, setTweakInstruction] = useState('');
  const [previewValue, setPreviewValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Focus tweak input when panel opens
  useEffect(() => {
    if (panelState === 'expanded' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [panelState]);

  // Close panel on outside click
  useEffect(() => {
    if (panelState === 'closed') return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [panelState]);

  const handleClose = () => {
    setPanelState('closed');
    setTweakInstruction('');
    setPreviewValue('');
    setError(null);
  };

  const handleTriggerClick = () => {
    if (panelState !== 'closed') {
      handleClose();
    } else {
      setPanelState('expanded');
      setError(null);
    }
  };

  const handleRegenerate = async () => {
    setPanelState('loading');
    setError(null);

    try {
      let result: string;

      if (isMockMode) {
        await new Promise(resolve => setTimeout(resolve, 400));
        result = mockRegenerate(fieldName, currentValue);
      } else {
        const tweakPart = tweakInstruction.trim()
          ? ` Additional instruction: ${tweakInstruction.trim()}.`
          : '';
        const prompt = `Regenerate the "${fieldName}" for this ${entityType}.\n\nCurrent value: ${currentValue}\n\nContext:\n${entityContext}${tweakPart}\n\nProvide only the regenerated text for the "${fieldName}" field, no labels or preamble.`;
        result = await generateEnhancedText(prompt, campaignContext, false);
      }

      setPreviewValue(result);
      setPanelState('preview');
    } catch (err) {
      console.error('[RegenerateButton] Generation failed:', err);
      setError('Generation failed. Please try again.');
      setPanelState('expanded');
    }
  };

  const handleAccept = () => {
    onRegenerate(previewValue);
    handleClose();
  };

  const handleReject = () => {
    handleClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRegenerate();
    } else if (e.key === 'Escape') {
      handleClose();
    }
  };

  const isActive = panelState !== 'closed';

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      {/* Trigger button — always visible inline with field label */}
      <button
        type="button"
        onClick={handleTriggerClick}
        title={`Regenerate ${fieldName} with AI`}
        aria-label={`Regenerate ${fieldName} with AI`}
        aria-expanded={isActive}
        className={[
          'inline-flex items-center gap-1 text-xs transition-colors ml-2 flex-shrink-0 rounded px-1 py-0.5',
          isActive
            ? 'text-indigo-300 bg-indigo-900/40'
            : 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/20',
        ].join(' ')}
      >
        {panelState === 'loading' ? (
          <Icons.Loader className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Icons.Sparkles className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Expanded panel — absolute positioned below the trigger, overlays content */}
      {isActive && (
        <div
          className="absolute left-0 top-full mt-1 z-50 min-w-72 w-max max-w-sm bg-slate-900 border border-indigo-800/60 rounded-lg shadow-xl shadow-black/50 p-3 space-y-2"
          style={{ minWidth: '18rem' }}
        >
          {/* Panel header */}
          <div className="flex items-center gap-2">
            {panelState === 'loading' ? (
              <Icons.Loader className="w-3.5 h-3.5 text-indigo-400 animate-spin flex-shrink-0" />
            ) : (
              <Icons.Sparkles className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            )}
            <span className="text-xs text-indigo-300 font-medium">
              {panelState === 'loading'
                ? `Regenerating ${fieldName}...`
                : panelState === 'preview'
                ? 'Preview — accept or reject?'
                : `Regenerate ${fieldName}`}
            </span>
            {panelState !== 'loading' && (
              <button
                type="button"
                onClick={handleClose}
                className="ml-auto text-slate-500 hover:text-slate-300 transition-colors"
                aria-label="Close"
              >
                <Icons.X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Error message */}
          {error && (
            <p className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded px-2 py-1">
              {error}
            </p>
          )}

          {/* Expanded: tweak input + generate button */}
          {panelState === 'expanded' && (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                ref={inputRef}
                type="text"
                value={tweakInstruction}
                onChange={e => setTweakInstruction(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Optional tweak (e.g. Make more sinister)"
                className="flex-grow bg-slate-800 border border-indigo-800/40 rounded px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
              <button
                type="button"
                onClick={handleRegenerate}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-xs rounded transition-colors whitespace-nowrap"
              >
                <Icons.Sparkles className="w-3 h-3" />
                Regenerate
              </button>
            </div>
          )}

          {/* Preview: new content with accept/reject */}
          {panelState === 'preview' && (
            <>
              <p className="text-xs text-slate-200 bg-slate-800/60 rounded p-2 border border-slate-700/50 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto custom-scrollbar">
                {previewValue}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAccept}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-xs rounded transition-colors"
                >
                  <Icons.CheckCircle className="w-3 h-3" />
                  Accept
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded transition-colors"
                >
                  <Icons.X className="w-3 h-3" />
                  Reject
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
