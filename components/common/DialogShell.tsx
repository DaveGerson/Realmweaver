
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

/**
 * Whether an element inside the dialog is actually reachable by a keyboard
 * user — i.e. not hidden behind an in-dialog overlay (inert/hidden/
 * aria-hidden ancestor) and not itself display:none / visibility:hidden.
 *
 * NOTE: deliberately does NOT rely on `el.offsetParent` or
 * `el.getClientRects()` — jsdom performs no layout, so those are always
 * null/empty even for elements that are genuinely visible, which would
 * filter out every element under any jsdom-based test. Attribute and
 * computed-style checks work correctly in both jsdom and real browsers.
 */
function isReachable(el: HTMLElement): boolean {
  if (el.closest('[inert], [hidden], [aria-hidden="true"]')) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  return true;
}

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

  // Tracks whether the mousedown that started the current press landed
  // directly on the backdrop (not inside the panel). A `click` event fires
  // on the nearest common ancestor of the mousedown/mouseup targets, so a
  // text-selection drag that starts inside the panel and is released over
  // the backdrop would otherwise dispatch its click on the backdrop and
  // close the dialog, discarding unsaved in-progress state.
  const backdropPressStartedRef = useRef(false);

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
        // A child that already consumed this Escape (e.g. MentionInput
        // closing its suggestion dropdown) marks it defaultPrevented —
        // the dialog must stay open in that case (finding #52).
        if (e.defaultPrevented) return;
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        if (!dialogRef.current) return;
        const allFocusable: HTMLElement[] = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
        );
        const focusable: HTMLElement[] = allFocusable.filter(isReachable);

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

  const handleBackdropMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    backdropPressStartedRef.current = e.target === e.currentTarget;
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const pressStartedOnBackdrop = backdropPressStartedRef.current;
      backdropPressStartedRef.current = false;
      if (e.target === e.currentTarget && pressStartedOnBackdrop) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
      onMouseDown={handleBackdropMouseDown}
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
