// @vitest-environment jsdom
/**
 * wp-review — C5: per-field @-mention state must reset on entity switch
 *
 * Editors are NOT keyed by entity id: ViewRouter renders <NpcEditor
 * npc={selectedNpc}/> at a fixed position, so navigating NPC A -> NPC B
 * reuses the mounted instance. NpcEditor's `mentionedIdsByFieldRef` and
 * `lastMergedIdsKeyRef` were useRef values whose initialisers ran only on
 * first mount, so after the switch they still held A's per-field id sets:
 *
 *  - CONTAMINATION: one keystroke in B's empty description made MentionInput
 *    report [] for 'description'; the handler merged that with A's stale map
 *    and wrote A's OTHER fields' ids (e.g. backstory's @Thorn) onto B's
 *    mentionedEntityIds — a silent, permanent corruption of the linking
 *    graph (Thorn's BacklinksPanel then lists B under "Mentioned in").
 *
 *  - SUPPRESSION: when B's legitimate first merged set happened to equal A's
 *    stale merged key, the churn short-circuit skipped the write, so B's
 *    genuinely new mention was never persisted.
 *
 * Contract: on every entity id change the editor rebuilds both refs from the
 * incoming entity (mirroring the mount-time seeding and MentionInput's own
 * seedKey resync). The same fix applies to LocationEditor, FactionEditor,
 * ArticleEditor and PlotEditor, which share the pattern verbatim.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { Campaign, NPC } from '../../types/index';

// Matches NpcEditorProps['onUpdate'] so the mock is assignable to the
// component prop without weakening the assertions made against its calls.
type OnUpdateFn = (id: string, updatedData: Partial<NPC>) => void;
const createOnUpdateMock = () => vi.fn<OnUpdateFn>();

vi.mock('../../services/aiService', () => ({
  generateEnhancedText: vi.fn(),
}));

const kara = {
  id: 'id-kara', name: 'Kara', description: '', traits: '', motivations: '', secrets: '',
  backstory: '', stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [],
  history: [], mentionedEntityIds: [],
} as unknown as NPC;

const thorn = {
  id: 'id-thorn', name: 'Thorn', description: '', traits: '', motivations: '', secrets: '',
  backstory: '', stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [],
  history: [], mentionedEntityIds: [],
} as unknown as NPC;

// NPC A: mentions live in TWO different fields, so the per-field map matters —
// the contamination path leaks the field the GM is NOT typing in (backstory).
const npcA = {
  id: 'npc-a', name: 'Aldric Vane',
  description: '@Kara stands guard at the gate.',
  traits: '', motivations: '', secrets: '',
  backstory: 'Haunted by @Thorn since the war.',
  stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
  mentionedEntityIds: ['id-kara', 'id-thorn'],
} as unknown as NPC;

// NPC B: pristine — no mentions anywhere.
const npcB = {
  id: 'npc-b', name: 'Brennan Cole',
  description: '', traits: '', motivations: '', secrets: '', backstory: '',
  stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
  mentionedEntityIds: [],
} as unknown as NPC;

// NPC A2 (suppression variant): stale merged key is exactly ['id-thorn'].
const npcA2 = {
  id: 'npc-a2', name: 'Aldric Vane',
  description: '', traits: '', motivations: '', secrets: '',
  backstory: 'Haunted by @Thorn since the war.',
  stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
  mentionedEntityIds: ['id-thorn'],
} as unknown as NPC;

const campaign = {
  id: 'camp-1', title: 'Test Campaign',
  npcs: [npcA, npcB, npcA2, kara, thorn],
  locations: [], factions: [], items: [], adventures: [],
  articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

// The dropdown pulls candidates from campaignService.getState() (not props),
// so the suppression test's @-autocomplete needs an active campaign here.
const storeState = {
  campaigns: [campaign], activeCampaignId: 'camp-1',
  saveStatus: 'idle', lastSavedAt: null, appStatus: 'editing',
};
vi.mock('../../services/campaignService', () => ({
  campaignService: {
    subscribe: () => () => {},
    getState: () => storeState,
    getActiveCampaign: () => undefined,
  },
}));

const { NpcEditor } = await import('../../components/editors/NpcEditor');
const { ConfirmDialogProvider } = await import('../../hooks/useConfirmDialog');

afterEach(cleanup);

function descriptionField(container: HTMLElement): HTMLTextAreaElement {
  const el = Array.from(container.querySelectorAll('textarea'))
    .find(t => /physical appearance/i.test(t.getAttribute('placeholder') || ''));
  expect(el, 'description MentionInput textarea not found').toBeTruthy();
  return el as HTMLTextAreaElement;
}

function editorTree(npc: NPC, onUpdate: ReturnType<typeof createOnUpdateMock>, strict = false) {
  const tree = (
    <ConfirmDialogProvider>
      <NpcEditor
        npc={npc}
        factions={[]}
        campaign={campaign}
        onUpdate={onUpdate}
        onDelete={() => {}}
        isMockMode
      />
    </ConfirmDialogProvider>
  );
  return strict ? <React.StrictMode>{tree}</React.StrictMode> : tree;
}

const mentionWritesOf = (onUpdate: ReturnType<typeof createOnUpdateMock>) =>
  onUpdate.mock.calls.filter(c =>
    Object.prototype.hasOwnProperty.call(c[1] ?? {}, 'mentionedEntityIds'));

describe("wp-review C5 — entity switch must not leak A's mentions onto B", () => {
  it("typing one character in pristine B's description does not write A's ids onto B", () => {
    const onUpdate = createOnUpdateMock();
    // Same mounted instance: render A, then rerender the SAME tree position with B —
    // exactly what ViewRouter does when the GM clicks an EntityLink inside A's editor.
    const { container, rerender } = render(editorTree(npcA, onUpdate));
    rerender(editorTree(npcB, onUpdate));

    fireEvent.change(descriptionField(container), { target: { value: 'B' } });

    const mentionWrites = mentionWritesOf(onUpdate);
    for (const [id, payload] of mentionWrites) {
      const ids = (payload as Partial<NPC>).mentionedEntityIds ?? [];
      expect(
        ids,
        `write against "${id}" carries NPC A's mention ids — stale per-field state leaked across the entity switch`,
      ).not.toContain('id-thorn');
      expect(ids).not.toContain('id-kara');
    }
    // Stronger: B's set is genuinely unchanged (empty -> empty), so per the
    // churn contract pinned in wp-f2-entity-editors.mention-field-commits
    // there must be NO mentionedEntityIds write at all.
    expect(
      mentionWrites.length,
      `an unchanged mention set must not produce a store write (saw: ${JSON.stringify(mentionWrites)})`,
    ).toBe(0);
  });

  it("same scenario under StrictMode — the id-keyed reset must be idempotent", () => {
    const onUpdate = createOnUpdateMock();
    const { container, rerender } = render(editorTree(npcA, onUpdate, true));
    rerender(editorTree(npcB, onUpdate, true));

    fireEvent.change(descriptionField(container), { target: { value: 'B' } });

    for (const [, payload] of mentionWritesOf(onUpdate)) {
      const ids = (payload as Partial<NPC>).mentionedEntityIds ?? [];
      expect(ids).not.toContain('id-thorn');
      expect(ids).not.toContain('id-kara');
    }
    expect(mentionWritesOf(onUpdate).length).toBe(0);
  });

  it("B's legitimate first mention is written even when it equals A's stale merged key", () => {
    const onUpdate = createOnUpdateMock();
    // A2's merged key is exactly ['id-thorn']. B then genuinely mentions
    // @Thorn for the first time: without the id-keyed reset, the stale key
    // matches and the churn short-circuit silently swallows B's first write.
    const { container, rerender } = render(editorTree(npcA2, onUpdate));
    rerender(editorTree(npcB, onUpdate));

    const field = descriptionField(container);
    fireEvent.change(field, { target: { value: '@Tho', selectionStart: 4, selectionEnd: 4 } });

    const option = Array.from(container.querySelectorAll('[role="option"]'))
      .find(o => /thorn/i.test(o.textContent || ''));
    expect(option, '@Thorn autocomplete option not found').toBeTruthy();
    fireEvent.pointerDown(option!);

    const thornWrites = mentionWritesOf(onUpdate)
      .filter(([id, payload]) =>
        id === 'npc-b' && ((payload as Partial<NPC>).mentionedEntityIds ?? []).includes('id-thorn'));
    expect(
      thornWrites.length,
      "B's first mention of @Thorn was suppressed by A's stale merged-ids key",
    ).toBeGreaterThan(0);
  });
});
