// @vitest-environment jsdom
/**
 * wp-f2-entity-editors — finding #69 (PlotEditor half)
 *
 * PlotEditor.tsx is unowned in plan.json, but the verifier assigned this
 * residual half of #69 to wp-f2 (see verify-reports.json): before the fix,
 * PlotEditor.handleMentionedIdsChange performed the store write INSIDE the
 * `setMentionedIdsByField` functional updater (React invokes updaters during
 * the render phase, and StrictMode double-invokes them — so the write, and
 * the debounced save it re-arms, fired twice per mention change), and
 * handleMentionFieldChange committed to the store on every keystroke instead
 * of debouncing like every other field.
 *
 * Contract: matches NpcEditor/ArticleEditor/FactionEditor/LocationEditor —
 * unblurred keystrokes coalesce into at most one write, and a mention change
 * writes mentionedEntityIds at most once, even under StrictMode.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { Campaign, Plot } from '../../types/index';

// Matches PlotEditorProps['onUpdate'] so the mock is assignable to the
// component prop without weakening the assertions made against its calls.
type OnUpdateFn = (id: string, updatedData: Partial<Plot>) => void;
const createOnUpdateMock = () => vi.fn<OnUpdateFn>();

vi.mock('../../services/aiService', () => ({
  generateScene: vi.fn(),
  generateEnhancedText: vi.fn(),
}));

const storeState = { campaigns: [], activeCampaignId: null, saveStatus: 'idle', lastSavedAt: null, appStatus: 'editing' };
vi.mock('../../services/campaignService', () => ({
  campaignService: {
    createScene: vi.fn(() => 'scene-generated'),
    subscribe: () => () => {},
    getState: () => storeState,
    getActiveCampaign: () => undefined,
  },
}));

const { PlotEditor } = await import('../../components/editors/PlotEditor');
const { ConfirmDialogProvider } = await import('../../hooks/useConfirmDialog');

afterEach(cleanup);

const plot = {
  id: 'plot-1',
  title: 'The Drowned Crown',
  status: 'active',
  description: '',
  relatedEntityIds: [],
  mentionedEntityIds: [],
} as unknown as Plot;

const campaign = {
  id: 'camp-1', title: 'Test Campaign',
  npcs: [], locations: [], factions: [], items: [], adventures: [],
  articles: [], sessionLogs: [], playerCharacters: [], plots: [plot], notes: [], secrets: [],
} as unknown as Campaign;

function descriptionField(container: HTMLElement): HTMLTextAreaElement {
  const el = Array.from(container.querySelectorAll('textarea'))
    .find(t => /describe the main conflict/i.test(t.getAttribute('placeholder') || ''));
  expect(el, 'description MentionInput textarea not found').toBeTruthy();
  return el as HTMLTextAreaElement;
}

function renderEditor(onUpdate: ReturnType<typeof createOnUpdateMock>, strict = false) {
  const tree = (
    <ConfirmDialogProvider>
      <PlotEditor
        plot={plot}
        campaign={campaign}
        onUpdate={onUpdate}
        onDelete={() => {}}
        isMockMode
      />
    </ConfirmDialogProvider>
  );
  return render(strict ? <React.StrictMode>{tree}</React.StrictMode> : tree);
}

describe('wp-f2-entity-editors #69/#70 — PlotEditor mention field matches the other editors', () => {
  it('does not write to the store at all for unblurred, non-mentioning keystrokes', () => {
    const onUpdate = createOnUpdateMock();
    const { container } = renderEditor(onUpdate);
    const field = descriptionField(container);

    fireEvent.change(field, { target: { value: 'T' } });
    fireEvent.change(field, { target: { value: 'Th' } });
    fireEvent.change(field, { target: { value: 'The crown stirs' } });

    expect(
      onUpdate.mock.calls.length,
      `unblurred keystrokes must not each produce a campaign-wide store write (saw: ${JSON.stringify(onUpdate.mock.calls)})`,
    ).toBe(0);
  });

  it('writes mentionedEntityIds at most once per change under StrictMode', () => {
    const onUpdate = createOnUpdateMock();
    const { container } = renderEditor(onUpdate, true);
    const field = descriptionField(container);

    fireEvent.change(field, { target: { value: 'Seen near the docks' } });

    const mentionWrites = onUpdate.mock.calls
      .filter(c => Object.prototype.hasOwnProperty.call(c[1] ?? {}, 'mentionedEntityIds'));
    expect(
      mentionWrites.length,
      'StrictMode double-invokes state updaters — a store write inside one runs twice',
    ).toBeLessThanOrEqual(1);
  });

  it('flushes a pending debounced edit on unmount instead of dropping it', async () => {
    const onUpdate = createOnUpdateMock();
    const { container, unmount } = renderEditor(onUpdate);
    const field = descriptionField(container);

    fireEvent.change(field, { target: { value: 'The crown stirs' } });
    unmount();

    await new Promise(resolve => setTimeout(resolve, 700));

    const flushed = onUpdate.mock.calls
      .map(c => (c[1] ?? {}) as Record<string, unknown>)
      .filter(payload => 'description' in payload)
      .pop();
    expect(flushed?.description).toBe('The crown stirs');
  });
});
