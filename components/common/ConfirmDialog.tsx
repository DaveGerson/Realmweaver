
import React from 'react';
import { DialogShell } from './DialogShell';
import { Button } from './Button';

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
  return (
    <DialogShell isOpen={isOpen} onClose={onCancel} ariaLabel={title}>
      <div className="relative w-full max-w-md bg-slate-800 border border-slate-700 rounded-lg shadow-2xl animate-fade-in">
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
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </DialogShell>
  );
};
