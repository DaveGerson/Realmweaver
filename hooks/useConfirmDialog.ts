
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

interface ConfirmOptions {
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
}

interface DialogState {
  isOpen: boolean;
  title: string;
  message: string;
  options: ConfirmOptions;
}

interface ConfirmDialogContextValue {
  confirm: (title: string, message: string, options?: ConfirmOptions) => Promise<boolean>;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

const INITIAL_STATE: DialogState = {
  isOpen: false,
  title: '',
  message: '',
  options: {},
};

interface ConfirmDialogProviderProps {
  children: React.ReactNode;
}

export const ConfirmDialogProvider: React.FC<ConfirmDialogProviderProps> = ({ children }) => {
  const [dialogState, setDialogState] = useState<DialogState>(INITIAL_STATE);
  // Holds the resolve function for the currently open dialog
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback(
    (title: string, message: string, options: ConfirmOptions = {}): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setDialogState({ isOpen: true, title, message, options });
      });
    },
    []
  );

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setDialogState(INITIAL_STATE);
  }, []);

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setDialogState(INITIAL_STATE);
  }, []);

  return React.createElement(
    ConfirmDialogContext.Provider,
    { value: { confirm } },
    children,
    React.createElement(ConfirmDialog, {
      isOpen: dialogState.isOpen,
      title: dialogState.title,
      message: dialogState.message,
      confirmLabel: dialogState.options.confirmLabel,
      cancelLabel: dialogState.options.cancelLabel,
      variant: dialogState.options.variant,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    })
  );
};

export const useConfirmDialog = (): ConfirmDialogContextValue => {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    throw new Error('useConfirmDialog must be used within a ConfirmDialogProvider');
  }
  return ctx;
};
