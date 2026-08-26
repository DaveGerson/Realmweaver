# High-Level Design Document: RealmWeaver

> **Last Updated:** 2026-08-14
> **Status:** Phases A through F complete, plus UX refactoring sprint, Claude migration, Phase 7 polish, and the 124-finding ship-readiness hardening pass (`docs/ship-readiness/remediation-plan.md`). Local-only SPA, fully functional.
> **See also:** `system-architecture.md` is the authoritative reference for runtime topology, the AI-proxy security posture, and the full component catalog.

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
| **Smart Linking** | `services/linking/` matching engine behind `@mention` capture, template-import auto-linking, scene smart-link bar, link suggestions panel |
| **Onboarding** | First Campaign Wizard (5-step), 4 template campaigns, DM Style progressive disclosure (guided/standard/power) |
| **Persistence** | localStorage with debounced auto-save (2s debounce / 10s max wait / synchronous flush on page teardown), IndexedDB fallback on quota overflow, 3-slot rotating backups with startup recovery, cross-tab conflict detection, JSON import/export, Obsidian markdown export |
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
|  Dialogs       |  | + Auto-save      |     |  ai/core.ts             |
|  Tools         |  |   (2s / 10s max) |     |  ai/realmWeaver.ts      |
|  RealmChat     |  | + Relationship   |     |  ai/dmCoach.ts          |
|  Visualizers   |  |   syncing        |     |  ai/realmChat.ts        |
|  StatusBanners |  | + Cascade delete |     |  ai/evocationWizard.ts  |
|                |  +--------+---------+     |  ai/worldSimulation.ts  |
|                |           |               |  ai/styleMatching.ts    |
|                |           v               |  ai/audioTranscription  |
|                |  storageService.ts        |  ai/mockService.ts      |
|                |  | localStorage           |       |                 |
|                |  | -> IndexedDB (quota)   |       v                 |
|                |  | + 3-slot backups       |  providers/             |
|                |  | + conflict events      |  claude-cli.ts (default)|
|                |                           |  anthropic-api.ts (stub)|
|                |  useSyncExternalStore()   |                         |
|                |  contextBuilder.ts        |                         |
|                |  continuityChecker.ts     |                         |
|                |  linking/ (match engine)  |                         |
+----------------+---------------------------+-------------------------+
|  Vite dev/preview server: vite-plugin-ai-proxy.ts (/api/ai/*)       |
+---------------------------------------------------------------------+
|           Claude CLI (local) / Anthropic API (future) / Mock        |
+---------------------------------------------------------------------+
```

### Key Architectural Patterns

1. **Factory-based external store** — `createCampaignStore()` returns a service object with Immer-powered immutable updates, debounced persistence, and `subscribe`/`getState` for React's `useSyncExternalStore`. `createCampaignStore({ persist: false })` gives tests an isolated, non-writing instance; `destroy()` tears down the listeners `init()` registered.

2. **Three-layer AI facade** — Components call `aiService.ts` (never `ai/` modules directly). The facade routes to mock or real implementations based on `isMockMode`. Real implementations use `ai/core.ts`, which delegates to the active provider via `providers/registry.ts`.

3. **Provider abstraction layer** — `providers/registry.ts` manages which AI backend is active. Default is `claude-cli` (Claude Code CLI via Vite proxy middleware). A stub `anthropic-api` provider is ready for future production deployment. Legacy Gemini model name strings are mapped to `ModelTier` values by `core.ts` for backward compatibility.

4. **Tiered context builder** — `contextBuilder.ts` assembles AI context with token-budget awareness. Tier 1 (always): setting, style profile, active scene. Tier 2 (contextual): scene NPCs, location, plots. Tier 3 (on-demand): full entity overviews.

5. **Three-tier component hierarchy** — Dashboards (list + generate via EntityCreationPanel) → Generators (AI creation forms) → Editors (detail editing with tabbed layouts and inline AI-assist).

6. **Entity cross-linking** — `EntityLink` renders clickable references with `EntityQuickCard` hover popovers. `LinkedText` auto-detects entity names in text. `BacklinksPanel` shows inbound references ("Referenced By").

7. **Decomposed App shell** — `App.tsx` delegates view routing to `ViewRouter.tsx`, entity selection state to `useEntitySelection`, and modal lifecycle to `useModalState`. `SessionRunner` and `CampaignSidebar` are each decomposed into focused sub-components under `views/session/` and `layout/sidebar/` respectively.

8. **Accessible dialog system** — All modals compose `DialogShell` for consistent focus trap, Escape-to-close, body scroll lock, and ARIA roles. Confirmations go through `useConfirmDialog` (context-provider); ephemeral feedback through `useToast` (context-provider). Direct use of `window.confirm` / `window.alert` is prohibited. Phase 7 additions: `DmStylePanel` uses `role="radiogroup"` semantics; `BacklinksPanel` exposes collapsed link count to screen readers.

9. **ENTITY_TYPE_CONFIG** — Canonical map in `utils/entityUtils.ts` from entity type key to `{ icon, color, label }`. All components that render entity type metadata (dashboards, quick cards, command palette, sidebar) derive from this config. Colors: npc=amber, location=emerald, faction=violet, item=sky, adventure=orange, article=cyan, sessionLog=rose, playerCharacter=teal, plot=yellow, note=slate, **scene=blue**. Adding a color here also requires extending the `@source inline(...)` safelist in `index.css`, since these classes are composed at runtime and invisible to Tailwind's scanner. There is still no `secret` entry.

10. **Shared Button component** — `components/common/Button.tsx` provides a unified button abstraction with 5 variants (`primary`, `secondary`, `ghost`, `danger`, `icon`) and 3 sizes (`sm`, `md`, `lg`). `twMerge` handles className composition and override. 219+ instances across the codebase use it. Cards, tabs, and chip elements with semantic roles may stay as raw `<button>` elements.

11. **Sidebar persistence defaults** — All `CampaignSidebar` sections expand by default. Drag-and-drop reordering tracks state in React (`draggingSceneId`, `dragOverSceneId`) rather than via direct DOM manipulation. The First Campaign Wizard hands off to the sidebar and expands the relevant section automatically.

12. **Durable persistence ladder** — `services/storageService.ts` sits between the store and the browser. Writes go to `localStorage`; a `QuotaExceededError` falls back to IndexedDB and surfaces `saveStatus: 'quota-warning'` (with the stale localStorage copy removed so `load()` cannot shadow the fresher IDB copy). Every write rotates the previous value through 3 backup slots namespaced per primary key (`<key>__backup_1..3`), and `init()` walks those slots newest-first when the primary payload fails to parse — the corrupt payload is never deleted. Autosave debounces 2s with a 10s max wait, and `pagehide`/`beforeunload`/`visibilitychange` flush any pending write synchronously.

13. **Explicit cross-tab conflict resolution** — a `storage` event from another tab sets `state.conflictDetected`; `persistToStorage` refuses to write while it is set, so no tab silently clobbers another. `components/layout/StatusBanners.tsx` renders the `ConflictBanner` (reload the other tab's snapshot vs. keep mine → `campaignService.resolveConflict`) and the `BackupRecoveryBanner` (fired by `state.recoveredFromBackup` → `dismissBackupRecoveryNotice`).

14. **Debounced per-field store commits** — `hooks/useDebouncedFieldCommit.ts` coalesces the per-keystroke `onUpdate(id, updates)` writes that `MentionInput`-backed editor fields produce. Editors are not remounted when the user switches between entities of the same type, so the hook flushes pending edits against the id they were typed under whenever `entityId` changes, and again on unmount. Used by the NPC, Location, Faction, Article, and Plot editors.

15. **Build-time Tailwind + provider env flow** — Tailwind is compiled by `@tailwindcss/vite` from `index.css` (no CDN script, no runtime JIT); classes composed at runtime from `ENTITY_TYPE_CONFIG` colors are kept alive by `@source inline(...)` safelists in that file. Provider knobs (`REALMWEAVER_AI_PROVIDER`, `_DEFAULT_TIER`, `_MAX_RETRIES`, `_TIMEOUT_MS`, `_API_BASE_URL`) travel from `.env.local` through `vite.config.ts`'s `define` as literal `process.env.<KEY>` tokens, and `services/ai/modelConfig.ts` reads them back through guarded live getters so Node-side callers (tests, middleware) still see runtime mutations.

16. **Localhost-only AI proxy** — `vite-plugin-ai-proxy.ts` registers `/api/ai/generate` and `/api/ai/health` on both the dev server (`configureServer`) and the preview server (`configurePreviewServer`). Requests must arrive from a loopback TCP peer (unforgeable), with `Origin` and `Host` both resolving to localhost; bodies are capped at 4 MB, CLI invocation at 120 s and 1 MB of stdout. A per-session token is injected into the page and validated when present, but is not yet required.

---

## 3. Data Model

All data lives in a single `Campaign` object with arrays of typed entities:

```
Campaign
├── npcs: NPC[]                # Characters with personality, faction links, relationships, optional voiceNotes, and a quote ledger kept in history[] (`Said: "…"` rows)
├── locations: Location[]      # Places with hierarchy, connections, points of interest
├── factions: Faction[]        # Organizations with goals, members, headquarters
├── items: Item[]              # Artifacts, equipment, treasures
├── adventures: Adventure[]    # Story arcs containing Scene[] (nested)
├── articles: Article[]        # Lore entries with parent/child hierarchy
├── sessionLogs: SessionLog[]  # Session records with notes, beats, recaps
├── playerCharacters: PC[]     # Imported from PDF or manual entry
├── plots: Plot[]              # Cross-session storyline threads
├── notes: Note[]              # Quick freeform notes
├── secrets?: Secret[]         # DM secrets/clues with reveal tracking + the E1 mystery edge (revealsSecretId/isVital/cluesNeeded)
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
NPC.factionId                    -> Faction    (member-of, bidirectional)
NPC.relationships[]              -> NPC        (ally/rival/family)
Location.parentLocationId        -> Location   (within, cycle-detected)
Location.subLocationIds[]        -> Location   (contains, bidirectional)
Location.connections[]           -> Location   (connected-to, via targetLocationId)
Location.controllingFactionId    -> Faction    (controlled-by)
Faction.leaderId                 -> NPC        (led-by)
Faction.memberIds[]              -> NPC        (has-member, bidirectional)
Faction.headquartersLocationId   -> Location   (headquartered-at)
Article.parentArticleId          -> Article    (Lorebook tree, cycle-detected)
Scene.locationId                 -> Location   (set-in)
Scene.npcIds[]                   -> NPC        (features)
Article.relatedEntityIds[]       -> Any entity (references)
Plot.relatedEntityIds[]          -> Any entity (involves)
Secret.linkedEntityIds[]         -> Any entity (concerns)
Secret.revealsSecretId           -> Secret     (E1 clue -> revelation, optional)
*.mentionedEntityIds[]           -> Any entity (@mention backlinks)
```

### Cascade Deletion

Every `deleteX()` does two things: type-specific relationship unwinding, plus a shared
`_purgeEntityReferences(campaign, id)` sweep so no dangling reference survives anywhere.

| Deleted entity | Type-specific cascade |
|----------------|----------------------|
| NPC | Removed from `Faction.memberIds`; removed from `Scene.npcIds` |
| Faction | Clears `factionId` on member NPCs; clears `Location.controllingFactionId` |
| Location | Un-parents child locations; clears `Scene.locationId` |
| Article | Detaches from its parent and un-parents every sub-article in the Lorebook tree |
| Adventure | Clears `Campaign.activeSceneId` if it belonged to the adventure; nulls `SessionLog.adventureId`; strips its scene ids from every `SessionLog.plannedSceneIds` |
| Scene | Removed from `Adventure.scenes`; `Campaign.activeSceneId` cleared if it matches |

`_purgeEntityReferences` additionally strips the deleted id from: `NPC.relationships`,
`Faction.leaderId` / `headquartersLocationId`, `Location.connections[].targetLocationId`,
`Plot`/`Article.relatedEntityIds`, `SessionLog.relatedPlotIds` / `plotProgressions` /
`structuredNotes[].taggedEntityIds` / `plannedNpcIds` / `plannedLocationIds`,
`Secret.linkedEntityIds` / `revealedInSessionId` / `revealsSecretId`, `Campaign.pinnedEntities`, and
`mentionedEntityIds` on every entity type that carries it.

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
| Secrets Tracker | `tools/SecretsTracker.tsx` | `campaignService`; `aiService.generateSecretBatch` -> `ai/realmWeaver` for R2 "Generate ten" |
| Continuity Check | `dialogs/ContinuityChecker.tsx` | `continuityChecker.ts` (pure, no AI) |
| Plot Timeline | `visualizers/PlotTimeline.tsx` | Pure component |
| Relationship Graph | `visualizers/RelationshipGraph.tsx` | Pure component (D3) |
| AI Scribe (voice capture) | `editors/SessionLogEditor.tsx` | `aiService.startAudioTranscription` -> `ai/audioTranscription` (mocked in mock mode) |
| Smart Linking | `common/SceneSmartLinkBar.tsx`, `common/LinkSuggestionsPanel.tsx`, `common/MentionInput.tsx` | `services/linking/` (`matchingEngine`, `engineRegistry`, `autoLinker`) |
| Navigation | `EntityLink`, `BacklinksPanel`, `LinkedText`, `Breadcrumbs` | `backlinkUtils.ts` |
| Persistence status | `layout/StatusBanners.tsx` (conflict + backup recovery) | `campaignService` / `storageService` |
| Command Palette | `common/CommandPalette.tsx` | `campaignService` |
| First Campaign Wizard | `views/FirstCampaignWizard.tsx` | `aiService` -> `ai/evocationWizard` |
| Campaign Templates | `views/CampaignCreator.tsx` | `data/templates/` |
| Cross-Campaign | `views/CrossCampaignDashboard.tsx` (with search/filter) | `campaignService` |
| Tonight's Table | `views/TonightsTable.tsx` (story-first campaign home: previously on, open threads, offstage cast, loaded guns) | `utils/storyDerivations.ts` |
| Callback Machine | `views/session/QuickToolsPanel.tsx` ("Complicate This" — zero-prompt reincorporation of dormant campaign material, logged as a `coach-used` entry) | `utils/dormantMaterial.ts` (over `storyDerivations`) -> `aiService.generateCallbackComplication` -> `ai/dmCoach` |
| Engraved moments & cold open | `views/TonightsTable.tsx` (Moments reel over starred `structuredNotes`, zero schema) + `dialogs/SessionPrepWizard.tsx` ("Draft it from last session", folded into `prepNotes` via `utils/strongStartFormat.ts`) | `aiService.generateColdOpen` / `hasColdOpenMaterial` -> `ai/dmCoach` |
| DM Style Settings | `common/DmStylePanel.tsx` | `utils/dmStyleUtils` |

---

## 5. Testing Strategy

| Layer | Framework | Count | Purpose |
|-------|-----------|-------|---------|
| Unit + component | Vitest | 990 (143 files) | Service logic, storage/migration/backup recovery, context builder, utilities, linking engine, AI adapters/providers, archetype scenarios, plus jsdom render tests (`@testing-library/react`) for editors, dialogs and hooks under `tests/ship/` |
| E2E | Playwright | 114 per project × 2 projects (chromium, mobile-chrome), 14 spec files, 2 permanently skipped + 4 runtime skip guards | User workflows: campaign CRUD, navigation, entity CRUD, generators, dialogs, session runner, DM tools, visualizers, mobile, RealmChat |
| Smoke | Built-in (`smokeTest.ts`) | ~20 | Service function availability, entity CRUD on app startup — opt-in via `VITE_RUN_SMOKE_TESTS=true` in dev only |
| Type Check | `npm run typecheck` (`tsc --noEmit`) | 0 errors | Standalone gate; `npm run build` does **not** typecheck |
| CI | GitHub Actions (`.github/workflows/ci.yml`) | — | typecheck → unit → build → Chromium E2E on push to `main` and every PR (`mobile-chrome` temporarily excluded) |
| Manual | Mock mode | — | Full app testing without API key |

---

## 6. Project Structure

```
Realmweaver/
├── App.tsx                          # Root: campaign state, isMockMode, top-level layout (~751L)
├── index.tsx                        # React entry point (ErrorBoundary > ToastProvider > ConfirmDialogProvider)
├── index.html                       # CSP meta, system font stacks, local animation/scrollbar CSS
├── index.css                        # Tailwind build-time entry (`@import "tailwindcss"` + @source safelists)
├── vite.config.ts                   # Dev server (127.0.0.1:4200, strictPort), Tailwind plugin, AI proxy, path alias, env define, vendor chunking
├── vite-plugin-ai-proxy.ts          # Vite dev + preview middleware: POST /api/ai/generate -> claude CLI
├── .github/workflows/ci.yml         # typecheck -> unit -> build -> Chromium E2E
│
├── hooks/                           # Custom React hooks (extracted from App.tsx)
│   ├── useEntitySelection.ts        # Selected entity state, nav stack, breadcrumbs, recent items
│   ├── useModalState.ts             # All modal open/close state with closeTopModal() priority
│   ├── useConfirmDialog.ts          # Context-provider: programmatic confirm dialogs
│   ├── useToast.ts                  # Context-provider: toast notification queue (capped at 3)
│   ├── useEntitySearch.ts           # Dashboard search/filter (case-insensitive multi-field)
│   ├── useDebouncedFieldCommit.ts   # Coalesced per-field store writes; flushes across entity switch + unmount
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
│   │   ├── LinkedText.tsx           # Auto-linkify entity names in text (Unicode word-boundary tokenizer)
│   │   ├── LinkSuggestionsPanel.tsx # Detected-but-unlinked entity suggestions with per-item dismissal
│   │   ├── SceneSmartLinkBar.tsx    # Inline "+Add" chips for NPCs/locations found in a scene's text
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
│   │   ├── StatusBanners.tsx        # ConflictBanner (multi-tab) + BackupRecoveryBanner
│   │   ├── ViewRouter.tsx           # Renders active EditorView (extracted from App.tsx)
│   │   └── sidebar/                 # Sidebar sub-components
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
│   ├── dialogs/                     # Modals (all use DialogShell): DmCoach, 4 wizards, ContinuityChecker, ExportModal
│   ├── tools/                       # CombatTracker, DiceRoller, SecretsTracker
│   ├── visualizers/                 # RelationshipGraph (D3), PlotTimeline
│   └── RealmChat/                   # Floating chat assistant (indigo accent only)
│
├── services/
│   ├── campaignService.ts           # Central state store (factory, Immer, auto-save, conflict/backup state)
│   ├── storageService.ts            # Persistence ladder: localStorage -> IndexedDB, backups, conflict events
│   ├── aiService.ts                 # AI facade -- the ONLY import for AI in components
│   ├── contextBuilder.ts            # Tiered token-budget-aware context assembly
│   ├── continuityChecker.ts         # 12 rule-based consistency checks, incl. the E2 mystery lints (pure function)
│   ├── importExportService.ts       # JSON/Obsidian import-export with validation warnings; generateSessionPrepSheetMarkdown/exportSessionPrepSheet (R3 one-page session prep sheet)
│   ├── linking/                     # Smart linking: matchingEngine, engineRegistry, autoLinker
│   └── ai/                          # AI implementation layer
│       ├── core.ts                  # Backward-compat adapter (preserves 3 func signatures)
│       ├── modelConfig.ts           # ModelTier type, tier->model mappings, provider config
│       ├── realmWeaver.ts           # Entity generation
│       ├── dmCoach.ts               # Session assistance
│       ├── realmChat.ts             # Conversational AI
│       ├── evocationWizard.ts       # Batch generation & parsing
│       ├── worldSimulation.ts       # World event simulation
│       ├── styleMatching.ts         # DM writing style analysis
│       ├── audioTranscription.ts    # AI Scribe live transcription (reached via the aiService facade)
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
│   ├── backlinkUtils.ts             # Compute inbound cross-references (incl. the E1 clue -> revelation edge)
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
