
import React, { createContext, useCallback, useContext, useState } from 'react';
import type { Toast, ToastVariant } from '@/components/common/ToastContainer';
import { ToastContainer } from '@/components/common/ToastContainer';

const MAX_TOASTS = 3;

interface ToastContextValue {
  addToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = crypto.randomUUID();
    setToasts((prev) => {
      const next = [...prev, { id, message, variant }];
      // If over the limit, drop the oldest entries first
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    });
  }, []);

  return React.createElement(
    ToastContext.Provider,
    { value: { addToast } },
    children,
    React.createElement(ToastContainer, { toasts, onDismiss: dismiss })
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};
