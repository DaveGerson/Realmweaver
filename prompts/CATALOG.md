# Realmweaver Prompt Catalog

> **Purpose**: Complete inventory of every AI prompt, schema, and interaction pattern in the codebase.
> Maps each prompt by location, purpose, persona, schema, model tier, reusability class, and optimization notes.
>
> **Generated**: 2026-03-23

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Model Tier Mapping](#model-tier-mapping)
3. [Reusable Pattern Classes](#reusable-pattern-classes)
4. [Prompt Inventory](#prompt-inventory)
   - [P1: Entity Generation (The Prep Architect)](#p1-entity-generation)
   - [P2: DM Coach Tools](#p2-dm-coach-tools)
   - [P3: Evocation Wizard (Batch Operations)](#p3-evocation-wizard)
   - [P4: RealmChat (Conversational)](#p4-realmchat)
   - [P5: Field Enhancement (CRUD)](#p5-field-enhancement)
   - [P6: Context Injection](#p6-context-injection)
5. [Schema Inventory](#schema-inventory)
6. [CRUD/Form Pattern Map](#crudform-pattern-map)
7. [Optimization Recommendations](#optimization-recommendations)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  COMPONENT LAYER (React)                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │Generator │ │ Editor   │ │DM Coach  │ │RealmChat  │  │
│  │  Forms   │ │  Forms   │ │  Dialog  │ │  Widget   │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
│       │ user       │ field     │ tool        │ chat    │
│       │ prompt     │ enhance   │ prompt      │ history │
├───────┴────────────┴───────────┴─────────────┴──────────┤
│  FACADE LAYER                                           │
│  geminiService.ts — mock mode switching only            │
├─────────────────────────────────────────────────────────┤
│  SERVICE LAYER (Prompts + Schemas live here)            │
│  ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │realmWeaver.ts│ │dmCoach.ts│ │evocation │ │realm   │ │
│  │  7 prompts   │ │ 6 prompts│ │Wizard.ts │ │Chat.ts │ │
│  │  8 schemas   │ │ 3 schemas│ │ 4 prompts│ │2 prompts│ │
│  └──────┬───────┘ └────┬─────┘ └────┬─────┘ └───┬────┘ │
├─────────┴──────────────┴────────────┴────────────┴──────┤
│  CORE LAYER                                             │
│  core.ts — 3 functions, Gemini SDK, context injection   │
│  contextBuilder.ts — tiered campaign context assembly    │
└─────────────────────────────────────────────────────────┘
```

**Total prompt count**: 21 distinct system instructions + 4 component-level prompt templates = **25 prompts**
**Total schemas**: 16 structured output definitions
**Gemini SDK surface**: 1 file (`core.ts`, 130 lines)

---

## Model Tier Mapping

| Current Gemini Model        | Role                  | Used By                                | Proposed Claude Equivalent |
|-----------------------------|-----------------------|----------------------------------------|----------------------------|
| `gemini-flash-lite-latest`  | Fast/cheap            | Enhanced text, chat brainstorm, lite coach | Haiku                     |
| `gemini-2.5-flash`          | Standard workhorse    | All entity generation, coach, session recap | Sonnet                   |
| `gemini-2.5-pro`            | High quality          | Document parsing                       | Opus or Sonnet+thinking   |
| `gemini-3-pro-preview`      | Experimental best     | RealmChat quality tier                 | Opus                      |

**Thinking budget configuration** (core.ts:26-30):
- `gemini-2.5-pro`: 32,768 tokens
- `gemini-2.5-flash`: 24,576 tokens
- Others: none

---

## Reusable Pattern Classes

Each prompt falls into one of these pattern classes, which determines how it should be consolidated:

### Class A: Schema-Bound Entity Generation
**Pattern**: `persona + field instructions + schema → structured JSON`
**Count**: 8 prompts (NPC, Location, Faction, Item, Scene, Adventure, Article, PointOfInterest)
**Reusability**: HIGH — identical structure, only field descriptions and schema differ.
**Consolidation**: Single parameterized template. See `templates/entity-generation.md`.

### Class B: Freeform Text Generation
**Pattern**: `persona + task description + user prompt → plain text`
**Count**: 4 prompts (Narration, Improvisation, Enhanced Text, Chat Brainstorm)
**Reusability**: MEDIUM — same structure, different personas and output expectations.
**Consolidation**: Single template with persona/task slots. See `templates/freeform-text.md`.

### Class C: Schema-Bound Analysis
**Pattern**: `task instructions + data input + schema → structured JSON`
**Count**: 3 prompts (Session Recap, Session Notes Analysis, Rollable Table)
**Reusability**: LOW — each has unique input/output shapes.
**Consolidation**: Keep separate but share context injection pattern.

### Class D: Multi-Turn Conversational
**Pattern**: `system instruction + conversation history + draft state → structured JSON`
**Count**: 2 prompts (RealmChat multi-entity, NPC Roleplay)
**Reusability**: LOW — complex stateful interactions.
**Consolidation**: Keep separate. Main optimization is splitting behavioral rules from schema rules.

### Class E: Document/Multimodal Parsing
**Pattern**: `extraction instructions + document content + schema → structured JSON`
**Count**: 2 prompts (Document Entity Parser, PDF Character Sheet)
**Reusability**: LOW — specialized extraction tasks.
**Consolidation**: Keep separate. Consider replacing with dedicated tooling.

### Class F: Field Enhancement (CRUD)
**Pattern**: `"generate a compelling {field}" + entity context → plain text`
**Count**: 2 implementations (NpcEditor, LocationEditor) + 1 reusable component (RegenerateButton)
**Reusability**: HIGHEST — exact same pattern across all entity editors.
**Consolidation**: Already partially consolidated via `RegenerateButton`. The inline `handleAiGenerate` in editors should use it too. See `templates/field-enhancement.md`.

---

## Prompt Inventory

### P1: Entity Generation

All use the **"Prep Architect"** persona and **Class A** pattern.

#### P1.1: NPC Generator
- **File**: `services/ai/realmWeaver.ts:140-154`
- **Persona**: "The Prep Architect, an expert TTRPG assistant"
- **Task**: "generate a detailed, ready-to-run NPC dossier"
- **Schema**: `npcSchema` (8 required fields)
- **Model**: `gemini-2.5-flash`
- **Context**: Campaign context via `campaignContext` param
- **Special**: Supports Google Search grounding; post-processes to add empty `knowsPlayerHistory`, `relationships`, `history` arrays
- **Fields instructed**:
  - `name`: Full name, title, or alias
  - `description`: Brief evocative physical description
  - `traits`: 2-3 actionable roleplaying notes (mannerisms, speech)
  - `exampleQuote`: Single characteristic dialogue line
  - `backstory`: Concise history and story role
  - `motivations`: Goals and active efforts
  - `secrets`: Hidden info, plot twist, vulnerability (GM-only)
  - `stats`: TTRPG-agnostic capabilities

#### P1.2: Location Generator
- **File**: `services/ai/realmWeaver.ts:156-164`
- **Persona**: Same
- **Task**: "generate a detailed, ready-to-run location"
- **Schema**: `locationSchema` (3 required fields)
- **Model**: `gemini-2.5-flash`
- **Fields instructed**:
  - `name`: Location name
  - `description`: Read-aloud, sensory details (sight, sound, smell)
  - `secrets`: Hidden details, investigation opportunities with DCs

#### P1.3: Faction Generator
- **File**: `services/ai/realmWeaver.ts:166-177`
- **Persona**: Same
- **Task**: "generate a detailed faction"
- **Schema**: `factionSchema` (6 required fields)
- **Model**: `gemini-2.5-flash`
- **Fields instructed**:
  - `name`, `description`, `goals`, `alignment`, `resources`, `influence`

#### P1.4: Item Generator
- **File**: `services/ai/realmWeaver.ts:179-188`
- **Persona**: Same
- **Task**: "generate a detailed magic item"
- **Schema**: `itemSchema` (4 required fields)
- **Model**: `gemini-2.5-flash`
- **Fields instructed**:
  - `name`, `description`, `rarity` (enum), `properties`

#### P1.5: Scene Generator
- **File**: `services/ai/realmWeaver.ts:190-211`
- **Persona**: Same
- **Task**: "generate a complete, ready-to-run scene"
- **Schema**: `sceneSchema` (6 required fields, nested `skillChecks`)
- **Model**: `gemini-2.5-flash`
- **Post-processing**: Adds `crypto.randomUUID()` IDs to skill checks
- **Fields instructed**:
  - `title`, `type` (enum), `readAloudText`, `gmNotes`, `skillChecks`, `rewards`

#### P1.6: Adventure Generator
- **File**: `services/ai/realmWeaver.ts:213-241`
- **Persona**: "The Prep Architect, an expert TTRPG adventure designer"
- **Task**: "generate a complete adventure outline with 2-3 fully detailed scenes"
- **Schema**: `adventureWithScenesSchema` (5 required fields, nested scenes)
- **Model**: `gemini-2.5-flash`
- **Post-processing**: Adds UUIDs to skill checks within scenes
- **Fields instructed**:
  - `title`, `level`, `hook`, `theme`, `scenes` (2-3 interconnected)

#### P1.7: Article/Lore Generator
- **File**: `services/ai/realmWeaver.ts:243-251`
- **Persona**: "The Prep Architect, an expert TTRPG loremaster"
- **Task**: "generate a detailed lore article"
- **Schema**: `articleSchema` (3 required fields)
- **Model**: `gemini-2.5-flash`
- **Fields instructed**:
  - `title`, `category` (enum), `content`

#### P1.8: Point of Interest Generator
- **File**: `services/ai/realmWeaver.ts:253-278`
- **Persona**: "a TTRPG designer creating an interactive element"
- **Task**: Create POI from loot description
- **Schema**: `pointOfInterestSchema` (5 required fields, nested arrays)
- **Model**: `gemini-2.5-flash`
- **Post-processing**: Adds UUIDs to investigationChecks and interactions
- **Fields instructed**:
  - `name`, `passivePerceptionDC`, `description`, `investigationChecks`, `interactions`

---

### P2: DM Coach Tools

#### P2.1: Narration Generator
- **File**: `services/ai/dmCoach.ts:72-80`
- **Class**: B (freeform text)
- **Persona**: "a master Dungeon Master, in the style of Brennan Lee Mulligan or Matt Mercer"
- **Task**: "generate evocative, sensory-rich narrative descriptions"
- **Output**: Plain text (2-4 sentences, read-aloud)
- **Model**: `gemini-2.5-flash` (default) or `gemini-flash-lite-latest`
- **Constraint**: "Do not break character"

#### P2.2: Improvisation Generator
- **File**: `services/ai/dmCoach.ts:82-91`
- **Class**: B (freeform text)
- **Persona**: "a master Dungeon Master, an expert at improvisation"
- **Task**: "help a fellow DM handle an unexpected player action"
- **Output**: Plain text (2-3 immediate consequences + 1 long-term, bullet/heading format)
- **Model**: `gemini-2.5-flash` (default) or `gemini-flash-lite-latest`

#### P2.3: Rollable Table Generator
- **File**: `services/ai/dmCoach.ts:93-97`
- **Class**: C (schema-bound analysis)
- **Persona**: "a creative Dungeon Master"
- **Task**: "generate a custom rollable table"
- **Schema**: `rollableTableSchema` (title, dieType, entries[])
- **Model**: `gemini-2.5-flash` (default) or `gemini-flash-lite-latest`
- **Constraint**: Ranges must be contiguous, cover full die range

#### P2.4: Enhanced Text Generator
- **File**: `services/ai/dmCoach.ts:99-105`
- **Class**: F (field enhancement)
- **Persona**: "a creative assistant for a Dungeon Master"
- **Task**: "generate a short, creative piece of text (2-4 sentences)"
- **Output**: Plain text, concise and evocative
- **Model**: Always `gemini-flash-lite-latest` (cheapest)
- **Note**: This is the workhorse behind ALL editor field enhancement

#### P2.5: Session Recap Generator
- **File**: `services/ai/dmCoach.ts:107-125`
- **Class**: C (schema-bound analysis)
- **Persona**: "an expert Game Master's assistant"
- **Task**: "generate a structured session recap from the DM's running notes"
- **Schema**: `sessionRecapSchema` (recap, looseEnds[], playerFacingRecap)
- **Model**: `gemini-2.5-flash`
- **Input**: Session notes text + active plot summaries
- **Output**: Three-part structured recap (GM, loose ends, player-safe)

#### P2.6: Session Notes Analyzer
- **File**: `services/ai/dmCoach.ts:127-139`
- **Class**: C (schema-bound analysis)
- **Persona**: "an expert Game Master's assistant"
- **Task**: "process raw session notes into structured log entries"
- **Schema**: `sessionAnalysisSchema` (entries[{ content, relatedEntityNames[] }])
- **Model**: `gemini-2.5-flash`
- **Input**: Raw notes + known entity names array
- **Constraint**: Only list entities from the provided list

---

### P3: Evocation Wizard

#### P3.1: Campaign Fill (Batch Generation)
- **File**: `services/ai/evocationWizard.ts:128-147`
- **Class**: A (entity generation, batch)
- **Persona**: "a master world-builder for Dungeons & Dragons"
- **Task**: "generate a set of interconnected world entities"
- **Schema**: Dynamic — `campaignFillSchema` filtered by user's checkbox selection
- **Model**: `gemini-2.5-flash`
- **Note**: Reuses entity schemas from realmWeaver.ts. Dynamic schema is built at call time.

#### P3.2: Document Entity Parser
- **File**: `services/ai/evocationWizard.ts:150-156`
- **Class**: E (document parsing)
- **Persona**: "an expert TTRPG assistant"
- **Task**: "parse the following document and extract all recognizable TTRPG entities"
- **Schema**: Full `campaignFillSchema`
- **Model**: `gemini-2.5-pro` (higher quality for complex extraction)
- **Note**: Infers relationships between extracted entities

#### P3.3: Character Sheet PDF Parser
- **File**: `services/ai/evocationWizard.ts:158-180`
- **Class**: E (multimodal parsing)
- **Persona**: "an expert D&D 5e data entry assistant"
- **Task**: "parse the provided D&D Beyond character sheet PDF"
- **Schema**: `playerCharacterSchema` (deeply nested: social, statistics, skills, actions)
- **Model**: `gemini-2.5-flash`
- **Input**: Multimodal (PDF base64 + text instruction)
- **Specific rules**: Ability score interpretation, skill proficiency markers, class extraction

#### P3.4: Evocation Chat (Brainstorm)
- **File**: `services/ai/evocationWizard.ts:182-189`
- **Class**: B (freeform text, conversational)
- **Persona**: "a creative, collaborative world-building assistant"
- **Task**: "help the user brainstorm ideas for their campaign"
- **Output**: Plain text (2-4 sentences, friendly/inquisitive tone)
- **Model**: `gemini-flash-lite-latest`

---

### P4: RealmChat

#### P4.1: Multi-Entity Creator
- **File**: `services/ai/realmChat.ts:51-141`
- **Class**: D (multi-turn conversational)
- **Persona**: "RealmChat, an intelligent TTRPG world-building assistant"
- **Task**: Create/refine NPCs, Locations, Factions, Items, Adventures, Articles via chat
- **Schema**: `realmChatResponseSchema` (message, suggestions[], draftEntities[])
- **Model**: Tier-mapped (`performance`→lite, `medium`→flash, `quality`→pro-preview)
- **Stateful**: Maintains draft IDs across turns, merges updates
- **Modes**: General (all entity types) or Focused (single entity type)
- **Behavioral rules**:
  1. Conversational — ask clarifying questions if vague
  2. Guided flows — offer 3 choices for key details
  3. Drafting — populate draftEntities when enough detail
  4. Context — use campaign context + approved entities log
- **Dynamic sections**:
  - Focused mode instruction (injected if `focusedEntityType` set)
  - Current drafts JSON
  - Approved entities log

#### P4.2: NPC Roleplay
- **File**: `services/ai/realmChat.ts:158-205`
- **Class**: D (multi-turn conversational, character roleplay)
- **Persona**: Dynamic — roleplays AS the selected NPC
- **Task**: In-character dialogue with mood cues
- **Schema**: `npcRoleplayResponseSchema` (dialogue, moodCue)
- **Model**: `gemini-2.5-flash`
- **NPC context template** (built in DmCoach.tsx:178-192):
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
- **Roleplay rules**:
  1. First person, never break character
  2. Reflect personality, speech patterns, emotional state
  3. Draw on traits/motivations/secrets naturally
  4. Reference campaign events organically
  5. Concise: 2-4 sentences
  6. Mood cue: physical action or emotional subtext
  7. Return JSON with `dialogue` and `moodCue`

---

### P5: Field Enhancement (CRUD)

These are the prompts used within entity editors to AI-enhance individual fields.

#### P5.1: Inline Field Generation (Editor Pattern)
- **Files**: `components/editors/NpcEditor.tsx:79-94`, `LocationEditor.tsx:82-93`, and similar in all editors
- **Class**: F
- **Prompt template**:
  ```
  Based on the following {EntityType} info, generate a compelling "{fieldName}":

  {entityContext}
  ```
- **Entity context construction** (NpcEditor example):
  ```
  NPC Name: {name}
  Description: {description}
  Traits: {traits}
  ```
- **Service called**: `generateEnhancedText(prompt, undefined, isMockMode)`
- **Model**: Always `gemini-flash-lite-latest` (hardcoded in dmCoach.ts)
- **Flow**: Generate → update local state → call `onUpdate(id, { [field]: result })`
- **Note**: campaignContext is NOT passed in the inline version (second arg is `undefined`)

#### P5.2: RegenerateButton (Reusable Component)
- **File**: `components/common/RegenerateButton.tsx:83-108`
- **Class**: F
- **Prompt template**:
  ```
  Regenerate the "{fieldName}" for this {entityType}.

  Current value: {currentValue}

  Context:
  {entityContext}{tweakPart}

  Provide only the regenerated text for the "{fieldName}" field, no labels or preamble.
  ```
- **Service called**: `generateEnhancedText(prompt, campaignContext, false)`
- **Model**: Always `gemini-flash-lite-latest`
- **Features**: Optional tweak instruction, preview/accept/reject workflow
- **Note**: This DOES pass campaignContext

---

### P6: Context Injection

#### P6.1: Core Campaign Context Wrapper
- **File**: `services/ai/core.ts:32-34, 81-83, 98-100`
- **Three variants** (all inject the same text differently):
  - `generateWithSchema`: Prepends to instructions
  - `generateText`: Prepends to full prompt
  - `generateChatCompletion`: Prepends to first user message
- **Template**:
  ```
  Reference the following existing campaign information for context and consistency:
  <campaign_context>
  {campaignContext}
  </campaign_context>
  ```

#### P6.2: Tiered Context Builder
- **File**: `services/contextBuilder.ts`
- **Not a prompt** — data assembly for inclusion in prompts
- **Three variants**: `generation`, `coach`, `chat`
- **Budget**: Default 4000 tokens (~16K chars), configurable
- **Tiers**:
  - Tier 1 (~1000 tokens): Campaign identity, active session, active scene
  - Tier 2 (~2000 tokens): Combat state, scene NPCs + relationships, scene location, plot threads, focus entity
  - Tier 3 (remaining): Entity overviews, article/adventure/item/PC names

#### P6.3: Component-Level Context Construction
- **EvocationWizard** (`components/dialogs/EvocationWizard.tsx:78-86`): Flat serialization
  ```
  Title: {title}
  Setting: {setting}
  NPCs: {names}
  Locations: {names}
  ...
  ```
- **EntityChatGenerator** (`components/generators/EntityChatGenerator.tsx:89`):
  ```
  {campaignContext}
  User is using the "Create via Chat" tool for a specific {entityType}.
  ```
- **DmCoach** (`components/dialogs/DmCoach.tsx:145-153`): Uses `buildCampaignContext` with `variant: 'coach'`, maxTokenEstimate: 3200, then appends `activeContext` and mention context

#### P6.4: UI-Level Prompt Templates
- **DM Coach chips** (`DmCoach.tsx:22-44`): 15 template prompts across 3 categories (narrate, improvise, table)
- **Evocation Simple Mode** (`EvocationWizard.tsx:162-165`): Theme + qualifiers construction
- **Evocation Detailed Mode** (`EvocationWizard.tsx:176-178`): Adventure concept + scene prompts
- **Evocation Chat Mode** (`EvocationWizard.tsx:201-203`): Transcript extraction prompt
- **RealmChat Widget greeting** (`RealmChatWidget.tsx:302-309`): Initial suggestions
- **EntityChatGenerator greeting** (`EntityChatGenerator.tsx:42-51`): Type-specific greeting

---

## Schema Inventory

### Entity Schemas (from realmWeaver.ts)

| Schema | Fields | Nested | Used By |
|--------|--------|--------|---------|
| `npcSchema` | 8 STRING | No | NPC gen, RealmChat drafts, Evocation batch |
| `locationSchema` | 3 STRING | No | Location gen, RealmChat drafts, Evocation batch |
| `factionSchema` | 6 STRING | No | Faction gen, RealmChat drafts, Evocation batch |
| `itemSchema` | 4 STRING (1 enum) | No | Item gen, RealmChat drafts, Evocation batch |
| `skillCheckSchema` | 2 STRING + 1 INTEGER | No | Nested in scenes |
| `sceneSchema` | 4 STRING (1 enum) + 1 ARRAY + 1 STRING | skillChecks[] | Scene gen, Adventure scenes |
| `adventureWithScenesSchema` | 3 STRING + 1 INTEGER + 1 ARRAY | scenes[] | Adventure gen, RealmChat, Evocation |
| `articleSchema` | 3 STRING (1 enum) | No | Article gen, RealmChat drafts |
| `poiInteractionSchema` | 2 STRING | No | Nested in POI |
| `pointOfInterestSchema` | 2 STRING + 1 INTEGER + 2 ARRAY | checks[], interactions[] | POI gen |

### Analysis Schemas (from dmCoach.ts)

| Schema | Fields | Used By |
|--------|--------|---------|
| `rollableTableSchema` | 2 STRING + 1 ARRAY(range,result) | Rollable table gen |
| `sessionAnalysisSchema` | 1 ARRAY(content, relatedEntityNames[]) | Session notes analysis |
| `sessionRecapSchema` | 2 STRING + 1 ARRAY(STRING) | Session recap gen |

### Chat Schemas (from realmChat.ts)

| Schema | Fields | Used By |
|--------|--------|---------|
| `draftEntitySchema` | 3 required + 6 optional entity data | Nested in RealmChat response |
| `realmChatResponseSchema` | message + suggestions[] + draftEntities[] | RealmChat |
| `npcRoleplayResponseSchema` | dialogue + moodCue | NPC roleplay |

### Parsing Schema (from evocationWizard.ts)

| Schema | Fields | Used By |
|--------|--------|---------|
| `playerCharacterSchema` | Deeply nested (social, statistics, skills, actions) | PDF parser |
| `campaignFillSchema` | 5 ARRAY (each uses entity schemas) | Campaign fill, document parsing |

---

## CRUD/Form Pattern Map

These are the patterns most affected by a Claude migration because they're the most repeated and most tightly coupled to the Gemini SDK.

### Pattern F1: Quick Generate (Generator → Service → Schema → Entity)

```
[Generator Component]
  User types prompt
  → calls geminiService.generateX(prompt, groundedSearch, isMockMode, campaignContext)
    → [geminiService facade] routes to real or mock
      → [realmWeaver.ts] constructs instructions string
        → [core.ts] generateWithSchema(prompt, schema, instructions, overrides, model, context)
          → Gemini API call with responseSchema
          → JSON.parse response
        ← structured entity data
      ← post-process (add UUIDs, empty arrays)
    ← entity data
  → onEntityCreated(data) → campaignService.createX(data)
```

**Files touched**: Generator component → geminiService.ts → realmWeaver.ts → core.ts
**Gemini-specific**: `Type.*` schema format, `responseMimeType`, `thinkingConfig`, `GoogleGenAI`
**Migration impact**: HIGH — schema format must change to JSON Schema, API call changes

### Pattern F2: Chat-Based Generate (EntityChatGenerator → RealmChat → Schema)

```
[EntityChatGenerator]
  User sends message
  → chatWithRealmWeaver(history, drafts, approvedLog, context, tier, isMockMode, entityType)
    → [realmChat.ts] builds system instruction with focused mode, drafts, log
      → [core.ts] generateWithSchema(prompt, realmChatResponseSchema, sysInstruction, {}, model, context)
        → Gemini API with schema
      ← { message, suggestions, draftEntities }
    ← post-process: flatten type-specific data fields
  → update local draft state
  → on "Create Entity": onEntityCreated(draftData)
```

**Files touched**: EntityChatGenerator → geminiService.ts → realmChat.ts → core.ts
**Migration impact**: HIGH — same schema issues plus complex multi-turn state management

### Pattern F3: Field Enhancement (Editor → EnhancedText)

```
[Editor Component]
  User clicks AI sparkle button on a field
  → Constructs prompt: 'Based on the following X info, generate a compelling "{field}":\n\n{context}'
  → generateEnhancedText(prompt, campaignContext?, isMockMode)
    → [dmCoach.ts] wraps in persona prompt
      → [core.ts] generateText(fullPrompt, 'gemini-flash-lite-latest', campaignContext)
        → Gemini API, plain text response
      ← text
    ← text
  → setFormData({[field]: result})
  → onUpdate(id, {[field]: result})
```

**Files touched**: Editor component → geminiService.ts → dmCoach.ts → core.ts
**Migration impact**: MEDIUM — simpler (no schema), just model swap. But used EVERYWHERE.

### Pattern F4: RegenerateButton (Component → EnhancedText with Preview)

```
[RegenerateButton]
  User clicks sparkle → optional tweak → clicks "Regenerate"
  → Constructs prompt: 'Regenerate the "{field}" for this {type}.\n\nCurrent value: ...\n\nContext: ...'
  → generateEnhancedText(prompt, campaignContext, false)
    → same as F3
  ← preview text
  → User clicks Accept → onRegenerate(previewValue)
```

**Migration impact**: MEDIUM — same as F3 but adds preview/accept workflow (UI stays the same)

### Pattern F5: Coach Tool (DmCoach → Narration/Improv/Table)

```
[DmCoach Dialog]
  User selects tool tab, types prompt
  → Builds tiered campaign context (variant: 'coach', maxTokenEstimate: 3200)
  → Appends activeContext + mentioned entity context
  → currentTool.action(prompt, campaignContext, useLiteModel, isMockMode)
    → [dmCoach.ts] generateNarration/Improv/Table
      → generateText or generateWithSchema
    ← text or RollableTable object
  → display result (copy-able, send-to-notes)
```

**Migration impact**: MEDIUM — narration/improv are simple text; rollable table needs schema migration

### Pattern F6: Batch Generate (EvocationWizard → Multiple Patterns)

```
[EvocationWizard]
  Mode: simple | detailed | ingest | chat

  Simple:
    → Theme + qualifiers → generateCampaignFill(prompt, options, isMockMode, context)

  Detailed:
    → Per-entity prompts → Promise.all([generateNpc, generateLocation, ...])
    → Adventures: build full prompt with scene descriptions → generateAdventure

  Ingest:
    → Document text → parseDocumentForEntities(text, isMockMode, context)

  Chat:
    → Chat transcript → generateCampaignFill(transcript, options, isMockMode, context)

  All modes → processGeneratedData → hydrate with UUIDs → review/select → addToCampaign
```

**Migration impact**: HIGH — uses multiple generation patterns, dynamic schemas, Promise.all parallelism

---

## Optimization Recommendations

### 1. Consolidate Prep Architect Prompts (Class A)
**Current**: 8 nearly identical functions in realmWeaver.ts, each with copy-pasted persona text.
**Recommendation**: Single `generateEntity(type, prompt, schema, fieldInstructions, ...)` function.
The persona text and common instructions become a template; only the entity-specific field descriptions vary.
**See**: `templates/entity-generation.md`

### 2. Unify Context Injection
**Current**: Three different injection methods in core.ts (prepend to instructions, prepend to prompt, prepend to first user message).
**Recommendation**: Single injection strategy. For Claude, use the `system` parameter for system instructions + context, and keep user messages clean.

### 3. Promote RegenerateButton Pattern
**Current**: `NpcEditor` and `LocationEditor` have BOTH inline `handleAiGenerate` (constructs its own prompt, doesn't pass campaignContext) AND `RegenerateButton` (better prompt, passes campaignContext).
**Recommendation**: Remove inline `handleAiGenerate` from all editors. Use `RegenerateButton` exclusively. It already has the better UX (preview/accept/reject) and the better prompt.

### 4. Extract Prompt Text from Code
**Current**: All prompt strings are embedded inline in TypeScript functions.
**Recommendation**: Move to `prompts/text/` as named template files. Load at build time or import as constants. Benefits:
- Non-engineers can review/edit prompts
- A/B testing becomes trivial
- Prompt versioning is visible in git

### 5. Split RealmChat System Instruction
**Current**: ~100-line system instruction built dynamically with interpolated JSON.
**Recommendation**: Split into:
- Static behavioral rules (cacheable system prompt)
- Dynamic context (current drafts, approved log — injected per turn)
This improves prompt caching efficiency with Claude's API.

### 6. Consider MCP Replacements
**Current**: Campaign context is a giant text string stuffed into every prompt.
**Future**: MCP resource server exposing campaign data. The AI queries what it needs instead of receiving everything. Benefits:
- Reduces token usage dramatically
- Enables precise entity lookups
- Entity graph queries become tool calls

### 7. Normalize Model Tier API
**Current**: Some functions take `useLiteModel: boolean`, others take `tier: ModelTier`, others hardcode the model.
**Recommendation**: Single `ModelTier` type everywhere. Map to Claude models in one place.
