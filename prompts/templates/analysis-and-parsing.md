# Template: Analysis & Parsing (Classes C and E)

> Covers the unique prompts that don't fit the repeated patterns:
> - C: Session Recap, Session Notes Analysis, Rollable Table
> - E: Document Entity Parser, PDF Character Sheet Parser

## Class C: Schema-Bound Analysis

These take unstructured text input and produce structured output. Each has a unique schema so consolidation is limited, but they share the same architectural pattern.

### P2.3: Rollable Table Generator

**File**: `dmCoach.ts:93-97`
```
You are a creative Dungeon Master. Based on the campaign context and the user's prompt,
generate a custom rollable table for a tabletop RPG. The table should be thematic and
provide interesting, varied outcomes. The roll ranges should be contiguous and cover
the full range of a standard die (like d4, d6, d8, d10, d12, or d20).
```

**Schema**: `{ title, dieType, entries[{ range, result }] }`
**Model**: Standard (with lite option)
**Migration note**: Clean schema → tool_use conversion. No special handling needed.

### P2.5: Session Recap Generator

**File**: `dmCoach.ts:107-125`
```
You are an expert Game Master's assistant. Your task is to generate a structured
session recap from the DM's running notes.

You will produce three things:
1. **recap**: Narrative recap (3-5 paragraphs). Past tense, third person. Engaging, dramatic.
2. **looseEnds**: Unresolved plot threads, unanswered questions, dangling hooks.
3. **playerFacingRecap**: Shorter, player-safe version. Strip GM secrets.

Active plot threads for context:
{plotSummaries}
```

**User prompt**: `Here are the session notes to recap:\n\n{sessionNotes}`
**Schema**: `{ recap, looseEnds[], playerFacingRecap }`
**Model**: Standard
**Migration note**: Good candidate for extended thinking — session recap benefits from reasoning about what to include/exclude from the player-facing version.

### P2.6: Session Notes Analyzer

**File**: `dmCoach.ts:127-139`
```
You are an expert Game Master's assistant. Your task is to process raw session
notes into structured log entries.

1. Break the notes down into distinct events.
2. Summarize each event clearly and concisely.
3. Identify if any of the following known entities are mentioned in the event:
{JSON.stringify(knownEntityNames)}

Only list entities from the provided list in the 'relatedEntityNames' field.
```

**Schema**: `{ entries[{ content, relatedEntityNames[] }] }`
**Model**: Standard
**Migration note**: The entity name matching part could be partially replaced by a tool call. Instead of stuffing all entity names into the prompt, provide a "lookup_entity" tool that the AI can call to verify entity matches. This would scale better for large campaigns.

---

## Class E: Document/Multimodal Parsing

### P3.2: Document Entity Parser

**File**: `evocationWizard.ts:150-156`
```
You are an expert TTRPG assistant. Your task is to parse the following document
and extract all recognizable TTRPG entities (NPCs, Locations, Factions, Items,
Adventures). Structure the extracted information into a valid JSON object that
conforms to the provided schema. Infer relationships between entities where
possible. For adventures, synthesize a cohesive adventure structure from the
notes, creating scenes from logical sections of the text.
```

**Schema**: Full `campaignFillSchema` (npcs[], locations[], factions[], adventures[], items[])
**Model**: `gemini-2.5-pro` (high quality needed for complex extraction)
**Migration note**: This is the most token-intensive operation. With Claude:
- Use Opus for best extraction quality
- The document content itself is the user message
- The extraction instructions + schema go in the system prompt
- Consider chunking very large documents

### P3.3: Character Sheet PDF Parser

**File**: `evocationWizard.ts:158-180`
```
You are an expert D&D 5e data entry assistant. Your task is to parse the
provided D&D Beyond character sheet PDF and extract all character information
into a structured JSON object.
- For ability scores, use the large number, not the small modifier.
- For skills, if a skill's bubble is filled in, it is 'proficient'. [...]
- Extract class and level from the top of the sheet.
- Extract personality traits, ideals, bonds, and flaws.
- Summarize the character's backstory.
- For actions, list weapon attack names.
- For special actions, list features and traits names.
```

**Schema**: `playerCharacterSchema` (deeply nested)
**Model**: `gemini-2.5-flash`
**Input**: Multimodal (PDF base64 + text)
**Migration note**:
- Claude supports PDF input natively via base64 content blocks
- The D&D-specific extraction rules are well-written and model-agnostic
- Consider whether this could be replaced by a dedicated PDF parsing library for D&D Beyond sheets (more reliable, no AI cost). The layout is standardized enough for template-based extraction.

---

## Shared Pattern: Schema-Bound Analysis

All Class C and E prompts follow this pattern:

```typescript
interface AnalysisConfig {
  id: string;
  persona: string;
  instructions: string;
  schema: object;
  model: ModelTier;
  // For prompts that need additional context injected into instructions
  dynamicInstructionBuilder?: (context: any) => string;
}
```

The key difference from entity generation (Class A) is:
- **Input is data to analyze**, not a creative prompt
- **Output schema is unique** per analysis type (not shared entity schemas)
- **No persona consistency needed** across different analyses

These don't consolidate well with each other, but they do share the same migration mechanics.

---

## Migration Priority

| Prompt | Migration Complexity | Value of Migration |
|--------|---------------------|-------------------|
| Rollable Table | LOW (simple schema) | LOW (infrequent use) |
| Session Recap | LOW (simple schema) | MEDIUM (high value feature) |
| Session Notes Analysis | MEDIUM (entity matching) | MEDIUM (could use tool calls) |
| Document Parser | MEDIUM (large input) | HIGH (Opus quality) |
| PDF Parser | HIGH (multimodal) | MEDIUM (could replace with library) |
