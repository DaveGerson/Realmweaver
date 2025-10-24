
import { Type } from "@google/genai";
import type { NPC, Location, Faction, Item, Scene, SkillCheck, AdventureForBatchAdd, Article, PointOfInterest } from '../../types/index';
import { generateWithSchema } from './core';

// --- Schemas for consistent JSON output ---
export const npcSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "The NPC's full name, title, or alias." },
    description: { type: Type.STRING, description: "A detailed physical description of the NPC, including their typical attire." },
    traits: { type: Type.STRING, description: "A list of 2-3 distinct, actionable personality traits or physical mannerisms. These should be things a game master can physically act out or say. e.g., 'Constantly fiddles with a strange coin; avoids eye contact when lying; speaks with a pronounced lisp.'" },
    exampleQuote: { type: Type.STRING, description: "A single, characteristic line of dialogue that captures the NPC's personality." },
    backstory: { type: Type.STRING, description: "A concise but compelling backstory for the NPC." },
    motivations: { type: Type.STRING, description: "The NPC's primary goals, desires, and motivations." },
    secrets: { type: Type.STRING, description: "A key secret the NPC is hiding or something important they know." },
    stats: { type: Type.STRING, description: "A brief summary of their combat or social capabilities, suitable for a tabletop RPG. e.g., 'Skilled archer, but clumsy in conversation' or 'Veteran warrior (use Knight stat block)'." },
  },
  required: ['name', 'description', 'traits', 'exampleQuote', 'backstory', 'motivations', 'secrets', 'stats'],
};

export const locationSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: "The name of the location." },
        description: { type: Type.STRING, description: "A vivid description of the location, including sights, sounds, and smells." },
        secrets: { type: Type.STRING, description: "Hidden details, history, or secrets about this location. e.g., 'A loose brick on the north wall reveals a hidden compartment.'" },
    },
    required: ['name', 'description', 'secrets'],
};

export const factionSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: "The name of the faction or organization." },
        description: { type: Type.STRING, description: "A summary of the faction's purpose, public image, and typical members." },
        goals: { type: Type.STRING, description: "The faction's primary short-term and long-term objectives." },
    },
    required: ['name', 'description', 'goals'],
};

export const itemSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: "The name of the item." },
        description: { type: Type.STRING, description: "A detailed description of the item's appearance and history." },
        rarity: { type: Type.STRING, enum: ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact'], description: "The rarity of the item." },
        properties: { type: Type.STRING, description: "The item's mechanical properties, abilities, and rules for use in a TTRPG." },
    },
    required: ['name', 'description', 'rarity', 'properties'],
};

export const skillCheckSchema = {
    type: Type.OBJECT,
    properties: {
        skill: { type: Type.STRING, description: "The skill being checked, e.g., 'Perception', 'Athletics', 'Deception'." },
        dc: { type: Type.INTEGER, description: "The Difficulty Class (DC) of the check." },
        description: { type: Type.STRING, description: "A brief description of what the check is for." },
    },
    required: ['skill', 'dc', 'description'],
};

export const sceneSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: "A short, descriptive title for the scene (e.g., 'Graveyard Ambush')." },
        type: { type: Type.STRING, enum: ['combat', 'social', 'exploration', 'puzzle'], description: "The primary type of challenge or interaction in the scene." },
        readAloudText: { type: Type.STRING, description: "Detailed, evocative 'box text' to be read aloud to the players to set the scene." },
        gmNotes: { type: Type.STRING, description: "GM-only notes describing the scene's goals, character motivations, potential outcomes, and hidden details." },
        skillChecks: {
            type: Type.ARRAY,
            description: "A list of 1-3 specific skill checks players might make in this scene.",
            items: skillCheckSchema,
        },
        rewards: { type: Type.STRING, description: "A description of any treasure, items, gold, or experience points awarded in this scene." },
    },
    required: ['title', 'type', 'readAloudText', 'gmNotes', 'skillChecks', 'rewards'],
};

export const adventureWithScenesSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: "A compelling title for the potential adventure." },
        level: { type: Type.INTEGER, description: "The suggested starting character level for this adventure." },
        hook: { type: Type.STRING, description: "A one or two-sentence plot hook to draw players in." },
        theme: { type: Type.STRING, description: "A few keywords for the adventure's theme (e.g., 'mystery, horror')." },
        scenes: {
            type: Type.ARRAY,
            description: "A list of 2-3 brief scenes that form the core of the adventure.",
            items: sceneSchema,
        }
    },
    required: ['title', 'level', 'hook', 'theme', 'scenes']
};

export const articleSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: "A compelling title for the lore, history, or cosmology article." },
        category: { type: Type.STRING, enum: ['lore', 'history', 'cosmology'], description: "The category of the article." },
        content: { type: Type.STRING, description: "The detailed content of the article, written in an engaging, encyclopedic style suitable for a TTRPG world guide." },
    },
    required: ['title', 'category', 'content'],
};

export const poiInteractionSchema = {
    type: Type.OBJECT,
    properties: {
        description: { type: Type.STRING, description: "The condition, trigger, or skill check (e.g., 'DC 15 Arcana check')." },
        outcome: { type: Type.STRING, description: "The result or information revealed if the condition is met." },
    },
    required: ['description', 'outcome'],
};

export const pointOfInterestSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: "A short, descriptive name for the point of interest based on the loot." },
        passivePerceptionDC: { type: Type.INTEGER, description: "The passive perception DC required to notice this. Default to 10 if not obvious, 15+ if hidden." },
        description: { type: Type.STRING, description: "A 'read-aloud' description for players who notice it, describing how the loot is found." },
        investigationChecks: {
            type: Type.ARRAY,
            description: "A list of checks or conditions for discovering more details about the loot. Can be empty if it's just a simple item.",
            items: poiInteractionSchema,
        },
        interactions: {
            type: Type.ARRAY,
            description: "A list of possible player actions and their outcomes (e.g., pulling a lever). Can be empty.",
            items: poiInteractionSchema,
        }
    },
    required: ['name', 'passivePerceptionDC', 'description', 'investigationChecks', 'interactions'],
};

// --- Generator Functions ---

export const generateNpc = async (prompt: string, useGroundedSearch: boolean = false, campaignContext?: string): Promise<Omit<NPC, 'id' | 'factionId'>> => {
  const instructions = `You are The Prep Architect, an expert TTRPG assistant. Your task is to generate a detailed, ready-to-run NPC dossier based on the user's prompt, conforming to the specified JSON schema.

- **name:** The NPC's full name, title, or alias.
- **description:** A brief but evocative physical description. Focus on details that are immediately noticeable.
- **traits:** Actionable roleplaying notes. How does the GM portray them? What are their mannerisms or speech patterns?
- **exampleQuote:** A single line of dialogue that perfectly captures their personality.
- **backstory:** A concise summary of their history and their role in the story.
- **motivations:** What does this character want, and what are they actively doing to achieve it?
- **secrets:** A crucial piece of hidden information, a plot twist, or a vulnerability. This is for the GM's eyes only.
- **stats:** A TTRPG-agnostic suggestion for their capabilities (e.g., "Use 'Guard' stats, but add a poison dagger attack.").`;
  const configOverrides = useGroundedSearch ? { tools: [{googleSearch: {}}] } : {};
  const generatedData = await generateWithSchema(prompt, npcSchema, instructions, configOverrides, 'gemini-2.5-flash', campaignContext);
  return { ...generatedData, knowsPlayerHistory: [] }; // The AI doesn't generate this field, so return an empty array.
};

export const generateLocation = async (prompt: string, campaignContext?: string): Promise<Omit<Location, 'id' | 'parentLocationId' | 'subLocationIds'>> => {
  const instructions = `You are The Prep Architect, an expert TTRPG assistant. Your task is to generate a detailed, ready-to-run location based on the user's prompt, conforming to the specified JSON schema.

- **name:** The name of the location.
- **description:** A "read-aloud" description focusing on sensory details (sight, sound, smell) to set the scene for players. Keep it evocative but concise.
- **secrets:** Hidden details, lore, or clues that players can discover through investigation. Frame these as "investigation" opportunities (e.g., "A DC 15 Investigation check on the bookshelf reveals a false book that acts as a lever.").`;
  return generateWithSchema(prompt, locationSchema, instructions, {}, 'gemini-2.5-flash', campaignContext);
};

export const generateFaction = async (prompt: string, campaignContext?: string): Promise<Omit<Faction, 'id' | 'leaderId' | 'memberIds'>> => {
  const instructions = `You are The Prep Architect, an expert TTRPG assistant. Your task is to generate a detailed faction based on the user's prompt, conforming to the specified JSON schema.

- **name:** The name of the faction or organization.
- **description:** A summary of the faction's purpose, public image, and a typical members.
- **goals:** The faction's primary objectives. Make these actionable and clear, providing potential plot hooks for the GM.`;
  return generateWithSchema(prompt, factionSchema, instructions, {}, 'gemini-2.5-flash', campaignContext);
};

export const generateItem = async (prompt: string, campaignContext?: string): Promise<Omit<Item, 'id'>> => {
  const instructions = `You are The Prep Architect, an expert TTRPG assistant. Your task is to generate a detailed magic item based on the user's prompt, conforming to the specified JSON schema.

- **name:** The name of the item.
- **description:** An evocative description of the item's appearance and history, suitable for reading to players.
- **rarity:** The item's rarity level.
- **properties:** Mechanically precise details of the item's abilities, attunement requirements, and usage rules. Ensure clarity for game mechanics.`;
  return generateWithSchema(prompt, itemSchema, instructions, {}, 'gemini-2.5-flash', campaignContext);
};

export const generateScene = async (prompt: string, campaignContext?: string): Promise<Omit<Scene, 'id' | 'locationId' | 'npcIds'>> => {
  const instructions = `You are The Prep Architect, an expert TTRPG assistant. Your task is to generate a complete, ready-to-run scene based on the user's prompt, conforming to the specified JSON schema.

- **title:** A clear, descriptive title for the scene.
- **type:** The primary type of encounter.
- **readAloudText:** High-quality, evocative text to be read aloud to players to set the scene.
- **gmNotes:** A comprehensive overview for the GM. This MUST include the scene's primary goal, setup details, potential complications, and information on any monsters or antagonists present (including their tactics).
- **skillChecks:** Explicitly defined skill checks with a skill, a DC, and a clear description of what success and failure mean.
- **rewards:** Any treasure, items, information, or other rewards players might gain.`;
  const generatedData = await generateWithSchema(prompt, sceneSchema, instructions, {}, 'gemini-2.5-flash', campaignContext);
  
  // Add client-side IDs to skill checks
  if (generatedData.skillChecks && Array.isArray(generatedData.skillChecks)) {
    generatedData.skillChecks = generatedData.skillChecks.map((sc: Omit<SkillCheck, 'id'>) => ({
      ...sc,
      id: crypto.randomUUID()
    }));
  }

  return generatedData;
};

export const generateAdventure = async (prompt: string, campaignContext?: string): Promise<AdventureForBatchAdd> => {
    const instructions = `You are The Prep Architect, an expert TTRPG adventure designer. Based on the user's prompt, generate a complete adventure outline with 2-3 fully detailed scenes, conforming to the specified JSON schema.

- **title:** A compelling title for the adventure.
- **level:** The suggested character level.
- **hook:** A "read-aloud" plot hook to engage the players immediately.
- **theme:** Keywords describing the adventure's mood and genre.
- **scenes:** Generate 2-3 interconnected scenes. Each scene must be fully fleshed out as per the scene generation guidelines: include high-quality read-aloud text, comprehensive GM notes (goals, setup, antagonists), clear skill checks, and defined rewards.`;
    const generatedData = await generateWithSchema(prompt, adventureWithScenesSchema, instructions, {}, 'gemini-2.5-flash', campaignContext);

    // Post-process the result to add IDs to skill checks within scenes, but not scene IDs themselves.
    if (generatedData.scenes && Array.isArray(generatedData.scenes)) {
        generatedData.scenes.forEach((scene: { skillChecks: Omit<SkillCheck, 'id'>[] }) => {
            if (scene.skillChecks && Array.isArray(scene.skillChecks)) {
                scene.skillChecks = scene.skillChecks.map((sc: Omit<SkillCheck, 'id'>) => ({
                    ...sc,
                    id: crypto.randomUUID(),
                }));
            } else {
                scene.skillChecks = [];
            }
        });
    } else {
        generatedData.scenes = [];
    }

    return generatedData as AdventureForBatchAdd;
};

export const generateArticle = async (prompt: string, campaignContext?: string): Promise<Omit<Article, 'id' | 'parentArticleId' | 'subArticleIds'>> => {
  const instructions = `You are The Prep Architect, an expert TTRPG loremaster. Your task is to generate a detailed lore article based on the user's prompt, conforming to the specified JSON schema.

- **title:** A clear title for the lore entry.
- **category:** The appropriate category for the article.
- **content:** Write the article in an engaging, encyclopedic style. This is background information for the GM to understand the world's history, key events, or cosmology. Structure it for clarity and easy reference during a game.`;
  return generateWithSchema(prompt, articleSchema, instructions, {}, 'gemini-2.5-flash', campaignContext);
};

export const generatePoiFromLoot = async (prompt: string, campaignContext?: string): Promise<Omit<PointOfInterest, 'id'>> => {
  const instructions = `You are a TTRPG designer creating an interactive element. Based on the following loot description, create a Point of Interest object describing how players discover it.

- **name:** Create a compelling name for the Point of Interest, inspired by the loot (e.g., "The Sunken Chest", "The Skeleton's Grasp").
- **passivePerceptionDC:** Set a DC to notice the item. 10 for easily visible, 13-15 for partially obscured, 16+ for well-hidden.
- **description:** Write a read-aloud description of the scene where the loot is found.
- **investigationChecks:** If there are details to learn by examining the loot (e.g., a maker's mark, a hidden compartment), create one or two checks. If the item is straightforward, return an empty array.
- **interactions:** Only add interactions if the item itself implies an action (e.g., it has a button or lever). Otherwise, return an empty array.`;
  const generatedData = await generateWithSchema(prompt, pointOfInterestSchema, instructions, {}, 'gemini-2.5-flash', campaignContext);
  
  // Add client-side IDs to sub-items
  if (generatedData.investigationChecks && Array.isArray(generatedData.investigationChecks)) {
    generatedData.investigationChecks = generatedData.investigationChecks.map((sc: Omit<SkillCheck, 'id'>) => ({
      ...sc,
      id: crypto.randomUUID()
    }));
  }
   if (generatedData.interactions && Array.isArray(generatedData.interactions)) {
    generatedData.interactions = generatedData.interactions.map((sc: Omit<SkillCheck, 'id'>) => ({
      ...sc,
      id: crypto.randomUUID()
    }));
  }

  return generatedData;
};
