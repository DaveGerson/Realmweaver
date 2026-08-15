// @vitest-environment jsdom
/**
 * wp-f1-session-editors — verifier finding #5 on the #66 fix
 *
 * handleStartSession (wired to the "Start Session" button, rendered whenever
 * status !== 'active') wrote `{ status: 'active', ... }` directly via
 * `onUpdate`, bypassing campaignService.goLive entirely — it neither demoted
 * an already-active log nor set campaign.activeSessionId. A GM with a live
 * session could open a different, planned log and click "Start Session" to
 * produce two logs with status 'active' simultaneously, undermining the
 * "only one session may be live" guarantee #66 established at the dashboard
 * level.
 *
 * Contract: "Start Session" must be disabled (and a no-op if somehow
 * triggered) whenever another session log in the campaign already has
 * status 'active'.
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

const otherActiveLog: SessionLog = {
  id: 'log-active',
  title: 'Currently Running Session',
  status: 'active',
  sessionDate: '2026-05-01T00:00:00.000Z',
  plannedSceneIds: [], prepNotes: '', relatedPlotIds: [], runningNotes: '',
  structuredNotes: [], encounterLog: [], recap: '', notableEvents: '', looseEnds: '',
} as SessionLog;

const plannedLog: SessionLog = {
  id: 'log-planned',
  title: 'Next Week\'s Session',
  status: 'planned',
  sessionDate: '2026-05-08T00:00:00.000Z',
  plannedSceneIds: [], prepNotes: '', relatedPlotIds: [], runningNotes: '',
  structuredNotes: [], encounterLog: [], recap: '', notableEvents: '', looseEnds: '',
} as SessionLog;

function makeCampaign(sessionLogs: SessionLog[]): Campaign {
  return {
    id: 'camp-1',
    title: 'Test Campaign',
    setting: 'A world',
    npcs: [], locations: [], factions: [], items: [], adventures: [],
    articles: [], sessionLogs, playerCharacters: [], plots: [], notes: [], secrets: [],
  } as unknown as Campaign;
}

function findButton(container: HTMLElement, re: RegExp): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find(b => re.test(b.textContent || ''));
  expect(btn, `no button matching ${re}`).toBeTruthy();
  return btn as HTMLButtonElement;
}

describe('wp-f1-session-editors #5 — Start Session must not create a second active session', () => {
  it('disables Start Session and ignores clicks while another log is already active', () => {
    const onUpdate = vi.fn();
    const campaign = makeCampaign([otherActiveLog, plannedLog]);
    const { container } = render(
      <ConfirmDialogProvider>
        <ToastProvider>
          <SessionLogEditor
            log={plannedLog}
            campaign={campaign}
            onUpdate={onUpdate}
            onDelete={vi.fn()}
            isMockMode={true}
          />
        </ToastProvider>
      </ConfirmDialogProvider>,
    );

    const startBtn = findButton(container, /start session/i);
    expect(startBtn.disabled).toBe(true);

    fireEvent.click(startBtn);
    expect(onUpdate).not.toHaveBeenCalledWith('log-planned', expect.objectContaining({ status: 'active' }));
  });

  it('allows Start Session when no other log is active', () => {
    const onUpdate = vi.fn();
    const campaign = makeCampaign([plannedLog]);
    const { container } = render(
      <ConfirmDialogProvider>
        <ToastProvider>
          <SessionLogEditor
            log={plannedLog}
            campaign={campaign}
            onUpdate={onUpdate}
            onDelete={vi.fn()}
            isMockMode={true}
          />
        </ToastProvider>
      </ConfirmDialogProvider>,
    );

    const startBtn = findButton(container, /start session/i);
    expect(startBtn.disabled).toBe(false);

    fireEvent.click(startBtn);
    expect(onUpdate).toHaveBeenCalledWith('log-planned', expect.objectContaining({ status: 'active' }));
  });
});
