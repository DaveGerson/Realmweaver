# CLAUDE.md - AI Assistant Guide for Realmweaver

> **Last Updated:** 2026-03-24
> **Purpose:** Comprehensive guide for AI assistants working with the Realmweaver codebase

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Quick Start](#quick-start)
3. [Project Structure](#project-structure)
4. [Architecture Patterns](#architecture-patterns)
5. [State Management](#state-management)
6. [AI Service Integration](#ai-service-integration)
7. [Component Patterns](#component-patterns)
8. [Type System](#type-system)
9. [Styling Conventions](#styling-conventions)
10. [Development Workflows](#development-workflows)
11. [Common Tasks](#common-tasks)
12. [Important Conventions](#important-conventions)
13. [Common Pitfalls](#common-pitfalls)

---

## Project Overview

**Realmweaver** is a single-page application (SPA) for tabletop RPG Game Masters to create, manage, and run campaigns using AI assistance.

### Tech Stack

- **Frontend:** React 19.2.0 with TypeScript 5.8.2
- **Build Tool:** Vite 6.2.0 + `vite-plugin-ai-proxy.ts` (Vite middleware for Claude CLI)
- **AI Integration:** Claude Code CLI (primary, via Vite proxy) / Anthropic REST API (future production path)
- **Styling:** Tailwind CSS (CDN via index.html)
- **State Management:** Custom store with Immer for immutable updates
- **Icons:** Lucide React 0.546.0
- **Graph Visualization:** React Flow 11.10.1, Dagre 0.8.5, D3 7.8.5
- **Utility:** tailwind-merge for className composition
- **Testing:** Vitest (unit tests) + Playwright (E2E tests)

### Key Features

- AI-powered content generation (NPCs, locations, factions, items, scenes, adventures, articles, plots)
- Campaign management with localStorage persistence (debounced auto-save)
- RealmChat conversational AI assistant for collaborative entity drafting
- DM Coach for in-session assistance (narration, dialogue, improv, rollable tables, skill checks)
- Evocation Wizard for batch world generation
- World Simulation Engine for time-skip events
- Content Style Matching (AI learns the DM's writing voice)
- Session log management with voice capture and note analysis
- First Campaign Wizard with guided world-building steps
- Plot tracking across sessions
- Combat tracker with encounter management
- Secrets & Clues tracker
- Relationship graph visualization (D3 and React Flow)
- Entity cross-linking (EntityLink, LinkedText, BacklinksPanel, EntityQuickCard hover)
- Entity history tracking and version management
- Player Character import (including PDF character sheet parsing)
- Mock mode for offline development and testing
- Import/Export functionality (JSON, Obsidian markdown)
- Continuity Checker (8 rule-based consistency checks)
- DM Style progressive disclosure (guided / standard / power)
- Command palette (Ctrl+K) with global entity search

---

## Quick Start

### Running the App

```bash
npm install
npm run dev    # Runs on http://localhost:3000
npm run build  # Production build
npm run preview # Preview production build
```

### Environment Setup

Create `.env.local` in the project root:

```env
# Primary AI backend (local development)
# Default is claude-cli; ensure the `claude` binary is on $PATH.
REALMWEAVER_AI_PROVIDER=claude-cli  # or 'anthropic-api'

# Only needed if REALMWEAVER_AI_PROVIDER=anthropic-api
# NOTE: NOT injected into client bundle for security; consumed by Vite middleware.
ANTHROPIC_API_KEY=your_anthropic_key_here

# Legacy; retained for backward compatibility in Vite define config
GEMINI_API_KEY=unused_but_may_be_present
```

### Mock Mode Toggle

The app includes a mock mode toggle in the header. Use this for:
- Testing without any AI API calls
- Offline development
- Running smoke tests

---

## Project Structure

### **CRITICAL:** No `src/` Directory

All application code lives at the **project root**, not in a `src/` directory.

```
/home/user/Realmweaver/
├── App.tsx                      # Root component: campaign state, isMockMode, top-level layout
├── index.tsx                    # React entry point
├── index.html                   # HTML template with Tailwind CDN
├── vite.config.ts               # Vite configuration (port 3000, path alias, env injection)
├── vite-plugin-ai-proxy.ts      # Vite middleware: bridges browser -> Claude CLI binary
├── tsconfig.json                # TypeScript configuration
├── package.json                 # Dependencies and scripts
├── smokeTest.ts                 # Built-in smoke tests
│
├── hooks/                       # Custom React hooks (extracted from App.tsx)
│   ├── useEntitySelection.ts    # Selected entity state + nav stack + breadcrumbs + recent items
│   ├── useModalState.ts         # Modal open/close lifecycle (all app modals)
│   ├── useConfirmDialog.ts      # Context-provider pattern for confirm dialogs
│   ├── useToast.ts              # Context-provider pattern for toast notifications
│   ├── useEntitySearch.ts       # Search/filter logic for dashboard entity lists
│   └── useRovingTabIndex.ts     # Keyboard navigation (roving tabindex pattern)
│
├── components/
│   ├── common/                  # Reusable primitives
│   │   ├── Button.tsx           # Styled button component
│   │   ├── Icons.tsx            # Centralized icon exports from lucide-react
│   │   ├── Textarea.tsx         # AiTextarea + exports inputBaseClasses, textareaBaseClasses
│   │   ├── EntityHistoryManager.tsx  # Entity version history tracking
│   │   ├── DialogShell.tsx      # Base modal wrapper (focus trap, Escape, ARIA, scroll lock)
│   │   ├── ConfirmDialog.tsx    # Confirmation modal (used via useConfirmDialog context)
│   │   ├── ToastContainer.tsx   # Toast notification renderer (used via useToast context)
│   │   ├── ErrorBoundary.tsx    # React error boundary for graceful error display
│   │   ├── EntityCreationPanel.tsx   # Chat-vs-form creation mode toggle for dashboards
│   │   ├── EntityLink.tsx       # Inline entity reference with hover QuickCard popover
│   │   ├── EntityQuickCard.tsx  # Floating entity preview card (portal-rendered)
│   │   ├── BacklinksPanel.tsx   # "Referenced By" panel showing inbound entity references
│   │   ├── LinkedText.tsx       # Auto-detect entity names in text and linkify them
│   │   ├── MentionInput.tsx     # Textarea with @mention autocomplete
│   │   ├── CommandPalette.tsx   # Ctrl+K global search across all entity types
│   │   ├── Breadcrumbs.tsx      # Navigation breadcrumb trail
│   │   ├── RegenerateButton.tsx # Inline AI field regeneration button with preview
│   │   ├── SkeletonCard.tsx     # Loading skeleton placeholder
│   │   ├── TabLayout.tsx        # Reusable tabbed panel layout
│   │   ├── DmStylePanel.tsx     # DM Style settings panel (guided/standard/power)
│   │   ├── GenerateHerePanel.tsx # Inline generation trigger panel
│   │   ├── SceneResourcesPanel.tsx # Collapsible in-editor NPC/location reference panel
│   │   └── KeyboardShortcutsHelp.tsx # Keyboard shortcut reference overlay
│   │
│   ├── layout/                  # App shell
│   │   ├── Header.tsx           # Top bar with tools access
│   │   ├── CampaignSidebar.tsx  # Left sidebar navigation (orchestrates sidebar/ sub-components)
│   │   ├── ContentWrapper.tsx   # Main content area wrapper
│   │   ├── ViewRouter.tsx       # Renders the active EditorView (extracted from App.tsx)
│   │   └── sidebar/             # Sidebar sub-components
│   │       ├── SidebarEntityList.tsx # Scrollable entity list with selection
│   │       ├── SidebarSearch.tsx     # Inline sidebar search/filter input
│   │       ├── PinnedEntities.tsx    # Pinned entity favorites section
│   │       ├── RecentItems.tsx       # Recent entity history section
│   │       ├── ArticleTreeItem.tsx   # Recursive article tree node
│   │       └── sidebarUtils.ts      # Sidebar-specific helper functions
│   │
│   ├── views/                   # High-level screens
│   │   ├── WelcomeScreen.tsx    # Landing page
│   │   ├── CampaignCreator.tsx  # New campaign setup
│   │   ├── FirstCampaignWizard.tsx  # Guided 5-step world-building onboarding
│   │   ├── CrossCampaignDashboard.tsx # Multi-campaign overview
│   │   ├── SessionRunner.tsx    # Live session management (orchestrates session/ sub-components)
│   │   └── session/             # SessionRunner sub-components
│   │       ├── ActiveScenePanel.tsx  # Currently active scene display
│   │       ├── SceneListPanel.tsx    # Ordered scene navigation list
│   │       ├── RunningLog.tsx        # Freeform session notes capture
│   │       ├── QuickToolsPanel.tsx   # Inline DM tools (dice, tables, etc.)
│   │       └── QuickNpcGenerator.tsx # In-session quick NPC creation
│   │
│   ├── dashboards/              # List views with embedded generators
│   │   ├── NpcDashboard.tsx
│   │   ├── LocationDashboard.tsx
│   │   ├── FactionDashboard.tsx
│   │   ├── ItemDashboard.tsx
│   │   ├── AdventureDashboard.tsx
│   │   ├── ArticleDashboard.tsx
│   │   ├── SessionLogDashboard.tsx
│   │   ├── PlayerCharacterDashboard.tsx
│   │   ├── PlotDashboard.tsx
│   │   └── NoteDashboard.tsx
│   │
│   ├── generators/              # AI creation forms
│   │   ├── NpcGenerator.tsx
│   │   ├── LocationGenerator.tsx
│   │   ├── FactionGenerator.tsx
│   │   ├── ItemGenerator.tsx
│   │   ├── SceneGenerator.tsx
│   │   ├── AdventureGenerator.tsx
│   │   ├── ArticleGenerator.tsx
│   │   ├── PlayerCharacterImporter.tsx
│   │   └── EntityChatGenerator.tsx  # Chat-based entity creation (used inside EntityCreationPanel)
│   │
│   ├── editors/                 # Detail editing views
│   │   ├── NpcEditor.tsx
│   │   ├── LocationEditor.tsx
│   │   ├── FactionEditor.tsx
│   │   ├── ItemEditor.tsx
│   │   ├── AdventureEditor.tsx
│   │   ├── SceneEditor.tsx
│   │   ├── ArticleEditor.tsx
│   │   ├── SessionLogEditor.tsx
│   │   ├── PlayerCharacterEditor.tsx
│   │   ├── PlotEditor.tsx
│   │   ├── NoteEditor.tsx
│   │   ├── CampaignSettingEditor.tsx
│   │   └── PrepDocumentView.tsx     # Adventure prep document renderer
│   │
│   ├── dialogs/                 # Modal components (all use DialogShell)
│   │   ├── DmCoach.tsx          # In-session DM assistance tool
│   │   ├── EvocationWizard.tsx  # Batch generation wizard
│   │   ├── WorldSimulationWizard.tsx # World event simulation
│   │   ├── ContinuityChecker.tsx # Campaign consistency checker
│   │   ├── SessionPrepWizard.tsx # 5-step session prep flow
│   │   ├── SessionEndWizard.tsx  # Post-session recap and cleanup
│   │   └── ExportModal.tsx      # Export format selection
│   │
│   ├── tools/                   # Gameplay tools
│   │   ├── CombatTracker.tsx    # Initiative and encounter tracking
│   │   ├── DiceRoller.tsx       # Dice rolling utility
│   │   └── SecretsTracker.tsx   # Secrets & clues management
│   │
│   ├── visualizers/             # Data visualization
│   │   ├── RelationshipGraph.tsx # Entity relationship graph (D3-based)
│   │   └── PlotTimeline.tsx     # Cross-session plot timeline
│   │
│   └── RealmChat/               # Conversational AI widget
│       └── RealmChatWidget.tsx  # Floating chat assistant (indigo accent ONLY here)
│
├── services/
│   ├── campaignService.ts       # Central state management
│   ├── aiService.ts             # AI service facade (mock/real routing) -- THE FACADE
│   ├── contextBuilder.ts        # Tiered token-budget-aware AI context assembly
│   ├── continuityChecker.ts     # Rule-based campaign consistency checker (pure function)
│   ├── importExportService.ts   # Import/export functionality
│   └── ai/                      # AI implementation modules
│       ├── core.ts              # Backward-compat adapter over provider registry
│       ├── modelConfig.ts       # ModelTier definitions + provider config from env vars
│       ├── realmWeaver.ts       # Entity generation
│       ├── dmCoach.ts           # In-session DM assistance
│       ├── evocationWizard.ts   # Batch generation & parsing
│       ├── realmChat.ts         # Conversational AI service
│       ├── worldSimulation.ts   # World event simulation
│       ├── styleMatching.ts     # DM writing style analysis
│       ├── mockService.ts       # Mock data for testing
│       └── providers/           # AI provider backends
│           ├── types.ts         # AIProvider interface + option types
│           ├── registry.ts      # Provider registry singleton (default: claude-cli)
│           ├── claude-cli.ts    # Claude CLI provider (via Vite proxy at /api/ai/generate)
│           ├── anthropic-api.ts # Anthropic API provider (stub, future production path)
│           └── retry.ts         # Transient failure retry logic
│
├── types/                       # TypeScript type definitions
│   ├── index.ts                 # Barrel export file
│   ├── common.ts                # Shared primitive types
│   ├── Campaign.ts              # Root campaign type
│   ├── NPC.ts
│   ├── Location.ts
│   ├── Faction.ts
│   ├── Item.ts
│   ├── Adventure.ts
│   ├── Scene.ts
│   ├── Article.ts
│   ├── SessionLog.ts
│   ├── PlayerCharacter.ts
│   ├── Plot.ts
│   ├── Note.ts
│   ├── Secret.ts                # Secrets & clues type
│   ├── Encounter.ts
│   ├── CampaignSetting.ts       # DmStyle type
│   ├── Evocation.ts             # Evocation wizard types
│   ├── RealmChat.ts             # Chat message types
│   ├── RollableTable.ts
│   ├── SkillCheck.ts
│   ├── DiceRoll.ts
│   └── Graph.ts                 # Relationship graph types
│
└── utils/
    ├── entityUtils.ts           # Default entity factories + ENTITY_TYPE_CONFIG
    ├── entityDetailExtractors.ts # Extract display strings from entity fields
    ├── entityFieldSave.ts       # Dispatch field saves to campaignService by entity type
    ├── backlinkUtils.ts         # Compute inbound entity cross-references
    ├── dmStyleUtils.ts          # Feature visibility rules for DM Style modes
    ├── demoTemplates.ts         # Starter demo content for onboarding
    ├── diceUtils.ts             # Dice formula parsing and rolling
    ├── keyboardShortcuts.ts     # Keyboard shortcut definitions and matching
    └── popoverPosition.ts       # Calculate popover/tooltip screen coordinates
```

### Import Path Alias

The project uses `@/` as an alias for the project root (configured in both `tsconfig.json` and `vite.config.ts`):

```typescript
import { Button } from '@/components/common/Button';
import type { NPC } from '@/types/index';
```

---

## Architecture Patterns

### 1. Factory-Based State Store

**Location:** `services/campaignService.ts`

```typescript
export function createCampaignStore(config: { persist?: boolean } = {}) {
    let state: CampaignState = { ... };
    const listeners = new Set<() => void>();

    // Triggers debounced auto-save to localStorage (2 second delay)
    const updateState = (updater: (draft: CampaignState) => void) => {
        state = produce(state, updater);
        notify();
        scheduleSave();
    };

    // Internal updates bypass auto-save (for meta-state like saveStatus)
    const _internalUpdate = (updater: (draft: CampaignState) => void) => {
        state = produce(state, updater);
        notify();
    };

    return service; // Returns public API
}

export const campaignService = createCampaignStore(); // Singleton
```

**Key details:**
- `updateState()` triggers debounced auto-save to localStorage
- `_internalUpdate()` updates state without triggering save (for `saveStatus`, `appStatus`)
- Factory pattern with `{ persist: false }` option for isolated test instances
- Storage keys: `realmweaver-campaigns` and `realmweaver-active-campaign-id`

### 2. React Integration Pattern

**Location:** `App.tsx`

```typescript
const { campaigns, activeCampaignId, appStatus, saveStatus, lastSavedAt } = useSyncExternalStore(
    campaignService.subscribe,
    campaignService.getState
);
```

### 3. AI Service Architecture (Post-Migration)

The AI backend migrated from Google Gemini to Claude Code CLI. The service layer is:

```
Component
    |
    v
services/aiService.ts           -- FACADE (mock/real routing; import only this in components)
    |
    v
services/ai/core.ts             -- Backward-compat adapter (preserves 3 function signatures)
    |
    v
services/ai/providers/registry  -- Provider registry (default: claude-cli)
    |
    +-- providers/claude-cli.ts    -- Claude CLI via Vite proxy (/api/ai/generate)
    +-- providers/anthropic-api.ts -- Anthropic REST API (stub, future production)
```

**MANDATORY: Always go through `aiService.ts`.**

```typescript
// CORRECT -- components import from the facade
import { generateNpc } from '@/services/aiService';

// WRONG -- never import from ai/ modules directly in components
import { generateNpc } from '@/services/ai/realmWeaver';
```

**Model tiers** replace Gemini model names:

| Tier | Claude CLI alias | Anthropic API model |
|------|-----------------|---------------------|
| `lite` | `haiku` | `claude-haiku-4-5-20251001` |
| `standard` | `sonnet` | `claude-sonnet-4-6` |
| `quality` | `opus` | `claude-opus-4-6` |

The `core.ts` adapter maps legacy Gemini model name strings (e.g., `'gemini-2.5-flash'`) to tiers automatically, so existing service modules continue to work unchanged.

### 4. App.tsx Decomposition

`App.tsx` was decomposed from ~1165 lines to ~564 lines by extracting responsibilities:

- **`hooks/useEntitySelection.ts`** — manages all selected entity IDs, nav stack, breadcrumb segments, and recent items
- **`hooks/useModalState.ts`** — manages open/close state for all app modals with `closeTopModal()` priority logic
- **`components/layout/ViewRouter.tsx`** — renders the correct dashboard or editor for the active `EditorView`

### 5. SessionRunner Decomposition

`components/views/SessionRunner.tsx` orchestrates five focused sub-components in `components/views/session/`:

| Sub-component | Responsibility |
|---------------|----------------|
| `ActiveScenePanel` | Displays the currently active scene with read-aloud text |
| `SceneListPanel` | Shows the ordered scene list and handles scene selection |
| `RunningLog` | Freeform note capture during session |
| `QuickToolsPanel` | Inline DM tools (dice, rollable tables, improv prompts) |
| `QuickNpcGenerator` | In-session rapid NPC creation without leaving the runner |

### 6. CampaignSidebar Decomposition

`CampaignSidebar.tsx` orchestrates sub-components in `components/layout/sidebar/`:

| Sub-component | Responsibility |
|---------------|----------------|
| `SidebarEntityList` | Scrollable, selectable entity list per section |
| `SidebarSearch` | Inline search/filter input |
| `PinnedEntities` | Pinned favorites section |
| `RecentItems` | Recently visited entity history |
| `ArticleTreeItem` | Recursive tree node for nested articles |
| `sidebarUtils.ts` | Sidebar-specific helpers (sorting, grouping) |

### 7. Dialog System

All modals compose `DialogShell` as a base wrapper for consistent focus trap, Escape-to-close, body scroll lock, and ARIA roles:

```typescript
import { DialogShell } from '@/components/common/DialogShell';

const MyDialog: React.FC<Props> = ({ isOpen, onClose }) => (
  <DialogShell isOpen={isOpen} onClose={onClose} ariaLabel="My Dialog">
    {/* dialog content */}
  </DialogShell>
);
```

For destructive confirmations, use `useConfirmDialog` (context-provider pattern, provider in `index.tsx`):

```typescript
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

const { confirm } = useConfirmDialog();
const ok = await confirm('Delete NPC?', 'This cannot be undone.', { variant: 'danger' });
if (ok) campaignService.deleteNpc(id);
```

For user feedback, use `useToast` (context-provider pattern, provider in `index.tsx`):

```typescript
import { useToast } from '@/hooks/useToast';

const { addToast } = useToast();
addToast('NPC saved', 'success');
```

### 8. ErrorBoundary Wrapping

`components/common/ErrorBoundary.tsx` wraps major view sections. A crash in one panel does not take down the whole app. Wrap top-level route regions and any component that fetches/processes external data.

### 9. EntityCreationPanel

Dashboards embed a creation panel with two modes — chat (via `EntityChatGenerator`) and form (via the entity-specific generator). `EntityCreationPanel` handles the mode toggle:

```typescript
import { EntityCreationPanel } from '@/components/common/EntityCreationPanel';

<EntityCreationPanel
  entityLabel="NPC"
  chatPanel={<EntityChatGenerator ... />}
  formPanel={<NpcGenerator ... />}
/>
```

### 10. Data Flow Pattern

**Unidirectional:**

```
User Action -> Component -> campaignService method -> Immer update ->
debounced localStorage save -> Notify subscribers -> React re-render
```

**Relationship Management:**
- Bidirectional syncing (NPCs <-> Factions via `_synchronizeNpcFactionLink`)
- Cycle detection (Location parent-child relationships)
- Cascade deletion (removing entities cleans up references in all related entities)

---

## State Management

### CampaignService API

**Location:** `services/campaignService.ts`

#### State Shape

```typescript
type CampaignState = {
  campaigns: Campaign[];
  activeCampaignId: string | null;
  appStatus: 'loading' | 'welcome' | 'selecting' | 'creating' | 'editing';
  saveStatus: 'idle' | 'saved' | 'saving' | 'error';
  lastSavedAt: string | null;
};
```

#### Core Methods

```typescript
// Campaign CRUD
campaignService.createCampaign(title, setting, settingType, officialSetting)
campaignService.switchCampaign(campaignId)
campaignService.updateCampaign(updates)
campaignService.deleteCampaign(campaignId)

// Entity CRUD (same pattern for all entity types)
campaignService.createNpc(npcData)
campaignService.updateNpc(id, updates)
campaignService.deleteNpc(id)              // Auto-cleans relationships

// Similar CRUD for: Location, Faction, Item, Adventure, Scene,
// Article, SessionLog, PlayerCharacter, Plot, Note, Secret

// Relationship Management
campaignService.linkNpcToFaction(npcId, factionId)
campaignService.unlinkNpcFromFaction(npcId)
campaignService.linkSceneToLocation(sceneId, locationId)
campaignService.linkSceneToNpcs(sceneId, npcIds)
campaignService.setLocationParent(locationId, parentId)
campaignService.removeLocationParent(locationId)

// State Access
campaignService.getState()
campaignService.getActiveCampaign()
campaignService.subscribe(listener)
```

#### Entity Types

All entity types follow the same CRUD pattern:
- NPCs, Locations, Factions, Items
- Adventures (contain Scenes)
- Articles (lore entries with hierarchy)
- Session Logs (with note analysis and voice capture)
- Player Characters
- Plots (cross-session tracking)
- Notes (quick freeform notes)
- Secrets (DM secrets and clues with reveal tracking)
- Encounters (combat tracking, stored on `Campaign.activeEncounter`)

### Important State Rules

1. **Never mutate state directly** — Always use `campaignService` methods (Immer handles immutability internally)
2. **UI state lives in components** — Active view, selected entity IDs, modal states, and `isMockMode` are managed via React `useState` or custom hooks
3. **Domain state lives in campaignService** — Campaign data, entity relationships, persistence
4. **Relationship syncing is automatic** — Linking an NPC to a faction automatically updates both sides

---

## AI Service Integration

### Service Facade: `services/aiService.ts`

This is the single entry point for all AI calls from components. The file was previously named `geminiService.ts`; it was renamed during the Claude migration.

```typescript
// Facade routing pattern
export const generateNpc = (prompt: string, isMockMode = false, campaignContext?: string) => {
  if (isMockMode) return mockService.generateNpc(prompt, false, campaignContext);
  return aiRealmWeaver.generateNpc(prompt, campaignContext);
};
```

**Functions exported from `aiService.ts`:**

| Function | Domain Module | Output |
|----------|--------------|--------|
| `generateNpc` | `realmWeaver` | `Omit<NPC, 'id' \| 'factionId'>` |
| `generateLocation` | `realmWeaver` | `Omit<Location, 'id' \| ...>` |
| `generateFaction` | `realmWeaver` | `Omit<Faction, 'id' \| ...>` |
| `generateItem` | `realmWeaver` | `Omit<Item, 'id'>` |
| `generateScene` | `realmWeaver` | `Omit<Scene, 'id' \| ...>` |
| `generateAdventure` | `realmWeaver` | `AdventureForBatchAdd` |
| `generateArticle` | `realmWeaver` | `Omit<Article, 'id' \| ...>` |
| `generatePoiFromLoot` | `realmWeaver` | `Omit<PointOfInterest, 'id'>` |
| `generateNarration` | `dmCoach` | `string` |
| `generateImprovisation` | `dmCoach` | `string` |
| `generateRollableTable` | `dmCoach` | `RollableTable` |
| `generateEnhancedText` | `dmCoach` | `string` |
| `generateSessionRecap` | `dmCoach` | `{ recap, looseEnds, playerFacingRecap }` |
| `analyzeSessionNotes` | `dmCoach` | `{ entries: ... }` |
| `generateNpcRoleplay` | `realmChat` | `{ dialogue, moodCue }` |
| `chatWithRealmWeaver` | `realmChat` | `RealmChatResponse` |
| `generateCampaignFill` | `evocationWizard` | `BatchAddData` |
| `parseDocumentForEntities` | `evocationWizard` | `BatchAddData` |
| `generateChatResponse` | `evocationWizard` | `string` |
| `parseCharacterSheetPdf` | `evocationWizard` | `Omit<PlayerCharacter, 'id'>` |
| `generateStarterNpcs` | `evocationWizard` | `NPC[]` |
| `generateStarterLocations` | `evocationWizard` | `Location[]` |
| `generateStarterAdventure` | `evocationWizard` | `AdventureForBatchAdd` |
| `analyzeWritingStyle` | `styleMatching` | `string` (200-word style guide) |

### AI Domain Modules (`services/ai/`)

| Module | Responsibility |
|--------|---------------|
| `core.ts` | Backward-compat adapter; preserves `generateWithSchema`, `generateText`, `generateChatCompletion` signatures; delegates to active provider via registry |
| `modelConfig.ts` | `ModelTier` type, tier-to-model mappings for CLI and API, provider config from env vars |
| `realmWeaver.ts` | All entity generation with JSON schemas and "Prep Architect" system prompt |
| `dmCoach.ts` | In-session tools: narration, improv, rollable tables, session recap, note analysis |
| `realmChat.ts` | Multi-turn conversational AI (RealmChat widget, NPC roleplay) |
| `evocationWizard.ts` | Batch ops: world fill, document parsing, PDF character sheet, starter world |
| `worldSimulation.ts` | World event generation for time-skip simulation |
| `styleMatching.ts` | DM writing style analysis (200-word style guide output) |
| `mockService.ts` | Static mock data for every AI function; used for offline dev and smoke tests |
| `providers/registry.ts` | Active provider singleton (default: `claude-cli`) |
| `providers/claude-cli.ts` | HTTP POST to Vite proxy `/api/ai/generate` which spawns `claude` CLI binary |
| `providers/anthropic-api.ts` | Stub for future Anthropic REST API production path |

### Campaign Context

`services/contextBuilder.ts` provides a tiered, token-budget-aware context assembly function:
- **Tier 1 (always):** Setting, style profile, active scene and session
- **Tier 2 (contextual):** Scene NPCs, location details, active plots
- **Tier 3 (on-demand):** Full entity overviews

Every AI function accepts an optional `campaignContext` string. Always pass it from `buildCampaignContext(activeCampaign)` in `utils/entityUtils.ts` or the tiered builder.

### Adding a New AI Function

1. Add the real implementation in the appropriate `services/ai/[module].ts`
2. Add a mock version in `services/ai/mockService.ts`
3. Add the facade function in `services/aiService.ts` with mock/real switching
4. Call from components only through `aiService.ts`

---

## Component Patterns

### Three-Tier Component Hierarchy

#### 1. Dashboards (`components/dashboards/`)

Show list of entities with embedded creation panel. All dashboards use:
- `EntityCreationPanel` for the chat/form creation toggle
- `useEntitySearch` for search/filter

```typescript
<EntityCreationPanel
  entityLabel="NPC"
  chatPanel={<EntityChatGenerator ... />}
  formPanel={<NpcGenerator onNpcCreated={handleCreated} isMockMode={isMockMode} campaignContext={campaignContext} />}
/>
```

#### 2. Generators (`components/generators/`)

AI-powered creation forms. Accept `isMockMode` and `campaignContext` props. Call `aiService` functions and return created entities via callbacks.

```typescript
const NpcGenerator: React.FC<Props> = ({ onNpcCreated, isMockMode, campaignContext }) => {
  const handleGenerate = async () => {
    const npcData = await generateNpc(prompt, isMockMode, campaignContext);
    onNpcCreated(npcData);
  };
};
```

#### 3. Editors (`components/editors/`)

Detail editing views with tabbed layouts and inline AI-assist. Pattern:

```typescript
const NpcEditor: React.FC<Props> = ({ npc, onUpdate, onDelete, isMockMode, campaignContext, onNavigate }) => {
  // onUpdate calls campaignService.updateNpc(id, updates)
  // onNavigate: (entityType: string, entityId: string) => void -- for EntityLink navigation
};
```

All editors accept an `onNavigate` callback for `EntityLink` clicks.

### EditorView Type

Defined in `App.tsx`. New views require an entry here AND in `ViewRouter.tsx`:

```typescript
export type EditorView = 'setting' | 'npcs' | 'locations' | 'factions' | 'items' |
  'adventures' | 'lorebook' | 'session-logs' | 'player-characters' | 'plots' |
  'combat' | 'relationships' | 'session-runner' | 'secrets';
```

### Navigation Callback Pattern

Editors receive an `onNavigate` callback for EntityLink click handling:

```typescript
onNavigate: (entityType: string, entityId: string) => void
```

In App.tsx this maps to `handleEntityNavigate` from `useEntitySelection`, which sets the appropriate view and selected ID.

### Icon Imports

**All icons must be imported from `components/common/Icons.tsx`**, which re-exports from `lucide-react`.

```typescript
// CORRECT
import { Icons } from '@/components/common/Icons';

// WRONG
import { Plus, Trash } from 'lucide-react';
```

### useEntitySearch for Dashboard Lists

```typescript
import { useEntitySearch } from '@/hooks/useEntitySearch';

const { filteredEntities, searchTerm, setSearchTerm } = useEntitySearch(
  campaign.npcs,
  ['name', 'description', 'traits']
);
```

---

## Type System

### Entity Type Pattern

Each entity has its own file in `types/` and is re-exported via `types/index.ts`.

**All entities must have at minimum:**
- `id: string` — Unique identifier (UUID generated by campaignService)
- `name: string` — Display name

**Full Campaign type shape:**

```typescript
interface Campaign {
  id: string;
  title: string;
  settingType: 'custom' | 'official';
  officialSetting?: string;
  setting: string;
  articles: Article[];
  adventures: Adventure[];
  npcs: NPC[];
  locations: Location[];
  factions: Faction[];
  items: Item[];
  sessionLogs: SessionLog[];
  playerCharacters: PlayerCharacter[];
  plots: Plot[];
  notes: Note[];
  secrets?: Secret[];
  activeEncounter?: Encounter;
  activeSceneId?: string;
  activeSessionId?: string;
  pinnedEntities?: Array<{ type: string; id: string }>;
  dmStyle?: DmStyle;               // 'guided' | 'standard' | 'power'
  featureOverrides?: Record<string, boolean>;
  wizardDismissed?: boolean;
  styleProfile?: string;           // AI-learned DM writing voice
  gcpApiKey?: string;              // For optional real-time audio transcription
}
```

### Adding a New Entity Type (13-Step Pattern)

1. Create `types/NewEntity.ts` with the interface (must have `id: string`, `name: string`)
2. Add `export * from './NewEntity'` to `types/index.ts`
3. Add the array to the `Campaign` interface in `types/Campaign.ts`
4. Add CRUD methods in `services/campaignService.ts`
5. Add mock data in `services/ai/mockService.ts`
6. Add facade function in `services/aiService.ts`
7. Add default factory in `utils/entityUtils.ts`
8. Add an entry to `ENTITY_TYPE_CONFIG` in `utils/entityUtils.ts` (icon name, color token, label)
9. Create `components/generators/NewEntityGenerator.tsx`
10. Create `components/dashboards/NewEntityDashboard.tsx` — use `EntityCreationPanel` and `useEntitySearch`
11. Create `components/editors/NewEntityEditor.tsx`
12. Add view routing in `components/layout/ViewRouter.tsx` AND add `EditorView` value in `App.tsx`
13. Add sidebar entry in `components/layout/CampaignSidebar.tsx`

---

## Styling Conventions

### Tailwind CSS (CDN)

Tailwind is loaded via CDN in `index.html`, not as a build dependency. This means:
- No `tailwind.config.js` file
- No PostCSS processing
- Classes are applied inline using standard Tailwind utility classes
- Use `tailwind-merge` for conditional className composition

### Design Tokens (slate + amber dark theme)

```
bg-slate-900    -- page background
bg-slate-800    -- card/panel background
bg-slate-700    -- secondary button, hover: bg-slate-600
bg-slate-950    -- deepest background (rare)

text-slate-100  -- primary text
text-slate-300  -- secondary text
text-slate-400  -- muted/placeholder text
text-amber-400  -- accent text, hover: text-amber-300

bg-amber-600    -- primary button, hover: bg-amber-500

border-slate-700  -- card borders and separators
border-slate-600  -- form input borders

rounded-lg  -- cards and panels
rounded-md  -- inputs and smaller elements
```

**Note:** Use `slate-*` color tokens. Earlier documentation mentioned `stone-*` but the codebase uses `slate-*` throughout.

### Input/Textarea Base Classes

`components/common/Textarea.tsx` exports two shared class strings for consistent form field styling:

```typescript
import { inputBaseClasses, textareaBaseClasses } from '@/components/common/Textarea';

// inputBaseClasses:
//   bg-slate-800 border border-slate-600 rounded-lg text-slate-100
//   placeholder-slate-400 focus:ring-2 focus:ring-amber-500/50
//   focus:border-amber-500/50 focus:outline-none

// textareaBaseClasses: same as inputBaseClasses + resize-none

<input className={`${inputBaseClasses} px-3 py-2`} />
<textarea className={`${textareaBaseClasses} p-3 h-24`} />
```

Use these instead of hand-rolling input styles in new components.

### ENTITY_TYPE_CONFIG

`utils/entityUtils.ts` exports `ENTITY_TYPE_CONFIG` as the single source of truth for entity type metadata:

```typescript
import { ENTITY_TYPE_CONFIG } from '@/utils/entityUtils';

const config = ENTITY_TYPE_CONFIG['npc'];  // { icon: 'NPCs', color: 'amber', label: 'NPCs' }
// Derive shades: `text-${config.color}-400`, `bg-${config.color}-900/60`
```

Entity type colors:

| Type key | Color |
|----------|-------|
| `npc` | amber |
| `location` | emerald |
| `faction` | violet |
| `item` | sky |
| `adventure` | orange |
| `article` | cyan |
| `sessionLog` / `session-log` | rose |
| `playerCharacter` / `player-character` | teal |
| `plot` | yellow |
| `note` | slate |

### Indigo Exception

Indigo is used **only** in `RealmChatWidget.tsx` to visually distinguish the AI assistant from the rest of the app. All other interactive accents, icons, and highlights use amber. Do not add indigo to any other component.

---

## Development Workflows

### Build & Run

```bash
npm run dev         # Start dev server on port 3000
npm run build       # Production build (vite build)
npm run preview     # Preview production build
npm test            # Run Vitest unit tests once
npm run test:watch  # Vitest watch mode
npm run test:e2e    # Playwright E2E tests
npm run test:e2e:headed  # E2E with visible browser
```

### TypeScript

- Strict mode is not explicitly enabled in tsconfig
- Uses `ES2022` target with `bundler` module resolution
- Path alias `@/*` maps to project root
- `allowImportingTsExtensions: true` — `.ts`/`.tsx` extensions allowed in imports
- `noEmit: true` — TypeScript does type checking only, Vite handles transpilation

### Testing Layers

| Layer | Framework | Location | Scope |
|-------|-----------|----------|-------|
| Unit | Vitest | `tests/` | Services, utilities, context builder, archetype scenarios |
| E2E | Playwright | `e2e/` | Campaign lifecycle, entity CRUD, navigation, session runner, DM tools |
| Smoke | `smokeTest.ts` | App startup | Service function availability, entity operations |
| Manual | Mock mode | Browser | Full app testing without any AI API key |

### Code Style

- 2-space or 4-space indentation (match existing file style)
- Single quotes for imports
- Named exports only (no `export default`)
- `React.FC<Props>` pattern for component typing

---

## Common Tasks

### Adding a New AI Generation Function

1. Add the real implementation in the appropriate `services/ai/[module].ts`
2. Add a mock version in `services/ai/mockService.ts`
3. Add the facade function in `services/aiService.ts` with mock mode switching
4. Call from components only through `aiService.ts`

### Adding a New View to the Sidebar

1. Add the view name to `EditorView` type in `App.tsx`
2. Add rendering logic in `components/layout/ViewRouter.tsx`
3. Add sidebar entry in `components/layout/CampaignSidebar.tsx`

### Working with Entity Relationships

```typescript
// Link NPC to faction (auto-syncs both sides)
campaignService.linkNpcToFaction(npcId, factionId);

// Set location hierarchy (with cycle detection)
campaignService.setLocationParent(childId, parentId);

// Link scene to NPCs and location
campaignService.linkSceneToNpcs(sceneId, npcIds);
campaignService.linkSceneToLocation(sceneId, locationId);
```

### Building Campaign Context for AI Calls

```typescript
// Simple version (entity names only)
import { buildCampaignContext } from '@/utils/entityUtils';
const campaignContext = buildCampaignContext(activeCampaign);

// Tiered version (token-budget-aware)
import { buildCampaignContext } from '@/services/contextBuilder';
const campaignContext = buildCampaignContext(activeCampaign, 'generation', 4000);
// variant: 'generation' | 'coach' | 'chat'
```

---

## Important Conventions

1. **No `src/` directory** — All code is at the project root
2. **Icons through `Icons.tsx`** — Never import directly from `lucide-react`
3. **Types through `types/index.ts`** — Use the barrel export for all type imports
4. **Named exports only** — Components use `export const ComponentName` not `export default`
5. **AI facade pattern** — All AI calls go through `services/aiService.ts`, never call `ai/` modules directly from components
6. **Mock mode support** — Every AI function must have a mock implementation in `mockService.ts`
7. **Campaign context** — Always pass campaign context to AI functions for world consistency
8. **Immer for state updates** — Never mutate state directly; use campaignService methods
9. **`useSyncExternalStore`** — Components subscribe to campaignService state via this React hook
10. **Entity defaults in `entityUtils.ts`** — Use factory functions for new entity creation
11. **All modals must use `DialogShell`** — For focus trap, Escape key dismiss, and ARIA attributes
12. **Use `useConfirmDialog` instead of `window.confirm`** — Context-provider pattern; provides branded UI
13. **Use `useToast` instead of `window.alert`** — Context-provider pattern; non-blocking feedback
14. **`ENTITY_TYPE_CONFIG` is the single source of truth for entity colors and icons** — Derive from it, never hardcode
15. **Use `slate` not `stone` for color tokens** — The codebase uses `slate-*` despite earlier docs
16. **Update `ViewRouter.tsx`** — New views must be added to `ViewRouter.tsx`, not just `App.tsx`
17. **`EntityCreationPanel` for dashboards** — Use this component for the chat/form toggle in all dashboards

---

## Documentation Maintenance (MANDATORY)

When completing work that changes the architecture, adds features, or modifies key patterns, **update the relevant documentation before committing**:

| What Changed | Update These Docs |
|-------------|------------------|
| New component, service, or type | `docs/architecture/high-level-design.md` (feature map, project structure) |
| Architecture pattern change | `docs/architecture/high-level-design.md` + `docs/architecture/technical-design.md` |
| New entity type or data model change | `docs/architecture/high-level-design.md` (data model section) + `CLAUDE.md` (type system) |
| New AI service function | `CLAUDE.md` (AI Service Integration section) |
| New testing infrastructure | `docs/architecture/high-level-design.md` (testing strategy) |
| Major feature completion | `README.md` (features table, project status) |

### Documentation Structure

```
docs/
├── architecture/
│   ├── high-level-design.md       # System overview, diagrams, data model, feature map
│   ├── technical-design.md        # Detailed technical design, patterns, subsystems
│   └── implementation-plan.md     # Phased plan with work packages (Phases A-F)
├── design/
│   ├── dm-archetypes.md           # 5 DM personas driving feature prioritization
│   └── session-cockpit-review.md  # 67 user stories and priority matrix
└── USER_GUIDE.md                  # End-user guide
```

---

## Common Pitfalls

1. **Creating files in `src/`** — There is no `src/` directory. All code lives at root.
2. **Importing icons from `lucide-react`** — Always use `components/common/Icons.tsx`.
3. **Calling AI services directly** — Always go through `services/aiService.ts` facade.
4. **Forgetting mock mode** — Every new AI function needs a mock implementation in `mockService.ts`.
5. **Direct state mutation** — Always use campaignService methods; Immer handles immutability.
6. **Missing relationship cleanup** — When deleting entities, ensure cascade deletion removes references from related entities.
7. **Forgetting to export types** — New types must be added to `types/index.ts` barrel export.
8. **Using `export default`** — The codebase uses named exports exclusively.
9. **Missing `campaignContext`** — AI-generated content will be inconsistent with the campaign if context is not passed.
10. **Not updating `ViewRouter.tsx`** — New views must be added to `ViewRouter.tsx` (and `EditorView` in `App.tsx`).
11. **Forgetting `EntityHistoryManager`** — Entities that support history (NPCs, Locations, etc.) should integrate the history tracking component.
12. **Not updating documentation** — After significant work, update `docs/architecture/high-level-design.md`, `README.md`, and `CLAUDE.md`.
13. **Using `window.confirm` or `window.alert`** — Use `useConfirmDialog` and `useToast` instead.
14. **Skipping `DialogShell` for modals** — Hand-rolled modals lack focus trap and keyboard accessibility.
15. **Hardcoding entity type colors** — Derive colors from `ENTITY_TYPE_CONFIG` in `utils/entityUtils.ts`.
16. **Using indigo outside RealmChatWidget** — Indigo is reserved exclusively for the RealmChat AI assistant.
17. **Using `stone` color tokens** — The codebase uses `slate-*` variants. Do not use `stone-*`.
18. **Importing from `services/geminiService.ts`** — The facade was renamed to `services/aiService.ts`. Always import from `aiService.ts`.
