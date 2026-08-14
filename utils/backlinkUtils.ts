
import type { Campaign } from '@/types/index';

export interface BacklinkEntry {
  id: string;
  name: string;
  entityType: string; // 'npc' | 'location' | 'faction' | 'scene' | 'article' | 'plot' | 'adventure' | 'session-log'
  relationshipLabel: string; // Human-readable: "Member", "Leader", "Set in", "Features", etc.
}

export interface GroupedBacklinks {
  [entityType: string]: BacklinkEntry[];
}

/**
 * Add a BacklinkEntry to a mutable accumulator map, creating the group array on
 * first use.  Entries are collected unsorted here; the caller sorts at the end.
 */
function addEntry(
  acc: Map<string, BacklinkEntry[]>,
  entityType: string,
  entry: BacklinkEntry,
): void {
  if (!acc.has(entityType)) {
    acc.set(entityType, []);
  }
  acc.get(entityType)!.push(entry);
}

/** Sort each group alphabetically by name, then convert Map → plain object. */
function finalise(acc: Map<string, BacklinkEntry[]>): GroupedBacklinks {
  const result: GroupedBacklinks = {};
  for (const [type, entries] of acc.entries()) {
    if (entries.length > 0) {
      result[type] = entries.slice().sort((a, b) => a.name.localeCompare(b.name));
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// @-mention backlink scanner
// ---------------------------------------------------------------------------

/**
 * Scan a list of entities for those that have @-mentioned the target entity
 * (via mentionedEntityIds), and add a "Mentioned in" backlink entry for each.
 */
function scanMentionedEntityIds(
  acc: Map<string, BacklinkEntry[]>,
  entityId: string,
  entities: Array<{ id: string; name: string; mentionedEntityIds?: string[] }>,
  sourceType: string,
): void {
  for (const entity of entities) {
    if (entity.mentionedEntityIds?.includes(entityId)) {
      addEntry(acc, sourceType, {
        id: entity.id,
        name: entity.name,
        entityType: sourceType,
        relationshipLabel: 'Mentioned in',
      });
    }
  }
}

/**
 * Sweep every entity type that can hold `mentionedEntityIds` (npcs, locations,
 * factions, articles, plots, scenes) for an @-mention of the target entity.
 * Shared by every computeBacklinksFor* function so the source list can never
 * drift out of sync between entity types again (findings #47, #48).
 *
 * Items are deliberately excluded as a mention SOURCE: Item has no
 * `mentionedEntityIds` field and no editor mounts MentionInput for items, so
 * items are a mention TARGET only.
 */
function scanAllMentionSources(
  acc: Map<string, BacklinkEntry[]>,
  entityId: string,
  campaign: Campaign,
): void {
  const allScenes = campaign.adventures.flatMap(a => a.scenes);
  scanMentionedEntityIds(acc, entityId, campaign.npcs, 'npc');
  scanMentionedEntityIds(acc, entityId, campaign.locations, 'location');
  scanMentionedEntityIds(acc, entityId, campaign.factions, 'faction');
  scanMentionedEntityIds(acc, entityId, campaign.articles.map(a => ({ id: a.id, name: a.title, mentionedEntityIds: a.mentionedEntityIds })), 'article');
  scanMentionedEntityIds(acc, entityId, campaign.plots.map(p => ({ id: p.id, name: p.title, mentionedEntityIds: p.mentionedEntityIds })), 'plot');
  scanMentionedEntityIds(acc, entityId, allScenes.map(s => ({ id: s.id, name: s.title, mentionedEntityIds: s.mentionedEntityIds })), 'scene');
}

/**
 * Generic relatedEntityIds sweep for entity types that can only ever be the
 * TARGET of a relatedEntityIds reference, never a mention/relationship SOURCE
 * themselves: session logs, player characters and notes (finding #46).
 * Covers articles and plots, the two entity types whose relatedEntityIds is
 * used as a general-purpose "related to" pointer.
 */
function computeGenericRelatedEntitySweep(entityId: string, campaign: Campaign): GroupedBacklinks {
  const acc = new Map<string, BacklinkEntry[]>();

  for (const article of campaign.articles) {
    if (article.relatedEntityIds?.includes(entityId)) {
      addEntry(acc, 'article', {
        id: article.id,
        name: article.title,
        entityType: 'article',
        relationshipLabel: 'Referenced by',
      });
    }
  }

  for (const plot of campaign.plots) {
    if (plot.relatedEntityIds?.includes(entityId)) {
      addEntry(acc, 'plot', {
        id: plot.id,
        name: plot.title,
        entityType: 'plot',
        relationshipLabel: 'Referenced by',
      });
    }
  }

  return finalise(acc);
}

// ---------------------------------------------------------------------------
// Per-entity-type scanner functions
// ---------------------------------------------------------------------------

function computeBacklinksForNpc(entityId: string, campaign: Campaign): GroupedBacklinks {
  const acc = new Map<string, BacklinkEntry[]>();

  // Factions where this NPC is leader or member
  for (const faction of campaign.factions) {
    if (faction.leaderId === entityId) {
      addEntry(acc, 'faction', {
        id: faction.id,
        name: faction.name,
        entityType: 'faction',
        relationshipLabel: 'Leader of',
      });
    } else if (faction.memberIds.includes(entityId)) {
      addEntry(acc, 'faction', {
        id: faction.id,
        name: faction.name,
        entityType: 'faction',
        relationshipLabel: 'Member of',
      });
    }
  }

  // Scenes where this NPC appears
  for (const adventure of campaign.adventures) {
    for (const scene of adventure.scenes) {
      if (scene.npcIds.includes(entityId)) {
        addEntry(acc, 'scene', {
          id: scene.id,
          name: scene.title,
          entityType: 'scene',
          relationshipLabel: `${adventure.title} \u2014 Appears in`,
        });
      }
    }
  }

  // NPCs that have a relationship pointing to this NPC
  for (const npc of campaign.npcs) {
    if (npc.id === entityId) continue;
    for (const rel of npc.relationships) {
      if (rel.targetId === entityId) {
        addEntry(acc, 'npc', {
          id: npc.id,
          name: npc.name,
          entityType: 'npc',
          relationshipLabel: 'Relationship with',
        });
        break; // One entry per NPC even if multiple relationship entries exist
      }
    }
  }

  // Articles referencing this NPC
  for (const article of campaign.articles) {
    if (article.relatedEntityIds?.includes(entityId)) {
      addEntry(acc, 'article', {
        id: article.id,
        name: article.title,
        entityType: 'article',
        relationshipLabel: 'Referenced by',
      });
    }
  }

  // Plots involving this NPC
  for (const plot of campaign.plots) {
    if (plot.relatedEntityIds.includes(entityId)) {
      addEntry(acc, 'plot', {
        id: plot.id,
        name: plot.title,
        entityType: 'plot',
        relationshipLabel: 'Involved in',
      });
    }
  }

  // @-mention backlinks
  scanAllMentionSources(acc, entityId, campaign);

  return finalise(acc);
}

function computeBacklinksForLocation(entityId: string, campaign: Campaign): GroupedBacklinks {
  const acc = new Map<string, BacklinkEntry[]>();

  // Other locations that are children of this location (this location is their parent)
  for (const location of campaign.locations) {
    if (location.id === entityId) continue;
    if (location.parentLocationId === entityId) {
      addEntry(acc, 'location', {
        id: location.id,
        name: location.name,
        entityType: 'location',
        relationshipLabel: 'Parent of',
      });
    }
  }

  // Other locations that have a connection pointing to this location
  for (const location of campaign.locations) {
    if (location.id === entityId) continue;
    const hasConnection = location.connections?.some(
      (conn) => conn.targetLocationId === entityId,
    );
    if (hasConnection) {
      addEntry(acc, 'location', {
        id: location.id,
        name: location.name,
        entityType: 'location',
        relationshipLabel: 'Connected to',
      });
    }
  }

  // Factions headquartered at this location
  for (const faction of campaign.factions) {
    if (faction.headquartersLocationId === entityId) {
      addEntry(acc, 'faction', {
        id: faction.id,
        name: faction.name,
        entityType: 'faction',
        relationshipLabel: 'Headquarters of',
      });
    }
  }

  // Scenes set in this location
  for (const adventure of campaign.adventures) {
    for (const scene of adventure.scenes) {
      if (scene.locationId === entityId) {
        addEntry(acc, 'scene', {
          id: scene.id,
          name: scene.title,
          entityType: 'scene',
          relationshipLabel: `${adventure.title} \u2014 Setting for`,
        });
      }
    }
  }

  // Articles referencing this location
  for (const article of campaign.articles) {
    if (article.relatedEntityIds?.includes(entityId)) {
      addEntry(acc, 'article', {
        id: article.id,
        name: article.title,
        entityType: 'article',
        relationshipLabel: 'Referenced by',
      });
    }
  }

  // @-mention backlinks
  scanAllMentionSources(acc, entityId, campaign);

  return finalise(acc);
}

function computeBacklinksForFaction(entityId: string, campaign: Campaign): GroupedBacklinks {
  const acc = new Map<string, BacklinkEntry[]>();

  // NPCs that belong to this faction
  for (const npc of campaign.npcs) {
    if (npc.factionId === entityId) {
      addEntry(acc, 'npc', {
        id: npc.id,
        name: npc.name,
        entityType: 'npc',
        relationshipLabel: 'Member',
      });
    }
  }

  // Locations controlled by this faction
  for (const location of campaign.locations) {
    if (location.controllingFactionId === entityId) {
      addEntry(acc, 'location', {
        id: location.id,
        name: location.name,
        entityType: 'location',
        relationshipLabel: 'Controls',
      });
    }
  }

  // Articles referencing this faction
  for (const article of campaign.articles) {
    if (article.relatedEntityIds?.includes(entityId)) {
      addEntry(acc, 'article', {
        id: article.id,
        name: article.title,
        entityType: 'article',
        relationshipLabel: 'Referenced by',
      });
    }
  }

  // Plots involving this faction
  for (const plot of campaign.plots) {
    if (plot.relatedEntityIds.includes(entityId)) {
      addEntry(acc, 'plot', {
        id: plot.id,
        name: plot.title,
        entityType: 'plot',
        relationshipLabel: 'Involved in',
      });
    }
  }

  // @-mention backlinks
  scanAllMentionSources(acc, entityId, campaign);

  return finalise(acc);
}

function computeBacklinksForItem(entityId: string, campaign: Campaign): GroupedBacklinks {
  const acc = new Map<string, BacklinkEntry[]>();

  // Articles referencing this item
  for (const article of campaign.articles) {
    if (article.relatedEntityIds?.includes(entityId)) {
      addEntry(acc, 'article', {
        id: article.id,
        name: article.title,
        entityType: 'article',
        relationshipLabel: 'Referenced by',
      });
    }
  }

  // Plots involving this item
  for (const plot of campaign.plots) {
    if (plot.relatedEntityIds.includes(entityId)) {
      addEntry(acc, 'plot', {
        id: plot.id,
        name: plot.title,
        entityType: 'plot',
        relationshipLabel: 'Involved in',
      });
    }
  }

  // @-mention backlinks
  scanAllMentionSources(acc, entityId, campaign);

  return finalise(acc);
}

function computeBacklinksForAdventure(entityId: string, campaign: Campaign): GroupedBacklinks {
  const acc = new Map<string, BacklinkEntry[]>();

  // Session logs played under this adventure
  for (const log of campaign.sessionLogs) {
    if (log.adventureId === entityId) {
      addEntry(acc, 'session-log', {
        id: log.id,
        name: log.title,
        entityType: 'session-log',
        relationshipLabel: 'Played in',
      });
    }
  }

  // Articles referencing this adventure
  for (const article of campaign.articles) {
    if (article.relatedEntityIds?.includes(entityId)) {
      addEntry(acc, 'article', {
        id: article.id,
        name: article.title,
        entityType: 'article',
        relationshipLabel: 'Referenced by',
      });
    }
  }

  // @-mention backlinks (adventures are @-mention candidates too — finding #47)
  scanAllMentionSources(acc, entityId, campaign);

  return finalise(acc);
}

function computeBacklinksForArticle(entityId: string, campaign: Campaign): GroupedBacklinks {
  const acc = new Map<string, BacklinkEntry[]>();

  // Other articles that are children of this article (this is their parentArticleId)
  for (const article of campaign.articles) {
    if (article.id === entityId) continue;
    if (article.parentArticleId === entityId) {
      addEntry(acc, 'article', {
        id: article.id,
        name: article.title,
        entityType: 'article',
        relationshipLabel: 'Parent of',
      });
    }
  }

  // Other articles whose relatedEntityIds include this article
  for (const article of campaign.articles) {
    if (article.id === entityId) continue;
    if (article.relatedEntityIds?.includes(entityId)) {
      addEntry(acc, 'article', {
        id: article.id,
        name: article.title,
        entityType: 'article',
        relationshipLabel: 'Referenced by',
      });
    }
  }

  // @-mention backlinks
  scanAllMentionSources(acc, entityId, campaign);

  return finalise(acc);
}

function computeBacklinksForPlot(entityId: string, campaign: Campaign): GroupedBacklinks {
  const acc = new Map<string, BacklinkEntry[]>();

  // Session logs that tracked this plot
  for (const log of campaign.sessionLogs) {
    if (log.relatedPlotIds.includes(entityId)) {
      addEntry(acc, 'session-log', {
        id: log.id,
        name: log.title,
        entityType: 'session-log',
        relationshipLabel: 'Tracked in',
      });
    }
  }

  // Articles referencing this plot
  for (const article of campaign.articles) {
    if (article.relatedEntityIds?.includes(entityId)) {
      addEntry(acc, 'article', {
        id: article.id,
        name: article.title,
        entityType: 'article',
        relationshipLabel: 'Referenced by',
      });
    }
  }

  // @-mention backlinks
  scanAllMentionSources(acc, entityId, campaign);

  return finalise(acc);
}

function computeBacklinksForScene(entityId: string, campaign: Campaign): GroupedBacklinks {
  const acc = new Map<string, BacklinkEntry[]>();

  // Find the parent adventure that contains this scene
  for (const adventure of campaign.adventures) {
    for (const scene of adventure.scenes) {
      if (scene.id === entityId) {
        addEntry(acc, 'adventure', {
          id: adventure.id,
          name: adventure.title,
          entityType: 'adventure',
          relationshipLabel: 'Part of',
        });
        break;
      }
    }
  }

  return finalise(acc);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute all entities that reference the given entity.
 * Returns backlinks grouped by entity type, with each group sorted
 * alphabetically by name.
 *
 * Pure function — no side effects; suitable for use inside useMemo.
 *
 * @param entityId   - The ID of the entity whose inbound references to find.
 * @param entityType - One of: 'npc' | 'location' | 'faction' | 'item' |
 *                    'adventure' | 'article' | 'plot' | 'scene' |
 *                    'session-log' | 'player-character' | 'note'
 * @param campaign   - The full campaign data object.
 */
export function computeBacklinks(
  entityId: string,
  entityType: string,
  campaign: Campaign,
): GroupedBacklinks {
  switch (entityType) {
    case 'npc':
      return computeBacklinksForNpc(entityId, campaign);
    case 'location':
      return computeBacklinksForLocation(entityId, campaign);
    case 'faction':
      return computeBacklinksForFaction(entityId, campaign);
    case 'item':
      return computeBacklinksForItem(entityId, campaign);
    case 'adventure':
      return computeBacklinksForAdventure(entityId, campaign);
    case 'article':
      return computeBacklinksForArticle(entityId, campaign);
    case 'plot':
      return computeBacklinksForPlot(entityId, campaign);
    case 'scene':
      return computeBacklinksForScene(entityId, campaign);
    // Types that BacklinksPanel mounts for but can never be a mention/
    // relationship SOURCE themselves — surface generic relatedEntityIds
    // references instead of the always-false "no references" state
    // (finding #46).
    case 'session-log':
    case 'player-character':
    case 'note':
      return computeGenericRelatedEntitySweep(entityId, campaign);
    default:
      return {};
  }
}
