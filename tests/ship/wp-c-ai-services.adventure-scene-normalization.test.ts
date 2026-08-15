/**
 * wp-c-ai-services — finding #7 (types/Evocation.ts:10 + the paths that trust it)
 *
 * `AdventureForBatchAdd` types its scenes as `Omit<Scene, 'id'>`, which makes
 * `status: SceneStatus` and `npcIds: string[]` REQUIRED. Nothing produces them
 * on the real-provider path:
 *   - `sceneSchema` (services/ai/realmWeaver.ts:65) declares only
 *     title / type / readAloudText / gmNotes / skillChecks / rewards
 *   - `adventureConfig.postProcess` (realmWeaver.ts:239) normalises
 *     `skillChecks` only
 *   - `campaignService.createFullAdventure` spreads the AI object straight
 *     into the campaign with just an added `id`
 *
 * Consequences with mock mode OFF (mockService hand-writes both fields, which
 * is why 516 tests stay green):
 *   - `deleteNpc` → `scene.npcIds.filter(...)` throws inside the Immer
 *     producer, so the NPC is never deleted and the whole update aborts
 *   - SceneListPanel.tsx:61, PrepDocumentView.tsx:28, continuityChecker.ts:99
 *     and autoLinker.ts:53 all crash on the same undefined
 *   - `status === undefined` makes AdventureDashboard report 0 completed
 *     scenes forever
 *
 * Fix: normalise in `createFullAdventure` (build each scene from
 * `createDefaultScene()` and spread the AI data over it), apply the same in
 * `evocationWizard.postProcessResult` (which patches `npcIds` but not
 * `status`), and narrow the type to
 * `scenes: Omit<Scene, 'id' | 'status' | 'npcIds'>[]`.
 */

import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import { setupTestEnvironment, makeTestStore, type CreateCampaignStoreFn } from '../helpers/testStoreFactory';

setupTestEnvironment();

let createCampaignStore: CreateCampaignStoreFn;

beforeAll(async () => {
  const mod = await import('../../services/campaignService');
  createCampaignStore = mod.createCampaignStore;
});

/** Exactly what the real provider returns for `sceneSchema` — no npcIds, no status. */
const aiSceneFromRealProvider = {
  title: 'The Drowned Gate',
  type: 'exploration',
  readAloudText: 'Black water laps at the portcullis.',
  gmNotes: 'The gate is rusted shut.',
  skillChecks: [],
  rewards: 'A waterlogged ledger.',
};

const aiAdventureFromRealProvider = {
  title: 'Beneath Hollowmere',
  hook: 'A child has gone missing beneath the mere.',
  theme: 'Drowned horror',
  level: '3',
  scenes: [aiSceneFromRealProvider],
};

describe('createFullAdventure normalises AI scenes (#7)', () => {
  it('gives every scene an npcIds array even when the AI omits it', () => {
    const { service, campaign } = makeTestStore(createCampaignStore);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service.createFullAdventure(aiAdventureFromRealProvider as any);

    const scene = campaign().adventures[0].scenes[0];
    expect(Array.isArray(scene.npcIds)).toBe(true);
    expect(scene.npcIds).toEqual([]);
  });

  it("defaults every scene's status to 'planned' when the AI omits it", () => {
    const { service, campaign } = makeTestStore(createCampaignStore);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service.createFullAdventure(aiAdventureFromRealProvider as any);

    expect(campaign().adventures[0].scenes[0].status).toBe('planned');
  });

  it('deleteNpc does not throw (and actually deletes) after a real-provider adventure', () => {
    const { service, campaign } = makeTestStore(createCampaignStore);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service.createFullAdventure(aiAdventureFromRealProvider as any);

    const npcId = service.createNpc({
      name: 'Grix', description: '', traits: '', backstory: '', motivations: '',
      secrets: '', stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
    });

    // Today: `scene.npcIds.filter(...)` throws TypeError inside the Immer
    // producer, the state update aborts, and the NPC survives.
    expect(() => service.deleteNpc(npcId)).not.toThrow();
    expect(campaign().npcs.find(n => n.id === npcId)).toBeUndefined();
  });

  it('preserves the AI-supplied fields it does receive', () => {
    const { service, campaign } = makeTestStore(createCampaignStore);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service.createFullAdventure(aiAdventureFromRealProvider as any);

    const scene = campaign().adventures[0].scenes[0];
    expect(scene.title).toBe('The Drowned Gate');
    expect(scene.type).toBe('exploration');
    expect(scene.gmNotes).toBe('The gate is rusted shut.');
    expect(scene.id).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// The Evocation Wizard path patches npcIds but still misses status.
// ---------------------------------------------------------------------------

vi.mock('../../services/ai/core', () => ({
  generateWithSchema: vi.fn(),
  generateText: vi.fn(),
  generateChatCompletion: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('evocationWizard.postProcessResult normalises scene status (#7)', () => {
  it("fills in status: 'planned' for scenes returned without one", async () => {
    const core = await import('../../services/ai/core');
    vi.mocked(core.generateWithSchema).mockResolvedValue({
      adventures: [aiAdventureFromRealProvider],
    });

    const aiService = await import('../../services/aiService');
    const result = await aiService.generateCampaignFill(
      'A drowned town',
      { npcs: false, locations: false, factions: false, adventures: true, items: false },
      /* isMockMode */ false,
      'Campaign: Test'
    );

    const scene = result.adventures[0].scenes[0];
    expect(scene.npcIds).toEqual([]); // already patched today
    expect(scene.status).toBe('planned'); // not patched today
  });
});
