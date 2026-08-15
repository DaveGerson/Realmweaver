// @vitest-environment jsdom
/**
 * wp-f1-session-editors — finding #65
 *
 * SceneEditor.handleGenerateNpcForScene awaits generateNpc, then computes
 *   const newNpcIds = [...formData.npcIds, newNpcId];
 * from the `formData` captured in the closure AT CLICK TIME, and persists that
 * via onUpdate(scene.id, { npcIds: newNpcIds }). AI generation takes seconds
 * and the NPC checkbox list stays interactive throughout, so any NPC the GM
 * ticks while generation runs is silently dropped when the promise resolves —
 * from local state AND from the persisted campaign.
 *
 * Contract: the payload written after generation must be derived from the
 * CURRENT npcIds (functional setState or a re-read of the store), so
 * selections made during generation survive. The generated NPC must be added,
 * never replacing concurrent edits.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, act, waitFor } from '@testing-library/react';
import type { Campaign, NPC, Location, Scene } from '../../types/index';

let resolveGenerate: ((npc: Partial<NPC>) => void) | null = null;
const generateNpc = vi.fn(
  () => new Promise<Partial<NPC>>(resolve => { resolveGenerate = resolve; }),
);

vi.mock('../../services/aiService', () => ({
  generateNpc: (...args: unknown[]) => generateNpc(...(args as [])),
}));

// campaignService is used for createNpc + the SaveStatusIndicator subscription.
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
  resolveGenerate = null;
  generateNpc.mockClear();
  createNpc.mockClear();
  cleanup();
});

const npcA = { id: 'npc-a', name: 'Aldric', relationships: [], history: [] } as unknown as NPC;
const npcB = { id: 'npc-b', name: 'Brynn', relationships: [], history: [] } as unknown as NPC;
const allNpcs = [npcA, npcB];
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

describe('wp-f1-session-editors #65 — NPC generation vs. concurrent selection', () => {
  it('keeps NPCs ticked while generation was running', async () => {
    const onUpdate = vi.fn();
    const { container } = render(
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
      </ConfirmDialogProvider>,
    );

    // Open the Connections tab where the NPC list + generate panel live.
    fireEvent.click(findButton(container, /^Connections$/i));

    // Kick off generation (open the inline prompt panel, then submit it).
    fireEvent.click(findButton(container, /generate npc for this scene/i));
    fireEvent.click(findButton(container, /^Generate$/i));
    await waitFor(() => expect(generateNpc).toHaveBeenCalled());

    // While it runs, the GM ticks Brynn — this commits ['npc-a','npc-b'].
    const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
    const brynnBox = checkboxes[1];
    expect(brynnBox).toBeTruthy();
    fireEvent.click(brynnBox);
    expect(onUpdate).toHaveBeenCalledWith(scene.id, { npcIds: ['npc-a', 'npc-b'] });

    // Generation resolves.
    await act(async () => {
      resolveGenerate!({ name: 'Generated Guard' } as Partial<NPC>);
      await Promise.resolve();
    });

    await waitFor(() => expect(createNpc).toHaveBeenCalled());

    const npcIdPatches = onUpdate.mock.calls
      .map(([, patch]) => (patch as Partial<Scene>).npcIds)
      .filter((v): v is string[] => Array.isArray(v));
    const finalPatch = npcIdPatches[npcIdPatches.length - 1];

    // The concurrently ticked NPC must survive, and the generated one must be added.
    expect(finalPatch).toContain('npc-b');
    expect(finalPatch).toContain('npc-generated');
    expect(finalPatch).toEqual(['npc-a', 'npc-b', 'npc-generated']);

    // …and the UI must still show Brynn as selected.
    const brynnAfter = (Array.from(container.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[])[1];
    expect(brynnAfter.checked).toBe(true);
  });
});
