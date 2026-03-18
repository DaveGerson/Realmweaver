# Realmweaver UI Design Evaluation

> **Date:** 2026-03-18
> **Scope:** Comprehensive aesthetic and UX evaluation through DM archetype lenses + 4 alternative design proposals

---

## Part 1: Current UI Audit

### Design System Summary

The current Realmweaver UI uses a **dark fantasy theme** built with:

- **Color palette:** Slate grays (`slate-950` through `slate-400`) with **indigo** (`indigo-400`/`500`/`600`) as the primary accent
- **Typography:** Merriweather (serif) for headings, Roboto (sans-serif) for body text
- **Layout:** Fixed header + fixed left sidebar (272px) + scrollable content area
- **Components:** Consistent button variants (primary/secondary/ghost/danger), cards with `slate-900/50` backgrounds, custom scrollbars
- **Animations:** Fade-in page transitions, slide-in panels, spin/pulse loading indicators
- **Responsive:** Mobile-first with sidebar overlay on small screens

### Current Strengths

1. **Consistent dark theme** — The slate + indigo palette is cohesive and easy on the eyes during long sessions
2. **Clear information hierarchy** — Serif headings vs sans-serif body, section headers with uppercase tracking
3. **Thoughtful interactive states** — Hover, focus, active, and disabled states are well-defined throughout
4. **Functional sidebar navigation** — Hierarchical tree with expandable sections, drag-and-drop scene reordering
5. **Loading/saving feedback** — Auto-save indicator in header with clear status states
6. **Accessibility basics** — Focus rings, aria labels on toggles, semantic button elements

### Current Weaknesses

1. **Generic "developer tool" aesthetic** — The slate + indigo palette resembles VS Code or a dashboard template more than a fantasy worldbuilding tool. There is no visual warmth, texture, or thematic resonance with the TTRPG domain
2. **Monotone color language** — Indigo serves as the only accent for selection, active states, links, buttons, and AI features. This makes it hard to visually distinguish between entity types, AI actions vs navigation, or priority levels at a glance
3. **No visual identity on the Welcome Screen** — A single icon, one line of text, and a button. No illustration, no atmosphere, no emotional hook to draw a GM in
4. **Dense sidebar with weak scannability** — All entity categories look identical (same icon weight, same text size, same color). With 10+ categories, visual fatigue sets in quickly
5. **Flat card design** — Entity cards, generators, and editors all use the same `bg-slate-900/50 border-slate-800` treatment. Nothing creates visual depth or spatial hierarchy
6. **No thematic typography flair** — Merriweather is a solid serif but it's used plainly. No drop caps, no decorative elements, no typographic personality that says "fantasy worldbuilding"
7. **AI features blend into the chrome** — The Evocation Wizard and Session Weaver buttons in the header look like standard nav items. AI-powered features deserve distinct visual treatment
8. **No empty-state design** — New campaigns show empty lists with no illustration, guidance, or emotional encouragement
9. **No visual differentiation between entity types** — NPCs, locations, factions, and items all use the same card/editor styling. Color-coding exists only in the relationship graph
10. **Limited use of whitespace** — Content areas pack information densely, which works for power users but can overwhelm newcomers

---

## Part 2: Evaluation Through the 5 DM Archetype Lenses

### Archetype 1: The Worldbuilder (Encyclopedic, detail-oriented, loves lore depth)

**What they need:** Dense information architecture, cross-references, deep hierarchies, the ability to see relationships at a glance.

**Current UI grade: B-**

**Strengths:**
- Hierarchical sidebar with nested adventures/scenes/articles works well for their mental model
- Lorebook with parent-child article tree is exactly what they want
- Relationship graph visualization is a strong feature

**Weaknesses:**
- No way to see entity cross-references inline (e.g., which NPCs reference a location while editing that location)
- Cards show only name + truncated description — Worldbuilders want to see tags, categories, connected entities at the list level
- The flat card grid doesn't support the "wiki-like" browsing experience they crave
- No breadcrumb trail showing where an entity sits in the world hierarchy
- Lorebook articles lack visual indicators of depth, word count, or completeness

**Verdict:** The structure is there but the visual presentation doesn't reward their detail orientation. They need richer cards, inline cross-references, and a sense of encyclopedic depth.

---

### Archetype 2: The Storyteller (Narrative-driven, emotionally invested, wants immersion)

**What they need:** Atmosphere, visual storytelling cues, a UI that *feels* like their world. Mood and tone matter as much as functionality.

**Current UI grade: C**

**Strengths:**
- Dark theme sets a baseline mood
- Merriweather serif headings nod toward fantasy
- The "Session Live" banner with pulsing icon creates urgency

**Weaknesses:**
- **This is the archetype most underserved by the current design.** The slate + indigo palette has zero narrative warmth — it could be a project management tool
- No atmospheric illustrations, textures, or decorative elements anywhere
- Welcome screen has no story hook or visual invitation
- Editors are pure form fields — there's no sense of reading or writing a story
- No mood/tone indicators on adventures or scenes (combat scenes look identical to social scenes in the editor)
- The AI generation experience is transactional ("enter prompt, get result") rather than collaborative or magical

**Verdict:** The UI actively works against immersion. A Storyteller DM would find the tool functional but emotionally flat, like writing a novel in a spreadsheet.

---

### Archetype 3: The Improviser (Session-focused, reactive, needs speed over depth)

**What they need:** Quick access to key info during live sessions, minimal navigation friction, glanceable summaries, one-click actions.

**Current UI grade: B**

**Strengths:**
- DM Coach (Session Weaver) as a right-panel overlay is well-positioned for mid-session use
- Combat Tracker with inline editing supports rapid encounter management
- Auto-save means they never lose notes mid-session
- Mock mode allows offline play

**Weaknesses:**
- Too many clicks to reach common mid-session actions (finding an NPC's key details requires: sidebar click → scroll → click entity → wait for editor load)
- No "quick view" or peek mechanism for entities — every interaction opens a full editor
- No search/filter in the sidebar for fast entity lookup during play
- Session notes have no quick-capture shortcut or voice integration visible in the UI
- The header toolbar (Evocation Wizard, Session Weaver) is too subtle for mid-session discovery
- No "session mode" that strips the UI down to just what's needed during play

**Verdict:** Usable but not optimized for the time pressure of live sessions. The Improviser needs fewer clicks and bigger hit targets.

---

### Archetype 4: The Tactician (Combat-focused, mechanical, loves systems and crunch)

**What they need:** Data tables, stat blocks, initiative trackers, encounter balance tools, structured data over prose.

**Current UI grade: B-**

**Strengths:**
- Dedicated Combat Tracker with grid-based layout and HP color coding
- Encounter management within the tracker
- Structured entity editors with discrete fields (not just freeform text)

**Weaknesses:**
- Combat Tracker is a single flat page — no encounter history, no saved encounters, no CR/difficulty indicators visible
- NPC stat blocks aren't rendered in a recognizable D&D stat block format — they're just form fields
- No dice roller or probability calculator visible
- No visual indicators of encounter difficulty or party balance
- Item editors don't visually distinguish magical properties, rarity, or mechanical effects
- Tables and grids use minimal visual structure — no alternating row colors, no column sorting

**Verdict:** The bones are there but the visual treatment doesn't serve data-dense workflows. Tacticians want structured, scannable data presentation — not form fields.

---

### Archetype 5: The Social DM (Player-focused, collaborative, relationship-driven)

**What they need:** NPC personality at a glance, relationship maps, faction dynamics, player character integration, social encounter support.

**Current UI grade: B**

**Strengths:**
- Relationship graph visualization is a standout feature
- NPC-Faction linking with bidirectional sync is well-implemented
- Player Character section with import support
- Party & Characters section in sidebar acknowledges player importance

**Weaknesses:**
- NPC cards don't surface personality, motivation, or relationship info at the list level — you have to click into each one
- No NPC "quick reference" showing key social details (personality traits, voice notes, goals)
- Relationship graph is a separate view — not integrated into NPC or Faction editors
- No visual indicators of NPC sentiment, loyalty, or disposition
- Faction editors don't visualize power dynamics or alliances
- No player-facing view or handout generation

**Verdict:** The data model supports social play well, but the UI doesn't surface social information quickly enough. The Social DM needs NPC details front and center, not buried in editor forms.

---

## Part 3: Best Practices Evaluation

### Information Architecture: 7/10
The three-bucket sidebar organization (Campaign State, Storylines, World Planning) is logical. The hierarchical tree for adventures/scenes and articles works well. However, the flat entity lists (NPCs, Locations, etc.) don't scale beyond ~20 items without filtering or grouping.

### Visual Hierarchy: 6/10
Heading levels are clear, but the uniformity of cards and list items creates a "wall of sameness." Primary actions (AI generation) don't stand out from secondary actions (navigation). The header crams too many controls into a single horizontal bar.

### Consistency: 8/10
The Button component system, Textarea patterns, and card styling are well-standardized. The design system is internally consistent, which is a strong foundation for any redesign.

### Accessibility: 6/10
Focus states exist but are indigo-on-dark which may not meet WCAG contrast ratios in all contexts. No visible skip-to-content links. Screen reader support is minimal beyond basic aria labels. Color alone distinguishes many states (entity types in graph, HP levels in combat).

### Responsiveness: 7/10
Mobile sidebar overlay works. Grid layouts collapse to single column. However, the complex editors and combat tracker likely break down on small screens. No tablet-optimized layouts.

### Performance Perception: 7/10
Loading states are present and clear. Animations are smooth but minimal. The lack of skeleton screens means content "pops in" rather than gradually appearing.

### Emotional Design: 4/10
This is the weakest area. The UI is competent but lifeless. There's no delight, no surprise, no sense that this tool was made *for DMs by people who love TTRPGs*. Every interaction is purely functional.

---

## Part 4: Four Alternative Design Proposals

---

### Proposal A: "Arcane Codex" — Thematic Immersion Overhaul

**Philosophy:** Transform the UI from "dark developer tool" into "magical artifact." Make the tool itself feel like something a wizard would use.

**Target Archetype Optimization:** Storyteller (primary), Worldbuilder (secondary)

#### Color Palette Overhaul
- **Primary background:** Deep parchment-shadow (`#1a1510`) — warm dark brown instead of cool slate
- **Secondary background:** Aged leather (`#2a2218`) for cards and panels
- **Accent primary:** Arcane gold (`#d4a853`) replacing indigo — for active states, AI features, important actions
- **Accent secondary:** Mystic teal (`#4a9e8e`) — for links, secondary interactive elements
- **Danger:** Blood crimson (`#a83232`)
- **Text primary:** Warm parchment (`#e8dcc8`) instead of cool slate-100
- **Text secondary:** Faded ink (`#9a8b74`)
- **Borders:** Dark wood grain (`#3d3428`)

#### Typography Enhancement
- **Headings:** Switch to **Cinzel** (more distinctly medieval/fantasy serif) or **Cormorant Garamond** (elegant fantasy feel)
- **Body:** Keep Roboto for readability but warm it with the parchment text color
- **Add decorative touches:** Subtle drop caps on article first paragraphs, ornamental dividers between sections (CSS-based, not images)

#### Layout Changes
- **Sidebar:** Add a subtle parchment texture overlay (CSS gradient, not image) on the sidebar background. Section headers get small ornamental borders
- **Welcome Screen:** Full-viewport atmospheric illustration (dark gradient with subtle fantasy motifs). Animated particles (firefly/ember effect using CSS). A "tome opening" animation on first load
- **Cards:** Add subtle inner shadow and warm border glow on hover, creating a "magical activation" feel
- **Generators:** The AI prompt area gets a "ritual circle" visual treatment — a subtle circular border pattern that glows during generation
- **Editors:** A parchment-tinted reading mode for viewing entities (distinct from the edit mode form fields)

#### AI Feature Distinction
- All AI-powered buttons get a distinctive gold sparkle icon and warm glow effect
- Generation loading states show an "arcane charging" animation (concentric circles pulsing) instead of a simple spinner
- The Evocation Wizard header button becomes a prominent floating action with a distinctive icon treatment

#### Entity Type Color Language
- NPCs: Warm amber (`#d4a853`)
- Locations: Forest green (`#5a8a5a`)
- Factions: Royal purple (`#7a5aaa`)
- Items: Steel blue (`#5a7a9a`)
- Adventures: Flame orange (`#c47a3a`)
- Articles: Ink blue (`#4a6a8a`)

These colors appear as subtle left-border accents on cards and sidebar items, making entity types scannable at a glance.

#### Empty State Design
- Custom illustrations for each empty entity list (e.g., an empty tavern for NPCs, a blank map for locations)
- Encouraging flavor text: "No NPCs yet — every great story needs its cast of characters"
- One-click generation prompt: "Generate a tavern full of interesting NPCs?"

#### Tradeoffs
- **Pro:** Dramatically more immersive and emotionally engaging. Strong brand identity
- **Pro:** Entity type colors improve scannability for all archetypes
- **Con:** The warm palette may cause eye strain for some users in extended sessions
- **Con:** Decorative elements add visual noise that may annoy efficiency-focused users
- **Con:** Higher implementation effort (custom fonts, CSS textures, illustrations, animations)
- **Risk:** Could feel "too themed" for DMs who run modern, sci-fi, or non-fantasy campaigns

---

### Proposal B: "Command Center" — Information Density & Efficiency Focus

**Philosophy:** Optimize for power users who treat campaign management like a professional workflow. Maximize information per pixel. Make every click count.

**Target Archetype Optimization:** Tactician (primary), Improviser (secondary)

#### Color Palette Refinement
- Keep the cool dark theme but sharpen contrast
- **Primary background:** True dark (`#0f1117`) — darker than current slate-950
- **Card surfaces:** `#1a1d27` — slightly elevated from background
- **Accent primary:** Keep indigo but make it brighter (`#6366f1` → `#818cf8`) for better contrast
- **Accent secondary:** Introduce **cyan** (`#22d3ee`) for AI-specific features, creating a clear "human action = indigo, AI action = cyan" distinction
- **Status colors:** Sharper green/amber/red for clear status indication
- **Borders:** Crisper 1px borders with slightly more contrast (`slate-600` → `slate-500`)

#### Typography Refinement
- **Headings:** Switch to **Inter** or **JetBrains Mono** for a modern, technical feel
- **Body:** **Inter** for superior readability at small sizes
- **Data displays:** Monospace font for stat blocks, tables, and numerical data
- **Reduce font sizes slightly** to fit more information on screen

#### Layout Overhaul — The "Panel" System
- **Replace the fixed sidebar with a collapsible panel system**
- Left panel: Navigation (collapsible to icon-only rail)
- Center panel: Primary content (editor/dashboard)
- Right panel: Context panel (entity details, AI chat, quick reference) — always available, not just for DM Coach
- **Panels are resizable** via drag handles
- **Keyboard shortcuts** for panel navigation (Ctrl+1/2/3, Ctrl+B to toggle sidebar)

#### Command Palette
- **Add a Spotlight/Command Palette** (Ctrl+K) for instant access to any entity, action, or AI feature
- Fuzzy search across all entities, with type-ahead suggestions
- Recent entities list for quick re-access
- Direct AI generation from the palette: "generate npc tavern keeper" triggers generation inline

#### Card Redesign — Dense Mode
- **List view option** alongside grid view for all dashboards
- List view shows: Type icon | Name | Key stat 1 | Key stat 2 | Tags | Last modified
- Each entity type shows different "key stats" (NPCs: race/class/faction, Locations: type/parent, Items: rarity/type)
- **Sortable columns** in list view
- **Inline quick-edit** — click a field in list view to edit without opening the full editor

#### Stat Block Rendering
- NPCs, Items, and Encounters render with a **proper D&D-style stat block** layout (not just form fields)
- Stat blocks use a structured card with clear sections: abilities, actions, traits, etc.
- Print-friendly stat block CSS for physical session use

#### Split-View Editing
- Open two entities side-by-side for comparison or cross-referencing
- "Pin" an entity to the right panel while browsing others in the center

#### Session Mode
- Dedicated **"Session Mode"** toggle that reconfigures the UI:
  - Hides generators and creation tools
  - Surfaces quick-reference panels
  - Enlarges text for readability at table distance
  - Promotes combat tracker and initiative display
  - Adds quick-access NPC card popup (hover over name → see key details)

#### Tradeoffs
- **Pro:** Dramatically faster for experienced users. More information visible at once
- **Pro:** Command palette alone would be transformative for navigation
- **Pro:** Split-view and panels serve all archetypes during different workflows
- **Con:** Steeper learning curve for new users
- **Con:** The dense, technical aesthetic may feel cold and uninviting
- **Con:** Panel system adds significant implementation complexity
- **Con:** Risk of feature creep — every panel/shortcut is more to maintain
- **Risk:** Could feel overwhelming to casual DMs or those who prep minimally

---

### Proposal C: "Storyboard" — Visual-First Narrative Design

**Philosophy:** Treat campaign management as visual storytelling. Use cards, boards, and spatial layouts to make the campaign's narrative structure visible and manipulable.

**Target Archetype Optimization:** Storyteller (primary), Social DM (secondary)

#### Color Palette
- **Dark mode with warm neutrals** — split the difference between Proposal A and current
- **Primary background:** Warm charcoal (`#1c1917` — stone-900 equivalent)
- **Card surfaces:** `#292524` (stone-800)
- **Accent primary:** Amber/gold (`#f59e0b`) — warm, inviting, matches the existing CLAUDE.md mention of amber accents
- **Accent secondary:** Soft violet (`#a78bfa`) for AI/magical features
- **Text:** Warm white (`#fafaf9` — stone-50)
- **Borders:** `#44403c` (stone-700)

This returns closer to the amber accent theme originally described in the CLAUDE.md styling section but actually diverges from the current implementation which uses indigo.

#### Typography
- **Headings:** **Cormorant Garamond** — elegant, readable, distinctly literary
- **Body:** **Source Sans 3** — warm humanist sans-serif, excellent readability
- **Accent:** **Permanent Marker** or similar handwritten font for personal notes and annotations only

#### Layout Overhaul — The "Canvas"
Replace the rigid sidebar+content layout with a **contextual canvas** that adapts to what you're doing:

**Campaign Home (Default View):**
- A **visual dashboard** replacing the current sidebar-only navigation
- **Story timeline** at the top — horizontal scrolling timeline showing sessions, with plot arcs overlaid as colored bands
- **Entity "constellation" view** — a simplified relationship graph as the central navigation (not hidden in a separate view)
- **Quick stats sidebar** — campaign health metrics (entity counts, session count, last played date)

**Adventure View — Kanban/Storyboard:**
- Scenes displayed as **cards on a horizontal storyboard** (like Trello columns but horizontal)
- Cards show scene type (icon + color), key NPCs (avatar circles), location (small tag), and status (planned/completed)
- Drag and drop reordering (already implemented in sidebar, extend to main view)
- Visual connectors between scenes showing narrative flow

**NPC Gallery View:**
- **Visual card grid** with NPC "portraits" (AI-generated placeholder silhouettes based on race/class, or user-uploadable)
- Cards show: Name, epithet/title, faction badge, relationship indicators (icons showing connections)
- Hover reveals: Key personality trait, current goal, last appeared in session #
- **Relationship web mini-map** in the corner showing selected NPC's connections

**Location Atlas View:**
- **Map-like nested layout** showing location hierarchy visually
- Parent locations are large cards; child locations are smaller cards nested inside
- Visual breadcrumb path showing location context

#### Narrative Widgets
- **"What's Happening Now" widget** — A persistent footer bar showing: current active session, last plot development, next planned scene
- **NPC Mood Board** — Editable tags/badges on NPCs showing current disposition, loyalty, and goals that update as the campaign progresses
- **Plot Thread Tracker** — Visual threads (colored lines) that connect entities across the campaign, visible in multiple views

#### AI Generation Experience
- **"Weave" metaphor** — AI generation uses a weaving/crafting visual language
- Generation prompts appear in a warm, inviting textarea with the feel of writing in a journal
- Results animate in as if being "written" (typewriter effect for text, fade-in for structured data)
- A "variations" tray lets you see 2-3 alternatives side by side before committing

#### Tradeoffs
- **Pro:** Genuinely novel approach that makes campaign structure visible and intuitive
- **Pro:** Storyboard/kanban scene management is immediately understandable
- **Pro:** Visual NPC gallery creates emotional connection to characters
- **Pro:** Warm color palette invites extended use
- **Con:** Very high implementation complexity (canvas layouts, visual connectors, constellation view)
- **Con:** May not scale well to very large campaigns (100+ NPCs overwhelm a gallery view)
- **Con:** Less information-dense than current design — trades density for visual clarity
- **Con:** The "novel" layouts may confuse users coming from traditional tool interfaces
- **Risk:** Visual metaphors (constellation, atlas) could feel gimmicky if not executed well

---

### Proposal D: "Adaptive Forge" — Mode-Switching Hybrid Design

**Philosophy:** No single design serves all DM archetypes. Instead, build a core design system with **switchable UI modes** that reconfigure layout, density, and emphasis based on what the DM is doing.

**Target Archetype Optimization:** All archetypes equally, through contextual adaptation

#### Core Design System (Shared Across All Modes)

**Color Palette — Refined Current:**
- Keep slate as the base but warm it slightly: `slate` → `zinc` (Tailwind's warmer neutral gray)
- **Primary accent:** Amber (`amber-400`/`500`/`600`) — warmer than indigo, thematic for fantasy, good contrast on dark backgrounds
- **AI accent:** Indigo (`indigo-400`/`500`) — retained specifically for AI-powered features
- **Entity type colors** (always visible): NPC amber, Location emerald, Faction violet, Item sky, Adventure orange, Article cyan
- **Status colors:** Standard green/yellow/red

This creates a clear visual language: **amber = user actions, indigo = AI actions, entity colors = content types**.

**Typography:**
- **Headings:** **Crimson Pro** — readable serif with personality, good for fantasy and modern settings alike
- **Body:** **Inter** — industry-standard for UI readability
- **Monospace:** **JetBrains Mono** — for stat blocks and code

**Component Library Refinements (all modes):**
- Entity cards get a **left border color** matching their entity type
- Buttons get clearer size hierarchy and the AI buttons get the indigo accent with a sparkle icon
- Form inputs get warmer styling with `zinc` backgrounds
- Better empty states with contextual illustrations and action prompts
- Loading skeletons instead of spinners for content areas

#### Mode 1: "Prep Mode" (Default — Worldbuilding & Planning)

**Layout:** Current sidebar + content layout, enhanced:
- Sidebar gains a **search/filter bar** at the top
- Entity type badges (colored dots) next to each sidebar item
- Content area gains **breadcrumbs** for navigation context
- Dashboard views show a **richer card design**: entity type color accent, tag pills, relationship count badges, last-modified timestamp
- Editors gain a **"preview" toggle** that renders the entity in a read-only, beautifully formatted view (like reading a sourcebook entry)

**Generator Enhancement:**
- AI generation gets a dedicated **"Generation Tray"** — a slide-up panel from the bottom (like a keyboard on mobile) that doesn't disrupt the current view
- The tray shows prompt input, campaign context hints, and previous generations
- Results appear in the tray first; you "accept" to add to the campaign

#### Mode 2: "Session Mode" (Live Play — In-Session)

Activated via a prominent toggle in the header. Reconfigures the UI:

**Layout Changes:**
- Sidebar collapses to an **icon rail** (saves space)
- Right panel opens permanently for **DM Coach / Quick Reference**
- Content area switches to a **"DM Screen" layout**: 2x2 grid of configurable panels
- Default panels: Initiative/Combat, Active Scene Details, Quick NPC Lookup, Session Notes

**Visual Changes:**
- **Larger text** throughout (base size increases from 14px to 16px)
- **Higher contrast** active states for readability at arm's length
- **Quick-access floating buttons** for common actions: roll dice, add to initiative, quick note
- **Active scene banner** at the top showing current scene context

**Behavior Changes:**
- All navigation prioritizes speed: single-click opens inline, no page transitions
- Entity names anywhere become **hover-peek targets** (hover shows key details in a tooltip card)
- Session timer visible in header
- **Distraction-free:** Hides generators, import/export, and other non-session features

#### Mode 3: "Review Mode" (Post-Session — Reflection & Continuity)

Activated when closing an active session or manually. Focused on session review:

**Layout:**
- Full-width content area (no sidebar)
- Session notes displayed in a **chronological timeline** format
- AI-powered session summary at the top
- **"What changed" panel** — highlights entities that were created, modified, or referenced during the session

**Features:**
- Plot thread progress tracking (what advanced, what stalled)
- NPC disposition changes suggested by AI based on session events
- Next session prep suggestions generated from session notes

#### Mode 4: "Atlas Mode" (Exploration — Visual Browsing)

For when you want to browse and explore the world visually:

**Layout:**
- **Full-screen canvas** with the relationship graph as the primary view
- Click any node to open its details in a right panel
- Zoom, pan, and cluster by entity type or relationship
- **Minimap** in the corner for orientation

**Enhancements over current graph:**
- Nodes display small preview cards (not just labels)
- Edge labels show relationship types
- Cluster visualization by faction, location, or adventure
- Search highlights matching nodes

#### Implementation Strategy

- Modes share the same component library and data layer
- Mode switching is a layout/CSS concern, not a data concern
- Start with Prep Mode (enhanced current) and Session Mode
- Add Review Mode and Atlas Mode in later iterations
- Persist mode preference per campaign (some campaigns may default to different modes)

#### Tradeoffs
- **Pro:** Serves all 5 DM archetypes without compromise
- **Pro:** Mode switching is a familiar pattern (apps like Notion, Linear already do this)
- **Pro:** Incremental implementation — each mode can ship independently
- **Pro:** The core design refinements (warm palette, entity colors, AI distinction) improve the UI even without modes
- **Con:** Most complex to implement overall
- **Con:** Users must learn that modes exist and when to use them
- **Con:** Design consistency across 4 modes is challenging — each mode needs testing
- **Con:** More UI surface area = more maintenance burden
- **Risk:** Modes could feel disjointed if the shared design system isn't strong enough

---

## Part 5: Comparison Matrix

| Criteria                  | Current | A: Arcane Codex | B: Command Center | C: Storyboard | D: Adaptive Forge |
|--------------------------|---------|-----------------|-------------------|---------------|-------------------|
| **Storyteller appeal**    | 4/10    | 9/10            | 5/10              | 9/10          | 7/10              |
| **Worldbuilder appeal**   | 6/10    | 7/10            | 8/10              | 7/10          | 8/10              |
| **Improviser appeal**     | 5/10    | 5/10            | 9/10              | 6/10          | 9/10              |
| **Tactician appeal**      | 5/10    | 4/10            | 9/10              | 5/10          | 8/10              |
| **Social DM appeal**      | 6/10    | 7/10            | 6/10              | 8/10          | 7/10              |
| **Implementation effort** | —       | Medium          | High              | Very High     | High (incremental)|
| **Learning curve**        | Low     | Low             | Medium            | Medium        | Low per mode      |
| **Brand identity**        | 3/10    | 9/10            | 6/10              | 8/10          | 7/10              |
| **Scalability (large campaigns)** | 7/10 | 6/10       | 9/10              | 5/10          | 8/10              |
| **Emotional engagement**  | 4/10    | 9/10            | 4/10              | 8/10          | 6/10              |
| **Information density**   | 6/10    | 5/10            | 9/10              | 6/10          | 7/10 (mode-dependent)|
| **Setting agnosticism**   | 9/10    | 5/10            | 9/10              | 7/10          | 8/10              |

---

## Part 6: Recommendation

Each proposal has clear strengths. The right choice depends on your priorities:

- **Choose A (Arcane Codex)** if you want maximum brand identity and emotional impact, and your primary audience runs fantasy campaigns
- **Choose B (Command Center)** if you want to compete with professional GM tools like Notion/World Anvil on power and speed
- **Choose C (Storyboard)** if you want to differentiate through a genuinely novel visual approach to campaign management
- **Choose D (Adaptive Forge)** if you want to serve all audiences and can invest in incremental, sustained development

**A pragmatic path** would be to start with **Proposal D's core design system** (warm palette, entity colors, AI distinction, better empty states) as a foundation — these improvements benefit everyone — and then layer in elements from A, B, or C as the product direction clarifies.
