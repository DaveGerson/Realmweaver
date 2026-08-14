// @vitest-environment jsdom
/**
 * wp-f2-entity-editors — finding #107
 *
 * PrepDocumentView.handleCopy (line 103) fires
 * `navigator.clipboard.writeText(markdownContent)` without awaiting or
 * catching, then unconditionally `setHasCopied(true)` — the button flips to
 * "Copied!" with a checkmark even though the write rejected (non-secure
 * context, unfocused document, denied permission), leaving an unhandled
 * promise rejection behind. The GM pastes stale/empty content into their notes
 * app with no clue the prep document never made it to the clipboard.
 *
 * Contract: only report success after the write resolves; on rejection keep the
 * button label unchanged and surface the failure (a toast — role="alert").
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { Adventure, Campaign } from '../../types/index';
import { PrepDocumentView } from '../../components/editors/PrepDocumentView';
import { ToastProvider } from '../../hooks/useToast';

const adventure = {
  id: 'adv-1',
  title: 'Salt & Ruin',
  description: 'A drowned vault reopens.',
  hook: 'A body washes up wearing the vault seal.',
  scenes: [],
} as unknown as Adventure;

const campaign = {
  id: 'camp-1', title: 'Test Campaign', setting: 'A drowned empire',
  npcs: [], locations: [], factions: [], items: [], adventures: [adventure],
  articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

function copyButton(container: HTMLElement): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button'))
    .find(b => /copy|copied/i.test(b.textContent || ''));
  expect(btn, 'copy button not found').toBeTruthy();
  return btn as HTMLButtonElement;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('wp-f2-entity-editors #107 — clipboard failures must not report success', () => {
  it('keeps the "Copy to Clipboard" label and shows an error when writeText rejects', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('NotAllowedError')));
    vi.stubGlobal('navigator', { ...globalThis.navigator, clipboard: { writeText } });

    const { container } = render(
      <ToastProvider>
        <PrepDocumentView adventure={adventure} campaign={campaign} />
      </ToastProvider>,
    );

    fireEvent.click(copyButton(container));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));

    // Give any .then/.catch chain a turn to settle before asserting.
    await Promise.resolve();
    await waitFor(() => {
      expect(copyButton(container).textContent).not.toMatch(/copied!/i);
    });
    await waitFor(() => {
      expect(document.querySelectorAll('[role="alert"]').length).toBeGreaterThan(0);
    });
  });

  it('flips to "Copied!" only when the write resolves', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...globalThis.navigator, clipboard: { writeText } });

    const { container } = render(
      <ToastProvider>
        <PrepDocumentView adventure={adventure} campaign={campaign} />
      </ToastProvider>,
    );

    fireEvent.click(copyButton(container));

    await waitFor(() => {
      expect(copyButton(container).textContent).toMatch(/copied!/i);
    });
  });
});
