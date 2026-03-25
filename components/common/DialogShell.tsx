
import React, { useEffect, useRef, useCallback } from 'react';
import { twMerge } from 'tailwind-merge';

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

interface DialogShellProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

/**
 * DialogShell — accessible modal wrapper.
 *
 * Provides:
 *   - role="dialog" aria-modal="true"
 *   - Focus trap (Tab / Shift+Tab stay within dialog)
 *   - Escape key to close
 *   - Backdrop click to close
 *   - Body scroll lock while open
 *   - Dark backdrop (bg-black/60)
 */
export const DialogShell: React.FC<DialogShellProps> = ({
  isOpen,
  onClose,
  children,
  className,
  ariaLabel,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus the first focusable element when opened; restore focus when closed.
  const previousFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement;

    const frame = requestAnimationFrame(() => {
      if (!dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        dialogRef.current.focus();
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      if (previousFocusRef.current && 'focus' in previousFocusRef.current) {
        (previousFocusRef.current as HTMLElement).focus();
      }
    };
  }, [isOpen]);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Keyboard handler: Escape closes, Tab traps focus
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        if (!dialogRef.current) return;
        const allFocusable: HTMLElement[] = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
        );
        const focusable: HTMLElement[] = allFocusable.filter(
          (el: HTMLElement) => !el.closest('[aria-hidden="true"]')
        );

        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first: HTMLElement = focusable[0];
        const last: HTMLElement = focusable[focusable.length - 1];

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
    },
    [onClose]
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
      // Keyboard events bubble up from children inside the portal
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={twMerge('outline-none', className)}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </div>
  );
};
