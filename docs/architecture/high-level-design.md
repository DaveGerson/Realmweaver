# High-Level Design Document: RealmWeaver

> **Last Updated:** 2026-03-23
> **Status:** Phases A through F complete. Local-only SPA, fully functional.

---

## 1. System Overview

RealmWeaver is an AI-native campaign management tool for tabletop RPG Game Masters. It runs as a client-side single-page application (React 19 + Vite) with localStorage persistence and Google Gemini AI integration.

### Core Responsibilities

| Concern | How It's Handled |
|---------|-----------------|
| **World Building** | AI-powered entity generation (NPCs, locations, factions, items, adventures, articles, plots) with campaign context injection |
| **Session Management** | Session Prep Wizard, Session Runner with scene advancement, running log, beats mode, voice capture |
| **In-Session Tools** | DM Coach (narrate, improvise, rollable tables, NPC roleplay), Combat Tracker, Dice Roller, Secrets & Clues Tracker |
| **Navigation** | Entity cross-linking (EntityLink + QuickCard hover), backlinks ("Referenced By"), back stack, recent items, pinned favorites, command palette (Ctrl+K) |
| **World Intelligence** | Continuity Checker (8 rules), Plot Timeline, World Simulation Engine, Content Style Matching, Smart Context Builder (tiered) |
| **Onboarding** | First Campaign Wizard, 4 template campaigns, DM Style progressive disclosure (guided/standard/power) |
| **Persistence** | localStorage with debounced auto-save, JSON import/export, Obsidian markdown export |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React 19 SPA (Vite)                          │
├────────────────┬──────────────────────────┬─────────────────────────┤
│   Components   │   State Management       │   AI Services           │
│                │                          │                         │
│  Views         │  campaignService.ts      │  geminiService.ts       │
│  Dashboards    │  ┌────────────────────┐  │  (facade)               │
│  Editors       │  │ Factory Store      │  │       │                 │
│  Generators    │  │ + Immer            │  │       ▼                 │
│  Dialogs       │  │ + Auto-save (2s)   │  │  ai/core.ts            │
│  Tools         │  │ + localStorage     │  │  ai/realmWeaver.ts     │
│  RealmChat     │  │ + Relationship     │  │  ai/dmCoach.ts         │
│  Visualizers   │  │   syncing          │  │  ai/realmChat.ts       │
│                │  │ + Cascade delete   │  │  ai/evocationWizard.ts │
│                │  └────────────────────┘  │  ai/worldSimulation.ts │
│                │                          │  ai/styleMatching.ts   │
│                │  useSyncExternalStore()  │  ai/mockService.ts     │
│                │  contextBuilder.ts       │                         │
│                │  continuityChecker.ts    │                         │
├────────────────┴──────────────────────────┴─────────────────────────┤
│                     Gemini API / Mock Service                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Patterns

1. **Factory-based external store** — `createCampaignStore()` returns a service object with Immer-powered immutable updates, debounced localStorage persistence, and `subscribe`/`getState` for React's `useSyncExternalStore`.

2. **Three-layer AI facade** — Components call `geminiService.ts` (never `ai/` modules directly). The facade routes to mock or real implementations based on `isMockMode`. Real implementations use `ai/core.ts` for Gemini API calls.

3. **Tiered context builder** — `contextBuilder.ts` assembles AI context with token-budget awareness. Tier 1 (always): setting, style profile, active scene. Tier 2 (contextual): scene NPCs, location, plots. Tier 3 (on-demand): full entity overviews.

4. **Three-tier component hierarchy** — Dashboards (list + generate) → Generators (AI creation forms) → Editors (detail editing with tabbed layouts).

5. **Entity cross-linking** — `EntityLink` renders clickable references with `EntityQuickCard` hover popovers. `LinkedText` auto-detects entity names in text. `BacklinksPanel` shows inbound references ("Referenced By").

---

## 3. Data Model

All data lives in a single `Campaign` object with arrays of typed entities:

```
Campaign
├── npcs: NPC[]               # Characters with personality, faction links, relationships
├── locations: Location[]      # Places with hierarchy, connections, points of interest
├── factions: Faction[]        # Organizations with goals, members, headquarters
├── items: Item[]              # Artifacts, equipment, treasures
├── adventures: Adventure[]    # Story arcs containing Scene[] (JSONB-like nesting)
├── articles: Article[]        # Lore entries with parent/child hierarchy
├── sessionLogs: SessionLog[]  # Session records with notes, beats, recaps
├── playerCharacters: PC[]     # Imported from PDF or manual entry
├── plots: Plot[]              # Cross-session storyline threads
├── notes: Note[]              # Quick freeform notes
├── secrets: Secret[]          # DM secrets/clues with reveal tracking
├── activeEncounter?: Encounter # Live combat state
├── pinnedEntities: PinnedRef[] # Sidebar favorites
├── dmStyle: DmStyle           # guided | standard | power
├── styleProfile?: string      # AI-learned writing voice
└── featureOverrides: Record    # Per-feature visibility toggles
```

### Entity Relationships

```
NPC.factionId          → Faction     (member-of, bidirectional)
NPC.relationships[]    → NPC         (ally/rival/family)
Location.parentId      → Location    (within, cycle-detected)
Location.connections[] → Location    (connected-to)
Location.factionId     → Faction     (controlled-by)
Faction.leaderId       → NPC         (led-by)
Faction.memberIds[]    → NPC         (has-member, bidirectional)
Faction.headquartersId → Location    (headquartered-at)
Scene.locationId       → Location    (set-in)
Scene.npcIds[]         → NPC         (features)
Article.relatedIds[]   → Any entity  (references)
Plot.relatedIds[]      → Any entity  (involves)
```

---

## 4. Feature Map

| Feature | Component(s) | Service(s) |
|---------|-------------|-----------|
| Entity Generation | `generators/*.tsx` | `geminiService` → `ai/realmWeaver` |
| DM Coach | `dialogs/DmCoach.tsx` | `geminiService` → `ai/dmCoach` |
| NPC Roleplay | `dialogs/DmCoach.tsx` (roleplay mode) | `geminiService` → `ai/realmChat` |
| RealmChat | `RealmChat/RealmChatWidget.tsx` | `geminiService` → `ai/realmChat` |
| Evocation Wizard | `dialogs/EvocationWizard.tsx` | `geminiService` → `ai/evocationWizard` |
| World Simulation | `dialogs/WorldSimulationWizard.tsx` | `geminiService` → `ai/worldSimulation` |
| Style Matching | `editors/CampaignSettingEditor.tsx` | `geminiService` → `ai/styleMatching` |
| Session Runner | `views/SessionRunner.tsx` | `campaignService` |
| Session Prep | `dialogs/SessionPrepWizard.tsx` | `campaignService` |
| Combat Tracker | `tools/CombatTracker.tsx` | `campaignService` |
| Secrets Tracker | `tools/SecretsTracker.tsx` | `campaignService` |
| Continuity Check | `dialogs/ContinuityChecker.tsx` | `continuityChecker.ts` |
| Plot Timeline | `visualizers/PlotTimeline.tsx` | Pure component |
| Relationship Graph | `visualizers/RelationshipGraph.tsx` | Pure component (D3) |
| Navigation | `EntityLink`, `BacklinksPanel`, `LinkedText`, `Breadcrumbs` | `backlinkUtils.ts` |
| Command Palette | `common/CommandPalette.tsx` | `campaignService` |
| First Campaign Wizard | `views/FirstCampaignWizard.tsx` | `geminiService` → `ai/evocationWizard` |
| Campaign Templates | `views/CampaignCreator.tsx` | `data/templates/` |
| Cross-Campaign | `views/CrossCampaignDashboard.tsx` | `campaignService` |

---

## 5. Testing Strategy

| Layer | Framework | Count | Purpose |
|-------|-----------|-------|---------|
| Unit | Vitest | 97 | Service logic, context builder, utilities |
| E2E | Playwright | 38 | User workflows: campaign CRUD, navigation, session runner, DM tools |
| Smoke | Built-in | ~20 | Service function availability, entity operations |
| Manual | Mock mode | — | Full app testing without API key |

---

## 6. Project Structure

```
Realmweaver/
├── App.tsx                          # Root: routing, state, modal management
├── components/
│   ├── common/                      # Shared: Button, Icons, TabLayout, EntityLink,
│   │                                  QuickCard, LinkedText, BacklinksPanel, etc.
│   ├── layout/                      # Shell: Header, CampaignSidebar, ContentWrapper
│   ├── views/                       # Screens: Welcome, Creator, SessionRunner, etc.
│   ├── dashboards/                  # Entity lists (9 dashboards)
│   ├── generators/                  # AI creation forms (8 generators)
│   ├── editors/                     # Detail editors with tabs (12 editors)
│   ├── dialogs/                     # Modals: DmCoach, Wizards, Checker, etc.
│   ├── tools/                       # CombatTracker, SecretsTracker, DiceRoller
│   ├── visualizers/                 # RelationshipGraph, PlotTimeline
│   └── RealmChat/                   # Floating chat assistant
├── services/
│   ├── campaignService.ts           # Central state store (~1900 lines)
│   ├── geminiService.ts             # AI facade with mock switching
│   ├── contextBuilder.ts            # Tiered AI context assembly
│   ├── continuityChecker.ts         # 8 rule-based consistency checks
│   ├── importExportService.ts       # JSON/Obsidian import-export
│   └── ai/                          # AI modules (core, realmWeaver, dmCoach,
│                                      realmChat, evocation, worldSim, style, mock)
├── types/                           # TypeScript interfaces (barrel via index.ts)
├── utils/                           # Helpers: entityUtils, backlinkUtils, dmStyleUtils,
│                                      diceUtils, keyboardShortcuts
├── data/templates/                  # 4 campaign templates (JSON)
├── e2e/                             # Playwright E2E tests
├── tests/                           # Vitest unit tests
└── docs/                            # Architecture and design documentation
    ├── architecture/                # Technical design, implementation plan, this file
    └── design/                      # DM archetypes, session cockpit review
```
