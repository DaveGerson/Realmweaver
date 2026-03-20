# Gemini AI Service Architecture

Three-layer architecture with mock mode switching for offline development.

---

## Layer Diagram

```
LAYER 1: Components (UI)
  components/generators/NpcGenerator.tsx
  components/editors/NpcEditor.tsx (AI-assist buttons)
  components/dialogs/DmCoach.tsx
  components/dialogs/EvocationWizard.tsx
  components/RealmChat/RealmChatWidget.tsx
      |
      | calls facade functions with (prompt, isMockMode, campaignContext)
      v
LAYER 2: Service Facade (services/geminiService.ts)
  - Single entry point for ALL AI calls from components
  - Runtime mock mode switching: if (isMockMode) -> mockService else -> real AI
  - ~144 lines, purely routing logic
  - NEVER call Layer 3 directly from components
      |
      | routes to real or mock implementation
      v
LAYER 3a: Real AI Modules (services/ai/)
  realmWeaver.ts  -- Entity generation (NPC, Location, Faction, Item, Scene, Adventure, Article)
  dmCoach.ts      -- In-session tools (narration, improv, rollable tables, session analysis)
  evocationWizard.ts -- Batch operations (campaign fill, document parsing, PDF parsing)
  realmChat.ts    -- Conversational AI (multi-turn entity drafting)
      |
      v
LAYER 3b: Core API Wrapper (services/ai/core.ts)
  generateWithSchema()  -- Structured JSON output
  generateText()        -- Unstructured text
  generateChatCompletion() -- Multi-turn chat

LAYER 3c: Mock Service (services/ai/mockService.ts)
  -- Mirror of every real AI function
  -- Returns static test data matching the same type signatures
  -- Used for offline development and smoke testing
```

## Key Rules

1. **Components NEVER import from `services/ai/` directly.**
   Always go through `services/geminiService.ts`.

2. **Every AI function in geminiService.ts follows this pattern:**
   ```typescript
   export const generateNpc = (prompt, useGroundedSearch, isMockMode, campaignContext) => {
     if (isMockMode) return mockService.generateNpc(...);
     return aiRealmWeaver.generateNpc(...);
   };
   ```

3. **Every real AI function MUST have a mock counterpart.**
   Adding a new AI function requires updating three files:
   - `services/ai/[module].ts` (real implementation)
   - `services/ai/mockService.ts` (mock implementation)
   - `services/geminiService.ts` (facade with mock/real switch)

4. **Mock mode is a UI toggle** in the app header.
   The `isMockMode` state lives in `App.tsx` as `useState<boolean>`.
   It's passed down as a prop to components that make AI calls.

## AI Module Responsibilities

### realmWeaver.ts (~279 lines)
- All entity generation functions
- Defines JSON schemas using `@google/genai` Type constants
- Each function: defines instructions (system prompt) + schema + calls core
- "The Prep Architect" persona in instructions
- Post-processing: adds client-side UUIDs to sub-items (skill checks)
- Primary model: `gemini-2.5-flash`

### dmCoach.ts (~99 lines)
- In-session DM assistance tools
- `generateNarration` -- box text for scenes
- `generateImprovisation` -- plot twists and improv ideas
- `generateRollableTable` -- structured random tables
- `generateEnhancedText` -- AI-enhanced text editing
- `analyzeSessionNotes` -- parses freeform notes into structured entries
- Uses `generateText` (unstructured) and `generateWithSchema` (structured)
- Primary model: `gemini-2.5-flash` (with `useLiteModel` option)

### evocationWizard.ts (~189 lines)
- Batch and parsing operations
- `generateCampaignFill` -- generates multiple entities at once
- `parseDocumentForEntities` -- extracts entities from adventure text
- `generateChatResponse` -- document Q&A chat
- `parseCharacterSheetPdf` -- PDF character sheet to PlayerCharacter
- Returns `BatchAddData` type for bulk entity creation
- Primary model: `gemini-2.5-pro` for complex parsing tasks

### realmChat.ts (~141 lines)
- Conversational AI for collaborative entity creation
- Multi-turn conversations with draft entity management
- `chatWithRealmWeaver` -- takes history + current drafts + approved log
- Returns `RealmChatResponse` with message + suggestions + draft entities
- Model selection via `ModelTier`: performance/medium/quality
- Uses `generateChatCompletion` from core

### mockService.ts (~423 lines)
- Static mock data for every AI function
- Returns pre-built objects matching real return types
- Simulates async behavior with `Promise.resolve()`
- Used for offline dev, smoke tests, and CI environments
