
import React, { useEffect, useRef } from 'react';
import { Icons } from '@/components/common/Icons';
import { SHORTCUTS, formatShortcut } from '@/utils/keyboardShortcuts';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({ isOpen, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click-outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-end pt-14 pr-4"
      style={{ pointerEvents: 'none' }}
    >
      <div
        ref={panelRef}
        className="w-72 bg-stone-900 border border-stone-700 rounded-xl shadow-2xl overflow-hidden"
        style={{ pointerEvents: 'auto' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700">
          <div className="flex items-center gap-2">
            <Icons.Keyboard className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-stone-100">Keyboard Shortcuts</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-stone-400 hover:text-stone-200 hover:bg-stone-700 transition-colors"
            aria-label="Close shortcuts help"
            type="button"
          >
            <Icons.X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcut list */}
        <ul className="py-2">
          {SHORTCUTS.map((shortcut) => (
            <li
              key={shortcut.action + shortcut.key}
              className="flex items-center justify-between px-4 py-2"
            >
              <span className="text-sm text-stone-300">{shortcut.description}</span>
              <kbd className="ml-3 flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded border border-stone-600 bg-stone-800 text-stone-300 text-xs font-mono">
                {formatShortcut(shortcut)}
              </kbd>
            </li>
          ))}
        </ul>

        {/* Footer note */}
        <div className="px-4 py-2 border-t border-stone-800">
          <p className="text-xs text-stone-500">Shortcuts are suppressed when typing in inputs.</p>
        </div>
      </div>
    </div>
  );
};
