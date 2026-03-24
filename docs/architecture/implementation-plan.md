# Realmweaver — Sequenced Implementation Plan

> **Created:** 2026-03-20
> **Supersedes:** `TODO.md` (items either absorbed here or cut), UX_OVERHAUL_PLAN.md Sprint numbering
> **Source documents:** `UX_OVERHAUL_PLAN.md`, `docs/SESSION_COCKPIT_ARCHETYPE_REVIEW.md`, `docs/DM_ARCHETYPES.md`, `TODO.md`
> **Steering decisions:** Balanced archetypes (Worldbuilder as super-user ceiling), mid-tier combat, cloud-late, mobile-critical, Gemini-only, phase-at-a-time execution

---

## Implementation Sequence

```
Phase A:  Universal Fixes ─────────── (immediate, ~1 week) ✅ COMPLETE
Phase A2: No-Regrets UI Foundation ── (~1 week)
Phase B:  Search & Generation UX ──── (~2 weeks)
Phase C:  Session Intelligence ─────── (~2 weeks)
Phase D:  World Coherence ──────────── (~2 weeks)
Phase E:  Visual Polish & Mobile ───── (~2 weeks)
Phase F:  Growth & Advanced AI ─────── (~2 weeks)
Phase G:  Cloud & Collaboration ────── (3-4 months out, ~4 weeks)
```

---

## Phase A: Universal Fixes

> **Goal:** Fix the 7 highest-friction issues identified in the archetype review. Every DM type benefits.
> **Predecessor:** Sprint 1 (Session Cockpit foundation) — COMPLETE
> **Archetypes served:** All 5
> **Estimated agents:** 7 (all parallelizable)

### A1: Persist Plot Progression
- **Problem:** Plot status cycling (advanced/stalled/unchanged) is LOCAL component state only. Lost on page refresh.
- **Fix:** Save to `sessionLog.plotSessionStatus: Record<string, PlotSessionStatus>` via `campaignService`.
- **Files:** `types/SessionLog.ts`, `services/campaignService.ts`, `components/views/SessionRunner.tsx`
- **Effort:** Small
- **Archetypes:** Worldbuilder (HIGH), Forever DM (CRITICAL)

### A2: Merge Dice Rolls into Running Log
- **Problem:** Dice rolls in `sessionLog.diceRolls[]` never appear in the chronological `structuredNotes` timeline.
- **Fix:** When a roll is logged, also create a `StructuredNote` with `type: 'dice-roll'` containing the formula, result, and note.
- **Files:** `services/campaignService.ts`, `components/views/SessionRunner.tsx`
- **Effort:** Small
- **Archetypes:** Lazy DM (HIGH), Tactical DM (HIGH)

### A3: "Send to Notes" on DM Coach Results
- **Problem:** Narration, improv, and table results from DM Coach require manual copy-paste to session notes.
- **Fix:** Add a "Send to Notes" button on each Coach result that appends to `structuredNotes` with `type: 'coach-used'`.
- **Files:** `components/dialogs/DmCoach.tsx`, `services/campaignService.ts`
- **Effort:** Small
- **Archetypes:** All (Lazy DM CRITICAL, Worldbuilder HIGH)

### A4: Quick NPC Preview/Edit Before Save
- **Problem:** Quick NPC generates and immediately saves with no review step.
- **Fix:** Show a preview card with name, traits, description. Offer "Save," "Regenerate," and "Edit before saving."
- **Files:** `components/views/SessionRunner.tsx` (QuickNpcPanel section)
- **Effort:** Medium
- **Archetypes:** Worldbuilder (HIGH), Lazy DM (HIGH), New DM (HIGH)

### A5: Skill Check → Dice Roller Integration
- **Problem:** Skill checks listed in scenes have no "Roll" button.
- **Fix:** Add a quick-roll button next to each DC that pre-fills the dice roller with `1d20` and the DC threshold displayed.
- **Files:** `components/views/SessionRunner.tsx` (skill check section), `components/tools/DiceRoller.tsx`
- **Effort:** Small
- **Archetypes:** Tactical DM (HIGH), New DM (HIGH)

### A6: Combat Tracker — Real HP from NPC Data
- **Problem:** Auto-populated combatants use hardcoded HP (NPCs=10, PCs=20).
- **Fix:** Parse HP from NPC `stats` field (regex for "HP: X" or "Hit Points: X"), fall back to a user-editable default. Add `defaultHp` field to NPC type. For PCs, parse from `PlayerCharacter` data.
- **Files:** `components/tools/CombatTracker.tsx`, `types/NPC.ts`, `types/PlayerCharacter.ts`, `services/campaignService.ts`
- **Effort:** Medium
- **Archetypes:** Tactical DM (CRITICAL), New DM (HIGH)

### A7: Session End Wizard
- **Problem:** Session end is a 2-click confirmation with no debrief. Post-session tools are in SessionLogEditor, not in the end flow.
- **Fix:** Build a multi-step end-session modal:
  1. AI generates structured recap from running notes
  2. DM reviews/edits recap
  3. Plot status review with checkboxes (advanced/stalled/resolved/new)
  4. Loose ends capture (AI-suggested + manual)
  5. Optional player-facing recap (secrets stripped)
  6. Save all, clear active session state
- **Files:** New `components/dialogs/SessionEndWizard.tsx`, `services/geminiService.ts`, `services/ai/dmCoach.ts`, `services/ai/mockService.ts`, `components/views/SessionRunner.tsx`
- **Effort:** Large
- **Archetypes:** Forever DM (CRITICAL), Lazy DM (HIGH), All benefit

### QA Gate: Phase A
- `npm run build` passes
- `npm test` passes (all existing tests + new tests for Phase A features)
- Plot status persists across page refresh
- Dice rolls appear in running log timeline
- Coach results can be sent to notes
- Quick NPC shows preview before save
- Skill checks have roll buttons
- Combat HP reflects NPC data
- Session end wizard functions end-to-end in mock mode

---

## Phase A2: No-Regrets UI Foundation

> **Goal:** Apply 6 UI improvements that are safe regardless of future design direction. These appear across 3+ design proposals in `UI_DESIGN_EVALUATION.md` and benefit all archetypes.
> **Predecessor:** Phase A (Universal Fixes) — COMPLETE
> **Source:** `UI_DESIGN_EVALUATION.md` — cross-proposal analysis
> **Archetypes served:** All 5
> **Estimated agents:** 6 (all parallelizable)

### A2-1: Entity Type Color Language
- **What:** Add left-border color accents to all entity cards and sidebar items. Each entity type gets a distinct color.
- **Colors:** NPC=amber, Location=emerald, Faction=violet, Item=sky, Adventure=orange, Article=cyan, Session=rose, Plot=yellow, PlayerCharacter=teal
- **Where:** Dashboard cards, sidebar entity lists, editor headers, entity quick-references
- **Files:** All dashboard components, `components/layout/CampaignSidebar.tsx`, all editor components
- **Effort:** Medium (many files but simple CSS changes per file)
- **Archetypes:** All (improves scannability — Worldbuilder and Tactician benefit most)

### A2-2: Amber Primary / Indigo for AI
- **What:** Replace indigo as the primary UI accent with amber. Reserve indigo exclusively for AI-powered features (generation buttons, Coach, Evocation Wizard, sparkle icons).
- **Rationale:** CLAUDE.md already says "amber accents" but the actual implementation uses indigo everywhere. This creates a clear visual language: **amber = user actions, indigo = AI actions**.
- **Scope:** Buttons, active sidebar items, selected states, focus rings, links → amber. AI generation buttons, Coach UI, Evocation Wizard, loading states for AI calls → indigo with sparkle icon.
- **Files:** `components/common/Button.tsx`, `components/layout/Header.tsx`, `components/layout/CampaignSidebar.tsx`, all generator components, `components/dialogs/DmCoach.tsx`, `components/dialogs/EvocationWizard.tsx`, `components/views/SessionRunner.tsx`, `index.html` (custom CSS)
- **Effort:** Large (touches many files but is a systematic find-and-replace of color classes)
- **Archetypes:** All (clearer visual hierarchy — New DM benefits most from reduced confusion)

### A2-3: Better Empty States
- **What:** Replace bare "No X yet" messages with illustrated empty states including encouraging flavor text and one-click generation prompts.
- **Examples:**
  - NPCs: "Every great story needs its cast of characters" + "Generate a tavern full of NPCs?"
  - Locations: "Your world awaits — where does the adventure begin?" + "Generate a starting location?"
  - Factions: "Power structures shape every world" + "Generate a faction?"
  - Adventures: "The quest begins with a single scene" + "Create your first adventure?"
  - Session Logs: "Ready to run your first session?" + "Start session prep?"
- **Visual:** Use a muted icon (from Icons.tsx) at 64px + text + amber CTA button. No external images needed.
- **Files:** All dashboard components
- **Effort:** Small (template pattern repeated across dashboards)
- **Archetypes:** All (New DM CRITICAL — blank canvas paralysis is their #1 pain point)

### A2-4: Sidebar Search/Filter
- **What:** Add a text filter input at the top of the sidebar's entity section. Typing filters visible entity names across all categories in real-time.
- **Behavior:** Debounced 100ms, filters across NPCs/Locations/Factions/Items/Adventures/Articles/Sessions/Plots. Matching items highlighted, non-matching hidden. Empty filter shows all. Category headers hidden when all their items are filtered out.
- **Files:** `components/layout/CampaignSidebar.tsx`
- **Effort:** Medium
- **Archetypes:** All (essential once campaigns exceed 20 entities — Worldbuilder and Forever DM most impacted)

### A2-5: Loading Skeletons
- **What:** Replace spinner/pulse loading indicators with skeleton placeholder content for dashboards and editors.
- **Implementation:** Create a `components/common/SkeletonCard.tsx` that shows a gray pulsing card shape matching the entity card layout. Use in dashboards during AI generation and initial load.
- **Files:** New `components/common/SkeletonCard.tsx`, all dashboard components, generator components
- **Effort:** Small
- **Archetypes:** All (better perceived performance)

### A2-6: Breadcrumbs
- **What:** Add a breadcrumb trail above the content area showing navigation context: Campaign > [Category] > [Entity Name]
- **Behavior:** Each segment is clickable (navigates back). Shows full path for nested items (Campaign > Adventures > Adventure Name > Scene Name).
- **Files:** New `components/common/Breadcrumbs.tsx`, `components/layout/ContentWrapper.tsx` or `App.tsx`
- **Effort:** Small
- **Archetypes:** All (Worldbuilder HIGH — deep hierarchies need orientation cues)

### QA Gate: Phase A2
- `npm run build` passes
- `npm test` passes
- Entity type colors visible on all dashboard cards and sidebar items
- Amber is primary accent; indigo only appears on AI features
- All empty dashboards show illustrated empty states with generation CTAs
- Sidebar filter works across all entity types
- Skeleton loading appears during AI generation
- Breadcrumbs show correct path and navigate on click
- All changes responsive at 375px width
- No visual regressions in Session Runner or existing editors

---

## Phase B: Search & Generation UX

> **Goal:** Make content creation and discovery fast. Find anything with Cmd+K. Generate in context. Rich entity previews everywhere.
> **Predecessor:** Phase A
> **Archetypes served:** All (Worldbuilder super-user features in popovers)
> **Estimated agents:** 6 (5 parallel + 1 sequential)

### B1: Global Search / Command Palette (Cmd+K)
- **Spec:** UX Overhaul Agent 2A
- Fuzzy search across all entity types by name AND content
- Results grouped by type with icons
- Recent items section, action shortcuts ("Create NPC", "Open Coach")
- **Files:** New `components/common/CommandPalette.tsx`, `App.tsx`
- **Effort:** Medium
- **Archetypes:** All (Worldbuilder CRITICAL for in-session lookup)

### B2: Contextual "Generate Here" Buttons
- **Spec:** UX Overhaul Agent 2B
- Scene → "Generate NPC for this scene" (auto-links)
- Location → "Generate NPC at this location"
- Faction → "Generate member"
- Adventure → "Generate next scene"
- Plot → "Generate scene advancing this plot"
- **Files:** Multiple editors: `SceneEditor.tsx`, `LocationEditor.tsx`, `FactionEditor.tsx`, `AdventureEditor.tsx`, `PlotEditor.tsx`
- **Effort:** Medium
- **Archetypes:** All (Worldbuilder HIGH, Forever DM HIGH)

### B3: Conversational Generation as Default
- **Spec:** UX Overhaul Agent 2C
- Chat-based creation is primary path in all dashboards
- Prompt chips per entity type
- "Switch to form" fallback available
- **Files:** All dashboard components, `EntityChatGenerator.tsx`
- **Effort:** Medium
- **Archetypes:** All (New DM HIGH — less intimidating than forms)

### B4: Quick Entity Card Popovers
- **Spec:** UX Overhaul Agent 2D
- Hover/click any entity name → popover with key details
- Worldbuilder mode: full profile (backstory, relationships, faction, lore links)
- Standard mode: name, traits, description, action buttons
- **Files:** New `components/common/EntityQuickCard.tsx`, `components/common/EntityLink.tsx`, integration in SessionRunner, SceneEditor, dashboards
- **Effort:** Large
- **Archetypes:** Worldbuilder (CRITICAL), New DM (HIGH), Tactical DM (MEDIUM)

### B5: Inline Field Regeneration
- **Spec:** UX Overhaul Agent 2E
- Per-field sparkle button on all entity editors
- Optional tweak instruction ("Make them more sinister")
- Uses existing `generateEnhancedText()`
- **Files:** New `components/common/RegenerateButton.tsx`, all editor components
- **Effort:** Medium
- **Archetypes:** All

### B6: @Mention Entity Referencing
- **Source:** TODO.md item 2.2 (cherry-picked)
- Type `@NPCName` in DM Coach or running log → autocomplete → entity details injected into AI context
- Mentioned entities highlighted with links to editors
- **Files:** New mention input component, `components/dialogs/DmCoach.tsx`, `components/views/SessionRunner.tsx`
- **Effort:** Medium
- **Archetypes:** Worldbuilder (HIGH), Lazy DM (HIGH)

### QA Gate: Phase B
- Cmd+K finds entities by name and content within 300ms
- "Generate Here" creates and auto-links entities correctly
- Chat creation works for all entity types with prompt chips
- Entity popovers show appropriate detail level
- Field regeneration works in mock mode
- @Mention autocomplete resolves entity names
- All features responsive on tablet/mobile (min 768px)
- `npm run build` + `npm test` pass

---

## Phase C: Session Intelligence

> **Goal:** Make sessions smarter — better prep, better capture, better tools during play.
> **Predecessor:** Phase A (running log and auto-events must exist)
> **Archetypes served:** All (strong Lazy DM and Forever DM focus)
> **Estimated agents:** 7 (5 parallel + 2 sequential)

### C1: Session Prep Wizard
- **Spec:** UX Overhaul Agent 3B
- 5-step guided wizard: Adventure → Scenes → NPCs/Locations → Plots → Review & Go Live
- Each step skippable
- AI scans selected scenes and surfaces missing entities
- **Files:** New `components/dialogs/SessionPrepWizard.tsx`, `components/dashboards/SessionLogDashboard.tsx`
- **Effort:** Large
- **Archetypes:** New DM (CRITICAL), Forever DM (HIGH), Lazy DM (MEDIUM)

### C2: Event-Driven Auto-Capture
- **Spec:** UX Overhaul Agent 3C
- NPC creation during active session → auto-log
- Combat end → auto-log summary
- DM Coach usage → auto-log
- Dice rolls → auto-log (Phase A2 handles the running log integration; this wires additional event sources)
- **Files:** `services/campaignService.ts`, `components/dialogs/DmCoach.tsx`, `components/tools/CombatTracker.tsx`
- **Effort:** Medium
- **Archetypes:** All (Lazy DM HIGH, Forever DM HIGH)

### C3: Voice Capture in Session Runner
- **Spec:** Archetype review Phase B item 7
- Port AI Scribe from `SessionLogEditor` into Session Runner
- Mic button in header, transcript feeds into running log
- **Files:** `components/views/SessionRunner.tsx`, voice/speech API integration
- **Effort:** Large
- **Archetypes:** Forever DM (CRITICAL), Lazy DM (HIGH)

### C4: DM Coach Template Prompts
- **Spec:** Archetype review Phase B item 3
- Contextual suggestion chips below Coach prompt textarea
- Stratified by DM Style: Guided mode shows prescriptive prompts, Standard/Power shows open-ended starters
- At least 5 prompts per tool (narrate, improvise, table) relevant to current scene
- **Files:** `components/dialogs/DmCoach.tsx`
- **Effort:** Medium
- **Archetypes:** New DM (CRITICAL), Lazy DM (MEDIUM)

### C5: Bullet-Point Beats Mode
- **Spec:** Archetype review Phase B item 8
- Sessions can use lightweight "beats" (title + 1-2 lines) instead of full Scene entities
- Beats appear in scene list and can be checked off
- Session runner fully functional with zero formal scenes
- **Files:** `types/SessionLog.ts` (new `beats` field), `components/views/SessionRunner.tsx`
- **Effort:** Medium
- **Archetypes:** Lazy DM (CRITICAL), Forever DM (HIGH)

### C6: Secrets & Clues Tracker
- **Spec:** Archetype review Phase B item 1
- Collapsible panel in quick tools area
- List of floating secrets/clues with revealed/unrevealed toggle
- Session-of-reveal metadata
- Support 50+ entries per campaign
- **Files:** New `components/tools/SecretsTracker.tsx`, `types/Campaign.ts` (or new type), `services/campaignService.ts`
- **Effort:** Medium
- **Archetypes:** Lazy DM (CRITICAL), Worldbuilder (HIGH)

### C7: NPC Roleplay Simulator
- **Source:** TODO.md item 3.4 (cherry-picked)
- Select an NPC → AI adopts that persona using traits/quotes/motivations
- Conversation mode in RealmChat or DM Coach
- "Mood cues" alongside dialogue
- **Files:** `services/ai/realmChat.ts`, `services/geminiService.ts`, `services/ai/mockService.ts`, `components/RealmChat/RealmChatWidget.tsx` or `components/dialogs/DmCoach.tsx`
- **Effort:** Medium
- **Archetypes:** New DM (HIGH — practice NPC voices), Worldbuilder (HIGH — test characterization)

### QA Gate: Phase C
- Prep wizard creates fully-linked session log
- Auto-capture events appear in running log with correct types
- Voice capture works in Session Runner
- Coach has template prompts in all modes
- Beats mode works without formal scenes
- Secrets tracker persists and supports 50+ entries
- NPC roleplay produces in-character responses
- All features responsive on mobile
- `npm run build` + `npm test` pass

---

## Phase D: World Coherence & Relationships

> **Goal:** The app helps DMs maintain narrative consistency across sessions. Relationships, continuity, and context become intelligent.
> **Predecessor:** Phases A-B (entity popovers and search must exist)
> **Archetypes served:** Worldbuilder (PRIMARY), Forever DM (HIGH), All benefit from Smart Context
> **Estimated agents:** 5 (4 parallel + 1 sequential)

### D1: Smart Context Window (Tiered)
- **Spec:** UX Overhaul Agent 4C
- Replace ad-hoc context construction in App.tsx with tiered, token-budget-aware builder
- Tier 1 (Always): campaign setting, active session recap, active scene
- Tier 2 (Contextual): NPCs in scene, location, active plots
- Tier 3 (On demand): full NPC histories, faction details, lore articles
- Context type variants: generation, coach, chat
- **Files:** New `services/contextBuilder.ts`, `App.tsx`
- **Effort:** Large
- **Archetypes:** All (improves ALL AI output quality)

### D2: Enhanced Plot Timeline
- **Spec:** UX Overhaul Agent 4A
- Horizontal timeline with session markers
- Plot threads as colored lines spanning active sessions
- Plot health warnings (dormant 3+ sessions)
- Dangling thread detection (orphaned entities)
- **Files:** New `components/visualizers/PlotTimeline.tsx`, `components/dashboards/PlotDashboard.tsx`
- **Effort:** Large
- **Archetypes:** Worldbuilder (HIGH), Forever DM (HIGH)

### D3: Continuity Checker
- **Spec:** UX Overhaul Agent 4B
- Rule-based checks (no AI needed for most):
  - Dead NPCs in future scenes
  - Items in multiple locations
  - Resolved plots with NPCs still motivated by them
  - Orphaned entities
  - Dormant plots
- Severity levels: Error (red), Warning (amber), Info (blue)
- Dismiss and Fix buttons
- **Files:** New `services/continuityChecker.ts`, new `components/dialogs/ContinuityChecker.tsx`
- **Effort:** Large
- **Archetypes:** Forever DM (CRITICAL), Worldbuilder (HIGH)

### D4: Wiki-Style Cross-Linking
- **Source:** TODO.md item 5.1 (cherry-picked)
- Entity names in text fields auto-become clickable links
- Scan text against entity name dictionary
- Render as links with tooltips showing mini-summary on hover
- Works in descriptions, backstories, article content, session notes
- **Files:** New `utils/crossLinker.ts`, new `components/common/LinkedText.tsx`, integration across editors
- **Effort:** Large
- **Archetypes:** Worldbuilder (CRITICAL), all benefit

### D5: Relationship Intelligence in Scene Panels
- **Spec:** Archetype review Phase C — relationship surfacing
- NPC cards in Session Runner show faction, relationships, and attitude badges
- Scene cast panel shows relationship web ("These two are rivals")
- DM Coach receives relationship context
- **Files:** `components/views/SessionRunner.tsx`, `services/contextBuilder.ts`
- **Effort:** Medium
- **Archetypes:** Worldbuilder (CRITICAL), New DM (HIGH)

### QA Gate: Phase D
- Context builder produces equivalent or better output than current ad-hoc
- Token budget respected (Tier 3 truncated first)
- Plot timeline renders across multiple sessions
- Continuity checker identifies 5+ issue types
- Wiki cross-linking detects entity names in text
- Relationship badges visible on NPC cards in session runner
- All features responsive on mobile
- `npm run build` + `npm test` pass

---

## Phase E: Visual Polish & Mobile

> **Goal:** Make the app feel professional, cohesive, and usable on all devices. Introduce DM Style progressive disclosure.
> **Predecessor:** Phases A-D (all features exist, now polish)
> **Archetypes served:** All (New DM benefits most from DM Style)
> **Estimated agents:** 6 (5 parallel + 1 sequential)

### E1: Rich Dashboard Cards
- **Spec:** UX Overhaul Agent 5A
- NPC cards: avatar, race/class, personality snippet, faction badge
- Location cards: type icon, atmosphere snippet, connection count
- Adventure cards: scene count, level range, completion %
- Session cards: status badge, date, adventure name
- Responsive grid: 1 col mobile, 2 col tablet, 3 col desktop
- **Files:** All dashboard components
- **Effort:** Large
- **Archetypes:** All

### E2: Tabbed Editor Layouts
- **Spec:** UX Overhaul Agent 5B
- NPC: Identity | Personality | Stats | Relationships | History
- Location: Overview | Details | Connections | Loot
- Scene: Narrative | Mechanics | Cast
- Adventure: Overview | Scenes | Prep Doc
- **Files:** New `components/common/TabLayout.tsx`, all editor components
- **Effort:** Large
- **Archetypes:** All (reduces scroll fatigue)

### E3: Keyboard Shortcuts
- **Spec:** UX Overhaul Agent 5C
- Cmd+K (search), Cmd+N (new entity), Cmd+S (force save), Cmd+G (generator), Escape (close)
- Shortcuts suppressed in input/textarea fields
- Visual hints in UI
- **Files:** New `utils/keyboardShortcuts.ts`, `App.tsx`
- **Effort:** Medium
- **Archetypes:** Power users (Worldbuilder, Forever DM)

### E4: Dark Fantasy Visual Polish
- **Spec:** UX Overhaul Agent 5D
- Subtle parchment textures for entity cards
- "Quill writing" CSS animation for AI generation loading
- Custom scrollbar styling
- Warm amber glow on focus states
- Read-aloud text: larger, italic, amber-tinted
- View transitions: subtle fade-in
- **Files:** `index.html` (custom CSS), multiple components
- **Effort:** Medium
- **Archetypes:** All (delight factor)

### E5: Mobile & Tablet Responsiveness
- **Priority:** CRITICAL — Galaxy Fold (280-344px folded / 585px open), iPhone (375-430px), iPad (768-1024px), Galaxy Tab (800-1200px)
- Session Runner: single-column with tab navigation below `md` breakpoint
- Quick tools: floating action button menu on mobile
- Scene list: horizontal swipeable carousel
- Running log: slides up from bottom as sheet
- All touch targets min 44px
- Dashboards: responsive card grids
- Editors: tabs stack vertically on mobile
- **Files:** All layout components, SessionRunner, dashboards, editors
- **Effort:** Large
- **Archetypes:** All (user runs from Galaxy Fold and iPhone)

### E6: DM Style Progressive Disclosure
- **Spec:** Archetype review "Gated Functionality Design"
- Add `dmStyle: 'guided' | 'standard' | 'power'` to campaign settings
- First campaign creation asks: "I'm new" / "I keep it simple" / "Give me everything"
- Each mode adjusts which panels and features are visible by default
- Gear icon allows toggling individual features regardless of style
- **Files:** `types/CampaignSetting.ts`, `components/views/CampaignCreator.tsx`, `components/views/SessionRunner.tsx`, multiple tool components
- **Effort:** Large
- **Archetypes:** New DM (CRITICAL — reduces overwhelm), All (customization)

### QA Gate: Phase E
- All dashboards show card grids
- Tabbed editors work without data loss on tab switch
- Keyboard shortcuts work, don't fire in input fields
- Visual polish is cohesive (no style mismatches)
- App fully usable on 375px width (iPhone)
- App fully usable on Galaxy Fold (both folded and open)
- App fully usable on iPad/tablet (768px+)
- DM Style changes interface appropriately
- No performance regression from CSS animations
- `npm run build` + `npm test` pass

---

## Phase F: Growth & Advanced AI

> **Goal:** Smooth onboarding and AI features that deepen over time.
> **Predecessor:** Phases A-E (core product complete)
> **Archetypes served:** New DM (onboarding), Forever DM (automation), Worldbuilder (simulation)
> **Estimated agents:** 5 (4 parallel + 1 sequential)

### F1: First Campaign Wizard
- **Spec:** UX Overhaul Agent 9A
- Guided conversational onboarding after creating a campaign
- "Tell me about your world" → AI sets tone → "Generate starting adventure?" → "Key NPCs?" → "Locations?" → "Ready to prep?"
- Uses Evocation Wizard under the hood
- **Files:** New `components/views/FirstCampaignWizard.tsx`, `components/views/CampaignCreator.tsx`
- **Effort:** Medium
- **Archetypes:** New DM (CRITICAL), All

### F2: Template Campaigns
- **Spec:** UX Overhaul Agent 9B
- Pre-built starters: Classic Dungeon Crawl, Political Intrigue, Sandbox Exploration, One-Shot
- JSON template files loaded via `campaignService.importCampaign()`
- Template selector in CampaignCreator
- **Files:** New `data/templates/` directory, `components/views/CampaignCreator.tsx`
- **Effort:** Medium
- **Archetypes:** New DM (HIGH), all

### F3: World Simulation Engine
- **Spec:** UX Overhaul Sprint 10, Agent 10A
- AI generates between-session world events based on faction goals, NPC motivations, time passed
- DM reviews and approves — approved events auto-update entities
- Triggered at session end or from a "What happened off-screen?" button
- **Files:** New `services/ai/worldSimulation.ts`, `services/geminiService.ts`, `services/ai/mockService.ts`, new UI component
- **Effort:** Large
- **Archetypes:** Worldbuilder (CRITICAL), Forever DM (HIGH)

### F4: Content Style Matching
- **Spec:** UX Overhaul Sprint 10, Agent 10B
- AI analyzes DM's existing entity descriptions to learn writing voice
- Style profile built from first 5-10 entities
- "Write like my other NPCs" becomes implicit in all generation
- **Files:** New `services/ai/styleMatching.ts`, `services/geminiService.ts`, integration into generation prompts
- **Effort:** Large
- **Archetypes:** Worldbuilder (HIGH), all

### F5: Cross-Campaign Dashboard
- **Spec:** Archetype review Phase C item 6
- Top-level view showing all campaigns with next session date, pending loose ends, quick-switch
- Entity copy between campaigns
- **Files:** New `components/views/CrossCampaignDashboard.tsx`, `App.tsx`
- **Effort:** Large
- **Archetypes:** Forever DM (CRITICAL)

### QA Gate: Phase F
- First Campaign Wizard produces a playable campaign from conversational flow
- Templates load correctly
- World simulation generates plausible events and updates entities on approval
- Style matching produces tonally consistent content after 5+ entities
- Cross-campaign dashboard shows all campaigns
- `npm run build` + `npm test` pass

---

## Phase G: Cloud & Collaboration (3-4 Months Out)

> **Goal:** Multi-device sync, player sharing, maps.
> **Predecessor:** ALL local features complete and tested
> **Note:** This phase requires architectural planning before implementation. Details deferred until closer to execution.

### G1: Cloud Architecture Planning
- Supabase vs Firebase evaluation
- Database schema design
- Offline-first sync strategy
- Auth flow (email + Google/Discord OAuth)
- Migration from localStorage

### G2: User Authentication
### G3: Cloud Database & Sync
### G4: localStorage → Cloud Migration
### G5: Player Portal (read-only)
### G6: GM Secrets System
### G7: Interactive World Map
### G8: Location Hierarchy Visualization

---

## Items Explicitly Cut

| Item | Source | Reason |
|------|--------|--------|
| Calendar & Time Tracking | TODO 1.3 | Nice-to-have, not session-critical. Reconsider in Phase F. |
| Visual Assets / Media Gallery | TODO 1.4 | Large effort, requires image storage infra. Deferred to Phase G (cloud). |
| Stat Block Integration (5e SRD) | TODO 1.5 | Mid-tier combat decision. Structured stat blocks are scope creep. Free-text stats with HP parsing (Phase A6) is sufficient. |
| Semantic Search / Vector DB | TODO 2.1 | Architecturally premature. Smart Context Window (Phase D1) achieves 80% of benefit at 1% of cost. |
| Session History Awareness | TODO 2.3 | Absorbed into Smart Context Window (Phase D1) Tier 2 context. |
| Rules Reference & Arbiter | TODO 3.2 | Requires 5e SRD database. Large effort, low differentiation. DMs already use D&D Beyond for rules. |
| Loot & Shop Generator | TODO 3.3 | Nice-to-have. Can be added as a DM Coach tool later. |
| Audio & Ambience DJ | TODO 3.5 | No TTRPG tool has done this well. Licensing/API stability problems. Cut. |
| Quest & Plot Thread Tracker | TODO 4.1 | Absorbed into existing Plot entity + Phase D2 (Plot Timeline). |
| Branching Narrative Flowchart | TODO 4.2 | Conflicts with Lazy DM philosophy. Worldbuilder-only, React Flow already used for relationship graph. Deprioritized. |
| Act & Arc Structure | TODO 4.3 | Over-structuring. Existing Adventure → Scene hierarchy is sufficient. |
| Dynamic World State Changes | TODO 4.4 | Partially absorbed into Phase F3 (World Simulation Engine). Entity status fields are a small add-on, not a phase. |
| Player Agency Tracker | TODO 4.5 | Absorbed into Secrets & Clues tracker (Phase C6) and Continuity Checker (Phase D3). |
| Professional PDF Export | TODO 5.4 | Nice-to-have. Existing export (JSON, Obsidian) is sufficient for now. |
| Full-screen combat mode | UX Sprint 4.4 | Mid-tier combat decision. Slide-out panel is sufficient. |
| Legendary/lair action tracking | US-4.5 | Mid-tier combat decision. Freeform notes field is sufficient. |
| Post-combat analytics | US-4.9 | Mid-tier combat decision. Cut. |
| Turn timer | US-4.6 | Mid-tier combat decision. Cut. Revisit if requested. |
| Encounter templates (save/reuse) | US-4.12 | Nice-to-have. Revisit in Phase F. |

---

## Responsive Design Requirements (All Phases)

Since mobile is critical, every new component must be responsive from initial implementation. Target breakpoints:

| Device | Width | Layout |
|--------|-------|--------|
| Galaxy Fold (folded) | 280-344px | Single column, stacked |
| iPhone / small phone | 375-430px | Single column, bottom sheets |
| Galaxy Fold (open) | 585px | Single column, wider cards |
| Tablet portrait | 768px | Two columns where appropriate |
| Tablet landscape / desktop | 1024px+ | Full multi-column layout |

**Rule:** If a component doesn't work at 375px width, it's not done.
