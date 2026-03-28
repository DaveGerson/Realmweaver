/**
 * Test campaign loader stub.
 * Test campaigns are optional local JSON files used during development.
 */

export interface TestCampaignMeta {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  theme: string;
  playstyle: string;
  entityCounts: {
    npcs: number;
    locations: number;
    factions: number;
    adventures: number;
    scenes: number;
    plots: number;
  };
  fileName: string;
}

export function getAvailableTestCampaigns(): TestCampaignMeta[] {
  return [];
}

export async function loadTestCampaignData(
  _templateId: string,
): Promise<Record<string, unknown> | null> {
  return null;
}
