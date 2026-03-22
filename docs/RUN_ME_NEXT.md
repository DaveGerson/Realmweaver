# Run Me Next — Pickup Instructions

> **Last Updated:** 2026-03-21
> **Branch:** feat/testing-and-phase-b
> **Build:** Clean | **Tests:** 84 passing

---

## What Was Completed This Session

### Navigation Overhaul — Phase 1 + Phase 4a COMPLETE

Executed as an orchestrated chain (4 activities + gate). All delivered:

| Feature | What | Files |
|---------|------|-------|
| **Nav Back Stack** | Navigation history (max 20), Back button in Breadcrumbs, sidebar resets stack | App.tsx, Breadcrumbs.tsx, Icons.tsx |
| **Recent Items** | "Recent" section at top of sidebar, collapsible, max 5, type-colored icons | CampaignSidebar.tsx, App.tsx |
| **EntityLinks in Editors** | Hover tooltips + click-to-navigate for all entity reference fields across 8 editors | All editors/*.tsx |
| **LinkedText Auto-Linking** | Entity names in text fields auto-detected and rendered as clickable EntityLinks | LinkedText.tsx (NEW), 7 editors |
| **All 9 Entity Types** | QuickCard + EntityLink support: npc, location, faction, item, adventure, article, plot, session-log, player-character | EntityQuickCard.tsx, EntityLink.tsx |

Commits: `ad8e14d`, `6e110c0`, `5278278`

### Prior Sessions (Still Complete)
- Phase A + A2 universal fixes (all done)
- Phase B search & generation UX (B1-B6 all done)
- Agent roster overhaul, testing knowledge pack, 84 Vitest tests

---

## What To Do Next (In Order)

### 1. Execute Navigation Overhaul — Phase 2: "Make Scenes Playable"

```
Execute Phase 2 of the navigation overhaul from .claude/team-context/plan.md
```

Phase 2 delivers:
- **2a: Scene Resources Panel** — Inlines NPC traits/motivation/quotes and location secrets directly in SceneEditor for zero-click mid-session reference
- **2b: Sidebar Favorites** — Pin/unpin entities (star icon), persisted in campaign state, "Pinned" section in sidebar

### 2. Phase 3: "Complete the Web"

```
Execute Phase 3 of the navigation overhaul from .claude/team-context/plan.md
```

Phase 3 delivers:
- **3a: Backlinks Utility** — `computeBacklinks(entityId, campaign)` returns all entities that reference a given entity, grouped by type with relationship labels
- **3b: "Referenced By" Panel** — Collapsible section in all editors showing inbound connections

### 3. Phase 4b: Semantic Graph Labels (Optional)

Phase 4a (LinkedText auto-linking) is already complete. Remaining:
- **4b:** Semantic labels on relationship graph edges ("member-of", "controlled-by")

### 4. Remaining Phases (C through G)

After navigation overhaul, continue per `docs/IMPLEMENTATION_PLAN.md`:
1. Orchestrator executes full phase
2. You review completion report
3. Merge to main
4. Start next phase

---

## Key Commands

```bash
npm run dev      # Start dev server on localhost:3000
npm test         # Run all 84 Vitest tests
npm run build    # Production build (verify zero TS errors)
```

## Key Documents

| Document | Purpose |
|----------|---------|
| `.claude/team-context/plan.md` | **Navigation overhaul execution plan (4 phases, 10 steps)** |
| `.claude/team-context/context.md` | **Shared context for agent delegation (entity cross-ref map, patterns)** |
| `.claude/team-context/mission-log.md` | **Chain execution log with commits and status** |
| `docs/IMPLEMENTATION_PLAN.md` | Sequenced 7-phase plan with all work packages |
| `CLAUDE.md` | Codebase conventions (always read first) |
