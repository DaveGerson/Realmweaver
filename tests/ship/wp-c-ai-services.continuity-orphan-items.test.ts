/**
 * wp-c-ai-services — finding #97 (services/continuityChecker.ts:291)
 *
 * `checkOrphanedEntities` builds `referencedItemIds` exclusively from
 * `article.relatedEntityIds`. Nothing else in types/ can reference an Item:
 * `LootItem` (types/Location.ts) is `{ id, description, pointOfInterestId }`
 * with no item id, `Scene.rewards` is free text, and there is no NPC/PC
 * inventory field. So a campaign with items and no lore articles emits one
 * "Orphaned item" info issue per item — 100 % noise that buries the genuine
 * broken-reference errors in the same list.
 *
 * Worse, the suggestedFix says "Link this item from a lore article, or assign
 * it as scene loot" — the second half is impossible, so a DM who follows it
 * sees the issue persist forever.
 *
 * Acceptable fixes: drop the rule until items are linkable from more than
 * articles, OR make items genuinely linkable and count those references. In
 * either case the checker must never emit advice the app cannot honour.
 */

import { describe, it, expect } from 'vitest';
import { checkContinuity } from '../../services/continuityChecker';
import type { Campaign } from '../../types/Campaign';
import type { Item } from '../../types/Item';

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'c-1',
    title: 'Test Campaign',
    settingType: 'custom',
    setting: 'Test',
    npcs: [],
    locations: [],
    factions: [],
    items: [],
    adventures: [],
    articles: [],
    sessionLogs: [],
    playerCharacters: [],
    plots: [],
    notes: [],
    ...overrides,
  };
}

function makeItems(count: number): Item[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    name: `Sunsteel Blade ${i}`,
    description: 'A blade that hums at dawn.',
    properties: '+1 to hit',
    history: [],
  })) as unknown as Item[];
}

const orphanItemIssues = (campaign: Campaign) =>
  checkContinuity(campaign).filter(i => i.title === 'Orphaned item');

describe('continuityChecker orphaned-item rule (#97)', () => {
  it('never suggests an action the app cannot perform', () => {
    const campaign = makeCampaign({ items: makeItems(40) });

    for (const issue of orphanItemIssues(campaign)) {
      // Scene rewards are free text and LootItem carries no item id, so
      // "assign it as scene loot" is not something a user can do.
      expect(issue.suggestedFix).not.toMatch(/scene loot/i);
    }
  });

  it('does not flag every item when no reference channel exists at all', () => {
    // No lore articles => `referencedItemIds` is necessarily empty, so today
    // EVERY item is reported. 40 info issues of pure noise on every run.
    const campaign = makeCampaign({ items: makeItems(40) });

    expect(orphanItemIssues(campaign)).toHaveLength(0);
  });
});
