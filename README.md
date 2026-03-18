
# RealmWeaver

<p align="center">
  <img src="https://storage.googleapis.com/aistudio-ux-team-bucket/apps/lu-lp/logo.png" alt="RealmWeaver Logo" width="150">
</p>

<h3 align="center">The AI-native campaign cockpit for tabletop RPG Game Masters.</h3>

<p align="center">
  Build worlds. Craft stories. Run sessions. All with AI at your side.
</p>

---

## What is RealmWeaver?

RealmWeaver is a single-page application for tabletop RPG Game Masters who want to create, manage, and run campaigns with AI assistance. It combines deep world-building tools, real-time session support, and conversational AI into one unified experience — replacing the juggle of scattered notes, wikis, and generator sites.

**Key capabilities:**

- **AI-Powered World Building** — Generate NPCs, locations, factions, items, scenes, adventures, articles, and plots with contextual AI that knows your world
- **Session Cockpit** — Run games from a unified session runner with scene management, combat tracking, voice notes, and DM coaching
- **RealmChat** — A conversational AI assistant for collaborative entity drafting through natural dialogue
- **DM Coach** — In-session tools for narration, improvisation, and rollable table generation
- **Evocation Wizard** — Batch-generate entire regions of connected content in one shot
- **Relationship Graph** — Visualize entity connections with interactive D3/React Flow graphs
- **Plot Tracking** — Track storylines across sessions so nothing falls through the cracks
- **Import/Export** — JSON and Obsidian markdown formats, plus PDF character sheet parsing
- **Offline-Ready** — Full mock mode for development and testing without API calls

---

## Quick Start

### Prerequisites

- Node.js 18+
- A Google Gemini API key (optional — mock mode works without one)

### Installation

```bash
git clone <repository-url>
cd Realmweaver
npm install
```

### Configuration

Create a `.env.local` file in the project root:

```env
GEMINI_API_KEY=your_api_key_here
```

### Running

```bash
npm run dev      # Development server → http://localhost:3000
npm run build    # Production build
npm run preview  # Preview production build
```

Toggle **Mock Mode** in the header to use the app without an API key — all AI features return sample data.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | React | 19.2.0 |
| **Language** | TypeScript | 5.8.2 |
| **Build** | Vite | 6.2.0 |
| **AI** | Google Gemini (@google/genai) | 1.25.0 |
| **State** | Custom store + Immer | 10.1.3 |
| **Styling** | Tailwind CSS (CDN) | Latest |
| **Icons** | Lucide React | 0.546.0 |
| **Graphs** | React Flow + Dagre + D3 | 11.10.1 / 0.8.5 / 7.8.5 |
| **Utilities** | tailwind-merge | 3.3.1 |

**AI Models:**
- **Primary:** `gemini-2.5-flash` — fast generation for most content
- **Quality:** `gemini-2.5-pro` — deeper reasoning for complex generation
- Thinking budgets: Pro 32K tokens, Flash 24K tokens

---

## Architecture Overview

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        React SPA (Vite)                          │
├──────────────┬───────────────────────────────┬───────────────────┤
│              │                               │                   │
│  Components  │    State Management           │   AI Services     │
│              │                               │                   │
│  Dashboards  │  campaignService.ts           │  geminiService.ts │
│  Generators  │  ┌─────────────────────┐      │  (facade)         │
│  Editors     │  │ Factory Store       │      │       │           │
│  Dialogs     │  │ + Immer             │      │       ▼           │
│  Tools       │  │ + Debounced Save    │      │  ai/core.ts       │
│  RealmChat   │  │ + localStorage      │      │  ai/realmWeaver   │
│              │  └─────────────────────┘      │  ai/dmCoach       │
│              │                               │  ai/realmChat     │
│              │  useSyncExternalStore()        │  ai/evocation     │
│              │  for React binding             │  ai/mockService   │
│              │                               │                   │
├──────────────┴───────────────────────────────┴───────────────────┤
│                     Gemini API / Mock Service                     │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Action → Component → campaignService method → Immer update →
debounced localStorage save → Notify subscribers → React re-render
```

### Three-Layer Service Architecture

```
Component Layer (React)
        ↓
geminiService.ts (facade — routes to mock or real AI based on mode)
        ↓
ai/realmWeaver.ts │ ai/dmCoach.ts │ ai/realmChat.ts │ ai/evocationWizard.ts
        ↓
ai/core.ts (Gemini API wrapper: generateWithSchema, generateText, generateChatCompletion)
```

### Project Structure

All application code lives at the **project root** — there is no `src/` directory.

```
Realmweaver/
├── App.tsx                        # Root component, view routing, state wiring
├── index.tsx                      # React entry point
├── index.html                     # HTML template (Tailwind CDN, import maps)
├── vite.config.ts                 # Vite config (port 3000, path aliases)
├── smokeTest.ts                   # Built-in smoke test suite
│
├── components/
│   ├── common/                    # Button, Icons, Textarea, EntityHistoryManager
│   ├── layout/                    # Header, CampaignSidebar, ContentWrapper
│   ├── views/                     # WelcomeScreen, CampaignCreator, CampaignSelector, SessionRunner
│   ├── dashboards/                # List views: NPC, Location, Faction, Item, Adventure, Article, etc.
│   ├── generators/                # AI creation forms: NPC, Location, Faction, Item, Scene, etc.
│   ├── editors/                   # Detail editors: NPC, Location, Faction, Item, Adventure, etc.
│   ├── dialogs/                   # DmCoach, EvocationWizard, ExportModal
│   ├── tools/                     # CombatTracker
│   ├── visualizers/               # RelationshipGraph (D3-based)
│   └── RealmChat/                 # RealmChatWidget (floating assistant)
│
├── services/
│   ├── campaignService.ts         # Central state store (factory + Immer + localStorage)
│   ├── geminiService.ts           # AI service facade (mock mode switching)
│   ├── importExportService.ts     # Import/export (JSON, Obsidian)
│   └── ai/                        # AI modules
│       ├── core.ts                # Gemini API wrapper
│       ├── realmWeaver.ts         # Entity generation
│       ├── dmCoach.ts             # Session assistance
│       ├── realmChat.ts           # Conversational AI
│       ├── evocationWizard.ts     # Batch generation & document parsing
│       └── mockService.ts         # Mock data for testing
│
├── types/                         # TypeScript interfaces (barrel-exported via index.ts)
│   ├── Campaign.ts, NPC.ts, Location.ts, Faction.ts, Item.ts,
│   ├── Adventure.ts, Scene.ts, Article.ts, SessionLog.ts,
│   ├── PlayerCharacter.ts, Plot.ts, Note.ts, Encounter.ts,
│   ├── RealmChat.ts, Evocation.ts, Graph.ts, RollableTable.ts, etc.
│
└── utils/
    └── entityUtils.ts             # Default entity factories and helpers
```

### State Management

The app uses a **factory-based external store** (`createCampaignStore`) with React's `useSyncExternalStore` for binding:

- **Immer** handles immutable state updates
- **Debounced auto-save** (2s) persists to `localStorage`
- **Relationship syncing** — linking an NPC to a faction automatically updates both sides
- **Cascade deletion** — removing entities cleans up references across the graph
- **Cycle detection** — location parent-child hierarchies are validated

### Entity Model

The `Campaign` type holds arrays of all entity types:

| Entity | Description |
|--------|-------------|
| **NPC** | Characters with personality, backstory, secrets, faction links |
| **Location** | Places with hierarchy (parent/child), connections, points of interest |
| **Faction** | Organizations with goals, relationships, NPC membership |
| **Item** | Artifacts, equipment, treasures |
| **Adventure** | Story arcs containing ordered scenes |
| **Scene** | Encounters within adventures — read-aloud text, GM notes, skill checks |
| **Article** | Lore entries linked to any entities |
| **Session Log** | Session records with notes, recaps, voice transcription |
| **Player Character** | PC data imported from PDF character sheets or manual entry |
| **Plot** | Cross-session storyline threads with status tracking |
| **Note** | Quick freeform notes |
| **Encounter** | Combat tracking (initiative, HP, combatants) |

---

## Features in Detail

### AI Generation

Every entity type can be generated from a natural language prompt. The AI uses your campaign's setting, existing entities, and relationships as context to maintain consistency. Generation supports:

- **Schema-enforced output** — AI returns structured JSON matching your type definitions
- **Campaign context injection** — every AI call receives relevant campaign data
- **Grounded search** — NPC generation can use Google Search for well-known characters
- **Multi-model support** — choose between Flash (fast) and Pro (quality)

### RealmChat

A floating conversational assistant for collaborative entity creation:
- Natural dialogue → AI builds draft entities in the background
- Review, edit, and approve drafts before adding to your campaign
- Model tier selection (performance/medium/quality)

### DM Coach

Three in-session tools accessible from the header:
- **Narrator** — generate read-aloud descriptive text
- **Improviser** — get consequences and plot hooks for unexpected player actions
- **Rollable Tables** — generate custom random tables on any theme

### Evocation Wizard

Four batch generation modes:
- **Simple** — single theme generates a full set of related entities
- **Detailed** — multiple specific prompts for fine control
- **Ingest** — parse existing documents for entities
- **Chat** — iterative conversational batch generation

### Session Runner

Unified view for running live sessions with scene management, combat tracking, voice notes, and integrated DM tools.

### Combat Tracker

Initiative tracking, HP management, and encounter management integrated into the session flow.

### Relationship Graph

Interactive D3/React Flow visualization showing how NPCs, factions, locations, and other entities connect across your campaign.

---

## Roadmap

RealmWeaver's roadmap is organized into phased delivery. See `UX_OVERHAUL_PLAN.md` for the full product strategy and `TODO.md` for detailed technical tasks.

### Phase 0: Session Cockpit (P0 — In Progress)
Complete the unified session runner — dice roller, quick tools panel, running log with auto-event capture, one-click "Go Live", tablet-responsive layout.

### Phase 1: Fast World-to-Session Pipeline (P1)
Contextual "Generate Here" buttons, global search (Cmd+K), session prep wizard, quick entity card popovers, inline scene builder.

### Phase 2: Fun & Friction-Free Interface (P2)
Conversational generation as default, rich dashboard cards, tabbed editor layouts, dark fantasy visual polish, keyboard shortcuts.

### Phase 3: Plot Coherence & World Intelligence (P2)
Enhanced plot timeline, continuity checker, world evolution engine (post-session state propagation), smart tiered context window, relationship intelligence.

### Phase 4: Note-Taking Reduction (P1)
Always-on voice log in session runner, smart note structuring, post-session auto-recap, event-driven auto-capture from combat/scene transitions.

### Phase 5: Collaboration & Sharing (P1)
Cloud sync with user accounts, player portal (free accounts), GM secrets system, shared world wiki, session recap sharing.

### Phase 6: Maps & Spatial Worldbuilding (P2)
Interactive world maps with location pins, battle maps with token placement, location hierarchy visualization.

### Phase 7: Onboarding & Growth (P3)
First campaign wizard, contextual feature discovery, template campaigns, community content hub, multi-system support (Pathfinder, Fate, PbtA).

### Phase 8: Advanced AI (P3)
AI world simulation between sessions, adaptive difficulty engine, player behavior prediction, content style matching, cross-campaign intelligence.

### Priority Matrix

| Phase | Impact | Effort | Priority |
|-------|--------|--------|----------|
| 0: Session Cockpit | Very High | Medium | **P0** |
| 1: World-to-Session Pipeline | High | Medium | **P1** |
| 4: Note-Taking Reduction | High | Medium | **P1** |
| 5: Collaboration & Sharing | Very High | Very High | **P1** |
| 3: Plot Coherence | High | Medium | **P2** |
| 2: Fun Interface | Medium | Medium | **P2** |
| 6: Maps | High | High | **P2** |
| 7: Onboarding & Growth | Medium | Low-Med | **P3** |
| 8: Advanced AI | High | High | **P3** |

---

## Development

### Scripts

```bash
npm run dev      # Vite dev server on port 3000
npm run build    # Production build
npm run preview  # Preview production build
npm test         # Run Vitest
```

### Key Conventions

- **No `src/` directory** — all code lives at the project root
- **Import alias** — `@/` maps to project root (`@/components/common/Button`)
- **Icons** — always import from `@/components/common/Icons.tsx`, never directly from `lucide-react`
- **Types** — import from `@/types/index` barrel export
- **Named exports only** — no default exports
- **AI facade** — all AI calls go through `geminiService.ts`, never call `ai/` modules directly
- **Mock mode** — every AI function must have a mock implementation
- **Campaign context** — always pass to AI functions for consistency

### Testing

- **Built-in smoke tests** (`smokeTest.ts`) — validates service functions, entity CRUD, relationships, and import/export
- **Mock mode** — enables full app testing without API calls
- **Vitest** — configured but primarily used for future unit testing

### Design System

- **Theme:** Dark fantasy — stone grays (`stone-800`, `stone-900`) + amber accents (`amber-400`, `amber-600`)
- **Fonts:** Roboto (body), Merriweather (headings)
- **Radius:** `rounded-lg` for cards, `rounded-md` for inputs
- **Tailwind via CDN** — no build-time config, classes applied inline

---

## Contributing

1. Read `CLAUDE.md` for comprehensive developer patterns and conventions
2. Check `TODO.md` and `UX_OVERHAUL_PLAN.md` for planned work
3. Use mock mode for development — toggle in the header
4. Follow existing code patterns (named exports, service facade, Immer updates)
5. Ensure new AI functions have mock implementations

---

## License

Proprietary. All rights reserved.
