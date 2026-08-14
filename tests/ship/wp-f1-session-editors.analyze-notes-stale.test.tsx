// @vitest-environment jsdom
/**
 * wp-f1-session-editors — verifier problem #1 on the #65 fix
 *
 * handleAnalyzeNotes awaits analyzeSessionNotes(...) and then merges the
 * AI-derived entries into `formData.structuredNotes` as captured in the
 * closure AT CLICK TIME:
 *
 *   const updatedNotes = [...(formData.structuredNotes || []), ...newEntries];
 *
 * The "Log Entries" tab stays interactive while analysis runs (its tab
 * button is not disabled), so a manual note added — or an existing one
 * removed — while the AI call is in flight gets silently clobbered when the
 * stale merge lands. This is the same defect shape #65 already fixed for
 * SceneEditor's NPC generation, just in a sibling handler.
 *
 * Contract: a manual structured-note add made while handleAnalyzeNotes is
 * in flight must survive — the final persisted structuredNotes must contain
 * BOTH the manual entry and the AI-derived entry.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, act, waitFor } from '@testing-library/react';
import type { Campaign, SessionLog } from '../../types/index';

let resolveAnalyze: ((result: { entries: { content: string; relatedEntityNames: string[] }[] }) => void) | null = null;
const analyzeSessionNotes = vi.fn(
  () => new Promise<{ entries: { content: string; relatedEntityNames: string[] }[] }>(resolve => {
    resolveAnalyze = resolve;
  }),
);

vi.mock('../../services/aiService', () => ({
  generateEnhancedText: vi.fn(async () => ''),
  analyzeSessionNotes: (...args: unknown[]) => analyzeSessionNotes(...(args as [])),
  startAudioTranscription: vi.fn(async () => ({ stop: async () => {} })),
}));

const { SessionLogEditor } = await import('../../components/editors/SessionLogEditor');
const { ToastProvider } = await import('../../hooks/useToast');
const { ConfirmDialogProvider } = await import('../../hooks/useConfirmDialog');

afterEach(() => {
  resolveAnalyze = null;
  analyzeSessionNotes.mockClear();
  cleanup();
});

const campaign = {
  id: 'camp-1',
  title: 'Test Campaign',
  setting: 'A world',
  npcs: [], locations: [], factions: [], items: [], adventures: [],
  articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

const log: SessionLog = {
  id: 'log-1',
  title: 'Session One',
  status: 'active',
  sessionDate: '2026-05-01T00:00:00.000Z',
  plannedSceneIds: [],
  prepNotes: '',
  relatedPlotIds: [],
  runningNotes: 'Rough notes taken during play.',
  structuredNotes: [],
  encounterLog: [],
  recap: '',
  notableEvents: '',
  looseEnds: '',
} as SessionLog;

function findButton(container: HTMLElement, re: RegExp): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find(b => re.test(b.textContent || ''));
  expect(btn, `no button matching ${re}`).toBeTruthy();
  return btn as HTMLButtonElement;
}

describe('wp-f1-session-editors #1 — manual log entries vs. concurrent AI analysis', () => {
  it('keeps a manually-added entry that was created while analysis was running', async () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <ConfirmDialogProvider>
        <ToastProvider>
          <SessionLogEditor
            log={log}
            campaign={campaign}
            onUpdate={onUpdate}
            onDelete={vi.fn()}
            isMockMode={true}
          />
        </ToastProvider>
      </ConfirmDialogProvider>,
    );

    // Switch to the Scratchpad tab and kick off "Process into Log".
    fireEvent.click(findButton(container, /scratchpad/i));
    fireEvent.click(findButton(container, /process into log/i));
    await waitFor(() => expect(analyzeSessionNotes).toHaveBeenCalled());

    // While analysis is running, switch to Log Entries and add a manual note.
    fireEvent.click(findButton(container, /log entries/i));
    const noteInput = container.querySelector('input[placeholder="Log an event..."]') as HTMLInputElement;
    expect(noteInput).toBeTruthy();
    fireEvent.change(noteInput, { target: { value: 'Manual entry by GM' } });
    fireEvent.click(findButton(container, /^Add$/i));

    expect(onUpdate).toHaveBeenCalledWith('log-1', { structuredNotes: [expect.objectContaining({ content: 'Manual entry by GM' })] });

    // Analysis resolves with an AI-derived entry.
    await act(async () => {
      resolveAnalyze!({ entries: [{ content: 'AI derived entry', relatedEntityNames: [] }] });
      await Promise.resolve();
    });

    await waitFor(() => {
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1];
      const patch = lastCall[1] as Partial<SessionLog>;
      expect(patch.structuredNotes?.length).toBe(2);
    });

    const finalPatch = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][1] as Partial<SessionLog>;
    const contents = (finalPatch.structuredNotes || []).map(n => n.content);
    expect(contents).toContain('Manual entry by GM');
    expect(contents).toContain('AI derived entry');

    // …and the UI must still show the manual entry.
    expect(container.textContent).toContain('Manual entry by GM');
  });
});
