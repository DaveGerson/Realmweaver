
import type { ChatMessage, RealmChatResponse, ModelTier, DraftEntity } from '../../types/index';
import { generateWithSchema } from './core';
import { npcSchema, locationSchema, factionSchema, itemSchema, adventureWithScenesSchema, articleSchema } from './realmWeaver';

// Define a super-schema that can contain any of the entity types
const draftEntitySchema = {
    type: 'object',
    properties: {
        id: { type: 'string', description: "A unique ID for this draft entity (e.g., 'draft-1'). Maintain this ID across turns for the same entity." },
        type: { type: 'string', enum: ['npc', 'location', 'faction', 'item', 'adventure', 'article'] },
        status: { type: 'string', enum: ['draft'], description: "Always 'draft' when coming from the AI." },
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
    type: 'object',
    properties: {
        message: { type: 'string', description: "The chat response to the user. Keep it conversational and helpful." },
        suggestions: {
            type: 'array',
            items: { type: 'string' },
            description: "3 short, distinct suggestions for what the user might say next, or options for a guided flow."
        },
        draftEntities: {
            type: 'array',
            items: draftEntitySchema,
            description: "A list of entities being created or updated. If editing an existing draft, use the same ID."
        }
    },
    required: ['message', 'suggestions', 'draftEntities']
};

const mapTierToModel = (tier: ModelTier): string => {
    switch (tier) {
        case 'performance': return 'lite';
        case 'medium': return 'standard';
        case 'quality': return 'quality';
        default: return 'standard';
    }
};

export const chatWithRealmWeaver = async (
    history: ChatMessage[],
    currentDrafts: DraftEntity[],
    approvedEntitiesLog: string[],
    campaignContext: string,
    tier: ModelTier,
    focusedEntityType?: 'npc' | 'location' | 'faction' | 'item' | 'adventure' | 'article' | 'scene'
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawResponse: any = await generateWithSchema(prompt, realmChatResponseSchema, systemInstruction, {}, modelName, campaignContext);

    // Post-process to flatten the data structure for the app.
    // The model may return entity data in several formats:
    //   1. Type-specific key: { npcData: {...} } (schema-enforced by Gemini)
    //   2. Generic data key: { data: {...} } (common with schema-in-prompt)
    //   3. Inline fields: { id, type, status, name, description, ... } (Claude CLI)
    // We handle all three gracefully.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processedDrafts: DraftEntity[] = (rawResponse.draftEntities || []).map((raw: any) => {
        // Try type-specific key first (original Gemini pattern)
        const typeKeyMap: Record<string, string> = {
            npc: 'npcData', location: 'locationData', faction: 'factionData',
            item: 'itemData', adventure: 'adventureData', article: 'articleData',
        };
        const typeKey = typeKeyMap[raw.type];
        let data = typeKey ? raw[typeKey] : undefined;

        // Fallback: generic "data" key
        if (!data && raw.data && typeof raw.data === 'object') {
            data = raw.data;
        }

        // Fallback: inline fields — extract everything except meta fields
        if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
            const { id: _id, type: _type, status: _status, npcData: _n, locationData: _l, factionData: _f, itemData: _i, adventureData: _a, articleData: _ar, ...inlineFields } = raw;
            if (Object.keys(inlineFields).length > 0) {
                data = inlineFields;
            }
        }

        return {
            id: raw.id,
            type: raw.type,
            status: 'draft',
            data: data || {}
        } as DraftEntity;
    });

    return {
        message: rawResponse.message,
        suggestions: rawResponse.suggestions || [],
        draftEntities: processedDrafts
    };
};

const npcRoleplayResponseSchema = {
    type: 'object',
    properties: {
        dialogue: {
            type: 'string',
            description: "The NPC's in-character dialogue response (2-4 sentences). Speak directly as the NPC in first person.",
        },
        moodCue: {
            type: 'string',
            description: "A brief stage direction describing the NPC's physical action or emotional state (e.g., 'leans forward, voice dropping to a whisper'). No brackets needed.",
        },
    },
    required: ['dialogue', 'moodCue'],
};

export const generateNpcRoleplay = async (
    npcContext: string,
    conversationHistory: Array<{ role: string; text: string }>,
    userMessage: string,
    campaignContext?: string
): Promise<{ dialogue: string; moodCue: string }> => {
    const systemInstruction = `You are roleplaying as the NPC described below. Stay fully in character at all times.

${npcContext}

**Roleplay Rules:**
1. Speak in first person as the NPC. Never break character or refer to yourself as an AI.
2. Reflect the NPC's personality, speech patterns, and emotional state in every response.
3. Draw on their traits, motivations, and secrets when it feels natural — but don't reveal secrets unless pressed.
4. Reference campaign events and other known characters organically if relevant.
5. Keep your dialogue concise: 2-4 sentences maximum.
6. Provide a mood cue that describes your physical action or emotional subtext (e.g., "drums fingers on the table, eyes darting to the door"). Do not include brackets.
7. Return JSON with exactly two fields: "dialogue" and "moodCue".
8. If a "Voice" section is documented above, that accent, cadence, and set of verbal tics are binding for this reply — not optional color.
9. If lines the NPC has actually spoken at the table are listed above, stay consistent with them: you are continuing a voice this table has already heard, not starting fresh from the character sheet.`;

    const historyLines = conversationHistory
        .map(msg => `${msg.role === 'user' ? 'Player' : 'NPC'}: ${msg.text}`)
        .join('\n');

    const prompt = historyLines
        ? `Conversation so far:\n${historyLines}\n\nPlayer says: "${userMessage}"\n\nRespond as the NPC.`
        : `Player says: "${userMessage}"\n\nRespond as the NPC.`;

    const rawResponse = await generateWithSchema(
        prompt,
        npcRoleplayResponseSchema,
        systemInstruction,
        {},
        'standard',
        campaignContext
    );
    return {
        dialogue: rawResponse.dialogue || '',
        moodCue: rawResponse.moodCue || '',
    };
};
