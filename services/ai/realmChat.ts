
import { Type } from "@google/genai";
import type { ChatMessage, RealmChatResponse, ModelTier, DraftEntity } from '../../types/index';
import { generateWithSchema } from './core';
import { npcSchema, locationSchema, factionSchema, itemSchema, adventureWithScenesSchema, articleSchema } from './realmWeaver';

// Define a super-schema that can contain any of the entity types
const draftEntitySchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING, description: "A unique ID for this draft entity (e.g., 'draft-1'). Maintain this ID across turns for the same entity." },
        type: { type: Type.STRING, enum: ['npc', 'location', 'faction', 'item', 'adventure', 'article'] },
        status: { type: Type.STRING, enum: ['draft'], description: "Always 'draft' when coming from the AI." },
        npcData: npcSchema,
        locationData: locationSchema,
        factionData: factionSchema,
        itemData: itemSchema,
        adventureData: adventureWithScenesSchema,
        articleData: articleSchema,
    },
    required: ['id', 'type', 'status'],
};

const realmChatResponseSchema = {
    type: Type.OBJECT,
    properties: {
        message: { type: Type.STRING, description: "The chat response to the user. Keep it conversational and helpful." },
        suggestions: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING }, 
            description: "3 short, distinct suggestions for what the user might say next, or options for a guided flow." 
        },
        draftEntities: {
            type: Type.ARRAY,
            items: draftEntitySchema,
            description: "A list of entities being created or updated. If editing an existing draft, use the same ID."
        }
    },
    required: ['message', 'suggestions', 'draftEntities']
};

const mapTierToModel = (tier: ModelTier): string => {
    switch (tier) {
        case 'performance': return 'gemini-flash-lite-latest';
        case 'medium': return 'gemini-2.5-flash';
        case 'quality': return 'gemini-3-pro-preview';
        default: return 'gemini-2.5-flash';
    }
};

export const chatWithRealmWeaver = async (
    history: ChatMessage[],
    currentDrafts: DraftEntity[],
    approvedEntitiesLog: string[],
    campaignContext: string,
    tier: ModelTier,
    focusedEntityType?: 'npc' | 'location' | 'faction' | 'item' | 'adventure' | 'article'
): Promise<RealmChatResponse> => {
    const modelName = mapTierToModel(tier);
    
    let specificInstruction = "";
    if (focusedEntityType) {
        specificInstruction = `\n**FOCUSED MODE:** You are currently helping the user create a **${focusedEntityType.toUpperCase()}**. 
        - Do NOT create other types of entities unless explicitly requested.
        - Focus your questions and suggestions on filling out the details for this ${focusedEntityType}.
        - Provide detailed, multi-line descriptions in your chat messages to inspire the user, offering 3 distinct options or paths when asking for details.
        - Ensure you populate the \`draftEntities\` array with a ${focusedEntityType} object as soon as you have basic info, and update it in every subsequent turn.`;
    }

    const systemInstruction = `You are RealmChat, an intelligent TTRPG world-building assistant. 
Your goal is to help the Dungeon Master create new content for their campaign.
You can create NPCs, Locations, Factions, Items, Adventures, and Lore Articles.

${specificInstruction}

**Behavior:**
1.  **Conversational:** Chat naturally. If the user is vague, ask clarifying questions.
2.  **Guided Flows:** If the user asks to create something, guide them through it. Offer 3 distinct choices for key details (e.g., "What kind of NPC? 1. A grumpy smith, 2. A noble spy, 3. A lost child"), but always allow them to specify their own.
3.  **Drafting:** Whenever you have enough detail to start forming an entity, return it in the \`draftEntities\` array. 
    - Use the \`id\` to track entities across turns. If refining an entity, send it back with the SAME ID and updated data.
    - Fill the specific data field corresponding to the type (e.g., if type is 'npc', fill \`npcData\`).
4.  **Context:** Use the provided campaign context and the list of "Approved Entities" to ensure consistency.

**Schema Rules:**
- \`message\`: Your text response.
- \`suggestions\`: Array of 3 strings. These are quick-reply buttons for the user.
- \`draftEntities\`: Array of objects. 
    - \`id\`: Persistent ID for the session (e.g., "entity-1").
    - \`type\`: 'npc', 'location', etc.
    - \`npcData\`: (if type is npc) properties: name, description, traits, etc.
    - ... (other data fields for other types).

**Current Drafts:**
${JSON.stringify(currentDrafts.map(d => ({ id: d.id, type: d.type, data: d.data })))}

**Approved/Created Log:**
${approvedEntitiesLog.join('\n')}
`;

    const transcript = history.map(msg => `${msg.role === 'user' ? 'User' : 'RealmChat'}: ${msg.text}`).join('\n\n');
    const lastUserMessage = history[history.length - 1];
    const prompt = `Conversation History:\n${transcript}\n\nUser's Last Input: "${lastUserMessage.text}"\n\nRespond to the user and update any drafts.`;

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawResponse: any = await generateWithSchema(prompt, realmChatResponseSchema, systemInstruction, {}, modelName, campaignContext);
        
        // Post-process to flatten the data structure for the app
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const processedDrafts: DraftEntity[] = (rawResponse.draftEntities || []).map((raw: any) => {
            let data = {};
            if (raw.type === 'npc') data = raw.npcData;
            else if (raw.type === 'location') data = raw.locationData;
            else if (raw.type === 'faction') data = raw.factionData;
            else if (raw.type === 'item') data = raw.itemData;
            else if (raw.type === 'adventure') data = raw.adventureData;
            else if (raw.type === 'article') data = raw.articleData;

            return {
                id: raw.id,
                type: raw.type,
                status: 'draft',
                data: data
            } as DraftEntity;
        });

        return {
            message: rawResponse.message,
            suggestions: rawResponse.suggestions || [],
            draftEntities: processedDrafts
        };

    } catch (error) {
        console.error("RealmChat Error:", error);
        return {
            message: "I'm having trouble connecting to the Weave right now. Please try again.",
            suggestions: [],
            draftEntities: []
        };
    }
};
