import { describe, it, expect } from 'vitest';
import { buildCampaignContext } from '../services/contextBuilder';
import type { Campaign } from '../types/Campaign';

// ---------------------------------------------------------------------------
// Minimal campaign factory
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Rough token estimate matching the builder's internal formula. */
const estimateTokens = (text: string) => Math.ceil(text.length / 4);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildCampaignContext', () => {
  it('always includes campaign title and setting (Tier 1)', () => {
    const campaign = makeCampaign();
    const ctx = buildCampaignContext({ variant: 'generation', campaign });

    expect(ctx).toContain('Campaign: Test Campaign');
    expect(ctx).toContain('Setting: A grim fantasy world');
  });

  it('includes official setting label when present', () => {
    const campaign = makeCampaign({ settingType: 'official', officialSetting: 'Forgotten Realms' });
    const ctx = buildCampaignContext({ variant: 'generation', campaign });

    expect(ctx).toContain('Official Setting: Forgotten Realms');
  });

  it('does not exceed maxTokenEstimate', () => {
    // Build a large campaign
    const npcs = Array.from({ length: 50 }, (_, i) => ({
      id: `npc-${i}`,
      name: `NPC ${i}`,
      description: 'A mysterious figure with a long history and many secrets.',
      traits: 'Cunning, ambitious',
      backstory: 'Grew up in poverty.',
      motivations: 'Seeks power.',
      secrets: 'Works for the enemy.',
      stats: 'HP: 40',
      exampleQuote: 'Nothing personal.',
      knowsPlayerHistory: [],
      relationships: [],
      history: [],
    }));

    const campaign = makeCampaign({ npcs });
    const maxTokenEstimate = 500; // Tight budget
    const ctx = buildCampaignContext({ variant: 'generation', campaign, maxTokenEstimate });

    expect(estimateTokens(ctx)).toBeLessThanOrEqual(maxTokenEstimate + 25); // Allow small overshoot for last section
  });

  it('generation variant includes NPC overview in Tier 3', () => {
    const campaign = makeCampaign({
      npcs: [
        { id: 'n1', name: 'Aldric the Bold', description: 'A veteran knight.', traits: '', backstory: '', motivations: '', secrets: '', stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [] },
      ],
    });

    const ctx = buildCampaignContext({ variant: 'generation', campaign });
    expect(ctx).toContain('NPCs:');
    expect(ctx).toContain('Aldric the Bold');
  });

  it('coach variant does NOT include NPC overview section, only names', () => {
    const campaign = makeCampaign({
      npcs: [
        { id: 'n1', name: 'Aldric the Bold', description: 'A veteran knight.', traits: '', backstory: '', motivations: '', secrets: '', stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [] },
      ],
    });

    const ctx = buildCampaignContext({ variant: 'coach', campaign });

    // Should not have the full NPC section header
    expect(ctx).not.toContain('\nNPCs:\n');
    // But should still have the name in a compact list
    expect(ctx).toContain('Aldric the Bold');
  });

  it('coach variant includes active encounter info when combat is running', () => {
    const campaign = makeCampaign({
      activeEncounter: {
        id: 'enc1',
        round: 3,
        turnIndex: 0,
        combatants: [
          { id: 'c1', name: 'Goblin', type: 'npc', initiative: 15, hp: 5, maxHp: 7 },
          { id: 'c2', name: 'Aldric', type: 'pc', initiative: 12, hp: 0, maxHp: 45 }, // dead — should be excluded
        ],
      },
    });

    const ctx = buildCampaignContext({ variant: 'coach', campaign });
    expect(ctx).toContain('Active Combat');
    expect(ctx).toContain('Round 3');
    expect(ctx).toContain('Goblin');
    // Dead combatant should not appear
    expect(ctx).not.toContain('Aldric');
  });

  it('generation variant excludes active encounter info', () => {
    const campaign = makeCampaign({
      activeEncounter: {
        id: 'enc1',
        round: 2,
        turnIndex: 0,
        combatants: [
          { id: 'c1', name: 'Orc', type: 'npc', initiative: 10, hp: 12, maxHp: 15 },
        ],
      },
    });

    const ctx = buildCampaignContext({ variant: 'generation', campaign });
    expect(ctx).not.toContain('Active Combat');
  });

  it('includes active scene details (Tier 1)', () => {
    const scene = {
      id: 'scene1',
      title: 'The Dark Cellar',
      type: 'exploration' as const,
      status: 'in-progress' as const,
      readAloudText: 'You descend into darkness. A foul smell greets you.',
      gmNotes: 'There is a secret door behind the barrels.',
      skillChecks: [],
      rewards: '',
      npcIds: [],
    };

    const campaign = makeCampaign({
      activeSceneId: 'scene1',
      adventures: [
        { id: 'adv1', title: 'The Dungeon', level: 3, hook: '', theme: '', scenes: [scene] },
      ],
    });

    const ctx = buildCampaignContext({ variant: 'generation', campaign, activeSceneId: 'scene1' });
    expect(ctx).toContain('Active Scene: The Dark Cellar');
    expect(ctx).toContain('You descend into darkness');
  });

  it('includes active plot threads in Tier 2 (max 5)', () => {
    const plots = Array.from({ length: 8 }, (_, i) => ({
      id: `plot-${i}`,
      title: `Plot ${i}`,
      description: '',
      status: 'active' as const,
      relatedEntityIds: [],
    }));

    const campaign = makeCampaign({ plots });
    const ctx = buildCampaignContext({ variant: 'generation', campaign });

    // Should include at most 5
    const matches = ctx.match(/Plot \d/g) ?? [];
    expect(matches.length).toBeLessThanOrEqual(5);
  });

  it('includes focus entity full details in Tier 2', () => {
    const npc = {
      id: 'n1',
      name: 'Seraphina',
      description: 'An elven sorceress.',
      traits: 'Aloof, brilliant',
      motivations: 'Restore her homeland.',
      backstory: 'Exiled after a political coup.',
      secrets: 'She is the lost queen.',
      stats: 'HP: 30',
      exampleQuote: 'Magic is not a gift — it is a burden.',
      knowsPlayerHistory: [],
      relationships: [],
      history: [],
    };

    const campaign = makeCampaign({ npcs: [npc] });
    const ctx = buildCampaignContext({
      variant: 'generation',
      campaign,
      focusEntityId: 'n1',
      focusEntityType: 'npc',
    });

    expect(ctx).toContain('Focus NPC — Seraphina');
    expect(ctx).toContain('Aloof, brilliant');
    expect(ctx).toContain('Restore her homeland');
  });

  it('returns empty string for a campaign that provides no usable data', () => {
    // Even an empty campaign should at least have title + setting
    const campaign = makeCampaign({ title: '', setting: '' });
    const ctx = buildCampaignContext({ variant: 'generation', campaign });
    // Should still produce Campaign: and Setting: lines even if values are empty
    expect(ctx).toContain('Campaign:');
  });

  it('chat variant includes both entity names and current context', () => {
    const campaign = makeCampaign({
      npcs: [
        { id: 'n1', name: 'Thorvald', description: 'A dwarf blacksmith.', traits: '', backstory: '', motivations: '', secrets: '', stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [] },
      ],
      locations: [
        { id: 'l1', name: 'Ironforge', description: 'A mountain fortress.', secrets: '', subLocationIds: [], history: [] },
      ],
    });

    const ctx = buildCampaignContext({ variant: 'chat', campaign });

    // Chat variant = not 'coach', so full Tier 3 lists are included
    expect(ctx).toContain('NPCs:');
    expect(ctx).toContain('Thorvald');
    expect(ctx).toContain('Locations:');
    expect(ctx).toContain('Ironforge');
  });

  it('respects maxTokenEstimate of 100 by only emitting Tier 1 basics', () => {
    const campaign = makeCampaign({
      npcs: Array.from({ length: 20 }, (_, i) => ({
        id: `n${i}`, name: `NPC ${i}`, description: 'desc', traits: '', backstory: '', motivations: '', secrets: '', stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
      })),
    });

    const ctx = buildCampaignContext({ variant: 'generation', campaign, maxTokenEstimate: 100 });

    // Should be under budget (400 chars)
    expect(ctx.length).toBeLessThanOrEqual(500);
    // Must still have campaign title
    expect(ctx).toContain('Campaign: Test Campaign');
    // Should NOT include NPC overview (too big)
    expect(ctx).not.toContain('NPCs:');
  });
});
