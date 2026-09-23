import React from 'react';
import { Button } from '../common/Button';
import { Icons } from '../common/Icons';
import { MODAL_INERT_EXEMPT_ATTR } from '@/utils/modalStack';

/**
 * Both banners guard data safety (autosave is PAUSED while a conflict is
 * unresolved), so an open dialog must never hide them (roadmap X4):
 *  - `data-modal-inert-exempt` keeps them out of DialogShell's background
 *    `inert` / `aria-hidden` sweep (utils/modalStack splits the app root
 *    around them);
 *  - `relative z-[85]` lifts them above the dialog backdrop (z-[80]) and
 *    below toasts (z-[90]) on the z-index ladder, so they stay visible and
 *    clickable even over e.g. the auto-opened FirstCampaignWizard.
 */
const STATUS_BANNER_LAYER = { [MODAL_INERT_EXEMPT_ATTR]: '' } as const;

interface ConflictBannerProps {
  /** campaignService's state.conflictDetected */
  isOpen: boolean;
  /** campaignService.resolveConflict */
  onResolve: (choice: 'reload' | 'overwrite') => void;
}

/**
 * Multi-tab conflict banner (EXTRA #1). wp-a-persistence's init() detects
 * that another browser tab wrote fresh campaign data via a `storage` event
 * listener and sets `state.conflictDetected`; `persistToStorage` refuses to
 * write while that flag is set, so this tab's autosave is silently paused
 * until the GM picks a side. Contract (services/campaignService.ts's
 * `resolveConflict` docblock): 'reload' adopts the other tab's on-disk
 * snapshot, 'overwrite' force-saves this tab's in-memory copy over it.
 * Either choice clears the flag and resumes autosave.
 */
export const ConflictBanner: React.FC<ConflictBannerProps> = ({ isOpen, onResolve }) => {
  if (!isOpen) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      {...STATUS_BANNER_LAYER}
      className="relative z-[85] flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 bg-amber-950/60 border-b border-amber-700/60 text-amber-200 text-sm flex-shrink-0"
    >
      <Icons.AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" aria-hidden="true" />
      <span className="flex-1 min-w-[240px]">
        This campaign was changed in another browser tab. Autosave is paused here until you choose which copy to keep.
      </span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => onResolve('reload')}>
          Reload other tab&apos;s version
        </Button>
        <Button size="sm" variant="primary" onClick={() => onResolve('overwrite')}>
          Keep mine
        </Button>
      </div>
    </div>
  );
};

interface BackupRecoveryBannerProps {
  /** campaignService's state.recoveredFromBackup */
  isOpen: boolean;
  /** campaignService.dismissBackupRecoveryNotice */
  onDismiss: () => void;
}

/**
 * Finding idx7's backup-recovery notice. init() sets
 * `state.recoveredFromBackup` when the primary saved payload failed to parse
 * and it had to fall back to a rotating backup slot — the GM is silently
 * continuing from a slightly older snapshot unless this is surfaced.
 */
export const BackupRecoveryBanner: React.FC<BackupRecoveryBannerProps> = ({ isOpen, onDismiss }) => {
  if (!isOpen) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      {...STATUS_BANNER_LAYER}
      className="relative z-[85] flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 bg-amber-950/60 border-b border-amber-700/60 text-amber-200 text-sm flex-shrink-0"
    >
      <Icons.AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" aria-hidden="true" />
      <span className="flex-1 min-w-[240px]">
        Your saved campaign data couldn&apos;t be read and was recovered from a recent backup — a small amount of very recent work may be missing.
      </span>
      <Button size="sm" variant="ghost" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
};
