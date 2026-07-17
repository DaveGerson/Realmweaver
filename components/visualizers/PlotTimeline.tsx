
import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { Plot } from '../../types/index';
import type { SessionLog, PlotSessionStatus } from '../../types/index';
import { Icons } from '../common/Icons';

export interface PlotTimelineProps {
  plots: Plot[];
  sessionLogs: SessionLog[];
  onSelectPlot?: (plotId: string) => void;
  onSelectSession?: (sessionId: string) => void;
}

// Ordered by sessionDate ascending, so the timeline reads left-to-right chronologically.
function sortedSessions(sessionLogs: SessionLog[]): SessionLog[] {
  return [...sessionLogs].sort((a, b) => {
    if (!a.sessionDate && !b.sessionDate) return 0;
    if (!a.sessionDate) return 1;
    if (!b.sessionDate) return -1;
    return a.sessionDate.localeCompare(b.sessionDate);
  });
}

// Six rotating accent colors, expressed as Tailwind-safe inline style hex values
// so we don't need arbitrary Tailwind classes.
const PLOT_COLORS = [
  { line: '#f59e0b', badge: 'bg-amber-500',   text: 'text-amber-300',   border: 'border-amber-500' },
  { line: '#10b981', badge: 'bg-emerald-500',  text: 'text-emerald-300', border: 'border-emerald-500' },
  { line: '#8b5cf6', badge: 'bg-violet-500',   text: 'text-violet-300',  border: 'border-violet-500' },
  { line: '#38bdf8', badge: 'bg-sky-500',      text: 'text-sky-300',     border: 'border-sky-500' },
  { line: '#f43f5e', badge: 'bg-rose-500',     text: 'text-rose-300',    border: 'border-rose-500' },
  { line: '#06b6d4', badge: 'bg-cyan-500',     text: 'text-cyan-300',    border: 'border-cyan-500' },
];

// Returns the PlotSessionStatus recorded for a given plot in a given session,
// or null if the session has no record of this plot.
export function getPlotSessionStatus(
  session: SessionLog,
  plotId: string
): PlotSessionStatus | 'resolved' | null {
  // Check explicit per-plot status first
  if (session.plotProgressions && session.plotProgressions[plotId]) {
    return session.plotProgressions[plotId];
  }
  // Fall back to relatedPlotIds (treated as "advanced" if present, but without explicit status)
  if (session.relatedPlotIds?.includes(plotId)) {
    return 'advanced';
  }
  return null;
}

// PlotSessionStatus (session.plotProgressions) has no 'resolved' value of its own —
// resolution lives on the Plot itself (Plot.status). Combine the two so a plot marked
// resolved actually renders as resolved somewhere on the timeline: we surface it on the
// most recent session column, since that's the closest thing to "when" a DM would place it.
export function getEffectiveSessionStatus(
  session: SessionLog,
  plot: Plot,
  isMostRecentSession: boolean
): PlotSessionStatus | 'resolved' | null {
  if (plot.status === 'resolved' && isMostRecentSession) {
    return 'resolved';
  }
  return getPlotSessionStatus(session, plot.id);
}

interface TooltipState {
  visible: boolean;
  // Anchor element rect, used for clamped positioning
  anchorRect: DOMRect | null;
  content: string;
}

// ---- Status indicator sub-component ----
interface StatusDotProps {
  status: PlotSessionStatus | 'resolved' | null;
  color: string;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}

const StatusDot: React.FC<StatusDotProps> = ({ status, color, onMouseEnter, onMouseLeave }) => {
  if (status === null) {
    // Hollow dim circle: plot not mentioned this session
    return (
      <span
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="w-3 h-3 rounded-full border border-slate-600 bg-transparent flex-shrink-0 cursor-default"
        style={{ display: 'inline-block' }}
      />
    );
  }

  if (status === 'advanced') {
    return (
      <span
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="w-3.5 h-3.5 rounded-full flex-shrink-0 cursor-default"
        style={{ backgroundColor: '#22c55e', display: 'inline-block' }}
      />
    );
  }

  if (status === 'stalled') {
    return (
      <span
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="w-3.5 h-3.5 rounded-full flex-shrink-0 cursor-default"
        style={{ backgroundColor: '#f59e0b', display: 'inline-block' }}
      />
    );
  }

  if (status === 'unchanged') {
    return (
      <span
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="w-3.5 h-3.5 rounded-full border-2 bg-transparent flex-shrink-0 cursor-default"
        style={{ borderColor: '#6b7280', display: 'inline-block' }}
      />
    );
  }

  if (status === 'resolved') {
    return (
      <span
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="flex-shrink-0 cursor-default"
        style={{ display: 'inline-flex', alignItems: 'center' }}
      >
        <Icons.Check className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
      </span>
    );
  }

  return null;
};

// ---- Dormant / dangling warnings ----
interface PlotWarning {
  plotId: string;
  plotTitle: string;
  type: 'dormant' | 'dangling';
}

function computeWarnings(plots: Plot[], sessions: SessionLog[]): PlotWarning[] {
  const warnings: PlotWarning[] = [];

  for (const plot of plots) {
    if (plot.status !== 'active') continue;

    // Dangling thread: active plot with no related entities
    if (!plot.relatedEntityIds || plot.relatedEntityIds.length === 0) {
      warnings.push({ plotId: plot.id, plotTitle: plot.title, type: 'dangling' });
    }

    // Dormant: no status change in 3+ consecutive sessions
    if (sessions.length >= 3) {
      const lastThree = sessions.slice(-3);
      const allUnchangedOrAbsent = lastThree.every(s => {
        const st = getPlotSessionStatus(s, plot.id);
        return st === null || st === 'unchanged' || st === 'stalled';
      });
      // Only flag as dormant if the plot was mentioned at least once in those 3 sessions
      const everMentioned = lastThree.some(s => getPlotSessionStatus(s, plot.id) !== null);
      if (allUnchangedOrAbsent && everMentioned) {
        if (!warnings.find(w => w.plotId === plot.id && w.type === 'dormant')) {
          warnings.push({ plotId: plot.id, plotTitle: plot.title, type: 'dormant' });
        }
      }
    }
  }

  return warnings;
}

// Compact threshold: switch to session numbers only when more than this many sessions
const COMPACT_THRESHOLD = 8;

// ---- Viewport-clamped Tooltip ----
// Rendered via a portal-like fixed div that measures itself and then adjusts position.
interface ClampedTooltipProps {
  anchorRect: DOMRect | null;
  content: string;
  visible: boolean;
}

const ClampedTooltip: React.FC<ClampedTooltipProps> = ({ anchorRect, content, visible }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!visible || !anchorRect || !tooltipRef.current) {
      setPosition(null);
      return;
    }

    const el = tooltipRef.current;
    const tooltipWidth = el.offsetWidth || 160;
    const tooltipHeight = el.offsetHeight || 32;

    // Default: centered above the anchor, 8px gap
    let left = anchorRect.left + anchorRect.width / 2 - tooltipWidth / 2;
    let top = anchorRect.top - tooltipHeight - 8;

    // Clamp horizontally within viewport with 8px margins
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipWidth - 8));

    // If the tooltip would clip at the top, flip it below the anchor
    const shouldFlip = top < 8;
    if (shouldFlip) {
      top = anchorRect.bottom + 8;
    }

    // Clamp vertically (bottom edge)
    top = Math.max(8, Math.min(top, window.innerHeight - tooltipHeight - 8));

    setFlipped(shouldFlip);
    setPosition({ left, top });
  }, [visible, anchorRect, content]);

  return (
    <div
      ref={tooltipRef}
      aria-hidden
      className="fixed z-50 pointer-events-none bg-slate-900 border border-slate-600 text-slate-200 text-xs px-2 py-1 rounded shadow-lg max-w-[200px] text-center transition-opacity duration-100"
      style={{
        left: position?.left ?? -9999,
        top: position?.top ?? -9999,
        opacity: visible && position ? 1 : 0,
      }}
    >
      {content}
    </div>
  );
};

// ---- Main component ----
export const PlotTimeline: React.FC<PlotTimelineProps> = ({
  plots,
  sessionLogs,
  onSelectPlot,
  onSelectSession,
}) => {
  const sessions = sortedSessions(sessionLogs);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, anchorRect: null, content: '' });
  const [hasOverflow, setHasOverflow] = useState(false);

  // Compact mode: show session numbers only when many sessions exist or user toggles
  const defaultCompact = sessions.length > COMPACT_THRESHOLD;
  const [compactMode, setCompactMode] = useState(defaultCompact);

  // Update compactMode default when session count crosses threshold
  useEffect(() => {
    setCompactMode(sessions.length > COMPACT_THRESHOLD);
  }, [sessions.length]);

  const warnings = computeWarnings(plots, sessions);

  // Detect horizontal overflow in the session grid to show the fade gradient
  const checkOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setHasOverflow(el.scrollWidth > el.clientWidth);
  }, []);

  useEffect(() => {
    checkOverflow();
    const el = scrollRef.current;
    if (!el) return;

    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);
    // Also watch the inner child so content changes are detected
    if (el.firstElementChild) observer.observe(el.firstElementChild);

    return () => observer.disconnect();
  }, [checkOverflow, sessions.length]);

  const showTooltip = (e: React.MouseEvent, content: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ visible: true, anchorRect: rect, content });
  };

  const hideTooltip = () => setTooltip(t => ({ ...t, visible: false }));

  if (plots.length === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 text-center">
        <p className="text-slate-500 text-sm italic">No plots to display. Create a plot arc to see the timeline.</p>
      </div>
    );
  }

  // Column width varies by mode:
  // - Compact: 48px (session numbers only)
  // - Expanded: flexible min 80px max 160px; we compute a target based on available space
  const COMPACT_COL_WIDTH = 48;
  const EXPANDED_COL_WIDTH = 120;
  const COL_WIDTH = compactMode ? COMPACT_COL_WIDTH : EXPANDED_COL_WIDTH;
  const ROW_HEIGHT = 40; // px per plot row
  const LABEL_WIDTH = 152; // px for fixed left label column

  return (
    <div className="relative select-none">
      {/* Viewport-clamped tooltip */}
      <ClampedTooltip
        anchorRect={tooltip.anchorRect}
        content={tooltip.content}
        visible={tooltip.visible}
      />

      {/* Compact/Expanded toggle — only shown when there are sessions */}
      {sessions.length > 0 && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setCompactMode(v => !v)}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
            title={compactMode ? 'Show full session titles' : 'Show compact session numbers'}
          >
            <Icons.Sliders className="w-3 h-3" />
            {compactMode ? 'Expand' : 'Compact'}
          </button>
        </div>
      )}

      <div className="flex">
        {/* ---- Fixed left column: plot name labels ---- */}
        <div className="flex-shrink-0 z-20" style={{ width: LABEL_WIDTH }}>
          {/* Header spacer aligned with the scrolling session header */}
          <div
            className="sticky top-0 z-20 border-b border-slate-700 bg-slate-900"
            style={{ height: ROW_HEIGHT }}
          />
          {/* One label row per plot */}
          {plots.map((plot, i) => {
            const color = PLOT_COLORS[i % PLOT_COLORS.length];
            return (
              <div
                key={plot.id}
                className="flex items-center pr-3 cursor-pointer group"
                style={{ height: ROW_HEIGHT, borderBottom: '1px solid #292524' }}
                onClick={() => onSelectPlot?.(plot.id)}
                title={plot.title}
              >
                {/* Color swatch */}
                <span
                  className="flex-shrink-0 w-1.5 h-5 rounded-full mr-2"
                  style={{ backgroundColor: color.line }}
                />
                <span className="text-xs text-slate-300 group-hover:text-amber-300 transition-colors truncate leading-tight">
                  {plot.title}
                </span>
              </div>
            );
          })}
        </div>

        {/* ---- Scrollable right section: session columns ---- */}
        <div className="relative flex-1" style={{ minWidth: 0 }}>
          <div
            ref={scrollRef}
            className="overflow-x-auto custom-scrollbar"
            style={{ minWidth: 0 }}
            onScroll={checkOverflow}
          >
            {sessions.length === 0 ? (
              <div className="flex items-center justify-center h-full px-8 py-6">
                <p className="text-slate-600 text-xs italic">No session logs yet.</p>
              </div>
            ) : (
              <div style={{ width: Math.max(sessions.length * COL_WIDTH, 1), minWidth: '100%' }}>
                {/* Session header row */}
                <div className="flex border-b border-slate-700 sticky top-0 z-10 bg-slate-900 shadow-sm" style={{ height: ROW_HEIGHT }}>
                  {sessions.map((session, si) => (
                    <div
                      key={session.id}
                      className="flex-shrink-0 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-700/40 transition-colors group px-1"
                      style={{ width: COL_WIDTH, borderRight: si < sessions.length - 1 ? '1px solid #292524' : undefined }}
                      onClick={() => onSelectSession?.(session.id)}
                      title={session.title || `Session ${si + 1}`}
                    >
                      {compactMode ? (
                        // Compact: just the session number
                        <span className="text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors">
                          S{si + 1}
                        </span>
                      ) : (
                        // Expanded: number + truncated title
                        <>
                          <span className="text-[10px] text-slate-500 group-hover:text-slate-300 transition-colors">
                            S{si + 1}
                          </span>
                          <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors truncate w-full text-center px-1 leading-tight">
                            {session.title || `Session ${si + 1}`}
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {/* Plot rows */}
                {plots.map((plot, pi) => {
                  const color = PLOT_COLORS[pi % PLOT_COLORS.length];

                  return (
                    <div
                      key={plot.id}
                      className="flex relative cursor-pointer hover:bg-slate-800/40 transition-colors"
                      style={{ height: ROW_HEIGHT, borderBottom: '1px solid #292524' }}
                      onClick={() => onSelectPlot?.(plot.id)}
                    >
                      {/* Horizontal line spanning all columns */}
                      <div
                        className="absolute top-1/2 left-0 right-0 pointer-events-none"
                        style={{ height: 2, transform: 'translateY(-50%)', backgroundColor: color.line, opacity: 0.35 }}
                      />

                      {/* Session cells */}
                      {sessions.map((session, si) => {
                        const status = getEffectiveSessionStatus(session, plot, si === sessions.length - 1);
                        const active = status !== null;

                        // Build tooltip string
                        const sessionLabel = session.title || `Session ${si + 1}`;
                        let statusLabel = 'Not mentioned';
                        if (status === 'advanced') statusLabel = 'Advanced';
                        else if (status === 'stalled') statusLabel = 'Stalled';
                        else if (status === 'unchanged') statusLabel = 'Unchanged';
                        else if (status === 'resolved') statusLabel = 'Resolved';
                        const tooltipContent = `${sessionLabel}: ${statusLabel}`;

                        return (
                          <div
                            key={session.id}
                            className="flex-shrink-0 flex items-center justify-center relative"
                            style={{
                              width: COL_WIDTH,
                              borderRight: si < sessions.length - 1 ? '1px solid #292524' : undefined,
                            }}
                            onClick={e => { e.stopPropagation(); onSelectSession?.(session.id); }}
                          >
                            {/* Solid segment of the line when plot is active in this session */}
                            {active && (
                              <div
                                className="absolute top-1/2 left-0 right-0 pointer-events-none"
                                style={{ height: 3, transform: 'translateY(-50%)', backgroundColor: color.line }}
                              />
                            )}

                            {/* Status dot */}
                            <div className="relative z-10" onClick={e => e.stopPropagation()}>
                              <StatusDot
                                status={status}
                                color={color.line}
                                onMouseEnter={e => showTooltip(e, tooltipContent)}
                                onMouseLeave={hideTooltip}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right-edge fade gradient — visible when content overflows */}
          {hasOverflow && (
            <div
              className="absolute top-0 right-0 bottom-0 w-10 pointer-events-none"
              style={{
                background: 'linear-gradient(to left, #0f172a, transparent)',
              }}
            />
          )}
        </div>
      </div>

      {/* ---- Legend ---- */}
      <div className="mt-3 flex flex-wrap gap-4 px-1">
        {[
          { label: 'Advanced', el: <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ backgroundColor: '#22c55e' }} /> },
          { label: 'Stalled',  el: <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ backgroundColor: '#f59e0b' }} /> },
          { label: 'Unchanged', el: <span className="w-3.5 h-3.5 rounded-full border-2 inline-block" style={{ borderColor: '#6b7280' }} /> },
          { label: 'Not mentioned', el: <span className="w-3 h-3 rounded-full border inline-block border-slate-600 bg-transparent" /> },
          { label: 'Resolved', el: <Icons.Check className="w-3.5 h-3.5 inline-block" style={{ color: '#22c55e' }} /> },
        ].map(({ label, el }) => (
          <span key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
            {el}
            {label}
          </span>
        ))}
      </div>

      {/* ---- Health warnings ---- */}
      {warnings.length > 0 && (
        <div className="mt-4 space-y-2">
          {warnings.map((w, idx) => (
            <div
              key={`${w.plotId}-${w.type}-${idx}`}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs border cursor-pointer hover:opacity-80 transition-opacity ${
                w.type === 'dormant'
                  ? 'bg-amber-900/20 border-amber-700/40 text-amber-300'
                  : 'bg-sky-900/20 border-sky-700/40 text-sky-300'
              }`}
              onClick={() => onSelectPlot?.(w.plotId)}
            >
              <Icons.AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {w.type === 'dormant' ? (
                <span>
                  <strong>{w.plotTitle}</strong> has stalled or been unchanged for 3+ sessions — consider advancing it.
                </span>
              ) : (
                <span>
                  <strong>{w.plotTitle}</strong> is active but has no linked entities — add NPCs, locations, or factions.
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
