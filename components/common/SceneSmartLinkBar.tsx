import React, { useMemo } from 'react';
import { Icons } from './Icons';
import { getMatchingEngine } from '../../services/linking/engineRegistry';
import type { EntityCandidate, EntityMatch } from '../../services/linking/matchingEngine';

// ─── Re-export EntityMatch for consumers ─────────────────────────────────────
export type { EntityMatch };

// ─── Detection Function (exported for testing) ────────────────────────────────

export function findUnlinkedEntities(
  readAloudText: string,
  gmNotes: string,
  currentNpcIds: string[],
  currentLocationId: string | null,
  allNpcs: EntityCandidate[],
  allLocations: EntityCandidate[],
): { npcs: EntityMatch[]; locations: EntityMatch[] } {
  const combinedText = [readAloudText, gmNotes].filter(Boolean).join(' ');
  if (!combinedText.trim()) {
    return { npcs: [], locations: [] };
  }

  const engine = getMatchingEngine();

  // Find NPC matches, filter out already-linked, deduplicate by entityId
  const npcMatches = engine.findMatches(combinedText, allNpcs);
  const seenNpcIds = new Set<string>();
  const unlinkedNpcs: EntityMatch[] = [];
  for (const match of npcMatches) {
    if (!currentNpcIds.includes(match.entityId) && !seenNpcIds.has(match.entityId)) {
      seenNpcIds.add(match.entityId);
      unlinkedNpcs.push(match);
    }
  }

  // Find location matches, filter out already-linked, deduplicate by entityId
  const locationMatches = engine.findMatches(combinedText, allLocations);
  const seenLocationIds = new Set<string>();
  const unlinkedLocations: EntityMatch[] = [];
  for (const match of locationMatches) {
    if (match.entityId !== currentLocationId && !seenLocationIds.has(match.entityId)) {
      seenLocationIds.add(match.entityId);
      unlinkedLocations.push(match);
    }
  }

  return { npcs: unlinkedNpcs, locations: unlinkedLocations };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SceneSmartLinkBarProps {
  readAloudText: string;
  gmNotes: string;
  currentNpcIds: string[];
  currentLocationId: string | null;
  allNpcs: EntityCandidate[];
  allLocations: EntityCandidate[];
  onAddNpc: (npcId: string) => void;
  onSetLocation: (locationId: string) => void;
}

export const SceneSmartLinkBar: React.FC<SceneSmartLinkBarProps> = ({
  readAloudText,
  gmNotes,
  currentNpcIds,
  currentLocationId,
  allNpcs,
  allLocations,
  onAddNpc,
  onSetLocation,
}) => {
  const detected = useMemo(
    () =>
      findUnlinkedEntities(
        readAloudText,
        gmNotes,
        currentNpcIds,
        currentLocationId,
        allNpcs,
        allLocations,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      readAloudText,
      gmNotes,
      // Stringify the arrays so the memo invalidates when ids change
      // eslint-disable-next-line react-hooks/exhaustive-deps
      currentNpcIds.join(','),
      currentLocationId,
      allNpcs,
      allLocations,
    ],
  );

  if (detected.npcs.length === 0 && detected.locations.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 mb-2 bg-amber-950/30 border border-amber-800/40 rounded-md text-xs">
      <span className="flex items-center gap-1 text-amber-400 font-medium shrink-0">
        <Icons.Sparkles className="w-3.5 h-3.5" />
        Detected:
      </span>

      {detected.npcs.map(match => (
        <button
          key={match.entityId}
          type="button"
          onClick={() => onAddNpc(match.entityId)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-amber-900/40 text-amber-300 border-amber-700/50 hover:bg-amber-800/60 hover:border-amber-600/60 transition-colors"
          title={`Add NPC: ${match.entityName}`}
        >
          <Icons.NPCs className="w-3 h-3" />
          {match.entityName}
          <span className="ml-0.5 text-amber-400 font-bold">+</span>
        </button>
      ))}

      {detected.locations.map(match => (
        <button
          key={match.entityId}
          type="button"
          onClick={() => onSetLocation(match.entityId)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-emerald-900/40 text-emerald-300 border-emerald-700/50 hover:bg-emerald-800/60 hover:border-emerald-600/60 transition-colors"
          title={`Set location: ${match.entityName}`}
        >
          <Icons.MapPin className="w-3 h-3" />
          {match.entityName}
          <span className="ml-0.5 text-emerald-400 font-bold">+</span>
        </button>
      ))}
    </div>
  );
};
