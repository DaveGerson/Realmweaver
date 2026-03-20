# Google Gemini AI SDK Patterns (@google/genai)

Realmweaver uses `@google/genai` version 1.25.0 for all AI interactions.

---

## SDK Initialization

```typescript
import { GoogleGenAI } from "@google/genai";

// Lazy initialization pattern (services/ai/core.ts)
let ai: GoogleGenAI | null = null;
const getAI = () => {
    if (!ai) {
        const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
        ai = new GoogleGenAI({ apiKey });
    }
    return ai;
};
```

API key is injected via Vite's `define` config in `vite.config.ts` as both
`process.env.API_KEY` and `process.env.GEMINI_API_KEY`.

## Core API Methods

### generateContent (primary method)

```typescript
const response = await ai.models.generateContent({
    model: modelName,        // 'gemini-2.5-flash' or 'gemini-2.5-pro'
    contents: contents,       // string or structured content array
    config: {
        responseMimeType: "application/json",
        responseSchema: schema,  // JSON schema for structured output
        thinkingConfig: { thinkingBudget: 24576 },
        systemInstruction: "...",  // for chat completions
        tools: [{ googleSearch: {} }],  // for grounded search
    },
});
const text = response.text;
```

## Three Core Functions (services/ai/core.ts)

### 1. generateWithSchema

Structured JSON output. Primary method for entity generation.

| Parameter | Type | Notes |
|-----------|------|-------|
| prompt | string | User's generation prompt |
| schema | object | JSON schema using @google/genai Type constants |
| instructions | string | System prompt ("The Prep Architect") |
| configOverrides | object | Optional: tools for grounded search, contents for multimodal |
| modelName | string | 'gemini-2.5-flash' or 'gemini-2.5-pro' |
| campaignContext? | string | Existing campaign data for consistency |

Key behaviors:
- Sets `responseMimeType: "application/json"` + `responseSchema` for structured output
- Thinking budget: Flash 24K, Pro 32K tokens
- If `tools` in config (grounded search): disables schema mode, instructs JSON via prompt
- If `contents` in config (multimodal): uses pre-constructed content with injected instructions
- Parses response as JSON, handles markdown wrapper cleanup

### 2. generateText

Unstructured text output. Used for narration, improvisation, enhanced text.

| Parameter | Type | Notes |
|-----------|------|-------|
| fullPrompt | string | Complete prompt including instructions |
| modelName | string | Model to use |
| campaignContext? | string | Campaign context for consistency |

### 3. generateChatCompletion

Multi-turn conversation. Used for RealmChat and document chat.

| Parameter | Type | Notes |
|-----------|------|-------|
| history | {role, parts}[] | Conversation history |
| systemInstruction | string | System prompt for the conversation |
| modelName | string | Model to use |
| campaignContext? | string | Injected into first user message |

## Schema Definition Pattern

Schemas use `@google/genai` Type enum constants:

```typescript
import { Type } from "@google/genai";

const schema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: "..." },
        level: { type: Type.INTEGER, description: "..." },
        items: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "..."
        },
        rarity: {
            type: Type.STRING,
            enum: ['common', 'uncommon', 'rare'],
            description: "..."
        },
    },
    required: ['name', 'level'],
};
```

Available Type constants: `Type.STRING`, `Type.INTEGER`, `Type.OBJECT`,
`Type.ARRAY`, `Type.BOOLEAN`, `Type.NUMBER`

## Campaign Context Injection

All three core functions inject campaign context the same way:

```typescript
const contextInstruction = campaignContext
    ? `Reference the following existing campaign information:\n<campaign_context>\n${campaignContext}\n</campaign_context>\n\n`
    : '';
```

## Grounded Search

Only used for NPC generation. When enabled:
1. `configOverrides = { tools: [{googleSearch: {}}] }`
2. Schema mode is DISABLED (Gemini API limitation: tools + schema are incompatible)
3. JSON format is enforced via prompt instruction instead
4. Used for well-known D&D characters where official lore improves accuracy

## Error Handling

- JSON parse failure: logs raw response, throws "invalid response" error
- API key missing: throws descriptive error suggesting Mock Mode
- Markdown wrapping: cleaned with regex before JSON.parse

## Model Configuration

| Model | ID | Thinking Budget | Use |
|-------|----|-----------------|----|
| Flash | `gemini-2.5-flash` | 24,576 tokens | Default for all generation |
| Pro | `gemini-2.5-pro` | 32,768 tokens | Optional high-quality mode |
