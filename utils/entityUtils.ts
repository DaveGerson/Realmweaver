
import type { NPC, Location, Faction, Item, Article, Adventure, Scene, SessionLog, Plot, Note, Secret, Campaign, PlayerCharacter } from '../types/index';
import { formatPlotClock } from './plotClock';

/**
 * Closed union of every key `ENTITY_TYPE_CONFIG` carries. The camelCase keys
 * are the canonical entity types; `'session-log'` / `'player-character'` are
 * kebab aliases (used by CommandPalette / QuickCard / sidebar pins) that map to
 * the same config as their camelCase twins. Typing the record against this
 * union makes a missing entry a compile error rather than a runtime
 * `Cannot read properties of undefined`.
 */
export type EntityTypeKey =
  | 'npc'
  | 'location'
  | 'faction'
  | 'item'
  | 'adventure'
  | 'article'
  | 'sessionLog'
  | 'session-log'
  | 'playerCharacter'
  | 'player-character'
  | 'plot'
  | 'note'
  | 'scene'
  | 'secret';

export interface EntityTypeConfigEntry {
  /** Key into `components/common/Icons.tsx` (not a lucide export name). */
  icon: string;
  /** Bare Tailwind color name — must be covered by index.css's safelist. */
  color: string;
  /** Plural display label. */
  label: string;
}

/**
 * Centralized entity type configuration.
 * Single source of truth for icons, accent colors, and labels used across
 * CrossCampaignDashboard, EntityQuickCard, CommandPalette, and CampaignSidebar.
 *
 * `color` is a Tailwind color name (without variant) — consumers derive the
 * specific shade they need (e.g. `text-${color}-400`, `bg-${color}-900/60`).
 * Every color used here must be covered by index.css's `@source inline(...)`
 * safelist, since runtime-composed class names are invisible to the build scan.
 */
export const ENTITY_TYPE_CONFIG: Record<EntityTypeKey, EntityTypeConfigEntry> = {
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
  secret:          { icon: 'Lock',            color: 'fuchsia', label: 'Secrets' },
};

/** Type guard: is `key` one of `ENTITY_TYPE_CONFIG`'s keys? */
export function isEntityTypeKey(key: string): key is EntityTypeKey {
  return Object.prototype.hasOwnProperty.call(ENTITY_TYPE_CONFIG, key);
}

/**
 * Looks up config for an open-ended type string (e.g. a linking-engine
 * candidate type). Returns `undefined` for unknown keys so callers fall back
 * explicitly instead of crashing on a missing entry.
 */
export function getEntityTypeConfig(key: string): EntityTypeConfigEntry | undefined {
  return isEntityTypeKey(key) ? ENTITY_TYPE_CONFIG[key] : undefined;
}

/**
 * Builds a concise entity context string for per-field AI regeneration.
 * Used as the `entityContext` prop on `RegenerateButton`.
 *
 * Each entity type includes its most relevant fields so the AI can
 * produce coherent output that fits the existing entity. Fields that
 * are empty/undefined are omitted to keep the context tight.
 *
 * Every editor's `RegenerateButton` goes through this function — do not
 * hand-roll an inline template in an editor (roadmap X11). `lookups` only
 * needs `factions` (used to resolve an NPC's faction name), so an editor
 * that holds a `factions` array but no full `Campaign` can pass `{ factions }`.
 */
export function buildEntityContext(
    entityType: string,
    entity: any,
    lookups?: Pick<Campaign, 'factions'>,
): string {
    switch (entityType) {
        case 'npc': {
            const e = entity as NPC;
            const faction = e.factionId && lookups?.factions
                ? lookups.factions.find(f => f.id === e.factionId)
                : undefined;
            return [
                `Name: ${e.name}`,
                e.description ? `Description: ${e.description}` : '',
                e.traits ? `Traits: ${e.traits}` : '',
                e.motivations ? `Motivations: ${e.motivations}` : '',
                e.backstory ? `Backstory: ${e.backstory}` : '',
                e.voiceNotes?.trim() ? `Voice: ${e.voiceNotes.trim()}` : '',
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
                e.influence ? `Influence: ${e.influence}` : '',
            ].filter(Boolean).join('\n');
        }
        case 'item': {
            const e = entity as Item;
            return [
                `Name: ${e.name}`,
                e.rarity ? `Rarity: ${e.rarity}` : '',
                e.itemType ? `Type: ${e.itemType}` : '',
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
                formatPlotClock(e.clock) ? `Clock: ${formatPlotClock(e.clock)}` : '',
                e.ifIgnored ? `If ignored: ${e.ifIgnored}` : '',
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
        case 'adventure': {
            const e = entity as Adventure;
            return [
                `Title: ${e.title}`,
                e.level !== undefined && e.level !== null ? `Level: ${e.level}` : '',
                e.theme ? `Theme: ${e.theme}` : '',
                e.hook ? `Hook: ${e.hook}` : '',
            ].filter(Boolean).join('\n');
        }
        case 'secret': {
            const e = entity as Secret;
            return [
                `Title: ${e.title}`,
                `Category: ${e.category}`,
                `Revealed: ${e.isRevealed ? 'yes' : 'no'}`,
                e.content ? `Content: ${e.content.substring(0, 300)}` : '',
            ].filter(Boolean).join('\n');
        }
        default:
            if (entity?.name) return `Name: ${entity.name}`;
            return entity?.title ? `Title: ${entity.title}` : '';
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
 * Default Note. Timestamps are stamped at call time; `campaignService.createNote`
 * still re-stamps `createdAt` / `lastModified` when it persists, so these are
 * placeholders for pre-save UI (e.g. a quick-add form).
 */
export const createDefaultNote = (): Note => {
    const now = new Date().toISOString();
    return {
        id: '',
        title: 'New Note',
        content: '',
        tags: [],
        createdAt: now,
        lastModified: now,
    };
};

/**
 * Default Secret. `campaignService.createSecret` owns the persisted
 * `createdAt` stamp; the value here is a pre-save placeholder.
 */
export const createDefaultSecret = (): Secret => ({
    id: '',
    title: 'New Secret',
    content: '',
    category: 'secret',
    isRevealed: false,
    linkedEntityIds: [],
    createdAt: new Date().toISOString(),
    notes: '',
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
    const normalized: PlayerCharacter = {
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
    // `playerFlags` (Table Pulse) is optional, but when present it must be a
    // string array — a hand-edited save can carry a bare string, and every
    // reader `.map`s / `.join`s it. Anything else is dropped, not coerced.
    if ('playerFlags' in pc) {
        const raw: unknown = pc.playerFlags;
        if (!Array.isArray(raw)) {
            delete normalized.playerFlags;
        } else if (raw.some(f => typeof f !== 'string')) {
            normalized.playerFlags = raw.filter((f): f is string => typeof f === 'string');
        }
    }
    return normalized;
}
