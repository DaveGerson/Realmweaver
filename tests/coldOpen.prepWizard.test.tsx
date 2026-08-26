// @vitest-environment jsdom
/**
 * SPEC — drafting the cold open inside session prep (Wave 2, lane MOMENTS / P4)
 * =============================================================================
 * Source: docs/design/storyteller-first-design.md P4, consumer 2. File under
 * test: components/dialogs/SessionPrepWizard.tsx.
 *
 * WHERE THIS LIVES, AND WHY IT IS NOT SOMEWHERE NEW
 * -------------------------------------------------
 * The wizard already owns the question "what are you opening with tonight?" —
 * the lazy prep path's Strong Start step asks it in so many words, and the
 * Session Runner already displays whatever that step produced. So the cold open
 * is offered there rather than in a new dialog of its own: pressing one button
 * fills the strong-start field the DM was going to fill anyway. With the lazy
 * path off, the same action is offered on the Go Live step, and what it drafts
 * is folded into `prepNotes` with the SAME strong-start encoding, so the
 * Session Runner surfaces it for free. Zero new storage of any kind.
 *
 * THE CONTRACT, IN PLAIN SENTENCES
 * --------------------------------
 * 1. **One button, one label, two places.** "Draft it from last session"
 *    appears on the Strong Start step (lazy path on) and, under a "Cold open"
 *    heading, on the Go Live step (lazy path off). It is never in both places
 *    at once — whichever step is asking the question owns it.
 *
 * 2. **The DM types nothing.** Pressing it hands the campaign itself to
 *    `aiService.generateColdOpen`, with the wizard's mock-mode flag. No prompt
 *    is composed at the call site, and nothing but the campaign, an optional
 *    context string and an optional tier flag is passed.
 *
 * 3. **The draft lands in a field the DM owns.** On the Strong Start step it
 *    fills that step's textarea; on the Go Live step it fills a cold-open
 *    textarea of its own. Either way the DM can edit it freely afterwards, and
 *    pressing the button again REPLACES what is there — a redraft is a redraft,
 *    not an append.
 *
 * 4. **One press is one generation.** The guard is a synchronous latch, so two
 *    clicks in the same tick produce one call, and the button reads as busy
 *    while the draft is in flight.
 *
 * 5. **A failure is quiet.** Nothing is thrown and no state is torn down: an
 *    inline, polite message appears beside the button, what was already in the
 *    field is left alone, and the button can be pressed again.
 *
 * 6. **With nothing to draft from, nothing is offered.** When
 *    `hasColdOpenMaterial(campaign)` is false the button is not rendered at
 *    all; an invitation says what would make it possible, and no generation is
 *    ever attempted.
 *
 * 7. **Go Live persists it with zero new schema.** The Go Live step's cold open
 *    is folded into `prepNotes` through `composeStrongStartPrepNotes` — the
 *    exact encoding the Session Runner already parses. The markers themselves
 *    are machinery and are never shown to the DM. With the lazy path on, the
 *    strong start keeps doing that job and the Go Live cold open does not exist
 *    to ship — the same "off means it does not ship" rule the strong start and
 *    the beats already follow.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import type { Campaign, SessionLog, SessionLogEntry, Beat } from '../types/index';
import { composeStrongStartPrepNotes, STRONG_START_OPEN, STRONG_START_CLOSE } from './helpers/strongStartFormat';

const h = vi.hoisted(() => ({
  createSessionLog: vi.fn((_newLogData: Omit<SessionLog, 'id'>) => 'sess-new'),
  goLive: vi.fn(),
  generateColdOpen: vi.fn(async (_request: unknown, _isMockMode?: boolean) => 'DRAFTED COLD OPEN'),
  hasColdOpenMaterial: vi.fn((_campaign: unknown) => true),
}));

vi.mock('../services/campaignService', () => ({
  campaignService: { createSessionLog: h.createSessionLog, goLive: h.goLive },
}));

vi.mock('../services/aiService', () => ({
  generateColdOpen: h.generateColdOpen,
  hasColdOpenMaterial: h.hasColdOpenMaterial,
}));

import { SessionPrepWizard } from '../components/dialogs/SessionPrepWizard';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function entry(over: Partial<SessionLogEntry> & { id: string }): SessionLogEntry {
  return { timestamp: '2026-01-01T20:00:00.000Z', content: 'A thing.', taggedEntityIds: [], ...over } as SessionLogEntry;
}

function session(over: Partial<SessionLog> & { id: string }): SessionLog {
  return {
    title: `Session ${over.id}`,
    status: 'completed',
    sessionDate: '2026-01-01',
    plannedSceneIds: [],
    prepNotes: '',
    relatedPlotIds: [],
    runningNotes: '',
    structuredNotes: [],
    encounterLog: [],
    recap: '',
    notableEvents: '',
    looseEnds: '',
    ...over,
  } as SessionLog;
}

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
  playerCharacters: [],
  plots: [],
  notes: [],
  secrets: [],
  styleProfile: 'Short, cold sentences.',
  sessionLogs: [
    session({
      id: 's1',
      title: 'The Ashen Vault',
      recap: 'The party burned the ledger.',
      looseEnds: 'Nobody has explained where Brannock went.',
      structuredNotes: [entry({ id: 'n1', content: 'Brannock swore on the ledger, and lied.', isImportant: true })],
    }),
  ],
} as unknown as Campaign;

// ── Helpers ───────────────────────────────────────────────────────────────────

const DRAFT_LABEL = /^Draft it from last session$/i;
const QUIET_ERROR = "That didn't come through. Try it again in a moment.";
const NO_MATERIAL_INVITE =
  'Star a moment at the table or write a recap when the session ends, and this drafts itself.';
const STRONG_START_FIELD = /first thing you['’]ll say when the session starts/i;
const COLD_OPEN_FIELD = /read this to open the session/i;

const nav = () => screen.getByRole('navigation', { name: /wizard steps/i });
const gotoStep = (label: RegExp) => fireEvent.click(within(nav()).getByRole('button', { name: label }));
const lazyToggle = () => screen.getByRole('button', { name: /lazy/i });
const draftButton = () => screen.getByRole('button', { name: DRAFT_LABEL }) as HTMLButtonElement;
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const valueOf = (el: HTMLElement): string => (el as HTMLInputElement | HTMLTextAreaElement).value;
const payload = () => h.createSessionLog.mock.calls[0][0] as unknown as Omit<SessionLog, 'id'>;

const pressGoLive = () => {
  gotoStep(/^Go Live/);
  fireEvent.click(screen.getByRole('button', { name: /^Go Live$/ }));
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function renderWizard(props: { isMockMode?: boolean; campaign?: Campaign } = {}) {
  const onComplete = vi.fn();
  render(
    <SessionPrepWizard
      campaign={props.campaign ?? campaign}
      onComplete={onComplete}
      onClose={() => {}}
      {...(props.isMockMode === undefined ? {} : { isMockMode: props.isMockMode })}
    />
  );
  return { onComplete };
}

/** Opens the lazy path's Strong Start step. */
function openStrongStart(props: { isMockMode?: boolean; campaign?: Campaign } = {}) {
  const handles = renderWizard(props);
  fireEvent.click(lazyToggle());
  gotoStep(/^Strong Start/);
  return handles;
}

/** Opens the Go Live step with the lazy path off. */
function openReview(props: { isMockMode?: boolean; campaign?: Campaign } = {}) {
  const handles = renderWizard(props);
  gotoStep(/^Go Live/);
  return handles;
}

beforeEach(() => {
  h.createSessionLog.mockClear();
  h.goLive.mockClear();
  h.generateColdOpen.mockClear();
  h.generateColdOpen.mockResolvedValue('DRAFTED COLD OPEN');
  h.hasColdOpenMaterial.mockClear();
  h.hasColdOpenMaterial.mockReturnValue(true);
});

afterEach(cleanup);

// ── 1. where the button is ────────────────────────────────────────────────────

describe('One button, in whichever step is asking the question', () => {
  it('offers it on the Strong Start step of the lazy path', () => {
    openStrongStart();
    expect(draftButton()).toBeTruthy();
  });

  it('offers it under a Cold open heading on Go Live when the lazy path is off', () => {
    openReview();
    expect(screen.getByRole('heading', { name: /^cold open$/i })).toBeTruthy();
    expect(draftButton()).toBeTruthy();
  });

  it('does not offer it twice — Go Live stays out of it while the lazy path is on', () => {
    renderWizard();
    fireEvent.click(lazyToggle());
    gotoStep(/^Go Live/);
    expect(screen.queryByRole('button', { name: DRAFT_LABEL })).toBeNull();
    expect(screen.queryByRole('heading', { name: /^cold open$/i })).toBeNull();
  });

  it('shows no cold-open field until something has been drafted', () => {
    openReview();
    expect(screen.queryByRole('textbox', { name: COLD_OPEN_FIELD })).toBeNull();
  });
});

// ── 2. the DM types nothing ───────────────────────────────────────────────────

describe('The DM types nothing', () => {
  it('hands over the campaign itself, and no crafted prompt', async () => {
    openStrongStart();
    fireEvent.click(draftButton());

    await waitFor(() => expect(h.generateColdOpen).toHaveBeenCalledTimes(1));
    const [request] = h.generateColdOpen.mock.calls[0] as [Record<string, unknown>, boolean?];

    expect(request.campaign).toBe(campaign);
    expect('prompt' in request).toBe(false);
    for (const key of Object.keys(request)) {
      expect(['campaign', 'campaignContext', 'useLiteModel']).toContain(key);
    }
  });

  it('passes the wizard mock-mode flag through the facade', async () => {
    openStrongStart({ isMockMode: true });
    fireEvent.click(draftButton());
    await waitFor(() => expect(h.generateColdOpen).toHaveBeenCalledTimes(1));
    expect(h.generateColdOpen.mock.calls[0][1]).toBe(true);
  });

  it('asks for the real thing when no flag is given', async () => {
    openStrongStart();
    fireEvent.click(draftButton());
    await waitFor(() => expect(h.generateColdOpen).toHaveBeenCalledTimes(1));
    expect(h.generateColdOpen.mock.calls[0][1] ?? false).toBe(false);
  });

  it('makes the same call from the Go Live step', async () => {
    openReview();
    fireEvent.click(draftButton());
    await waitFor(() => expect(h.generateColdOpen).toHaveBeenCalledTimes(1));
    expect((h.generateColdOpen.mock.calls[0][0] as Record<string, unknown>).campaign).toBe(campaign);
  });
});

// ── 3. the draft lands in a field the DM owns ─────────────────────────────────

describe('The draft fills the field the DM was going to fill anyway', () => {
  it('fills the strong-start field on the lazy path', async () => {
    openStrongStart();
    fireEvent.click(draftButton());
    await waitFor(() =>
      expect(valueOf(screen.getByRole('textbox', { name: STRONG_START_FIELD }))).toBe('DRAFTED COLD OPEN')
    );
  });

  it('fills a cold-open field of its own on the Go Live step', async () => {
    openReview();
    fireEvent.click(draftButton());
    await waitFor(() =>
      expect(valueOf(screen.getByRole('textbox', { name: COLD_OPEN_FIELD }))).toBe('DRAFTED COLD OPEN')
    );
  });

  it('lets the DM rewrite it afterwards', async () => {
    openStrongStart();
    fireEvent.click(draftButton());
    const field = () => screen.getByRole('textbox', { name: STRONG_START_FIELD });
    await waitFor(() => expect(valueOf(field())).toBe('DRAFTED COLD OPEN'));

    type(field(), 'The bell in the drowned chapel starts ringing by itself.');
    expect(valueOf(field())).toBe('The bell in the drowned chapel starts ringing by itself.');
  });

  it('replaces what is there when it is asked again', async () => {
    openStrongStart();
    const field = () => screen.getByRole('textbox', { name: STRONG_START_FIELD });

    fireEvent.click(draftButton());
    await waitFor(() => expect(valueOf(field())).toBe('DRAFTED COLD OPEN'));

    type(field(), 'A line the DM typed over it.');
    h.generateColdOpen.mockResolvedValueOnce('A SECOND DRAFT');
    fireEvent.click(draftButton());

    await waitFor(() => expect(valueOf(field())).toBe('A SECOND DRAFT'));
    expect(h.generateColdOpen).toHaveBeenCalledTimes(2);
  });

  it('keeps the draft when the DM steps away and comes back', async () => {
    openStrongStart();
    fireEvent.click(draftButton());
    await waitFor(() =>
      expect(valueOf(screen.getByRole('textbox', { name: STRONG_START_FIELD }))).toBe('DRAFTED COLD OPEN')
    );

    gotoStep(/^Beats/);
    gotoStep(/^Strong Start/);

    expect(valueOf(screen.getByRole('textbox', { name: STRONG_START_FIELD }))).toBe('DRAFTED COLD OPEN');
  });

  it('never shows the DM the storage machinery', async () => {
    openReview();
    fireEvent.click(draftButton());
    await waitFor(() => expect(screen.getByRole('textbox', { name: COLD_OPEN_FIELD })).toBeTruthy());
    expect(document.body.textContent).not.toContain(STRONG_START_OPEN);
    expect(document.body.textContent).not.toMatch(/prepNotes|styleProfile|isImportant/);
  });
});

// ── 4. one press is one generation ────────────────────────────────────────────

describe('One press is one generation', () => {
  it('fires once however fast the DM double-clicks', async () => {
    const d = deferred<string>();
    h.generateColdOpen.mockReturnValueOnce(d.promise);

    openStrongStart();
    const button = draftButton();
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    expect(h.generateColdOpen).toHaveBeenCalledTimes(1);

    await act(async () => { d.resolve('DRAFTED COLD OPEN'); });
    expect(h.generateColdOpen).toHaveBeenCalledTimes(1);
  });

  it('reads as busy while the draft is in flight, and comes back afterwards', async () => {
    const d = deferred<string>();
    h.generateColdOpen.mockReturnValueOnce(d.promise);

    openStrongStart();
    fireEvent.click(draftButton());
    expect(draftButton().disabled).toBe(true);

    await act(async () => { d.resolve('DRAFTED COLD OPEN'); });
    await waitFor(() => expect(draftButton().disabled).toBe(false));
  });

  it('guards the Go Live step the same way', async () => {
    const d = deferred<string>();
    h.generateColdOpen.mockReturnValueOnce(d.promise);

    openReview();
    const button = draftButton();
    fireEvent.click(button);
    fireEvent.click(button);

    expect(h.generateColdOpen).toHaveBeenCalledTimes(1);
    await act(async () => { d.resolve('DRAFTED COLD OPEN'); });
  });
});

// ── 5. a failure is quiet ─────────────────────────────────────────────────────

describe('When the draft does not come through', () => {
  it('says so inline, politely, without throwing', async () => {
    h.generateColdOpen.mockRejectedValueOnce(new Error('504 gateway timeout'));

    openStrongStart();
    expect(() => fireEvent.click(draftButton())).not.toThrow();

    const message = await screen.findByText(QUIET_ERROR);
    expect(message.closest('[role="status"]')).toBeTruthy();
    // The wizard is still standing.
    expect(screen.getByRole('textbox', { name: STRONG_START_FIELD })).toBeTruthy();
  });

  it('leaves what the DM already wrote alone', async () => {
    h.generateColdOpen.mockRejectedValueOnce(new Error('504 gateway timeout'));

    openStrongStart();
    const field = () => screen.getByRole('textbox', { name: STRONG_START_FIELD });
    type(field(), 'The bell starts ringing by itself.');
    fireEvent.click(draftButton());

    await screen.findByText(QUIET_ERROR);
    expect(valueOf(field())).toBe('The bell starts ringing by itself.');
  });

  it('lets the DM try again, and clears the message when the next one lands', async () => {
    h.generateColdOpen.mockRejectedValueOnce(new Error('504 gateway timeout'));

    openStrongStart();
    fireEvent.click(draftButton());
    await screen.findByText(QUIET_ERROR);

    expect(draftButton().disabled).toBe(false);
    fireEvent.click(draftButton());

    await waitFor(() =>
      expect(valueOf(screen.getByRole('textbox', { name: STRONG_START_FIELD }))).toBe('DRAFTED COLD OPEN')
    );
    expect(screen.queryByText(QUIET_ERROR)).toBeNull();
  });

  it('never raises a browser dialog over it', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    h.generateColdOpen.mockRejectedValueOnce(new Error('504 gateway timeout'));

    openStrongStart();
    fireEvent.click(draftButton());
    await screen.findByText(QUIET_ERROR);

    expect(alertSpy).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
    confirmSpy.mockRestore();
  });
});

// ── 6. nothing to draft from ──────────────────────────────────────────────────

describe('With nothing to draft from', () => {
  it('offers no button on the Strong Start step, and invites what would help', () => {
    h.hasColdOpenMaterial.mockReturnValue(false);
    openStrongStart();

    expect(screen.queryByRole('button', { name: DRAFT_LABEL })).toBeNull();
    expect(screen.getByText(NO_MATERIAL_INVITE)).toBeTruthy();
    expect(h.generateColdOpen).not.toHaveBeenCalled();
  });

  it('does the same on the Go Live step', () => {
    h.hasColdOpenMaterial.mockReturnValue(false);
    openReview();

    expect(screen.queryByRole('button', { name: DRAFT_LABEL })).toBeNull();
    expect(screen.getByText(NO_MATERIAL_INVITE)).toBeTruthy();
    expect(h.generateColdOpen).not.toHaveBeenCalled();
  });

  it('asks the campaign, not the session logs, whether there is anything to use', () => {
    openStrongStart();
    expect(h.hasColdOpenMaterial).toHaveBeenCalled();
    expect(h.hasColdOpenMaterial.mock.calls[0][0]).toBe(campaign);
  });

  it('leaves the strong-start field itself in place either way', () => {
    h.hasColdOpenMaterial.mockReturnValue(false);
    openStrongStart();
    expect(screen.getByRole('textbox', { name: STRONG_START_FIELD })).toBeTruthy();
  });
});

// ── 7. what Go Live persists ──────────────────────────────────────────────────

describe('What Go Live persists — zero new schema', () => {
  it('folds a Go Live cold open into prepNotes with the strong-start encoding', async () => {
    openReview();
    fireEvent.click(draftButton());
    await waitFor(() => expect(screen.getByRole('textbox', { name: COLD_OPEN_FIELD })).toBeTruthy());

    type(screen.getByRole('textbox', { name: /prep notes/i }), 'Scottish accent for Angus.');
    fireEvent.click(screen.getByRole('button', { name: /^Go Live$/ }));

    expect(h.createSessionLog).toHaveBeenCalledTimes(1);
    expect(payload().prepNotes).toBe(
      composeStrongStartPrepNotes('DRAFTED COLD OPEN', 'Scottish accent for Angus.')
    );
    expect(payload().prepNotes).toBe(
      [STRONG_START_OPEN, 'DRAFTED COLD OPEN', STRONG_START_CLOSE, '', 'Scottish accent for Angus.'].join('\n')
    );
  });

  it('ships the DM edited version, not the draft it started from', async () => {
    openReview();
    fireEvent.click(draftButton());
    await waitFor(() => expect(screen.getByRole('textbox', { name: COLD_OPEN_FIELD })).toBeTruthy());

    type(screen.getByRole('textbox', { name: COLD_OPEN_FIELD }), 'The bell starts ringing by itself.');
    fireEvent.click(screen.getByRole('button', { name: /^Go Live$/ }));

    expect(payload().prepNotes).toBe(
      `${STRONG_START_OPEN}\nThe bell starts ringing by itself.\n${STRONG_START_CLOSE}`
    );
  });

  it('brings no beats along with it', async () => {
    openReview();
    fireEvent.click(draftButton());
    await waitFor(() => expect(screen.getByRole('textbox', { name: COLD_OPEN_FIELD })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /^Go Live$/ }));

    expect((payload().beats as Beat[]) ?? []).toEqual([]);
  });

  it('writes no markers at all when nothing was drafted', () => {
    openReview();
    type(screen.getByRole('textbox', { name: /prep notes/i }), 'Scottish accent for Angus.');
    fireEvent.click(screen.getByRole('button', { name: /^Go Live$/ }));

    expect(payload().prepNotes).toBe('Scottish accent for Angus.');
    expect(payload().prepNotes).not.toContain(STRONG_START_OPEN);
  });

  it('writes no markers when the drafted cold open is edited down to nothing', async () => {
    openReview();
    fireEvent.click(draftButton());
    await waitFor(() => expect(screen.getByRole('textbox', { name: COLD_OPEN_FIELD })).toBeTruthy());

    type(screen.getByRole('textbox', { name: COLD_OPEN_FIELD }), '   ');
    type(screen.getByRole('textbox', { name: /prep notes/i }), 'Angus is Scottish.');
    fireEvent.click(screen.getByRole('button', { name: /^Go Live$/ }));

    expect(payload().prepNotes).toBe('Angus is Scottish.');
  });

  it('ships the lazy path strong start exactly as before when the draft filled it', async () => {
    openStrongStart();
    fireEvent.click(draftButton());
    await waitFor(() =>
      expect(valueOf(screen.getByRole('textbox', { name: STRONG_START_FIELD }))).toBe('DRAFTED COLD OPEN')
    );

    pressGoLive();

    expect(payload().prepNotes).toBe(
      `${STRONG_START_OPEN}\nDRAFTED COLD OPEN\n${STRONG_START_CLOSE}`
    );
  });

  it('drops a Go Live cold open when the lazy path is switched on, as the strong start is dropped when it is switched off', async () => {
    openReview();
    fireEvent.click(draftButton());
    await waitFor(() => expect(screen.getByRole('textbox', { name: COLD_OPEN_FIELD })).toBeTruthy());

    gotoStep(/^Adventure/);
    fireEvent.click(lazyToggle());
    pressGoLive();

    expect(payload().prepNotes).toBe('');
    expect(payload().prepNotes).not.toContain(STRONG_START_OPEN);
  });

  it('still creates exactly one session when Go Live is pressed twice', async () => {
    const { onComplete } = renderWizard();
    gotoStep(/^Go Live/);
    fireEvent.click(draftButton());
    await waitFor(() => expect(screen.getByRole('textbox', { name: COLD_OPEN_FIELD })).toBeTruthy());

    const button = screen.getByRole('button', { name: /^Go Live$/ });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(h.createSessionLog).toHaveBeenCalledTimes(1);
    expect(h.goLive).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
