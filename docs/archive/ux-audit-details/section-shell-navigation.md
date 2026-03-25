# Shell & Navigation — UX Audit Report

**Audited:** 2026-03-24
**Baseline:** Abstract UX standards (no UI-SPEC.md present)
**Screenshots:** Captured — desktop (1440x900), tablet (768x1024), mobile (375x812)

---

## Summary

The shell is coherent and functional for a power user who learns the layout. The sidebar's three-bucket structure (Campaign State / Storylines / World Planning) is logical and search-filtered inline navigation is a strong feature. However, the system is showing strain: `App.tsx` has grown to 1,162 lines with 27 `useState` calls and 15 `useMemo` calls making it hard to maintain; `CampaignSidebar.tsx` at 771 lines mixes presentation, interaction logic, and drag-and-drop into a single component; and the header becomes visually crowded on medium screens because seven action buttons are rendered at the same hierarchy level with no grouping. Several quality gaps — missing scene search in the Command Palette, a wrong icon on the World Graph nav item, `alert()` for feedback, and a `text-md` non-existent Tailwind class — lower the overall score.

---

## Scored Dimensions

- **Visual Consistency: 7/10** — Shell colour palette is coherent (slate-900/800 backgrounds, amber accents) but two different neutral scales (`slate-*` and `stone-*`) are mixed across components: the sidebar uses `slate-*` throughout while the Command Palette and CrossCampaignDashboard use `stone-*`. The header also contains `text-md`, a class that does not exist in Tailwind, so the campaign title renders at the browser default size rather than the intended medium size.
- **Interaction Quality: 7/10** — Navigation transitions are clean, touch targets meet 44px on mobile, the nav back-stack and breadcrumbs work together correctly. Friction points: five `alert()` dialogs replace proper in-app feedback; the sidebar filter hides entire buckets silently rather than showing a zero-state message; the desktop sidebar has no resize handle.
- **Information Architecture: 7/10** — Three named buckets in the sidebar give clear structural logic. Active-session banner, Pinned, and Recent sections contextualise navigation well. Gaps: scenes are not searchable from the Command Palette (only adventure titles are indexed); "World Graph" in the sidebar uses the Coach icon (`Icons.Coach`) instead of a graph icon; the distinction between "Session Timeline" and "Session Runner" is not obvious from nav labels alone.
- **Component Quality: 5/10** — `App.tsx` at 1,162 lines with 27 state variables, 15 memos, and 7 effects is the primary concern. `CampaignSidebar.tsx` at 771 lines handles state management, drag-and-drop, filtering, pinned entities, DM style exposure, and full article-tree rendering. Neither component is at a sustainable boundary. `ContentWrapper` (22 lines) is a good counter-example of proper scope.
- **Scalability: 6/10** — Adding a new entity type currently requires changes across `App.tsx` (4 new state variables, 1 new memo, new `handleSelect` branch, new breadcrumb case, new `renderMainContent` block), `CampaignSidebar.tsx` (new filter variable, new JSX section), and `CommandPalette.tsx` (new prop + new `push()` call). The system scales linearly with effort but lacks the data-driven abstraction that would make new entity types a single registration step. The sidebar has no fixed width on desktop and no resize/collapse capability, making it inflexible as content grows.

---

## Issues

### 1 — App.tsx is a god component approaching unsustainability
- **Severity:** High
- **Location:** `App.tsx:68–1162` (entire App function)
- **Description:** 27 `useState` calls, 15 `useMemo` calls, 7 `useEffect` calls, and 1,162 total lines in a single component. The component owns: all entity selection IDs (10 state variables), all modal open states (8 variables), nav stack, breadcrumb derivation, context construction for Session Weaver (80-line memo at line 370–484), keyboard shortcut handling, inline handlers for RealmChat additions and updates, smoke test invocation on mount, and the entire `renderMainContent()` conditional tree. Any new entity type or modal adds 4–6 more lines of state and 3–4 new branches in existing functions. The `currentContext` memo (App.tsx:370–484) duplicates context-building logic that also exists in `services/contextBuilder.ts`.
- **Suggested Fix:** Extract entity selection state and navigation logic into a `useNavigationState()` hook; extract modal open/close state into a `useModalState()` hook; move the `renderMainContent()` function into a `<MainContentRouter>` component that receives only the minimal props it needs. This reduces App.tsx to a composition root under ~300 lines.
- **Effort:** L

### 2 — CampaignSidebar.tsx has too many responsibilities at 771 lines
- **Severity:** High
- **Location:** `CampaignSidebar.tsx:1–771`
- **Description:** The component manages: drag-and-drop scene reordering, sidebar-level search/filter with debounce, article tree rendering (with a recursive sub-component), pinned entity display and unpin, recent items display, DM style panel toggle, session banner, and 14+ nav sections rendered with conditional logic. This makes understanding one section require scanning the whole file. The `ArticleTreeItem` recursive component (lines 43–93) is correct to be extracted but is defined at the top of the file rather than in its own module.
- **Suggested Fix:** Split into `SidebarSearch.tsx`, `SidebarRecentPinned.tsx`, `SidebarCampaignState.tsx`, `SidebarStorylines.tsx`, `SidebarWorldPlanning.tsx` and keep `CampaignSidebar.tsx` as the composition root that assembles them. Move `ArticleTreeItem` to its own file under `components/sidebar/` or `components/common/`.
- **Effort:** M

### 3 — Command Palette does not index scenes
- **Severity:** High
- **Location:** `CommandPalette.tsx:309–334` (entity push loop), `CommandPalette.tsx:46–73` (props interface)
- **Description:** The Command Palette indexes NPCs, locations, factions, items, adventures, articles, session logs, plots, and player characters but not individual scenes. Scenes are children of adventures and are the most granular navigable entity in the app — a DM searching for "Throne Room confrontation" by scene title gets zero results. The component's props interface does not include a `scenes` prop, so this is a structural gap, not just a display omission. Adventures themselves appear in search, but their scene children are invisible.
- **Suggested Fix:** Add a `scenes` prop of type `Array<{ id: string; title: string; adventureId: string; type: string }>` to `CommandPaletteProps`. Add a `scene` entry to `ENTITY_CONFIG` with an appropriate label and colour. In the entity push loop, add `push('scene', scenes)` where `getEntityName` returns `scene.title`. In `handleSelect`, add a `case 'scene'` that calls a new `onSelectScene(id)` callback — App.tsx already has the `handleSelect('scene', id)` branch that finds the parent adventure.
- **Effort:** S

### 4 — "World Graph" nav item uses the DM Coach icon
- **Severity:** Medium
- **Location:** `CampaignSidebar.tsx:556–561`
- **Description:** The World Graph nav item (line 558) passes `icon="Coach"` to `NavItem`. This renders the Session Weaver / Coach icon (a headset or similar) for a completely different feature — the entity relationship graph. Users scanning the sidebar by icon shape will miscategorise this item. The correct icon should be a graph, network, or hub type.
- **Suggested Fix:** Add a `Graph` or `Network` icon export to `components/common/Icons.tsx` (e.g., `Network` from lucide-react), then change line 558 to `icon="Network"`.
- **Effort:** S

### 5 — `text-md` is not a valid Tailwind class
- **Severity:** Medium
- **Location:** `Header.tsx:114`
- **Description:** `text-md` does not exist in Tailwind CSS. Tailwind's scale goes `text-sm` → `text-base` → `text-lg`. When Tailwind is loaded via CDN (as in this project, without JIT purging), the class will simply be ignored and the element will render at whatever the browser's inherited font size is. This means the campaign title in the header has no explicit size applied.
- **Suggested Fix:** Change `text-md` to `text-base` at `Header.tsx:114`.
- **Effort:** S

### 6 — Five `alert()` calls used for feedback
- **Severity:** Medium
- **Location:** `App.tsx:269, 272, 839, 1031, 1087`
- **Description:** `window.alert()` blocks the main thread, prevents keyboard shortcuts from working, and renders differently across browsers and OS. The five instances cover: successful campaign import (line 269), import failure (272), PC sheet import failure (839), adding scene without selecting adventure first (1031), and batch entity creation success (1087). The "please select an adventure first" case (line 1031) is especially jarring — the user has just clicked a sidebar "+" button and receives a blocking OS dialog instead of an inline message.
- **Suggested Fix:** Implement a lightweight toast/notification system (a `useToast()` hook with a fixed-position notification stack) and replace all five `alert()` calls with toast notifications. Alternatively, for the "select adventure first" case, simply disable or hide the scene "+" button when no adventure is selected, making the constraint self-evident.
- **Effort:** M

### 7 — Sidebar filter silently hides entire buckets with no zero-state
- **Severity:** Medium
- **Location:** `CampaignSidebar.tsx:288–291, 441–573`
- **Description:** When a user types a search term that matches nothing in a bucket, the entire bucket (e.g., "Campaign State" or "Storylines") disappears from the sidebar without explanation. The conditions `hasCampaignStateItems`, `hasStorylineItems`, and `hasWorldPlanningItems` (lines 289–291) simply unmount the sections. A user who mistyped "campagin" sees a completely empty sidebar and may not understand why.
- **Suggested Fix:** Instead of unmounting the section when `!hasCampaignStateItems`, render the section header with a muted "No results" inline message. This preserves structural context and confirms to the user that the filter is working rather than that something broke.
- **Effort:** S

### 8 — Desktop sidebar has no width on `md:relative` (relies on `w-72` from fixed positioning)
- **Severity:** Medium
- **Location:** `App.tsx:1001–1005`
- **Description:** The sidebar container has `fixed inset-y-0 left-0 w-72` for mobile, and on `md+` switches to `md:relative md:translate-x-0 md:h-auto md:inset-y-auto`. However, there is no explicit `md:w-72` or equivalent class. On desktop, the `w-72` class persists from the non-prefixed declaration, so the layout works — but it is fragile: if a responsive override for any breakpoint is added in the future, the width inheritance from the mobile rule may break. More importantly, the sidebar has no collapse/expand capability on desktop, and there is no resize handle, meaning it permanently consumes 288px regardless of content.
- **Suggested Fix:** Add `md:w-72` explicitly to the container class string for clarity and future safety. As a separate improvement, add a collapse toggle button at the sidebar's right edge so DMs working on large campaigns can reclaim horizontal space.
- **Effort:** S (explicit width), L (collapsible sidebar)

### 9 — Mock Mode toggle (`role="switch"`) has no accessible name
- **Severity:** Low
- **Location:** `Header.tsx:245–260`
- **Description:** The toggle button has `role="switch"` and `aria-checked` but no `aria-label`. The visible label "Mock Mode" appears in an adjacent `<span>` at `Header.tsx:242–244` but is not associated with the button element, so screen readers announce "switch, checked/unchecked" without indicating what the switch controls.
- **Suggested Fix:** Add `aria-label="Mock Mode"` to the button at line 245.
- **Effort:** S

### 10 — Breadcrumb row has `pb-0` creating zero bottom gap before main content
- **Severity:** Low
- **Location:** `Breadcrumbs.tsx:20`
- **Description:** The breadcrumb `<nav>` has `pt-4 pb-0`. The result is that the breadcrumb row sits immediately above the content area's top padding (`p-4 md:p-6 lg:p-8` in `ContentWrapper`). While ContentWrapper's own padding handles spacing for generators and editors, views that do not use ContentWrapper (e.g., NpcDashboard, SessionLogDashboard) have the breadcrumb abutting their content. Changing `pb-0` to `pb-2` or `pb-3` would provide consistent spacing.
- **Suggested Fix:** Change `pb-0` to `pb-2` at `Breadcrumbs.tsx:20`.
- **Effort:** S

### 11 — `slate-*` and `stone-*` neutral scales are mixed across shell components
- **Severity:** Low
- **Location:** `CampaignSidebar.tsx` (all slate), `CommandPalette.tsx` (all stone), `CrossCampaignDashboard.tsx` (all stone), `Header.tsx` (all slate), `ContentWrapper.tsx` (all slate), `Breadcrumbs.tsx` (all slate)
- **Description:** The sidebar, header, breadcrumbs, and content wrapper consistently use `slate-*` backgrounds (slate-900, slate-800) and text colours. The Command Palette and CrossCampaignDashboard use `stone-*` exclusively (stone-900, stone-800, stone-700). These two scales are perceptually similar at most steps, so the difference is subtle — but when the Command Palette renders as an overlay on the slate-background shell, the subtle warmth difference of stone vs. the blue-tint of slate is visible in bright environments. A consistent token decision (pick one) would close this gap.
- **Suggested Fix:** Standardise on `slate-*` throughout the shell. Update `CommandPalette.tsx` and `CrossCampaignDashboard.tsx` to replace `stone-900` → `slate-900`, `stone-800` → `slate-800`, etc. Alternatively, if stone is preferred for the content layer to create visual distinction from the chrome, document the intentional split.
- **Effort:** S

---

## Patterns & Themes

**State accumulation in App.tsx.** The pattern of adding one `useState` per selected entity ID and one per modal open state is the root cause of the component's size. Each new feature adds 2–4 state variables and 3–5 handler functions directly into the App function. This is the most urgent architectural issue for long-term maintainability.

**Sidebar as a second App.tsx.** CampaignSidebar has evolved by accretion. It now internally owns filter state, drag state, expand/collapse state, recent-item display logic, DM style panel visibility, and the full rendering tree for all entity groups. This is the same accumulation pattern as App.tsx. The two components together represent the bulk of the maintenance surface.

**Command Palette is excellent but incomplete.** The implementation quality is high — keyboard navigation, grouped results, recent items, action shortcuts, empty state, ESC handling, focus management on open — all done correctly. The only structural gap is scenes. Filling that one gap makes the Command Palette a complete navigation solution.

**Mobile navigation is correct in structure, incomplete in discoverability.** The hamburger button on mobile exists in the header, touch targets are 44px, and the sidebar overlay is implemented. The search (Ctrl+K) button is `hidden sm:flex` — invisible on mobile. A DM using the app on a tablet in portrait mode has no discoverable path to the Command Palette. Adding the search button to the mobile header (possibly as just an icon button with no label text) would close this gap.

**Icon semantics matter in a dense sidebar.** With 14+ nav entries, icons are the fastest scanning aid. The Coach icon on "World Graph" is the one clear case where the icon contradicts the label. All other nav items appear to use semantically appropriate icons.

---

## Screenshots

- Desktop (1440×900): `docs/ux-audit/screenshots/shell-navigation/app-shell-desktop.png`
- Tablet (768×1024): `docs/ux-audit/screenshots/shell-navigation/app-shell-tablet.png`
- Mobile (375×812): `docs/ux-audit/screenshots/shell-navigation/app-shell-mobile.png`

Screenshots show the app loaded with an active campaign ("Winter's Daughter") at the Campaign Setting view. The sidebar is visible on desktop and tablet at `md:relative` positioning. The header shows the full tool row (Continuity, Evocation Wizard, World Sim, Session Weaver, keyboard shortcut help, Mock Mode toggle) compressed but readable on desktop. On mobile, the sidebar is hidden behind the hamburger and the header shows only the campaign title dropdown and tool icons.

---

## Files Audited

- `/home/djiv/WebstormProjects/Realmweaver/App.tsx` (1,162 lines)
- `/home/djiv/WebstormProjects/Realmweaver/components/layout/Header.tsx` (272 lines)
- `/home/djiv/WebstormProjects/Realmweaver/components/layout/CampaignSidebar.tsx` (771 lines)
- `/home/djiv/WebstormProjects/Realmweaver/components/layout/ContentWrapper.tsx` (22 lines)
- `/home/djiv/WebstormProjects/Realmweaver/components/common/CommandPalette.tsx` (563 lines)
- `/home/djiv/WebstormProjects/Realmweaver/components/common/Breadcrumbs.tsx` (56 lines)
- `/home/djiv/WebstormProjects/Realmweaver/components/views/CrossCampaignDashboard.tsx` (270 lines)
