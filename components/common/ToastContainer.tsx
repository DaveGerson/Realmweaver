
import React, { useEffect } from 'react';
import { twMerge } from 'tailwind-merge';
import { Icons } from '@/components/common/Icons';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const VARIANT_STYLES: Record<ToastVariant, { container: string; icon: React.ReactNode }> = {
  success: {
    container: 'bg-slate-800 border-green-600/60 text-green-300',
    icon: <Icons.CheckCircle className="w-4 h-4 flex-shrink-0 text-green-400" />,
  },
  error: {
    container: 'bg-slate-800 border-red-600/60 text-red-300',
    icon: <Icons.AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400" />,
  },
  info: {
    container: 'bg-slate-800 border-amber-500/60 text-amber-300',
    icon: <Icons.Help className="w-4 h-4 flex-shrink-0 text-amber-400" />,
  },
};

const DISMISS_DELAY_MS = 4000;

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const styles = VARIANT_STYLES[toast.variant];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), DISMISS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={twMerge(
        'flex items-start gap-3 w-80 px-4 py-3 rounded-lg border shadow-lg animate-fade-in',
        styles.container
      )}
    >
      {styles.icon}
      <span className="text-sm flex-1 text-slate-200">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 text-slate-400 hover:text-slate-200 transition-colors"
        aria-label="Dismiss notification"
      >
        <Icons.X className="w-4 h-4" />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-[90] flex flex-col gap-2 items-end"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};
