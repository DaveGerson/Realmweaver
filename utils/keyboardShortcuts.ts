
export interface KeyboardShortcut {
  key: string;           // e.g. 'k', 'n', 's', 'Escape'
  ctrlOrMeta: boolean;   // Ctrl on Windows/Linux, Cmd on Mac
  description: string;
  action: string;        // Action identifier used in switch dispatch
}

export const SHORTCUTS: KeyboardShortcut[] = [
  { key: 'k', ctrlOrMeta: true,  description: 'Open search / command palette', action: 'search' },
  { key: 'n', ctrlOrMeta: true,  description: 'New entity (go to current view dashboard)', action: 'new-entity' },
  { key: 's', ctrlOrMeta: true,  description: 'Force save', action: 'save' },
  { key: '/', ctrlOrMeta: false, description: 'Open search / command palette', action: 'search' },
  { key: 'Escape', ctrlOrMeta: false, description: 'Close active modal', action: 'close' },
  { key: '?', ctrlOrMeta: false, description: 'Show keyboard shortcuts', action: 'help' },
];

/** Returns true when focus is inside a text-entry element where shortcuts must be suppressed. */
function isFocusedInInput(): boolean {
  const target = document.activeElement as HTMLElement | null;
  if (!target) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || target.isContentEditable;
}

/**
 * Check if a keyboard event matches any registered shortcut.
 * Returns the action identifier string, or null if no match.
 * Suppresses all non-modifier shortcuts (ctrlOrMeta: false) when focus is in
 * an input/textarea/contenteditable.
 */
export function matchShortcut(event: KeyboardEvent): string | null {
  for (const shortcut of SHORTCUTS) {
    const modifierMatch = shortcut.ctrlOrMeta
      ? event.ctrlKey || event.metaKey
      : !event.ctrlKey && !event.metaKey && !event.altKey;

    if (!modifierMatch) continue;
    if (event.key !== shortcut.key) continue;

    // Suppress bare key shortcuts (no modifier) when inside an input
    if (!shortcut.ctrlOrMeta && isFocusedInInput()) continue;

    return shortcut.action;
  }
  return null;
}

/** Returns the platform-appropriate modifier symbol for display. */
export function getModifierSymbol(): string {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
    ? '⌘'
    : 'Ctrl';
}

/** Format a shortcut for display, e.g. "⌘K" or "Ctrl+S". */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const mod = getModifierSymbol();
  const key = shortcut.key === 'Escape' ? 'Esc' : shortcut.key.toUpperCase();
  return shortcut.ctrlOrMeta ? `${mod}+${key}` : key;
}
