# Run Me Next — Pickup Instructions

> **Last Updated:** 2026-03-20
> **Branch:** main (clean, pushed)
> **Build:** Clean | **Tests:** 64 passing

---

## What Was Completed This Session

### Agent Roster Overhaul
- 9 irrelevant agents archived, 2 new agents created (frontend-engineer--realmweaver, subject-matter-expert--ttrpg)
- 6 existing agents tuned for Realmweaver, 2 knowledge packs created (TTRPG + Gemini AI)
- Orchestrator IP removed from git (kept locally, gitignored)

### Phase A: Universal Fixes (COMPLETE)
- A4: Quick NPC preview/edit before save
- A5: Skill check → dice roller integration
- A6: Combat tracker real HP from NPC/PC data
- A7: Session End Wizard (5-step: AI recap → plots → loose ends → player recap → confirm)
- (A1-A3 were already done in Sprint 1)

### Phase A2: No-Regrets UI Foundation (COMPLETE)
- Entity type color borders (9 entity types, distinct colors)
- Amber primary / Indigo for AI accent split (28 files)
- Better empty states with flavor text (7 dashboards)
- Sidebar search/filter
- Loading skeletons for AI generation
- Breadcrumb navigation

### Planning Documents Created
- `docs/IMPLEMENTATION_PLAN.md` — 7-phase sequenced plan (A through G)
- `docs/ORCHESTRATION_PLAN.md` — Per-phase orchestrator execution detail

---

## What To Do Next (In Order)

### 1. Functional Testing Setup (Before Phase B)

Create a testing knowledge pack and write archetype-based functional tests. Say:

```
Create a functional testing knowledge pack and write Vitest tests that simulate
DM archetype workflows through campaignService. Use the subject-matter-expert--ttrpg
to define realistic scenarios (prep a session, run combat, improvise an NPC,
end a session with recap) and the test-engineer to implement them.
Each test persona should represent one of the 5 DM archetypes.
```

### 2. Phase B: Search & Generation UX

After testing is set up, say:

```
Use the orchestrator to execute Phase B from docs/IMPLEMENTATION_PLAN.md
and docs/ORCHESTRATION_PLAN.md
```

Phase B delivers:
- B1: Global Search / Command Palette (Cmd+K)
- B2: Contextual "Generate Here" buttons
- B3: Conversational generation as default
- B4: Quick Entity Card popovers
- B5: Inline field regeneration
- B6: @Mention entity referencing

### 3. Phases C through G

Continue phase-at-a-time execution per `docs/IMPLEMENTATION_PLAN.md`. Each phase:
1. Orchestrator executes full phase
2. You review completion report
3. Merge to main
4. Start next phase

---

## Key Commands

```bash
npm run dev      # Start dev server on localhost:3000
npm test         # Run all 64 Vitest tests
npm run build    # Production build (verify zero TS errors)
```

## Key Documents

| Document | Purpose |
|----------|---------|
| `docs/IMPLEMENTATION_PLAN.md` | Sequenced 7-phase plan with all work packages |
| `docs/ORCHESTRATION_PLAN.md` | How the orchestrator executes each phase |
| `docs/DM_ARCHETYPES.md` | 5 DM personas driving feature prioritization |
| `docs/SESSION_COCKPIT_ARCHETYPE_REVIEW.md` | 67 user stories and priority matrix |
| `UI_DESIGN_EVALUATION.md` | UI audit + 4 design proposals |
| `CLAUDE.md` | Codebase conventions (always read first) |
