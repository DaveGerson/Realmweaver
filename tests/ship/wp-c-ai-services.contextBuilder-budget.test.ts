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
