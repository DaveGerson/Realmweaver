import React from 'react';
import { Button } from '@/components/common/Button';

interface IncrementalListFooterProps {
  /** From `useIncrementalList`. */
  hasMore: boolean;
  remaining: number;
  visibleCount: number;
  totalCount: number;
  showMore: () => void;
  sentinelRef: (el: Element | null) => void;
  /** Plural noun for the button label, e.g. "NPCs". */
  noun: string;
}

/**
 * Footer for a `useIncrementalList`-bounded grid (roadmap N4): an
 * IntersectionObserver sentinel that auto-grows the window as the user
 * scrolls near the end, plus an explicit "Show more" button so growth never
 * depends on scrolling (keyboard / screen-reader users, environments without
 * IntersectionObserver). Renders nothing when every item is on screen, so
 * small campaigns look exactly as before.
 *
 * Render it AFTER (outside) the grid so it never becomes a grid cell or a
 * member of the grid's roving-tabindex group.
 */
export const IncrementalListFooter: React.FC<IncrementalListFooterProps> = ({
  hasMore,
  remaining,
  visibleCount,
  totalCount,
  showMore,
  sentinelRef,
  noun,
}) => {
  if (!hasMore) return null;
  return (
    <div className="mt-4 flex flex-col items-center gap-2" data-testid="incremental-list-footer">
      {/* Keyed by the window size so each growth remounts the sentinel and a
          fresh observer re-checks intersection — otherwise a sentinel that
          is STILL in view after a growth step never fires again. */}
      <div key={visibleCount} ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
      <p className="text-xs text-slate-500" aria-live="polite">
        Showing {visibleCount} of {totalCount} {noun}
      </p>
      <Button variant="secondary" size="sm" onClick={showMore}>
        Show more ({remaining} remaining)
      </Button>
    </div>
  );
};
