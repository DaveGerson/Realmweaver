// @vitest-environment jsdom
/**
 * wp-f1-session-editors — findings #43 and #68 (same defect, two reports)
 *
 * handleAiGenerateRecap (SessionLogEditor.tsx ~137-146) is:
 *
 *   setIsGenerating(true);
 *   try { const recap = await generateEnhancedText(prompt, undefined, isMockMode); ... }
 *   finally { setIsGenerating(false); }
 *
 * There is no `catch`. It is wired straight into AiTextarea's `onAiGenerate`,
 * so nothing awaits the returned promise: a provider failure (CLI timeout,
 * proxy 5xx, malformed JSON) escapes as an unhandled rejection, the spinner
 * just stops and the GM gets no toast, no inline error, no console message.
 * The sibling handleAnalyzeNotes in the same file does it correctly.
 *
 * #43 additionally notes the call passes `undefined` for campaignContext,
 * violating CLAUDE.md's "Always pass campaignContext" rule — the editor has
 * the campaign right there in props.
 *
 * Contract:
 *  1. A rejected generateEnhancedText must be caught — no unhandled rejection.
 *  2. The user must get an error toast (mirroring handleAnalyzeNotes).
 *  3. generateEnhancedText must be called with real campaign context, not undefined.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { Campaign, SessionLog } from '../../types/index';

const generateEnhancedText = vi.fn();
const analyzeSessionNotes = vi.fn();

vi.mock('../../services/aiService', () => ({
  generateEnhancedText: (...args: unknown[]) => generateEnhancedText(...args),
  analyzeSessionNotes: (...args: unknown[]) => analyzeSessionNotes(...args),
}));

const { SessionLogEditor } = await import('../../components/editors/SessionLogEditor');
const { ToastProvider } = await import('../../hooks/useToast');
const { ConfirmDialogProvider } = await import('../../hooks/useConfirmDialog');

const campaign = {
  id: 'camp-1',
  title: 'The Sunken Crown',
  setting: 'A drowned empire of brass and salt',
  npcs: [], locations: [], factions: [], items: [], adventures: [],
  articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

const log: SessionLog = {
  id: 'log-1',
  title: 'Session One',
  status: 'planned',
  sessionDate: '2026-05-01T00:00:00.000Z',
  plannedSceneIds: [],
  prepNotes: '',
  relatedPlotIds: [],
  runningNotes: 'The party fought a kraken.',
  structuredNotes: [],
  encounterLog: [],
  recap: '',
  notableEvents: '',
  looseEnds: '',
} as SessionLog;

function renderEditor() {
  const onUpdate = vi.fn();
  const result = render(
    <ConfirmDialogProvider>
      <ToastProvider>
        <SessionLogEditor
          log={log}
          campaign={campaign}
          onUpdate={onUpdate}
          onDelete={vi.fn()}
          isMockMode={false}
        />
      </ToastProvider>
    </ConfirmDialogProvider>,
  );
  return { ...result, onUpdate };
}

/** The "Generate" affordance rendered by AiTextarea for the Session Recap field. */
function clickGenerateRecap(container: HTMLElement) {
  const recapField = container.querySelector('textarea[name="recap"]');
  expect(recapField).toBeTruthy();
  const block = recapField!.closest('div')!.parentElement!;
  const generateBtn = Array.from(block.querySelectorAll('button')).find(b =>
    /generate/i.test(b.textContent || ''),
  );
  expect(generateBtn).toBeTruthy();
  fireEvent.click(generateBtn!);
}

let unhandled: unknown[] = [];
const onUnhandled = (e: PromiseRejectionEvent | { reason?: unknown }) => {
  unhandled.push((e as PromiseRejectionEvent).reason ?? e);
};

beforeEach(() => {
  unhandled = [];
  generateEnhancedText.mockReset();
  process.on('unhandledRejection', onUnhandled);
});

afterEach(() => {
  process.off('unhandledRejection', onUnhandled);
  cleanup();
});

describe('wp-f1-session-editors #43/#68 — AI recap failure handling', () => {
  it('shows an error toast when recap generation rejects', async () => {
    generateEnhancedText.mockRejectedValue(new Error('CLI timed out after 120s'));
    const { container } = renderEditor();

    clickGenerateRecap(container);

    await waitFor(() => {
      expect(screen.getByText(/fail|error|could not/i)).toBeTruthy();
    });
  });

  it('does not leak an unhandled promise rejection when recap generation fails', async () => {
    generateEnhancedText.mockRejectedValue(new Error('proxy returned 504'));
    const { container } = renderEditor();

    clickGenerateRecap(container);

    // Let the rejection propagate and the microtask/macrotask queues drain.
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(unhandled).toEqual([]);
  });

  it('passes campaign context to generateEnhancedText (CLAUDE.md: always pass campaignContext)', async () => {
    generateEnhancedText.mockResolvedValue('A cohesive recap.');
    const { container } = renderEditor();

    clickGenerateRecap(container);

    await waitFor(() => expect(generateEnhancedText).toHaveBeenCalled());
    const [, context] = generateEnhancedText.mock.calls[0];
    expect(typeof context).toBe('string');
    expect(context as string).toContain(campaign.title);
  });
});
