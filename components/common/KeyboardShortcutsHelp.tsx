
import React from 'react';
import { Icons } from '@/components/common/Icons';
import { DialogShell } from '@/components/common/DialogShell';
import { SHORTCUTS, formatShortcut } from '@/utils/keyboardShortcuts';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({ isOpen, onClose }) => {
  return (
    <DialogShell
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Keyboard shortcuts"
    >
      <div className="w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Icons.Keyboard className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-slate-100">Keyboard Shortcuts</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
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
              <span className="text-sm text-slate-300">{shortcut.description}</span>
              <kbd className="ml-3 flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded border border-slate-600 bg-slate-800 text-slate-300 text-xs font-mono">
                {formatShortcut(shortcut)}
              </kbd>
            </li>
          ))}
        </ul>

        {/* Footer note */}
        <div className="px-4 py-2 border-t border-slate-800">
          <p className="text-xs text-slate-500">Shortcuts are suppressed when typing in inputs.</p>
        </div>
      </div>
    </DialogShell>
  );
};
