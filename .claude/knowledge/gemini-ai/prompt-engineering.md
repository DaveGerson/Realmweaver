# Prompt Engineering Patterns in Realmweaver

How the project constructs prompts for structured entity output.

---

## The Prep Architect Persona

All entity generation uses a consistent persona:

```
You are The Prep Architect, an expert TTRPG assistant. Your task is to
generate a detailed, ready-to-run [entity type] based on the user's prompt,
conforming to the specified JSON schema.
```

This persona is defined per-function in `services/ai/realmWeaver.ts` as the
`instructions` parameter passed to `generateWithSchema`.

## Instruction Pattern

Each generator function defines field-specific instructions:

```typescript
const instructions = `You are The Prep Architect...

- **name:** [what this field should contain]
- **description:** [guidance for this field]
- **traits:** [specific format requirements]
...`;
```

These instructions serve as a system prompt that guides the model to
produce high-quality content for each field independently.

## Key Instruction Principles

### Be Specific About Format
Bad: "A description of the NPC"
Good: "A brief but evocative physical description. Focus on details that
are immediately noticeable."

### Emphasize Actionability
NPCs: "Actionable roleplaying notes. How does the GM portray them?"
Scenes: "Explicitly defined skill checks with a skill, a DC, and a clear
description of what success and failure mean."

### GM-Oriented Content
Everything generated should be ready to use at the game table:
- Read-aloud text is written to be read aloud
- GM notes are structured for quick reference during play
- Stats reference existing stat blocks rather than inventing numbers

### Distinguish Player-Facing vs GM-Facing
- `readAloudText` -- for players to hear
- `gmNotes`, `secrets` -- GM-only information
- This distinction is critical for the product's value

## Campaign Context Pattern

Campaign context is injected into every AI call to maintain world consistency:

```typescript
const campaignContext = `
Setting: ${campaign.setting}
Existing NPCs: ${campaign.npcs.map(n => n.name).join(', ')}
Existing Locations: ${campaign.locations.map(l => l.name).join(', ')}
Existing Factions: ${campaign.factions.map(f => f.name).join(', ')}
`;
```

This is wrapped by core.ts:
```
Reference the following existing campaign information for context and consistency:
<campaign_context>
[the context string]
</campaign_context>
```

Benefits:
- Names stay consistent with the world
- New entities can reference existing ones
- Setting tone and style are maintained
- Prevents contradictions with established lore

## Schema-Driven Output

### How It Works
1. Define a JSON schema using `@google/genai` Type constants
2. Pass to `generateWithSchema` which sets `responseMimeType: "application/json"`
   and `responseSchema: schema`
3. Gemini returns structured JSON matching the schema
4. `core.ts` parses the JSON and returns the typed object

### Schema Design Rules
- Every field gets a `description` -- this is effectively a per-field prompt
- Use `required` array to ensure critical fields are always populated
- Use `enum` for constrained values (rarity, scene type, article category)
- Nested schemas (scenes within adventures) use `Type.ARRAY` with `items`

### When Schema Mode Is Disabled
Grounded search (Google Search tool) is incompatible with schema mode.
When tools are enabled:
1. Schema and MIME type are removed from config
2. The schema is serialized to a JSON string and included in the prompt
3. Model is instructed to return raw JSON (no markdown wrapping)
4. Response is parsed with markdown cleanup fallback

## DM Coach Prompts

DM Coach functions use a different pattern -- some return unstructured text:

```typescript
// Narration: pure text generation
const prompt = `Generate evocative narration text for: ${userPrompt}`;
return generateText(prompt, modelName, campaignContext);

// Rollable table: structured output
return generateWithSchema(prompt, rollableTableSchema, instructions, {}, modelName);
```

## RealmChat Prompts

Multi-turn conversation with entity drafting:
- Uses `generateChatCompletion` with conversation history
- System instruction defines the RealmChat persona and capabilities
- Current draft entities and approved entity log are included in context
- Model can create/update draft entities in its response
- Suggestions for next user action are returned alongside the message

## Common Prompt Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | Better Approach |
|-------------|-------------|----------------|
| "Create an interesting NPC" | Too vague, inconsistent results | Include campaign context + specific instructions per field |
| Inventing stat numbers | Players will argue about balance | Reference existing stat blocks ("Use Knight stat block") |
| Generic descriptions | Not useful at the table | Focus on sensory details and actionable traits |
| Ignoring campaign context | Creates contradictions | Always pass campaignContext parameter |
| Long prompt instructions | Token waste, model confusion | Keep instructions focused and field-specific |
