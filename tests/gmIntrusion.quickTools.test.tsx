// @vitest-environment jsdom
/**
 * SPEC — components/views/session/QuickToolsPanel.tsx + GmIntrusionCard.tsx
 * (§4.2 of the lazy-dm-lens research report; Monte Cook / Cypher System)
 *
 * GM Intrusion sits next to the Callback Machine's "Complicate This" button
 * in Quick Tools. Same zero-prompt, one-request, in-flight-latched idiom —
 * see `tests/callbackMachine.quickTools.test.tsx` for the sibling spec this
 * one deliberately mirrors — but with the one behavioral difference that is
 * the whole point of the feature: GM Intrusion has no material precondition,
 * so it never shows an "empty" state and never refuses to run, even against
 * a campaign so bare that the Callback Machine's own sampler would return
 * nothing to spend.
 *
 * 1. **A second button, always there, nothing to type.** GM Intrusion sits
 *    alongside Complicate This and DM Coach. Pressing it is the whole
 *    interaction.
 * 2. **Pressing it asks the facade for one intrusion**, passing the panel's
 *    own mock-mode flag, a coach-variant campaign context, and a derived
 *    scene-on-stage line — never a DM-typed prompt.
 * 3. **One press is one request** — the button disables while in flight, and
 *    an impatient double-press produces exactly one call and one card.
 * 4. **The result card offers Use It and Another**, mirroring the Callback
 *    card's own actions.
 * 5. **Use It logs a `coach-used` entry, once**, and only confirms when the
 *    write actually landed.
 * 6. **A failed generation shows an alert and writes nothing.**
 * 7. **It never shows an "empty" state and never refuses to run** — the one
 *    behavioral difference from Callback — even against a campaign bare
 *    enough that Callback's own sampler would return nothing.
 * 8. Slate/amber only — no indigo anywhere in the flow.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Campaign, SessionLog, Scene, Adventure } from '../types/index';
import { ToastProvider } from '../hooks/useToast';
import { ConfirmDialogProvider } from '../hooks/useConfirmDialog';

const h = vi.hoisted(() => ({
  generateCallbackComplication: vi.fn(),
  generateGmIntrusion: vi.fn(),
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
  addSessionRunnerNote: vi.fn(),
  getState: vi.fn(() => ({ campaigns: [], activeCampaignId: null })),
  subscribe: vi.fn(() => () => {}),
}));

vi.mock('@/services/aiService', () => ({
  generateCallbackComplication: h.generateCallbackComplication,
  generateGmIntrusion: h.generateGmIntrusion,
  generateExtras: vi.fn(async () => []),
  generateNpc: vi.fn(),
  generateEnhancedText: vi.fn(),
}));

vi.mock('@/services/contextBuilder', () => ({ buildCampaignContext: h.buildCampaignContext }));

vi.mock('@/services/campaignService', () => ({
  campaignService: {
    addAutoEvent: h.addAutoEvent,
    revealSecret: h.revealSecret,
    addDiceRollToSession: h.addDiceRollToSession,
    addSessionRunnerNote: h.addSessionRunnerNote,
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

const INTRUSION = 'A side door bangs open and a stranger stumbles in, already mid-sentence.';

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

const ADVENTURE = {
  id: 'adv-1',
  title: 'Salt & Ruin',
  hook: '',
  theme: '',
  level: 1,
  scenes: [LIVE_SCENE],
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
    sessionLogs: [LIVE_SESSION],
    playerCharacters: [],
    plots: [{ id: 'plot-hollow', title: 'The Hollow Crown', description: '', status: 'active', relatedEntityIds: [] }],
    notes: [],
    secrets: [],
    activeSessionId: 's2',
    activeSceneId: 'scene-live',
    ...over,
  } as unknown as Campaign;
}

function renderPanel(over: { campaign?: Campaign; activeScene?: Scene | null; isMockMode?: boolean } = {}) {
  const campaign = over.campaign ?? makeCampaign();
  return render(
    <ToastProvider>
      <ConfirmDialogProvider>
        <QuickToolsPanel
          campaign={campaign}
          sessionLog={LIVE_SESSION}
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

const intrusionButton = () => screen.getByRole('button', { name: /gm intrusion/i });
const complicateButton = () => screen.getByRole('button', { name: /complicate this/i });
const useItButton = () => screen.getByRole('button', { name: /use it/i });
const anotherButton = () => screen.getByRole('button', { name: /another/i });

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
  h.generateGmIntrusion.mockResolvedValue(INTRUSION);
  h.generateCallbackComplication.mockResolvedValue('A callback complication.');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// --- 1. a second button, zero prompt ---------------------------------------

describe('a second button next to Complicate This, nothing to type', () => {
  it('sits alongside Complicate This and DM Coach', () => {
    renderPanel();
    expect(intrusionButton()).toBeTruthy();
    expect(complicateButton()).toBeTruthy();
    expect(screen.getByRole('button', { name: /dm coach/i })).toBeTruthy();
  });

  it('never asks the DM to write anything, before or after generating', async () => {
    renderPanel();
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(intrusionButton());
    await screen.findByText(INTRUSION);
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

// --- 2. what the press does --------------------------------------------------

describe('pressing it asks the facade for one intrusion', () => {
  it('passes the mock-mode flag first, a coach-variant context, and a derived scene line', async () => {
    renderPanel();
    fireEvent.click(intrusionButton());
    await screen.findByText(INTRUSION);

    expect(h.generateGmIntrusion).toHaveBeenCalledTimes(1);
    const [isMockMode, campaignContext, sceneSummary] = h.generateGmIntrusion.mock.calls[0];
    expect(isMockMode).toBe(true);
    expect(campaignContext).toBe('COACH-CONTEXT');
    expect(sceneSummary).toContain('The Ashen Gate Tollhouse');

    const options = h.buildCampaignContext.mock.calls[0][0] as Record<string, unknown>;
    expect(options.variant).toBe('coach');
  });

  it('still works with no scene on stage', async () => {
    renderPanel({ activeScene: null });
    fireEvent.click(intrusionButton());
    await screen.findByText(INTRUSION);
    expect(h.generateGmIntrusion).toHaveBeenCalledTimes(1);
  });
});

// --- 3. one press, one request -----------------------------------------------

describe('one press is one request', () => {
  it('disables the button while in flight and ignores a second press', async () => {
    const gate = deferred<string>();
    h.generateGmIntrusion.mockReturnValue(gate.promise);
    renderPanel();

    fireEvent.click(intrusionButton());
    await waitFor(() => expect((intrusionButton() as HTMLButtonElement).disabled).toBe(true));

    fireEvent.click(intrusionButton());
    expect(h.generateGmIntrusion).toHaveBeenCalledTimes(1);

    gate.resolve(INTRUSION);
    await screen.findByText(INTRUSION);
    expect((intrusionButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it('renders one card, not two, after an impatient double press', async () => {
    renderPanel();
    fireEvent.click(intrusionButton());
    fireEvent.click(intrusionButton());
    await screen.findByText(INTRUSION);
    expect(screen.getAllByText(INTRUSION)).toHaveLength(1);
    expect(h.generateGmIntrusion).toHaveBeenCalledTimes(1);
  });
});

// --- 4. Use It and Another ----------------------------------------------------

describe('the result card offers Use It and Another', () => {
  it('logs a coach-used entry naming the intrusion, once', async () => {
    renderPanel();
    fireEvent.click(intrusionButton());
    await screen.findByText(INTRUSION);

    fireEvent.click(useItButton());
    await waitFor(() => expect(h.addAutoEvent).toHaveBeenCalledTimes(1));
    expect(h.addAutoEvent.mock.calls[0][0]).toBe('coach-used');
    expect(String(h.addAutoEvent.mock.calls[0][1])).toContain(INTRUSION);
    expect(await screen.findByText(/logged/i)).toBeTruthy();

    fireEvent.click(useItButton());
    expect(h.addAutoEvent).toHaveBeenCalledTimes(1);
  });

  it('says nothing about logging when no session was live to take it', async () => {
    h.addAutoEvent.mockReturnValue(false);
    renderPanel();
    fireEvent.click(intrusionButton());
    await screen.findByText(INTRUSION);
    fireEvent.click(useItButton());
    await waitFor(() => expect(h.addAutoEvent).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/logged/i)).toBeNull();
  });

  it('Another resamples and shows a fresh intrusion', async () => {
    renderPanel();
    fireEvent.click(intrusionButton());
    await screen.findByText(INTRUSION);

    h.generateGmIntrusion.mockResolvedValue('A second, entirely different twist.');
    fireEvent.click(anotherButton());

    await screen.findByText('A second, entirely different twist.');
    expect(h.generateGmIntrusion).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(INTRUSION)).toBeNull();
  });
});

// --- 5. failure ----------------------------------------------------------------

describe('a failed generation says so and changes nothing', () => {
  it('shows an alert and writes nothing to the store', async () => {
    h.generateGmIntrusion.mockRejectedValue(new Error('504 gateway timeout'));
    renderPanel();

    fireEvent.click(intrusionButton());
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(h.addAutoEvent).not.toHaveBeenCalled();
  });

  it('leaves the button usable for a second try', async () => {
    h.generateGmIntrusion.mockRejectedValueOnce(new Error('504 gateway timeout'));
    renderPanel();

    fireEvent.click(intrusionButton());
    await screen.findByRole('alert');
    await waitFor(() => expect((intrusionButton() as HTMLButtonElement).disabled).toBe(false));

    h.generateGmIntrusion.mockResolvedValue(INTRUSION);
    fireEvent.click(intrusionButton());
    await screen.findByText(INTRUSION);
  });
});

// --- 6 & 7. zero-precondition — the one difference from Callback --------------

describe('never an "empty" state — the one behavioral difference from Callback', () => {
  const bare = () =>
    makeCampaign({
      npcs: [],
      plots: [],
      secrets: [],
      adventures: [],
      sessionLogs: [LIVE_SESSION],
      activeSceneId: undefined,
    });

  it('still generates and completes against a campaign with nothing dormant to spend', async () => {
    renderPanel({ campaign: bare(), activeScene: null });
    fireEvent.click(intrusionButton());
    await screen.findByText(INTRUSION);
    expect(h.generateGmIntrusion).toHaveBeenCalledTimes(1);
  });

  it('never shows Callback-style empty-state copy for GM Intrusion', async () => {
    renderPanel({ campaign: bare(), activeScene: null });
    fireEvent.click(intrusionButton());
    await screen.findByText(INTRUSION);
    expect(screen.queryByText(/nothing dormant/i)).toBeNull();
  });

  it('the same bare campaign would leave Callback with nothing to spend, unlike GM Intrusion', async () => {
    renderPanel({ campaign: bare(), activeScene: null });
    fireEvent.click(complicateButton());
    const message = await screen.findByRole('status');
    expect(message.textContent).toMatch(/nothing dormant/i);
    expect(h.generateCallbackComplication).not.toHaveBeenCalled();
  });
});

// --- 8. on-theme -----------------------------------------------------------------

describe('slate and amber only', () => {
  it('uses no indigo anywhere in the flow', async () => {
    const { container } = renderPanel();
    fireEvent.click(intrusionButton());
    await screen.findByText(INTRUSION);
    fireEvent.click(useItButton());
    await waitFor(() => expect(h.addAutoEvent).toHaveBeenCalledTimes(1));
    expect(container.innerHTML).not.toMatch(/indigo/);
  });
});
