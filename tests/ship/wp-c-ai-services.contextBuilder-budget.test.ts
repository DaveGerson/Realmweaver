/**
 * wp-c-ai-services — findings #15 and #44
 *
 * #15: `tryAdd` in services/contextBuilder.ts is all-or-nothing:
 *      `if (usedChars + text.length > maxChars) return false;`
 *      Tier 3 builds ONE giant string containing every NPC, so once the
 *      campaign grows past ~120 NPCs the entire NPC roster is silently
 *      discarded and the context collapses to the two Tier-1 lines.
 *
 * #44: The existing budget tests only assert the UPPER bound, never that
 *      content survives at the default budget — which is why the collapse
 *      ships green.
 *
 * Desired behaviour: list sections must be filled entry-by-entry until the
 * remaining budget is exhausted (with an "…and N more" marker), never dropped
 * wholesale.
 */

import { describe, it, expect } from 'vitest';
import { buildCampaignContext } from '../../services/contextBuilder';
import type { Campaign } from '../../types/Campaign';
import type { NPC } from '../../types/NPC';
import type { Location } from '../../types/Location';
import type { Faction } from '../../types/Faction';
import type { Article } from '../../types/Article';
import type { Item } from '../../types/Item';

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'c1',
    title: 'Test Campaign',
    settingType: 'custom',
    setting: 'A grim fantasy world where magic is dying.',
    articles: [],
    adventures: [],
    npcs: [],
    locations: [],
    factions: [],
    items: [],
    sessionLogs: [],
    playerCharacters: [],
    plots: [],
    notes: [],
    ...overrides,
  };
}

function makeNpcs(count: number): NPC[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `npc-${i}`,
    name: `Ser Aldric Number ${i}`,
    description: `A weathered sellsword who keeps a tally of debts owed in a ledger of cracked leather. Entry ${i}.`,
    traits: 'Cunning, ambitious',
    backstory: 'Grew up in poverty.',
    motivations: 'Seeks power.',
    secrets: 'Works for the enemy.',
    stats: 'HP: 40',
    exampleQuote: 'Nothing personal.',
    knowsPlayerHistory: [],
    relationships: [],
    history: [],
  })) as NPC[];
}

function makeLocations(count: number): Location[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `loc-${i}`,
    name: `Hollowmere Ward ${i}`,
    description: `A rain-slick district of leaning tenements and drowned cellars. District ${i}.`,
    secrets: '',
    subLocationIds: [],
    pointsOfInterest: [],
    connections: [],
    history: [],
  })) as unknown as Location[];
}

function makeFactions(count: number): Faction[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `fac-${i}`,
    name: `The Ashen Concord ${i}`,
    description: `A shadowy cabal seeking to control the dying magic. Chapter ${i}.`,
    goals: 'Consolidate arcane power before it fades entirely.',
    memberIds: [],
  })) as Faction[];
}

function makeArticles(count: number): Article[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `art-${i}`,
    title: `On the Fading of the Weave, Vol. ${i}`,
    category: 'lore' as const,
    content: `A lengthy treatise on arcane decay. Volume ${i}.`,
    subArticleIds: [],
  })) as Article[];
}

function makeItems(count: number): Item[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    name: `Shard of the Last Ember ${i}`,
    description: `A fragment of dying magic bound in cold iron. Piece ${i}.`,
    rarity: 'rare' as const,
    properties: 'Glows faintly when true magic is nearby.',
  })) as Item[];
}

/** Rough token estimate matching the builder's internal formula. */
const estimateTokens = (text: string) => Math.ceil(text.length / 4);

/** Count of "  - " roster entry lines inside the `NPCs:` section. */
function npcRosterEntryCount(ctx: string): number {
  const start = ctx.indexOf('NPCs:');
  if (start === -1) return 0;
  const section = ctx.slice(start);
  return (section.match(/^ {2}- Ser Aldric Number \d+/gm) ?? []).length;
}

describe('contextBuilder — large campaigns must keep their entity rosters (findings #15, #44)', () => {
  it('still emits a substantial NPC roster at the default 4000-token budget with 200 NPCs', () => {
    const campaign = makeCampaign({ npcs: makeNpcs(200), locations: makeLocations(50) });

    const ctx = buildCampaignContext({ variant: 'generation', campaign });

    // Upper bound is still respected...
    expect(estimateTokens(ctx)).toBeLessThanOrEqual(4000 + 25);

    // ...but the roster must NOT be dropped wholesale. Today the whole
    // `NPCs:` block overflows `maxChars` in one go and `tryAdd` returns
    // false, so `ctx` collapses to ~67 characters.
    expect(ctx).toContain('NPCs:');
    expect(npcRosterEntryCount(ctx)).toBeGreaterThanOrEqual(20);
  });

  it('does not collapse to a bare Tier-1 stub when Tier 3 overflows', () => {
    const campaign = makeCampaign({ npcs: makeNpcs(200), locations: makeLocations(50) });

    const ctx = buildCampaignContext({ variant: 'generation', campaign });

    // A 200-NPC campaign should be filling most of its budget, not 67 chars.
    expect(ctx.length).toBeGreaterThan(8000);
  });

  it('marks the elided remainder instead of silently dropping entries', () => {
    const campaign = makeCampaign({ npcs: makeNpcs(200) });

    const ctx = buildCampaignContext({ variant: 'generation', campaign });

    // Some form of "…and N more" truncation marker must be present so the
    // model (and any future debugging) knows the list was cut short.
    expect(ctx).toMatch(/\d+\s+more/i);
  });
});

describe('contextBuilder — a full NPC roster must not starve every other Tier-3 section', () => {
  // Reproduces the verifier's exact repro shape: a mature campaign with
  // several large entity collections at the default 4000-token budget.
  // Before the per-section quota, `NPCs:` (the first Tier-3 section) filled
  // greedily to within a byte of `maxChars`, so `Locations:`, `Factions:`,
  // `Lore Articles:` and `Notable Items:` all silently vanished — the exact
  // failure mode finding #15 was written to fix, just shifted one section
  // over.
  it('keeps at least a truncated slice of Locations/Factions/Lore Articles/Items alongside a full NPC roster', () => {
    const campaign = makeCampaign({
      npcs: makeNpcs(200),
      locations: makeLocations(50),
      factions: makeFactions(20),
      articles: makeArticles(15),
      items: makeItems(40),
    });

    const ctx = buildCampaignContext({ variant: 'generation', campaign });

    // Upper bound still respected.
    expect(estimateTokens(ctx)).toBeLessThanOrEqual(4000 + 25);

    // NPCs still get a substantial (if now shared) slice of the budget.
    expect(ctx).toContain('NPCs:');
    expect(npcRosterEntryCount(ctx)).toBeGreaterThan(0);

    // Every sibling Tier-3 section must be PRESENT — truncated is fine,
    // wholly absent is the bug. Each header appearing at all means the
    // section was not dropped whole.
    expect(ctx).toContain('Locations:');
    expect(ctx).toContain('Factions:');
    expect(ctx).toContain('Lore Articles:');
    expect(ctx).toContain('Notable Items:');
  });

  it('gives every Tier-3 list section a non-zero character allowance, not just the first one', () => {
    const campaign = makeCampaign({
      npcs: makeNpcs(200),
      locations: makeLocations(50),
      factions: makeFactions(20),
    });

    const ctx = buildCampaignContext({ variant: 'generation', campaign });

    const npcStart = ctx.indexOf('NPCs:');
    const locStart = ctx.indexOf('Locations:');
    const facStart = ctx.indexOf('Factions:');

    expect(npcStart).toBeGreaterThanOrEqual(0);
    expect(locStart).toBeGreaterThan(npcStart);
    expect(facStart).toBeGreaterThan(locStart);

    // Each section must contain at least one real roster line (not just the
    // header immediately followed by the next section's header).
    const locSection = ctx.slice(locStart, facStart);
    expect(locSection.split('\n').length).toBeGreaterThan(1);
  });
});
