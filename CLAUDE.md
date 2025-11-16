# CLAUDE.md - AI Assistant Guide for Realmweaver

> **Last Updated:** 2025-11-16
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
- **Styling:** Tailwind CSS (CDN)
- **State Management:** Custom store with Immer for immutable updates
- **Icons:** Lucide React
- **Deployment Target:** Google AI Studio platform

### Key Features

- AI-powered content generation (NPCs, locations, factions, items, scenes, adventures)
- Campaign management with localStorage persistence
- DM Coach for in-session assistance
- Evocation Wizard for batch world generation
- Mock mode for offline development and testing
- Import/Export functionality (JSON, Obsidian)

---

## Quick Start

### Running the App

```bash
npm install
npm run dev  # Runs on http://localhost:3000
```

### Environment Setup

Create `.env.local` file:
```env
GEMINI_API_KEY=your_api_key_here
```

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
├── App.tsx                      # Main application component (372 lines)
├── index.tsx                    # React entry point
├── index.html                   # HTML template with Tailwind CDN
├── vite.config.ts               # Vite configuration
├── tsconfig.json                # TypeScript configuration
├── package.json                 # Dependencies and scripts
├── smokeTest.ts                 # Integration tests (15,819 lines!)
│
├── components/                  # UI components (organized by purpose)
│   ├── common/                  # Reusable primitives (Button, Icons, Textarea)
│   ├── layout/                  # App shell (Header, CampaignSidebar)
│   ├── views/                   # High-level screens (WelcomeScreen, CampaignCreator)
│   ├── dashboards/              # List views with embedded generators
│   ├── generators/              # AI creation forms
│   ├── editors/                 # Detail editing views
│   └── dialogs/                 # Modal components
│
├── services/                    # Business logic and external integrations
│   ├── campaignService.ts       # Central state management (665 lines)
│   ├── geminiService.ts         # Service facade (mock mode switching)
│   ├── importExportService.ts   # Import/export functionality
│   └── ai/                      # AI service modules
│       ├── core.ts              # Core Gemini integration
│       ├── realmWeaver.ts       # Entity generation
│       ├── dmCoach.ts           # In-session DM assistance
│       ├── evocationWizard.ts   # Batch generation & parsing
│       └── mockService.ts       # Mock data for testing
│
└── types/                       # TypeScript type definitions
    ├── index.ts                 # Barrel export file
    ├── Campaign.ts              # Root campaign type
    ├── NPC.ts, Location.ts, etc.# One file per entity type
    └── ...
```

### Import Path Alias

The project uses `@/` as an alias for the project root:

```typescript
// Both work:
import { Button } from './components/common/Button';
import { Button } from '@/components/common/Button';
```

---

## Architecture Patterns

### 1. Factory-Based State Store

**Location:** `services/campaignService.ts`

```typescript
// Factory pattern allows testable instances
export function createCampaignStore() {
    let state: CampaignState = {
        campaigns: [],
        activeCampaignId: null,
        appStatus: 'loading'
    };
    const listeners = new Set<() => void>();

    // Immer-based updates with auto-persistence
    const updateState = (updater: (draft: CampaignState) => void) => {
        state = produce(state, updater);
        saveState();  // Auto-persist to localStorage
        notify();     // Notify subscribers
    };

    return service; // Returns public API
}

// Singleton export for app use
export const campaignService = createCampaignStore();
```

**Benefits:**
- Centralized state with automatic persistence
- Observable pattern via subscription model
- Factory pattern allows isolated testing
- Immer enables immutable updates with mutable syntax

### 2. React Integration Pattern

**Location:** `App.tsx:39-42`

```typescript
const { campaigns, activeCampaignId, appStatus } = useSyncExternalStore(
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
ai/realmWeaver.ts | ai/mockService.ts (Implementation)
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
localStorage save → Notify subscribers → React re-render
```

**Relationship Management:**
- Bidirectional syncing (NPCs ↔ Factions)
- Cycle detection (Location parent-child relationships)
- Cascade deletion (removing entities cleans up references)

---

## State Management

### CampaignService API

**Location:** `services/campaignService.ts`

#### State Shape

```typescript
type CampaignState = {
  campaigns: Campaign[];           // All campaigns
  activeCampaignId: string | null; // Currently selected
  appStatus: 'loading' | 'welcome' | 'selecting' | 'creating' | 'editing';
};
```

#### Core Methods

```typescript
// Campaign CRUD
campaignService.createCampaign(title, setting)
campaignService.switchCampaign(campaignId)
campaignService.updateCampaign(updates)
campaignService.deleteCampaign(campaignId)

// Entity CRUD (pattern applies to all entity types)
campaignService.createNpc(npcData)          // Returns full NPC with ID
campaignService.updateNpc(id, updates)
campaignService.deleteNpc(id)               // Auto-cleans relationships

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

#### Entity Types with CRUD

All entity types follow the same CRUD pattern:
- NPCs
- Locations
- Factions
- Items
- Adventures
- Scenes (within adventures)
- Articles
- Session Logs
- Player Characters

### Important State Rules

#### 1. Never Mutate State Directly

**❌ WRONG:**
```typescript
const campaign = campaignService.getState().campaigns[0];
campaign.npcs.push(newNpc); // Direct mutation!
```

**✅ CORRECT:**
```typescript
campaignService.createNpc(newNpcData); // Uses Immer internally
```

#### 2. UI State vs. Domain State

**Domain State (in campaignService):**
- Campaign data
- Entity relationships
- Persistence data

**UI State (in components with `useState`):**
- Active view
- Selected entity IDs
- Modal open states
- `isMockMode` toggle

#### 3. Relationship Syncing

The service automatically maintains bidirectional relationships:

```typescript
// Linking NPC to Faction
campaignService.linkNpcToFaction(npcId, factionId);
// Automatically updates:
// - npc.factionId = factionId
// - faction.memberIds includes npcId
```

---

## AI Service Integration

### Service Layer Structure

#### 1. Core AI Functions

**Location:** `services/ai/core.ts`

```typescript
// Structured JSON generation with schemas
generateWithSchema(prompt, schema, instructions, modelId, campaignContext)

// Free-form text generation
generateText(prompt, instructions, modelId)

// Multi-turn conversations
generateChatCompletion(conversationHistory, modelId)
```

#### 2. Entity Generation

**Location:** `services/ai/realmWeaver.ts`

Functions:
- `generateNpc(prompt, useGroundedSearch, campaignContext)`
- `generateLocation(prompt, campaignContext)`
- `generateFaction(prompt, campaignContext)`
- `generateItem(prompt, campaignContext)`
- `generateScene(prompt, campaignContext)`
- `generateAdventure(prompt, campaignContext)`
- `generateArticle(prompt, campaignContext)`

#### 3. DM Coach Tools

**Location:** `services/ai/dmCoach.ts`

Functions:
- `generateNarration(prompt, scene, modelId)`
- `generateNpcDialogue(prompt, npc, scene, modelId)`
- `generateImprovPlotTwist(prompt, campaignContext, modelId)`
- `generateRollableTable(prompt, campaignContext)`
- `generateSkillCheck(prompt, campaignContext)`

#### 4. Batch Operations

**Location:** `services/ai/evocationWizard.ts`

Functions:
- `generateCampaignFill(setting, theme, detailed)`
- `parseNpcFromText(description, campaignContext)`
- `parseLocationFromText(description, campaignContext)`
- `chatWithDocument(conversationHistory, document)`
- `parseCharacterSheetPdf(base64Data)`

### Campaign Context Injection

**Every AI function accepts an optional `campaignContext` parameter:**

```typescript
const contextInstruction = campaignContext
    ? `Reference the following existing campaign information...\n${campaignContext}\n`
    : '';
```

**Best Practice:** Always pass campaign context for consistency:

```typescript
const campaignContext = `
Setting: ${campaign.setting}
Existing NPCs: ${campaign.npcs.map(n => n.name).join(', ')}
Existing Locations: ${campaign.locations.map(l => l.name).join(', ')}
`;

const npcData = await generateNpc(prompt, false, isMockMode, campaignContext);
```

### Schema-Based Generation

All entity generation uses TypeScript-like schemas:

```typescript
export const npcSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "The NPC's name" },
    description: { type: Type.STRING, description: "Physical appearance..." },
    traits: { type: Type.STRING, description: "Personality traits..." },
    // ... more fields
  },
  required: ['name', 'description', 'traits', ...]
};
```

### AI Models

**Primary Model:** `gemini-2.5-flash` (faster, most generation)
**High Quality:** `gemini-2.5-pro` (optional, better results)

**Thinking Budgets:**
- Pro: 32K tokens
- Flash: 24K tokens

### Grounded Search

Only available for NPC generation:

```typescript
const npcData = await generateNpc(prompt, useGroundedSearch, isMockMode, context);
// When useGroundedSearch=true, uses Google Search for well-known characters
```

---

## Component Patterns

### Three-Tier Component Hierarchy

#### 1. Dashboards (List + Generator)

**Location:** `components/dashboards/`

**Purpose:** Show list of entities with embedded generator

**Example:** `NpcDashboard.tsx`

```typescript
<NpcDashboard
  npcs={campaign.npcs}
  onNpcCreated={(npc) => campaignService.createNpc(npc)}
  onSelectNpc={(id) => setSelectedNpcId(id)}
  isMockMode={isMockMode}
  campaignContext={campaignContext}
/>
```

**Layout:**
```
┌─────────────────────────────────────┐
│  Dashboard Title                    │
├──────────────┬──────────────────────┤
│  Generator   │   Entity List        │
│  Form        │   - Item 1           │
│              │   - Item 2           │
│  [Generate]  │   - Item 3           │
└──────────────┴──────────────────────┘
```

#### 2. Generators (AI Creation Forms)

**Location:** `components/generators/`

**Purpose:** AI-powered creation forms

**Pattern:**

```typescript
const NpcGenerator: React.FC<Props> = ({ onNpcCreated, isMockMode, campaignContext }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const npcData = await generateNpc(prompt, false, isMockMode, campaignContext);
      onNpcCreated(npcData);
      setPrompt(''); // Clear form
    } catch (error) {
      console.error('Generation failed:', error);
      alert('Failed to generate NPC');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <Button onClick={handleGenerate} disabled={isLoading}>
        {isLoading ? 'Generating...' : 'Generate'}
      </Button>
    </div>
  );
};
```

#### 3. Editors (Detail Editing)

**Location:** `components/editors/`

**Purpose:** Detailed editing with AI-assist

**Pattern:**

```typescript
const NpcEditor: React.FC<Props> = ({ npc, onUpdate, onDelete }) => {
  const [localName, setLocalName] = useState(npc.name);
  const [localDescription, setLocalDescription] = useState(npc.description);

  const handleUpdate = () => {
    onUpdate(npc.id, { name: localName, description: localDescription });
  };

  return (
    <div>
      <input
        value={localName}
        onChange={(e) => setLocalName(e.target.value)}
        onBlur={handleUpdate}  // Save on blur
      />
      <textarea
        value={localDescription}
        onChange={(e) => setLocalDescription(e.target.value)}
        onBlur={handleUpdate}
      />
      <Button variant="danger" onClick={() => onDelete(npc.id)}>Delete</Button>
    </div>
  );
};
```

### Common Component Props

**Generator Props:**
```typescript
interface GeneratorProps {
  onEntityCreated: (data: Omit<Entity, 'id'>) => void;
  isMockMode: boolean;
  campaignContext?: string;
}
```

**Editor Props:**
```typescript
interface EditorProps {
  entity: Entity;
  onUpdate: (id: string, updates: Partial<Entity>) => void;
  onDelete: (id: string) => void;
}
```

**Dashboard Props:**
```typescript
interface DashboardProps {
  entities: Entity[];
  onEntityCreated: (data: Omit<Entity, 'id'>) => void;
  onSelectEntity: (id: string) => void;
  isMockMode: boolean;
  campaignContext?: string;
}
```

---

## Type System

### Type Organization

**Location:** `types/`

**Pattern:** One file per entity type + barrel export

```
types/
├── index.ts          # Barrel export (export * from './NPC')
├── Campaign.ts       # Root entity
├── NPC.ts
├── Location.ts
├── Faction.ts
├── Item.ts
├── Adventure.ts
├── Scene.ts
├── Article.ts
├── SessionLog.ts
├── PlayerCharacter.ts
├── RollableTable.ts
└── SkillCheck.ts
```

### Key Type Patterns

#### 1. Root Campaign Type

```typescript
export interface Campaign {
  id: string;
  title: string;
  setting: string;
  articles: Article[];
  adventures: Adventure[];
  npcs: NPC[];
  locations: Location[];
  factions: Faction[];
  items: Item[];
  sessionLogs: SessionLog[];
  playerCharacters: PlayerCharacter[];
}
```

#### 2. Entity with Relationships

```typescript
export interface NPC {
  id: string;
  name: string;
  description: string;
  traits: string;
  backstory: string;
  motivations: string;
  secrets: string;
  stats: string;
  exampleQuote: string;
  factionId?: string; // Relationship field (optional)
  knowsPlayerHistory: { playerId: string; details: string }[];
}
```

#### 3. Nested Complex Types

```typescript
export interface Location {
  id: string;
  name: string;
  description: string;
  secrets: string;
  loot?: LootItem[];
  parentLocationId?: string;      // Hierarchy
  subLocationIds: string[];       // Bidirectional
  connections?: LocationConnection[];
  pointsOfInterest?: PointOfInterest[];
}

export interface PointOfInterest {
  id: string;
  name: string;
  passivePerceptionDC: number;
  description: string;
  investigationChecks: PoiInteraction[];
  interactions: PoiInteraction[];
}
```

#### 4. AI Generation Types

**Common pattern:** Omit fields added by the app

```typescript
// AI generates everything except id and relationship fields
type NpcInput = Omit<NPC, 'id' | 'factionId' | 'knowsPlayerHistory'>;
type LocationInput = Omit<Location, 'id' | 'parentLocationId' | 'subLocationIds'>;
type SceneInput = Omit<Scene, 'id' | 'locationId' | 'npcIds'>;
```

#### 5. Batch Import Type

```typescript
export type BatchAddData = {
  npcs: Omit<NPC, 'id' | 'knowsPlayerHistory'>[];
  locations: Omit<Location, 'id' | 'subLocationIds'>[];
  factions: Omit<Faction, 'id' | 'leaderId' | 'memberIds'>[];
  items: Omit<Item, 'id'>[];
  adventures: AdventureForBatchAdd[];
};
```

### Import Pattern

**Always import from barrel:**

```typescript
// ✅ CORRECT
import { Campaign, NPC, Location } from './types';

// ❌ AVOID
import { NPC } from './types/NPC';
```

---

## Styling Conventions

### Tailwind CSS via CDN

**Load Method:** `<script src="https://cdn.tailwindcss.com"></script>` in `index.html`

**No PostCSS config** - JIT mode from CDN

### Typography

**Fonts:**
- **Body:** Roboto (sans-serif)
- **Headings:** Merriweather (serif)

```typescript
className="font-serif text-3xl" // Uses Merriweather
className="text-base"           // Uses Roboto
```

### Color Palette

**Theme:** Dark mode with indigo accents

```typescript
// Primary Accent
className="text-indigo-400"      // Light accent
className="bg-indigo-600"        // Primary buttons
className="border-indigo-500"    // Focus states

// Backgrounds
className="bg-slate-950"         // Darkest (main background)
className="bg-slate-900"         // Cards/panels
className="bg-slate-800"         // Input fields

// Text
className="text-slate-100"       // Primary text
className="text-slate-300"       // Secondary text
className="text-slate-500"       // Muted text

// Borders
className="border-slate-700"     // Input borders
className="border-slate-800"     // Card borders

// Danger
className="bg-red-800"           // Destructive actions
className="text-red-400"         // Error text
```

### Common Component Styles

#### Card/Panel

```typescript
className="bg-slate-900/50 p-6 rounded-xl border border-slate-800/50"
```

#### Input Field

```typescript
className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2
           text-slate-100 focus:ring-2 focus:ring-indigo-500/50
           focus:border-indigo-500 outline-none transition-all
           placeholder:text-slate-600"
```

#### Button (via Button component)

```typescript
import { Button } from '@/components/common/Button';

<Button variant="primary">Save</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="ghost">Edit</Button>
<Button variant="danger">Delete</Button>
```

**Button Implementation:**
```typescript
const variantClasses = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
  secondary: 'bg-slate-700 text-slate-100 hover:bg-slate-600',
  ghost: 'bg-transparent text-slate-300 hover:bg-slate-800',
  danger: 'bg-red-800 text-white hover:bg-red-700',
};
```

#### Layout Container

```typescript
// Full-screen flex container
<div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col">
  <Header />
  <div className="flex-1 flex overflow-hidden">
    <Sidebar className="w-64" />
    <main className="flex-1 overflow-y-auto">
      {content}
    </main>
  </div>
</div>
```

#### Responsive Grid

```typescript
<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
  <div className="lg:col-span-1">{/* Generator */}</div>
  <div className="lg:col-span-2">{/* List */}</div>
</div>
```

### Custom Scrollbar

```css
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
  background: #1e293b; /* slate-800 */
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #475569; /* slate-600 */
  border-radius: 4px;
}
```

### Icons

**Always import from centralized Icons file:**

```typescript
// ✅ CORRECT
import { Icons } from '@/components/common/Icons';
<Icons.Plus />
<Icons.Trash />
<Icons.Sparkles />

// ❌ WRONG
import { Plus } from 'lucide-react';
```

---

## Development Workflows

### Running the App

```bash
npm run dev     # Start dev server (http://localhost:3000)
npm run build   # Production build
npm run preview # Preview production build
```

### Environment Variables

**File:** `.env.local`

```env
GEMINI_API_KEY=your_api_key_here
```

**Access in code:**
```typescript
const apiKey = process.env.GEMINI_API_KEY;
```

### Mock Mode

**Toggle in Header:** Switch between real AI and mock data

**Benefits:**
- Test without API calls
- Offline development
- Faster iteration
- Smoke test validation

**Usage in components:**
```typescript
const handleGenerate = async () => {
  const data = await generateNpc(prompt, false, isMockMode, context);
  // isMockMode automatically routes to mockService
};
```

### Smoke Testing

**File:** `smokeTest.ts` (15,819 lines!)

**Runs automatically on mount** in `App.tsx:65-67`:

```typescript
useEffect(() => {
  runSmokeTests(isMockMode);
}, [isMockMode]);
```

**Two Test Suites:**
1. **`testServiceFunctions`** - Tests all AI service functions
2. **`testCampaignHandlers`** - Tests state management CRUD

**Manual trigger:** Can be called from browser console

### Local Storage

**Keys:**
- `realmweaver-campaigns` - Campaign data
- `realmweaver-active-campaign-id` - Active campaign ID

**Auto-save:** Every state change triggers save

**Clear data:**
```typescript
campaignService.reset();
// Or manually: localStorage.clear();
```

---

## Common Tasks

### Adding a New Entity Type

**Example:** Adding a "Monster" entity

#### 1. Create Type Definition

**File:** `types/Monster.ts`

```typescript
export interface Monster {
  id: string;
  name: string;
  description: string;
  stats: string;
  abilities: string;
  lore: string;
}
```

**Update:** `types/index.ts`

```typescript
export * from './Monster';
```

#### 2. Add to Campaign Type

**File:** `types/Campaign.ts`

```typescript
export interface Campaign {
  // ... existing fields
  monsters: Monster[];
}
```

#### 3. Add CRUD to Campaign Service

**File:** `services/campaignService.ts`

```typescript
createMonster(monsterData: Omit<Monster, 'id'>): Monster {
  const newMonster: Monster = { ...monsterData, id: crypto.randomUUID() };
  updateState(draft => {
    const campaign = getActiveCampaignFromState(draft);
    campaign.monsters.push(newMonster);
  });
  return newMonster;
},

updateMonster(id: string, updates: Partial<Omit<Monster, 'id'>>) {
  updateState(draft => {
    const campaign = getActiveCampaignFromState(draft);
    const monster = campaign.monsters.find(m => m.id === id);
    if (monster) Object.assign(monster, updates);
  });
},

deleteMonster(id: string) {
  updateState(draft => {
    const campaign = getActiveCampaignFromState(draft);
    campaign.monsters = campaign.monsters.filter(m => m.id !== id);
  });
},
```

#### 4. Create AI Generation Schema

**File:** `services/ai/realmWeaver.ts`

```typescript
import { Type } from '@google/genai';

export const monsterSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "The monster's name" },
    description: { type: Type.STRING, description: "Physical appearance" },
    stats: { type: Type.STRING, description: "Game statistics" },
    abilities: { type: Type.STRING, description: "Special abilities" },
    lore: { type: Type.STRING, description: "Background and lore" },
  },
  required: ['name', 'description', 'stats', 'abilities', 'lore']
};

export const generateMonster = async (
  prompt: string,
  campaignContext?: string
): Promise<Omit<Monster, 'id'>> => {
  const instructions = `You are a master game designer. Create a compelling monster...`;
  return await generateWithSchema(prompt, monsterSchema, instructions, 'gemini-2.5-flash', campaignContext);
};
```

#### 5. Add Mock Implementation

**File:** `services/ai/mockService.ts`

```typescript
generateMonster: async (prompt: string, campaignContext?: string): Promise<Omit<Monster, 'id'>> => {
  await delay(1500);
  return {
    name: "Shadow Drake",
    description: "A sleek dragon with obsidian scales...",
    stats: "AC 18, HP 152, Speed 40 ft., fly 80 ft.",
    abilities: "Shadow Breath, Phase Step, Dark Aura",
    lore: "Ancient guardians of the Shadow Realm..."
  };
},
```

#### 6. Add to Service Facade

**File:** `services/geminiService.ts`

```typescript
export const generateMonster = (
  prompt: string,
  isMockMode: boolean,
  campaignContext?: string
): Promise<Omit<Monster, 'id'>> => {
  if (isMockMode) return mockService.generateMonster(prompt, campaignContext);
  return aiRealmWeaver.generateMonster(prompt, campaignContext);
};
```

#### 7. Create Components

**Generator:** `components/generators/MonsterGenerator.tsx`

```typescript
const MonsterGenerator: React.FC<{
  onMonsterCreated: (data: Omit<Monster, 'id'>) => void;
  isMockMode: boolean;
  campaignContext?: string;
}> = ({ onMonsterCreated, isMockMode, campaignContext }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const monsterData = await generateMonster(prompt, isMockMode, campaignContext);
      onMonsterCreated(monsterData);
      setPrompt('');
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/50 p-6 rounded-xl">
      <h3 className="font-serif text-xl mb-4">Generate Monster</h3>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="A shadow dragon that guards ancient ruins..."
        className="w-full bg-slate-950 border border-slate-700 rounded-md p-3"
        rows={4}
      />
      <Button onClick={handleGenerate} disabled={isLoading}>
        {isLoading ? 'Generating...' : 'Generate Monster'}
      </Button>
    </div>
  );
};
```

**Editor:** `components/editors/MonsterEditor.tsx`
**Dashboard:** `components/dashboards/MonsterDashboard.tsx`

#### 8. Update App.tsx

```typescript
// Add to EditorView type
export type EditorView = 'setting' | 'npcs' | 'locations' | ... | 'monsters';

// Add state
const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(null);

// Add to routing logic
{activeView === 'monsters' && (
  <MonsterDashboard
    monsters={activeCampaign.monsters}
    onMonsterCreated={(data) => campaignService.createMonster(data)}
    onSelectMonster={setSelectedMonsterId}
    isMockMode={isMockMode}
    campaignContext={campaignContext}
  />
)}
```

#### 9. Update CampaignSidebar

```typescript
// Add navigation item
<button
  onClick={() => {
    setActiveView('monsters');
    resetSelections();
  }}
  className={activeView === 'monsters' ? 'active' : ''}
>
  <Icons.Skull className="w-4 h-4" />
  <span>Monsters</span>
  <span className="badge">{campaign.monsters.length}</span>
</button>
```

### Adding AI-Assist to a Field

**Pattern:** Sparkle button next to field triggers AI enhancement

```typescript
const [isEnhancing, setIsEnhancing] = useState(false);

const handleEnhanceDescription = async () => {
  setIsEnhancing(true);
  try {
    const enhanced = await generateText(
      `Enhance this description: ${localDescription}`,
      'You are a creative writer...',
      'gemini-2.5-flash'
    );
    setLocalDescription(enhanced);
    onUpdate(entity.id, { description: enhanced });
  } catch (error) {
    console.error('Enhancement failed:', error);
  } finally {
    setIsEnhancing(false);
  }
};

return (
  <div className="relative">
    <textarea value={localDescription} onChange={...} />
    <button
      onClick={handleEnhanceDescription}
      disabled={isEnhancing}
      className="absolute top-2 right-2"
    >
      <Icons.Sparkles className={isEnhancing ? 'animate-spin' : ''} />
    </button>
  </div>
);
```

### Implementing Relationships

**Pattern:** Use campaignService sync functions

```typescript
// Example: Linking a Monster to a Location

// In MonsterEditor.tsx
const handleLinkToLocation = (locationId: string) => {
  campaignService.linkMonsterToLocation(monster.id, locationId);
};

// In campaignService.ts
linkMonsterToLocation(monsterId: string, locationId: string) {
  updateState(draft => {
    const campaign = getActiveCampaignFromState(draft);
    const monster = campaign.monsters.find(m => m.id === monsterId);
    const location = campaign.locations.find(l => l.id === locationId);

    if (monster && location) {
      // Update monster
      monster.locationId = locationId;

      // Update location (bidirectional)
      if (!location.monsterIds) location.monsterIds = [];
      if (!location.monsterIds.includes(monsterId)) {
        location.monsterIds.push(monsterId);
      }
    }
  });
},
```

### Export Functionality

**JSON Export:**
```typescript
import { exportCampaignAsJson } from './services/importExportService';

const handleExport = () => {
  exportCampaignAsJson(activeCampaign);
  // Downloads campaign-title.json
};
```

**Obsidian Export:**
```typescript
import { exportCampaignAsObsidian } from './services/importExportService';

const handleExport = () => {
  exportCampaignAsObsidian(activeCampaign);
  // Downloads campaign-title-obsidian.zip
};
```

---

## Important Conventions

### File Naming

**Components:** PascalCase
```
NpcEditor.tsx
CampaignSidebar.tsx
Button.tsx
```

**Services:** camelCase
```
campaignService.ts
geminiService.ts
importExportService.ts
```

**Types:** PascalCase
```
NPC.ts
Campaign.ts
Location.ts
```

### Import Organization

**Order:**
1. React imports
2. Type imports
3. Component imports
4. Service imports
5. Utility imports

```typescript
import React, { useState, useEffect } from 'react';
import type { Campaign, NPC } from './types';
import { Button } from '@/components/common/Button';
import { campaignService } from './services/campaignService';
import { generateNpc } from './services/geminiService';
```

### Component Structure

**Standard order:**
1. Props interface
2. Component function
3. State declarations
4. Effects
5. Derived state (useMemo)
6. Event handlers
7. Helper functions
8. Render logic

```typescript
interface Props {
  entity: Entity;
  onUpdate: (id: string, updates: Partial<Entity>) => void;
}

const EntityEditor: React.FC<Props> = ({ entity, onUpdate }) => {
  // State
  const [localName, setLocalName] = useState(entity.name);

  // Effects
  useEffect(() => {
    setLocalName(entity.name);
  }, [entity.name]);

  // Derived state
  const isValid = useMemo(() => localName.length > 0, [localName]);

  // Event handlers
  const handleSave = () => {
    onUpdate(entity.id, { name: localName });
  };

  // Render
  return <div>...</div>;
};
```

### Error Handling

**Pattern:**
```typescript
const handleGenerate = async () => {
  setIsLoading(true);
  try {
    const data = await generateEntity(prompt, isMockMode, context);
    onEntityCreated(data);
  } catch (error) {
    console.error('Generation failed:', error);
    alert(`Failed to generate: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    setIsLoading(false);
  }
};
```

### Loading States

**Pattern:**
```typescript
const [isLoading, setIsLoading] = useState(false);

return (
  <Button onClick={handleAction} disabled={isLoading}>
    {isLoading ? (
      <>
        <Icons.Loader className="animate-spin mr-2" />
        Processing...
      </>
    ) : (
      'Generate'
    )}
  </Button>
);
```

---

## Common Pitfalls

### 1. Forgetting to Use campaignService

**❌ WRONG:**
```typescript
const newNpc = { ...npcData, id: crypto.randomUUID() };
campaign.npcs.push(newNpc); // Direct mutation!
```

**✅ CORRECT:**
```typescript
campaignService.createNpc(npcData); // Service handles ID generation and state update
```

### 2. Not Passing isMockMode

**❌ WRONG:**
```typescript
const data = await generateNpc(prompt, false, campaignContext);
// Missing isMockMode parameter!
```

**✅ CORRECT:**
```typescript
const data = await generateNpc(prompt, false, isMockMode, campaignContext);
```

### 3. Importing Icons Directly

**❌ WRONG:**
```typescript
import { Plus, Trash } from 'lucide-react';
```

**✅ CORRECT:**
```typescript
import { Icons } from '@/components/common/Icons';
// Use Icons.Plus, Icons.Trash
```

### 4. Forgetting Campaign Context

**❌ WRONG:**
```typescript
const npcData = await generateNpc(prompt, false, isMockMode);
// Missing campaign context!
```

**✅ CORRECT:**
```typescript
const campaignContext = `Setting: ${campaign.setting}...`;
const npcData = await generateNpc(prompt, false, isMockMode, campaignContext);
```

### 5. Not Handling Relationships

**❌ WRONG:**
```typescript
// Manually updating both sides
npc.factionId = factionId;
faction.memberIds.push(npcId);
```

**✅ CORRECT:**
```typescript
campaignService.linkNpcToFaction(npcId, factionId);
// Automatically syncs both sides
```

### 6. Incorrect Type for AI Generation

**❌ WRONG:**
```typescript
const generateNpc = (): Promise<NPC> => { ... }
// AI shouldn't generate id, factionId, etc.
```

**✅ CORRECT:**
```typescript
const generateNpc = (): Promise<Omit<NPC, 'id' | 'factionId' | 'knowsPlayerHistory'>> => { ... }
```

### 7. Not Using Barrel Exports

**❌ WRONG:**
```typescript
import { NPC } from './types/NPC';
import { Campaign } from './types/Campaign';
```

**✅ CORRECT:**
```typescript
import { NPC, Campaign } from './types';
```

### 8. Forgetting to Update Mock Service

When adding new AI functions, always update both:
- `services/ai/realmWeaver.ts` (real implementation)
- `services/ai/mockService.ts` (mock implementation)
- `services/geminiService.ts` (facade)

### 9. Not Resetting Selections

**❌ WRONG:**
```typescript
setActiveView('npcs');
// Old selection might still be active!
```

**✅ CORRECT:**
```typescript
setActiveView('npcs');
resetSelections(); // Clear all entity selections
```

### 10. Hardcoding Paths Instead of Using Alias

**❌ WRONG:**
```typescript
import { Button } from '../../../components/common/Button';
```

**✅ CORRECT:**
```typescript
import { Button } from '@/components/common/Button';
```

---

## Best Practices Summary

### State Management
- ✅ Always use `campaignService` methods
- ✅ Never mutate state directly
- ✅ Use provided sync functions for relationships
- ✅ Keep UI state in components, domain state in service

### AI Integration
- ✅ Always pass `isMockMode` parameter
- ✅ Always pass `campaignContext` for consistency
- ✅ Use schema-based generation for structured data
- ✅ Handle errors gracefully with try/catch
- ✅ Show loading states during generation

### Component Development
- ✅ Follow three-tier pattern (Dashboard → Generator → Editor)
- ✅ Import icons from `@/components/common/Icons`
- ✅ Use `@/` path alias for imports
- ✅ Follow Tailwind dark theme color conventions
- ✅ Use Button component for all buttons

### Type Safety
- ✅ Import types from barrel (`./types`)
- ✅ Use `Omit<Entity, 'id' | ...>` for AI generation
- ✅ Define all entity relationships explicitly
- ✅ Create schemas for AI-generated data

### Testing & Development
- ✅ Use mock mode for development
- ✅ Run smoke tests regularly
- ✅ Test with and without campaign context
- ✅ Validate relationship syncing

---

## Quick Reference

### Common Imports

```typescript
// React
import React, { useState, useEffect, useMemo, useSyncExternalStore } from 'react';

// Types
import type { Campaign, NPC, Location, Faction, Item, Scene, Adventure } from './types';

// State Management
import { campaignService } from './services/campaignService';

// AI Services
import { generateNpc, generateLocation, generateFaction, ... } from './services/geminiService';

// Common Components
import { Button } from '@/components/common/Button';
import { Icons } from '@/components/common/Icons';
import { Textarea } from '@/components/common/Textarea';
```

### Environment Variables

```typescript
process.env.GEMINI_API_KEY  // Gemini API key
process.env.API_KEY         // Alternative key name
```

### Campaign Service Quick Reference

```typescript
// Campaign
campaignService.createCampaign(title, setting)
campaignService.switchCampaign(id)
campaignService.updateCampaign(updates)
campaignService.deleteCampaign(id)

// Entity CRUD (pattern applies to all)
campaignService.createNpc(data)
campaignService.updateNpc(id, updates)
campaignService.deleteNpc(id)

// Relationships
campaignService.linkNpcToFaction(npcId, factionId)
campaignService.unlinkNpcFromFaction(npcId)
campaignService.linkSceneToLocation(sceneId, locationId)
campaignService.linkSceneToNpcs(sceneId, npcIds)

// State
campaignService.getState()
campaignService.subscribe(listener)
```

### AI Service Quick Reference

```typescript
// Entity Generation
generateNpc(prompt, useGroundedSearch, isMockMode, context)
generateLocation(prompt, isMockMode, context)
generateFaction(prompt, isMockMode, context)
generateItem(prompt, isMockMode, context)
generateScene(prompt, isMockMode, context)
generateAdventure(prompt, isMockMode, context)
generateArticle(prompt, isMockMode, context)

// DM Coach
generateNarration(prompt, scene, modelId, isMockMode)
generateNpcDialogue(prompt, npc, scene, modelId, isMockMode)
generateImprovPlotTwist(prompt, context, modelId, isMockMode)
generateRollableTable(prompt, context, isMockMode)

// Batch
generateCampaignFill(setting, theme, detailed, isMockMode)
parseNpcFromText(text, context, isMockMode)
parseCharacterSheetPdf(base64, isMockMode)
```

### Tailwind Common Classes

```typescript
// Backgrounds
"bg-slate-950"           // Main background
"bg-slate-900/50"        // Card background
"bg-slate-800"           // Input background

// Text
"text-slate-100"         // Primary text
"text-slate-300"         // Secondary text
"text-indigo-400"        // Accent text

// Borders
"border border-slate-700"      // Input border
"border border-slate-800/50"   // Card border

// Interactive
"hover:bg-slate-800"     // Hover state
"focus:ring-2 focus:ring-indigo-500/50"  // Focus state

// Layout
"flex flex-col gap-4"    // Vertical stack
"grid grid-cols-1 lg:grid-cols-3 gap-8"  // Responsive grid
```

---

## Additional Resources

### Key Files to Reference

- **`TDD.md`** - Technical Design Document
- **`smokeTest.ts`** - Comprehensive integration tests
- **`App.tsx`** - Main application logic
- **`services/campaignService.ts`** - State management
- **`services/ai/core.ts`** - AI integration core

### Development Tips

1. **Start with mock mode** to avoid API costs during development
2. **Check smoke tests** to understand expected behavior
3. **Reference existing components** for patterns
4. **Use TypeScript strictly** - types are comprehensive
5. **Test relationships thoroughly** - bidirectional sync is critical

### When in Doubt

1. Check existing similar components for patterns
2. Verify types are imported from barrel (`./types`)
3. Ensure `campaignService` is used for all state changes
4. Always pass `isMockMode` to AI functions
5. Follow the three-tier component pattern

---

**Last Updated:** 2025-11-16
**Maintained by:** AI assistants working on Realmweaver
**Questions?** Reference this guide and existing code patterns
