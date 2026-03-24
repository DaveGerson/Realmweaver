# Execution Plan: Phase F — Growth & Advanced AI

> **Priority:** 3 (after E2E tests and code review)
> **Predecessor:** Phases A-E complete, code review pass done
> **Estimated agents:** 6 (5 implementation + 1 review)
> **Risk Level:** MEDIUM (AI service changes, new data types, large UX flows)
> **Branch:** `feat/phase-f`
> **Git Strategy:** Commit-per-feature, merge to main after gate

---

## Phase Overview

Phase F transforms Realmweaver from a tool that helps DMs manage content into one
that actively generates and evolves content. Five features:

| Item | What | Effort | Dependencies |
|------|------|--------|-------------|
| F1 | First Campaign Wizard | Medium | Evocation Wizard (exists) |
| F2 | Template Campaigns | Medium | importExportService (exists) |
| F3 | World Simulation Engine | Large | AI services, campaignService |
| F4 | Content Style Matching | Large | AI services, contextBuilder |
| F5 | Cross-Campaign Dashboard | Large | campaignService, App routing |

---

## Step F1: First Campaign Wizard

**Agent:** frontend-engineer--realmweaver (sonnet)
**Depends on:** None
**Parallel with:** F2

### Deliverables

New component: `components/views/FirstCampaignWizard.tsx`

A conversational onboarding wizard triggered after creating a new campaign (when the campaign has 0 entities). Steps:

1. **"Tell me about your world"** — Large textarea, AI extracts setting tone, themes, and conflict seeds
2. **"Let's build your cast"** — AI suggests 3-5 starter NPCs based on setting. DM reviews, edits, approves. Uses Evocation Wizard batch generation under the hood.
3. **"Key locations"** — AI suggests 2-3 locations. Same review flow.
4. **"Your first adventure"** — AI generates a starter adventure with 3-4 scenes linking the NPCs and locations.
5. **"Ready to prep!"** — Summary of everything created. "Start Session Prep" button → opens Session Prep Wizard.

### Implementation Details

- Renders when `activeCampaign.npcs.length === 0 && activeCampaign.adventures.length === 0`
- Can be dismissed ("Skip — I'll build my own")
- Uses `generateCampaignFill` from evocationWizard.ts for batch generation
- Each step shows generated content as editable cards before saving
- Back/Next navigation between steps
- Progress bar at top

### Files
- `components/views/FirstCampaignWizard.tsx` (NEW, ~400 lines)
- `components/views/CampaignCreator.tsx` (trigger wizard after creation)
- `App.tsx` (route to wizard when campaign is empty)

---

## Step F2: Template Campaigns

**Agent:** frontend-engineer--realmweaver (sonnet)
**Depends on:** None
**Parallel with:** F1

### Deliverables

Pre-built campaign templates that give new DMs a running start.

### Templates (4)

1. **Classic Dungeon Crawl** — 3 NPCs (tavern keeper, quest giver, villain), 3 locations (village, dungeon entrance, boss chamber), 1 adventure with 4 scenes (hook, exploration, puzzle, boss fight)

2. **Political Intrigue** — 5 NPCs (noble, spy, merchant, guard captain, informant), 3 locations (palace, market district, underground tavern), 2 factions (ruling house, resistance), 1 adventure with 3 scenes (audience, investigation, revelation)

3. **Sandbox Exploration** — 4 NPCs (guide, hermit, trader, wandering knight), 5 locations (hub town, forest, ruins, cave, mountain pass), 2 plots (ancient evil stirring, missing caravan), no pre-built adventure (sandbox)

4. **One-Shot** — 3 NPCs, 2 locations, 1 tightly-paced adventure with 5 scenes (hook, 3 acts, climax). Designed to run in one session.

### Implementation

- Template data as JSON files in `data/templates/` directory
- Each template: `{ title, setting, settingType, npcs[], locations[], factions[], adventures[], plots[] }`
- Template selector card in CampaignCreator (shown before the setting input)
- "Use Template" loads the JSON via `campaignService.importTemplateData(templateData)`
- Templates set the campaign title and setting, then bulk-create entities

### Files
- `data/templates/dungeon-crawl.json` (NEW)
- `data/templates/political-intrigue.json` (NEW)
- `data/templates/sandbox-exploration.json` (NEW)
- `data/templates/one-shot.json` (NEW)
- `components/views/CampaignCreator.tsx` (template selector UI)
- `services/campaignService.ts` (add `importTemplateData` method)

---

## Step F3: World Simulation Engine

**Agent:** frontend-engineer--realmweaver (sonnet)
**Depends on:** F1, F2 (nice to have populated campaigns for testing)
**Parallel with:** F4

### Deliverables

AI generates "between-session" world events based on faction goals, NPC motivations, and campaign state.

### AI Service

New file: `services/ai/worldSimulation.ts`

```typescript
interface WorldEvent {
  id: string;
  title: string;
  description: string;        // What happened
  affectedEntityIds: string[]; // Which entities are affected
  affectedEntityTypes: string[];
  suggestedUpdates: Array<{    // Proposed changes to entities
    entityId: string;
    entityType: string;
    field: string;
    currentValue: string;
    proposedValue: string;
  }>;
  severity: 'minor' | 'major' | 'critical';
  category: 'faction' | 'npc' | 'location' | 'plot' | 'world';
}

export async function generateWorldEvents(
  campaign: Campaign,
  daysPassed: number,
  isMockMode: boolean,
  campaignContext?: string
): Promise<WorldEvent[]>
```

### Prompt Strategy

Feed the AI:
- Active factions with goals and tensions
- NPC motivations and unresolved plot threads
- Recent session events (last 2 recaps)
- Time elapsed since last session
- Ask: "What 2-4 events would realistically occur in this world over N days?"

### UI Component

New: `components/dialogs/WorldSimulationWizard.tsx`

1. **Trigger:** "What happened off-screen?" button in header or SessionPrepWizard
2. **Step 1:** Set time elapsed (slider: 1 day to 6 months)
3. **Step 2:** AI generates events (loading state with quill animation)
4. **Step 3:** Review events — each as a card with:
   - Title, description, severity badge
   - Affected entities as EntityLinks
   - Proposed changes shown as diff (old → new)
   - Approve / Reject / Edit buttons per event
5. **Step 4:** Apply approved events — calls campaignService to update entities

### Mock Service

`mockService.generateWorldEvents` returns 2-3 template events.

### Files
- `services/ai/worldSimulation.ts` (NEW)
- `services/ai/mockService.ts` (add mock events)
- `services/geminiService.ts` (add facade)
- `components/dialogs/WorldSimulationWizard.tsx` (NEW)
- `components/layout/Header.tsx` (add trigger button)
- `App.tsx` (modal state + rendering)

---

## Step F4: Content Style Matching

**Agent:** frontend-engineer--realmweaver (sonnet)
**Depends on:** None (uses existing AI services)
**Parallel with:** F3

### Deliverables

AI learns the DM's writing voice from existing entities and applies it to all future generation.

### Approach

**Style Profile Builder** (`services/ai/styleMatching.ts`):

1. Collect text samples: first 10 NPC descriptions, first 5 location descriptions, first 3 adventure hooks
2. Feed to AI: "Analyze this DM's writing style. Describe their voice, tone, vocabulary level, sentence structure, use of metaphor, and thematic preferences. Output a concise style guide (200 words max)."
3. Store the style profile as `campaign.styleProfile: string` (new optional field on Campaign)
4. Auto-generate profile when campaign has 5+ entities (triggered on entity creation)

**Style Integration:**

Inject the style profile into the `contextBuilder`:
- Add as a Tier 1 context item (always included)
- Prefix: "WRITING STYLE: Generate content matching this DM's voice: {styleProfile}"
- Only included when `styleProfile` exists and is non-empty

**Regeneration:**

- Button in Campaign Settings: "Regenerate Style Profile"
- Shows the current profile text (read-only)
- "Clear" button to remove and revert to default AI voice

### Files
- `services/ai/styleMatching.ts` (NEW — `analyzeStyle`, `buildStylePrompt`)
- `services/ai/mockService.ts` (mock style analysis)
- `services/geminiService.ts` (facade)
- `types/Campaign.ts` (add `styleProfile?: string`)
- `services/contextBuilder.ts` (inject style into Tier 1)
- `services/campaignService.ts` (add `setStyleProfile` method, auto-trigger)
- `components/editors/CampaignSettingEditor.tsx` (style profile display + regenerate)

---

## Step F5: Cross-Campaign Dashboard

**Agent:** frontend-engineer--realmweaver (sonnet)
**Depends on:** F1, F2 (better with multiple campaigns)

### Deliverables

A top-level view showing all campaigns at a glance with quick management.

### UI Component

New: `components/views/CrossCampaignDashboard.tsx`

**Layout:**
- Grid of campaign cards (responsive: 1/2/3 columns)
- Each card shows:
  - Campaign title + setting name
  - Entity counts (NPCs, locations, factions, adventures)
  - Last session date + session count
  - Active plots count + any loose ends
  - DM Style badge (guided/standard/power)
  - "Continue" button (switches to campaign)
  - "Duplicate" button (copies campaign)
  - "Delete" button (with confirmation)
- Sort: most recently accessed first
- "Create New Campaign" card at the end

**Entity Copy Between Campaigns:**
- "Copy Entity" action in entity editors (new button)
- Opens a modal: select target campaign → copies entity with new ID
- Handles dependencies: if NPC references faction, offer to copy faction too

### Integration
- Accessible from header "All Campaigns" link (when a campaign is active)
- Also the default view when `appStatus === 'selecting'`
- Replaces or enhances the existing CampaignSelector

### Files
- `components/views/CrossCampaignDashboard.tsx` (NEW)
- `App.tsx` (route, replace CampaignSelector usage)
- `services/campaignService.ts` (add `duplicateCampaign`, `copyEntityToCampaign`)
- `components/layout/Header.tsx` (add "All Campaigns" link)

---

## Execution Sequence

```
F1 (First Campaign Wizard) ──┐
F2 (Template Campaigns)      ──┤ [parallel, no shared files]
                               ↓
                        GATE 1 (build + test)
                               ↓
F3 (World Simulation) ────────┐
F4 (Style Matching)           ──┤ [parallel, minimal overlap]
                               ↓
                        GATE 2 (build + test)
                               ↓
F5 (Cross-Campaign Dashboard) ─── [sequential, touches App.tsx + campaignService]
                               ↓
                        FINAL GATE
```

## Gate Criteria

### Gate 1 (after F1 + F2)
- First Campaign Wizard produces a populated campaign from conversational flow
- All 4 templates load correctly and produce valid campaigns
- `npm run build` + `npm test` pass

### Gate 2 (after F3 + F4)
- World Simulation generates plausible events in mock mode
- Approved events correctly update campaign entities
- Style profile auto-generates after 5+ entities
- Style-aware generation produces tonally consistent content
- `npm run build` + `npm test` pass

### Final Gate (after F5)
- Cross-campaign dashboard shows all campaigns with correct stats
- Campaign duplication works
- Entity copy between campaigns works (with dependency handling)
- All existing E2E tests still pass
- `npm run build` + `npm test` pass

---

## Design Decisions (Pre-Resolved)

1. **First Campaign Wizard vs Template:** Both exist. Wizard is AI-conversational ("tell me about your world"). Templates are instant ("start from dungeon crawl"). User picks. They complement, not compete.

2. **World Simulation approval model:** DM reviews ALL events before they apply. No auto-application. This respects DM agency — "the AI suggests, the DM decides."

3. **Style profile storage:** Stored on Campaign, not user-level. Different campaigns may have different tones (gritty noir vs whimsical fairy tale).

4. **Entity copy dependency resolution:** Shallow copy by default (copy entity, clear broken references). Optional deep copy (copy referenced entities too). Prompt user to choose.
