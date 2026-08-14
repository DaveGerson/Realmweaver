
# Technical Design Document: RealmWeaver

> **Last Updated:** 2026-03-26
> **Audience:** Developers contributing to the RealmWeaver codebase

---

## 1. Introduction

RealmWeaver is a single-page application (SPA) for tabletop RPG Game Masters to create, manage, and run campaigns with AI assistance. It runs entirely in the browser with client-side persistence (localStorage). AI generation is powered by the Claude Code CLI via a local Vite proxy middleware, with an Anthropic REST API path prepared for future production deployment.

---

## 2. Technology Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Runtime** | React 19.2.0 | UI framework with `useSyncExternalStore` for external state binding |
| **Language** | TypeScript 5.8.2 | Type safety (ES2022 target, bundler module resolution) |
| **Build** | Vite 6.2.0 | Dev server, HMR, production bundling |
| **AI** | Claude Code CLI / `@anthropic-ai/sdk` 0.39.0 | Local Claude CLI (default) or Anthropic REST API |
| **State** | Immer 10.1.3 | Immutable state updates with mutable syntax |
| **Styling** | Tailwind CSS 4.3.3 (build-time) | Utility-first CSS via `@tailwindcss/vite` + `index.css` |
| **Icons** | Lucide React 0.546.0 | SVG icon library, centralized through `Icons.tsx` |
| **Graphs** | D3 7.8.5 | Entity relationship visualization |
| **Utilities** | tailwind-merge 3.3.1 | Conditional className composition without conflicts |
| **Testing** | Vitest 4.1.0 + Playwright 1.58.2 | Unit tests and E2E tests |

### TypeScript Configuration

- **Target:** ES2022 with `bundler` module resolution
- **JSX:** `react-jsx` (automatic runtime)
- **Path alias:** `@/*` maps to project root
- **No emit:** TypeScript does type checking only; Vite handles transpilation
- **Strict mode:** Not explicitly enabled

---

## 3. Project Architecture

### 3.1 Directory Layout

All code lives at the **project root** — there is no `src/` directory.

```
Realmweaver/
├── App.tsx                     # Root component (~564L after decomposition)
├── index.tsx                   # React 19 createRoot entry; mounts ToastProvider, ConfirmDialogProvider
├── index.html                  # Tailwind CDN, Google Fonts, favicon
├── vite.config.ts              # Dev server (port 3000), path alias, env injection
├── vite-plugin-ai-proxy.ts     # Vite middleware: POST /api/ai/generate -> claude CLI binary
│
├── hooks/                      # Custom React hooks (UX refactoring sprint extractions)
│   ├── useEntitySelection.ts   # Selected entity IDs, nav stack, breadcrumbs, recent items
│   ├── useModalState.ts        # All modal open/close state; closeTopModal() priority logic
│   ├── useConfirmDialog.ts     # Context-provider confirm dialog (replaces window.confirm)
│   ├── useToast.ts             # Context-provider toast queue (replaces window.alert)
│   ├── useEntitySearch.ts      # Multi-field case-insensitive filter for entity lists
│   └── useRovingTabIndex.ts    # Roving tabindex for keyboard grid/list navigation
│
├── components/                 # UI layer (organized by role)
│   ├── common/                 # Shared primitives (20+ components)
│   ├── layout/                 # App shell: Header, CampaignSidebar, ViewRouter
│   │   └── sidebar/            # 5 sidebar sub-components + sidebarUtils.ts
│   ├── views/                  # Top-level screens: Welcome, Creator, SessionRunner, etc.
│   │   └── session/            # 5 SessionRunner sub-components
│   ├── dashboards/             # Entity list views (10 dashboards)
│   ├── generators/             # AI creation forms (8 generators + EntityChatGenerator)
│   ├── editors/                # Detail editing views (12 editors + PrepDocumentView)
│   ├── dialogs/                # Modal tools (7 dialogs, all use DialogShell)
│   ├── tools/                  # Gameplay tools: CombatTracker, DiceRoller, SecretsTracker
│   ├── visualizers/            # Data viz: RelationshipGraph (D3), PlotTimeline
│   └── RealmChat/              # Floating chat widget (indigo accent only)
│
├── services/                   # Business logic layer
│   ├── campaignService.ts      # Central state store
│   ├── aiService.ts            # AI service facade (the ONLY AI import for components)
│   ├── contextBuilder.ts       # Tiered token-budget-aware context assembly
│   ├── continuityChecker.ts    # 8 rule-based consistency checks (pure function, no AI)
│   ├── importExportService.ts  # JSON/Obsidian import-export
│   └── ai/                     # AI implementation modules
│       ├── core.ts             # Backward-compat adapter (3 function signatures preserved)
│       ├── modelConfig.ts      # ModelTier type + tier-to-model mappings + provider config
│       ├── realmWeaver.ts      # Entity generation
│       ├── dmCoach.ts          # Session assistance
│       ├── realmChat.ts        # Conversational AI
│       ├── evocationWizard.ts  # Batch generation & parsing
│       ├── worldSimulation.ts  # World event simulation
│       ├── styleMatching.ts    # DM writing style analysis
│       ├── mockService.ts      # Static mock data for offline dev
│       └── providers/          # AI provider backends
│           ├── types.ts        # AIProvider interface + option types
│           ├── registry.ts     # Provider registry singleton
│           ├── claude-cli.ts   # Claude CLI via Vite proxy (default)
│           ├── anthropic-api.ts # Anthropic REST API (stub)
│           └── retry.ts        # Transient failure retry logic
│
├── types/                      # TypeScript type definitions (24 files, barrel via index.ts)
└── utils/                      # Utility functions (9 files)
```

### 3.2 Layer Diagram

```
+---------------------------------------------------------------+
|                    Component Layer                             |
|  Dashboards | Generators | Editors | Dialogs | Tools          |
+------+----------------------------+-------------------------+--+
       |                            |                         |
       |  React State Binding       |  AI Service Layer       |
       |                            |                         |
       |  useSyncExternalStore()    |  aiService.ts           |
       |          |                 |  (facade/router)        |
       v          v                 |         |               |
  campaignService.ts                |         v               |
  (External Store)                  |    ai/core.ts           |
  +---------------------+           |    (adapter)            |
  | Immer produce()     |           |         |               |
  | localStorage        |           |         v               |
  | Debounced save (2s) |           |  providers/registry.ts  |
  | Relationship sync   |           |         |               |
  | Cascade delete      |           |    claude-cli.ts        |
  +---------------------+           |    (Vite proxy)         |
                                    +-------------------------+
                                              |
                             +----------------+-----------------+
                             |                                  |
                      Claude CLI                         Mock Service
                    (local dev)                        (offline dev)
```

---

## 4. State Management

### 4.1 Factory-Based External Store

**Location:** `services/campaignService.ts`

```typescript
export function createCampaignStore(config: { persist?: boolean } = {}) {
    let state: CampaignState = {
        campaigns: Campaign[],
        activeCampaignId: string | null,
        appStatus: 'loading' | 'welcome' | 'selecting' | 'creating' | 'editing',
        saveStatus: 'idle' | 'saved' | 'saving' | 'error',
        lastSavedAt: string | null,
    };

    const updateState = (updater) => {
        state = produce(state, updater);  // Immer immutable update
        notify();                          // Notify React subscribers
        scheduleSave();                    // Debounced localStorage write (2s)
    };

    const _internalUpdate = (updater) => {
        state = produce(state, updater);
        notify();
        // No save -- for meta-state like saveStatus, appStatus
    };

    return { getState, subscribe, getActiveCampaign, /* CRUD methods */ };
}

export const campaignService = createCampaignStore(); // Singleton
```

**Design decisions:**
- **Factory pattern** — `createCampaignStore({ persist: false })` enables isolated test instances
- **Two update paths** — `updateState()` triggers persistence; `_internalUpdate()` doesn't
- **Debounced save** — 2-second delay prevents excessive localStorage writes during rapid edits
- **`useSyncExternalStore`** — React 18+ API for subscribing to external state without Context

### 4.2 React Binding

```typescript
// App.tsx
const { campaigns, activeCampaignId, appStatus, saveStatus, lastSavedAt } =
    useSyncExternalStore(campaignService.subscribe, campaignService.getState);
```

UI-only state (selected entity IDs, active view, modal states, `isMockMode`) lives in hooks extracted from App.tsx:
- `useEntitySelection` — selected IDs, nav stack, breadcrumbs, recent items
- `useModalState` — modal open/close state for all app-level dialogs

### 4.3 Persistence

- **Storage keys:** `realmweaver-campaigns` and `realmweaver-active-campaign-id`
- **Format:** JSON serialization of the full campaigns array
- **Timing:** Debounced 2-second auto-save after any `updateState()` call
- **Loading:** On mount, the store reads from localStorage and sets `appStatus`

### 4.4 Relationship Management

- **Bidirectional sync:** `linkNpcToFaction()` updates both the NPC's `factionId` and the Faction's member list
- **Cascade deletion:** Deleting a faction removes `factionId` from all linked NPCs
- **Cycle detection:** `setLocationParent()` validates no circular parent-child chains
- **Scene linking:** Scenes reference NPCs and locations; deletion cascades to these references

### 4.5 deleteAdventure Cascade

`deleteAdventure(id)` follows the same cascade pattern as other entity deletes but has two additional cleanup steps specific to the Adventure/Scene/Session relationship:

1. **`Campaign.activeSceneId` cleared** — if the currently active scene belongs to the deleted adventure, `activeSceneId` is set to `undefined` so the Session Runner does not reference a non-existent scene.
2. **`SessionLog.adventureId` nulled** — all session logs that reference the deleted adventure have their `adventureId` set to `null` (preserving the log itself but removing the now-broken link).

These steps run inside a single `updateState()` call so the state transition is atomic and triggers one debounced save.

---

## 5. AI Service Architecture

### 5.1 Three-Layer Design

```
Components
    | import from aiService.ts ONLY
    v
aiService.ts          <- Facade: checks isMockMode, routes to real or mock
    |
    v
ai/realmWeaver.ts     <- Domain logic: prompts, schemas, instructions
ai/dmCoach.ts
ai/realmChat.ts
ai/evocationWizard.ts
ai/worldSimulation.ts
ai/styleMatching.ts
    |
    v
ai/core.ts            <- Backward-compat adapter (preserves 3 function signatures)
    |
    v
providers/registry    <- Active provider (default: claude-cli)
    |
    +-- claude-cli.ts    <- HTTP POST /api/ai/generate -> Vite proxy -> claude binary
    +-- anthropic-api.ts <- Anthropic REST API (stub, not yet implemented)
```

### 5.2 Provider Abstraction Layer

**Location:** `services/ai/providers/`

The provider abstraction allows swapping AI backends without changing domain modules.

**`AIProvider` interface** (all providers implement this):
```typescript
interface AIProvider {
    readonly name: string;
    generateWithSchema<T>(options: GenerateWithSchemaOptions): Promise<T>;
    generateText(options: GenerateTextOptions): Promise<string>;
    generateChatCompletion(options: GenerateChatOptions): Promise<string>;
}
```

**`ModelTier`** — logical quality tiers used throughout the app:
```typescript
type ModelTier = 'lite' | 'standard' | 'quality';

// Claude CLI aliases:   lite -> haiku,  standard -> sonnet,  quality -> opus
// Anthropic API IDs:    lite -> claude-haiku-4-5-20251001,
//                       standard -> claude-sonnet-4-6,
//                       quality  -> claude-opus-4-6
```

**`core.ts`** preserves the three function signatures all domain modules already use (`generateWithSchema`, `generateText`, `generateChatCompletion`). It maps legacy Gemini model name strings to `ModelTier` values so domain modules need no changes during migration.

**Claude CLI provider** (`providers/claude-cli.ts`):
- Makes HTTP POST to the Vite dev server at `/api/ai/generate`
- The `vite-plugin-ai-proxy.ts` middleware handles the request by spawning the `claude` binary
- Security: uses `execFile` (no shell injection) for prompts under 100KB; temp file approach for larger prompts

**Environment variables** for provider configuration:

| Variable | Purpose | Default |
|----------|---------|---------|
| `REALMWEAVER_AI_PROVIDER` | Active provider (`claude-cli` or `anthropic-api`) | `claude-cli` |
| `CLAUDE_CLI_PATH` | Path to the `claude` binary | `claude` (on $PATH) |
| `ANTHROPIC_API_KEY` | API key for `anthropic-api` provider | — |
| `REALMWEAVER_DEFAULT_TIER` | Default model tier | `standard` |
| `REALMWEAVER_MAX_RETRIES` | Max retry attempts on transient errors | `3` |
| `REALMWEAVER_TIMEOUT_MS` | Request timeout | `120000` (2 minutes) |

### 5.3 Core Adapter Functions (`ai/core.ts`)

The adapter forwards calls to the active provider after mapping legacy model names:

**`generateWithSchema(prompt, schema, instructions, configOverrides, modelName, campaignContext?)`**
- Forces structured JSON output (schema embedded in prompt for Claude)
- Injects campaign context
- `configOverrides.contents` (multimodal PDF parts) forwarded; `configOverrides.tools` (Google Search) silently dropped

**`generateText(fullPrompt, modelName, campaignContext?)`**
- Free-form text generation (narration, descriptions)

**`generateChatCompletion(history, systemInstruction, modelName, campaignContext?)`**
- Multi-turn conversation (RealmChat, EntityChatGenerator, document chat)

### 5.4 Domain Modules

| Module | Functions | Output |
|--------|-----------|--------|
| `realmWeaver.ts` | `generateNpc`, `generateLocation`, `generateFaction`, `generateItem`, `generateScene`, `generateAdventure`, `generateArticle`, `generatePoiFromLoot` | Structured entity JSON |
| `dmCoach.ts` | `generateNarration`, `generateImprovisation`, `generateRollableTable`, `generateEnhancedText`, `generateSessionRecap`, `analyzeSessionNotes` | Free text, structured tables |
| `realmChat.ts` | `chatWithRealmWeaver`, `generateNpcRoleplay` | `RealmChatResponse`, `{ dialogue, moodCue }` |
| `evocationWizard.ts` | `generateCampaignFill`, `parseDocumentForEntities`, `generateChatResponse`, `parseCharacterSheetPdf`, `generateStarterNpcs`, `generateStarterLocations`, `generateStarterAdventure` | Batch entity arrays |
| `worldSimulation.ts` | `generateWorldEvent` | `WorldEvent` |
| `styleMatching.ts` | `analyzeWritingStyle` | 200-word style guide string |

### 5.5 Service Facade (`aiService.ts`)

All AI functions route through `aiService.ts` with mock mode switching:

```typescript
export const generateNpc = (prompt: string, isMockMode = false, campaignContext?: string) => {
    if (isMockMode) return mockService.generateNpc(prompt, false, campaignContext);
    return aiRealmWeaver.generateNpc(prompt, campaignContext);
};
```

### 5.6 Mock Service (`ai/mockService.ts`)

Mirrors the facade API with hardcoded sample data, simulated async delays, and no external API calls. Used for offline development, smoke tests, and demo mode.

### 5.7 Campaign Context

`services/contextBuilder.ts` provides a tiered, token-budget-aware builder:

- **Variant `'generation'`** — world consistency: all entity names, setting, relationships
- **Variant `'coach'`** — current session: active scene, combat, recent events first
- **Variant `'chat'`** — balanced: entity names + current context

```typescript
import { buildCampaignContext } from '@/services/contextBuilder';
const campaignContext = buildCampaignContext(campaign, 'generation', 4000);
```

A simpler version in `utils/entityUtils.ts` builds a flat string with entity names only.

---

## 6. Component Architecture

### 6.1 View Routing

`EditorView` type in `App.tsx` defines all valid views:

```typescript
export type EditorView = 'setting' | 'npcs' | 'locations' | 'factions' | 'items' |
    'adventures' | 'lorebook' | 'session-logs' | 'player-characters' |
    'plots' | 'combat' | 'relationships' | 'session-runner' | 'secrets';
```

`components/layout/ViewRouter.tsx` renders the correct component for each `EditorView`. This was extracted from `App.tsx` to reduce its line count from ~1165 to ~564.

### 6.2 CampaignSidebar Patterns

**Default-expanded sections** — all collapsible sections in `CampaignSidebar` open by default so the sidebar is immediately usable without user interaction. Individual section state persists in local React state for the session.

**Drag-drop ordering** — Scene drag-and-drop within the sidebar tracks drag state in two React state variables (`draggingSceneId: string | null`, `dragOverSceneId: string | null`). Visual feedback (drop-target highlight) is applied by comparing these values during render. This replaces an earlier approach that applied CSS classes directly to DOM nodes via `element.classList`, which caused React state/DOM desync. The React-state approach ensures clean re-renders and compatibility with concurrent mode.

**Wizard handoff** — when the First Campaign Wizard completes, it signals the sidebar to expand the relevant entity sections so newly created content is immediately visible without manual navigation.

**Article tree icons** — `ArticleTreeItem` derives its icon from `ENTITY_TYPE_CONFIG` rather than a hardcoded fallback, so article section icons stay consistent with the rest of the app.

### 6.3 Three-Tier Component Pattern

**Dashboards** (`components/dashboards/`)
- List views showing all entities of a type
- Embed creation panel via `EntityCreationPanel` (chat/form toggle)
- Use `useEntitySearch` for search/filter
- Use `useRovingTabIndex` for keyboard list navigation
- Show entity completeness dots (visual indicator of how many optional fields are filled)
- Handle entity selection callbacks
- 10 dashboards: NPC, Location, Faction, Item, Adventure, Article, SessionLog, PlayerCharacter, Plot, Note

**Generators** (`components/generators/`)
- AI-powered creation forms
- Accept `isMockMode`, `campaignContext`, and `onEntityCreated` callback props
- Call `aiService` functions
- Support form-based creation; chat-based creation via `EntityChatGenerator`
- 8 generators + EntityChatGenerator

**Editors** (`components/editors/`)
- Detail editing views with tabbed layouts
- Manage local form state for fields
- Include AI-assist buttons (via `RegenerateButton`) for individual field generation
- Accept `onNavigate` callback for `EntityLink` click handling
- 12 editors + PrepDocumentView

### 6.4 Custom Hooks

| Hook | Purpose | Returns |
|------|---------|---------|
| `useEntitySelection` | All selected entity IDs, nav stack, breadcrumbs, recent items, handlers | `EntitySelectionState` |
| `useModalState` | Open/close state for all app-level modals; `closeTopModal()` priority logic | `ModalState` |
| `useConfirmDialog` | Programmatic confirm dialog via context provider | `{ confirm }` |
| `useToast` | Toast notification queue via context provider | `{ addToast }` |
| `useEntitySearch` | Multi-field case-insensitive filter for entity arrays | `{ filteredEntities, searchTerm, setSearchTerm }` |
| `useRovingTabIndex` | Roving tabindex for keyboard grid/list navigation | `{ getRovingProps }` |

### 6.5 Dialog System

**`DialogShell`** provides:
- `role="dialog" aria-modal="true"`
- Focus trap (Tab/Shift+Tab stay within dialog)
- Escape key to close
- Backdrop click to close
- Body scroll lock while open

**`useConfirmDialog`** — context-provider pattern. `ConfirmDialogProvider` must wrap the app in `index.tsx`. Components call `const { confirm } = useConfirmDialog()` then `await confirm(title, message, options)`.

**`useToast`** — context-provider pattern. `ToastProvider` must wrap the app in `index.tsx`. Components call `const { addToast } = useToast()` then `addToast(message, variant)`.

### 6.6 Entity Cross-Linking System

| Component | Purpose |
|-----------|---------|
| `EntityLink` | Renders entity name as a styled inline link; shows `EntityQuickCard` on hover |
| `EntityQuickCard` | Portal-rendered floating preview card; mobile: bottom sheet |
| `LinkedText` | Scans text for entity name matches and wraps them in `EntityLink` |
| `BacklinksPanel` | Displays all entities that reference the current entity (via `backlinkUtils`) |
| `MentionInput` | Textarea with `@mention` autocomplete for 7 entity types |

### 6.7 Shared Common Components

| Component | Purpose |
|-----------|---------|
| `Button` | Styled button — 5 variants (`primary`, `secondary`, `ghost`, `danger`, `icon`), 3 sizes (`sm`, `md`, `lg`); `twMerge` for className overrides |
| `StepIndicator` | Multi-step wizard progress indicator (step number, label, completed/active state) |
| `Textarea` / `AiTextarea` | Styled textarea; exports `inputBaseClasses`, `textareaBaseClasses` |
| `Icons` | Centralized re-export from `lucide-react` — ALL icon imports must use this |
| `EntityHistoryManager` | Version history tracking for entities that support undo/history |
| `EntityCreationPanel` | Chat-vs-form creation mode toggle for dashboards |
| `RegenerateButton` | Inline AI field regeneration with expanded preview panel |
| `SkeletonCard` | Animated loading placeholder |
| `TabLayout` | Reusable tabbed panel layout with `TabDefinition` interface |
| `DmStylePanel` | DM Style settings panel (guided/standard/power modes) |
| `GenerateHerePanel` | Inline generation trigger panel with collapsible prompt textarea |
| `SceneResourcesPanel` | Collapsible in-editor NPC/location reference for SceneEditor |
| `CommandPalette` | Ctrl+K global search across all entity types |
| `Breadcrumbs` | Navigation breadcrumb trail with clickable segments |
| `KeyboardShortcutsHelp` | Keyboard shortcut reference overlay |
| `ErrorBoundary` | Class-based error boundary; optional custom fallback prop |

---

## 7. Type System

### 7.1 Entity Type Pattern

```typescript
// types/NPC.ts
export interface NPC {
    id: string;           // UUID (generated by campaignService)
    name: string;         // Display name
    description: string;  // Primary description
    history: Array<{...}>;  // Version history
    // entity-specific fields...
}
```

**Required fields (all entities):** `id`, `name`
**Common fields:** `description`, `history` (for entities with version tracking)

### 7.2 Campaign Type

See `types/Campaign.ts` for the authoritative definition. Key fields beyond the entity arrays:

```typescript
interface Campaign {
    // ...entity arrays (npcs, locations, factions, etc.)...
    secrets?: Secret[];
    activeEncounter?: Encounter;
    activeSceneId?: string;
    activeSessionId?: string;
    pinnedEntities?: Array<{ type: string; id: string }>;
    dmStyle?: DmStyle;               // 'guided' | 'standard' | 'power'
    featureOverrides?: Record<string, boolean>;
    wizardDismissed?: boolean;
    styleProfile?: string;           // AI-generated DM voice description
    gcpApiKey?: string;              // Optional GCP key for audio transcription
}
```

### 7.3 ENTITY_TYPE_CONFIG

Single source of truth for entity type metadata in `utils/entityUtils.ts`:

```typescript
export const ENTITY_TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  npc:              { icon: 'NPCs',             color: 'amber',   label: 'NPCs' },
  location:         { icon: 'Locations',        color: 'emerald', label: 'Locations' },
  faction:          { icon: 'Factions',         color: 'violet',  label: 'Factions' },
  item:             { icon: 'Items',            color: 'sky',     label: 'Items' },
  adventure:        { icon: 'Adventures',       color: 'orange',  label: 'Adventures' },
  article:          { icon: 'BookCopy',         color: 'cyan',    label: 'Articles' },
  sessionLog:       { icon: 'SessionLog',       color: 'rose',    label: 'Session Logs' },
  'session-log':    { icon: 'SessionLog',       color: 'rose',    label: 'Session Logs' },
  playerCharacter:  { icon: 'PlayerCharacters', color: 'teal',    label: 'Player Characters' },
  'player-character': { icon: 'PlayerCharacters', color: 'teal', label: 'Player Characters' },
  plot:             { icon: 'Plot',             color: 'yellow',  label: 'Plots' },
  note:             { icon: 'FileText',         color: 'slate',   label: 'Notes' },
};
```

Derive color shades: `` `text-${config.color}-400` ``, `` `bg-${config.color}-900/60` ``.

### 7.4 Adding a New Entity Type

1. Create `types/NewEntity.ts`
2. Export from `types/index.ts`
3. Add array to `Campaign` interface in `types/Campaign.ts`
4. Add CRUD methods in `campaignService.ts`
5. Add mock data in `mockService.ts`
6. Add facade function in `aiService.ts`
7. Add default factory in `entityUtils.ts`
8. Add entry in `ENTITY_TYPE_CONFIG` in `entityUtils.ts`
9. Create generator, dashboard (with `EntityCreationPanel` + `useEntitySearch`), and editor components
10. Add `EditorView` value in `App.tsx`
11. Add view rendering in `ViewRouter.tsx`
12. Add sidebar entry in `CampaignSidebar.tsx`

---

## 8. Utilities

| Utility | Purpose |
|---------|---------|
| `entityUtils.ts` | Default entity factories (`createDefaultNpc()`, etc.), `ENTITY_TYPE_CONFIG`, `buildCampaignContext()` |
| `entityDetailExtractors.ts` | Extract display strings and edit details from entity fields; defines `QuickCardEntityType` |
| `entityFieldSave.ts` | Dispatch field-level saves to the correct `campaignService.update*()` method by entity type |
| `backlinkUtils.ts` | `computeBacklinks(campaign, entityId, entityType)` — compute all inbound cross-references |
| `dmStyleUtils.ts` | `isFeatureVisible(feature, dmStyle, overrides)` — feature visibility logic for DM Style modes |
| `demoTemplates.ts` | Starter demo campaign data for the onboarding quick-start option |
| `diceUtils.ts` | `parseFormula(formula)` + `rollDice(formula)` — dice formula parsing and rolling |
| `keyboardShortcuts.ts` | `SHORTCUTS` constant + `matchShortcut(event)` — keyboard shortcut definitions and matching |
| `popoverPosition.ts` | `calculatePopoverPosition(triggerRect, isExpanded)` — screen coordinate calculation for popovers |

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
| Page background | `bg-slate-900` | Page, outermost container |
| Card background | `bg-slate-800` | Cards, panels, modals |
| Secondary bg | `bg-slate-700` | Secondary buttons, inputs |
| Primary text | `text-slate-100` | Body text, labels |
| Secondary text | `text-slate-300` / `text-slate-400` | Secondary text, placeholders |
| Accent | `text-amber-400`, `bg-amber-600` | Interactive elements, primary buttons |
| Border | `border-slate-700`, `border-slate-600` | Separators, form inputs |
| Radius | `rounded-lg` (cards), `rounded-md` (inputs) | Consistent corner rounding |

**Note:** Earlier codebase versions used `stone-*` tokens. The codebase now uses `slate-*` throughout. Do not introduce `stone-*` in new code.

### 9.3 Indigo Exception

`indigo-*` tokens are used exclusively in `RealmChatWidget.tsx` to visually distinguish the AI assistant voice. Never add indigo elsewhere.

### 9.4 Input Base Classes

`components/common/Textarea.tsx` exports:

```typescript
export const inputBaseClasses = 'bg-slate-800 border border-slate-600 rounded-lg text-slate-100 '
    + 'placeholder-slate-400 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 focus:outline-none';

export const textareaBaseClasses = `${inputBaseClasses} resize-none`;
```

Use these for all text input and textarea elements.

### 9.5 Button Component Pattern

`components/common/Button.tsx` is the single source for interactive buttons with 219+ instances across the codebase.

**Variants** map to design tokens:

| Variant | Visual | Use case |
|---------|--------|----------|
| `primary` | `bg-amber-600 hover:bg-amber-500` | Primary actions (Save, Generate, Create) |
| `secondary` | `bg-slate-700 hover:bg-slate-600` | Secondary actions (Cancel, Close) |
| `ghost` | Transparent, `hover:bg-slate-700` | Toolbar actions, list row controls |
| `danger` | `bg-red-700 hover:bg-red-600` | Destructive actions (Delete) |
| `icon` | Square ghost variant sized to icon | Icon-only buttons; always include `aria-label` |

**Sizes:** `sm` (compact toolbars), `md` (default), `lg` (hero/CTA).

**`twMerge` composition** — the component merges the caller's `className` prop over base classes using `twMerge`, so one-off overrides (`w-full`, custom margin) are safe without specificity fights.

**When NOT to use `Button`:** Card click targets, tab triggers, chip/pill toggles, and elements whose primary semantic role is not "action button" may remain raw `<button>` elements with their own styling. The goal is consistency for action buttons, not eliminating every raw `<button>`.

---

## 10. Testing

### 10.1 Vitest Unit Tests (`tests/`)

```bash
npm test          # Run once
npm run test:watch  # Watch mode
```

Test files cover:
- `campaignService.sprint1.test.ts` — entity CRUD, relationships, cascade delete
- `contextBuilder.test.ts` — tiered context assembly
- `diceUtils.test.ts` — formula parsing and rolling
- `archetype.*.test.ts` — 5 DM archetype scenario tests (forever-dm, lazy-dm, new-dm, tactical-dm, worldbuilder)
- `migration-verification.test.ts` — AI migration correctness

### 10.2 Playwright E2E Tests (`e2e/`)

```bash
npm run test:e2e          # Headless
npm run test:e2e:headed   # Visible browser
npm run test:e2e:ui       # Interactive UI
```

Covers: campaign creation lifecycle, entity CRUD, navigation (EntityLink, back stack), session runner flow, DM coach tools.

### 10.3 Smoke Tests (`smokeTest.ts`)

Opt-in only: runs on app startup in development mode when `VITE_RUN_SMOKE_TESTS=true` is set (see `.env.local.example`) — it no longer runs automatically, since the suite wipes the `realmweaver-campaigns` / `realmweaver-active-campaign-id` storage keys and, with Mock Mode off, fires live AI calls against the real provider. Tests service function availability and a full entity CRUD session. Console reports pass/fail.

### 10.4 Manual Testing

Toggle mock mode in the app header for full feature testing without any AI API key or network access.

---

## 11. Build & Deployment

### 11.1 Vite Configuration

```typescript
// vite.config.ts highlights
{
    plugins: [react(), aiProxyPlugin()],  // aiProxyPlugin adds /api/ai/generate endpoint
    server: { port: 3000, host: '0.0.0.0' },
    resolve: { alias: { '@': path.resolve(__dirname, '.') } },
    define: {
        'process.env.REALMWEAVER_AI_PROVIDER': JSON.stringify(env.REALMWEAVER_AI_PROVIDER || 'claude-cli'),
        'process.env.AI_PROVIDER': JSON.stringify(env.AI_PROVIDER || 'claude-cli'),
        // SECURITY: ANTHROPIC_API_KEY is intentionally NOT injected into the client bundle.
    }
}
```

### 11.2 Environment Variables

| Variable | Source | Injected to Browser | Purpose |
|----------|--------|---------------------|---------|
| `REALMWEAVER_AI_PROVIDER` | `.env.local` | Yes | Active provider name |
| `ANTHROPIC_API_KEY` | `.env.local` | **No** | Used server-side in Vite middleware only |
| `CLAUDE_CLI_PATH` | `.env.local` | No | Path to `claude` binary (Vite middleware) |
| `GEMINI_API_KEY` | `.env.local` | Yes (legacy compat) | Unused; kept for legacy code paths |

### 11.3 Production Build

```bash
npm run build    # Outputs to dist/
npm run preview  # Serves dist/ for verification
```

The build produces a static SPA bundle. No server-side rendering. The Vite proxy middleware is a development-time tool only — it is not part of the production bundle.

---

## 12. Security Considerations

- **API key handling:** `ANTHROPIC_API_KEY` is NOT injected into the client bundle. It is consumed server-side in the Vite proxy middleware. The `claude-cli` provider has no API key at all — authentication is handled by the Claude Code CLI binary's own session.
- **Data storage:** All campaign data is stored in browser localStorage. No server-side persistence.
- **No authentication:** The app is single-user, local-only.
- **CLI invocation:** Uses `execFile` (not `exec`) to prevent shell injection. Large prompts use a temp file approach.
- **Input sanitization:** AI-generated content is rendered as text/markdown, not raw HTML.

---

## 13. Known Limitations & Technical Debt

1. **No server-side persistence** — localStorage only; data is browser-specific
2. **Anthropic API provider is a stub** — production path exists but is not yet implemented
3. **`@google/genai` still listed as dependency** — present for legacy compatibility; not used in active code paths
4. **Smoke tests lack TypeScript compilation** — `smokeTest.ts` runs directly in-browser, not via Vitest
