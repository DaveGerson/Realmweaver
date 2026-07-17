// Template index — metadata only, does not import full JSON until template is selected.
// Full template data is loaded via dynamic import when "Use This Template" is clicked.

import {
  getAvailableTestCampaigns,
  loadTestCampaignData,
  type TestCampaignMeta,
} from '../testCampaigns';

export interface TemplateEntityCounts {
  npcs: number;
  locations: number;
  factions: number;
  adventures: number;
  scenes: number;
  plots: number;
}

export interface TemplateMeta {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  theme: string;
  playstyle: string;
  entityCounts: TemplateEntityCounts;
  fileName: string;
}

export type { TestCampaignMeta };

export const TEMPLATE_META: TemplateMeta[] = [
  {
    id: 'dungeon-crawl',
    title: 'The Sunken Vault',
    subtitle: 'Classic Dungeon Crawl',
    description:
      'Delve into imperial ruins for glory and treasure. A frontier village, a mysterious vault, and a lich who has been waiting six centuries for someone interesting to arrive.',
    theme: 'Dungeon Delve, Mystery, Boss Confrontation',
    playstyle: 'Combat & Exploration',
    entityCounts: {
      npcs: 3,
      locations: 3,
      factions: 0,
      adventures: 1,
      scenes: 4,
      plots: 0,
    },
    fileName: 'dungeon-crawl.json',
  },
  {
    id: 'political-intrigue',
    title: 'The Crown Conspiracy',
    subtitle: 'Political Intrigue',
    description:
      'A king is dead and his court is full of suspects. Navigate noble factions, a royal spymaster, and a merchant conspiracy before the succession vote installs the wrong ruler.',
    theme: 'Investigation, Moral Ambiguity, Faction Politics',
    playstyle: 'Social & Investigation',
    entityCounts: {
      npcs: 5,
      locations: 3,
      factions: 2,
      adventures: 1,
      scenes: 3,
      plots: 0,
    },
    fileName: 'political-intrigue.json',
  },
  {
    id: 'sandbox-exploration',
    title: 'The Untamed Wilds',
    subtitle: 'Sandbox Exploration',
    description:
      'An uncharted wilderness littered with ruins of a vanished civilisation. Two active plots, five locations to discover, and no pre-built adventure — the DM shapes the story.',
    theme: 'Open World, Ancient Mystery, Slow Burn',
    playstyle: 'Sandbox — DM-driven',
    entityCounts: {
      npcs: 4,
      locations: 5,
      factions: 0,
      adventures: 0,
      scenes: 0,
      plots: 2,
    },
    fileName: 'sandbox-exploration.json',
  },
  {
    id: 'one-shot',
    title: 'The Festival of Shadows',
    subtitle: 'One-Shot Adventure',
    description:
      'A harvest festival turns sinister when an ancient binding breaks and a three-hundred-year-old spirit demands acknowledgment. Designed to run in a single session.',
    theme: 'Folk Horror, Moral Complexity, Tight Pacing',
    playstyle: 'One-Shot (3-4 hours)',
    entityCounts: {
      npcs: 3,
      locations: 2,
      factions: 0,
      adventures: 1,
      scenes: 5,
      plots: 0,
    },
    fileName: 'one-shot.json',
  },
];

/**
 * Returns all available templates — built-in plus any local test campaigns on disk.
 * Test campaigns are appended at the front so they appear first in the selector.
 */
export function getAllTemplateMeta(): TemplateMeta[] {
  const testCampaigns = getAvailableTestCampaigns();
  return [...testCampaigns, ...TEMPLATE_META];
}

/**
 * Dynamically loads the full template JSON for a given template id.
 * Checks both built-in templates and local test campaigns.
 * Returns null if the template id is not found.
 */
export async function loadTemplateData(templateId: string): Promise<Record<string, unknown> | null> {
  // Try built-in templates first
  switch (templateId) {
    case 'dungeon-crawl':
      return (await import('./dungeon-crawl.json')).default as Record<string, unknown>;
    case 'political-intrigue':
      return (await import('./political-intrigue.json')).default as Record<string, unknown>;
    case 'sandbox-exploration':
      return (await import('./sandbox-exploration.json')).default as Record<string, unknown>;
    case 'one-shot':
      return (await import('./one-shot.json')).default as Record<string, unknown>;
  }

  // Fall through to test campaigns
  return loadTestCampaignData(templateId);
}
