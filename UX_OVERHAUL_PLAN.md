# Realmweaver UX Overhaul Plan

> **Created:** 2026-03-13
> **Goal:** Transform Realmweaver from a campaign *database* into a fast, fun, integrated *session cockpit* for DMs

---

## Guiding Principles

1. **Session-first, not entity-first.** Everything should flow toward making the next session great.
2. **Zero-click context.** The app should know what you're doing and surface the right tools without asking.
3. **Generate-in-place.** Never make the DM leave their current view to create something.
4. **Fun > Completeness.** A half-finished NPC that sparks an idea beats a perfect form nobody fills out.
5. **The DM's hands are busy.** Voice, single-click, and AI-driven workflows beat typing.

---

## Phase 0: Session Cockpit (Highest Impact — Do First)

**Problem:** Running a session currently requires juggling 4+ views. The DM has no unified "I'm running a game right now" experience.

### 0.1 — Unified Session Runner View

Create a new top-level view that replaces the current scattered session flow. When a session is marked "active," the app transforms into a **Session Runner** — a single screen with everything the DM needs mid-game.

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  SESSION HEADER: "Session 12 — The Betrayal"   [End]│
├──────────┬──────────────────────────┬───────────────┤
│          │                          │               │
│  SCENE   │   ACTIVE SCENE PANEL    │  QUICK TOOLS  │
│  LIST    │                          │               │
│          │  Read-aloud text         │  DM Coach     │
│  ☑ Sc 1  │  GM Notes               │  Voice Notes  │
│  ▶ Sc 2  │  NPCs present           │  Dice/Tables  │
│  ○ Sc 3  │  Location details       │  Quick NPC    │
│  ○ Sc 4  │  Skill checks           │  Combat       │
│          │  Rewards                 │  Plot Tracker │
│          │                          │               │
├──────────┴──────────────────────────┴───────────────┤
│  RUNNING LOG: Live voice transcript + typed notes   │
└─────────────────────────────────────────────────────┘
```

**Key behaviors:**
- Clicking a scene in the left rail loads it into the center panel — no navigation away
- "Quick Tools" panel is always visible — DM Coach, voice notes, dice roller, rollable tables
- Running log streams at the bottom — voice transcription feeds directly here
- Advancing to next scene is one click (checkmark current, arrow to next)
- Starting combat from a scene auto-populates combatants from `scene.npcIds` + player characters
- Session context (recap, running notes, active plots) automatically injected into all AI calls

**Data model changes:**
- Add `sceneStatus: 'planned' | 'in-progress' | 'completed'` to `Scene` type
- Add `sessionId` field to `Encounter` type
- Add `encounterLog: Encounter[]` to `SessionLog` for combat history
- Add `activeSessionId` to `Campaign` (separate from `activeSceneId`)

### 0.2 — One-Click Session Start

Replace the current multi-step session start flow:

**Current:** Create session log → fill fields → click "Start Session" → navigate to adventure → find scene → click "Start Session Here" (6+ steps)

**New:** From any session log, click **"Go Live"** → App enters Session Runner with the session's adventure loaded, first planned scene active, DM Coach primed with session context, voice notes ready. One click.

### 0.3 — Smart Session End

When ending a session:
- AI auto-generates a recap from running notes + structured notes
- Prompts DM: "Which plots advanced? Any new ones?" with checkboxes
- Archives combat encounters to session log
- Clears active scene/encounter state
- Suggests prep hooks for next session ("The party left mid-dungeon — pick up at Scene 4?")

---

## Phase 1: Fast World-to-Session Pipeline

**Problem:** World-building and session prep feel like separate activities. Creating an NPC doesn't connect them to scenes; building a location doesn't place it in an adventure.

### 1.1 — Contextual Generation ("Generate Here")

Every entity list in the app gets a **"Generate Here"** button that creates entities pre-linked to the current context:

- Viewing a scene? "Generate NPC" creates an NPC and auto-links to that scene
- Viewing a location? "Generate NPC" creates an NPC whose home/workplace is that location
- Viewing a faction? "Generate NPC" creates a faction member
- Viewing an adventure? "Generate Scene" creates a scene within that adventure

No more creating an entity, then navigating somewhere else to link it.

### 1.2 — Session Prep Wizard

A guided 5-minute workflow to prep a session:

```
Step 1: "Which adventure are we continuing?" → Select/create adventure
Step 2: "Which scenes do you expect to run?" → Select/reorder/create scenes
Step 3: "Any new NPCs or locations needed?" → Quick-generate with context
Step 4: "What plots should advance?" → Select active plots, AI suggests hooks
Step 5: "Ready!" → Review prep document, one-click to Go Live
```

This replaces the blank SessionLogEditor form with a guided, AI-assisted flow. Each step can be skipped. The wizard populates the session log automatically.

### 1.3 — Scene Builder (Inline, Not Separate)

Replace the current flow of creating scenes in a modal from the sidebar:

- AdventureEditor gets a **Scenes tab** showing all scenes inline with expandable cards
- Each card shows: title, type, location, NPCs, read-aloud preview
- "Add Scene" opens inline generator (not a modal, not a sidebar click)
- Drag-and-drop reordering within the adventure view
- "AI: Suggest next scene" button that reads adventure context and proposes what comes next

### 1.4 — Quick Entity Cards

Replace the current "click to open full editor" pattern for common lookups:

- Hovering/clicking an entity name anywhere shows a **Quick Card** popover
- Cards show: name, key traits, role, relationships, last-modified
- Cards have: "Edit," "Link to Scene," "Add to Encounter" action buttons
- Works everywhere: scene NPC lists, sidebar, dashboards, session notes

---

## Phase 2: Fun & Friction-Free Interface

**Problem:** The app feels like a database form. Generators are transactional (type → click → done). The visual language doesn't spark creativity.

### 2.1 — Conversational Generation as Default

Replace textarea-and-button generators with chat-based flows as the primary creation mode:

- "Tell me about the NPC you're imagining" → multi-turn conversation → preview card updates live
- "I don't know yet, surprise me" → AI proposes, DM reacts, iterate
- Conversation is the default; "quick generate" (single prompt) is the secondary option
- Prompt suggestions appear as clickable chips: "A mysterious merchant," "A rival adventurer," "Someone from the player's backstory"

### 2.2 — Inline Field Regeneration

In any entity editor, individual fields get a small "regenerate" icon:

- Click the icon next to "Personality Traits" → AI regenerates just that field
- Click next to "Backstory" → AI rewrites backstory keeping everything else
- Optionally provide a tweak instruction: "Make them more sinister"
- No need to regenerate the entire entity to fix one field

### 2.3 — Entity Preview Panels

Dashboards show rich preview information without requiring clicks:

- NPC dashboard cards show: portrait placeholder, race/class, 2-line personality summary, faction badge
- Location cards show: type icon, atmosphere snippet, connected locations
- Adventure cards show: scene count, level range, completion percentage
- Clicking opens editor; most browse tasks don't need the editor

### 2.4 — Streamlined Editor Layout

Current editors are long vertical forms. Restructure into tabbed/sectioned layouts:

- **NPC Editor:** Identity tab | Personality tab | Stats tab | Relationships tab | History tab
- **Location Editor:** Overview tab | Points of Interest tab | Connections tab | Loot tab
- **Scene Editor:** Narrative tab (read-aloud, GM notes) | Mechanics tab (skill checks, rewards) | Cast tab (NPCs, location)

Each tab fits on one screen. No scrolling through 20 fields.

### 2.5 — Dark Fantasy Polish

Enhance the visual identity beyond utility:
- Subtle parchment textures for entity cards
- Animated transitions between views (slide, not jump)
- "Quill writing" animation during AI generation (replaces spinner)
- Warm amber glow effects on interactive elements
- Sound effects toggle for dice rolls, generation complete, session start (optional)

---

## Phase 3: Tight Integration & Plot Coherence

**Problem:** DMs create lots of content but the app doesn't help them stay coherent. Plot threads get lost. NPCs appear without motivation. Locations exist without purpose.

### 3.1 — Plot Thread Tracker (Enhanced)

Upgrade the current Plot entity from a simple tracker to an active coherence engine:

- **Plot Timeline:** Visual timeline showing which sessions advanced which plots
- **Plot Health Alerts:** "This plot hasn't been touched in 3 sessions" warnings
- **Plot-Scene Linking:** When creating scenes, AI suggests which plots could advance
- **Plot Resolution Assistant:** When a plot reaches a climax, AI suggests resolution scenarios
- **Dangling Thread Detection:** AI scans campaign for NPCs/locations/factions not connected to any active plot — flags them as potential hooks or cleanup candidates

### 3.2 — Relationship Intelligence

Surface entity relationships everywhere they matter:

- **NPC cards show faction, location, and relationship badges** inline
- **Scene cast panel** shows relationship web between NPCs in the scene ("These two are rivals")
- **DM Coach receives relationship context** — "Remind the party that Grak and Thessa have history"
- **Auto-suggest encounters:** "Grak is in this scene and hates the faction the party just helped — suggest tension"

### 3.3 — Continuity Checker

Before starting a session, AI scans for inconsistencies:

- "NPC Aldric was killed in Session 5 but is still listed in Scene 3 of the current adventure"
- "The party has the Amulet of Storms but it's listed as being in the Dragon's Lair location"
- "Plot 'The Missing Heir' was resolved but NPC Lyra still has motivation 'Find the heir'"
- Runs automatically during session prep; DM can dismiss or fix each issue

### 3.4 — Smart Context Window

Replace the current `campaignContext` string construction with a structured, priority-ranked context system:

- **Tier 1 (Always included):** Campaign setting, active session recap, active scene details
- **Tier 2 (Included when relevant):** NPCs in active scene, location details, active plot summaries
- **Tier 3 (Included on demand):** Full NPC histories, faction details, lore articles
- Context is automatically tailored per AI call type (DM Coach gets Tier 1+2; entity generation gets Tier 1+3)

---

## Phase 4: Reducing Note-Taking Burden

**Problem:** DMs are busy running the game. Taking notes pulls them out of the moment. Current voice transcription exists but isn't smart enough.

### 4.1 — Always-On Voice Log (Session Runner Integration)

During an active session in the Session Runner:

- Voice transcription runs continuously in the background (toggle on/off)
- Transcript appears in the running log panel at the bottom
- DM can tap a "Mark Important" button to flag a transcript segment
- No need to navigate to SessionLogEditor to use voice — it's built into the Session Runner

### 4.2 — Smart Note Structuring

AI processes the voice transcript in real-time (or at natural breaks):

- Auto-tags entity mentions: "Grak → NPC:Grak_id"
- Auto-detects event types: combat result, social interaction, discovery, plot advancement
- Structures raw transcript into categorized entries:
  - **Events:** "Party negotiated with Grak for safe passage"
  - **Decisions:** "Party chose to enter the cave instead of the forest"
  - **Combat:** "Defeated 3 goblins, Lyra took 12 damage"
  - **Loot:** "Found Potion of Healing in chest"

### 4.3 — Post-Session Auto-Recap

When the DM ends a session:

- AI generates a structured recap from all notes (voice + typed)
- Recap includes: key events, NPC interactions, plot advancements, loot gained, decisions made
- DM reviews and edits the recap (not writing from scratch)
- Recap is saved to SessionLog and becomes context for next session
- Optional: Generate a "player-facing" recap to share with the group

### 4.4 — Event-Driven Note Capture

Instead of the DM writing notes, the app captures events automatically:

- **Combat tracker → Session log:** "Combat: Party vs. 3 Orcs in the Darkwood. 4 rounds. No casualties."
- **Scene transitions → Session log:** "Moved from Scene 2 (The Tavern) to Scene 3 (The Cave) at 8:45 PM"
- **Entity creation mid-session → Session log:** "New NPC created: Merchant Thessa (improvised during tavern scene)"
- **DM Coach usage → Session log:** "Used DM Coach for improvised narration about the storm"

The DM's notes become a supplement to automatic logging, not the primary record.

---

## Phase 5: Delightful Onboarding & Discovery

**Problem:** New users are dropped into an empty campaign with no guidance. Powerful features (Evocation Wizard, DM Coach, voice notes) go undiscovered.

### 5.1 — First Campaign Wizard

After creating a campaign, guide the user through initial setup:

```
"Welcome to your new campaign! Let's get you started."

→ "Want me to generate a starting adventure?" [Yes / I'll do it myself]
→ "Let's create a few key NPCs for your world" [Generate 3 / Skip]
→ "Any important locations?" [Generate 3 / Skip]
→ "Ready to prep your first session?" [Open Session Prep / Explore on my own]
```

Each step uses the Evocation Wizard under the hood but presents it as a friendly conversation, not a complex tool.

### 5.2 — Contextual Feature Discovery

Instead of a tutorial, surface features when they're relevant:

- First time opening an adventure with no scenes: "Tip: You can generate scenes from a prompt. Try it!"
- First time starting a session: "Tip: Enable voice notes to capture the session hands-free"
- First NPC created: "Tip: Link this NPC to a faction to build your world's power structure"
- First combat: "Tip: The DM Coach can improvise narration for dramatic combat moments"

Dismissible, non-blocking, shown once per feature.

### 5.3 — Template Campaigns

Offer pre-built campaign templates for quick starts:

- **"Classic Dungeon Crawl"** — 1 adventure, 5 scenes, 3 NPCs, 2 locations
- **"Political Intrigue"** — 3 factions, 6 NPCs with relationships, 2 plots
- **"Sandbox Exploration"** — 5 locations with connections, 4 NPCs, random encounter tables
- **"One-Shot Adventure"** — 1 complete adventure with all scenes, NPCs, and locations

Templates are generated via Evocation Wizard with pre-tuned prompts.

---

## Implementation Priority Matrix

| Phase | Impact | Effort | Priority |
|-------|--------|--------|----------|
| **0: Session Cockpit** | Very High | High | **P0 — Do first** |
| **1: World-to-Session Pipeline** | High | Medium | **P1** |
| **4: Note-Taking Reduction** | High | Medium | **P1** |
| **3: Plot Coherence** | High | Medium | **P2** |
| **2: Fun Interface** | Medium | Medium | **P2** |
| **5: Onboarding** | Medium | Low | **P3** |

### Suggested Build Order Within Phases

**Sprint 1 (Phase 0 foundation):**
1. Data model changes (sceneStatus, activeSessionId, sessionId on Encounter)
2. Session Runner view — basic layout with scene list + active scene panel
3. One-click "Go Live" from session log
4. Move voice notes into Session Runner

**Sprint 2 (Phase 0 completion + Phase 1 start):**
5. Quick Tools panel in Session Runner (DM Coach, dice, tables)
6. Running log integration with auto-capture
7. Smart Session End with AI recap
8. Contextual "Generate Here" for NPCs and scenes

**Sprint 3 (Phase 1 + Phase 4):**
9. Session Prep Wizard
10. Inline Scene Builder in AdventureEditor
11. Smart Note Structuring (real-time entity tagging)
12. Event-driven auto-capture (combat → log, scene transition → log)

**Sprint 4 (Phase 3 + Phase 2):**
13. Enhanced Plot Thread Tracker with timeline
14. Continuity Checker
15. Smart Context Window (tiered)
16. Conversational Generation as default
17. Inline field regeneration

**Sprint 5 (Phase 2 + Phase 5):**
18. Quick Entity Cards (popovers)
19. Entity Preview Panels in dashboards
20. Editor tab restructuring
21. First Campaign Wizard
22. Template Campaigns
23. Visual polish pass

---

## Success Metrics

After implementation, measure:

1. **Clicks to start a session:** Current ~8 → Target: 1-2
2. **Views visited during active session:** Current ~4 → Target: 1 (Session Runner)
3. **Time from "create campaign" to "first session ready":** Current ~30min → Target: ~5min
4. **Manual notes written per session:** Should decrease by 70%+ with auto-capture
5. **Entities created but never linked to anything:** Should decrease with contextual generation
6. **Plot threads forgotten (no activity for 3+ sessions):** Should trigger alerts

---

## Technical Debt to Address Along the Way

- **App.tsx is 900+ lines** — Session Runner extracts ~40% of the logic into its own component
- **Context construction is ad-hoc** — Tiered context system (Phase 3.4) standardizes it
- **No undo system** — Add global undo stack for entity CRUD operations
- **Sidebar search** — Add quick-find across all entities
- **Mobile responsiveness** — Session Runner should work on a tablet at the game table
