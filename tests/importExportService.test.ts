/**
 * importExportService.test.ts
 *
 * Unit tests for Phase 5.1 (import validation) and 5.2 (export round-trip)
 * in services/importExportService.ts.
 *
 * All tests are pure — they call exported validation functions directly
 * without touching the DOM, FileReader, or any AI service.
 */

import { describe, it, expect } from 'vitest';
import {
  validateImportedCampaign,
  validateExportRoundTrip,
  CURRENT_CAMPAIGN_VERSION,
} from '../services/importExportService';
import type { Campaign } from '../types/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a minimal valid campaign object (passes all required checks). */
function minimalCampaign(): Record<string, unknown> {
  return {
    id: 'camp-1',
    title: 'Test Campaign',
    setting: 'A dark fantasy world.',
    settingType: 'custom',
    npcs: [],
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
  };
}

/** Returns a minimal NPC (name-keyed entity). */
function makeNpc(id: string, name?: string): Record<string, unknown> {
  const npc: Record<string, unknown> = { id };
  if (name !== undefined) npc['name'] = name;
  return npc;
}

/** Returns a minimal Adventure (title-keyed entity). */
function makeAdventure(id: string, title?: string): Record<string, unknown> {
  const adv: Record<string, unknown> = { id, hook: '', theme: '', level: 1, scenes: [] };
  if (title !== undefined) adv['title'] = title;
  return adv;
}

// ---------------------------------------------------------------------------
// validateImportedCampaign — top-level structure
// ---------------------------------------------------------------------------

describe('validateImportedCampaign — top-level structure', () => {
  it('accepts a minimal valid campaign and returns success', () => {
    const result = validateImportedCampaign(minimalCampaign());

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.campaign).toBeDefined();
  });

  it('rejects non-object input (string)', () => {
    const result = validateImportedCampaign('not an object');

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.campaign).toBeUndefined();
  });

  it('rejects non-object input (array)', () => {
    const result = validateImportedCampaign([1, 2, 3]);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects null', () => {
    const result = validateImportedCampaign(null);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects a campaign missing id', () => {
    const data = minimalCampaign();
    delete data['id'];

    const result = validateImportedCampaign(data);

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('"id"'))).toBe(true);
  });

  it('rejects a campaign missing both title and name', () => {
    const data = minimalCampaign();
    delete data['title'];

    const result = validateImportedCampaign(data);

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('"title"'))).toBe(true);
  });

  it('migrates legacy "name" field to "title" with a warning', () => {
    const data = minimalCampaign();
    delete data['title'];
    data['name'] = 'Legacy Name Campaign';

    const result = validateImportedCampaign(data);

    expect(result.success).toBe(true);
    expect(result.campaign?.title).toBe('Legacy Name Campaign');
    expect(result.warnings.some(w => w.includes('"title"'))).toBe(true);
  });

  it('stamps version onto campaigns that have no version field', () => {
    const data = minimalCampaign();
    // Ensure no version field
    delete (data as Record<string, unknown>)['version'];

    const result = validateImportedCampaign(data);

    expect(result.success).toBe(true);
    const campaign = result.campaign as unknown as Record<string, unknown>;
    expect(campaign['version']).toBe(CURRENT_CAMPAIGN_VERSION);
    // Should emit a warning about missing version
    expect(result.warnings.some(w => w.includes('version'))).toBe(true);
  });

  it('preserves existing version field when already set', () => {
    const data = { ...minimalCampaign(), version: CURRENT_CAMPAIGN_VERSION };

    const result = validateImportedCampaign(data);

    expect(result.success).toBe(true);
    // No version-related warning expected when version is already present
    const versionWarnings = result.warnings.filter(w =>
      w.toLowerCase().includes('version'),
    );
    expect(versionWarnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// validateImportedCampaign — entity array normalisation
// ---------------------------------------------------------------------------

describe('validateImportedCampaign — missing entity arrays', () => {
  it('initialises missing name-keyed arrays to empty arrays', () => {
    const data = minimalCampaign();
    delete data['npcs'];
    delete data['locations'];
    delete data['factions'];
    delete data['items'];

    const result = validateImportedCampaign(data);

    expect(result.success).toBe(true);
    expect(Array.isArray(result.campaign?.npcs)).toBe(true);
    expect(Array.isArray(result.campaign?.locations)).toBe(true);
    expect(Array.isArray(result.campaign?.factions)).toBe(true);
    expect(Array.isArray(result.campaign?.items)).toBe(true);
  });

  it('initialises missing title-keyed arrays to empty arrays', () => {
    const data = minimalCampaign();
    delete data['adventures'];
    delete data['articles'];
    delete data['sessionLogs'];
    delete data['plots'];
    delete data['notes'];
    delete data['secrets'];

    const result = validateImportedCampaign(data);

    expect(result.success).toBe(true);
    expect(Array.isArray(result.campaign?.adventures)).toBe(true);
    expect(Array.isArray(result.campaign?.articles)).toBe(true);
    expect(Array.isArray(result.campaign?.sessionLogs)).toBe(true);
    expect(Array.isArray(result.campaign?.plots)).toBe(true);
    expect(Array.isArray(result.campaign?.notes)).toBe(true);
  });

  it('initialises missing playerCharacters array', () => {
    const data = minimalCampaign();
    delete data['playerCharacters'];

    const result = validateImportedCampaign(data);

    expect(result.success).toBe(true);
    expect(Array.isArray(result.campaign?.playerCharacters)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateImportedCampaign — entity-level validation (name-keyed)
// ---------------------------------------------------------------------------

describe('validateImportedCampaign — NPC entity validation', () => {
  it('accepts valid NPCs without warnings', () => {
    const data = minimalCampaign();
    data['npcs'] = [makeNpc('npc-1', 'Goblin King'), makeNpc('npc-2', 'The Elder')];

    const result = validateImportedCampaign(data);

    expect(result.success).toBe(true);
    expect(result.campaign?.npcs).toHaveLength(2);
    const npcWarnings = result.warnings.filter(w => w.includes('NPC'));
    expect(npcWarnings).toHaveLength(0);
  });

  it('auto-generates names for NPCs missing names and emits a warning', () => {
    const data = minimalCampaign();
    data['npcs'] = [makeNpc('npc-1'), makeNpc('npc-2')]; // both missing name

    const result = validateImportedCampaign(data);

    expect(result.success).toBe(true);
    expect(result.campaign?.npcs).toHaveLength(2);
    // Both should now have names
    result.campaign?.npcs.forEach(npc => {
      expect(typeof npc.name).toBe('string');
      expect(npc.name.length).toBeGreaterThan(0);
    });
    // Warning should mention NPCs and count
    const npcWarning = result.warnings.find(w => w.includes('NPC') && w.includes('missing names'));
    expect(npcWarning).toBeTruthy();
    expect(npcWarning).toContain('2');
  });

  it('removes NPCs missing the required id field and emits a warning', () => {
    const data = minimalCampaign();
    data['npcs'] = [
      makeNpc('npc-1', 'Valid NPC'),
      { name: 'No ID NPC' }, // missing id
      { name: 'Also No ID' }, // missing id
    ];

    const result = validateImportedCampaign(data);

    expect(result.success).toBe(true);
    expect(result.campaign?.npcs).toHaveLength(1);
    const removalWarning = result.warnings.find(w => w.includes('NPC') && w.includes('removed'));
    expect(removalWarning).toBeTruthy();
    expect(removalWarning).toContain('2');
  });

  it('handles empty string id as invalid', () => {
    const data = minimalCampaign();
    data['npcs'] = [{ id: '', name: 'Empty ID NPC' }];

    const result = validateImportedCampaign(data);

    expect(result.success).toBe(true);
    // Should be removed because id is an empty string
    expect(result.campaign?.npcs).toHaveLength(0);
  });

  it('handles non-array npcs field (e.g., null) by resetting to empty', () => {
    const data = minimalCampaign();
    data['npcs'] = null;

    const result = validateImportedCampaign(data);

    expect(result.success).toBe(true);
    expect(result.campaign?.npcs).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateImportedCampaign — entity-level validation (title-keyed)
// ---------------------------------------------------------------------------

describe('validateImportedCampaign — Adventure entity validation', () => {
  it('accepts valid adventures without warnings', () => {
    const data = minimalCampaign();
    data['adventures'] = [makeAdventure('adv-1', 'The Lost Tomb')];

    const result = validateImportedCampaign(data);

    expect(result.success).toBe(true);
    expect(result.campaign?.adventures).toHaveLength(1);
  });

  it('auto-generates titles for adventures missing titles and emits a warning', () => {
    const data = minimalCampaign();
    data['adventures'] = [makeAdventure('adv-1')]; // missing title

    const result = validateImportedCampaign(data);

    expect(result.success).toBe(true);
    expect(result.campaign?.adventures).toHaveLength(1);
    const adv = result.campaign?.adventures[0];
    expect(typeof adv?.title).toBe('string');
    expect(adv?.title.length).toBeGreaterThan(0);
    const warning = result.warnings.find(w => w.includes('Adventure') && w.includes('missing titles'));
    expect(warning).toBeTruthy();
  });

  it('removes adventures missing id and emits a warning', () => {
    const data = minimalCampaign();
    data['adventures'] = [
      makeAdventure('adv-1', 'Valid'),
      { title: 'No ID Adventure', hook: '', theme: '', level: 1, scenes: [] },
    ];

    const result = validateImportedCampaign(data);

    expect(result.success).toBe(true);
    expect(result.campaign?.adventures).toHaveLength(1);
    const warning = result.warnings.find(w => w.includes('Adventure') && w.includes('removed'));
    expect(warning).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// validateImportedCampaign — required array field backfilling
// ---------------------------------------------------------------------------

describe('validateImportedCampaign — required array field backfilling', () => {
  it('defaults Faction.memberIds to [] when missing from a hand-edited import', () => {
    const data = minimalCampaign();
    data['factions'] = [{ id: 'f1', name: 'Thieves Guild' }]; // no memberIds

    const result = validateImportedCampaign(data);

    expect(result.success).toBe(true);
    const faction = result.campaign?.factions[0];
    expect(Array.isArray(faction?.memberIds)).toBe(true);
    expect(faction?.memberIds).toEqual([]);
  });

  it('defaults Location.subLocationIds and history to [] when missing', () => {
    const data = minimalCampaign();
    data['locations'] = [{ id: 'l1', name: 'Old Tower' }]; // no subLocationIds/history

    const result = validateImportedCampaign(data);

    expect(result.success).toBe(true);
    const location = result.campaign?.locations[0];
    expect(location?.subLocationIds).toEqual([]);
    expect(location?.history).toEqual([]);
  });

  it('defaults NPC.relationships, history, and knowsPlayerHistory to []', () => {
    const data = minimalCampaign();
    data['npcs'] = [{ id: 'n1', name: 'Stranger' }];

    const result = validateImportedCampaign(data);

    expect(result.success).toBe(true);
    const npc = result.campaign?.npcs[0];
    expect(npc?.relationships).toEqual([]);
    expect(npc?.history).toEqual([]);
    expect(npc?.knowsPlayerHistory).toEqual([]);
  });

  it('defaults Adventure.scenes and Scene.npcIds/skillChecks to []', () => {
    const data = minimalCampaign();
    data['adventures'] = [{ id: 'a1', title: 'The Heist', scenes: [{ id: 's1', title: 'Break-in' }] }];

    const result = validateImportedCampaign(data);

    expect(result.success).toBe(true);
    const adventure = result.campaign?.adventures[0];
    expect(Array.isArray(adventure?.scenes)).toBe(true);
    const scene = adventure?.scenes[0] as unknown as { npcIds: unknown; skillChecks: unknown };
    expect(scene.npcIds).toEqual([]);
    expect(scene.skillChecks).toEqual([]);
  });

  it('defaults a missing Adventure.scenes array entirely to []', () => {
    const data = minimalCampaign();
    data['adventures'] = [{ id: 'a1', title: 'No Scenes Field' }]; // scenes omitted

    const result = validateImportedCampaign(data);

    expect(result.success).toBe(true);
    expect(result.campaign?.adventures[0].scenes).toEqual([]);
  });

  it('defaults Article.subArticleIds, Plot.relatedEntityIds, and Note.tags to []', () => {
    const data = minimalCampaign();
    data['articles'] = [{ id: 'art1', title: 'Lore Entry', category: 'lore', content: '' }];
    data['plots'] = [{ id: 'p1', title: 'Main Plot', description: '', status: 'active' }];
    data['notes'] = [{ id: 'note1', title: 'Reminder', content: '', createdAt: '', lastModified: '' }];

    const result = validateImportedCampaign(data);

    expect(result.success).toBe(true);
    expect(result.campaign?.articles[0].subArticleIds).toEqual([]);
    expect(result.campaign?.plots[0].relatedEntityIds).toEqual([]);
    expect(result.campaign?.notes[0].tags).toEqual([]);
  });

  it('defaults SessionLog array fields (plannedSceneIds, relatedPlotIds, structuredNotes, encounterLog) to []', () => {
    const data = minimalCampaign();
    data['sessionLogs'] = [{ id: 'sl1', title: 'Session 1', status: 'completed', sessionDate: '2026-01-01', prepNotes: '', runningNotes: '', recap: '', notableEvents: '', looseEnds: '' }];

    const result = validateImportedCampaign(data);

    expect(result.success).toBe(true);
    const log = result.campaign?.sessionLogs[0];
    expect(log?.plannedSceneIds).toEqual([]);
    expect(log?.relatedPlotIds).toEqual([]);
    expect(log?.structuredNotes).toEqual([]);
    expect(log?.encounterLog).toEqual([]);
  });

  it('does not overwrite existing valid array fields', () => {
    const data = minimalCampaign();
    data['factions'] = [{ id: 'f1', name: 'Thieves Guild', memberIds: ['npc-1', 'npc-2'] }];

    const result = validateImportedCampaign(data);

    expect(result.campaign?.factions[0].memberIds).toEqual(['npc-1', 'npc-2']);
  });
});

// ---------------------------------------------------------------------------
// validateImportedCampaign — mixed valid/invalid arrays
// ---------------------------------------------------------------------------

describe('validateImportedCampaign — mixed entity scenarios', () => {
  it('correctly validates a campaign with multiple entity type issues in one pass', () => {
    const data = minimalCampaign();
    data['npcs'] = [makeNpc('npc-1', 'Druid'), { name: 'No ID' }]; // 1 invalid
    data['locations'] = [makeNpc('loc-1')]; // valid id, missing name → auto-named
    data['adventures'] = [makeAdventure('adv-1', 'The Quest')]; // valid

    const result = validateImportedCampaign(data);

    expect(result.success).toBe(true);
    expect(result.campaign?.npcs).toHaveLength(1); // invalid removed
    expect(result.campaign?.locations).toHaveLength(1); // auto-named, kept
    expect(result.campaign?.adventures).toHaveLength(1);
    // Should have 2 distinct warnings: one for removal, one for auto-name
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// validateExportRoundTrip
// ---------------------------------------------------------------------------

describe('validateExportRoundTrip', () => {
  /** Build a minimal Campaign fixture (cast to Campaign for the test). */
  function campaignFixture(): Campaign {
    return {
      id: 'camp-test',
      title: 'Round Trip Test',
      setting: 'A test setting',
      settingType: 'custom',
      npcs: [{ id: 'n1', name: 'NPC 1', description: '', traits: '', backstory: '',
                motivations: '', secrets: '', stats: '', exampleQuote: '',
                knowsPlayerHistory: [], relationships: [], history: [] }],
      locations: [],
      factions: [],
      items: [],
      adventures: [],
      articles: [],
      sessionLogs: [],
      playerCharacters: [],
      plots: [],
      notes: [],
    };
  }

  it('returns roundTripOk:true for a valid JSON string that matches original counts', () => {
    const campaign = campaignFixture();
    const json = JSON.stringify(campaign, null, 2);

    const result = validateExportRoundTrip(campaign, json);

    expect(result.roundTripOk).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  it('returns roundTripOk:false when the parsed JSON has fewer NPCs than the original', () => {
    const campaign = campaignFixture();
    // Corrupt the JSON string so npcs array is empty after parse
    const parsed = { ...campaign, npcs: [] };
    const corruptJson = JSON.stringify(parsed, null, 2);

    const result = validateExportRoundTrip(campaign, corruptJson);

    expect(result.roundTripOk).toBe(false);
    expect(typeof result.warning).toBe('string');
    expect(result.warning).toContain('npcs');
  });

  it('returns roundTripOk:false when the parsed JSON has fewer secrets than the original', () => {
    const campaign = {
      ...campaignFixture(),
      secrets: [
        { id: 's1', title: 'Secret 1', content: '', category: 'secret', isRevealed: false, createdAt: '2026-01-01' },
      ],
    } as Campaign;
    // Corrupt the JSON string so secrets array is empty after parse
    const parsed = { ...campaign, secrets: [] };
    const corruptJson = JSON.stringify(parsed, null, 2);

    const result = validateExportRoundTrip(campaign, corruptJson);

    expect(result.roundTripOk).toBe(false);
    expect(result.warning).toContain('secrets');
  });

  it('returns roundTripOk:false when JSON.parse throws (malformed string)', () => {
    const campaign = campaignFixture();

    const result = validateExportRoundTrip(campaign, 'not valid json {{{');

    expect(result.roundTripOk).toBe(false);
    expect(typeof result.warning).toBe('string');
  });

  it('returns roundTripOk:true for a campaign with no entities (all empty arrays)', () => {
    const campaign = {
      ...campaignFixture(),
      npcs: [],
      locations: [],
      factions: [],
      items: [],
      adventures: [],
      articles: [],
      sessionLogs: [],
      playerCharacters: [],
      plots: [],
      notes: [],
    } as Campaign;
    const json = JSON.stringify(campaign, null, 2);

    const result = validateExportRoundTrip(campaign, json);

    expect(result.roundTripOk).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CURRENT_CAMPAIGN_VERSION
// ---------------------------------------------------------------------------

describe('CURRENT_CAMPAIGN_VERSION', () => {
  it('is a positive integer', () => {
    expect(typeof CURRENT_CAMPAIGN_VERSION).toBe('number');
    expect(Number.isInteger(CURRENT_CAMPAIGN_VERSION)).toBe(true);
    expect(CURRENT_CAMPAIGN_VERSION).toBeGreaterThan(0);
  });
});
