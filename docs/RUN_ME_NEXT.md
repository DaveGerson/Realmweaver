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

### 1. E2E Test Coverage Expansion

The Playwright E2E infrastructure is set up but only has 5 smoke tests. Before adding new features, expand test coverage for everything that was built:

```
Use the e2e-test-engineer agent to write comprehensive E2E tests covering:
- Campaign creation flow with DM Style selector
- Entity CRUD (create NPC, edit, delete)
- Navigation: EntityLinks, back stack, recent items, pinning
- Session Prep Wizard → Session Runner → Session End flow
- DM Coach with all 4 modes (narrate, improvise, table, roleplay)
- Secrets & Clues tracker
- Continuity Checker
- Mobile responsiveness (run against mobile-chrome project)
- Keyboard shortcuts
```

### 2. Code Review Pass

Run a code review across all Phase C-E changes. Focus on:
- Performance with large campaigns (100+ entities)
- Accessibility (ARIA labels, keyboard navigation, screen readers)
- Consistency (naming conventions, icon usage, color palette)
- Edge cases (empty campaigns, deleted entity references)

```
Use the code-reviewer agent to review all changes since Phase B
```

### 3. Phase F: Growth & Advanced AI

```
Execute Phase F from docs/IMPLEMENTATION_PLAN.md
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

Requires architectural planning before implementation:
- Cloud provider evaluation (Supabase vs Firebase)
- Database schema design + offline-first sync strategy
- Auth flow, localStorage migration
- Player Portal (read-only), GM Secrets, Interactive World Map

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
| `docs/IMPLEMENTATION_PLAN.md` | Master plan — Phases A-G with all work packages |
| `CLAUDE.md` | Codebase conventions (always read first) |
| `.claude/agents/e2e-test-engineer.md` | Playwright E2E test agent definition |
| `.claude/agents/browser-simulator.md` | Browser user simulation agent definition |
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
