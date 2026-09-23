
import React, { useMemo } from 'react';
import type { Campaign } from '@/types/index';
import { Button } from '@/components/common/Button';
import { Icons } from '@/components/common/Icons';
import { sampleDormantMaterial, type DormantPiece } from '@/utils/dormantMaterial';

/**
 * 'previously-on' stays wired to the shipped `generateColdOpen` call —
 * unchanged behaviour, unchanged label — so it is deliberately not a member
 * of `StrongStartRequest['style']` in `services/ai/dmCoach.ts`. The other two
 * route through the new `generateStrongStart` facade function.
 */
export type StrongStartStyle = 'previously-on' | 'action' | 'reincorporate';

export interface StrongStartStylesProps {
  campaign: Campaign;
  /** Gates the "Draft it from last session" chip — the unchanged `hasColdOpenMaterial` precondition. */
  canDraftColdOpen: boolean;
  /** Shared latch state across all three styles AND both call sites (lazy Strong Start step, standard Go Live step) — only one of which is ever mounted at a time. */
  phase: 'idle' | 'loading' | 'error';
  onSelectStyle: (style: StrongStartStyle, dormantPiece?: DormantPiece) => void;
}

/**
 * §4.6 Strong Start Styles (docs/design/lazy-dm-lens.md §4.6) — a small row
 * of drafting styles, replacing the single "Draft it from last session"
 * button at both places the cold-open action lives.
 *
 * "Draft it from last session" itself is UNCHANGED — same accessible name,
 * same `hasColdOpenMaterial` gate, same call shape — so every pinned
 * cold-open test (tests/coldOpen.prepWizard.test.tsx) keeps passing
 * untouched. "Drop into action" never hides: it works even in a brand-new
 * campaign with nothing played or prepped yet. "Reincorporate" hides itself
 * when there is nothing dormant to sample — the same graceful-empty posture
 * the Callback Machine already uses.
 */
export const StrongStartStyles: React.FC<StrongStartStylesProps> = ({
  campaign,
  canDraftColdOpen,
  phase,
  onSelectStyle,
}) => {
  // Sampled once per campaign identity, not re-rolled on every render or on
  // every click — what is shown is exactly what a click on "Reincorporate"
  // spends.
  const dormantPiece = useMemo<DormantPiece | undefined>(
    () => sampleDormantMaterial({ campaign, count: 1 })[0],
    [campaign]
  );

  const busy = phase === 'loading';

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {canDraftColdOpen && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onSelectStyle('previously-on')}
            disabled={busy}
          >
            <Icons.Sparkles className="w-4 h-4 mr-1.5" />
            Draft it from last session
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onSelectStyle('action')}
          disabled={busy}
        >
          <Icons.Sparkles className="w-4 h-4 mr-1.5" />
          Drop into action
        </Button>
        {dormantPiece && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onSelectStyle('reincorporate', dormantPiece)}
            disabled={busy}
            title={dormantPiece.label}
          >
            <Icons.Sparkles className="w-4 h-4 mr-1.5" />
            Reincorporate
          </Button>
        )}
      </div>

      {!canDraftColdOpen && (
        <p className="text-xs text-slate-500 italic mt-2">
          Star a moment at the table or write a recap when the session ends, and this drafts itself.
        </p>
      )}

      {phase === 'error' && (
        <p role="status" className="text-xs text-red-400 mt-2">
          That didn't come through. Try it again in a moment.
        </p>
      )}
    </div>
  );
};
