// @vitest-environment jsdom
/**
 * wp-f1-session-editors — verifier finding #3 on the #4 fix
 *
 * The write-side guard for the session-date input bails out on an
 * empty/unparseable value with a bare `return` — no state update. Because
 * the browser has already cleared the DOM value by the time onChange fires,
 * and no React state changed, React never re-renders to push the retained
 * `formData.sessionDate` back into the controlled input's DOM node: the
 * field is left showing blank even though formData and the store still hold
 * the real date, until some unrelated re-render happens to resync it.
 *
 * Contract: clearing the date input must not persist '' (the original #4
 * fix), AND must re-render so the controlled input snaps back to the
 * retained date rather than being left blank.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { Campaign, SessionLog } from '../../types/index';

vi.mock('../../services/aiService', () => ({
  generateEnhancedText: vi.fn(async () => ''),
  analyzeSessionNotes: vi.fn(async () => ({ entries: [] })),
  startAudioTranscription: vi.fn(async () => ({ stop: async () => {} })),
}));

const { SessionLogEditor } = await import('../../components/editors/SessionLogEditor');
const { ToastProvider } = await import('../../hooks/useToast');
const { ConfirmDialogProvider } = await import('../../hooks/useConfirmDialog');

afterEach(() => cleanup());

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
  status: 'planned',
  sessionDate: '2026-05-01T00:00:00.000Z',
  plannedSceneIds: [], prepNotes: '', relatedPlotIds: [], runningNotes: '',
  structuredNotes: [], encounterLog: [], recap: '', notableEvents: '', looseEnds: '',
} as SessionLog;

describe('wp-f1-session-editors #3 — clearing the date input resyncs the controlled field', () => {
  it('does not persist an empty sessionDate and re-renders the input back to the retained date', () => {
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

    const dateInput = container.querySelector('input[name="sessionDate"]') as HTMLInputElement;
    expect(dateInput).toBeTruthy();
    expect(dateInput.value).toBe('2026-05-01');

    // Simulate the browser clearing the date field.
    fireEvent.change(dateInput, { target: { value: '' } });

    // The empty value must never be persisted.
    expect(onUpdate).not.toHaveBeenCalledWith('log-1', expect.objectContaining({ sessionDate: '' }));

    // The controlled input must snap back to the retained date, not stay blank.
    expect(dateInput.value).toBe('2026-05-01');
  });
});
