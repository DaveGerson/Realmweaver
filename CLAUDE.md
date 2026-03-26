# CLAUDE.md - AI Assistant Guide for Realmweaver

> **Last Updated:** 2026-03-26

---

## Project Overview

**Realmweaver** is an SPA for tabletop RPG Game Masters to create, manage, and run campaigns with AI assistance.

### Tech Stack

- **Frontend:** React 19.2.0 + TypeScript 5.8.2, Vite 6.2.0
- **AI:** Claude Code CLI (via `vite-plugin-ai-proxy.ts`) / Anthropic REST API (future)
- **Styling:** Tailwind CSS (CDN via index.html), tailwind-merge
- **State:** Custom store with Immer (`services/campaignService.ts`)
- **Icons:** Lucide React via `components/common/Icons.tsx`
- **Visualization:** React Flow 11.10.1, Dagre 0.8.5, D3 7.8.5
- **Testing:** Vitest (unit) + Playwright (E2E)

### Quick Start

```bash
npm install && npm run dev    # http://localhost:3000
npm run build                 # Production build
npm test                      # Vitest unit tests
npm run test:e2e              # Playwright E2E
```

Create `.env.local`:
```env
REALMWEAVER_AI_PROVIDER=claude-cli  # or 'anthropic-api'
ANTHROPIC_API_KEY=your_key_here     # only if anthropic-api
```

---

## Project Structure

### CRITICAL: No `src/` Directory

All code lives at the **project root**. Import alias: `@/` maps to root.

```
Realmweaver/
├── App.tsx, index.tsx, index.html, vite.config.ts, vite-plugin-ai-proxy.ts
├── hooks/           # useEntitySelection, useModalState, useConfirmDialog, useToast, useEntitySearch, useRovingTabIndex
├── components/
│   ├── common/      # Button, Icons, Textarea, DialogShell, ConfirmDialog, ToastContainer,
│   │                  ErrorBoundary, EntityCreationPanel, EntityLink, EntityQuickCard,
│   │                  BacklinksPanel, LinkedText, MentionInput, CommandPalette, Breadcrumbs,
│   │                  RegenerateButton, SkeletonCard, TabLayout, DmStylePanel,
│   │                  StepIndicator, KeyboardShortcutsHelp, GenerateHerePanel,
│   │                  SceneResourcesPanel, etc.
│   ├── layout/      # Header, CampaignSidebar, ContentWrapper, ViewRouter + sidebar/ sub-components
│   ├── views/       # WelcomeScreen, CampaignCreator, FirstCampaignWizard, CrossCampaignDashboard,
│   │                  SessionRunner + session/ sub-components
│   ├── dashboards/  # One per entity type (NPC, Location, Faction, Item, Adventure, Article, etc.)
│   ├── generators/  # AI creation forms per entity type + EntityChatGenerator
│   ├── editors/     # Detail editors per entity type + CampaignSettingEditor, PrepDocumentView
│   ├── dialogs/     # DmCoach, EvocationWizard, WorldSimulationWizard, ContinuityChecker, etc.
│   ├── tools/       # CombatTracker, DiceRoller, SecretsTracker
│   ├── visualizers/ # RelationshipGraph, PlotTimeline
│   └── RealmChat/   # RealmChatWidget (indigo accent ONLY here)
├── services/
│   ├── aiService.ts          # AI facade — THE ONLY import point for components
│   ├── campaignService.ts    # Central state store
│   ├── contextBuilder.ts     # Tiered token-budget-aware context assembly
│   ├── continuityChecker.ts  # Rule-based consistency checks
│   ├── importExportService.ts
│   └── ai/                   # core.ts, modelConfig.ts, realmWeaver.ts, dmCoach.ts,
│                               evocationWizard.ts, realmChat.ts, worldSimulation.ts,
│                               styleMatching.ts, audioTranscription.ts, mockService.ts,
│                               providers/
├── types/           # One file per entity, barrel export via index.ts
└── utils/           # entityUtils.ts (factories + ENTITY_TYPE_CONFIG), backlinkUtils, dmStyleUtils, etc.
```

---

## Architecture Patterns

### State Store (`campaignService.ts`)

Factory-based store using Immer. `updateState()` triggers debounced localStorage auto-save (2s). `_internalUpdate()` bypasses save for meta-state. Factory accepts `{ persist: false }` for tests. React integration via `useSyncExternalStore(campaignService.subscribe, campaignService.getState)`.

### AI Service Architecture

```
Component → aiService.ts (facade) → ai/core.ts (adapter) → providers/registry → claude-cli | anthropic-api
```

**MANDATORY: Components import ONLY from `aiService.ts`.** Never import `ai/` modules directly.

Model tiers: `lite` (haiku), `standard` (sonnet), `quality` (opus). The `core.ts` adapter maps legacy Gemini model names to tiers automatically.

### Dialog System

All modals use `DialogShell` (focus trap, Escape, ARIA, scroll lock). Confirmations via `useConfirmDialog()`. Toast feedback via `useToast()`.

### Data Flow

```
User Action → Component → campaignService method → Immer update →
debounced localStorage save → notify subscribers → React re-render
```

Relationships: bidirectional syncing (NPC ↔ Faction), cycle detection (Location hierarchy), cascade deletion.

---

## State Management

```typescript
type CampaignState = {
  campaigns: Campaign[];
  activeCampaignId: string | null;
  appStatus: 'loading' | 'welcome' | 'selecting' | 'creating' | 'editing';
  saveStatus: 'idle' | 'saved' | 'saving' | 'error';
  lastSavedAt: string | null;
};
```

**Core API pattern** (same for all entity types — NPC, Location, Faction, Item, Adventure, Scene, Article, SessionLog, PlayerCharacter, Plot, Note, Secret):
```typescript
campaignService.createNpc(data) / updateNpc(id, updates) / deleteNpc(id)
// e.g. deleteAdventure(id) — deletion cascades to clean up all related references
```

Relationship methods: `linkNpcToFaction`, `linkSceneToLocation`, `linkSceneToNpcs`, `setLocationParent`, etc.

---

## Component Patterns

### Three-Tier Hierarchy

1. **Dashboards** — Entity list + `EntityCreationPanel` (chat/form toggle) + `useEntitySearch`. All dashboards use `useEntitySearch` for search/filter and `useRovingTabIndex` for keyboard grid navigation. Dashboard cards display entity completeness indicators (green/amber/red dots).
2. **Generators** — AI creation forms. Accept `isMockMode`, `campaignContext`. Call `aiService` functions.
3. **Editors** — Detail views with tabs and inline AI-assist. Accept `onNavigate` for EntityLink clicks.

### EditorView

Defined in `App.tsx`. New views need entries in BOTH `App.tsx` and `ViewRouter.tsx`:
```typescript
export type EditorView = 'setting' | 'npcs' | 'locations' | 'factions' | 'items' |
  'adventures' | 'lorebook' | 'session-logs' | 'player-characters' | 'plots' |
  'combat' | 'relationships' | 'session-runner' | 'secrets';
```

---

## Type System

All entities require `id: string` + `name: string`. Each has its own file in `types/`, re-exported via `types/index.ts`.

### Adding a New Entity Type (13 Steps)

1. Create `types/NewEntity.ts` (must have `id`, `name`)
2. Export from `types/index.ts`
3. Add array to `Campaign` interface in `types/Campaign.ts`
4. Add CRUD methods in `campaignService.ts`
5. Add mock data in `ai/mockService.ts`
6. Add facade function in `aiService.ts`
7. Add default factory in `utils/entityUtils.ts`
8. Add entry to `ENTITY_TYPE_CONFIG` in `entityUtils.ts`
9. Create generator in `components/generators/`
10. Create dashboard in `components/dashboards/` (use `EntityCreationPanel` + `useEntitySearch`)
11. Create editor in `components/editors/`
12. Add to `EditorView` in `App.tsx` AND `ViewRouter.tsx`
13. Add sidebar entry in `CampaignSidebar.tsx`

---

## Styling Conventions

### Dark Theme Tokens (slate + amber)

| Token | Usage |
|-------|-------|
| `bg-slate-900/800/700` | Page / card / secondary bg |
| `text-slate-100/300/400` | Primary / secondary / muted text |
| `text-amber-400`, `bg-amber-600` | Accent text, primary buttons |
| `border-slate-700/600` | Borders, input borders |
| `rounded-lg/md` | Cards / inputs |

Use `inputBaseClasses` / `textareaBaseClasses` from `components/common/Textarea.tsx` for form fields.

### Entity Type Colors (via `ENTITY_TYPE_CONFIG`)

npc=amber, location=emerald, faction=violet, item=sky, adventure=orange, article=cyan, sessionLog=rose, playerCharacter=teal, plot=yellow, note=slate

**Indigo is reserved exclusively for RealmChatWidget.**

---

## Common Tasks

### Adding a New AI Function

1. Implement in `services/ai/[module].ts`
2. Add mock in `ai/mockService.ts`
3. Add facade in `aiService.ts` with mock/real switching
4. Import only from `aiService.ts` in components

### Adding a New View

1. Add to `EditorView` in `App.tsx`
2. Add rendering in `ViewRouter.tsx`
3. Add sidebar entry in `CampaignSidebar.tsx`

### Campaign Context for AI Calls

```typescript
import { buildCampaignContext } from '@/services/contextBuilder';
const ctx = buildCampaignContext(campaign, 'generation', 4000); // variant: 'generation' | 'coach' | 'chat'
```

---

## Conventions & Pitfalls

| Rule | Details |
|------|---------|
| No `src/` directory | All code at project root |
| Icons via `Icons.tsx` | Never import directly from `lucide-react` |
| Types via `types/index.ts` | Use barrel export |
| Named exports only | No `export default` |
| AI facade only | Import from `aiService.ts`, never `ai/` modules directly |
| Mock mode required | Every AI function needs a mock in `mockService.ts` |
| Always pass campaignContext | AI content needs world context for consistency |
| No direct state mutation | Use campaignService methods (Immer internally) |
| `useSyncExternalStore` | React subscription pattern for campaignService |
| `DialogShell` for all modals | Focus trap, Escape, ARIA |
| `useConfirmDialog` not `window.confirm` | Branded UI |
| `useToast` not `window.alert` | Non-blocking |
| `ENTITY_TYPE_CONFIG` | Single source for entity colors/icons, never hardcode |
| `slate-*` not `stone-*` | Consistent color tokens |
| Update `ViewRouter.tsx` | New views need both `App.tsx` and `ViewRouter.tsx` |
| `EntityCreationPanel` | Required for all dashboard creation UIs |
| Cascade deletion | Entity delete must clean up all relationship references |
| No indigo outside RealmChat | Indigo is reserved for the AI assistant widget |
| `<Button>` for action buttons | Use `Button` component (primary/secondary/ghost/danger/icon variants) for action buttons. Raw `<button>` only for cards, tabs, chips, toggles, semantic role buttons |

---

## Documentation Maintenance (MANDATORY)

| What Changed | Update |
|-------------|--------|
| New component/service/type | `docs/architecture/high-level-design.md` |
| Architecture pattern | `high-level-design.md` + `technical-design.md` |
| New entity type / data model | `high-level-design.md` + `CLAUDE.md` (type system) |
| New AI service function | `CLAUDE.md` (AI Service Integration) |
| Major feature | `README.md` |
