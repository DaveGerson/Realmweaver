// @vitest-environment jsdom
/**
 * SPEC — Wave 2, lane SECRETS (E1/E2 UI): the mystery controls in
 * `components/tools/SecretsTracker.tsx`.
 *
 * The tracker is where a GM writes the clue→revelation edge. Three controls,
 * all inside the card's EXPANDED body (where "Linked Entities" already lives),
 * plus one compact badge that is readable without expanding anything.
 *
 * 1. **"Supports revelation" picker — clue cards only.** An expanded
 *    `category: 'clue'` card renders a select whose accessible name contains
 *    "Supports revelation". Its options are a clearing option (value `''`) plus
 *    one option per `category: 'revelation'` secret in the campaign, labelled
 *    with the revelation's title — never a clue, a plain secret, a rumour, or
 *    the card itself. Its value is the card's current `revealsSecretId`.
 *    Choosing a revelation writes `updateSecret(clueId, { revealsSecretId: id })`;
 *    choosing the clearing option writes `{ revealsSecretId: undefined }` — the
 *    key must be PRESENT, since `updateSecret` is an `Object.assign` and an
 *    omitted key clears nothing. When the campaign holds no revelations at all
 *    there is no select, just a plain sentence saying so.
 *
 * 2. **Vital toggle — revelation cards only.** An expanded
 *    `category: 'revelation'` card renders a toggle button whose accessible
 *    name contains "vital", carrying its state on `aria-pressed` (a constant
 *    label, like the shipped "Here now" toggle). Absent `isVital` reads as not
 *    pressed. Clicking writes `{ isVital: true }` / `{ isVital: false }`.
 *
 * 3. **Clues-needed control — vital revelations only.** When, and only when, a
 *    revelation is vital, a small number input with accessible name containing
 *    "clues needed" appears next to the toggle. It shows `3` when
 *    `cluesNeeded` is absent — the documented default. A valid integer of 1 or
 *    more writes `{ cluesNeeded: n }`; clearing the field writes
 *    `{ cluesNeeded: undefined }` (back to the default); a value below 1 writes
 *    nothing at all.
 *
 * 4. **Inbound-clue badge — every revelation card, collapsed.** Accessible name
 *    exactly `"{inbound} of {cluesNeeded ?? 3} clues"`. "Inbound" uses this
 *    lane's single definition: any secret whose `revealsSecretId` equals this
 *    revelation's id, whatever its own category; a self-reference never counts.
 *    Non-revelation cards carry no badge.
 *
 * 5. Reading and expanding write nothing to the store. Indigo belongs to
 *    RealmChat and appears nowhere here.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';
import type { Campaign } from '../types/index';

const h = vi.hoisted(() => ({
  createSecret: vi.fn(),
  updateSecret: vi.fn(),
  revealSecret: vi.fn(),
  deleteSecret: vi.fn(),
}));

vi.mock('@/services/campaignService', () => ({
  campaignService: {
    createSecret: h.createSecret,
    updateSecret: h.updateSecret,
    revealSecret: h.revealSecret,
    deleteSecret: h.deleteSecret,
  },
}));

const { SecretsTracker } = await import('../components/tools/SecretsTracker');
const { ConfirmDialogProvider } = await import('../hooks/useConfirmDialog');
const { ToastProvider } = await import('../hooks/useToast');

// --- Fixture ---------------------------------------------------------------

const secret = (over: Record<string, unknown>) => ({
  id: 's-x',
  title: 'A secret',
  content: 'Content.',
  category: 'secret',
  isRevealed: false,
  createdAt: '2026-05-01T00:00:00.000Z',
  ...over,
});

const T = {
  revelation: 'The Duke is the drowned god',
  otherRevelation: 'The tide is a debt, not a tide',
  clueLinked: 'The wet footprints',
  clueLoose: 'A ledger with nine blank pages',
  plain: 'The harbourmaster takes coin',
  rumour: 'They say the bells ring themselves',
};

const baseCampaign = () => ({
  id: 'camp-1',
  title: 'The Sunken Crown',
  setting: 'A drowned empire',
  npcs: [{ id: 'npc-1', name: 'Marla Tidebinder' }],
  locations: [],
  factions: [],
  items: [],
  adventures: [],
  articles: [],
  sessionLogs: [],
  playerCharacters: [],
  plots: [],
  notes: [],
  secrets: [
    secret({ id: 'rev-1', title: T.revelation, category: 'revelation', isVital: true }),
    secret({ id: 'rev-2', title: T.otherRevelation, category: 'revelation' }),
    secret({ id: 'clue-1', title: T.clueLinked, category: 'clue', revealsSecretId: 'rev-1' }),
    secret({ id: 'clue-2', title: T.clueLoose, category: 'clue' }),
    secret({ id: 'plain-1', title: T.plain, category: 'secret' }),
    secret({ id: 'rum-1', title: T.rumour, category: 'rumor' }),
  ],
});

const renderTracker = (over: Record<string, unknown> = {}) => {
  const campaign = { ...baseCampaign(), ...over } as unknown as Campaign;
  return render(
    <ToastProvider>
      <ConfirmDialogProvider>
        <SecretsTracker campaign={campaign} />
      </ConfirmDialogProvider>
    </ToastProvider>
  );
};

/** Expand one card by clicking its title button. */
const expand = (title: string) => {
  fireEvent.click(screen.getByRole('button', { name: title }));
};

const picker = () => screen.getByRole('combobox', { name: /supports revelation/i });
const queryPicker = () => screen.queryByRole('combobox', { name: /supports revelation/i });
const vitalToggle = () => screen.getByRole('button', { name: /vital/i });
const queryVitalToggle = () => screen.queryByRole('button', { name: /vital/i });
const cluesNeeded = () => screen.getByRole('spinbutton', { name: /clues needed/i });
const queryCluesNeeded = () => screen.queryByRole('spinbutton', { name: /clues needed/i });

/** The single `updates` object handed to updateSecret. */
const lastUpdate = () => {
  const calls = h.updateSecret.mock.calls;
  return { id: calls[calls.length - 1][0], updates: calls[calls.length - 1][1] };
};

beforeEach(() => {
  h.createSecret.mockClear();
  h.updateSecret.mockClear();
  h.revealSecret.mockClear();
  h.deleteSecret.mockClear();
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// 1. Supports-revelation picker
// ---------------------------------------------------------------------------

describe('SecretsTracker — the "supports revelation" picker', () => {
  it('appears on an expanded clue card', () => {
    renderTracker();
    expect(queryPicker()).toBeNull();

    expand(T.clueLoose);

    expect(queryPicker()).not.toBeNull();
  });

  it('offers a clearing option plus every revelation, and nothing else', () => {
    renderTracker();
    expand(T.clueLoose);

    const options = within(picker()).getAllByRole('option');
    const values = options.map(o => (o as HTMLOptionElement).value);

    expect(values).toContain('');
    expect(values).toContain('rev-1');
    expect(values).toContain('rev-2');
    expect(values).not.toContain('clue-1');
    expect(values).not.toContain('clue-2');
    expect(values).not.toContain('plain-1');
    expect(values).not.toContain('rum-1');
    expect(values).toHaveLength(3);
  });

  it('labels each option with the revelation\'s title', () => {
    renderTracker();
    expand(T.clueLoose);

    const labels = within(picker()).getAllByRole('option').map(o => o.textContent);
    expect(labels).toContain(T.revelation);
    expect(labels).toContain(T.otherRevelation);
  });

  it('shows the clue\'s current edge as the selected value', () => {
    renderTracker();
    expand(T.clueLinked);

    expect((picker() as HTMLSelectElement).value).toBe('rev-1');
  });

  it('shows the clearing option as selected for a clue with no edge', () => {
    renderTracker();
    expand(T.clueLoose);

    expect((picker() as HTMLSelectElement).value).toBe('');
  });

  it('writes the edge when a revelation is chosen', () => {
    renderTracker();
    expand(T.clueLoose);

    fireEvent.change(picker(), { target: { value: 'rev-2' } });

    expect(h.updateSecret).toHaveBeenCalledTimes(1);
    expect(lastUpdate().id).toBe('clue-2');
    expect(lastUpdate().updates.revealsSecretId).toBe('rev-2');
  });

  it('clears the edge — with the key present — when the clearing option is chosen', () => {
    renderTracker();
    expand(T.clueLinked);

    fireEvent.change(picker(), { target: { value: '' } });

    const { id, updates } = lastUpdate();
    expect(id).toBe('clue-1');
    expect(Object.prototype.hasOwnProperty.call(updates, 'revealsSecretId')).toBe(true);
    expect(updates.revealsSecretId).toBeUndefined();
  });

  it('is absent on revelation, plain-secret and rumour cards', () => {
    renderTracker();

    expand(T.revelation);
    expect(queryPicker()).toBeNull();

    expand(T.plain);
    expect(queryPicker()).toBeNull();

    expand(T.rumour);
    expect(queryPicker()).toBeNull();
  });

  it('says so plainly instead of offering an empty picker when there are no revelations', () => {
    renderTracker({
      secrets: [secret({ id: 'clue-2', title: T.clueLoose, category: 'clue' })],
    });
    expand(T.clueLoose);

    expect(queryPicker()).toBeNull();
    expect(screen.queryByText(/no revelations/i)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Vital toggle
// ---------------------------------------------------------------------------

describe('SecretsTracker — the vital toggle', () => {
  it('appears on an expanded revelation card only', () => {
    renderTracker();
    expect(queryVitalToggle()).toBeNull();

    expand(T.clueLoose);
    expect(queryVitalToggle()).toBeNull();

    expand(T.revelation);
    expect(queryVitalToggle()).not.toBeNull();
  });

  it('reads pressed for a vital revelation', () => {
    renderTracker();
    expand(T.revelation);

    expect(vitalToggle().getAttribute('aria-pressed')).toBe('true');
  });

  it('reads unpressed when isVital is absent', () => {
    renderTracker();
    expand(T.otherRevelation);

    expect(vitalToggle().getAttribute('aria-pressed')).toBe('false');
  });

  it('marks a revelation vital', () => {
    renderTracker();
    expand(T.otherRevelation);

    fireEvent.click(vitalToggle());

    expect(lastUpdate().id).toBe('rev-2');
    expect(lastUpdate().updates.isVital).toBe(true);
  });

  it('un-marks a vital revelation', () => {
    renderTracker();
    expand(T.revelation);

    fireEvent.click(vitalToggle());

    expect(lastUpdate().id).toBe('rev-1');
    expect(lastUpdate().updates.isVital).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Clues-needed control
// ---------------------------------------------------------------------------

describe('SecretsTracker — the clues-needed control', () => {
  it('is absent on a revelation that is not vital', () => {
    renderTracker();
    expand(T.otherRevelation);

    expect(queryCluesNeeded()).toBeNull();
  });

  it('appears on a vital revelation and defaults to three', () => {
    renderTracker();
    expand(T.revelation);

    expect((cluesNeeded() as HTMLInputElement).value).toBe('3');
  });

  it('shows an explicit cluesNeeded override', () => {
    renderTracker({
      secrets: [secret({ id: 'rev-1', title: T.revelation, category: 'revelation', isVital: true, cluesNeeded: 5 })],
    });
    expand(T.revelation);

    expect((cluesNeeded() as HTMLInputElement).value).toBe('5');
  });

  it('writes a new threshold as a number', () => {
    renderTracker();
    expand(T.revelation);

    fireEvent.change(cluesNeeded(), { target: { value: '5' } });

    expect(lastUpdate().id).toBe('rev-1');
    expect(lastUpdate().updates.cluesNeeded).toBe(5);
  });

  it('clears back to the default — with the key present — when emptied', () => {
    renderTracker({
      secrets: [secret({ id: 'rev-1', title: T.revelation, category: 'revelation', isVital: true, cluesNeeded: 5 })],
    });
    expand(T.revelation);

    fireEvent.change(cluesNeeded(), { target: { value: '' } });

    const { updates } = lastUpdate();
    expect(Object.prototype.hasOwnProperty.call(updates, 'cluesNeeded')).toBe(true);
    expect(updates.cluesNeeded).toBeUndefined();
  });

  it('refuses a threshold below one', () => {
    renderTracker();
    expand(T.revelation);

    fireEvent.change(cluesNeeded(), { target: { value: '0' } });

    expect(h.updateSecret).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4. Inbound-clue badge
// ---------------------------------------------------------------------------

describe('SecretsTracker — the inbound-clue badge', () => {
  it('counts the clues pointing at each revelation without expanding anything', () => {
    renderTracker();

    // rev-1 has one inbound clue and defaults to a threshold of 3.
    expect(screen.queryByLabelText('1 of 3 clues')).not.toBeNull();
    // rev-2 has none.
    expect(screen.queryByLabelText('0 of 3 clues')).not.toBeNull();
  });

  it('honours a cluesNeeded override in the denominator', () => {
    renderTracker({
      secrets: [
        secret({ id: 'rev-1', title: T.revelation, category: 'revelation', isVital: true, cluesNeeded: 5 }),
        secret({ id: 'clue-1', title: T.clueLinked, category: 'clue', revealsSecretId: 'rev-1' }),
      ],
    });

    expect(screen.queryByLabelText('1 of 5 clues')).not.toBeNull();
  });

  it('counts an inbound edge whatever category the pointing secret carries', () => {
    renderTracker({
      secrets: [
        secret({ id: 'rev-1', title: T.revelation, category: 'revelation' }),
        secret({ id: 'clue-1', title: T.clueLinked, category: 'clue', revealsSecretId: 'rev-1' }),
        secret({ id: 'rum-1', title: T.rumour, category: 'rumor', revealsSecretId: 'rev-1' }),
      ],
    });

    expect(screen.queryByLabelText('2 of 3 clues')).not.toBeNull();
  });

  it('never counts a self-reference', () => {
    renderTracker({
      secrets: [
        secret({ id: 'rev-1', title: T.revelation, category: 'revelation', revealsSecretId: 'rev-1' }),
      ],
    });

    expect(screen.queryByLabelText('0 of 3 clues')).not.toBeNull();
  });

  it('carries no badge on non-revelation cards', () => {
    renderTracker({
      secrets: [
        secret({ id: 'clue-1', title: T.clueLinked, category: 'clue' }),
        secret({ id: 'plain-1', title: T.plain, category: 'secret' }),
        secret({ id: 'rum-1', title: T.rumour, category: 'rumor' }),
      ],
    });

    expect(screen.queryByLabelText(/of \d+ clues$/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. Hygiene
// ---------------------------------------------------------------------------

describe('SecretsTracker — the mystery controls are quiet until used', () => {
  it('writes nothing to the store on render or expansion', () => {
    renderTracker();

    expand(T.revelation);
    expand(T.clueLinked);
    expand(T.plain);

    expect(h.updateSecret).not.toHaveBeenCalled();
    expect(h.createSecret).not.toHaveBeenCalled();
    expect(h.deleteSecret).not.toHaveBeenCalled();
    expect(h.revealSecret).not.toHaveBeenCalled();
  });

  it('survives a campaign whose secrets array is absent', () => {
    expect(() => renderTracker({ secrets: undefined })).not.toThrow();
  });

  it('leaves indigo to RealmChat', () => {
    const { container } = renderTracker();
    expand(T.revelation);
    expand(T.clueLoose);

    expect(container.innerHTML).not.toMatch(/indigo/);
  });
});
