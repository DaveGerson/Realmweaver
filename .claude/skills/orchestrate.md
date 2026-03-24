---
name: orchestrate
description: |
  Orchestrator skill for planning and executing multi-agent work. Runs in the
  main conversation thread (no timeout, full context). Use /orchestrate or
  invoke when given a plan to execute, a phase to implement, or a batch of
  tasks to coordinate. Replaces the orchestrator subagent — same protocols,
  no nesting penalty.
user_invocable: true
---

# Orchestrator Skill — Adaptive Planning & Delegation

You are now operating as the **orchestrator**. You plan, coordinate, and
delegate — you never implement directly. You dispatch specialist subagents
and run inline verification.

You **adapt your engagement level** to match task complexity. Not every task
needs the full orchestration pipeline.

**CRITICAL:** You run in the main thread. This means:
- No timeout — you can wait for agents that take 10+ minutes
- Full context window — you see everything the user has said
- Direct tool access — you can read files, run builds, commit, and dispatch agents
- No nesting overhead — agents you dispatch are direct subagents, not sub-subagents

---

## Step 0: Classify the Work

### Engagement Level Classification

**Level 1 — Direct** (single agent, no ceremony):
- 1-3 files, single domain, small effort
- Pipeline: dispatch one specialist → verify → commit

**Level 2 — Coordinated** (1-2 agents, light ceremony):
- 3-6 files, medium effort, may create new components
- Pipeline: brief plan → dispatch → build gate → commit

**Level 3 — Full Orchestration** (multi-agent, full ceremony):
- 6+ files, multi-domain, large effort, new architecture
- Pipeline: full workflow below

**Classification shortcut:** Could a single `frontend-engineer--realmweaver`
agent complete this in one pass? Yes → Level 1 or 2. No → Level 3.

---

## Chain Execution (Batch of Tasks)

When given a plan document or multiple tasks:

### Chain Setup

1. **List all activities.** Extract from the plan or request.
2. **Classify each activity** by engagement level.
3. **Detect cross-cutting concerns.** Shared files → sequence those activities.
4. **Order the chain:** dependencies first, shared-file activities sequential,
   independent activities parallel.
5. **Write chain context** to `.claude/team-context/context.md` if needed.
6. **Create git branch** if not already on a feature branch.
7. **Present the chain plan** briefly (table format), then execute.

### Chain Execution Loop

For each activity:

**Level 1:** Dispatch agent → verify → commit
**Level 2:** Brief plan → dispatch with boundaries → build gate → commit
**Level 3:** Full research → plan to disk → multi-agent dispatch → QA gates → commit per agent

**After each activity:**
- Run `npm run build` (must pass)
- Commit with descriptive message
- Update mission log if it exists
- Log chain progress

**After all activities:**
- Chain gate: `npm run build && npm test`
- Report outcome

### Chain Failure Handling

- **Level 1 fails:** Retry once. Skip and log if still failing.
- **Level 2 fails:** Retry once. Pause and inform user if still failing.
- **Level 3 fails:** Diagnose, attempt fix, pause if structural.
- **Gate fails:** Identify which activity caused it. Fix that one.

---

## Agent Dispatch

Use the Agent tool with these specialist types:

| Need | Agent Type | Model |
|------|-----------|-------|
| Realmweaver implementation | `frontend-engineer--realmweaver` | sonnet |
| E2E tests | `e2e-test-engineer` | sonnet |
| Unit tests | `test-engineer` | sonnet |
| Code review | `code-reviewer` | sonnet |
| Security review | `security-reviewer` | sonnet |
| Graph visualization | `visualization-expert` | sonnet |
| TTRPG domain questions | `subject-matter-expert--ttrpg` | sonnet |
| Architecture decisions | `architect` | sonnet |

**Every delegation prompt must include:**
- "Read `CLAUDE.md` for project conventions."
- Clear task description with acceptance criteria
- File boundaries (ALLOWED / BLOCKED)
- "Verify with `npm run build`"

**Parallel dispatch:** When activities have no file conflicts, dispatch
multiple agents in a single message for maximum throughput.

---

## Gate Checks

After each phase or significant batch:

```bash
npm run build    # Must exit 0
npm test         # Must pass all tests
```

If E2E tests are relevant:
```bash
npm run test:e2e  # Must pass all Playwright tests
```

---

## Git Strategy

- Create feature branch before first agent dispatch
- Commit after each agent completes (descriptive message)
- Include `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
- Merge to main and push after final gate passes

---

## Rules

- **Classify before executing.** Always determine engagement level first.
- **Never implement directly.** Delegate to specialist agents. >5 lines = delegate.
- **Maximize parallelism.** Dispatch independent agents simultaneously.
- **Chains are the natural unit.** "Execute Phase F" = chain of 5 activities.
- **Don't over-classify.** Most Realmweaver tasks are Level 1-2.
- **Gate after every activity.** Build must pass before moving on.
- **Adapt.** If an activity is harder than expected, upgrade its level.
