# Realmweaver — Best-in-Class Product Plan

> **Created:** 2026-03-13 | **Revised:** 2026-03-17
> **Vision:** The AI-native campaign cockpit — combining the generation depth of RoleplayRev, the worldbuilding richness of World Anvil, and the clean collaborative UX of LegendKeeper into a single product that no competitor offers.

---

## Competitive Positioning

The TTRPG tool market has three archetypes. Realmweaver targets the gap between all three:

| Tool | Archetype | Strength | Weakness |
|------|-----------|----------|----------|
| **RoleplayRev** | AI-first generator | Ready-to-run AI content, world evolution | Shallow organization, no collaboration |
| **World Anvil** | Structured wiki | Deepest feature set, 25+ templates, maps | Steep learning curve, bolted-on AI |
| **LegendKeeper** | Collaborative canvas | Clean UX, real-time collab, GM secrets | No AI at all, limited session tools |
| **Realmweaver** | **AI-native cockpit** | AI generation + session cockpit + collaboration | Currently local-only, no maps, no search |

**Realmweaver's unfair advantage:** It already has the strongest AI integration (multi-model, multi-mode generation, live voice transcription, contextual DM coaching) AND a session-first architecture. No competitor combines these.

---

## Guiding Principles

1. **Session-first, not entity-first.** Everything flows toward making the next session great.
2. **Zero-click context.** The app knows what you're doing and surfaces the right tools without asking.
3. **Generate-in-place.** Never make the DM leave their current view to create something.
4. **Fun > Completeness.** A half-finished NPC that sparks an idea beats a perfect form nobody fills out.
5. **The DM's hands are busy.** Voice, single-click, and AI-driven workflows beat typing.
6. **Collaborative by default.** Players see what the DM shares, nothing more.
7. **Your data, your way.** Cloud-synced, offline-capable, exportable to open formats.
8. **Progressive disclosure.** Start simple, reveal power as the user grows.

---

## Phase 0: Session Cockpit (Highest Impact — Do First)

> **Status: Foundation built** — SessionRunner.tsx exists with basic scene management. Needs completion.

**Problem:** Running a session currently requires juggling 4+ views. The DM has no unified "I'm running a game right now" experience.

### 0.1 — Unified Session Runner View (ENHANCE EXISTING)

The existing SessionRunner needs to evolve from a basic scene selector into a full cockpit:

```
┌─────────────────────────────────────────────────────────────┐
│  SESSION: "Session 12 — The Betrayal"    [Mic 🔴] [End]    │
├──────────┬───────────────────────────────┬──────────────────┤
│          │                               │                  │
│  SCENE   │   ACTIVE SCENE PANEL         │  QUICK TOOLS     │
│  LIST    │                               │                  │
│          │  📖 Read-aloud (expandable)   │  🎲 Dice Roller  │
│  ✅ Sc 1 │  🔒 GM Notes                 │  📋 Tables       │
│  ▶ Sc 2  │  👥 NPCs (quick cards)       │  🧠 DM Coach    │
│  ○ Sc 3  │  📍 Location details         │  ⚔️ Combat       │
│  ○ Sc 4  │  🎯 Skill checks             │  👤 Quick NPC    │
│          │  💰 Rewards                   │  📊 Plot Track   │
│          │                               │  🗺️ Quick Map   │
├──────────┴───────────────────────────────┴──────────────────┤
│  LIVE LOG: Voice transcript + auto-events + typed notes     │
│  [Tag: Combat] [Tag: NPC] [Tag: Decision] [Mark Important]│
└─────────────────────────────────────────────────────────────┘
```

**Key behaviors:**
- Clicking a scene loads it into the center panel — no navigation away
- "Quick Tools" panel is always visible — DM Coach, dice, tables, combat
- Running log streams at the bottom — voice transcription + auto-events feed here
- Advancing to next scene is one click (checkmark current, arrow to next)
- Starting combat auto-populates combatants from `scene.npcIds` + player characters
- Session context automatically injected into all AI calls
- **Tablet-optimized:** Touch-friendly buttons, swipeable scene list, large text for read-aloud

**Data model changes needed:**
- Add `sceneStatus: 'planned' | 'in-progress' | 'completed'` to Scene *(exists)*
- Add `sessionId` field to Encounter *(exists)*
- Add `encounterLog: Encounter[]` to SessionLog *(exists)*
- Add `activeSessionId` to Campaign *(exists)*

### 0.2 — Integrated Dice Roller

**Gap:** No dice roller exists. Every competitor has one or assumes external tools.

- d4, d6, d8, d10, d12, d20, d100 with quantity selector
- Custom formulas: `2d6+4`, `4d6kh3` (keep highest 3)
- Roll history log (persisted to session)
- Advantage/disadvantage quick buttons
- Results auto-logged to session running notes
- Rollable table integration — roll on any custom table from here
- Sound effect toggle (dice clatter)

### 0.3 — One-Click Session Start

**Current:** 6+ steps. **Target:** 1 click.

From any session log, click **"Go Live"** → App enters Session Runner with:
- Adventure loaded, first planned scene active
- DM Coach primed with full session context
- Voice notes ready
- Previous session recap visible
- Active plots surfaced in sidebar

### 0.4 — Smart Session End

When ending a session:
- AI auto-generates a structured recap from running notes + voice transcript + combat logs
- Prompts DM: "Which plots advanced? Any new ones?" with checkboxes
- Archives combat encounters to session log
- Clears active scene/encounter state
- Generates **player-facing recap** (optional) — shareable summary with no GM secrets
- Suggests prep hooks for next session ("The party left mid-dungeon — pick up at Scene 4?")

---

## Phase 1: Fast World-to-Session Pipeline

**Problem:** World-building and session prep feel disconnected. Creating an NPC doesn't connect them to scenes.

### 1.1 — Contextual Generation ("Generate Here")

Every entity list gets a context-aware generator:

- Viewing a scene? "Generate NPC" → NPC auto-linked to that scene
- Viewing a location? "Generate NPC" → NPC whose workplace is that location
- Viewing a faction? "Generate NPC" → NPC auto-assigned as faction member
- Viewing an adventure? "Generate Scene" → Scene within that adventure
- **NEW:** Viewing a plot? "Generate Scene" → Scene that advances that plot thread

### 1.2 — Session Prep Wizard

Guided 5-minute workflow replacing the blank SessionLogEditor:

```
Step 1: "Which adventure are we continuing?"  → Select/create adventure
Step 2: "Which scenes do you expect to run?"  → Select/reorder/create scenes
Step 3: "Any new NPCs or locations needed?"   → Quick-generate with context
Step 4: "What plots should advance?"          → Select plots, AI suggests hooks
Step 5: "Review & Go!"                        → Prep document → one-click Go Live
```

Each step skippable. Wizard populates session log automatically.

### 1.3 — Scene Builder (Inline, Not Separate)

- AdventureEditor gets a **Scenes tab** with expandable inline cards
- Each card: title, type, location, NPCs, read-aloud preview
- "Add Scene" opens inline generator (no modal, no sidebar click)
- Drag-and-drop reordering within the adventure view
- **"AI: Suggest next scene"** — reads adventure context and proposes what comes next

### 1.4 — Quick Entity Cards (Popovers)

Hovering/clicking any entity name anywhere shows a **Quick Card**:

- Name, key traits, role, relationships, last-modified
- Action buttons: "Edit," "Link to Scene," "Add to Encounter"
- Works everywhere: scene NPC lists, sidebar, dashboards, session notes, relationship graph

### 1.5 — Global Search (Cmd+K)

**Critical gap vs every competitor.** Currently zero search capability.

- `Cmd+K` / `Ctrl+K` opens command palette
- Searches across ALL entity types: NPCs, locations, factions, items, articles, scenes, session logs
- Fuzzy matching with type icons
- Recent items section
- Action shortcuts: "Create NPC," "Start Session," "Open DM Coach"
- Search within entity content (not just titles)

---

## Phase 2: Fun & Friction-Free Interface

**Problem:** The app feels like a database form. The visual language doesn't spark creativity.

### 2.1 — Conversational Generation as Default

Replace form-based generators with chat as the primary creation mode:

- "Tell me about the NPC you're imagining" → multi-turn → preview card updates live
- "I don't know yet, surprise me" → AI proposes, DM reacts, iterate
- Clickable prompt chips: "A mysterious merchant," "A rival adventurer," "Someone from the player's backstory"
- **Existing strength:** EntityChatGenerator and RealmChat already support this — make it the default path, not the alternative

### 2.2 — Inline Field Regeneration

In any editor, individual fields get a "regenerate" sparkle icon:

- Click next to "Personality Traits" → AI regenerates just that field
- Click next to "Backstory" → AI rewrites keeping everything else
- Optional tweak instruction: "Make them more sinister"
- **Existing strength:** `generateEnhancedText()` already exists — wire it to per-field buttons

### 2.3 — Rich Dashboard Cards

Dashboards show rich previews without requiring clicks:

- NPC cards: portrait placeholder, race/class, personality snippet, faction badge
- Location cards: type icon, atmosphere snippet, connected locations count
- Adventure cards: scene count, level range, completion percentage
- Session cards: status badge (planned/active/completed), date, linked adventure
- **Faction cards:** member count, influence level, alignment badge
- Clicking opens editor; most browse tasks don't need it

### 2.4 — Tabbed Editor Layout

Restructure long vertical forms into tabbed layouts:

- **NPC Editor:** Identity | Personality | Stats | Relationships | History
- **Location Editor:** Overview | Points of Interest | Connections | Loot
- **Scene Editor:** Narrative (read-aloud, GM notes) | Mechanics (skill checks, rewards) | Cast (NPCs, location)
- **Adventure Editor:** Overview | Scenes (inline builder) | Prep Doc

Each tab fits on one screen. No scrolling through 20 fields.

### 2.5 — Dark Fantasy Visual Polish

- Subtle parchment/vellum textures for entity cards
- Animated view transitions (slide, not jump)
- "Quill writing" animation during AI generation (replaces spinner)
- Warm amber glow on interactive elements
- Optional sound effects: dice clatter, generation complete, session start/end
- Custom fantasy fonts for headings (Merriweather already in use — good)
- Dark mode refined: richer contrast, better visual hierarchy

### 2.6 — Keyboard-First Power Users

- `Cmd+K` — Global search/command palette
- `Cmd+N` — New entity (context-aware)
- `Cmd+S` — Force save
- `Cmd+G` — Open generator
- `Escape` — Close panel/modal, deselect
- `Cmd+Enter` — Submit/generate
- Arrow keys to navigate sidebar items
- `/` in any text field triggers AI assist

---

## Phase 3: Plot Coherence & World Intelligence

**Problem:** DMs create content but the app doesn't help them stay coherent. Plot threads get lost.

### 3.1 — Enhanced Plot Thread Tracker

Upgrade from simple tracker to active coherence engine:

- **Plot Timeline:** Visual timeline showing which sessions advanced which plots (like LegendKeeper's timeline but plot-focused)
- **Plot Health Alerts:** "The Missing Heir hasn't been touched in 3 sessions" warnings
- **Plot-Scene Linking:** When creating scenes, AI suggests which plots could advance
- **Plot Resolution Assistant:** When a plot climaxes, AI suggests resolution scenarios
- **Dangling Thread Detection:** AI flags NPCs/locations/factions not connected to any active plot

### 3.2 — Relationship Intelligence

Surface relationships everywhere:

- **NPC cards** show faction, location, and relationship badges inline
- **Scene cast panel** shows relationship web: "These two are rivals"
- **DM Coach** receives relationship context: "Remind the party that Grak and Thessa have history"
- **Auto-suggest tension:** "Grak is in this scene and hates the faction the party just helped"
- **Relationship Graph** (exists) — enhance with filtering by relationship type, session-based highlighting

### 3.3 — Continuity Checker (ENHANCE EXISTING)

The ConsistencyDashboard exists but needs intelligence:

- "NPC Aldric was killed in Session 5 but is still in Scene 3 of the current adventure"
- "The party has the Amulet of Storms but it's listed in Dragon's Lair"
- "Plot 'The Missing Heir' was resolved but Lyra still has motivation 'Find the heir'"
- Runs automatically before session start; DM can dismiss or fix
- **Severity levels:** Error (contradiction), Warning (stale), Info (suggestion)

### 3.4 — Smart Context Window

Replace ad-hoc context construction with priority-ranked system:

- **Tier 1 (Always):** Campaign setting, active session recap, active scene
- **Tier 2 (Contextual):** NPCs in scene, location details, active plot summaries
- **Tier 3 (On demand):** Full NPC histories, faction details, lore articles
- Context automatically tailored per AI call type
- Token budget management — truncate Tier 3 when approaching limits

### 3.5 — World Evolution Engine

**Inspired by RoleplayRev's strongest feature.** Player decisions propagate:

- When a session ends, AI identifies world-state changes:
  - Faction opinion shifts ("The Thieves' Guild now views the party as enemies")
  - NPC status changes ("Grak was convinced to betray his faction")
  - Location state changes ("The temple was destroyed in the battle")
- DM reviews and approves changes
- Approved changes auto-update entity fields
- Change history tracked per entity (EntityHistoryManager already exists)

---

## Phase 4: Reducing Note-Taking Burden

**Problem:** DMs are busy running the game. Notes pull them out of the moment.

### 4.1 — Always-On Voice Log (Session Runner)

- Voice transcription runs continuously in background (toggle on/off)
- **Existing strength:** Gemini Live API integration already exists in SessionLogEditor
- Move voice into Session Runner — no navigation required
- "Mark Important" button flags transcript segments
- Speaker diarization (future): distinguish DM voice from player voices

### 4.2 — Smart Note Structuring

AI processes transcript in real-time:

- Auto-tags entity mentions: "Grak" → links to NPC:Grak
- Auto-detects event types: combat, social interaction, discovery, plot advancement
- Structures into categories:
  - **Events:** "Party negotiated with Grak for safe passage"
  - **Decisions:** "Chose to enter the cave instead of the forest"
  - **Combat:** "Defeated 3 goblins, Lyra took 12 damage"
  - **Loot:** "Found Potion of Healing in chest"
- **Existing strength:** `analyzeSessionNotes()` already does this — make it real-time

### 4.3 — Post-Session Auto-Recap

When ending a session:

- AI generates structured recap from all notes (voice + typed + auto-events)
- Key events, NPC interactions, plot advancements, loot, decisions
- DM reviews and edits (not writing from scratch)
- **Player-facing recap** (no GM secrets) — shareable as text/markdown
- Saved to SessionLog, becomes context for next session

### 4.4 — Event-Driven Auto-Capture

The app captures events automatically:

- **Combat tracker → Session log:** "Combat: Party vs. 3 Orcs. 4 rounds. No casualties."
- **Scene transitions → Log:** "Moved to Scene 3 (The Cave) at 8:45 PM"
- **Entity creation mid-session → Log:** "New NPC: Merchant Thessa (improvised)"
- **DM Coach usage → Log:** "Used DM Coach for storm narration"
- **Dice rolls → Log:** "Rolled 17 on d20 for Perception check"

DM's notes supplement automatic logging, not replace it.

---

## Phase 5: Collaboration & Sharing

> **This is the biggest gap vs competitors.** LegendKeeper wins users with free player seats. World Anvil retains with granular permissions. Realmweaver is currently local-only.

### 5.1 — Cloud Sync & Accounts

**Foundation for everything else.**

- User accounts (email + OAuth with Google/Discord)
- Campaign data synced to cloud (Supabase or Firebase)
- Offline-first architecture: local-first with background sync
- Conflict resolution for simultaneous edits
- Campaign data remains exportable (JSON, Obsidian markdown — already exists)
- **Free tier:** 2 campaigns, 500 entities, local AI (mock mode)
- **Pro tier:** Unlimited campaigns, cloud sync, full AI access

### 5.2 — Player Portal (Free Accounts)

**Critical differentiator:** Players join for free (like LegendKeeper).

- DM shares a campaign invite link
- Players see: their character, session recaps, shared world lore, shared maps
- Players do NOT see: GM notes, secrets, upcoming scenes, plot internals
- Players CAN: update their character, add session notes, view shared articles

### 5.3 — GM Secrets System

**Inspired by LegendKeeper's best feature.**

- Any text block in any entity can be marked as `[SECRET]...[/SECRET]`
- Secrets are visible to the DM, hidden from players in the Player Portal
- DM can "reveal" a secret mid-session — it becomes visible to players in real-time
- Secrets in session recaps are auto-stripped for player-facing versions
- Visual indicator in editor: secret text has a subtle locked-border styling

### 5.4 — Shared World Wiki

Convert the existing Lorebook/Articles into a player-accessible wiki:

- DM controls which articles are "published" (visible to players)
- Auto-linking between articles (like World Anvil/LegendKeeper)
- Backlinks: "This article is referenced by: [NPC: Grak], [Location: The Keep]"
- Player search across published content
- Categories and tags for organization

### 5.5 — Session Recap Sharing

- After post-session recap generation, DM clicks "Share with Players"
- Players receive the recap in their portal (GM secrets auto-stripped)
- Optional: push notification via Discord webhook or email
- Recap history creates a "Story So Far" timeline for the whole campaign

---

## Phase 6: Maps & Spatial Worldbuilding

> **Every competitor has maps. Realmweaver has zero.** This is the #2 gap after collaboration.

### 6.1 — Interactive World Map

- Upload map images (continent, city, dungeon)
- Place pins on locations — pins link to Location entities
- Click a pin → Quick Card popover with location details
- Nested maps: continent → region → city → building → room
- Fog of war: DM reveals regions as players explore (shared via Player Portal)

### 6.2 — Battle Maps

- Upload or AI-generate grid-based battle maps
- Token placement for combatants (ties into Combat Tracker)
- Simple measurement tools (distance, area of effect)
- Scene links: each Scene can have an associated battle map
- **Not a full VTT** — intentionally lighter than Roll20/Foundry. Complements, doesn't replace.

### 6.3 — Location Hierarchy Visualization

- Interactive tree/graph of location containment (parentLocationId already exists)
- Click to navigate: World → Continent → Kingdom → City → District → Building
- Visual connection lines between linked locations (connections[] already exist)

---

## Phase 7: Delightful Onboarding & Growth

### 7.1 — First Campaign Wizard

After creating a campaign:

```
"Welcome to your new campaign! Let's get you started."

→ "Tell me about your world in a sentence or two"  → AI sets tone
→ "Want me to generate a starting adventure?"       → [Yes / I'll do it myself]
→ "Let's create a few key NPCs"                     → [Generate 3 / Skip]
→ "Any important locations?"                         → [Generate 3 / Skip]
→ "Ready to prep your first session?"                → [Session Prep / Explore]
```

Uses Evocation Wizard under the hood, presented as friendly conversation.

### 7.2 — Contextual Feature Discovery

Surface features when relevant (not a tutorial wall):

- First adventure with no scenes: "Tip: Generate scenes from a prompt. Try it!"
- First session start: "Tip: Enable voice notes to capture hands-free"
- First NPC: "Tip: Link to a faction to build your world's power structure"
- First combat: "Tip: DM Coach can improvise narration for dramatic moments"

Dismissible, non-blocking, shown once per feature.

### 7.3 — Template Campaigns

Pre-built starters:

- **"Classic Dungeon Crawl"** — 1 adventure, 5 scenes, 3 NPCs, 2 locations
- **"Political Intrigue"** — 3 factions, 6 NPCs with relationships, 2 plots
- **"Sandbox Exploration"** — 5 locations with connections, 4 NPCs, random encounter tables
- **"One-Shot Adventure"** — 1 complete adventure with all entities
- **"Curse of Strahd Starter"** — Official setting template with key NPCs/locations

Templates generated via Evocation Wizard with pre-tuned prompts.

### 7.4 — Community Content Hub

- Users can publish campaigns/adventures as templates
- Browse and import community content
- Rating/review system
- Creator profiles
- **Monetization opportunity:** Featured templates, premium templates from partner creators

### 7.5 — Multi-System Support

**World Anvil supports 100+ systems.** Realmweaver is D&D-only.

- Abstract stat blocks behind system-specific renderers
- Start with: D&D 5e (current), Pathfinder 2e, Fate, PbtA
- System selection per campaign
- AI generation adapts to system (different stat blocks, terminology)
- Community-contributed system definitions (stretch goal)

---

## Phase 8: Advanced AI & Intelligence

> **Realmweaver's core moat.** Push AI integration further than any competitor.

### 8.1 — AI World Simulation

Beyond single-entity generation — simulate the world between sessions:

- "What happened in the world while the party was away?"
- AI considers active plots, faction goals, NPC motivations, time passed
- Generates a list of off-screen events: faction movements, NPC actions, environmental changes
- DM reviews and approves — approved events become canon

### 8.2 — Adaptive Difficulty Engine

- Track party level, composition, resources across sessions
- AI adjusts encounter difficulty suggestions automatically
- "Your party of 4 level-5 characters with a depleted cleric should face Medium encounters"
- CR-appropriate monster/NPC stat suggestions
- Encounter balance warnings in scene editor

### 8.3 — Player Behavior Prediction

- AI analyzes past session notes for player patterns:
  - "Your players tend to negotiate rather than fight — consider more social encounters"
  - "The rogue always investigates alone — set up an ambush opportunity"
  - "The party has ignored the main quest for 2 sessions — consider a hook"
- Suggestions appear during session prep, not during play (non-intrusive)

### 8.4 — Content Style Matching

- AI learns the DM's writing voice from existing content
- Generated descriptions match the DM's tone (dark & gritty vs. whimsical vs. epic)
- Style profile built from first 5-10 entities, refined over time
- "Write like my other NPCs" becomes implicit in all generation

### 8.5 — Cross-Campaign Intelligence

- AI draws connections across campaigns by the same DM
- "You used a similar villain archetype in Campaign 2 — want to differentiate?"
- Reuse entities across campaigns with adaptation
- DM's personal entity library (NPCs, locations, items that appear in multiple worlds)

---

## Implementation Priority Matrix

| Phase | Impact | Effort | Priority | Competitive Value |
|-------|--------|--------|----------|-------------------|
| **0: Session Cockpit** | Very High | Medium | **P0** | Unique — no competitor has this |
| **1: World-to-Session Pipeline** | High | Medium | **P1** | Differentiator |
| **4: Note-Taking Reduction** | High | Medium | **P1** | Unique (voice + AI) |
| **5: Collaboration & Sharing** | Very High | Very High | **P1** | Table stakes — must have |
| **3: Plot Coherence** | High | Medium | **P2** | Strong differentiator |
| **2: Fun Interface** | Medium | Medium | **P2** | Catch-up to LegendKeeper UX |
| **6: Maps** | High | High | **P2** | Table stakes — must have |
| **7: Onboarding & Growth** | Medium | Low-Med | **P3** | Growth driver |
| **8: Advanced AI** | High | High | **P3** | Long-term moat |

---

## Sprint Roadmap

### Sprint 1 — Session Cockpit Completion (2-3 weeks)
1. Dice roller component (integrated into Session Runner)
2. Session Runner quick tools panel (DM Coach, dice, tables)
3. Running log with auto-event capture
4. Combat auto-population from scene NPCs
5. One-click "Go Live" polish
6. Tablet-responsive Session Runner layout

### Sprint 2 — Generation & Search (2-3 weeks)
7. Global search / command palette (Cmd+K)
8. Contextual "Generate Here" buttons
9. Conversational generation as default path
10. Inline field regeneration buttons
11. Quick Entity Card popovers

### Sprint 3 — Session Intelligence (2-3 weeks)
12. Smart Session End with AI recap + player-facing export
13. Real-time voice note structuring
14. Event-driven auto-capture (combat → log, scene transition → log)
15. Session Prep Wizard

### Sprint 4 — World Coherence (2-3 weeks)
16. Enhanced Plot Timeline visualization
17. Continuity Checker with severity levels
18. World Evolution Engine (post-session state propagation)
19. Smart Context Window (tiered)
20. Relationship Intelligence in Scene cast panels

### Sprint 5 — Visual & UX Polish (2-3 weeks)
21. Rich dashboard cards with previews
22. Tabbed editor layouts
23. Dark fantasy visual polish pass
24. Animated transitions
25. Keyboard shortcuts
26. Inline scene builder in AdventureEditor

### Sprint 6 — Cloud & Accounts (3-4 weeks)
27. User authentication (email + OAuth)
28. Cloud database (Supabase/Firebase)
29. Offline-first sync architecture
30. Campaign backup/restore
31. Migration from LocalStorage to cloud

### Sprint 7 — Collaboration (3-4 weeks)
32. Player Portal (read-only campaign view)
33. Free player accounts with invite links
34. GM Secrets system ([SECRET] blocks)
35. Shared world wiki from Lorebook
36. Session recap sharing

### Sprint 8 — Maps & Spatial (3-4 weeks)
37. Image upload for world/region/dungeon maps
38. Pin-to-entity linking on maps
39. Nested map drill-down
40. Location hierarchy visualization
41. Fog of war (basic)

### Sprint 9 — Growth & Polish (2-3 weeks)
42. First Campaign Wizard
43. Template campaigns
44. Contextual feature discovery tooltips
45. Multi-system support (Pathfinder 2e)
46. Community content hub (v1)

### Sprint 10 — Advanced AI (ongoing)
47. AI World Simulation (between-session events)
48. Adaptive difficulty engine
49. Content style matching
50. Player behavior analysis
51. Cross-campaign intelligence

---

## Success Metrics

### Session Experience
| Metric | Current | Target |
|--------|---------|--------|
| Clicks to start a session | ~8 | 1-2 |
| Views visited during active session | ~4 | 1 (Session Runner) |
| Manual notes per session | 100% manual | 70% auto-captured |
| Time from campaign create to first session | ~30 min | ~5 min |

### World Coherence
| Metric | Current | Target |
|--------|---------|--------|
| Entities not linked to anything | Unknown (high) | <10% |
| Plot threads dormant >3 sessions | No tracking | Alerts triggered |
| Continuity errors caught pre-session | 0 | 80%+ |

### Growth & Engagement
| Metric | Current | Target (6 months) |
|--------|---------|-------------------|
| Campaigns with >1 user | 0 (local only) | 40% of active campaigns |
| Session Runner adoption | New feature | 70% of sessions use it |
| Returning users (weekly) | Unknown | 60% retention |
| Player Portal accounts | 0 | 3:1 player-to-DM ratio |

### Competitive Parity
| Feature | RoleplayRev | World Anvil | LegendKeeper | Realmweaver Target |
|---------|-------------|-------------|--------------|-------------------|
| AI Generation | Deep | Basic | None | **Deepest** |
| Session Tools | None | Basic | None | **Best-in-class** |
| Collaboration | None | Good | Best | **Good** (free player seats) |
| Maps | Battlemaps | Full interactive | Full interactive | **Good** (pins + nested) |
| Search | Basic | Good | Full-text | **Excellent** (Cmd+K) |
| Mobile | Mobile-web | Improving | Planned | **Good** (responsive) |
| Data Export | None | Limited | Excellent | **Good** (JSON + Obsidian) |
| Onboarding | Low friction | High friction | Low friction | **Lowest friction** |

---

## Technical Debt & Architecture

Address alongside feature work:

- **App.tsx decomposition** — SessionRunner already extracts session logic. Continue splitting by concern.
- **Context construction** — Replace ad-hoc string building with tiered context service
- **State management** — Current Immer store works locally; needs adapter layer for cloud sync
- **Undo system** — Global undo stack for entity CRUD operations
- **TypeScript strictness** — Fix RelationshipGraph.tsx type errors, enable stricter config
- **Code splitting** — Dynamic imports for Session Runner, Maps, Combat Tracker (reduce bundle from 915KB)
- **Testing** — Add Vitest unit tests for campaign service, AI service response parsing
- **API abstraction** — Current Gemini-only; abstract for potential multi-provider support

---

## Monetization Strategy

| Tier | Price | Includes |
|------|-------|---------|
| **Free** | $0 | 2 campaigns, 200 entities, mock mode AI, local storage only |
| **Adventurer** | $7/mo ($5/mo annual) | Unlimited campaigns/entities, full AI, cloud sync, 1 shared campaign |
| **Dungeon Master** | $12/mo ($9/mo annual) | Everything + unlimited sharing, Player Portal, maps, priority AI |
| **Guild** | $25/mo | Team features: 5 DM seats, shared entity library, custom branding |

**Key decisions:**
- Player accounts are always free (LegendKeeper model — reduces adoption friction)
- AI generation is the premium driver (free tier gets mock mode only)
- Cloud sync is premium (local-only free tier still fully functional)
- No per-seat pricing for players — only DMs pay

---

## Claude Workplan — Agent Orchestration Blueprint

> **Purpose:** This section defines how a Claude orchestrator agent can independently spin up parallel and sequential sub-agents to execute the UX overhaul. Each work package specifies the agent's scope, required context, files to read/modify, dependencies, and acceptance criteria.

### How to Use This Document

An **orchestrator agent** reads this section and spawns sub-agents for each work package. The orchestrator:

1. Reads `CLAUDE.md` and this plan in full before spawning any agents.
2. Spawns agents respecting the **dependency graph** — never start a work package whose prerequisites are incomplete.
3. Maximizes parallelism within each sprint (agents with no mutual dependencies run concurrently).
4. After each agent completes, runs `npm run build` to verify zero TypeScript errors before moving on.
5. Uses **worktree isolation** (`isolation: "worktree"`) for each agent so parallel work doesn't conflict. Merge completed worktree branches sequentially.

### Global Context — Every Agent Must Read

Every agent receives these files as mandatory pre-read context before starting work:

```
MUST READ (Architecture & Conventions):
├── CLAUDE.md                           # Full project conventions, patterns, pitfalls
├── types/index.ts                      # All type barrel exports
├── services/campaignService.ts         # State management (skim structure, read relevant CRUD)
├── services/geminiService.ts           # AI facade — understand mock mode pattern
├── components/common/Icons.tsx         # Icon import source (NEVER import from lucide-react)
├── components/common/Button.tsx        # Shared button component
├── App.tsx                             # EditorView routing, state wiring
└── components/layout/CampaignSidebar.tsx # Navigation structure
```

### Naming Conventions for New Files

- Components: `components/<category>/ComponentName.tsx` — named export, `React.FC<Props>` pattern
- Types: `types/TypeName.ts` — add `export * from './TypeName'` to `types/index.ts`
- Services: `services/ai/serviceName.ts` — always add facade in `geminiService.ts`
- Utils: `utils/utilName.ts`

---

### Sprint 1 — Session Cockpit Completion

> **Prerequisite:** None (foundation already exists in `SessionRunner.tsx`)

#### Agent 1A: Dice Roller Component

**Type:** Implementation agent
**Parallelizable with:** 1B, 1C, 1D
**Estimated scope:** ~300–400 lines new component

**Task:** Build a self-contained dice roller component and integrate it into the Session Runner.

**Context files to read:**
```
components/views/SessionRunner.tsx       # Integration target — "Dice / Tables" button is a placeholder
components/tools/CombatTracker.tsx       # Reference for tool panel UI patterns
types/SessionLog.ts                      # For dice roll log persistence
services/campaignService.ts              # For persisting roll history to session
```

**Deliverables:**
1. `components/tools/DiceRoller.tsx` — Standalone dice roller component
   - Die buttons: d4, d6, d8, d10, d12, d20, d100 with quantity selector
   - Formula parser: `2d6+4`, `4d6kh3` (keep highest N), `2d20kl1` (keep lowest = disadvantage)
   - Advantage/disadvantage quick-toggle buttons
   - Roll history list (last 20 rolls), each showing: formula, individual dice, total
   - "Roll on Table" integration point (accepts a `RollableTable` prop, rolls d100 against it)
   - All state local to component except explicit "log to session" action
2. `types/DiceRoll.ts` — Type definition: `{ id, formula, results: number[], total, timestamp, note? }`
3. Update `types/index.ts` — Add barrel export
4. Update `SessionRunner.tsx` — Replace the placeholder "Dice / Tables" button with the DiceRoller rendered in a collapsible panel in the quick tools area
5. Update `services/campaignService.ts` — Add `addDiceRollToSession(roll: DiceRoll)` method that appends to `sessionLog.diceRolls[]`
6. Update `types/SessionLog.ts` — Add `diceRolls?: DiceRoll[]` field

**Acceptance criteria:**
- Rolling dice produces correct random results
- Formula parser handles: `NdX`, `NdX+M`, `NdXkhY`, `NdXklY`
- Roll history renders in the Session Runner
- `npm run build` passes with zero errors

---

#### Agent 1B: Session Runner Quick Tools Panel

**Type:** Implementation agent
**Parallelizable with:** 1A, 1C, 1D

**Task:** Enhance the Session Runner's right panel with fully wired quick tool buttons. Currently the buttons exist but are mostly non-functional.

**Context files to read:**
```
components/views/SessionRunner.tsx       # Current quick tools panel (lines 280–338)
components/dialogs/DmCoach.tsx           # DM Coach integration — already wired via onOpenCoach
components/tools/CombatTracker.tsx       # Combat tracker — needs inline embed option
App.tsx                                  # How combat tracker is currently rendered (lines 519–526)
types/Encounter.ts                       # Combat encounter type
services/campaignService.ts              # updateEncounter, combat-related methods
```

**Deliverables:**
1. Update `SessionRunner.tsx` quick tools panel:
   - **Combat Tracker button:** When clicked from a combat scene, auto-populate combatants from `scene.npcIds` + `campaign.playerCharacters`. Open as a slide-out panel within the Session Runner (not a navigation change).
   - **Quick NPC button:** Opens a minimal inline NPC generator (prompt field + generate button) that creates an NPC and auto-links to the current scene.
   - **Plot Tracker button:** Shows active plots from `sessionLog.relatedPlotIds` with status toggles (advanced/stalled/resolved).
2. Wire the Combat Tracker button to call `campaignService.updateEncounter()` and auto-populate from scene NPCs:
   ```typescript
   const combatants = [
     ...activeSceneNpcs.map(npc => ({ id: npc.id, name: npc.name, type: 'npc', ... })),
     ...campaign.playerCharacters.map(pc => ({ id: pc.id, name: pc.name, type: 'pc', ... }))
   ];
   ```

**Acceptance criteria:**
- Combat button auto-populates combatants from current scene
- Quick NPC generates and links to active scene
- Plot tracker shows/updates plot statuses
- All buttons function within Session Runner without navigating away

---

#### Agent 1C: Running Log with Auto-Event Capture

**Type:** Implementation agent
**Parallelizable with:** 1A, 1B, 1D

**Task:** Enhance the Session Runner's bottom running log to capture events automatically and support tagging.

**Context files to read:**
```
components/views/SessionRunner.tsx       # Current running log (lines 342–378)
types/SessionLog.ts                      # structuredNotes type, StructuredNote interface
services/campaignService.ts              # addSessionRunnerNote, advanceScene, setSceneStatus
```

**Deliverables:**
1. Update `types/SessionLog.ts` — Extend `StructuredNote`:
   ```typescript
   interface StructuredNote {
     id: string;
     timestamp: string;
     content: string;
     type: 'manual' | 'scene-transition' | 'combat' | 'npc-created' | 'dice-roll' | 'coach-used';
     tags?: string[];
     isImportant?: boolean;
   }
   ```
2. Update `services/campaignService.ts`:
   - Add `addAutoEvent(type, content)` method that creates a StructuredNote with the appropriate type
   - Hook auto-events into existing methods:
     - `advanceScene()` → logs `"Moved to Scene: {title}"`
     - `setSceneStatus()` → logs scene status changes
     - `updateEncounter()` when combat ends → logs combat summary
3. Update `SessionRunner.tsx` running log:
   - Color-code entries by type (manual=white, scene-transition=blue, combat=red, etc.)
   - Add tag buttons above input: `[Combat] [NPC] [Decision] [Loot]` — clicking pre-tags the next note
   - Add "Mark Important" star toggle on each note entry
   - Add `isImportant` filter toggle to show only starred entries

**Acceptance criteria:**
- Scene transitions automatically appear in the log
- Manual notes can be tagged
- Important notes can be starred and filtered
- Log entries are visually distinguished by type

---

#### Agent 1D: One-Click Session Start ("Go Live" Polish)

**Type:** Implementation agent
**Parallelizable with:** 1A, 1B, 1C

**Task:** Polish the "Go Live" flow so clicking it from a session log primes the full Session Runner with complete context.

**Context files to read:**
```
components/editors/SessionLogEditor.tsx   # Where "Go Live" button lives
components/views/SessionRunner.tsx        # Target view
services/campaignService.ts              # goLive() method (find it)
App.tsx                                  # handleGoLive (lines 348–352)
```

**Deliverables:**
1. Update `campaignService.goLive(sessionLogId)`:
   - Set session status to `'active'`
   - Set `campaign.activeSessionId`
   - Auto-set `campaign.activeSceneId` to first planned scene (if any)
   - Set first planned scene status to `'in-progress'`
   - Log an auto-event: `"Session started: {title}"`
2. Update `SessionRunner.tsx`:
   - On mount, if `previousSession?.recap` exists, show a dismissible "Previously..." banner at the top
   - Surface active plots in a more prominent position (currently buried in right panel)
3. Update `SessionLogEditor.tsx`:
   - Add pre-flight checklist before "Go Live": adventure selected?, scenes planned?, plots linked?
   - Disable "Go Live" if no adventure is linked (with helpful tooltip)

**Acceptance criteria:**
- One click from session log enters Session Runner with scene active
- Previous session recap is visible
- Missing prerequisites show warnings

---

#### Agent 1E: Tablet-Responsive Session Runner

**Type:** Implementation agent
**Prerequisites:** Agents 1A–1D complete (works on the final merged SessionRunner)

**Task:** Make the Session Runner touch-friendly and tablet-responsive.

**Context files to read:**
```
components/views/SessionRunner.tsx       # Full component after 1A–1D merges
components/layout/CampaignSidebar.tsx    # Reference for existing mobile responsive pattern
```

**Deliverables:**
1. Update `SessionRunner.tsx` layout:
   - Below `md` breakpoint: collapse 3-column layout into single-column with tab navigation (Scenes | Scene | Tools | Log)
   - Scene list becomes a horizontal swipeable carousel on mobile
   - Quick tools collapse into a floating action button (FAB) menu
   - Read-aloud text gets a larger font toggle ("Present Mode")
   - Touch targets minimum 44px
   - Running log slides up from bottom as a sheet
2. All Tailwind responsive — no JS media queries needed

**Acceptance criteria:**
- Session Runner usable on iPad-sized screens (768px+)
- No horizontal scrolling at any breakpoint
- Touch targets are finger-friendly

---

### Sprint 2 — Generation & Search

> **Prerequisite:** Sprint 1 complete (Session Runner is stable)

#### Agent 2A: Global Search / Command Palette (Cmd+K)

**Type:** Implementation agent
**Parallelizable with:** 2B, 2C, 2D

**Task:** Build a Cmd+K command palette that searches across all entity types.

**Context files to read:**
```
App.tsx                                  # EditorView routing, handleSelect for navigation
types/Campaign.ts                        # Campaign shape — all entity arrays
types/NPC.ts, types/Location.ts, etc.    # Entity shapes for search indexing
services/campaignService.ts              # getState() for accessing campaign data
components/common/Icons.tsx              # Entity type icons
```

**Deliverables:**
1. `components/common/CommandPalette.tsx` — Modal overlay component:
   - Triggered by `Cmd+K` / `Ctrl+K` (register global keydown listener in App.tsx)
   - Text input with autofocus
   - Fuzzy search across: NPCs, Locations, Factions, Items, Adventures, Articles, Session Logs, Plots
   - Search by name AND content (description, traits, backstory, etc.)
   - Results grouped by type with type icons
   - Recent items section (last 5 viewed, stored in localStorage)
   - Action shortcuts section: "Create NPC", "Start Session", "Open DM Coach", "Open Evocation Wizard"
   - Enter/click navigates to entity (calls `handleSelect`)
   - Escape closes
2. Update `App.tsx`:
   - Add `useEffect` for global `Cmd+K` keyboard listener
   - Render `CommandPalette` when open
   - Pass `handleSelect` and action callbacks

**Implementation notes:**
- Use a simple scoring function: exact match > starts-with > includes > content match
- No external fuzzy search library needed — keep it lightweight
- Debounce search input by 150ms

**Acceptance criteria:**
- Cmd+K opens palette from anywhere in the app
- Searching "Grak" finds NPC Grak
- Searching "tavern" finds locations/scenes with "tavern" in any field
- Clicking a result navigates to that entity's editor
- Action shortcuts work (create NPC, open coach, etc.)

---

#### Agent 2B: Contextual "Generate Here" Buttons

**Type:** Implementation agent
**Parallelizable with:** 2A, 2C, 2D

**Task:** Add context-aware "Generate" buttons that auto-link created entities to the current context.

**Context files to read:**
```
components/editors/SceneEditor.tsx       # Add "Generate NPC for this scene" button
components/editors/LocationEditor.tsx    # Add "Generate NPC at this location" button
components/editors/FactionEditor.tsx     # Add "Generate NPC in this faction" button
components/editors/AdventureEditor.tsx   # Add "Generate Scene for this adventure" button
components/editors/PlotEditor.tsx        # Add "Generate Scene advancing this plot" button
components/generators/NpcGenerator.tsx   # Existing NPC generator — accept optional preContext
services/geminiService.ts               # AI generation functions
services/campaignService.ts             # Entity creation + linking methods
```

**Deliverables:**
1. Add a shared `QuickGenerateButton` component or inline pattern:
   ```typescript
   // Pattern: a small "✨ Generate NPC" button that opens inline mini-generator
   // with pre-filled context like "Generate an NPC who works at {location.name}"
   ```
2. Update editors:
   - `SceneEditor.tsx` NPC list section: + "Generate NPC for this scene" → creates NPC, calls `linkSceneToNpcs`
   - `LocationEditor.tsx`: + "Generate NPC at this location" → creates NPC with location context in prompt
   - `FactionEditor.tsx` member list: + "Generate member" → creates NPC, calls `linkNpcToFaction`
   - `AdventureEditor.tsx` scene list: + "Generate next scene" → creates scene within adventure
   - `PlotEditor.tsx`: + "Generate scene advancing this plot" → creates scene with plot context
3. Each button:
   - Shows a one-line prompt field + Generate button (inline, not modal)
   - Pre-fills prompt with context: "An NPC who is a member of {faction.name} and operates in {setting}"
   - On generate: creates entity via `geminiService`, then calls the appropriate `campaignService` link method
   - Shows loading spinner during generation

**Acceptance criteria:**
- Generating NPC from a scene auto-links NPC to that scene
- Generating NPC from a faction auto-assigns membership
- Generated content reflects the contextual prompt
- Works in both mock and live mode

---

#### Agent 2C: Conversational Generation as Default

**Type:** Implementation agent
**Parallelizable with:** 2A, 2B, 2D

**Task:** Make chat-based entity creation the default path in all dashboards, with form-based as the fallback.

**Context files to read:**
```
components/generators/EntityChatGenerator.tsx  # Existing chat generator
components/RealmChat/RealmChatWidget.tsx        # Existing chat widget pattern
components/dashboards/NpcDashboard.tsx          # Current form-based generator embed
components/dashboards/LocationDashboard.tsx     # Same pattern
components/dashboards/FactionDashboard.tsx
components/dashboards/ItemDashboard.tsx
components/dashboards/ArticleDashboard.tsx
services/geminiService.ts                       # chatWithRealmWeaver function
```

**Deliverables:**
1. Update all dashboards to show EntityChatGenerator as the primary "Create" experience:
   - "Create" button opens chat interface first (not form)
   - Chat interface shows clickable prompt chips: contextual suggestions like "A mysterious merchant", "A rival adventurer"
   - "Switch to form" link available for users who prefer direct input
   - Chat produces entity preview card that updates live as conversation progresses
2. Add prompt chip suggestions per entity type:
   - NPC: "A mysterious merchant", "A rival adventurer", "A corrupt official", "Surprise me"
   - Location: "A hidden temple", "A bustling market", "A dangerous wilderness"
   - Faction: "A criminal underworld", "A noble house", "A religious order"
   - etc.
3. Ensure `EntityChatGenerator` or equivalent handles all entity types

**Acceptance criteria:**
- Chat is the first thing users see when creating entities
- Prompt chips are clickable and start conversations
- Users can still switch to form-based generation
- Created entities are properly typed and saved

---

#### Agent 2D: Quick Entity Card Popovers

**Type:** Implementation agent
**Parallelizable with:** 2A, 2B, 2C

**Task:** Build hover/click popovers that show entity summaries everywhere entity names appear.

**Context files to read:**
```
components/views/SessionRunner.tsx       # NPC names in scene panel
components/editors/SceneEditor.tsx       # NPC and location references
components/layout/CampaignSidebar.tsx    # Entity names in nav
types/NPC.ts, types/Location.ts, etc.   # Entity fields for card content
```

**Deliverables:**
1. `components/common/EntityQuickCard.tsx` — Popover component:
   - Props: `entityType`, `entityId`, `campaign` (to look up the entity)
   - Renders: name, key traits/description, type-specific badges, last-modified
   - Action buttons: "Edit" (navigates), "Link to Scene" (if in scene context), "Add to Encounter"
   - Positions relative to trigger element (above/below/left/right based on viewport)
   - Click-outside or Escape to dismiss
2. `components/common/EntityLink.tsx` — Wrapper component:
   - Renders entity name as a styled link
   - On hover (desktop) or click (mobile): shows EntityQuickCard
   - Props: `entityType`, `entityId`, `campaign`, `onNavigate`
3. Integrate `EntityLink` in key locations:
   - Session Runner NPC cards
   - Scene Editor NPC/location references
   - Dashboard cards (faction badge on NPC, location on NPC, etc.)

**Acceptance criteria:**
- Hovering an NPC name in Session Runner shows a quick card
- Quick card shows relevant entity info without navigating
- "Edit" button navigates to entity editor
- Card dismisses properly

---

#### Agent 2E: Inline Field Regeneration

**Type:** Implementation agent
**Parallelizable with:** 2A, 2B, 2C, 2D

**Task:** Add per-field AI regeneration sparkle buttons to all entity editors.

**Context files to read:**
```
services/geminiService.ts               # generateEnhancedText() — already exists
components/editors/NpcEditor.tsx         # Target editor — add sparkle buttons per field
components/editors/LocationEditor.tsx    # Same
components/editors/FactionEditor.tsx     # Same
components/editors/ItemEditor.tsx        # Same
```

**Deliverables:**
1. `components/common/RegenerateButton.tsx` — Small sparkle icon button:
   - Props: `fieldName`, `currentValue`, `entityContext`, `onRegenerated`, `isMockMode`
   - On click: opens a small popover with optional tweak instruction ("Make them more sinister")
   - Calls `generateEnhancedText()` with prompt: "Regenerate the {fieldName} for this {entityType}. Current value: {currentValue}. {tweakInstruction}. Context: {entityContext}"
   - Shows loading spinner, then calls `onRegenerated(newValue)`
2. Integrate into editors:
   - NPC: personality, backstory, appearance, motivations, speech patterns, traits
   - Location: description, atmosphere, points of interest descriptions
   - Faction: description, goals, reputation
   - Item: description, history, mechanics
3. Each sparkle button positioned at the top-right of its field's container

**Acceptance criteria:**
- Clicking sparkle next to "Backstory" regenerates only that field
- Optional tweak instruction modifies the output
- Original value is preserved until user accepts the regeneration
- Works in mock mode

---

### Sprint 3 — Session Intelligence

> **Prerequisite:** Sprint 1 complete (Session Runner exists with running log)

#### Agent 3A: Smart Session End with AI Recap

**Type:** Implementation agent
**Parallelizable with:** 3B, 3C

**Task:** Build the session end flow: AI generates a structured recap, DM reviews, optional player-facing export.

**Context files to read:**
```
components/views/SessionRunner.tsx       # End session button, handleEndSession
services/campaignService.ts             # endSession() method
services/geminiService.ts               # analyzeSessionNotes, generateEnhancedText
services/ai/dmCoach.ts                  # analyzeSessionNotes implementation
types/SessionLog.ts                     # recap, looseEnds fields
```

**Deliverables:**
1. `components/dialogs/SessionEndWizard.tsx` — Multi-step modal:
   - **Step 1 — AI Recap:** Show loading while AI processes all session notes (structuredNotes + runningNotes). Display generated recap in editable textarea. DM can edit before saving.
   - **Step 2 — Plot Updates:** Show checkboxes for related plots: "Which plots advanced?" with options: advanced / stalled / resolved / new plot. Pre-checked based on AI suggestion.
   - **Step 3 — Loose Ends:** AI-suggested "unresolved threads" from session notes. DM confirms/edits. Saved to `sessionLog.looseEnds`.
   - **Step 4 — Player Recap (optional):** Toggle to generate a player-facing version (GM secrets stripped). Copy-to-clipboard button.
   - **Finish:** Saves recap, updates plots, archives encounter, clears active session state.
2. Update `services/geminiService.ts`:
   - Add `generateSessionRecap(notes, campaignContext, isMockMode)` facade
3. Update `services/ai/dmCoach.ts`:
   - Add `generateSessionRecap()` implementation using structured prompt
4. Update `services/ai/mockService.ts`:
   - Add mock for `generateSessionRecap()`
5. Wire `SessionEndWizard` into Session Runner's "End Session" flow (replace simple confirm)

**Acceptance criteria:**
- Ending a session shows the wizard, not a simple confirm
- AI generates a recap from session notes
- DM can edit recap before saving
- Plot statuses are updated
- Player-facing recap strips GM-only content

---

#### Agent 3B: Session Prep Wizard

**Type:** Implementation agent
**Parallelizable with:** 3A, 3C

**Task:** Build a guided session prep workflow that replaces the blank session log creation experience.

**Context files to read:**
```
components/editors/SessionLogEditor.tsx   # Current session log editing
components/dashboards/SessionLogDashboard.tsx  # Where "Create" happens
types/SessionLog.ts                       # Session log shape
types/Adventure.ts, types/Scene.ts        # Adventure/scene linking
types/Plot.ts                             # Plot linking
services/campaignService.ts               # createSessionLog, scene/adventure methods
```

**Deliverables:**
1. `components/dialogs/SessionPrepWizard.tsx` — Multi-step wizard:
   - **Step 1:** "Which adventure?" — Select existing or create new. Shows adventure cards.
   - **Step 2:** "Which scenes?" — Checkbox list of adventure scenes. Drag to reorder. "Generate new scene" inline button.
   - **Step 3:** "NPCs & Locations needed?" — AI scans selected scenes, surfaces NPCs/locations not yet created. Quick-generate buttons.
   - **Step 4:** "Which plots advance?" — Checkbox list of active plots. AI suggests plot hooks based on selected scenes.
   - **Step 5:** "Review & Go!" — Summary card showing: adventure, scene count, NPCs, locations, plots. "Save as Prep" and "Go Live" buttons.
2. Trigger: Replace or augment "Create Session Log" button in `SessionLogDashboard.tsx` with "Prep Next Session" that opens the wizard
3. Wizard creates the SessionLog with all fields pre-populated

**Acceptance criteria:**
- Each step is skippable
- Wizard creates a fully-linked session log
- "Go Live" from step 5 enters Session Runner
- Works with campaigns that have no adventures (graceful empty state)

---

#### Agent 3C: Event-Driven Auto-Capture

**Type:** Implementation agent
**Parallelizable with:** 3A, 3B
**Depends on:** Agent 1C (running log with auto-event support)

**Task:** Wire auto-capture events from combat tracker, scene transitions, entity creation, and DM Coach into the session log.

**Context files to read:**
```
services/campaignService.ts             # All mutation methods that should trigger events
components/tools/CombatTracker.tsx       # Combat end events
components/dialogs/DmCoach.tsx           # Coach usage events
components/views/SessionRunner.tsx       # Scene transition events (already partially wired by 1C)
```

**Deliverables:**
1. Update `services/campaignService.ts` — Add auto-event logging to mutation methods (only when `activeSessionId` is set):
   - `createNpc()` during active session → log `"New NPC improvised: {name}"`
   - `updateEncounter()` when all combatants defeated → log `"Combat ended: {summary}"`
   - `createItem()` during session → log `"Item created: {name}"`
2. Update `components/dialogs/DmCoach.tsx`:
   - After generating narration/table/check, log `"DM Coach: Generated {type}"`
   - Requires access to `campaignService.addAutoEvent()`
3. Auto-capture dice rolls (integration point for Agent 1A's DiceRoller):
   - When dice are rolled AND "log to session" is enabled, auto-capture the roll

**Acceptance criteria:**
- Combat resolution auto-logs to running notes
- NPC creation during active session auto-logs
- DM Coach usage auto-logs
- Events appear in running log with correct type/color coding

---

### Sprint 4 — World Coherence

> **Prerequisite:** Sprints 1–2 complete

#### Agent 4A: Enhanced Plot Timeline Visualization

**Type:** Implementation agent
**Parallelizable with:** 4B, 4C

**Task:** Build a visual plot timeline showing plot progression across sessions.

**Context files to read:**
```
components/editors/PlotEditor.tsx        # Current plot editing
components/dashboards/PlotDashboard.tsx  # Current plot listing
types/Plot.ts                            # Plot shape — check for session linkage fields
types/SessionLog.ts                      # relatedPlotIds — how plots link to sessions
components/visualizers/RelationshipGraph.tsx  # Reference for D3/React Flow visualization patterns
```

**Deliverables:**
1. `components/visualizers/PlotTimeline.tsx` — Timeline visualization:
   - Horizontal timeline with session markers
   - Plot threads as horizontal lines spanning their active sessions
   - Color coding by plot status: active (amber), resolved (green), stalled (red)
   - Click a plot line to navigate to PlotEditor
   - Click a session marker to navigate to SessionLogEditor
   - "Plot Health" indicators: warning icon if a plot hasn't been touched in 3+ sessions
2. Update `PlotDashboard.tsx`:
   - Add a "Timeline View" toggle alongside the current list view
3. Add `dangling thread detection`:
   - In PlotDashboard, surface NPCs/locations/factions not connected to any active plot
   - "Orphaned entities" warning section

**Acceptance criteria:**
- Timeline renders correctly with multiple plots across multiple sessions
- Plot health warnings appear for dormant plots
- Navigation from timeline to editors works
- Handles campaigns with zero plots gracefully

---

#### Agent 4B: Continuity Checker

**Type:** Implementation agent
**Parallelizable with:** 4A, 4C

**Task:** Build an AI-powered continuity checker that flags contradictions and stale data before sessions.

**Context files to read:**
```
types/Campaign.ts                        # Full campaign shape
services/geminiService.ts                # AI service pattern
services/ai/dmCoach.ts                   # Where to add continuity check function
services/ai/mockService.ts              # Mock pattern
types/SessionLog.ts                      # Session data for checking
```

**Deliverables:**
1. `components/dialogs/ContinuityChecker.tsx` — Modal/panel component:
   - Three severity levels: Error (red), Warning (amber), Info (blue)
   - Errors: "NPC {name} was killed in Session {N} but appears in upcoming Scene {M}"
   - Warnings: "Plot '{name}' hasn't been touched in {N} sessions"
   - Info: "NPC {name} has no faction — consider linking"
   - Each issue has: description, affected entities (clickable), "Dismiss" and "Fix" buttons
   - "Fix" navigates to the relevant editor
2. Add `services/ai/continuityChecker.ts`:
   - `checkContinuity(campaign)` — Rule-based checks (no AI needed for most):
     - Dead NPCs in future scenes
     - Items in multiple locations
     - Resolved plots with NPCs still motivated by them
     - Orphaned entities (no relationships)
     - Dormant plots (3+ sessions)
3. Add facade in `geminiService.ts`, mock in `mockService.ts`
4. Trigger: "Check Continuity" button in Session Prep Wizard (3B) and in PlotDashboard

**Acceptance criteria:**
- Checker identifies at least 5 types of issues
- Issues are categorized by severity
- Clicking an issue navigates to the relevant entity
- Dismissing an issue persists (doesn't re-appear)

---

#### Agent 4C: Smart Context Window (Tiered)

**Type:** Implementation agent
**Parallelizable with:** 4A, 4B

**Task:** Replace the ad-hoc context construction in App.tsx with a tiered, token-budget-aware context builder.

**Context files to read:**
```
App.tsx                                  # currentContext useMemo (lines 200–314) — THIS IS WHAT TO REPLACE
services/ai/core.ts                      # Gemini API wrapper — understand token limits
services/ai/realmWeaver.ts               # How campaignContext is consumed
services/ai/dmCoach.ts                   # Same
types/Campaign.ts                        # Full data shape
```

**Deliverables:**
1. `services/contextBuilder.ts` — New service:
   ```typescript
   interface ContextOptions {
     campaign: Campaign;
     activeScene?: Scene;
     activeSession?: SessionLog;
     focusEntity?: { type: string; id: string };
     maxTokenEstimate?: number; // default 4000
   }

   function buildContext(options: ContextOptions): string {
     // Tier 1 (Always): setting, active session recap, active scene
     // Tier 2 (Contextual): NPCs in scene, location, active plots
     // Tier 3 (On demand): full NPC histories, faction details, articles
     // Truncate Tier 3 first, then Tier 2 when approaching budget
   }
   ```
2. Token estimation: simple `text.length / 4` approximation (good enough)
3. Replace `currentContext` useMemo in `App.tsx` with call to `buildContext()`
4. Add context type variants:
   - `buildGenerationContext()` — For entity generation (heavy on setting + existing entities)
   - `buildCoachContext()` — For DM Coach (heavy on active scene + session state)
   - `buildChatContext()` — For RealmChat (balanced)

**Acceptance criteria:**
- Context output is equivalent or better than current ad-hoc construction
- Token budget is respected (Tier 3 truncated first)
- Different context types prioritize different data
- `App.tsx` is simplified (context construction moved out)

---

### Sprint 5 — Visual & UX Polish

> **Prerequisite:** Sprints 1–3 complete

#### Agent 5A: Rich Dashboard Cards

**Type:** Implementation agent
**Parallelizable with:** 5B, 5C, 5D

**Task:** Replace plain list items in dashboards with rich preview cards.

**Context files to read:**
```
components/dashboards/NpcDashboard.tsx
components/dashboards/LocationDashboard.tsx
components/dashboards/FactionDashboard.tsx
components/dashboards/ItemDashboard.tsx
components/dashboards/AdventureDashboard.tsx
components/dashboards/SessionLogDashboard.tsx
types/NPC.ts, types/Location.ts, etc.   # Fields available for card content
```

**Deliverables:**
1. Update each dashboard to render entities as cards (not list items):
   - **NPC cards:** Portrait placeholder (colored avatar from initials), race/class line, personality snippet (first 80 chars of traits), faction badge (if linked)
   - **Location cards:** Type icon, atmosphere/description snippet, sub-location count, faction presence badges
   - **Adventure cards:** Scene count, level range, theme badge, completion percentage (completed scenes / total)
   - **Session cards:** Status badge (planned=blue, active=red, completed=green), date, linked adventure name
   - **Faction cards:** Member count, alignment badge, influence descriptor
   - **Item cards:** Rarity badge (colored), type icon, description snippet
2. Cards in a responsive grid: 1 column mobile, 2 columns tablet, 3 columns desktop
3. Click card → navigate to editor (existing behavior, new presentation)

**Acceptance criteria:**
- All dashboards show card grid instead of plain list
- Cards display meaningful preview data without clicking
- Responsive grid adapts to screen size
- Visual style consistent with dark fantasy theme (stone/amber palette)

---

#### Agent 5B: Tabbed Editor Layouts

**Type:** Implementation agent
**Parallelizable with:** 5A, 5C, 5D

**Task:** Restructure long vertical editor forms into tabbed layouts.

**Context files to read:**
```
components/editors/NpcEditor.tsx         # Longest editor — restructure first
components/editors/LocationEditor.tsx
components/editors/SceneEditor.tsx
components/editors/AdventureEditor.tsx
```

**Deliverables:**
1. `components/common/TabLayout.tsx` — Reusable tab container:
   - Props: `tabs: { id, label, icon? }[]`, `activeTab`, `onTabChange`, `children`
   - Horizontal tab bar with styled active indicator
   - Each tab's content renders only when active (for performance)
2. Restructure editors:
   - **NPC:** Identity (name, race, class, appearance) | Personality (traits, motivations, speech, ideals) | Stats (abilities, skills, equipment) | Relationships (faction, allies, rivals) | History (version history)
   - **Location:** Overview (name, type, description, atmosphere) | Details (points of interest) | Connections (parent, sub-locations, linked locations) | Loot (treasures, items)
   - **Scene:** Narrative (read-aloud, GM notes) | Mechanics (skill checks, rewards, encounter) | Cast (NPCs, location)
   - **Adventure:** Overview (title, theme, hook, level range) | Scenes (inline scene list/builder) | Prep Doc

**Acceptance criteria:**
- Each tab fits on one screen without scrolling for typical content
- Tab state persists while switching (no data loss)
- Mobile: tabs become a dropdown or horizontal scroll
- All existing functionality preserved (no field removed)

---

#### Agent 5C: Keyboard Shortcuts

**Type:** Implementation agent
**Parallelizable with:** 5A, 5B, 5D
**Depends on:** Agent 2A (CommandPalette already handles Cmd+K)

**Task:** Add global keyboard shortcuts for power users.

**Context files to read:**
```
App.tsx                                  # Global event listeners
components/common/CommandPalette.tsx     # Cmd+K already handled here (from 2A)
```

**Deliverables:**
1. `utils/keyboardShortcuts.ts` — Central shortcut registry:
   ```typescript
   const SHORTCUTS = {
     'mod+k': 'openCommandPalette',
     'mod+n': 'createEntity',        // Context-aware: creates entity matching current view
     'mod+s': 'forceSave',
     'mod+g': 'openGenerator',
     'mod+enter': 'submitGenerate',
     'escape': 'closePanel',
   };
   ```
2. `useKeyboardShortcuts(shortcuts, handlers)` — Custom hook
3. Wire into `App.tsx`:
   - `Cmd+N` → Opens generator matching current `activeView` (e.g., viewing NPCs → NPC generator)
   - `Cmd+S` → Calls `campaignService.saveCampaign()`
   - `Escape` → Closes modals, deselects entities
4. Show keyboard hints in UI:
   - CommandPalette footer: "Esc to close · ↑↓ to navigate · Enter to select"
   - Generator buttons: show `⌘G` hint
   - Sidebar navigation: arrow key support

**Acceptance criteria:**
- All listed shortcuts work
- Shortcuts don't fire when typing in input/textarea fields
- Hints visible in UI
- No conflicts with browser defaults

---

#### Agent 5D: Dark Fantasy Visual Polish

**Type:** Implementation agent (CSS/styling focused)
**Parallelizable with:** 5A, 5B, 5C

**Task:** Visual polish pass across the entire app — textures, animations, typography, and theming.

**Context files to read:**
```
index.html                               # Tailwind CDN, any custom CSS
components/views/WelcomeScreen.tsx       # Landing page — first impression
components/views/SessionRunner.tsx       # Session view — needs drama
components/layout/Header.tsx             # Top bar styling
components/layout/CampaignSidebar.tsx    # Sidebar styling
```

**Deliverables:**
1. Update `index.html` — Add custom CSS:
   - Subtle parchment/stone texture overlay for entity cards (CSS `background-image` with low opacity)
   - "Quill writing" CSS animation for AI generation loading states (replaces generic spinner)
   - Custom scrollbar styling (thin, stone-colored)
   - Warm amber glow on interactive focus states
2. Typography:
   - Headings: Use `font-serif` consistently (already Merriweather)
   - Body text: Keep sans-serif for readability
   - Read-aloud text in Session Runner: slightly larger, italic, amber-tinted
3. Transitions:
   - View transitions: subtle fade-in (CSS `transition` + React state)
   - Modal open/close: fade + scale animation
   - Sidebar: slide transition (already exists, polish timing)
4. Color refinement:
   - Richer contrast between bg levels (slate-950, slate-900, slate-800)
   - More prominent amber accent usage on primary actions
   - Status colors: red=live/danger, green=complete/safe, amber=active/warning, indigo=AI/magic

**Acceptance criteria:**
- App feels cohesive and thematic
- No performance impact from animations (CSS-only, no JS animation loops)
- Loading states use quill animation instead of generic spinner
- Custom scrollbars render correctly

---

### Sprint 6 — Cloud & Accounts

> **Prerequisite:** Sprints 1–5 complete (all local features stable)
> **Note:** This sprint requires significant architectural decisions. The orchestrator should spawn a **planning agent** first to finalize the cloud architecture before implementation agents begin.

#### Agent 6-PLAN: Cloud Architecture Planning

**Type:** Planning/research agent (NO code changes)
**Run first, before 6A–6D**

**Task:** Research and produce a concrete architecture document for cloud sync.

**Research tasks:**
1. Evaluate Supabase vs Firebase for this use case (real-time sync, auth, free tier, row-level security)
2. Design the database schema (map Campaign type to relational tables or document structure)
3. Define the offline-first sync strategy: local-first with background push/pull, conflict resolution approach
4. Define migration path: how to move existing localStorage data to cloud on first login
5. Define auth flow: email + Google OAuth + Discord OAuth
6. Define API security: row-level security so users only access their campaigns

**Output:** Architecture decision document written to `docs/CLOUD_ARCHITECTURE.md` including:
- Chosen platform with rationale
- Database schema
- Sync protocol (optimistic local writes, background sync, conflict resolution)
- Auth flow diagrams
- Migration strategy
- Free vs Pro tier enforcement points

**This document becomes input for Agents 6A–6D.**

---

#### Agent 6A: User Authentication

**Type:** Implementation agent
**Prerequisites:** Agent 6-PLAN complete
**Parallelizable with:** 6B (once schema is decided)

**Task:** Implement user auth (email + OAuth). Read `docs/CLOUD_ARCHITECTURE.md` for platform choice.

---

#### Agent 6B: Cloud Database & Sync

**Type:** Implementation agent
**Prerequisites:** Agent 6-PLAN complete
**Parallelizable with:** 6A

**Task:** Implement cloud database, CRUD adapter layer over `campaignService`, and offline-first sync. Read `docs/CLOUD_ARCHITECTURE.md` for schema and sync protocol.

**Key constraint:** `campaignService` must continue to work identically for non-logged-in users (localStorage path). Add a `StorageAdapter` interface:
```typescript
interface StorageAdapter {
  loadCampaigns(): Promise<Campaign[]>;
  saveCampaigns(campaigns: Campaign[]): Promise<void>;
  loadActiveCampaignId(): Promise<string | null>;
  saveActiveCampaignId(id: string | null): Promise<void>;
}
// LocalStorageAdapter (existing behavior) vs CloudStorageAdapter (new)
```

---

#### Agent 6C: LocalStorage → Cloud Migration

**Type:** Implementation agent
**Prerequisites:** 6A and 6B complete

**Task:** Build one-time migration flow: on first login, detect localStorage campaigns and offer to upload them to cloud.

---

#### Agent 6D: Campaign Backup/Restore

**Type:** Implementation agent
**Prerequisites:** 6B complete

**Task:** Cloud-backed backup/restore with versioned snapshots.

---

### Sprint 7 — Collaboration

> **Prerequisite:** Sprint 6 complete (auth + cloud sync working)

#### Agent 7A: Player Portal (Read-Only View)

**Type:** Implementation agent
**Parallelizable with:** 7B

**Task:** Build a separate read-only view for players. Players see: their character, session recaps, shared articles. Players do NOT see: GM notes, secrets, upcoming scenes.

**Key files to read:**
```
App.tsx                                  # Routing — add player portal route
types/Campaign.ts                        # What to expose vs hide
components/editors/*                     # Reference for entity display patterns
```

**Deliverables:**
1. `components/portal/PlayerPortal.tsx` — Top-level player view
2. `components/portal/PlayerCampaignView.tsx` — Read-only campaign browser
3. `components/portal/PlayerCharacterView.tsx` — Player's own character (editable)
4. `components/portal/SessionRecapView.tsx` — Read-only recaps
5. `components/portal/SharedArticleView.tsx` — Published articles only
6. Visibility filtering: strip all `gmNotes`, `secrets`, unpublished articles

---

#### Agent 7B: GM Secrets System

**Type:** Implementation agent
**Parallelizable with:** 7A

**Task:** Implement `[SECRET]...[/SECRET]` block syntax. Visible to DM, hidden in player portal.

**Deliverables:**
1. `utils/secretsParser.ts` — Parse and strip secret blocks
2. `components/common/SecretBlock.tsx` — Renders secret text with locked-border styling for DM view
3. Update all text editors to support `[SECRET]` insertion via toolbar button
4. Strip secrets in player-facing recap generation (Session End Wizard)

---

### Sprint 8 — Maps & Spatial

> **Prerequisite:** Sprint 6 complete (cloud storage for map image uploads)

#### Agent 8A: Interactive World Map

**Type:** Implementation agent
**Parallelizable with:** 8B

**Task:** Map image upload with pin-to-location entity linking.

**Key consideration:** Use a canvas-based library like `react-leaflet` with image overlay (no tile server needed — user-uploaded images).

**Deliverables:**
1. `components/maps/WorldMap.tsx` — Map viewer/editor
2. `components/maps/MapPin.tsx` — Clickable pin linked to a Location entity
3. `types/Map.ts` — Map type with `pins: { x, y, locationId }[]`
4. Update `types/Campaign.ts` — Add `maps: Map[]`
5. Update `campaignService.ts` — CRUD for maps
6. Add "Maps" to `EditorView` and sidebar

---

#### Agent 8B: Location Hierarchy Visualization

**Type:** Implementation agent
**Parallelizable with:** 8A

**Task:** Interactive tree view of location containment (parent → child relationships).

**Key files:** `types/Location.ts` (parentLocationId, subLocationIds already exist), `components/visualizers/RelationshipGraph.tsx` (reference for D3 patterns)

---

### Sprint 9 — Growth & Polish

> **Prerequisite:** Sprints 1–5 complete (core UX polished)

#### Agent 9A: First Campaign Wizard

**Type:** Implementation agent
**Parallelizable with:** 9B

**Task:** Guided onboarding wizard for new campaigns using conversational flow backed by Evocation Wizard.

**Context files to read:**
```
components/views/CampaignCreator.tsx     # Current campaign creation
components/dialogs/EvocationWizard.tsx   # Batch generation — use under the hood
services/geminiService.ts                # generateCampaignFill
```

---

#### Agent 9B: Template Campaigns

**Type:** Implementation agent
**Parallelizable with:** 9A

**Task:** Create pre-built campaign templates that can be loaded on creation.

**Deliverables:**
1. `data/templates/` directory with JSON campaign templates:
   - `classic-dungeon-crawl.json`
   - `political-intrigue.json`
   - `sandbox-exploration.json`
   - `one-shot-adventure.json`
2. Template selector in CampaignCreator/First Campaign Wizard
3. Template loading via `campaignService.importCampaign()` (already exists)

---

### Sprint 10 — Advanced AI

> **Prerequisite:** Sprints 1–5 complete
> **Note:** These are ongoing/experimental features. Each can be developed independently.

#### Agent 10A: World Simulation Engine

**Task:** AI generates between-session world events based on faction goals, NPC motivations, and time passed.

#### Agent 10B: Content Style Matching

**Task:** AI analyzes DM's existing entity descriptions to learn their writing voice and match it in future generation.

#### Agent 10C: Adaptive Difficulty Engine

**Task:** Track party composition and suggest encounter difficulty adjustments.

---

### Dependency Graph Summary

```
Sprint 1 (Session Cockpit) ─── no deps ─────────────────────┐
  ├── 1A Dice Roller          ─┐                             │
  ├── 1B Quick Tools Panel    ─┤── parallel ──┐              │
  ├── 1C Running Log          ─┤              ├── 1E Tablet  │
  └── 1D Go Live Polish       ─┘              │    Response  │
                                               │              │
Sprint 2 (Generation & Search) ─── after S1 ──┘              │
  ├── 2A Command Palette      ─┐                             │
  ├── 2B Generate Here         ─┤                             │
  ├── 2C Chat as Default      ─┤── all parallel              │
  ├── 2D Quick Cards          ─┤                             │
  └── 2E Field Regen          ─┘                             │
                                                              │
Sprint 3 (Session Intelligence) ─── after S1 ─────────────────┤
  ├── 3A Session End Wizard   ─┐                             │
  ├── 3B Session Prep Wizard  ─┤── parallel                  │
  └── 3C Auto-Capture         ─┘── depends on 1C             │
                                                              │
Sprint 4 (World Coherence) ─── after S1+S2 ──────────────────┤
  ├── 4A Plot Timeline        ─┐                             │
  ├── 4B Continuity Checker   ─┤── all parallel              │
  └── 4C Smart Context        ─┘                             │
                                                              │
Sprint 5 (Visual Polish) ─── after S1+S2+S3 ─────────────────┤
  ├── 5A Rich Cards           ─┐                             │
  ├── 5B Tabbed Editors       ─┤── all parallel              │
  ├── 5C Keyboard Shortcuts   ─┤── depends on 2A             │
  └── 5D Visual Polish        ─┘                             │
                                                              │
Sprint 6 (Cloud) ─── after S1–S5 ────────────────────────────┤
  └── 6-PLAN → 6A+6B (parallel) → 6C → 6D                  │
                                                              │
Sprint 7 (Collaboration) ─── after S6 ───────────────────────┤
  ├── 7A Player Portal        ─┐── parallel                  │
  └── 7B GM Secrets           ─┘                             │
                                                              │
Sprint 8 (Maps) ─── after S6 ────────────────────────────────┤
  ├── 8A World Map            ─┐── parallel                  │
  └── 8B Location Hierarchy   ─┘                             │
                                                              │
Sprint 9 (Growth) ─── after S1–S5 ───────────────────────────┤
  ├── 9A Campaign Wizard      ─┐── parallel                  │
  └── 9B Template Campaigns   ─┘                             │
                                                              │
Sprint 10 (Advanced AI) ─── after S1–S5 (ongoing) ──────────┘
  ├── 10A World Sim           ─┐
  ├── 10B Style Matching      ─┤── all independent
  └── 10C Difficulty Engine   ─┘
```

### Orchestrator Execution Protocol

```
ORCHESTRATOR WORKFLOW:

1. READ phase:
   - Read CLAUDE.md, UX_OVERHAUL_PLAN.md (this document), all type files
   - Run `npm run build` to verify clean baseline

2. For each sprint (in dependency order):
   a. Identify parallelizable agents within the sprint
   b. Spawn all parallel agents simultaneously using worktree isolation
   c. Wait for all agents in the group to complete
   d. Merge worktree branches sequentially (resolve any conflicts)
   e. Run `npm run build` to verify merged result compiles
   f. Run the app in mock mode and smoke test the new features
   g. Commit with descriptive message: "feat(sprint-N): {summary}"

3. BETWEEN sprints:
   - Verify all acceptance criteria from completed sprint
   - If any agent failed, re-spawn with error context
   - Update this plan with completion status

4. CONFLICT RESOLUTION:
   - If two agents modify the same file (e.g., App.tsx, campaignService.ts):
     - Merge the first agent's changes
     - Re-spawn the second agent with the updated file as context
   - Common conflict files:
     - App.tsx (view routing, state wiring)
     - campaignService.ts (new methods)
     - types/index.ts (new exports)
     - geminiService.ts (new facade functions)
     - components/common/Icons.tsx (new icon exports)

5. QUALITY GATES per sprint:
   - `npm run build` passes (zero TS errors)
   - No regressions in existing features
   - New features work in mock mode
   - Mobile responsive (where applicable)
   - Icons imported from Icons.tsx (never lucide-react directly)
   - Types exported from types/index.ts barrel
   - AI functions have mock implementations
```

### Agent Count Summary

| Sprint | Agents | Parallel Groups | Est. Total Files Changed |
|--------|--------|-----------------|--------------------------|
| **S1** | 5 | 4 parallel + 1 sequential | ~15 files |
| **S2** | 5 | 5 parallel | ~20 files |
| **S3** | 3 | 3 parallel | ~12 files |
| **S4** | 3 | 3 parallel | ~10 files |
| **S5** | 4 | 4 parallel | ~25 files |
| **S6** | 5 | 1 plan + 2 parallel + 2 sequential | ~15 new files |
| **S7** | 2 | 2 parallel | ~10 new files |
| **S8** | 2 | 2 parallel | ~8 new files |
| **S9** | 2 | 2 parallel | ~6 files |
| **S10** | 3 | 3 parallel | ~9 files |
| **Total** | **34 agents** | | |
