// @vitest-environment jsdom
/**
 * wp-f2-entity-editors — findings #64 and #71 (residual RealmChatWidget half)
 *
 * RealmChatWidget renders entity editors as full-screen "draft" panels for
 * an unsaved chat draft (RealmChatWidget.tsx:464-520). Two problems on that
 * surface, both in a file no package owns:
 *
 * - #64: the 'adventure' draft branch (line 505 pre-fix) omitted both
 *   `isMockMode` and `campaignContext`, so AdventureEditor's "Generate next
 *   scene" / RegenerateButtons fired live provider calls even while the app
 *   is in mock mode, and generated with no world context.
 * - #71: the 'faction' draft branch (line 489 pre-fix) rendered FactionEditor
 *   with none of the guards that stop "Generate member NPC" elsewhere — the
 *   faction's id is the draft's own real uuid (not the synthetic 'preview'
 *   used by FactionDashboard's preview), so only an explicit `isPreview`
 *   prop closes it. Without it, clicking the button while the draft is still
 *   unsaved writes a real NPC pointing at a faction that doesn't exist yet
 *   in the campaign.
 *
 * Contract: opening a faction or adventure chat draft for editing must pass
 * isMockMode/campaignContext through, and the faction draft editor must be
 * told it's a preview.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { Campaign } from '../../types/index';

const factionEditorProps: Record<string, unknown>[] = [];
const adventureEditorProps: Record<string, unknown>[] = [];

vi.mock('../../components/editors/FactionEditor', () => ({
  FactionEditor: (props: Record<string, unknown>) => {
    factionEditorProps.push(props);
    return <div data-testid="faction-editor-stub" />;
  },
}));

vi.mock('../../components/editors/AdventureEditor', () => ({
  AdventureEditor: (props: Record<string, unknown>) => {
    adventureEditorProps.push(props);
    return <div data-testid="adventure-editor-stub" />;
  },
}));

const chatWithRealmWeaver = vi.fn();
vi.mock('../../services/aiService', () => ({
  chatWithRealmWeaver: (...args: unknown[]) => chatWithRealmWeaver(...(args as [])),
}));

// Hoisted so useSyncExternalStore (LinkedText, EntityLink) gets a
// referentially-stable snapshot across renders — an inline object literal
// here trips React's "getSnapshot should be cached" infinite-loop guard.
const storeState = { campaigns: [], activeCampaignId: null, saveStatus: 'idle', lastSavedAt: null, appStatus: 'editing' };
vi.mock('../../services/campaignService', () => ({
  campaignService: {
    subscribe: () => () => {},
    getState: () => storeState,
    getActiveCampaign: () => undefined,
  },
}));

const { RealmChatWidget } = await import('../../components/RealmChat/RealmChatWidget');

// jsdom has no layout engine — RealmChatWidget auto-scrolls the chat log on
// every history change.
(Element.prototype as any).scrollIntoView = vi.fn();

afterEach(() => {
  factionEditorProps.length = 0;
  adventureEditorProps.length = 0;
  chatWithRealmWeaver.mockReset();
  cleanup();
  try { sessionStorage.clear(); } catch { /* ignore */ }
});

const campaign = {
  id: 'camp-1', title: 'Test Campaign', setting: 'A drowned empire', settingType: 'custom',
  npcs: [], locations: [], factions: [], items: [], adventures: [],
  articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

async function openWidgetAndSend(container: HTMLElement, response: unknown) {
  chatWithRealmWeaver.mockResolvedValueOnce(response);

  const openBtn = container.querySelector('button[aria-label="Open RealmChat"]');
  expect(openBtn, 'FAB open button not found').toBeTruthy();
  fireEvent.click(openBtn!);

  const input = container.querySelector('input[placeholder="Type a message..."]') as HTMLInputElement;
  expect(input, 'chat input not found').toBeTruthy();
  fireEvent.change(input, { target: { value: 'Draft me a faction' } });
  fireEvent.keyDown(input, { key: 'Enter' });

  await waitFor(() => expect(chatWithRealmWeaver).toHaveBeenCalled());
}

describe('wp-f2-entity-editors #71 — RealmChatWidget faction draft editor is a preview', () => {
  it('passes isPreview to FactionEditor for an unsaved chat draft', async () => {
    const { container } = render(
      <RealmChatWidget campaign={campaign} onAddToCampaign={() => {}} isMockMode onNavigate={() => {}} />,
    );

    await openWidgetAndSend(container, {
      message: 'Here is a faction.',
      suggestions: [],
      draftEntities: [
        { id: 'draft-faction-1', type: 'faction', status: 'draft', data: { name: 'The Ashen Compact' } },
      ],
    });

    const draftChip = await waitFor(() => {
      const chip = Array.from(container.querySelectorAll('button')).find(b => (b.textContent || '').includes('The Ashen Compact'));
      expect(chip).toBeTruthy();
      return chip!;
    });
    fireEvent.click(draftChip);

    await waitFor(() => expect(factionEditorProps.length).toBeGreaterThan(0));
    expect(factionEditorProps[factionEditorProps.length - 1].isPreview).toBe(true);
  });
});

describe('wp-f2-entity-editors #64 — RealmChatWidget adventure draft editor gets mock mode + context', () => {
  it('passes isMockMode and a non-empty campaignContext to AdventureEditor for an unsaved chat draft', async () => {
    const { container } = render(
      <RealmChatWidget campaign={campaign} onAddToCampaign={() => {}} isMockMode onNavigate={() => {}} />,
    );

    await openWidgetAndSend(container, {
      message: 'Here is an adventure.',
      suggestions: [],
      draftEntities: [
        { id: 'draft-adv-1', type: 'adventure', status: 'draft', data: { title: 'Salt & Ruin' } },
      ],
    });

    const draftChip = await waitFor(() => {
      const chip = Array.from(container.querySelectorAll('button')).find(b => (b.textContent || '').includes('Salt & Ruin'));
      expect(chip).toBeTruthy();
      return chip!;
    });
    fireEvent.click(draftChip);

    await waitFor(() => expect(adventureEditorProps.length).toBeGreaterThan(0));
    const props = adventureEditorProps[adventureEditorProps.length - 1];
    expect(props.isMockMode).toBe(true);
    expect(typeof props.campaignContext).toBe('string');
    expect((props.campaignContext as string).length).toBeGreaterThan(0);
  });
});
