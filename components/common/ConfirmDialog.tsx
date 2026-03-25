
import React, { useEffect, useRef } from 'react';
import { twMerge } from 'tailwind-merge';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

const BASE_BTN = 'inline-flex items-center justify-center rounded-md font-semibold text-sm px-4 py-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 transition-colors disabled:opacity-50';
const CANCEL_BTN = twMerge(BASE_BTN, 'bg-slate-700 text-slate-100 hover:bg-slate-600 focus:ring-slate-500');
const CONFIRM_BTN = twMerge(BASE_BTN, 'bg-amber-600 text-white hover:bg-amber-500 focus:ring-amber-500');
const DANGER_BTN  = twMerge(BASE_BTN, 'bg-red-800 text-white hover:bg-red-700 focus:ring-red-600');

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus the cancel button when the dialog opens
  useEffect(() => {
    if (isOpen) {
      cancelRef.current?.focus();
    }
  }, [isOpen]);

  // Escape key and focus trap
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLElement[];
        if (focusable.length < 2) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md bg-slate-800 border border-slate-700 rounded-lg shadow-2xl animate-fade-in">
        <div className="p-6">
          <h2
            id="confirm-dialog-title"
            className="text-lg font-semibold text-slate-100 mb-2 font-serif"
          >
            {title}
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">{message}</p>
        </div>

        <div className="flex justify-end gap-3 px-6 pb-5">
          <button ref={cancelRef} className={CANCEL_BTN} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            className={variant === 'danger' ? DANGER_BTN : CONFIRM_BTN}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
