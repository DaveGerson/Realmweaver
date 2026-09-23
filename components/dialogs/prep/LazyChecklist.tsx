
import React, { useState } from 'react';
import { Icons } from '@/components/common/Icons';
import type { ChecklistRow, LazyChecklistStepId } from '@/utils/lazyChecklist';

export interface LazyChecklistProps {
  rows: ChecklistRow[];
  /** Jumps the wizard to the given step. Only ever called with a row's own `stepId`. */
  onNavigate: (stepId: LazyChecklistStepId) => void;
}

/**
 * §4.5 Lazy DM Checklist (docs/design/lazy-dm-lens.md §4.5) — a collapsible,
 * purely informational mirror of Shea's eight-step method on the Review & Go
 * Live step. NEVER red, never a "missing" badge, never blocks Go Live: every
 * row uses the same neutral slate tones as the rest of the wizard, whether
 * it has something to report or not. Collapsed by default so a DM who never
 * opens it pays zero cost.
 */
export const LazyChecklist: React.FC<LazyChecklistProps> = ({ rows, onNavigate }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Icons.CheckCircle className="w-3.5 h-3.5" />
          Lazy DM checklist
        </span>
        <Icons.ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <ul className="px-2 pb-3 space-y-1">
          {rows.map(row => (
            <li key={row.id}>
              {row.stepId ? (
                <button
                  type="button"
                  onClick={() => onNavigate(row.stepId as LazyChecklistStepId)}
                  className="w-full flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-700/60 transition-colors"
                >
                  <span className="font-medium text-slate-200">{row.label}</span>
                  <span className="text-xs text-slate-500 text-right">{row.detail}</span>
                </button>
              ) : (
                <div className="flex items-baseline justify-between gap-3 px-2 py-1.5 text-sm text-slate-300">
                  <span className="font-medium text-slate-200">{row.label}</span>
                  <span className="text-xs text-slate-500 text-right">{row.detail}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
