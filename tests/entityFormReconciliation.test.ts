import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestEnvironment } from './helpers/testStoreFactory';

// FactionEditor pulls in the campaignService singleton (which touches localStorage
// on import) and other UI modules, so set up the environment before importing it —
// mirrors the dynamic-import pattern used in entityFieldSave.test.ts.
setupTestEnvironment();

let reconcileEntityFormData: typeof import('../components/editors/FactionEditor').reconcileEntityFormData;

beforeAll(async () => {
  const mod = await import('../components/editors/FactionEditor');
  reconcileEntityFormData = mod.reconcileEntityFormData;
});

interface TestEntity {
  id: string;
  name: string;
  goals: string;
  memberIds: string[];
}

describe('reconcileEntityFormData', () => {
  it('adopts an incoming field the user has not edited since the last sync', () => {
    const prevSeen: TestEntity = { id: '1', name: 'Order', goals: 'Protect the realm', memberIds: [] };
    const incoming: TestEntity = { id: '1', name: 'Order', goals: 'Protect the realm', memberIds: ['npc-1'] };
    // `prev` (local formData) is identical to what we last saw — no local edits.
    const prev: TestEntity = { ...prevSeen };

    const result = reconcileEntityFormData(prev, prevSeen, incoming);

    expect(result.memberIds).toEqual(['npc-1']);
    expect(result.name).toBe('Order');
  });

  it('preserves an unblurred local edit even when the entity mutates elsewhere (the race in the bug report)', () => {
    // The GM is mid-edit on `goals` — formData.goals diverges from what was last
    // synced from props (prevSeen), but hasn't been committed via onUpdate yet.
    const prevSeen: TestEntity = { id: '1', name: 'Order', goals: 'Protect the realm', memberIds: [] };
    const prev: TestEntity = { ...prevSeen, goals: 'Protect the realm and its secrets' };

    // Meanwhile an async action (e.g. generating a member NPC) mutates the same
    // faction elsewhere, producing a new `incoming` reference with an updated
    // memberIds array but unrelated/unchanged goals from the store's perspective.
    const incoming: TestEntity = { id: '1', name: 'Order', goals: 'Protect the realm', memberIds: ['npc-1'] };

    const result = reconcileEntityFormData(prev, prevSeen, incoming);

    // The in-progress edit must survive...
    expect(result.goals).toBe('Protect the realm and its secrets');
    // ...while the unrelated field mutated elsewhere is still adopted.
    expect(result.memberIds).toEqual(['npc-1']);
  });

  it('fully adopts the incoming entity when switching to a different entity id', () => {
    const prevSeen: TestEntity = { id: '1', name: 'Order', goals: 'Protect the realm', memberIds: [] };
    const prev: TestEntity = { ...prevSeen, goals: 'Unsaved draft for a different faction' };
    const incoming: TestEntity = { id: '2', name: 'Cabal', goals: 'Seize power', memberIds: ['npc-9'] };

    const result = reconcileEntityFormData(prev, prevSeen, incoming);

    expect(result).toEqual(incoming);
  });

  it('is a no-op when the incoming entity is unchanged from what was last seen', () => {
    const prevSeen: TestEntity = { id: '1', name: 'Order', goals: 'Protect the realm', memberIds: [] };
    const prev: TestEntity = { ...prevSeen, name: 'Order (draft)' };

    const result = reconcileEntityFormData(prev, prevSeen, prevSeen);

    expect(result.name).toBe('Order (draft)');
  });
});
