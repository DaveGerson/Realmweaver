// Local-only test campaigns.
//
// The data/test-campaigns/ directory is gitignored (see .gitignore: "Test
// campaigns — may contain licensed/non-shareable content") so its contents
// never ship in the repository or CI; this loader module lives outside it so
// the codebase still type-checks and builds from a fresh clone. Developers
// may drop full campaign export JSON files into data/test-campaigns/ (the
// same shape produced by "Export Campaign") to have them show up as
// selectable templates in the Campaign Creator during local development.
// In the default/shipped state the directory is absent/empty, so every
// export below is a safe no-op.

export interface TestCampaignEntityCounts {
  npcs: number;
  locations: number;
  factions: number;
  adventures: number;
  scenes: number;
  plots: number;
}

export interface TestCampaignMeta {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  theme: string;
  playstyle: string;
  entityCounts: TestCampaignEntityCounts;
  fileName: string;
  isTestCampaign: true;
}

// Eagerly glob any local campaign JSON files dropped into this folder.
// `import.meta.glob` resolves to `{}` when nothing matches, so this stays a
// no-op in the default (empty) checkout — no file-not-found errors.
const localCampaignModules = import.meta.glob<Record<string, unknown>>('./test-campaigns/*.json', {
  eager: true,
  import: 'default',
});

function countArray(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function toMeta(fileName: string, data: Record<string, unknown>): TestCampaignMeta {
  const id = fileName.replace(/\.json$/, '');
  const title = typeof data.title === 'string' ? data.title : id;
  const setting = typeof data.setting === 'string' ? data.setting : '';
  return {
    id,
    title,
    subtitle: 'Local Test Campaign',
    description: setting.length > 0
      ? setting.slice(0, 160)
      : 'A local test campaign loaded from your machine.',
    theme: 'Local',
    playstyle: 'Local Test',
    entityCounts: {
      npcs: countArray(data.npcs),
      locations: countArray(data.locations),
      factions: countArray(data.factions),
      adventures: countArray(data.adventures),
      scenes: countArray(data.scenes),
      plots: countArray(data.plots),
    },
    fileName,
    isTestCampaign: true,
  };
}

const metaByFileName = new Map<string, TestCampaignMeta>();
const dataByFileName = new Map<string, Record<string, unknown>>();

for (const [path, data] of Object.entries(localCampaignModules)) {
  const fileName = path.replace(/^\.\/test-campaigns\//, '');
  metaByFileName.set(fileName, toMeta(fileName, data));
  dataByFileName.set(fileName, data);
}

/**
 * Returns metadata for all local test campaigns found in data/test-campaigns/.
 * Returns an empty array when none are present (the default, shipped state).
 */
export function getAvailableTestCampaigns(): TestCampaignMeta[] {
  return Array.from(metaByFileName.values());
}

/**
 * Loads the full campaign data for a local test campaign by its id (the
 * template id assigned in getAvailableTestCampaigns — the filename minus
 * its extension). Returns null if no matching local test campaign is found.
 */
export function loadTestCampaignData(templateId: string): Record<string, unknown> | null {
  const fileName = `${templateId}.json`;
  return dataByFileName.get(fileName) ?? null;
}
