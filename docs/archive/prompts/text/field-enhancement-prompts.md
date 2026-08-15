# Field Enhancement Prompts — Raw Prompt Text

> Sources: Editor components + `RegenerateButton.tsx` + `dmCoach.ts:99-105`
> Pattern Class: F (CRUD/Form Enhancement)
> **Most repeated pattern in the codebase**

---

## The Underlying Service Prompt (dmCoach.ts:101-103)

Every field enhancement call eventually hits this:

```
You are a creative assistant for a Dungeon Master. Based on the provided context, generate a short, creative piece of text (2-4 sentences) for the requested field. Be concise and evocative.

Request: "{prompt}"
```

Model: `gemini-flash-lite-latest` (always cheapest)

---

## Pattern 1: Inline Editor Enhancement

### Prompt Template (identical across all editors):
```
Based on the following {EntityType} info, generate a compelling "{fieldName}":

{entityContext}
```

### Entity Context Construction (varies per editor):

**NPC** (NpcEditor.tsx:81):
```
NPC Name: {formData.name}
Description: {formData.description || 'Not specified'}
Traits: {formData.traits || 'Not specified'}
```

**Location** (LocationEditor.tsx:87):
```
Location Name: {formData.name}
Description: {formData.description || 'Not specified'}
Secrets: {formData.secrets || 'Not specified'}
```

**Faction** (similar pattern):
```
Faction Name: {formData.name}
Description: {formData.description || 'Not specified'}
Goals: {formData.goals || 'Not specified'}
```

**Item** (similar pattern):
```
Item Name: {formData.name}
Description: {formData.description || 'Not specified'}
Rarity: {formData.rarity || 'Not specified'}
```

---

## Pattern 2: RegenerateButton Enhancement

### Prompt Template (RegenerateButton.tsx:94-97):
```
Regenerate the "{fieldName}" for this {entityType}.

Current value: {currentValue}

Context:
{entityContext}{tweakPart}

Provide only the regenerated text for the "{fieldName}" field, no labels or preamble.
```

Where `tweakPart` is either empty or:
```
 Additional instruction: {tweakInstruction}.
```

---

## Combined Service Call Chain

Both patterns call:
```
generateEnhancedText(prompt, campaignContext?, isMockMode)
  → dmCoach.generateEnhancedText(prompt, campaignContext)
    → core.generateText(fullPrompt, 'gemini-flash-lite-latest', campaignContext)
```

The full prompt sent to the API is:
```
You are a creative assistant for a Dungeon Master. Based on the provided context, generate a short, creative piece of text (2-4 sentences) for the requested field. Be concise and evocative.

Request: "Based on the following NPC info, generate a compelling "backstory":

NPC Name: Theron Vex
Description: A gaunt, pale-skinned elf with a nervous tick
Traits: Paranoid, secretive, fiddles with a strange coin"
```

Note: The prompt nests inside the persona prompt. The `Request:` wrapper is redundant — the inner prompt is already a complete instruction.

---

## Inconsistencies to Fix

| Issue | Pattern 1 (Inline) | Pattern 2 (RegenerateButton) |
|-------|-------------------|---------------------------|
| Campaign context passed? | NO (`undefined`) | YES |
| Preview before apply? | NO (immediate) | YES (accept/reject) |
| Tweak instruction? | NO | YES |
| "No preamble" instruction? | NO | YES |
| Current value included? | NO | YES |

Pattern 2 is strictly better. Pattern 1 should be removed.

---

## Editors Using Each Pattern

| Editor | Inline (Pattern 1) | RegenerateButton (Pattern 2) | Fields |
|--------|-------------------|---------------------------|--------|
| NpcEditor | `handleAiGenerate` | Per-field sparkle buttons | description, traits, exampleQuote, backstory, motivations, secrets, stats |
| LocationEditor | `handleAiGenerate` | Per-field sparkle buttons | description, secrets |
| FactionEditor | `handleAiGenerate` | Per-field sparkle buttons | description, goals, resources, influence |
| ItemEditor | `handleAiGenerate` | Per-field sparkle buttons | description, properties |
| SceneEditor | `handleAiGenerate` | Per-field sparkle buttons | readAloudText, gmNotes, rewards |
| ArticleEditor | `handleAiGenerate` | Per-field sparkle buttons | content |
| PlotEditor | `handleAiGenerate` | Per-field sparkle buttons | description |
| NoteEditor | `handleAiGenerate` | Per-field sparkle buttons | content |
