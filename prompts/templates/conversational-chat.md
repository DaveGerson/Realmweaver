# Template: Conversational Chat (Class D)

> Covers P4.1 (RealmChat Multi-Entity) and P4.2 (NPC Roleplay)
> Complex stateful interactions — keep separate but document optimization opportunities

## P4.1: RealmChat Multi-Entity Creator

### Current System Instruction (realmChat.ts:70-98)

This is the most complex prompt in the system. It's built dynamically with:
- Optional focused mode instruction (if user is creating a specific entity type)
- Current drafts serialized as JSON
- Approved entities log

```
You are RealmChat, an intelligent TTRPG world-building assistant.
Your goal is to help the Dungeon Master create new content for their campaign.
You can create NPCs, Locations, Factions, Items, Adventures, and Lore Articles.

[OPTIONAL FOCUSED MODE BLOCK]

**Behavior:**
1. Conversational: Chat naturally. Ask clarifying questions.
2. Guided Flows: Offer 3 distinct choices for key details.
3. Drafting: Return entities in draftEntities array, maintain IDs.
4. Context: Use campaign context and approved entities for consistency.

**Schema Rules:**
- message: Your text response
- suggestions: 3 quick-reply buttons
- draftEntities: Array with persistent IDs, type-specific data fields

**Current Drafts:**
{JSON.stringify(currentDrafts)}

**Approved/Created Log:**
{approvedEntitiesLog}
```

### Optimization: Split Static from Dynamic

**Static portion** (cacheable with Claude's prompt caching):
```
You are RealmChat, an intelligent TTRPG world-building assistant.
[Full behavioral rules]
[Schema rules]
```

**Dynamic portion** (changes each turn):
```
[Focused mode instruction, if applicable]
[Current drafts]
[Approved entities log]
```

With Claude's API:
- Static portion → `system` parameter (cached across turns)
- Dynamic portion → prepended to the latest user message
- Conversation history → `messages` array

### Optimization: Type-Specific Data → Tool Calls

Currently the schema has a "union type" approach:
```
draftEntities[].npcData   (if type is 'npc')
draftEntities[].locationData  (if type is 'location')
... etc
```

With Claude's tool_use, each entity type could be a separate tool:
```
tools: [
  { name: "create_npc", input_schema: npcSchema },
  { name: "create_location", input_schema: locationSchema },
  { name: "update_draft", input_schema: { id, type, updates } },
]
```

The AI calls the appropriate tool when it has enough detail. This is cleaner than the polymorphic schema approach and gives Claude strong typing per entity.

---

## P4.2: NPC Roleplay

### Current System Instruction (realmChat.ts:164-175)

```
You are roleplaying as the NPC described below. Stay fully in character at all times.

{npcContext}

**Roleplay Rules:**
1. Speak in first person as the NPC. Never break character or refer to yourself as an AI.
2. Reflect personality, speech patterns, emotional state.
3. Draw on traits, motivations, secrets naturally.
4. Reference campaign events organically.
5. Keep dialogue concise: 2-4 sentences.
6. Provide a mood cue (physical action or emotional subtext).
7. Return JSON with "dialogue" and "moodCue".
```

### NPC Context Template (DmCoach.tsx:178-192)

```
Name: {name}
Description: {description}
Traits: {traits}
Motivations: {motivations}
Secrets (known to the NPC, not easily revealed): {secrets}
Example Quote: "{exampleQuote}"
Faction: {factionName}
Backstory: {backstory}
```

### Optimization: Structured Output via Tool

Instead of rule 7 ("Return JSON with..."), use Claude's tool_use:

```
tools: [{
  name: "npc_response",
  description: "Respond as the NPC",
  input_schema: {
    type: "object",
    properties: {
      dialogue: { type: "string", description: "In-character dialogue (2-4 sentences)" },
      moodCue: { type: "string", description: "Physical action or emotional subtext" }
    },
    required: ["dialogue", "moodCue"]
  }
}]
```

This eliminates the "return JSON" instruction from the roleplay prompt, keeping the character voice cleaner.

---

## Migration Notes

### RealmChat
- **Biggest change**: Schema approach → tool_use approach
- **System prompt caching**: Split static behavioral rules from dynamic state
- **Conversation history**: Gemini uses `{role: 'user'|'model', parts: [{text}]}` → Claude uses `{role: 'user'|'assistant', content: string}`
- **Draft management**: The client-side draft merge logic stays the same

### NPC Roleplay
- **Clean migration**: System instruction is the NPC context + rules; user messages are the conversation
- **Structured output**: Schema → tool_use (cleaner separation of concerns)
- **Model**: Good fit for Sonnet (needs personality but not extreme reasoning)
