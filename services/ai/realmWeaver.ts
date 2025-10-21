


import { Type } from "@google/genai";
import type { NPC, Location, Faction, Item, Scene, SkillCheck, AdventureForBatchAdd } from '../../types';
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

// --- Generator Functions ---

export const generateNpc = async (prompt: string, useGroundedSearch: boolean = false, campaignContext?: string): Promise<Omit<NPC, 'id' | 'factionId'>> => {
  const instructions = `You are a master storyteller and world-builder for Dungeons & Dragons. Based on the following prompt, generate a detailed NPC. The NPC should be memorable, with a rich description that includes unique physical details and attire. Their personality traits should be distinct and actionable, giving a game master clear hooks for roleplaying. Include a single, characteristic example quote. The backstory and motivations should be compelling but concise, providing clear plot hooks.`;
  const configOverrides = useGroundedSearch ? { tools: [{googleSearch: {}}] } : {};
  const generatedData = await generateWithSchema(prompt, npcSchema, instructions, configOverrides, 'gemini-2.5-flash', campaignContext);
  return { ...generatedData, knowsPlayerHistory: [] }; // The AI doesn't generate this field, so return an empty array.
};

export const generateLocation = async (prompt: string, campaignContext?: string): Promise<Omit<Location, 'id' | 'parentLocationId' | 'subLocationIds'>> => {
  const instructions = `You are a master world-builder, crafting vivid settings for Dungeons & Dragons. Based on the following prompt, generate a detailed location. The description should be rich with sensory details—what does it look, sound, and smell like? Evoke a strong mood or atmosphere. The secrets should be intriguing and provide clear opportunities for player discovery and interaction.`;
  return generateWithSchema(prompt, locationSchema, instructions, {}, 'gemini-2.5-flash', campaignContext);
};

export const generateFaction = async (prompt: string, campaignContext?: string): Promise<Omit<Faction, 'id' | 'leaderId' | 'memberIds'>> => {
  const instructions = `You are a master world-builder, designing political and social structures for Dungeons & Dragons. Based on the following prompt, generate a detailed faction. The description should give a clear sense of their public identity and their internal culture. Their goals should be specific, actionable, and divided into short-term (what are they doing now?) and long-term (what is their ultimate ambition?) objectives.`;
  return generateWithSchema(prompt, factionSchema, instructions, {}, 'gemini-2.5-flash', campaignContext);
};

export const generateItem = async (prompt: string, campaignContext?: string): Promise<Omit<Item, 'id'>> => {
  const instructions = `You are a legendary artificer and loremaster for Dungeons & Dragons. Based on the prompt, design a compelling magical item. The description should be evocative, hinting at its origin or purpose. The properties must be clear and align with standard TTRPG mechanics.`;
  return generateWithSchema(prompt, itemSchema, instructions, {}, 'gemini-2.5-flash', campaignContext);
};

export const generateScene = async (prompt: string, campaignContext?: string): Promise<Omit<Scene, 'id' | 'locationId' | 'npcIds'>> => {
  const instructions = `You are an expert Dungeon Master, designing engaging scenes for Dungeons & Dragons. Based on the prompt, create a detailed scene. Generate distinct text for 'readAloudText' (for players) and 'gmNotes' (for the GM). The read-aloud text should be evocative and set the scene. The GM notes should cover goals, motivations, and secrets. Also include relevant skill checks and potential rewards.`;
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
    const instructions = `You are a master adventure writer for Dungeons & Dragons. Based on the prompt, outline a compelling adventure. This should include a title, a target level, a plot hook, themes, and 2-3 fully detailed scenes that form a coherent storyline. Each scene must have its own title, type, read-aloud text, GM notes, skill checks, and rewards.`;
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
