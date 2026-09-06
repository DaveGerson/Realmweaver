// @vitest-environment jsdom
/**
 * SPEC — Strong Start Styles: the two NEW chips, "Drop into action" and
 * "Reincorporate" (Wave 2, lane 2: SessionPrepWizard bundle)
 * =============================================================================
 * Source: docs/design/lazy-dm-lens.md §4.6. File under test:
 * components/dialogs/SessionPrepWizard.tsx (via
 * components/dialogs/prep/StrongStartStyles.tsx).
 *
 * The existing "Draft it from last session" ("previously-on") chip keeps its
 * accessible name and its exact `generateColdOpen` call shape — that whole
 * contract is pinned separately by tests/coldOpen.prepWizard.test.tsx and is
 * untouched by this lane. This file covers only what §4.6 ADDS.
 *
 * THE CONTRACT
 * ------------
 * 1. "Drop into action" is ALWAYS offered, at both call sites, even in a
 *    brand-new campaign with nothing played or prepped — unlike "Draft it
 *    from last session", it has no material precondition.
 * 2. "Reincorporate" hides itself when there is nothing dormant to sample,
 *    and appears once there is something to spend.
 * 3. Each new style calls `generateStrongStart` (never `generateColdOpen`)
 *    with the right `style` and, for "reincorporate", the ONE sampled piece
 *    — and fills the exact same field "Draft it from last session" already
 *    fills, with the exact same strong-start encoding at Go Live.
 * 4. The in-flight latch and the quiet-failure message are shared across all
 *    three styles.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import type { Campaign, SessionLog } from '../types/index';
import type { DormantPiece } from '../utils/dormantMaterial';
import { STRONG_START_OPEN, STRONG_START_CLOSE } from './helpers/strongStartFormat';

interface StrongStartTestRequest {
  style: 'action' | 'reincorporate';
  campaign: Campaign;
  campaignContext?: string;
  dormantPiece?: DormantPiece;
  useLiteModel?: boolean;
}

const h = vi.hoisted(() => ({
  createSessionLog: vi.fn((_newLogData: Omit<SessionLog, 'id'>) => 'sess-new'),
  goLive: vi.fn(),
  hasColdOpenMaterial: vi.fn(() => false),
  generateColdOpen: vi.fn(async () => 'COLD OPEN'),
  generateStrongStart: vi.fn(
    async (request: StrongStartTestRequest, _isMockMode?: boolean): Promise<string> =>
      request.style === 'reincorporate' ? 'REINCORPORATE DRAFT' : 'ACTION DRAFT'
  ),
}));

vi.mock('../services/campaignService', () => ({
  campaignService: { createSessionLog: h.createSessionLog, goLive: h.goLive },
}));

vi.mock('../services/aiService', () => ({
  hasColdOpenMaterial: h.hasColdOpenMaterial,
  generateColdOpen: h.generateColdOpen,
  generateStrongStart: h.generateStrongStart,
}));

import { SessionPrepWizard } from '../components/dialogs/SessionPrepWizard';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Nothing played, nothing prepped, nothing dormant. */
const emptyCampaign = {
  id: 'c-empty',
  title: 'Blank Slate',
  settingType: 'custom',
  setting: '',
  articles: [],
  adventures: [],
  npcs: [],
  locations: [],
  factions: [],
  items: [],
  sessionLogs: [],
  playerCharacters: [],
  plots: [],
  notes: [],
  secrets: [],
} as unknown as Campaign;

/**
 * Exactly one dormant piece to spend: a DM-marked-dormant plot. That bucket
 * (`collectStalledPlots`'s `dormant` half in utils/dormantMaterial.ts) is
 * unconditional on session history, so with every other bucket empty the
 * sample is deterministic regardless of Math.random.
 */
const campaignWithDormantPlot = {
  ...emptyCampaign,
  plots: [{ id: 'plot-dormant-1', title: 'The Cinder Crown', description: '', status: 'dormant', relatedEntityIds: [] }],
} as unknown as Campaign;

// ── Helpers ───────────────────────────────────────────────────────────────────

const nav = () => screen.getByRole('navigation', { name: /wizard steps/i });
const gotoStep = (label: RegExp) => fireEvent.click(within(nav()).getByRole('button', { name: label }));
const lazyToggle = () => screen.getByRole('button', { name: /lazy/i });
const STRONG_START_FIELD = /first thing you['’]ll say when the session starts/i;
const COLD_OPEN_FIELD = /read this to open the session/i;
const actionChip = () => screen.getByRole('button', { name: /^Drop into action$/i });
const reincorporateChip = () => screen.queryByRole('button', { name: /^Reincorporate$/i });

function openStrongStart(campaign: Campaign) {
  render(<SessionPrepWizard campaign={campaign} onComplete={() => {}} onClose={() => {}} />);
  fireEvent.click(lazyToggle());
  gotoStep(/^Strong Start/);
}

function openReview(campaign: Campaign) {
  render(<SessionPrepWizard campaign={campaign} onComplete={() => {}} onClose={() => {}} />);
  gotoStep(/^Go Live/);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => { resolve = res; });
  return { promise, resolve };
}

beforeEach(() => {
  h.createSessionLog.mockClear();
  h.goLive.mockClear();
  h.hasColdOpenMaterial.mockClear();
  h.hasColdOpenMaterial.mockReturnValue(false);
  h.generateColdOpen.mockClear();
  h.generateStrongStart.mockClear();
  h.generateStrongStart.mockImplementation(
    async request => (request.style === 'reincorporate' ? 'REINCORPORATE DRAFT' : 'ACTION DRAFT')
  );
});

afterEach(cleanup);

// ── 1. "Drop into action" never hides ─────────────────────────────────────────

describe('"Drop into action" has no material precondition', () => {
  it('is offered on the Strong Start step even with nothing played or prepped', () => {
    openStrongStart(emptyCampaign);
    expect(actionChip()).toBeTruthy();
  });

  it('is offered on the Go Live step even with nothing played or prepped', () => {
    openReview(emptyCampaign);
    expect(actionChip()).toBeTruthy();
  });

  it('sits alongside "Reincorporate" once there is something dormant too', () => {
    openStrongStart(campaignWithDormantPlot);
    expect(actionChip()).toBeTruthy();
    expect(reincorporateChip()).toBeTruthy();
  });
});

// ── 2. "Reincorporate" hides on nothing dormant ───────────────────────────────

describe('"Reincorporate" hides itself with nothing dormant to sample', () => {
  it('is absent on the Strong Start step for a campaign with nothing dormant', () => {
    openStrongStart(emptyCampaign);
    expect(reincorporateChip()).toBeNull();
  });

  it('is absent on the Go Live step for a campaign with nothing dormant', () => {
    openReview(emptyCampaign);
    expect(reincorporateChip()).toBeNull();
  });

  it('appears once the campaign has a dormant plot to spend', () => {
    openStrongStart(campaignWithDormantPlot);
    expect(reincorporateChip()).toBeTruthy();
  });
});

// ── 3. what each new style calls, and where it lands ──────────────────────────

describe('"Drop into action" calls generateStrongStart, never generateColdOpen', () => {
  it('fills the strong-start field with style "action" and no dormant piece', async () => {
    openStrongStart(emptyCampaign);
    fireEvent.click(actionChip());

    await waitFor(() => expect(h.generateStrongStart).toHaveBeenCalledTimes(1));
    const [request, isMockMode] = h.generateStrongStart.mock.calls[0];
    expect(request.style).toBe('action');
    expect(request.campaign).toBe(emptyCampaign);
    expect(request.dormantPiece).toBeUndefined();
    expect(isMockMode).toBe(false);
    expect(h.generateColdOpen).not.toHaveBeenCalled();

    await waitFor(() =>
      expect((screen.getByRole('textbox', { name: STRONG_START_FIELD }) as HTMLTextAreaElement).value).toBe(
        'ACTION DRAFT'
      )
    );
  });

  it('fills the Go Live step\'s own field the same way', async () => {
    openReview(emptyCampaign);
    fireEvent.click(actionChip());

    await waitFor(() => expect(h.generateStrongStart).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect((screen.getByRole('textbox', { name: COLD_OPEN_FIELD }) as HTMLTextAreaElement).value).toBe(
        'ACTION DRAFT'
      )
    );
  });

  it('passes the wizard mock-mode flag through', async () => {
    render(<SessionPrepWizard campaign={emptyCampaign} onComplete={() => {}} onClose={() => {}} isMockMode />);
    fireEvent.click(lazyToggle());
    gotoStep(/^Strong Start/);
    fireEvent.click(actionChip());

    await waitFor(() => expect(h.generateStrongStart).toHaveBeenCalledTimes(1));
    expect(h.generateStrongStart.mock.calls[0][1]).toBe(true);
  });
});

describe('"Reincorporate" names the ONE sampled piece', () => {
  it('calls generateStrongStart with style "reincorporate" and that exact piece', async () => {
    openStrongStart(campaignWithDormantPlot);
    fireEvent.click(reincorporateChip()!);

    await waitFor(() => expect(h.generateStrongStart).toHaveBeenCalledTimes(1));
    const [request] = h.generateStrongStart.mock.calls[0];
    expect(request.style).toBe('reincorporate');
    expect(request.dormantPiece).toEqual({
      kind: 'plot',
      id: 'plot-dormant-1',
      label: 'The Cinder Crown',
      reason: 'Marked dormant by the DM',
    });
  });

  it('fills the strong-start field with the draft', async () => {
    openStrongStart(campaignWithDormantPlot);
    fireEvent.click(reincorporateChip()!);

    await waitFor(() =>
      expect((screen.getByRole('textbox', { name: STRONG_START_FIELD }) as HTMLTextAreaElement).value).toBe(
        'REINCORPORATE DRAFT'
      )
    );
  });
});

// ── 4. shared latch and shared quiet failure ──────────────────────────────────

describe('the in-flight latch is shared across all three styles', () => {
  it('a click on "Reincorporate" while "Drop into action" is in flight fires no second generation', async () => {
    const d = deferred<string>();
    h.generateStrongStart.mockReturnValueOnce(d.promise);

    openStrongStart(campaignWithDormantPlot);
    fireEvent.click(actionChip());
    fireEvent.click(reincorporateChip()!);

    expect(h.generateStrongStart).toHaveBeenCalledTimes(1);
    await act(async () => { d.resolve('ACTION DRAFT'); });
  });

  it('both new chips read as busy while a draft of either kind is in flight', async () => {
    const d = deferred<string>();
    h.generateStrongStart.mockReturnValueOnce(d.promise);

    openStrongStart(campaignWithDormantPlot);
    fireEvent.click(actionChip());

    expect((actionChip() as HTMLButtonElement).disabled).toBe(true);
    expect((reincorporateChip() as HTMLButtonElement).disabled).toBe(true);

    await act(async () => { d.resolve('ACTION DRAFT'); });
    await waitFor(() => expect((actionChip() as HTMLButtonElement).disabled).toBe(false));
  });
});

describe('a failed draft from either new style fails exactly as quietly', () => {
  it('shows the same inline message, and leaves the wizard standing', async () => {
    h.generateStrongStart.mockRejectedValueOnce(new Error('504 gateway timeout'));
    openStrongStart(emptyCampaign);

    expect(() => fireEvent.click(actionChip())).not.toThrow();
    const message = await screen.findByText("That didn't come through. Try it again in a moment.");
    expect(message.closest('[role="status"]')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: STRONG_START_FIELD })).toBeTruthy();
  });

  it('lets the DM try again afterwards', async () => {
    h.generateStrongStart.mockRejectedValueOnce(new Error('504 gateway timeout'));
    openStrongStart(emptyCampaign);
    fireEvent.click(actionChip());
    await screen.findByText("That didn't come through. Try it again in a moment.");

    fireEvent.click(actionChip());
    await waitFor(() =>
      expect((screen.getByRole('textbox', { name: STRONG_START_FIELD }) as HTMLTextAreaElement).value).toBe(
        'ACTION DRAFT'
      )
    );
  });
});

// ── 5. what Go Live persists — the identical strong-start encoding ───────────

describe('Go Live persists either new style the same way "Draft it from last session" does', () => {
  it('folds an "action" draft into prepNotes with the strong-start encoding, from the Go Live step', async () => {
    openReview(emptyCampaign);
    fireEvent.click(actionChip());
    await waitFor(() => expect(screen.getByRole('textbox', { name: COLD_OPEN_FIELD })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /^Go Live$/ }));

    expect(h.createSessionLog).toHaveBeenCalledTimes(1);
    const payload = h.createSessionLog.mock.calls[0][0] as unknown as Omit<SessionLog, 'id'>;
    expect(payload.prepNotes).toBe(`${STRONG_START_OPEN}\nACTION DRAFT\n${STRONG_START_CLOSE}`);
  });

  it('folds a "reincorporate" draft into the lazy path\'s strong start the same way', async () => {
    openStrongStart(campaignWithDormantPlot);
    fireEvent.click(reincorporateChip()!);
    await waitFor(() =>
      expect((screen.getByRole('textbox', { name: STRONG_START_FIELD }) as HTMLTextAreaElement).value).toBe(
        'REINCORPORATE DRAFT'
      )
    );

    gotoStep(/^Go Live/);
    fireEvent.click(screen.getByRole('button', { name: /^Go Live$/ }));

    const payload = h.createSessionLog.mock.calls[0][0] as unknown as Omit<SessionLog, 'id'>;
    expect(payload.prepNotes).toBe(`${STRONG_START_OPEN}\nREINCORPORATE DRAFT\n${STRONG_START_CLOSE}`);
  });
});
