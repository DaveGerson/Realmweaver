import React, { useMemo, useState } from 'react';
import type { Campaign } from '@/types';
import { Icons } from '@/components/common/Icons';
import { ContinuityThreadIcon } from '@/components/common/ContinuityThreadIcon';
import type { QuickCardEntityType } from '@/components/common/EntityQuickCard';
import { computeContinuityThreads } from '@/utils/continuityThreads';

interface LooseEndsPanelProps {
    campaign: Campaign;
    onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
    /** Maximum threads listed before "Show all". Default 6. */
    limit?: number;
}

/**
 * Compact, collapsible "Loose ends" list for the Session Runner sidebar
 * (roadmap L3). Same threads as SessionPrepWizard's "Previously on…" panel,
 * computed by utils/continuityThreads.ts. Clicking a thread navigates via
 * the runner's `onNavigate`. Renders nothing when there are no threads.
 */
export const LooseEndsPanel: React.FC<LooseEndsPanelProps> = ({ campaign, onNavigate, limit = 6 }) => {
    const threads = useMemo(() => computeContinuityThreads(campaign), [campaign]);
    const [isOpen, setIsOpen] = useState(true);
    const [showAll, setShowAll] = useState(false);

    if (threads.length === 0) return null;
    const visible = showAll ? threads : threads.slice(0, limit);
    const listId = 'session-loose-ends-list';

    return (
        <section className="mt-6" aria-label="Loose ends">
            <button
                type="button"
                onClick={() => setIsOpen(o => !o)}
                aria-expanded={isOpen}
                aria-controls={listId}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 hover:text-slate-300 transition-colors"
            >
                <span className="flex items-center gap-1">
                    <Icons.ChevronDown className={isOpen ? 'w-3 h-3' : 'w-3 h-3 -rotate-90'} />
                    Loose ends
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 normal-case tracking-normal">
                    {threads.length}
                </span>
            </button>
            {isOpen && (
                <ul id={listId} className="space-y-1">
                    {visible.map(thread => {
                        const target = thread.navigateTo;
                        const content = (
                            <>
                                <ContinuityThreadIcon kind={thread.kind} className="mt-0.5" />
                                <span className="flex flex-col min-w-0">
                                    <span className="text-xs text-slate-300 truncate">{thread.title}</span>
                                    <span className="text-[10px] text-slate-500 line-clamp-2">{thread.summary}</span>
                                </span>
                            </>
                        );
                        return (
                            <li key={thread.id}>
                                {target && onNavigate ? (
                                    <button
                                        type="button"
                                        onClick={() => onNavigate(target.type, target.id)}
                                        title={thread.summary}
                                        className="w-full flex items-start gap-2 px-1.5 py-1.5 rounded-md text-left hover:bg-slate-800 transition-colors"
                                    >
                                        {content}
                                    </button>
                                ) : (
                                    <div className="flex items-start gap-2 px-1.5 py-1.5" title={thread.summary}>
                                        {content}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                    {threads.length > limit && (
                        <li>
                            <button
                                type="button"
                                onClick={() => setShowAll(s => !s)}
                                className="text-[10px] text-amber-400 hover:text-amber-300 px-1.5"
                            >
                                {showAll ? 'Show fewer' : `Show all ${threads.length}`}
                            </button>
                        </li>
                    )}
                </ul>
            )}
        </section>
    );
};
