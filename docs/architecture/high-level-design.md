# High-Level Design Document: RealmWeaver

> **Last Updated:** 2026-03-26
> **Status:** Phases A through F complete, plus UX refactoring sprint, Claude migration, and Phase 7 polish. Local-only SPA, fully functional.

---

## 1. System Overview

RealmWeaver is an AI-native campaign management tool for tabletop RPG Game Masters. It runs as a client-side single-page application (React 19 + Vite) with localStorage persistence. AI generation is powered by the Claude Code CLI (local development) or the Anthropic REST API (future production path).

### Core Responsibilities

| Concern | How It's Handled |
|---------|-----------------|
| **World Building** | AI-powered entity generation (NPCs, locations, factions, items, adventures, articles, plots) with campaign context injection |
| **Session Management** | Session Prep Wizard, Session Runner with scene advancement, running log, beats mode, voice capture |
| **In-Session Tools** | DM Coach (narrate, improvise, rollable tables, NPC roleplay), Combat Tracker, Dice Roller, Secrets & Clues Tracker |
| **Navigation** | Entity cross-linking (EntityLink + QuickCard hover), backlinks ("Referenced By"), back stack, recent items, pinned favorites, command palette (Ctrl+K) |
| **World Intelligence** | Continuity Checker (8 rules), Plot Timeline, World Simulation Engine, Content Style Matching, Smart Context Builder (tiered, token-budget-aware) |
| **Onboarding** | First Campaign Wizard (5-step), 4 template campaigns, DM Style progressive disclosure (guided/standard/power) |
| **Persistence** | localStorage with debounced auto-save, JSON import/export, Obsidian markdown export |
| **Cross-Campaign** | CrossCampaignDashboard with search/filter across all stored campaigns |

---

## 2. Architecture

```
+---------------------------------------------------------------------+
|                        React 19 SPA (Vite)                          |
+----------------+---------------------------+-------------------------+
|   Components   |   State Management        |   AI Services           |
|                |                           |                         |
|  Views         |  campaignService.ts       |  aiService.ts           |
|  Dashboards    |  +------------------+     |  (facade)               |
|  Editors       |  | Factory Store    |     |       |                 |
|  Generators    |  | + Immer          |     |       v                 |
|  Dialogs       |  | + Auto-save (2s) |     |  ai/core.ts             |
|  Tools         |  | + localStorage   |     |  ai/realmWeaver.ts      |
|  RealmChat     |  | + Relationship   |     |  ai/dmCoach.ts          |
|  Visualizers   |  |   syncing        |     |  ai/realmChat.ts        |
|                |  | + Cascade delete |     |  ai/evocationWizard.ts  |
|                |  +------------------+     |  ai/worldSimulation.ts  |
|                |                           |  ai/styleMatching.ts    |
|                |  useSyncExternalStore()   |  ai/mockService.ts      |
|                |  contextBuilder.ts        |       |                 |
|                |  continuityChecker.ts     |       v                 |
|                |                           |  providers/             |
|                |                           |  claude-cli.ts (default)|
|                |                           |  anthropic-api.ts (stub)|
+----------------+---------------------------+-------------------------+
|           Claude CLI (local) / Anthropic API (future) / Mock        |
+---------------------------------------------------------------------+
```

### Key Architectural Patterns

1. **Factory-based external store** — `createCampaignStore()` returns a service object with Immer-powered immutable updates, debounced localStorage persistence, and `subscribe`/`getState` for React's `useSyncExternalStore`.

2. **Three-layer AI facade** — Components call `aiService.ts` (never `ai/` modules directly). The facade routes to mock or real implementations based on `isMockMode`. Real implementations use `ai/core.ts`, which delegates to the active provider via `providers/registry.ts`.

3. **Provider abstraction layer** — `providers/registry.ts` manages which AI backend is active. Default is `claude-cli` (Claude Code CLI via Vite proxy middleware). A stub `anthropic-api` provider is ready for future production deployment. Legacy Gemini model name strings are mapped to `ModelTier` values by `core.ts` for backward compatibility.

4. **Tiered context builder** — `contextBuilder.ts` assembles AI context with token-budget awareness. Tier 1 (always): setting, style profile, active scene. Tier 2 (contextual): scene NPCs, location, plots. Tier 3 (on-demand): full entity overviews.

5. **Three-tier component hierarchy** — Dashboards (list + generate via EntityCreationPanel) → Generators (AI creation forms) → Editors (detail editing with tabbed layouts and inline AI-assist).

6. **Entity cross-linking** — `EntityLink` renders clickable references with `EntityQuickCard` hover popovers. `LinkedText` auto-detects entity names in text. `BacklinksPanel` shows inbound references ("Referenced By").

7. **Decomposed App shell** — `App.tsx` delegates view routing to `ViewRouter.tsx`, entity selection state to `useEntitySelection`, and modal lifecycle to `useModalState`. `SessionRunner` and `CampaignSidebar` are each decomposed into focused sub-components under `views/session/` and `layout/sidebar/` respectively.

8. **Accessible dialog system** — All modals compose `DialogShell` for consistent focus trap, Escape-to-close, body scroll lock, and ARIA roles. Confirmations go through `useConfirmDialog` (context-provider); ephemeral feedback through `useToast` (context-provider). Direct use of `window.confirm` / `window.alert` is prohibited. Phase 7 additions: `DmStylePanel` uses `role="radiogroup"` semantics; `BacklinksPanel` exposes collapsed link count to screen readers.

9. **ENTITY_TYPE_CONFIG** — Canonical map in `utils/entityUtils.ts` from entity type key to `{ icon, color, label }`. All components that render entity type metadata (dashboards, quick cards, command palette, sidebar) derive from this config.

10. **Shared Button component** — `components/common/Button.tsx` provides a unified button abstraction with 5 variants (`primary`, `secondary`, `ghost`, `danger`, `icon`) and 3 sizes (`sm`, `md`, `lg`). `twMerge` handles className composition and override. 219+ instances across the codebase use it. Cards, tabs, and chip elements with semantic roles may stay as raw `<button>` elements.

11. **Sidebar persistence defaults** — All `CampaignSidebar` sections expand by default. Drag-and-drop reordering tracks state in React (`draggingSceneId`, `dragOverSceneId`) rather than via direct DOM manipulation. The First Campaign Wizard hands off to the sidebar and expands the relevant section automatically.

---

## 3. Data Model

All data lives in a single `Campaign` object with arrays of typed entities:

```
Campaign
├── npcs: NPC[]                # Characters with personality, faction links, relationships
├── locations: Location[]      # Places with hierarchy, connections, points of interest
├── factions: Faction[]        # Organizations with goals, members, headquarters
├── items: Item[]              # Artifacts, equipment, treasures
├── adventures: Adventure[]    # Story arcs containing Scene[] (nested)
├── articles: Article[]        # Lore entries with parent/child hierarchy
├── sessionLogs: SessionLog[]  # Session records with notes, beats, recaps
├── playerCharacters: PC[]     # Imported from PDF or manual entry
├── plots: Plot[]              # Cross-session storyline threads
├── notes: Note[]              # Quick freeform notes
├── secrets?: Secret[]         # DM secrets/clues with reveal tracking
├── activeEncounter?: Encounter # Live combat state
├── activeSceneId?: string     # Scene currently being played
├── activeSessionId?: string   # Session Runner active session
├── pinnedEntities?: PinnedRef[] # Sidebar favorites
├── dmStyle?: DmStyle          # guided | standard | power
├── featureOverrides?: Record  # Per-feature manual visibility toggles
├── wizardDismissed?: boolean  # First Campaign Wizard completion flag
├── styleProfile?: string      # AI-learned DM writing voice
└── gcpApiKey?: string         # Optional GCP key for real-time audio transcription
```

### Entity Relationships

```
NPC.factionId          -> Faction     (member-of, bidirectional)
NPC.relationships[]    -> NPC         (ally/rival/family)
Location.parentId      -> Location    (within, cycle-detected)
Location.connections[] -> Location    (connected-to)
Location.factionId     -> Faction     (controlled-by)
Faction.leaderId       -> NPC         (led-by)
Faction.memberIds[]    -> NPC         (has-member, bidirectional)
Faction.headquartersId -> Location    (headquartered-at)
Scene.locationId       -> Location    (set-in)
Scene.npcIds[]         -> NPC         (features)
Article.relatedIds[]   -> Any entity  (references)
Plot.relatedIds[]      -> Any entity  (involves)
```

### Cascade Deletion

Entity deletion in `campaignService` cleans up all references to keep data consistent:

| Deleted entity | Cascade effect |
|----------------|---------------|
| NPC | Clears `factionId` from faction member list; removes from `Scene.npcIds` |
| Faction | Nulls `factionId` on member NPCs; nulls `Location.factionId` |
| Location | Nulls parent refs on child locations; nulls `Scene.locationId` |
| Adventure | Clears `Campaign.activeSceneId` if it belongs to the adventure; nulls `SessionLog.adventureId` references |
| Scene | Removed from `Adventure.scenes`; `Campaign.activeSceneId` cleared if it matches |

---

## 4. Feature Map

| Feature | Component(s) | Service(s) |
|---------|-------------|-----------|
| Entity Generation | `generators/*.tsx` | `aiService` -> `ai/realmWeaver` |
| DM Coach | `dialogs/DmCoach.tsx` | `aiService` -> `ai/dmCoach` |
| NPC Roleplay | `dialogs/DmCoach.tsx` (roleplay mode) | `aiService` -> `ai/realmChat` |
| RealmChat | `RealmChat/RealmChatWidget.tsx` | `aiService` -> `ai/realmChat` |
| Evocation Wizard | `dialogs/EvocationWizard.tsx` | `aiService` -> `ai/evocationWizard` |
| World Simulation | `dialogs/WorldSimulationWizard.tsx` | `aiService` -> `ai/worldSimulation` |
| Style Matching | `editors/CampaignSettingEditor.tsx` | `aiService` -> `ai/styleMatching` |
| Session Runner | `views/SessionRunner.tsx` | `campaignService` |
| Session Prep | `dialogs/SessionPrepWizard.tsx` | `campaignService` |
| Session End | `dialogs/SessionEndWizard.tsx` | `aiService` -> `ai/dmCoach` |
| Combat Tracker | `tools/CombatTracker.tsx` | `campaignService` |
| Dice Roller | `tools/DiceRoller.tsx` | `utils/diceUtils` |
| Secrets Tracker | `tools/SecretsTracker.tsx` | `campaignService` |
| Continuity Check | `dialogs/ContinuityChecker.tsx` | `continuityChecker.ts` (pure, no AI) |
| Plot Timeline | `visualizers/PlotTimeline.tsx` | Pure component |
| Relationship Graph | `visualizers/RelationshipGraph.tsx` | Pure component (D3) |
| Navigation | `EntityLink`, `BacklinksPanel`, `LinkedText`, `Breadcrumbs` | `backlinkUtils.ts` |
| Command Palette | `common/CommandPalette.tsx` | `campaignService` |
| First Campaign Wizard | `views/FirstCampaignWizard.tsx` | `aiService` -> `ai/evocationWizard` |
| Campaign Templates | `views/CampaignCreator.tsx` | `data/templates/` |
| Cross-Campaign | `views/CrossCampaignDashboard.tsx` (with search/filter) | `campaignService` |
| DM Style Settings | `common/DmStylePanel.tsx` | `utils/dmStyleUtils` |

---

## 5. Testing Strategy

| Layer | Framework | Count | Purpose |
|-------|-----------|-------|---------|
| Unit | Vitest | 516 (34 files) | Service logic, context builder, utilities, linking engine, storage/migration, archetype scenarios |
| E2E | Playwright | 118 (6 skipped) | User workflows: campaign CRUD, navigation, session runner, DM tools |
| Smoke | Built-in (`smokeTest.ts`) | ~20 | Service function availability, entity CRUD on app startup |
| Type Check | `npm run typecheck` (`tsc --noEmit`) | 0 errors | Standalone quality gate; not yet wired into CI (no `.github/workflows`) |
| Manual | Mock mode | — | Full app testing without API key |

---

## 6. Project Structure

```
Realmweaver/
├── App.tsx                          # Root: campaign state, isMockMode, top-level layout (~564L)
├── index.tsx                        # React entry point (mounts providers)
├── index.html                       # Tailwind CDN, Google Fonts, import maps
├── vite.config.ts                   # Dev server (port 3000), path alias, env injection
├── vite-plugin-ai-proxy.ts          # Vite middleware: POST /api/ai/generate -> claude CLI
│
├── hooks/                           # Custom React hooks (extracted from App.tsx)
│   ├── useEntitySelection.ts        # Selected entity state, nav stack, breadcrumbs, recent items
│   ├── useModalState.ts             # All modal open/close state with closeTopModal() priority
│   ├── useConfirmDialog.ts          # Context-provider: programmatic confirm dialogs
│   ├── useToast.ts                  # Context-provider: toast notification queue
│   ├── useEntitySearch.ts           # Dashboard search/filter (case-insensitive multi-field)
│   └── useRovingTabIndex.ts         # Keyboard roving tabindex (grid/list navigation)
│
├── components/
│   ├── common/                      # Shared primitives
│   │   ├── Button.tsx               # Styled button (5 variants, 3 sizes, twMerge composition; 219+ uses)
│   │   ├── StepIndicator.tsx        # Multi-step wizard progress indicator
│   │   ├── Icons.tsx                # Centralized re-export from lucide-react (mandatory)
│   │   ├── Textarea.tsx             # AiTextarea + inputBaseClasses/textareaBaseClasses exports
│   │   ├── DialogShell.tsx          # Base modal wrapper (focus trap, Escape, ARIA, scroll lock)
│   │   ├── ConfirmDialog.tsx        # Confirmation modal (consumed via useConfirmDialog)
│   │   ├── ToastContainer.tsx       # Toast renderer (consumed via useToast)
│   │   ├── ErrorBoundary.tsx        # React class-based error boundary
│   │   ├── EntityCreationPanel.tsx  # Chat vs form creation toggle for dashboards
│   │   ├── EntityHistoryManager.tsx # Entity version history + undo
│   │   ├── EntityLink.tsx           # Inline entity link with QuickCard hover popover
│   │   ├── EntityQuickCard.tsx      # Floating entity preview (portal-rendered, mobile bottom sheet)
│   │   ├── BacklinksPanel.tsx       # "Referenced By" inbound cross-references
│   │   ├── LinkedText.tsx           # Auto-linkify entity names in text
│   │   ├── MentionInput.tsx         # Textarea with @mention autocomplete; accepts `initialMentions` so persisted mentions are recognized after an editor remount
│   │   ├── CommandPalette.tsx       # Ctrl+K global entity search
│   │   ├── Breadcrumbs.tsx          # Navigation breadcrumb trail
│   │   ├── RegenerateButton.tsx     # Inline AI field regeneration with preview panel
│   │   ├── SkeletonCard.tsx         # Loading skeleton placeholder
│   │   ├── TabLayout.tsx            # Reusable tabbed panel layout
│   │   ├── DmStylePanel.tsx         # DM Style settings (guided/standard/power)
│   │   ├── GenerateHerePanel.tsx    # Inline generation trigger panel
│   │   ├── SceneResourcesPanel.tsx  # Collapsible scene NPC/location reference panel
│   │   └── KeyboardShortcutsHelp.tsx # Keyboard shortcut reference overlay
│   │
│   ├── layout/                      # App shell
│   │   ├── Header.tsx               # Top navigation bar
│   │   ├── CampaignSidebar.tsx      # Left nav (orchestrates sidebar/ sub-components)
│   │   ├── ContentWrapper.tsx       # Main content area wrapper
│   │   ├── ViewRouter.tsx           # Renders active EditorView (extracted from App.tsx)
│   │   └── sidebar/                 # Sidebar sub-components
│   │       ├── SidebarEntityList.tsx
│   │       ├── SidebarSearch.tsx
│   │       ├── PinnedEntities.tsx
│   │       ├── RecentItems.tsx
│   │       ├── ArticleTreeItem.tsx
│   │       └── sidebarUtils.ts
│   │
│   ├── views/                       # High-level screens
│   │   ├── WelcomeScreen.tsx
│   │   ├── CampaignCreator.tsx
│   │   ├── FirstCampaignWizard.tsx  # Guided 5-step world-building onboarding
│   │   ├── CrossCampaignDashboard.tsx
│   │   ├── SessionRunner.tsx        # Live session orchestrator (~439L)
│   │   └── session/                 # SessionRunner sub-components
│   │       ├── ActiveScenePanel.tsx
│   │       ├── SceneListPanel.tsx
│   │       ├── RunningLog.tsx
│   │       ├── QuickToolsPanel.tsx
│   │       └── QuickNpcGenerator.tsx
│   │
│   ├── dashboards/                  # Entity list views (10 dashboards, all use EntityCreationPanel)
│   ├── generators/                  # AI creation forms (8 generators + EntityChatGenerator)
│   ├── editors/                     # Detail editors with tabbed layouts (12 editors + PrepDocumentView)
│   ├── dialogs/                     # Modals (all use DialogShell): DmCoach, 4 Wizards, etc.
│   ├── tools/                       # CombatTracker, DiceRoller, SecretsTracker
│   ├── visualizers/                 # RelationshipGraph (D3), PlotTimeline
│   └── RealmChat/                   # Floating chat assistant (indigo accent only)
│
├── services/
│   ├── campaignService.ts           # Central state store (factory, Immer, auto-save)
│   ├── aiService.ts                 # AI facade -- the ONLY import for AI in components
│   ├── contextBuilder.ts            # Tiered token-budget-aware context assembly
│   ├── continuityChecker.ts         # 8 rule-based consistency checks (pure function)
│   ├── importExportService.ts       # JSON/Obsidian import-export
│   └── ai/                          # AI implementation layer
│       ├── core.ts                  # Backward-compat adapter (preserves 3 func signatures)
│       ├── modelConfig.ts           # ModelTier type, tier->model mappings, provider config
│       ├── realmWeaver.ts           # Entity generation
│       ├── dmCoach.ts               # Session assistance
│       ├── realmChat.ts             # Conversational AI
│       ├── evocationWizard.ts       # Batch generation & parsing
│       ├── worldSimulation.ts       # World event simulation
│       ├── styleMatching.ts         # DM writing style analysis
│       ├── mockService.ts           # Static mock data for offline dev and tests
│       └── providers/               # AI provider backends
│           ├── types.ts             # AIProvider interface
│           ├── registry.ts          # Provider registry (default: claude-cli)
│           ├── claude-cli.ts        # Claude CLI via Vite proxy
│           ├── anthropic-api.ts     # Anthropic API stub (future production)
│           └── retry.ts             # Transient failure retry
│
├── types/                           # TypeScript interfaces (24 files, barrel via index.ts)
│
├── utils/
│   ├── entityUtils.ts               # Entity factories + ENTITY_TYPE_CONFIG
│   ├── formReconciliation.ts        # Merge in-progress editor form state with incoming entity prop updates
│   ├── entityDetailExtractors.ts    # Extract display strings from entity fields
│   ├── entityFieldSave.ts           # Dispatch field saves by entity type
│   ├── backlinkUtils.ts             # Compute inbound cross-references
│   ├── dmStyleUtils.ts              # Feature visibility per DM Style mode
│   ├── demoTemplates.ts             # Starter campaign demo data
│   ├── diceUtils.ts                 # Dice formula parsing and rolling
│   ├── keyboardShortcuts.ts         # Shortcut definitions and matching
│   └── popoverPosition.ts           # Popover screen coordinate calculation
│
├── data/templates/                  # 4 campaign templates (JSON)
├── data/testCampaigns.ts            # Loader for local-only test campaigns dropped into data/test-campaigns/ (gitignored; no-op on a fresh clone)
├── e2e/                             # Playwright E2E tests
├── tests/                           # Vitest unit tests
└── docs/                            # Architecture and design documentation
    ├── architecture/                # This file, technical design, implementation plan
    └── design/                      # DM archetypes, session cockpit review
```
