import { Type } from "@google/genai";
import type { SkillCheck, BatchAddData } from '../../types/index';
import { npcSchema, locationSchema, factionSchema, itemSchema, adventureWithScenesSchema } from './realmWeaver';
import { generateWithSchema, generateText } from './core';

// --- Schemas ---

const campaignFillSchema = {
    type: Type.OBJECT,
    properties: {
        npcs: { type: Type.ARRAY, description: "A list of non-player characters related to the prompt. The number of entities should be appropriate for the scope of the prompt.", items: npcSchema },
        locations: { type: Type.ARRAY, description: "A list of key locations related to the prompt. The number of entities should be appropriate for the scope of the prompt.", items: locationSchema },
        factions: { type: Type.ARRAY, description: "A list of factions related to the prompt. The number of entities should be appropriate for the scope of the prompt.", items: factionSchema },
        adventures: { type: Type.ARRAY, description: "A list of short, compelling adventures related to the prompt, each with a few scenes. The number of entities should be appropriate for the scope of the prompt.", items: adventureWithScenesSchema },
        items: { type: Type.ARRAY, description: "A list of magic items related to the prompt. The number of entities should be appropriate for the scope of the prompt.", items: itemSchema },
    }
};

const postProcessResult = (result: BatchAddData): BatchAddData => {
    // Post-process the result to add IDs to skill checks within scenes
    if (result.adventures) {
        result.adventures.forEach((adventure: { scenes: { skillChecks: Omit<SkillCheck, 'id'>[] }[] }) => {
            if (adventure.scenes && Array.isArray(adventure.scenes)) {
                adventure.scenes.forEach(scene => {
                    if (scene.skillChecks && Array.isArray(scene.skillChecks)) {
                        scene.skillChecks = scene.skillChecks.map((sc: Omit<SkillCheck, 'id'>) => ({
                            ...sc,
                            id: crypto.randomUUID(),
                        }));
                    }
                });
            }
        });
    }

    // Ensure all requested arrays exist, even if empty, to prevent downstream errors
    const finalResult = {
        npcs: result.npcs || [],
        locations: result.locations || [],
        factions: result.factions || [],
        adventures: result.adventures || [],
        items: result.items || [],
    };
    
    return finalResult;
}

// --- Generator Function ---

export const generateCampaignFill = async (prompt: string, options: { npcs: boolean, locations: boolean, factions: boolean, adventures: boolean, items: boolean }, campaignContext?: string): Promise<BatchAddData> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestedProperties: Record<string, any> = {};
    if (options.npcs) requestedProperties.npcs = campaignFillSchema.properties.npcs;
    if (options.locations) requestedProperties.locations = campaignFillSchema.properties.locations;
    if (options.factions) requestedProperties.factions = campaignFillSchema.properties.factions;
    if (options.adventures) requestedProperties.adventures = campaignFillSchema.properties.adventures;
    if (options.items) requestedProperties.items = campaignFillSchema.properties.items;

    const dynamicSchema = {
        type: Type.OBJECT,
        properties: requestedProperties,
        required: Object.keys(requestedProperties),
    };

    const instructions = `You are a master world-builder for Dungeons & Dragons. Based on the following high-level prompt, generate a set of interconnected world entities. You should decide on a reasonable number of entities to create based on the prompt's scope. Ensure the entities feel cohesive and related to the central theme of the prompt. For adventures, include 2-3 scenes that form a coherent storyline.`;
    const result = await generateWithSchema(prompt, dynamicSchema, instructions, {}, 'gemini-2.5-flash', campaignContext);
    
    return postProcessResult(result);
};


export const parseDocumentForEntities = async (documentContent: string, campaignContext?: string): Promise<BatchAddData> => {
    const instructions = `You are an expert TTRPG assistant. Your task is to parse the following document and extract all recognizable TTRPG entities (NPCs, Locations, Factions, Items, Adventures). Structure the extracted information into a valid JSON object that conforms to the provided schema. Infer relationships between entities where possible. For adventures, synthesize a cohesive adventure structure from the notes, creating scenes from logical sections of the text.`;
    
    const result = await generateWithSchema(documentContent, campaignFillSchema, instructions, {}, 'gemini-2.5-pro', campaignContext);
    
    return postProcessResult(result);
}

export const generateChatResponse = async (history: { role: 'user' | 'model', text: string }[], campaignContext?: string): Promise<string> => {
    const modelName = 'gemini-flash-lite-latest'; // Use a fast model for conversational turns
    const systemInstruction = `You are a creative, collaborative world-building assistant for a TTRPG Dungeon Master. Your tone is friendly and inquisitive. Help the user brainstorm ideas for their campaign. Ask clarifying questions and offer creative suggestions to help them flesh out their ideas for NPCs, locations, factions, and story hooks. Keep your responses concise (2-4 sentences).`;

    const contents = history.map(h => ({ role: h.role, parts: [{text: h.text}] }));

    const response = await generateText(JSON.stringify({systemInstruction, contents}), modelName, campaignContext);
    return response;
};
