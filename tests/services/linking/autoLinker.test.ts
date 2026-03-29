import { describe, it, expect } from 'vitest';
import { autoLinkScenes, autoLinkNpcFactions } from '../../../services/linking/autoLinker';

describe('autoLinkScenes', () => {
  const npcs = [
    { id: 'npc1', name: 'Kalli Alran' },
    { id: 'npc2', name: 'Brackle' },
  ];
  const locations = [
    { id: 'loc1', name: 'Salvation' },
    { id: 'loc2', name: 'The Mournland' },
  ];

  it('populates empty npcIds from scene text', () => {
    const scene = { id: 's1', title: 'Test', npcIds: [] as string[], locationId: undefined as string | undefined, readAloudText: 'Kalli Alran greets the party at Salvation.', gmNotes: 'Brackle is hiding nearby.' };
    autoLinkScenes([scene], npcs, locations);
    expect(scene.npcIds).toContain('npc1');
    expect(scene.npcIds).toContain('npc2');
  });

  it('does not overwrite existing npcIds', () => {
    const scene = { id: 's1', title: 'Test', npcIds: ['npc1'], locationId: undefined as string | undefined, readAloudText: 'Kalli Alran and Brackle are here.', gmNotes: '' };
    autoLinkScenes([scene], npcs, locations);
    expect(scene.npcIds).toContain('npc1');
    expect(scene.npcIds).toContain('npc2');
  });

  it('sets empty locationId from scene text', () => {
    const scene = { id: 's1', title: 'Test', npcIds: [] as string[], locationId: undefined as string | undefined, readAloudText: 'The party enters Salvation.', gmNotes: '' };
    autoLinkScenes([scene], npcs, locations);
    expect(scene.locationId).toBe('loc1');
  });

  it('does not overwrite existing locationId', () => {
    const scene = { id: 's1', title: 'Test', npcIds: [] as string[], locationId: 'loc2', readAloudText: 'The party is in Salvation.', gmNotes: '' };
    autoLinkScenes([scene], npcs, locations);
    expect(scene.locationId).toBe('loc2');
  });
});

describe('autoLinkNpcFactions', () => {
  it('sets empty factionId when one faction mentioned', () => {
    const npc = { id: 'npc1', name: 'Agent', factionId: undefined as string | undefined, description: 'An operative of the Emerald Claw.', backstory: '' };
    autoLinkNpcFactions([npc], [{ id: 'f1', name: 'Emerald Claw' }]);
    expect(npc.factionId).toBe('f1');
  });

  it('does not set factionId when multiple factions mentioned', () => {
    const npc = { id: 'npc1', name: 'Double Agent', factionId: undefined as string | undefined, description: 'Works for the Emerald Claw and the Dark Lanterns.', backstory: '' };
    autoLinkNpcFactions([npc], [{ id: 'f1', name: 'Emerald Claw' }, { id: 'f2', name: 'Dark Lanterns' }]);
    expect(npc.factionId).toBeUndefined();
  });
});
