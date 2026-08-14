// @vitest-environment jsdom
/**
 * wp-f2-entity-editors — findings #70 and #69
 *
 * #70 NpcEditor.handleMentionFieldChange (line 90) calls
 *     `onUpdate(npc.id, { [field]: value })` on EVERY keystroke, bypassing the
 *     blur-commit design documented in utils/formReconciliation.ts. Each call
 *     runs an Immer produce over the whole campaign, notifies every
 *     useSyncExternalStore subscriber and re-arms the debounced save — one
 *     structural clone plus a full app re-render per character typed. Plain
 *     textareas in the same editor correctly commit on blur; only the
 *     MentionInput-backed fields (description/traits/motivations/secrets/
 *     backstory, and their twins in Article/Faction/Location/Plot/Scene) do this.
 *
 *     Contract: typing does not write to the store per keystroke (at most one
 *     coalesced write), and the final text IS committed once the field settles
 *     (blur, or a trailing debounce).
 *
 * #69 NpcEditor.handleMentionedIdsChange (line 111) performs the store write
 *     INSIDE a setState updater:
 *       setMentionedIdsByField(prev => { ...; setFormData(...); onUpdate(...); return next; })
 *     React runs updaters during the render phase, so this notifies App while
 *     NpcEditor is rendering ("Cannot update a component while rendering a
 *     different component"), and StrictMode's intentional double-invoke of the
 *     updater executes the store write — and the debounced save — TWICE per
 *     mention change.
 *
 *     Contract: one mention change produces at most ONE mentionedEntityIds
 *     write, even under StrictMode. Compute the merged set outside the updater.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { Campaign, NPC } from '../../types/index';

vi.mock('../../services/aiService', () => ({
  generateEnhancedText: vi.fn(),
}));

const storeState = { campaigns: [], activeCampaignId: null, saveStatus: 'idle', lastSavedAt: null, appStatus: 'editing' };
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

const npc = {
  id: 'npc-1',
  name: 'Aldric Vane',
  description: '',
  traits: '',
  motivations: '',
  secrets: '',
  backstory: '',
  stats: '',
  exampleQuote: '',
  knowsPlayerHistory: [],
  relationships: [],
  history: [],
  mentionedEntityIds: [],
} as unknown as NPC;

const campaign = {
  id: 'camp-1', title: 'Test Campaign',
  npcs: [npc], locations: [], factions: [], items: [], adventures: [],
  articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

function descriptionField(container: HTMLElement): HTMLTextAreaElement {
  const el = Array.from(container.querySelectorAll('textarea'))
    .find(t => /physical appearance/i.test(t.getAttribute('placeholder') || ''));
  expect(el, 'description MentionInput textarea not found').toBeTruthy();
  return el as HTMLTextAreaElement;
}

function renderEditor(onUpdate: ReturnType<typeof vi.fn>, strict = false) {
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
  return render(strict ? <React.StrictMode>{tree}</React.StrictMode> : tree);
}

describe('wp-f2-entity-editors #70 — MentionInput fields commit like every other field', () => {
  it('does not write to the store on every keystroke', async () => {
    const onUpdate = vi.fn();
    const { container } = renderEditor(onUpdate);
    const field = descriptionField(container);

    fireEvent.change(field, { target: { value: 'A' } });
    fireEvent.change(field, { target: { value: 'A t' } });
    fireEvent.change(field, { target: { value: 'A tall' } });
    fireEvent.change(field, { target: { value: 'A tall man' } });

    const descriptionWrites = onUpdate.mock.calls
      .filter(c => Object.prototype.hasOwnProperty.call(c[1] ?? {}, 'description'));
    expect(
      descriptionWrites.length,
      'unblurred keystrokes must not each produce a campaign-wide store write',
    ).toBeLessThanOrEqual(1);
  });

  it('still commits the final text once the field settles', async () => {
    const onUpdate = vi.fn();
    const { container } = renderEditor(onUpdate);
    const field = descriptionField(container);

    fireEvent.change(field, { target: { value: 'A tall man' } });
    fireEvent.blur(field);

    await waitFor(() => {
      const committed = onUpdate.mock.calls
        .map(c => (c[1] ?? {}) as Record<string, unknown>)
        .filter(payload => 'description' in payload)
        .pop();
      expect(committed?.description).toBe('A tall man');
    }, { timeout: 2000 });
  });
});

describe('wp-f2-entity-editors #69 — mention tracking must not write from a render-phase updater', () => {
  it('writes mentionedEntityIds at most once per change under StrictMode', () => {
    const onUpdate = vi.fn();
    const { container } = renderEditor(onUpdate, true);
    const field = descriptionField(container);

    fireEvent.change(field, { target: { value: 'Seen near the docks' } });

    const mentionWrites = onUpdate.mock.calls
      .filter(c => Object.prototype.hasOwnProperty.call(c[1] ?? {}, 'mentionedEntityIds'));
    expect(
      mentionWrites.length,
      "StrictMode double-invokes state updaters — a store write inside one runs twice",
    ).toBeLessThanOrEqual(1);
  });
});
