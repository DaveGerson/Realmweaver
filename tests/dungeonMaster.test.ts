import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  setupTestEnvironment,
  makeTestStore,
  type CreateCampaignStoreFn,
} from './helpers/testStoreFactory';
import {
  createDungeonMasterState,
  executeAction,
} from '../services/rules/engine';
import { demoParty } from '../services/rules/characters';
import { loadSrd, searchSrd } from '../services/rules/srd';
import { validateDmProposal } from '../services/ai/dungeonMaster';
import { resolveDmProposal } from '../services/dungeonMasterService';
import type { DmProposal } from '../types/index';

setupTestEnvironment();
let createStore: CreateCampaignStoreFn;
beforeAll(async () => {
  createStore = (await import('../services/campaignService'))
    .createCampaignStore;
});
const proposal: DmProposal = {
  narration: 'You attempt to strike the raider.',
  action: {
    kind: 'attack',
    actorId: 'demo-warden',
    targetId: 'demo-raider',
    weaponId: 'longsword',
  },
  rulePages: [14],
  needsRuling: null,
  suggestedOptions: [],
};

describe('Complete SRD reference and evidence boundary', () => {
  it('contains every page exactly once and retrieves current rules', async () => {
    const pages = await loadSrd();
    expect(pages.map((p) => p.page)).toEqual(
      Array.from({ length: 364 }, (_, i) => i + 1),
    );
    expect(pages.every((p) => p.text.length > 100)).toBe(true);
    expect(searchSrd(pages, 'Exhaustion')[0].page).toBe(181);
    expect(
      searchSrd(pages, 'Wish').some((p) => p.headings.includes('Wish')),
    ).toBe(true);
    expect(searchSrd(pages, 'Warhorse')[0].section).toBe('Animals');
  });
  it('rejects fabricated or unretrieved citations', async () => {
    const pages = (await loadSrd()).filter((p) => p.page === 14);
    expect(() =>
      validateDmProposal(
        { ...proposal, rulePages: [999] },
        pages,
        createDungeonMasterState(demoParty()),
        'demo-warden',
      ),
    ).toThrow('not supplied');
    expect(() =>
      validateDmProposal(
        { ...proposal, rulePages: [17] },
        pages,
        createDungeonMasterState(demoParty()),
        'demo-warden',
      ),
    ).toThrow('not supplied');
  });
  it('rejects attempts to control another actor or inject arbitrary state', async () => {
    const pages = (await loadSrd()).filter((p) => p.page === 14);
    const state = createDungeonMasterState(demoParty());
    expect(() =>
      validateDmProposal(proposal, pages, state, 'demo-acolyte'),
    ).toThrow('different creature');
    expect(() =>
      validateDmProposal(
        { ...proposal, action: { ...proposal.action, hp: 999 } },
        pages,
        state,
        'demo-warden',
      ),
    ).toThrow('Unexpected action field');
  });
  it('leaves mechanics unchanged for an explicit ruling request', () => {
    const state = createDungeonMasterState(demoParty());
    const result = resolveDmProposal(state, 'Use an unimplemented feature.', {
      ...proposal,
      needsRuling: 'Choose the feature interpretation.',
    });
    expect(result.status).toBe('needs-ruling');
    expect(result.state.actors).toEqual(state.actors);
    expect(result.state.messages.at(-1)?.text).toContain('Ruling needed');
  });
  it('narration includes the actual engine miss and never applies damage for a miss', () => {
    const state = createDungeonMasterState(demoParty());
    const result = resolveDmProposal(state, 'Attack.', proposal, () => 1);
    expect(result.state.actors[2].hp).toBe(9);
    expect(result.state.messages.at(-1)?.text).toContain('failure');
    expect(state.messages).toHaveLength(0);
  });
});
describe('Campaign integration and stale response protection', () => {
  it('commits play state only at the expected revision', () => {
    const { service, campaign } = makeTestStore(createStore);
    const state = createDungeonMasterState(demoParty());
    state.revision = 1;
    expect(service.commitDungeonMaster(campaign().id, 0, state)).toBe(true);
    const newer = executeAction(
      state,
      { kind: 'check', actorId: 'demo-warden', ability: 'wisdom', dc: 10 },
      () => 15,
    ).state;
    expect(service.commitDungeonMaster(campaign().id, 1, newer)).toBe(true);
    expect(service.commitDungeonMaster(campaign().id, 1, newer)).toBe(false);
    expect(campaign().dungeonMaster?.revision).toBe(2);
  });
  it('does not copy a live AI DM session into a duplicated campaign', () => {
    const { service, campaign } = makeTestStore(createStore);
    const state = createDungeonMasterState(demoParty());
    state.revision = 1;
    service.commitDungeonMaster(campaign().id, 0, state);
    const id = service.duplicateCampaign(campaign().id);
    expect(
      service.getState().campaigns.find((c) => c.id === id)?.dungeonMaster,
    ).toBeUndefined();
  });
  it('uses the mock provider path without a network call', async () => {
    const { campaign } = makeTestStore(createStore);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Network forbidden'));
    try {
      const { runDungeonMasterTurn } =
        await import('../services/dungeonMasterService');
      const result = await runDungeonMasterTurn(
        campaign(),
        createDungeonMasterState(demoParty()),
        'I search the room.',
        'demo-warden',
        true,
      );
      expect(result.events[0].roll?.kind).toBe('perception');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
