// @vitest-environment jsdom
/**
 * wp-b-import-export.import-warnings.test.ts
 *
 * Red-first test for idx 12 — import warnings are discarded.
 *
 * `campaignService.importCampaign` currently calls `importCampaignFromJson`
 * (the throw-on-error wrapper) and returns only `campaign.title`, so the
 * warnings array built by `validateImportedCampaign` ("12 NPC(s) were removed
 * because they were missing a required \"id\" field.") never reaches the UI —
 * App.tsx shows an unconditional 'imported successfully!' toast.
 *
 * Desired contract: `importCampaign` resolves to
 *   { title: string; warnings: string[] }
 * so the caller can surface each warning.
 *
 * jsdom is required for File/FileReader.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestEnvironment, type CreateCampaignStoreFn } from '../helpers/testStoreFactory';

setupTestEnvironment();

let createCampaignStore: CreateCampaignStoreFn;

beforeAll(async () => {
  const mod = await import('../../services/campaignService');
  createCampaignStore = mod.createCampaignStore;
});

/** Export-shaped JSON where two NPCs lost their `id` during a hand-edit. */
function lossyExportJson(): string {
  return JSON.stringify({
    id: 'imported-campaign-1',
    title: 'Broken Campaign',
    setting: 'A world with holes in it.',
    settingType: 'custom',
    version: 1,
    npcs: [
      { id: 'npc-keep', name: 'Survivor' },
      { name: 'Lost One' },
      { name: 'Lost Two' },
    ],
    locations: [],
    factions: [],
    items: [],
    adventures: [],
    articles: [],
    sessionLogs: [],
    playerCharacters: [],
    plots: [],
    notes: [],
    secrets: [],
  });
}

describe('idx 12 — campaignService.importCampaign surfaces validation warnings', () => {
  it('resolves to { title, warnings } and reports the dropped NPCs', async () => {
    const service = createCampaignStore({ persist: false });
    service.init();

    const file = new File([lossyExportJson()], 'broken-campaign.json', {
      type: 'application/json',
    });

    const result = (await service.importCampaign(file)) as unknown as {
      title: string;
      warnings: string[];
    };

    // Today this resolves to the bare string 'Broken Campaign'.
    expect(typeof result).toBe('object');
    expect(result?.title).toBe('Broken Campaign');
    expect(Array.isArray(result?.warnings)).toBe(true);
    expect(
      result.warnings.some((w) => /2 NPC\(s\) were removed/i.test(w)),
    ).toBe(true);

    // The campaign is still imported — warnings are informational, not fatal.
    const imported = service
      .getState()
      .campaigns.find((c) => c.title === 'Broken Campaign');
    expect(imported).toBeDefined();
    expect(imported!.npcs).toHaveLength(1);
  });

  it('resolves with an EMPTY warnings array for a clean import', async () => {
    const service = createCampaignStore({ persist: false });
    service.init();

    const clean = JSON.stringify({
      id: 'imported-campaign-2',
      title: 'Clean Campaign',
      setting: 'Everything in its place.',
      settingType: 'custom',
      version: 1,
      npcs: [{ id: 'npc-1', name: 'Aldric' }],
      locations: [],
      factions: [],
      items: [],
      adventures: [],
      articles: [],
      sessionLogs: [],
      playerCharacters: [],
      plots: [],
      notes: [],
      secrets: [],
    });

    const file = new File([clean], 'clean-campaign.json', { type: 'application/json' });

    const result = (await service.importCampaign(file)) as unknown as {
      title: string;
      warnings: string[];
    };

    expect(typeof result).toBe('object');
    expect(result?.title).toBe('Clean Campaign');
    expect(result?.warnings).toEqual([]);
  });
});
