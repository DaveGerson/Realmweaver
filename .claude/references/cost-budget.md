# Cost & Context Budget

The orchestrator uses this to right-size agent selection and avoid burning
through rate limits or token budgets unnecessarily.

---

## Token Cost Model

| Agent Model | Approximate Cost per Subagent Session | Best For |
|-------------|--------------------------------------|----------|
| **Opus** | Highest — deep reasoning, large context use | Architecture, auditing, domain expertise, complex analysis |
| **Sonnet** | Moderate — strong balance of quality and speed | Implementation, testing, data work, reviews |
| **Haiku** | Lowest — fast, cheap, good for simple tasks | Linting, formatting, simple lookups, quick checks |

**Multiplier effect:** Each subagent uses roughly **4-7x** the tokens of
doing the same work in a single agent session. This comes from:
- Each agent reads the shared context independently (~1x overhead per agent)
- Each agent explores/reads files independently (no shared file cache)
- Summarization back to the orchestrator adds output tokens

**Rate limits:** On Claude Max plans, sustained multi-agent work (5+ parallel
Opus agents) can hit rate limits within 15-20 minutes. Plan for this.

---

## Model Selection Guide

**Default to Sonnet** for implementation agents. Only upgrade to Opus when:

| Upgrade Signal | Why Opus Helps |
|---------------|---------------|
| Complex architectural reasoning across multiple systems | Opus handles long-chain reasoning better |
| Security review requiring subtle vulnerability detection | Nuanced pattern recognition |
| Domain expertise requiring regulatory interpretation | Opus is better at reasoning about edge cases in rules |
| Tasks where getting it wrong has high consequences | Worth the cost for higher accuracy |

**Downgrade to Haiku** when:

| Downgrade Signal | Why Haiku Is Enough |
|-----------------|-------------------|
| Simple file transformation or formatting | Mechanical task, no reasoning needed |
| Running a linting pass | Following rules, not making judgments |
| Quick file searches or inventories | Read-only lookup |
| Generating boilerplate from a clear template | Pattern replication |

## Budget Tiers

The orchestrator should assess the task's budget tier before planning:

### Tier: Lean (1-2 subagents)

Use for focused tasks that touch one domain.

Examples: "Add a new API endpoint", "Write tests for this module",
"Review this PR for security issues"

Typical team: 1 implementation agent + 1 reviewer

### Tier: Standard (3-5 subagents)

Use for multi-domain tasks that need several specialists.

Examples: "Build a feature with frontend + backend + tests",
"Migrate this service to a new framework", "Build a dashboard with
data pipeline and visualization"

Typical team: 2-3 implementation agents + 1 reviewer + SME or auditor
as needed

### Tier: Full (6-8 subagents, use sparingly)

Use only for large, cross-cutting work where skipping agents would cause
real quality loss.

Examples: "Build an entire new subsystem with API, UI, tests, docs,
and deployment", "Major compliance-critical feature requiring SME +
auditor + multiple implementation agents"

**Warning:** At this tier, the orchestrator's own context will be
strained from managing handoffs. Consider:
- Splitting into two sequential orchestrator sessions
- Writing intermediate results to disk (mission log, shared context)
- Setting `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=80`

### Tier: Over Budget (9+ subagents)

**Don't do this.** Split the task into two or more orchestrator sessions
with a handoff document between them.

---

## Cost Optimization Tactics

### 1. Share research, don't repeat it

The shared context doc (`.claude/team-context/context.md`) exists so that
each agent doesn't independently explore the codebase. If the orchestrator
did thorough research in Phase 1, every agent benefits.

**Anti-pattern:** Skipping research, then each of 5 agents spends tokens
reading the same files independently.

### 2. Use the base agent when flavors don't matter

If the task is simple and doesn't exercise framework-specific patterns,
the base agent is fine. Don't spin up `backend-engineer--node` for a task
that's just "add a utility function" — the generic `backend-engineer` or
even inline work by the orchestrator may suffice.

### 3. Batch related work into fewer agents

If two work packages are in the same domain, same files, and sequential
— consider combining them into one agent delegation. The overhead of
context switching between two agents may exceed the overhead of a slightly
larger single delegation.

**But don't over-batch.** If combining makes the delegation prompt vague
or the scope too large, keep them separate.

### 4. Skip the auditor on LOW risk

This is already in the design (auditor's dual nature), but worth
reiterating: the orchestrator handles LOW-risk guardrails inline. Don't
invoke the auditor subagent for trivial tasks — it costs a full Opus
context window.

### 5. Use read-only agents as Haiku when possible

Agents that only read (architect in review mode, code-reviewer on a small
change) can often be run on Haiku with no quality loss. The orchestrator
can override the model in the delegation prompt:

```
Use the code-reviewer agent with model: haiku for this small change.
```

Note: This only works if the agent's frontmatter doesn't hardcode the
model, or if the orchestrator spawns it with an explicit model override.

---

## Context Window Management

The orchestrator holds the most state: research findings, agent outputs,
mission log updates, handoff briefs. On complex tasks it will fill up.

**Preventive measures:**
- Set `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=80` (triggers compaction earlier)
- Write the mission log to disk, don't hold it in context
- Keep handoff briefs concise (the templates in comms-protocols help)
- After each agent completes, discard the raw output and keep only the
  summary — the full output is in the agent's committed files

**If the orchestrator hits compaction mid-task:**
- The mission log on disk preserves what happened
- The shared context doc preserves project knowledge
- The execution plan (if written to disk) preserves what's left to do
- Post-compaction, re-read these files to recover state

**Recommendation:** For Standard+ tier tasks, write the execution plan
to `.claude/team-context/plan.md` at the start. This survives compaction.
