// @vitest-environment jsdom
/**
 * SPEC — components/views/session/DormantShelf.tsx (§4.7 of the lazy-dm-lens
 * research report; Monte Cook: "prep what excites you, discard freely" —
 * unused prep is inventory, not a failure)
 *
 * The Callback Machine's own sampler (`QuickToolsPanel.tsx`'s "Complicate
 * This") is random. Browse the Shelf is the same inventory
 * (`utils/dormantMaterial.ts`'s `collectDormantCandidates`, read-only here),
 * made choosable.
 *
 * 1. **Collapsed by default**, so it costs nothing to a DM who never opens
 *    it — no bucket, no "Spend this" button, no result card in the DOM.
 * 2. **Expanding it lists every non-empty bucket** the campaign actually has
 *    dormant material in, grouped and labelled.
 * 3. **"Spend this" calls the exact same `generateCallbackComplication`
 *    facade** the Callback Machine uses, with a material array containing
 *    exactly the one clicked piece — bypassing the random sampler entirely.
 * 4. **One press is one request** — the clicked button shows a spinner while
 *    in flight, and a second click on any "Spend this" button in that window
 *    is a no-op.
 * 5. **The result card offers Use It**, which logs a `coach-used` entry once
 *    and only confirms when the write actually landed.
 * 6. **A failed generation shows an alert and writes nothing.**
 * 7. **An empty shelf says so, once expanded**, rather than showing nothing
 *    or erroring.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { Campaign, Scene } from '../types/index';

const h = vi.hoisted(() => ({
  generateCallbackComplication: vi.fn(),
  buildCampaignContext: vi.fn((_options: Record<string, unknown>) => 'COACH-CONTEXT'),
  addAutoEvent: vi.fn((_type: string, _content: string) => true),
}));

vi.mock('@/services/aiService', () => ({
  generateCallbackComplication: h.generateCallbackComplication,
}));

vi.mock('@/services/contextBuilder', () => ({ buildCampaignContext: h.buildCampaignContext }));

vi.mock('@/services/campaignService', () => ({
  campaignService: {
    addAutoEvent: h.addAutoEvent,
  },
}));

const { DormantShelf } = await import('../components/views/session/DormantShelf');

// --- fixtures ---------------------------------------------------------------
// Mirrors tests/callbackMachine.quickTools.test.tsx's fixture: one dormant
// entry in every bucket (offstage npc, unrevealed linked secret, stalled
// plot, unused planned scene) so every group can be exercised.

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
};

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
      {
        id: 's1',
        title: 'Session s1',
        status: 'completed',
        sessionDate: '2026-01-01',
        plannedSceneIds: [],
        prepNotes: '',
        relatedPlotIds: [],
        runningNotes: '',
        structuredNotes: [{ id: 'n1', timestamp: '2026-01-01T20:00:00.000Z', content: 'Serah bargained.', taggedEntityIds: ['npc-serah'] }],
        encounterLog: [],
        recap: '',
        notableEvents: '',
        looseEnds: '',
      },
      {
        id: 's2',
        title: 'Session s2',
        status: 'active',
        sessionDate: '2026-02-01',
        plannedSceneIds: ['scene-live'],
        prepNotes: '',
        relatedPlotIds: [],
        runningNotes: '',
        structuredNotes: [],
        encounterLog: [],
        recap: '',
        notableEvents: '',
        looseEnds: '',
      },
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

function renderShelf(over: { campaign?: Campaign; activeScene?: Scene | null; isMockMode?: boolean } = {}) {
  const campaign = over.campaign ?? makeCampaign();
  return render(
    <DormantShelf
      campaign={campaign}
      activeScene={over.activeScene === undefined ? LIVE_SCENE : over.activeScene}
      activeSceneNpcs={[{ id: 'npc-here', name: 'Doryn' }]}
      isMockMode={over.isMockMode ?? true}
    />
  );
}

const toggle = () => screen.getByRole('button', { name: /browse dormant material/i });
const spendButtons = () => screen.getAllByRole('button', { name: /spend this/i });

const COMPLICATION = 'The toll clerk looks up and it is Serah Vane, in a borrowed coat.';

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
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// --- 1. collapsed by default -------------------------------------------------

describe('collapsed by default', () => {
  it('shows the toggle but nothing else until expanded', () => {
    renderShelf();
    expect(toggle()).toBeTruthy();
    expect(screen.queryByRole('button', { name: /spend this/i })).toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });
});

// --- 1b. each Spend this names its piece -------------------------------------

describe('each Spend this names its piece', () => {
  it('no two Spend buttons share an accessible name, and each carries the piece label', () => {
    renderShelf();
    fireEvent.click(toggle());
    const names = spendButtons().map(b => b.getAttribute('aria-label'));
    expect(names.length).toBeGreaterThan(1);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^Spend this: .+/);
  });
});

// --- 2. expanding lists every bucket -----------------------------------------

describe('expanding lists every non-empty bucket', () => {
  it('shows offstage cast, unrevealed secrets, stalled threads, and unused scenes', () => {
    renderShelf();
    fireEvent.click(toggle());

    expect(screen.getByText('Offstage cast')).toBeTruthy();
    expect(screen.getByText('Unrevealed secrets')).toBeTruthy();
    expect(screen.getByText('Stalled threads')).toBeTruthy();
    expect(screen.getByText('Unused scenes')).toBeTruthy();

    expect(screen.getByText('Serah Vane')).toBeTruthy();
    expect(screen.getByText('The Ashen Key')).toBeTruthy();
    expect(screen.getByText('The Hollow Crown')).toBeTruthy();
    expect(screen.getByText('The Cold Cellar')).toBeTruthy();

    expect(spendButtons().length).toBe(4);
  });

  it('collapses again on a second toggle click', () => {
    renderShelf();
    fireEvent.click(toggle());
    expect(screen.getByText('Serah Vane')).toBeTruthy();
    fireEvent.click(toggle());
    expect(screen.queryByText('Serah Vane')).toBeNull();
  });
});

// --- 3. Spend this calls the exact facade with exactly one piece -------------

describe('Spend this reuses the Callback facade, bypassing the sampler', () => {
  it('calls generateCallbackComplication with a material array of exactly the clicked piece', async () => {
    renderShelf();
    fireEvent.click(toggle());

    const npcRow = screen.getByText('Serah Vane').closest('li') as HTMLElement;
    fireEvent.click(within(npcRow).getByRole('button', { name: /spend this/i }));

    await screen.findByText(COMPLICATION);
    expect(h.generateCallbackComplication).toHaveBeenCalledTimes(1);
    const [request, isMockMode] = h.generateCallbackComplication.mock.calls[0];
    expect(request.material).toHaveLength(1);
    expect(request.material[0]).toMatchObject({ kind: 'npc', id: 'npc-serah', label: 'Serah Vane' });
    expect(isMockMode).toBe(true);
  });

  it('spends the plot bucket just as well as the npc bucket', async () => {
    renderShelf();
    fireEvent.click(toggle());

    const plotRow = screen.getByText('The Hollow Crown').closest('li') as HTMLElement;
    fireEvent.click(within(plotRow).getByRole('button', { name: /spend this/i }));

    await screen.findByText(COMPLICATION);
    const [request] = h.generateCallbackComplication.mock.calls[0];
    expect(request.material).toEqual([expect.objectContaining({ kind: 'plot', id: 'plot-hollow' })]);
  });

  it('builds the campaign context with the coach variant', async () => {
    renderShelf();
    fireEvent.click(toggle());
    fireEvent.click(spendButtons()[0]);
    await screen.findByText(COMPLICATION);

    const options = h.buildCampaignContext.mock.calls[0][0] as Record<string, unknown>;
    expect(options.variant).toBe('coach');
  });
});

// --- 4. one press, one request ------------------------------------------------

describe('one press is one request', () => {
  it('ignores a second Spend-this click while one is in flight', async () => {
    const gate = deferred<string>();
    h.generateCallbackComplication.mockReturnValue(gate.promise);
    renderShelf();
    fireEvent.click(toggle());

    const buttons = spendButtons();
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    expect(h.generateCallbackComplication).toHaveBeenCalledTimes(1);

    gate.resolve(COMPLICATION);
    await screen.findByText(COMPLICATION);
  });
});

// --- 5. Use It -----------------------------------------------------------------

describe('Use It logs the complication, once', () => {
  it('writes a coach-used entry and confirms only once it lands', async () => {
    renderShelf();
    fireEvent.click(toggle());
    fireEvent.click(spendButtons()[0]);
    await screen.findByText(COMPLICATION);

    fireEvent.click(screen.getByRole('button', { name: /use it/i }));
    await waitFor(() => expect(h.addAutoEvent).toHaveBeenCalledTimes(1));
    expect(h.addAutoEvent.mock.calls[0][0]).toBe('coach-used');
    expect(String(h.addAutoEvent.mock.calls[0][1])).toContain(COMPLICATION);
    expect(await screen.findByText(/logged/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /use it/i }));
    expect(h.addAutoEvent).toHaveBeenCalledTimes(1);
  });
});

// --- 6. failure ------------------------------------------------------------------

describe('a failed generation says so and writes nothing', () => {
  it('shows an alert and never calls addAutoEvent', async () => {
    h.generateCallbackComplication.mockRejectedValue(new Error('504 gateway timeout'));
    renderShelf();
    fireEvent.click(toggle());
    fireEvent.click(spendButtons()[0]);

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(h.addAutoEvent).not.toHaveBeenCalled();
  });
});

// --- 7. empty shelf ----------------------------------------------------------------

describe('an empty shelf says so once expanded', () => {
  it('shows an invitational message and no Spend-this buttons', () => {
    const bare = makeCampaign({ npcs: [], plots: [], secrets: [], adventures: [], activeSceneId: undefined });
    renderShelf({ campaign: bare, activeScene: null });
    fireEvent.click(toggle());

    expect(screen.getByRole('status').textContent?.length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /spend this/i })).toBeNull();
  });
});
