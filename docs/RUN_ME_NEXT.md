# Run Me Next — Pickup Instructions

> **Last Updated:** 2026-03-22
> **Branch:** main (clean)
> **Build:** Clean (2356 modules) | **Unit Tests:** 97 passing | **E2E Tests:** 5 passing

---

## What Was Completed (Phases A through E — ALL DONE)

### This Session (2026-03-22) — 38 commits, 14,837 lines added

| Phase | What Was Delivered |
|-------|-------------------|
| **Nav Overhaul 1-4** | Back stack, EntityLinks in all editors, LinkedText auto-linking, recent items, scene tooltips, expandable/editable QuickCard, tooltip hover fix |
| **Phase 2** | Scene Resources Panel (inlined NPC/location in SceneEditor), Sidebar Favorites with pin/unpin |
| **Phase 3** | Backlinks utility (`computeBacklinks`), "Referenced By" panels in 7 editors |
| **Phase 4** | LinkedText auto-linking, Semantic graph edge labels |
| **Phase C** | Session Prep Wizard, Event Auto-Capture, Voice Input, DM Coach Template Prompts, Beats Mode, Secrets & Clues Tracker, NPC Roleplay Simulator |
| **Phase D** | Smart Context Builder (tiered), Plot Timeline, Continuity Checker (8 rules), Relationship Intelligence in SessionRunner |
| **Phase E** | Rich Dashboard Cards, Tabbed Editor Layouts, Keyboard Shortcuts, Dark Fantasy Visual Polish, Mobile Responsiveness, DM Style Progressive Disclosure |
| **Infra** | Playwright E2E testing (5 smoke tests), MCP browser tools, e2e-test-engineer + browser-simulator agents |

### Prior Sessions (Still Complete)
- Phase A + A2 universal fixes
- Phase B search & generation UX (B1-B6)
- Agent roster, testing knowledge pack, Vitest infrastructure

---

## What To Do Next (In Order)

Each item has a detailed execution plan. Say the command shown to begin.

### 1. E2E Test Coverage Expansion

**Plan:** [`docs/PLAN_E2E_TESTING.md`](PLAN_E2E_TESTING.md) — 8 test suites, 60+ tests, shared helpers

```
Execute the E2E test plan from docs/PLAN_E2E_TESTING.md
```

- 8 suites: Campaign, Entity CRUD, Navigation, Session Runner, DM Tools, Editors, Mobile, DM Style
- Suites 1-3 first (foundational), then 4-6 (features), then 7-8 (polish)
- Shared helpers in `e2e/helpers.ts` for campaign creation, mock mode, navigation

### 2. Code Review Pass

**Plan:** [`docs/PLAN_CODE_REVIEW.md`](PLAN_CODE_REVIEW.md) — 4 parallel review tracks

```
Execute the code review plan from docs/PLAN_CODE_REVIEW.md
```

- Track A: Performance (100+ entity scaling, render perf, useMemo audits)
- Track B: Accessibility (ARIA, keyboard nav, focus management, touch targets)
- Track C: Security (XSS, injection, localStorage limits, import validation)
- Track D: Architecture (pattern consistency, dead code, decomposition candidates)

### 3. Phase F: Growth & Advanced AI

**Plan:** [`docs/PLAN_PHASE_F.md`](PLAN_PHASE_F.md) — 5 features, 3 gates

```
Execute Phase F from docs/PLAN_PHASE_F.md
```

Phase F delivers 5 features (4 parallel + 1 sequential):

| Item | What | Effort |
|------|------|--------|
| **F1: First Campaign Wizard** | Conversational onboarding: "Tell me about your world" → AI generates starter content | Medium |
| **F2: Template Campaigns** | Pre-built starters: Classic Dungeon Crawl, Political Intrigue, Sandbox, One-Shot | Medium |
| **F3: World Simulation Engine** | AI generates between-session events based on faction goals and NPC motivations | Large |
| **F4: Content Style Matching** | AI learns DM's writing voice from existing entities, applies to all generation | Large |
| **F5: Cross-Campaign Dashboard** | Top-level view of all campaigns with quick-switch, entity copy, pending loose ends | Large |

### 4. Phase G: Cloud & Collaboration (Future)

**Plan:** [`docs/PLAN_PHASE_G.md`](PLAN_PHASE_G.md) — 8 steps, architecture decisions required first

```
Execute Phase G architecture planning from docs/PLAN_PHASE_G.md
```

**REQUIRES USER INPUT BEFORE STARTING** — 7 open design questions in the plan:
1. Cloud provider (Supabase recommended)
2. Offline support priority
3. OAuth providers (Discord + Google recommended)
4. Self-hosting requirement
5. Player sharing scope
6. Budget constraints
7. World map priority

---

## Known Issues / Follow-ups

- **FAB overlap with RealmChat**: The mobile floating action button and RealmChat widget may overlap at bottom-right — needs visual check
- **BacklinksPanel in guided mode**: `isFeatureVisible('backlinks-panel')` infrastructure is in place but not yet wired into all editor components (editors would need dmStyle prop threading)
- **Stale pinned entities**: Pinned items for deleted entities are silently hidden but not auto-cleaned from the array
- **Article content truncation**: Expanded QuickCard edits only the first 500 chars of article content

---

## Key Commands

```bash
npm run dev           # Start dev server on localhost:3000
npm test              # Run all 97 Vitest unit tests
npm run test:e2e      # Run 5 Playwright E2E tests (headless)
npm run test:e2e:headed  # Run E2E tests with visible browser
npm run build         # Production build (verify zero TS errors)
```

## Key Documents

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Codebase conventions (always read first) |
| `docs/IMPLEMENTATION_PLAN.md` | Master plan — Phases A-G with all work packages |
| **`docs/PLAN_E2E_TESTING.md`** | **E2E test expansion plan — 8 suites, 60+ tests** |
| **`docs/PLAN_CODE_REVIEW.md`** | **Code review plan — 4 parallel tracks (perf, a11y, security, arch)** |
| **`docs/PLAN_PHASE_F.md`** | **Phase F execution plan — 5 features, 3 gates** |
| **`docs/PLAN_PHASE_G.md`** | **Phase G execution plan — cloud, auth, sync, sharing, maps** |
| `playwright.config.ts` | E2E test configuration (chromium + mobile-chrome) |

## Available Agents

| Agent | Use For |
|-------|---------|
| `e2e-test-engineer` | Writing Playwright browser tests for user workflow validation |
| `browser-simulator` | Headless browser navigation, screenshots, visual verification |
| `frontend-engineer--realmweaver` | All Realmweaver implementation tasks |
| `test-engineer` | Unit/integration tests with Vitest |
| `code-reviewer` | Code quality, consistency, performance review |
| `visualization-expert` | D3/React Flow graph work |
| `subject-matter-expert--ttrpg` | TTRPG domain knowledge validation |
