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
});
