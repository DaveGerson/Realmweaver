# Context Injection Patterns — Current State

> Sources: `core.ts`, `contextBuilder.ts`, `EvocationWizard.tsx`, `EntityChatGenerator.tsx`, `DmCoach.tsx`

---

## Three Injection Points in core.ts

All three functions in `core.ts` inject campaign context, but each does it differently:

### 1. generateWithSchema (core.ts:32-34)
Prepends context instruction to the contents string:
```
Reference the following existing campaign information for context and consistency:
<campaign_context>
{campaignContext}
</campaign_context>

{instructions}

Prompt: "{prompt}"
```

### 2. generateText (core.ts:81-83)
Prepends context instruction to the full prompt:
```
Reference the following existing campaign information for context and consistency:
<campaign_context>
{campaignContext}
</campaign_context>

{fullPrompt}
```

### 3. generateChatCompletion (core.ts:98-100)
Prepends context to the first user message in the conversation:
```
Use the following existing campaign information for context and consistency:
<campaign_context>
{campaignContext}
</campaign_context>

{first user message text}
```

---

## Context Builders (Who Constructs What)

### contextBuilder.ts — Tiered Builder (PRIMARY)
Used by: DmCoach, RealmChatWidget
```typescript
buildCampaignContext({
  variant: 'generation' | 'coach' | 'chat',
  campaign: Campaign,
  activeSceneId?: string,
  activeSessionId?: string,
  maxTokenEstimate?: number,  // default 4000
  focusEntityId?: string,
  focusEntityType?: string,
})
```

**Tier 1** (~1000 tokens): Campaign title, setting, official setting, active session (prep + running notes), active scene (title, read-aloud, GM notes)

**Tier 2** (~2000 tokens): Combat encounter state (coach only), NPCs in scene (with traits, motivations, faction), NPC relationships (coach only), scene location, active plot threads (max 5), focus entity details

**Tier 3** (remaining budget): NPC overview list, location overview, faction overview, lore article titles, adventure titles, item names, player character names

### EvocationWizard serializeCampaign — Flat Builder
Used by: EvocationWizard only
```
Title: {title}
Setting: {setting}
NPCs: {names}
Locations: {names}
Factions: {names}
Items: {names}
Adventures: {titles}
```
Much simpler — no tiering, no budget, no active session awareness.

### EntityChatGenerator — Appended Annotation
```
{campaignContext}
User is using the "Create via Chat" tool for a specific {entityType}.
```

### DmCoach — Composite
```
{buildCampaignContext(variant: 'coach', maxTokenEstimate: 3200)}

{activeContext (from parent)}
{buildMentionedEntityContext(mentionedEntityIds)}
```

---

## Inconsistencies

| Builder | Token-aware? | Session-aware? | Scene-aware? | Used by |
|---------|-------------|---------------|-------------|---------|
| contextBuilder.ts | YES (4000 default) | YES | YES | DmCoach, RealmChatWidget |
| EvocationWizard flat | NO | NO | NO | EvocationWizard |
| EntityChatGenerator | NO (uses whatever is passed) | Depends on caller | Depends | EntityChatGenerator |
| Editor inline | **NOT USED** (passes `undefined`) | N/A | N/A | All editors (Pattern 1) |

**Key problem**: Inline editor field enhancement doesn't use campaign context at all. The AI generates in a vacuum.

---

## Recommendation: Unified Context Strategy

For Claude migration, all context should flow through `contextBuilder.ts` with appropriate variants:

| Caller | Variant | Max Tokens | Notes |
|--------|---------|-----------|-------|
| Entity generators | `generation` | 4000 | World consistency |
| DM Coach | `coach` | 3200 | Session-focused |
| RealmChat | `chat` | 4000 | Balanced |
| Field enhancement | `generation` | 2000 | Smaller budget, just entity names |
| Evocation Wizard | `generation` | 4000 | Replace flat serialization |

For Claude specifically, the context should go in the `system` parameter (cacheable), not prepended to user messages.
