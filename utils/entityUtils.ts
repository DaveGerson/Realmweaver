
import type { NPC, Location, Faction, Item, Article, Adventure, Scene, SessionLog, Plot, Note, Campaign, PlayerCharacter } from '../types/index';

/**
 * Centralized entity type configuration.
 * Single source of truth for icons, accent colors, and labels used across
 * CrossCampaignDashboard, EntityQuickCard, CommandPalette, and CampaignSidebar.
 *
 * `color` is a Tailwind color name (without variant) — consumers derive the
 * specific shade they need (e.g. `text-${color}-400`, `bg-${color}-900/60`).
 */
export const ENTITY_TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  npc:             { icon: 'NPCs',            color: 'amber',   label: 'NPCs' },
  location:        { icon: 'Locations',       color: 'emerald', label: 'Locations' },
  faction:         { icon: 'Factions',        color: 'violet',  label: 'Factions' },
  item:            { icon: 'Items',           color: 'sky',     label: 'Items' },
  adventure:       { icon: 'Adventures',      color: 'orange',  label: 'Adventures' },
  article:         { icon: 'BookCopy',        color: 'cyan',    label: 'Articles' },
  sessionLog:      { icon: 'SessionLog',      color: 'rose',    label: 'Session Logs' },
  'session-log':   { icon: 'SessionLog',      color: 'rose',    label: 'Session Logs' },
  playerCharacter: { icon: 'PlayerCharacters', color: 'teal',   label: 'Player Characters' },
  'player-character': { icon: 'PlayerCharacters', color: 'teal', label: 'Player Characters' },
  plot:            { icon: 'Plot',            color: 'yellow',  label: 'Plots' },
  note:            { icon: 'FileText',        color: 'slate',   label: 'Notes' },
};

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

/**
 * Builds a concise entity context string for per-field AI regeneration.
 * Used as the `entityContext` prop on `RegenerateButton`.
 *
 * Each entity type includes its most relevant fields so the AI can
 * produce coherent output that fits the existing entity. Fields that
 * are empty/undefined are omitted to keep the context tight.
 */
export function buildEntityContext(entityType: string, entity: any, campaign?: Campaign): string {
    switch (entityType) {
        case 'npc': {
            const e = entity as NPC;
            const faction = e.factionId && campaign
                ? campaign.factions.find(f => f.id === e.factionId)
                : undefined;
            return [
                `Name: ${e.name}`,
                e.description ? `Description: ${e.description}` : '',
                e.traits ? `Traits: ${e.traits}` : '',
                e.motivations ? `Motivations: ${e.motivations}` : '',
                e.backstory ? `Backstory: ${e.backstory}` : '',
                faction ? `Faction: ${faction.name}` : '',
            ].filter(Boolean).join('\n');
        }
        case 'location': {
            const e = entity as Location;
            return [
                `Name: ${e.name}`,
                e.description ? `Description: ${e.description}` : '',
                e.secrets ? `Secrets: ${e.secrets}` : '',
            ].filter(Boolean).join('\n');
        }
        case 'faction': {
            const e = entity as Faction;
            return [
                `Name: ${e.name}`,
                e.description ? `Description: ${e.description}` : '',
                e.goals ? `Goals: ${e.goals}` : '',
                e.alignment ? `Alignment: ${e.alignment}` : '',
                e.resources ? `Resources: ${e.resources}` : '',
            ].filter(Boolean).join('\n');
        }
        case 'item': {
            const e = entity as Item;
            return [
                `Name: ${e.name}`,
                e.rarity ? `Rarity: ${e.rarity}` : '',
                e.description ? `Description: ${e.description}` : '',
                e.properties ? `Properties: ${e.properties}` : '',
            ].filter(Boolean).join('\n');
        }
        case 'scene': {
            const e = entity as Scene;
            return [
                `Title: ${e.title}`,
                `Type: ${e.type}`,
                e.readAloudText ? `Read-Aloud: ${e.readAloudText}` : '',
                e.gmNotes ? `GM Notes: ${e.gmNotes}` : '',
                e.rewards ? `Rewards: ${e.rewards}` : '',
            ].filter(Boolean).join('\n');
        }
        case 'article': {
            const e = entity as Article;
            return [
                `Title: ${e.title}`,
                `Category: ${e.category}`,
                e.content ? `Content summary: ${e.content.substring(0, 300)}` : '',
            ].filter(Boolean).join('\n');
        }
        case 'plot': {
            const e = entity as Plot;
            return [
                `Title: ${e.title}`,
                `Status: ${e.status}`,
                e.description ? `Description: ${e.description}` : '',
            ].filter(Boolean).join('\n');
        }
        case 'note': {
            const e = entity as Note;
            return [
                `Title: ${e.title}`,
                e.tags && e.tags.length > 0 ? `Tags: ${e.tags.join(', ')}` : '',
                e.content ? `Content: ${e.content.substring(0, 300)}` : '',
            ].filter(Boolean).join('\n');
        }
        default:
            return entity.name ? `Name: ${entity.name}` : '';
    }
}

/**
 * Estimates PC hit points from character statistics.
 * Uses 10 + (CON modifier * level) as a rough D&D 5e estimate.
 * Falls back to 20 if data is missing or unparseable.
 */
export const estimatePcHp = (pc: PlayerCharacter): number => {
    try {
        const con = pc.characterStatistics?.attributes?.constitution;
        const level = pc.characterStatistics?.classes?.level;
        if (typeof con !== 'number' || typeof level !== 'number') return 20;
        const conMod = Math.floor((con - 10) / 2);
        // Base 10 HP + CON modifier per level (simplified average)
        return Math.max(1, 10 + conMod * level);
    } catch {
        return 20;
    }
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
