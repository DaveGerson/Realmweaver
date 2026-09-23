// components/common/ClockPips.tsx
//
// A plot's countdown clock as a row of pips — filled segments in the plot
// accent (yellow, per ENTITY_TYPE_CONFIG), empty ones outlined. Read-only by
// default; pass `onSetFilled` to make each pip a button that sets the clock to
// that many filled segments (clicking the last filled pip empties it, so a
// tick can be undone with one more click).
//
// Classes are static literals on purpose — build-time Tailwind never sees a
// runtime-composed `bg-${color}-400` (components/CLAUDE.md).

import React from 'react';
import { twMerge } from 'tailwind-merge';
import type { PlotClock } from '@/types';
import { normalizePlotClock } from '@/utils/plotClock';

export interface ClockPipsProps {
    clock: PlotClock | null | undefined;
    /** `sm` for inline badges (panels, lists); `md` for the editor. */
    size?: 'sm' | 'md';
    /** When given, pips become buttons; called with the new `filled` count. */
    onSetFilled?: (filled: number) => void;
    /** Accessible name prefix, e.g. the plot title. */
    label?: string;
    className?: string;
}

export const ClockPips: React.FC<ClockPipsProps> = ({ clock, size = 'sm', onSetFilled, label, className }) => {
    const normalized = normalizePlotClock(clock);
    if (!normalized) return null;
    const { segments, filled } = normalized;
    const pipSize = size === 'md' ? 'w-5 h-5' : 'w-2.5 h-2.5';
    const prefix = label ? `${label}: ` : '';

    return (
        <span
            role={onSetFilled ? 'group' : 'img'}
            aria-label={`${prefix}clock ${filled} of ${segments}`}
            className={twMerge('inline-flex items-center gap-0.5', className)}
        >
            {Array.from({ length: segments }, (_, i) => {
                const index = i + 1;
                const isFilled = index <= filled;
                const pipClasses = twMerge(
                    'rounded-full border transition-colors',
                    pipSize,
                    isFilled ? 'bg-yellow-400 border-yellow-300' : 'bg-transparent border-yellow-500/50'
                );
                if (!onSetFilled) {
                    return <span key={index} className={pipClasses} aria-hidden="true" />;
                }
                // Clicking the last filled pip empties it by one — the undo.
                // Each pip is named by its own position (a toggle whose
                // pressed state is "filled"), so no two pips share a name.
                const isLastFilled = index === filled;
                const next = isLastFilled ? index - 1 : index;
                return (
                    <button
                        key={index}
                        type="button"
                        onClick={() => onSetFilled(next)}
                        aria-label={`${prefix}segment ${index} of ${segments}`}
                        aria-pressed={isFilled}
                        title={isLastFilled ? 'Empty this segment' : `Fill the clock to ${index}`}
                        className={twMerge(pipClasses, 'hover:border-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-500/50')}
                    />
                );
            })}
        </span>
    );
};
