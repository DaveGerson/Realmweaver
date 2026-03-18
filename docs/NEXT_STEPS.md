# Realmweaver — Next Steps

> **Last Updated:** 2026-03-18
> **Status:** Sprint 1 complete, archetype review complete, ready for Phase A implementation

---

## Where We Left Off

All Sprint 1 (Session Cockpit foundation) work is **merged, tested, and pushed to main**. The codebase is clean — no uncommitted changes, all 64 tests passing, production build succeeds.

### What Was Completed This Session

| Task | Status |
|------|--------|
| Claude Workplan added to `UX_OVERHAUL_PLAN.md` | Pushed |
| Sprint 1 agents (4 parallel): Dice Roller, Quick Tools, Running Log, Go Live Polish | Merged to main |
| Vitest setup + 64 unit tests (dice utils + campaign service) | Pushed |
| Code quality audit + fixes (encounter ID bug, responsive log, import cleanup) | Pushed |
| Header z-index fix (campaign dropdown behind sidebar) | Pushed |
| Winter's Daughter test campaign (8 NPCs, 7 locations, 5 items, 10 scenes, 2 plots, 2 articles) | Pushed |
| Empty screen bug fixes (plots/articles — wrong field names, missing migration) | Pushed |
| `docs/DM_ARCHETYPES.md` — 5 research-grounded DM personas | Pushed |
| `docs/SESSION_COCKPIT_ARCHETYPE_REVIEW.md` — 67 user stories, synthesis, implementation plan | Pushed |

---

## What To Do Next

### Immediate: Phase A — Universal Fixes (benefits all 5 archetypes)

These are the 7 highest-priority changes identified in the archetype review. They fix issues that **every** DM type would notice. See `docs/SESSION_COCKPIT_ARCHETYPE_REVIEW.md` → "Phase A: Universal Fixes" for full details.

1. **Persist plot progression** — Plot status cycling (advanced/stalled/unchanged) is currently LOCAL component state only. Lost on page refresh. Fix: save to `sessionLog` or `Plot` entity via `campaignService`.

2. **Merge dice rolls into running log** — Dice rolls are stored in `sessionLog.diceRolls[]` but never appear in the chronological `structuredNotes` timeline. Fix: when a roll is logged, also create a `SessionLogEntry` with `type: 'dice-roll'`.

3. **Add "Send to Notes" on DM Coach results** — Narration, improv, and table results from DM Coach require manual copy-paste. Fix: add a button that appends the result to `structuredNotes` with `type: 'coach-used'`.

4. **Quick NPC preview/edit before save** — Currently generates and immediately saves with no review. Fix: show a preview card with edit fields before committing.

5. **Skill check → dice roller integration** — Skill checks listed in scenes have no "Roll" button. Fix: add a quick-roll button next to each DC that pre-fills the dice roller formula.

6. **Combat tracker: real HP from NPC data** — Auto-populated combatants use hardcoded HP (NPCs=10, PCs=20). Fix: parse HP from NPC `stats` field or allow a default HP field on NPCs.

7. **Session end wizard** — Currently a 2-click confirmation with no debrief. Fix: build a multi-step end-session flow (AI recap → plot update → loose ends → player-facing export). See Sprint 3 Agent 3A in `UX_OVERHAUL_PLAN.md` for full spec.

### After Phase A: Phase B — Archetype-Gated Features

These features should be **optional/configurable** based on DM style. The review proposes a "DM Style" setting with three modes:

| Mode | Target Archetypes | Behavior |
|------|-------------------|----------|
| **Guided** | New DM | Tooltips, prep wizard, encounter warnings, AI suggestions on by default |
| **Standard** | Lazy DM, Worldbuilder, Forever DM | Clean interface, all tools available, no hand-holding |
| **Power** | Tactical DM, Worldbuilder | Full combat panel, stat blocks, encounter balance metrics |

Key Phase B features:
- Encounter difficulty indicators (Guided + Power modes)
- Secrets & clues tracker (Standard + Power modes)
- Entity quick-card popovers on hover (Standard + Power modes)
- Freeform "beats" mode as alternative to rigid scenes (Standard mode)
- Combat condition tracking panel (Power mode)
- Session timer (all modes, toggleable)
- Customizable note tags (Standard + Power modes)
- "What should I do?" AI suggestion button (Guided mode)

### Then: Phase C — Archetype-Specific Deep Features

See `docs/SESSION_COCKPIT_ARCHETYPE_REVIEW.md` → "Phase C" for the full list. Highlights:
- Worldbuilder: Inline lore surfacing, entity relationship badges in scene panel
- Lazy DM: Secrets/clues pool with reveal tracking, freeform scene beats
- New DM: Step-by-step prep wizard, encounter balance warnings, post-session learning prompts
- Tactical DM: Full-screen combat mode, stat block sidebar, condition tracker, encounter builder
- Forever DM: AI session recap automation, cross-campaign dashboard, continuity alerts

---

## Key Documents to Read

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Codebase conventions, architecture, patterns |
| `UX_OVERHAUL_PLAN.md` | Full product plan with Claude Workplan (agent orchestration blueprint for all 10 sprints) |
| `docs/DM_ARCHETYPES.md` | 5 DM personas with research basis, workflows, and needs |
| `docs/SESSION_COCKPIT_ARCHETYPE_REVIEW.md` | 67 user stories, CTQ elements, priority matrix, implementation phases |

## Key Test Commands

```bash
npm run dev          # Start dev server on localhost:3000
npm test             # Run all 64 Vitest tests
npm run build        # Production build (verify zero TS errors)
```

## Git State

```
Branch: main
Remote: origin/main (up to date)
Last commit: 6b2a547 — chore: Gitignore worktrees + defensive guard in legacy ArticleEditor
Working tree: clean
```

## To See Winter's Daughter Demo

Clear localStorage (or use incognito) and load `localhost:3000`. The app initializes with the full Winter's Daughter campaign — explore NPCs, locations, plots, lorebook articles, adventure scenes, and the Session Runner via the "Go Live" button on the session log.
