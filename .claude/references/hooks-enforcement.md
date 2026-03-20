# Hooks & Enforcement Configuration

This document explains the hooks that mechanically enforce orchestrator
behavior — turning prompt-based "please do X" into "you literally cannot
skip X."

---

## What Hooks Solve

| Problem (Prompt-Only) | Fix (With Hooks) |
|----------------------|------------------|
| Orchestrator skips reading references | SubagentStart hook reminds it on launch |
| Mission log not updated | SubagentStop hook auto-appends a timestamp entry |
| Agent writes to .env or secrets/ | PreToolUse hook blocks the write with exit code 2 |
| team-context directory doesn't exist | SubagentStart hook auto-creates it |
| User doesn't know mission log exists | Stop hook prints the path when session ends |

## Claude Code Hooks (settings.json)

The package includes hooks configuration. In Realmweaver, project hooks are
installed in **`.claude/settings.local.json`** (not `.claude/settings.json`).
The `settings.local.json` file is user-specific and not committed to git,
which allows per-developer hook customization.

### Installation

```bash
# Hooks are already configured in .claude/settings.local.json for this project.
# If you need to recreate them, copy the hooks section from the reference
# below into your .claude/settings.local.json file.
```

### Locating the hooks file

Check for hooks in this order:
1. `.claude/settings.local.json` (project-level, user-specific -- Realmweaver uses this)
2. `.claude/settings.json` (project-level, committed to git)
3. `~/.claude/settings.json` (user-level, all projects)

### Hook Details

**SubagentStart (orchestrator matcher):**
Fires when the orchestrator agent starts. Prints a reminder to read
references and write the plan to disk. Also ensures `.claude/team-context/`
directory exists.

**SubagentStop (all agents):**
Fires when any subagent completes. Appends a timestamped entry to the
mission log. This is a safety net — the orchestrator should also update the
log with details, but this hook ensures at minimum the completion event is
recorded even if the orchestrator skips it.

**PreToolUse (Write|Edit matcher):**
Fires before any file write or edit. Blocks writes to protected paths:
`.env`, `secrets/`, `node_modules/`. Returns exit code 2 to deny the
operation and feed an error message back to the agent.

**Customizing protected paths:** Edit the grep pattern in the PreToolUse
hook command. Add more paths separated by `|`:

```bash
grep -qE "(\\.env|secrets/|node_modules/|.claude/agents/)"
```

**Stop:**
Fires when the session ends. If a mission log exists, prints its path so
you know where to find it.

## Codex Enforcement

Codex doesn't have the same hook system, but provides equivalent controls:

### sandbox_mode per agent

Already set in the TOML files:
- `sandbox_mode = "read-only"` for reviewers (auditor, SME, security, code-review)
- Implementation agents inherit parent sandbox (default: workspace-write)

### Config-level controls

In your `.codex/config.toml` (project) or `~/.codex/config.toml` (user):

```toml
[agents]
max_threads = 6        # Cap concurrent subagents
max_depth = 1          # Prevent subagents from spawning sub-subagents
```

### AGENTS.md reinforcement

The `AGENTS.md` file is read at session start and persists across the
conversation. It reinforces the same behaviors the Claude Code hooks enforce:
- Read all references before planning
- Write plan to disk before delegating
- Update mission log after each agent

## Adding Custom File Protection

### Claude Code

Add more paths to the PreToolUse hook's grep pattern:

```json
{
  "matcher": "Write|Edit",
  "hooks": [{
    "type": "command",
    "command": "bash -c 'FILE=\"$CLAUDE_TOOL_INPUT_FILE_PATH\"; if echo \"$FILE\" | grep -qE \"(\\.env|secrets/|node_modules/|prisma/schema.prisma|.github/workflows/)\"; then echo \"BLOCKED: Protected path: $FILE\" >&2; exit 2; fi'"
  }]
}
```

### Codex

Set `sandbox_mode = "read-only"` on agents that shouldn't modify certain files,
or use a narrower workspace scope in the parent session config.

## Validating Hooks Are Working

After installing `settings.json`:

1. Start a Claude Code session
2. Ask it to write to a `.env` file: "Create a .env file with DATABASE_URL=test"
3. The PreToolUse hook should block it with: "BLOCKED: Write to protected path"
4. If the write goes through, the hook isn't loaded. Check:
   - Is `settings.json` valid JSON? (`cat .claude/settings.json | python -m json.tool`)
   - Did you restart the session after adding hooks?
   - Is the file at `.claude/settings.json` (project) or `~/.claude/settings.json` (user)?
