// @vitest-environment jsdom
/**
 * wp-f2-entity-editors — finding #105
 *
 * ArticleEditor declares `allNpcs` / `allLocations` / `allFactions` in its
 * props interface but never destructures them (line 32); lines 36-38 derive the
 * lists from `campaign?.npcs ?? []` instead. ArticleDashboard (89-93) and
 * ArticleGenerator (115-118) both render the editor as the chat-creation
 * preview passing exactly those three arrays and NO `campaign`, so the
 * "Related Entities" picker renders empty and shows
 * "Create NPCs, Locations, or Factions to link them here." in a campaign full
 * of entities — the user cannot tag related entities while drafting an article.
 *
 * Contract: the explicit props win (or at least are honoured) when `campaign`
 * is absent — `const allNpcs = propAllNpcs ?? campaign?.npcs ?? []`.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { Article, Campaign } from '../../types/index';

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

const { ArticleEditor } = await import('../../components/editors/ArticleEditor');
const { ConfirmDialogProvider } = await import('../../hooks/useConfirmDialog');

afterEach(cleanup);

const draftArticle = {
  id: 'preview',
  title: 'On the Drowned Empire',
  content: 'Long ago the sea took the throne.',
  category: 'lore',
  relatedEntityIds: [],
} as unknown as Article;

describe('wp-f2-entity-editors #105 — ArticleEditor honours the entity list props', () => {
  it('lists NPCs/locations/factions passed as props when no campaign prop is given', () => {
    // Exactly the ArticleDashboard / ArticleGenerator preview call shape.
    const { container } = render(
      <ConfirmDialogProvider>
        <ArticleEditor
          article={draftArticle}
          allArticles={[draftArticle]}
          allNpcs={[{ id: 'npc-1', name: 'Aldric Vane', history: [] }]}
          allLocations={[{ id: 'loc-1', name: 'The Sunken Ward', history: [] }]}
          allFactions={[{ id: 'fac-1', name: 'The Ashen Compact', memberIds: [] }]}
          onUpdate={() => {}}
          onDelete={() => {}}
          isMockMode
        />
      </ConfirmDialogProvider>,
    );

    const text = container.textContent || '';
    expect(text).not.toMatch(/Create NPCs, Locations, or Factions to link them here/i);
    expect(text).toContain('Aldric Vane');
    expect(text).toContain('The Sunken Ward');
    expect(text).toContain('The Ashen Compact');
  });

  it('still falls back to the campaign lists when only `campaign` is passed', () => {
    const campaign = {
      id: 'camp-1', title: 'Test Campaign',
      npcs: [{ id: 'npc-2', name: 'Brynn Kell', history: [] }],
      locations: [], factions: [], items: [], adventures: [],
      articles: [draftArticle], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
    } as unknown as Campaign;

    const { container } = render(
      <ConfirmDialogProvider>
        <ArticleEditor
          article={draftArticle}
          allArticles={[draftArticle]}
          campaign={campaign}
          onUpdate={() => {}}
          onDelete={() => {}}
          isMockMode
        />
      </ConfirmDialogProvider>,
    );

    expect(container.textContent || '').toContain('Brynn Kell');
  });
});
