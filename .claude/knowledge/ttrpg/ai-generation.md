# AI Generation Patterns for TTRPG Content

How Realmweaver generates entities via Google Gemini AI and what makes
good AI-generated TTRPG content.

---

## Generation Architecture

```
User clicks "Generate" in a Generator component
    |
    v
Component calls geminiService.generateNpc(prompt, useGroundedSearch, isMockMode, campaignContext)
    |
    v
geminiService checks isMockMode:
    - true  -> mockService.generateNpc(...)  [returns static test data]
    - false -> aiRealmWeaver.generateNpc(...) [calls Gemini API]
    |
    v
aiRealmWeaver.generateNpc():
    1. Defines instructions (system prompt for "The Prep Architect")
    2. Defines JSON schema (using @google/genai Type constants)
    3. Calls core.generateWithSchema(prompt, schema, instructions, ...)
    |
    v
core.generateWithSchema():
    1. Initializes GoogleGenAI client (lazy, from env API key)
    2. Sets thinking budget (Flash: 24K tokens, Pro: 32K tokens)
    3. Injects campaignContext if provided
    4. Calls ai.models.generateContent() with JSON response mode
    5. Parses and returns JSON
    |
    v
Component receives entity data, calls campaignService.createNpc(data)
    |
    v
campaignService assigns UUID, adds to campaign, triggers save
```

## Entity Generation Functions

| Entity | Facade Function | AI Module | Schema |
|--------|----------------|-----------|--------|
| NPC | `generateNpc` | realmWeaver | npcSchema |
| Location | `generateLocation` | realmWeaver | locationSchema |
| Faction | `generateFaction` | realmWeaver | factionSchema |
| Item | `generateItem` | realmWeaver | itemSchema |
| Scene | `generateScene` | realmWeaver | sceneSchema |
| Adventure | `generateAdventure` | realmWeaver | adventureWithScenesSchema |
| Article | `generateArticle` | realmWeaver | articleSchema |
| Point of Interest | `generatePoiFromLoot` | realmWeaver | pointOfInterestSchema |

## Other AI Functions

| Function | Facade | Module | Returns |
|----------|--------|--------|---------|
| Narration text | `generateNarration` | dmCoach | string |
| Improv/plot twist | `generateImprovisation` | dmCoach | string |
| Rollable table | `generateRollableTable` | dmCoach | RollableTable |
| Enhanced text | `generateEnhancedText` | dmCoach | string |
| Session note analysis | `analyzeSessionNotes` | dmCoach | structured entries |
| Batch world generation | `generateCampaignFill` | evocationWizard | BatchAddData |
| Document parsing | `parseDocumentForEntities` | evocationWizard | BatchAddData |
| Chat with document | `generateChatResponse` | evocationWizard | string |
| PDF character sheet | `parseCharacterSheetPdf` | evocationWizard | PlayerCharacter |
| RealmChat conversation | `chatWithRealmWeaver` | realmChat | RealmChatResponse |

## Campaign Context Injection

Every AI function accepts `campaignContext?: string`. This provides existing
campaign data for consistency. Built in components like:

```typescript
const campaignContext = `
Setting: ${campaign.setting}
Existing NPCs: ${campaign.npcs.map(n => n.name).join(', ')}
Existing Locations: ${campaign.locations.map(l => l.name).join(', ')}
Existing Factions: ${campaign.factions.map(f => f.name).join(', ')}
`;
```

The core.ts injects this into the prompt:
```
Reference the following existing campaign information for context:
<campaign_context>
[campaignContext]
</campaign_context>
```

## Quality Markers for AI-Generated TTRPG Content

### Good NPC Generation
- Name fits the campaign setting (fantasy names for fantasy, etc.)
- Description focuses on VISIBLE traits, not internal states
- Traits are ACTIONABLE at the table (mannerisms the GM can perform)
- Motivations drive scene interaction (not just backstory)
- Secrets provide GM leverage for plot hooks
- Stats reference existing stat blocks, not invented numbers

### Good Location Generation
- Description uses multiple senses (sight, sound, smell, touch)
- Secrets have discovery conditions (DCs, triggers)
- Points of Interest have varying passive perception DCs
- Connections suggest how players arrive and depart

### Good Adventure Generation
- Hook creates immediate tension or curiosity
- Scenes flow logically but allow branching
- Mix of scene types (not all combat)
- Each scene has clear GM notes with goals and contingencies
- Skill checks are specific (skill + DC + outcome)

### Good Article Generation
- Written in encyclopedic tone suitable for a world guide
- Provides actionable GM content, not just fluff
- References other campaign elements for consistency

## Mock Mode

Every AI function has a mock implementation in `services/ai/mockService.ts`.
Mock mode is toggled via a header UI button (`isMockMode` state in App.tsx).

When adding a new AI function:
1. Add the real implementation in the appropriate `ai/` module
2. Add a mock implementation in `mockService.ts` returning static data
3. Add the facade function in `geminiService.ts` with the mock/real switch
4. The mock should return data matching the same type signature

## Model Selection

| Model | Use Case | Thinking Budget |
|-------|----------|----------------|
| `gemini-2.5-flash` | Most generation (fast, cheap) | 24,576 tokens |
| `gemini-2.5-pro` | Optional high-quality generation | 32,768 tokens |

Model selection is typically hardcoded per function in the AI modules.
The `ModelTier` type ('performance' / 'medium' / 'quality') is used by
RealmChat to let users choose quality level.

## Grounded Search

Only available for NPC generation via `useGroundedSearch` parameter.
Uses Google Search to ground responses in official D&D lore for well-known
characters. When enabled, schema-based JSON response mode is disabled
(Gemini API limitation) and the model is instructed to return JSON via
prompt instead.
