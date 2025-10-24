

import { Type } from "@google/genai";
import type { SkillCheck, BatchAddData, PlayerCharacter } from '../../types/index';
import { npcSchema, locationSchema, factionSchema, itemSchema, adventureWithScenesSchema } from './realmWeaver';
import { generateWithSchema, generateChatCompletion } from './core';

// --- Schemas ---

export const playerCharacterSchema = {
    type: Type.OBJECT,
    properties: {
        playerName: { type: Type.STRING, description: "The player's name, often found at the top right." },
        characterSocial: {
            type: Type.OBJECT,
            properties: {
                characterName: { type: Type.STRING, description: "The character's name." },
                background: { type: Type.STRING, description: "The character's background (e.g., Soldier, Sage)." },
                species: { type: Type.STRING, description: "The character's species or race (e.g., Dark Elf (Drow))." },
                personality: { type: Type.STRING, description: "The character's personality traits, usually in a dedicated box." },
                appearance: { type: Type.STRING, description: "A summary of the character's appearance. If not explicitly stated, infer from species and other details." },
                backstory: { type: Type.STRING, description: "The character's backstory, often on a separate page." },
                ideals: { type: Type.STRING, description: "The character's ideals." },
                bonds: { type: Type.STRING, description: "The character's bonds." },
                flaws: { type: Type.STRING, description: "The character's flaws." },
            },
            required: ['characterName', 'background', 'species', 'personality', 'appearance', 'backstory', 'ideals', 'bonds', 'flaws'],
        },
        characterStatistics: {
            type: Type.OBJECT,
            properties: {
                classes: {
                    type: Type.OBJECT,
                    properties: {
                        charClass: { type: Type.STRING, description: "The character's primary class (e.g., Ranger)." },
                        subclass: { type: Type.STRING, description: "The character's subclass, if specified." },
                        level: { type: Type.INTEGER, description: "The character's level for that class." },
                    },
                    required: ['charClass', 'level'],
                },
                attributes: {
                    type: Type.OBJECT,
                    properties: {
                        strength: { type: Type.INTEGER },
                        dexterity: { type: Type.INTEGER },
                        constitution: { type: Type.INTEGER },
                        intelligence: { type: Type.INTEGER },
                        wisdom: { type: Type.INTEGER },
                        charisma: { type: Type.INTEGER },
                    },
                    required: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'],
                },
                skills: {
                    type: Type.OBJECT,
                    properties: {
                        acrobatics: { type: Type.STRING, enum: ["none", "half", "proficient", "expertise"] },
                        animal_handling: { type: Type.STRING, enum: ["none", "half", "proficient", "expertise"] },
                        arcana: { type: Type.STRING, enum: ["none", "half", "proficient", "expertise"] },
                        athletics: { type: Type.STRING, enum: ["none", "half", "proficient", "expertise"] },
                        deception: { type: Type.STRING, enum: ["none", "half", "proficient", "expertise"] },
                        history: { type: Type.STRING, enum: ["none", "half", "proficient", "expertise"] },
                        insight: { type: Type.STRING, enum: ["none", "half", "proficient", "expertise"] },
                        intimidation: { type: Type.STRING, enum: ["none", "half", "proficient", "expertise"] },
                        investigation: { type: Type.STRING, enum: ["none", "half", "proficient", "expertise"] },
                        medicine: { type: Type.STRING, enum: ["none", "half", "proficient", "expertise"] },
                        nature: { type: Type.STRING, enum: ["none", "half", "proficient", "expertise"] },
                        perception: { type: Type.STRING, enum: ["none", "half", "proficient", "expertise"] },
                        performance: { type: Type.STRING, enum: ["none", "half", "proficient", "expertise"] },
                        persuasion: { type: Type.STRING, enum: ["none", "half", "proficient", "expertise"] },
                        religion: { type: Type.STRING, enum: ["none", "half", "proficient", "expertise"] },
                        sleight_of_hand: { type: Type.STRING, enum: ["none", "half", "proficient", "expertise"] },
                        stealth: { type: Type.STRING, enum: ["none", "half", "proficient", "expertise"] },
                        survival: { type: Type.STRING, enum: ["none", "half", "proficient", "expertise"] },
                    },
                    required: ['acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleight_of_hand', 'stealth', 'survival'],
                },
                actions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of the names of weapon attacks and other standard actions listed under the 'Actions' section." },
                specialActions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of the names of features and traits from the 'Features & Traits' page (e.g., 'Favored Enemy', 'Sharpshooter')." },
            },
            required: ['classes', 'attributes', 'skills'],
        },
    },
    required: ['playerName', 'characterSocial', 'characterStatistics'],
};

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

export const parseCharacterSheetPdf = async (pdfBase64: string, campaignContext?: string): Promise<Omit<PlayerCharacter, 'id'>> => {
    const instructions = `You are an expert D&D 5e data entry assistant. Your task is to parse the provided D&D Beyond character sheet PDF and extract all character information into a structured JSON object.
- For ability scores, use the large number, not the small modifier.
- For skills, if a skill's bubble is filled in, it is 'proficient'. If it also has a 'P' it is also 'proficient'. If it has an 'E', it is 'expertise'. Otherwise, it is 'none'.
- Extract class and level from the top of the sheet.
- Extract personality traits, ideals, bonds, and flaws from their respective boxes.
- Summarize the character's backstory from the backstory page.
- For actions, list the names of weapon attacks and other standard actions listed under the 'Actions' section.
- For special actions, list the names of features and traits from the 'Features & Traits' page (e.g., 'Favored Enemy', 'Sharpshooter').`;
    
    const pdfPart = {
        inlineData: {
            mimeType: 'application/pdf',
            data: pdfBase64,
        },
    };

    const textPart = { text: "Parse this character sheet." };

    const response = await generateWithSchema('', playerCharacterSchema, instructions, { contents: { parts: [pdfPart, textPart] } }, 'gemini-2.5-flash', campaignContext);

    return response as Omit<PlayerCharacter, 'id'>;
};

export const generateChatResponse = async (history: { role: 'user' | 'model', text: string }[], campaignContext?: string): Promise<string> => {
    const modelName = 'gemini-flash-lite-latest';
    const systemInstruction = `You are a creative, collaborative world-building assistant for a TTRPG Dungeon Master. Your tone is friendly and inquisitive. Help the user brainstorm ideas for their campaign. Ask clarifying questions and offer creative suggestions to help them flesh out their ideas for NPCs, locations, factions, and story hooks. Keep your responses concise (2-4 sentences).`;

    const contents = history.map(h => ({ role: h.role, parts: [{text: h.text}] }));

    return await generateChatCompletion(contents, systemInstruction, modelName, campaignContext);
};
