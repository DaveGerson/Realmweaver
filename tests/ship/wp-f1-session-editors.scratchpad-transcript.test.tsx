// @vitest-environment jsdom
/**
 * wp-f1-session-editors — finding #67
 *
 * The scratchpad textarea renders
 *   value={formData.runningNotes + (liveTranscript ? `\n\n[Live Transcription]: ${liveTranscript}` : '')}
 * but its onChange is the generic handleChange, which stores e.target.value
 * wholesale into formData.runningNotes. While the AI Scribe is running, a
 * single keystroke in the scratchpad therefore bakes the transcript PREVIEW —
 * marker text included — into the real notes field, and handleBlur persists it.
 * When the GM then stops the scribe, handleToggleLive appends
 * `[AI Scribe]: ${liveTranscript}` again, so the transcript ends up duplicated
 * with a stray '[Live Transcription]:' label to clean up by hand.
 *
 * Contract: the live transcript must be a read-only preview element, not part
 * of the textarea's value (or the known suffix must be stripped in onChange).
 * Typing while transcription is running must persist ONLY the user's own text.
 * The transcript must still be visible somewhere while recording.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import type { Campaign, SessionLog } from '../../types/index';

type TranscriptOptions = {
  gcpApiKey: string;
  onTranscript: (text: string) => void;
  onConnected: () => void;
  onDisconnected: () => void;
  onError: (err: unknown) => void;
};

let captured: TranscriptOptions | null = null;

// SessionLogEditor imports `startAudioTranscription` from the aiService facade
// (never `services/ai/audioTranscription` directly, per CLAUDE.md), so the
// facade mock below is what actually backs the component under test.
vi.mock('../../services/ai/audioTranscription', () => ({
  startAudioTranscription: async (opts: TranscriptOptions) => {
    captured = opts;
    opts.onConnected();
    return { stop: async () => {} };
  },
}));

vi.mock('../../services/aiService', () => ({
  generateEnhancedText: vi.fn(async () => ''),
  analyzeSessionNotes: vi.fn(async () => ({ entries: [] })),
  startAudioTranscription: async (opts: TranscriptOptions) => {
    captured = opts;
    opts.onConnected();
    return { stop: async () => {} };
  },
}));

const { SessionLogEditor } = await import('../../components/editors/SessionLogEditor');
const { ToastProvider } = await import('../../hooks/useToast');
const { ConfirmDialogProvider } = await import('../../hooks/useConfirmDialog');

afterEach(() => {
  captured = null;
  cleanup();
});

const ORIGINAL_NOTES = 'Party enters the drowned vault.';
const TRANSCRIPT = 'the bard sings a shanty';

const campaign = {
  id: 'camp-1',
  title: 'Test Campaign',
  setting: 'A world',
  gcpApiKey: 'test-gcp-key',
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
  runningNotes: ORIGINAL_NOTES,
  structuredNotes: [],
  encounterLog: [],
  recap: '',
  notableEvents: '',
  looseEnds: '',
} as SessionLog;

function clickByText(container: HTMLElement, re: RegExp) {
  const btn = Array.from(container.querySelectorAll('button')).find(b => re.test(b.textContent || ''));
  expect(btn, `no button matching ${re}`).toBeTruthy();
  fireEvent.click(btn!);
}

/** Renders the editor with the AI Scribe running and a transcript received. */
async function renderWithLiveTranscript() {
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

  await act(async () => {
    clickByText(container, /enable ai scribe/i);
  });
  expect(captured).toBeTruthy();

  await act(async () => {
    captured!.onTranscript(TRANSCRIPT);
  });

  clickByText(container, /scratchpad/i);
  const textarea = container.querySelector('textarea[name="runningNotes"]') as HTMLTextAreaElement;
  expect(textarea).toBeTruthy();
  return { container, textarea, onUpdate };
}

describe('wp-f1-session-editors #67 — typing during AI Scribe', () => {
  it('persists only the GM\'s own text, not the live transcript preview', async () => {
    const { container, textarea, onUpdate } = await renderWithLiveTranscript();

    // The transcript must remain visible to the GM (as a preview, not as textarea content).
    expect(container.textContent).toContain(TRANSCRIPT);

    // Simulate one keystroke appended at the end of whatever the field shows.
    const typed = textarea.value + '!';
    fireEvent.change(textarea, { target: { value: typed } });
    fireEvent.blur(textarea);

    expect(onUpdate).toHaveBeenCalled();
    const runningNotesCalls = onUpdate.mock.calls
      .map(([, patch]) => (patch as Partial<SessionLog>).runningNotes)
      .filter((v): v is string => typeof v === 'string');
    expect(runningNotesCalls.length).toBeGreaterThan(0);

    const persisted = runningNotesCalls[runningNotesCalls.length - 1];
    expect(persisted).not.toContain('[Live Transcription]');
    expect(persisted).not.toContain(TRANSCRIPT);
    expect(persisted).toBe(ORIGINAL_NOTES + '!');
  });
});
