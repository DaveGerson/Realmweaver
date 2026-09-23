// @vitest-environment jsdom
/**
 * Roadmap X4 — DialogShell portal + background inert.
 *
 * Contract:
 *  - the dialog renders into `document.body` (not inside its React parent's
 *    DOM), so an ancestor's overflow/transform can't clip the fixed backdrop;
 *  - while open, every other top-level body node (the app root) is
 *    `inert` + `aria-hidden="true"`; only the TOPMOST dialog's background is
 *    hidden when dialogs stack; attributes are restored exactly on close;
 *  - the toast region (data-modal-inert-exempt) is never hidden;
 *  - focus is returned to the opener on close (after the background is
 *    un-inerted), Escape still closes, scroll lock still applies.
 */
import React, { useState } from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react';
import { DialogShell } from '../components/common/DialogShell';
import { ToastProvider, useToast } from '../hooks/useToast';
import { getModalLayerCount } from '../utils/modalStack';

beforeEach(() => {
  // Run the open-focus rAF synchronously so focus assertions are deterministic.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const Harness: React.FC<{ nested?: boolean }> = ({ nested }) => {
  const [open, setOpen] = useState(false);
  const [innerOpen, setInnerOpen] = useState(false);
  return (
    <div data-testid="app" style={{ overflow: 'hidden', transform: 'translateZ(0)' }}>
      <button onClick={() => setOpen(true)}>Open outer</button>
      <DialogShell isOpen={open} onClose={() => setOpen(false)} ariaLabel="Outer">
        <button onClick={() => setOpen(false)}>Close outer</button>
        {nested && <button onClick={() => setInnerOpen(true)}>Open inner</button>}
        {nested && (
          <DialogShell isOpen={innerOpen} onClose={() => setInnerOpen(false)} ariaLabel="Inner">
            <button onClick={() => setInnerOpen(false)}>Close inner</button>
          </DialogShell>
        )}
      </DialogShell>
    </div>
  );
};

function appRoot(container: HTMLElement): HTMLElement {
  // RTL mounts into a <div> appended to body — that div is the "app root".
  return container;
}

describe('DialogShell — portal (X4)', () => {
  it('renders the dialog as a descendant of document.body, outside its React parent DOM', () => {
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByText('Open outer'));
    const dialog = screen.getByRole('dialog', { name: 'Outer' });
    expect(container.contains(dialog)).toBe(false);
    expect(screen.getByTestId('app').contains(dialog)).toBe(false);
    // The backdrop is a direct child of <body>.
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(dialog.parentElement?.className).toContain('z-[80]');
  });
});

describe('DialogShell — background inert (X4)', () => {
  it('marks the app root inert + aria-hidden while open and restores on close', () => {
    const { container } = render(<Harness />);
    const root = appRoot(container);
    expect(root.hasAttribute('inert')).toBe(false);

    fireEvent.click(screen.getByText('Open outer'));
    expect(root.hasAttribute('inert')).toBe(true);
    expect(root.getAttribute('aria-hidden')).toBe('true');
    // The dialog itself is not hidden.
    const backdrop = screen.getByRole('dialog', { name: 'Outer' }).parentElement!;
    expect(backdrop.hasAttribute('inert')).toBe(false);
    expect(backdrop.hasAttribute('aria-hidden')).toBe(false);

    fireEvent.click(screen.getByText('Close outer'));
    expect(root.hasAttribute('inert')).toBe(false);
    expect(root.hasAttribute('aria-hidden')).toBe(false);
    expect(getModalLayerCount()).toBe(0);
  });

  it('restores pre-existing aria-hidden / inert values exactly', () => {
    const preHidden = document.createElement('div');
    preHidden.setAttribute('aria-hidden', 'false');
    const preInert = document.createElement('div');
    preInert.setAttribute('inert', '');
    preInert.setAttribute('aria-hidden', 'true');
    document.body.append(preHidden, preInert);
    try {
      render(<Harness />);
      fireEvent.click(screen.getByText('Open outer'));
      expect(preHidden.getAttribute('aria-hidden')).toBe('true');
      expect(preHidden.hasAttribute('inert')).toBe(true);

      fireEvent.click(screen.getByText('Close outer'));
      expect(preHidden.getAttribute('aria-hidden')).toBe('false');
      expect(preHidden.hasAttribute('inert')).toBe(false);
      expect(preInert.hasAttribute('inert')).toBe(true);
      expect(preInert.getAttribute('aria-hidden')).toBe('true');
    } finally {
      preHidden.remove();
      preInert.remove();
    }
  });

  it('hides only the topmost dialog\'s background when dialogs stack', () => {
    const { container } = render(<Harness nested />);
    fireEvent.click(screen.getByText('Open outer'));
    fireEvent.click(screen.getByText('Open inner'));

    const outerBackdrop = screen.getByRole('dialog', { name: 'Outer', hidden: true }).parentElement!;
    const innerBackdrop = screen.getByRole('dialog', { name: 'Inner' }).parentElement!;
    // Inner is portaled as its own body child, not inside Outer's DOM.
    expect(innerBackdrop.parentElement).toBe(document.body);
    expect(outerBackdrop.contains(innerBackdrop)).toBe(false);

    expect(container.hasAttribute('inert')).toBe(true);
    expect(outerBackdrop.hasAttribute('inert')).toBe(true);
    expect(outerBackdrop.getAttribute('aria-hidden')).toBe('true');
    expect(innerBackdrop.hasAttribute('inert')).toBe(false);
    expect(getModalLayerCount()).toBe(2);

    // Close inner: outer becomes interactive again, app root stays hidden.
    fireEvent.click(screen.getByText('Close inner'));
    expect(outerBackdrop.hasAttribute('inert')).toBe(false);
    expect(outerBackdrop.hasAttribute('aria-hidden')).toBe(false);
    expect(container.hasAttribute('inert')).toBe(true);

    fireEvent.click(screen.getByText('Close outer'));
    expect(container.hasAttribute('inert')).toBe(false);
    expect(getModalLayerCount()).toBe(0);
  });

  it('un-inerts everything when a dialog unmounts while open', () => {
    const { container, unmount } = render(<Harness />);
    fireEvent.click(screen.getByText('Open outer'));
    expect(container.hasAttribute('inert')).toBe(true);
    unmount();
    expect(container.hasAttribute('inert')).toBe(false);
    expect(getModalLayerCount()).toBe(0);
  });
});

describe('DialogShell — exempt elements nested in the app root (X4)', () => {
  const BannerHarness: React.FC<{ banner: boolean }> = ({ banner }) => {
    const [open, setOpen] = useState(true);
    return (
      <div data-testid="app">
        {banner && (
          <div role="alert" data-modal-inert-exempt="">
            Conflict! <button>Keep mine</button>
          </div>
        )}
        <main data-testid="content"><button>Background action</button></main>
        <DialogShell isOpen={open} onClose={() => setOpen(false)} ariaLabel="Wizard">
          <button onClick={() => setOpen(false)}>Done</button>
        </DialogShell>
      </div>
    );
  };

  it('splits the app root around an exempt banner instead of hiding it', () => {
    const { container } = render(<BannerHarness banner />);
    expect(container.hasAttribute('inert')).toBe(false);
    expect(screen.getByTestId('app').hasAttribute('inert')).toBe(false);
    expect(screen.getByRole('alert').closest('[inert], [aria-hidden="true"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Keep mine' })).toBeTruthy();
    expect(screen.getByTestId('content').hasAttribute('inert')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Background action' })).toBeNull();

    fireEvent.click(screen.getByText('Done'));
    expect(screen.getByTestId('content').hasAttribute('inert')).toBe(false);
    expect(screen.getByTestId('content').hasAttribute('aria-hidden')).toBe(false);
  });

  it('splits out an exempt banner that appears while the dialog is already open', async () => {
    const { container, rerender } = render(<BannerHarness banner={false} />);
    expect(container.hasAttribute('inert')).toBe(true);
    rerender(<BannerHarness banner />);
    // The MutationObserver callback runs as a microtask.
    await act(async () => { await Promise.resolve(); });
    expect(container.hasAttribute('inert')).toBe(false);
    expect(screen.getByRole('alert').closest('[inert], [aria-hidden="true"]')).toBeNull();
    expect(screen.getByTestId('content').hasAttribute('inert')).toBe(true);

    fireEvent.click(screen.getByText('Done'));
    expect(container.querySelector('[inert]')).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});

describe('DialogShell — toasts stay reachable (X4)', () => {
  const ToastingHarness: React.FC = () => {
    const { addToast } = useToast();
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        <DialogShell isOpen={open} onClose={() => setOpen(false)} ariaLabel="Dlg">
          <button onClick={() => addToast('Saved!', 'success')}>Toast me</button>
        </DialogShell>
      </>
    );
  };

  it('a toast raised while a dialog is open is not inert/aria-hidden and sits at z-[90]', () => {
    render(<ToastProvider><ToastingHarness /></ToastProvider>);
    fireEvent.click(screen.getByText('Open'));
    fireEvent.click(screen.getByText('Toast me'));

    const alert = screen.getByRole('alert'); // would throw if aria-hidden
    const region = alert.parentElement!;
    expect(region.className).toContain('z-[90]');
    expect(region.closest('[inert], [aria-hidden="true"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toBeTruthy();
  });

  it('an already-visible toast region is not hidden when a dialog opens', () => {
    const Pre: React.FC = () => {
      const { addToast } = useToast();
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => addToast('Hi')}>Toast</button>
          <button onClick={() => setOpen(true)}>Open</button>
          <DialogShell isOpen={open} onClose={() => setOpen(false)} ariaLabel="Dlg"><button>x</button></DialogShell>
        </>
      );
    };
    render(<ToastProvider><Pre /></ToastProvider>);
    fireEvent.click(screen.getByText('Toast'));
    fireEvent.click(screen.getByText('Open'));
    expect(screen.getByRole('alert').closest('[inert], [aria-hidden="true"]')).toBeNull();
  });
});

describe('DialogShell — preserved behaviours after portaling (X4)', () => {
  it('returns focus to the opener on close, Escape closes, scroll lock applies', () => {
    render(<Harness />);
    const opener = screen.getByText('Open outer');
    opener.focus();
    fireEvent.click(opener);

    expect(document.body.style.overflow).toBe('hidden');
    // First reachable control inside the dialog got focus.
    expect(document.activeElement).toBe(screen.getByText('Close outer'));

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(opener);
  });

  it('Escape in a nested dialog closes only the nested dialog', () => {
    render(<Harness nested />);
    fireEvent.click(screen.getByText('Open outer'));
    const openInner = screen.getByText('Open inner');
    act(() => openInner.focus());
    fireEvent.click(openInner);
    expect(document.activeElement).toBe(screen.getByText('Close inner'));
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Inner' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Inner' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Outer' })).toBeTruthy();
    // Focus went back to the control that opened the inner dialog.
    expect(document.activeElement).toBe(screen.getByText('Open inner'));
  });
});
