// @vitest-environment jsdom
/**
 * wp-f1-session-editors — finding #66
 *
 * SessionLogDashboard guards the "Prepare Session" button with
 *   disabled={!!filteredSessionLogs.find(s => s.status === 'active')}
 * i.e. it inspects the SEARCH-FILTERED list rather than the full sessionLogs
 * array. Typing a search term that does not match the running session's
 * title/prepNotes/recap drops the active session out of filteredSessionLogs:
 * the "Live Now" hero card vanishes and "Prepare Session" becomes enabled.
 * Completing the wizard calls onGoLive, and campaignService.goLive demotes
 * every currently-active log back to 'planned' — the in-progress session
 * silently loses its active state mid-game.
 *
 * Contract: the live-session guard (disabled state + title) must be derived
 * from the unfiltered sessionLogs array. Only the rendered planned/past lists
 * may use the filtered list.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { SessionLogDashboard } from '../../components/dashboards/SessionLogDashboard';
import type { Campaign, SessionLog } from '../../types/index';

afterEach(cleanup);

function makeLog(overrides: Partial<SessionLog>): SessionLog {
  return {
    id: 'log-x',
    title: 'Untitled',
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

const activeLog = makeLog({ id: 'log-live', title: 'The Kraken Ascends', status: 'active' });
const plannedLog = makeLog({ id: 'log-next', title: 'Dockside Reckoning', status: 'planned' });

const campaign = {
  id: 'camp-1',
  title: 'Test Campaign',
  npcs: [], locations: [], factions: [], items: [], adventures: [],
  articles: [], sessionLogs: [activeLog, plannedLog], playerCharacters: [],
  plots: [], notes: [], secrets: [],
} as unknown as Campaign;

function findPrepareButton(container: HTMLElement): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find(b =>
    /prepare session/i.test(b.textContent || ''),
  ) as HTMLButtonElement | undefined;
  expect(btn).toBeTruthy();
  return btn!;
}

function renderDashboard() {
  return render(
    <SessionLogDashboard
      campaign={campaign}
      sessionLogs={[activeLog, plannedLog]}
      onSessionLogCreated={vi.fn()}
      onSelectSessionLog={vi.fn()}
      onGoLive={vi.fn()}
      isMockMode={true}
    />,
  );
}

describe('wp-f1-session-editors #66 — live-session guard vs. search filter', () => {
  it('keeps "Prepare Session" disabled while a session is live, even when the search term hides it', () => {
    const { container } = renderDashboard();

    // Sanity: with no search term, the guard already works.
    expect(findPrepareButton(container).disabled).toBe(true);

    const search = container.querySelector('input[placeholder="Search sessions..."]') as HTMLInputElement;
    expect(search).toBeTruthy();
    // A term matching only the PLANNED session — the live one drops out of the filtered list.
    fireEvent.change(search, { target: { value: 'Dockside' } });

    expect(findPrepareButton(container).disabled).toBe(true);
  });

  it('keeps the "a session is already live" tooltip when the live session is filtered out', () => {
    const { container } = renderDashboard();

    const search = container.querySelector('input[placeholder="Search sessions..."]') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'Dockside' } });

    expect(findPrepareButton(container).getAttribute('title')).toMatch(/already live/i);
  });
});
