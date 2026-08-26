# CLAUDE.md - AI Assistant Guide for Realmweaver

> **Last Updated:** 2026-08-14

---

## Project Overview

**Realmweaver** is an SPA for tabletop RPG Game Masters to create, manage, and run campaigns with AI assistance.

### Tech Stack

- **Frontend:** React 19.2.0 + TypeScript 5.8.2, Vite 6.2.0
- **AI:** Claude Code CLI (via `vite-plugin-ai-proxy.ts`) / Anthropic REST API (`@anthropic-ai/sdk`)
- **Styling:** Tailwind CSS 4 **build-time** via `@tailwindcss/vite` + `index.css` (the CDN `<script>` is gone), tailwind-merge
- **State:** Custom store with Immer (`services/campaignService.ts`) over `services/storageService.ts`
- **Icons:** Lucide React via `components/common/Icons.tsx`
- **Visualization:** D3 7.8.5
- **Testing:** Vitest 4 (unit; default env `node`, per-file `// @vitest-environment jsdom` + `@testing-library/react` for component tests) + Playwright (E2E)

### Quick Start

```bash
npm install && npm run dev    # http://localhost:4200 (strictPort — a taken port fails loudly)
npm run build                 # Production bundle ONLY — does not typecheck
npm run typecheck             # tsc --noEmit (run separately in CI/pre-commit)
npm test                      # Vitest unit tests (tests/**)
npm run test:e2e              # Playwright E2E (e2e/**)
```

**Runtime / deploy story:** `npm run dev` (or `npm run preview` after `npm run build`) IS the
runtime — `vite-plugin-ai-proxy.ts` registers `/api/ai/*` on BOTH `configureServer` (dev) and
`configurePreviewServer` (preview), so a live Vite process is required for AI generation. A
statically hosted `dist/` (no Vite process behind it) has no AI backend at all; every
`/api/ai/*` call 404s.

The proxy gates every request three ways: TCP peer address must be loopback, `Origin` **and**
`Host` must both resolve to localhost/127.0.0.1/[::1], and an `x-realmweaver-token` header — if
present — must match the per-session token (validated, not yet required).

Create `.env.local` (all read via `loadEnv(mode, '.', '')`, so plain `process.env` keys work too):

```env
# Client-visible (injected by vite.config.ts `define`, consumed by services/ai/modelConfig.ts)
REALMWEAVER_AI_PROVIDER=claude-cli   # 'claude-cli' (default) | 'anthropic-api' (stub — see below)
REALMWEAVER_DEFAULT_TIER=standard    # 'lite' | 'standard' (default) | 'quality'
REALMWEAVER_MAX_RETRIES=3            # total ATTEMPTS, min 1 (default 3)
REALMWEAVER_TIMEOUT_MS=120000        # request timeout ms (default 120000)
REALMWEAVER_API_BASE_URL=            # anthropic-api only; proxy / self-hosted base URL

# Server-only — deliberately NOT injected into the client bundle
ANTHROPIC_API_KEY=your_key_here      # only if anthropic-api (stub — see below)
CLAUDE_CLI_PATH=claude               # path to the `claude` binary (default: on $PATH)
REALMWEAVER_DEV_HOST=127.0.0.1       # widen the dev-server bind at your own risk
```

`anthropic-api` is a **stub** — `services/ai/providers/anthropic-api.ts` throws
`'Anthropic API provider not yet implemented'` from all three methods, so selecting it breaks
every AI feature. `claude-cli` is the only working provider; mock mode is the only other
working path.

`GEMINI_API_KEY` is **not** wired into `define` — the Gemini key is sourced per-campaign from
`campaign.gcpApiKey`.

---

## Project Structure

### CRITICAL: No `src/` Directory

All code lives at the **project root**. Import alias: `@/` maps to root.

```
Realmweaver/
├── App.tsx, index.tsx, index.html, index.css, vite.config.ts, vite-plugin-ai-proxy.ts
├── hooks/           # useEntitySelection, useModalState, useConfirmDialog, useToast,
│                      useEntitySearch, useRovingTabIndex, useDebouncedFieldCommit
├── components/
│   ├── common/      # Button, Icons, Textarea, DialogShell, ConfirmDialog, ToastContainer,
│   │                  ErrorBoundary, EntityCreationPanel, EntityLink, EntityQuickCard,
│   │                  EntityHistoryManager, BacklinksPanel, LinkedText, MentionInput,
│   │                  LinkSuggestionsPanel, CommandPalette, Breadcrumbs, RegenerateButton,
│   │                  SkeletonCard, TabLayout, DmStylePanel, StepIndicator,
│   │                  KeyboardShortcutsHelp, GenerateHerePanel, SceneResourcesPanel,
│   │                  SceneSmartLinkBar
│   ├── layout/      # Header, CampaignSidebar, ContentWrapper, ViewRouter,
│   │                  StatusBanners (ConflictBanner + BackupRecoveryBanner) + sidebar/
│   ├── views/       # TonightsTable, WelcomeScreen, CampaignCreator, FirstCampaignWizard,
│   │                  CrossCampaignDashboard, SessionRunner + session/ sub-components
│   ├── dashboards/  # One per entity type (NPC, Location, Faction, Item, Adventure, Article, etc.)
│   ├── generators/  # AI creation forms per entity type + EntityChatGenerator
│   ├── editors/     # Detail editors per entity type + CampaignSettingEditor, PrepDocumentView
│   ├── dialogs/     # DmCoach, EvocationWizard, WorldSimulationWizard, ContinuityChecker,
│   │                  SessionPrepWizard, SessionEndWizard, ExportModal
│   ├── tools/       # CombatTracker, DiceRoller, SecretsTracker
│   ├── visualizers/ # RelationshipGraph, PlotTimeline
│   └── RealmChat/   # RealmChatWidget (indigo accent ONLY here)
├── services/
│   ├── aiService.ts          # AI facade — THE ONLY import point for components
│   ├── campaignService.ts    # Central state store
│   ├── storageService.ts     # localStorage + IndexedDB fallback, rotating backups, conflict events
│   ├── contextBuilder.ts     # Tiered token-budget-aware context assembly
│   ├── continuityChecker.ts  # Rule-based consistency checks
│   ├── importExportService.ts
│   ├── linking/              # matchingEngine.ts (TextMatchingEngine), engineRegistry.ts,
│   │                           autoLinker.ts — swappable entity-name matching
│   └── ai/                   # core.ts, modelConfig.ts, realmWeaver.ts, dmCoach.ts,
│                               evocationWizard.ts, realmChat.ts, worldSimulation.ts,
│                               styleMatching.ts, audioTranscription.ts, mockService.ts,
│                               providers/ (registry, claude-cli, anthropic-api, retry, types)
├── types/           # One file per entity, barrel export via index.ts
├── utils/           # entityUtils.ts (factories + ENTITY_TYPE_CONFIG), backlinkUtils,
│                      dmStyleUtils, entityFieldSave, formReconciliation, demoTemplates,
│                      diceUtils, keyboardShortcuts, popoverPosition, entityDetailExtractors,
│                      storyDerivations (Tonight's Table panel derivations)
├── tests/           # Vitest — top-level suites + components/, services/, helpers/,
│                      and ship/ (the ship-readiness regression suite, wp-*.test.ts[x])
└── e2e/             # Playwright specs (port 4200 is hardcoded in playwright.config.ts)
```

---

## Architecture Patterns

### State Store (`campaignService.ts`)

Factory-based store (`createCampaignStore({ persist })`) using Immer.
React integration via `useSyncExternalStore(campaignService.subscribe, campaignService.getState)`.

- `updateState()` → Immer produce + notify + `scheduleSave()`. `_internalUpdate()` bypasses save
  (used for `saveStatus`/`appStatus` meta-state) to avoid save loops.
- **Autosave:** 2s debounce with a **10s max-wait** ceiling, so a long uninterrupted typing burst
  still flushes. `init()` registers `pagehide` / `beforeunload` / `visibilitychange` handlers that
  call `flushPendingSaveSync()` — the localStorage write lands before the handler returns.
- **Durability:** `storageService.save()` returns a `pending` promise; on localStorage quota
  exhaustion the write falls back to IndexedDB and `pending` resolves only on real completion.
  `saveStatus` becomes `'quota-warning'` on fallback, `'error'` if the write never durably lands.
  A monotonic sequence token stops a slow in-flight save from stamping stale status.
- **Backups:** `storageService` keeps 3 rotating slots **namespaced per primary key**
  (`<key>__backup_<n>`, newest = 1). Pass `{ skipBackup: true }` for tiny scalar keys.
- **Backup recovery:** if the primary payload fails to `JSON.parse`, `init()` walks the backup
  slots newest-first and recovers from the first that parses, setting `recoveredFromBackup`.
  It never `remove()`s a corrupt payload — manual recovery stays possible.
- **Cross-tab conflict:** another tab's write raises `conflictDetected`; `persistToStorage()`
  then **refuses to write** until `resolveConflict('reload' | 'overwrite')` is called
  (`'reload'` adopts the on-disk snapshot, `'overwrite'` force-saves this tab's memory).
- `destroy()` disposes everything `init()` registered — call it in `afterEach` for
  `persist: true` stores. `flushPendingSave()` is the public sync flush (used by ErrorBoundary).
- `init()` is idempotent: a second call disposes the first registration set.

`ConflictBanner` / `BackupRecoveryBanner` (`components/layout/StatusBanners.tsx`) are the UI for
`conflictDetected` and `recoveredFromBackup`, wired in `App.tsx`.

### AI Service Architecture

```
Component → aiService.ts (facade) → ai/core.ts (adapter) → providers/registry → claude-cli | anthropic-api
```

**MANDATORY: Components import ONLY from `aiService.ts`.** Never import `ai/` modules directly —
including `audioTranscription` (use `startAudioTranscription({ ...config, isMockMode })`).

- Registry default provider is `claude-cli`; anything unrecognised falls back to it. `gemini` is
  a removed provider name that throws if selected. `anthropic-api` is registered but unimplemented
  — every method throws, so never route a user to it as a workaround.
- Model tiers: `lite` (haiku), `standard` (sonnet), `quality` (opus). `core.ts` maps legacy
  Gemini model names to tiers automatically; `modelConfig.resolveModelName()` maps a tier or
  legacy name to the active provider's model id (CLI alias vs. API model id).
- Retry: `withRetry({ maxAttempts })` — `REALMWEAVER_MAX_RETRIES` is an **attempts count**
  (minimum 1, default 3), not an "extra tries after the first" count.
- `modelConfig`'s `ENV` object uses live getters, not a snapshot, so Node-side callers that
  mutate `process.env` at runtime are honoured.

### Dialog System

All modals use `DialogShell` (focus trap, Escape, ARIA, scroll lock). Confirmations via
`useConfirmDialog()`. Toast feedback via `useToast()`.

### Data Flow

```
User Action → Component → campaignService method → Immer update →
debounced localStorage save → notify subscribers → React re-render
```

Relationships: bidirectional syncing (NPC ↔ Faction), cycle detection (Location and Article
hierarchies), cascade deletion via `_purgeEntityReferences` (mentions, relationships, pins,
connections, plot progressions, secrets — every delete path calls it).

---

## State Management

```typescript
type CampaignState = {
  campaigns: Campaign[];
  activeCampaignId: string | null;
  appStatus: 'loading' | 'welcome' | 'selecting' | 'creating' | 'editing';
  saveStatus: 'idle' | 'saved' | 'saving' | 'error' | 'quota-warning';
  lastSavedAt: string | null;
  conflictDetected: boolean;      // another tab wrote; saves are blocked until resolved
  recoveredFromBackup: boolean;   // init() restored from a backup slot
};
```

**Core API pattern** (same for all entity types — NPC, Location, Faction, Item, Adventure, Scene,
Article, SessionLog, PlayerCharacter, Plot, Note, Secret):
```typescript
campaignService.createNpc(data) / updateNpc(id, updates) / deleteNpc(id)
// e.g. deleteAdventure(id) — deletion cascades to clean up all related references
```

**Relationships have no dedicated link methods.** Edit the relationship field through the normal
updater — `updateNpc(id, { factionId })`, `updateLocation(id, { parentLocationId })`,
`updateArticle(id, { parentArticleId })`, `updateScene(adventureId, sceneId, { locationId, npcIds })` — and the store
applies bidirectional sync and cycle validation internally via the private
`_synchronizeNpcFactionLink` / `_synchronizeLocationHierarchy` / `_synchronizeArticleHierarchy`
helpers and the `_isLocationParentingAllowed` / `_isArticleParentingAllowed` guards (an update that
would create a parent cycle is rejected, leaving state unchanged).

Lifecycle methods: `init`, `destroy`, `saveCampaign`, `flushPendingSave`, `resolveConflict`,
`dismissBackupRecoveryNotice`.

---

## Component Patterns

### Three-Tier Hierarchy

1. **Dashboards** — Entity list + a creation UI. `useEntitySearch` (search/filter) and `useRovingTabIndex` (keyboard grid navigation) are universal. `EntityCreationPanel` (chat/form toggle) covers the six AI-generated types — NPC, location, faction, item, adventure, article — and is required for any *new* AI-generated type; plot and note use local title-only creators, player character uses `PlayerCharacterImporter`, and session log creates from `createDefaultSession()`. Completeness indicators (green/amber/red dots) are on 6 of 10 dashboards — adventure, article, note, player character, plot, session log — not the NPC/location/faction/item grids. See `components/CLAUDE.md` for the per-dashboard detail.
2. **Generators** — AI creation forms. Accept `isMockMode`, `campaignContext`. Call `aiService` functions.
3. **Editors** — Detail views with tabs and inline AI-assist. Accept `onNavigate` for EntityLink clicks. Editors are **not** remounted when navigating between entities of the same type — use `useDebouncedFieldCommit` for debounced field writes so pending edits commit against the id they were typed against.

### EditorView

Defined in `App.tsx`. New views need entries in BOTH `App.tsx` and `ViewRouter.tsx`:
```typescript
export type EditorView = 'tonight' | 'setting' | 'npcs' | 'locations' | 'factions' | 'items' |
  'adventures' | 'lorebook' | 'session-logs' | 'player-characters' | 'plots' | 'notes' |
  'combat' | 'relationships' | 'session-runner' | 'secrets';
```

---

## Type System

All entities require `id: string` + `name: string`. Each has its own file in `types/`, re-exported via `types/index.ts`.

### Adding a New Entity Type (13 Steps)

1. Create `types/NewEntity.ts` (must have `id`, `name`)
2. Export from `types/index.ts`
3. Add array to `Campaign` interface in `types/Campaign.ts`
4. Add CRUD methods in `campaignService.ts` (delete must call `_purgeEntityReferences`)
5. Add mock data in `ai/mockService.ts`
6. Add facade function in `aiService.ts`
7. Add default factory in `utils/entityUtils.ts`
8. Add entry to `ENTITY_TYPE_CONFIG` in `entityUtils.ts` (and confirm its color/shades are covered by `index.css`'s safelist)
9. Create generator in `components/generators/`
10. Create dashboard in `components/dashboards/` (use `EntityCreationPanel` + `useEntitySearch`)
11. Create editor in `components/editors/`
12. Add to `EditorView` in `App.tsx` AND `ViewRouter.tsx`
13. Add sidebar entry in `CampaignSidebar.tsx`

---

## Styling Conventions

Tailwind is compiled at build time by `@tailwindcss/vite`. `index.css` is the entry point
(`@import "tailwindcss"`) and is linked from `index.html`; it also carries the
`@source inline(...)` safelist for runtime-composed entity-accent classes. `index.html` holds
the base/body styles plus a hand-rolled `animate-in` polyfill, and a CSP that restricts
`script-src` to `'self'` — no remote script origins.

### Dark Theme Tokens (slate + amber)

| Token | Usage |
|-------|-------|
| `bg-slate-900/800/700` | Page / card / secondary bg |
| `text-slate-100/300/400` | Primary / secondary / muted text |
| `text-amber-400`, `bg-amber-600` | Accent text, primary buttons |
| `border-slate-700/600` | Borders, input borders |
| `rounded-lg/md` | Cards / inputs |

Use `inputBaseClasses` / `textareaBaseClasses` from `components/common/Textarea.tsx` for form fields.

### Entity Type Colors (via `ENTITY_TYPE_CONFIG`)

npc=amber, location=emerald, faction=violet, item=sky, adventure=orange, article=cyan,
sessionLog=rose, playerCharacter=teal, plot=yellow, note=slate, **scene=blue**

(`session-log` / `player-character` kebab aliases map to the same entries.)

**Indigo is reserved exclusively for RealmChatWidget.**

---

## Common Tasks

### Adding a New AI Function

1. Implement in `services/ai/[module].ts`
2. Add mock in `ai/mockService.ts`
3. Add facade in `aiService.ts` with mock/real switching
4. Import only from `aiService.ts` in components

### Adding a New View

1. Add to `EditorView` in `App.tsx`
2. Add rendering in `ViewRouter.tsx`
3. Add sidebar entry in `CampaignSidebar.tsx`

### Campaign Context for AI Calls

`buildCampaignContext` takes a single options object (`ContextOptions`), not positional args:

```typescript
import { buildCampaignContext } from '@/services/contextBuilder';
const ctx = buildCampaignContext({
  variant: 'generation',        // 'generation' | 'coach' | 'chat' | 'player-safe'
  campaign,
  maxTokenEstimate: 4000,       // default 4000 (≈16 000 chars)
  // optional: activeSceneId, activeSessionId, focusEntityId, focusEntityType, focusSelection
});
```

---

## Conventions & Pitfalls

| Rule | Details |
|------|---------|
| No `src/` directory | All code at project root |
| Icons via `Icons.tsx` | Never import directly from `lucide-react` |
| Types via `types/index.ts` | Use barrel export |
| Named exports only | No `export default` (`App.tsx` is the one exception) |
| AI facade only | Import from `aiService.ts`, never `ai/` modules directly — audio transcription included |
| Mock mode required | Every AI function needs a mock in `mockService.ts` |
| Always pass campaignContext | AI content needs world context for consistency |
| No direct state mutation | Use campaignService methods (Immer internally) |
| `useSyncExternalStore` | React subscription pattern for campaignService |
| Never write to the store in a setState updater | Functional updaters run during render and StrictMode double-invokes them — derive in the updater, commit outside it |
| `useDebouncedFieldCommit` | Use for debounced entity-field commits in editors; it flushes on entity switch and unmount so edits can't land on the wrong id |
| ENV reads stay literal | In `modelConfig.ts` every read must be a literal `process.env.<KEY>` token inside `safeEnv(() => …)`; a whole-object `process.env` shim breaks Vite's `define` substitution and silently disconnects every `REALMWEAVER_*` setting |
| No dynamic Tailwind class strings | Build-time scanning only sees literal class names — prefer static class maps; any runtime-composed utility must be covered by `index.css`'s `@source inline(...)` safelist |
| `DialogShell` for all modals | Focus trap, Escape, ARIA |
| `useConfirmDialog` not `window.confirm` | Branded UI |
| `useToast` not `window.alert` | Non-blocking |
| `ENTITY_TYPE_CONFIG` | Single source for entity colors/icons, never hardcode |
| `slate-*` not `stone-*` | Consistent color tokens |
| Update `ViewRouter.tsx` | New views need both `App.tsx` and `ViewRouter.tsx` |
| `EntityCreationPanel` | Required for all dashboard creation UIs |
| Cascade deletion | Entity delete must call `_purgeEntityReferences` to clean up all relationship references |
| No indigo outside RealmChat | Indigo is reserved for the AI assistant widget |
| `<Button>` for action buttons | Use `Button` component (primary/secondary/ghost/danger/icon variants) for action buttons. Raw `<button>` only for cards, tabs, chips, toggles, semantic role buttons |
| jsdom is opt-in | Vitest's default environment is `node`; component tests need `// @vitest-environment jsdom` as the file's first line |

---

## Documentation Maintenance (MANDATORY)

| What Changed | Update |
|-------------|--------|
| New component/service/type | `docs/architecture/high-level-design.md` |
| Architecture pattern | `high-level-design.md` + `technical-design.md` |
| New entity type / data model | `high-level-design.md` + `CLAUDE.md` (type system) |
| New AI service function | `CLAUDE.md` (AI Service Integration) |
| Major feature | `README.md` |
