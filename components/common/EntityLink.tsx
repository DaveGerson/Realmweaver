
/**
 * EntityLink — renders an entity name as a styled inline link.
 *
 * On desktop hover (after a 200ms delay) it shows an EntityQuickCard popover.
 * On mobile tap it shows the card as a bottom sheet.
 * Clicking the link text navigates to the entity editor via `onNavigate`.
 *
 * Usage:
 *   <EntityLink
 *     entityType="npc"
 *     entityId={npc.id}
 *     label={npc.name}
 *     onNavigate={(type, id) => { setView(type + 's'); setSelectedId(id); }}
 *   />
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { EntityQuickCard } from '@/components/common/EntityQuickCard';
import type { QuickCardEntityType } from '@/components/common/EntityQuickCard';

// ─── Accent color per entity type ────────────────────────────────────────────

const ENTITY_TEXT_CLASS: Record<QuickCardEntityType, string> = {
  npc: 'text-amber-400 hover:text-amber-300',
  location: 'text-emerald-400 hover:text-emerald-300',
  faction: 'text-violet-400 hover:text-violet-300',
  item: 'text-sky-400 hover:text-sky-300',
  adventure: 'text-orange-400 hover:text-orange-300',
  article: 'text-cyan-400 hover:text-cyan-300',
  plot: 'text-yellow-400 hover:text-yellow-300',
  'session-log': 'text-rose-400 hover:text-rose-300',
  'player-character': 'text-indigo-400 hover:text-indigo-300',
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface EntityLinkProps {
  entityType: QuickCardEntityType;
  entityId: string;
  /** Display text; defaults to entityId if omitted */
  label?: string;
  /**
   * Called when the user clicks "View" / "Edit" in the popover, or clicks the
   * link text directly. The parent is responsible for navigating to the editor.
   */
  onNavigate: (entityType: QuickCardEntityType, entityId: string) => void;
  /** Additional className to merge onto the trigger element */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const HOVER_DELAY_MS = 200;

export const EntityLink: React.FC<EntityLinkProps> = ({
  entityType,
  entityId,
  label,
  onNavigate,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether the card is being hovered so we don't close on trigger leave
  const cardHoveredRef = useRef(false);

  const colorClass = ENTITY_TEXT_CLASS[entityType] ?? 'text-stone-300 hover:text-stone-100';

  // ── Open/close helpers ───────────────────────────────────────────────────

  const openCard = useCallback(() => {
    if (triggerRef.current) {
      setTriggerRect(triggerRef.current.getBoundingClientRect());
      setIsOpen(true);
    }
  }, []);

  const closeCard = useCallback(() => {
    setIsOpen(false);
    setTriggerRect(null);
    cardHoveredRef.current = false;
  }, []);

  // ── Hover handling (desktop) ─────────────────────────────────────────────

  const handlePointerEnter = useCallback(() => {
    // Only show on hover for non-touch (touch devices have pointer type "touch")
    hoverTimerRef.current = setTimeout(() => {
      openCard();
    }, HOVER_DELAY_MS);
  }, [openCard]);

  const handlePointerLeave = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    // Give a generous grace window so the user can move the pointer to the card.
    setTimeout(() => {
      if (!cardHoveredRef.current) {
        closeCard();
      }
    }, 300);
  }, [closeCard]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current !== null) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  // ── Card hover callbacks (keep card open while user interacts) ──────────

  const handleCardPointerEnter = useCallback(() => {
    cardHoveredRef.current = true;
  }, []);

  const handleCardPointerLeave = useCallback(() => {
    cardHoveredRef.current = false;
    // Delay close so brief pointer exits (e.g. moving between action buttons) don't dismiss
    setTimeout(() => {
      if (!cardHoveredRef.current) {
        closeCard();
      }
    }, 300);
  }, [closeCard]);

  // ── Click handling ───────────────────────────────────────────────────────

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (isOpen) {
      closeCard();
    } else {
      openCard();
    }
  }, [isOpen, openCard, closeCard]);

  // ── Navigate callback passed to card ────────────────────────────────────

  const handleNavigate = useCallback((type: QuickCardEntityType, id: string) => {
    onNavigate(type, id);
    closeCard();
  }, [onNavigate, closeCard]);

  const displayText = label ?? entityId;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleClick}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        className={[
          'inline underline decoration-dotted underline-offset-2 cursor-pointer',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm',
          'transition-colors',
          colorClass,
          className,
        ].join(' ')}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`Show quick info for ${displayText}`}
      >
        {displayText}
      </button>

      {isOpen && triggerRect && (
        <EntityQuickCard
          entityType={entityType}
          entityId={entityId}
          triggerRect={triggerRect}
          onNavigate={handleNavigate}
          onClose={closeCard}
          onPointerEnter={handleCardPointerEnter}
          onPointerLeave={handleCardPointerLeave}
        />
      )}
    </>
  );
};
