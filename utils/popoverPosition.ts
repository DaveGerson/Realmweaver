
// ─── Popover positioning ─────────────────────────────────────────────────────

export interface PopoverPosition {
  top: number;
  left: number;
  openUpward: boolean;
}

export function calculatePopoverPosition(triggerRect: DOMRect, isExpanded: boolean): PopoverPosition {
  // Use larger estimates when expanded so the card fits on screen
  const CARD_HEIGHT = isExpanded ? 480 : 240;
  const CARD_WIDTH  = isExpanded ? 384 : 280;
  const MARGIN = 8;
  const viewportHeight = window.innerHeight;
  const viewportWidth  = window.innerWidth;

  // Prefer opening below; flip upward if not enough space
  const openUpward = triggerRect.bottom + CARD_HEIGHT + MARGIN > viewportHeight
    && triggerRect.top - CARD_HEIGHT - MARGIN >= 0;

  const top = openUpward
    ? triggerRect.top + window.scrollY - CARD_HEIGHT - MARGIN
    : triggerRect.bottom + window.scrollY + MARGIN;

  // Align left with trigger but clamp to viewport
  let left = triggerRect.left + window.scrollX;
  if (left + CARD_WIDTH > viewportWidth - MARGIN) {
    left = viewportWidth - CARD_WIDTH - MARGIN;
  }
  if (left < MARGIN) left = MARGIN;

  return { top, left, openUpward };
}
