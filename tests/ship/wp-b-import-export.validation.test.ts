/**
 * wp-b-import-export.validation.test.ts
 *
 * Red-first tests for import-validation defects in
 * services/importExportService.ts:
 *
 *   idx 36 — duplicate entity ids are accepted, silently aliasing entities
 *   idx 37 — exports from a FUTURE schema version are silently downgraded
 *   idx 95 — dead `if (data[key] !== undefined)` emits a bogus
 *            '"npcs" field was not an array' warning on every normal import
 *
 * Verifier follow-up findings (fixed in this package):
 *   idx 1 (verify) — dedupeIdsAcrossCampaign only scanned the eleven
 *            top-level arrays; duplicate ids nested inside
 *            adventures[].scenes / locations[].pointsOfInterest /
 *            locations[].loot passed through silently.
 *   idx 5 (verify) — the future-version guard ran AFTER the legacy
 *            name->title migration, so a rejected future-version file that
 *            used the legacy `name` field still got mutated before the
 *            reject was returned.
 *
 * Pure tests: no DOM, no FileReader, no AI.
 */

import { describe, it, expect } from 'vitest';
import {
  validateImportedCampaign,
  CURRENT_CAMPAIGN_VERSION,
} from '../../services/importExportService';

/** Minimal campaign object that already satisfies the required-field checks. */
function baseCampaign(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'camp-1',
    title: 'Test Campaign',
    setting: 'A dark fantasy world.',
    settingType: 'custom',
    version: CURRENT_CAMPAIGN_VERSION,
    ...overrides,
  };
}

const notAnArrayWarnings = (warnings: string[]): string[] =>
  warnings.filter((w) => /was not an array/i.test(w));

// ---------------------------------------------------------------------------
// idx 95 — false "field was not an array" warnings
// ---------------------------------------------------------------------------

describe('idx 95 — "field was not an array" warning only fires when the field is present', () => {
  it('emits NO array warnings for a campaign that simply has no entity arrays yet', () => {
    // A young campaign export: id + title + version, no entity arrays at all.
    const result = validateImportedCampaign(baseCampaign());

    expect(result.success).toBe(true);
    // Absent !== wrong type. Nothing was "reset" because nothing was there.
    expect(notAnArrayWarnings(result.warnings)).toEqual([]);
  });

  it('emits exactly one array warning for the ONE name-keyed field that is present but the wrong type', () => {
    const result = validateImportedCampaign(baseCampaign({ npcs: 'oops-not-an-array' }));

    expect(result.success).toBe(true);
    expect(result.campaign!.npcs).toEqual([]);

    const arrayWarnings = notAnArrayWarnings(result.warnings);
    expect(arrayWarnings).toHaveLength(1);
    expect(arrayWarnings[0]).toContain('npcs');
    // locations / factions / items were absent, not malformed.
    expect(arrayWarnings.some((w) => /locations|factions|items/.test(w))).toBe(false);
  });

  it('warns for title-keyed fields that are present but the wrong type (loop parity)', () => {
    const result = validateImportedCampaign(baseCampaign({ adventures: { nope: true } }));

    expect(result.success).toBe(true);
    expect(result.campaign!.adventures).toEqual([]);

    const arrayWarnings = notAnArrayWarnings(result.warnings);
    expect(arrayWarnings).toHaveLength(1);
    expect(arrayWarnings[0]).toContain('adventures');
  });
});

// ---------------------------------------------------------------------------
// idx 37 — future schema version must be rejected, not downgraded
// ---------------------------------------------------------------------------

describe('idx 37 — a file from a newer schema version is rejected, not silently downgraded', () => {
  it('fails validation and reports a "newer version" error', () => {
    const future = baseCampaign({ version: CURRENT_CAMPAIGN_VERSION + 1 });

    const result = validateImportedCampaign(future);

    expect(result.success).toBe(false);
    expect(result.campaign).toBeUndefined();
    expect(result.errors.some((e) => /newer version/i.test(e))).toBe(true);
  });

  it('does NOT rewrite the version stamp of a future-version file', () => {
    const future = baseCampaign({ version: CURRENT_CAMPAIGN_VERSION + 1 });

    validateImportedCampaign(future);

    // The provenance of the file must survive validation untouched, so a
    // re-export cannot launder a v(N+1) file into a v(N) file.
    expect(future['version']).toBe(CURRENT_CAMPAIGN_VERSION + 1);
  });

  it('still accepts a file at exactly the current version', () => {
    const result = validateImportedCampaign(baseCampaign({ version: CURRENT_CAMPAIGN_VERSION }));
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// idx 36 — duplicate entity ids
// ---------------------------------------------------------------------------

describe('idx 36 — duplicate entity ids are not allowed through the validator', () => {
  it('de-duplicates ids inside a single entity array and warns about it', () => {
    const result = validateImportedCampaign(
      baseCampaign({
        npcs: [
          { id: 'npc-1', name: 'Original Aldric' },
          { id: 'npc-1', name: 'Hand-Cloned Aldric' },
        ],
      }),
    );

    expect(result.success).toBe(true);

    const npcs = result.campaign!.npcs;
    const ids = npcs.map((n) => n.id);
    // Either the duplicate was dropped or it was given a fresh id — but two
    // entities may never share an id, because every CRUD path resolves by
    // `find(e => e.id === id)` and would silently edit/delete the wrong one.
    expect(new Set(ids).size).toBe(ids.length);

    // The first occurrence keeps its identity.
    const original = npcs.find((n) => n.id === 'npc-1');
    expect(original).toBeDefined();
    expect(original!.name).toBe('Original Aldric');

    expect(result.warnings.some((w) => /duplicate/i.test(w))).toBe(true);
  });

  it('de-duplicates ids across different entity arrays (campaign-wide uniqueness)', () => {
    const result = validateImportedCampaign(
      baseCampaign({
        npcs: [{ id: 'shared-1', name: 'The NPC' }],
        locations: [{ id: 'shared-1', name: 'The Location' }],
      }),
    );

    expect(result.success).toBe(true);

    const allIds = [
      ...result.campaign!.npcs.map((n) => n.id),
      ...result.campaign!.locations.map((l) => l.id),
    ];
    expect(new Set(allIds).size).toBe(allIds.length);
    expect(result.warnings.some((w) => /duplicate/i.test(w))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Verify idx 1 — nested collections (scenes / PoIs / loot) must also be
  // deduped, since they are resolved by `id` exactly like the top-level
  // arrays (updateScene/deleteScene in campaignService.ts,
  // LocationEditor.tsx's PoI/loot lookups).
  // -------------------------------------------------------------------------

  it('de-duplicates scene ids nested inside adventures[].scenes, campaign-wide', () => {
    const result = validateImportedCampaign(
      baseCampaign({
        adventures: [
          {
            id: 'a1',
            title: 'A',
            scenes: [
              { id: 's1', title: 'Original Scene', npcIds: [] },
              { id: 's1', title: 'Hand-Cloned Scene', npcIds: [] },
            ],
          },
          {
            id: 'a2',
            title: 'B',
            scenes: [{ id: 's1', title: 'Also colliding', npcIds: [] }],
          },
        ],
      }),
    );

    expect(result.success).toBe(true);

    const allSceneIds = result.campaign!.adventures.flatMap((a) => a.scenes.map((s) => s.id));
    expect(new Set(allSceneIds).size).toBe(allSceneIds.length);
    // Total 3 scenes went in, 2 duplicates dropped -> 1 remains.
    expect(allSceneIds).toEqual(['s1']);

    const firstAdventure = result.campaign!.adventures.find((a) => a.id === 'a1')!;
    expect(firstAdventure.scenes[0].title).toBe('Original Scene');

    expect(result.warnings.some((w) => /duplicate/i.test(w))).toBe(true);
  });

  it('drops a scene id that collides with an NPC id elsewhere in the campaign', () => {
    const result = validateImportedCampaign(
      baseCampaign({
        npcs: [{ id: 'shared-2', name: 'The NPC' }],
        adventures: [
          {
            id: 'a1',
            title: 'A',
            scenes: [{ id: 'shared-2', title: 'Colliding Scene', npcIds: [] }],
          },
        ],
      }),
    );

    expect(result.success).toBe(true);
    // The NPC (first in ID_BEARING_ARRAY_KEYS order) keeps the id; the
    // colliding scene is dropped rather than aliasing it.
    expect(result.campaign!.npcs.map((n) => n.id)).toEqual(['shared-2']);
    expect(result.campaign!.adventures[0].scenes).toEqual([]);
    expect(result.warnings.some((w) => /duplicate/i.test(w))).toBe(true);
  });

  it('de-duplicates points-of-interest and loot ids nested inside locations[]', () => {
    const result = validateImportedCampaign(
      baseCampaign({
        locations: [
          {
            id: 'loc-1',
            name: 'The Keep',
            pointsOfInterest: [
              { id: 'poi-1', name: 'Original PoI' },
              { id: 'poi-1', name: 'Cloned PoI' },
            ],
            loot: [
              { id: 'loot-1', description: 'Original Loot' },
              { id: 'loot-1', description: 'Cloned Loot' },
            ],
          },
        ],
      }),
    );

    expect(result.success).toBe(true);

    const loc = result.campaign!.locations[0] as unknown as {
      pointsOfInterest: Array<{ id: string; name: string }>;
      loot: Array<{ id: string; description: string }>;
    };
    expect(loc.pointsOfInterest.map((p) => p.id)).toEqual(['poi-1']);
    expect(loc.pointsOfInterest[0].name).toBe('Original PoI');
    expect(loc.loot.map((l) => l.id)).toEqual(['loot-1']);
    expect(loc.loot[0].description).toBe('Original Loot');

    expect(result.warnings.some((w) => /duplicate/i.test(w))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Verify idx 5 — the future-version guard must run BEFORE any mutation,
// including the legacy "name" -> "title" migration.
// ---------------------------------------------------------------------------

describe('verify idx 5 — future-version rejection happens before any mutation', () => {
  it('does not migrate the legacy "name" field on an object rejected for being a future version', () => {
    const future: Record<string, unknown> = {
      id: 'camp-legacy',
      name: 'Legacy-Named Campaign',
      version: CURRENT_CAMPAIGN_VERSION + 1,
    };

    const result = validateImportedCampaign(future);

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => /newer version/i.test(e))).toBe(true);
    // No migration warning should have been produced...
    expect(result.warnings.some((w) => /legacy "name"/i.test(w))).toBe(false);
    // ...and the caller's object must not have been mutated with a `title`.
    expect(future['title']).toBeUndefined();
  });

  it('does not add a placeholder id-check error side effect before the version check', () => {
    // No id at all AND a future version: the version rejection must win,
    // and it must be the ONLY error (proving it ran first / short-circuited).
    const future = { version: CURRENT_CAMPAIGN_VERSION + 1 };

    const result = validateImportedCampaign(future);

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/newer version/i);
  });
});
