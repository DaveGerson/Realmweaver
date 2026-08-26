// @vitest-environment jsdom
/**
 * SPEC — components/views/session/QuickToolsPanel.tsx (Wave 1, lane P2)
 *
 * The Callback Machine is a button, not a form. `docs/design/lazy-dm-lens.md`
 * §5 rules out "any AI surface that requires a crafted prompt as the entry
 * point", and §3 ranks this feature first for the lazy DM precisely because it
 * spends prep the table already paid for. So the entry point in Quick Tools is
 * one press with nothing to type.
 *
 * The contract, in plain sentences:
 *
 * 1. **One button, always there.** Quick Tools carries a "Complicate This"
 *    control alongside DM Coach, Dice Roller and Quick NPC. It is a `Button`,
 *    it is not hidden behind a DM-style gate, and pressing it is the entire
 *    interaction — no textarea, no chips, no prompt appears at any point in
 *    the flow.
 *
 * 2. **Pressing it spends dormant material.** The panel samples the campaign's
 *    own idle inventory for the live scene and asks the AI facade — never
 *    `services/ai/*` — for one complication, handing over the sampled pieces,
 *    a derived line about the scene on stage, a coach-variant campaign
 *    context, and the panel's own mock-mode flag.
 *
 * 3. **One press is one request.** While a complication is in flight the
 *    button is disabled, so an impatient double-press cannot stack two
 *    generations or two cards.
 *
 * 4. **The result is a card that shows its working.** The complication text
 *    renders, and so does every piece it was built from — the DM should be
 *    able to see which of their own material just got spent.
 *
 * 5. **"Use It" logs it, once.** The card's first action writes the
 *    complication to the running log through the existing auto-event
 *    mechanism as a `coach-used` entry. Pressing it a second time does not
 *    write a second entry. The confirmation only appears when the write
 *    actually landed: `addAutoEvent` reports false when no session is live,
 *    and in that case the DM is not told it was logged and can try again.
 *
 * 6. **A spent secret can be flipped in one tap.** When — and only when — the
 *    sample included a secret, using the complication offers a mark-revealed
 *    control for that secret. One tap reveals it against the live session; a
 *    second tap does nothing, because it is already revealed. A sample with no
 *    secret in it never shows the control.
 *
 * 7. **"Another" resamples.** The second action clears the card and runs the
 *    whole thing again — a fresh sample, a fresh generation — and is itself
 *    press-once-while-in-flight.
 *
 * 8. **Nothing dormant is an invitation, not an error.** A campaign with
 *    nothing to spend says so in a sentence that points at writing the next
 *    thing, and no AI call is made at all.
 *
 * 9. **A failed generation says so and changes nothing.** The panel shows an
 *    alert, writes nothing to the store, and leaves the button usable.
 *
 * 10. **It is GM-private.** The only store writes this flow can make are the
 *     `coach-used` running-log entry and the secret reveal. Nothing here
 *     touches a recap, least of all the player-facing one.
 *
 * 11. Slate/amber only — indigo belongs to RealmChat.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Campaign, SessionLog, Scene, Adventure } from '../types/index';
import { ToastProvider } from '../hooks/useToast';
import { ConfirmDialogProvider } from '../hooks/useConfirmDialog';

const h = vi.hoisted(() => ({
  generateCallbackComplication: vi.fn(),
  buildCampaignContext: vi.fn((_options: Record<string, unknown>) => 'COACH-CONTEXT'),
  addAutoEvent: vi.fn((_type: string, _content: string) => true),
  revealSecret: vi.fn(),
  addDiceRollToSession: vi.fn(),
  createNpc: vi.fn(),
  updateNpc: vi.fn(),
  updateScene: vi.fn(),
  createSecret: vi.fn(),
  updateSecret: vi.fn(),
  deleteSecret: vi.fn(),
  updateSessionLog: vi.fn(),
  getState: vi.fn(() => ({ campaigns: [], activeCampaignId: null })),
  subscribe: vi.fn(() => () => {}),
}));

vi.mock('@/services/aiService', () => ({
  generateCallbackComplication: h.generateCallbackComplication,
  generateNpc: vi.fn(),
  generateEnhancedText: vi.fn(),
}));

vi.mock('@/services/contextBuilder', () => ({ buildCampaignContext: h.buildCampaignContext }));

vi.mock('@/services/campaignService', () => ({
  campaignService: {
    addAutoEvent: h.addAutoEvent,
    revealSecret: h.revealSecret,
    addDiceRollToSession: h.addDiceRollToSession,
    createNpc: h.createNpc,
    updateNpc: h.updateNpc,
    updateScene: h.updateScene,
    createSecret: h.createSecret,
    updateSecret: h.updateSecret,
    deleteSecret: h.deleteSecret,
    updateSessionLog: h.updateSessionLog,
    getState: h.getState,
    subscribe: h.subscribe,
  },
}));

const { QuickToolsPanel } = await import('../components/views/session/QuickToolsPanel');

// --- fixtures -------------------------------------------------------------

const COMPLICATION = 'The toll clerk looks up and it is Serah Vane, in a borrowed coat.';

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

function scene(over: Record<string, unknown>): Scene {
  return {
    type: 'social',
    status: 'planned',
    readAloudText: '',
    gmNotes: '',
    skillChecks: [],
    rewards: '',
    npcIds: [],
    ...over,
  } as unknown as Scene;
}

const LIVE_SCENE = scene({
  id: 'scene-live',
  title: 'The Ashen Gate Tollhouse',
  status: 'in-progress',
  npcIds: ['npc-here'],
  locationId: 'loc-hall',
});

const COLD_SCENE = scene({ id: 'scene-cold', title: 'The Cold Cellar' });

const ADVENTURE = {
  id: 'adv-1',
  title: 'Salt & Ruin',
  hook: '',
  theme: '',
  level: 1,
  scenes: [LIVE_SCENE, COLD_SCENE],
} as unknown as Adventure;

const LIVE_SESSION = session({ id: 's2', sessionDate: '2026-02-01', status: 'active', plannedSceneIds: ['scene-live'] });

function makeCampaign(over: Record<string, unknown> = {}): Campaign {
  return {
    id: 'camp-1',
    title: 'Ashfall',
    setting: 'A dying empire',
    settingType: 'custom',
    npcs: [
      { id: 'npc-serah', name: 'Serah Vane' },
      { id: 'npc-here', name: 'Doryn' },
    ],
    locations: [{ id: 'loc-hall', name: 'The Salt Hall' }],
    factions: [],
    items: [],
    adventures: [ADVENTURE],
    articles: [],
    sessionLogs: [
      session({
        id: 's1',
        sessionDate: '2026-01-01',
        structuredNotes: [{ id: 'n1', timestamp: '2026-01-01T20:00:00.000Z', content: 'Serah bargained.', taggedEntityIds: ['npc-serah'] }],
      }),
      LIVE_SESSION,
    ],
    playerCharacters: [],
    plots: [{ id: 'plot-hollow', title: 'The Hollow Crown', description: '', status: 'active', relatedEntityIds: [] }],
    notes: [],
    secrets: [
      {
        id: 'sec-key',
        title: 'The Ashen Key',
        content: 'The clerk keeps it.',
        category: 'secret',
        isRevealed: false,
        createdAt: '2026-01-01',
        linkedEntityIds: ['npc-here'],
      },
    ],
    activeSessionId: 's2',
    activeSceneId: 'scene-live',
    ...over,
  } as unknown as Campaign;
}

function renderPanel(over: { campaign?: Campaign; sessionLog?: SessionLog; activeScene?: Scene | null; isMockMode?: boolean } = {}) {
  const campaign = over.campaign ?? makeCampaign();
  return render(
    <ToastProvider>
      <ConfirmDialogProvider>
        <QuickToolsPanel
          campaign={campaign}
          sessionLog={over.sessionLog ?? LIVE_SESSION}
          activeScene={over.activeScene === undefined ? LIVE_SCENE : over.activeScene}
          adventure={ADVENTURE}
          activeSceneNpcs={[{ id: 'npc-here', name: 'Doryn' }]}
          plotSessionStatus={{}}
          isMockMode={over.isMockMode ?? true}
          mobileTab="tools"
          canShowCombatTracker
          canShowSecretsTracker
          onOpenCoach={() => {}}
          onOpenCombat={() => {}}
          onCyclePlotStatus={() => {}}
        />
      </ConfirmDialogProvider>
    </ToastProvider>
  );
}

const complicateButton = () => screen.getByRole('button', { name: /complicate this/i });
const useItButton = () => screen.getByRole('button', { name: /use it/i });
const anotherButton = () => screen.getByRole('button', { name: /another/i });

/** A promise the test resolves by hand, for pinning the in-flight state. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.buildCampaignContext.mockReturnValue('COACH-CONTEXT');
  h.addAutoEvent.mockReturnValue(true);
  h.generateCallbackComplication.mockResolvedValue(COMPLICATION);
  vi.spyOn(Math, 'random').mockReturnValue(0);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// --- 1. one button, zero prompt -------------------------------------------

describe('one button, nothing to type', () => {
  it('sits in Quick Tools next to the other tools', () => {
    renderPanel();
    expect(complicateButton()).toBeTruthy();
    expect(screen.getByRole('button', { name: /dm coach/i })).toBeTruthy();
  });

  it('is a Button, not a bare element', () => {
    renderPanel();
    expect(complicateButton().className).toContain('inline-flex');
    expect(complicateButton().className).toContain('items-center');
  });

  it('is not hidden behind the tool gates the other panels use', () => {
    renderPanel();
    cleanup();
    render(
      <ToastProvider>
        <ConfirmDialogProvider>
          <QuickToolsPanel
            campaign={makeCampaign()}
            sessionLog={LIVE_SESSION}
            activeScene={LIVE_SCENE}
            adventure={ADVENTURE}
            activeSceneNpcs={[]}
            plotSessionStatus={{}}
            isMockMode
            mobileTab="tools"
            canShowCombatTracker={false}
            canShowSecretsTracker={false}
            onOpenCoach={() => {}}
            onOpenCombat={() => {}}
            onCyclePlotStatus={() => {}}
          />
        </ConfirmDialogProvider>
      </ToastProvider>
    );
    expect(complicateButton()).toBeTruthy();
  });

  it('never asks the DM to write anything, before or after generating', async () => {
    renderPanel();
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(complicateButton());
    await screen.findByText(COMPLICATION);
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

// --- 2. what the press does ------------------------------------------------

describe('pressing it spends dormant material', () => {
  it('asks the facade for one complication built from the sampled pieces', async () => {
    renderPanel();
    fireEvent.click(complicateButton());
    await screen.findByText(COMPLICATION);

    expect(h.generateCallbackComplication).toHaveBeenCalledTimes(1);
    const request = h.generateCallbackComplication.mock.calls[0][0] as {
      material: { kind: string; id: string; label: string; reason: string }[];
      sceneSummary?: string;
      campaignContext?: string;
    };
    expect(request.material.map(p => p.kind)).toEqual(['npc', 'secret', 'plot']);
    expect(request.material.map(p => p.id)).toEqual(['npc-serah', 'sec-key', 'plot-hollow']);
    expect(request.campaignContext).toBe('COACH-CONTEXT');
  });

  it('describes the scene on stage without asking the DM for it', async () => {
    renderPanel();
    fireEvent.click(complicateButton());
    await screen.findByText(COMPLICATION);

    const request = h.generateCallbackComplication.mock.calls[0][0] as { sceneSummary?: string };
    expect(request.sceneSummary).toBeTruthy();
    expect(request.sceneSummary).toContain('The Ashen Gate Tollhouse');
  });

  it('builds the campaign context with the coach variant, aimed at the live scene', async () => {
    renderPanel();
    fireEvent.click(complicateButton());
    await screen.findByText(COMPLICATION);

    expect(h.buildCampaignContext).toHaveBeenCalled();
    const options = h.buildCampaignContext.mock.calls[0][0] as Record<string, unknown>;
    expect(options.variant).toBe('coach');
    expect(options.activeSceneId).toBe('scene-live');
    expect(options.activeSessionId).toBe('s2');
  });

  it('passes the panel own mock-mode flag through the facade', async () => {
    renderPanel({ isMockMode: true });
    fireEvent.click(complicateButton());
    await screen.findByText(COMPLICATION);
    expect(h.generateCallbackComplication.mock.calls[0][1]).toBe(true);
  });

  it('still works with no scene on stage', async () => {
    renderPanel({ activeScene: null });
    fireEvent.click(complicateButton());
    await screen.findByText(COMPLICATION);
    expect(h.generateCallbackComplication).toHaveBeenCalledTimes(1);
  });
});

// --- 3. one press, one request --------------------------------------------

describe('one press is one request', () => {
  it('disables the button while a complication is in flight', async () => {
    const gate = deferred<string>();
    h.generateCallbackComplication.mockReturnValue(gate.promise);
    renderPanel();

    fireEvent.click(complicateButton());
    await waitFor(() => expect((complicateButton() as HTMLButtonElement).disabled).toBe(true));

    fireEvent.click(complicateButton());
    expect(h.generateCallbackComplication).toHaveBeenCalledTimes(1);

    gate.resolve(COMPLICATION);
    await screen.findByText(COMPLICATION);
    expect((complicateButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it('renders one card, not two, after an impatient double press', async () => {
    renderPanel();
    fireEvent.click(complicateButton());
    fireEvent.click(complicateButton());
    await screen.findByText(COMPLICATION);
    expect(screen.getAllByText(COMPLICATION)).toHaveLength(1);
    expect(h.generateCallbackComplication).toHaveBeenCalledTimes(1);
  });
});

// --- 4. the card ----------------------------------------------------------

describe('the card shows its working', () => {
  it('renders the complication and every piece it was built from', async () => {
    renderPanel();
    fireEvent.click(complicateButton());
    await screen.findByText(COMPLICATION);

    expect(screen.getByText(/Serah Vane/)).toBeTruthy();
    expect(screen.getByText(/The Ashen Key/)).toBeTruthy();
    expect(screen.getByText(/The Hollow Crown/)).toBeTruthy();
  });

  it('offers exactly two actions on the card', async () => {
    renderPanel();
    fireEvent.click(complicateButton());
    await screen.findByText(COMPLICATION);
    expect(useItButton()).toBeTruthy();
    expect(anotherButton()).toBeTruthy();
  });
});

// --- 5. Use It ------------------------------------------------------------

describe('Use It logs the complication, once', () => {
  it('writes a coach-used entry carrying the complication text', async () => {
    renderPanel();
    fireEvent.click(complicateButton());
    await screen.findByText(COMPLICATION);

    fireEvent.click(useItButton());
    await waitFor(() => expect(h.addAutoEvent).toHaveBeenCalledTimes(1));
    expect(h.addAutoEvent.mock.calls[0][0]).toBe('coach-used');
    expect(String(h.addAutoEvent.mock.calls[0][1])).toContain(COMPLICATION);
  });

  it('does not log a second entry when pressed twice', async () => {
    renderPanel();
    fireEvent.click(complicateButton());
    await screen.findByText(COMPLICATION);

    fireEvent.click(useItButton());
    await waitFor(() => expect(h.addAutoEvent).toHaveBeenCalledTimes(1));
    fireEvent.click(useItButton());
    expect(h.addAutoEvent).toHaveBeenCalledTimes(1);
  });

  it('confirms only when the entry actually landed', async () => {
    renderPanel();
    fireEvent.click(complicateButton());
    await screen.findByText(COMPLICATION);
    fireEvent.click(useItButton());
    expect(await screen.findByText(/logged/i)).toBeTruthy();
  });

  it('says nothing about logging when no session was live to take it', async () => {
    h.addAutoEvent.mockReturnValue(false);
    renderPanel();
    fireEvent.click(complicateButton());
    await screen.findByText(COMPLICATION);

    fireEvent.click(useItButton());
    await waitFor(() => expect(h.addAutoEvent).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/logged/i)).toBeNull();
    expect((useItButton() as HTMLButtonElement).disabled).toBe(false);
  });
});

// --- 6. the secret flip ---------------------------------------------------

describe('a spent secret can be flipped in one tap', () => {
  it('offers the flip after the complication is used', async () => {
    renderPanel();
    fireEvent.click(complicateButton());
    await screen.findByText(COMPLICATION);
    expect(screen.queryByRole('button', { name: /reveal/i })).toBeNull();

    fireEvent.click(useItButton());
    expect(await screen.findByRole('button', { name: /reveal/i })).toBeTruthy();
  });

  it('reveals the sampled secret against the live session', async () => {
    renderPanel();
    fireEvent.click(complicateButton());
    await screen.findByText(COMPLICATION);
    fireEvent.click(useItButton());

    const flip = await screen.findByRole('button', { name: /reveal/i });
    fireEvent.click(flip);
    await waitFor(() => expect(h.revealSecret).toHaveBeenCalledTimes(1));
    expect(h.revealSecret).toHaveBeenCalledWith('sec-key', 's2');
  });

  it('does not reveal twice', async () => {
    renderPanel();
    fireEvent.click(complicateButton());
    await screen.findByText(COMPLICATION);
    fireEvent.click(useItButton());

    const flip = await screen.findByRole('button', { name: /reveal/i });
    fireEvent.click(flip);
    await waitFor(() => expect(h.revealSecret).toHaveBeenCalledTimes(1));
    fireEvent.click(flip);
    expect(h.revealSecret).toHaveBeenCalledTimes(1);
  });

  it('never offers the flip when the sample held no secret', async () => {
    const noSecrets = makeCampaign({ secrets: [] });
    renderPanel({ campaign: noSecrets });
    fireEvent.click(complicateButton());
    await screen.findByText(COMPLICATION);

    const request = h.generateCallbackComplication.mock.calls[0][0] as { material: { kind: string }[] };
    expect(request.material.some(p => p.kind === 'secret')).toBe(false);

    fireEvent.click(useItButton());
    await waitFor(() => expect(h.addAutoEvent).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: /reveal/i })).toBeNull();
  });
});

// --- 7. Another -----------------------------------------------------------

describe('Another resamples and regenerates', () => {
  it('runs the whole thing again and shows the new complication', async () => {
    renderPanel();
    fireEvent.click(complicateButton());
    await screen.findByText(COMPLICATION);

    h.generateCallbackComplication.mockResolvedValue('A second, entirely different problem.');
    fireEvent.click(anotherButton());

    await screen.findByText('A second, entirely different problem.');
    expect(h.generateCallbackComplication).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(COMPLICATION)).toBeNull();
  });

  it('is press-once while the resample is in flight', async () => {
    renderPanel();
    fireEvent.click(complicateButton());
    await screen.findByText(COMPLICATION);

    const gate = deferred<string>();
    h.generateCallbackComplication.mockReturnValue(gate.promise);
    fireEvent.click(anotherButton());
    await waitFor(() => expect(h.generateCallbackComplication).toHaveBeenCalledTimes(2));

    fireEvent.click(complicateButton());
    expect(h.generateCallbackComplication).toHaveBeenCalledTimes(2);

    gate.resolve('Take three.');
    await screen.findByText('Take three.');
  });

  it('starts the log-and-reveal actions over for the new complication', async () => {
    renderPanel();
    fireEvent.click(complicateButton());
    await screen.findByText(COMPLICATION);
    fireEvent.click(useItButton());
    await waitFor(() => expect(h.addAutoEvent).toHaveBeenCalledTimes(1));

    h.generateCallbackComplication.mockResolvedValue('A second, entirely different problem.');
    fireEvent.click(anotherButton());
    await screen.findByText('A second, entirely different problem.');

    expect(screen.queryByText(/logged/i)).toBeNull();
    fireEvent.click(useItButton());
    await waitFor(() => expect(h.addAutoEvent).toHaveBeenCalledTimes(2));
  });
});

// --- 8. nothing dormant ---------------------------------------------------

describe('nothing dormant is an invitation, not an error', () => {
  const bare = () =>
    makeCampaign({
      npcs: [],
      plots: [],
      secrets: [],
      adventures: [],
      sessionLogs: [LIVE_SESSION],
      activeSceneId: undefined,
    });

  it('makes no AI call when there is nothing to spend', async () => {
    renderPanel({ campaign: bare(), activeScene: null });
    fireEvent.click(complicateButton());
    await waitFor(() => expect(screen.queryByRole('button', { name: /use it/i })).toBeNull());
    expect(h.generateCallbackComplication).not.toHaveBeenCalled();
  });

  it('says so, and points at writing the next thing', async () => {
    renderPanel({ campaign: bare(), activeScene: null });
    fireEvent.click(complicateButton());
    const message = await screen.findByRole('status');
    expect(message.textContent && message.textContent.length).toBeTruthy();
  });
});

// --- 9. failure -----------------------------------------------------------

describe('a failed generation says so and changes nothing', () => {
  it('shows an alert and writes nothing to the store', async () => {
    h.generateCallbackComplication.mockRejectedValue(new Error('504 gateway timeout'));
    renderPanel();

    fireEvent.click(complicateButton());
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(h.addAutoEvent).not.toHaveBeenCalled();
    expect(h.revealSecret).not.toHaveBeenCalled();
  });

  it('leaves the button usable for a second try', async () => {
    h.generateCallbackComplication.mockRejectedValueOnce(new Error('504 gateway timeout'));
    renderPanel();

    fireEvent.click(complicateButton());
    await screen.findByRole('alert');
    await waitFor(() => expect((complicateButton() as HTMLButtonElement).disabled).toBe(false));

    h.generateCallbackComplication.mockResolvedValue(COMPLICATION);
    fireEvent.click(complicateButton());
    await screen.findByText(COMPLICATION);
  });
});

// --- 10 & 11. GM-private, and on-theme ------------------------------------

describe('GM-private, slate and amber', () => {
  it('never writes anything but the running-log entry and the reveal', async () => {
    renderPanel();
    fireEvent.click(complicateButton());
    await screen.findByText(COMPLICATION);
    fireEvent.click(useItButton());
    await waitFor(() => expect(h.addAutoEvent).toHaveBeenCalledTimes(1));
    const flip = await screen.findByRole('button', { name: /reveal/i });
    fireEvent.click(flip);
    await waitFor(() => expect(h.revealSecret).toHaveBeenCalledTimes(1));

    expect(h.updateSessionLog).not.toHaveBeenCalled();
    expect(h.updateNpc).not.toHaveBeenCalled();
    expect(h.updateScene).not.toHaveBeenCalled();
  });

  it('uses no indigo anywhere in the flow', async () => {
    const { container } = renderPanel();
    fireEvent.click(complicateButton());
    await screen.findByText(COMPLICATION);
    fireEvent.click(useItButton());
    await screen.findByRole('button', { name: /reveal/i });
    expect(container.innerHTML).not.toMatch(/indigo/);
  });
});
