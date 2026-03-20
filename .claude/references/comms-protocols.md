# Communication Protocols & Templates

The orchestrator manages cross-agent communication as part of its workflow.
No subagent needed — these are templates and procedures, not reasoning tasks.

---

## Shared Context Document

Create at `.claude/team-context/context.md` before dispatching agents.
Every delegation prompt should include: "Read `.claude/team-context/context.md`
for shared project context before starting."

**Template:**
```markdown
# Team Context — [Task Description]

## Project
[One paragraph from research phase]

## Stack
[Language, framework, ORM, key dependencies with versions]

## Architecture
[Directory structure, patterns, data flow]

## Conventions
[Naming, file org, coding style — extracted during research]

## Domain Context
[Business rules from SME, if applicable. Skip if not a domain task.]

## Guardrails
[From auditor review or inline risk triage. Per-agent boundaries.]

## Agent Assignments
| Agent | Scope | Writes To | Blocked From | Depends On |
|-------|-------|-----------|--------------|------------|
| ... | ... | ... | ... | ... |
```

## Mission Log

Create at `.claude/team-context/mission-log.md`. Update after each agent
completes.

**Template:**
```markdown
# Mission Log — [Task Description]

Started: [timestamp]
Risk level: [from audit]

---

### [Agent Name] — [COMPLETE | FAILED | PARTIAL]
Assignment: [one-line summary of delegation]
Result: [2-3 sentence summary of what was done]
Files: [paths created/modified]
Decisions: [key choices made]
Issues: [problems, blockers, questions raised]
Handoff: [what the next agent needs from this output]

---
```

## Delegation Prompt Template

Use this structure for every agent delegation:

```
You are a [role] working on [project description].

SHARED CONTEXT: Read .claude/team-context/context.md

TASK: [Specific, concrete assignment]

CONTEXT:
- [Relevant files to read]
- [Patterns to follow]
- [Output from prior agents this one depends on]

DOMAIN CONTEXT: [If applicable — key business rules from SME]

BOUNDARIES:
- ALLOWED: [file paths this agent may write]
- BLOCKED: [file paths off-limits]

ACCEPTANCE CRITERIA:
- [How to know the work is done correctly]

RETURN: [Summary of files changed, decisions, integration notes, open questions]
```

## Handoff Briefs

When Agent A's output feeds into Agent B, prepare a summary — don't pass
raw output. This keeps Agent B's context clean.

**Template:**
```
HANDOFF FROM [Agent A]:
What was done: [2-3 sentences]
What you need: [specific details relevant to your task]
Files to reference: [paths for full detail if needed]
Constraints from this work: [e.g., "API returns this shape, consume these fields"]
```

## Information Classification

| Level | Description | Handling |
|-------|-------------|----------|
| SHARED | Stack, conventions, architecture | Shared context doc |
| DIRECTED | Agent A's output for Agent B | Included in delegation prompt as handoff |
| RESTRICTED | Credentials, PII, security findings | Reference by env var or file path only — never in prompts |
| INTERNAL | Agent working notes, intermediate output | Stays in agent's context — only summary returned |

**Hard rules:**
- Credentials and secrets are NEVER included in delegation prompts or shared
  context. Reference by environment variable name only.
- Security findings from the security-reviewer go only to the orchestrator
  and auditor — never broadcast to all agents.
- Agent outputs are always summarized before handoff. Raw Bash output, full
  file contents, and verbose logs stay INTERNAL.

## Completion Report Template

Produce after all agents finish and auditor signs off:

```markdown
## Completion Report — [Task]

### Summary
[What was built/changed in 2-3 sentences]

### Files Modified
| File | Action | Agent | Purpose |
|------|--------|-------|---------|
| ... | Created/Modified | ... | ... |

### Key Decisions
1. [Decision]: [rationale] — by [agent]

### Audit Status
[Summary from auditor — SHIP / SHIP WITH NOTES / REVISE]

### Known Limitations
[What wasn't done, needs follow-up]
```
