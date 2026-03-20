# Git Strategy for Multi-Agent Work

The orchestrator applies these git procedures to prevent agent collisions
and maintain traceability. This is especially important for regulated domains
where "who changed what and why" must be auditable.

---

## Strategy Selection

Choose based on task complexity and risk level:

### Strategy 1: Commit-Per-Agent (DEFAULT — use for most tasks)

Each agent's work is committed as a single atomic commit when it completes.
Simple, traceable, easy to revert one agent's work without affecting others.

**When to use:** Most tasks. LOW-MEDIUM risk. Agents have non-overlapping
file scopes.

**Orchestrator procedure:**

Before dispatching agents:
```bash
# Ensure clean working tree
git status
# Create a feature branch for the entire task
git checkout -b feat/[task-description]
```

After each agent completes and you've verified the output:
```bash
# Stage only the files this agent was assigned
git add [agent's file paths]
git commit -m "[agent-role]: [one-line summary of what was done]

Orchestrated task: [task description]
Agent: [agent name/flavor]
Trust level: [from auditor manifest]
Files: [list of files modified]"
```

After all agents complete and final review passes:
```bash
# Squash-merge or regular merge to main, depending on project conventions
git checkout main
git merge feat/[task-description]
```

**Rollback:** `git revert [commit-hash]` to undo one agent's work without
affecting others.

### Strategy 2: Branch-Per-Agent (HIGH/CRITICAL risk or overlapping scopes)

Each agent works on its own branch. The orchestrator merges them after
verification. More overhead but maximum isolation and traceability.

**When to use:** HIGH/CRITICAL risk. Regulated data. Multiple agents touching
related files. When the auditor requires verified-before-merge checkpoints.

**Orchestrator procedure:**

Before dispatching agents:
```bash
git checkout -b feat/[task-description]  # base branch for this task
```

For each agent, create a sub-branch:
```bash
git checkout feat/[task-description]
git checkout -b feat/[task-description]/[agent-role]
```

Include in the delegation prompt:
```
GIT: You are working on branch feat/[task]/[role]. Commit your work when
complete with a descriptive message. Do not merge.
```

After each agent completes:
```bash
# Switch to agent's branch, verify, then merge to task branch
git checkout feat/[task-description]/[agent-role]
# Auditor review here if supervised trust level
git checkout feat/[task-description]
git merge feat/[task-description]/[agent-role] --no-ff \
  -m "Merge [agent-role]: [summary]"
```

**Conflict resolution:** If two agent branches conflict:
1. Identify which agent's changes take priority (check the execution plan
   dependency order)
2. Merge the upstream agent first
3. Rebase the downstream agent's branch onto the updated task branch
4. If the conflict is in logic (not just merge markers), re-delegate the
   conflicting portion to one agent with full context of both changes

### Strategy 3: No Git (quick, disposable work only)

Skip git ceremony for LOW-risk, single-session work that won't be
committed anyway (exploration, prototyping, analysis scripts).

**When to use:** Throwaway work. Pure analysis. No production impact.

---

## Commit Message Convention

```
[agent-role]: [imperative summary, 50 chars max]

[Optional body: what was done and key decisions]

Orchestrated-by: orchestrator
Agent: [agent-name/flavor]
Trust-level: [Full Autonomy | Supervised | Restricted]
Task-ref: [brief task description or ticket number]
```

Examples:
```
backend-engineer--node: Add compliance tracking endpoints

- PATCH/GET/POST endpoints for /api/compliance-records
- Zod validation for record categories and statuses
- Audit trail middleware for all write operations

Orchestrated-by: orchestrator
Agent: backend-engineer--node
Trust-level: Supervised
Task-ref: compliance tracking system
```

## Regulatory Traceability

For tasks touching regulated data (compliance, audit-controlled, industry-regulated), the git
history serves as an audit trail. Ensure:

1. **Every change is committed** — no dangling uncommitted work
2. **Commit messages reference the agent and task** — per convention above
3. **No force-pushes** on branches with compliance-related changes
4. **Branch protection** on main — require PR or merge review for regulated
   code paths
5. **The mission log cross-references commits** — add commit hashes to the
   mission log after each agent's work is committed:
   ```
   ### backend-engineer--node — COMPLETE
   ...
   Commit: abc1234
   ```

## Orchestrator Checklist

Before starting multi-agent work:
- [ ] Working tree is clean (`git status`)
- [ ] On a feature branch (not main)
- [ ] Agent file scopes are non-overlapping (if they overlap, use Strategy 2)

After each agent:
- [ ] Output verified (or auditor-verified for supervised agents)
- [ ] Changes committed with proper message
- [ ] Commit hash logged in mission log

After all agents:
- [ ] Final review pass complete
- [ ] All changes committed
- [ ] Ready for merge to main
