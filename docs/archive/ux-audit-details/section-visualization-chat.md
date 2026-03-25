# Visualization & Chat — UX Audit Report

**Audited:** 2026-03-24
**Scope:** RelationshipGraph, PlotTimeline, RealmChatWidget
**Screenshots:** Captured (dev server running at localhost:3000 with live campaign data — "Winter's Daughter")

---

## Summary

The Visualization & Chat section is architecturally solid and notably ambitious: a live D3 force graph, a cross-session plot-tracking matrix, and a floating AI assistant with full draft-editing workflows all work as implemented. However, the chat widget has a critical mobile layout failure (it overflows the viewport on small screens), the relationship graph lacks a "reset view" control which makes it easy to get lost after heavy zooming, and the PlotTimeline's tiny (40px row / 120px column) grid becomes unreadable as the campaign grows. These are solvable problems on top of a genuinely well-executed foundation.

---

## Scored Dimensions

- **Visual Consistency: 8/10** — All three components faithfully use the dark stone/slate palette with amber accents. The graph's slate-950 canvas with colored node types reads as intentionally designed. The chat widget's indigo accent is the only departure from the app-wide amber accent system, which is a deliberate product decision (distinguishing the "AI assistant" voice from primary content) but creates a mild inconsistency at the color-system level.
- **Interaction Quality: 6/10** — The graph supports zoom, pan, and drag-to-reposition nodes, and clicking a node navigates to that entity — all excellent. Missing: a "fit to screen" or "reset zoom" button, node hover highlight to trace connected edges, and any keyboard navigation. The chat's send button uses `Icons.Combat` (a crossed-swords icon) rotated 90°, which is semantically wrong and confusing. PlotTimeline interactions (click plot label, click session header) work, but the tooltip position calculation (`rect.top - 8`) uses `fixed` positioning against viewport coordinates, which breaks when the Plots view is inside a scrolled content panel.
- **Information Architecture: 7/10** — The graph filter panel (top-left) is well-placed and immediately visible. The PlotTimeline's matrix layout (rows = plots, columns = sessions) is the correct mental model and is easy to read for small datasets. However, the PlotTimeline is buried in the "Plots & Arcs" view with the Active Arcs cards above it; a first-time user scanning the page may not scroll down to find it. The session count visible in the screenshot header shows "0 / 1 sessions" which is accurate but terse — a small explanatory label would help discoverability.
- **Component Quality: 8/10** — D3 lifecycle is managed correctly: the simulation is torn down on cleanup (line 291: `return () => simulation.stop()`), mutable copies are made before passing to D3 (lines 174-175), and the `useMemo` for graph data is correctly keyed on `[campaign, filters]`. The `@ts-ignore` comments in RealmChatWidget (lines 295, 368) are minor technical debt but not blocking. One real concern: `RelationshipGraph` has no `ResizeObserver` — the graph dimensions are read once at mount from `containerRef.current.clientWidth/Height`; if the container resizes (sidebar collapse, window resize), the SVG viewBox becomes stale.
- **Scalability: 6/10** — The graph force simulation uses `d3.forceManyBody().strength(-300)` with `d3.forceCollide(30)`. With the current demo dataset (~15 nodes) this runs smoothly. At 50+ nodes the simulation will churn noticeably; at 100+ it will likely become unusable without alpha decay tuning or a separate "cluster by type" layout mode. PlotTimeline uses a fixed 120px column width with no virtualization — 30+ sessions will produce a wide scroll container that still renders all cells. RealmChat's `history` array grows unbounded in memory; there is no session persistence, truncation limit, or "start new conversation" affordance.

**Overall composite: 35/50**

---

## Issues

### Issue 1: Mobile Chat Widget Overflows Viewport
- **Severity:** Critical
- **Location:** `components/RealmChat/RealmChatWidget.tsx:213`
- **Description:** The chat window is fixed at `w-[450px] h-[700px]`, positioned `bottom-6 right-6`. On a 375px-wide mobile viewport, the 450px width causes the widget to overflow the left edge — the header is clipped, the input placeholder is partially hidden, and the "Send" button is pushed partially off-screen (confirmed in screenshot `12-mobile-chat.png`). The `h-[700px]` also exceeds the 812px iPhone viewport height, consuming nearly the entire screen and leaving no room to see the page behind.
- **Suggested Fix:** Add responsive width classes: `w-[calc(100vw-1.5rem)] sm:w-[450px]` and `max-h-[calc(100vh-3rem)] sm:h-[700px]`. Apply `right-3 bottom-3 sm:right-6 sm:bottom-6` for smaller margin on mobile. Also cap height with `max-h-[90svh]` to handle short viewport heights.
- **Effort:** S

### Issue 2: No "Fit to Screen" / "Reset View" Control on Relationship Graph
- **Severity:** High
- **Location:** `components/visualizers/RelationshipGraph.tsx:165-171`
- **Description:** The D3 zoom is initialized with `scaleExtent([0.1, 4])` but there is no button to reset the zoom transform or fit all nodes into view. After zooming in or panning away from the cluster center, a user has no reliable way to get back to the full graph view other than manually scrolling. This is especially pronounced after clicking a node (which calls `onNodeSelect` and routes to an editor), then returning to the graph — the zoom state is reset to identity because `initializeGraph` fully re-runs, but the simulation starts from random positions each time, which can disorient users.
- **Suggested Fix:** Add a "Reset View" button to the top-right of the SVG container. Expose the `zoom` object via a `useRef`, and on button click call `svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity)`. Consider also adding a "Fit" action that calls `zoom.translateExtent` to frame all nodes.
- **Effort:** S

### Issue 3: Send Button Uses Semantically Wrong Icon
- **Severity:** High
- **Location:** `components/RealmChat/RealmChatWidget.tsx:358`
- **Description:** The send button renders `<Icons.Combat className="w-4 h-4 rotate-90" />`. `Icons.Combat` maps to the `Swords` lucide icon — a crossed-swords combat symbol. Rotated 90°, this becomes a vaguely upward-pointing shape, but it does not resemble a "send" affordance. The app already has `Icons.Send` defined in `Icons.tsx` (line 164, mapping to `SendHorizonal`). Using the wrong icon introduces cognitive friction and makes the chat widget look unpolished.
- **Suggested Fix:** Replace `Icons.Combat className="w-4 h-4 rotate-90"` with `Icons.Send className="w-4 h-4"`. No other changes needed.
- **Effort:** S (one-line change)

### Issue 4: Relationship Graph Has No ResizeObserver — Stale Dimensions After Resize
- **Severity:** High
- **Location:** `components/visualizers/RelationshipGraph.tsx:151-152`
- **Description:** Container width and height are read once at initialization: `containerRef.current.clientWidth` / `clientHeight`. If the browser window is resized, the sidebar is collapsed, or any container layout changes after initial render, the SVG `viewBox` remains set to the old dimensions. The D3 force center (`forceCenter(width/2, height/2)`) also uses the stale values, causing nodes to cluster toward the wrong center point.
- **Suggested Fix:** Add a `ResizeObserver` in a `useEffect` that calls `initializeGraph()` when container dimensions change, debounced by ~200ms to avoid thrashing. Alternatively, use a CSS approach: set the SVG to `width: 100%; height: 100%` and use a `viewBox` that tracks the actual bounding box of all nodes after simulation settles.
- **Effort:** M

### Issue 5: PlotTimeline Tooltip Uses Stale Viewport Coordinates Inside Scrolled Panel
- **Severity:** Medium
- **Location:** `components/visualizers/PlotTimeline.tsx:190-191`
- **Description:** `showTooltip` calculates position as `rect.left + rect.width / 2` and `rect.top - 8`, then renders the tooltip with `position: fixed`. `getBoundingClientRect()` returns coordinates relative to the viewport, which is correct for fixed positioning. However, the Plots view (`09-plots-full.png`) renders the PlotTimeline inside a scrollable content wrapper. If the user has scrolled the content panel (not the window) before hovering, `rect.top` reflects the on-screen position correctly — but if the outer page container also scrolls, tooltip positions may drift. More critically, the `tooltip.y` of `rect.top - 8` places the tooltip above the element, which clips when the element is near the top of the viewport.
- **Suggested Fix:** Add a bounds check: if `rect.top - 8 < 12`, flip the tooltip to render below the element (`transform: translate(-50%, 0)` with `top: rect.bottom + 8`). Also ensure the tooltip `z-index` (currently `z-50`) exceeds any potential stacking context from parent containers.
- **Effort:** S

### Issue 6: Graph Simulation Restarts From Scratch on Every Filter Toggle
- **Severity:** Medium
- **Location:** `components/visualizers/RelationshipGraph.tsx:295-300`
- **Description:** The `useEffect` re-runs `initializeGraph()` whenever `nodes` or `links` change. Since `nodes`/`links` are derived from `filters` (via `useMemo`), toggling any filter (e.g., hiding "Scenes") triggers a full graph teardown and re-initialization with new random starting positions. This means every filter toggle produces a jarring visual "explosion" as the simulation starts from zero. Nodes that were carefully dragged to custom positions lose their positions.
- **Suggested Fix:** Instead of full reinit on filter change, keep the simulation running and dynamically add/remove nodes and links using D3's update pattern (`simulation.nodes(newNodes); simulation.force("link").links(newLinks); simulation.alpha(0.3).restart()`). This preserves the existing node layout and only animates the delta.
- **Effort:** M

### Issue 7: `animate-in` / `slide-in-from-bottom-10` Classes Are Undefined
- **Severity:** Medium
- **Location:** `components/RealmChat/RealmChatWidget.tsx:214`
- **Description:** The chat window opening animation uses `animate-in slide-in-from-bottom-10`, which are utility classes from the `tailwindcss-animate` plugin. The project uses Tailwind via CDN (plain `tailwindcss` CDN, not a PostCSS build), and the CDN bundle does not include `tailwindcss-animate`. The `index.html` defines `animate-fade-in` manually (line 70-75) but does not define `animate-in` or `slide-in-from-bottom-10`. As a result, the opening animation silently does nothing — the chat window just appears without transition.
- **Suggested Fix:** Either add the missing keyframes to `index.html` (e.g., `@keyframes slide-in-from-bottom { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`) and a corresponding `.animate-in.slide-in-from-bottom-10 { animation: slide-in-from-bottom 0.2s ease-out; }`, or replace the class with the existing `animate-fade-in` class.
- **Effort:** S

### Issue 8: QUEST and EVENT Entity Types Have Colors and Filters But Are Never Populated
- **Severity:** Low
- **Location:** `components/visualizers/RelationshipGraph.tsx:21-22, 36-37`
- **Description:** `TYPE_COLORS` defines entries for `EntityType.QUEST` (#ec4899) and `EntityType.EVENT` (#eab308), and the initial `filters` state includes both (defaulting to `false`). However, `EntityType.QUEST` and `EntityType.EVENT` do not exist on the `Campaign` type — `Campaign` has no `quests` or `events` arrays. The filter buttons for these types are not rendered in the UI (they are not included in the filter toggle list), but the dead entries in `TYPE_COLORS` and `filters` create confusion and may cause issues if someone tries to enable them in the future.
- **Suggested Fix:** Remove `EntityType.QUEST` and `EntityType.EVENT` entries from `TYPE_COLORS` (lines 21-22) and from the initial `filters` state (lines 36-37). If QUEST/EVENT entities are planned, add a comment noting they are stubs.
- **Effort:** S

### Issue 9: Chat History Is Not Persisted — Lost on Navigation Away
- **Severity:** Medium
- **Location:** `components/RealmChat/RealmChatWidget.tsx:31`
- **Description:** `history` is local `useState` — navigating away from the chat or reloading the page clears all conversation context. For an AI assistant tool where users build up conversational context over a session ("remember that NPC we were building?"), this is a significant UX degradation. There is also no way to explicitly start a fresh conversation — the history accumulates forever until page reload.
- **Suggested Fix:** Persist `history` and `drafts` to `sessionStorage` (keyed by `campaign.id`) so conversation survives navigation within a session but clears between browser sessions. Add a "New Conversation" button with a confirmation modal. For longer-running campaigns, add a message count limit with a "load more" pattern.
- **Effort:** M

### Issue 10: PlotTimeline Fixed Column Width (120px) Truncates Session Titles
- **Severity:** Low
- **Location:** `components/visualizers/PlotTimeline.tsx:204, 280-283`
- **Description:** Session header cells use `width: COL_WIDTH` (120px) with `truncate` class. Session titles longer than ~12 characters are truncated with an ellipsis and only readable via the `title` attribute tooltip. With many sessions (10+), the horizontal scroll area becomes very wide (1200px+). The `S{index}` abbreviation helps but is not intuitive for first-time users.
- **Suggested Fix:** Consider allowing COL_WIDTH to scale with the container (e.g., `Math.max(120, containerWidth / sessionCount)` up to a maximum of 180px). Alternatively, add a compact/expanded toggle that switches between the `S{N}` abbreviation mode and full title mode. A sticky header (using `position: sticky` on the header row) would also help on tall campaigns.
- **Effort:** M

---

## Patterns & Themes

**Hardcoded dimensions are a recurring problem.** The chat widget's `w-[450px] h-[700px]`, the graph's one-time container measurement, and the timeline's `COL_WIDTH = 120` all work well at the designed resolution but degrade predictably as the environment changes (mobile, window resize, content growth). The fix pattern is consistent: replace fixed values with viewport-relative or container-relative calculations.

**The D3 graph is the standout quality piece.** The lifecycle management is correct, the filter system is well-designed, edge labels with paint-order stroke-as-halo is a sophisticated touch, and clicking through to entity editors is properly implemented. The gap between this quality floor and the missing "reset zoom" affordance is striking — the infrastructure to add it is already there (the `zoom` object just needs to be retained in a ref).

**The RealmChat widget's architecture is genuinely strong.** The draft entity system (collaborative editing via chat, with inline full editors before approval) is sophisticated and well-executed. The separation of `history`, `drafts`, and `approvedLog` as distinct state primitives is correct. The main weaknesses are cosmetic (wrong send icon, missing open animation, mobile sizing) and infrastructure (persistence), not architectural.

**Accessibility is essentially absent.** The D3 graph has no ARIA roles, no keyboard navigation for nodes, and no screen-reader-accessible representation of the graph. PlotTimeline's status dots (colored circles with no text) are not described with ARIA labels. The chat input has no `aria-label`. None of these are likely to be priorities given the DM-tool context, but they represent a gap.

**Theme coherence is good with one exception.** The RealmChat widget uses `bg-indigo-600` / `indigo-*` throughout (FAB, user messages, suggestions, model tier selector focus), while the rest of the app uses `amber-*` as the primary accent. The indigo palette works well for the "AI assistant" role (visually separating it from primary content), but it means the chat widget looks like it was built by a different team. If this distinction is intentional, it should be documented as a design decision.

---

## Screenshots

All screenshots captured at 1440x900 (desktop) and 375x812 (mobile), dev server running at `http://localhost:3000` with the "Winter's Daughter" campaign loaded.

| File | View |
|------|------|
| `docs/ux-audit/screenshots/visualization-chat/02-world-graph.png` | World Graph — full view, filter panel visible, all nodes settled |
| `docs/ux-audit/screenshots/visualization-chat/07-world-graph-with-fab.png` | World Graph — RealmChat FAB visible in bottom-right |
| `docs/ux-audit/screenshots/visualization-chat/08-graph-with-chat-open.png` | World Graph — RealmChat widget open, covering ~40% of graph area |
| `docs/ux-audit/screenshots/visualization-chat/03-plots-arcs.png` | Plots & Arcs — PlotTimeline at top, Active Arcs cards below |
| `docs/ux-audit/screenshots/visualization-chat/09-plots-full.png` | Plots full view with warning banner for "Cold Prince's Shadow" |
| `docs/ux-audit/screenshots/visualization-chat/04-session-timeline.png` | Session Timeline view (separate from PlotTimeline within Plots & Arcs) |
| `docs/ux-audit/screenshots/visualization-chat/05-realmchat-open.png` | RealmChat open on Session Manager — empty state with starter prompts |
| `docs/ux-audit/screenshots/visualization-chat/12-mobile-chat.png` | **Critical** — RealmChat on 375px viewport, left edge clipped, widget overflows |
| `docs/ux-audit/screenshots/visualization-chat/11-mobile-state.png` | Mobile home — sidebar nav not accessible (requires scroll past viewport) |

---

## Files Audited

- `/home/djiv/WebstormProjects/Realmweaver/components/visualizers/RelationshipGraph.tsx` (334 lines)
- `/home/djiv/WebstormProjects/Realmweaver/components/visualizers/PlotTimeline.tsx` (402 lines)
- `/home/djiv/WebstormProjects/Realmweaver/components/RealmChat/RealmChatWidget.tsx` (459 lines)
- `/home/djiv/WebstormProjects/Realmweaver/types/Graph.ts` (37 lines)
- `/home/djiv/WebstormProjects/Realmweaver/types/RealmChat.ts` (28 lines)
- `/home/djiv/WebstormProjects/Realmweaver/types/SessionLog.ts` (excerpt — PlotSessionStatus definition)
- `/home/djiv/WebstormProjects/Realmweaver/index.html` (excerpt — scrollbar CSS, animation CSS, font declarations)
- `/home/djiv/WebstormProjects/Realmweaver/components/common/Icons.tsx` (excerpt — icon name mapping)
