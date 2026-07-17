import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestEnvironment } from './helpers/testStoreFactory';
import type { Campaign } from '../types/index';

// Must set up localStorage before importing MentionInput, since it imports the
// campaignService singleton (which touches localStorage on module load).
setupTestEnvironment();

let findMentionedIdsInText: typeof import('../components/common/MentionInput').findMentionedIdsInText;
let resolveMentionCandidates: typeof import('../components/common/MentionInput').resolveMentionCandidates;

beforeAll(async () => {
  const mod = await import('../components/common/MentionInput');
  findMentionedIdsInText = mod.findMentionedIdsInText;
  resolveMentionCandidates = mod.resolveMentionCandidates;
});

describe('findMentionedIdsInText', () => {
  it('matches an exact @Name mention', () => {
    const ids = findMentionedIdsInText('@Ann is waiting outside.', [{ id: 'npc-ann', name: 'Ann' }]);
    expect(ids).toEqual(['npc-ann']);
  });

  it('does not treat a shorter tracked name as a false match inside a longer name (word-boundary regression)', () => {
    // 'Ann' must not falsely match inside '@Anna' — this is the substring bug.
    const ids = findMentionedIdsInText('@Anna arrives at the gate.', [{ id: 'npc-ann', name: 'Ann' }]);
    expect(ids).toEqual([]);
  });

  it('matches both names correctly when both are tracked and only the longer one is mentioned', () => {
    const candidates = [
      { id: 'npc-ann', name: 'Ann' },
      { id: 'npc-anna', name: 'Anna' },
    ];
    const ids = findMentionedIdsInText('@Anna arrives at the gate.', candidates);
    expect(ids).toEqual(['npc-anna']);
  });

  it('matches the shorter name when it appears on its own', () => {
    const candidates = [
      { id: 'npc-ann', name: 'Ann' },
      { id: 'npc-anna', name: 'Anna' },
    ];
    const ids = findMentionedIdsInText('@Ann waves from across the room.', candidates);
    expect(ids).toEqual(['npc-ann']);
  });

  it('stops tracking a mention once it is edited away (no longer present in the text)', () => {
    // Regression: previously `text.includes('@Ann')` stayed true for '@Anna' even
    // after the user edited '@Ann' into '@Anna' referring to someone else.
    const candidates = [{ id: 'npc-ann', name: 'Ann' }];
    const idsAfterEdit = findMentionedIdsInText('@Anna is a different person now.', candidates);
    expect(idsAfterEdit).toEqual([]);
  });

  it('returns no ids for text with no mentions', () => {
    expect(findMentionedIdsInText('Nothing to see here.', [{ id: 'npc-ann', name: 'Ann' }])).toEqual([]);
  });
});

describe('resolveMentionCandidates', () => {
  const campaign: Campaign = {
    id: 'c1',
    title: 'Test Campaign',
    settingType: 'custom',
    setting: 'A fantasy world',
    articles: [{ id: 'art-1', title: 'History of the Realm' } as any],
    adventures: [],
    npcs: [{ id: 'npc-1', name: 'Ann' } as any],
    locations: [{ id: 'loc-1', name: 'Salvation' } as any],
    factions: [{ id: 'fac-1', name: 'The Order' } as any],
    items: [],
    sessionLogs: [],
    playerCharacters: [],
    plots: [],
    notes: [],
  };

  it('resolves persisted mentionedEntityIds back into named candidates', () => {
    const candidates = resolveMentionCandidates(campaign, ['npc-1', 'loc-1']);
    expect(candidates).toHaveLength(2);
    expect(candidates.find(c => c.id === 'npc-1')).toMatchObject({ name: 'Ann', type: 'npc' });
    expect(candidates.find(c => c.id === 'loc-1')).toMatchObject({ name: 'Salvation', type: 'location' });
  });

  it('returns an empty array when campaign is undefined', () => {
    expect(resolveMentionCandidates(undefined, ['npc-1'])).toEqual([]);
  });

  it('returns an empty array when ids is undefined or empty', () => {
    expect(resolveMentionCandidates(campaign, undefined)).toEqual([]);
    expect(resolveMentionCandidates(campaign, [])).toEqual([]);
  });

  it('ignores ids that do not match any entity in the campaign', () => {
    expect(resolveMentionCandidates(campaign, ['does-not-exist'])).toEqual([]);
  });
});
