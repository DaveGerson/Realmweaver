// @vitest-environment jsdom
/**
 * wp-review — SessionLogEditor per-entity reset on log switch (review finding C11)
 *
 * ViewRouter renders <SessionLogEditor log={selectedSessionLog}/> with no key,
 * so navigating log A -> log B reuses the mounted editor. Before the fix the
 * editor had no [log.id] effect, so per-entity state survived the switch:
 *   - a half-typed Log Entries draft stayed in the input; pressing Enter after
 *     the switch filed the entry against the WRONG session — handleAddNote
 *     writes onUpdate(log.id, { structuredNotes }) with log.id now B;
 *   - a running AI Scribe session was only torn down on unmount, so the mic
 *     stayed hot while the Stop Scribe button (gated on the active log's
 *     status) was no longer rendered, with the "AI Listening" badge still up.
 *
 * Contract (mirrors the tab-bearing sibling editors): switching logs resets
 * the draft note, tags, and tab, and tears down the audio session exactly
 * like the unmount cleanup. Nothing typed against log A may be written to
 * log B.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import type { Campaign, SessionLog } from '../../types/index';

type TranscriptOptions = {
  gcpApiKey: string;
  isMockMode?: boolean;
  onTranscript: (text: string) => void;
  onConnected: () => void;
  onDisconnected: () => void;
  onError: (err: unknown) => void;
};

let captured: TranscriptOptions | null = null;
const stopSpy = vi.fn(async () => {});

// Matches SessionLogEditorProps['onUpdate'] so the mock is assignable to the
// component prop without weakening the assertions made against its calls.
type OnUpdateFn = (id: string, updatedData: Partial<SessionLog>) => void;
const createOnUpdateMock = () => vi.fn<OnUpdateFn>();

vi.mock('../../services/aiService', () => ({
  generateEnhancedText: vi.fn(async () => ''),
  analyzeSessionNotes: vi.fn(async () => ({ entries: [] })),
  startAudioTranscription: async (opts: TranscriptOptions) => {
    captured = opts;
    opts.onConnected();
    return { stop: stopSpy };
  },
}));

const { SessionLogEditor } = await import('../../components/editors/SessionLogEditor');
const { ToastProvider } = await import('../../hooks/useToast');
const { ConfirmDialogProvider } = await import('../../hooks/useConfirmDialog');

afterEach(() => {
  captured = null;
  stopSpy.mockClear();
  cleanup();
});

const makeLog = (overrides: Partial<SessionLog>): SessionLog => ({
  id: 'log-a',
  title: 'Session Twelve',
  status: 'planned',
  sessionDate: '2026-05-01T00:00:00.000Z',
  plannedSceneIds: [],
  prepNotes: '',
  relatedPlotIds: [],
  runningNotes: '',
  structuredNotes: [],
  encounterLog: [],
  recap: '',
  notableEvents: '',
  looseEnds: '',
  ...overrides,
} as SessionLog);

function makeCampaign(sessionLogs: SessionLog[], gcpApiKey?: string): Campaign {
  return {
    id: 'camp-1',
    title: 'Test Campaign',
    setting: 'A world',
    gcpApiKey,
    npcs: [], locations: [], factions: [], items: [], adventures: [],
    articles: [], sessionLogs, playerCharacters: [], plots: [], notes: [], secrets: [],
  } as unknown as Campaign;
}

function editorTree(log: SessionLog, campaign: Campaign, onUpdate: ReturnType<typeof createOnUpdateMock>) {
  return (
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
    </ConfirmDialogProvider>
  );
}

function draftInput(container: HTMLElement): HTMLInputElement {
  const el = container.querySelector('input[placeholder="Log an event..."]');
  expect(el, 'Log Entries draft input not found').toBeTruthy();
  return el as HTMLInputElement;
}

function clickByText(container: HTMLElement, re: RegExp) {
  const btn = Array.from(container.querySelectorAll('button')).find(b => re.test(b.textContent || ''));
  expect(btn, `no button matching ${re}`).toBeTruthy();
  fireEvent.click(btn!);
}

describe('wp-review C11 — SessionLogEditor resets per-entity state on log switch', () => {
  it('clears a half-typed log entry draft so it cannot be filed against the next log', () => {
    const logA = makeLog({ id: 'log-a', title: 'Session Twelve' });
    const logB = makeLog({ id: 'log-b', title: 'Session Thirteen' });
    const campaign = makeCampaign([logA, logB]);
    const onUpdate = createOnUpdateMock();

    const { container, rerender } = render(editorTree(logA, campaign, onUpdate));

    // GM types a draft entry for Session Twelve, but does not submit it...
    fireEvent.change(draftInput(container), { target: { value: 'Aldric betrays the party' } });
    expect(draftInput(container).value).toBe('Aldric betrays the party');

    // ...then jumps to Session Thirteen (same mounted editor, new log prop).
    rerender(editorTree(logB, campaign, onUpdate));

    // The draft must not survive onto the other session's editor.
    expect(draftInput(container).value).toBe('');

    // The deterministic misfiling scenario: pressing Enter on the (previously
    // populated) input must not write A's draft into B's structuredNotes.
    fireEvent.keyDown(draftInput(container), { key: 'Enter' });
    const writesOnB = onUpdate.mock.calls.filter(([id]) => id === 'log-b');
    expect(
      writesOnB,
      `nothing typed against log A may land on log B (saw: ${JSON.stringify(writesOnB)})`,
    ).toEqual([]);
  });

  it('tears down a running AI Scribe session on log switch instead of leaving the mic hot', async () => {
    const logA = makeLog({ id: 'log-a', title: 'Session Twelve', status: 'active' });
    const logB = makeLog({ id: 'log-b', title: 'Session Thirteen' });
    const campaign = makeCampaign([logA, logB], 'test-gcp-key');
    const onUpdate = createOnUpdateMock();

    const { container, rerender } = render(editorTree(logA, campaign, onUpdate));

    await act(async () => {
      clickByText(container, /enable ai scribe/i);
    });
    expect(captured).toBeTruthy();
    expect(container.textContent).toContain('AI Listening');

    await act(async () => {
      captured!.onTranscript('the bard sings a shanty');
    });

    // Navigate to the non-active log B: the Stop Scribe button disappears
    // (it is gated on the active log), so the session must be stopped here.
    rerender(editorTree(logB, campaign, onUpdate));

    expect(stopSpy, 'audio session must be stopped on log switch').toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain('AI Listening');

    // Log A's transcript must not bleed into log B's scratchpad preview or notes.
    clickByText(container, /scratchpad/i);
    expect(container.textContent).not.toContain('[Live Transcription]');
    expect(container.textContent).not.toContain('the bard sings a shanty');
    const writesOnB = onUpdate.mock.calls.filter(([id]) => id === 'log-b');
    expect(writesOnB).toEqual([]);
  });
});
