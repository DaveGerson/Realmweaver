# Design System & Visual Consistency — Cross-Cutting Audit

**Audited:** 2026-03-24
**Auditor:** GSD UI Auditor (cross-cutting design system lens)
**Screenshots:** Captured — `docs/ux-audit/screenshots/`
**Scope:** All 90 .tsx component files across `components/`, `App.tsx`

---

## Summary

Realmweaver has a clear, intentional dark-fantasy theme (slate/stone grays + amber accents, Merriweather/Roboto font pairing) that is largely coherent across the app. However, the design system is not fully systematized: it operates from convention rather than enforced tokens. Three specific fault lines undermine consistency. First, **indigo bleeds into UI as an unofficial second accent**, competing directly with amber across interactive elements, focus rings, and tool-launcher buttons. Second, there is a **slate vs. stone split** — the majority of the app uses `slate-*` surfaces while a newer cohort of components (FirstCampaignWizard, CrossCampaignDashboard, and related cards) was built with `stone-*` tones, creating a visible surface-color schism. Third, a **legacy component layer** at `components/*.tsx` (root level) exists in parallel with the refactored `components/editors/`, `components/views/`, and `components/layout/` directories; these orphaned files carry older indigo-ring patterns and are still present on disk even though `App.tsx` no longer imports them.

---

## Overall Score: 6.4/10

### Sub-Scores

| Sub-dimension | Score | Justification |
|---|---|---|
| Color Consistency | 5/10 | Indigo accent competes with amber; slate/stone surface split; ad-hoc semantic colors (blue/green/purple/red per entity type) |
| Typography Consistency | 8/10 | Merriweather/Roboto pairing applied reliably; label conventions (`text-xs uppercase tracking-wider`) are consistent; occasional missing `font-serif` on h2-level headings |
| Spacing Consistency | 7/10 | Tailwind scale used throughout (no arbitrary px values); card padding oscillates between `p-4` and `p-6`/`p-8` without clear rule |
| Component Styling Uniformity | 6/10 | `<Button>` and `<AiTextarea>` are well-adopted; 295 raw `<button>` elements vs. 125 `<Button>` usages; 48 raw `<textarea>` vs. 53 `<AiTextarea>` — not dominant |
| Theme Coherence | 6/10 | Dark fantasy aesthetic is present everywhere; stone/slate split and indigo secondary make certain panels feel like a different product skin |

---

## Issues

### Issue 1 — Indigo Competes With Amber as a Second Accent

- **Severity:** High
- **Location:** `components/layout/Header.tsx` (lines 167, 191, 206, 223, 233, 247), `components/common/Textarea.tsx` (line 40), `components/generators/NpcGenerator.tsx` (line 108), `components/dialogs/DmCoach.tsx` (multiple), `components/RealmChat/RealmChatWidget.tsx` (multiple), plus 47 other files with `text-indigo-|bg-indigo-|ring-indigo-` (199 total occurrences across 47 files)
- **Description:** Indigo was used for the Mock Mode toggle, the Evocation Wizard launcher, Session Weaver launcher, Continuity Checker launcher, the AI "Generate" button in `AiTextarea`, focus rings in legacy editors, and the saving spinner. This makes indigo feel like a secondary brand color, but it is defined nowhere in the design system. Amber is the declared accent (60/30/10 primary → `bg-amber-600` Button primary, amber tabs, amber icons). Having two competing accents dilutes both and makes the interactive layer unpredictable.
- **Suggested Fix:** Audit all indigo usages and migrate interactive controls to the amber scale. Use `amber-500/amber-600` for the AI "Generate" affordance in `AiTextarea` (already the dominant CTA color). Use `slate-500/slate-400` for utility controls (Mock Mode toggle, keyboard shortcut button). Reserve distinct colors only for true semantic meaning: `red` for destructive, `green` for success/live, and `amber` for all primary actions. The indigo spinner in the header save indicator (`border-indigo-500`) should become `border-amber-500`.
- **Effort:** M

---

### Issue 2 — Slate vs. Stone Surface Split

- **Severity:** High
- **Location:** `components/views/FirstCampaignWizard.tsx` (57 stone-* occurrences), `components/views/CrossCampaignDashboard.tsx` (15 stone-* occurrences), `components/common/EntityQuickCard.tsx` (19 stone-* occurrences), `components/common/BacklinksPanel.tsx` (14 stone-*), `components/common/CommandPalette.tsx` (19 stone-*), `components/common/KeyboardShortcutsHelp.tsx` (8 stone-*), `components/common/SceneResourcesPanel.tsx` (17 stone-*), `components/visualizers/PlotTimeline.tsx` (14 stone-*)
  vs. the rest of the app: 615 occurrences of `bg-slate-|bg-stone-` in slate-dominant components.
- **Description:** Tailwind's `slate` and `stone` color families are related but visually distinct — slate is cooler/bluer-gray while stone is warmer/browner-gray. The app clearly started with slate as the base surface color (`bg-slate-900`, `bg-slate-800`, `bg-slate-950`) but a newer cohort of ~17 components was built with stone (`bg-stone-800`, `bg-stone-700`, `bg-stone-900`). When these appear together — e.g., the CrossCampaignDashboard's stone cards sitting inside a slate shell — the warm/cool contrast is visible in screenshots even at thumbnail size.
- **Suggested Fix:** Establish a single surface family. Stone is actually more appropriate for the dark-fantasy parchment aesthetic (warmer, earthier). Either: (a) migrate the slate-dominant majority to stone, which requires a global find-replace across ~71 files; or (b) keep slate as the base and migrate the newer 17 files back to slate. Option (b) is lower effort since it only touches 17 files. Use the note in `index.html` (`bg-slate-950` body) as the canonical root and work down from there.
- **Effort:** M (Option b) / L (Option a)

---

### Issue 3 — Legacy Root-Level Component Files

- **Severity:** High
- **Location:** `components/NpcEditor.tsx`, `components/LocationEditor.tsx`, `components/FactionEditor.tsx`, `components/ArticleEditor.tsx`, `components/ItemEditor.tsx`, `components/AdventureEditor.tsx`, `components/SceneEditor.tsx`, `components/SessionLogEditor.tsx`, `components/PlayerCharacterEditor.tsx`, `components/CampaignSidebar.tsx`, `components/Header.tsx`, `components/WelcomeScreen.tsx`, `components/CampaignSelector.tsx`, `components/CampaignCreator.tsx`, `components/DmCoach.tsx`, `components/PrepDocumentView.tsx`, `components/ExportModal.tsx`, `components/Icons.tsx`, `components/AdventureCreator.tsx`, `components/EncounterEditor.tsx` (20 root-level files)
- **Description:** `App.tsx` imports exclusively from `components/editors/`, `components/views/`, `components/layout/`, `components/dialogs/`, `components/generators/`, `components/dashboards/`, etc. — the well-organized subdirectory tree. However, the root `components/` directory still contains 20 older files that are not imported by the current app. These legacy files carry older design patterns: `focus:ring-indigo` for inputs (e.g., `components/ArticleEditor.tsx` lines 106, 115, 142; `components/FactionEditor.tsx` line 85; `components/SessionLogEditor.tsx` lines 68, 78), `bg-slate-950` with `focus:ring-indigo` on textareas, and slightly different card structures. While not rendered in the live app, their presence adds confusion for contributors and may be accidentally re-integrated in future work.
- **Suggested Fix:** Delete all 20 root-level legacy component files. Confirm with `grep -r "from.*components/NpcEditor"` etc. that none are imported outside `App.tsx`. If any are referenced by smoke tests, update the test imports to point to the correct subdirectory path.
- **Effort:** S

---

### Issue 4 — Focus Ring Inconsistency (Indigo vs. Amber vs. None)

- **Severity:** Medium
- **Location:** 80 occurrences of `focus:ring-indigo` / `focus:border-indigo` across 26 files; 96 occurrences of `focus:ring-amber` / `focus:border-amber` across 26 files; `components/common/Textarea.tsx` line 26 (`focus:ring-amber-500`); multiple raw `<button>` elements with `focus:outline-none` and no ring replacement
- **Description:** The global CSS defines `.focus-amber` (double-ring glow: `2px #78350f` + `4px amber-500/25%`). `Button.tsx` uses `focus:ring-2 focus:ring-offset-2 focus:ring-amber-500` for primary. But across the codebase, inputs and buttons split between amber rings, indigo rings (`focus:ring-indigo-500/50`), and no visible ring at all (`focus:outline-none` with no replacement). This creates inconsistent keyboard-navigation affordances — an accessibility concern as well as a design inconsistency.
- **Suggested Fix:** Standardize all interactive form elements to use `focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none`. Apply the `.focus-amber` class to all `<input>` and `<select>` elements via a shared utility or by updating the few remaining indigo-ring inputs in the `components/editors/` tree. Create a shared `inputBaseClasses` constant similar to what `AiTextarea` already does, and use it consistently in editors.
- **Effort:** M

---

### Issue 5 — Raw `<button>` vs. `<Button>` Component Inconsistency

- **Severity:** Medium
- **Location:** 295 raw `<button>` occurrences across 59 files vs. 125 `<Button>` component usages across 53 files; prominent raw buttons in `components/layout/CampaignSidebar.tsx` (30), `components/views/SessionRunner.tsx` (35), `components/layout/Header.tsx` (15), `components/RealmChat/RealmChatWidget.tsx` (11), `components/tools/SecretsTracker.tsx` (11)
- **Description:** The `Button` component provides consistent sizing, focus rings, variant styling, disabled state handling, and `twMerge` composition. However, raw `<button>` elements account for 70% of all button-rendering in the codebase. Many of these are intentional (icon-only toolbar buttons, tab-style navigations, toggle switches) but many are not — they are regular action buttons with ad-hoc styling that varies per file. For example, in `SessionRunner.tsx`, context-action buttons have one-off className strings mixing `text-sm text-slate-300 hover:text-white` without the disabled state handling that `Button` provides.
- **Suggested Fix:** Audit all raw `<button>` elements and classify them: (a) icon-only/toolbar — acceptable as raw with aria-label, (b) action buttons with text — migrate to `<Button variant="ghost" size="sm">`, (c) toggle/switch controls — keep raw with documented pattern. Create a `variant="icon"` on the `Button` component for the toolbar pattern: `p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700`. This eliminates the most common raw button pattern.
- **Effort:** M

---

### Issue 6 — Raw `<textarea>` Used Alongside `<AiTextarea>`

- **Severity:** Medium
- **Location:** 48 raw `<textarea>` occurrences across 28 files, including `components/generators/NpcGenerator.tsx` (line 103), `components/views/SessionRunner.tsx`, `components/views/FirstCampaignWizard.tsx` (4 instances), `components/editors/SessionLogEditor.tsx` (2 instances), `components/editors/LocationEditor.tsx` (3 instances)
- **Description:** `AiTextarea` provides a consistent label row, AI-generate button slot, and unified focus/border styling. But 28 files bypass it in favour of raw `<textarea>` elements, each with hand-written className strings that diverge: some use `focus:ring-indigo-500/50`, others `focus:ring-amber-500`, some have `placeholder:text-slate-600`, some `placeholder:text-slate-500`. The base style in `AiTextarea` reads `bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-200`; raw textareas in `NpcGenerator.tsx` use `bg-slate-950 border border-slate-700` — a different background level.
- **Suggested Fix:** For all textareas that do not need the AI-generate button, extract the base class string from `AiTextarea` into an exported constant `textareaBaseClasses` and import it in each file. For prompts that benefit from the generate button, switch to `<AiTextarea>`. This eliminates the divergent className sprawl while preserving flexibility.
- **Effort:** S

---

### Issue 7 — Semantic Color Overload in Entity Badges

- **Severity:** Medium
- **Location:** `components/views/CrossCampaignDashboard.tsx` (lines 118-135): NPCs = `bg-blue-900/50 text-blue-300`, Locations = `bg-green-900/50 text-green-300`, Factions = `bg-red-900/50 text-red-300`, Adventures = `bg-purple-900/50 text-purple-300`; `components/common/EntityQuickCard.tsx` uses cyan/purple/violet/sky as entity-type badges; `components/visualizers/PlotTimeline.tsx` uses 6 rotating colors (amber, emerald, violet, sky, rose, cyan)
- **Description:** The app assigns a unique color to each entity type across multiple components, but these color assignments are not centralized or consistent. In `CrossCampaignDashboard`, NPCs are blue; in `CampaignSidebar`, NPCs are labeled with an `Icons.NPCs` icon in amber; in `CommandPalette`, entity types receive stone badges without color differentiation. The entity-type-color mapping is defined ad hoc in each component. When a user navigates between views they encounter different semantic color assignments for the same entity type.
- **Suggested Fix:** Create a centralized `entityTypeConfig` map (already partially exists in `IconUtils` for icons) that defines per-entity-type: icon, color class string, label. Export this from `utils/entityUtils.ts` and consume it in `CrossCampaignDashboard`, `EntityQuickCard`, `CommandPalette`, `CampaignSidebar`, and any other file that renders entity-type labels. This guarantees consistent color-to-entity mapping across all views.
- **Effort:** M

---

### Issue 8 — Card Padding Inconsistency

- **Severity:** Low
- **Location:** `components/editors/NpcEditor.tsx` (line 114): `p-6 md:p-8`; `components/generators/NpcGenerator.tsx` (line 88): `p-6`; `components/views/FirstCampaignWizard.tsx` cards: `p-4`; `components/views/CrossCampaignDashboard.tsx` cards: `p-4 pb-3`; `components/dialogs/DmCoach.tsx`: `p-4`; `components/dashboards/NpcDashboard.tsx`: `p-6 md:p-8`
- **Description:** Container padding has no consistent rule. Editors use `p-6 md:p-8`, dialog panels use `p-4`, wizard cards use `p-4`, and full-panel views use `p-6 md:p-8`. While this partially follows a logical size hierarchy (large content area = more padding, compact cards = less), it's not documented and differs between visually equivalent components — e.g., a dashboard panel and an editor panel often use the same layout structure but different padding values.
- **Suggested Fix:** Establish a two-tier rule: (1) full-page content panels → `p-6 md:p-8`; (2) embedded cards/dialog sections → `p-4`. Document this in `CLAUDE.md` under "Styling Conventions." Apply consistently to any new components.
- **Effort:** S

---

### Issue 9 — `AiTextarea` AI Generate Button Uses Indigo

- **Severity:** Low
- **Location:** `components/common/Textarea.tsx` line 40: `text-indigo-400 hover:text-indigo-300`
- **Description:** The AI-generate affordance inside the shared `AiTextarea` component uses indigo, making every field with an AI button a place where indigo appears — which is the most common shared primitive. Since `AiTextarea` is consumed in nearly all editors, this is the single highest-leverage location to fix the indigo leak.
- **Suggested Fix:** Change `text-indigo-400 hover:text-indigo-300` to `text-amber-400 hover:text-amber-300` in `AiTextarea`. The AI sparkle button is an AI affordance, and the app consistently uses amber for AI/magic-themed elements (session loading text "Weaving into existence...", the quill animation, the amber sparkle icon in dashboards).
- **Effort:** S (single file, single line change)

---

### Issue 10 — Body Background Color Mismatch (index.html vs. App)

- **Severity:** Low
- **Location:** `index.html` line 131: `<body class="bg-slate-950">` — but `App.tsx` renders its own root container that sets `bg-slate-900` (from `ContentWrapper.tsx` and header). The `bg-slate-950` body is only visible during load or in uncovered areas.
- **Description:** Minor but the body class and the app root class should match to prevent any flash or edge-case gap coloring. Also, the body class uses `bg-slate-950` while the page content primarily uses `bg-slate-900` — a one-stop level difference that is visible if the sidebar doesn't fill full height.
- **Suggested Fix:** Confirm the App root wrapper uses `bg-slate-950` as its outermost class, or change the body class to `bg-slate-900` to match the most common surface level.
- **Effort:** S

---

## Patterns & Anti-Patterns

### What's Working Well

**Merriweather/Roboto font pairing is well-disciplined.** The `h1, h2, h3, h4, .font-serif` CSS rule in `index.html` ensures that heading tags automatically receive Merriweather. The `font-serif` class is available as an escape hatch and is used consistently in headings across all components audited. Body text uniformly uses Roboto (the browser default via `body { font-family: 'Roboto' }`).

**Label styling is consistent.** The pattern `text-xs font-medium text-slate-400 uppercase tracking-wider` for form field labels appears consistently across `AiTextarea`, editor components, and generator forms. This is a genuinely systematized micro-convention that creates visual coherence in dense form UIs.

**`<Button>` component is well-designed.** The four-variant system (primary, secondary, ghost, danger) with three sizes covers the majority of interactive patterns. `twMerge` integration and `disabled:opacity-50 disabled:pointer-events-none` base behavior are good. The component is imported in 53 files, indicating reasonable adoption.

**Custom scrollbar is global.** The webkit scrollbar rules in `index.html` apply globally, meaning all scrollable areas look themed without any per-component boilerplate. This is the right approach.

**Loading state animation is thematic.** The `animate-quill` CSS animation and "Weaving into existence..." copy in `SkeletonGeneratorOverlay.tsx` perfectly match the fantasy theme. This is a high point.

**`card-parchment` CSS class is available** in `index.html` but under-used — it was audited in only one file. If more cards adopted it, it would reinforce the dark-fantasy aesthetic.

**TabLayout accessibility is correct.** `TabLayout.tsx` uses proper ARIA attributes (`role="tab"`, `aria-selected`, `aria-controls`). Active tab uses amber underline (`border-amber-500 text-amber-400`), which is consistent with the amber accent.

### Anti-Patterns

**Two-token color system where one token was intended.** Amber = primary accent, indigo = utility/AI. This was apparently an organic drift as the AI tools (DmCoach, RealmChat, Evocation Wizard) got indigo to visually separate them from "campaign" tools. The intent is understandable but the result is two competing accent families with no documentation of which controls are which.

**Per-file className strings instead of shared constants.** Input field styling is re-declared in every editor file instead of being exported from `Textarea.tsx` or a `styles.ts` utility. Any padding or color correction requires touching 20+ files.

**Parallel legacy file tree.** The 20 root-level `components/*.tsx` files are a maintenance trap. They will inevitably get edited by a contributor who finds them by searching the repo for a component name, unaware that the active version lives in a subdirectory.

**Entity-type color assignments are local state.** No canonical entity-type color map exists. The same entity type gets different colors in different views depending on which developer last touched that component.

---

## Design System Maturity Assessment

**Current state: Ad-hoc with emerging conventions (Level 2 of 5)**

Level 1 — No system (every component styled independently): NOT here. There is clear intentionality.

Level 2 — Conventions without enforcement: This is where the app sits. A clear aesthetic intent (dark fantasy, amber accent, Merriweather headings) is communicated through code patterns and `CLAUDE.md`, but:
- No token layer (`theme.colors.primary` would prevent the indigo drift)
- No enforced base classes (inputs are restyled per-file)
- No component audit gate (the legacy file tree exists undetected)
- No centralized entity-type metadata

Level 3 — Shared primitives (next achievable step): Would require:
1. Exporting `inputBaseClasses`, `textareaBaseClasses`, `labelBaseClasses` from `Textarea.tsx`
2. Resolving amber vs. indigo as the AI accent
3. Establishing slate vs. stone surface canon
4. Deleting the legacy root-level component files

Level 4 — Design token layer: CSS custom properties for `--color-surface`, `--color-accent`, etc., feeding into Tailwind config (requires moving from CDN to npm Tailwind).

Level 5 — Fully governed system with visual regression testing: Out of scope for this app's architecture.

The gap from Level 2 to Level 3 is achievable within a single sprint without architectural change. The most impactful single action is fixing `AiTextarea`'s indigo button (Issue 9 — S effort, maximum leverage because it touches every AI-assisted field in the app).

---

## Screenshots

Screenshots captured to `docs/ux-audit/screenshots/`:

- `01-desktop-home.png` — 1440x900 desktop view of active campaign (Campaign Setting editor visible)
- `02-mobile-home.png` — 375x812 mobile view of same state

The desktop screenshot confirms the slate-dominant shell (header `bg-slate-900`, sidebar dark), the amber accent on the active nav item, and the `border-indigo-500` spinner area in the save indicator row. The amber/indigo competition is visible in the top toolbar where World Sim (amber icon) and Session Weaver/Evocation Wizard (indigo icons) sit side by side.

The mobile screenshot shows that the sidebar collapses cleanly and the Campaign Setting panel is legible at 375px width. No critical layout breakage observed at mobile breakpoint.

---

## Files Audited

**Config / Theme**
- `/home/djiv/WebstormProjects/Realmweaver/index.html` (lines 14–134) — theme definitions, font loading, body class
- `/home/djiv/WebstormProjects/Realmweaver/App.tsx` (lines 1–60) — import tree, root structure

**Shared Components**
- `components/common/Button.tsx`
- `components/common/Textarea.tsx`
- `components/common/Icons.tsx`
- `components/common/TabLayout.tsx`
- `components/common/SkeletonCard.tsx`
- `components/common/CommandPalette.tsx` (lines 1–60)

**Layout**
- `components/layout/Header.tsx` (full)
- `components/layout/CampaignSidebar.tsx` (sampled via grep)

**Views**
- `components/views/WelcomeScreen.tsx` (full)
- `components/views/CampaignCreator.tsx` (lines 1–60)
- `components/views/CrossCampaignDashboard.tsx` (lines 1–180)
- `components/views/FirstCampaignWizard.tsx` (lines 1–180)
- `components/views/SessionRunner.tsx` (lines 1–65)

**Editors**
- `components/editors/NpcEditor.tsx` (lines 1–160)
- `components/editors/SessionLogEditor.tsx` (lines 1–80)

**Generators**
- `components/generators/NpcGenerator.tsx` (full)

**Dashboards**
- `components/dashboards/NpcDashboard.tsx` (lines 1–80)

**Dialogs**
- `components/dialogs/DmCoach.tsx` (lines 1–80)
- `components/dialogs/EvocationWizard.tsx` (lines 1–80)
- `components/dialogs/SessionPrepWizard.tsx` (lines 1–60)

**Tools & Visualizers**
- `components/tools/CombatTracker.tsx` (lines 1–60)
- `components/visualizers/PlotTimeline.tsx` (lines 1–60)

**Chat**
- `components/RealmChat/RealmChatWidget.tsx` (lines 1–80)

**Grep pattern analysis across all 90 .tsx files:**
- `bg-slate-*` / `bg-stone-*` distribution
- `text-indigo-` / `bg-indigo-` / `ring-indigo-` distribution (199 occurrences / 47 files)
- `text-amber-` / `bg-amber-` / `ring-amber-` distribution (351 occurrences / 50 files)
- `text-stone-` / `bg-stone-` / `border-stone-` distribution (208 occurrences / 17 files)
- Raw `<button>` vs. `<Button>` component usage (295 vs. 125)
- Raw `<textarea>` vs. `<AiTextarea>` usage (48 vs. 53)
- `focus:ring-indigo` vs. `focus:ring-amber` (80 vs. 96)
- `rounded-xl` distribution (76 files)
- Font size classes (`text-xs` through `text-4xl`) — 1009 occurrences across 86 files
- Font weight classes — 466 occurrences across 82 files
- `font-serif` usage — 130 occurrences across 69 files
- Hardcoded hex colors — 38 occurrences, concentrated in `PlotTimeline.tsx` (18) and `RelationshipGraph.tsx` (18) — both justified as SVG/D3 canvas contexts where CSS classes cannot be used
