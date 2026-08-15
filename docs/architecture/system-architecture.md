# Realmweaver — System Architecture

> **Status:** Authoritative architecture reference. Supersedes the narrative parts of
> `high-level-design.md` and `technical-design.md` as the entry point for understanding the
> system; those documents remain for phase history and implementation planning notes.
> **Verified against:** commit `f043509`, after the 124-finding ship-readiness remediation
> (`docs/ship-readiness/remediation-plan.md`) — 990/990 Vitest tests across 143 files passing.
> **Last Updated:** 2026-08-14

---

## 1. Purpose & Product Overview

Realmweaver is a client-side single-page application for tabletop RPG Game Masters. It
covers the full GM workflow for one or more campaigns: building a world (NPCs, locations,
factions, items, adventures, lore articles), preparing and running sessions (session prep,
a live Session Runner with scene advancement and a running log, combat tracking, dice
rolling, secrets/clues), and keeping that world internally consistent as it grows
(cross-entity linking, backlinks, a rule-based continuity checker, a relationship graph).
AI assistance is woven through nearly every creation and editing surface — entity
generation, DM-facing narration and improvisation, a conversational world-building
assistant, batch "evocation" of a starter world, and a coach that helps run a session in
progress — but the app is fully usable in a mock-data mode with no AI backend at all.

Architecturally, Realmweaver is a "local-first" tool: there is no application server or
database. The Vite dev server doubles as the production runtime (`npm run dev` *is* how the
app is run), the AI backend is the user's own local Claude Code CLI installation (or, in a
stubbed-out future path, a direct Anthropic API integration), and all campaign data is
persisted in the browser via `localStorage` with an `IndexedDB` fallback for quota
overflow. This means the trust boundary of interest is not "client vs. server" in the
usual sense but "browser tab vs. local machine": the one network-facing surface (the AI
proxy) is deliberately restricted to same-origin, localhost-bound requests so that a
malicious web page cannot spend the user's Claude usage or exfiltrate campaign data through it.

---

## 2. Technology Stack

| Dependency | Version | Role |
|---|---|---|
| React | 19.2.0 | UI rendering; `useSyncExternalStore` is the integration point with the custom state store |
| TypeScript | 5.8.2 | Static typing across the entire codebase (no `src/`; code lives at project root) |
| Vite | 6.2.0 | Dev server, bundler, and (via `vite-plugin-ai-proxy.ts`) the AI request middleware |
| `@vitejs/plugin-react` | ^5.0.0 | React Fast Refresh / JSX transform for Vite |
| `immer` | ^10.1.3 | Structural-sharing immutable updates inside `campaignService`'s `produce()` calls |
| `tailwind-merge` | ^3.3.1 | Merges/overrides conflicting Tailwind class strings in shared components (`Button`, `MentionInput`, etc.) |
| `tailwindcss` + `@tailwindcss/vite` | ^4.3.3 | Utility-class styling, compiled at **build time** from `index.css` — the CDN `<script>` JIT compiler was removed (see §12) |
| `lucide-react` | ^0.546.0 | Icon source, re-exported exclusively through `components/common/Icons.tsx` |
| `d3` | 7.8.5 | Force layout and rendering primitives for `RelationshipGraph` |
| `@anthropic-ai/sdk` | ^0.39.0 | Anthropic Messages API client — wired into the still-stubbed `anthropic-api` provider |
| `@google/genai` | ^1.25.0 | Reached only by `services/ai/audioTranscription.ts`'s dynamic `import()`; no other `services/ai/*` module touches it, and `tests/migration-verification.test.ts` pins that as the single exception |
| `@types/react`, `@types/react-dom` | ^19.2.17 / ^19.2.3 | Type declarations for React 19; their absence had let ~20 latent type errors (incl. a `SessionPrepWizard` bug and a missing `'scene'` union member) go undetected by `tsc` |
| Vitest | ^4.1.0 | Unit/component test runner (`tests/`); `environment: 'node'` by default |
| `@testing-library/react` + `@testing-library/dom` + `jsdom` | ^16.3.2 / ^10.4.1 / ^30.0.1 | Rendered-component tests, opted into per-file with `@vitest-environment jsdom` |
| Playwright (`@playwright/test`, `@playwright/mcp`) | ^1.58.2 / ^0.0.68 | End-to-end browser test runner (`e2e/`) |
| `typescript` | ~5.8.2 | Compiler; `npm run typecheck` runs `tsc --noEmit` as a standalone gate — `npm run build` does not typecheck |

`reactflow` and `dagre` were previously declared but never imported; both were removed, and
`tests/ship/wp-i2-build-test-infra.package-deps.test.ts` fails if either is reintroduced without a
real import.

---

## 3. Runtime Topology

Three processes are involved, only one of which is a "server" in any conventional sense —
and it only exists because `npm run dev` is the way this app is actually run in
production, not just in development.

```mermaid
flowchart LR
    subgraph Browser["Browser — React 19 SPA"]
        UI["Components<br/>(views/dashboards/generators/editors/dialogs/tools/visualizers)"]
        Store["campaignService<br/>(state store)"]
        AIFacade["aiService.ts<br/>(AI facade)"]
        Storage["storageService<br/>(localStorage / IndexedDB)"]
    end

    subgraph ViteServer["Vite dev OR preview server (also the production runtime)"]
        Proxy["vite-plugin-ai-proxy.ts<br/>POST /api/ai/generate<br/>GET /api/ai/health"]
    end

    subgraph Local["Local Machine"]
        CLI["Claude Code CLI binary<br/>(execFile / spawn, no shell)"]
    end

    subgraph Cloud["Anthropic (future path)"]
        API["Anthropic Messages API<br/>(anthropic-api provider — STUB, not implemented)"]
    end

    UI --> Store
    UI --> AIFacade
    Store --> Storage
    AIFacade -- "fetch('/api/ai/generate')<br/>same-origin only" --> Proxy
    Proxy -- "execFile/spawn, 120s timeout,<br/>1MB stdout cap" --> CLI
    AIFacade -.-> API

    style API stroke-dasharray: 5 5
```

**Both server modes carry the proxy.** `aiProxyPlugin()` registers the same routes through
`configureServer` (`vite dev`) *and* `configurePreviewServer` (`vite preview`, serving the built
`dist/`), so a previewed production build behaves identically instead of 404ing on every AI call.
Neither hook helps a `dist/` served by something other than Vite — a plain static host has no Node
process to run the plugin at all. `transformIndexHtml` (which injects the proxy token) runs only in serve
mode — the plugin is `apply: 'serve'`, so `vite build` never bakes a stale token into `dist/`.

**Security posture of the AI proxy** (`vite-plugin-ai-proxy.ts`):

- **Localhost bind.** `vite.config.ts` binds the dev server to `127.0.0.1:4200` by default
  (`REALMWEAVER_DEV_HOST` env var can opt into a wider bind) with `strictPort: true`, so a taken
  port fails loudly rather than drifting to 4201 behind Playwright's hardcoded URL. This keeps
  `/api/ai/generate` unreachable from other devices on the LAN by default.
- **TCP peer address gate (mandatory).** Every request to `/api/ai/generate` and
  `/api/ai/health` is first checked against `req.socket.remoteAddress` — it must be a loopback
  address. Unlike every header below, this value is set by the kernel from the real TCP
  connection and cannot be forged by a client that controls its own request headers (curl,
  python, arbitrary scripts), which is what closes the LAN-bind exploit: forging `Origin` *and*
  `Host` to read as `localhost` from a real LAN peer is rejected outright, because the peer
  address itself isn't loopback.
- **Origin + Host validation.** Both headers must resolve to a localhost interface
  (`ALLOWED_ORIGIN_RE` / `ALLOWED_HOST_RE`) — a missing/empty Origin is rejected, not allowed
  through. Origin cannot be forged by page JS in a browser (`fetch`/`XHR` don't let script
  override it), so this is what blocks DNS-rebinding / any other page the browser happens to
  have open; Host cross-checks that the connection didn't arrive over a LAN bind.
- **Per-session proxy token (defense in depth, not yet enforced).** The plugin generates a
  random token at process start and injects it into dev-served pages via `transformIndexHtml` (serve mode only — built `dist/` pages carry no token);
  `X-Realmweaver-Token`, when present, is validated with a constant-time comparison and a
  mismatch is always rejected. It is not yet *required* on every request — the browser client
  doesn't send it yet (see the header comment in `vite-plugin-ai-proxy.ts` for the exact wiring
  still needed) — so today it hardens the design without yet closing the "other local process on
  the same machine" case (see §12).
- **No shell.** CLI invocation uses `execFile`/`spawn` (never a shell string), so
  arbitrary prompt content cannot achieve command injection. Prompts over 100 KB switch
  from an argv-based invocation to writing to the child process's stdin, avoiding OS
  `ARG_MAX` limits without introducing a shell.
- **Bounded resources.** Request bodies are capped at 4 MB — a request that exceeds it gets a
  `413` (the request stream is paused, not immediately destroyed, so the response actually
  reaches the client before the socket is torn down). CLI invocation has a 120 s timeout and a
  1 MB stdout buffer cap (`MAX_BUFFER`); output beyond that now **kills the child and rejects
  with `ENOBUFS`** (both the `execFile` and stdin-piped `spawn` paths) rather than silently
  truncating — the previous "silently truncated" gap is fixed, not merely documented.
  `outputFormat: 'json'` requests whose CLI output doesn't parse as the expected result envelope
  get a `502` instead of the raw, possibly-mangled text.
- **No client-side API key.** `ANTHROPIC_API_KEY` is intentionally *not* injected into the
  client bundle (`vite.config.ts`'s `define` block comments this explicitly) — the
  `claude-cli` provider doesn't need it, and the future `anthropic-api` provider would
  consume it server-side only. `GEMINI_API_KEY` is likewise excluded: `loadEnv(mode, '.', '')`
  uses an empty prefix and so merges in every key already in `process.env`, meaning wiring one
  into `define` would bake the secret into `dist/assets/*.js` as a literal.

**Client-visible provider configuration.** The knobs that *are* declared in `define`
(`REALMWEAVER_AI_PROVIDER`, `_DEFAULT_TIER`, `_MAX_RETRIES`, `_TIMEOUT_MS`, `_API_BASE_URL`) are
substituted as literal `process.env.<KEY>` tokens. `services/ai/modelConfig.ts` reads them back
through an `ENV` object of getters, each wrapping its read in `safeEnv()`. Getters, not a
snapshot: Node-side callers (tests, middleware) mutate `process.env` at runtime and expect live
reads. Two invariants hold this together — each getter must reference `process.env.<KEY>` as a
literal member expression (a whole-object `typeof process !== 'undefined' ? process.env : {}` shim
defeats Vite's substitution and silently disconnects every setting in the shipped app), and
`safeEnv()` must swallow the `ReferenceError` a bare `process` read throws in the browser for the
undeclared server-only keys so they fall back to documented defaults instead of crashing at module
load.

---

## 4. Layered Architecture

```mermaid
flowchart TB
    subgraph Presentation["Presentation Layer (components/)"]
        direction LR
        Views["views/<br/>(WelcomeScreen, CampaignCreator,<br/>FirstCampaignWizard, SessionRunner,<br/>CrossCampaignDashboard)"]
        Dashboards["dashboards/<br/>(10 entity list views)"]
        Generators["generators/<br/>(8 AI creation forms<br/>+ EntityChatGenerator)"]
        Editors["editors/<br/>(12 tabbed detail editors)"]
        Dialogs["dialogs/<br/>(DmCoach, wizards, modals)"]
        Tools["tools/<br/>(Combat, Dice, Secrets)"]
        Visualizers["visualizers/<br/>(RelationshipGraph, PlotTimeline)"]
        RealmChat["RealmChat/<br/>(floating assistant)"]
        Common["common/<br/>(shared primitives)"]
        Layout["layout/<br/>(App shell, ViewRouter, Sidebar)"]
    end

    subgraph Application["Application Services (services/, hooks/)"]
        CampaignSvc["campaignService.ts<br/>(state store)"]
        AiSvc["aiService.ts<br/>(facade)"]
        ContextBuilder["contextBuilder.ts<br/>(tiered context)"]
        Linking["linking/<br/>(matching engine, autoLinker)"]
        Continuity["continuityChecker.ts"]
        ImportExport["importExportService.ts"]
        StorageSvc["storageService.ts<br/>(persistence ladder)"]
        Hooks["hooks/<br/>(selection, modals, search,<br/>roving-tabindex, toast, confirm)"]
    end

    subgraph Domain["Domain Types (types/)"]
        Types["Campaign, NPC, Location, Faction,<br/>Item, Adventure, Scene, Article,<br/>SessionLog, PlayerCharacter, Plot,<br/>Note, Secret, Encounter, ..."]
    end

    subgraph Utilities["Utilities (utils/)"]
        EntityUtils["entityUtils.ts<br/>(factories, ENTITY_TYPE_CONFIG)"]
        FormRecon["formReconciliation.ts"]
        BacklinkUtils["backlinkUtils.ts"]
        Others["dmStyleUtils, diceUtils,<br/>keyboardShortcuts, popoverPosition,<br/>entityFieldSave, entityDetailExtractors"]
    end

    Presentation --> Application
    Application --> Domain
    Presentation -.-> Utilities
    Application -.-> Utilities
    Application --> Domain
```

**Layer rules enforced by convention** (see `CLAUDE.md`):

- Components call **only** `aiService.ts` for AI — never `services/ai/*` modules directly. The
  last violation (`SessionLogEditor.tsx` importing `services/ai/audioTranscription.ts`) was
  closed: the facade now exports `startAudioTranscription` plus the `AudioTranscriptionConfig` /
  `AudioTranscriptionSession` types, and `mockService` provides a mock that emits canned
  transcript chunks on a timer.
- Components call `campaignService` methods for all state mutation; no direct mutation of
  `Campaign` objects. Immer inside the store is what makes this safe.
- `types/index.ts` is the only import path components use for domain types (barrel export).
- `ENTITY_TYPE_CONFIG` in `utils/entityUtils.ts` is the single source of truth for entity
  icon/color/label — components must not hardcode these.

---

## 5. Component Catalog

Every file under `components/` and `services/` is listed below, grouped by directory, with
a one-line responsibility. `hooks/` and `utils/` (part of the Application/Utilities layers)
are included for completeness.

### 5.1 `components/common/` — shared primitives

| File | Responsibility |
|---|---|
| `BacklinksPanel.tsx` | Renders "Referenced By" inbound cross-references computed by `backlinkUtils.computeBacklinks`, grouped by entity type |
| `Breadcrumbs.tsx` | Navigation breadcrumb trail with back-stack support |
| `Button.tsx` | Unified button abstraction: 5 variants (primary/secondary/ghost/danger/icon) × 3 sizes, `twMerge`-composed className |
| `CommandPalette.tsx` | Ctrl+K / `/` global entity search across all entity types in the active campaign |
| `ConfirmDialog.tsx` | The modal rendered by `useConfirmDialog`'s context provider; danger/default variants |
| `DialogShell.tsx` | Base modal wrapper: focus trap, Escape-to-close, backdrop-click-to-close, body scroll lock, `role="dialog"`. Renders **inline**, not via a React portal (see §12) |
| `DmStylePanel.tsx` | DM Style (guided/standard/power) settings UI with per-feature manual overrides, `role="radiogroup"` |
| `EntityCreationPanel.tsx` | Chat-vs-form creation mode toggle used by every dashboard's "create new" flow |
| `EntityHistoryManager.tsx` | Entity version history display + undo/revert |
| `EntityLink.tsx` | Inline clickable entity reference; triggers `EntityQuickCard` hover popover |
| `EntityQuickCard.tsx` | Floating entity preview, portal-rendered, degrades to a mobile bottom sheet |
| `ErrorBoundary.tsx` | Class-based React error boundary with a styled recovery screen (Try Again / Return Home) |
| `GenerateHerePanel.tsx` | Inline "generate content for this field" trigger panel |
| `Icons.tsx` | Centralized re-export from `lucide-react` — the only file permitted to import that package |
| `KeyboardShortcutsHelp.tsx` | `?`-triggered overlay listing shortcuts from `utils/keyboardShortcuts.ts` |
| `LinkSuggestionsPanel.tsx` | Collapsible "Link Suggestions" panel: runs the matching engine against free-text fields and offers one-click add/dismiss for detected but unlinked entities |
| `LinkedText.tsx` | Auto-linkifies entity names found inside free text |
| `MentionInput.tsx` | Textarea/input with `@`-mention autocomplete; tracks a name→ID map, seeded from `initialMentions` so persisted mentions survive editor remounts, and reports `mentionedEntityIds` via `onMentionedIdsChange` |
| `RegenerateButton.tsx` | Inline AI field regeneration control with a preview/accept panel |
| `SceneResourcesPanel.tsx` | Collapsible scene NPC/location quick-reference panel |
| `SceneSmartLinkBar.tsx` | Detects NPCs/locations mentioned in a scene's text that aren't yet linked and offers one-click "+Add" |
| `SkeletonCard.tsx` | Loading-state placeholder card |
| `StepIndicator.tsx` | Multi-step wizard progress indicator |
| `TabLayout.tsx` | Reusable tabbed panel layout used by editors |
| `Textarea.tsx` | `AiTextarea` component plus the `inputBaseClasses`/`textareaBaseClasses` shared style exports |
| `ToastContainer.tsx` | Renders the toast queue managed by `useToast`'s context provider |

### 5.2 `components/layout/` — app shell

| File | Responsibility |
|---|---|
| `CampaignSidebar.tsx` | Left navigation: view switcher, entity lists per section (via `sidebar/` sub-components), DM Style panel, drag-drop scene reordering |
| `ContentWrapper.tsx` | Generic titled/icon'd content-area wrapper used by simpler views |
| `Header.tsx` | Top bar: campaign title, mock-mode toggle, save status, tool/wizard launch buttons |
| `StatusBanners.tsx` | `ConflictBanner` (multi-tab write detected → `campaignService.resolveConflict('reload' \| 'overwrite')`, `role="alert"`) and `BackupRecoveryBanner` (`state.recoveredFromBackup` → `dismissBackupRecoveryNotice()`, `role="status"`). Rendered by `App.tsx` above the content area |
| `ViewRouter.tsx` | Single large conditional that renders the active `EditorView`/selected entity/active generator — the extracted routing logic formerly inline in `App.tsx`. Statically imports every dashboard and editor; only `RelationshipGraph` is `React.lazy`-split here |
| `sidebar/ArticleTreeItem.tsx` | Recursive tree-node renderer for the Lorebook's parent/child article hierarchy |
| `sidebar/PinnedEntities.tsx` | Renders the campaign's pinned-entity shortcuts (`React.memo`) |
| `sidebar/RecentItems.tsx` | Renders the last-10 recently-viewed entities (`React.memo`) |
| `sidebar/SidebarSearch.tsx` | Sidebar-local search input with clear button |
| `sidebar/sidebarUtils.ts` | Shared filter/sort helpers for sidebar entity lists |

### 5.3 `components/views/` — high-level screens

| File | Responsibility |
|---|---|
| `CampaignCreator.tsx` | New-campaign form: custom setting vs. official setting vs. template selection |
| `CrossCampaignDashboard.tsx` | Lists all locally stored campaigns with search/filter, switch/duplicate/delete |
| `FirstCampaignWizard.tsx` | 5-step guided onboarding flow that seeds a brand-new campaign via `ai/evocationWizard` batch generation |
| `SessionRunner.tsx` | Live session orchestrator: composes the `session/` sub-components, drives scene advancement |
| `WelcomeScreen.tsx` | First-launch screen: start new campaign or import an existing export |
| `session/ActiveScenePanel.tsx` | Displays the in-progress scene's read-aloud text/GM notes with copy-to-clipboard |
| `session/QuickNpcGenerator.tsx` | Inline NPC generation without leaving the live session |
| `session/QuickToolsPanel.tsx` | Quick-access panel for dice/combat/coach during a live session |
| `session/RunningLog.tsx` | Renders and edits the session's structured note timeline (manual/scene-transition/dice-roll/etc.) |
| `session/SceneListPanel.tsx` | Planned-scene list with status and reordering during a live session |

### 5.4 `components/dashboards/` — entity list views (10)

All follow the same pattern: `EntityCreationPanel` (chat/form toggle) + `useEntitySearch`
for filtering + `useRovingTabIndex` for keyboard grid navigation + a per-card completeness
indicator (green/amber/red dot based on key-field population).

| File | Entity |
|---|---|
| `AdventureDashboard.tsx` | Adventures — completeness keys: title, hook, theme, level>0 |
| `ArticleDashboard.tsx` | Lorebook articles — completeness keys: title, content, category |
| `FactionDashboard.tsx` | Factions |
| `ItemDashboard.tsx` | Items |
| `LocationDashboard.tsx` | Locations |
| `NoteDashboard.tsx` | Notes — fully wired into `EditorView`/`ViewRouter`/`CampaignSidebar`; e2e coverage is still `test.skip` behind a stale "not routed" comment (see §11–12) |
| `NpcDashboard.tsx` | NPCs |
| `PlayerCharacterDashboard.tsx` | Player Characters — completeness keys: name, species, class, background, player name |
| `PlotDashboard.tsx` | Plots — lazy-loads a `PlotTimeline` panel; completeness keys: title, description, status progression |
| `SessionLogDashboard.tsx` | Session Logs — lazy-loads `SessionPrepWizard`; completeness keys: title, prepNotes, recap, beats>0 |

### 5.5 `components/generators/` — AI creation forms (8 + chat)

Each accepts `isMockMode`/`campaignContext` and calls the matching `aiService.generateX`
function; the dashboard wires the result into a `campaignService.createX` call.

| File | Generates |
|---|---|
| `AdventureGenerator.tsx` | Adventures (with nested scenes) |
| `ArticleGenerator.tsx` | Lore articles |
| `EntityChatGenerator.tsx` | Multi-entity conversational generation — the engine behind RealmChat and the Evocation Wizard's chat mode |
| `FactionGenerator.tsx` | Factions |
| `ItemGenerator.tsx` | Items |
| `LocationGenerator.tsx` | Locations |
| `NpcGenerator.tsx` | NPCs |
| `PlayerCharacterImporter.tsx` | Player Characters — PDF character-sheet parsing, plus an optional "Quick Add" manual-entry tab |
| `SceneGenerator.tsx` | Scenes (nested under a selected Adventure) |

### 5.6 `components/editors/` — detail editors (12 + prep view)

All follow the tabbed-layout pattern (`TabLayout`), local `formData` state reconciled
against incoming props via `utils/formReconciliation.ts`, inline `RegenerateButton`
AI-assist, and `EntityLink`/`onNavigate` cross-references.

| File | Edits |
|---|---|
| `AdventureEditor.tsx` | Adventure (title/hook/theme/level, scene list) |
| `ArticleEditor.tsx` | Article (content, category, parent/child hierarchy, related entities) |
| `CampaignSettingEditor.tsx` | Campaign-level setting/style profile; hosts the Style Matching "analyze writing style" trigger |
| `FactionEditor.tsx` | Faction (goals, leader/members, headquarters) |
| `ItemEditor.tsx` | Item (rarity, properties) |
| `LocationEditor.tsx` | Location (hierarchy, connections, points of interest, loot) |
| `NoteEditor.tsx` | Note (title, tags, content) |
| `NpcEditor.tsx` | NPC (traits, backstory, relationships, faction link) |
| `PlayerCharacterEditor.tsx` | Player Character sheet fields |
| `PlotEditor.tsx` | Plot (status, related entities, session progression) |
| `PrepDocumentView.tsx` | Read-only printable/exportable session prep document assembled from an Adventure + Scenes |
| `SceneEditor.tsx` | Scene (read-aloud text, GM notes, skill checks, NPC/location links) — hosts `SceneSmartLinkBar` |
| `SessionLogEditor.tsx` | Session Log (prep notes, recap, beats) — hosts the AI Scribe, calling `startAudioTranscription` through the `aiService` facade so mock mode works |

### 5.7 `components/dialogs/` — modals (all via `DialogShell`)

| File | Purpose |
|---|---|
| `ContinuityChecker.tsx` | Displays `continuityChecker.ts`'s rule-based issue list with navigate-to-entity links |
| `DmCoach.tsx` | In-session AI assistant: narration, improvisation, rollable tables, NPC roleplay chat |
| `EvocationWizard.tsx` | Batch "fill my campaign" / document-parsing / chat-driven multi-entity generation, reviewed before commit |
| `ExportModal.tsx` | JSON / Obsidian-markdown export trigger with entity-count summary |
| `SessionEndWizard.tsx` | End-of-session recap generation (AI) and plot-progression review |
| `SessionPrepWizard.tsx` | Pre-session planning flow: scene selection, prep notes, plot check-in |
| `WorldSimulationWizard.tsx` | Simulates world events over elapsed in-fiction time via `ai/worldSimulation` |

### 5.8 `components/tools/`, `components/visualizers/`, `components/RealmChat/`

| File | Purpose |
|---|---|
| `tools/CombatTracker.tsx` | Initiative order, HP tracking, turn advancement for the active `Encounter`; combatant removal re-locates whose turn it is after the array shifts |
| `tools/DiceRoller.tsx` | Dice formula parsing/rolling UI (`utils/diceUtils.ts`) |
| `tools/SecretsTracker.tsx` | Secrets/clues list with reveal tracking |
| `visualizers/PlotTimeline.tsx` | Chronological (by `sessionDate`) plot-progression timeline |
| `visualizers/RelationshipGraph.tsx` | D3 force-directed graph of NPC/Faction/Location relationships; maps `ENTITY_TYPE_CONFIG` Tailwind color names to hex for D3; no keyboard/ARIA interaction path (see §12) |
| `RealmChat/RealmChatWidget.tsx` | Floating conversational assistant (indigo accent — the one place indigo is permitted); drives `EntityChatGenerator` under the hood |

### 5.9 `services/` — root-level services

| File | Responsibility |
|---|---|
| `aiService.ts` | **The** AI facade. Every exported function takes `isMockMode` and dispatches to either `ai/mockService.ts` or the matching real `ai/*` module. Components must import only from here |
| `campaignService.ts` | Central state store — factory (`createCampaignStore`), Immer-based mutation, debounced auto-save, relationship sync, cascade deletion, campaign duplication with ID remapping (see §6) |
| `contextBuilder.ts` | Tiered, token-budget-aware `buildCampaignContext()` used for AI prompt assembly (see §7) |
| `continuityChecker.ts` | Pure function, 8 rule-based consistency checks over a `Campaign` (no AI) |
| `importExportService.ts` | JSON campaign export/import with schema validation and round-trip checking; Obsidian-markdown export |
| `storageService.ts` | Persistence abstraction: quota detection, IndexedDB fallback, cross-tab conflict detection, 3-slot backup rotation (see §6) |

### 5.10 `services/ai/` — AI implementation layer

| File | Responsibility |
|---|---|
| `core.ts` | Backward-compatible adapter preserving 3 legacy function signatures (`generateWithSchema`, `generateText`, `generateChatCompletion`); maps legacy Gemini model-name strings to `ModelTier`; converts Gemini-style multimodal `contents.parts` to the provider-agnostic `MultimodalPart[]`; silently drops Gemini's Google Search grounding `tools` config |
| `modelConfig.ts` | `ModelTier` type (`lite`/`standard`/`quality`), tier→CLI-alias and tier→API-model-ID mappings, `getProviderConfig()` reading provider/timeout/retry env vars |
| `realmWeaver.ts` | Entity generation: NPC/Location/Faction/Item/Scene/Adventure/Article, each with a JSON schema passed to `generateWithSchema` |
| `dmCoach.ts` | Session assistance: narration, improvisation, rollable tables, enhanced-text rewriting, session-note analysis, session recap generation |
| `evocationWizard.ts` | Batch generation (`generateCampaignFill`), document parsing into entities, PDF character-sheet parsing, chat-driven generation, starter-world generation (NPCs/locations/adventure) for the First Campaign Wizard |
| `realmChat.ts` | Conversational multi-entity chat (`chatWithRealmWeaver`) and NPC roleplay dialogue generation |
| `worldSimulation.ts` | Generates world events given elapsed days for the World Simulation Wizard |
| `styleMatching.ts` | Analyzes DM writing samples into a style-profile string used to steer future generations |
| `audioTranscription.ts` | Live session audio transcription (AI Scribe). Dynamically `import()`s `@google/genai` so it stays out of the initial bundle, keyed per-campaign from `campaign.gcpApiKey`. Reached through `aiService.startAudioTranscription`, with a `mockService` counterpart |
| `mockService.ts` | Static/deterministic mock implementations of every `aiService` function, used when `isMockMode` is true and by unit tests |
| `providers/types.ts` | `AIProvider` interface (`generateWithSchema`/`generateText`/`generateChatCompletion`) and option types both providers implement |
| `providers/registry.ts` | Lazy-instantiated provider registry. The initial provider name is resolved from `modelConfig.getActiveProvider()` (i.e. `REALMWEAVER_AI_PROVIDER`) on first read rather than hard-coded, so the env var actually takes effect; `setProvider()` discards the cached instance |
| `providers/claude-cli.ts` | Default provider: assembles system+user prompts, POSTs to `/api/ai/generate`, runs a JSON-recovery pipeline (strip markdown fences → find `{...}` boundaries → parse), flattens multi-turn history for the CLI's non-conversational `--print` mode |
| `providers/anthropic-api.ts` | **Stub** — all three methods throw `"not yet implemented"`; TODO comments show the intended `@anthropic-ai/sdk` `tool_use` implementation shape |
| `providers/retry.ts` | `withRetry()` — retries on timeout / JSON-parse / 5xx errors, fixed delay (not exponential backoff), used by the CLI provider |

### 5.11 `services/linking/` — Smart Linking subsystem

| File | Responsibility |
|---|---|
| `matchingEngine.ts` | `TextMatchingEngine`: word-boundary-aware (Unicode `\p{L}\p{N}`) case-insensitive substring matching of entity names against free text; longest-name-first greedy, non-overlapping matches |
| `engineRegistry.ts` | Swappable-engine registry (`getMatchingEngine`/`setMatchingEngine`/`resetMatchingEngine`) — currently always resolves to `TextMatchingEngine`, but the seam exists for a future fuzzy/embedding-based engine |
| `autoLinker.ts` | `autoLinkScenes`/`autoLinkNpcFactions` — one-shot batch linking run during template/bulk import: scans scene/NPC text for entity mentions and auto-populates `npcIds`/`locationId`/`factionId` above a confidence threshold |

### 5.12 `hooks/`

| File | Responsibility |
|---|---|
| `useEntitySelection.ts` | All selected-entity-ID state, resolved-entity memos, nav stack (back button), recent items, breadcrumb computation, and the `handleSelect`/`handleEntityNavigate` dispatch used throughout `App.tsx` |
| `useModalState.ts` | Every top-level modal's open/close boolean plus `closeTopModal()` priority-ordered close (command palette > shortcuts help > continuity checker > coach > wizard > world-sim > export) |
| `useConfirmDialog.ts` | Context provider exposing `confirm(title, message, options): Promise<boolean>`, backing `ConfirmDialog` |
| `useToast.ts` | Context provider exposing `addToast(message, variant)`, capped at 3 concurrent toasts (oldest dropped first) |
| `useDebouncedFieldCommit.ts` | Coalesces the per-keystroke `onUpdate(id, updates)` writes that `MentionInput`-backed editor fields produce (400 ms default). Editors are not remounted when the user switches between entities of the same type, so pending edits are flushed against the id they were typed under whenever `entityId` changes, and again on unmount. Used by the NPC/Location/Faction/Article/Plot editors |
| `useEntitySearch.ts` | Case-insensitive multi-field substring search with `useDeferredValue` to keep keystrokes responsive on large entity lists |
| `useRovingTabIndex.ts` | Roving-tabindex keyboard grid/list navigation; resolves a responsive column count per Tailwind breakpoint; re-anchors focus when the tracked item is unmounted (e.g. a search filter shrinks the list) |

### 5.13 `utils/`

| File | Responsibility |
|---|---|
| `entityUtils.ts` | `ENTITY_TYPE_CONFIG` (icon/color/label per entity type — `Record<string, ...>`, not a closed union; has a `scene` entry (blue), still no `secret` entry), `createDefaultX()` factories (present for NPC/Location/Faction/Item/Article/Adventure/Scene/Session/Plot/PlayerCharacter; missing for Secret and Note), `buildCampaignContext()` (a flat legacy context builder now superseded by `contextBuilder.ts` but still exported), `buildEntityContext()` (implemented and unit-tested but not called from any editor — they duplicate the logic inline), `estimatePcHp()` |
| `formReconciliation.ts` | `reconcileEntityFormData()` — merges a locally-edited form state with a freshly-arrived entity prop field-by-field, preserving in-progress edits while still picking up concurrent external changes (async AI generation, bidirectional relationship sync) that arrive mid-edit. Centralizes logic previously duplicated per-editor |
| `backlinkUtils.ts` | `computeBacklinks()` — per-entity-type inbound-reference scanners (faction membership, scene appearances, NPC relationships, article/plot references, `@mention` backlinks), grouped and sorted |
| `dmStyleUtils.ts` | `isFeatureVisible()` — resolves per-feature visibility from DM Style (guided/standard/power) defaults plus per-campaign manual overrides |
| `demoTemplates.ts` | Just the Winter's Daughter world-description prose used to quick-fill `FirstCampaignWizard`. The inline entity payload (and its drifted shadow interfaces) was removed — it was not tree-shakeable and shipped in the entry chunk; a full demo campaign belongs under `data/templates/*.json` behind the existing dynamic import |
| `diceUtils.ts` | Dice formula parsing (`XdY+Z` etc.) and rolling |
| `keyboardShortcuts.ts` | Shortcut table (`Ctrl+K` search, `Ctrl+N` new entity, `Ctrl+S` save, `Escape` close, `?` help) and `matchShortcut()` dispatch, suppressing bare-key shortcuts while focus is in a text field |
| `popoverPosition.ts` | Viewport-aware popover coordinate calculation (used by `EntityQuickCard`) |
| `entityFieldSave.ts` | Dispatches a single-field save to the correct `campaignService.updateX` call by entity type |
| `entityDetailExtractors.ts` | Extracts short display strings from entity fields for dashboard cards/quick cards |

---

## 6. State Management Deep-Dive

`campaignService.ts` exports a factory, `createCampaignStore(config)`, and a default
singleton built from it (`persist: true`). The factory pattern exists specifically so
tests can create isolated, non-persisting instances (`tests/helpers/testStoreFactory.ts`)
without touching `localStorage`.

**Core mechanics:**

- **Immer.** All mutation goes through `produce()`; callers write "mutating" code against a
  draft, Immer produces a new immutable state tree with structural sharing.
- **Two update paths.** `updateState()` (public) both mutates and calls `scheduleSave()`
  (debounced auto-save). `_internalUpdate()` (private-ish, but exposed as `_updateState`
  for tests) mutates without scheduling a save — used for UI-only state like `appStatus`/
  `saveStatus` so that e.g. opening the campaign creator doesn't itself trigger a write.
- **Debounced persistence with a max wait.** `scheduleSave()` immediately flips `saveStatus` to
  `'saving'`, then debounces the actual `persistToStorage()` call by 2000 ms
  (`AUTO_SAVE_DELAY_MS`), coalescing rapid successive edits into one write. A second timer,
  `AUTO_SAVE_MAX_WAIT_MS` (10 s), is armed only for the *first* pending change in a burst — so
  continuous typing (which re-arms the debounce on every keystroke) still commits on a fixed
  cadence rather than never. `saveCampaign()` (manual save / `Ctrl+S`) cancels both timers and
  forces an immediate write.
- **Teardown flush.** `init()` registers `pagehide`, `beforeunload` and
  `visibilitychange → hidden` handlers that call `flushPendingSaveSync()`, so closing the tab
  mid-burst does not discard the debounce window. The flush is a no-op unless a save is genuinely
  pending — a real unload fires all three events in quick succession, and unguarded re-flushes
  would rotate identical copies through the backup buffer and evict older, useful generations.
  `campaignService.flushPendingSave()` exposes the same path (used by `ErrorBoundary` before a
  reload); `campaignService.destroy()` removes these listeners and the conflict subscription.
- **Honest save status.** `persistToStorage` awaits the `pending` promise a quota-fallback write
  returns before stamping `lastSavedAt`, and a monotonically increasing `saveSequenceToken` means
  only the newest in-flight write may update `saveStatus` — a slow write completing after a newer
  one can no longer report stale information.
- **`useSyncExternalStore` integration.** `App.tsx` subscribes via
  `useSyncExternalStore(campaignService.subscribe, campaignService.getState)` — the
  store's `listeners: Set<() => void>` plus `notify()` is the whole pub/sub mechanism.

**Persistence ladder** (`storageService.ts`):

1. `localStorage.setItem()` is tried first.
2. On `QuotaExceededError` (or the Firefox/older equivalents), the write falls back to
   **IndexedDB** (`idbSet`), and `saveStatus` surfaces as `'quota-warning'` rather than
   `'error'` — data is not lost, just relocated.
3. Once the IndexedDB write succeeds, the **stale localStorage copy is explicitly removed**
   — `load()` prefers localStorage, so leaving old data there would shadow the fresher
   IndexedDB copy on the next app start, and removing it also reclaims quota headroom.
4. `load()` (used at startup, async) checks localStorage first, then IndexedDB, so data
   that only ever made it to IndexedDB (a save from a previous session that hit quota) is
   not silently lost — this is why `init()` deliberately uses the async `load()` rather
   than a synchronous localStorage-only read.
5. **Backup rotation**: before every write, up to 3 prior snapshots are rotated into
   `<primaryKey>__backup_1/2/3` (slot 1 = newest); `getBackups()`/`restoreFromBackup()` expose
   manual recovery. Slots are namespaced **per primary key** — a single shared
   `CAMPAIGNS_BACKUP_<n>` namespace previously let the tiny active-campaign-id write shift the
   campaign JSON out of slot 1 on every save cycle. The id key now also passes
   `{ skipBackup: true }`, and a rotation is skipped entirely when the incoming value is identical
   to the stored one. This is a `localStorage`-only mechanism and still a full serialize-and-write
   on every save, a real perf cost (see §12).
6. **Cross-tab conflict detection**: `storageService.onConflict()` wires the `window`
   `storage` event so that a write from another tab flips `conflictDetected` in state (backup-slot
   keys are filtered out, so a rotation in another tab doesn't raise a false conflict).

**Conflict and recovery policy.** Detection alone was worse than nothing, so both flags now drive
real behaviour:

- While `conflictDetected` is set, `persistToStorage()` **refuses to write** — a stale tab can no
  longer clobber the other tab's newer data, and nothing in memory is discarded either. An earlier
  design reloaded the other tab's snapshot straight into `draft.campaigns`, silently throwing away
  whatever this tab had typed but not yet saved. `ConflictBanner` surfaces the choice and
  `resolveConflict('reload' | 'overwrite')` executes it: `'reload'` adopts the on-disk snapshot
  (keeping the in-memory copy if that snapshot doesn't parse), `'overwrite'` force-saves this tab's
  copy now. Either clears the flag and resumes autosave.
- When `init()`'s `JSON.parse` of the primary payload throws, it walks the backup slots newest-first
  and adopts the first that parses, setting `recoveredFromBackup` so `BackupRecoveryBanner` can tell
  the GM they are continuing from a slightly older snapshot. The corrupt payload is deliberately
  **not** removed — an earlier version called `remove()`, which also wipes the IndexedDB copy and
  destroyed the entire campaign library irrecoverably. If no slot parses, the app falls back to the
  welcome screen with the corrupt value still on disk for manual recovery.
- The whole storage read in `init()` is wrapped in try/catch, so a browser that throws on
  `localStorage` access (Firefox with cookies blocked, Safari private mode) resolves to a
  renderable `appStatus` instead of stranding the app at `'loading'` forever.

**Migration / backfill.** `init()` (async, fire-and-forget inside a `void (async () => ...)`
block so the public `init()` signature stays synchronous for test stubs) parses saved JSON
and backfills every array field that might be missing on an older save — `plots`,
`notes`, `secrets`, `playerCharacters`, `relationships`, `history`, `memberIds`,
`scenes[].npcIds`, `activeEncounter` — so that later CRUD code (which assumes these arrays
always exist) never crashes on `undefined`. The same backfill logic is duplicated (not
shared) in `importCampaign()` for freshly-imported JSON, since imported data is only
lightly schema-validated.

**Cascade deletion + reference purging.** Every `deleteX()` method does two things:
type-specific relationship unwinding (e.g. `deleteNpc` unlinks the faction membership,
`deleteLocation` un-parents child locations) *and* a call to `_purgeEntityReferences()`,
which sweeps every known cross-entity reference array (NPC `relationships`/
`mentionedEntityIds`, Location/Faction/Scene `mentionedEntityIds`, Plot/Article
`relatedEntityIds`/`mentionedEntityIds`, SessionLog `relatedPlotIds`/`plotProgressions`)
for the deleted ID and strips it. `deleteAdventure` additionally strips the adventure's
(now-deleted) scene IDs out of every `SessionLog.plannedSceneIds` and clears
`activeSceneId` if it pointed into the deleted adventure.

**Relationship syncing.** Three private bidirectional-sync helpers keep denormalized
back-references consistent on every create/update/delete: `_synchronizeNpcFactionLink`
(NPC.factionId ↔ Faction.memberIds), `_synchronizeLocationHierarchy`
(Location.parentLocationId ↔ Location.subLocationIds, with `_isLocationParentingAllowed`
cycle detection), `_synchronizeArticleHierarchy` (same pattern for the Lorebook tree).

**`duplicateCampaign()` ID remapping.** Deep-clones a campaign for every entity array,
building a single `Map<oldId, newId>` up front (pre-registering every entity's new ID
before any field remapping happens, so forward references resolve correctly regardless of
array order), then rewrites every cross-reference field (faction membership, location
hierarchy, scene NPC/location links, session log plot/scene references, plot related
entities) through that map. Session/encounter live-state is deliberately reset rather than
cloned (`activeSceneId`/`activeSessionId` cleared, a fresh empty `activeEncounter`,
`wizardDismissed: true`, `pinnedEntities: []`).

---

## 7. AI Subsystem Deep-Dive

```mermaid
sequenceDiagram
    participant C as Component<br/>(e.g. NpcGenerator)
    participant F as aiService.ts<br/>(facade)
    participant M as ai/mockService.ts
    participant S as ai/realmWeaver.ts<br/>(service module)
    participant Core as ai/core.ts<br/>(adapter)
    participant Reg as providers/registry.ts
    participant P as ClaudeCliProvider
    participant Proxy as vite-plugin-ai-proxy.ts
    participant CLI as claude CLI binary

    C->>F: generateNpc(prompt, isMockMode, campaignContext)
    alt isMockMode === true
        F->>M: generateNpc(...)
        M-->>F: deterministic mock NPC
    else real generation
        F->>S: generateNpc(prompt, campaignContext)
        S->>Core: generateWithSchema(prompt, npcSchema, instructions, {}, 'standard', ctx)
        Core->>Reg: getActiveProvider()
        Reg-->>Core: ClaudeCliProvider instance
        Core->>P: generateWithSchema({..., model: 'standard'})
        P->>P: withRetry(callback, {maxAttempts:2, delayMs:1500})
        P->>Proxy: POST /api/ai/generate<br/>{prompt, model:'sonnet', outputFormat:'json', systemPrompt}
        Proxy->>Proxy: check Origin header
        Proxy->>CLI: execFile('claude', ['--print','--model','sonnet',<br/>'--output-format','json','--system-prompt',...,'-p',prompt])
        CLI-->>Proxy: stdout: {"type":"result","result":"...json...","is_error":false}
        Proxy-->>P: {result: "...json..."}
        P->>P: parseJsonResponse: strip markdown fences, find {..}, JSON.parse
        alt parse fails or transient error
            P->>P: retry once (delayMs=1500)
        end
        P-->>Core: parsed NPC object
        Core-->>S: NPC object
        S-->>F: NPC object
    end
    F-->>C: Omit<NPC,'id'|'factionId'>
```

**Facade chain.** `aiService.ts` is the only import point components use. Every exported
function has the shape `(...args, isMockMode, campaignContext) => Promise<T>` and
dispatches to either `ai/mockService.ts` or the matching real service module
(`realmWeaver`, `dmCoach`, `evocationWizard`, `realmChat`, `worldSimulation`,
`styleMatching`). Those service modules call `ai/core.ts`'s three adapter functions
(`generateWithSchema`, `generateText`, `generateChatCompletion`) — an intentionally
preserved legacy signature from the pre-Claude-migration Gemini integration, so the six
service modules didn't need rewriting during the provider swap.

**Provider registry.** `core.ts` resolves the active provider via
`providers/registry.ts#getActiveProvider()`, which lazily instantiates and caches either
`ClaudeCliProvider` (default) or `AnthropicApiProvider` (stub — every method throws "not
yet implemented"). `setProvider()` discards the cached instance so a provider switch takes
effect on the next call. A third registry entry, `'gemini'`, exists only to throw a clear
"removed, use claude-cli" error if anything still references it.

**Model tiers.** `ModelTier = 'lite' | 'standard' | 'quality'` maps to CLI aliases
`haiku`/`sonnet`/`opus` (`mapTierToCliModel`) or full API model IDs
(`mapTierToApiModelId`, for the stub provider). `core.ts#mapLegacyModelName()` additionally
accepts legacy Gemini model-name strings (`'gemini-2.5-flash'` etc.) and maps them onto
tiers, so service-module call sites written against the old Gemini naming didn't need to
change. **Known duplication**: `types/RealmChat.ts` defines its own separate `ModelTier`
type, bridged to `services/ai/modelConfig.ts`'s version by hand-written mapping tables
rather than a shared type (see §12).

**Mock mode.** Every `aiService` function accepts `isMockMode: boolean`. `ai/mockService.ts`
provides a full deterministic implementation of every function — this is what lets the
entire app (including the dev-only, opt-in `smokeTest.ts` — runs only when
`VITE_RUN_SMOKE_TESTS=true` is set alongside `DEV`) be exercised with zero AI backend, and
is the same code path the 990 Vitest tests assert against.

**Retry/timeout semantics.** `providers/retry.ts#withRetry()` retries once
(`maxAttempts: 2`, fixed `delayMs: 1500` — no exponential backoff, reasoned as unnecessary
given AI calls are already long-running) on: message containing `'timeout'`/`'JSON'`/
`'504'`/`'500'`, or `err.code === 'ETIMEDOUT'`. The Vite proxy layer independently enforces
a 120 s CLI timeout (`TIMEOUT_MS`) and synthesizes a reliable `ETIMEDOUT` code from the
child process's `killed`/`SIGTERM` signals — Node's own `execFile`/`spawn` timeout does
*not* set `.code` or put "timeout" in the message, so without that synthesis the retry
logic's timeout detection would never actually fire on a real CLI timeout. **No streaming**
exists anywhere in the AI layer — every call is a single request/response round trip, so a
multi-entity batch generation blocks until the whole CLI invocation completes.

**Context assembly** (`contextBuilder.ts#buildCampaignContext`). Takes a single `ContextOptions`
object — `{ variant, campaign, activeSceneId?, activeSessionId?, maxTokenEstimate?,
focusEntityId?, focusEntityType?, focusSelection? }`, not positional arguments. Token-budget-aware
(`maxTokenEstimate`, default 4000 tokens ≈ 16,000 chars, estimated as `chars/4`), built in
three tiers that are added in priority order and stop once the budget is exhausted. List sections
fill entry-by-entry rather than all-or-nothing, so a tight budget yields a partial roster instead
of an empty one:

- **Tier 1** (always, if budget allows): campaign title/setting, style profile, active
  session recap, active scene summary.
- **Tier 2** (contextual): for the `'coach'` variant, the active combat encounter first;
  NPCs present in the active scene (plus their in-scene relationships for `'coach'`); the
  scene's location; up to 5 active plot threads; full details of a `focusEntityId` if one
  is set (used for edit-continuity — "keep generating consistent with what already
  exists").
- **Tier 3** (fills remaining budget): for `'generation'`/`'chat'`, one-line overviews of
  every NPC/Location/Faction/Article-title/Adventure-title/Item-name/PC-name; for
  `'coach'`, just NPC/Location name lists (broad overviews are considered less useful
  mid-session than fast reference). A focus entity's recent history entries and the
  editor's current-selection context ("USER IS VIEWING...") are appended last if space
  remains.

This supersedes the older, flat `buildCampaignContext()` still exported from
`utils/entityUtils.ts` (kept for backward compatibility / simpler call sites like the
per-field `RegenerateButton` context) — the two are separate functions with the same name
in different modules; do not confuse them.

---

## 8. Smart Linking Subsystem

A pluggable text-matching layer (`services/linking/`) that powers four different UI
surfaces, all built on the same `EntityCandidate`/`EntityMatch` contract:

- **`matchingEngine.ts`** defines the `MatchingEngine` interface and its only current
  implementation, `TextMatchingEngine`: for each candidate name (≥3 chars, longest names
  tried first so "Duke Aldric" wins over "Duke"), it scans the text left-to-right for the
  next occurrence with a Unicode-aware word boundary on both sides (`\p{L}\p{N}`, so
  `@Ann` doesn't falsely match inside `@Annë`), advancing the cursor past each match found
  so matches never overlap.
- **`engineRegistry.ts`** is a one-function-swap seam
  (`getMatchingEngine`/`setMatchingEngine`/`resetMatchingEngine`) — currently always
  resolves to `TextMatchingEngine`, but exists so a future fuzzy or embedding-based engine
  can be substituted (and so tests can inject a fake engine) without touching call sites.
- **`autoLinker.ts`** is the one-shot **batch** consumer: `autoLinkScenes()` runs during
  template/bulk import (`campaignService.importTemplateData`) to populate `scene.npcIds`
  and `scene.locationId` from the scene's read-aloud text/GM notes, and
  `autoLinkNpcFactions()` links an NPC to a faction if exactly one faction name is
  unambiguously mentioned in their description/backstory. Both use a 0.9 minimum
  confidence.
- **Interactive consumers** call the engine directly rather than through `autoLinker.ts`:
  `SceneSmartLinkBar` (`findUnlinkedEntities`) surfaces NPCs/locations detected in a
  scene's text that aren't yet linked, as inline "+Add" chips; `LinkSuggestionsPanel` does
  the same more generally across arbitrary text fields (NPC/location/faction), with a
  lower 0.5 confidence threshold and per-suggestion dismissal tracking.

**Mention capture.** Independently, `MentionInput.tsx` implements `@`-mention autocomplete
(not matching-engine-based — it's explicit user selection from a dropdown, not text
scanning): typing `@` opens a grouped-by-type dropdown of every campaign entity;
selecting one inserts `@EntityName` into the text and records a name→ID mapping in a
`useRef` map, seeded on mount from an optional `initialMentions` prop so that IDs
persisted from a previous editing session (`mentionedEntityIds` resolved back to
candidates via `resolveMentionCandidates()`) are still recognized after remount, not just
mentions made in the current session. `findMentionedIdsInText()` (shared with the linking
engine's Unicode word-boundary logic) re-derives the current `mentionedEntityIds` set on
every keystroke.

**Backlinks.** `backlinkUtils.ts#computeBacklinks()` is the read side of the whole
subsystem: given an entity ID/type and the campaign, it returns every inbound reference
grouped by source type — structural relationships (faction membership/leadership, scene
appearances, location parent/connections, NPC-to-NPC relationships) *and* `@mention`
backlinks (scanning every entity type's `mentionedEntityIds` for the target ID) — sorted
alphabetically within each group. `BacklinksPanel.tsx` renders this as the "Referenced By"
section on every editor.

---

## 9. Cross-Cutting Concerns

- **Dialog system.** Every modal composes `DialogShell` for a consistent focus trap,
  Escape-to-close, backdrop-click, body-scroll-lock, and `role="dialog"`/`aria-modal`. It
  renders **inline in the DOM tree**, not through a React portal, and does not set
  `aria-hidden`/`inert` on the rest of the app while open (a known gap, see §12).
- **Confirmations & toasts.** `useConfirmDialog()` (context provider around
  `ConfirmDialog`) replaces `window.confirm` everywhere; `useToast()` (context provider
  around `ToastContainer`, capped at 3 concurrent toasts) replaces `window.alert`. Both are
  enforced by convention (`CLAUDE.md`), not by lint rule.
- **Keyboard shortcuts & roving tabindex.** `utils/keyboardShortcuts.ts` defines the global
  shortcut table (search, new-entity, save, close, help) and `matchShortcut()`, wired up in
  a single `App.tsx` `keydown` listener; bare-key shortcuts (no Ctrl/Cmd) are suppressed
  while focus is inside any input/textarea/contenteditable. Independently,
  `useRovingTabIndex()` gives every dashboard's entity grid arrow-key/Home/End navigation
  with only one grid cell in the natural Tab order at a time, resolving the effective
  column count from a per-breakpoint map so it stays correct across responsive layouts;
  when a filtered-out item unmounts mid-session, focus is re-anchored so the grid never
  goes entirely un-Tab-reachable.
- **Error boundaries.** `ErrorBoundary` (class component) wraps every lazy-loaded dialog
  and the `ViewRouter` output individually (keyed by `activeView`, so navigating away from
  a crashed view clears the fallback instead of it sticking around), plus a `scope="root"`
  boundary in `index.tsx` — a crash in one panel does not take down the whole app or lose
  campaign data (which lives in `campaignService`, outside the crashed subtree). Its "reload"
  recovery action calls `campaignService.flushPendingSave()` first, so a debounced write in
  flight at crash time is committed synchronously before the page reloads.
- **Accessibility state.** DM Style progressive disclosure (`dmStyleUtils.ts`) hides
  advanced surfaces (continuity checker, relationship graph, plot timeline, backlinks
  panel, secrets tracker, combat tracker, keyboard shortcuts, advanced context) by default
  in `'guided'` mode for new DMs, with per-feature manual overrides always taking
  precedence over the style default. Roving-tabindex grids, `DialogShell`'s focus trap, and
  `DmStylePanel`'s `radiogroup` semantics are the concrete accessibility primitives in use;
  `RelationshipGraph` (D3 canvas/SVG) is a known exception with no keyboard path (§12).

---

## 10. Data Model

All application data lives inside a single `Campaign` object; `CampaignState` (in
`campaignService.ts`) holds an array of these plus UI-level fields (`activeCampaignId`,
`appStatus`, `saveStatus`, `lastSavedAt`, `conflictDetected`).

```mermaid
erDiagram
    Campaign ||--o{ NPC : npcs
    Campaign ||--o{ Location : locations
    Campaign ||--o{ Faction : factions
    Campaign ||--o{ Item : items
    Campaign ||--o{ Adventure : adventures
    Campaign ||--o{ Article : articles
    Campaign ||--o{ SessionLog : sessionLogs
    Campaign ||--o{ PlayerCharacter : playerCharacters
    Campaign ||--o{ Plot : plots
    Campaign ||--o{ Note : notes
    Campaign ||--o{ Secret : secrets
    Campaign ||--o| Encounter : activeEncounter
    Adventure ||--o{ Scene : scenes

    NPC }o--o| Faction : "factionId (member-of)"
    NPC }o--o{ NPC : "relationships[] (ally/rival/family)"
    Faction }o--o| NPC : "leaderId"
    Faction }o--o| Location : "headquartersLocationId"
    Location }o--o| Location : "parentLocationId (cycle-checked)"
    Location }o--o{ Location : "connections[]"
    Location }o--o| Faction : "controllingFactionId"
    Scene }o--o| Location : "locationId (set-in)"
    Scene }o--o{ NPC : "npcIds[] (features)"
    SessionLog }o--o| Adventure : "adventureId"
    SessionLog }o--o{ Scene : "plannedSceneIds[]"
    SessionLog }o--o{ Plot : "relatedPlotIds[] / plotProgressions"
    Article }o--o| Article : "parentArticleId (cycle-checked)"
    Article }o--o{ Article : "subArticleIds[]"
    Article }o--o{ NPC : "relatedEntityIds[] (any entity)"
    Plot }o--o{ NPC : "relatedEntityIds[] (any entity)"
    Secret }o--o{ NPC : "linkedEntityIds[] (any entity)"
```

**Entity types and their reference fields:**

| Entity | Key reference fields |
|---|---|
| `NPC` | `factionId` (member-of); `relationships[]` (→ NPC, typed ally/rival/family); `mentionedEntityIds[]` (@mentions); `history[]` (version snapshots) |
| `Location` | `parentLocationId`/`subLocationIds[]` (hierarchy, cycle-detected); `connections[]` (→ Location); `controllingFactionId`; `mentionedEntityIds[]`; `history[]` |
| `Faction` | `leaderId`/`memberIds[]` (→ NPC, bidirectionally synced); `headquartersLocationId`; `mentionedEntityIds[]` |
| `Item` | No structural cross-references; referenced *by* Articles/Plots via `relatedEntityIds` |
| `Adventure` | `scenes: Scene[]` (owned, nested array — not a separate top-level collection) |
| `Scene` | `locationId` (set-in); `npcIds[]` (features); `mentionedEntityIds[]`; `skillChecks[]` (owned) |
| `Article` | `parentArticleId`/`subArticleIds[]` (Lorebook hierarchy, cycle-detected); `relatedEntityIds[]` (any entity type); `mentionedEntityIds[]` |
| `SessionLog` | `adventureId`; `plannedSceneIds[]`; `relatedPlotIds[]`/`plotProgressions` (per-plot status this session); `structuredNotes[]`, `diceRolls[]`, `beats[]`, `encounterLog[]` (all owned) |
| `PlayerCharacter` | No cross-references — flat `characterSocial`/`characterStatistics` sheet data |
| `Plot` | `relatedEntityIds[]` (any entity); `mentionedEntityIds[]` |
| `Note` | No cross-references; `tags[]` freeform categorization |
| `Secret` | `linkedEntityIds[]` (any entity); `revealedInSessionId` (→ SessionLog) |
| `Encounter` | `sessionId`/`sceneId` (provenance links); `combatants[]` (owned, PC/NPC/monster) |

---

## 11. Testing & Quality

| Layer | Framework | Count (verified against `f043509`) | Notes |
|---|---|---|---|
| Unit | Vitest (`tests/`, `environment: 'node'`) | **990 tests / 143 files**, all passing | Covers `campaignService` (CRUD, cascade deletion, migration/backfill, autosave durability, multi-tab, backup recovery), `storageService`, `contextBuilder`, `continuityChecker`, `importExportService`, linking engine + `autoLinker`, `entityUtils`, `entityFieldSave`, `entityDetailExtractors`, `formReconciliation`, dice/keyboard/popover utils, AI service adapters + retry + Claude CLI provider + audio transcription, `MentionInput`, five persona-driven "archetype" scenario tests, and one suite per ship-readiness finding under `tests/ship/` |
| Component (render) | Vitest + `@testing-library/react` on jsdom | **~65 `.tsx` suites**, opted in per-file with `@vitest-environment jsdom` | Rendered behaviour for editors, dialogs, wizards, the command palette, `DialogShell`'s focus trap, `useDebouncedFieldCommit`, roving tabindex, and tool panels. `tests/components/*.test.ts` remain pure-function tests extracted *from* components |
| E2E | Playwright (`e2e/`) | **114 tests across 14 spec files**, run against 2 projects (`chromium`, `mobile-chrome`); 2 permanently skipped, 4 runtime `test.skip()` guards | Covers campaign CRUD/persistence, navigation, entity CRUD (core + extended), generators, editors, dialogs, DM tools, session runner, visualizers, mobile responsiveness, RealmChat. `globalSetup` (`e2e/global-setup.ts`) verifies the reused/launched server really is Realmweaver before any spec runs; `baseURL` is `http://127.0.0.1:4200` because Vite binds to the IPv4 loopback and Node's resolver may prefer `::1`. Hard `waitForTimeout` waits are down to 2 occurrences. The 2 skipped Notes tests in `entity-crud-extended.spec.ts` still carry a **stale comment** ("NoteDashboard exists but is not routed") — Notes *is* wired into `EditorView`/`ViewRouter`/`CampaignSidebar` |
| Smoke | `smokeTest.ts`, dev-only, opt-in | ~20 checks | Runs on app load only when `import.meta.env.DEV` AND `VITE_RUN_SMOKE_TESTS=true` are both set (off by default — see `.env.local.example`); with Mock Mode off it exercises real AI service calls, so it is not guarded against hitting the live provider; exercises AI service function availability and basic entity CRUD against a real `createCampaignStore` instance |
| Type check | `tsc --noEmit` via `npm run typecheck` | 0 errors | Standalone gate. `npm run build` is `vite build` alone and does **not** typecheck, so this must run separately (CI does) |
| CI | GitHub Actions (`.github/workflows/ci.yml`) | — | On push to `main` and every PR: `npm ci` → typecheck → unit tests → build → `playwright install chromium` → `test:e2e --project=chromium` |
| Manual | Mock mode | — | The entire app is usable end-to-end with `isMockMode: true` and zero AI backend — this is what local verification and the smoke test rely on |

**Known gaps:** the `mobile-chrome` Playwright project is excluded from CI. `Header.tsx` renders
`relative z-[60]` while `DialogShell`'s overlay and the mobile sidebar render at `z-50`/`z-40`, so
on narrow viewports the header can paint above modals and intercept the clicks `e2e/helpers.ts`
makes; re-enable it once the stacking order is fixed to content < header < sidebar < modal.

---

## 12. Known Architectural Debt

Each item below was re-verified against the current code after the ship-readiness pass and is
still real. Items that pass closed — Tailwind-via-CDN, the missing CI workflow, the absent
component render tests, `audioTranscription` bypassing the facade, the missing `'scene'`
`ENTITY_TYPE_CONFIG` entry, `createDefaultPlayerCharacter`, silent stdout truncation, and the
`vite preview` 404 — have been removed rather than left as stale warnings.

| Debt | Why it matters |
|---|---|
| No list virtualization | Dashboard entity grids and `CommandPalette` render every result unbounded — a long-running "Forever DM" campaign with hundreds of NPCs will visibly degrade |
| Per-view components not code-split | `ViewRouter.tsx` statically imports all 22 dashboards/editors, so the entry chunk stays over Rollup's 500 KB warning threshold; the vendor `manualChunks` split alone doesn't close it. Only `RelationshipGraph` and five `App.tsx` dialogs are `React.lazy` |
| `campaignService` CRUD hand-duplicated ×12 | Each entity type's create/update/delete is written out by hand rather than through a generic factory — real but consistent duplication that makes the file ~2,700 lines and means a cross-cutting fix (e.g. a new cascade rule) has to be applied 12 times by hand |
| Two incompatible `ModelTier` types | `types/RealmChat.ts` declares `'performance' \| 'medium' \| 'quality'` while `services/ai/modelConfig.ts` declares `'lite' \| 'standard' \| 'quality'`, bridged by hand-written mapping tables instead of one shared type — a drift risk every time a tier is added or renamed |
| No streaming | Every AI call is single-shot request/response with no progressive output, so a multi-entity batch generation blocks until the whole CLI invocation completes |
| Per-session proxy token generated but not yet required | `vite-plugin-ai-proxy.ts` injects `PROXY_TOKEN` via `transformIndexHtml` and validates `X-Realmweaver-Token` when present, but the browser client doesn't send it yet, so the mandatory gate against a same-machine-but-non-browser caller is the TCP-peer-loopback check only, not the token — see the header comment in `vite-plugin-ai-proxy.ts` for the exact client-side change that would complete this |
| `_rotateBackups` cost on every autosave | Every debounced save does a full serialize plus additional `localStorage` round-trips to rotate backup slots, on top of the primary write — real overhead that scales with campaign size and autosave frequency. No-op and scalar-key saves are now skipped, which trims it but does not remove it |
| `DialogShell` renders inline, no portal/`inert` | No React portal means dialog content participates in the surrounding DOM's stacking/layout context rather than a clean top-level layer, and the background app remains in the accessibility tree (no `aria-hidden`/`inert`) while a modal is open |
| `ENTITY_TYPE_CONFIG` open `Record<string, ...>`, no `'secret'` entry | Not a closed union, so a typo'd entity-type key type-checks fine and silently falls through to no config anywhere it's looked up. A `'scene'` entry (blue) was added; `Secret` still has none, and `createDefaultSecret`/`createDefaultNote` don't exist alongside the other `createDefaultX()` functions in `entityUtils.ts` |
| Runtime-composed Tailwind classes need a manual safelist | Accent classes built from `ENTITY_TYPE_CONFIG[...].color` via template literals are invisible to the build-time scanner; `index.css`'s `@source inline(...)` directives keep them alive, so adding a color to the config without extending the safelist compiles to nothing |
| `buildEntityContext()` unused | Implemented and unit-tested in `entityUtils.ts` but never called from a component — every editor duplicates equivalent per-field context logic inline instead |
| Notes e2e permanently skipped | The 2 skipped Notes CRUD e2e tests carry a stale "not routed" comment even though Notes is fully wired into `EditorView`/`ViewRouter`/`CampaignSidebar` — the tests were never updated to match |
| No in-session-specific save path | A hard crash inside the autosave window during a live session can still lose that window's notes. The 10 s max-wait and the `pagehide`/`beforeunload`/`visibilitychange` flush cover ordinary typing and tab-close, but there is no dedicated, more-aggressive write path for in-session data |
| Combat encounter discarded on session end | Only a one-line summary is archived to `SessionLog.encounterLog`; the full combatant/HP/initiative state from `activeEncounter` is not preserved in reviewable detail |
| `RelationshipGraph` has no keyboard path | The SVG carries an `aria-label`, but the D3 force-directed graph itself is mouse/touch-only — no node is focusable and there is no keyboard way to operate it |
| `FirstCampaignWizard` batch save not atomic | A mid-loop failure while saving the wizard's generated starter entities can leave a partially-populated campaign with no rollback |
| Reconciliation: array fields stay "dirty" until remount | `formReconciliation.ts`'s field-level merge treats a changed-reference array field as user-edited even after a commit, so it won't pick up a concurrent external update to that specific field until the editor next remounts — considered benign since the array itself did just get the user's intended value |
| Pre-existing `@ts-ignore`/`as any` | Two `@ts-ignore` in `EvocationWizard` plus scattered `as any` casts elsewhere remain |

---

## 13. Extension Guide

To add a new entity type, follow the 13-step checklist in `CLAUDE.md` ("Adding a New
Entity Type") exactly, in order: new `types/NewEntity.ts` → barrel export → `Campaign`
interface field → `campaignService` CRUD methods → `mockService.ts` mock data →
`aiService.ts` facade function → `createDefaultX()` factory → `ENTITY_TYPE_CONFIG` entry →
generator component → dashboard component (using `EntityCreationPanel` + `useEntitySearch`)
→ editor component → `EditorView` union entry in **both** `App.tsx` and `ViewRouter.tsx` →
`CampaignSidebar.tsx` entry. Skipping any step tends to fail silently rather than loudly —
e.g. a missing `ViewRouter.tsx` case just renders nothing for that view, and a missing
`ENTITY_TYPE_CONFIG` entry falls through to `undefined` wherever it's read.

Beyond that checklist, `CLAUDE.md`'s "Documentation Maintenance" table governs what else
must be updated alongside a change: new component/service/type →
`docs/architecture/high-level-design.md`; a new architecture pattern → both
`high-level-design.md` and `technical-design.md`; a new AI service function →
`CLAUDE.md`'s AI Service Integration section; a major feature → `README.md`. This document
(`system-architecture.md`) should be treated as the first place to check for whether a
change invalidates an existing claim — particularly the Component Catalog (§5) and Known
Architectural Debt (§12), which are the two sections most likely to drift out of date as
the codebase evolves.
