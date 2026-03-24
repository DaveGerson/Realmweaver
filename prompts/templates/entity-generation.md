# Template: Entity Generation (Class A)

> Consolidates P1.1-P1.8: NPC, Location, Faction, Item, Scene, Adventure, Article, PointOfInterest

## Current State: 8 Separate Functions

Each function in `realmWeaver.ts` repeats:
1. The "Prep Architect" persona line
2. The "generate a detailed, ready-to-run {type}" task line
3. Per-field markdown instructions
4. The `generateWithSchema(prompt, schema, instructions, overrides, model, context)` call

The ONLY things that vary between them:
- The persona variant ("assistant" vs "adventure designer" vs "loremaster")
- The entity type name
- The field instruction list
- The schema
- Post-processing (adding UUIDs to nested arrays)

## Proposed Consolidated Template

### System Instruction Template

```
You are The Prep Architect, an expert TTRPG {{personaVariant}}.
Your task is to generate a detailed, ready-to-run {{entityLabel}} based on the user's prompt,
conforming to the specified JSON schema.

{{fieldInstructions}}
```

### Parameterized Config (one per entity type)

```typescript
interface EntityGenerationConfig {
  entityType: string;           // 'npc', 'location', etc.
  entityLabel: string;          // 'NPC dossier', 'location', 'faction', etc.
  personaVariant: string;       // 'assistant', 'adventure designer', 'loremaster'
  schema: object;               // The JSON Schema definition
  fieldInstructions: string;    // Markdown field descriptions
  postProcess?: (data: any) => any;  // Optional post-processing (add UUIDs, etc.)
  supportsGroundedSearch?: boolean;
}
```

### Example: NPC Config

```typescript
const npcConfig: EntityGenerationConfig = {
  entityType: 'npc',
  entityLabel: 'NPC dossier',
  personaVariant: 'assistant',
  schema: npcSchema,
  fieldInstructions: `
- **name:** The NPC's full name, title, or alias.
- **description:** A brief but evocative physical description. Focus on details that are immediately noticeable.
- **traits:** Actionable roleplaying notes. How does the GM portray them? What are their mannerisms or speech patterns?
- **exampleQuote:** A single line of dialogue that perfectly captures their personality.
- **backstory:** A concise summary of their history and their role in the story.
- **motivations:** What does this character want, and what are they actively doing to achieve it?
- **secrets:** A crucial piece of hidden information, a plot twist, or a vulnerability. This is for the GM's eyes only.
- **stats:** A TTRPG-agnostic suggestion for their capabilities.`,
  postProcess: (data) => ({ ...data, knowsPlayerHistory: [], relationships: [], history: [] }),
  supportsGroundedSearch: true,
};
```

### Unified Generator Function

```typescript
export async function generateEntity(
  config: EntityGenerationConfig,
  prompt: string,
  options: { useGroundedSearch?: boolean; model?: string } = {},
  campaignContext?: string
): Promise<any> {
  const model = options.model || 'default-standard'; // Maps to model tier

  const instructions = `You are The Prep Architect, an expert TTRPG ${config.personaVariant}. Your task is to generate a detailed, ready-to-run ${config.entityLabel} based on the user's prompt, conforming to the specified JSON schema.\n\n${config.fieldInstructions}`;

  const configOverrides = options.useGroundedSearch
    ? { tools: [{ /* web search tool */ }] }
    : {};

  const data = await generateWithSchema(
    prompt, config.schema, instructions, configOverrides, model, campaignContext
  );

  return config.postProcess ? config.postProcess(data) : data;
}
```

## Entity Config Registry

All configs in one place for easy review and editing:

```typescript
export const entityConfigs: Record<string, EntityGenerationConfig> = {
  npc: npcConfig,
  location: locationConfig,
  faction: factionConfig,
  item: itemConfig,
  scene: sceneConfig,
  adventure: adventureConfig,
  article: articleConfig,
  pointOfInterest: poiConfig,
};
```

## Migration Notes

### What changes for Claude:
1. **Schema format**: `Type.STRING` → `{ type: "string" }` (JSON Schema)
2. **Structured output**: `responseMimeType: "application/json"` → Claude's `tool_use` with JSON Schema
3. **Model name**: `gemini-2.5-flash` → model tier enum
4. **Grounded search**: Google Search tool → MCP web search or dropped
5. **Thinking config**: Gemini thinking budget → Claude extended thinking budget

### What stays the same:
- The prompt text itself (personas, field instructions) is model-agnostic
- The field instruction quality is good — no changes needed
- Post-processing logic is SDK-agnostic
- Campaign context injection is just string prepending

## Savings

- **Lines eliminated**: ~130 lines of duplicated persona/instruction text
- **Functions eliminated**: 7 individual generators → 1 parameterized function + 8 config objects
- **Maintenance**: Edit field instructions in one place per entity type
