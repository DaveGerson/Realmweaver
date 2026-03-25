# Interaction & Information Architecture — Cross-Cutting Audit

**Audited:** 2026-03-24
**Auditor:** UX IA Dimension Agent
**Screenshots:** Captured (desktop 1440x900, mobile 375x812)
**Baseline:** Abstract IA standards + session-cockpit-review.md CTQ thresholds

---

## Summary

Realmweaver has a well-structured navigation model with sidebar routing, a capable command palette (Cmd+K), breadcrumbs, and a back-stack system. Loading feedback is consistent across generators using skeleton overlays, and entity cross-linking is strong via EntityLink, LinkedText, BacklinksPanel, and EntityQuickCard popovers. The primary gaps are in error feedback (relying on browser `alert()` and `window.confirm()` instead of in-app UI), missing keyboard navigation within dense list views, and incomplete parity on empty states and BacklinksPanel coverage across all editors.

---

## Overall Score: 6.5/10

### Sub-Scores

- **Navigation Clarity: 8/10** — Three-tier navigation (sidebar sections, entity list within section, entity editor) is predictable. Back-stack (up to 20 entries) and breadcrumbs give clear orientation. Command palette indexes 9 entity types plus quick actions. The sole weakness: `secrets` and `session-runner` are views accessed from sidebar but are not listed in the sidebar nav sections for all DM styles, making their discoverability contingent on DM Style settings.

- **Loading State Consistency: 7/10** — Six of eight form-based generators use `SkeletonGeneratorOverlay` consistently. `SceneGenerator` and `PlayerCharacterImporter` use inline spinner/text fallback. Dialogs (DmCoach, EvocationWizard, SessionEndWizard) each implement bespoke loaders (spinner + text, wizard icon pulse, full overlay) — visually varied but thematically coherent. No dashboard skeleton loading exists; dashboards render immediately from synchronous local state so this is acceptable, not a gap.

- **Error Handling Consistency: 4/10** — Every generator has a `setError` + inline `<p className="text-xs text-red-400">` pattern, which is good. However, all destructive actions (`onDelete`, import, campaign switching errors) use `window.alert()` and `window.confirm()` — 20 confirmed instances across 14 files. No toast system, no notification queue, no `ErrorBoundary` component exists anywhere in the tree. A runtime exception in any editor will crash the subtree silently.

- **Empty State Handling: 7/10** — All nine entity dashboards have explicit empty states with thematic copy and a directional sub-text. Session logs properly split planned/past buckets with distinct empty states. Plot dashboard distinguishes active, dormant, and resolved empties. The two weaker cases: (1) `NoteDashboard` empty state was found but copy reads generically ("No notes yet"), (2) `SessionLogDashboard` past-sessions empty just says "No history recorded yet" without a CTA. No empty state exists for the Relationship Graph when no entities are linked.

- **Keyboard Support: 5/10** — Global shortcuts (Cmd+K search, Cmd+N new entity, Cmd+S save, Escape to close, ? for help) are well implemented and suppressed correctly in inputs. The `CommandPalette` has full arrow-key navigation with scroll-into-view and Enter to select. However: (1) no `tabIndex` attributes found in any dashboard component — entity cards in NPC/Location/Faction/etc. grids are not tab-navigable; (2) delete/generate/editor buttons within list cards have no keyboard shortcut or focus trap; (3) `KeyboardShortcutsHelp` panel is not modal (no focus trap, no `role="dialog"`), relying on click-outside detection; (4) most dialogs lack visible focus rings, only relying on browser defaults; (5) there is no `/` shortcut to focus the note input in SessionRunner even though the design doc recommends it (CTQ-2.1 threshold: <3 seconds from thought to captured note).

- **Entity Discoverability: 7/10** — Strong: EntityQuickCard popovers appear on hover for all 10 entity types including scenes, showing 4-row compact detail plus expanded editable view. BacklinksPanel is present in 7 of 9 editors (NPC, Location, Faction, Item, Adventure, Article, Plot). Missing from: `SessionLogEditor` and `PlayerCharacterEditor`. LinkedText auto-linkifies entity name mentions in freeform text across all editors. EntityLink enables click-through from mention to entity. Pinning to sidebar is supported. The CommandPalette does not search article content or session log recap text — only name + subtitle prefix (80 chars). Scenes are not directly searchable in the CommandPalette (the palette indexes adventures but not their individual scenes).

---

## Loading / Error / Empty State Inventory

| Component | Loading | Error | Empty |
|-----------|---------|-------|-------|
| NpcGenerator | SkeletonGeneratorOverlay overlay | Inline red text below submit | N/A (generator, not list) |
| LocationGenerator | SkeletonGeneratorOverlay overlay | Inline red text | N/A |
| FactionGenerator | SkeletonGeneratorOverlay overlay | Inline red text | N/A |
| ItemGenerator | SkeletonGeneratorOverlay overlay | Inline red text | N/A |
| AdventureGenerator | SkeletonGeneratorOverlay overlay | Inline red text | N/A |
| ArticleGenerator | SkeletonGeneratorOverlay overlay | Inline red text | N/A |
| SceneGenerator | Inline spinner icon + button text change | Inline red text | N/A |
| PlayerCharacterImporter | Inline spinner icon + button text change | Inline red text | N/A |
| EntityChatGenerator | Inline spinner bubble in chat thread | Model error message in chat | Empty thread with prompt chips |
| NpcDashboard | Synchronous (no async load) | N/A | Thematic icon + copy + "use the generator" |
| LocationDashboard | Synchronous | N/A | Thematic icon + copy |
| FactionDashboard | Synchronous | N/A | Thematic icon + copy |
| ItemDashboard | Synchronous | N/A | Thematic icon + copy |
| AdventureDashboard | Synchronous | N/A | Thematic icon + copy |
| ArticleDashboard | Synchronous | N/A | Thematic icon + copy |
| PlotDashboard | Synchronous | N/A | Three distinct: active/dormant/resolved |
| SessionLogDashboard | Synchronous | N/A | Planned: icon+CTA; Past: text-only, no CTA |
| PlayerCharacterDashboard | Synchronous | N/A | Icon + text |
| NoteDashboard | Synchronous | N/A | Icon + generic text |
| DmCoach dialog | Spinner on generate button | Console.error only (no user message) | Initial state with tool selector |
| EvocationWizard dialog | Wizard icon pulse + progress message | None visible (silent fail) | Initial mode selector |
| SessionEndWizard dialog | Spinner overlay | None visible | Empty recap prompts |
| ContinuityChecker dialog | Spinner before run | N/A (reads local state) | "No issues found" success state |
| CombatTracker | N/A | window.confirm for reset | "Add combatants" hint |
| SessionRunner | Per-action spinners (NPC gen, notes) | speech.onerror → silently stops | "No scenes planned" + "No beats yet" |
| RelationshipGraph | D3 render (synchronous) | None | No explicit empty state for zero-entity campaign |
| SessionLogEditor | Spinner on AI analysis | window.alert | N/A |
| NpcEditor | Per-field regenerate spinner | None at editor level | N/A |
| LocationEditor | Per-POI generate spinner | None at editor level | N/A |

---

## Issues

### ISSUE-01: `window.alert()` and `window.confirm()` used for all destructive actions and import errors

**Severity:** High
**Location:** 14 component files — `components/editors/NpcEditor.tsx:72`, `components/editors/LocationEditor.tsx:89`, `components/editors/FactionEditor.tsx:71`, `components/editors/ItemEditor.tsx:47`, `components/editors/ArticleEditor.tsx:72`, `components/editors/SessionLogEditor.tsx:98`, `components/editors/SceneEditor.tsx:68`, `components/editors/PlotEditor.tsx:54`, `components/editors/PlayerCharacterEditor.tsx:21`, `components/editors/NoteEditor.tsx:49`, `components/tools/CombatTracker.tsx:93`, `App.tsx:269`, `App.tsx:272`, `App.tsx:1031`, `App.tsx:1087`, `components/editors/SessionLogEditor.tsx:172`
**Description:** Every delete confirmation and import success/failure uses browser-native `window.confirm()` and `window.alert()`. These block the main thread, look inconsistent with the dark-fantasy UI, cannot be styled, and break the immersive experience during a live session. The confirm dialog closes the app's mental context.
**Suggested Fix:** Implement a minimal `useConfirmDialog` hook or an in-app `ConfirmModal` component with the dark stone theme. For non-destructive notifications (import success, entity count), implement a `toast` system (a `useState`-driven toast queue in `App.tsx` with a fixed-position overlay is sufficient — no library needed). The pattern from `EntityChatGenerator` showing errors inline in the UI is the correct model to generalize.
**Effort:** M

---

### ISSUE-02: No `ErrorBoundary` at any level of the component tree

**Severity:** High
**Location:** `App.tsx` (root), no `ErrorBoundary` found anywhere via grep
**Description:** A runtime exception in any editor, dashboard, or dialog will crash the entire application with a blank screen. For a DM running a live session, this means losing the session runner with no recovery path visible. There is no fallback UI and no way for the user to know what happened or how to continue.
**Suggested Fix:** Wrap the main content area (`ContentWrapper` and all views) in a React `ErrorBoundary` that renders a styled recovery screen: "Something went wrong — your campaign data is safe. [Reload view] [Go to home]". Add a second boundary around each dialog overlay. The boundaries should catch and log errors but never crash the whole app.
**Effort:** S

---

### ISSUE-03: Dashboard entity cards are not keyboard-navigable (no `tabIndex`, no focus management)

**Severity:** High
**Location:** All dashboard grid components — `components/dashboards/NpcDashboard.tsx`, `LocationDashboard.tsx`, `FactionDashboard.tsx`, `ItemDashboard.tsx`, `AdventureDashboard.tsx`, `ArticleDashboard.tsx`, `PlotDashboard.tsx`, `PlayerCharacterDashboard.tsx`
**Description:** Entity cards rendered in dashboard grids are `<div>` or `<button>` elements but no `tabIndex` ordering exists, no roving tabindex pattern is implemented, and no focus ring is visible on any card. A keyboard-only user cannot navigate the entity grid and must rely exclusively on the CommandPalette search to find entities. This fails WCAG 2.1 criterion 2.1.1 (all functionality available via keyboard).
**Suggested Fix:** Ensure all entity card trigger elements are native `<button>` elements (not `<div onClick>`). Add `tabIndex={0}` to cards. For arrow-key grid navigation within a dashboard, implement a `useRovingTabIndex` hook. The `min-h-[44px]` touch targets are already present in CommandPalette results, confirming this pattern is understood — extend it to dashboards.
**Effort:** M

---

### ISSUE-04: Session Runner note input lacks a focus shortcut (CTQ-2.1 unmet)

**Severity:** High
**Location:** `components/views/SessionRunner.tsx` — note input area (rendered around line 1100+)
**Description:** The design document CTQ-2.1 requires "time from thought to captured note under 3 seconds" via a keyboard shortcut to focus the note input. The global keyboard shortcut system in `App.tsx` and `keyboardShortcuts.ts` does not include a shortcut for focusing the note input in SessionRunner. During a live session, the DM must click the input with a mouse, breaking flow.
**Suggested Fix:** Add a `'/'` shortcut that, when `activeView === 'session-runner'`, fires a `noteInputRef.current?.focus()` call. This shortcut is already suppressed inside inputs (`isFocusedInInput()` returns true), so it will not interfere with typing. Register it in `SHORTCUTS` with a description like "Focus session note input" and add a `useEffect` handler in `SessionRunner` that listens for this shortcut, or pass a `focusNoteInput` callback down from App.
**Effort:** S

---

### ISSUE-05: `BacklinksPanel` missing from `SessionLogEditor` and `PlayerCharacterEditor`

**Severity:** Medium
**Location:** `components/editors/SessionLogEditor.tsx` and `components/editors/PlayerCharacterEditor.tsx`
**Description:** 7 of 9 entity editors have a `BacklinksPanel` that shows which other entities reference them. `SessionLogEditor` and `PlayerCharacterEditor` do not. A user cannot discover which NPCs, articles, or plots mention a given session log or player character without manually searching. This is a consistency gap and hurts discoverability for two of the most cross-referenced entity types.
**Suggested Fix:** Import `BacklinksPanel` in both files and render it as a section within their tab layout (e.g., within a "Connections" or "References" tab). The `BacklinksPanel` accepts `entityId`, `entityType`, and `onNavigate` props — all of which are already available in both editors.
**Effort:** S

---

### ISSUE-06: Scenes not searchable via CommandPalette

**Severity:** Medium
**Location:** `components/common/CommandPalette.tsx:309-334` — entity push loop
**Description:** The CommandPalette indexes all 9 entity types but not `Scene` entities. Adventures are indexed as a whole, but a campaign with 5 adventures and 30 scenes (a common state for active campaigns) forces the user to know which adventure contains the scene they want, then navigate to it. There is no way to type "Ambush at Thornwood" and jump directly to that scene.
**Suggested Fix:** In `CommandPalette.tsx`, add `scene` to `CommandPaletteEntityType`. In `App.tsx` where `CommandPalette` is rendered (around line 1130), derive all scenes from `activeCampaign.adventures.flatMap(a => a.scenes)` and pass them as a `scenes` prop. The palette's `handleSelect` for `scene` type would call the existing `handleSelect('scene', id)` which already routes correctly via `parentAdventure` lookup.
**Effort:** S

---

### ISSUE-07: DmCoach errors are silent — no user feedback on generation failure

**Severity:** Medium
**Location:** `components/dialogs/DmCoach.tsx` — catch blocks in generate handlers
**Description:** When DM Coach AI generation fails (network error, rate limit, API key issue), the error is logged to `console.error` only. The dialog shows no error state — the button re-enables and the output area remains blank. During a live session this is critically confusing: the DM clicks "Generate Narration", nothing appears, and there is no indication of whether to wait or retry.
**Suggested Fix:** Add an `error` state to `DmCoach`. In the catch block, set a human-readable message: "Generation failed — check your API key in Campaign Settings." Display it in the output area with a retry button. The same inline red text pattern used in all generators should apply here.
**Effort:** S

---

### ISSUE-08: `EvocationWizard` has no visible error state on generation failure

**Severity:** Medium
**Location:** `components/dialogs/EvocationWizard.tsx` — generation catch path
**Description:** The Evocation Wizard (batch generation tool) replaces the loading overlay with the result list on success. On failure, the catch handler is not visible — the loading state disappears and the wizard returns to its prior state without explanation. For a batch operation that may take 15-30 seconds, a silent failure with no retry instruction is a severe usability gap.
**Suggested Fix:** Add an error state to the wizard that renders a styled error banner inside the panel: "Generation failed. Your campaign data was not modified. [Try again]" with a link to the API key settings.
**Effort:** S

---

### ISSUE-09: Plot status persistence gap is identified in design docs but still present

**Severity:** Medium
**Location:** `components/views/SessionRunner.tsx` — `plotSessionStatus` state (around line 100-150)
**Description:** The design document (session-cockpit-review.md, UNI-1, CTQ-1.3) identifies that plot status changes in the Session Runner must persist to `campaignService` state and survive page refresh. This is rated P0 across three archetypes. The current implementation uses a local React state for `plotSessionStatus`. Changes made during a live session vanish on refresh.
**Suggested Fix:** Call `campaignService.updatePlot(plotId, { sessionStatus: newStatus })` on status toggle instead of writing to local React state. The `PlotSessionStatus` type already exists in the type system. Ensure `Plot` includes a `sessionStatus` field and that `campaignService.updatePlot` persists it through the Immer update path.
**Effort:** M

---

### ISSUE-10: `KeyboardShortcutsHelp` panel lacks focus trap and dialog role

**Severity:** Low
**Location:** `components/common/KeyboardShortcutsHelp.tsx:29`
**Description:** The help panel uses `style={{ pointerEvents: 'none' }}` on its outer container and `style={{ pointerEvents: 'auto' }}` on the inner panel. It has no `role="dialog"`, no `aria-modal="true"`, and no focus trap. A keyboard user pressing `?` to open help cannot tab through the shortcuts list; focus stays in whatever element was active before. Screen readers will not announce this as a modal dialog.
**Suggested Fix:** Add `role="dialog"` and `aria-modal="true"` to the inner panel. On open, move focus to the panel's close button (`useEffect` + `closeButtonRef.current?.focus()`). Trap Tab/Shift+Tab within the panel while open. The `CommandPalette` component demonstrates this pattern correctly and can serve as a reference.
**Effort:** S

---

### ISSUE-11: Relationship Graph has no empty state for a campaign with no linked entities

**Severity:** Low
**Location:** `components/visualizers/RelationshipGraph.tsx`
**Description:** When viewing the Relationship Graph for a campaign where no entity relationships have been established (common for new campaigns), the D3 canvas renders an empty SVG. There is no empty state, no guidance on how to create relationships, and no hint that the graph will populate as the user links NPCs to factions, locations to factions, etc.
**Suggested Fix:** Add a conditional empty state: when the edge count is 0, render a centered illustration with the message "Your world map will grow here — link NPCs to factions, locations to factions, and connect scenes to populate the graph." Include a CTA that navigates to the NPCs view.
**Effort:** S

---

### ISSUE-12: `session-runner` view is only reachable via "Go Live" in SessionLogDashboard — no direct navigation path

**Severity:** Low
**Location:** `App.tsx:57` (EditorView type), `components/layout/CampaignSidebar.tsx`
**Description:** The `session-runner` view is defined in the `EditorView` union type but the sidebar does not show a direct "Session Runner" navigation item. The only path to it is via the "Go Live" button in a session log. If a DM accidentally navigates away from an active session (e.g., looks up an NPC), there is no obvious sidebar item to return to the session runner. They must know to go to Session Logs, find the active session, and click Go Live again.
**Suggested Fix:** When a session is active (`activeCampaign.sessionLogs.some(s => s.status === 'active')`), render a prominent "Return to Live Session" button at the top of the sidebar, above the section navigation. The sidebar already has conditional rendering logic based on `activeView`; this would be a simple conditional addition.
**Effort:** S

---

## CTQ Gap Analysis

Referencing `docs/design/session-cockpit-review.md`:

| CTQ | Threshold | Current Status | Gap |
|-----|-----------|---------------|-----|
| CTQ-1.1 | Entity popover renders within 200ms | EntityQuickCard renders from synchronous local state — no async fetch. Likely met. | None |
| CTQ-1.3 | Plot status changes persist to campaign data | Local React state only in SessionRunner | FAIL — Issue 09 |
| CTQ-1.5 | Quick-search indexes all entity types, returns within 300ms | Scenes not indexed. Substring match is synchronous — latency likely <10ms for <500 entities | Partial FAIL — Issue 06 |
| CTQ-2.1 | Note capture under 3 seconds (shortcut to focus) | No focus shortcut for note input | FAIL — Issue 04 |
| CTQ-2.5 | Secrets/clues: 15 entries, one-click toggle | SecretsTracker is conditionally visible via DM Style; supports toggles | Conditionally met |
| CTQ-3.1 | First-session onboarding in 3 steps or fewer | FirstCampaignWizard exists (multi-step) | Likely met |
| CTQ-3.3 | DM Coach template prompts (5 per tool) | DmCoach has suggestion chips for prompt templates | Likely met |
| CTQ-4.4 | Full-screen combat with 15 combatants without horizontal scroll | CombatTracker is a slide-out panel (~500px), not full-screen | FAIL |
| CTQ-5.1 | Session end flow includes recap, loose ends, plot status in same view | SessionEndWizard is a dialog launched from SessionRunner | Likely met |
| CTQ-5.5 | Session timer persists across refresh | No session timer visible in SessionRunner header | FAIL |

---

## Patterns and Anti-Patterns

### Positive Patterns

**Consistent entity type color coding.** CommandPalette, EntityQuickCard, BacklinksPanel, and EntityLink all use the same amber/emerald/violet/sky/orange/cyan/rose/yellow/teal/blue color-to-type mapping. Users learn once that amber means NPC and it holds everywhere.

**Back-stack navigation with breadcrumbs.** The `pushNavStack` / `handleGoBack` system combined with `Breadcrumbs` gives the app proper browser-like back navigation without using the actual browser history API, which would break the SPA model. This is well-designed.

**Progressive disclosure via DM Style.** `isFeatureVisible()` checks allow hiding combat tracker and secrets tracker for less experienced DMs. The architecture is correct.

**Keyboard shortcut suppression in inputs.** The `isFocusedInInput()` check in `matchShortcut` prevents the `/` and `?` shortcuts from firing while typing. This is a subtle but important detail that most apps get wrong.

**Recent items tracking is session-only.** Storing recent items in `useState` rather than `localStorage` is the correct choice for a DM — you do not want last week's session's NPCs polluting today's recent list.

### Anti-Patterns

**`window.alert()` and `window.confirm()` for all user decisions.** These are synchronous, blocking, and cannot be styled. The rest of the app is polished; these calls are jarring. Every user action that requires confirmation should use an in-app modal.

**No `ErrorBoundary` anywhere.** A single uncaught exception in a React component will blank the screen. For an app used during live play, this is unacceptable.

**Inconsistent loading feedback for dialogs vs. generators.** Generators all use `SkeletonGeneratorOverlay` (consistent). Dialogs each invented their own loading UI: DmCoach uses a spinner on the button, EvocationWizard uses a pulsing icon with progressive text, WorldSimulationWizard uses a centered spinner overlay, SessionEndWizard uses a full-overlay spinner. These are not wrong individually but there is no shared `DialogLoadingOverlay` primitive.

**Duplicate legacy editor files.** The repo contains both `components/editors/NpcEditor.tsx` (canonical) and `components/NpcEditor.tsx` (legacy). Same for Location, Faction, Item, Scene, Article, SessionLog, PlayerCharacter. These legacy files still use `window.confirm` (confirmed at `components/NpcEditor.tsx:44`). If any import path resolves to a legacy file accidentally, the app regresses silently.

**Scenes are a first-class entity in the type system but second-class in navigation.** `Scene` has an `EntityQuickCard` type config, a `handleSelect('scene', id)` path, and LinkedText support, but cannot be searched in CommandPalette and has no BacklinksPanel in `SceneEditor`. The gap is small but breaks the mental model.

---

## Screenshots

- Desktop (1440x900): `.planning/ui-reviews/ia-audit-20260324-164531/desktop.png`
- Mobile (375x812): `.planning/ui-reviews/ia-audit-20260324-164531/mobile.png`

Screenshot shows: Campaign Setting view for "Winter's Daughter" campaign. Sidebar displays all navigation sections. Header shows mock mode toggle, search button, continuity badge, Evocation Wizard, World Sim, and Session Weaver tools. The three-tier hierarchy (sidebar section > content area > detail editor) is clearly visible.

---

## Files Audited

- `/home/djiv/WebstormProjects/Realmweaver/App.tsx` (all 1000+ lines, read in segments)
- `/home/djiv/WebstormProjects/Realmweaver/components/common/CommandPalette.tsx`
- `/home/djiv/WebstormProjects/Realmweaver/components/common/KeyboardShortcutsHelp.tsx`
- `/home/djiv/WebstormProjects/Realmweaver/components/common/EntityQuickCard.tsx` (sampled)
- `/home/djiv/WebstormProjects/Realmweaver/components/layout/CampaignSidebar.tsx` (sampled)
- `/home/djiv/WebstormProjects/Realmweaver/components/layout/Header.tsx` (sampled)
- `/home/djiv/WebstormProjects/Realmweaver/components/views/SessionRunner.tsx` (sampled)
- `/home/djiv/WebstormProjects/Realmweaver/components/editors/NpcEditor.tsx` (sampled)
- `/home/djiv/WebstormProjects/Realmweaver/components/editors/LocationEditor.tsx` (sampled)
- `/home/djiv/WebstormProjects/Realmweaver/components/editors/FactionEditor.tsx` (sampled)
- `/home/djiv/WebstormProjects/Realmweaver/components/dashboards/NpcDashboard.tsx` (sampled)
- `/home/djiv/WebstormProjects/Realmweaver/utils/keyboardShortcuts.ts`
- `/home/djiv/WebstormProjects/Realmweaver/docs/design/session-cockpit-review.md` (full CTQ sections)
- Systematic grep across all `components/` `.tsx` files for: loading state patterns, error patterns, empty state patterns, keyboard event handlers, ARIA attributes, spinner/skeleton usage, alert/confirm usage, ErrorBoundary, BacklinksPanel, EntityLink, confirm dialogs, and navigation handlers
