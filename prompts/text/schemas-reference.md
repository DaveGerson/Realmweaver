# Schema Reference — All Structured Output Definitions

> Source: `realmWeaver.ts`, `dmCoach.ts`, `evocationWizard.ts`, `realmChat.ts`
> Format: Currently Gemini `Type.*` — must convert to JSON Schema for Claude

---

## Entity Schemas

### npcSchema (realmWeaver.ts:7-20)
```json
{
  "type": "object",
  "properties": {
    "name":         { "type": "string", "description": "The NPC's full name, title, or alias." },
    "description":  { "type": "string", "description": "A detailed physical description including typical attire." },
    "traits":       { "type": "string", "description": "2-3 distinct, actionable personality traits or mannerisms." },
    "exampleQuote": { "type": "string", "description": "A single characteristic line of dialogue." },
    "backstory":    { "type": "string", "description": "A concise but compelling backstory." },
    "motivations":  { "type": "string", "description": "Primary goals, desires, and motivations." },
    "secrets":      { "type": "string", "description": "A key secret or hidden information." },
    "stats":        { "type": "string", "description": "Brief TTRPG-agnostic capabilities summary." }
  },
  "required": ["name", "description", "traits", "exampleQuote", "backstory", "motivations", "secrets", "stats"]
}
```

### locationSchema (realmWeaver.ts:22-30)
```json
{
  "type": "object",
  "properties": {
    "name":        { "type": "string" },
    "description": { "type": "string", "description": "Vivid description with sights, sounds, smells." },
    "secrets":     { "type": "string", "description": "Hidden details discoverable through investigation." }
  },
  "required": ["name", "description", "secrets"]
}
```

### factionSchema (realmWeaver.ts:32-43)
```json
{
  "type": "object",
  "properties": {
    "name":        { "type": "string" },
    "description": { "type": "string", "description": "Purpose, public image, typical members." },
    "goals":       { "type": "string", "description": "Short-term and long-term objectives." },
    "alignment":   { "type": "string", "description": "Moral/ethical alignment." },
    "resources":   { "type": "string", "description": "Assets, wealth, tools at disposal." },
    "influence":   { "type": "string", "description": "Where and how they exert power." }
  },
  "required": ["name", "description", "goals", "alignment", "resources", "influence"]
}
```

### itemSchema (realmWeaver.ts:45-54)
```json
{
  "type": "object",
  "properties": {
    "name":        { "type": "string" },
    "description": { "type": "string", "description": "Appearance and history." },
    "rarity":      { "type": "string", "enum": ["common", "uncommon", "rare", "very rare", "legendary", "artifact"] },
    "properties":  { "type": "string", "description": "Mechanical abilities and usage rules." }
  },
  "required": ["name", "description", "rarity", "properties"]
}
```

### skillCheckSchema (realmWeaver.ts:56-64)
```json
{
  "type": "object",
  "properties": {
    "skill":       { "type": "string", "description": "e.g., 'Perception', 'Athletics'" },
    "dc":          { "type": "integer", "description": "Difficulty Class" },
    "description": { "type": "string", "description": "What the check is for." }
  },
  "required": ["skill", "dc", "description"]
}
```

### sceneSchema (realmWeaver.ts:66-81)
```json
{
  "type": "object",
  "properties": {
    "title":        { "type": "string" },
    "type":         { "type": "string", "enum": ["combat", "social", "exploration", "puzzle"] },
    "readAloudText": { "type": "string", "description": "Evocative box text for players." },
    "gmNotes":      { "type": "string", "description": "GM-only goals, motivations, outcomes." },
    "skillChecks":  { "type": "array", "items": { "$ref": "#/skillCheckSchema" }, "description": "1-3 skill checks" },
    "rewards":      { "type": "string", "description": "Treasure, items, XP." }
  },
  "required": ["title", "type", "readAloudText", "gmNotes", "skillChecks", "rewards"]
}
```

### adventureWithScenesSchema (realmWeaver.ts:83-97)
```json
{
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "level": { "type": "integer", "description": "Suggested starting character level." },
    "hook":  { "type": "string", "description": "1-2 sentence plot hook." },
    "theme": { "type": "string", "description": "Theme keywords." },
    "scenes": { "type": "array", "items": { "$ref": "#/sceneSchema" }, "description": "2-3 scenes" }
  },
  "required": ["title", "level", "hook", "theme", "scenes"]
}
```

### articleSchema (realmWeaver.ts:99-107)
```json
{
  "type": "object",
  "properties": {
    "title":    { "type": "string" },
    "category": { "type": "string", "enum": ["lore", "history", "cosmology"] },
    "content":  { "type": "string", "description": "Engaging encyclopedic content." }
  },
  "required": ["title", "category", "content"]
}
```

### pointOfInterestSchema (realmWeaver.ts:118-136)
```json
{
  "type": "object",
  "properties": {
    "name":                { "type": "string" },
    "passivePerceptionDC": { "type": "integer" },
    "description":         { "type": "string" },
    "investigationChecks": { "type": "array", "items": { "$ref": "#/poiInteractionSchema" } },
    "interactions":        { "type": "array", "items": { "$ref": "#/poiInteractionSchema" } }
  },
  "required": ["name", "passivePerceptionDC", "description", "investigationChecks", "interactions"]
}
```

### poiInteractionSchema (realmWeaver.ts:109-116)
```json
{
  "type": "object",
  "properties": {
    "description": { "type": "string", "description": "Condition/trigger/skill check." },
    "outcome":     { "type": "string", "description": "Result if condition met." }
  },
  "required": ["description", "outcome"]
}
```

---

## Analysis Schemas

### rollableTableSchema (dmCoach.ts:8-26)
```json
{
  "type": "object",
  "properties": {
    "title":   { "type": "string" },
    "dieType": { "type": "string", "description": "e.g., 'd6', 'd10', 'd20'" },
    "entries": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "range":  { "type": "string", "description": "e.g., '1', '2-3'" },
          "result": { "type": "string" }
        },
        "required": ["range", "result"]
      }
    }
  },
  "required": ["title", "dieType", "entries"]
}
```

### sessionAnalysisSchema (dmCoach.ts:28-48)
```json
{
  "type": "object",
  "properties": {
    "entries": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "content":            { "type": "string", "description": "Single-sentence event summary." },
          "relatedEntityNames": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["content", "relatedEntityNames"]
      }
    }
  },
  "required": ["entries"]
}
```

### sessionRecapSchema (dmCoach.ts:50-62)
```json
{
  "type": "object",
  "properties": {
    "recap":             { "type": "string", "description": "Narrative recap, 3-5 paragraphs." },
    "looseEnds":         { "type": "array", "items": { "type": "string" } },
    "playerFacingRecap": { "type": "string", "description": "Player-safe, spoiler-free version." }
  },
  "required": ["recap", "looseEnds", "playerFacingRecap"]
}
```

---

## Chat Schemas

### realmChatResponseSchema (realmChat.ts:24-40)
```json
{
  "type": "object",
  "properties": {
    "message":     { "type": "string", "description": "Conversational response." },
    "suggestions": { "type": "array", "items": { "type": "string" }, "description": "3 quick-reply options." },
    "draftEntities": {
      "type": "array",
      "items": { "$ref": "#/draftEntitySchema" }
    }
  },
  "required": ["message", "suggestions", "draftEntities"]
}
```

### draftEntitySchema (realmChat.ts:8-22)
```json
{
  "type": "object",
  "properties": {
    "id":            { "type": "string", "description": "Persistent session ID." },
    "type":          { "type": "string", "enum": ["npc", "location", "faction", "item", "adventure", "article"] },
    "status":        { "type": "string", "enum": ["draft"] },
    "npcData":       { "$ref": "#/npcSchema" },
    "locationData":  { "$ref": "#/locationSchema" },
    "factionData":   { "$ref": "#/factionSchema" },
    "itemData":      { "$ref": "#/itemSchema" },
    "adventureData": { "$ref": "#/adventureWithScenesSchema" },
    "articleData":   { "$ref": "#/articleSchema" }
  },
  "required": ["id", "type", "status"]
}
```

### npcRoleplayResponseSchema (realmChat.ts:143-156)
```json
{
  "type": "object",
  "properties": {
    "dialogue": { "type": "string", "description": "In-character response, 2-4 sentences." },
    "moodCue":  { "type": "string", "description": "Physical action or emotional state description." }
  },
  "required": ["dialogue", "moodCue"]
}
```

---

## Parsing Schema

### playerCharacterSchema (evocationWizard.ts:9-83)
Deeply nested — see source file for full definition. Key structure:
```json
{
  "type": "object",
  "properties": {
    "playerName": { "type": "string" },
    "characterSocial": {
      "type": "object",
      "properties": {
        "characterName", "background", "species", "personality",
        "appearance", "backstory", "ideals", "bonds", "flaws"
      }
    },
    "characterStatistics": {
      "type": "object",
      "properties": {
        "classes": { "charClass", "subclass", "level" },
        "attributes": { "strength..charisma" (6 integers) },
        "skills": { "acrobatics..survival" (18 enum fields) },
        "actions": ["string"],
        "specialActions": ["string"]
      }
    }
  },
  "required": ["playerName", "characterSocial", "characterStatistics"]
}
```

### campaignFillSchema (evocationWizard.ts:85-94)
```json
{
  "type": "object",
  "properties": {
    "npcs":       { "type": "array", "items": { "$ref": "#/npcSchema" } },
    "locations":  { "type": "array", "items": { "$ref": "#/locationSchema" } },
    "factions":   { "type": "array", "items": { "$ref": "#/factionSchema" } },
    "adventures": { "type": "array", "items": { "$ref": "#/adventureWithScenesSchema" } },
    "items":      { "type": "array", "items": { "$ref": "#/itemSchema" } }
  }
}
```
Note: `required` fields are set dynamically based on which entity types the user selects.

---

## Migration: Gemini Type.* → JSON Schema

The conversion is mechanical:

| Gemini | JSON Schema |
|--------|-------------|
| `Type.STRING` | `{ "type": "string" }` |
| `Type.INTEGER` | `{ "type": "integer" }` |
| `Type.OBJECT` | `{ "type": "object" }` |
| `Type.ARRAY` | `{ "type": "array" }` |
| `enum: [...]` | `{ "enum": [...] }` |
| `items: schema` | `{ "items": schema }` |
| `properties: {}` | `{ "properties": {} }` |
| `required: []` | `{ "required": [] }` |

The JSON Schema versions in this document are already valid for Claude's tool_use `input_schema`.
