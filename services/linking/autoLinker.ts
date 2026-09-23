import { getMatchingEngine } from './engineRegistry';
import type { EntityCandidate, EntityMatch } from './matchingEngine';

/**
 * A match is safe to auto-apply only when it clears the confidence bar AND
 * names exactly one entity. Ambiguous names (two NPCs called "Marcus") are
 * never resolved by array order — the engine already scores them below the
 * default 0.9, and the explicit check keeps that true for any custom
 * `minConfidence` or engine.
 */
function isConfidentUnambiguous(m: EntityMatch, minConfidence: number): boolean {
  return m.confidence >= minConfidence && !m.ambiguous;
}

interface LinkableScene {
  id: string;
  npcIds: string[];
  locationId?: string;
  readAloudText?: string;
  gmNotes?: string;
}

interface LinkableNpc {
  id: string;
  name: string;
  factionId?: string;
  description?: string;
  backstory?: string;
}

interface LinkableFaction {
  id: string;
  name: string;
  /** Mutated in place: a linked NPC's id is pushed here so the
   * NPC↔Faction bidirectional invariant holds (see services/CLAUDE.md). */
  memberIds?: string[];
}

export function autoLinkScenes(
  scenes: LinkableScene[],
  npcs: Array<{ id: string; name: string }>,
  locations: Array<{ id: string; name: string }>,
  minConfidence = 0.9,
): { scenesUpdated: number; npcsAdded: number; locationsSet: number } {
  const engine = getMatchingEngine();

  const npcCandidates: EntityCandidate[] = npcs.map(n => ({
    id: n.id,
    name: n.name,
    type: 'npc',
  }));

  const locationCandidates: EntityCandidate[] = locations.map(l => ({
    id: l.id,
    name: l.name,
    type: 'location',
  }));

  let scenesUpdated = 0;
  let npcsAdded = 0;
  let locationsSet = 0;

  for (const scene of scenes) {
    const text = `${scene.readAloudText ?? ''} ${scene.gmNotes ?? ''}`;
    let sceneChanged = false;

    // NPC matching — add any matched NPC not already in npcIds
    const npcMatches = engine.findMatches(text, npcCandidates).filter(
      m => isConfidentUnambiguous(m, minConfidence),
    );
    for (const match of npcMatches) {
      if (!scene.npcIds.includes(match.entityId)) {
        scene.npcIds.push(match.entityId);
        npcsAdded++;
        sceneChanged = true;
      }
    }

    // Location matching — only set if locationId is empty
    if (!scene.locationId) {
      const locationMatches = engine
        .findMatches(text, locationCandidates)
        .filter(m => isConfidentUnambiguous(m, minConfidence));

      if (locationMatches.length > 0) {
        // Pick the match with the longest entity name (most specific)
        const best = locationMatches.reduce((prev, curr) =>
          curr.entityName.length > prev.entityName.length ? curr : prev,
        );
        scene.locationId = best.entityId;
        locationsSet++;
        sceneChanged = true;
      }
    }

    if (sceneChanged) scenesUpdated++;
  }

  return { scenesUpdated, npcsAdded, locationsSet };
}

export function autoLinkNpcFactions(
  npcs: LinkableNpc[],
  factions: LinkableFaction[],
  minConfidence = 0.9,
): { npcsUpdated: number } {
  const engine = getMatchingEngine();

  const factionCandidates: EntityCandidate[] = factions.map(f => ({
    id: f.id,
    name: f.name,
    type: 'faction',
  }));

  let npcsUpdated = 0;

  for (const npc of npcs) {
    if (npc.factionId) continue;

    const text = `${npc.description ?? ''} ${npc.backstory ?? ''}`;
    const matches = engine
      .findMatches(text, factionCandidates)
      .filter(m => isConfidentUnambiguous(m, minConfidence));

    // Deduplicate by entityId (engine may return the same entity multiple times)
    const uniqueIds = [...new Set(matches.map(m => m.entityId))];

    // Only link when exactly one faction was mentioned
    if (uniqueIds.length === 1) {
      npc.factionId = uniqueIds[0];
      // Maintain the reverse half of the link — FactionEditor's member roster
      // and deleteFaction's member unlinking both walk memberIds only.
      const faction = factions.find(f => f.id === uniqueIds[0]);
      if (faction) {
        if (!faction.memberIds) faction.memberIds = [];
        if (!faction.memberIds.includes(npc.id)) faction.memberIds.push(npc.id);
      }
      npcsUpdated++;
    }
  }

  return { npcsUpdated };
}
