// @vitest-environment jsdom
/**
 * wp-review — SceneEditor mention-plumbing migration (review findings C5/C6/C10,
 * the SceneEditor twins of findings #69/#70)
 *
 * SceneEditor was the one MentionInput-bearing editor the #69/#70 hardening
 * sweep missed:
 *   - handleMentionedIdsChange called setFormData AND onUpdate(scene.id, ...)
 *     from INSIDE the setMentionedIdsByField functional updater. Updaters run
 *     during the render phase and StrictMode double-invokes them, so every
 *     mention change fired the store write (and the autosave it re-arms) twice.
 *   - handleMentionFieldChange committed readAloudText/gmNotes to the store on
 *     every keystroke instead of routing through useDebouncedFieldCommit.
 *   - the per-field mention map used a once-only useState lazy initialiser
 *     with no [scene.id] reset, so navigating scene A -> scene B under the
 *     same mounted editor (ViewRouter renders it with no key) merged A's
 *     stale field sets into B's first mentionedEntityIds write.
 *
 * Contract: matches NpcEditor/ArticleEditor/FactionEditor/LocationEditor/
 * PlotEditor — unblurred keystrokes coalesce into at most one write, a
 * mention change writes mentionedEntityIds at most once even under
 * StrictMode, pending edits flush on unmount, and a scene switch never leaks
 * the previous scene's mention ids onto the next scene.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { Campaign, NPC, Scene } from '../../types/index';

// Matches SceneEditorProps['onUpdate'] so the mock is assignable to the
// component prop without weakening the assertions made against its calls.
type OnUpdateFn = (id: string, updatedData: Partial<Scene>) => void;
const createOnUpdateMock = () => vi.fn<OnUpdateFn>();

vi.mock('../../services/aiService', () => ({
  generateNpc: vi.fn(),
  generateEnhancedText: vi.fn(),
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

afterEach(cleanup);

const kara = { id: 'id-kara', name: 'Kara', relationships: [], history: [] } as unknown as NPC;

const makeScene = (overrides: Partial<Scene>): Scene => ({
  id: 'scene-1',
  title: 'The Drowned Vault',
  type: 'social',
  status: 'planned',
  readAloudText: '',
  gmNotes: '',
  rewards: '',
  npcIds: [],
  skillChecks: [],
  locationId: undefined,
  mentionedEntityIds: [],
  ...overrides,
} as unknown as Scene);

const campaign = {
  id: 'camp-1', title: 'Test Campaign',
  npcs: [kara], locations: [], factions: [], items: [], adventures: [],
  articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

function fieldByPlaceholder(container: HTMLElement, re: RegExp): HTMLTextAreaElement {
  const el = Array.from(container.querySelectorAll('textarea'))
    .find(t => re.test(t.getAttribute('placeholder') || ''));
  expect(el, `MentionInput textarea matching ${re} not found`).toBeTruthy();
  return el as HTMLTextAreaElement;
}

const readAloudField = (container: HTMLElement) => fieldByPlaceholder(container, /box text/i);
const gmNotesField = (container: HTMLElement) => fieldByPlaceholder(container, /GM-only notes/i);

function renderEditor(onUpdate: ReturnType<typeof createOnUpdateMock>, scene: Scene, strict = false) {
  const tree = (
    <ConfirmDialogProvider>
      <SceneEditor
        scene={scene}
        allNpcs={[kara]}
        allLocations={[]}
        campaign={campaign}
        onUpdate={onUpdate}
        onDelete={() => {}}
        isMockMode
      />
    </ConfirmDialogProvider>
  );
  return render(strict ? <React.StrictMode>{tree}</React.StrictMode> : tree);
}

describe('wp-review C5/C6/C10 — SceneEditor mention fields match the other editors', () => {
  it('does not write to the store at all for unblurred, non-mentioning keystrokes', () => {
    const onUpdate = createOnUpdateMock();
    const { container } = renderEditor(onUpdate, makeScene({}));

    const readAloud = readAloudField(container);
    fireEvent.change(readAloud, { target: { value: 'T' } });
    fireEvent.change(readAloud, { target: { value: 'Th' } });
    fireEvent.change(readAloud, { target: { value: 'The vault opens' } });

    const gmNotes = gmNotesField(container);
    fireEvent.change(gmNotes, { target: { value: 'Trap on the door' } });

    expect(
      onUpdate.mock.calls.length,
      `unblurred keystrokes must not each produce a campaign-wide store write (saw: ${JSON.stringify(onUpdate.mock.calls)})`,
    ).toBe(0);
  });

  it('writes mentionedEntityIds at most once per change under StrictMode', () => {
    const onUpdate = createOnUpdateMock();
    const { container } = renderEditor(onUpdate, makeScene({}), true);

    fireEvent.change(readAloudField(container), { target: { value: 'Seen near the docks' } });

    const mentionWrites = onUpdate.mock.calls
      .filter(c => Object.prototype.hasOwnProperty.call(c[1] ?? {}, 'mentionedEntityIds'));
    expect(
      mentionWrites.length,
      'StrictMode double-invokes state updaters — a store write inside one runs twice',
    ).toBeLessThanOrEqual(1);
  });

  it('flushes a pending debounced edit on unmount instead of dropping it', async () => {
    const onUpdate = createOnUpdateMock();
    const { container, unmount } = renderEditor(onUpdate, makeScene({}));

    fireEvent.change(readAloudField(container), { target: { value: 'The vault opens' } });
    unmount();

    await new Promise(resolve => setTimeout(resolve, 700));

    const flushed = onUpdate.mock.calls
      .map(c => (c[1] ?? {}) as Record<string, unknown>)
      .filter(payload => 'readAloudText' in payload)
      .pop();
    expect(flushed?.readAloudText).toBe('The vault opens');
  });

  it('does not leak scene A\'s mention ids onto scene B after an in-place switch (C5)', () => {
    const sceneA = makeScene({
      id: 'scene-a',
      gmNotes: '@Kara awaits below.',
      mentionedEntityIds: ['id-kara'],
    });
    const sceneB = makeScene({ id: 'scene-b' });

    const onUpdate = createOnUpdateMock();
    const { container, rerender } = renderEditor(onUpdate, sceneA);

    // Same mounted editor receives scene B — ViewRouter never remounts it.
    rerender(
      <ConfirmDialogProvider>
        <SceneEditor
          scene={sceneB}
          allNpcs={[kara]}
          allLocations={[]}
          campaign={campaign}
          onUpdate={onUpdate}
          onDelete={() => {}}
          isMockMode
        />
      </ConfirmDialogProvider>,
    );

    // One keystroke into pristine scene B's read-aloud field. Before the fix,
    // the stale per-field map merged A's gmNotes ids into B's write:
    // onUpdate('scene-b', { mentionedEntityIds: ['id-kara'] }).
    fireEvent.change(readAloudField(container), { target: { value: 'x' } });

    const mentionWritesOnB = onUpdate.mock.calls
      .filter(([id, patch]) => id === 'scene-b' && Object.prototype.hasOwnProperty.call(patch ?? {}, 'mentionedEntityIds'));
    expect(
      mentionWritesOnB,
      `scene B must not inherit scene A's mention ids (saw: ${JSON.stringify(mentionWritesOnB)})`,
    ).toEqual([]);
  });
});
