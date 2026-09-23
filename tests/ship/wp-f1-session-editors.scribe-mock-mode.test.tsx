// @vitest-environment jsdom
/**
 * wp-f1-session-editors — roadmap X3 residual
 *
 * SessionLogEditor forwarded `isMockMode` into startAudioTranscription (pinned
 * in wp-f1-session-editors.scratchpad-transcript), but the "Enable AI Scribe"
 * button itself only rendered when `campaign.gcpApiKey` was set. The mock
 * transcription needs no key, so in Mock Mode — the offline / demo path, where
 * nobody has a GCP key — the mock branch was still unreachable from the UI.
 *
 * Contract:
 *   1. Mock Mode shows the AI Scribe button even without a GCP key, and
 *      clicking it calls the facade with `isMockMode: true` (no `undefined!`
 *      key — an empty string).
 *   2. Outside Mock Mode, no key still means the "key required" hint.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { Campaign, SessionLog } from '../../types/index';

const h = vi.hoisted(() => ({
  startAudioTranscription: vi.fn(async (opts: { onConnected: () => void }) => {
    opts.onConnected();
    return { stop: async () => {} };
  }),
}));

vi.mock('../../services/aiService', () => ({
  generateEnhancedText: vi.fn(async () => ''),
  analyzeSessionNotes: vi.fn(async () => ({ entries: [] })),
  startAudioTranscription: h.startAudioTranscription,
}));

const { SessionLogEditor } = await import('../../components/editors/SessionLogEditor');
const { ToastProvider } = await import('../../hooks/useToast');
const { ConfirmDialogProvider } = await import('../../hooks/useConfirmDialog');

afterEach(() => {
  h.startAudioTranscription.mockClear();
  cleanup();
});

const keylessCampaign = {
  id: 'camp-1', title: 'Offline Demo', setting: 'A world',
  npcs: [], locations: [], factions: [], items: [], adventures: [],
  articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

const log = {
  id: 'log-1', title: 'Session One', status: 'active', sessionDate: '2026-05-01T00:00:00.000Z',
  plannedSceneIds: [], prepNotes: '', relatedPlotIds: [], runningNotes: '', structuredNotes: [],
  encounterLog: [], recap: '', notableEvents: '', looseEnds: '',
} as SessionLog;

function renderEditor(isMockMode: boolean) {
  return render(
    <ConfirmDialogProvider>
      <ToastProvider>
        <SessionLogEditor log={log} campaign={keylessCampaign} onUpdate={vi.fn()} onDelete={vi.fn()} isMockMode={isMockMode} />
      </ToastProvider>
    </ConfirmDialogProvider>,
  );
}

describe('X3 residual — AI Scribe is reachable in Mock Mode without a GCP key', () => {
  it('shows the button in Mock Mode and starts the mock transcription', async () => {
    renderEditor(true);
    expect(screen.queryByText(/key required/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Enable AI Scribe/ }));
    await waitFor(() => expect(h.startAudioTranscription).toHaveBeenCalledTimes(1));

    const opts = h.startAudioTranscription.mock.calls[0][0] as unknown as { isMockMode?: boolean; gcpApiKey: unknown };
    expect(opts.isMockMode).toBe(true);
    expect(opts.gcpApiKey).toBe('');
    await screen.findByRole('button', { name: /Stop Scribe/ });
  });

  it('still requires a key outside Mock Mode', () => {
    renderEditor(false);
    expect(screen.getByText(/AI Scribe \(key required\)/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Enable AI Scribe/ })).toBeNull();
  });
});
