
// services/continuityChecker.ts
// Rule-based continuity checker — pure function, no side effects, no API calls.

import type { Campaign } from '@/types/Campaign';

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ContinuityIssue {
  id: string;
  severity: IssueSeverity;
  title: string;
  description: string;
  entityIds: string[];    // Related entity IDs for navigation / EntityLink
  entityTypes: string[];  // Corresponding entity types (parallel array to entityIds)
  ruleId: string;         // Which rule produced this issue
  suggestedFix?: string;  // Human-readable fix suggestion
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _issueCounter = 0;

function makeId(ruleId: string): string {
  return `${ruleId}-${++_issueCounter}`;
}

// ─── Rule 1: Broken References (error) ───────────────────────────────────────

function checkBrokenReferences(campaign: Campaign): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];

  const npcIds = new Set(campaign.npcs.map(n => n.id));
  const locationIds = new Set(campaign.locations.map(l => l.id));
  const factionIds = new Set(campaign.factions.map(f => f.id));
  const itemIds = new Set(campaign.items.map(i => i.id));
  const articleIds = new Set(campaign.articles.map(a => a.id));

  // NPC.factionId → Faction
  for (const npc of campaign.npcs) {
    if (npc.factionId && !factionIds.has(npc.factionId)) {
      issues.push({
        id: makeId('broken-ref'),
        severity: 'error',
        ruleId: 'broken-ref',
        title: 'NPC references missing faction',
        description: `"${npc.name}" belongs to a faction (ID: ${npc.factionId.slice(0, 8)}…) that no longer exists.`,
        entityIds: [npc.id],
        entityTypes: ['npc'],
        suggestedFix: 'Open the NPC editor and reassign or clear the faction field.',
      });
    }
  }

  // Faction.leaderId → NPC
  for (const faction of campaign.factions) {
    if (faction.leaderId && !npcIds.has(faction.leaderId)) {
      issues.push({
        id: makeId('broken-ref'),
        severity: 'error',
        ruleId: 'broken-ref',
        title: 'Faction has a missing leader',
        description: `"${faction.name}" lists a leader (ID: ${faction.leaderId.slice(0, 8)}…) that no longer exists.`,
        entityIds: [faction.id],
        entityTypes: ['faction'],
        suggestedFix: 'Open the faction editor and clear or reassign the leader.',
      });
    }
  }

  // Faction.headquartersLocationId → Location
  for (const faction of campaign.factions) {
    if (faction.headquartersLocationId && !locationIds.has(faction.headquartersLocationId)) {
      issues.push({
        id: makeId('broken-ref'),
        severity: 'error',
        ruleId: 'broken-ref',
        title: 'Faction headquarters location is missing',
        description: `"${faction.name}" has a headquarters (ID: ${faction.headquartersLocationId.slice(0, 8)}…) that no longer exists.`,
        entityIds: [faction.id],
        entityTypes: ['faction'],
        suggestedFix: 'Open the faction editor and clear or reassign the headquarters location.',
      });
    }
  }

  // Scene.locationId → Location  /  Scene.npcIds → NPCs
  for (const adventure of campaign.adventures) {
    for (const scene of adventure.scenes) {
      if (scene.locationId && !locationIds.has(scene.locationId)) {
        issues.push({
          id: makeId('broken-ref'),
          severity: 'error',
          ruleId: 'broken-ref',
          title: 'Scene references missing location',
          description: `Scene "${scene.title}" in adventure "${adventure.title}" references a location (ID: ${scene.locationId.slice(0, 8)}…) that no longer exists.`,
          entityIds: [adventure.id],
          entityTypes: ['adventure'],
          suggestedFix: 'Open the scene editor and clear or reassign the location.',
        });
      }

      for (const npcId of scene.npcIds) {
        if (!npcIds.has(npcId)) {
          issues.push({
            id: makeId('broken-ref'),
            severity: 'error',
            ruleId: 'broken-ref',
            title: 'Scene references missing NPC',
            description: `Scene "${scene.title}" in adventure "${adventure.title}" references an NPC (ID: ${npcId.slice(0, 8)}…) that no longer exists.`,
            entityIds: [adventure.id],
            entityTypes: ['adventure'],
            suggestedFix: 'Open the scene editor and remove the deleted NPC.',
          });
        }
      }
    }
  }

  // Article.relatedEntityIds — validate against all known entities
  const allEntityIds = new Set([...npcIds, ...locationIds, ...factionIds, ...itemIds, ...articleIds]);
  for (const article of campaign.articles) {
    for (const refId of article.relatedEntityIds ?? []) {
      if (!allEntityIds.has(refId)) {
        issues.push({
          id: makeId('broken-ref'),
          severity: 'error',
          ruleId: 'broken-ref',
          title: 'Article has a broken entity link',
          description: `Article "${article.title}" references an entity (ID: ${refId.slice(0, 8)}…) that no longer exists.`,
          entityIds: [article.id],
          entityTypes: ['article'],
          suggestedFix: 'Open the article editor and remove the stale entity reference.',
        });
      }
    }
  }

  // Location.controllingFactionId → Faction
  for (const location of campaign.locations) {
    if (location.controllingFactionId && !factionIds.has(location.controllingFactionId)) {
      issues.push({
        id: makeId('broken-ref'),
        severity: 'error',
        ruleId: 'broken-ref',
        title: 'Location has a missing controlling faction',
        description: `"${location.name}" references a controlling faction (ID: ${location.controllingFactionId.slice(0, 8)}…) that no longer exists.`,
        entityIds: [location.id],
        entityTypes: ['location'],
        suggestedFix: 'Open the location editor and clear or reassign the controlling faction.',
      });
    }
  }

  return issues;
}

// ─── Rule 2: Circular Location Hierarchy (error) ─────────────────────────────

function checkCircularLocationHierarchy(campaign: Campaign): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];
  const parentMap = new Map<string, string>();

  for (const loc of campaign.locations) {
    if (loc.parentLocationId) {
      parentMap.set(loc.id, loc.parentLocationId);
    }
  }

  for (const loc of campaign.locations) {
    // Walk up the parent chain; if we visit the same node twice, it's a cycle.
    const visited = new Set<string>();
    let currentId: string | undefined = loc.id;
    while (currentId) {
      if (visited.has(currentId)) {
        issues.push({
          id: makeId('circular-location'),
          severity: 'error',
          ruleId: 'circular-location',
          title: 'Circular location hierarchy detected',
          description: `"${loc.name}" is part of a parent-child location cycle. This can cause infinite loops in the UI.`,
          entityIds: [loc.id],
          entityTypes: ['location'],
          suggestedFix: 'Remove one of the parent assignments to break the cycle.',
        });
        break;
      }
      visited.add(currentId);
      currentId = parentMap.get(currentId);
    }
  }

  // De-duplicate: if multiple locations are in the same cycle we can get N issues for 1 cycle.
  // Keep only the first occurrence per unique description.
  const seen = new Set<string>();
  return issues.filter(issue => {
    const key = issue.entityIds[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Rule 3: Orphaned Entities (info) ────────────────────────────────────────

function checkOrphanedEntities(campaign: Campaign): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];

  // --- Orphaned NPCs ---
  // Referenced by: faction memberIds, scene npcIds, NPC relationships, article relatedEntityIds
  const referencedNpcIds = new Set<string>();

  for (const faction of campaign.factions) {
    for (const id of faction.memberIds) referencedNpcIds.add(id);
    if (faction.leaderId) referencedNpcIds.add(faction.leaderId);
  }
  for (const adventure of campaign.adventures) {
    for (const scene of adventure.scenes) {
      for (const id of scene.npcIds) referencedNpcIds.add(id);
    }
  }
  for (const npc of campaign.npcs) {
    for (const rel of npc.relationships) referencedNpcIds.add(rel.targetId);
    if (npc.factionId) referencedNpcIds.add(npc.id); // has a faction → referenced
  }
  for (const article of campaign.articles) {
    for (const id of article.relatedEntityIds ?? []) referencedNpcIds.add(id);
  }

  for (const npc of campaign.npcs) {
    if (!referencedNpcIds.has(npc.id) && !npc.factionId) {
      issues.push({
        id: makeId('orphan'),
        severity: 'info',
        ruleId: 'orphan',
        title: 'Orphaned NPC',
        description: `"${npc.name}" is not referenced by any faction, scene, article, or relationship.`,
        entityIds: [npc.id],
        entityTypes: ['npc'],
        suggestedFix: 'Link this NPC to a faction, add them to a scene, or create a relationship.',
      });
    }
  }

  // --- Orphaned Locations ---
  const referencedLocationIds = new Set<string>();

  for (const location of campaign.locations) {
    if (location.parentLocationId) referencedLocationIds.add(location.id); // has parent → referenced
    for (const subId of location.subLocationIds) referencedLocationIds.add(subId);
    for (const conn of location.connections ?? []) referencedLocationIds.add(conn.targetLocationId);
  }
  for (const adventure of campaign.adventures) {
    for (const scene of adventure.scenes) {
      if (scene.locationId) referencedLocationIds.add(scene.locationId);
    }
  }
  for (const faction of campaign.factions) {
    if (faction.headquartersLocationId) referencedLocationIds.add(faction.headquartersLocationId);
  }
  for (const article of campaign.articles) {
    for (const id of article.relatedEntityIds ?? []) referencedLocationIds.add(id);
  }

  for (const location of campaign.locations) {
    if (!referencedLocationIds.has(location.id)) {
      issues.push({
        id: makeId('orphan'),
        severity: 'info',
        ruleId: 'orphan',
        title: 'Orphaned location',
        description: `"${location.name}" is not referenced by any scene, faction headquarters, connection, or parent/child hierarchy.`,
        entityIds: [location.id],
        entityTypes: ['location'],
        suggestedFix: 'Link this location to a scene, set it as a faction headquarters, or add connections to other locations.',
      });
    }
  }

  // --- Orphaned Items ---
  const referencedItemIds = new Set<string>();
  for (const article of campaign.articles) {
    for (const id of article.relatedEntityIds ?? []) referencedItemIds.add(id);
  }

  for (const item of campaign.items) {
    if (!referencedItemIds.has(item.id)) {
      issues.push({
        id: makeId('orphan'),
        severity: 'info',
        ruleId: 'orphan',
        title: 'Orphaned item',
        description: `"${item.name}" is not referenced in any lore article.`,
        entityIds: [item.id],
        entityTypes: ['item'],
        suggestedFix: 'Link this item from a lore article, or assign it as scene loot.',
      });
    }
  }

  return issues;
}

// ─── Rule 4: Empty Factions (warning) ────────────────────────────────────────

function checkEmptyFactions(campaign: Campaign): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];

  for (const faction of campaign.factions) {
    const hasMembers =
      faction.memberIds.length > 0 ||
      campaign.npcs.some(n => n.factionId === faction.id);

    if (!hasMembers) {
      issues.push({
        id: makeId('empty-faction'),
        severity: 'warning',
        ruleId: 'empty-faction',
        title: 'Faction has no members',
        description: `"${faction.name}" has no NPCs assigned to it. Factions without members feel hollow to players.`,
        entityIds: [faction.id],
        entityTypes: ['faction'],
        suggestedFix: 'Create or assign at least one NPC to this faction.',
      });
    }
  }

  return issues;
}

// ─── Rule 5: Dormant Active Plots (warning) ───────────────────────────────────

function checkDormantPlots(campaign: Campaign): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];

  const activePlots = (campaign.plots ?? []).filter(p => p.status === 'active');
  if (activePlots.length === 0) return issues;

  // Collect the 3 most recent completed session logs (by sessionDate)
  const completedLogs = (campaign.sessionLogs ?? [])
    .filter(s => s.status === 'completed')
    .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime())
    .slice(0, 3);

  // Build a set of plot IDs that were "advanced" in any of those sessions
  const advancedPlotIds = new Set<string>();
  for (const log of completedLogs) {
    for (const plotId of log.relatedPlotIds ?? []) {
      const status = log.plotProgressions?.[plotId];
      if (status === 'advanced') {
        advancedPlotIds.add(plotId);
      }
    }
  }

  for (const plot of activePlots) {
    if (!advancedPlotIds.has(plot.id)) {
      issues.push({
        id: makeId('dormant-plot'),
        severity: 'warning',
        ruleId: 'dormant-plot',
        title: 'Active plot not advanced recently',
        description: `Plot "${plot.title}" is marked active but was not advanced in the last 3 completed sessions.`,
        entityIds: [plot.id],
        entityTypes: ['plot'],
        suggestedFix: 'Either advance this plot in an upcoming session, or mark it as dormant if it\'s on hold.',
      });
    }
  }

  return issues;
}

// ─── Rule 6: Scenes Without Content (info) ───────────────────────────────────

function checkScenesWithoutContent(campaign: Campaign): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];

  for (const adventure of campaign.adventures) {
    for (const scene of adventure.scenes) {
      const isEmpty =
        (!scene.readAloudText || scene.readAloudText.trim() === '') &&
        (!scene.gmNotes || scene.gmNotes.trim() === '');

      if (isEmpty) {
        issues.push({
          id: makeId('empty-scene'),
          severity: 'info',
          ruleId: 'empty-scene',
          title: 'Scene has no content',
          description: `Scene "${scene.title}" in adventure "${adventure.title}" has no read-aloud text or GM notes.`,
          entityIds: [adventure.id],
          entityTypes: ['adventure'],
          suggestedFix: 'Add read-aloud text or GM notes to make this scene playable.',
        });
      }
    }
  }

  return issues;
}

// ─── Rule 7: Adventures Without Scenes (info) ────────────────────────────────

function checkAdventuresWithoutScenes(campaign: Campaign): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];

  for (const adventure of campaign.adventures) {
    if (adventure.scenes.length === 0) {
      issues.push({
        id: makeId('empty-adventure'),
        severity: 'info',
        ruleId: 'empty-adventure',
        title: 'Adventure has no scenes',
        description: `"${adventure.title}" contains no scenes. It cannot be run at the table without at least one scene.`,
        entityIds: [adventure.id],
        entityTypes: ['adventure'],
        suggestedFix: 'Generate or create at least one scene for this adventure.',
      });
    }
  }

  return issues;
}

// ─── Rule 8: Duplicate Entity Names (warning) ─────────────────────────────────

function checkDuplicateNames(campaign: Campaign): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];

  function findDuplicates<T extends { id: string; name: string }>(
    entities: T[],
    entityType: string,
    label: string
  ): ContinuityIssue[] {
    const nameMap = new Map<string, T[]>();
    for (const entity of entities) {
      const key = entity.name.toLowerCase().trim();
      if (!nameMap.has(key)) nameMap.set(key, []);
      nameMap.get(key)!.push(entity);
    }

    const dupeIssues: ContinuityIssue[] = [];
    for (const [, group] of nameMap) {
      if (group.length > 1) {
        dupeIssues.push({
          id: makeId('duplicate-name'),
          severity: 'warning',
          ruleId: 'duplicate-name',
          title: `Duplicate ${label} name`,
          description: `${group.length} ${label.toLowerCase()}s share the name "${group[0].name}". This can confuse players and cause tracking errors.`,
          entityIds: group.map(e => e.id),
          entityTypes: group.map(() => entityType),
          suggestedFix: `Rename one of the "${group[0].name}" ${label.toLowerCase()}s to make it distinct.`,
        });
      }
    }
    return dupeIssues;
  }

  issues.push(...findDuplicates(campaign.npcs, 'npc', 'NPC'));
  issues.push(...findDuplicates(campaign.locations, 'location', 'Location'));
  issues.push(...findDuplicates(campaign.factions, 'faction', 'Faction'));
  issues.push(...findDuplicates(campaign.items, 'item', 'Item'));

  return issues;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Run all continuity rules against the campaign and return a flat list of issues.
 * Pure function — reads campaign data only, makes no changes.
 */
export function checkContinuity(campaign: Campaign): ContinuityIssue[] {
  // Reset the counter so IDs are deterministic per run (not required but keeps tests clean).
  _issueCounter = 0;

  return [
    ...checkBrokenReferences(campaign),
    ...checkCircularLocationHierarchy(campaign),
    ...checkOrphanedEntities(campaign),
    ...checkEmptyFactions(campaign),
    ...checkDormantPlots(campaign),
    ...checkScenesWithoutContent(campaign),
    ...checkAdventuresWithoutScenes(campaign),
    ...checkDuplicateNames(campaign),
  ];
}
