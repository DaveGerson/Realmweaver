// @vitest-environment jsdom
/**
 * wp-f1-session-editors — finding #4
 *
 * SessionLogEditor renders the session date as
 *   value={new Date(formData.sessionDate).toISOString().split('T')[0]}
 * while its onChange writes the raw input value into state AND straight through
 * to the store via onUpdate(log.id, { sessionDate: val }).
 *
 * An <input type="date"> can be cleared, which fires onChange with ''. The next
 * render evaluates new Date('').toISOString() -> RangeError: Invalid time value,
 * tearing the editor down into the ErrorBoundary. Because '' was already handed
 * to onUpdate, the corrupted value is persisted, so re-opening the log crashes
 * again — the log becomes unopenable and unrepairable from the UI.
 *
 * Contract:
 *  1. Clearing the date must never persist an invalid sessionDate.
 *  2. Clearing the date must not crash the editor.
 *  3. A log that ALREADY carries a corrupted sessionDate must still render
 *     (defensive read), so existing bad saves are repairable.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { SessionLogEditor } from '../../components/editors/SessionLogEditor';
import { ToastProvider } from '../../hooks/useToast';
import { ConfirmDialogProvider } from '../../hooks/useConfirmDialog';
import type { Campaign, SessionLog } from '../../types/index';

afterEach(cleanup);

const campaign = {
  id: 'camp-1',
  title: 'Test Campaign',
  setting: 'A world',
  npcs: [], locations: [], factions: [], items: [], adventures: [],
  articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

function makeLog(overrides: Partial<SessionLog> = {}): SessionLog {
  return {
    id: 'log-1',
    title: 'Session One',
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
  } as SessionLog;
}

function renderEditor(log: SessionLog, onUpdate = vi.fn()) {
  const result = render(
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
  return { ...result, onUpdate };
}

/** Fires the change and captures a render crash instead of letting it abort the test. */
function clearDate(container: HTMLElement): unknown {
  const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
  expect(dateInput).toBeTruthy();
  try {
    fireEvent.change(dateInput, { target: { value: '' } });
    return null;
  } catch (err) {
    return err;
  }
}

describe('wp-f1-session-editors #4 — clearing the session date', () => {
  it('never persists an empty/invalid sessionDate through onUpdate', () => {
    const { container, onUpdate } = renderEditor(makeLog());

    clearDate(container);

    const badCall = onUpdate.mock.calls.find(([, patch]) => {
      const value = (patch as Partial<SessionLog>)?.sessionDate;
      return value !== undefined && Number.isNaN(new Date(value).getTime());
    });
    expect(badCall).toBeUndefined();
  });

  it('does not crash the editor when the date field is cleared', () => {
    const { container } = renderEditor(makeLog());

    const renderError = clearDate(container);

    expect(renderError).toBeNull();
  });

  it('still renders a session log whose stored sessionDate is already corrupted', () => {
    // Simulates re-opening a log that the bug already wrote '' into.
    expect(() => renderEditor(makeLog({ sessionDate: '' }))).not.toThrow();
  });
});
