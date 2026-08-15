# Migration Map: Gemini → Claude

> Companion to `CATALOG.md`. Shows what changes, what stays, and the priority order.

---

## Summary

| Layer | Files | Migration Effort | Notes |
|-------|-------|-----------------|-------|
| **Core API wrapper** | `core.ts` (130 lines) | REWRITE | Replace `@google/genai` with `@anthropic-ai/sdk` |
| **Schema definitions** | All `ai/*.ts` (schemas) | MECHANICAL | `Type.STRING` → `{ type: "string" }` — 22 schemas across 5 files |
| **Prompt text** | All `ai/*.ts` (instructions) | NONE | Model-agnostic, keep as-is |
| **Service facade** | `geminiService.ts` | RENAME | Update imports, rename to `aiService.ts` |
| **Mock service** | `mockService.ts` | NONE | No AI calls |
| **Context builder** | `contextBuilder.ts` | NONE | Pure data, no SDK dependency |
| **Real-time audio** | `SessionLogEditor.tsx` | **REWRITE** | Direct Gemini Live API for microphone transcription — no Claude equivalent |
| **Components** | All generators, editors, dialogs | MINIMAL | Only import paths change |

**Bottom line**: 2 file rewrites (`core.ts` + `SessionLogEditor.tsx` audio), 1 mechanical conversion (22 schemas across 5 files), everything else is prompt text and UI code that doesn't change.

**Important discovery**: `SessionLogEditor.tsx` **bypasses the entire service layer** and directly imports `GoogleGenAI`, `LiveServerMessage`, and `Modality` from `@google/genai` for real-time audio streaming (microphone-to-notes). This uses `gemini-2.5-flash-native-audio-preview` via the Gemini Live API. Claude does not have an equivalent real-time audio streaming API — this feature would need to either:
1. Keep using Gemini for audio transcription only (hybrid approach)
2. Use a dedicated speech-to-text service (Whisper, Deepgram, etc.) and pipe text to Claude
3. Be removed/deferred

---

## core.ts Rewrite Plan

### Current: 3 Gemini SDK Functions

```typescript
// 1. Structured output (entities, analysis, chat)
generateWithSchema(prompt, schema, instructions, configOverrides, modelName, campaignContext)

// 2. Plain text (narration, improv, enhanced text)
generateText(fullPrompt, modelName, campaignContext)

// 3. Multi-turn chat (evocation chat)
generateChatCompletion(history, systemInstruction, modelName, campaignContext)
```

### Target: 3 Claude SDK Functions

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();  // Uses ANTHROPIC_API_KEY env var

// 1. Structured output via tool_use
async function generateWithSchema(
  prompt: string,
  schema: object,       // Now JSON Schema, not Gemini Type.*
  instructions: string,
  modelName: string,    // 'haiku', 'sonnet', 'opus'
  campaignContext?: string
) {
  const systemPrompt = campaignContext
    ? `${instructions}\n\nCampaign context:\n${campaignContext}`
    : instructions;

  const response = await anthropic.messages.create({
    model: mapModelName(modelName),
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
    tools: [{
      name: 'structured_output',
      description: 'Return the generated content as structured data',
      input_schema: schema as Anthropic.Tool.InputSchema,
    }],
    tool_choice: { type: 'tool', name: 'structured_output' },
  });

  const toolBlock = response.content.find(b => b.type === 'tool_use');
  return toolBlock?.input;
}

// 2. Plain text
async function generateText(
  fullPrompt: string,
  modelName: string,
  campaignContext?: string
) {
  const system = campaignContext
    ? `Campaign context:\n${campaignContext}`
    : undefined;

  const response = await anthropic.messages.create({
    model: mapModelName(modelName),
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: fullPrompt }],
  });

  return response.content[0].type === 'text' ? response.content[0].text : '';
}

// 3. Multi-turn chat
async function generateChatCompletion(
  history: Array<{ role: string; parts: Array<{ text: string }> }>,
  systemInstruction: string,
  modelName: string,
  campaignContext?: string
) {
  const system = campaignContext
    ? `${systemInstruction}\n\nCampaign context:\n${campaignContext}`
    : systemInstruction;

  const messages = history.map(h => ({
    role: h.role === 'model' ? 'assistant' as const : 'user' as const,
    content: h.parts.map(p => p.text).join('\n'),
  }));

  const response = await anthropic.messages.create({
    model: mapModelName(modelName),
    max_tokens: 2048,
    system,
    messages,
  });

  return response.content[0].type === 'text' ? response.content[0].text : '';
}
```

### Model Mapping

```typescript
function mapModelName(name: string): string {
  // Internal tier names → Claude model IDs
  const map: Record<string, string> = {
    'lite':     'claude-haiku-4-5-20251001',
    'standard': 'claude-sonnet-4-6',
    'quality':  'claude-opus-4-6',
    // Legacy Gemini names (for gradual migration)
    'gemini-flash-lite-latest': 'claude-haiku-4-5-20251001',
    'gemini-2.5-flash':         'claude-sonnet-4-6',
    'gemini-2.5-pro':           'claude-opus-4-6',
    'gemini-3-pro-preview':     'claude-opus-4-6',
  };
  return map[name] || 'claude-sonnet-4-6';
}
```

### Extended Thinking (Optional)

```typescript
// For complex tasks (document parsing, session recap)
if (useExtendedThinking) {
  response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    thinking: { type: 'enabled', budget_tokens: 10000 },
    // ... rest of params
  });
}
```

---

## Schema Conversion Checklist

Each schema needs `Type.*` → JSON Schema conversion. The work is mechanical:

- [ ] `npcSchema` (realmWeaver.ts:7-20)
- [ ] `locationSchema` (realmWeaver.ts:22-30)
- [ ] `factionSchema` (realmWeaver.ts:32-43)
- [ ] `itemSchema` (realmWeaver.ts:45-54)
- [ ] `skillCheckSchema` (realmWeaver.ts:56-64)
- [ ] `sceneSchema` (realmWeaver.ts:66-81)
- [ ] `adventureWithScenesSchema` (realmWeaver.ts:83-97)
- [ ] `articleSchema` (realmWeaver.ts:99-107)
- [ ] `poiInteractionSchema` (realmWeaver.ts:109-116)
- [ ] `pointOfInterestSchema` (realmWeaver.ts:118-136)
- [ ] `rollableTableSchema` (dmCoach.ts:8-26)
- [ ] `sessionAnalysisSchema` (dmCoach.ts:28-48)
- [ ] `sessionRecapSchema` (dmCoach.ts:50-62)
- [ ] `playerCharacterSchema` (evocationWizard.ts:9-83)
- [ ] `campaignFillSchema` (evocationWizard.ts:85-94)
- [ ] `draftEntitySchema` (realmChat.ts:8-22)
- [ ] `realmChatResponseSchema` (realmChat.ts:24-40)
- [ ] `npcRoleplayResponseSchema` (realmChat.ts:143-156)
- [ ] `worldEventSchema` (worldSimulation.ts:25-82)
- [ ] `worldEventsSchema` (worldSimulation.ts:84-94)
- [ ] `starterNpcsSchema` (evocationWizard.ts:193-202)
- [ ] `starterLocationsSchema` (evocationWizard.ts:204-213)

Total: 22 schemas. Remove `import { Type } from "@google/genai"` from 5 files.

---

## Reusable Pattern Migration Priority

### Priority 1: Field Enhancement (Class F) — HIGHEST IMPACT
- Used in every editor, every session
- Simplest to migrate (plain text in/out)
- Fix inconsistency: make all editors use `RegenerateButton` with campaign context
- Model: Haiku (fast, cheap)

### Priority 2: Entity Generation (Class A) — HIGHEST FREQUENCY
- 8 generators, core workflow
- Consolidate to single parameterized function first
- Structured output via `tool_use`
- Model: Sonnet

### Priority 3: DM Coach Tools (Classes B, C) — SESSION-CRITICAL
- Narration, Improv, Table — used during live play
- Low latency requirement → Haiku for lite, Sonnet for standard
- Table needs schema migration

### Priority 4: RealmChat (Class D) — COMPLEX BUT CONTAINED
- 2 complex conversational prompts
- Consider tool_use approach for entity drafting
- Biggest prompt engineering opportunity
- Model: User-selectable tier

### Priority 5: Parsing (Class E) — LEAST FREQUENT
- Document parser, PDF parser
- Used occasionally
- PDF parsing could potentially move to a library
- Model: Opus for document parsing

---

## Removed Gemini-Specific Features

| Feature | Current | Claude Equivalent |
|---------|---------|-------------------|
| Google Search grounding | `tools: [{googleSearch: {}}]` | MCP web search tool, or remove |
| `responseMimeType: "application/json"` | Forces JSON | `tool_use` with `tool_choice: { type: 'tool' }` |
| `responseSchema` | Gemini-native schema enforcement | Tool `input_schema` |
| `thinkingConfig: { thinkingBudget }` | Gemini thinking | Claude `thinking: { budget_tokens }` |
| `contents` with `inlineData` (PDF) | Multimodal input | Claude `content: [{ type: 'document', source: { type: 'base64' } }]` |
| `systemInstruction` (chat) | Gemini chat system prompt | Claude `system` parameter |

---

## Files to Change (Complete List)

| File | Change Type | Description |
|------|-----------|-------------|
| `services/ai/core.ts` | **REWRITE** | Replace Gemini SDK with Anthropic SDK |
| `services/ai/realmWeaver.ts` | Schema conversion | `Type.*` → JSON Schema objects |
| `services/ai/dmCoach.ts` | Schema conversion + model names | Same |
| `services/ai/evocationWizard.ts` | Schema conversion + model names + multimodal | PDF input format |
| `services/ai/realmChat.ts` | Schema conversion + model tier map | Update `mapTierToModel` |
| `services/ai/worldSimulation.ts` | Schema conversion + model name | NEW FILE — `Type.*` → JSON Schema |
| `services/ai/styleMatching.ts` | Model name only | NEW FILE — no schema (plain text) |
| `components/editors/SessionLogEditor.tsx` | **REWRITE** (partial) | Direct Gemini SDK use for real-time audio (Live API). Uses `GoogleGenAI`, `LiveServerMessage`, `Modality` for microphone note-taking. No Claude equivalent for real-time audio streaming — needs alternative approach. |
| `services/geminiService.ts` | Rename + cleanup | → `aiService.ts`, update imports |
| `package.json` | Dependency swap | `@google/genai` → `@anthropic-ai/sdk` |
| `vite.config.ts` | Env var | `GEMINI_API_KEY` → `ANTHROPIC_API_KEY` |
| `.env.local` | Key swap | New API key |
| All components importing from `geminiService` | Import path | `geminiService` → `aiService` |

---

## What Does NOT Change

- All prompt text (personas, field instructions, behavioral rules)
- `contextBuilder.ts` (pure data assembly)
- `campaignService.ts` (state management, no AI)
- All component UI code (generators, editors, dashboards, dialogs)
- Mock service (`mockService.ts`)
- Type definitions (`types/*.ts`)
- Entity utilities (`utils/entityUtils.ts`)
- Import/export service (`importExportService.ts`)
