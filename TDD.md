
# Technical Design Document: RealmWeaver

> **Last Updated:** 2026-03-18
> **Audience:** Developers contributing to the RealmWeaver codebase

---

## 1. Introduction

RealmWeaver is a single-page application (SPA) for tabletop RPG Game Masters to create, manage, and run campaigns with AI assistance. It runs entirely in the browser with client-side persistence (localStorage) and integrates with Google Gemini for AI-powered content generation.

This document covers the technical architecture, design decisions, data flow, and key subsystems.

---

## 2. Technology Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Runtime** | React 19.2.0 | UI framework with `useSyncExternalStore` for external state binding |
| **Language** | TypeScript 5.8.2 | Type safety (ES2022 target, bundler module resolution) |
| **Build** | Vite 6.2.0 | Dev server, HMR, production bundling |
| **AI** | @google/genai 1.25.0 | Google Gemini API client (schema-enforced JSON generation) |
| **State** | Immer 10.1.3 | Immutable state updates with mutable syntax |
| **Styling** | Tailwind CSS (CDN) | Utility-first CSS — loaded via `<script>` in index.html, not a build dependency |
| **Icons** | Lucide React 0.546.0 | SVG icon library, centralized through `Icons.tsx` |
| **Graphs** | React Flow 11.10.1 + Dagre 0.8.5 + D3 7.8.5 | Entity relationship visualization |
| **Utilities** | tailwind-merge 3.3.1 | Conditional className composition without conflicts |
| **Testing** | Vitest 4.1.0 | Test runner (configured, used alongside built-in smoke tests) |

### Dependency Loading

React, Immer, Lucide, React Flow, Dagre, D3, and `@google/genai` are loaded via **ES module import maps** defined in `index.html`. Tailwind CSS is loaded via CDN script tag. This avoids bundling these libraries, keeping the build focused on application code.

### TypeScript Configuration

- **Target:** ES2022 with `bundler` module resolution
- **JSX:** `react-jsx` (automatic runtime — no `React` import needed)
- **Path alias:** `@/*` maps to project root
- **No emit:** TypeScript does type checking only; Vite handles transpilation
- **Strict mode:** Not explicitly enabled

---

## 3. Project Architecture

### 3.1 Directory Layout

All code lives at the **project root** — there is no `src/` directory.

```
Realmweaver/
├── App.tsx                     # Root component (~671 lines)
├── index.tsx                   # React 19 createRoot entry
├── index.html                  # Import maps, CDN deps, custom styles
├── vite.config.ts              # Dev server (port 3000), path aliases, env injection
├── smokeTest.ts                # Built-in smoke test suite (~389 lines)
│
├── components/                 # UI layer (organized by role)
│   ├── common/                 # Shared primitives: Button, Icons, Textarea, EntityHistoryManager
│   ├── layout/                 # App shell: Header, CampaignSidebar, ContentWrapper
│   ├── views/                  # Top-level screens: Welcome, Creator, Selector, SessionRunner
│   ├── dashboards/             # Entity list views with embedded generators (9 dashboards)
│   ├── generators/             # AI creation forms (8 generators + EntityChatGenerator)
│   ├── editors/                # Detail editing views (13 editors + PrepDocumentView)
│   ├── dialogs/                # Modal tools: DmCoach, EvocationWizard, ExportModal
│   ├── tools/                  # Gameplay tools: CombatTracker
│   ├── visualizers/            # Data viz: RelationshipGraph
│   └── RealmChat/              # Floating chat widget: RealmChatWidget
│
├── services/                   # Business logic layer
│   ├── campaignService.ts      # Central state store (~1,736 lines)
│   ├── geminiService.ts        # AI service facade (~143 lines)
│   ├── importExportService.ts  # Import/export logic
│   └── ai/                     # AI implementation modules
│       ├── core.ts             # Gemini API wrapper (~119 lines)
│       ├── realmWeaver.ts      # Entity generation (~278 lines)
│       ├── dmCoach.ts          # Session assistance (~99 lines)
│       ├── realmChat.ts        # Conversational AI (~141 lines)
│       ├── evocationWizard.ts  # Batch generation & parsing (~189 lines)
│       └── mockService.ts      # Mock data for offline testing (~423 lines)
│
├── types/                      # TypeScript type definitions (18+ files)
│   ├── index.ts                # Barrel export
│   ├── Campaign.ts             # Root campaign type
│   └── [Entity].ts             # One file per entity type
│
└── utils/
    └── entityUtils.ts          # Default entity factories
```

### 3.2 Layer Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Component Layer                        │
│  Dashboards │ Generators │ Editors │ Dialogs │ Tools     │
├─────────────┼────────────────────────┼──────────────────┤
│             │                        │                   │
│  React      │  campaignService.ts    │  geminiService.ts │
│  State      │  (External Store)      │  (AI Facade)      │
│  Binding    │                        │       │           │
│             │  ┌──────────────────┐  │       ▼           │
│  useSyncExternalStore()           │  │  ┌────────────┐   │
│             │  │ Immer produce()  │  │  │ ai/core.ts │   │
│             │  │ localStorage     │  │  │ (Gemini)   │   │
│             │  │ Debounced save   │  │  └────────────┘   │
│             │  └──────────────────┘  │       │           │
├─────────────┴────────────────────────┴───────┼───────────┤
│                                              ▼           │
│              Google Gemini API / Mock Service             │
└─────────────────────────────────────────────────────────┘
```

---

## 4. State Management

### 4.1 Factory-Based External Store

**Location:** `services/campaignService.ts`

The app uses a custom external store (not Redux, Zustand, or Context) built with the factory pattern:

```typescript
export function createCampaignStore(config: { persist?: boolean } = {}) {
    let state: CampaignState = {
        campaigns: Campaign[],
        activeCampaignId: string | null,
        appStatus: 'loading' | 'welcome' | 'selecting' | 'creating' | 'editing',
        saveStatus: 'idle' | 'saved' | 'saving' | 'error',
        lastSavedAt: string | null,
    };
    const listeners = new Set<() => void>();

    const updateState = (updater: (draft: CampaignState) => void) => {
        state = produce(state, updater);   // Immer immutable update
        notify();                           // Notify React subscribers
        scheduleSave();                     // Debounced localStorage write (2s)
    };

    const _internalUpdate = (updater: (draft: CampaignState) => void) => {
        state = produce(state, updater);
        notify();
        // No save — used for meta-state like saveStatus, appStatus
    };

    return { getState, subscribe, /* CRUD methods */ };
}

export const campaignService = createCampaignStore(); // Singleton
```

**Design decisions:**
- **Factory pattern** — `createCampaignStore({ persist: false })` enables isolated test instances
- **Two update paths** — `updateState()` triggers persistence; `_internalUpdate()` doesn't (for transient UI state like `saveStatus`)
- **Debounced save** — 2-second delay prevents excessive localStorage writes during rapid edits
- **`useSyncExternalStore`** — React 18+ API for subscribing to external state without Context

### 4.2 React Binding

```typescript
// App.tsx
const { campaigns, activeCampaignId, appStatus, saveStatus, lastSavedAt } =
    useSyncExternalStore(campaignService.subscribe, campaignService.getState);
```

Components derive state from this binding. UI-only state (selected entity IDs, active view, modal states, `isMockMode`) lives in `useState` within `App.tsx`.

### 4.3 Persistence

- **Storage keys:** `realmweaver-campaigns` and `realmweaver-active-campaign-id`
- **Format:** JSON serialization of the full campaigns array
- **Timing:** Debounced 2-second auto-save after any state change via `updateState()`
- **Loading:** On mount, the store reads from localStorage and sets `appStatus` accordingly

### 4.4 Relationship Management

The campaign service handles entity cross-references automatically:

- **Bidirectional sync:** `linkNpcToFaction()` updates both the NPC's `factionId` and the Faction's member list (`_synchronizeNpcFactionLink`)
- **Cascade deletion:** Deleting a faction removes `factionId` from all linked NPCs
- **Cycle detection:** `setLocationParent()` validates no circular parent-child chains
- **Scene linking:** Scenes reference NPCs and locations; deletion cleans up these references

---

## 5. AI Service Architecture

### 5.1 Three-Layer Design

```
Components
    ↓ call
geminiService.ts          ← Facade: checks isMockMode, routes to real or mock
    ↓ delegates to
ai/realmWeaver.ts         ← Domain logic: prompts, schemas, instructions
ai/dmCoach.ts
ai/realmChat.ts
ai/evocationWizard.ts
    ↓ calls
ai/core.ts                ← Gemini API wrapper: generateWithSchema / generateText / generateChatCompletion
```

### 5.2 Core API Functions (`ai/core.ts`)

**`generateWithSchema(prompt, schema, instructions, configOverrides, modelName, campaignContext?)`**
- Forces structured JSON output via Gemini's `responseSchema`
- Injects campaign context into the prompt
- Manages thinking budgets: Pro 32K tokens, Flash 24K tokens
- Cleans markdown-wrapped JSON from responses
- Special handling for tool-augmented calls (Google Search) — must omit schema

**`generateText(fullPrompt, modelName, campaignContext?)`**
- Free-form text generation (narration, descriptions)
- Injects campaign context

**`generateChatCompletion(history, systemInstruction, modelName, campaignContext?)`**
- Multi-turn conversation support (RealmChat, EntityChatGenerator)
- Prepends campaign context to the first user message

**Client initialization:** Lazy — the `GoogleGenAI` client is created on the first API call using the injected `GEMINI_API_KEY`.

### 5.3 Domain Modules

| Module | Functions | Output |
|--------|-----------|--------|
| `realmWeaver.ts` | `generateNpc`, `generateLocation`, `generateFaction`, `generateItem`, `generateScene`, `generateAdventure`, `generateArticle` | Structured entity JSON |
| `dmCoach.ts` | `generateNarration`, `generateImprovisation`, `generateRollableTable`, `analyzeSessionNotes` | Free text, structured tables |
| `realmChat.ts` | `generateRealmChatResponse` | `{ message, suggestions, draftEntities }` |
| `evocationWizard.ts` | `generateCampaignFill`, `parseNpcFromText`, `parseLocationFromText`, `chatWithDocument`, `parseCharacterSheetPdf` | Batch entity arrays |

Each module defines:
- **JSON schemas** using `@google/genai`'s `Type` enum for structured output
- **System instructions** that set the AI's persona and task requirements
- **Campaign context** integration for world-consistent generation

### 5.4 Service Facade (`geminiService.ts`)

Every AI function is exported through the facade, which handles mock mode switching:

```typescript
export const generateNpc = (prompt, useGroundedSearch, isMockMode, campaignContext) => {
    if (isMockMode) return mockService.generateNpc(prompt, useGroundedSearch);
    return aiRealmWeaver.generateNpc(prompt, useGroundedSearch, campaignContext);
};
```

**21 exported functions** cover all generation, coaching, parsing, and chat operations.

### 5.5 Mock Service (`ai/mockService.ts`)

Mirrors the facade API with:
- Hardcoded sample data for every entity type
- Simulated async delays
- No external API calls

Used for offline development, smoke tests, and demo mode.

### 5.6 Campaign Context

Every AI call receives a `campaignContext` string built from the active campaign:

```typescript
const campaignContext = `
Setting: ${campaign.setting}
Existing NPCs: ${campaign.npcs.map(n => n.name).join(', ')}
Existing Locations: ${campaign.locations.map(l => l.name).join(', ')}
// ... factions, items, session history, active scene, etc.
`;
```

This ensures generated content is consistent with the existing world.

---

## 6. Component Architecture

### 6.1 View Routing

`App.tsx` manages the active view via `EditorView` type:

```typescript
type EditorView = 'setting' | 'npcs' | 'locations' | 'factions' | 'items' |
    'adventures' | 'lorebook' | 'session-logs' | 'player-characters' |
    'plots' | 'combat' | 'relationships' | 'session-runner';
```

View selection is driven by `CampaignSidebar` navigation. The main content area renders the appropriate dashboard, editor, or tool based on `activeView` and any selected entity ID.

### 6.2 Three-Tier Component Pattern

**Dashboards** (`components/dashboards/`)
- List views showing all entities of a type
- Embed the corresponding generator inline
- Handle entity selection and creation callbacks
- 9 dashboards: NPC, Location, Faction, Item, Adventure, Article, SessionLog, PlayerCharacter, Plot

**Generators** (`components/generators/`)
- AI-powered creation forms
- Accept `isMockMode` and `campaignContext` props
- Call `geminiService` functions and return created entities via callbacks
- Support both prompt-based and chat-based creation (EntityChatGenerator)
- 8 generators + EntityChatGenerator

**Editors** (`components/editors/`)
- Detail editing views for individual entities
- Manage local form state for fields
- Include AI-assist buttons for individual field generation
- Call `onUpdate` callbacks to persist changes via campaignService
- 13 editors + PrepDocumentView

### 6.3 Specialized Components

**DmCoach** (`components/dialogs/DmCoach.tsx`)
- Slide-out panel with three tools: Narrator, Improviser, Rollable Table
- Each tool has its own prompt, placeholder, action function, and icon
- Low-latency mode toggle (`useLiteModel`) for faster in-session responses
- Receives active session context for aware generation

**EvocationWizard** (`components/dialogs/EvocationWizard.tsx`)
- Modal with four modes: simple, detailed, ingest, chat
- Manages internal `WizardStateData` (arrays of NPCs, locations, factions, items, adventures)
- In-wizard editing before approval
- Batch output via `onAddToCampaign` callback

**RealmChatWidget** (`components/RealmChat/RealmChatWidget.tsx`)
- Floating chat interface (open/minimize/close states)
- Multi-turn conversation history
- Draft entity management — preview, edit, approve workflow
- Model tier selection (performance/medium/quality)

**SessionRunner** (`components/views/SessionRunner.tsx`)
- Unified session view with scene management
- Integrated combat tracking, voice notes, DM tools
- Scene progression (planned → in-progress → completed)

**RelationshipGraph** (`components/visualizers/RelationshipGraph.tsx`)
- D3-based force-directed graph of entity relationships
- Interactive: click nodes to navigate to entity editors
- Auto-layout via Dagre

### 6.4 Shared Components

- **Button** — styled button with variant support
- **Textarea** — styled textarea
- **Icons** — centralized re-export from `lucide-react` (all icon imports must go through this file)
- **EntityHistoryManager** — version history tracking for entities that support undo/history

---

## 7. Type System

### 7.1 Entity Type Pattern

Each entity has its own file in `types/` and is re-exported via `types/index.ts`:

```typescript
// types/NPC.ts
export interface NPC {
    id: string;           // UUID (generated by campaignService)
    name: string;         // Display name
    description: string;  // Primary description
    history: Array<{...}>;  // Version history
    // ... entity-specific fields
}
```

**Required fields (all entities):** `id`, `name`
**Common fields:** `description`, `history`

### 7.2 Campaign Type

```typescript
interface Campaign {
    id: string;
    title: string;
    settingType: 'custom' | 'official';
    officialSetting?: string;
    setting: string;
    npcs: NPC[];
    locations: Location[];
    factions: Faction[];
    items: Item[];
    adventures: Adventure[];     // Each contains Scene[]
    articles: Article[];
    sessionLogs: SessionLog[];
    playerCharacters: PlayerCharacter[];
    plots: Plot[];
    notes: Note[];
    activeEncounter?: Encounter;
    activeSceneId?: string;
    activeSessionId?: string;
}
```

### 7.3 Adding a New Entity Type

1. Create `types/NewEntity.ts`
2. Export from `types/index.ts`
3. Add array to `Campaign` interface
4. Add CRUD methods in `campaignService.ts`
5. Add mock data in `mockService.ts`
6. Add facade function in `geminiService.ts`
7. Add default factory in `entityUtils.ts`
8. Create generator, dashboard, and editor components
9. Add view routing in `App.tsx`
10. Add sidebar entry in `CampaignSidebar.tsx`

---

## 8. Knowledge Graph & Context System

### 8.1 Entity Relationships

Entities form an interconnected graph:

```
Adventure ──contains──→ Scene ──occurs at──→ Location
                          │                      │
                          ├──involves──→ NPC ←──controls── Faction
                          │              │
                          │              └──member of──→ Faction
                          │
Article ──references──→ [NPC | Location | Faction]

Location ──parent of──→ Location (hierarchy)
Location ──connects to──→ Location (adjacency)
```

### 8.2 Context Injection for DM Coach

The DM Coach builds a priority-ranked context string:

1. **Active session state** — current scene, adventure, location, present NPCs
2. **Campaign notes** — most recently modified notes
3. **Current focus** — whatever entity the DM is editing during the session
4. **Linked lore** — articles connected to any entity currently in context

This ensures the AI "knows" the web of relationships surrounding the party.

---

## 9. Styling Architecture

### 9.1 Tailwind CSS via CDN

Tailwind is loaded via a CDN `<script>` tag in `index.html`, not as a build dependency. This means:
- No `tailwind.config.js`
- No PostCSS processing
- Classes applied inline
- `tailwind-merge` resolves conflicting classes at runtime

### 9.2 Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| Background | `bg-stone-900`, `bg-stone-800`, `bg-slate-950` | Page, cards, panels |
| Text | `text-stone-100`, `text-stone-300` | Primary, secondary |
| Accent | `text-amber-400`, `bg-amber-600` | Interactive, highlights |
| Border | `border-stone-700` | Separators, card edges |
| Radius | `rounded-lg`, `rounded-md` | Cards, inputs |

### 9.3 Fonts

- **Roboto** (sans-serif) — body text
- **Merriweather** (serif) — headings
- Both loaded via Google Fonts CDN in `index.html`

---

## 10. Testing

### 10.1 Smoke Tests (`smokeTest.ts`)

Built-in test suite triggered from within the app:

- **`testServiceFunctions()`** — validates all generator functions return data in the expected format
- **`testCampaignHandlers()`** — simulates a full user session: create campaign → CRUD entities → link relationships → reorder → delete
- Runs with `isMockMode` parameter to avoid API calls
- Provides console-based pass/fail reporting

### 10.2 Vitest

Configured in `vite.config.ts` (globals: true, environment: node). Available for unit tests:

```bash
npm test         # Run once
npm run test:watch  # Watch mode
```

### 10.3 Manual Testing

- Toggle mock mode in the header for API-free testing
- Browser DevTools for state inspection
- localStorage can be cleared to reset all data

---

## 11. Build & Deployment

### 11.1 Vite Configuration

```typescript
// vite.config.ts
{
    plugins: [react()],
    server: { port: 3000, host: '0.0.0.0' },
    resolve: { alias: { '@': path.resolve(__dirname, '.') } },
    define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    }
}
```

### 11.2 Environment Variables

| Variable | Source | Usage |
|----------|--------|-------|
| `GEMINI_API_KEY` | `.env.local` | Injected at build time via Vite `define` |

### 11.3 Production Build

```bash
npm run build    # Outputs to dist/
npm run preview  # Serves dist/ for verification
```

The build produces a static SPA bundle. No server-side rendering or API backend.

---

## 12. Security Considerations

- **API key handling:** The Gemini API key is injected at build time — it is embedded in the client bundle. This is acceptable for the current deployment model (Google AI Studio) but would need server-side proxying for public deployment.
- **Data storage:** All campaign data is stored in browser localStorage. No server-side persistence.
- **No authentication:** The app is single-user, local-only. Cloud sync and auth are planned for Phase 5.
- **Input sanitization:** AI-generated content is rendered as text/markdown, not raw HTML.

---

## 13. Known Limitations & Technical Debt

1. **No server-side persistence** — localStorage only; data is browser-specific and can be lost on clear
2. **API key in client bundle** — acceptable for current deployment, needs proxying for public use
3. **No formal test coverage** — smoke tests provide sanity checks but not comprehensive unit/integration coverage
4. **No linting/formatting tools** — no ESLint or Prettier configured
5. **No CI/CD pipeline** — no automated builds, tests, or deployments
6. **Large files** — `campaignService.ts` (~1,736 lines) and `App.tsx` (~671 lines) could benefit from decomposition
7. **Tailwind CDN** — no tree-shaking of CSS; entire Tailwind library is loaded
8. **Import maps for deps** — limits control over dependency bundling and tree-shaking
