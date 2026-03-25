
// components/dialogs/ContinuityChecker.tsx
// Modal dialog that displays continuity issues for the active campaign.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Campaign } from '@/types/index';
import { checkContinuity } from '@/services/continuityChecker';
import type { ContinuityIssue, IssueSeverity } from '@/services/continuityChecker';
import { Icons } from '@/components/common/Icons';
import { EntityLink } from '@/components/common/EntityLink';
import type { QuickCardEntityType } from '@/components/common/EntityQuickCard';
import { twMerge } from 'tailwind-merge';
import { DialogShell } from '@/components/common/DialogShell';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ContinuityCheckerProps {
  campaign: Campaign;
  onNavigate?: (entityType: string, entityId: string) => void;
  onClose: () => void;
}

// ─── Severity helpers ─────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<IssueSeverity, number> = { error: 0, warning: 1, info: 2 };

const SEVERITY_LABEL: Record<IssueSeverity, string> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
};

const SEVERITY_ICON_CLASS: Record<IssueSeverity, string> = {
  error: 'text-red-400',
  warning: 'text-amber-400',
  info: 'text-sky-400',
};

const SEVERITY_CARD_CLASS: Record<IssueSeverity, string> = {
  error: 'border-red-800/60 bg-red-950/20',
  warning: 'border-amber-800/60 bg-amber-950/20',
  info: 'border-sky-800/60 bg-sky-950/20',
};

const SEVERITY_BADGE_CLASS: Record<IssueSeverity, string> = {
  error: 'bg-red-900/60 text-red-300',
  warning: 'bg-amber-900/60 text-amber-300',
  info: 'bg-sky-900/60 text-sky-300',
};

function SeverityIcon({ severity, className }: { severity: IssueSeverity; className?: string }) {
  const base = twMerge('w-4 h-4 flex-shrink-0', SEVERITY_ICON_CLASS[severity], className);
  if (severity === 'error') return <Icons.X className={base} />;
  if (severity === 'warning') return <Icons.AlertTriangle className={base} />;
  return <Icons.Help className={base} />;
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type FilterTab = 'all' | IssueSeverity;

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'error', label: 'Errors' },
  { id: 'warning', label: 'Warnings' },
  { id: 'info', label: 'Info' },
];

// ─── Issue card ───────────────────────────────────────────────────────────────

interface IssueCardProps {
  issue: ContinuityIssue;
  onDismiss: (id: string) => void;
  onNavigate?: (entityType: string, entityId: string) => void;
}

const IssueCard: React.FC<IssueCardProps> = ({ issue, onDismiss, onNavigate }) => {
  // Build entity link pairs, deduplicating by ID
  const uniqueEntities = issue.entityIds.reduce<Array<{ id: string; type: string }>>(
    (acc, id, idx) => {
      if (!acc.some(e => e.id === id)) {
        acc.push({ id, type: issue.entityTypes[idx] });
      }
      return acc;
    },
    []
  );

  // Derive a display name for entity links by looking them up in the campaign
  // We only have the ID and type here, so we label them by truncated ID unless
  // the parent supplies an onNavigate (which implies the label is navigable).
  // EntityLink itself resolves the name via EntityQuickCard which reads from
  // the campaignService store — so we pass the ID as the label placeholder,
  // EntityLink will show the real name from the QuickCard data.

  return (
    <div
      className={twMerge(
        'rounded-lg border p-3 sm:p-4',
        SEVERITY_CARD_CLASS[issue.severity]
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: icon + title */}
        <div className="flex items-start gap-2 min-w-0">
          <SeverityIcon severity={issue.severity} className="mt-0.5" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-100 text-sm leading-snug">
                {issue.title}
              </span>
              <span className={twMerge('text-xs rounded px-1.5 py-0.5', SEVERITY_BADGE_CLASS[issue.severity])}>
                {SEVERITY_LABEL[issue.severity]}
              </span>
            </div>
            <p className="text-slate-300 text-sm mt-1 leading-relaxed">{issue.description}</p>

            {/* Entity links */}
            {uniqueEntities.length > 0 && onNavigate && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {uniqueEntities.map(({ id, type }) => (
                  <EntityLink
                    key={id}
                    entityType={type as QuickCardEntityType}
                    entityId={id}
                    onNavigate={onNavigate}
                    className="text-xs"
                  />
                ))}
              </div>
            )}

            {/* Suggested fix */}
            {issue.suggestedFix && (
              <p className="text-slate-400 text-xs italic mt-2">{issue.suggestedFix}</p>
            )}
          </div>
        </div>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={() => onDismiss(issue.id)}
          className="flex-shrink-0 text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-md hover:bg-slate-700/50"
          aria-label="Dismiss issue"
          title="Dismiss for this session"
        >
          <Icons.X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const ContinuityChecker: React.FC<ContinuityCheckerProps> = ({
  campaign,
  onNavigate,
  onClose,
}) => {
  const [issues, setIssues] = useState<ContinuityIssue[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [isRunning, setIsRunning] = useState(true);
  const runTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Run the checker. We defer via setTimeout so the spinner renders first.
  const runCheck = useCallback(() => {
    if (runTimerRef.current) clearTimeout(runTimerRef.current);
    setIsRunning(true);
    runTimerRef.current = setTimeout(() => {
      const result = checkContinuity(campaign);
      result.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
      setIssues(result);
      setIsRunning(false);
    }, 50);
  }, [campaign]);

  useEffect(() => {
    runCheck();
    return () => {
      if (runTimerRef.current) clearTimeout(runTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount; re-check is manual via runCheck()

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  }, []);

  const visibleIssues = issues.filter(i => {
    if (dismissedIds.has(i.id)) return false;
    if (activeTab === 'all') return true;
    return i.severity === activeTab;
  });

  const liveIssues = issues.filter(i => !dismissedIds.has(i.id));
  const errorCount = liveIssues.filter(i => i.severity === 'error').length;
  const warningCount = liveIssues.filter(i => i.severity === 'warning').length;
  const infoCount = liveIssues.filter(i => i.severity === 'info').length;

  const tabCount: Record<FilterTab, number> = {
    all: liveIssues.length,
    error: errorCount,
    warning: warningCount,
    info: infoCount,
  };

  return (
    <DialogShell isOpen={true} onClose={onClose} ariaLabel="Continuity Check" className="w-full max-w-2xl mx-2 sm:mx-4">
      {/* Panel */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Icons.Factions className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-slate-100">Continuity Check</h2>

            {!isRunning && (
              <div className="flex items-center gap-1.5 text-xs">
                {errorCount > 0 && (
                  <span className="bg-red-900/70 text-red-300 rounded px-1.5 py-0.5">
                    {errorCount} {errorCount === 1 ? 'error' : 'errors'}
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="bg-amber-900/70 text-amber-300 rounded px-1.5 py-0.5">
                    {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
                  </span>
                )}
                {infoCount > 0 && (
                  <span className="bg-sky-900/70 text-sky-300 rounded px-1.5 py-0.5">
                    {infoCount} info
                  </span>
                )}
                {liveIssues.length === 0 && (
                  <span className="bg-green-900/70 text-green-300 rounded px-1.5 py-0.5">
                    All clear
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Re-check button */}
            <button
              type="button"
              onClick={runCheck}
              disabled={isRunning}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-300 transition-colors px-2 py-1 rounded-md hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Re-run continuity check"
              title="Re-check for issues"
            >
              <Icons.RefreshCw className={twMerge('w-3.5 h-3.5', isRunning && 'animate-spin')} />
              <span className="hidden sm:inline">Re-check</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-md hover:bg-slate-700"
              aria-label="Close continuity checker"
            >
              <Icons.X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-4 pt-3 flex-shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={twMerge(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                activeTab === tab.id
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              )}
            >
              {tab.label}
              {!isRunning && tabCount[tab.id] > 0 && (
                <span className={twMerge(
                  'ml-1.5 text-xs rounded px-1',
                  tab.id === 'error' ? 'bg-red-900/60 text-red-300'
                  : tab.id === 'warning' ? 'bg-amber-900/60 text-amber-300'
                  : tab.id === 'info' ? 'bg-sky-900/60 text-sky-300'
                  : 'bg-slate-700 text-slate-300'
                )}>
                  {tabCount[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Issue list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isRunning && (
            <div className="flex items-center justify-center gap-3 py-12 text-slate-400">
              <Icons.Loader className="w-5 h-5 animate-spin" />
              <span className="text-sm">Analysing campaign…</span>
            </div>
          )}

          {!isRunning && visibleIssues.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Icons.CheckCircle className="w-10 h-10 text-green-400" />
              <p className="text-slate-200 font-semibold">
                {liveIssues.length === 0
                  ? 'No issues found! Your campaign is consistent.'
                  : 'No issues in this category.'}
              </p>
              {liveIssues.length === 0 && (
                <p className="text-slate-400 text-sm">
                  All entity references, hierarchies, and relationships look good.
                </p>
              )}
            </div>
          )}

          {!isRunning && visibleIssues.map(issue => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onDismiss={handleDismiss}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-700 flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-slate-500">
            {dismissedIds.size > 0 && `${dismissedIds.size} dismissed this session`}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm px-4 py-1.5 rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </DialogShell>
  );
};
