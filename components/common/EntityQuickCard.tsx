
import React, { useEffect, useRef, useCallback, useState } from 'react';
import ReactDOM from 'react-dom';
import { Icons } from '@/components/common/Icons';
import { campaignService } from '@/services/campaignService';
import { ENTITY_TYPE_CONFIG } from '@/utils/entityUtils';
import {
  lookupEntity,
  getExpandedDetails,
} from '@/utils/entityDetailExtractors';
import type { QuickCardEntityType, EntityDetail, ExpandedDetail } from '@/utils/entityDetailExtractors';
import { saveEntityField } from '@/utils/entityFieldSave';
import { calculatePopoverPosition } from '@/utils/popoverPosition';

// Re-export so existing consumers importing QuickCardEntityType from here continue to work.
export type { QuickCardEntityType } from '@/utils/entityDetailExtractors';

// ─── Entity type configuration ──────────────────────────────────────────────

interface EntityTypeConfig {
  label: string;
  badgeClass: string;       // bg-* text-* classes for the type badge
  borderClass: string;      // left-border accent class
  Icon: React.ElementType;
}

// Build EntityQuickCard config from the centralized ENTITY_TYPE_CONFIG.
// scene is card-local only (not in the global config) so it is defined inline.
function makeQuickCardConfig(type: QuickCardEntityType): EntityTypeConfig {
  if (type === 'scene') {
    return { label: 'Scene', badgeClass: 'bg-blue-900/60 text-blue-300', borderClass: 'border-l-blue-500', Icon: Icons.Scenes };
  }
  const base = ENTITY_TYPE_CONFIG[type];
  const c = base.color;
  const singularLabel = base.label.replace(/s$/, '');
  const labelOverrides: Partial<Record<QuickCardEntityType, string>> = {
    'session-log': 'Session',
    'player-character': 'Character',
    npc: 'NPC',
  };
  return {
    label: labelOverrides[type] ?? singularLabel,
    badgeClass: `bg-${c}-900/60 text-${c}-300`,
    borderClass: `border-l-${c}-500`,
    Icon: Icons[base.icon as keyof typeof Icons] as React.ElementType,
  };
}

const ENTITY_CONFIG: Record<QuickCardEntityType, EntityTypeConfig> = {
  npc:              makeQuickCardConfig('npc'),
  location:         makeQuickCardConfig('location'),
  faction:          makeQuickCardConfig('faction'),
  item:             makeQuickCardConfig('item'),
  adventure:        makeQuickCardConfig('adventure'),
  article:          makeQuickCardConfig('article'),
  plot:             makeQuickCardConfig('plot'),
  'session-log':    makeQuickCardConfig('session-log'),
  'player-character': makeQuickCardConfig('player-character'),
  scene:            makeQuickCardConfig('scene'),
};

// ─── EntityQuickCard (the floating card) ─────────────────────────────────────

export interface EntityQuickCardProps {
  entityType: QuickCardEntityType;
  entityId: string;
  triggerRect: DOMRect;
  /** Called when user clicks "View" or the card's navigate action */
  onNavigate: (entityType: QuickCardEntityType, entityId: string) => void;
  /** Called when the popover should close */
  onClose: () => void;
  /** Called when the pointer enters the card (keeps it alive during hover) */
  onPointerEnter?: () => void;
  /** Called when the pointer leaves the card */
  onPointerLeave?: () => void;
}

export const EntityQuickCard: React.FC<EntityQuickCardProps> = React.memo(({
  entityType,
  entityId,
  triggerRect,
  onNavigate,
  onClose,
  onPointerEnter,
  onPointerLeave,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const config = ENTITY_CONFIG[entityType];

  const campaign = campaignService.getActiveCampaign();
  const entityData = lookupEntity(entityType, entityId, campaign);

  // Position recalculates on every render — isExpanded triggers re-render
  const { top, left } = calculatePopoverPosition(triggerRect, isExpanded);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close on outside click
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use capture so we intercept before the trigger's own pointer handler
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [onClose]);

  const handleCopyName = useCallback(() => {
    if (entityData?.name) {
      navigator.clipboard.writeText(entityData.name).catch(() => {
        // Clipboard API may not be available in all contexts; silently ignore
      });
    }
    onClose();
  }, [entityData, onClose]);

  const handleNavigate = useCallback(() => {
    onNavigate(entityType, entityId);
    onClose();
  }, [onNavigate, entityType, entityId, onClose]);

  const handleToggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // ── Mobile bottom sheet ───────────────────────────────────────────────────
  // On screens narrower than 768px, render as a fixed bottom sheet overlay.
  const isMobile = window.innerWidth < 768;

  if (isMobile) {
    return ReactDOM.createPortal(
      <div
        className="fixed inset-0 z-[80] flex flex-col justify-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onPointerDown={(e) => {
          // Close when tapping the backdrop (not the card itself)
          if (e.target === e.currentTarget) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`Quick info: ${entityData?.name ?? 'Entity'}`}
      >
        <div
          ref={cardRef}
          className={`bg-slate-800 border-t-2 border-slate-600 border-l-4 ${config.borderClass} rounded-t-xl p-4 w-full overflow-y-auto shadow-xl transition-all duration-200 ${isExpanded ? 'max-h-[80vh]' : 'max-h-[60vh]'}`}
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <QuickCardContent
            config={config}
            entityData={entityData}
            entityType={entityType}
            entityId={entityId}
            onNavigate={handleNavigate}
            onCopyName={handleCopyName}
            onClose={onClose}
            isExpanded={isExpanded}
            onToggleExpand={handleToggleExpand}
          />
        </div>
      </div>,
      document.body
    );
  }

  // ── Desktop popover ───────────────────────────────────────────────────────
  return ReactDOM.createPortal(
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="false"
      aria-label={`Quick info: ${entityData?.name ?? 'Entity'}`}
      className={`fixed z-50 bg-slate-800 border border-slate-600 border-l-4 ${config.borderClass} rounded-lg shadow-xl transition-all duration-200 ${isExpanded ? 'w-96' : 'w-72'}`}
      style={{ top, left }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <QuickCardContent
        config={config}
        entityData={entityData}
        entityType={entityType}
        entityId={entityId}
        onNavigate={handleNavigate}
        onCopyName={handleCopyName}
        onClose={onClose}
        isExpanded={isExpanded}
        onToggleExpand={handleToggleExpand}
      />
    </div>,
    document.body
  );
});

// ─── Editable field component ─────────────────────────────────────────────────

interface EditableFieldProps {
  label: string;
  value: string;
  fieldKey: string;
  entityType: QuickCardEntityType;
  entityId: string;
  multiline?: boolean;
}

const EditableField: React.FC<EditableFieldProps> = ({
  label,
  value,
  fieldKey,
  entityType,
  entityId,
  multiline,
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [savedIndicator, setSavedIndicator] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local value if the prop changes (external update from outside)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleBlur = useCallback(() => {
    if (localValue === value) return; // no change, skip save
    saveEntityField(entityType, entityId, fieldKey, localValue);
    setSavedIndicator(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSavedIndicator(false), 1500);
  }, [localValue, value, entityType, entityId, fieldKey]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const baseInputClass =
    'w-full bg-slate-700/60 border border-slate-600 rounded text-xs text-slate-200 px-2 py-1 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 placeholder-slate-500 resize-none';

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-slate-500 text-xs">{label}</span>
        {savedIndicator && (
          <span className="text-xs text-emerald-400 flex items-center gap-0.5">
            <Icons.Check className="w-3 h-3" />
            saved
          </span>
        )}
      </div>
      {multiline ? (
        <textarea
          className={`${baseInputClass} min-h-[60px]`}
          value={localValue}
          onChange={e => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          rows={3}
          aria-label={label}
        />
      ) : (
        <input
          type="text"
          className={baseInputClass}
          value={localValue}
          onChange={e => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          aria-label={label}
        />
      )}
    </div>
  );
};

// ─── Inner card content (shared between mobile/desktop) ──────────────────────

interface QuickCardContentProps {
  config: EntityTypeConfig;
  entityData: { name: string; details: EntityDetail[] } | null;
  entityType: QuickCardEntityType;
  entityId: string;
  onNavigate: () => void;
  onCopyName: () => void;
  onClose: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const QuickCardContent: React.FC<QuickCardContentProps> = ({
  config,
  entityData,
  entityType,
  entityId,
  onNavigate,
  onCopyName,
  onClose,
  isExpanded,
  onToggleExpand,
}) => {
  const [pinned, setPinned] = useState(() => campaignService.isPinned(entityType, entityId));
  if (!entityData) {
    return (
      <div className="p-3 text-slate-400 text-sm">
        Entity not found.
      </div>
    );
  }

  // Expanded details are only fetched when the panel is open
  const campaign = isExpanded ? campaignService.getActiveCampaign() : null;
  const expandedDetails: ExpandedDetail[] | null = isExpanded ? getExpandedDetails(entityType, entityId, campaign) : null;

  // Player characters: show read-only expanded data, no editable fields
  const isPlayerCharacter = entityType === 'player-character';

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <config.Icon className="w-4 h-4 flex-shrink-0 text-slate-400" />
          <span className="font-semibold text-slate-100 text-sm truncate">{entityData.name}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${config.badgeClass}`}>
            {config.label}
          </span>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
            aria-label="Close"
          >
            <Icons.X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Compact details row (collapsed mode only) */}
      {!isExpanded && entityData.details.length > 0 && (
        <dl className="px-3 pb-2 space-y-1">
          {entityData.details.map((detail, i) => (
            <div key={i} className="flex gap-1.5 text-xs">
              <dt className="text-slate-500 flex-shrink-0 w-20 truncate">{detail.label}</dt>
              <dd className="text-slate-300 min-w-0 break-words">{detail.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Expanded details panel */}
      {isExpanded && (
        <div className="px-3 pb-2 max-h-[60vh] overflow-y-auto space-y-2.5">
          {isPlayerCharacter && (
            <p className="text-xs text-slate-500 italic mb-1">
              Player Characters support read-only preview here. Use the full editor to make changes.
            </p>
          )}
          {expandedDetails && expandedDetails.map((detail, i) => {
            if (!isPlayerCharacter && detail.editable && detail.fieldKey) {
              return (
                <EditableField
                  key={`${detail.fieldKey}-${i}`}
                  label={detail.label}
                  value={detail.value}
                  fieldKey={detail.fieldKey}
                  entityType={entityType}
                  entityId={entityId}
                  multiline={detail.multiline}
                />
              );
            }
            // Read-only row
            return (
              <div key={i} className="space-y-0.5">
                <span className="text-slate-500 text-xs block">{detail.label}</span>
                <p className="text-slate-300 text-xs leading-relaxed break-words">
                  {detail.value || <span className="text-slate-600 italic">empty</span>}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Action bar */}
      <div className="border-t border-slate-700 px-3 py-2 flex items-center gap-2 flex-wrap">
        <button
          onClick={onNavigate}
          className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors min-h-[44px] sm:min-h-0 py-2 sm:py-1 px-1"
          aria-label={`View ${entityData.name}`}
        >
          <Icons.FolderOpen className="w-3.5 h-3.5" />
          View
        </button>
        <button
          onClick={onNavigate}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors min-h-[44px] sm:min-h-0 py-2 sm:py-1 px-1"
          aria-label={`Edit ${entityData.name}`}
        >
          <Icons.Edit className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          onClick={onToggleExpand}
          className={`flex items-center gap-1.5 text-xs transition-colors min-h-[44px] sm:min-h-0 py-2 sm:py-1 px-1 ${isExpanded ? 'text-amber-400 hover:text-amber-300' : 'text-slate-400 hover:text-slate-200'}`}
          aria-label={isExpanded ? 'Collapse quick card' : 'Expand quick card'}
          aria-expanded={isExpanded}
        >
          {isExpanded
            ? <Icons.Minimize className="w-3.5 h-3.5" />
            : <Icons.Maximize className="w-3.5 h-3.5" />
          }
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
        <button
          onClick={() => {
            if (pinned) {
              campaignService.unpinEntity(entityType, entityId);
            } else {
              campaignService.pinEntity(entityType, entityId);
            }
            setPinned(prev => !prev);
          }}
          className={`flex items-center gap-1.5 text-xs transition-colors min-h-[44px] sm:min-h-0 py-2 sm:py-1 px-1 ${pinned ? 'text-amber-400 hover:text-amber-300' : 'text-slate-400 hover:text-slate-200'}`}
          aria-label={pinned ? `Unpin ${entityData.name}` : `Pin ${entityData.name}`}
          title={pinned ? 'Unpin from sidebar' : 'Pin to sidebar'}
        >
          {pinned ? <Icons.Star className="w-3.5 h-3.5 fill-current" /> : <Icons.Star className="w-3.5 h-3.5" />}
          {pinned ? 'Pinned' : 'Pin'}
        </button>
        <button
          onClick={onCopyName}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors min-h-[44px] sm:min-h-0 py-2 sm:py-1 px-1 ml-auto"
          aria-label={`Copy name: ${entityData.name}`}
        >
          <Icons.Clipboard className="w-3.5 h-3.5" />
          Copy Name
        </button>
      </div>
    </div>
  );
};
