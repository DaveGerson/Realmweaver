# Component & State Architecture — Cross-Cutting Audit

## Summary

Realmweaver's architecture is well-conceived for its scale: a clean Immer-based store with a proper
subscription model, a clear service facade over the AI layer, and a recently completed provider
abstraction for the Gemini-to-Claude migration. The main structural debt is concentrated in three
areas: `App.tsx` has grown into a god-component orchestrating 27 `useState` hooks and all navigation
logic; `campaignService.ts` at 2,200 lines has crossed from "large but coherent" into "will resist
splitting when the next entity type arrives"; and eight editor components reach directly into the
store via non-reactive `campaignService.getState()` calls, which can yield stale data.

## Overall Score: 7/10

### Sub-Scores

- **Component Boundaries & Sizing: 6/10** — Several components are legitimately large (SessionRunner
  covers an entire execution mode; EntityQuickCard manages 10 entity types in one pop-over), but
  `App.tsx` at 1,162 lines accumulates navigation state, two parallel context-building pipelines,
  and the entire view-routing switch, none of which belong in the root component.

- **State Management Quality: 7/10** — The `useSyncExternalStore` + Immer pattern is correct and
  well-isolated. The debounced auto-save is robust. Two issues lower the score: eight editor
  components read the store non-reactively with `getState()` (stale data risk), and
  `campaignService.ts` contains a `window.confirm()` call at line 916 (a UI concern that belongs in
  the component layer).

- **Service Layer Architecture: 8/10** — `aiService.ts` is a clean, consistent facade with uniform
  mock-mode switching across 22 functions. The new provider registry (`providers/registry.ts`) is
  well-structured and the `core.ts` adapter layer preserves backward compatibility during migration.
  Minor concern: `audioTranscription.ts` still references a Gemini-specific model name
  (`gemini-2.5-flash-native-audio-preview`) directly, making it a migration outlier.

- **Reusability & Duplication Balance: 7/10** — The Dashboard/Generator/Editor three-tier pattern is
  consistently applied. Common components (`Button`, `Textarea`, `EntityLink`, `EntityQuickCard`,
  `MentionInput`) are used throughout. The main duplication issue is two parallel context-building
  pipelines: the 100-line `currentContext` `useMemo` in `App.tsx` (lines 370–484) and the
  `buildCampaignContext()` call at line 192–199 that uses `contextBuilder.ts`. They serve different
  consumers (DmCoach vs. generators) but share no code.

- **Type System Quality: 8/10** — Types are well-structured, each in its own file, with a clean
  barrel export. No `any` types exist in the `types/` directory. One coupling issue: `HistoryEntry`
  is defined in `NPC.ts` but imported by `Location.ts`, creating a semantic dependency that should
  live in a shared `common.ts` or `shared.ts` type file. There are 73 `as any` / suppressed-any
  comments across `services/` (11) and `components/` (11 suppressions, 11 `as any` usages), mostly
  in data-migration and import paths where `any` is unavoidable, plus two loose `as any` casts in
  `App.tsx` at lines 911 and 1141.

- **File Organization: 6/10** — The `components/` subdirectory structure is clear and consistent.
  However, 20 stale `.tsx` files remain at `components/*.tsx` (root level) — duplicates of files
  that were reorganised into subdirectories (`components/editors/`, `components/dialogs/`, etc.).
  These are unreferenced by any active import but inflate the project surface area and create
  confusion when searching for files.

---

## Large Component Analysis

| Component | Lines | Justified? | Decomposition Candidates |
|-----------|-------|------------|--------------------------|
| `services/campaignService.ts` | 2,209 | Partially — single store is correct, but the 700-line Winter's Daughter seed data and `duplicateCampaign` are separable concerns | Extract seed data to `services/seedData.ts`; extract `duplicateCampaign` to `services/campaignDuplication.ts` |
| `components/views/SessionRunner.tsx` | 1,389 | Mostly — covers an entire live-play mode | Extract `QuickNpcPanel` (lines ~103–320), `BeatTracker` (beat input/display), `SkillCheckRoller` as sub-components |
| `App.tsx` | 1,162 | No — violates single responsibility | Extract `useNavigation()` hook; extract `useViewSelection()` hook; move `currentContext` build to `contextBuilder`; split `renderMainContent` into a `ViewRouter` component |
| `components/common/EntityQuickCard.tsx` | 1,003 | Yes — 10 entity types × detail/expand/edit modes justify the size | Keep as-is; consider a detail-extractor registry if a new entity type is added |
| `components/dialogs/SessionPrepWizard.tsx` | 890 | Mostly — multi-step wizard covers many concerns | Extract `BeatPlanner` and `ScenePicker` as sub-components |
| `components/views/FirstCampaignWizard.tsx` | 779 | Mostly — 3-step wizard with AI generation | Extract each step (`WorldDescriptionStep`, `StarterContentStep`, `AdventureStep`) as sub-components |
| `components/layout/CampaignSidebar.tsx` | 771 | Partially — navigation and feature-flag rendering are tangled | Extract feature visibility logic into a `useSidebarItems()` hook |
| `components/dialogs/DmCoach.tsx` | 760 | Yes — 6 tool categories in one dialog; each is a self-contained tool | Keep as-is unless individual tools need reuse elsewhere |

---

## Issues

### Issue 1: `App.tsx` god-component accumulates all navigation state

**Severity:** High
**Location:** `App.tsx:74–103` (27 `useState` declarations), `App.tsx:487–668` (navigation handlers)
**Description:** `App.tsx` manages 10 entity selection states, 9 modal-open booleans, nav stack,
recent items, pending template data, continuity issue count, and two parallel context-building
pipelines. This is routing/navigation logic that has no place in the root component.
**Suggested Fix:** Extract a `useEntitySelection()` hook returning `{ selectedNpcId, setSelectedNpcId, ... }` for all 10 entity ID states. Extract a `useModalState()` hook for the 9 boolean open/closed flags. Move `renderMainContent` into a `<ViewRouter>` component that receives the selection state as props. This would reduce `App.tsx` to under 400 lines.
**Effort:** L

---

### Issue 2: Eight editor components read store non-reactively

**Severity:** High
**Location:**
- `components/editors/NpcEditor.tsx:42`
- `components/editors/LocationEditor.tsx:45`
- `components/editors/FactionEditor.tsx:41`
- `components/editors/PlotEditor.tsx:28`
- `components/editors/SessionLogEditor.tsx:50`
- `components/editors/ArticleEditor.tsx:33`
- `components/editors/SceneEditor.tsx:90`
- `components/common/EntityQuickCard.tsx:105`

**Description:** Each of these calls `campaignService.getState().campaigns.find(c => c.id === campaignService.getState().activeCampaignId)` at the top of the component body. This is a synchronous snapshot read that does not subscribe to updates. If the store changes while the editor is open (e.g., an NPC is created by another widget), the editor's local copy of the campaign goes stale until a re-render is triggered by the parent. `EntityQuickCard.tsx` calls this inside detail-extractor functions that run during render.
**Suggested Fix:** The campaign object is already available in `App.tsx` as `activeCampaign` and is passed down as a prop to most editors (e.g., `SceneEditor` already receives `campaign`). Extend the existing prop interface to pass `campaign` to the remaining editors rather than pulling it out of the store directly. For `EntityQuickCard`, which subscribes via `useSyncExternalStore` correctly in `LinkedText.tsx` and `BacklinksPanel.tsx`, follow the same reactive pattern.
**Effort:** M

---

### Issue 3: `campaignService.ts` contains a `window.confirm()` UI call

**Severity:** Medium
**Location:** `services/campaignService.ts:916`
**Description:** `deleteCampaign()` calls `window.confirm(...)` directly inside the service. This is a UI concern inside a business logic layer, which makes the service untestable in a headless environment and breaks the separation of concerns the rest of the architecture correctly maintains.
**Suggested Fix:** Remove the `window.confirm` from the service. The service method should accept a `confirmed: boolean` parameter, or the calling component should handle the confirmation dialog before invoking `deleteCampaign`. The `CampaignSelector` or wherever `deleteCampaign` is invoked should own the confirmation step.
**Effort:** S

---

### Issue 4: Invalid `'planning'` status string in `duplicateCampaign`

**Severity:** Medium
**Location:** `services/campaignService.ts:1042`
**Description:** `duplicateCampaign` resets `active` sessions to `'planning'`, but `SessionStatus` is typed as `'planned' | 'active' | 'completed'`. The string `'planning'` is not a member of this union. TypeScript does not catch this because the value is immediately cast with `as typeof l.status`. Any code that later uses a strict `===` or switch on `SessionStatus` against a duplicated campaign will silently mismatch.
**Suggested Fix:** Change line 1042 to: `status: (l.status === 'active' ? 'planned' : l.status) as SessionStatus,`
**Effort:** S

---

### Issue 5: Dual parallel context-building pipelines in `App.tsx`

**Severity:** Medium
**Location:** `App.tsx:192–199` (`campaignContext` via `buildCampaignContext`), `App.tsx:370–484` (`currentContext` inline `useMemo`)
**Description:** Two separate context strings are built from the same campaign data. `campaignContext` uses `contextBuilder.ts` with its tiered, token-budget-aware logic and is passed to generators. `currentContext` is a 115-line inline `useMemo` that assembles session-oriented context for DmCoach. `contextBuilder.ts` already supports a `'coach'` variant. The inline pipeline is a maintenance risk: it duplicates active-session, active-scene, and NPC-context logic that exists in `contextBuilder.ts`.
**Suggested Fix:** Replace the `currentContext` `useMemo` with: `const currentContext = useMemo(() => !activeCampaign ? '' : buildCampaignContext({ variant: 'coach', campaign: activeCampaign, activeSceneId: activeCampaign.activeSceneId, activeSessionId: activeCampaign.activeSessionId }), [activeCampaign]);` This eliminates 100+ lines from `App.tsx` and consolidates context logic.
**Effort:** S

---

### Issue 6: 20 stale component files at `components/*.tsx` (root level)

**Severity:** Low
**Location:** `/home/djiv/WebstormProjects/Realmweaver/components/AdventureCreator.tsx`, `CampaignSidebar.tsx`, `LocationEditor.tsx`, and 17 others at the `components/` root.
**Description:** These are pre-reorganisation duplicates of files now living in subdirectories (`components/editors/`, `components/layout/`, etc.). No active import references them. They inflate search results, confuse file discovery, and could accidentally be reopened and edited.
**Suggested Fix:** Delete the 20 stale files at `components/*.tsx`. Run `npm run build` to confirm no breakage.
**Effort:** S

---

### Issue 7: `HistoryEntry` type defined in `NPC.ts` but used by `Location.ts`

**Severity:** Low
**Location:** `types/NPC.ts:10–17`, `types/Location.ts:3`
**Description:** `HistoryEntry` is a general-purpose type (history tracking on any entity), but it lives in `NPC.ts`, creating a coupling where `Location.ts` must import from `NPC.ts`. If a third entity type (e.g., `Faction`) ever needs history, it too will import from `NPC.ts`, compounding the mismatch.
**Suggested Fix:** Move `HistoryEntry` and `EntityRelationship` (also general-purpose) to a new `types/common.ts` file. Update `NPC.ts` and `Location.ts` to import from `common.ts`. Export from `types/index.ts`.
**Effort:** S

---

### Issue 8: `audioTranscription.ts` still uses a Gemini-specific model name

**Severity:** Low
**Location:** `services/ai/audioTranscription.ts:20`
**Description:** The file sets `const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025'`. This file was noted as deferred in the migration plan (opt-in GCP audio), so it is not blocking. However, it is a migration outlier — all other AI calls now go through the provider abstraction. The Gemini-specific model name hardcoded here is not routed through `core.ts`.
**Suggested Fix:** Add a `NOTE: This file uses the Gemini Live API directly and is intentionally excluded from the provider abstraction (deferred GCP path).` comment block to make the intentional exception explicit and prevent confusion during future maintainers' audits.
**Effort:** S

---

## Architecture Fitness Assessment

### Adding 5 more entity types

**Assessment: Feasible but increasingly painful.** The `campaignService.ts` pattern (CRUD + relationship helpers) scales correctly — each new entity adds ~50–80 lines. However, at 2,200 lines already, adding 5 entity types brings the file to ~2,600 lines, making it harder to navigate. The 10-`useState` selection pattern in `App.tsx` becomes 15, and `handleSelect` gains 5 more cases. The `resetSelections` function already has 10 nullifications. The architecture will not break, but developer velocity will slow. Extracting navigation state into a custom hook (Issue 1) is the prerequisite for keeping this manageable.

### Migrating AI provider

**Assessment: Excellent.** The provider registry pattern (`services/ai/providers/registry.ts`) is exactly right for this. Switching providers is a single call to `setProvider()`. The `core.ts` adapter layer translates legacy Gemini field names. The mock service is fully decoupled. The only rough edge is `audioTranscription.ts` which bypasses the registry (Issue 8, intentional).

### Adding collaborative features

**Assessment: Will require significant rework.** The current architecture assumes a single active campaign owned by a single user in `localStorage`. `useSyncExternalStore` with the singleton `campaignService` means all state changes are local. Real-time collaboration requires a WebSocket/server layer, conflict resolution, and likely a switch from Immer-local mutation to an event-sourced or CRDT model. The store factory pattern (`createCampaignStore`) is a good foundation because it does not hardcode `localStorage`, but the store API (synchronous `updateState`) would need an async rewrite.

### Supporting mobile layout

**Assessment: Mostly feasible.** The Tailwind CDN setup, dark theme, and component structure do not inherently prevent mobile support. The main risk is `CampaignSidebar.tsx` at 771 lines, which already has a mobile drawer mode (`isSidebarOpen` state exists in `App.tsx`). `SessionRunner.tsx` has a complex multi-column layout that would need deliberate responsive breakpoints. No viewport meta tag or `sm:` / `md:` Tailwind class audit has been done, but the structural blockers are manageable.

---

## Patterns and Anti-Patterns

### Patterns (what is working well)

- **Factory store with Immer** — `createCampaignStore({ persist: false })` enables isolated testing instances. Immer ensures immutable updates without boilerplate. The `_internalUpdate` / `updateState` split (save-triggering vs. non-save-triggering) is a clean design decision.

- **`useSyncExternalStore` as the sole subscription hook** — React 18's `useSyncExternalStore` is the correct, future-proof integration point. The fact that only two deep components (`LinkedText`, `BacklinksPanel`) subscribe directly, and all others receive data via props, is mostly correct (the eight editor exceptions notwithstanding).

- **Service facade with uniform mock-mode switching** — `aiService.ts` provides 22 consistently structured functions. Every function has the same signature shape: `(inputs..., isMockMode = false, campaignContext?) => Promise<T>`. This uniformity makes the mock layer easy to maintain and test.

- **Named exports everywhere** — No default exports across the codebase. This is correct for a codebase using barrel re-exports and tree-shaking via Vite.

- **Provider registry for AI abstraction** — The `AIProvider` interface and lazy-instantiation registry are textbook patterns for swappable backends. The Gemini error message in the registry (`'Gemini provider removed. Use claude-cli.'`) is a helpful guard during the migration window.

### Anti-Patterns (what needs attention)

- **God component root** — `App.tsx` is simultaneously the store subscriber, navigation state owner, context builder, view router, and modal orchestrator. It should be none of these; it should only be the composition root.

- **Non-reactive synchronous store reads in editors** — Eight components call `campaignService.getState()` at render time instead of receiving props or using `useSyncExternalStore`. This is a stale-closure risk during concurrent rendering.

- **`window.confirm()` in the service layer** — UI side-effects belong in components. The service layer should be pure business logic callable from any context (tests, workers, future server actions).

- **Inline context construction duplicating the context builder** — The 115-line `currentContext` `useMemo` in `App.tsx` re-implements logic already present in `contextBuilder.ts`. This is the kind of duplication that diverges over time as one path gets updated and the other does not.

- **Seed data inside `campaignService.ts`** — The 700-line "Winter's Daughter" campaign seed embedded in the `init()` method (`campaignService.ts:276–847`) is not service logic; it is content data. It makes `init()` visually overwhelming and slows down searches for actual initialization logic.

---

## Files Audited

- `/home/djiv/WebstormProjects/Realmweaver/App.tsx` (1,162 lines)
- `/home/djiv/WebstormProjects/Realmweaver/services/campaignService.ts` (2,209 lines)
- `/home/djiv/WebstormProjects/Realmweaver/services/aiService.ts` (233 lines)
- `/home/djiv/WebstormProjects/Realmweaver/services/ai/core.ts` (168 lines)
- `/home/djiv/WebstormProjects/Realmweaver/services/ai/realmWeaver.ts` (278 lines, first 80 lines)
- `/home/djiv/WebstormProjects/Realmweaver/services/ai/providers/registry.ts` (75 lines)
- `/home/djiv/WebstormProjects/Realmweaver/services/contextBuilder.ts` (402 lines, first 60 lines)
- `/home/djiv/WebstormProjects/Realmweaver/services/importExportService.ts` (first 80 lines)
- `/home/djiv/WebstormProjects/Realmweaver/components/views/SessionRunner.tsx` (1,389 lines, first 180 lines)
- `/home/djiv/WebstormProjects/Realmweaver/components/common/EntityQuickCard.tsx` (1,003 lines, first 180 lines)
- `/home/djiv/WebstormProjects/Realmweaver/components/editors/NpcEditor.tsx` (368 lines, excerpt)
- `/home/djiv/WebstormProjects/Realmweaver/types/index.ts`
- `/home/djiv/WebstormProjects/Realmweaver/types/Campaign.ts`
- `/home/djiv/WebstormProjects/Realmweaver/types/NPC.ts`
- `/home/djiv/WebstormProjects/Realmweaver/types/Location.ts`
- `/home/djiv/WebstormProjects/Realmweaver/types/SessionLog.ts`
- `/home/djiv/WebstormProjects/Realmweaver/types/Adventure.ts`

Pattern analysis via grep across all `components/**/*.tsx` and `services/**/*.ts`.
