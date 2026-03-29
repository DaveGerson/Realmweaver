import { describe, it, expect } from 'vitest';
import { findUnlinkedEntities } from '../../components/common/SceneSmartLinkBar';
import type { EntityCandidate } from '../../services/linking/matchingEngine';

const npcs: EntityCandidate[] = [
  { id: 'npc1', name: 'Kalli Alran', type: 'npc' },
  { id: 'npc2', name: 'Brackle', type: 'npc' },
  { id: 'npc3', name: 'Belaluur', type: 'npc' },
];
const locations: EntityCandidate[] = [
  { id: 'loc1', name: 'Salvation', type: 'location' },
  { id: 'loc2', name: 'The Mournland', type: 'location' },
];

describe('findUnlinkedEntities', () => {
  it('finds NPCs mentioned in text but not in npcIds', () => {
    const result = findUnlinkedEntities('Kalli Alran and Brackle discuss the plan.', '', ['npc1'], null, npcs, locations);
    expect(result.npcs).toHaveLength(1);
    expect(result.npcs[0].entityName).toBe('Brackle');
  });

  it('finds locations mentioned in text but not set as locationId', () => {
    const result = findUnlinkedEntities('The party arrives at Salvation.', '', [], null, npcs, locations);
    expect(result.locations).toHaveLength(1);
    expect(result.locations[0].entityName).toBe('Salvation');
  });

  it('excludes already-linked entities', () => {
    const result = findUnlinkedEntities('Kalli Alran is in Salvation.', '', ['npc1'], 'loc1', npcs, locations);
    expect(result.npcs).toHaveLength(0);
    expect(result.locations).toHaveLength(0);
  });

  it('scans both readAloudText and gmNotes', () => {
    const result = findUnlinkedEntities('Brackle speaks.', 'Belaluur watches from the shadows.', [], null, npcs, locations);
    expect(result.npcs).toHaveLength(2);
  });

  it('returns empty when no mentions found', () => {
    const result = findUnlinkedEntities('Nothing happens.', '', [], null, npcs, locations);
    expect(result.npcs).toHaveLength(0);
    expect(result.locations).toHaveLength(0);
  });
});
