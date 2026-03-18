
import type { NPC, Location, Faction, Item, Article, Adventure, Scene, SessionLog, Plot, Campaign } from '../types/index';

/**
 * Builds a campaign context string for AI generation functions.
 * Keeps it concise (entity names only) to avoid token bloat while
 * giving the AI enough awareness to maintain consistency.
 */
export const buildCampaignContext = (campaign: Campaign): string => {
    const lines: string[] = [];
    lines.push(`Campaign: ${campaign.title}`);
    lines.push(`Setting: ${campaign.setting}`);
    if (campaign.settingType === 'official' && campaign.officialSetting) {
        lines.push(`Official Setting: ${campaign.officialSetting}`);
    }
    if (campaign.npcs.length > 0) {
        lines.push(`Existing NPCs: ${campaign.npcs.map(n => n.name).join(', ')}`);
    }
    if (campaign.locations.length > 0) {
        lines.push(`Existing Locations: ${campaign.locations.map(l => l.name).join(', ')}`);
    }
    if (campaign.factions.length > 0) {
        lines.push(`Existing Factions: ${campaign.factions.map(f => f.name).join(', ')}`);
    }
    if (campaign.items.length > 0) {
        lines.push(`Existing Items: ${campaign.items.map(i => i.name).join(', ')}`);
    }
    if (campaign.adventures.length > 0) {
        lines.push(`Existing Adventures: ${campaign.adventures.map(a => a.title).join(', ')}`);
    }
    if (campaign.articles.length > 0) {
        lines.push(`Lore Articles: ${campaign.articles.map(a => a.title).join(', ')}`);
    }
    if (campaign.plots && campaign.plots.length > 0) {
        lines.push(`Active Plots: ${campaign.plots.filter(p => p.status === 'active').map(p => p.title).join(', ')}`);
    }
    if (campaign.playerCharacters && campaign.playerCharacters.length > 0) {
        lines.push(`Player Characters: ${campaign.playerCharacters.map(pc => pc.characterSocial.characterName).join(', ')}`);
    }
    return lines.join('\n');
};

export const createDefaultNpc = (): NPC => ({
  id: '',
  name: 'New NPC',
  description: '',
  traits: '',
  backstory: '',
  motivations: '',
  secrets: '',
  stats: '',
  exampleQuote: '',
  knowsPlayerHistory: [],
  relationships: [],
  history: [],
});

export const createDefaultLocation = (): Location => ({
  id: '',
  name: 'New Location',
  description: '',
  secrets: '',
  subLocationIds: [],
  connections: [],
  pointsOfInterest: [],
  loot: [],
  history: [],
});

export const createDefaultFaction = (): Faction => ({
  id: '',
  name: 'New Faction',
  description: '',
  goals: '',
  alignment: '',
  resources: '',
  influence: '',
  memberIds: [],
});

export const createDefaultItem = (): Item => ({
  id: '',
  name: 'New Item',
  description: '',
  rarity: 'common',
  properties: '',
});

export const createDefaultArticle = (): Article => ({
  id: '',
  title: 'New Article',
  category: 'lore',
  content: '',
  subArticleIds: [],
});

export const createDefaultAdventure = (): Adventure => ({
  id: '',
  title: 'New Adventure',
  level: 1,
  hook: '',
  theme: '',
  scenes: [],
});

export const createDefaultScene = (): Scene => ({
    id: '',
    title: 'New Scene',
    type: 'social',
    status: 'planned',
    readAloudText: '',
    gmNotes: '',
    skillChecks: [],
    rewards: '',
    npcIds: [],
});

export const createDefaultSession = (): SessionLog => ({
    id: '',
    title: 'New Session',
    status: 'planned',
    sessionDate: new Date().toISOString(),
    adventureId: undefined,
    plannedSceneIds: [],
    prepNotes: '',
    runningNotes: '',
    structuredNotes: [],
    relatedPlotIds: [],
    encounterLog: [],
    recap: '',
    notableEvents: '',
    looseEnds: ''
});

export const createDefaultPlot = (): Plot => ({
    id: '',
    title: 'New Plot Arc',
    description: '',
    status: 'active',
    relatedEntityIds: []
});
