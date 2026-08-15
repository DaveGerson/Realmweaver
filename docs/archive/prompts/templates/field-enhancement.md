# Template: Field Enhancement / CRUD (Class F)

> Consolidates P5.1 (Inline Field Generation) and P5.2 (RegenerateButton)
> **Highest migration impact** — used across EVERY entity editor

## Current State: Two Competing Patterns

### Pattern 1: Inline `handleAiGenerate` (in each editor)

Found in: `NpcEditor.tsx:79-94`, `LocationEditor.tsx:82-93`, and equivalent in all editors.

```typescript
// NpcEditor example
const handleAiGenerate = async (field) => {
  const npcContext = `NPC Name: ${formData.name}\nDescription: ${formData.description || 'Not specified'}\nTraits: ${formData.traits || 'Not specified'}`;
  const prompt = `Based on the following NPC info, generate a compelling "${field}":\n\n${npcContext}`;
  const result = await generateEnhancedText(prompt, undefined, isMockMode);
  //                                                 ^^^^^^^^^ campaignContext NOT passed!
  setFormData(prev => ({ ...prev, [field]: result }));
  onUpdate(npc.id, { [field]: result });
};
```

**Problems**:
- Campaign context is NOT passed (second arg is `undefined`)
- Each editor constructs entity context differently
- No preview/accept workflow — result is applied immediately
- Duplicated across every editor component

### Pattern 2: `RegenerateButton` (reusable component)

Found in: `components/common/RegenerateButton.tsx:83-108`

```typescript
const prompt = `Regenerate the "${fieldName}" for this ${entityType}.\n\nCurrent value: ${currentValue}\n\nContext:\n${entityContext}${tweakPart}\n\nProvide only the regenerated text for the "${fieldName}" field, no labels or preamble.`;
const result = await generateEnhancedText(prompt, campaignContext, false);
//                                                ^^^^^^^^^^^^^^^^ campaignContext IS passed
```

**Advantages**:
- Reusable across all editors
- Passes campaign context
- Has preview/accept/reject workflow
- Supports optional tweak instruction
- Explicit "no labels or preamble" instruction

## Recommendation: Consolidate on RegenerateButton

Remove `handleAiGenerate` from all editors. The `RegenerateButton` is strictly better:
- It passes campaign context
- It has a preview workflow (safer)
- It's already a reusable component

### Migration Action Items

1. **Remove** `handleAiGenerate` from: NpcEditor, LocationEditor, FactionEditor, ItemEditor, SceneEditor, ArticleEditor, NoteEditor, PlotEditor
2. **Ensure** every editor field that currently has an AI sparkle button uses `RegenerateButton` instead
3. **Standardize** the entity context construction (see below)

## Proposed Unified Field Enhancement

### Context Builder Per Entity Type

Each entity type needs a standardized context string for field regeneration:

```typescript
interface EntityContextBuilder {
  entityType: string;
  buildContext: (entity: any, campaign?: Campaign) => string;
}

const entityContextBuilders: Record<string, EntityContextBuilder> = {
  npc: {
    entityType: 'NPC',
    buildContext: (npc, campaign) => {
      const faction = npc.factionId && campaign
        ? campaign.factions.find(f => f.id === npc.factionId)
        : undefined;
      return [
        `Name: ${npc.name}`,
        npc.description ? `Description: ${npc.description}` : '',
        npc.traits ? `Traits: ${npc.traits}` : '',
        npc.motivations ? `Motivations: ${npc.motivations}` : '',
        npc.backstory ? `Backstory: ${npc.backstory}` : '',
        faction ? `Faction: ${faction.name}` : '',
      ].filter(Boolean).join('\n');
    },
  },
  location: {
    entityType: 'Location',
    buildContext: (loc) => [
      `Name: ${loc.name}`,
      loc.description ? `Description: ${loc.description}` : '',
      loc.secrets ? `Secrets: ${loc.secrets}` : '',
    ].filter(Boolean).join('\n'),
  },
  faction: {
    entityType: 'Faction',
    buildContext: (faction) => [
      `Name: ${faction.name}`,
      faction.description ? `Description: ${faction.description}` : '',
      faction.goals ? `Goals: ${faction.goals}` : '',
      faction.alignment ? `Alignment: ${faction.alignment}` : '',
    ].filter(Boolean).join('\n'),
  },
  item: {
    entityType: 'Item',
    buildContext: (item) => [
      `Name: ${item.name}`,
      item.description ? `Description: ${item.description}` : '',
      item.rarity ? `Rarity: ${item.rarity}` : '',
      item.properties ? `Properties: ${item.properties}` : '',
    ].filter(Boolean).join('\n'),
  },
  // ... etc for Scene, Article, Plot, Note
};
```

### Prompt Template

The `RegenerateButton` prompt is already good. Formalized:

```
Regenerate the "{{fieldName}}" for this {{entityType}}.

Current value: {{currentValue}}

Context:
{{entityContext}}{{tweakInstruction}}

Provide only the regenerated text for the "{{fieldName}}" field, no labels or preamble.
```

### The Underlying Service Call

```typescript
// Current: generateEnhancedText wraps in persona prompt then calls generateText
// The persona prompt:
"You are a creative assistant for a Dungeon Master. Based on the provided context, generate a short, creative piece of text (2-4 sentences) for the requested field. Be concise and evocative."

// This is fine as-is. It's simple and effective.
```

## Migration Notes

### What changes for Claude:
1. **API call**: Simple text completion → Claude `messages.create`
2. **System prompt**: The persona text becomes the `system` parameter
3. **User prompt**: The field-specific prompt stays as the user message
4. **Model**: `gemini-flash-lite-latest` → Haiku (cheapest, fastest)

### What stays the same:
- Prompt text is model-agnostic
- `RegenerateButton` component UI stays identical
- Preview/accept/reject flow stays identical

### Opportunity: Tool-based approach
Instead of prompt-only regeneration, Claude's tool_use could make this more structured:
```typescript
// Define a "regenerate_field" tool
{
  name: "regenerate_field",
  description: "Regenerate a specific field for a TTRPG entity",
  input_schema: {
    type: "object",
    properties: {
      regenerated_text: { type: "string", description: "The new text for the field" }
    }
  }
}
```
This guarantees structured output without needing to parse freeform text.

## Inventory of Editors Using Field Enhancement

| Editor | Has `handleAiGenerate`? | Has `RegenerateButton`? | Fields Enhanced |
|--------|------------------------|------------------------|-----------------|
| NpcEditor | Yes (inline) | Yes | description, traits, exampleQuote, backstory, motivations, secrets, stats |
| LocationEditor | Yes (inline) | Yes | description, secrets |
| FactionEditor | Yes (inline) | Yes | description, goals, resources, influence |
| ItemEditor | Yes (inline) | Yes | description, properties |
| SceneEditor | Yes (inline) | Yes | readAloudText, gmNotes, rewards |
| ArticleEditor | Yes (inline) | Yes | content |
| NoteEditor | Likely | Likely | content |
| PlotEditor | Likely | Likely | description |
| SessionLogEditor | N/A (uses recap) | N/A | N/A |
| PlayerCharacterEditor | N/A (imported) | N/A | N/A |
