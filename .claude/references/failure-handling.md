# Failure Handling & Retry Protocol

The orchestrator runs this inline when an agent fails, produces unusable
output, or goes out of scope. These are procedures, not judgment — they
follow the decision framework (Test 4: procedure → skill).

---

## Failure Classification

When an agent's output is problematic, classify it before acting:

| Class | Symptoms | Example |
|-------|----------|---------|
| **Hard Failure** | Agent errored out, produced no output, or hit a tool permission wall | Bash command denied, file not found, context overflow |
| **Scope Violation** | Agent modified files outside its boundaries, ignored constraints | Wrote to blocked paths, introduced unauthorized dependencies |
| **Quality Failure** | Agent produced output that doesn't meet acceptance criteria | Code doesn't compile, tests fail, logic is wrong, misunderstood the task |
| **Partial Success** | Some deliverables are correct, others are missing or wrong | 3 of 4 endpoints built correctly, one has wrong validation logic |

## Response Protocol

### Hard Failure → Diagnose and Retry (max 1 retry)

1. **Read the error.** What specifically went wrong? Permission denied?
   Context overflow? Missing file?
2. **Fix the root cause** in the delegation:
   - Permission error → Check the agent's `tools:` and `permissionMode`
   - File not found → Update file paths in the delegation prompt
   - Context overflow → Split the work package into two smaller ones
3. **Retry once** with the corrected delegation. If it fails again, STOP
   and report the issue to the user. Do not retry indefinitely.

Log in mission log:
```
### [Agent] — FAILED → RETRIED
Failure: [what went wrong]
Root cause: [diagnosis]
Fix applied: [what changed in the delegation]
Retry result: [success/fail]
```

### Scope Violation → Revert and Re-delegate

1. **Identify what was modified outside scope.** Use `git diff` or file
   timestamps to find unauthorized changes.
2. **Revert out-of-scope changes.** `git checkout -- [files]` for tracked
   files. Delete unauthorized new files.
3. **Re-delegate** with stronger boundary language:
   ```
   CRITICAL BOUNDARY: You MUST NOT modify any files outside [allowed paths].
   Files you may modify: [explicit list]
   If you need changes to files outside this list, STOP and report what you
   need in your output. Do not make the changes yourself.
   ```
4. If the same agent violates scope twice, escalate to the auditor with a
   HALT recommendation.

### Quality Failure → Feedback and Retry (max 1 retry)

1. **Be specific about what's wrong.** Don't just re-send the same prompt.
   Include the failure:
   ```
   PREVIOUS ATTEMPT FAILED. Issues:
   - [Specific problem 1 with file:line if applicable]
   - [Specific problem 2]

   Please fix these issues. All other aspects of your previous output were
   acceptable — focus only on the problems listed above.
   ```
2. **Retry once.** If the quality is still unacceptable, consider:
   - Splitting the task into smaller pieces
   - Using a different agent flavor or model tier (e.g., upgrade to Opus)
   - Delegating to the architect first for a design spec, then re-delegating
     implementation with that spec as context
3. If two retries fail, report to the user with the specific issues.

### Partial Success → Salvage and Supplement

1. **Keep what works.** Don't throw away good output because part is bad.
2. **Identify the gap.** What specifically is missing or broken?
3. **Delegate only the gap** as a focused follow-up task:
   ```
   CONTEXT: A previous agent completed most of this work. The following
   files are already correct and MUST NOT be modified: [list]

   YOUR TASK: Fix/complete only the following: [specific gap]
   ```

## Cascade Failure Handling

When a failed step has downstream dependencies:

1. **Pause all dependent steps.** Don't dispatch agents that depend on
   failed output.
2. **Assess impact.** Can independent steps continue in parallel? Usually yes.
3. **After fixing the failed step,** update the shared context and handoff
   briefs before resuming dependent steps.
4. **If the failure changes the plan** (e.g., discovered the approach won't
   work), replan rather than patching. Update the mission log with the
   revised plan.

## The One-Retry Rule

**Each agent gets at most one retry per failure.** This prevents token burn
on fundamentally broken approaches. After one failed retry:

- Log the failure fully in the mission log
- Report to the user with: what was attempted, what failed, your diagnosis,
  and your recommendation (different approach, manual intervention, etc.)
- Do NOT keep retrying with minor prompt tweaks hoping for a different result

## Mission Log Template for Failures

```
### [Agent] — [FAILED | RETRIED | ESCALATED]
Assignment: [original task]
Failure class: [Hard | Scope Violation | Quality | Partial]
What went wrong: [specific description]
Diagnosis: [root cause]
Action taken: [retry with fix / revert / escalate / report to user]
Result: [outcome of the action]
Impact on plan: [none / delayed step N / revised plan]
```

---

## Session Recovery (Crashed / Rate-Limited / Interrupted)

If the Claude Code session dies mid-task, the mission log and shared context
on disk let a new session pick up where things left off.

### Recovery Procedure

1. **Start a new Claude Code session** in the same project directory.

2. **Invoke the orchestrator** with:
   ```
   Resume an interrupted task. Read these files for context:
   - .claude/team-context/mission-log.md (what was completed)
   - .claude/team-context/context.md (project context and guardrails)
   - .claude/team-context/plan.md (execution plan, if it exists)
   Then tell me what was completed and what remains.
   ```

3. **The orchestrator reads the recovery files and reports:**
   - Steps completed (from mission log)
   - Steps in progress when interrupted (may need re-running)
   - Steps not yet started
   - Any issues flagged before the interruption

4. **User approves the recovery plan.** The orchestrator then:
   - Skips completed steps
   - Re-runs the interrupted step (it may have partially completed)
   - Continues with remaining steps

### Making Recovery Work

For this to function, the orchestrator MUST write to disk during execution:

- **Mission log**: Updated after every agent completion (already in workflow)
- **Execution plan**: Write to `.claude/team-context/plan.md` at the start
  of Phase 3. This is the most commonly missed step.
- **Shared context**: Already written in Phase 4

If these files exist on disk, recovery is straightforward. If they don't,
recovery requires the user to explain what happened and the orchestrator to
re-research the codebase.

### Git as a Recovery Aid

If the orchestrator follows the git strategy (commit-per-agent), the git log
itself is a recovery record:

```bash
git log --oneline feat/[task-description]
```

Shows exactly which agents completed their work. Uncommitted changes indicate
the agent that was in progress when the session died.
