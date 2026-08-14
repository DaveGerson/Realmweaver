// @vitest-environment jsdom
/**
 * wp-f1-session-editors — wp-d's finding #50 (the SceneEditor half)
 *
 * LinkSuggestionsPanel and SceneSmartLinkBar each memoize their matching work
 * keyed (in part) on the candidate arrays they receive by reference. Before
 * this fix, SceneEditor built `allCandidates`/`allNpcs`/`allLocations` as
 * fresh array literals inline on every render:
 *
 *   allCandidates={[...allNpcs.map(...), ...allLocations.map(...)]}
 *   allNpcs={allNpcs.map(...)}
 *   allLocations={allLocations.map(...)}
 *
 * A new array identity on every render defeats those memos completely, so the
 * O(candidates × matches × textLength) matching engine re-ran on every
 * SceneEditor re-render (e.g. every keystroke elsewhere in the editor, since
 * SceneEditor is a single component with one `formData` state).
 *
 * Contract: re-rendering SceneEditor with stable `allNpcs`/`allLocations`
 * prop identities must not re-invoke the matching engine.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { Campaign, NPC, Location, Scene } from '../../types/index';
import { setMatchingEngine, resetMatchingEngine } from '../../services/linking/engineRegistry';

vi.mock('../../services/aiService', () => ({
  generateNpc: vi.fn(async () => ({})),
}));

const storeState = { campaigns: [], activeCampaignId: null, saveStatus: 'idle', lastSavedAt: null, appStatus: 'editing' };
vi.mock('../../services/campaignService', () => ({
  campaignService: {
    createNpc: vi.fn(() => 'npc-generated'),
    subscribe: () => () => {},
    getState: () => storeState,
    getActiveCampaign: () => undefined,
  },
}));

const { SceneEditor } = await import('../../components/editors/SceneEditor');
const { ConfirmDialogProvider } = await import('../../hooks/useConfirmDialog');

let findMatchesCalls = 0;

beforeEach(() => {
  findMatchesCalls = 0;
  setMatchingEngine({
    findMatches: () => {
      findMatchesCalls += 1;
      return [];
    },
    info: () => ({ name: 'CountingEngine', version: '1.0.0' }),
  });
});

afterEach(() => {
  resetMatchingEngine();
  cleanup();
});

const npcA = { id: 'npc-a', name: 'Aldric', relationships: [], history: [] } as unknown as NPC;
const npcB = { id: 'npc-b', name: 'Brynn', relationships: [], history: [] } as unknown as NPC;
const allNpcs = [npcA, npcB];
const allLocations: Location[] = [{ id: 'loc-a', name: 'The Drowned Vault' } as unknown as Location];

const scene = {
  id: 'scene-1',
  title: 'The Drowned Vault',
  type: 'social',
  readAloudText: 'Aldric waits in the vault.',
  gmNotes: 'Brynn is hiding nearby.',
  rewards: '',
  npcIds: [],
  skillChecks: [],
  locationId: undefined,
} as unknown as Scene;

const campaign = {
  id: 'camp-1',
  title: 'Test Campaign',
  npcs: allNpcs, locations: allLocations, factions: [], items: [], adventures: [],
  articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

function findButton(container: HTMLElement, re: RegExp): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find(b => re.test(b.textContent || ''));
  expect(btn, `no button matching ${re}`).toBeTruthy();
  return btn as HTMLButtonElement;
}

describe('wp-f1-session-editors #50 — SceneEditor candidate arrays must be memoized', () => {
  it('does not re-run the matching engine on an unrelated re-render', () => {
    const onUpdate = vi.fn();
    const element = () => (
      <ConfirmDialogProvider>
        <SceneEditor
          scene={scene}
          allNpcs={allNpcs}
          allLocations={allLocations}
          campaign={campaign}
          onUpdate={onUpdate}
          onDelete={vi.fn()}
          isMockMode={true}
        />
      </ConfirmDialogProvider>
    );

    const { container, rerender } = render(element());

    // Open the Connections tab, where SceneSmartLinkBar + LinkSuggestionsPanel
    // (the two matching-engine consumers) live.
    fireEvent.click(findButton(container, /^Connections$/i));

    expect(findMatchesCalls).toBeGreaterThan(0);
    const afterFirstRender = findMatchesCalls;

    // Re-render with the exact same `allNpcs`/`allLocations`/`scene` prop
    // identities — simulates a parent re-render (e.g. from an unrelated
    // keystroke elsewhere) that doesn't actually change any scene data.
    rerender(element());
    rerender(element());

    expect(findMatchesCalls).toBe(afterFirstRender);
  });
});
