---
name: orchestration-framework
description: |
  Architectural decision framework for multi-agent orchestration. Read this
  FIRST when building or modifying the agent team. It defines when to use a
  subagent vs a skill vs a process step, how to assess cost/benefit of
  spinning up a new context window, and the guiding principles for the
  entire system. The orchestrator reads this before every planning session.
  Also use when someone asks "should this be an agent?" or wants to
  understand the system architecture.
---

# Orchestration Framework — Decision Architecture

This document defines the guiding principles for the orchestration system.
Every design decision — whether something is a subagent, a skill, or a
process step — traces back to these principles.

---

## Core Principle: Pay for Context Only When You Need Isolation

A subagent costs:
- A full context window (~200K tokens of capacity)
- Startup latency (reads files, orients itself)
- Information loss (output is summarized back to the parent — detail is lost)
- Token spend (4-7x multiplier over single-agent work)

These costs are justified **only** when the benefits of isolation outweigh them.

---

## The Decision Framework

When deciding how to implement a capability, apply these tests **in order**:

### Test 1: Does this produce substantial, independent work product?

**Yes** → Likely a **subagent**. Writing 50+ lines of code, producing a
detailed analysis, building a data model — these are jobs that need space
to think and work.

**No** → Move to Test 2.

*Examples: A backend engineer writing API routes = subagent. Detecting
which tech stack the project uses = not a subagent.*

### Test 2: Does this need to be independent from the caller?

**Yes** → **Subagent**. The auditor MUST be independent from the orchestrator
so it can overrule unsafe plans. A security reviewer must assess without
being primed by the developer's assumptions.

**No** → Move to Test 3.

*Examples: Auditor reviewing orchestrator's plan = subagent (independence
matters). Orchestrator reading the codebase structure = not a subagent
(the orchestrator needs this context directly).*

### Test 3: Does the caller need the full detail of the output?

**Yes** → **Skill or inline process** (runs in the caller's context, no
summarization loss). Research findings, stack detection results, and
communication protocols are most useful when they stay in the orchestrator's
context with full fidelity.

**No** → **Subagent** (summary is sufficient). A code reviewer's verdict
doesn't need to preserve every line it read — just the findings.

### Test 4: Is this a procedure (follow these steps) or judgment (think about this)?

**Procedure** → **Skill or process step**. Stack detection, handoff
templates, mission logging, guardrail checklists — these are repeatable
procedures with predictable steps.

**Judgment** → **Subagent**. Architecture decisions, security analysis,
domain validation — these require focused reasoning.

### Test 5: Do multiple agents need this, or just one?

**Multiple** → **Reference document** (shared file agents can read).
Guardrail presets are used by both the orchestrator (for inline risk triage)
and the auditor (for formal review). Comms templates are used by the
orchestrator when writing delegation prompts.

**One** → **Embedded in that agent's prompt** or a skill it reads.

---

## The Three Implementation Tiers

### Tier 1: Subagents (own context window)

**What they are:** Independent Claude instances with their own system prompt,
tools, and 200K-token context.

**Use when:**
- The work is substantial (code, analysis, design — not lookup or detection)
- Independence from the caller matters (auditor, security reviewer)
- The output is large enough that working in the parent's context would
  pollute it with noise
- The task can run in parallel with other tasks
- Domain expertise requires a detailed, focused system prompt

**Current subagent roster and justification:**

| Agent | Justification |
|-------|--------------|
| `orchestrator` | Central coordinator — enhanced with inline skills |
| `auditor` | MUST be independent from orchestrator (veto authority) |
| `architect` | Deep design reasoning needs focused context |
| `frontend-engineer--realmweaver` | Primary implementation agent — project-specific conventions baked in |
| `frontend-engineer--react` | Generic React fallback — for non-Realmweaver React work |
| `frontend-engineer` | Base frontend — ultimate fallback |
| `test-engineer` | Writes substantial test code |
| `visualization-expert` | D3/React Flow graph visualization — substantial output |
| `subject-matter-expert--ttrpg` | TTRPG domain reasoning, isolated from implementation bias |
| `security-reviewer` | Must assess independently |
| `code-reviewer` | Must assess independently |
| `talent-builder` | Creates files (agent definitions) — needs write access |

**Archived agents** (in `.claude/agents/archive/`, available if needed for
other projects): backend-engineer (+node, +python), frontend-engineer--dotnet,
data-engineer, data-analyst, data-scientist, devops-engineer, subject-matter-expert

### Tier 2: Skills (procedures that run in the caller's context)

**What they are:** Reference documents that an agent reads and follows
inline — no new context window, no summarization loss.

**Use when:**
- The output needs to stay in the caller's context with full fidelity
- The task is procedural (detection, lookup, templating, checklist)
- The overhead of a subagent (startup, summarization) outweighs the benefit
- The "skill" augments an existing agent rather than replacing it

**Current skills and what they replaced:**

| Skill | Was Previously | Why It Changed |
|-------|---------------|----------------|
| Research procedures | `researcher` subagent | Orchestrator needs findings in its own context — summarization loses critical detail that downstream planning depends on |
| Agent routing | `talent-mapper` subagent | Stack detection is a lookup procedure, not a reasoning task. Orchestrator does it faster inline. |
| Comms protocols | `comms-controller` subagent | Templates and logging are procedures. The orchestrator manages comms as part of its workflow — a separate agent added latency and coordination overhead with no reasoning benefit. |
| Audit process (inline) | Part of `auditor` | Quick risk triage for LOW-risk tasks doesn't need an independent subagent. The orchestrator applies guardrail checklists inline, escalating to the auditor subagent only when warranted. |

### Tier 3: Reference Documents (shared knowledge)

**What they are:** Standalone files that multiple agents read when they need
specific knowledge. Not executable procedures — just structured information.

**Use when:**
- Multiple agents need the same information
- The content is reference material (presets, templates, schemas) not
  instructions
- The content changes less frequently than agent prompts

**Current reference documents:**

| Document | Used By |
|----------|---------|
| Guardrail presets | Orchestrator (inline triage), Auditor (formal review) |
| Comms protocols & templates | Orchestrator (delegation prompts, mission log) |
| Agent routing table | Orchestrator (stack detection, flavor matching) |

---

## Guiding Principles

### 1. Context Is the Scarcest Resource

Every subagent consumes a full context window. Every handoff between agents
loses information. Design to minimize context windows while maximizing
information fidelity.

**Corollary:** If the orchestrator needs research findings to plan well,
the orchestrator should do the research — not delegate it to a subagent
and read a summary.

### 2. Isolate for Independence, Not for Organization

Subagents exist to provide isolation when it matters — not as an
organizational chart. The auditor is isolated because it must be independent.
A backend engineer is isolated because its 200 lines of code output would
pollute the orchestrator's context. A "researcher" doesn't need isolation —
the orchestrator IS the consumer of the research.

### 3. Process Should Be Embedded, Not Delegated

Procedures (checklists, detection steps, templates) run faster and more
reliably when embedded in the agent that needs them. Delegating a checklist
to a subagent adds latency, costs tokens, and achieves nothing that inline
execution can't.

### 4. The Auditor Is Both Process and Agent

Low-risk tasks: The orchestrator applies guardrail checklists inline
(process component). High-risk tasks: The auditor subagent does independent
review (agent component). This dual nature prevents the auditor from being
either a bottleneck (reviewing every trivial change) or absent (skipped
because it's "too heavy" for small tasks).

### 5. Specialists Earn Their Context Window

Every subagent in the roster must pass the five-test framework above. If a
specialist can't justify its context window cost, it should be downgraded to
a skill or merged into another agent. Periodically re-evaluate the roster.

### 6. The System Grows Through the Talent Builder, Not the Orchestrator

When new capabilities are needed, the talent-builder creates a proper
specialist with a focused system prompt — it doesn't get bolted onto the
orchestrator as another inline procedure. The orchestrator stays lean: it
plans, coordinates, and applies process steps. It doesn't accumulate domain
expertise.

### 7. Favor Depth Over Breadth in Specialist Count

3-5 focused specialists per task outperform 8-10 lightly-used specialists.
Each subagent has startup cost. The orchestrator should select the minimum
set needed, not activate every available agent.

---

## Decision Flowchart

```
New capability needed
        │
        ▼
Does it produce substantial,     YES ──▶ Does independence matter?
independent work product?                        │
        │                               YES ──▶ SUBAGENT
        NO                                       │
        │                               NO ──▶ Is the output too large
        ▼                                       for the caller's context?
Does the caller need full                        │
detail of the output?                   YES ──▶ SUBAGENT
        │                               NO ──▶ Consider SKILL first,
        YES ──▶ SKILL (inline)                   promote to SUBAGENT only
        │                                        if quality suffers
        NO
        │
        ▼
Is it used by multiple agents?
        │
        YES ──▶ REFERENCE DOCUMENT
        │
        NO ──▶ EMBED in the agent's prompt
```

---

## Applying This Framework

When the orchestrator plans a task, it should:

1. Read this framework (you're doing it now)
2. Identify the capabilities needed for the task
3. For each capability, run the five tests
4. Use the minimum set of subagents that passes the tests
5. Use skills and process steps for everything else
6. Only escalate to the auditor subagent for MEDIUM+ risk (use inline
   guardrail checklists for LOW risk)

When the talent-builder creates a new agent, it should:

1. Read this framework
2. Verify the new agent passes the five tests
3. If it doesn't pass, suggest a skill or reference document instead
4. Document the justification in the agent's file

---

## Roster Health — Periodic Review

The talent-builder creates new agents but nothing prunes them. Over time,
the roster will accumulate agents that are rarely used, overlapping, or
underperforming. Periodically (every 10-20 orchestrated tasks, or when the
roster exceeds ~25 agents), run a quick review:

### Review Checklist

1. **List all agents:** `ls ~/.claude/agents/ .claude/agents/`
2. **For each agent, ask:**
   - When was it last used? (Check mission logs or git history)
   - Does it still pass the five-test framework?
   - Has the project's stack changed such that this flavor is no longer needed?
   - Is there another agent that overlaps with it significantly?
3. **Actions:**
   - **Keep** — Used regularly, passes the tests
   - **Merge** — Two agents with overlapping scope → combine into one
   - **Demote** — Passes as a skill or reference doc, not a subagent → convert
   - **Archive** — Not used, not needed → move to `.claude/agents/archive/`
     (don't delete, in case you need it later)

### Post-Task Retrospective (Optional, Lightweight)

After a complex orchestrated task, the orchestrator can append a brief
retrospective to the mission log:

```
## Retrospective

### What worked well
- [Agent that produced strong output first try]
- [Process that saved time]

### What didn't work
- [Agent that needed retry and why]
- [Bottleneck or unnecessary step]

### Roster recommendations
- [Agent to consider creating for future similar tasks]
- [Agent that underperformed and might need prompt revision]
- [Agent that wasn't needed and could be skipped next time]
```

This is a 2-minute addition at the end of a task, not a formal process.
Its value compounds over time as patterns emerge.
