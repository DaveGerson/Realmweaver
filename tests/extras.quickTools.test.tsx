// @vitest-environment jsdom
/**
 * SPEC — components/views/session/ExtrasPanel.tsx (§4.8 of the lazy-dm-lens
 * research report; Sly Flourish step 6, scoped to the disposable case the
 * shipped Quick NPC Generator doesn't target)
 *
 * 1. **Collapsed by default**, using the same toggle pattern as Quick Tools'
 *    Dice Roller — no "Generate extras" button, no list, until expanded.
 * 2. **Generating asks the facade for a batch**, built from campaign state
 *    alone (zero-prompt) via a `'generation'`-variant campaign context.
 * 3. **The result renders as plain copy-ready text** — a name and one-line
 *    detail per row — with a working "Copy all" action that never reports
 *    success before the write actually resolves (mirrors the ship-hardened
 *    `SessionEndWizard` clipboard contract, finding #81).
 * 4. **"Promote to NPC" creates a minimal NPC** via `campaignService.createNpc`
 *    with just name + description filled in, defaulted through the real
 *    `createDefaultNpc()` factory, and is per-line and idempotent (a second
 *    click on an already-promoted line does nothing).
 * 5. **A prepped scene gets the new NPC linked to it**, the way
 *    `QuickNpcGenerator` already does; with no active scene, promotion still
 *    creates the NPC but never calls `updateScene`.
 * 6. **`onNpcCreated` fires with the new id** when the prop is supplied.
 * 7. **A failed generation shows an error and renders no list.**
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Campaign, Scene, Adventure } from '../types/index';

const h = vi.hoisted(() => ({
  generateExtras: vi.fn(),
  buildCampaignContext: vi.fn((_options: Record<string, unknown>) => 'GENERATION-CONTEXT'),
  createNpc: vi.fn((_data: Record<string, unknown>) => 'npc-new-1'),
  updateScene: vi.fn(),
  addAutoEvent: vi.fn(() => true),
}));

vi.mock('@/services/aiService', () => ({
  generateExtras: h.generateExtras,
}));

vi.mock('@/services/contextBuilder', () => ({ buildCampaignContext: h.buildCampaignContext }));

vi.mock('@/services/campaignService', () => ({
  campaignService: {
    createNpc: h.createNpc,
    updateScene: h.updateScene,
    addAutoEvent: h.addAutoEvent,
  },
}));

const { ExtrasPanel } = await import('../components/views/session/ExtrasPanel');

// --- fixtures ----------------------------------------------------------------

const EXTRAS = [
  { name: 'Bram Kettle', detail: 'Talks with his hands full.' },
  { name: 'Sela Voss', detail: 'A scar through one eyebrow.' },
];

const ACTIVE_SCENE = { id: 'scene-1', title: 'The Tollhouse', npcIds: ['npc-existing'] } as unknown as Scene;
const ADVENTURE = { id: 'adv-1', title: 'Salt & Ruin' } as unknown as Adventure;
const CAMPAIGN = { id: 'camp-1', title: 'Ashfall', setting: 'A dying empire' } as unknown as Campaign;

function renderPanel(over: { activeScene?: Scene | null; adventure?: Adventure | null; onNpcCreated?: (id: string) => void } = {}) {
  return render(
    <ExtrasPanel
      campaign={CAMPAIGN}
      activeScene={over.activeScene === undefined ? ACTIVE_SCENE : over.activeScene}
      adventure={over.adventure === undefined ? ADVENTURE : over.adventure}
      isMockMode
      onNpcCreated={over.onNpcCreated}
    />
  );
}

const toggle = () => screen.getByRole('button', { name: /^extras$/i });
const generateButton = () => screen.getByRole('button', { name: /generate extras|generate more/i });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.buildCampaignContext.mockReturnValue('GENERATION-CONTEXT');
  h.createNpc.mockReturnValue('npc-new-1');
  h.addAutoEvent.mockReturnValue(true);
  h.generateExtras.mockResolvedValue(EXTRAS);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// --- 1. collapsed by default --------------------------------------------------

describe('collapsed by default', () => {
  it('shows only the toggle until expanded', () => {
    renderPanel();
    expect(toggle()).toBeTruthy();
    expect(screen.queryByRole('button', { name: /generate extras/i })).toBeNull();
  });
});

// --- 2. generating -------------------------------------------------------------

describe('generating asks the facade for a zero-prompt batch', () => {
  it('builds a generation-variant context and passes the mock-mode flag through', async () => {
    renderPanel();
    fireEvent.click(toggle());
    fireEvent.click(generateButton());

    await screen.findByText('Bram Kettle');
    expect(h.generateExtras).toHaveBeenCalledTimes(1);
    const [count, context, , isMockMode] = h.generateExtras.mock.calls[0];
    expect(count).toBeGreaterThanOrEqual(4);
    expect(count).toBeLessThanOrEqual(6);
    expect(context).toBe('GENERATION-CONTEXT');
    expect(isMockMode).toBe(true);

    const options = h.buildCampaignContext.mock.calls[0][0] as Record<string, unknown>;
    expect(options.variant).toBe('generation');
  });

  it('renders every generated name and detail', async () => {
    renderPanel();
    fireEvent.click(toggle());
    fireEvent.click(generateButton());

    await screen.findByText('Bram Kettle');
    expect(screen.getByText(/talks with his hands full/i)).toBeTruthy();
    expect(screen.getByText('Sela Voss')).toBeTruthy();
    expect(screen.getByText(/a scar through one eyebrow/i)).toBeTruthy();
  });

  it('shows an error and no list when generation fails', async () => {
    h.generateExtras.mockRejectedValue(new Error('504 gateway timeout'));
    renderPanel();
    fireEvent.click(toggle());
    fireEvent.click(generateButton());

    expect(await screen.findByText('504 gateway timeout')).toBeTruthy();
    expect(screen.queryByText('Bram Kettle')).toBeNull();
  });
});

// --- 3. copy-all, never reporting success early -------------------------------

describe('copy-all never reports success before the write resolves', () => {
  it('copies every line as "name — detail" and confirms only after resolving', async () => {
    let resolveWrite: () => void = () => {};
    const writeText = vi.fn(() => new Promise<void>((res) => { resolveWrite = res; }));
    vi.stubGlobal('navigator', { ...globalThis.navigator, clipboard: { writeText } });

    renderPanel();
    fireEvent.click(toggle());
    fireEvent.click(generateButton());
    await screen.findByText('Bram Kettle');

    fireEvent.click(screen.getByRole('button', { name: /copy all/i }));
    expect(writeText).toHaveBeenCalledWith('Bram Kettle — Talks with his hands full.\nSela Voss — A scar through one eyebrow.');
    expect(screen.queryByText(/^copied$/i)).toBeNull();

    resolveWrite();
    await waitFor(() => expect(screen.getByText(/^copied$/i)).toBeTruthy());
  });

  it('does not report success when the clipboard write is rejected', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('permission denied')));
    vi.stubGlobal('navigator', { ...globalThis.navigator, clipboard: { writeText } });

    renderPanel();
    fireEvent.click(toggle());
    fireEvent.click(generateButton());
    await screen.findByText('Bram Kettle');

    fireEvent.click(screen.getByRole('button', { name: /copy all/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.queryByText(/^copied$/i)).toBeNull();
  });

  it('does not throw when navigator.clipboard is unavailable', async () => {
    vi.stubGlobal('navigator', { ...globalThis.navigator, clipboard: undefined });

    renderPanel();
    fireEvent.click(toggle());
    fireEvent.click(generateButton());
    await screen.findByText('Bram Kettle');

    expect(() => fireEvent.click(screen.getByRole('button', { name: /copy all/i }))).not.toThrow();
    expect(screen.queryByText(/^copied$/i)).toBeNull();
  });
});

// --- 4, 5 & 6. Promote to NPC --------------------------------------------------

describe('Promote to NPC creates a minimal NPC and links it', () => {
  it('creates an NPC with just name + description, defaulted via createDefaultNpc()', async () => {
    renderPanel();
    fireEvent.click(toggle());
    fireEvent.click(generateButton());
    await screen.findByText('Bram Kettle');

    fireEvent.click(screen.getAllByRole('button', { name: /promote to npc/i })[0]);

    expect(h.createNpc).toHaveBeenCalledTimes(1);
    const created = h.createNpc.mock.calls[0][0];
    expect(created.name).toBe('Bram Kettle');
    expect(created.description).toBe('Talks with his hands full.');
    expect(created.id).toBeUndefined();
    // Defaulted fields from createDefaultNpc() survive the spread.
    expect(created.relationships).toEqual([]);
    expect(created.history).toEqual([]);
  });

  it('links the new NPC to the active scene, the way QuickNpcGenerator does', async () => {
    renderPanel();
    fireEvent.click(toggle());
    fireEvent.click(generateButton());
    await screen.findByText('Bram Kettle');

    fireEvent.click(screen.getAllByRole('button', { name: /promote to npc/i })[0]);

    expect(h.updateScene).toHaveBeenCalledWith('adv-1', 'scene-1', { npcIds: ['npc-existing', 'npc-new-1'] });
  });

  it('logs an npc-created event and calls onNpcCreated with the new id', async () => {
    const onNpcCreated = vi.fn();
    renderPanel({ onNpcCreated });
    fireEvent.click(toggle());
    fireEvent.click(generateButton());
    await screen.findByText('Bram Kettle');

    fireEvent.click(screen.getAllByRole('button', { name: /promote to npc/i })[0]);

    expect(h.addAutoEvent).toHaveBeenCalledWith('npc-created', expect.stringContaining('Bram Kettle'));
    expect(onNpcCreated).toHaveBeenCalledWith('npc-new-1');
  });

  it('never calls updateScene when there is no active scene', async () => {
    renderPanel({ activeScene: null });
    fireEvent.click(toggle());
    fireEvent.click(generateButton());
    await screen.findByText('Bram Kettle');

    fireEvent.click(screen.getAllByRole('button', { name: /promote to npc/i })[0]);

    expect(h.createNpc).toHaveBeenCalledTimes(1);
    expect(h.updateScene).not.toHaveBeenCalled();
  });

  it('is idempotent — a second click on an already-promoted line creates nothing more', async () => {
    renderPanel();
    fireEvent.click(toggle());
    fireEvent.click(generateButton());
    await screen.findByText('Bram Kettle');

    const promoteButtons = screen.getAllByRole('button', { name: /promote to npc/i });
    fireEvent.click(promoteButtons[0]);
    expect(h.createNpc).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /added/i }));
    expect(h.createNpc).toHaveBeenCalledTimes(1);
  });

  it('names each Promote button after its extra, so no two share an accessible name', async () => {
    renderPanel();
    fireEvent.click(toggle());
    fireEvent.click(generateButton());
    await screen.findByText('Bram Kettle');

    const names = screen.getAllByRole('button', { name: /promote to npc/i }).map(b => b.getAttribute('aria-label'));
    expect(names).toContain('Promote to NPC: Bram Kettle');
    expect(new Set(names).size).toBe(names.length);
  });
});
