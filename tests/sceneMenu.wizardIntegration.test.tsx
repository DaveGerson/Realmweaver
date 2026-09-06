// @vitest-environment jsdom
/**
 * SPEC — Scene Menu Generator inside the Session Prep Wizard's Beats step
 * (Wave 2, lane 2: SessionPrepWizard bundle)
 * =============================================================================
 * Source: docs/design/lazy-dm-lens.md §4 R1 / the "scene menu". File under
 * test: components/dialogs/SessionPrepWizard.tsx (via
 * components/dialogs/prep/SceneMenuSuggestions.tsx).
 *
 * THE CONTRACT
 * ------------
 * 1. A "Suggest a few" button sits above the existing manual add-beat row,
 *    present from the moment the Beats step opens — zero typed prompt.
 * 2. One click fetches 5-6 draft scenes (here, three) and shows them as
 *    checked-by-default checkable cards: a one-line title plus an optional
 *    one-sentence hook.
 * 3. "Add N" folds only the CHECKED drafts into the existing beats list —
 *    hook becomes `notes` — in addition to, never instead of, any hand-typed
 *    beats already there. The batch is then gone (a one-shot preview).
 * 4. "Discard" drops the whole batch with no trace: nothing is added, and
 *    generating again works exactly as before.
 * 5. An empty result or a rejected generation says so inline, quietly, and
 *    never leaves the step half-broken.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within, waitFor, act } from '@testing-library/react';
import type { Campaign, SessionLog, Beat } from '../types/index';

const h = vi.hoisted(() => ({
  createSessionLog: vi.fn((_newLogData: Omit<SessionLog, 'id'>) => 'sess-new'),
  goLive: vi.fn(),
  hasColdOpenMaterial: vi.fn(() => false),
  generateColdOpen: vi.fn(async () => 'COLD OPEN'),
  generateStrongStart: vi.fn(async () => 'STRONG START'),
  generateSceneMenu: vi.fn(async (_context?: string, _isMockMode?: boolean) => [
    { title: 'Ambush at the ford', hook: 'A rope bridge, half-cut.' },
    { title: 'A stranger at the door' },
    { title: 'The bell rings early' },
  ]),
}));

vi.mock('../services/campaignService', () => ({
  campaignService: { createSessionLog: h.createSessionLog, goLive: h.goLive },
}));

vi.mock('../services/aiService', () => ({
  hasColdOpenMaterial: h.hasColdOpenMaterial,
  generateColdOpen: h.generateColdOpen,
  generateStrongStart: h.generateStrongStart,
  generateSceneMenu: h.generateSceneMenu,
}));

import { SessionPrepWizard } from '../components/dialogs/SessionPrepWizard';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const campaign = {
  id: 'c1',
  title: 'Ashfall',
  settingType: 'custom',
  setting: 'A dying empire',
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const nav = () => screen.getByRole('navigation', { name: /wizard steps/i });
const gotoStep = (label: RegExp) => fireEvent.click(within(nav()).getByRole('button', { name: label }));
const lazyToggle = () => screen.getByRole('button', { name: /lazy/i });
const payload = () => h.createSessionLog.mock.calls[0][0] as unknown as Omit<SessionLog, 'id'>;
const beatFields = () => screen.queryAllByRole('textbox', { name: /^Beat \d+$/ });
const suggestButton = () => screen.getByRole('button', { name: /^Suggest a few$/i });

const openBeats = (props: { isMockMode?: boolean } = {}) => {
  render(
    <SessionPrepWizard
      campaign={campaign}
      onComplete={() => {}}
      onClose={() => {}}
      {...(props.isMockMode === undefined ? {} : { isMockMode: props.isMockMode })}
    />
  );
  fireEvent.click(lazyToggle());
  gotoStep(/^Beats/);
};

const pressGoLive = () => {
  gotoStep(/^Go Live/);
  fireEvent.click(screen.getByRole('button', { name: /^Go Live$/ }));
};

beforeEach(() => {
  h.createSessionLog.mockClear();
  h.goLive.mockClear();
  h.generateSceneMenu.mockClear();
  h.generateSceneMenu.mockResolvedValue([
    { title: 'Ambush at the ford', hook: 'A rope bridge, half-cut.' },
    { title: 'A stranger at the door' },
    { title: 'The bell rings early' },
  ]);
});

afterEach(cleanup);

// ── 0. one request per press ──────────────────────────────────────────────────

describe('Scene Menu Generator — one request per press', () => {
  it('two presses landing before React commits fetch once; the latch releases when the response lands', async () => {
    let resolveMenu!: (value: Awaited<ReturnType<typeof h.generateSceneMenu>>) => void;
    h.generateSceneMenu.mockImplementationOnce(() => new Promise(resolve => { resolveMenu = resolve; }));
    openBeats();

    // Two clicks inside one act(): neither sees the other's disabled re-render,
    // exactly like a double-click at the table — only the ref latch stands.
    const button = suggestButton();
    act(() => {
      button.click();
      button.click();
    });
    expect(h.generateSceneMenu).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveMenu([{ title: 'Ambush at the ford' }]);
    });
    await screen.findByRole('checkbox', { name: 'Ambush at the ford' });

    fireEvent.click(suggestButton());
    expect(h.generateSceneMenu).toHaveBeenCalledTimes(2);
  });
});

// ── 1. the button ─────────────────────────────────────────────────────────────

describe('Scene Menu Generator — where the button is', () => {
  it('offers "Suggest a few" above the manual add-beat row, present from the start', () => {
    openBeats();
    expect(suggestButton()).toBeTruthy();
    expect(beatFields()).toHaveLength(0);
  });

  it('calls generateSceneMenu with zero DM-typed input', async () => {
    openBeats();
    fireEvent.click(suggestButton());

    await waitFor(() => expect(h.generateSceneMenu).toHaveBeenCalledTimes(1));
    const [context, isMockMode] = h.generateSceneMenu.mock.calls[0];
    expect(typeof context).toBe('string');
    expect(isMockMode).toBe(false);
  });

  it('passes the wizard mock-mode flag through to the facade', async () => {
    openBeats({ isMockMode: true });
    fireEvent.click(suggestButton());

    await waitFor(() => expect(h.generateSceneMenu).toHaveBeenCalledTimes(1));
    expect(h.generateSceneMenu.mock.calls[0][1]).toBe(true);
  });
});

// ── 2. the preview ────────────────────────────────────────────────────────────

describe('Scene Menu Generator — the preview', () => {
  it('shows checkable draft cards, all checked by default', async () => {
    openBeats();
    fireEvent.click(suggestButton());

    const checkbox = () => screen.getByRole('checkbox', { name: 'Ambush at the ford' }) as HTMLInputElement;
    await waitFor(() => expect(checkbox()).toBeTruthy());

    expect(checkbox().checked).toBe(true);
    expect(screen.getByText('A rope bridge, half-cut.')).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: 'A stranger at the door' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'The bell rings early' }) as HTMLInputElement).checked).toBe(true);
  });

  it('renders a title with no hook just as happily as one with a hook', async () => {
    openBeats();
    fireEvent.click(suggestButton());
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'A stranger at the door' })).toBeTruthy());
    // No crash, and no stray "undefined" text from a missing hook.
    expect(document.body.textContent).not.toContain('undefined');
  });
});

// ── 3. Add N ──────────────────────────────────────────────────────────────────

describe('Scene Menu Generator — "Add N" keeps only what is checked', () => {
  it('folds only the checked drafts into the beats list — hook becomes notes', async () => {
    openBeats();
    fireEvent.click(suggestButton());
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Ambush at the ford' })).toBeTruthy());

    fireEvent.click(screen.getByRole('checkbox', { name: 'A stranger at the door' })); // uncheck the middle one
    fireEvent.click(screen.getByRole('button', { name: /^Add 2$/i }));

    expect(beatFields()).toHaveLength(2);
    expect((beatFields()[0] as HTMLInputElement).value).toBe('Ambush at the ford');
    expect((beatFields()[1] as HTMLInputElement).value).toBe('The bell rings early');

    // One-shot: the preview is gone.
    expect(screen.queryByRole('checkbox', { name: 'Ambush at the ford' })).toBeNull();

    pressGoLive();
    const beats = payload().beats as Beat[];
    expect(beats.map(b => b.title)).toEqual(['Ambush at the ford', 'The bell rings early']);
    expect(beats[0].notes).toBe('A rope bridge, half-cut.');
    expect('notes' in beats[1]).toBe(false);
  });

  it('adds in ADDITION to hand-typed beats, never instead of them', async () => {
    openBeats();
    fireEvent.change(screen.getByRole('textbox', { name: /add a beat/i }), { target: { value: 'Hand-typed beat' } });
    fireEvent.click(screen.getByRole('button', { name: /^Add beat$/i }));
    expect(beatFields()).toHaveLength(1);

    fireEvent.click(suggestButton());
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Ambush at the ford' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /^Add 3$/i }));

    expect(beatFields()).toHaveLength(4);
    expect((beatFields()[0] as HTMLInputElement).value).toBe('Hand-typed beat');
  });

  it('disables "Add 0" when every draft is unchecked', async () => {
    openBeats();
    fireEvent.click(suggestButton());
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Ambush at the ford' })).toBeTruthy());

    for (const label of ['Ambush at the ford', 'A stranger at the door', 'The bell rings early']) {
      fireEvent.click(screen.getByRole('checkbox', { name: label }));
    }

    expect((screen.getByRole('button', { name: /^Add 0$/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});

// ── 4. Discard ────────────────────────────────────────────────────────────────

describe('Scene Menu Generator — "Discard" drops the batch with no trace', () => {
  it('adds nothing to the beats list', async () => {
    openBeats();
    fireEvent.click(suggestButton());
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Ambush at the ford' })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /^Discard$/i }));

    expect(screen.queryByRole('checkbox', { name: 'Ambush at the ford' })).toBeNull();
    expect(beatFields()).toHaveLength(0);

    pressGoLive();
    expect((payload().beats as Beat[]) ?? []).toEqual([]);
  });

  it('lets the DM generate again afterwards', async () => {
    openBeats();
    fireEvent.click(suggestButton());
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Ambush at the ford' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /^Discard$/i }));

    fireEvent.click(suggestButton());
    await waitFor(() => expect(h.generateSceneMenu).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('checkbox', { name: 'Ambush at the ford' })).toBeTruthy();
  });
});

// ── 5. quiet failure ──────────────────────────────────────────────────────────

describe('Scene Menu Generator — when nothing usable comes back', () => {
  it('says so inline when the result is empty, without crashing', async () => {
    h.generateSceneMenu.mockResolvedValueOnce([]);
    openBeats();
    fireEvent.click(suggestButton());

    await screen.findByText(/nothing came back/i);
    expect(beatFields()).toHaveLength(0);
  });

  it('says so inline on a rejected generation, without crashing', async () => {
    h.generateSceneMenu.mockRejectedValueOnce(new Error('504 gateway timeout'));
    openBeats();
    expect(() => fireEvent.click(suggestButton())).not.toThrow();

    await screen.findByText('504 gateway timeout');
    expect(suggestButton()).toBeTruthy();
  });
});
