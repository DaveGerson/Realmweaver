
# RealmWeaver

<p align="center">
  <img src="public/favicon.svg" alt="RealmWeaver Logo" width="96">
</p>

<h3 align="center">The AI-native campaign cockpit for tabletop RPG Game Masters.</h3>

<p align="center">
  Build worlds. Craft stories. Run sessions. All with AI at your side.
</p>

---

## What is RealmWeaver?

RealmWeaver is a single-page application for tabletop RPG Game Masters who want to create, manage, and run campaigns with AI assistance. It combines deep world-building tools, real-time session support, and conversational AI into one unified experience.

### AI Dungeon Master preview (SRD 5.2.1)

Open **AI Dungeon Master** in a campaign's sidebar. Play with the offline demo or the existing Claude Code provider, review creatures, resolve supported actions with deterministic rules, and search all 364 pages of the current 5.5e SRD. Results persist with the campaign.

**Full source coverage is available; full mechanical coverage is not yet complete.** The preview automates core mechanics and 17 spell profiles. Unsupported mechanics pause for a table ruling. See [implementation, exact coverage, setup and completion gates](docs/ai-dungeon-master.md).

### Core Features

| Category | Features |
|----------|---------|
| **World Building** | AI-generated NPCs, locations, factions, items, adventures, articles, plots. Campaign context injected into every generation for consistency. |
| **Session Management** | Session Prep Wizard (5-step guided flow), Session Runner with scene advancement, running log, beats mode, voice capture, auto-event capture. |
| **In-Session Tools** | DM Coach (narrate, improvise, rollable tables, NPC roleplay), Combat Tracker, Dice Roller, Secrets & Clues Tracker. |
| **Navigation** | Entity cross-linking with hover tooltips (EntityQuickCard), backlinks ("Referenced By"), back stack, recent items, pinned favorites, command palette (Ctrl+K). |
| **World Intelligence** | Continuity Checker (8 rules), Plot Timeline, World Simulation Engine, Content Style Matching, Smart Context Builder (tiered token-budget-aware). |
| **Smart Linking** | Word-boundary matching engine behind `@mention` capture, auto-linking on template import, scene smart-link bar, link suggestions panel. |
| **Onboarding** | First Campaign Wizard (5-step), 4 template campaigns, DM Style progressive disclosure (guided/standard/power). |
| **Data** | localStorage persistence with IndexedDB quota fallback, 3-slot rotating backups + startup recovery, cross-tab conflict resolution, JSON import/export with validation warnings, Obsidian markdown export, PDF character sheet parsing. |

---

## Quick Start

```bash
git clone <repository-url>
cd Realmweaver
npm install
npm run dev      # http://localhost:4200
```

The app works immediately in **Mock Mode** (toggle in the header) — no API key or AI setup required. For real AI generation, ensure the Claude Code CLI is installed and on your `$PATH`.

### Configuration (`.env.local`)

Every variable is optional; copy `.env.local.example` to `.env.local` to start. Values are read by
`vite.config.ts`'s `loadEnv` and, for the client-visible keys, substituted into the bundle through
`define` — `services/ai/modelConfig.ts` reads them back through live getters.

| Variable | Default | Reaches the browser | Purpose |
|----------|---------|---------------------|---------|
| `REALMWEAVER_AI_PROVIDER` | `claude-cli` | Yes | Active provider: `claude-cli` or `anthropic-api` (the latter is still a stub) |
| `REALMWEAVER_DEFAULT_TIER` | `standard` | Yes | Default model tier (`lite` / `standard` / `quality`) |
| `REALMWEAVER_MAX_RETRIES` | `3` | Yes | Retry attempts on transient AI failures |
| `REALMWEAVER_TIMEOUT_MS` | `120000` | Yes | AI request timeout |
| `REALMWEAVER_API_BASE_URL` | — | Yes | Custom Anthropic base URL (`anthropic-api` provider only) |
| `CLAUDE_CLI_PATH` | `claude` | **No** | Path to the `claude` binary, used by the Vite proxy middleware |
| `ANTHROPIC_API_KEY` | — | **No** | Deliberately never injected into the client bundle |
| `REALMWEAVER_DEV_HOST` | `127.0.0.1` | **No** | Opt into a wider dev-server bind (see the security note below) |
| `VITE_RUN_SMOKE_TESTS` | unset | Yes | Opt in to `smokeTest.ts` on startup — it wipes local storage keys and, with Mock Mode off, fires live AI calls |

**Runtime / deploy story:** `npm run dev` (or `npm run preview` after `npm run build`) *is* the
runtime, not just a dev convenience — `vite-plugin-ai-proxy.ts` registers the `/api/ai/*` routes
as middleware on both the dev server (`configureServer`) and the preview server
(`configurePreviewServer`), so a real Node process must stay running for AI generation to work.
There is no separate backend server, and a statically hosted `dist/` (e.g. served from a plain
CDN/static file host with no Vite process behind it) has **no AI backend at all** — every
`/api/ai/*` call 404s and every AI feature falls back to failing requests. `npm run build` alone
is a bundling step (it does *not* typecheck — run `npm run typecheck` separately), not a
deployable artifact on its own.

**Security:** the dev/preview server binds to `127.0.0.1` by default and the proxy rejects any
request whose TCP peer address is not loopback, whose `Origin`/`Host` do not resolve to
localhost, or whose body exceeds 4 MB. The CLI is invoked with `execFile`/`spawn` (never a
shell), under a 120 s timeout and a 1 MB stdout cap.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 19.2 + TypeScript 5.8 |
| **Build** | Vite 6.2 + custom AI proxy middleware (`vite-plugin-ai-proxy.ts`) |
| **AI** | Claude Code CLI (primary, local dev) / Anthropic API (future production) |
| **State** | Custom store + Immer + `useSyncExternalStore` |
| **Persistence** | localStorage with IndexedDB quota fallback + rotating backups (`storageService.ts`) |
| **Styling** | Tailwind CSS 4 (build-time, via `@tailwindcss/vite` + `index.css`) — dark theme (slate + amber) |
| **Icons** | Lucide React (centralized via `Icons.tsx`) |
| **Graphs** | D3 |
| **Testing** | Vitest (unit + jsdom component tests) + Playwright (E2E) |
| **CI** | GitHub Actions (`.github/workflows/ci.yml`): typecheck → unit → build → Chromium E2E |

---

## Architecture

```
Components (React)  ->  campaignService (Immer store)  ->  storageService
        |                         |                          (localStorage -> IndexedDB
aiService.ts (facade)    useSyncExternalStore()               + 3-slot backups)
        |
  ai/core.ts (adapter)
  providers/registry  ->  claude-cli  (default, via Vite proxy)
                      ->  anthropic-api  (future production)
  ai/realmWeaver | dmCoach | realmChat | evocation | worldSim | style | audio
  ai/mockService (offline testing)

services/linking/  ->  matchingEngine (+ engineRegistry seam) -> autoLinker
```

**Key patterns:**
- Factory-based external store with debounced auto-save (2s debounce, 10s max wait, synchronous flush on page teardown)
- Persistence ladder: localStorage -> IndexedDB on quota overflow, rotating backups with startup recovery, cross-tab conflict detection resolved by the GM (`resolveConflict`)
- Three-layer AI facade (component -> aiService.ts -> ai/ modules -> provider)
- Provider abstraction: `ModelTier` (lite/standard/quality) maps to Claude haiku/sonnet/opus; provider knobs flow env -> `vite define` -> `modelConfig.ts` live getters
- Tiered context builder (token-budget-aware, 3 tiers)
- Three-tier component hierarchy (dashboards -> generators -> editors)
- Entity cross-linking (EntityLink, QuickCard hover, LinkedText, BacklinksPanel) over a swappable matching engine
- Decomposed App shell: ViewRouter, StatusBanners, useEntitySelection, useModalState, sidebar sub-components, session sub-components
- Accessible dialog system: DialogShell (focus trap), useConfirmDialog, useToast
- ENTITY_TYPE_CONFIG as canonical entity color/icon registry

All code at **project root** (no `src/` directory). Import alias `@/` maps to root.

---

## Documentation

| Document | Description |
|----------|-------------|
| [`docs/architecture/system-architecture.md`](docs/architecture/system-architecture.md) | **Start here.** Authoritative reference: runtime topology, AI-proxy security posture, component catalog, state deep-dive, known debt |
| [`docs/architecture/semantic-model.html`](docs/architecture/semantic-model.html) | Full semantic model and taxonomy: every entity, every edge, integrity machinery, vocabulary systems (open in a browser) |
| [`docs/architecture/campaign-model-walkthrough.html`](docs/architecture/campaign-model-walkthrough.html) | Visual, exploratory walkthrough of the campaign model for DMs — three depth levels, an interactive map, one worked example story (open in a browser) |
| [`docs/architecture/ontology-tracker.md`](docs/architecture/ontology-tracker.md) | Tracker for ontological-model elements **not in use today**: adopted-but-unimplemented extensions (E1–E11) and dormant shipped elements |
| [`docs/architecture/ontology-proposal-evaluation.md`](docs/architecture/ontology-proposal-evaluation.md) | Evaluation of the external DDAO & ADRAS ontology proposals: what was adopted into the model, what was rejected, and why |
| [`docs/architecture/high-level-design.md`](docs/architecture/high-level-design.md) | System overview, architecture diagram, data model, feature map, project structure |
| [`docs/architecture/technical-design.md`](docs/architecture/technical-design.md) | Detailed technical design: state management, AI integration, hooks, dialog system, styling, build |
| [`docs/architecture/implementation-plan.md`](docs/architecture/implementation-plan.md) | Phased implementation plan (Phases A-F) with work packages |
| [`docs/ship-readiness/remediation-plan.md`](docs/ship-readiness/remediation-plan.md) | The 124-finding ship-readiness review and its 13 work packages |
| [`docs/roadmap.md`](docs/roadmap.md) | Forward-looking feature roadmap |
| [`docs/design/dm-archetypes.md`](docs/design/dm-archetypes.md) | 5 DM personas driving feature prioritization |
| [`docs/design/schema-presentation-guide.md`](docs/design/schema-presentation-guide.md) | Style guide for presenting the data model to DMs — the consistency contract across docs, the walkthrough, and future in-app help |
| [`docs/design/storyteller-first-design.md`](docs/design/storyteller-first-design.md) | Proposed storyteller-first elements (P1–P8): story-first home, improv support, story health, campaign endings |
| [`docs/design/session-cockpit-review.md`](docs/design/session-cockpit-review.md) | 67 user stories and priority matrix |
| [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) | End-user guide |
| [`CLAUDE.md`](CLAUDE.md) | Developer conventions for AI-assisted development (plus per-directory `CLAUDE.md` files) |

---

## Development

### Commands

```bash
npm run dev              # Dev server on 127.0.0.1:4200 (strictPort) -- the AI proxy runs here
npm run build            # Production bundle to dist/ (no typecheck; dist/ has no AI backend by itself)
npm run preview          # Serves dist/ AND the /api/ai/* proxy -- the way to exercise a built app
npm run typecheck        # tsc --noEmit
npm test                 # Vitest unit + component tests
npm run test:watch       # Vitest watch mode
npm run test:e2e         # Playwright E2E tests (headless, chromium + mobile-chrome)
npm run test:e2e:headed  # E2E with visible browser
npm run test:e2e:ui      # Playwright interactive UI mode
```

`npm run dev` uses `strictPort`, so a taken 4200 fails loudly rather than drifting to 4201 —
`playwright.config.ts` hardcodes `http://127.0.0.1:4200`.

### Key Conventions

- **No `src/` directory** — all code at project root
- **Icons** through `components/common/Icons.tsx` only
- **Types** through `types/index.ts` barrel export
- **Named exports only** — no `export default` (the only exceptions are `App.tsx` and the config files Vite/Playwright require to default-export)
- **AI calls** through `services/aiService.ts` facade only
- **Mock mode** — every AI function has a mock implementation
- **Modals** must use `DialogShell`; confirmations use `useConfirmDialog`; alerts use `useToast`
- **Entity colors/icons** derived from `ENTITY_TYPE_CONFIG` in `utils/entityUtils.ts`
- **Indigo** is reserved for `RealmChatWidget` only; all other accents use amber
- **`slate-*`** color tokens, not `stone-*`

### Testing

| Layer | Framework | Tests | Scope |
|-------|-----------|-------|-------|
| Unit + component | Vitest | 990 across 143 files | Services, storage/migration, linking engine, utilities, context builder, AI adapters, archetype scenarios, plus jsdom render tests (`@testing-library/react`) for editors, dialogs and hooks |
| E2E | Playwright | 114 per project × 2 projects (chromium, mobile-chrome); 2 permanently skipped + 4 runtime skip guards | Campaign lifecycle, entity CRUD, navigation, generators, dialogs, session runner, DM tools, visualizers, mobile, RealmChat |
| Smoke | Built-in (`smokeTest.ts`) | ~20 checks | Service availability + entity CRUD; **opt-in**, dev-only, requires `VITE_RUN_SMOKE_TESTS=true` |
| Mock | Built-in | Full app | Every AI function has a mock — all features work without API key or network |

CI (`.github/workflows/ci.yml`) runs typecheck → unit tests → build → Chromium E2E on push to
`main` and on every PR. The `mobile-chrome` E2E project is temporarily excluded there pending a
header/modal z-index fix.

---

## Project Status

**All 7 UX audit phases complete, plus the UX refactoring sprint, the Claude migration, and the
ship-readiness hardening pass.**

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
| Phase 7 (UX Conv. Cleanup) | Done | Button migration (219 usages, 29 files), sidebar drag-drop React state, all sections expanded by default, CrossCampaignDashboard search/filter, DM Style ARIA radiogroup, EntityCreationPanel viewport-relative sizing, BacklinksPanel count, universal language, article icon fix, wizard handoff, deleteAdventure cascade, AdventureEditor delete button, WelcomeScreen import wiring |
| Ship Readiness | Done | 124 findings across 13 work packages ([plan](docs/ship-readiness/remediation-plan.md)): storage backups + init recovery + autosave max-wait/unload flush + multi-tab conflict resolution, cascade/duplication reference purging, import validation warnings, AI provider env plumbing, linking/mention rewrite, app-shell and editor fixes, AI-proxy hardening (loopback peer check, Origin/Host allowlist, body/stdout caps, preview-server support), Tailwind moved from CDN to build-time, CI workflow, test suite 516 → 990 |

---

## License

Proprietary. All rights reserved. There is no separate `LICENSE` file — this section is the single
source of truth, and `package.json` records it as `"license": "UNLICENSED"`.

Included SRD material is separately licensed under CC-BY-4.0; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

