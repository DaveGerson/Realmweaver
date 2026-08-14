/**
 * wp-b-import-export.template-import.test.ts
 *
 * Red-first tests for idx 93 — `campaignService.importTemplateData` silently
 * discards articles, notes, secrets, session logs and player characters,
 * hardcodes `connections: []` / `loot: []` / `relationships: []` /
 * `history: []`, and `remap()` mints a fresh UUID for ANY unknown id, turning
 * a typo'd cross-reference into a dangling pointer instead of dropping it.
 *
 * The documented contract (data/testCampaigns.ts) is that a full campaign
 * export — "the same shape produced by Export Campaign" — can be dropped in
 * as a template, so nothing in that shape may be dropped on the floor.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  setupTestEnvironment,
  makeTestStore,
  type CreateCampaignStoreFn,
} from '../helpers/testStoreFactory';

setupTestEnvironment();

let createCampaignStore: CreateCampaignStoreFn;

beforeAll(async () => {
  const mod = await import('../../services/campaignService');
  createCampaignStore = mod.createCampaignStore;
});

/** An export-shaped template with lore, relationships and one dangling ref. */
function richTemplate(): Record<string, unknown> {
  return {
    title: 'Template Campaign',
    setting: 'A borrowed world.',
    settingType: 'custom',
    npcs: [
      {
        id: 'npc-1',
        name: 'Aldric',
        description: 'A knight.',
        relationships: [
          { id: 'rel-1', targetId: 'npc-2', relationType: 'Rival', description: 'Old grudge' },
        ],
        history: [
          { id: 'hist-1', summary: 'Lost the duel at Greenhollow.', referenceType: 'manual' },
        ],
      },
      { id: 'npc-2', name: 'Brea', description: 'A spy.' },
    ],
    locations: [
      {
        id: 'loc-1',
        name: 'The Keep',
        description: 'Stone and cold.',
        subLocationIds: [],
        connections: [
          { id: 'conn-1', targetLocationId: 'loc-2', description: 'The old road' },
        ],
        loot: [{ id: 'loot-1', description: 'A tarnished signet ring' }],
      },
      { id: 'loc-2', name: 'Greenhollow', description: 'A village.', subLocationIds: [] },
    ],
    articles: [
      {
        id: 'art-1',
        title: 'The Founding',
        category: 'lore',
        content: 'Long ago...',
        subArticleIds: ['art-2'],
        relatedEntityIds: ['npc-1'],
      },
      {
        id: 'art-2',
        title: 'The Second Age',
        category: 'history',
        content: 'Then...',
        parentArticleId: 'art-1',
        subArticleIds: [],
      },
    ],
    notes: [
      {
        id: 'note-1',
        title: 'Session idea',
        content: 'Ambush on the old road.',
        tags: ['Idea'],
        createdAt: '2026-01-01T00:00:00.000Z',
        lastModified: '2026-01-01T00:00:00.000Z',
      },
    ],
    secrets: [
      {
        id: 'sec-1',
        title: 'Brea works for the crown',
        content: 'She reports weekly.',
        category: 'secret',
        isRevealed: false,
        linkedEntityIds: ['npc-2'],
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    plots: [
      {
        id: 'plot-1',
        title: 'The Grudge',
        description: 'Aldric vs Brea.',
        status: 'active',
        // 'ghost-404' does not exist anywhere in this template.
        relatedEntityIds: ['npc-1', 'ghost-404'],
      },
    ],
  };
}

describe('idx 93 — importTemplateData preserves the full export shape', () => {
  it('imports articles and remaps their parent/sub/related references', () => {
    const { service, campaign } = makeTestStore(createCampaignStore);

    service.importTemplateData(richTemplate());

    const articles = campaign().articles;
    expect(articles).toHaveLength(2);

    const founding = articles.find((a) => a.title === 'The Founding')!;
    const secondAge = articles.find((a) => a.title === 'The Second Age')!;
    expect(founding).toBeDefined();
    expect(secondAge).toBeDefined();

    // Ids were remapped, but the hierarchy still points at the imported rows.
    expect(secondAge.parentArticleId).toBe(founding.id);
    expect(founding.subArticleIds).toEqual([secondAge.id]);

    // Cross-entity reference resolves to the imported NPC, not a stale id.
    const aldric = campaign().npcs.find((n) => n.name === 'Aldric')!;
    expect(founding.relatedEntityIds).toEqual([aldric.id]);
  });

  it('imports notes and secrets', () => {
    const { service, campaign } = makeTestStore(createCampaignStore);

    service.importTemplateData(richTemplate());

    expect(campaign().notes.map((n) => n.title)).toContain('Session idea');
    expect(campaign().secrets.map((s) => s.title)).toContain('Brea works for the crown');

    const brea = campaign().npcs.find((n) => n.name === 'Brea')!;
    const secret = campaign().secrets.find((s) => s.title === 'Brea works for the crown')!;
    expect(secret.linkedEntityIds).toEqual([brea.id]);
  });

  it('preserves location connections/loot and NPC relationships/history', () => {
    const { service, campaign } = makeTestStore(createCampaignStore);

    service.importTemplateData(richTemplate());

    const keep = campaign().locations.find((l) => l.name === 'The Keep')!;
    const greenhollow = campaign().locations.find((l) => l.name === 'Greenhollow')!;
    expect(keep.connections ?? []).toHaveLength(1);
    expect((keep.connections ?? [])[0]?.targetLocationId).toBe(greenhollow.id);
    expect(keep.loot ?? []).toHaveLength(1);

    const aldric = campaign().npcs.find((n) => n.name === 'Aldric')!;
    const brea = campaign().npcs.find((n) => n.name === 'Brea')!;
    expect(aldric.relationships).toHaveLength(1);
    expect(aldric.relationships[0].targetId).toBe(brea.id);
    expect(aldric.history).toHaveLength(1);
  });

  it('drops references to ids that no imported entity owns instead of minting a dangling UUID', () => {
    const { service, campaign } = makeTestStore(createCampaignStore);

    service.importTemplateData(richTemplate());

    const plot = campaign().plots.find((p) => p.title === 'The Grudge')!;
    const aldric = campaign().npcs.find((n) => n.name === 'Aldric')!;

    // 'ghost-404' must be filtered out, not turned into a fresh UUID that
    // points at nothing.
    expect(plot.relatedEntityIds).toEqual([aldric.id]);

    // Every id referenced by the imported campaign must resolve to a real row.
    const knownIds = new Set<string>([
      ...campaign().npcs.map((n) => n.id),
      ...campaign().locations.map((l) => l.id),
      ...campaign().factions.map((f) => f.id),
      ...campaign().items.map((i) => i.id),
      ...campaign().articles.map((a) => a.id),
    ]);
    for (const id of plot.relatedEntityIds) {
      expect(knownIds.has(id)).toBe(true);
    }
  });

  it('imports session logs and player characters from an export-shaped template', () => {
    const { service, campaign } = makeTestStore(createCampaignStore);

    const template = {
      ...richTemplate(),
      sessionLogs: [
        {
          id: 'log-1',
          title: 'Session 1 — The Old Road',
          status: 'completed',
          sessionDate: '2026-01-02T00:00:00.000Z',
          plannedSceneIds: [],
          prepNotes: '',
          relatedPlotIds: ['plot-1'],
          runningNotes: '',
          structuredNotes: [],
          encounterLog: [],
          recap: 'They fought on the road.',
          notableEvents: '',
          looseEnds: '',
        },
      ],
      playerCharacters: [
        { id: 'pc-1', social: { characterName: 'Mira' } },
      ],
    };

    service.importTemplateData(template);

    expect(campaign().sessionLogs).toHaveLength(1);
    expect(campaign().sessionLogs[0].title).toBe('Session 1 — The Old Road');
    expect(campaign().playerCharacters).toHaveLength(1);
  });
});
