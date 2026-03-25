# Realmweaver UX Audit Report -- Unified Synthesis

**Date:** 2026-03-24
**Synthesized from:** 9 individual audit reports (6 view-partitioned, 3 cross-cutting)
**Audited surface:** ~90 .tsx component files, ~3,600 lines of service code, full type system

---

## 1. Executive Summary

Realmweaver has a strong design foundation: a coherent dark-fantasy aesthetic, a well-structured three-tier component hierarchy (Dashboard / Generator / Editor), and genuinely ambitious features like the D3 relationship graph, session cockpit, and AI-powered entity drafting. The app is usable and often delightful for a DM who has learned the layout. However, three systemic problems undermine the experience at scale. First, **browser-native dialogs (`window.alert` and `window.confirm`) are used for every destructive action and error notification across 14+ files**, breaking the dark-fantasy immersion and blocking the main thread during live sessions. Second, **the codebase has two competing gray palettes (`slate-*` vs. `stone-*`) and two competing accent colors (amber vs. indigo)** that create a subtle but persistent visual inconsistency across views. Third, **three monolithic components -- `App.tsx` (1,162 lines), `SessionRunner.tsx` (1,389 lines), and `CampaignSidebar.tsx` (771 lines) -- have accumulated state and logic beyond sustainable boundaries**, making every new feature incrementally harder to ship. The single most important thing to fix is replacing the native dialog calls with in-app UI components: it is the highest-visibility, most-frequently-encountered quality gap that every user hits on every session.

---

## 2. Scored Assessment

### Methodology

Each of the 9 audit agents scored applicable dimensions on a 1-10 scale. Layer 2 cross-cutting agents (Design System, Interaction/IA, Component Architecture) reviewed the full application and receive 1.5x weight. Layer 1 view-partitioned agents (Onboarding, Entity Management, Session/Gameplay, Wizards/Dialogs, Shell/Navigation, Visualization/Chat) reviewed their specific scope and receive 1x weight.

### Aggregate Scoring Table

| Dimension | Onboarding | Entity Mgmt | Session | Wizards | Shell/Nav | Viz/Chat | Design System (1.5x) | Interaction/IA (1.5x) | Component Arch (1.5x) | **Weighted Avg** |
|-----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Visual Consistency | 7 | 7 | 7 | 6 | 7 | 8 | 6.4 | -- | -- | **6.8** |
| Interaction Quality | 5 | 5 | 6 | 7 | 7 | 6 | -- | -- | -- | **6.0** |
| Information Architecture | 4 | 6 | 6 | 8 | 7 | 7 | -- | 6.5 | -- | **6.3** |
| Component Quality | 7 | 6 | 5 | 5 | 5 | 8 | -- | -- | 6 | **5.9** |
| Scalability | 6 | 6 | 5 | 4 | 6 | 6 | -- | -- | -- | **5.5** |

**Notes on scoring:**
- **Visual Consistency (6.8/10):** The dark fantasy theme holds well across 80% of the app. The score is pulled down by the slate/stone split (flagged by 7 of 9 agents) and the indigo accent competing with amber (flagged by 4 agents). The entity-type color system is a genuine strength.
- **Interaction Quality (6.0/10):** AI generation loading states are consistently handled. The score suffers from universal reliance on `window.alert`/`window.confirm` (flagged by 6 agents), missing search/filter on dashboards, and DM Coach output not flowing to the session log.
- **Information Architecture (6.3/10):** Navigation is well-structured (sidebar buckets, breadcrumbs, command palette, back-stack). Gaps: new users bypass the welcome screen due to demo seeding, scenes are not searchable in the command palette, and the session runner has no persistent sidebar return path during a live session.
- **Component Quality (5.9/10):** The three-tier pattern and shared primitives (Button, AiTextarea, TabLayout, EntityQuickCard) are well-designed. The score reflects three god-components (App.tsx, SessionRunner, CampaignSidebar), 20 stale legacy component files, and duplicated dashboard creation toggle logic across 7 files.
- **Scalability (5.5/10):** The lowest dimension. No shared wizard primitive exists (each wizard re-implements step logic). Adding a new entity type requires touching 6+ files. The combat tracker and PlotTimeline have hardcoded dimensions that degrade at scale. The absence of dashboard search makes the app unusable with 40+ entities of any type.

### Radar Chart Data

```
Visual Consistency:      6.8
Interaction Quality:     6.0
Information Architecture: 6.3
Component Quality:       5.9
Scalability:             5.5
```

**Composite score: 6.1/10** -- a functional, visually appealing app with systematic gaps in interaction polish, component maintainability, and scalability.

---

## 3. Prioritized Issue List

Issues are merged and deduplicated across all 9 reports. Sorted by severity, then by number of agents flagging it, then by effort (quick wins first).

### Critical

| # | Theme | Location | Description | Suggested Fix | Effort | Sources |
|---|-------|----------|-------------|---------------|--------|---------|
| C1 | **Native Dialog Replacement** | 14+ files across `components/editors/`, `components/tools/`, `App.tsx` (20+ call sites) | Every destructive action uses `window.confirm()` and every error/success notification uses `window.alert()`. These block the main thread, break the dark theme, and are jarring during live sessions. 20 confirmed instances across 14 files. | Implement a `<ConfirmDialog>` component and a `useToast()` hook. Replace all `window.confirm` with the dialog and all `window.alert` with toast notifications. The `SecretsTracker` "Sure?" button pattern and `EntityChatGenerator` inline error pattern already demonstrate the correct approaches. Also remove the `window.confirm()` in `campaignService.ts:916` -- a UI concern that does not belong in the service layer. | M | Onboarding, Entity Mgmt, Session, Shell/Nav, Interaction/IA, Component Arch (6/9 agents) |
| C2 | **Mobile Chat Widget Overflow** | `components/RealmChat/RealmChatWidget.tsx:213` | Chat window is fixed at `w-[450px] h-[700px]`. On 375px mobile, it overflows the viewport -- header clipped, send button partially off-screen. Confirmed in screenshot. | Add responsive classes: `w-[calc(100vw-1.5rem)] sm:w-[450px]` and `max-h-[calc(100vh-3rem)] sm:h-[700px]`. Also apply `right-3 bottom-3 sm:right-6 sm:bottom-6`. | S | Visualization/Chat |
| C3 | **No Keyboard Focus Trap in Modal Dialogs** | All 7 dialog files in `components/dialogs/` | No dialog implements focus trapping. Tab navigation escapes into the background DOM. Only ContinuityChecker handles Escape key. WCAG 2.1 Level AA failure for modal accessibility. | Create a shared `<DialogShell>` wrapper with `useEffect`-based focus trap. Add `onKeyDown` Escape handling to all dialogs. Consider `focus-trap-react` for a lightweight solution. | M | Wizards/Dialogs |
| C4 | **New Users Never See the Welcome Flow** | `services/campaignService.ts:275-920` | When no saved campaigns exist, `init()` auto-seeds a full "Winter's Daughter" demo campaign and sets `appStatus = 'editing'`. First-time users land inside a foreign campaign with zero orientation. `WelcomeScreen` is functionally unreachable. | Set `appStatus = 'welcome'` when no saved campaigns exist. Move demo data into a template offered during the creation flow. | M | Onboarding |

### High

| # | Theme | Location | Description | Suggested Fix | Effort | Sources |
|---|-------|----------|-------------|---------------|--------|---------|
| H1 | **Slate vs. Stone Color Token Split** | 17 files use `stone-*` (208 occurrences) vs. ~71 files using `slate-*` (615+ occurrences) | Two visually similar but distinct gray families compete across the app. Stone-dominant components: FirstCampaignWizard, CrossCampaignDashboard, CommandPalette, EntityQuickCard, PlotTimeline, ContinuityChecker. Creates visible warm/cool tonal shifts at component boundaries. | Standardize on one family. Recommended: keep `slate-*` as the base (it is dominant and matches the `bg-slate-950` body class in index.html). Migrate the 17 `stone-*` files to `slate-*` equivalents. | M | Onboarding, Entity Mgmt, Session, Wizards, Shell/Nav, Viz/Chat, Design System (7/9 agents) |
| H2 | **Indigo Competes With Amber as Second Accent** | 47 files, 199 occurrences of `indigo-*` vs. 50 files, 351 occurrences of `amber-*` | Indigo is used for Mock Mode toggle, Evocation Wizard launcher, Session Weaver launcher, AI "Generate" buttons in AiTextarea, focus rings in legacy editors, and the save spinner. Two competing accent colors dilute the design system. | Audit all indigo usages. Migrate interactive controls to amber. Reserve indigo only for the RealmChat widget (AI assistant voice distinction). Document the split explicitly in CLAUDE.md if intentional. Highest-leverage single fix: change `AiTextarea`'s indigo button (`Textarea.tsx:40`) to amber -- it touches every AI-assisted field in the app. | M | Wizards, Design System (weighted 1.5x), Shell/Nav, Viz/Chat |
| H3 | **App.tsx God Component** | `App.tsx:68-1162` | 1,162 lines, 27 `useState` calls, 15 `useMemo` calls, 7 `useEffect` calls. Owns entity selection IDs, modal states, nav stack, context building, view routing, and keyboard shortcuts. The 115-line `currentContext` useMemo duplicates logic in `contextBuilder.ts`. | Extract `useEntitySelection()` hook, `useModalState()` hook, move `renderMainContent()` into a `<ViewRouter>` component. Consolidate `currentContext` with `contextBuilder.ts`. Target: App.tsx under 400 lines. | L | Shell/Nav, Component Arch (both weighted 1.5x for cross-cutting), Session |
| H4 | **SessionRunner.tsx Monolith** | `components/views/SessionRunner.tsx` (1,389 lines, 22 `useState` hooks) | Single component managing 6+ unrelated concerns (note input, combat panel, dice roller, quick NPC generation, voice capture, mobile layout). Any new session feature adds to this surface. Decomposition is prerequisite for P1 feature work. | Extract `<SceneListPanel>`, `<ActiveScenePanel>`, `<QuickToolsPanel>`, `<RunningLog>`, `<QuickNpcGenerator>` as sub-components in `components/views/session/`. | L | Session, Component Arch (1.5x) |
| H5 | **20 Stale Root-Level Component Files** | `components/NpcEditor.tsx`, `components/FactionEditor.tsx`, and 18 others at `components/` root | Older versions of files now in `components/editors/`, `components/layout/`, etc. Not imported by the live app but inflate search results, confuse contributors, carry outdated design patterns (indigo focus rings), and may be accidentally re-integrated. | Delete all 20 files. Run `npm run build` to confirm no breakage. | S | Entity Mgmt, Design System (1.5x), Interaction/IA (1.5x), Component Arch (1.5x) -- 4 agents |
| H6 | **No Search/Filter on Any Dashboard** | All 10 dashboard files in `components/dashboards/` | All entity lists are unbounded grids with no filtering. A campaign with 40+ NPCs has no way to find entities except scrolling. Blocks practical use at scale. | Add a controlled text input above each entity grid, filtered client-side with `useMemo`. Extract a reusable `useEntitySearch` hook. Start with NpcDashboard, LocationDashboard, ItemDashboard. | M | Entity Mgmt, Interaction/IA (1.5x) |
| H7 | **No ErrorBoundary in the Component Tree** | `App.tsx` (root) -- none found anywhere | A runtime exception in any editor, dashboard, or dialog crashes the entire application with a blank screen. For a DM in a live session, this means total loss of the session runner with no recovery. | Wrap the main content area in a React `ErrorBoundary` with a styled recovery screen. Add a second boundary around each dialog overlay. | S | Interaction/IA (1.5x) |
| H8 | **Eight Editor Components Read Store Non-Reactively** | `NpcEditor.tsx:42`, `LocationEditor.tsx:45`, `FactionEditor.tsx:41`, `PlotEditor.tsx:28`, `SessionLogEditor.tsx:50`, `ArticleEditor.tsx:33`, `SceneEditor.tsx:90`, `EntityQuickCard.tsx:105` | Each calls `campaignService.getState()` at the top of the component body -- a synchronous snapshot that does not subscribe to updates. If the store changes while the editor is open, the local campaign copy goes stale. | Pass `campaign` as a prop from App.tsx (which already subscribes reactively). The prop interface exists in most editors -- extend it to the remaining ones. | M | Component Arch (1.5x) |
| H9 | **Command Palette Does Not Index Scenes** | `components/common/CommandPalette.tsx:309-334` | Scenes are first-class entities but cannot be searched in the Command Palette. A DM with 5 adventures and 30 scenes must know which adventure contains the scene they want. | Add a `scenes` prop. Derive scenes from `activeCampaign.adventures.flatMap(a => a.scenes)`. Add `case 'scene'` to `handleSelect`. | S | Shell/Nav, Interaction/IA (1.5x) |
| H10 | **DM Coach Output Not Auto-Logged to Session Running Log** | `components/dialogs/DmCoach.tsx`, `components/views/SessionRunner.tsx` | Coach-generated narration/improv disappears when the panel closes. The `onSendToNotes` prop exists but requires manual click. Design doc CTQ-2.3 requires auto-logging within 1 second. | Add `onResultGenerated` callback to DmCoach. Wire to `campaignService.addAutoEvent('coach-used', content)` in SessionRunner. | S | Session |
| H11 | **Wrong Icon on Chat Send Button** | `components/RealmChat/RealmChatWidget.tsx:358` | Send button uses `Icons.Combat` (crossed swords) rotated 90 degrees. `Icons.Send` already exists in Icons.tsx. Semantically wrong and visually confusing. | Replace `Icons.Combat className="w-4 h-4 rotate-90"` with `Icons.Send className="w-4 h-4"`. | S | Visualization/Chat |
| H12 | **Relationship Graph Missing Reset View Control** | `components/visualizers/RelationshipGraph.tsx:165-171` | No button to reset zoom/pan after navigating the graph. Users get lost with no reliable way back. Graph also lacks a `ResizeObserver` -- dimensions go stale on window resize. | Add "Reset View" button using stored `zoom` ref. Add `ResizeObserver` for container dimension tracking (debounced). | S (reset), M (resize) | Visualization/Chat |
| H13 | **Dashboard Entity Cards Not Keyboard-Navigable** | All 8+ dashboard files | Entity cards lack `tabIndex`, no roving tabindex pattern. Keyboard-only users cannot navigate entity grids. WCAG 2.1 criterion 2.1.1 failure. | Ensure card triggers are native `<button>` elements with `tabIndex={0}`. Implement `useRovingTabIndex` for grid navigation. | M | Interaction/IA (1.5x) |
| H14 | **CampaignSidebar.tsx Overloaded** | `components/layout/CampaignSidebar.tsx` (771 lines) | Manages drag-and-drop, search/filter, article tree rendering, pinned entities, recent items, DM style panel, session banner, and 14+ nav sections. Same accumulation pattern as App.tsx. | Split into `SidebarSearch.tsx`, `SidebarRecentPinned.tsx`, and per-bucket section components. Keep CampaignSidebar as composition root. | M | Shell/Nav, Component Arch (1.5x) |

### Medium

| # | Theme | Location | Description | Suggested Fix | Effort | Sources |
|---|-------|----------|-------------|---------------|--------|---------|
| M1 | **No Shared Wizard/StepIndicator Primitive** | `SessionPrepWizard.tsx:320-345`, `SessionEndWizard.tsx:189-210`, `WorldSimulationWizard.tsx` | Three wizards independently re-implement step state, navigation, and indicator UI. ~100 lines of boilerplate per wizard. Any visual change requires updating 3 files. | Extract `<StepIndicator>` to `components/common/StepIndicator.tsx`. Each wizard replaces its indicator JSX with this component. | M | Wizards/Dialogs |
| M2 | **Dashboard Creation Mode Toggle Duplicated 7x** | `NpcDashboard.tsx`, `LocationDashboard.tsx`, `FactionDashboard.tsx`, `ItemDashboard.tsx`, `AdventureDashboard.tsx`, `ArticleDashboard.tsx` | Same ~50-line chat-vs-form creation mode toggle copy-pasted across 6+ dashboards. Any change requires touching all files. | Extract `<EntityCreationPanel>` that accepts `entityType`, `formGenerator`, `onCreated`, and `promptChips` props. | M | Entity Mgmt |
| M3 | **EntityQuickCard.tsx Monolith (1,003 lines)** | `components/common/EntityQuickCard.tsx` | Contains entity type config, compact/expanded detail extractors for 10 types, field save dispatch, scene details, and the React component. At least 4 separate concerns. | Extract `entityDetailExtractors.ts`, `entityFieldSave.ts`. Keep only the React component in EntityQuickCard.tsx. | M | Entity Mgmt |
| M4 | **Focus Ring Inconsistency** | 80 occurrences of `focus:ring-indigo` across 26 files vs. 96 of `focus:ring-amber` across 26 files | Inputs and buttons split between amber rings, indigo rings, and no visible ring. Inconsistent keyboard navigation affordances. | Standardize all interactive elements to `focus:ring-2 focus:ring-amber-500/50`. Create shared `inputBaseClasses` constant. | M | Design System (1.5x) |
| M5 | **Raw `<button>` vs. `<Button>` Inconsistency** | 295 raw `<button>` across 59 files vs. 125 `<Button>` usages across 53 files | 70% of buttons are raw elements with ad-hoc styling. Many lack consistent disabled state, focus rings, or variant styling. | Audit raw buttons. Migrate action buttons to `<Button>`. Add `variant="icon"` for toolbar patterns. | M | Design System (1.5x) |
| M6 | **EvocationWizard/ExportModal Use `absolute` Instead of `fixed` Positioning** | `EvocationWizard.tsx:273`, `ExportModal.tsx:14` | Both use `absolute inset-0` for overlay. If parent is not full-viewport, modal does not cover the screen and scrolls with the page. | Change to `fixed inset-0`. Verify z-index stacking. | S | Wizards/Dialogs |
| M7 | **SessionEndWizard Recap Step Opens Empty** | `components/dialogs/SessionEndWizard.tsx:222-233` | User must discover and click "Generate AI Recap" button. Since the wizard's purpose is to generate a recap, auto-trigger on mount would match expectations. | Auto-trigger `handleGenerateRecap()` via `useEffect` when session notes are non-empty. Provide "Regenerate" button afterward. | S | Wizards/Dialogs |
| M8 | **DmCoach and EvocationWizard Have Silent Error States** | `DmCoach.tsx` catch blocks, `EvocationWizard.tsx` generation path | DmCoach logs to `console.error` only with no user feedback. EvocationWizard silently returns to prior state on batch generation failure. | Add `error` state. Display inline error with retry button using the red-text pattern from generators. | S | Interaction/IA (1.5x) |
| M9 | **Chat History Not Persisted** | `components/RealmChat/RealmChatWidget.tsx:31` | `history` is local `useState`. Navigating away or reloading clears all conversation context. No "New Conversation" affordance exists either. | Persist to `sessionStorage` keyed by `campaign.id`. Add "New Conversation" button. Add message count limit. | M | Visualization/Chat |
| M10 | **`text-md` Is Not a Valid Tailwind Class** | `Header.tsx:114` | `text-md` does not exist in Tailwind (scale goes `text-sm` -> `text-base` -> `text-lg`). Campaign title has no explicit font size applied. | Change to `text-base`. | S | Shell/Nav |
| M11 | **Invalid `'planning'` Status String in `duplicateCampaign`** | `services/campaignService.ts:1042` | Sets status to `'planning'` but `SessionStatus` is `'planned' | 'active' | 'completed'`. Cast with `as typeof l.status` hides the mismatch. | Change to `'planned'`. | S | Component Arch (1.5x) |
| M12 | **Entity-Type Color Assignments Not Centralized** | `CrossCampaignDashboard.tsx`, `EntityQuickCard.tsx`, `CommandPalette.tsx`, `CampaignSidebar.tsx` | Same entity types get different colors in different views. No canonical entity-type color map exists. | Create centralized `ENTITY_TYPE_CONFIG` in `utils/entityUtils.ts` with icon, color, and label per type. Consume everywhere. | M | Design System (1.5x) |
| M13 | **Sidebar Filter Hides Buckets Silently** | `CampaignSidebar.tsx:288-291` | When search matches nothing in a bucket, the entire section disappears with no explanation. User may think the app is broken. | Render section header with muted "No results" message instead of unmounting. | S | Shell/Nav |
| M14 | **SecretsTracker Panel Height via Inline Style** | `SessionRunner.tsx:1081` | `style={{ maxHeight: '400px' }}` inline override instead of Tailwind. Does not respond to viewport height. | Replace with `max-h-[400px]` or dynamic `max-h-[40vh]`. | S | Session |
| M15 | **Plot Status Cycle Affordance Invisible on Touch** | `SessionRunner.tsx:1112` | "Click to change" text uses `opacity-0 group-hover:opacity-100`. Touch screens never trigger hover. No visible fallback. | Add persistent small label or cycle icon. | S | Session |
| M16 | **Running Log Fixed Height Too Small** | `SessionRunner.tsx:1134` | `h-44 md:h-56` limits visibility to ~6-8 entries. The log is the "single timeline of truth" but requires scrolling after minimal entries. | Bump to `h-48 md:h-64 lg:h-72` or add resize handle. | S | Session |
| M17 | **World Graph Nav Item Uses Wrong Icon** | `CampaignSidebar.tsx:556-561` | "World Graph" renders `icon="Coach"` (headset icon). Should be a graph/network icon. | Add `Network` icon to Icons.tsx. Change to `icon="Network"`. | S | Shell/Nav |
| M18 | **`isMockMode` Prop Accepted but Never Used in SessionPrepWizard** | `SessionPrepWizard.tsx:24-31` | Declared in interface but never referenced in component body. Dead prop creates false contract. | Remove from interface and calling site. | S | Wizards/Dialogs |
| M19 | **Amber vs. Indigo Accent Split Undocumented** | `DmCoach.tsx`, `EvocationWizard.tsx`, `SessionPrepWizard.tsx`, `SessionEndWizard.tsx` | No documented rule for when to use indigo vs. amber. DmCoach uses indigo "Send"; session wizards use amber. | Document the semantic rule in CLAUDE.md or unify to amber. | S | Wizards/Dialogs |
| M20 | **BacklinksPanel Missing from SessionLogEditor and PlayerCharacterEditor** | `components/editors/SessionLogEditor.tsx`, `components/editors/PlayerCharacterEditor.tsx` | 7/9 editors have BacklinksPanel. These two do not. Consistency gap for cross-referenced entity types. | Import and render BacklinksPanel in both editors. | S | Interaction/IA (1.5x) |
| M21 | **SessionLogEditor DOCX Import Silently Produces Garbage** | `SessionLogEditor.tsx:219` | UI accepts `.docx` files but import produces garbled output with a prefix note. No parser library installed. | Remove `.docx` from the `accept` attribute or disable with tooltip explaining limitation. | S | Entity Mgmt |
| M22 | **Graph Simulation Restarts From Scratch on Filter Toggle** | `components/visualizers/RelationshipGraph.tsx:295-300` | Every filter toggle triggers full teardown and re-initialization with random positions. Jarring visual "explosion"; custom node positions lost. | Use D3 update pattern to add/remove nodes dynamically instead of full reinit. | M | Visualization/Chat |
| M23 | **`animate-in` / `slide-in-from-bottom-10` CSS Classes Undefined** | `components/RealmChat/RealmChatWidget.tsx:214` | These classes require `tailwindcss-animate` plugin which is not included in the CDN bundle. Chat open animation silently does nothing. | Add missing keyframes to `index.html` or replace with existing `animate-fade-in` class. | S | Visualization/Chat |
| M24 | **Dual Context-Building Pipelines in App.tsx** | `App.tsx:192-199` and `App.tsx:370-484` | Two separate context strings built from the same campaign data. The 115-line inline `useMemo` duplicates logic in `contextBuilder.ts`. | Replace inline `useMemo` with `buildCampaignContext({ variant: 'coach', ... })`. Eliminates 100+ lines. | S | Component Arch (1.5x) |
| M25 | **Raw `<textarea>` Used Alongside `<AiTextarea>`** | 48 raw `<textarea>` across 28 files vs. 53 `<AiTextarea>` usages | Each raw textarea has hand-written className strings that diverge in focus rings, placeholder colors, and background levels. | Export `textareaBaseClasses` from `Textarea.tsx`. Import in all raw textarea usages for consistency. | S | Design System (1.5x) |
| M26 | **PlotTimeline Tooltip Position Breaks Near Viewport Top** | `components/visualizers/PlotTimeline.tsx:190-191` | Tooltip renders above element with `rect.top - 8`. No bounds check; clips when element is near top of viewport. | Add bounds check: flip tooltip below when near top. | S | Visualization/Chat |
| M27 | **No Session Timer in Cockpit Header** | `components/views/SessionRunner.tsx` header | Three DM archetypes rate this as critical. Completely absent from implementation. | Store `startedAt` on session log. Display elapsed `HH:MM` in header with `setInterval(1000)`. | S | Session |

### Low

| # | Theme | Location | Description | Suggested Fix | Effort | Sources |
|---|-------|----------|-------------|---------------|--------|---------|
| L1 | **Button.tsx Contains Invalid `focus-amber` Class** | `components/common/Button.tsx:21` | Not a valid Tailwind utility; does nothing. | Remove `focus-amber` from line 21. | S | Onboarding |
| L2 | **CampaignSelector.tsx Is Orphaned** | `components/views/CampaignSelector.tsx` | Complete component imported but never rendered. Will silently diverge from CrossCampaignDashboard. | Delete the file and remove import from App.tsx. | S | Onboarding |
| L3 | **ProgressBar Shows 0% on Step 1 of FirstCampaignWizard** | `components/views/FirstCampaignWizard.tsx:53-63` | Formula `((step-1)/(totalSteps-1))*100` gives 0% on step 1. Looks broken. | Use `(step/totalSteps)*100` so step 1 shows 20%. | S | Onboarding |
| L4 | **Body Background Color Mismatch** | `index.html:131` vs. App.tsx root | Body uses `bg-slate-950`; app content uses `bg-slate-900`. One-stop difference visible in edge cases. | Align to single value. | S | Design System (1.5x) |
| L5 | **Mock Mode Toggle Lacks Accessible Name** | `Header.tsx:245-260` | `role="switch"` with no `aria-label`. Screen readers announce "switch, checked/unchecked" without context. | Add `aria-label="Mock Mode"`. | S | Shell/Nav |
| L6 | **KeyboardShortcutsHelp Panel Lacks Focus Trap and Dialog Role** | `components/common/KeyboardShortcutsHelp.tsx:29` | No `role="dialog"`, no `aria-modal`, no focus trap. Keyboard user cannot interact with the panel. | Add dialog role, focus trap, and Escape handling. | S | Interaction/IA (1.5x) |
| L7 | **Step Progress Not Communicated to Screen Readers** | `SessionPrepWizard.tsx:320-345`, `SessionEndWizard.tsx:189-210` | No `aria-current="step"` on active step. No visually-hidden progress announcement. | Add `aria-current="step"` and sr-only progress text. | S | Wizards/Dialogs |
| L8 | **QUEST and EVENT Types in RelationshipGraph Are Dead Code** | `RelationshipGraph.tsx:21-22, 36-37` | Color and filter entries exist for entity types that do not exist in the Campaign type. | Remove dead entries or add explanatory comment. | S | Visualization/Chat |
| L9 | **PlotTimeline Fixed Column Width Truncates Session Titles** | `PlotTimeline.tsx:204` | 120px columns truncate titles >12 characters. Wide at 10+ sessions. | Allow dynamic width or add compact/expanded toggle. | M | Visualization/Chat |
| L10 | **HistoryEntry Type Defined in NPC.ts but Used by Location.ts** | `types/NPC.ts:10-17`, `types/Location.ts:3` | General-purpose type lives in entity-specific file. | Move to `types/common.ts`. | S | Component Arch (1.5x) |
| L11 | **Card Padding Inconsistency** | Editors `p-6 md:p-8`, dialogs `p-4`, wizard cards `p-4` | No documented rule for card padding hierarchy. | Establish two-tier rule and document in CLAUDE.md. | S | Design System (1.5x) |
| L12 | **Breadcrumb Row Zero Bottom Padding** | `Breadcrumbs.tsx:20` | `pb-0` creates abutment with content in views not using ContentWrapper. | Change to `pb-2`. | S | Shell/Nav |
| L13 | **`audioTranscription.ts` Uses Gemini-Specific Model Name** | `services/ai/audioTranscription.ts:20` | Migration outlier with hardcoded model name. Intentionally deferred but undocumented. | Add explicit comment noting intentional exclusion from provider abstraction. | S | Component Arch (1.5x) |
| L14 | **AdventureEditor Missing Delete Button** | `components/editors/AdventureEditor.tsx` header | Every other editor has a Delete button in the header. Adventures can only be deleted from the dashboard. | Add `<Button variant="danger">Delete Adventure</Button>` to header. | S | Entity Mgmt |
| L15 | **WelcomeScreen CTA Label Mismatch** | `components/views/WelcomeScreen.tsx:19` | "Create Your First Campaign" is misleading if user deleted all campaigns and returned. | Change to "Create a Campaign". | S | Onboarding |
| L16 | **Relationship Graph Has No Empty State** | `components/visualizers/RelationshipGraph.tsx` | Zero-entity campaign shows empty SVG with no guidance. | Render centered message with instructions when edge count is 0. | S | Interaction/IA (1.5x) |
| L17 | **`session-runner` View Has No Direct Sidebar Navigation** | `App.tsx:57`, `CampaignSidebar.tsx` | The only path to a live session is via "Go Live" in SessionLogDashboard. No sidebar return path. | When a session is active, render "Return to Live Session" button at top of sidebar. | S | Interaction/IA (1.5x) |

---

## 4. Strategic Recommendations

The following work streams are organized as actionable sprint planning items, ordered by priority. Each builds on the previous where noted.

### Work Stream 1: Replace Native Dialogs With In-App UI

**Rationale:** This is the single most impactful UX fix. It was flagged by 6 of 9 audit agents, affects every user on every session, and is the most visible quality gap in an otherwise polished app. Covers issues C1, plus partial M8.

**Affected areas:** 14+ component files across editors, tools, and App.tsx. Also `campaignService.ts:916`.

**Recommended approach:**
1. Create `components/common/ConfirmDialog.tsx` -- a styled modal with dark-fantasy theme, title, message, confirm/cancel buttons.
2. Create a `useToast()` hook and `<ToastContainer>` component for success/error notifications.
3. Remove `window.confirm()` from `campaignService.ts:916` -- move confirmation to the calling component.
4. Systematically replace all 20 `window.confirm`/`window.alert` call sites.
5. Add error states to DmCoach and EvocationWizard catch paths.

**Estimated effort:** M (2-3 days)
**Priority order:** Do first. Maximum user-facing impact per hour invested.

---

### Work Stream 2: Standardize the Design System Tokens

**Rationale:** The slate/stone split (7 agents) and amber/indigo competition (4 agents) are the most frequently flagged issues after native dialogs. Resolving them eliminates an entire class of "which gray? which accent?" decisions for every future PR. Covers issues H1, H2, M4, M5, M12, M25, and several Low items.

**Affected areas:** ~17 files for stone-to-slate migration, 47 files for indigo audit, `Textarea.tsx`, `Button.tsx`, `entityUtils.ts`.

**Recommended approach:**
1. **Quick win (day 1):** Change `AiTextarea` indigo button to amber (`Textarea.tsx:40`). This single-line change touches every AI-assisted field.
2. **Slate standardization (day 2):** Migrate the 17 `stone-*` files to `slate-*`. Global find-replace with manual review.
3. **Focus ring standardization (day 3):** Replace all `focus:ring-indigo` with `focus:ring-amber`. Export shared `inputBaseClasses` from `Textarea.tsx`.
4. **Entity color centralization:** Create canonical `ENTITY_TYPE_CONFIG` in `entityUtils.ts`. Update `CrossCampaignDashboard`, `CommandPalette`, and `CampaignSidebar`.
5. **Document decisions:** Update CLAUDE.md Styling Conventions with the resolved token rules.

**Estimated effort:** M (3-4 days)
**Priority order:** Do second. Foundational for all future UI work.

---

### Work Stream 3: Delete Dead Code and Fix Quick Bugs

**Rationale:** Low-effort, high-signal changes that reduce maintenance surface and fix visible bugs. All items are S effort. Covers issues H5, L1, L2, L3, M10, M11, M18, M6, M23, H11, L5, L8, L12, L15, M13, M21, L4.

**Affected areas:** 20+ legacy files, Button.tsx, CampaignSelector.tsx, Header.tsx, campaignService.ts, various small fixes.

**Recommended approach:** Tackle as a single "cleanup" commit batch:
1. Delete 20 stale root-level component files.
2. Delete orphaned `CampaignSelector.tsx`.
3. Fix `text-md` -> `text-base` in Header.tsx.
4. Fix `'planning'` -> `'planned'` in campaignService.ts.
5. Fix `focus-amber` invalid class in Button.tsx.
6. Fix progress bar formula in FirstCampaignWizard.
7. Fix `absolute` -> `fixed` in EvocationWizard and ExportModal.
8. Fix send icon in RealmChatWidget.
9. Add missing animation keyframes or replace with existing class.
10. Remove dead `isMockMode` prop from SessionPrepWizard.
11. Add `aria-label` to Mock Mode toggle.
12. Remove dead QUEST/EVENT entries from RelationshipGraph.
13. Fix breadcrumb bottom padding.
14. Remove `.docx` from SessionLogEditor accept attribute.
15. Add documentation comment to `audioTranscription.ts`.

**Estimated effort:** S (1 day)
**Priority order:** Do third (or in parallel with Work Stream 2). Maximum debt reduction per hour.

---

### Work Stream 4: Decompose Monolithic Components

**Rationale:** Three components (App.tsx, SessionRunner, CampaignSidebar) are beyond sustainable boundaries. Every new feature increases their complexity. Decomposition is prerequisite for the session-gameplay P1 feature work identified in the cockpit review. Covers issues H3, H4, H14, M3, and partially M2.

**Affected areas:** `App.tsx`, `SessionRunner.tsx`, `CampaignSidebar.tsx`, `EntityQuickCard.tsx`.

**Recommended approach:**
1. **App.tsx (highest leverage):** Extract `useEntitySelection()`, `useModalState()` hooks. Move `renderMainContent` to `<ViewRouter>`. Consolidate `currentContext` with `contextBuilder.ts`. Target: under 400 lines.
2. **SessionRunner:** Extract `<SceneListPanel>`, `<ActiveScenePanel>`, `<QuickToolsPanel>`, `<RunningLog>` into `components/views/session/`.
3. **CampaignSidebar:** Split into per-bucket section components. Extract `ArticleTreeItem` to its own file.
4. **EntityQuickCard:** Extract detail extractors and field save dispatch to separate files.
5. **Dashboard creation panel:** Extract shared `<EntityCreationPanel>` to replace 6 copy-pasted toggle blocks.

**Estimated effort:** L (5-8 days)
**Priority order:** Do fourth. Unblocks all future feature work.

---

### Work Stream 5: Improve Accessibility and Keyboard Navigation

**Rationale:** Multiple WCAG 2.1 failures were identified: no focus traps in modals, entity cards not keyboard-navigable, missing ARIA attributes. While the DM-tool context reduces the urgency, these are real barriers for keyboard-primary users and a quality signal. Covers issues C3, H13, L5, L6, L7, and keyboard shortcut gaps.

**Affected areas:** All 7 dialog files, 8+ dashboard files, Header.tsx, KeyboardShortcutsHelp.tsx, SessionRunner.tsx.

**Recommended approach:**
1. Create shared `<DialogShell>` with focus trap, Escape handling, `role="dialog"`, `aria-modal`.
2. Retrofit all 7 dialogs to use `<DialogShell>`.
3. Add `tabIndex={0}` and `useRovingTabIndex` to dashboard entity cards.
4. Add `aria-label` to Mock Mode toggle and all icon-only buttons.
5. Add `aria-current="step"` to wizard step indicators.
6. Add `/` shortcut to focus session note input (CTQ-2.1).

**Estimated effort:** M (3-4 days)
**Priority order:** Do fifth. Important for quality but lower urgency than user-visible UX issues.

---

### Work Stream 6: Enhance Session Gameplay Experience

**Rationale:** The session cockpit is the app's most ambitious feature and where DMs spend the most critical time. Several P0/P1 gaps from the cockpit review remain. Covers issues H10, M14, M15, M16, M27, and the broader session integration theme.

**Affected areas:** `SessionRunner.tsx` (post-decomposition), `DmCoach.tsx`, session-related services.

**Recommended approach:** (Depends on Work Stream 4 completing SessionRunner decomposition first.)
1. Wire DM Coach auto-logging to running log.
2. Add session timer to cockpit header.
3. Bump running log height and add resize capability.
4. Replace inline style on SecretsTracker with Tailwind classes.
5. Add persistent affordance for plot status cycling (touch-friendly).
6. Add "Return to Live Session" button in sidebar when session is active.
7. Implement "Free Session" mode for sessions without linked adventures.

**Estimated effort:** M (3-4 days)
**Priority order:** Do sixth. Depends on Work Stream 4 for SessionRunner decomposition.

---

### Work Stream 7: Fix Onboarding and First-Run Experience

**Rationale:** New users currently land inside a pre-populated demo campaign with no orientation. The welcome screen, which is well-designed, is unreachable. This is the first impression and it is wrong. Covers issues C4, and related wizard UX (H-step validation, back-navigation warnings).

**Affected areas:** `campaignService.ts` init logic, `WelcomeScreen.tsx`, `CampaignCreator.tsx`, `FirstCampaignWizard.tsx`.

**Recommended approach:**
1. Change `init()` to set `appStatus = 'welcome'` when no saved campaigns exist.
2. Move "Winter's Daughter" demo data into a template file.
3. Offer it as a template option in TemplateSelectorStep.
4. Add character counter and inline validation to FirstCampaignWizard Step 1.
5. Add confirmation before Regenerate overwrites manual edits in wizard.
6. Add "Cancel" / "Back to campaigns" affordance from template selector.

**Estimated effort:** M (2-3 days)
**Priority order:** Do seventh. Important for new user acquisition but existing users are not affected.

---

### Work Stream 8: Add Dashboard Search and Improve Scalability

**Rationale:** The app becomes unusable at scale without search. No dashboard has any filtering mechanism. The combat tracker, PlotTimeline, and RealmChat all have hardcoded dimensions that degrade with growth. Covers issues H6, M9, M22, L9, and the broader scalability theme.

**Affected areas:** All 10 dashboard files, `CombatTracker.tsx`, `PlotTimeline.tsx`, `RelationshipGraph.tsx`, `RealmChatWidget.tsx`.

**Recommended approach:**
1. Extract `useEntitySearch(entities, searchFields)` hook.
2. Add search input to NpcDashboard, LocationDashboard, ItemDashboard first (highest entity counts).
3. Extend to remaining dashboards.
4. Add empty-search-results state to all dashboards.
5. Add scenes to CommandPalette index.
6. Persist RealmChat history to sessionStorage.
7. Use D3 update pattern for graph filter changes instead of full reinit.

**Estimated effort:** M-L (4-6 days)
**Priority order:** Do eighth. Important for long campaigns but not blocking for initial sessions.

---

## 5. Appendix

### Individual Report Links

**Layer 1 -- View-Partitioned:**
1. [Onboarding & Setup](section-onboarding.md)
2. [Entity Management](section-entity-management.md)
3. [Session & Gameplay](section-session-gameplay.md)
4. [Wizards & Dialogs](section-wizards-dialogs.md)
5. [Shell & Navigation](section-shell-navigation.md)
6. [Visualization & Chat](section-visualization-chat.md)

**Layer 2 -- Cross-Cutting:**
7. [Design System & Visual Consistency](dimension-design-system.md)
8. [Interaction & Information Architecture](dimension-interaction-ia.md)
9. [Component & State Architecture](dimension-component-architecture.md)

### Full Score Matrix (All Agents x All Dimensions)

| Agent | Type | Visual | Interaction | Info Arch | Component | Scalability | Composite |
|-------|------|:------:|:-----------:|:---------:|:---------:|:-----------:|:---------:|
| Onboarding | L1 (1x) | 7 | 5 | 4 | 7 | 6 | 29/50 |
| Entity Mgmt | L1 (1x) | 7 | 5 | 6 | 6 | 6 | 30/50 |
| Session/Gameplay | L1 (1x) | 7 | 6 | 6 | 5 | 5 | 29/50 |
| Wizards/Dialogs | L1 (1x) | 6 | 7 | 8 | 5 | 4 | 30/50 |
| Shell/Nav | L1 (1x) | 7 | 7 | 7 | 5 | 6 | 32/50 |
| Viz/Chat | L1 (1x) | 8 | 6 | 7 | 8 | 6 | 35/50 |
| **Design System** | **L2 (1.5x)** | **6.4** | -- | -- | -- | -- | **6.4/10** |
| **Interaction/IA** | **L2 (1.5x)** | -- | -- | **6.5** | -- | -- | **6.5/10** |
| **Component Arch** | **L2 (1.5x)** | -- | -- | -- | **6** | -- | **7/10** |
| **Weighted Average** | | **6.8** | **6.0** | **6.3** | **5.9** | **5.5** | **6.1/10** |

Notes:
- Design System agent scored sub-dimensions (Color: 5, Typography: 8, Spacing: 7, Component Styling: 6, Theme Coherence: 6) that roll up to the 6.4 Visual Consistency composite.
- Interaction/IA agent scored sub-dimensions (Navigation: 8, Loading: 7, Error Handling: 4, Empty States: 7, Keyboard: 5, Entity Discovery: 7) that roll up to the 6.5 Info Arch composite.
- Component Arch agent scored sub-dimensions (Boundaries: 6, State Mgmt: 7, Services: 8, Reusability: 7, Types: 8, File Org: 6) that roll up to the 7/10 overall and a 6 for Component Quality.

### Screenshot Directory

```
docs/ux-audit/screenshots/
  01-desktop-home.png
  02-mobile-home.png
  entity-management/
    01-app-desktop.png
    02-app-mobile.png
    03-app-desktop-tablet.png
  onboarding/
    01-welcome-screen.png
    02-template-selector.png
    03-campaign-form-top.png
    04-campaign-form-dm-style.png
    05-cross-campaign-dashboard.png
    05b-from-header-menu.png
    06-welcome-mobile.png
    09-cross-campaign-mobile.png
    10-first-campaign-wizard-step1.png
  session-gameplay/
    desktop.png
    mobile.png
    tablet.png
  shell-navigation/
    app-shell-desktop.png
    app-shell-tablet.png
    app-shell-mobile.png
  visualization-chat/
    02-world-graph.png
    03-plots-arcs.png
    04-session-timeline.png
    05-realmchat-open.png
    07-world-graph-with-fab.png
    08-graph-with-chat-open.png
    09-plots-full.png
    11-mobile-state.png
    12-mobile-chat.png
  wizards-dialogs/
    (desktop overview captured)
```
