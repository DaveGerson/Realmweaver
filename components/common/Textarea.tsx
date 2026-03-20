
import React from 'react';
import { Sparkles } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface AiTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  onAiGenerate?: () => void;
  isGenerating?: boolean;
}

export const AiTextarea: React.FC<AiTextareaProps> = ({
  label,
  className,
  onAiGenerate,
  isGenerating = false,
  ...props
}) => {
  const baseClasses = 'w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none resize-y placeholder:text-slate-500 transition-colors';
  const mergedClasses = twMerge(baseClasses, className);

  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</label>
        {onAiGenerate && (
          <button
            onClick={onAiGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-pulse' : ''}`} />
            {isGenerating ? 'Generating...' : 'Generate'}
          </button>
        )}
      </div>
      <textarea className={mergedClasses} {...props} />
    </div>
  );
};
