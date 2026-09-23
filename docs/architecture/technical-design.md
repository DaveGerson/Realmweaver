
# Technical Design Document: RealmWeaver

> **Last Updated:** 2026-08-14
> **Audience:** Developers contributing to the RealmWeaver codebase
> **See also:** `system-architecture.md` for runtime topology, the AI-proxy threat model, and the full component catalog.

---

## 1. Introduction

RealmWeaver is a single-page application (SPA) for tabletop RPG Game Masters to create, manage, and run campaigns with AI assistance. It runs entirely in the browser with client-side persistence (localStorage). AI generation is powered by the Claude Code CLI via a local Vite proxy middleware, with an Anthropic REST API path prepared for future production deployment.

---

## 2. Technology Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Runtime** | React 19.2.0 | UI framework with `useSyncExternalStore` for external state binding |
| **Language** | TypeScript 5.8.2 | Type safety (ES2022 target, bundler module resolution) |
| **Build** | Vite 6.2.0 | Dev server, HMR, production bundling |
| **AI** | Claude Code CLI / `@anthropic-ai/sdk` 0.39.0 | Local Claude CLI (default) or Anthropic REST API |
| **State** | Immer 10.1.3 | Immutable state updates with mutable syntax |
| **Styling** | Tailwind CSS 4.3.3 (build-time) | Utility-first CSS via `@tailwindcss/vite` + `index.css` |
| **Icons** | Lucide React 0.546.0 | SVG icon library, centralized through `Icons.tsx` |
| **Graphs** | D3 7.8.5 | Entity relationship visualization |
| **Utilities** | tailwind-merge 3.3.1 | Conditional className composition without conflicts |
| **Testing** | Vitest 4.1.0 + Playwright 1.58.2 | Unit/component tests and E2E tests |
| **Test DOM** | `@testing-library/react` 16.3.2 + jsdom 30 | Render tests, opted into per-file with `@vitest-environment jsdom` |
| **CI** | GitHub Actions (`.github/workflows/ci.yml`) | typecheck → unit → build → Chromium E2E |

### TypeScript Configuration

- **Target:** ES2022 with `bundler` module resolution
- **JSX:** `react-jsx` (automatic runtime)
- **Path alias:** `@/*` maps to project root
- **No emit:** TypeScript does type checking only; Vite handles transpilation
- **Strict mode:** Not explicitly enabled

---

## 3. Project Architecture

### 3.1 Directory Layout

All code lives at the **project root** — there is no `src/` directory.

```
Realmweaver/
├── App.tsx                     # Root component (~751L after decomposition)
├── index.tsx                   # React 19 createRoot entry; mounts ErrorBoundary, ToastProvider, ConfirmDialogProvider
├── index.html                  # CSP meta, system font stacks, local animation/scrollbar CSS, favicon
├── index.css                   # Tailwind build-time entry: `@import "tailwindcss"` + @source safelists
├── vite.config.ts              # Dev server (127.0.0.1:4200, strictPort), Tailwind + AI-proxy plugins, path alias, env define, vendor chunking
├── vite-plugin-ai-proxy.ts     # Vite dev + preview middleware: POST /api/ai/generate -> claude CLI binary
├── .github/workflows/ci.yml    # typecheck -> unit -> build -> Chromium E2E
│
├── hooks/                      # Custom React hooks (UX refactoring sprint extractions)
│   ├── useEntitySelection.ts   # Selected entity IDs, nav stack, breadcrumbs, recent items
│   ├── useModalState.ts        # All modal open/close state; closeTopModal() priority logic
│   ├── useConfirmDialog.ts     # Context-provider confirm dialog (replaces window.confirm)
│   ├── useToast.ts             # Context-provider toast queue (replaces window.alert)
│   ├── useEntitySearch.ts      # Multi-field case-insensitive filter for entity lists
│   ├── useDebouncedFieldCommit.ts # Coalesced per-field store writes for MentionInput-backed fields
│   └── useRovingTabIndex.ts    # Roving tabindex for keyboard grid/list navigation
│
├── components/                 # UI layer (organized by role)
│   ├── common/                 # Shared primitives (25+ components)
│   ├── layout/                 # App shell: Header, CampaignSidebar, ViewRouter, StatusBanners
│   │   └── sidebar/            # 5 sidebar sub-components + sidebarUtils.ts
│   ├── views/                  # Top-level screens: Welcome, Creator, SessionRunner, etc.
│   │   └── session/            # 5 SessionRunner sub-components
│   ├── dashboards/             # Entity list views (10 dashboards)
│   ├── generators/             # AI creation forms (8 generators + EntityChatGenerator)
│   ├── editors/                # Detail editing views (12 editors + PrepDocumentView)
│   ├── dialogs/                # Modal tools (7 dialogs, all use DialogShell)
│   │                           #   ContinuityChecker, DmCoach, EvocationWizard, ExportModal,
│   │                           #   SessionEndWizard, SessionPrepWizard, WorldSimulationWizard
│   ├── tools/                  # Gameplay tools: CombatTracker, DiceRoller, SecretsTracker
│   ├── visualizers/            # Data viz: RelationshipGraph (D3), PlotTimeline
│   └── RealmChat/              # Floating chat widget (indigo accent only)
│
├── services/                   # Business logic layer
│   ├── campaignService.ts      # Central state store
│   ├── storageService.ts       # Persistence ladder: localStorage -> IndexedDB, backups, conflict events
│   ├── aiService.ts            # AI service facade (the ONLY AI import for components)
│   ├── contextBuilder.ts       # Tiered token-budget-aware context assembly
│   ├── continuityChecker.ts    # 8 rule-based consistency checks (pure function, no AI)
│   ├── importExportService.ts  # JSON/Obsidian import-export
│   ├── linking/                # matchingEngine.ts, engineRegistry.ts, autoLinker.ts
│   └── ai/                     # AI implementation modules
│       ├── core.ts             # Backward-compat adapter (3 function signatures preserved)
│       ├── modelConfig.ts      # ModelTier type + tier-to-model mappings + provider config
│       ├── realmWeaver.ts      # Entity generation
│       ├── dmCoach.ts          # Session assistance
│       ├── realmChat.ts        # Conversational AI
│       ├── evocationWizard.ts  # Batch generation & parsing
│       ├── worldSimulation.ts  # World event simulation
│       ├── styleMatching.ts    # DM writing style analysis
│       ├── audioTranscription.ts # AI Scribe live transcription (reached via the facade)
│       ├── mockService.ts      # Static mock data for offline dev
│       └── providers/          # AI provider backends
│           ├── types.ts        # AIProvider interface + option types
│           ├── registry.ts     # Provider registry singleton
│           ├── claude-cli.ts   # Claude CLI via Vite proxy (default)
│           ├── anthropic-api.ts # Anthropic REST API (stub)
│           └── retry.ts        # Transient failure retry logic
│
├── types/                      # TypeScript type definitions (24 files, barrel via index.ts)
└── utils/                      # Utility functions (10 files)
```

### 3.2 Layer Diagram

```
+---------------------------------------------------------------+
|                    Component Layer                             |
|  Dashboards | Generators | Editors | Dialogs | Tools          |
+------+----------------------------+-------------------------+--+
       |                            |                         |
       |  React State Binding       |  AI Service Layer       |
       |                            |                         |
       |  useSyncExternalStore()    |  aiService.ts           |
       |          |                 |  (facade/router)        |
       v          v                 |         |               |
  campaignService.ts                |         v               |
  (External Store)                  |    ai/core.ts           |
  +---------------------+           |    (adapter)            |
  | Immer produce()     |           |         |               |
  | localStorage        |           |         v               |
  | Debounced save (2s) |           |  providers/registry.ts  |
  | Relationship sync   |           |         |               |
  | Cascade delete      |           |    claude-cli.ts        |
  +---------------------+           |    (Vite proxy)         |
                                    +-------------------------+
                                              |
                             +----------------+-----------------+
                             |                                  |
                      Claude CLI                         Mock Service
                    (local dev)                        (offline dev)
```

---

## 4. State Management

### 4.1 Factory-Based External Store

**Location:** `services/campaignService.ts`

```typescript
export function createCampaignStore(config: { persist?: boolean } = {}) {
    let state: CampaignState = {
        campaigns: Campaign[],
        activeCampaignId: string | null,
        appStatus: 'loading' | 'welcome' | 'selecting' | 'creating' | 'editing',
        saveStatus: 'idle' | 'saved' | 'saving' | 'error' | 'quota-warning',
        lastSavedAt: string | null,
        conflictDetected: boolean,      // another tab wrote fresher data
        recoveredFromBackup: boolean,   // init() fell back to a backup slot
    };

    const updateState = (updater) => {
        state = produce(state, updater);  // Immer immutable update
        notify();                          // Notify React subscribers
        scheduleSave();                    // Debounced write (2s, 10s max wait)
    };

    const _internalUpdate = (updater) => {
        state = produce(state, updater);
        notify();
        // No save -- for meta-state like saveStatus, appStatus
    };

    return { getState, subscribe, getActiveCampaign, /* CRUD methods */ };
}

export const campaignService = createCampaignStore({ persist: true }); // Singleton
```

**Design decisions:**
- **Factory pattern** — `createCampaignStore({ persist: false })` enables isolated test instances
- **Two update paths** — `updateState()` triggers persistence; `_internalUpdate()` doesn't
- **Debounced save** — `AUTO_SAVE_DELAY_MS = 2000` coalesces rapid edits; `AUTO_SAVE_MAX_WAIT_MS = 10000` is armed on the *first* pending change in a burst so continuous typing still commits
- **`useSyncExternalStore`** — React 18+ API for subscribing to external state without Context

**Lifecycle API added by the ship-readiness pass:**

| Method | Purpose |
|--------|---------|
| `flushPendingSave()` | Synchronously commits any pending debounced write (no-op when nothing is pending). Used by `ErrorBoundary` before a reload and by the page-teardown handlers. |
| `resolveConflict('reload' \| 'overwrite')` | Ends a cross-tab conflict: adopt the other tab's on-disk snapshot, or force-save this tab's in-memory copy. Clears `conflictDetected` either way. |
| `dismissBackupRecoveryNotice()` | Clears `recoveredFromBackup` after the banner is acknowledged. |
| `destroy()` | Removes the `storage`-conflict subscription and the `pagehide`/`beforeunload`/`visibilitychange` listeners `init()` registered. Tests that build multiple persisting stores in one jsdom environment must call it in `afterEach`. |

### 4.2 React Binding

```typescript
// App.tsx
const { campaigns, activeCampaignId, appStatus, saveStatus, lastSavedAt } =
    useSyncExternalStore(campaignService.subscribe, campaignService.getState);
```

UI-only state (selected entity IDs, active view, modal states, `isMockMode`) lives in hooks extracted from App.tsx:
- `useEntitySelection` — selected IDs, nav stack, breadcrumbs, recent items
- `useModalState` — modal open/close state for all app-level dialogs

### 4.3 Persistence

`services/storageService.ts` owns every browser-storage interaction; `campaignService` never
touches `localStorage` directly.

- **Storage keys:** `realmweaver-campaigns` and `realmweaver-active-campaign-id`
- **Format:** JSON serialization of the full campaigns array
- **Timing:** Debounced 2-second auto-save after any `updateState()` call, forced after 10s of
  continuous activity, and flushed synchronously on `pagehide` / `beforeunload` /
  `visibilitychange → hidden`
- **Write ladder:** `localStorage.setItem()` first; on `QuotaExceededError` the value is written
  to IndexedDB instead (`realmweaver-db` / `campaigns` store), the stale localStorage copy is
  removed so `load()` cannot shadow the fresher one, and `saveStatus` becomes `'quota-warning'`
  rather than `'error'`. The IndexedDB write is awaited before `lastSavedAt` is stamped.
- **Backups:** before each write the previous value rotates through three slots named
  `<primaryKey>__backup_1..3` (slot 1 = newest). `getBackups()` / `restoreFromBackup()` expose
  manual recovery. Slots are namespaced per primary key, and the tiny active-campaign-id write
  opts out entirely via `{ skipBackup: true }`, so it can never evict the campaign snapshot.
- **Honest status reporting:** `persistToStorage` awaits the `pending` promise a quota-fallback
  save returns before stamping `lastSavedAt`, and a monotonic save-sequence token ensures only
  the newest in-flight write may update `saveStatus`.
- **Loading:** `init()` uses the async, IndexedDB-aware `load()` so data that only reached
  IndexedDB survives a restart. If the primary payload fails `JSON.parse`, `init()` walks the
  backup slots newest-first and sets `recoveredFromBackup` on the first that parses — the corrupt
  payload is deliberately **not** deleted. A throwing `localStorage` (Firefox with cookies
  blocked, Safari private mode) is caught so `appStatus` always resolves to something renderable.
- **Migration:** `migrateCampaignsData()` backfills array fields missing from older saves
  (`plots`, `notes`, `secrets`, `playerCharacters`, `relationships`, `history`, `memberIds`,
  `scenes[].npcIds`, `sessionLogs[].plannedSceneIds` / `encounterLog`, `activeEncounter`) so
  downstream CRUD never meets an `undefined` array.
- **Cross-tab conflicts:** `storageService.onConflict()` wires the `window` `storage` event. A
  write from another tab sets `conflictDetected`; `persistToStorage` refuses to write while the
  flag is set, so no tab silently clobbers another. `components/layout/StatusBanners.tsx` renders
  the choice and calls `resolveConflict()`.

### 4.4 Relationship Management

There are no dedicated `link*` / `set*Parent` methods. A relationship is edited by writing its
field through the ordinary updater — `updateNpc(id, { factionId })`,
`updateLocation(id, { parentLocationId })`, `updateArticle(id, { parentArticleId })`,
`updateScene(adventureId, sceneId, { locationId, npcIds })` — and the store enforces the invariants
internally:

- **Bidirectional sync:** `_synchronizeNpcFactionLink()` runs inside `createNpc`/`updateNpc`/`deleteNpc`
  and keeps the NPC's `factionId` and the Faction's `memberIds` in step. `_synchronizeLocationHierarchy()`
  and `_synchronizeArticleHierarchy()` do the same for `parentLocationId` ↔ `subLocationIds` and
  `parentArticleId` ↔ `subArticleIds`.
- **Cascade deletion:** Deleting a faction removes `factionId` from all linked NPCs; every delete path
  also calls `_purgeEntityReferences`.
- **Cycle detection:** `updateLocation`/`updateArticle` check `_isLocationParentingAllowed()` /
  `_isArticleParentingAllowed()` *before* applying the patch and abort the whole update (logging an
  error, leaving state untouched) if the new parent would close a cycle.
- **Scene linking:** Scenes reference NPCs and locations; deletion cascades to these references

### 4.5 deleteAdventure Cascade

`deleteAdventure(id)` follows the same cascade pattern as other entity deletes but has two additional cleanup steps specific to the Adventure/Scene/Session relationship:

1. **`Campaign.activeSceneId` cleared** — if the currently active scene belongs to the deleted adventure, `activeSceneId` is set to `undefined` so the Session Runner does not reference a non-existent scene.
2. **`SessionLog.adventureId` nulled** — all session logs that reference the deleted adventure have their `adventureId` set to `null` (preserving the log itself but removing the now-broken link).

These steps run inside a single `updateState()` call so the state transition is atomic and triggers one debounced save.

### 4.6 The Stage and the Scene Menu (unstructured play)

Design record: `docs/design/unstructured-play.md`. A live session is not required to have a scene track.

- **The Stage** — `SessionLog.stage?: SessionStage` (`{ locationId?, place?, npcIds, focus? }`) on the ACTIVE
  session is the DM's live statement of where the party is, who is with them, and what is happening. It is
  written only through dedicated store methods (`setStageLocation`, `addNpcToStage`, `removeNpcFromStage`,
  `setStageFocus`, `updateStage`), each of which — except the silent `updateStage` — appends a
  `scene-transition` running-log entry, so an improvised session produces the same timeline a scene-driven
  one does. `locationId` and `npcIds` are id-bearing: they are in `_purgeEntityReferences`, in both id-remap
  passes (`duplicateCampaign` preserves, `importTemplateData` drops unknown ids), and `npcIds` is backfilled
  by `normaliseRequiredArrays`.
- **The union rule.** Every reader derives `presentNpcs = sceneCast ∪ stage.npcIds` and
  `presentLocation = stage location ?? scene location` — `SessionRunner` (cards, cast dynamics, Combat Tracker
  auto-roster, the situation line handed to the zero-prompt tools) and `contextBuilder` ("On Stage Now" +
  "NPCs in Scene") alike. `sceneCast` still follows finding #26 (`plannedNpcIds` / `plannedLocationIds` win
  over the scene's own links when present).
- **Lifecycle invariants.** `enterScene(id)` leaves the previous scene `in-progress` (a menu, not a track),
  reopens a completed scene, and resets the Stage. `leaveScene({ complete })` (Done / Set Aside) seeds the
  Stage from the scene's place and cast merged with the prior Stage cast; `advanceScene()` past the last
  planned scene does the same instead of leaving the table nowhere. `removePlannedScene` reopens a started
  scene as `planned` and clears `activeSceneId` if it was live. `plannedSceneIds` may name scenes from ANY
  adventure; `goLive`, `advanceScene`, the runner and the store's Stage helpers all resolve through
  `utils/storyDerivations.resolveSceneById`, never through `SessionLog.adventureId`.
- **Idempotent `goLive`.** The prep wizard calls `goLive` and then hands the id to `App.handleGoLive`, which
  calls it again; a second call for the session that is already live is a no-op (previously it logged
  "Session started" twice). `createFreeformSession()` deliberately does not go live — one entry path.
- **Plot pressure.** `Plot.clock?` / `Plot.ifIgnored?` are non-id-bearing; every reader normalises through
  `utils/plotClock.normalizePlotClock`. `tickPlotClock` clamps and logs a `world-moved` entry; the
  Continuity Checker's `clock-expired` rule is `info` severity by design — a clock is the DM's tool, never
  a required field.

---

## 5. AI Service Architecture

### 5.1 Three-Layer Design

```
Components
    | import from aiService.ts ONLY
    v
aiService.ts          <- Facade: checks isMockMode, routes to real or mock
    |
    v
ai/realmWeaver.ts     <- Domain logic: prompts, schemas, instructions
ai/dmCoach.ts
ai/realmChat.ts
ai/evocationWizard.ts
ai/worldSimulation.ts
ai/styleMatching.ts
    |
    v
ai/core.ts            <- Backward-compat adapter (preserves 3 function signatures)
    |
    v
providers/registry    <- Active provider (default: claude-cli)
    |
    +-- claude-cli.ts    <- HTTP POST /api/ai/generate -> Vite proxy -> claude binary
    +-- anthropic-api.ts <- Anthropic REST API (stub, not yet implemented)
```

### 5.2 Provider Abstraction Layer

**Location:** `services/ai/providers/`

The provider abstraction allows swapping AI backends without changing domain modules.

**`AIProvider` interface** (all providers implement this):
```typescript
interface AIProvider {
    readonly name: string;
    generateWithSchema<T>(options: GenerateWithSchemaOptions): Promise<T>;
    generateText(options: GenerateTextOptions): Promise<string>;
    generateChatCompletion(options: GenerateChatOptions): Promise<string>;
}
```

**`ModelTier`** — logical quality tiers used throughout the app:
```typescript
type ModelTier = 'lite' | 'standard' | 'quality';

// Claude CLI aliases:   lite -> haiku,  standard -> sonnet,  quality -> opus
// Anthropic API IDs:    lite -> claude-haiku-4-5-20251001,
//                       standard -> claude-sonnet-4-6,
//                       quality  -> claude-opus-4-6
```

**`core.ts`** preserves the three function signatures all domain modules already use (`generateWithSchema`, `generateText`, `generateChatCompletion`). It maps legacy Gemini model name strings to `ModelTier` values so domain modules need no changes during migration.

**Claude CLI provider** (`providers/claude-cli.ts`):
- Makes HTTP POST to the Vite dev server at `/api/ai/generate`
- The `vite-plugin-ai-proxy.ts` middleware handles the request by spawning the `claude` binary
- Security: uses `execFile` (no shell injection) for prompts under 100KB; temp file approach for larger prompts

**Environment variables** for provider configuration, read by `modelConfig.getProviderConfig()`:

| Variable | Purpose | Default | Reaches the browser |
|----------|---------|---------|---------------------|
| `REALMWEAVER_AI_PROVIDER` | Active provider (`claude-cli` or `anthropic-api`) | `claude-cli` | Yes |
| `REALMWEAVER_DEFAULT_TIER` | Default model tier | `standard` | Yes |
| `REALMWEAVER_MAX_RETRIES` | Max retry attempts on transient errors (minimum 1) | `3` | Yes |
| `REALMWEAVER_TIMEOUT_MS` | Request timeout | `120000` (2 minutes) | Yes |
| `REALMWEAVER_API_BASE_URL` | Custom Anthropic base URL (`anthropic-api` only) | — | Yes |
| `CLAUDE_CLI_PATH` | Path to the `claude` binary | `claude` (on $PATH) | No |
| `ANTHROPIC_API_KEY` | API key for `anthropic-api` provider | — | No |

**How the values travel.** `vite.config.ts` calls `loadEnv(mode, '.', '')` and lists each
client-visible key in `define` as a literal `process.env.<KEY>` token. `modelConfig.ts` reads
them through an `ENV` object of **getters**, each wrapping its read in `safeEnv()`:

```typescript
const ENV = {
  get REALMWEAVER_MAX_RETRIES() { return safeEnv(() => process.env.REALMWEAVER_MAX_RETRIES); },
  // ...
};
```

Two constraints follow from this shape and must not be "simplified" away:

1. Each callback must reference `process.env.<KEY>` as a **literal member expression** — a
   whole-object shim (`typeof process !== 'undefined' ? process.env : {}`) defeats Vite's token
   substitution and silently disconnects every `REALMWEAVER_*` setting in the shipped app.
2. `safeEnv()` swallows the `ReferenceError: process is not defined` that a bare `process` read
   throws in the browser for keys `define` does not declare (the server-only secrets), so those
   resolve to their documented defaults instead of crashing at module load.

Getters rather than a snapshot: Node-side callers (tests, the Vite middleware) legitimately mutate
`process.env` at runtime and expect live reads. `providers/registry.ts` lazily resolves the initial
provider name from `modelConfig.getActiveProvider()` on first use, so the env var actually takes
effect; `setProvider()` discards the cached instance.

### 5.3 Core Adapter Functions (`ai/core.ts`)

The adapter forwards calls to the active provider after mapping legacy model names:

**`generateWithSchema(prompt, schema, instructions, configOverrides, modelName, campaignContext?)`**
- Forces structured JSON output (schema embedded in prompt for Claude)
- Injects campaign context
- `configOverrides.contents` (multimodal PDF parts) forwarded; `configOverrides.tools` (Google Search) silently dropped

**`generateText(fullPrompt, modelName, campaignContext?)`**
- Free-form text generation (narration, descriptions)

**`generateChatCompletion(history, systemInstruction, modelName, campaignContext?)`**
- Multi-turn conversation (RealmChat, EntityChatGenerator, document chat)

### 5.4 Domain Modules

| Module | Functions | Output |
|--------|-----------|--------|
| `realmWeaver.ts` | `generateNpc`, `generateLocation`, `generateFaction`, `generateItem`, `generateScene`, `generateAdventure`, `generateArticle`, `generatePoiFromLoot` | Structured entity JSON |
| `dmCoach.ts` | `generateNarration`, `generateImprovisation`, `generateRollableTable`, `generateEnhancedText`, `generateSessionRecap`, `analyzeSessionNotes` | Free text, structured tables |
| `realmChat.ts` | `chatWithRealmWeaver`, `generateNpcRoleplay` | `RealmChatResponse`, `{ dialogue, moodCue }` |
| `evocationWizard.ts` | `generateCampaignFill`, `parseDocumentForEntities`, `generateChatResponse`, `parseCharacterSheetPdf`, `generateStarterNpcs`, `generateStarterLocations`, `generateStarterAdventure` | Batch entity arrays |
| `worldSimulation.ts` | `generateWorldEvent` | `WorldEvent` |
| `styleMatching.ts` | `analyzeWritingStyle` | 200-word style guide string |
| `audioTranscription.ts` | `startAudioTranscription` | `AudioTranscriptionSession` (live AI Scribe) |

### 5.5 Service Facade (`aiService.ts`)

All AI functions route through `aiService.ts` with mock mode switching:

```typescript
export const generateNpc = (prompt: string, isMockMode = false, campaignContext?: string) => {
    if (isMockMode) return mockService.generateNpc(prompt, false, campaignContext);
    return aiRealmWeaver.generateNpc(prompt, campaignContext);
};
```

Audio transcription follows the same rule: `SessionLogEditor` imports `startAudioTranscription`
(and the `AudioTranscriptionConfig` / `AudioTranscriptionSession` types) from `aiService.ts`, which
dispatches to `mockService.startAudioTranscription` in mock mode. Nothing outside `services/`
imports `ai/audioTranscription` directly.

### 5.6 Mock Service (`ai/mockService.ts`)

Mirrors the facade API with hardcoded sample data, simulated async delays, and no external API calls. Used for offline development, smoke tests, and demo mode.

### 5.7 Campaign Context

`services/contextBuilder.ts` provides a tiered, token-budget-aware builder:

- **Variant `'generation'`** — world consistency: all entity names, setting, relationships
- **Variant `'coach'`** — current session: active scene, combat, recent events first
- **Variant `'chat'`** — balanced: entity names + current context

It takes a single `ContextOptions` object (**not** positional arguments):

```typescript
import { buildCampaignContext } from '@/services/contextBuilder';

const campaignContext = buildCampaignContext({
    variant: 'generation',        // 'generation' | 'coach' | 'chat'
    campaign,
    maxTokenEstimate: 4000,       // default; ~4 chars per token
    activeSceneId,                // optional
    activeSessionId,              // optional
    focusEntityId, focusEntityType, // optional — pulls full details for edit continuity
    focusSelection,               // optional — "USER IS VIEWING..." block for the DM Coach
});
```

Sections are added tier by tier and stop once the character budget
(`maxTokenEstimate * 4`) is exhausted; list sections fill entry-by-entry rather than
all-or-nothing, so a tight budget degrades to a partial roster instead of an empty one.

A fourth variant, `'player-safe'`, is the player-facing build (no GM-authored private prose, no
unrevealed secrets). When `activeSessionId` names a session with a non-empty Stage (§4.6), Tier 1
adds an **On Stage Now** section — place and present cast in every variant, the DM's `focus` line
GM-only — and the Stage's cast joins the "NPCs in Scene" list and the GM-ONLY secrets relevance set.
Plot lines carry `[clock n/m]` / `— if ignored: …`, and the Player Characters roster carries each
player's `playerFlags`.

A separate, simpler `buildCampaignContext()` in `utils/entityUtils.ts` builds a flat string with
entity names only — same name, different module. Do not confuse the two.

---

## 6. Component Architecture

### 6.1 View Routing

`EditorView` type in `App.tsx` defines all valid views:

```typescript
export type EditorView = 'setting' | 'npcs' | 'locations' | 'factions' | 'items' |
    'adventures' | 'lorebook' | 'session-logs' | 'player-characters' |
    'plots' | 'combat' | 'relationships' | 'session-runner' | 'secrets';
```

`components/layout/ViewRouter.tsx` renders the correct component for each `EditorView`. This was extracted from `App.tsx` to reduce its line count from ~1165 to ~564.

### 6.2 CampaignSidebar Patterns

**Default-expanded sections** — all collapsible sections in `CampaignSidebar` open by default so the sidebar is immediately usable without user interaction. Individual section state persists in local React state for the session.

**Drag-drop ordering** — Scene drag-and-drop within the sidebar tracks drag state in two React state variables (`draggingSceneId: string | null`, `dragOverSceneId: string | null`). Visual feedback (drop-target highlight) is applied by comparing these values during render. This replaces an earlier approach that applied CSS classes directly to DOM nodes via `element.classList`, which caused React state/DOM desync. The React-state approach ensures clean re-renders and compatibility with concurrent mode.

**Wizard handoff** — when the First Campaign Wizard completes, it signals the sidebar to expand the relevant entity sections so newly created content is immediately visible without manual navigation.

**Article tree icons** — `ArticleTreeItem` derives its icon from `ENTITY_TYPE_CONFIG` rather than a hardcoded fallback, so article section icons stay consistent with the rest of the app.

### 6.3 Three-Tier Component Pattern

**Dashboards** (`components/dashboards/`)
- List views showing all entities of a type
- Embed creation panel via `EntityCreationPanel` (chat/form toggle)
- Use `useEntitySearch` for search/filter
- Use `useRovingTabIndex` for keyboard list navigation
- Show entity completeness dots (visual indicator of how many optional fields are filled)
- Handle entity selection callbacks
- 10 dashboards: NPC, Location, Faction, Item, Adventure, Article, SessionLog, PlayerCharacter, Plot, Note

**Generators** (`components/generators/`)
- AI-powered creation forms
- Accept `isMockMode`, `campaignContext`, and `onEntityCreated` callback props
- Call `aiService` functions
- Support form-based creation; chat-based creation via `EntityChatGenerator`
- 8 generators + EntityChatGenerator

**Editors** (`components/editors/`)
- Detail editing views with tabbed layouts
- Manage local form state for fields
- Include AI-assist buttons (via `RegenerateButton`) for individual field generation
- Accept `onNavigate` callback for `EntityLink` click handling
- 12 editors + PrepDocumentView

### 6.4 Custom Hooks

| Hook | Purpose | Returns |
|------|---------|---------|
| `useEntitySelection` | All selected entity IDs, nav stack, breadcrumbs, recent items, handlers | `EntitySelectionState` |
| `useModalState` | Open/close state for all app-level modals; `closeTopModal()` priority logic | `ModalState` |
| `useConfirmDialog` | Programmatic confirm dialog via context provider | `{ confirm }` |
| `useToast` | Toast notification queue via context provider | `{ addToast }` |
| `useEntitySearch` | Multi-field case-insensitive filter for entity arrays (`useDeferredValue`-backed) | `{ filteredEntities, searchTerm, setSearchTerm }` |
| `useRovingTabIndex` | Roving tabindex for keyboard grid/list navigation | `{ getRovingProps }` |
| `useDebouncedFieldCommit` | Coalesces per-keystroke `onUpdate(id, updates)` writes from `MentionInput`-backed editor fields | `{ commit, flush }` |

**`useDebouncedFieldCommit(entityId, onUpdate, delayMs = 400)`** exists because editors are *not*
remounted when the user navigates between entities of the same type — the same mounted editor
simply receives a new entity prop. A naive field-keyed debounce therefore either fires with the
previous entity's id closed over, or is cancelled by the first keystroke into the new one. The
hook flushes pending edits against the id they were typed under whenever `entityId` changes, and
again on unmount. Used by `NpcEditor`, `LocationEditor`, `FactionEditor`, `ArticleEditor`, and
`PlotEditor`.

### 6.5 Dialog System

**`DialogShell`** provides:
- `role="dialog" aria-modal="true"`
- Focus trap (Tab/Shift+Tab stay within dialog)
- Escape key to close
- Backdrop click to close
- Body scroll lock while open

**`useConfirmDialog`** — context-provider pattern. `ConfirmDialogProvider` must wrap the app in `index.tsx`. Components call `const { confirm } = useConfirmDialog()` then `await confirm(title, message, options)`.

**`useToast`** — context-provider pattern. `ToastProvider` must wrap the app in `index.tsx`. Components call `const { addToast } = useToast()` then `addToast(message, variant)`.

### 6.6 Entity Cross-Linking System

| Component | Purpose |
|-----------|---------|
| `EntityLink` | Renders entity name as a styled inline link; shows `EntityQuickCard` on hover |
| `EntityQuickCard` | Portal-rendered floating preview card; mobile: bottom sheet |
| `LinkedText` | Scans text for entity name matches and wraps them in `EntityLink` |
| `BacklinksPanel` | Displays all entities that reference the current entity (via `backlinkUtils`) |
| `MentionInput` | Textarea with `@mention` autocomplete for 7 entity types |

### 6.7 Shared Common Components

| Component | Purpose |
|-----------|---------|
| `Button` | Styled button — 5 variants (`primary`, `secondary`, `ghost`, `danger`, `icon`), 3 sizes (`sm`, `md`, `lg`); `twMerge` for className overrides |
| `StepIndicator` | Multi-step wizard progress indicator (step number, label, completed/active state) |
| `Textarea` / `AiTextarea` | Styled textarea; exports `inputBaseClasses`, `textareaBaseClasses` |
| `Icons` | Centralized re-export from `lucide-react` — ALL icon imports must use this |
| `EntityHistoryManager` | Version history tracking for entities that support undo/history |
| `EntityCreationPanel` | Chat-vs-form creation mode toggle for dashboards |
| `RegenerateButton` | Inline AI field regeneration with expanded preview panel |
| `SkeletonCard` | Animated loading placeholder |
| `TabLayout` | Reusable tabbed panel layout with `TabDefinition` interface |
| `DmStylePanel` | DM Style settings panel (guided/standard/power modes) |
| `GenerateHerePanel` | Inline generation trigger panel with collapsible prompt textarea |
| `SceneResourcesPanel` | Collapsible in-editor NPC/location reference for SceneEditor |
| `CommandPalette` | Ctrl+K global search across all entity types |
| `Breadcrumbs` | Navigation breadcrumb trail with clickable segments |
| `KeyboardShortcutsHelp` | Keyboard shortcut reference overlay |
| `ErrorBoundary` | Class-based error boundary; optional custom fallback prop |

---

## 7. Type System

### 7.1 Entity Type Pattern

```typescript
// types/NPC.ts
export interface NPC {
    id: string;           // UUID (generated by campaignService)
    name: string;         // Display name
    description: string;  // Primary description
    history: Array<{...}>;  // Version history
    // entity-specific fields...
}
```

**Required fields (all entities):** `id`, `name`
**Common fields:** `description`, `history` (for entities with version tracking)

### 7.2 Campaign Type

See `types/Campaign.ts` for the authoritative definition. Key fields beyond the entity arrays:

```typescript
interface Campaign {
    // ...entity arrays (npcs, locations, factions, etc.)...
    secrets?: Secret[];
    activeEncounter?: Encounter;
    activeSceneId?: string;
    activeSessionId?: string;
    pinnedEntities?: Array<{ type: string; id: string }>;
    dmStyle?: DmStyle;               // 'guided' | 'standard' | 'power'
    featureOverrides?: Record<string, boolean>;
    wizardDismissed?: boolean;
    styleProfile?: string;           // AI-generated DM voice description
    gcpApiKey?: string;              // Optional GCP key for audio transcription
}
```

### 7.3 ENTITY_TYPE_CONFIG

Single source of truth for entity type metadata in `utils/entityUtils.ts`:

```typescript
export const ENTITY_TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  npc:              { icon: 'NPCs',             color: 'amber',   label: 'NPCs' },
  location:         { icon: 'Locations',        color: 'emerald', label: 'Locations' },
  faction:          { icon: 'Factions',         color: 'violet',  label: 'Factions' },
  item:             { icon: 'Items',            color: 'sky',     label: 'Items' },
  adventure:        { icon: 'Adventures',       color: 'orange',  label: 'Adventures' },
  article:          { icon: 'BookCopy',         color: 'cyan',    label: 'Articles' },
  sessionLog:       { icon: 'SessionLog',       color: 'rose',    label: 'Session Logs' },
  'session-log':    { icon: 'SessionLog',       color: 'rose',    label: 'Session Logs' },
  playerCharacter:  { icon: 'PlayerCharacters', color: 'teal',    label: 'Player Characters' },
  'player-character': { icon: 'PlayerCharacters', color: 'teal', label: 'Player Characters' },
  plot:             { icon: 'Plot',             color: 'yellow',  label: 'Plots' },
  note:             { icon: 'FileText',         color: 'slate',   label: 'Notes' },
  scene:            { icon: 'Scenes',           color: 'blue',    label: 'Scenes' },
};
```

Derive color shades: `` `text-${config.color}-400` ``, `` `bg-${config.color}-900/60` ``.
Because those strings are composed at runtime, Tailwind's build-time scanner cannot see them —
`index.css` keeps them alive with `@source inline(...)` safelists covering every color in this map
(plus `blue`). Adding a new color here means extending that safelist, or the classes compile to
nothing.

Known gap: the map is an open `Record<string, ...>` rather than a closed union, so a typo'd key
type-checks and silently resolves to `undefined`. There is still no `secret` entry.

### 7.4 Adding a New Entity Type

1. Create `types/NewEntity.ts`
2. Export from `types/index.ts`
3. Add array to `Campaign` interface in `types/Campaign.ts`
4. Add CRUD methods in `campaignService.ts`
5. Add mock data in `mockService.ts`
6. Add facade function in `aiService.ts`
7. Add default factory in `entityUtils.ts`
8. Add entry in `ENTITY_TYPE_CONFIG` in `entityUtils.ts`
9. Create generator, dashboard (with `EntityCreationPanel` + `useEntitySearch`), and editor components
10. Add `EditorView` value in `App.tsx`
11. Add view rendering in `ViewRouter.tsx`
12. Add sidebar entry in `CampaignSidebar.tsx`

---

## 8. Utilities

| Utility | Purpose |
|---------|---------|
| `entityUtils.ts` | Default entity factories (`createDefaultNpc()`, etc.), `ENTITY_TYPE_CONFIG`, the legacy flat `buildCampaignContext()`, `estimatePcHp()` |
| `formReconciliation.ts` | `reconcileEntityFormData()` — merges in-progress editor form state with a freshly-arrived entity prop field-by-field, so a concurrent external change (async AI generation, bidirectional relationship sync) lands without discarding the user's edits |
| `entityDetailExtractors.ts` | Extract display strings and edit details from entity fields; defines `QuickCardEntityType` |
| `entityFieldSave.ts` | Dispatch field-level saves to the correct `campaignService.update*()` method by entity type |
| `backlinkUtils.ts` | `computeBacklinks(campaign, entityId, entityType)` — compute all inbound cross-references |
| `dmStyleUtils.ts` | `isFeatureVisible(feature, dmStyle, overrides)` — feature visibility logic for DM Style modes |
| `demoTemplates.ts` | Starter demo campaign data for the onboarding quick-start option |
| `diceUtils.ts` | `parseFormula(formula)` + `rollDice(formula)` — dice formula parsing and rolling |
| `keyboardShortcuts.ts` | `SHORTCUTS` constant + `matchShortcut(event)` — keyboard shortcut definitions and matching |
| `popoverPosition.ts` | `calculatePopoverPosition(triggerRect, isExpanded)` — screen coordinate calculation for popovers |

---

## 9. Styling Architecture

### 9.1 Tailwind CSS at build time

Tailwind 4 is compiled by the `@tailwindcss/vite` plugin (registered in `vite.config.ts`) from
`index.css`, which `index.html` loads as a plain stylesheet. The old
`<script src="https://cdn.tailwindcss.com">` runtime JIT compiler is gone, along with the Google
Fonts `<link>` that accompanied it — `index.html` now declares system font stacks and a strict
`Content-Security-Policy` meta (`script-src 'self'`), so no remote origin can execute script in a
page holding campaign data and `gcpApiKey` in localStorage.

- No `tailwind.config.js` — configuration is CSS-first (`@import "tailwindcss"`)
- No PostCSS pipeline of our own; the Vite plugin owns compilation
- `tailwind-merge` still resolves conflicting classes at runtime in `Button` and friends
- Non-Tailwind CSS (scrollbar theming, `animate-quill`, `animate-fade-in`, `.card-parchment`, and a
  hand-rolled `animate-in` polyfill) lives in a `<style>` block in `index.html`

**Runtime-composed classes must be safelisted.** The scanner only emits CSS for literal strings it
finds in source, but several components build accent classes from `ENTITY_TYPE_CONFIG[...].color`
via template literals. `index.css` therefore ends with two `@source inline(...)` directives
covering `{text,bg,border,border-l}` × every config color (plus `blue`) × the shades and opacity
steps in use. Known template-literal call sites are listed in the comment above those directives;
converting one to a static class map is the more self-documenting fix, but the safelist is
deliberately broad so a newly added color cannot silently regress to unstyled output.

### 9.2 Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| Page background | `bg-slate-900` | Page, outermost container |
| Card background | `bg-slate-800` | Cards, panels, modals |
| Secondary bg | `bg-slate-700` | Secondary buttons, inputs |
| Primary text | `text-slate-100` | Body text, labels |
| Secondary text | `text-slate-300` / `text-slate-400` | Secondary text, placeholders |
| Accent | `text-amber-400`, `bg-amber-600` | Interactive elements, primary buttons |
| Border | `border-slate-700`, `border-slate-600` | Separators, form inputs |
| Radius | `rounded-lg` (cards), `rounded-md` (inputs) | Consistent corner rounding |

**Note:** Earlier codebase versions used `stone-*` tokens. The codebase now uses `slate-*` throughout. Do not introduce `stone-*` in new code.

### 9.3 Indigo Exception

`indigo-*` tokens are used exclusively in `RealmChatWidget.tsx` to visually distinguish the AI assistant voice. Never add indigo elsewhere.

### 9.4 Input Base Classes

`components/common/Textarea.tsx` exports:

```typescript
export const inputBaseClasses = 'bg-slate-800 border border-slate-600 rounded-lg text-slate-100 '
    + 'placeholder-slate-400 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 focus:outline-none';

export const textareaBaseClasses = `${inputBaseClasses} resize-none`;
```

Use these for all text input and textarea elements.

### 9.5 Button Component Pattern

`components/common/Button.tsx` is the single source for interactive buttons with 219+ instances across the codebase.

**Variants** map to design tokens:

| Variant | Visual | Use case |
|---------|--------|----------|
| `primary` | `bg-amber-600 hover:bg-amber-500` | Primary actions (Save, Generate, Create) |
| `secondary` | `bg-slate-700 hover:bg-slate-600` | Secondary actions (Cancel, Close) |
| `ghost` | Transparent, `hover:bg-slate-700` | Toolbar actions, list row controls |
| `danger` | `bg-red-700 hover:bg-red-600` | Destructive actions (Delete) |
| `icon` | Square ghost variant sized to icon | Icon-only buttons; always include `aria-label` |

**Sizes:** `sm` (compact toolbars), `md` (default), `lg` (hero/CTA).

**`twMerge` composition** — the component merges the caller's `className` prop over base classes using `twMerge`, so one-off overrides (`w-full`, custom margin) are safe without specificity fights.

**When NOT to use `Button`:** Card click targets, tab triggers, chip/pill toggles, and elements whose primary semantic role is not "action button" may remain raw `<button>` elements with their own styling. The goal is consistency for action buttons, not eliminating every raw `<button>`.

---

## 10. Testing

### 10.1 Vitest Unit Tests (`tests/`)

```bash
npm test            # Run once  (990 tests / 143 files)
npm run test:watch  # Watch mode
```

The Vitest `environment` default is `node` (set in `vite.config.ts`); render tests opt into jsdom
per-file with a `@vitest-environment jsdom` docblock and use `@testing-library/react`.

Test files cover:
- `campaignService.sprint1.test.ts`, `.cascadeDeletion`, `.initMigration` — entity CRUD, relationships, reference purging, migration/backfill
- `storageService.test.ts` — persistence ladder, backup rotation, conflict events
- `contextBuilder.test.ts` — tiered context assembly and budget behaviour
- `diceUtils.test.ts` — formula parsing and rolling
- `aiServiceAdapters` / `claudeCliProvider` / `retryProvider` — facade, provider and retry semantics
- `tests/services/linking/` — matching engine and auto-linker
- `archetype.*.test.ts` — 5 DM archetype scenario tests (forever-dm, lazy-dm, new-dm, tactical-dm, worldbuilder)
- `migration-verification.test.ts` — AI migration correctness (asserts nothing under `services/ai/` still imports `@google/genai`, except `audioTranscription.ts`'s dynamic import)
- `tests/ship/` — one suite per ship-readiness finding, including the jsdom render tests for editors, dialogs and hooks

### 10.2 Playwright E2E Tests (`e2e/`)

```bash
npm run test:e2e          # Headless
npm run test:e2e:headed   # Visible browser
npm run test:e2e:ui       # Interactive UI
```

114 tests across 14 spec files, run against two projects (`chromium`, `mobile-chrome`); 6 are
skipped. `playwright.config.ts` targets `http://127.0.0.1:4200` — not `localhost`, because Vite
binds to `127.0.0.1` and Node's resolver may prefer `::1`. A `globalSetup` (`e2e/global-setup.ts`)
verifies the reused or launched server really is Realmweaver before any spec runs.

Covers: campaign creation lifecycle, entity CRUD (core + extended), generators, dialogs, editors,
navigation (EntityLink, back stack), session runner flow, DM tools, visualizers, mobile layout,
RealmChat.

### 10.3 Smoke Tests (`smokeTest.ts`)

Opt-in only: runs on app startup in development mode when `VITE_RUN_SMOKE_TESTS=true` is set (see `.env.local.example`) — it no longer runs automatically, since the suite wipes the `realmweaver-campaigns` / `realmweaver-active-campaign-id` storage keys and, with Mock Mode off, fires live AI calls against the real provider. Tests service function availability and a full entity CRUD session. Console reports pass/fail.

### 10.4 Manual Testing

Toggle mock mode in the app header for full feature testing without any AI API key or network access.

### 10.5 CI

`.github/workflows/ci.yml` runs on push to `main` and every pull request: `npm ci` →
`npm run typecheck` → `npm test` → `npm run build` → `npx playwright install --with-deps chromium`
→ `npm run test:e2e -- --project=chromium`. The `mobile-chrome` project is temporarily excluded
there: `Header.tsx` renders at `z-[60]` while `DialogShell`'s overlay and the mobile sidebar sit at
`z-50`/`z-40`, so on narrow viewports the header can intercept the clicks `e2e/helpers.ts` makes.

---

## 11. Build & Deployment

### 11.1 Vite Configuration

```typescript
// vite.config.ts highlights
{
    plugins: [react(), tailwindcss(), aiProxyPlugin()],
    server: {
        port: 4200,
        // Localhost-only by default; REALMWEAVER_DEV_HOST opts into a wider bind.
        host: env.REALMWEAVER_DEV_HOST || '127.0.0.1',
        // A taken port must fail loudly — playwright.config.ts hardcodes 4200.
        strictPort: true,
    },
    build: {
        rollupOptions: { output: { manualChunks(id) { /* react, lucide-react */ } } },
    },
    resolve: { alias: { '@': path.resolve(__dirname, '.') } },
    define: {
        'process.env.REALMWEAVER_AI_PROVIDER': JSON.stringify(env.REALMWEAVER_AI_PROVIDER || 'claude-cli'),
        'process.env.REALMWEAVER_DEFAULT_TIER': JSON.stringify(env.REALMWEAVER_DEFAULT_TIER || ''),
        // ...MAX_RETRIES, TIMEOUT_MS, API_BASE_URL
        // SECURITY: ANTHROPIC_API_KEY and GEMINI_API_KEY are intentionally NOT injected
        // into the client bundle. loadEnv(mode, '.', '') uses an empty prefix, so it merges
        // in every key already present in process.env — wiring one into `define` would bake
        // that secret into dist/assets/*.js as a literal.
    },
    test: { globals: true, environment: 'node', exclude: ['e2e/**', 'node_modules/**'] },
}
```

`manualChunks` splits React and `lucide-react` out of the entry chunk. It does not by itself clear
the 500 KB entry-chunk warning: the bulk of the weight is the app's own component tree, since
`ViewRouter.tsx` statically imports every dashboard and editor. Only `RelationshipGraph` (in
`ViewRouter`) and five dialogs (in `App.tsx`) are `React.lazy`-split today.

### 11.2 Environment Variables

See §5.2 for the provider knobs and how `define` + `modelConfig`'s getters carry them. Two more
variables affect the server process only:

| Variable | Source | Injected to Browser | Purpose |
|----------|--------|---------------------|---------|
| `REALMWEAVER_DEV_HOST` | `.env.local` | **No** | Overrides the default `127.0.0.1` dev-server bind. Widening it exposes `/api/ai/generate` to the LAN; the proxy's loopback peer check still rejects those callers |
| `VITE_RUN_SMOKE_TESTS` | `.env.local` | Yes | Opts `smokeTest.ts` into running on startup in dev |
| `GEMINI_API_KEY` | `.env.local` | **No** | Deliberately not wired into `define`. Nothing reads `process.env.GEMINI_API_KEY` — the Gemini key used by audio transcription is sourced per-campaign from `campaign.gcpApiKey` |

### 11.3 Production Build & Runtime

```bash
npm run typecheck  # tsc --noEmit — `npm run build` does NOT typecheck
npm run build      # Outputs to dist/
npm run preview    # Serves dist/ AND the /api/ai/* proxy
```

The build produces a static SPA bundle with no server-side rendering — but `dist/` is not a
self-contained deployable. `aiProxyPlugin()` registers its routes through **both**
`configureServer` (dev) and `configurePreviewServer` (preview), so `npm run dev` or
`npm run preview` *is* the supported runtime. A `dist/` served by anything else (a plain static
host or CDN, with no Node process behind it) has no AI backend at all: every `/api/ai/*` call
404s and every AI feature fails.

---

## 12. Security Considerations

- **API key handling:** `ANTHROPIC_API_KEY` is NOT injected into the client bundle. It is consumed server-side in the Vite proxy middleware. The `claude-cli` provider has no API key at all — authentication is handled by the Claude Code CLI binary's own session.
- **Data storage:** All campaign data is stored in browser localStorage (IndexedDB on quota overflow). No server-side persistence.
- **No authentication:** The app is single-user, local-only.
- **Content Security Policy:** `index.html` declares `default-src 'self'` with `script-src 'self'`. `'unsafe-inline'`/`'unsafe-eval'` remain only for the react-refresh preamble in dev; no remote origin may execute script. `connect-src` additionally allows `ws:`/`wss:` for the HMR socket.
- **Input sanitization:** AI-generated content is rendered as text/markdown, not raw HTML.

### 12.1 AI Proxy Request Authentication

`/api/ai/generate` and `/api/ai/health` shell out to a local binary on behalf of client-supplied
input, so `vite-plugin-ai-proxy.ts` gates both with layered checks, most authoritative first:

1. **TCP peer address (mandatory).** `req.socket.remoteAddress` must be loopback. The kernel sets
   this from the real connection, so unlike every header below it cannot be forged — this is what
   closes the LAN exploit of spoofing `Origin` *and* `Host` from a real remote peer.
2. **`Origin` + `Host` allowlist.** Both must resolve to a localhost interface
   (`ALLOWED_ORIGIN_RE` / `ALLOWED_HOST_RE`). A missing or empty `Origin` is rejected, not waved
   through. Browsers do not let page script override `Origin`, so this blocks DNS rebinding; the
   `Host` cross-check catches a request that arrived over a widened bind. `extractHostname()`
   strips ports bracket-aware, handling the bare `::1` form that `new URL()` rejects.
3. **Per-session proxy token (defense in depth, not yet required).** A fresh 32-byte token is
   generated per server process and injected into the page via `transformIndexHtml`. When the
   `x-realmweaver-token` header is present it is compared with `timingSafeEqual` and a mismatch is
   always rejected — but `services/ai/providers/claude-cli.ts` does not yet send it, so the token
   does not currently close the "another local process on this machine" case.

Resource bounds: request bodies cap at 4 MB (a 413 is flushed *before* the request stream is
destroyed, so the client sees the status rather than `ECONNRESET`); the CLI runs under a 120 s
timeout with a 1 MB stdout cap, and output beyond it kills the child and rejects with `ENOBUFS`
rather than truncating silently. A `--output-format json` run whose envelope will not parse
returns 502. Invocation uses `execFile`/`spawn` — never a shell string; prompts over 100 KB are
piped to the child's stdin instead of argv to stay under `ARG_MAX`.

---

## 13. Known Limitations & Technical Debt

1. **No server-side persistence** — localStorage (with IndexedDB overflow) only; data is browser-specific
2. **Anthropic API provider is a stub** — every method of `providers/anthropic-api.ts` throws "not yet implemented"
3. **`@google/genai` still listed as dependency** — reached only by `services/ai/audioTranscription.ts`'s dynamic import; `tests/migration-verification.test.ts` pins that as the sole exception
4. **Smoke tests lack TypeScript compilation** — `smokeTest.ts` runs directly in-browser, not via Vitest
5. **No streaming** — every AI call is a single request/response round trip, so batch generation blocks until the whole CLI invocation returns
6. **Proxy token generated but not required** — the client does not yet send `x-realmweaver-token` (see §12.1)
7. **Per-view code is not lazy-split** — `ViewRouter.tsx` statically imports every dashboard and editor (22 modules), keeping the entry chunk over the 500 KB warning threshold
8. **Two incompatible `ModelTier` types** — `types/RealmChat.ts` declares `'performance' | 'medium' | 'quality'`, bridged to `modelConfig.ts`'s `'lite' | 'standard' | 'quality'` by hand-written mapping rather than a shared type
9. **`DialogShell` renders inline** — no React portal, and the background app is not marked `inert`/`aria-hidden` while a modal is open
10. **Backup rotation costs on every autosave** — each debounced save serializes the campaigns array and performs additional `localStorage` round trips to rotate slots

The fuller, continuously maintained list lives in `system-architecture.md` §12.
