
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

RealmWeaver is a single-page application for tabletop RPG Game Masters who want to create, manage, and run campaigns with AI assistance. It combines deep world-building tools, real-time session support, and conversational AI into one unified experience.

### Core Features

| Category | Features |
|----------|---------|
| **World Building** | AI-generated NPCs, locations, factions, items, adventures, articles, plots. Campaign context injected into every generation for consistency. |
| **Session Management** | Session Prep Wizard (5-step guided flow), Session Runner with scene advancement, running log, beats mode, voice capture, auto-event capture. |
| **In-Session Tools** | DM Coach (narrate, improvise, rollable tables, NPC roleplay), Combat Tracker, Dice Roller, Secrets & Clues Tracker. |
| **Navigation** | Entity cross-linking with hover tooltips (EntityQuickCard), backlinks ("Referenced By"), back stack, recent items, pinned favorites, command palette (Ctrl+K). |
| **World Intelligence** | Continuity Checker (8 rules), Plot Timeline, World Simulation Engine, Content Style Matching, Smart Context Builder (tiered token-budget-aware). |
| **Onboarding** | First Campaign Wizard (5-step), 4 template campaigns, DM Style progressive disclosure (guided/standard/power). |
| **Data** | localStorage persistence, JSON import/export, Obsidian markdown export, PDF character sheet parsing. |

---

## Quick Start

```bash
git clone <repository-url>
cd Realmweaver
npm install
npm run dev      # http://localhost:3000
```

The app works immediately in **Mock Mode** (toggle in the header) — no API key or AI setup required. For real AI generation, ensure the Claude Code CLI is installed and on your `$PATH`:

```env
# .env.local (optional)
REALMWEAVER_AI_PROVIDER=claude-cli   # default; requires `claude` binary on $PATH
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 19.2 + TypeScript 5.8 |
| **Build** | Vite 6.2 + custom AI proxy middleware |
| **AI** | Claude Code CLI (primary, local dev) / Anthropic API (future production) |
| **State** | Custom store + Immer + `useSyncExternalStore` |
| **Styling** | Tailwind CSS (CDN) — dark theme (slate + amber) |
| **Icons** | Lucide React (centralized via `Icons.tsx`) |
| **Graphs** | React Flow + Dagre + D3 |
| **Testing** | Vitest (unit) + Playwright (E2E) |

---

## Architecture

```
Components (React)  ->  campaignService (Immer + localStorage)
        |                         |
aiService.ts (facade)    useSyncExternalStore()
        |
  ai/core.ts (adapter)
  providers/registry  ->  claude-cli  (default, via Vite proxy)
                      ->  anthropic-api  (future production)
  ai/realmWeaver | dmCoach | realmChat | evocation | worldSim | style
  ai/mockService (offline testing)
```

**Key patterns:**
- Factory-based external store with debounced auto-save (2s)
- Three-layer AI facade (component -> aiService.ts -> ai/ modules -> provider)
- Provider abstraction: `ModelTier` (lite/standard/quality) maps to Claude haiku/sonnet/opus
- Tiered context builder (token-budget-aware, 3 tiers)
- Three-tier component hierarchy (dashboards -> generators -> editors)
- Entity cross-linking (EntityLink, QuickCard hover, LinkedText, BacklinksPanel)
- Decomposed App shell: ViewRouter, useEntitySelection, useModalState, sidebar sub-components, session sub-components
- Accessible dialog system: DialogShell (focus trap), useConfirmDialog, useToast
- ENTITY_TYPE_CONFIG as canonical entity color/icon registry

All code at **project root** (no `src/` directory). Import alias `@/` maps to root.

---

## Documentation

| Document | Description |
|----------|-------------|
| [`docs/architecture/high-level-design.md`](docs/architecture/high-level-design.md) | System overview, architecture diagrams, data model, feature map, project structure |
| [`docs/architecture/technical-design.md`](docs/architecture/technical-design.md) | Detailed technical design: state management, AI integration, hooks, dialog system, utilities |
| [`docs/architecture/implementation-plan.md`](docs/architecture/implementation-plan.md) | Phased implementation plan (Phases A-F) with work packages |
| [`docs/design/dm-archetypes.md`](docs/design/dm-archetypes.md) | 5 DM personas driving feature prioritization |
| [`docs/design/session-cockpit-review.md`](docs/design/session-cockpit-review.md) | 67 user stories and priority matrix |
| [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) | End-user guide |
| [`CLAUDE.md`](CLAUDE.md) | Developer conventions for AI-assisted development |

---

## Development

### Commands

```bash
npm run dev              # Dev server on localhost:3000
npm run build            # Production build (verify zero TS errors)
npm test                 # Vitest unit tests
npm run test:watch       # Vitest watch mode
npm run test:e2e         # Playwright E2E tests (headless)
npm run test:e2e:headed  # E2E with visible browser
```

### Key Conventions

- **No `src/` directory** — all code at project root
- **Icons** through `components/common/Icons.tsx` only
- **Types** through `types/index.ts` barrel export
- **Named exports only** — no `export default`
- **AI calls** through `services/aiService.ts` facade only
- **Mock mode** — every AI function has a mock implementation
- **Modals** must use `DialogShell`; confirmations use `useConfirmDialog`; alerts use `useToast`
- **Entity colors/icons** derived from `ENTITY_TYPE_CONFIG` in `utils/entityUtils.ts`
- **Indigo** is reserved for `RealmChatWidget` only; all other accents use amber
- **`slate-*`** color tokens, not `stone-*`

### Testing

| Layer | Framework | Tests | Scope |
|-------|-----------|-------|-------|
| Unit | Vitest | 97 | Services, utilities, context builder, archetype scenarios |
| E2E | Playwright | 38 | Campaign lifecycle, entity CRUD, navigation, session runner, DM tools |
| Smoke | Built-in | ~20 | Service availability, entity CRUD (runs on app startup) |
| Mock | Built-in | Full app | All features work without API key or network |

---

## Project Status

**Phases A through F complete, plus UX refactoring sprint and Claude migration.**

| Phase | Status | What |
|-------|--------|------|
| A | Done | Universal fixes (7 items) |
| A2 | Done | UI foundation (color language, empty states, sidebar filter, breadcrumbs) |
| B | Done | Search & generation UX (command palette, entity cards, @mention, inline regen) |
| Nav Overhaul | Done | EntityLinks, back stack, recent items, pinning, backlinks, LinkedText |
| C | Done | Session intelligence (prep wizard, auto-capture, voice, beats, secrets, roleplay) |
| D | Done | World coherence (context builder, plot timeline, continuity checker, relationship intelligence) |
| E | Done | Visual polish (rich cards, tabbed editors, shortcuts, mobile, DM style) |
| F | Done | Growth (campaign wizard, templates, world simulation, style matching, cross-campaign) |
| UX Refactor | Done | App shell decomposition, accessible dialog system, ENTITY_TYPE_CONFIG, hook extraction, utility extraction |
| Claude Migration | Done | Gemini -> Claude Code CLI, provider abstraction layer, model tier system, Vite proxy middleware |

---

## License

Proprietary. All rights reserved.
