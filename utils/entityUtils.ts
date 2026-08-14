
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
  scene:           { icon: 'Scenes',          color: 'blue',    label: 'Scenes' },
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

/**
 * Fully-populated default PlayerCharacter, used to normalize AI-parsed
 * character sheets (which may omit fields the model deemed empty) before
 * they enter the store. Deep-merge parsed data onto this so every field
 * `CharacterStatistics`/`CharacterSocial` declare as required is always
 * present, e.g.:
 *   { ...createDefaultPlayerCharacter(), ...parsed,
 *     characterSocial: { ...createDefaultPlayerCharacter().characterSocial, ...parsed.characterSocial },
 *     characterStatistics: {
 *       ...createDefaultPlayerCharacter().characterStatistics, ...parsed.characterStatistics,
 *       classes: { ...defaultClasses, ...parsed.characterStatistics?.classes },
 *       attributes: { ...defaultAttributes, ...parsed.characterStatistics?.attributes },
 *       skills: { ...defaultSkills, ...parsed.characterStatistics?.skills },
 *     } }
 * A shallow spread of `characterStatistics` alone is NOT enough — it would
 * wipe the default `actions`/`specialActions` whenever the parse includes
 * a partial `characterStatistics` object.
 */
export const createDefaultPlayerCharacter = (): Omit<PlayerCharacter, 'id'> => ({
    playerName: '',
    characterSocial: {
        characterName: '',
        background: '',
        species: '',
        personality: '',
        appearance: '',
        backstory: '',
        ideals: '',
        bonds: '',
        flaws: '',
    },
    characterStatistics: {
        classes: { charClass: '', level: 1 },
        attributes: {
            strength: 0,
            dexterity: 0,
            constitution: 0,
            intelligence: 0,
            wisdom: 0,
            charisma: 0,
        },
        skills: {
            acrobatics: 'none',
            animal_handling: 'none',
            arcana: 'none',
            athletics: 'none',
            deception: 'none',
            history: 'none',
            insight: 'none',
            intimidation: 'none',
            investigation: 'none',
            medicine: 'none',
            nature: 'none',
            perception: 'none',
            performance: 'none',
            persuasion: 'none',
            religion: 'none',
            sleight_of_hand: 'none',
            stealth: 'none',
            survival: 'none',
        },
        actions: [],
        specialActions: [],
    },
});

/**
 * Deep-merges a possibly-incomplete PlayerCharacter (AI-parsed sheet data, or
 * a PC persisted before defensive normalization existed) onto
 * createDefaultPlayerCharacter() so every field `CharacterStatistics` /
 * `CharacterSocial` declare as required is always present. A shallow spread
 * alone is NOT enough — see createDefaultPlayerCharacter's docstring for why.
 * `id` and any parsed values are preserved verbatim; only missing fields are
 * backfilled.
 */
export function normalizePlayerCharacter(pc: PlayerCharacter): PlayerCharacter {
    const defaults = createDefaultPlayerCharacter();
    return {
        ...defaults,
        ...pc,
        id: pc.id,
        characterSocial: { ...defaults.characterSocial, ...pc.characterSocial },
        characterStatistics: {
            ...defaults.characterStatistics,
            ...pc.characterStatistics,
            classes: { ...defaults.characterStatistics.classes, ...pc.characterStatistics?.classes },
            attributes: { ...defaults.characterStatistics.attributes, ...pc.characterStatistics?.attributes },
            skills: { ...defaults.characterStatistics.skills, ...pc.characterStatistics?.skills },
            actions: pc.characterStatistics?.actions ?? defaults.characterStatistics.actions,
            specialActions: pc.characterStatistics?.specialActions ?? defaults.characterStatistics.specialActions,
        },
    };
}
