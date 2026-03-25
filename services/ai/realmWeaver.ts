
import type { NPC, Location, Faction, Item, Scene, SkillCheck, AdventureForBatchAdd, Article, PointOfInterest } from '../../types/index';
import { generateWithSchema } from './core';

// --- Schemas for consistent JSON output ---
export const npcSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: "The NPC's full name, title, or alias." },
    description: { type: 'string', description: "A detailed physical description of the NPC, including their typical attire." },
    traits: { type: 'string', description: "A list of 2-3 distinct, actionable personality traits or physical mannerisms. These should be things a game master can physically act out or say. e.g., 'Constantly fiddles with a strange coin; avoids eye contact when lying; speaks with a pronounced lisp.'" },
    exampleQuote: { type: 'string', description: "A single, characteristic line of dialogue that captures the NPC's personality." },
    backstory: { type: 'string', description: "A concise but compelling backstory for the NPC." },
    motivations: { type: 'string', description: "The NPC's primary goals, desires, and motivations." },
    secrets: { type: 'string', description: "A key secret the NPC is hiding or something important they know." },
    stats: { type: 'string', description: "A brief summary of their combat or social capabilities, suitable for a tabletop RPG. e.g., 'Skilled archer, but clumsy in conversation' or 'Veteran warrior (use Knight stat block)'." },
  },
  required: ['name', 'description', 'traits', 'exampleQuote', 'backstory', 'motivations', 'secrets', 'stats'],
};

export const locationSchema = {
    type: 'object',
    properties: {
        name: { type: 'string', description: "The name of the location." },
        description: { type: 'string', description: "A vivid description of the location, including sights, sounds, and smells." },
        secrets: { type: 'string', description: "Hidden details, history, or secrets about this location. e.g., 'A loose brick on the north wall reveals a hidden compartment.'" },
    },
    required: ['name', 'description', 'secrets'],
};

export const factionSchema = {
    type: 'object',
    properties: {
        name: { type: 'string', description: "The name of the faction or organization." },
        description: { type: 'string', description: "A summary of the faction's purpose, public image, and typical members." },
        goals: { type: 'string', description: "The faction's primary short-term and long-term objectives." },
        alignment: { type: 'string', description: "The general moral and ethical alignment of the faction (e.g., Lawful Neutral, Chaotic Good)." },
        resources: { type: 'string', description: "The assets, wealth, and tools at the faction's disposal (e.g., 'Vast gold reserves', 'Network of safehouses', 'Magical artifacts')." },
        influence: { type: 'string', description: "Where the faction holds power and how they exert it (e.g., 'Controls the city watch', 'Respected by the common folk', 'Feared in the underworld')." },
    },
    required: ['name', 'description', 'goals', 'alignment', 'resources', 'influence'],
};

export const itemSchema = {
    type: 'object',
    properties: {
        name: { type: 'string', description: "The name of the item." },
        description: { type: 'string', description: "A detailed description of the item's appearance and history." },
        rarity: { type: 'string', enum: ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact'], description: "The rarity of the item." },
        properties: { type: 'string', description: "The item's mechanical properties, abilities, and rules for use in a TTRPG." },
    },
    required: ['name', 'description', 'rarity', 'properties'],
};

export const skillCheckSchema = {
    type: 'object',
    properties: {
        skill: { type: 'string', description: "The skill being checked, e.g., 'Perception', 'Athletics', 'Deception'." },
        dc: { type: 'integer', description: "The Difficulty Class (DC) of the check." },
        description: { type: 'string', description: "A brief description of what the check is for." },
    },
    required: ['skill', 'dc', 'description'],
};

export const sceneSchema = {
    type: 'object',
    properties: {
        title: { type: 'string', description: "A short, descriptive title for the scene (e.g., 'Graveyard Ambush')." },
        type: { type: 'string', enum: ['combat', 'social', 'exploration', 'puzzle'], description: "The primary type of challenge or interaction in the scene." },
        readAloudText: { type: 'string', description: "Detailed, evocative 'box text' to be read aloud to the players to set the scene." },
        gmNotes: { type: 'string', description: "GM-only notes describing the scene's goals, character motivations, potential outcomes, and hidden details." },
        skillChecks: {
            type: 'array',
            description: "A list of 1-3 specific skill checks players might make in this scene.",
            items: skillCheckSchema,
        },
        rewards: { type: 'string', description: "A description of any treasure, items, gold, or experience points awarded in this scene." },
    },
    required: ['title', 'type', 'readAloudText', 'gmNotes', 'skillChecks', 'rewards'],
};

export const adventureWithScenesSchema = {
    type: 'object',
    properties: {
        title: { type: 'string', description: "A compelling title for the potential adventure." },
        level: { type: 'integer', description: "The suggested starting character level for this adventure." },
        hook: { type: 'string', description: "A one or two-sentence plot hook to draw players in." },
        theme: { type: 'string', description: "A few keywords for the adventure's theme (e.g., 'mystery, horror')." },
        scenes: {
            type: 'array',
            description: "A list of 2-3 brief scenes that form the core of the adventure.",
            items: sceneSchema,
        }
    },
    required: ['title', 'level', 'hook', 'theme', 'scenes']
};

export const articleSchema = {
    type: 'object',
    properties: {
        title: { type: 'string', description: "A compelling title for the lore, history, or cosmology article." },
        category: { type: 'string', enum: ['lore', 'history', 'cosmology'], description: "The category of the article." },
        content: { type: 'string', description: "The detailed content of the article, written in an engaging, encyclopedic style suitable for a TTRPG world guide." },
    },
    required: ['title', 'category', 'content'],
};

export const poiInteractionSchema = {
    type: 'object',
    properties: {
        description: { type: 'string', description: "The condition, trigger, or skill check (e.g., 'DC 15 Arcana check')." },
        outcome: { type: 'string', description: "The result or information revealed if the condition is met." },
    },
    required: ['description', 'outcome'],
};

export const pointOfInterestSchema = {
    type: 'object',
    properties: {
        name: { type: 'string', description: "A short, descriptive name for the point of interest based on the loot." },
        passivePerceptionDC: { type: 'integer', description: "The passive perception DC required to notice this. Default to 10 if not obvious, 15+ if hidden." },
        description: { type: 'string', description: "A 'read-aloud' description for players who notice it, describing how the loot is found." },
        investigationChecks: {
            type: 'array',
            description: "A list of checks or conditions for discovering more details about the loot. Can be empty if it's just a simple item.",
            items: poiInteractionSchema,
        },
        interactions: {
            type: 'array',
            description: "A list of possible player actions and their outcomes (e.g., pulling a lever). Can be empty.",
            items: poiInteractionSchema,
        }
    },
    required: ['name', 'passivePerceptionDC', 'description', 'investigationChecks', 'interactions'],
};

// --- Entity Generation Config ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface EntityGenerationConfig {
  entityType: string;
  entityLabel: string;
  personaVariant: string;
  schema: object;
  fieldInstructions: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  postProcess?: (data: any) => any;
  /**
   * When true, the system instruction preamble uses a custom format rather
   * than the standard "The Prep Architect" persona line. The personaVariant
   * field is used verbatim as the full preamble in that case.
   */
  customPreamble?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addSkillCheckIds(skillChecks: Omit<SkillCheck, 'id'>[]): any[] {
  return skillChecks.map(sc => ({ ...sc, id: crypto.randomUUID() }));
}

const npcConfig: EntityGenerationConfig = {
  entityType: 'npc',
  entityLabel: 'NPC dossier',
  personaVariant: 'assistant',
  schema: npcSchema,
  fieldInstructions: `- **name:** The NPC's full name, title, or alias.
- **description:** A brief but evocative physical description. Focus on details that are immediately noticeable.
- **traits:** Actionable roleplaying notes. How does the GM portray them? What are their mannerisms or speech patterns?
- **exampleQuote:** A single line of dialogue that perfectly captures their personality.
- **backstory:** A concise summary of their history and their role in the story.
- **motivations:** What does this character want, and what are they actively doing to achieve it?
- **secrets:** A crucial piece of hidden information, a plot twist, or a vulnerability. This is for the GM's eyes only.
- **stats:** A TTRPG-agnostic suggestion for their capabilities (e.g., "Use 'Guard' stats, but add a poison dagger attack.").`,
  postProcess: (data) => ({ ...data, knowsPlayerHistory: [], relationships: [], history: [] }),
};

const locationConfig: EntityGenerationConfig = {
  entityType: 'location',
  entityLabel: 'location',
  personaVariant: 'assistant',
  schema: locationSchema,
  fieldInstructions: `- **name:** The name of the location.
- **description:** A "read-aloud" description focusing on sensory details (sight, sound, smell) to set the scene for players. Keep it evocative but concise.
- **secrets:** Hidden details, lore, or clues that players can discover through investigation. Frame these as "investigation" opportunities (e.g., "A DC 15 Investigation check on the bookshelf reveals a false book that acts as a lever.").`,
};

const factionConfig: EntityGenerationConfig = {
  entityType: 'faction',
  entityLabel: 'faction',
  personaVariant: 'assistant',
  schema: factionSchema,
  fieldInstructions: `- **name:** The name of the faction or organization.
- **description:** A summary of the faction's purpose, public image, and a typical members.
- **goals:** The faction's primary objectives. Make these actionable and clear, providing potential plot hooks for the GM.
- **alignment:** The general moral alignment (e.g. Neutral Good, Lawful Evil).
- **resources:** What resources they command (wealth, magic, information, soldiers).
- **influence:** Where and how they exert power.`,
};

const itemConfig: EntityGenerationConfig = {
  entityType: 'item',
  entityLabel: 'magic item',
  personaVariant: 'assistant',
  schema: itemSchema,
  fieldInstructions: `- **name:** The name of the item.
- **description:** An evocative description of the item's appearance and history, suitable for reading to players.
- **rarity:** The item's rarity level.
- **properties:** Mechanically precise details of the item's abilities, attunement requirements, and usage rules. Ensure clarity for game mechanics.`,
};

const sceneConfig: EntityGenerationConfig = {
  entityType: 'scene',
  entityLabel: 'scene',
  personaVariant: 'assistant',
  schema: sceneSchema,
  fieldInstructions: `- **title:** A clear, descriptive title for the scene.
- **type:** The primary type of encounter.
- **readAloudText:** High-quality, evocative text to be read aloud to players to set the scene.
- **gmNotes:** A comprehensive overview for the GM. This MUST include the scene's primary goal, setup details, potential complications, and information on any monsters or antagonists present (including their tactics).
- **skillChecks:** Explicitly defined skill checks with a skill, a DC, and a clear description of what success and failure mean.
- **rewards:** Any treasure, items, information, or other rewards players might gain.`,
  postProcess: (data) => {
    if (data.skillChecks && Array.isArray(data.skillChecks)) {
      data.skillChecks = addSkillCheckIds(data.skillChecks);
    }
    return data;
  },
};

const adventureConfig: EntityGenerationConfig = {
  entityType: 'adventure',
  entityLabel: 'complete adventure outline with 2-3 fully detailed scenes',
  personaVariant: 'adventure designer',
  schema: adventureWithScenesSchema,
  fieldInstructions: `- **title:** A compelling title for the adventure.
- **level:** The suggested character level.
- **hook:** A "read-aloud" plot hook to engage the players immediately.
- **theme:** Keywords describing the adventure's mood and genre.
- **scenes:** Generate 2-3 interconnected scenes. Each scene must be fully fleshed out as per the scene generation guidelines: include high-quality read-aloud text, comprehensive GM notes (goals, setup, antagonists), clear skill checks, and defined rewards.`,
  postProcess: (data) => {
    if (data.scenes && Array.isArray(data.scenes)) {
      data.scenes.forEach((scene: { skillChecks: Omit<SkillCheck, 'id'>[] }) => {
        if (scene.skillChecks && Array.isArray(scene.skillChecks)) {
          scene.skillChecks = addSkillCheckIds(scene.skillChecks);
        } else {
          scene.skillChecks = [];
        }
      });
    } else {
      data.scenes = [];
    }
    return data;
  },
};

const articleConfig: EntityGenerationConfig = {
  entityType: 'article',
  entityLabel: 'lore article',
  personaVariant: 'loremaster',
  schema: articleSchema,
  fieldInstructions: `- **title:** A clear title for the lore entry.
- **category:** The appropriate category for the article.
- **content:** Write the article in an engaging, encyclopedic style. This is background information for the GM to understand the world's history, key events, or cosmology. Structure it for clarity and easy reference during a game.`,
};

const poiConfig: EntityGenerationConfig = {
  entityType: 'pointOfInterest',
  entityLabel: 'Point of Interest',
  // For POI the persona line is different — customPreamble carries the full
  // opening sentence so generateEntity skips the standard Prep Architect line.
  personaVariant: 'a TTRPG designer creating an interactive element. Based on the following loot description, create a Point of Interest object describing how players discover it.',
  customPreamble: true,
  schema: pointOfInterestSchema,
  fieldInstructions: `- **name:** Create a compelling name for the Point of Interest, inspired by the loot (e.g., "The Sunken Chest", "The Skeleton's Grasp").
- **passivePerceptionDC:** Set a DC to notice the item. 10 for easily visible, 13-15 for partially obscured, 16+ for well-hidden.
- **description:** Write a read-aloud description of the scene where the loot is found.
- **investigationChecks:** If there are details to learn by examining the loot (e.g., a maker's mark, a hidden compartment), create one or two checks. If the item is straightforward, return an empty array.
- **interactions:** Only add interactions if the item itself implies an action (e.g., it has a button or lever). Otherwise, return an empty array.`,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  postProcess: (data: any) => {
    if (data.investigationChecks && Array.isArray(data.investigationChecks)) {
      data.investigationChecks = data.investigationChecks.map((sc: Omit<SkillCheck, 'id'>) => ({
        ...sc,
        id: crypto.randomUUID(),
      }));
    }
    if (data.interactions && Array.isArray(data.interactions)) {
      data.interactions = data.interactions.map((sc: Omit<SkillCheck, 'id'>) => ({
        ...sc,
        id: crypto.randomUUID(),
      }));
    }
    return data;
  },
};

// --- Unified generator ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateEntity(config: EntityGenerationConfig, prompt: string, campaignContext?: string): Promise<any> {
  const instructions = config.customPreamble
    ? `You are ${config.personaVariant}\n\n${config.fieldInstructions}`
    : `You are The Prep Architect, an expert TTRPG ${config.personaVariant}. Your task is to generate a detailed, ready-to-run ${config.entityLabel} based on the user's prompt, conforming to the specified JSON schema.\n\n${config.fieldInstructions}`;
  const data = await generateWithSchema(prompt, config.schema, instructions, {}, 'standard', campaignContext);
  return config.postProcess ? config.postProcess(data) : data;
}

// --- Generator Functions (public API — signatures unchanged) ---

export const generateNpc = async (prompt: string, campaignContext?: string): Promise<Omit<NPC, 'id' | 'factionId'>> =>
  generateEntity(npcConfig, prompt, campaignContext);

export const generateLocation = async (prompt: string, campaignContext?: string): Promise<Omit<Location, 'id' | 'parentLocationId' | 'subLocationIds'>> =>
  generateEntity(locationConfig, prompt, campaignContext);

export const generateFaction = async (prompt: string, campaignContext?: string): Promise<Omit<Faction, 'id' | 'leaderId' | 'memberIds'>> =>
  generateEntity(factionConfig, prompt, campaignContext);

export const generateItem = async (prompt: string, campaignContext?: string): Promise<Omit<Item, 'id'>> =>
  generateEntity(itemConfig, prompt, campaignContext);

export const generateScene = async (prompt: string, campaignContext?: string): Promise<Omit<Scene, 'id' | 'locationId' | 'npcIds'>> =>
  generateEntity(sceneConfig, prompt, campaignContext);

export const generateAdventure = async (prompt: string, campaignContext?: string): Promise<AdventureForBatchAdd> =>
  generateEntity(adventureConfig, prompt, campaignContext) as Promise<AdventureForBatchAdd>;

export const generateArticle = async (prompt: string, campaignContext?: string): Promise<Omit<Article, 'id' | 'parentArticleId' | 'subArticleIds'>> =>
  generateEntity(articleConfig, prompt, campaignContext);

export const generatePoiFromLoot = async (prompt: string, campaignContext?: string): Promise<Omit<PointOfInterest, 'id'>> =>
  generateEntity(poiConfig, prompt, campaignContext);
