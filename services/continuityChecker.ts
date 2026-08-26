
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

type MakeId = (ruleId: string) => string;

// ─── Rule 1: Broken References (error) ───────────────────────────────────────

function checkBrokenReferences(campaign: Campaign, makeId: MakeId): ContinuityIssue[] {
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

  // Article.relatedEntityIds — validate against all known entities. The field's
  // documented contract is "any entity" (backlinkUtils surfaces these links on
  // adventures, plots, session logs, PCs, notes and secrets too), so every
  // entity collection must count as valid or a legitimate reference gets
  // flagged as broken.
  const allEntityIds = new Set([
    ...npcIds,
    ...locationIds,
    ...factionIds,
    ...itemIds,
    ...articleIds,
    ...campaign.adventures.map(a => a.id),
    ...campaign.adventures.flatMap(a => a.scenes.map(s => s.id)),
    ...(campaign.plots ?? []).map(p => p.id),
    ...(campaign.sessionLogs ?? []).map(l => l.id),
    ...(campaign.playerCharacters ?? []).map(pc => pc.id),
    ...(campaign.notes ?? []).map(n => n.id),
    ...(campaign.secrets ?? []).map(s => s.id),
  ]);
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

  // Secret.revealsSecretId → Secret (E1 mystery edge, the fifth stop of the
  // N-place integrity contract in semantic-model.html §7). The field targets
  // a SECRET specifically — an id that resolves against some other entity
  // collection (e.g. an NPC) is still broken — and it is validated wherever
  // it appears, whatever the holder's own category.
  const secretIds = new Set((campaign.secrets ?? []).map(s => s.id));
  for (const secret of campaign.secrets ?? []) {
    if (secret.revealsSecretId && !secretIds.has(secret.revealsSecretId)) {
      issues.push({
        id: makeId('broken-ref'),
        severity: 'error',
        ruleId: 'broken-ref',
        title: 'Secret points at a missing revelation',
        description: `"${secret.title}" points at a secret (ID: ${secret.revealsSecretId.slice(0, 8)}…) that no longer exists.`,
        entityIds: [secret.id],
        entityTypes: ['secret'],
        suggestedFix: 'Open the secrets tracker and clear or reassign "Supports revelation" on this entry.',
      });
    }
  }

  return issues;
}

// ─── Rule 2: Circular Location Hierarchy (error) ─────────────────────────────

function checkCircularLocationHierarchy(campaign: Campaign, makeId: MakeId): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];
  const parentMap = new Map<string, string>();
  const locationsById = new Map(campaign.locations.map(loc => [loc.id, loc]));

  for (const loc of campaign.locations) {
    if (loc.parentLocationId) {
      parentMap.set(loc.id, loc.parentLocationId);
    }
  }

  // Every location that walks into the same cycle would otherwise report its
  // own copy of the issue, so we key de-duplication on the cycle's actual
  // membership (a canonical, order-independent key) rather than on whichever
  // location happened to start the walk.
  const reportedCycles = new Set<string>();

  for (const loc of campaign.locations) {
    // Walk up the parent chain; if we visit the same node twice, it's a cycle.
    const path: string[] = [];
    const pathIndex = new Map<string, number>();
    let currentId: string | undefined = loc.id;
    while (currentId) {
      if (pathIndex.has(currentId)) {
        const cycleNodes = path.slice(pathIndex.get(currentId)!);
        const cycleKey = [...cycleNodes].sort().join('|');
        if (!reportedCycles.has(cycleKey)) {
          reportedCycles.add(cycleKey);
          const cycleNames = cycleNodes.map(id => locationsById.get(id)?.name ?? id);
          issues.push({
            id: makeId('circular-location'),
            severity: 'error',
            ruleId: 'circular-location',
            title: 'Circular location hierarchy detected',
            description: `"${cycleNames.join('" → "')}" form a parent-child location cycle. This can cause infinite loops in the UI.`,
            entityIds: cycleNodes,
            entityTypes: cycleNodes.map(() => 'location'),
            suggestedFix: 'Remove one of the parent assignments to break the cycle.',
          });
        }
        break;
      }
      pathIndex.set(currentId, path.length);
      path.push(currentId);
      currentId = parentMap.get(currentId);
    }
  }

  return issues;
}

// ─── Rule 3: Orphaned Entities (info) ────────────────────────────────────────

function checkOrphanedEntities(campaign: Campaign, makeId: MakeId): ContinuityIssue[] {
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

  // Orphaned-item detection is intentionally omitted: nothing in types/ can
  // reference an Item other than an Article's relatedEntityIds (LootItem has
  // no item id and Scene.rewards is free text), so the rule was 100% noise
  // for any campaign without lore articles and its suggested fix ("assign it
  // as scene loot") described an action the app cannot perform. See finding
  // #97 in the wp-c-ai-services ship-readiness plan.

  return issues;
}

// ─── Rule 4: Empty Factions (warning) ────────────────────────────────────────

function checkEmptyFactions(campaign: Campaign, makeId: MakeId): ContinuityIssue[] {
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

function checkDormantPlots(campaign: Campaign, makeId: MakeId): ContinuityIssue[] {
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

function checkScenesWithoutContent(campaign: Campaign, makeId: MakeId): ContinuityIssue[] {
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

function checkAdventuresWithoutScenes(campaign: Campaign, makeId: MakeId): ContinuityIssue[] {
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

function checkDuplicateNames(campaign: Campaign, makeId: MakeId): ContinuityIssue[] {
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

// ─── Rule 9: Mystery Edges (E1/E2) ────────────────────────────────────────────

/**
 * Four lints over the `Secret.revealsSecretId` mystery-edge ontology (E1) and
 * its Three-Clue Rule amendment (E2, Option 3's per-revelation `cluesNeeded`).
 *
 * Shared definitions, identical to `utils/backlinkUtils.ts`'s inbound-clue
 * sweep and `SecretsTracker`'s inbound-clue badge:
 *   - "revelation" = a secret with `category === 'revelation'`.
 *   - "inbound clue of S" = any secret whose `revealsSecretId === S.id`,
 *     whatever its own category. A self-reference never counts.
 *   - unrevealed = `isRevealed` falsy (`undefined` counts as unrevealed).
 *   - the three-clue threshold of a revelation R is `R.cluesNeeded ?? 3`.
 *
 * Silent on a campaign with no `secrets` array, an empty one, or a secret
 * that is already revealed. `three-clue` and `revelation-without-revealed-
 * clues` additionally require actual use of the new fields (`isVital` /
 * `revealsSecretId`) to fire at all. `unreachable-revelation` and
 * `undeliverable-secret`, though, key off fields that predate this stage
 * (`category`, `isRevealed`, `linkedEntityIds`): an old save's unrevealed
 * revelation with no inbound clue, or an unrevealed secret with no
 * `linkedEntityIds`, reports one of these on first open even though the GM
 * never touched a new field. That is deliberate — both are real gaps in the
 * world as authored, not artifacts of adopting the new schema.
 */
function checkMysteryEdges(campaign: Campaign, makeId: MakeId): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];
  const secrets = campaign.secrets ?? [];
  if (secrets.length === 0) return issues;

  // Inbound-clue counts, computed once: any secret whose revealsSecretId
  // points at another secret counts toward THAT secret's inbound total,
  // never its own (a self-reference is excluded here, at the source).
  const inboundCounts = new Map<string, number>();
  for (const s of secrets) {
    if (s.revealsSecretId && s.revealsSecretId !== s.id) {
      inboundCounts.set(s.revealsSecretId, (inboundCounts.get(s.revealsSecretId) ?? 0) + 1);
    }
  }
  const inboundCountOf = (id: string): number => inboundCounts.get(id) ?? 0;

  for (const secret of secrets) {
    const unrevealed = !secret.isRevealed;
    const isRevelation = secret.category === 'revelation';
    const inbound = inboundCountOf(secret.id);

    if (isRevelation && unrevealed) {
      if (inbound === 0) {
        // unreachable-revelation (error) — nothing in the campaign can lead
        // the party here, vital or not.
        issues.push({
          id: makeId('unreachable-revelation'),
          severity: 'error',
          ruleId: 'unreachable-revelation',
          title: 'Revelation has no clues pointing at it',
          description: `"${secret.title}" is an unrevealed revelation with no clues pointing at it. Nothing in the campaign can lead the party to it.`,
          entityIds: [secret.id],
          entityTypes: ['secret'],
          suggestedFix: 'Open the secrets tracker and set "Supports revelation" to this entry on at least one clue.',
        });
      } else if (secret.isVital) {
        // three-clue (warning) — zero inbound is deliberately excluded above
        // so this rule and the unreachable error never double-report the
        // same revelation.
        const threshold = secret.cluesNeeded ?? 3;
        if (inbound < threshold) {
          issues.push({
            id: makeId('three-clue'),
            severity: 'warning',
            ruleId: 'three-clue',
            title: 'Vital revelation is short on clues',
            description: `"${secret.title}" is marked vital but only has ${inbound} of the ${threshold} clue(s) it needs pointing at it.`,
            entityIds: [secret.id],
            entityTypes: ['secret'],
            suggestedFix: 'Add another clue and set its "Supports revelation" to this entry, or lower the clues-needed threshold.',
          });
        }
      }
    }

    if (isRevelation && !unrevealed && inbound > 0) {
      // revelation-without-revealed-clues (info) — the party learned it some
      // other way; worth a glance, never an error.
      const anyClueRevealed = secrets.some(
        s => s.id !== secret.id && s.revealsSecretId === secret.id && s.isRevealed
      );
      if (!anyClueRevealed) {
        issues.push({
          id: makeId('revelation-without-revealed-clues'),
          severity: 'info',
          ruleId: 'revelation-without-revealed-clues',
          title: 'Revealed revelation has only hidden clues',
          description: `"${secret.title}" has been revealed, but none of the clues pointing at it have been revealed. The party may have learned it another way — worth confirming.`,
          entityIds: [secret.id],
          entityTypes: ['secret'],
          suggestedFix: 'Reveal one of the supporting clues, or leave it as-is if the party found this out some other way.',
        });
      }
    }

    if (unrevealed) {
      // undeliverable-secret (warning) — any category. May co-fire with
      // unreachable-revelation on the same brand-new revelation: different
      // findings (no anchor in the world vs. no clue structure), both
      // actionable.
      const linked = secret.linkedEntityIds ?? [];
      if (linked.length === 0 && inbound === 0) {
        issues.push({
          id: makeId('undeliverable-secret'),
          severity: 'warning',
          ruleId: 'undeliverable-secret',
          title: 'Secret has no way to reach the players',
          description: `"${secret.title}" is unrevealed, is not linked to any entity, and has no clue pointing at it. No NPC, location, item, or clue in the world can ever surface it.`,
          entityIds: [secret.id],
          entityTypes: ['secret'],
          suggestedFix: 'Link this entry to an NPC, location, item, or plot, or point a clue at it.',
        });
      }
    }
  }

  return issues;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Run all continuity rules against the campaign and return a flat list of issues.
 * Pure function — reads campaign data only, makes no changes.
 *
 * The ID counter is local to each call (Fix A-4) so concurrent invocations
 * cannot produce duplicate IDs.
 */
export function checkContinuity(campaign: Campaign): ContinuityIssue[] {
  let counter = 0;
  const makeId: MakeId = (ruleId: string) => `${ruleId}-${++counter}`;

  return [
    ...checkBrokenReferences(campaign, makeId),
    ...checkCircularLocationHierarchy(campaign, makeId),
    ...checkOrphanedEntities(campaign, makeId),
    ...checkEmptyFactions(campaign, makeId),
    ...checkDormantPlots(campaign, makeId),
    ...checkScenesWithoutContent(campaign, makeId),
    ...checkAdventuresWithoutScenes(campaign, makeId),
    ...checkDuplicateNames(campaign, makeId),
    ...checkMysteryEdges(campaign, makeId),
  ];
}
