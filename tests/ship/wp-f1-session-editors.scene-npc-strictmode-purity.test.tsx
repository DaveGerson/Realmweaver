// @vitest-environment jsdom
/**
 * wp-f1-session-editors — verifier finding #2 on the #65 fix
 *
 * The original #65 fix called `onUpdate(scene.id, { npcIds: next })` — a
 * global store write — from INSIDE the `setFormData` updater, which React
 * requires to be pure. Under React.StrictMode (which index.tsx wraps the
 * whole app in), updater functions are deliberately double-invoked in
 * development to surface exactly this kind of impurity: the store write
 * fired twice with an identical payload for a single NPC-generation event.
 *
 * Contract: generating one NPC for a scene, under StrictMode, must produce
 * exactly ONE onUpdate call carrying the generated NPC's id in npcIds — not
 * two identical calls.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { Campaign, NPC, Location, Scene } from '../../types/index';

const generateNpc = vi.fn(async () => ({ name: 'Generated Guard' }));
vi.mock('../../services/aiService', () => ({
  generateNpc: (...args: unknown[]) => generateNpc(...(args as [])),
}));

const createNpc = vi.fn(() => 'npc-generated');
const storeState = { campaigns: [], activeCampaignId: null, saveStatus: 'idle', lastSavedAt: null, appStatus: 'editing' };
vi.mock('../../services/campaignService', () => ({
  campaignService: {
    createNpc: (...args: unknown[]) => createNpc(...(args as [])),
    subscribe: () => () => {},
    getState: () => storeState,
    getActiveCampaign: () => undefined,
  },
}));

const { SceneEditor } = await import('../../components/editors/SceneEditor');
const { ConfirmDialogProvider } = await import('../../hooks/useConfirmDialog');

afterEach(() => {
  generateNpc.mockClear();
  createNpc.mockClear();
  cleanup();
});

const npcA = { id: 'npc-a', name: 'Aldric', relationships: [], history: [] } as unknown as NPC;
const allNpcs = [npcA];
const allLocations: Location[] = [];

const scene = {
  id: 'scene-1',
  title: 'The Drowned Vault',
  type: 'social',
  readAloudText: '',
  gmNotes: '',
  rewards: '',
  npcIds: ['npc-a'],
  skillChecks: [],
  locationId: undefined,
} as unknown as Scene;

const campaign = {
  id: 'camp-1',
  title: 'Test Campaign',
  npcs: allNpcs, locations: [], factions: [], items: [], adventures: [],
  articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

function findButton(container: HTMLElement, re: RegExp): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find(b => re.test(b.textContent || ''));
  expect(btn, `no button matching ${re}`).toBeTruthy();
  return btn as HTMLButtonElement;
}

describe('wp-f1-session-editors #2 — NPC generation must not double-write under StrictMode', () => {
  it('calls onUpdate exactly once with the generated NPC id', async () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <React.StrictMode>
        <ConfirmDialogProvider>
          <SceneEditor
            scene={scene}
            allNpcs={allNpcs}
            allLocations={allLocations}
            campaign={campaign}
            onUpdate={onUpdate}
            onDelete={vi.fn()}
            isMockMode={true}
            campaignContext="ctx"
          />
        </ConfirmDialogProvider>
      </React.StrictMode>,
    );

    fireEvent.click(findButton(container, /^Connections$/i));
    fireEvent.click(findButton(container, /generate npc for this scene/i));
    fireEvent.click(findButton(container, /^Generate$/i));

    await waitFor(() => expect(createNpc).toHaveBeenCalled());
    await waitFor(() => {
      const generatedPatches = onUpdate.mock.calls.filter(([, patch]) =>
        (patch as Partial<Scene>).npcIds?.includes('npc-generated'),
      );
      expect(generatedPatches.length).toBe(1);
    });
  });
});
