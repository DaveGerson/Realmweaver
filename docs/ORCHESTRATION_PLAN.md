# Realmweaver — Orchestration Implementation Plan

> **Created:** 2026-03-20
> **Purpose:** Defines how the orchestrator agent should execute each phase of `docs/IMPLEMENTATION_PLAN.md`
> **Execution style:** Phase-at-a-time — orchestrator completes a full phase, presents results, waits for user approval before starting next phase

---

## Pre-Execution Setup Checklist

Before the orchestrator begins Phase A, these items must exist:

### Already Complete
- [x] Agent roster tuned for project (12 active agents in `.claude/agents/`)
- [x] Knowledge packs: `.claude/knowledge/ttrpg/` (3 files)
- [x] Knowledge packs: `.claude/knowledge/gemini-ai/` (3 files)
- [x] Codebase profile: `.claude/team-context/codebase-profile.md`
- [x] Reference docs: `.claude/references/` (11 files)
- [x] Hooks: `.claude/settings.local.json`

### Needed Before Phase A
- [ ] **Update codebase profile** — Sprint 1 added significant code (DiceRoller, SessionRunner, CombatTracker, tests). The profile needs a freshness check.
- [ ] **Create phase context template** — A `.claude/team-context/phase-context-template.md` that the orchestrator fills out per phase with: goal, agents, shared decisions, file boundaries.
- [ ] **Verify test infrastructure** — Run `npm test` to confirm all 64 tests pass on current main.
- [ ] **Verify build** — Run `npm run build` to confirm clean baseline.
- [ ] **Update knowledge packs if stale** — Cross-check `.claude/knowledge/ttrpg/entity-model.md` against current `types/` directory (Sprint 1 may have added fields).

---

## Orchestrator Execution Protocol (Per Phase)

```
1. READ the implementation plan phase
2. READ all reference docs (mandatory — see orchestrator.md)
3. CHECK codebase profile freshness (research-procedures.md)
4. WRITE phase execution plan to .claude/team-context/plan.md
5. WRITE shared context to .claude/team-context/context.md
6. CREATE feature branch: feat/phase-{letter}-{short-description}
7. TRIAGE risk level (guardrail-presets.md)
   - Phase A-F: LOW risk (local features, no infra, no regulated data)
   - Phase G: MEDIUM risk (auth, cloud, data migration)
8. DELEGATE to agents (see phase-specific routing below)
9. After each agent: verify output, commit, update mission log
10. QA GATE: run build + tests + acceptance criteria
11. PRESENT completion report to user
12. WAIT for user approval before next phase
```

---

## Phase A: Universal Fixes — Orchestration Detail

### Risk Level: LOW
### Budget Tier: Standard (7 agents)
### Git Strategy: Commit-per-agent on single feature branch

### Agent Routing

| Work Package | Agent | Model | Parallel Group |
|---|---|---|---|
| A1: Persist plot progression | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| A2: Dice rolls in running log | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| A3: Coach "Send to Notes" | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| A4: Quick NPC preview | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| A5: Skill check → dice roller | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| A6: Combat HP from NPC data | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| A7: Session End Wizard | `frontend-engineer--realmweaver` | sonnet | Group 2 (after Group 1 — largest item, benefits from merged state) |

### Parallel Strategy
- **Group 1 (A1-A6):** All 6 are independent. Run in parallel using worktree isolation.
  - **Conflict risk:** A1, A2, A3 all touch `services/campaignService.ts`. Use worktrees and merge sequentially.
  - **Merge order:** A1 → A2 → A3 → A4 → A5 → A6 (ascending risk of conflict)
- **Group 2 (A7):** Sequential after Group 1. Session End Wizard is the largest item and touches many files. Run after all Group 1 merges are clean.

### Shared Context for Phase A Agents
```
Every agent receives:
- CLAUDE.md (project conventions)
- .claude/knowledge/ttrpg/entity-model.md (entity types and relationships)
- .claude/knowledge/gemini-ai/service-architecture.md (AI service layers)
- .claude/team-context/context.md (phase-specific shared context)
- docs/SESSION_COCKPIT_ARCHETYPE_REVIEW.md → Phase A section (the 7 fixes)

Agent-specific context:
- A7 also reads: docs/UX_OVERHAUL_PLAN.md → Agent 3A spec (Session End Wizard full spec)
```

### File Boundaries (prevent agent collisions)

| Agent | Writes To | Blocked From |
|---|---|---|
| A1 | `types/SessionLog.ts`, `services/campaignService.ts` (plot methods only), `SessionRunner.tsx` (plot section only) | Other sections of SessionRunner |
| A2 | `services/campaignService.ts` (dice log method only), `SessionRunner.tsx` (running log section only) | Other sections |
| A3 | `components/dialogs/DmCoach.tsx`, `services/campaignService.ts` (addAutoEvent only) | SessionRunner |
| A4 | `components/views/SessionRunner.tsx` (QuickNpc section only) | Other sections |
| A5 | `components/views/SessionRunner.tsx` (skill check section), `components/tools/DiceRoller.tsx` | Other sections |
| A6 | `components/tools/CombatTracker.tsx`, `types/NPC.ts`, `types/PlayerCharacter.ts` | SessionRunner |
| A7 | New file `components/dialogs/SessionEndWizard.tsx`, `services/geminiService.ts`, `services/ai/dmCoach.ts`, `services/ai/mockService.ts`, `SessionRunner.tsx` (end session handler) | Everything else |

### QA Gate
```bash
npm run build    # Zero TS errors
npm test         # All tests pass (existing + new)
```
Manual verification:
- [ ] Plot status persists across page refresh
- [ ] Dice rolls appear inline in running log
- [ ] DM Coach has "Send to Notes" button that works
- [ ] Quick NPC shows preview card before saving
- [ ] Skill checks have roll buttons linked to dice roller
- [ ] Combat HP reflects NPC data (not hardcoded 10/20)
- [ ] Session End Wizard works end-to-end in mock mode

---

## Phase A2: No-Regrets UI Foundation — Orchestration Detail

### Risk Level: LOW
### Budget Tier: Standard (6 agents)
### Git Strategy: Commit-per-agent on single feature branch

### Agent Routing

| Work Package | Agent | Model | Parallel Group |
|---|---|---|---|
| A2-1: Entity type color borders | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| A2-2: Amber primary / Indigo for AI | `frontend-engineer--realmweaver` | sonnet | Group 2 (after A2-1 — both touch color classes) |
| A2-3: Better empty states | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| A2-4: Sidebar search/filter | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| A2-5: Loading skeletons | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| A2-6: Breadcrumbs | `frontend-engineer--realmweaver` | sonnet | Group 1 |

### Parallel Strategy
- **Group 1 (A2-1, A2-3, A2-4, A2-5, A2-6):** Run in parallel with worktree isolation. Minimal overlap — different files.
- **Group 2 (A2-2):** Sequential after Group 1. The amber/indigo palette swap touches many of the same files as A2-1 (entity colors). Merge A2-1 first, then A2-2 works on the merged state.

### Conflict Hotspots
- `CampaignSidebar.tsx` — A2-1 (entity colors), A2-2 (amber active states), A2-4 (search filter) all touch this. Merge order: A2-4 → A2-1 → A2-2.
- Dashboard components — A2-1 (color borders), A2-3 (empty states), A2-5 (skeletons) all touch dashboards. Use worktrees; merge sequentially.

### Shared Context for Phase A2 Agents
```
Every agent receives:
- CLAUDE.md (project conventions)
- UI_DESIGN_EVALUATION.md (source design rationale)
- docs/IMPLEMENTATION_PLAN.md → Phase A2 section
- .claude/team-context/context.md (phase-specific shared context)

Key instruction for A2-2 (amber/indigo):
- Amber classes: bg-amber-600, hover:bg-amber-500, text-amber-400, border-amber-500, ring-amber-500
- Indigo classes (AI only): bg-indigo-600, hover:bg-indigo-500, text-indigo-400
- Systematically replace indigo with amber for non-AI elements
- Add sparkle/wand icon to AI-specific buttons to reinforce the distinction
```

---

## Phase B: Search & Generation — Orchestration Detail

### Risk Level: LOW
### Budget Tier: Standard (6 agents)
### Git Strategy: Commit-per-agent

### Agent Routing

| Work Package | Agent | Model | Parallel Group |
|---|---|---|---|
| B1: Command Palette | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| B2: Generate Here buttons | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| B3: Chat as default creation | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| B4: Entity Quick Cards | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| B5: Inline field regen | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| B6: @Mention referencing | `frontend-engineer--realmweaver` | sonnet | Group 2 (after B4 — builds on entity card components) |

### Conflict Hotspots
- `App.tsx` — B1 (keyboard listener) and B3 (dashboard routing) both touch this. Merge B1 first.
- Editor components — B2 (Generate Here) and B5 (field regen) both add buttons to editors. Non-overlapping sections but same files. Use worktrees.

---

## Phase C: Session Intelligence — Orchestration Detail

### Risk Level: LOW
### Budget Tier: Standard (7 agents)
### Git Strategy: Commit-per-agent

### Agent Routing

| Work Package | Agent | Model | Parallel Group |
|---|---|---|---|
| C1: Session Prep Wizard | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| C2: Auto-capture events | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| C3: Voice in Session Runner | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| C4: Coach template prompts | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| C5: Bullet-point beats | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| C6: Secrets & clues tracker | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| C7: NPC Roleplay Sim | `frontend-engineer--realmweaver` | sonnet | Group 2 (needs AI service changes from earlier merges) |

### Domain Context Required
- C7 (NPC Roleplay): Invoke `subject-matter-expert--ttrpg` to review the roleplay prompt design — what makes a good NPC voice? What context does the AI need to stay in-character? This is a 15-minute review, not a full consultation.

---

## Phase D: World Coherence — Orchestration Detail

### Risk Level: LOW
### Budget Tier: Standard (5 agents)
### Git Strategy: Commit-per-agent

### Agent Routing

| Work Package | Agent | Model | Parallel Group |
|---|---|---|---|
| D1: Smart Context Window | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| D2: Plot Timeline | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| D3: Continuity Checker | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| D4: Wiki Cross-Linking | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| D5: Relationship Intelligence | `frontend-engineer--realmweaver` | sonnet | Group 2 (after D1 — uses new context builder) |

### Special Considerations
- **D1 (Smart Context Window) is foundational.** It replaces the ad-hoc `currentContext` useMemo in App.tsx. Merge D1 FIRST, then all other agents work with the new context builder.
- **D2 (Plot Timeline)** may benefit from `visualization-expert` review of the D3/timeline design before implementation. Quick consultation, not a full delegation.
- **D3 (Continuity Checker)** should consult `subject-matter-expert--ttrpg` for domain rules (what constitutes a "continuity error" in TTRPG terms).

---

## Phase E: Visual Polish & Mobile — Orchestration Detail

### Risk Level: LOW
### Budget Tier: Standard (6 agents)
### Git Strategy: Commit-per-agent

### Agent Routing

| Work Package | Agent | Model | Parallel Group |
|---|---|---|---|
| E1: Rich dashboard cards | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| E2: Tabbed editor layouts | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| E3: Keyboard shortcuts | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| E4: Visual polish | `frontend-engineer--realmweaver` | sonnet | Group 1 |
| E5: Mobile responsiveness | `frontend-engineer--realmweaver` | sonnet | Group 2 (after Group 1 — touches ALL components) |
| E6: DM Style disclosure | `frontend-engineer--realmweaver` | sonnet | Group 3 (after E5 — builds on responsive layout) |

### Special Considerations
- **E5 (Mobile) is the largest item in this phase.** It touches nearly every component. Run AFTER all other Phase E agents have merged to avoid massive conflicts.
- **E6 (DM Style) depends on E5.** The progressive disclosure system needs to work on mobile layouts.
- Consider `code-reviewer` after Phase E merges — this phase has the highest risk of visual regressions.

---

## Phase F: Growth & Advanced AI — Orchestration Detail

### Risk Level: LOW
### Budget Tier: Standard (5 agents)
### Git Strategy: Commit-per-agent

### Agent Routing

| Work Package | Agent | Model | Notes |
|---|---|---|---|
| F1: Campaign Wizard | `frontend-engineer--realmweaver` | sonnet | Parallel with F2 |
| F2: Templates | `frontend-engineer--realmweaver` | sonnet | Parallel with F1 |
| F3: World Simulation | `frontend-engineer--realmweaver` | sonnet | Parallel with F4 |
| F4: Style Matching | `frontend-engineer--realmweaver` | sonnet | Parallel with F3 |
| F5: Cross-campaign | `frontend-engineer--realmweaver` | sonnet | After F1-F4 (touches App.tsx routing) |

### Domain Context Required
- F3 (World Simulation): Invoke `subject-matter-expert--ttrpg` to review the simulation prompt — what kinds of between-session events are plausible? What faction behaviors make sense? This is critical for output quality.
- F4 (Style Matching): `architect` consultation for the style analysis approach — embeddings? Prompt engineering? Example-based few-shot?

---

## Phase G: Cloud — Orchestration Detail

> **Deferred.** This phase is 3-4 months out. Planning will happen closer to execution.
> Risk level will be MEDIUM+ (auth, cloud infra, data migration).
> Will require `architect` for cloud architecture planning.
> Will require `auditor` for pre-execution review of auth and data handling.

---

## Cross-Phase Guidelines

### Testing Strategy
- Every agent that modifies `campaignService.ts` must add or update Vitest tests
- Every new AI service function must have a mock implementation in `mockService.ts`
- QA gate at every phase boundary: `npm run build && npm test`
- Manual smoke test in mock mode for UI features

### Responsive Design Enforcement
- Include in EVERY delegation prompt: "All new UI must be responsive. Test at 375px (iPhone), 585px (Galaxy Fold open), 768px (tablet), 1024px+ (desktop). Touch targets min 44px."
- `code-reviewer` should flag non-responsive components

### Commit Message Convention
```
[agent-role]: [imperative summary, 50 chars max]

[body: what was done and key decisions]

Orchestrated-by: orchestrator
Agent: frontend-engineer--realmweaver
Phase: [A|B|C|D|E|F|G]
Work-package: [A1|B2|etc]
```

### Session Recovery
If a session is interrupted mid-phase:
1. Read `.claude/team-context/mission-log.md` for what completed
2. Read `.claude/team-context/plan.md` for the full plan
3. Check `git log` on the feature branch for committed work
4. Resume from the first incomplete work package

### When to Use Non-Default Agents

| Situation | Agent | When |
|---|---|---|
| Domain validation needed | `subject-matter-expert--ttrpg` | NPC roleplay prompts (C7), world simulation rules (F3), continuity checker rules (D3) |
| Visualization design review | `visualization-expert` | Plot timeline (D2), relationship graph updates |
| Architecture decisions | `architect` | Smart context window design (D1), style matching approach (F4), cloud architecture (G) |
| Final quality pass | `code-reviewer` | After each phase, before presenting to user |
| Security review | `security-reviewer` | Phase G only (auth, API keys, cloud data) |
| Risk review | `auditor` | Phase G only (MEDIUM+ risk) |

---

## Phase Completion Report Template

After each phase, the orchestrator presents:

```markdown
## Phase [X] Completion Report

**Branch:** feat/phase-{x}-{description}
**Commit count:** N
**Tests:** X passing (Y new)
**Build:** Clean

### Delivered
- [x] Work package 1: summary
- [x] Work package 2: summary
...

### Key Decisions Made
- Decision 1: rationale
...

### Known Limitations
- Limitation 1: planned resolution
...

### QA Gate Results
- Build: PASS
- Tests: PASS (N new tests)
- Manual verification: [details]

### Ready for Review
The branch is ready for your review. Approve to merge to main and start Phase [X+1].
```
