# CLAUDE.md - AI Assistant Guide for Realmweaver

> **Last Updated:** 2026-03-24
> **Purpose:** Comprehensive guide for AI assistants working with the Realmweaver codebase

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Quick Start](#quick-start)
3. [Project Structure](#project-structure)
4. [Architecture Patterns](#architecture-patterns)
5. [State Management](#state-management)
6. [AI Service Integration](#ai-service-integration)
7. [Component Patterns](#component-patterns)
8. [Type System](#type-system)
9. [Styling Conventions](#styling-conventions)
10. [Development Workflows](#development-workflows)
11. [Common Tasks](#common-tasks)
12. [Important Conventions](#important-conventions)
13. [Common Pitfalls](#common-pitfalls)

---

## Project Overview

**Realmweaver** is a single-page application (SPA) for tabletop RPG Game Masters to create, manage, and run campaigns using AI assistance.

### Tech Stack

- **Frontend:** React 19.2.0 with TypeScript 5.8.2
- **Build Tool:** Vite 6.2.0
- **AI Integration:** Google Gemini AI (@google/genai 1.25.0)
- **Styling:** Tailwind CSS (CDN via index.html)
- **State Management:** Custom store with Immer for immutable updates
- **Icons:** Lucide React 0.546.0
- **Graph Visualization:** React Flow 11.10.1, Dagre 0.8.5, D3 7.8.5
- **Utility:** tailwind-merge for className composition
- **Deployment Target:** Google AI Studio platform

### Key Features

- AI-powered content generation (NPCs, locations, factions, items, scenes, adventures, articles, plots)
- Campaign management with localStorage persistence (debounced auto-save)
- RealmChat conversational AI assistant for collaborative entity drafting
- DM Coach for in-session assistance (narration, dialogue, improv, rollable tables, skill checks)
- Evocation Wizard for batch world generation
- Session log management with microphone-enabled note analysis
- Plot tracking across sessions
- Combat tracker with encounter management
- Relationship graph visualization (D3 and React Flow)
- Entity history tracking and version management
- Player Character import (including PDF character sheet parsing)
- Mock mode for offline development and testing
- Import/Export functionality (JSON, Obsidian markdown)

---

## Quick Start

### Running the App

```bash
npm install
npm run dev    # Runs on http://localhost:3000
npm run build  # Production build
npm run preview # Preview production build
```

### Environment Setup

Create `.env.local` file in the project root:
```env
GEMINI_API_KEY=your_api_key_here
```

The key is injected via Vite's `define` in `vite.config.ts` as both `process.env.API_KEY` and `process.env.GEMINI_API_KEY`.

### Mock Mode Toggle

The app includes a mock mode toggle in the header. Use this for:
- Testing without API calls
- Offline development
- Running smoke tests

---

## Project Structure

### **CRITICAL:** No `src/` Directory

All application code lives at the **project root**, not in a `src/` directory.

```
/home/user/Realmweaver/
├── App.tsx                      # Main application component
├── index.tsx                    # React entry point
├── index.html                   # HTML template with Tailwind CDN + D3
├── vite.config.ts               # Vite configuration
├── tsconfig.json                # TypeScript configuration
├── package.json                 # Dependencies and scripts
├── smokeTest.ts                 # Smoke tests
├── types.ts                     # Legacy types file (prefer types/ directory)
│
├── hooks/                       # Custom React hooks (UX refactoring sprint)
│   ├── useEntitySelection.ts    # Selected entity state (replaces App.tsx inline state)
│   ├── useModalState.ts         # Modal open/close/data lifecycle
│   ├── useConfirmDialog.ts      # Programmatic confirm dialog (replaces window.confirm)
│   ├── useToast.ts              # Toast notification queue (replaces window.alert)
│   ├── useEntitySearch.ts       # Search/filter logic for dashboard entity lists
│   └── useRovingTabIndex.ts     # Keyboard navigation (roving tabindex pattern)
│
├── components/                  # UI components (organized by purpose)
│   ├── common/                  # Reusable primitives
│   │   ├── Button.tsx           # Styled button component
│   │   ├── Icons.tsx            # Centralized icon exports from lucide-react
│   │   ├── Textarea.tsx         # Styled textarea + exports inputBaseClasses, textareaBaseClasses
│   │   ├── EntityHistoryManager.tsx # Entity version history tracking
│   │   ├── DialogShell.tsx      # Base modal wrapper with focus trap and accessibility
│   │   ├── ConfirmDialog.tsx    # Confirmation modal (used with useConfirmDialog)
│   │   ├── ToastContainer.tsx   # Toast notification renderer (used with useToast)
│   │   ├── ErrorBoundary.tsx    # React error boundary for graceful error display
│   │   └── EntityCreationPanel.tsx  # Shared creation panel for dashboard generators
│   ├── layout/                  # App shell
│   │   ├── Header.tsx           # Top bar with tools access
│   │   ├── CampaignSidebar.tsx  # Left sidebar navigation (orchestrates sidebar/ sub-components)
│   │   ├── ContentWrapper.tsx   # Main content area wrapper
│   │   ├── ViewRouter.tsx       # Renders the active EditorView (extracted from App.tsx)
│   │   └── sidebar/             # Sidebar sub-components
│   │       ├── SidebarEntityList.tsx # Scrollable entity list with selection
│   │       ├── SidebarSearch.tsx     # Inline sidebar search/filter input
│   │       ├── PinnedEntities.tsx    # Pinned entity favorites section
│   │       ├── RecentItems.tsx       # Recent entity history section
│   │       ├── ArticleTreeItem.tsx   # Recursive article tree node
│   │       └── sidebarUtils.ts      # Sidebar-specific helper functions
│   ├── views/                   # High-level screens
│   │   ├── WelcomeScreen.tsx    # Landing page
│   │   ├── CampaignCreator.tsx  # New campaign setup
│   │   ├── CampaignSelector.tsx # Campaign picker
│   │   └── session/             # Session Runner sub-components
│   │       ├── ActiveScenePanel.tsx  # Currently active scene display
│   │       ├── SceneListPanel.tsx    # Ordered scene navigation list
│   │       ├── RunningLog.tsx        # Freeform session notes capture
│   │       ├── QuickToolsPanel.tsx   # Inline DM tools (dice, tables, etc.)
│   │       └── QuickNpcGenerator.tsx # In-session quick NPC creation
│   ├── dashboards/              # List views with embedded generators
│   │   ├── NpcDashboard.tsx
│   │   ├── LocationDashboard.tsx
│   │   ├── FactionDashboard.tsx
│   │   ├── ItemDashboard.tsx
│   │   ├── AdventureDashboard.tsx
│   │   ├── ArticleDashboard.tsx
│   │   ├── SessionLogDashboard.tsx
│   │   ├── PlayerCharacterDashboard.tsx
│   │   └── PlotDashboard.tsx
│   ├── generators/              # AI creation forms
│   │   ├── NpcGenerator.tsx
│   │   ├── LocationGenerator.tsx
│   │   ├── FactionGenerator.tsx
│   │   ├── ItemGenerator.tsx
│   │   ├── SceneGenerator.tsx
│   │   ├── AdventureGenerator.tsx
│   │   ├── ArticleGenerator.tsx
│   │   ├── PlayerCharacterImporter.tsx
│   │   └── EntityChatGenerator.tsx  # Chat-based entity creation
│   ├── editors/                 # Detail editing views
│   │   ├── NpcEditor.tsx
│   │   ├── LocationEditor.tsx
│   │   ├── FactionEditor.tsx
│   │   ├── ItemEditor.tsx
│   │   ├── AdventureEditor.tsx
│   │   ├── SceneEditor.tsx
│   │   ├── ArticleEditor.tsx
│   │   ├── SessionLogEditor.tsx
│   │   ├── PlayerCharacterEditor.tsx
│   │   ├── PlotEditor.tsx
│   │   ├── NoteEditor.tsx
│   │   ├── CampaignSettingEditor.tsx
│   │   └── PrepDocumentView.tsx     # Adventure prep document renderer
│   ├── dialogs/                 # Modal components (all use DialogShell)
│   │   ├── DmCoach.tsx          # In-session DM assistance tool
│   │   ├── EvocationWizard.tsx  # Batch generation wizard
│   │   └── ExportModal.tsx      # Export format selection
│   ├── tools/                   # Gameplay tools
│   │   └── CombatTracker.tsx    # Initiative and encounter tracking
│   ├── visualizers/             # Data visualization
│   │   └── RelationshipGraph.tsx # Entity relationship graph (D3-based)
│   └── RealmChat/               # Conversational AI widget
│       └── RealmChatWidget.tsx  # Floating chat assistant (indigo accent only)
│
├── services/                    # Business logic and external integrations
│   ├── campaignService.ts       # Central state management
│   ├── geminiService.ts         # Service facade (mock mode switching)
│   ├── importExportService.ts   # Import/export functionality
│   └── ai/                      # AI service modules
│       ├── core.ts              # Core Gemini API wrapper
│       ├── realmWeaver.ts       # Entity generation
│       ├── dmCoach.ts           # In-session DM assistance
│       ├── evocationWizard.ts   # Batch generation & parsing
│       ├── realmChat.ts         # Conversational AI service
│       └── mockService.ts       # Mock data for testing
│
├── types/                       # TypeScript type definitions
│   ├── index.ts                 # Barrel export file
│   ├── common.ts                # Shared primitive types (used across entity types)
│   ├── Campaign.ts              # Root campaign type
│   ├── NPC.ts                   # NPC entity
│   ├── Location.ts              # Location entity
│   ├── Faction.ts               # Faction entity
│   ├── Item.ts                  # Item entity
│   ├── Adventure.ts             # Adventure entity
│   ├── Scene.ts                 # Scene entity (within adventures)
│   ├── Article.ts               # Lore article entity
│   ├── SessionLog.ts            # Session log entity
│   ├── PlayerCharacter.ts       # Player character entity
│   ├── Plot.ts                  # Plot tracking entity
│   ├── Note.ts                  # Quick note entity
│   ├── Encounter.ts             # Combat encounter type
│   ├── CampaignSetting.ts       # Campaign setting config
│   ├── Evocation.ts             # Evocation wizard types
│   ├── RealmChat.ts             # Chat message types
│   ├── RollableTable.ts         # Rollable table type
│   ├── SkillCheck.ts            # Skill check type
│   └── Graph.ts                 # Relationship graph types
│
└── utils/                       # Utility functions
    ├── entityUtils.ts           # Default entity factories, helpers, ENTITY_TYPE_CONFIG
    ├── entityDetailExtractors.ts # Extract display strings from complex entity fields
    ├── entityFieldSave.ts       # Debounced field-save helpers for editors
    ├── popoverPosition.ts       # Calculate popover/tooltip screen coordinates
    └── demoTemplates.ts         # Starter demo content for onboarding
```

### Import Path Alias

The project uses `@/` as an alias for the project root (configured in both `tsconfig.json` and `vite.config.ts`):

```typescript
import { Button } from '@/components/common/Button';
import type { NPC } from '@/types/index';
```

---

## Architecture Patterns

### 1. Factory-Based State Store

**Location:** `services/campaignService.ts`

```typescript
export function createCampaignStore(config: { persist?: boolean } = {}) {
    let state: CampaignState = {
        campaigns: [],
        activeCampaignId: null,
        appStatus: 'loading',
        saveStatus: 'idle',
        lastSavedAt: null,
    };
    const listeners = new Set<() => void>();

    // Debounced auto-save (2 second delay)
    const updateState = (updater: (draft: CampaignState) => void) => {
        state = produce(state, updater);
        notify();
        scheduleSave(); // Debounced localStorage persistence
    };

    // Internal updates (saveStatus, appStatus) bypass auto-save
    const _internalUpdate = (updater: (draft: CampaignState) => void) => {
        state = produce(state, updater);
        notify();
    };

    return service; // Returns public API
}

// Singleton export for app use
export const campaignService = createCampaignStore();
```

**Key details:**
- `updateState()` triggers debounced auto-save to localStorage
- `_internalUpdate()` updates state without triggering save (for meta-state like `saveStatus`)
- Factory pattern with `{ persist: false }` option for testing
- Stores campaigns under `realmweaver-campaigns` and active ID under `realmweaver-active-campaign-id` in localStorage

### 2. React Integration Pattern

**Location:** `App.tsx`

```typescript
const { campaigns, activeCampaignId, appStatus, saveStatus, lastSavedAt } = useSyncExternalStore(
    campaignService.subscribe,
    campaignService.getState
);
```

### 3. Three-Layer Service Architecture

```
Component Layer
      ↓
geminiService.ts (Facade with isMockMode switching)
      ↓
ai/realmWeaver.ts | ai/realmChat.ts | ai/dmCoach.ts | ai/mockService.ts
      ↓
ai/core.ts (Gemini API wrapper)
```

**Example:**

```typescript
// geminiService.ts - Runtime switching
export const generateNpc = (prompt, useGroundedSearch, isMockMode, campaignContext) => {
  if (isMockMode) return mockService.generateNpc(...);
  return aiRealmWeaver.generateNpc(...);
};
```

### 4. Data Flow Pattern

**Unidirectional Flow:**

```
User Action → Component → campaignService method → Immer update →
debounced localStorage save → Notify subscribers → React re-render
```

**Relationship Management:**
- Bidirectional syncing (NPCs ↔ Factions via `_synchronizeNpcFactionLink`)
- Cycle detection (Location parent-child relationships)
- Cascade deletion (removing entities cleans up references)

### 5. App.tsx Decomposition (UX Refactoring Sprint)

`App.tsx` delegates responsibilities to extracted units rather than containing everything inline:

- **`hooks/useEntitySelection.ts`** — manages selected entity IDs per view type, replaces inline `useState` pairs in App.tsx
- **`hooks/useModalState.ts`** — generic open/close/payload lifecycle for dialogs
- **`components/layout/ViewRouter.tsx`** — renders the correct dashboard or editor for the active `EditorView`, extracted from the main render function in App.tsx

### 6. SessionRunner Decomposition

`components/views/SessionRunner.tsx` orchestrates five focused sub-components in `components/views/session/`:

| Sub-component | Responsibility |
|---------------|----------------|
| `ActiveScenePanel` | Displays the currently active scene with read-aloud text |
| `SceneListPanel` | Shows the ordered scene list and handles scene selection |
| `RunningLog` | Freeform note capture during session |
| `QuickToolsPanel` | Inline DM tools (dice, rollable tables, improv prompts) |
| `QuickNpcGenerator` | In-session rapid NPC creation without leaving the runner |

### 7. CampaignSidebar Decomposition

`CampaignSidebar.tsx` orchestrates sub-components in `components/layout/sidebar/`:

| Sub-component | Responsibility |
|---------------|----------------|
| `SidebarEntityList` | Scrollable, selectable entity list per section |
| `SidebarSearch` | Inline search/filter input |
| `PinnedEntities` | Pinned favorites section |
| `RecentItems` | Recently visited entity history |
| `ArticleTreeItem` | Recursive tree node for nested articles |
| `sidebarUtils.ts` | Sidebar-specific helpers (sorting, grouping) |

### 8. Dialog System

All modals use `DialogShell` as a base wrapper for consistent focus trap, keyboard dismiss, and accessibility attributes:

```typescript
// All new dialogs must use DialogShell
import { DialogShell } from '@/components/common/DialogShell';

const MyDialog: React.FC<Props> = ({ isOpen, onClose }) => (
  <DialogShell isOpen={isOpen} onClose={onClose} title="My Dialog">
    {/* dialog content */}
  </DialogShell>
);
```

For destructive confirmations use `useConfirmDialog` rather than `window.confirm`:

```typescript
const { confirm, ConfirmDialogPortal } = useConfirmDialog();
// ...
const ok = await confirm({ title: 'Delete NPC?', message: '...' });
if (ok) campaignService.deleteNpc(id);
// render <ConfirmDialogPortal /> in JSX
```

For user feedback use `useToast` rather than `window.alert`:

```typescript
const { toast, ToastPortal } = useToast();
toast({ message: 'NPC saved', variant: 'success' });
// render <ToastPortal /> in JSX
```

### 9. ErrorBoundary Wrapping

`components/common/ErrorBoundary.tsx` wraps major view sections so a crash in one panel does not take down the whole app. Wrap top-level route regions and any component that fetches/processes external data.

---

## State Management

### CampaignService API

**Location:** `services/campaignService.ts`

#### State Shape

```typescript
type CampaignState = {
  campaigns: Campaign[];
  activeCampaignId: string | null;
  appStatus: 'loading' | 'welcome' | 'selecting' | 'creating' | 'editing';
  saveStatus: 'idle' | 'saved' | 'saving' | 'error';
  lastSavedAt: string | null;
};
```

#### Core Methods

```typescript
// Campaign CRUD
campaignService.createCampaign(title, setting, settingType, officialSetting)
campaignService.switchCampaign(campaignId)
campaignService.updateCampaign(updates)
campaignService.deleteCampaign(campaignId)

// Entity CRUD (pattern applies to all entity types)
campaignService.createNpc(npcData)
campaignService.updateNpc(id, updates)
campaignService.deleteNpc(id)               // Auto-cleans relationships

// Similar CRUD for: Location, Faction, Item, Adventure, Scene,
// Article, SessionLog, PlayerCharacter, Plot, Note

// Relationship Management
campaignService.linkNpcToFaction(npcId, factionId)
campaignService.unlinkNpcFromFaction(npcId)
campaignService.linkSceneToLocation(sceneId, locationId)
campaignService.linkSceneToNpcs(sceneId, npcIds)

// Hierarchy Management
campaignService.setLocationParent(locationId, parentId)
campaignService.removeLocationParent(locationId)

// State Access
campaignService.getState()
campaignService.subscribe(listener)

// Import/Export
campaignService.importCampaign(file)
campaignService.reset()
```

#### Entity Types

All entity types follow the same CRUD pattern:
- NPCs, Locations, Factions, Items
- Adventures (contain Scenes)
- Articles (lore entries)
- Session Logs (with note analysis)
- Player Characters
- Plots (cross-session tracking)
- Notes (quick freeform notes)
- Encounters (combat tracking)

### Important State Rules

1. **Never mutate state directly** - Always use `campaignService` methods (Immer handles immutability internally)
2. **UI state lives in components** - Active view, selected entity IDs, modal states, and `isMockMode` are managed via React `useState`
3. **Domain state lives in campaignService** - Campaign data, entity relationships, persistence
4. **Relationship syncing is automatic** - Linking an NPC to a faction automatically updates both sides

---

## AI Service Integration

### Service Layer Structure

#### 1. Core AI Functions (`services/ai/core.ts`)

```typescript
generateWithSchema(prompt, schema, instructions, modelId, campaignContext)
generateText(prompt, instructions, modelId)
generateChatCompletion(conversationHistory, modelId)
```

#### 2. Entity Generation (`services/ai/realmWeaver.ts`)

Functions: `generateNpc`, `generateLocation`, `generateFaction`, `generateItem`, `generateScene`, `generateAdventure`, `generateArticle`

#### 3. DM Coach Tools (`services/ai/dmCoach.ts`)

Functions: `generateNarration`, `generateNpcDialogue`, `generateImprovPlotTwist`, `generateRollableTable`, `generateSkillCheck`, `analyzeSessionNotes`

#### 4. RealmChat (`services/ai/realmChat.ts`)

Functions: `generateRealmChatResponse` - Conversational AI for collaborative entity drafting with multi-turn conversation support.

#### 5. Batch Operations (`services/ai/evocationWizard.ts`)

Functions: `generateCampaignFill`, `parseNpcFromText`, `parseLocationFromText`, `chatWithDocument`, `parseCharacterSheetPdf`

#### 6. Service Facade (`services/geminiService.ts`)

All generator functions route through here, which handles mock mode switching:
```typescript
export const generateNpc = (prompt, useGroundedSearch, isMockMode, campaignContext) => {
  if (isMockMode) return mockService.generateNpc(...);
  return aiRealmWeaver.generateNpc(...);
};
```

### Campaign Context Injection

Every AI function accepts an optional `campaignContext` parameter that provides existing campaign data for consistency:

```typescript
const campaignContext = `
Setting: ${campaign.setting}
Existing NPCs: ${campaign.npcs.map(n => n.name).join(', ')}
Existing Locations: ${campaign.locations.map(l => l.name).join(', ')}
`;
```

### AI Models

- **Primary Model:** `gemini-2.5-flash` (faster, most generation)
- **High Quality:** `gemini-2.5-pro` (optional, better results)
- Thinking budgets: Pro 32K tokens, Flash 24K tokens

### Grounded Search

Only available for NPC generation (`useGroundedSearch` parameter) - uses Google Search for well-known D&D characters.

---

## Component Patterns

### Three-Tier Component Hierarchy

#### 1. Dashboards (`components/dashboards/`)

Show list of entities with embedded generator. Pattern:

```typescript
<NpcDashboard
  npcs={campaign.npcs}
  onNpcCreated={(npc) => campaignService.createNpc(npc)}
  onSelectNpc={(id) => setSelectedNpcId(id)}
  isMockMode={isMockMode}
  campaignContext={campaignContext}
/>
```

#### 2. Generators (`components/generators/`)

AI-powered creation forms. Pattern:

```typescript
const NpcGenerator: React.FC<Props> = ({ onNpcCreated, isMockMode, campaignContext }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const npcData = await generateNpc(prompt, false, isMockMode, campaignContext);
      onNpcCreated(npcData);
      setPrompt('');
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setIsLoading(false);
    }
  };
};
```

Generators now also support chat-based creation via `EntityChatGenerator.tsx`.

#### 3. Editors (`components/editors/`)

Detail editing views with inline AI-assist. Pattern:

```typescript
const NpcEditor: React.FC<Props> = ({ npc, onUpdate, onDelete, isMockMode, campaignContext }) => {
  // Local state for form fields
  // onUpdate calls campaignService.updateNpc(id, updates)
  // AI-assist buttons for individual fields
};
```

### EditorView Type

The main app routes views via `EditorView` type defined in `App.tsx`:

```typescript
export type EditorView = 'setting' | 'npcs' | 'locations' | 'factions' | 'items' |
  'adventures' | 'lorebook' | 'session-logs' | 'player-characters' | 'plots' |
  'combat' | 'relationships';
```

### Icon Imports

**All icons must be imported from `components/common/Icons.tsx`**, which re-exports from `lucide-react`. Never import directly from `lucide-react` in components.

```typescript
// ✅ CORRECT
import { PlusIcon, TrashIcon } from '@/components/common/Icons';

// ❌ WRONG
import { Plus, Trash } from 'lucide-react';
```

### EntityCreationPanel

Dashboards that embed a generator panel use `EntityCreationPanel` from `components/common/EntityCreationPanel.tsx` instead of hand-building the creation UI. Pass the entity-type label and children (the generator component):

```typescript
import { EntityCreationPanel } from '@/components/common/EntityCreationPanel';

<EntityCreationPanel entityLabel="NPC">
  <NpcGenerator onNpcCreated={handleCreated} isMockMode={isMockMode} campaignContext={campaignContext} />
</EntityCreationPanel>
```

### useEntitySearch for Dashboard Lists

Dashboards use `useEntitySearch` from `hooks/useEntitySearch.ts` to provide consistent search/filter behaviour:

```typescript
import { useEntitySearch } from '@/hooks/useEntitySearch';

const { query, setQuery, filteredEntities } = useEntitySearch(campaign.npcs, ['name', 'description']);
```

---

## Type System

### Entity Type Pattern

Each entity has its own file in `types/` and is re-exported via `types/index.ts`.

**All entities must have at minimum:**
- `id: string` - Unique identifier (UUID generated by campaignService)
- `name: string` - Display name

**Many entities include:**
- `history: Array<{...}>` - Version history for undo/tracking (NPCs, Locations, etc.)
- `description: string` - Primary description text

### Campaign Type (`types/Campaign.ts`)

```typescript
export interface Campaign {
  id: string;
  title: string;
  settingType: SettingType;        // 'custom' | 'official'
  officialSetting?: string;        // e.g., "Forgotten Realms"
  setting: string;                 // Custom setting description
  articles: Article[];
  adventures: Adventure[];
  npcs: NPC[];
  locations: Location[];
  factions: Faction[];
  items: Item[];
  sessionLogs: SessionLog[];
  playerCharacters: PlayerCharacter[];
  plots: Plot[];
  notes: Note[];
  activeEncounter?: Encounter;
  activeSceneId?: string;
}
```

### Adding a New Entity Type

1. Create `types/NewEntity.ts` with the interface
2. Add `export * from './NewEntity'` to `types/index.ts`
3. Add the array to the `Campaign` interface in `types/Campaign.ts`
4. Add CRUD methods in `services/campaignService.ts`
5. Add mock data in `services/ai/mockService.ts`
6. Add facade function in `services/geminiService.ts`
7. Add default factory in `utils/entityUtils.ts`
8. Add an entry for the new type to `ENTITY_TYPE_CONFIG` in `utils/entityUtils.ts` (icon name, color token, label)
9. Create `components/generators/NewEntityGenerator.tsx`
10. Create `components/dashboards/NewEntityDashboard.tsx` — use `EntityCreationPanel` for the creation panel and `useEntitySearch` for filtering
11. Create `components/editors/NewEntityEditor.tsx`
12. Add view routing in `components/layout/ViewRouter.tsx`
13. Add sidebar entry in `components/layout/CampaignSidebar.tsx`

---

## Styling Conventions

### Tailwind CSS (CDN)

Tailwind is loaded via CDN in `index.html`, not as a build dependency. This means:
- No `tailwind.config.js` file
- No PostCSS processing
- Classes are applied inline using standard Tailwind utility classes
- Use `tailwind-merge` for conditional className composition

### Common Style Patterns

```typescript
// Dark theme with amber accents (slate grays, not stone)
className="bg-slate-900 text-slate-100"
className="text-amber-400 hover:text-amber-300"
className="border-slate-700"
className="bg-slate-800 rounded-lg p-4"

// Button variants
className="bg-amber-600 hover:bg-amber-500 text-white rounded-lg px-4 py-2"
className="bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg px-4 py-2"
```

### Design System

- **Theme:** Dark fantasy/medieval (slate grays + amber accents)
- **Border radius:** `rounded-lg` for cards, `rounded-md` for inputs
- **Spacing:** Tailwind standard spacing scale
- **Typography:** Default Tailwind + monospace for code/tables

### Indigo Exception

Indigo is used **only** in `RealmChatWidget.tsx` to visually distinguish the AI assistant voice from the rest of the app UI. All other interactive accents, icons, and highlights use amber. Do not add indigo to any other component.

### Input/Textarea Base Classes

`components/common/Textarea.tsx` exports two shared class strings for consistent form field styling:

```typescript
import { inputBaseClasses, textareaBaseClasses } from '@/components/common/Textarea';

// inputBaseClasses: bg-slate-800 border border-slate-600 rounded-lg text-slate-100
//   placeholder-slate-400 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 focus:outline-none
// textareaBaseClasses: same as inputBaseClasses + resize-none

<input className={`${inputBaseClasses} px-3 py-2`} />
<textarea className={`${textareaBaseClasses} p-3 h-24`} />
```

Use these instead of hand-rolling input styles in new components.

### ENTITY_TYPE_CONFIG

`utils/entityUtils.ts` exports `ENTITY_TYPE_CONFIG` as the single source of truth for entity type metadata (icon name, Tailwind color token, display label). Import this wherever you need entity colors or icons rather than hardcoding them:

```typescript
import { ENTITY_TYPE_CONFIG } from '@/utils/entityUtils';

const config = ENTITY_TYPE_CONFIG['npc'];  // { icon: 'NPCs', color: 'amber', label: 'NPCs' }
// Derive shades: `text-${config.color}-400`, `bg-${config.color}-900/60`
```

All dashboards, `EntityQuickCard`, `CommandPalette`, and `CampaignSidebar` derive colors from this config.

---

## Development Workflows

### Build & Run

```bash
npm run dev      # Start dev server on port 3000
npm run build    # Production build (vite build)
npm run preview  # Preview production build
```

### TypeScript

- Strict mode is not explicitly enabled in tsconfig
- Uses `ES2022` target with `bundler` module resolution
- Path alias `@/*` maps to project root
- `allowImportingTsExtensions: true` - `.ts`/`.tsx` extensions allowed in imports
- `noEmit: true` - TypeScript only does type checking, Vite handles transpilation

### Smoke Testing

**Location:** `smokeTest.ts`

The smoke test suite validates core functionality. Run via the app's built-in test runner (not a CLI test framework). Tests cover:
- Service function availability
- Entity CRUD operations
- Import/export functionality
- AI service function signatures

### No Formal Testing Framework

There is no Jest, Vitest, or other test runner configured. Testing is done via:
1. The built-in `smokeTest.ts` (run from within the app)
2. Manual testing with mock mode enabled
3. Browser developer tools

### No Linting/Formatting Configuration

There is no ESLint, Prettier, or other code quality tooling configured. Follow the existing code style:
- 2-space indentation (some files use 4-space)
- Single quotes for imports
- Named exports (not default exports) for components
- `React.FC<Props>` pattern for component typing

### No CI/CD

There is no `.github` directory or CI/CD pipeline configured.

---

## Common Tasks

### Adding a New AI Generation Function

1. Add the generation function in `services/ai/realmWeaver.ts`
2. Add a mock version in `services/ai/mockService.ts`
3. Add the facade function in `services/geminiService.ts` with mock mode switching
4. Add smoke test entry in `smokeTest.ts`

### Adding a New View to the Sidebar

1. Add the view name to `EditorView` type in `App.tsx`
2. Add sidebar entry in `CampaignSidebar.tsx`
3. Add rendering logic in `App.tsx`'s main content switch

### Working with Entity Relationships

```typescript
// Link NPC to faction (auto-syncs both sides)
campaignService.linkNpcToFaction(npcId, factionId);

// Set location hierarchy (with cycle detection)
campaignService.setLocationParent(childId, parentId);

// Link scene to NPCs and location
campaignService.linkSceneToNpcs(sceneId, npcIds);
campaignService.linkSceneToLocation(sceneId, locationId);
```

---

## Important Conventions

1. **No `src/` directory** - All code is at the project root
2. **Icons through `Icons.tsx`** - Never import directly from `lucide-react`
3. **Types through `types/index.ts`** - Use the barrel export for all type imports
4. **Named exports only** - Components use `export const ComponentName` not `export default`
5. **Service facade pattern** - All AI calls go through `geminiService.ts`, never call `ai/` modules directly from components
6. **Mock mode support** - Every AI function must have a mock implementation
7. **Campaign context** - Always pass campaign context to AI functions for consistency
8. **Immer for state updates** - Never mutate state directly; use campaignService methods
9. **`useSyncExternalStore`** - Components subscribe to campaignService state via this React hook
10. **Entity defaults in `entityUtils.ts`** - Use factory functions like `createDefaultNpc()` for new entity creation
11. **All modals must use `DialogShell`** - For focus trap, keyboard dismiss (Escape), and ARIA attributes
12. **Use `useConfirmDialog` instead of `window.confirm`** - Provides branded UI consistent with the design system
13. **Use `useToast` instead of `window.alert`** - Provides non-blocking feedback that doesn't interrupt the user
14. **`ENTITY_TYPE_CONFIG` is the single source of truth for entity colors and icons** - Never hardcode entity type colors or icon names in components; derive them from the config in `utils/entityUtils.ts`

---

## Documentation Maintenance (MANDATORY)

When completing work that changes the architecture, adds features, or modifies key patterns, **update the relevant documentation before committing**:

| What Changed | Update These Docs |
|-------------|------------------|
| New component, service, or type | `docs/architecture/high-level-design.md` (feature map, project structure) |
| Architecture pattern change | `docs/architecture/high-level-design.md` + `docs/architecture/technical-design.md` |
| New entity type or data model change | `docs/architecture/high-level-design.md` (data model section) + `CLAUDE.md` (type system) |
| New AI service function | `CLAUDE.md` (AI Service Integration section) |
| New testing infrastructure | `docs/architecture/high-level-design.md` (testing strategy) |
| Major feature completion | `README.md` (features table, project status) |

### Documentation Structure

```
docs/
├── architecture/
│   ├── high-level-design.md       # System overview, diagrams, data model, feature map
│   ├── technical-design.md        # Detailed technical design, patterns, subsystems
│   └── implementation-plan.md     # Phased plan with work packages (Phases A-F)
├── design/
│   ├── dm-archetypes.md           # 5 DM personas driving feature prioritization
│   └── session-cockpit-review.md  # 67 user stories and priority matrix
└── USER_GUIDE.md                  # End-user guide
```

**README.md** at the project root is the public-facing entry point. Keep it concise, current, and linking to `docs/` for details.

**CLAUDE.md** at the project root is the AI development guide. Keep it accurate as the codebase evolves.

---

## Common Pitfalls

1. **Creating files in `src/`** - There is no `src/` directory. All code lives at root.
2. **Importing icons from `lucide-react`** - Always use `components/common/Icons.tsx`.
3. **Calling AI services directly** - Always go through `geminiService.ts` facade.
4. **Forgetting mock mode** - Every new AI function needs a mock implementation in `mockService.ts`.
5. **Direct state mutation** - Always use campaignService methods; Immer handles immutability.
6. **Missing relationship cleanup** - When deleting entities, ensure cascade deletion removes references from related entities.
7. **Forgetting to export types** - New types must be added to `types/index.ts` barrel export.
8. **Using default exports** - The codebase uses named exports exclusively.
9. **Missing `campaignContext`** - AI-generated content will be inconsistent with the campaign if context is not passed.
10. **Not updating `ViewRouter.tsx`** - New views must be added to `components/layout/ViewRouter.tsx` (no longer only `App.tsx`).
11. **Forgetting `EntityHistoryManager`** - Entities that support history (NPCs, Locations, etc.) should integrate the history tracking component.
12. **Not updating documentation** - After significant work, update `docs/architecture/high-level-design.md`, `README.md`, and `CLAUDE.md` per the Documentation Maintenance section above.
13. **Using `window.confirm` or `window.alert`** - Use `useConfirmDialog` and `useToast` instead for UI-consistent feedback.
14. **Skipping `DialogShell` for modals** - Hand-rolled modals lack focus trap and keyboard accessibility; always compose dialogs with `DialogShell`.
15. **Hardcoding entity type colors** - Derive colors from `ENTITY_TYPE_CONFIG` in `utils/entityUtils.ts` to stay in sync across all entity type consumers.
16. **Using indigo outside RealmChatWidget** - Indigo is reserved exclusively for the RealmChat AI assistant component. Use amber for all other accents.
