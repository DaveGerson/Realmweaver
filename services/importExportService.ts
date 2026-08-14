// FIX: Updated type import path to use the barrel file 'types/index.ts'.
import type { Campaign, Article } from '../types/index';

// ---------------------------------------------------------------------------
// Version constants
// ---------------------------------------------------------------------------

/** Current schema version stamped into every export. Bump this when the
 * Campaign schema makes a breaking change so migrations can be targeted. */
export const CURRENT_CAMPAIGN_VERSION = 1;

// ---------------------------------------------------------------------------
// Validation result types
// ---------------------------------------------------------------------------

export interface ImportValidationResult {
  success: boolean;
  campaign?: Campaign;
  errors: string[];
  warnings: string[];
}

export interface ExportValidationResult {
  roundTripOk: boolean;
  warning?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns true when value is a non-null plain object (not an array). */
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Returns true when value is a non-empty string. */
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

// ---------------------------------------------------------------------------
// Entity-level validators
// Each returns { valid, autoName? } so callers can decide whether to
// auto-fix (warning) or reject (error).
// ---------------------------------------------------------------------------

interface EntityCheckResult {
  /** Whether the entity is structurally usable (has an id). */
  valid: boolean;
  /** When true, the entity was missing a name/title and a generated one was
   *  substituted — the caller should emit a warning. */
  autoNamed: boolean;
}

/** Validates an entity that uses the `name` field (NPC, Location, Faction, Item). */
const checkNameEntity = (
  entity: unknown,
  index: number,
  kind: string,
): EntityCheckResult => {
  if (!isPlainObject(entity)) return { valid: false, autoNamed: false };
  if (!isNonEmptyString(entity['id'])) return { valid: false, autoNamed: false };

  if (!isNonEmptyString(entity['name'])) {
    (entity as Record<string, unknown>)['name'] = `Unnamed ${kind} ${index + 1}`;
    return { valid: true, autoNamed: true };
  }
  return { valid: true, autoNamed: false };
};

/** Validates an entity that uses the `title` field (Adventure, Article,
 *  SessionLog, Plot, Note, Secret). */
const checkTitleEntity = (
  entity: unknown,
  index: number,
  kind: string,
): EntityCheckResult => {
  if (!isPlainObject(entity)) return { valid: false, autoNamed: false };
  if (!isNonEmptyString(entity['id'])) return { valid: false, autoNamed: false };

  if (!isNonEmptyString(entity['title'])) {
    (entity as Record<string, unknown>)['title'] = `Unnamed ${kind} ${index + 1}`;
    return { valid: true, autoNamed: true };
  }
  return { valid: true, autoNamed: false };
};

/** PlayerCharacter has no top-level name — validate id only. */
const checkPlayerCharacter = (
  entity: unknown,
): EntityCheckResult => {
  if (!isPlainObject(entity)) return { valid: false, autoNamed: false };
  if (!isNonEmptyString(entity['id'])) return { valid: false, autoNamed: false };
  return { valid: true, autoNamed: false };
};

// ---------------------------------------------------------------------------
// Array-level validation
// Returns the count of auto-named entities (for warning text) and filters out
// structurally invalid ones (for error text).
// ---------------------------------------------------------------------------

interface ArrayValidationResult {
  /** Sanitised array (invalid entries removed). */
  sanitised: unknown[];
  /** Number of entries that were removed as structurally invalid. */
  removedCount: number;
  /** Number of entries that had their name/title auto-generated. */
  autoNamedCount: number;
}

type EntityValidator = (entity: unknown, index: number) => EntityCheckResult;

const validateEntityArray = (
  raw: unknown,
  validator: EntityValidator,
): ArrayValidationResult => {
  if (!Array.isArray(raw)) {
    return { sanitised: [], removedCount: 0, autoNamedCount: 0 };
  }

  const sanitised: unknown[] = [];
  let removedCount = 0;
  let autoNamedCount = 0;

  raw.forEach((entry, i) => {
    const result = validator(entry, i);
    if (!result.valid) {
      removedCount++;
      return;
    }
    if (result.autoNamed) autoNamedCount++;
    sanitised.push(entry);
  });

  return { sanitised, removedCount, autoNamedCount };
};

// ---------------------------------------------------------------------------
// Required-array-field normalisation
// ---------------------------------------------------------------------------

/** Ensures `entity[field]` is an array, defaulting to `[]` when missing or of
 *  the wrong type. Mutates `entity` in place. */
const ensureArrayField = (entity: Record<string, unknown>, field: string): void => {
  if (!Array.isArray(entity[field])) {
    entity[field] = [];
  }
};

/**
 * Backfills every array field each entity type declares as *required*
 * (non-optional) in its `types/` definition, so the `as unknown as Campaign`
 * cast at the end of `validateImportedCampaign` is actually safe.
 *
 * The entity-level validators above only guarantee `id` + `name`/`title` —
 * hand-edited or partially-authored exports routinely omit relationship
 * arrays like `Faction.memberIds` or `Location.subLocationIds`. Those fields
 * are typed as required, so downstream consumers (continuityChecker.ts,
 * FactionEditor, etc.) iterate them without an `?? []` guard and throw a
 * TypeError the moment they encounter one.
 */
const normaliseRequiredArrays = (data: Record<string, unknown>): void => {
  const npcs = data['npcs'];
  if (Array.isArray(npcs)) {
    for (const npc of npcs) {
      if (!isPlainObject(npc)) continue;
      ensureArrayField(npc, 'knowsPlayerHistory');
      ensureArrayField(npc, 'relationships');
      ensureArrayField(npc, 'history');
    }
  }

  const locations = data['locations'];
  if (Array.isArray(locations)) {
    for (const location of locations) {
      if (!isPlainObject(location)) continue;
      ensureArrayField(location, 'subLocationIds');
      ensureArrayField(location, 'history');
    }
  }

  const factions = data['factions'];
  if (Array.isArray(factions)) {
    for (const faction of factions) {
      if (!isPlainObject(faction)) continue;
      ensureArrayField(faction, 'memberIds');
    }
  }

  const articles = data['articles'];
  if (Array.isArray(articles)) {
    for (const article of articles) {
      if (!isPlainObject(article)) continue;
      ensureArrayField(article, 'subArticleIds');
    }
  }

  const adventures = data['adventures'];
  if (Array.isArray(adventures)) {
    for (const adventure of adventures) {
      if (!isPlainObject(adventure)) continue;
      ensureArrayField(adventure, 'scenes');
      const scenes = adventure['scenes'];
      if (Array.isArray(scenes)) {
        for (const scene of scenes) {
          if (!isPlainObject(scene)) continue;
          ensureArrayField(scene, 'npcIds');
          ensureArrayField(scene, 'skillChecks');
        }
      }
    }
  }

  const sessionLogs = data['sessionLogs'];
  if (Array.isArray(sessionLogs)) {
    for (const log of sessionLogs) {
      if (!isPlainObject(log)) continue;
      ensureArrayField(log, 'plannedSceneIds');
      ensureArrayField(log, 'relatedPlotIds');
      ensureArrayField(log, 'structuredNotes');
      ensureArrayField(log, 'encounterLog');
    }
  }

  const plots = data['plots'];
  if (Array.isArray(plots)) {
    for (const plot of plots) {
      if (!isPlainObject(plot)) continue;
      ensureArrayField(plot, 'relatedEntityIds');
    }
  }

  const notes = data['notes'];
  if (Array.isArray(notes)) {
    for (const note of notes) {
      if (!isPlainObject(note)) continue;
      ensureArrayField(note, 'tags');
    }
  }
};

// ---------------------------------------------------------------------------
// Campaign-wide id de-duplication
// ---------------------------------------------------------------------------

/** Every id-bearing entity array a Campaign export may contain, in a fixed
 *  scan order. Order matters for "first occurrence wins" semantics. */
const ID_BEARING_ARRAY_KEYS = [
  'npcs',
  'locations',
  'factions',
  'items',
  'adventures',
  'articles',
  'sessionLogs',
  'plots',
  'notes',
  'secrets',
  'playerCharacters',
] as const;

/**
 * Enforces campaign-wide uniqueness of entity `id`s (both within a single
 * array and across different arrays). Every CRUD path in campaignService
 * resolves entities by `find`/`findIndex` on `id`, so a duplicate id causes
 * edits/deletes to silently hit the wrong entity. The FIRST occurrence
 * (in `ID_BEARING_ARRAY_KEYS` order, then array order) keeps its id; later
 * duplicates are dropped. Mutates `data` in place.
 */
const dedupeIdsAcrossCampaign = (
  data: Record<string, unknown>,
  warnings: string[],
): void => {
  const seenIds = new Set<string>();
  let duplicateCount = 0;

  for (const key of ID_BEARING_ARRAY_KEYS) {
    const raw = data[key];
    if (!Array.isArray(raw)) continue;

    const deduped: unknown[] = [];
    for (const entity of raw) {
      if (!isPlainObject(entity)) {
        deduped.push(entity);
        continue;
      }
      const id = entity['id'];
      if (typeof id === 'string' && seenIds.has(id)) {
        duplicateCount++;
        continue;
      }
      if (typeof id === 'string') seenIds.add(id);
      deduped.push(entity);
    }
    data[key] = deduped;
  }

  if (duplicateCount > 0) {
    warnings.push(
      `${duplicateCount} entit${duplicateCount === 1 ? 'y was' : 'ies were'} removed for having a duplicate id shared with an earlier entity.`,
    );
  }
};

// ---------------------------------------------------------------------------
// Version migration
// ---------------------------------------------------------------------------

/**
 * Applies any schema migrations needed to bring an older campaign up to the
 * current version. Mutates `data` in place and returns it.
 * Warnings produced during migration are pushed into `warnings`.
 */
const applyMigrations = (
  data: Record<string, unknown>,
  warnings: string[],
): void => {
  const version = typeof data['version'] === 'number' ? data['version'] : 0;

  if (version === 0) {
    // Version 0 → 1: stamp the version field; no structural changes needed
    // beyond what the main validator already normalises.
    warnings.push(
      'Imported file has no version field. Assuming current schema version and importing.',
    );
  }

  // Future migrations go here:
  // if (version < 2) { ... migrate v1 → v2 ... }

  data['version'] = CURRENT_CAMPAIGN_VERSION;
};

// ---------------------------------------------------------------------------
// Core campaign schema validation
// ---------------------------------------------------------------------------

/**
 * Validates a parsed (but untrusted) object against the Campaign schema.
 * Returns a structured result with errors, warnings, and (if valid) the
 * sanitised Campaign ready to be stored.
 *
 * This is a pure function — it does not throw.
 */
export const validateImportedCampaign = (
  data: unknown,
): ImportValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Must be a plain object
  if (!isPlainObject(data)) {
    return {
      success: false,
      errors: ['File does not contain a valid campaign object.'],
      warnings,
    };
  }

  // Campaign-level required fields: id + (title or name)
  if (!isNonEmptyString(data['id'])) {
    errors.push('Campaign is missing a required "id" field.');
  }

  // Accept either "title" or legacy "name"
  const hasTitle = isNonEmptyString(data['title']);
  const hasName = isNonEmptyString(data['name']);

  if (!hasTitle && !hasName) {
    errors.push('Campaign is missing a required "title" (or "name") field.');
  } else if (!hasTitle && hasName) {
    // Migrate legacy "name" → "title"
    data['title'] = data['name'];
    warnings.push('Campaign used a legacy "name" field — migrated to "title" automatically.');
  }

  // Block on structural errors before attempting entity validation
  if (errors.length > 0) {
    return { success: false, errors, warnings };
  }

  // Reject files from a future schema version BEFORE any mutation — a file
  // stamped with a version newer than this build understands must not be
  // silently downgraded and re-stamped (that would launder its provenance).
  const declaredVersion = typeof data['version'] === 'number' ? data['version'] : 0;
  if (declaredVersion > CURRENT_CAMPAIGN_VERSION) {
    return {
      success: false,
      errors: [
        'This file was created by a newer version of Realmweaver. Please update the app before importing it.',
      ],
      warnings,
    };
  }

  // Apply schema version migrations
  applyMigrations(data, warnings);

  // Normalise and validate each entity array -----------------------------------

  // name-keyed arrays
  const nameArrays: Array<{ key: string; kind: string }> = [
    { key: 'npcs', kind: 'NPC' },
    { key: 'locations', kind: 'Location' },
    { key: 'factions', kind: 'Faction' },
    { key: 'items', kind: 'Item' },
  ];

  for (const { key, kind } of nameArrays) {
    if (!Array.isArray(data[key])) {
      const wasPresent = data[key] !== undefined;
      data[key] = [];
      if (wasPresent) {
        warnings.push(`"${key}" field was not an array and has been reset to empty.`);
      }
    } else {
      const result = validateEntityArray(
        data[key],
        (entity, i) => checkNameEntity(entity, i, kind),
      );
      data[key] = result.sanitised;
      if (result.removedCount > 0) {
        warnings.push(
          `${result.removedCount} ${kind}(s) were removed because they were missing a required "id" field.`,
        );
      }
      if (result.autoNamedCount > 0) {
        warnings.push(
          `${result.autoNamedCount} ${kind}(s) were missing names and had placeholder names auto-generated.`,
        );
      }
    }
  }

  // title-keyed arrays
  const titleArrays: Array<{ key: string; kind: string }> = [
    { key: 'adventures', kind: 'Adventure' },
    { key: 'articles', kind: 'Article' },
    { key: 'sessionLogs', kind: 'Session Log' },
    { key: 'plots', kind: 'Plot' },
    { key: 'notes', kind: 'Note' },
    { key: 'secrets', kind: 'Secret' },
  ];

  for (const { key, kind } of titleArrays) {
    if (!Array.isArray(data[key])) {
      const wasPresent = data[key] !== undefined;
      data[key] = [];
      if (wasPresent) {
        warnings.push(`"${key}" field was not an array and has been reset to empty.`);
      }
    } else {
      const result = validateEntityArray(
        data[key],
        (entity, i) => checkTitleEntity(entity, i, kind),
      );
      data[key] = result.sanitised;
      if (result.removedCount > 0) {
        warnings.push(
          `${result.removedCount} ${kind}(s) were removed because they were missing a required "id" field.`,
        );
      }
      if (result.autoNamedCount > 0) {
        warnings.push(
          `${result.autoNamedCount} ${kind}(s) were missing titles and had placeholder titles auto-generated.`,
        );
      }
    }
  }

  // PlayerCharacters use a different shape — only validate id presence
  if (!Array.isArray(data['playerCharacters'])) {
    const wasPresent = data['playerCharacters'] !== undefined;
    data['playerCharacters'] = [];
    if (wasPresent) {
      warnings.push('"playerCharacters" field was not an array and has been reset to empty.');
    }
  } else {
    const result = validateEntityArray(
      data['playerCharacters'],
      (entity) => checkPlayerCharacter(entity),
    );
    data['playerCharacters'] = result.sanitised;
    if (result.removedCount > 0) {
      warnings.push(
        `${result.removedCount} Player Character(s) were removed because they were missing a required "id" field.`,
      );
    }
  }

  // Enforce campaign-wide id uniqueness now that every array is sanitised.
  dedupeIdsAcrossCampaign(data, warnings);

  // Ensure legacy compatibility fields that campaignService also handles,
  // so the service layer gets a cleaner object.
  data['settingType'] = data['settingType'] || 'custom';
  data['setting'] = data['setting'] || '';

  // Backfill required array fields (memberIds, subLocationIds, npcIds, etc.)
  // so every entity is structurally complete before being cast to Campaign.
  normaliseRequiredArrays(data);

  return {
    success: true,
    campaign: data as unknown as Campaign,
    errors,
    warnings,
  };
};

// ---------------------------------------------------------------------------
// Export round-trip validation
// ---------------------------------------------------------------------------

/**
 * Verifies that a Campaign JSON string round-trips through JSON.parse without
 * losing entity counts. Returns a structured result — callers decide whether
 * to surface a warning toast.
 *
 * This is a pure function — it does not throw.
 */
export const validateExportRoundTrip = (
  campaign: Campaign,
  jsonString: string,
): ExportValidationResult => {
  try {
    const parsed = JSON.parse(jsonString) as Record<string, unknown>;

    const arrayKeys: Array<keyof Campaign> = [
      'npcs',
      'locations',
      'factions',
      'items',
      'adventures',
      'articles',
      'sessionLogs',
      'playerCharacters',
      'plots',
      'notes',
      'secrets',
    ];

    for (const key of arrayKeys) {
      const originalArray = campaign[key];
      const parsedArray = parsed[key];
      const originalCount = Array.isArray(originalArray) ? originalArray.length : 0;
      const parsedCount = Array.isArray(parsedArray) ? parsedArray.length : 0;

      if (originalCount !== parsedCount) {
        return {
          roundTripOk: false,
          warning: `Export verification failed: ${key} count mismatch (${originalCount} → ${parsedCount}). The file has been downloaded but may be incomplete.`,
        };
      }
    }

    return { roundTripOk: true };
  } catch {
    return {
      roundTripOk: false,
      warning:
        'Export verification failed: the JSON could not be re-parsed. The file has been downloaded but may be corrupt.',
    };
  }
};

// ---------------------------------------------------------------------------
// Markdown generation (unchanged)
// ---------------------------------------------------------------------------

const generateMarkdownForCampaign = (campaign: Campaign): string => {
    let md = `# ${campaign.title}\n\n`;
    md += `## Campaign Setting\n\n${campaign.setting}\n\n`;

    md += `---\n\n# World Entities\n\n`;

    // NPCs
    if (campaign.npcs.length > 0) {
        md += `## NPCs\n\n`;
        campaign.npcs.forEach(npc => {
            md += `### ${npc.name}\n\n`;
            if (npc.description) md += `- **Description:** ${npc.description}\n`;
            if (npc.traits) md += `- **Traits:** ${npc.traits}\n`;
            if (npc.exampleQuote) md += `- **Quote:** *"${npc.exampleQuote}"*\n`;
            if (npc.motivations) md += `- **Motivations:** ${npc.motivations}\n`;
            if (npc.secrets) md += `- **Secrets (GM Only):** ${npc.secrets}\n`;
            if (npc.backstory) md += `- **Backstory:** ${npc.backstory}\n`;
            md += `\n`;
        });
    }

    // Locations
    if (campaign.locations.length > 0) {
        md += `## Locations\n\n`;
        campaign.locations.forEach(location => {
            md += `### ${location.name}\n\n`;
            if (location.description) md += `- **Description:** ${location.description}\n`;
            if (location.secrets) md += `- **Secrets:** ${location.secrets}\n`;
            md += `\n`;
        });
    }

    // Factions
    if (campaign.factions.length > 0) {
        md += `## Factions\n\n`;
        campaign.factions.forEach(faction => {
            md += `### ${faction.name}\n\n`;
            if (faction.description) md += `- **Description:** ${faction.description}\n`;
            if (faction.goals) md += `- **Goals:** ${faction.goals}\n`;
            md += `\n`;
        });
    }

    // Items
    if (campaign.items.length > 0) {
        md += `## Items\n\n`;
        campaign.items.forEach(item => {
            md += `### ${item.name} (${item.rarity})\n\n`;
            if (item.description) md += `- **Description:** ${item.description}\n`;
            if (item.properties) md += `- **Properties:** ${item.properties}\n`;
            md += `\n`;
        });
    }

    // Articles (Lorebook)
    if (campaign.articles.length > 0) {
        md += `## Lorebook\n\n`;
        const topLevelArticles = campaign.articles.filter(a => !a.parentArticleId);
        const allArticles = campaign.articles;

        const renderArticle = (article: Article, level: number) => {
            let articleMd = `${'#'.repeat(level + 3)} ${article.title} (${article.category})\n\n`;
            articleMd += `${article.content}\n\n`;

            const children = allArticles.filter(a => a.parentArticleId === article.id);
            children.forEach(child => {
                articleMd += renderArticle(child, level + 1);
            });
            return articleMd;
        }

        topLevelArticles.forEach(article => {
            md += renderArticle(article, 0);
        });
    }


    md += `---\n\n# Storylines\n\n`;

    // Adventures
    if (campaign.adventures.length > 0) {
        campaign.adventures.forEach(adventure => {
            md += `## Adventure: ${adventure.title}\n\n`;
            md += `- **Hook:** ${adventure.hook}\n`;
            md += `- **Theme:** ${adventure.theme}\n`;
            md += `- **Target Level:** ${adventure.level}\n\n`;

            adventure.scenes.forEach(scene => {
                const location = campaign.locations.find(l => l.id === scene.locationId);
                md += `### Scene: ${scene.title}${location ? ` (${location.name})` : ''}\n\n`;
                md += `**Type:** ${scene.type}\n\n`;
                if(scene.readAloudText) md += `**Read-Aloud Text:**\n> ${scene.readAloudText.replace(/\n/g, '\n> ')}\n\n`;
                if(scene.gmNotes) md += `**GM Notes:**\n> ${scene.gmNotes.replace(/\n/g, '\n> ')}\n\n`;

                const sceneNpcs = campaign.npcs.filter(npc => scene.npcIds.includes(npc.id));
                if (sceneNpcs.length > 0) {
                    md += `**NPCs Present:** ${sceneNpcs.map(n => n.name).join(', ')}\n\n`;
                }

                if (scene.skillChecks && scene.skillChecks.length > 0) {
                    md += `**Skill Checks:**\n`;
                    scene.skillChecks.forEach(sc => {
                        md += `- **${sc.skill} (DC ${sc.dc}):** ${sc.description}\n`;
                    });
                    md += `\n`;
                }

                if (scene.rewards) md += `**Rewards:** ${scene.rewards}\n\n`;
            });
        });
    }

    // Session Logs
    if (campaign.sessionLogs && campaign.sessionLogs.length > 0) {
        md += `## Session Logs\n\n`;
        campaign.sessionLogs.sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime()).forEach(log => {
            md += `### ${log.title} (${new Date(log.sessionDate).toLocaleDateString()})\n\n`;
            if (log.recap) md += `**Recap:**\n${log.recap}\n\n`;
            if (log.notableEvents) md += `**Notable Events:**\n${log.notableEvents}\n\n`;
            if (log.looseEnds) md += `**Loose Ends:**\n${log.looseEnds}\n\n`;
        });
    }


    return md;
};

// ---------------------------------------------------------------------------
// File download helper (unchanged)
// ---------------------------------------------------------------------------

const downloadFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// ---------------------------------------------------------------------------
// Public export functions
// ---------------------------------------------------------------------------

/**
 * Exports a campaign as a JSON file. Stamps a `version` field if not present
 * and verifies the JSON round-trips cleanly before triggering the download.
 *
 * Returns an `ExportValidationResult` so the caller can surface a warning
 * toast if the round-trip check fails (rare, but defensive).
 */
export const exportCampaignAsJson = (campaign: Campaign): ExportValidationResult => {
    // SECURITY: Strip sensitive fields before export to prevent credential leakage
    const { gcpApiKey: _omit, ...exportable } = campaign;

    // Stamp the schema version
    const exportData = {
        ...exportable,
        version: (exportable as Record<string, unknown>)['version'] ?? CURRENT_CAMPAIGN_VERSION,
    };

    const content = JSON.stringify(exportData, null, 2);

    // Verify round-trip before download
    const roundTripResult = validateExportRoundTrip(campaign, content);

    const filename = `${campaign.title.replace(/ /g, '_')}.json`;
    downloadFile(filename, content, 'application/json');

    return roundTripResult;
};

export const exportCampaignAsObsidian = (campaign: Campaign) => {
    const filename = `${campaign.title.replace(/ /g, '_')}.md`;
    const content = generateMarkdownForCampaign(campaign);
    downloadFile(filename, content, 'text/markdown');
};

// ---------------------------------------------------------------------------
// Public import function
// ---------------------------------------------------------------------------

/**
 * Reads a File, parses the JSON, and runs full schema validation.
 * Returns a structured `ImportValidationResult` instead of throwing —
 * callers should inspect `success`, `errors`, and `warnings` and surface
 * them via `useToast` or similar UI feedback.
 *
 * This replaces the previous Promise<Campaign> signature. The old behaviour
 * (throw on error) is preserved for `campaignService.ts` via the companion
 * `importCampaignFromJson` wrapper below.
 */
export const importCampaignFromJsonValidated = (
  file: File,
): Promise<ImportValidationResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const raw = event.target?.result as string;

      // 5.1.1 — JSON parse safety
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        resolve({
          success: false,
          errors: [
            'The file could not be read as JSON. Make sure you selected a valid Realmweaver campaign export.',
          ],
          warnings: [],
        });
        return;
      }

      // 5.1.2 & 5.1.3 — Schema validation + version migration
      const result = validateImportedCampaign(parsed);
      resolve(result);
    };

    reader.onerror = () => {
      resolve({
        success: false,
        errors: ['The file could not be read. Please try again.'],
        warnings: [],
      });
    };

    reader.readAsText(file);
  });
};

/**
 * Backward-compatible wrapper used by `campaignService.ts`.
 * Rejects with an Error if validation fails so existing catch blocks work.
 *
 * NOTE: campaignService.ts adds its own compatibility patching on top of this,
 * so the Campaign returned here may be further normalised before storage.
 */
export const importCampaignFromJson = (file: File): Promise<Campaign> => {
  return importCampaignFromJsonValidated(file).then((result) => {
    if (!result.success || !result.campaign) {
      throw new Error(result.errors.join(' '));
    }
    return result.campaign;
  });
};
