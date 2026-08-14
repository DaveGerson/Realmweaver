
import type { SkillCheck, BatchAddData, PlayerCharacter, AdventureForBatchAdd, Scene, NPC, Location } from '../../types/index';
import { npcSchema, locationSchema, factionSchema, itemSchema, adventureWithScenesSchema } from './realmWeaver';
import { generateWithSchema, generateChatCompletion } from './core';

// --- Schemas ---

export const playerCharacterSchema = {
    type: 'object',
    properties: {
        playerName: { type: 'string', description: "The player's name, often found at the top right." },
        characterSocial: {
            type: 'object',
            properties: {
                characterName: { type: 'string', description: "The character's name." },
                background: { type: 'string', description: "The character's background (e.g., Soldier, Sage)." },
                species: { type: 'string', description: "The character's species or race (e.g., Dark Elf (Drow))." },
                personality: { type: 'string', description: "The character's personality traits, usually in a dedicated box." },
                appearance: { type: 'string', description: "A summary of the character's appearance. If not explicitly stated, infer from species and other details." },
                backstory: { type: 'string', description: "The character's backstory, often on a separate page." },
                ideals: { type: 'string', description: "The character's ideals." },
                bonds: { type: 'string', description: "The character's bonds." },
                flaws: { type: 'string', description: "The character's flaws." },
            },
            required: ['characterName', 'background', 'species', 'personality', 'appearance', 'backstory', 'ideals', 'bonds', 'flaws'],
        },
        characterStatistics: {
            type: 'object',
            properties: {
                classes: {
                    type: 'object',
                    properties: {
                        charClass: { type: 'string', description: "The character's primary class (e.g., Ranger)." },
                        subclass: { type: 'string', description: "The character's subclass, if specified." },
                        level: { type: 'integer', description: "The character's level for that class." },
                    },
                    required: ['charClass', 'level'],
                },
                attributes: {
                    type: 'object',
                    properties: {
                        strength: { type: 'integer' },
                        dexterity: { type: 'integer' },
                        constitution: { type: 'integer' },
                        intelligence: { type: 'integer' },
                        wisdom: { type: 'integer' },
                        charisma: { type: 'integer' },
                    },
                    required: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'],
                },
                skills: {
                    type: 'object',
                    properties: {
                        acrobatics: { type: 'string', enum: ["none", "half", "proficient", "expertise"] },
                        animal_handling: { type: 'string', enum: ["none", "half", "proficient", "expertise"] },
                        arcana: { type: 'string', enum: ["none", "half", "proficient", "expertise"] },
                        athletics: { type: 'string', enum: ["none", "half", "proficient", "expertise"] },
                        deception: { type: 'string', enum: ["none", "half", "proficient", "expertise"] },
                        history: { type: 'string', enum: ["none", "half", "proficient", "expertise"] },
                        insight: { type: 'string', enum: ["none", "half", "proficient", "expertise"] },
                        intimidation: { type: 'string', enum: ["none", "half", "proficient", "expertise"] },
                        investigation: { type: 'string', enum: ["none", "half", "proficient", "expertise"] },
                        medicine: { type: 'string', enum: ["none", "half", "proficient", "expertise"] },
                        nature: { type: 'string', enum: ["none", "half", "proficient", "expertise"] },
                        perception: { type: 'string', enum: ["none", "half", "proficient", "expertise"] },
                        performance: { type: 'string', enum: ["none", "half", "proficient", "expertise"] },
                        persuasion: { type: 'string', enum: ["none", "half", "proficient", "expertise"] },
                        religion: { type: 'string', enum: ["none", "half", "proficient", "expertise"] },
                        sleight_of_hand: { type: 'string', enum: ["none", "half", "proficient", "expertise"] },
                        stealth: { type: 'string', enum: ["none", "half", "proficient", "expertise"] },
                        survival: { type: 'string', enum: ["none", "half", "proficient", "expertise"] },
                    },
                    required: ['acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleight_of_hand', 'stealth', 'survival'],
                },
                actions: { type: 'array', items: { type: 'string' }, description: "List of the names of weapon attacks and other standard actions listed under the 'Actions' section." },
                specialActions: { type: 'array', items: { type: 'string' }, description: "List of the names of features and traits from the 'Features & Traits' page (e.g., 'Favored Enemy', 'Sharpshooter')." },
            },
            required: ['classes', 'attributes', 'skills'],
        },
    },
    required: ['playerName', 'characterSocial', 'characterStatistics'],
};

const campaignFillSchema = {
    type: 'object',
    properties: {
        npcs: { type: 'array', description: "A list of non-player characters related to the prompt. The number of entities should be appropriate for the scope of the prompt.", items: npcSchema },
        locations: { type: 'array', description: "A list of key locations related to the prompt. The number of entities should be appropriate for the scope of the prompt.", items: locationSchema },
        factions: { type: 'array', description: "A list of factions related to the prompt. The number of entities should be appropriate for the scope of the prompt.", items: factionSchema },
        adventures: { type: 'array', description: "A list of short, compelling adventures related to the prompt, each with a few scenes. The number of entities should be appropriate for the scope of the prompt.", items: adventureWithScenesSchema },
        items: { type: 'array', description: "A list of magic items related to the prompt. The number of entities should be appropriate for the scope of the prompt.", items: itemSchema },
    }
};

const postProcessResult = (result: BatchAddData): BatchAddData => {
    // Post-process the result to add IDs to skill checks within scenes and sanitize data
    if (result.adventures) {
        result.adventures.forEach((adventure) => {
            // FIX: Ensure adventure.scenes is an array, as the AI might omit it.
            adventure.scenes = adventure.scenes || [];
            adventure.scenes.forEach((scene: Partial<Scene>) => {
                // FIX: Ensure scene.skillChecks is an array and add IDs.
                scene.skillChecks = (scene.skillChecks || []).map((sc: Omit<SkillCheck, 'id'>) => ({
                    ...sc,
                    id: crypto.randomUUID(),
                }));
                 // FIX: Ensure scene.npcIds is an array to prevent crashes.
                scene.npcIds = scene.npcIds || [];
                 // FIX: Ensure scene.status has a valid default — the real-provider
                 // sceneSchema never returns it (finding #7).
                scene.status = scene.status || 'planned';
            });
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
        type: 'object',
        properties: requestedProperties,
        required: Object.keys(requestedProperties),
    };

    const instructions = `You are a master world-builder for Dungeons & Dragons. Based on the following high-level prompt, generate a set of interconnected world entities. You should decide on a reasonable number of entities to create based on the prompt's scope. Ensure the entities feel cohesive and related to the central theme of the prompt. For adventures, include 2-3 scenes that form a coherent storyline.`;
    const result = await generateWithSchema(prompt, dynamicSchema, instructions, {}, 'standard', campaignContext);
    
    return postProcessResult(result);
};


export const parseDocumentForEntities = async (documentContent: string, campaignContext?: string): Promise<BatchAddData> => {
    const instructions = `You are an expert TTRPG assistant. Your task is to parse the following document and extract all recognizable TTRPG entities (NPCs, Locations, Factions, Items, Adventures). Structure the extracted information into a valid JSON object that conforms to the provided schema. Infer relationships between entities where possible. For adventures, synthesize a cohesive adventure structure from the notes, creating scenes from logical sections of the text.`;
    
    const result = await generateWithSchema(documentContent, campaignFillSchema, instructions, {}, 'quality', campaignContext);
    
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

    const response = await generateWithSchema('', playerCharacterSchema, instructions, { contents: { parts: [pdfPart, textPart] } }, 'standard', campaignContext);

    return response as Omit<PlayerCharacter, 'id'>;
};

export const generateChatResponse = async (history: { role: 'user' | 'model', text: string }[], campaignContext?: string): Promise<string> => {
    const modelName = 'lite';
    const systemInstruction = `You are a creative, collaborative world-building assistant for a TTRPG Dungeon Master. Your tone is friendly and inquisitive. Help the user brainstorm ideas for their campaign. Ask clarifying questions and offer creative suggestions to help them flesh out their ideas for NPCs, locations, factions, and story hooks. Keep your responses concise (2-4 sentences).`;

    const contents = history.map(h => ({ role: h.role, parts: [{text: h.text}] }));

    return await generateChatCompletion(contents, systemInstruction, modelName, campaignContext);
};

// --- First Campaign Wizard ---

const starterNpcsSchema = {
    type: 'object',
    properties: {
        npcs: {
            type: 'array',
            description: "3 to 5 starter NPCs for the campaign world",
            items: npcSchema,
        }
    },
    required: ['npcs'],
};

const starterLocationsSchema = {
    type: 'object',
    properties: {
        locations: {
            type: 'array',
            description: "2 to 3 starter locations for the campaign world",
            items: locationSchema,
        }
    },
    required: ['locations'],
};

export const generateStarterNpcs = async (worldDescription: string, campaignContext?: string): Promise<Array<Omit<NPC, 'id' | 'factionId'>>> => {
    const instructions = `You are a master world-builder for tabletop RPGs. Based on the world description, generate 3 to 5 interesting starter NPCs who feel native to this world. Each NPC should have a distinct role in the community (innkeeper, merchant, guard, mage, etc.) and a compelling secret or motivation that a Game Master can use. Make them feel grounded and immediately useful for running the first session.`;
    const result = await generateWithSchema(worldDescription, starterNpcsSchema, instructions, {}, 'standard', campaignContext);
    const npcs: Array<Omit<NPC, 'id' | 'factionId'>> = (result.npcs || []).map((n: Omit<NPC, 'id' | 'factionId'>) => ({
        ...n,
        knowsPlayerHistory: [],
        relationships: [],
        history: [],
    }));
    return npcs;
};

export const generateStarterLocations = async (worldDescription: string, npcs: Array<Omit<NPC, 'id' | 'factionId'>>, campaignContext?: string): Promise<Array<Omit<Location, 'id' | 'parentLocationId' | 'subLocationIds'>>> => {
    const npcList = npcs.map(n => `- ${n.name}: ${n.description}`).join('\n');
    const prompt = `World description:\n${worldDescription}\n\nKey NPCs who inhabit this world:\n${npcList}`;
    const instructions = `You are a master world-builder for tabletop RPGs. Based on the world description and its key NPCs, generate 2 to 3 starter locations. Each location should feel lived-in and relevant to the NPCs. Include at least one safe hub (tavern, inn, town square) and one location with a danger or mystery. Make them immediately usable for the first session.`;
    const result = await generateWithSchema(prompt, starterLocationsSchema, instructions, {}, 'standard', campaignContext);
    const locations: Array<Omit<Location, 'id' | 'parentLocationId' | 'subLocationIds'>> = (result.locations || []).map((l: Omit<Location, 'id' | 'parentLocationId' | 'subLocationIds'>) => ({
        ...l,
        loot: l.loot || [],
        connections: l.connections || [],
        pointsOfInterest: l.pointsOfInterest || [],
        history: l.history || [],
    }));
    return locations;
};

export const generateStarterAdventure = async (worldDescription: string, npcs: Array<Omit<NPC, 'id' | 'factionId'>>, locations: Array<Omit<Location, 'id' | 'parentLocationId' | 'subLocationIds'>>, campaignContext?: string): Promise<AdventureForBatchAdd> => {
    const npcList = npcs.map(n => `- ${n.name}: ${n.motivations}`).join('\n');
    const locList = locations.map(l => `- ${l.name}: ${l.description}`).join('\n');
    const prompt = `World description:\n${worldDescription}\n\nNPCs:\n${npcList}\n\nLocations:\n${locList}`;
    const instructions = `You are a master adventure designer for tabletop RPGs. Based on the world, its NPCs, and its locations, generate a complete starter adventure with 3 scenes. The adventure should naturally draw the players into the world, involve at least 2 of the NPCs, and use the key locations. Keep it approachable for level 1 characters. The adventure should have a clear beginning, middle, and end.`;
    const result = await generateWithSchema(prompt, adventureWithScenesSchema, instructions, {}, 'standard', campaignContext);
    const adventure: AdventureForBatchAdd = {
        title: result.title || 'Starter Adventure',
        hook: result.hook || '',
        theme: result.theme || '',
        level: result.level || 1,
        scenes: (result.scenes || []).map((s: Scene) => ({
            ...s,
            skillChecks: (s.skillChecks || []).map((sc: Omit<typeof s.skillChecks[0], 'id'>) => ({ ...sc, id: crypto.randomUUID() })),
            npcIds: s.npcIds || [],
            status: s.status || 'planned',
        })),
    };
    return adventure;
};
