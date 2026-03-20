# Research Procedures

The orchestrator executes these procedures inline during Phase 1. No subagent
needed — the orchestrator is the direct consumer of research findings.

---

## Codebase Profile (Cache-First Research)

**The problem:** Full codebase research on every task wastes 10-30K tokens
re-reading the same config files, tracing the same architecture, and
documenting the same conventions. On a project you work on daily, this
information changes rarely.

**The solution:** A **codebase profile** cached to disk. First run does full
research and writes the profile. Subsequent runs read the profile (~500 tokens)
and do a quick staleness check (~2K tokens) instead of full research (~15-25K
tokens).

### Profile Location

`.claude/team-context/codebase-profile.md` (Claude Code)
`.codex/team-context/codebase-profile.md` (Codex)

### Phase 1 Decision Tree

```
Does codebase-profile.md exist?
    │
    NO → Run full research (Mode 1 or 2), write profile to disk
    │
    YES → Read profile, then run Staleness Check
              │
              STALE → Update only the stale sections, rewrite profile
              │
              FRESH → Use cached profile as-is, proceed to Phase 2
```

### Staleness Check (< 1 minute, ~2K tokens)

Run these quick checks against the cached profile:

```bash
# 1. Has the dependency list changed?
#    Compare hash of package.json / *.csproj / pyproject.toml to profile
md5sum package.json 2>/dev/null || md5sum *.csproj 2>/dev/null || md5sum pyproject.toml 2>/dev/null

# 2. Have new top-level directories appeared?
ls -d */ 2>/dev/null

# 3. What files changed since the profile was written?
#    The profile records its own timestamp
git diff --name-only --since="[profile_timestamp]" 2>/dev/null || find . -newer .claude/team-context/codebase-profile.md -name "*.ts" -o -name "*.py" -o -name "*.cs" | head -20
```

**Interpret results:**
- Dependencies unchanged + no new directories + only source files changed
  → Profile is FRESH. Use as-is.
- Dependencies changed → Update Stack section only. Partial rewrite.
- New directories or major structural changes → Full rewrite of profile.
- Nothing changed at all → Profile is definitely fresh.

### Profile Format

```markdown
# Codebase Profile

**Generated**: [ISO timestamp]
**Project**: [name from package.json / *.csproj / directory name]
**Config Hash**: [md5 of primary config file — for staleness detection]

## Stack
Language: [e.g., TypeScript]
Framework: [e.g., Next.js 14, App Router]
ORM: [e.g., Prisma 5.x]
Testing: [e.g., Vitest + Playwright]
Package Manager: [e.g., pnpm]
Node Version: [e.g., 20.x]

## Architecture
Pattern: [e.g., modular monolith, microservice, etc.]
Entry points: [e.g., src/app/layout.tsx → pages → API routes]
Request flow: [e.g., middleware → route handler → service → repository → DB]
Key abstractions: [e.g., services in src/services/, repositories in src/repositories/]

## Directory Structure
src/           → [purpose]
src/app/       → [purpose]
src/lib/       → [purpose]
src/services/  → [purpose]
tests/         → [purpose]
prisma/        → [purpose]

## Conventions
Naming: [e.g., camelCase variables, PascalCase components, kebab-case files]
File organization: [e.g., feature-based, layer-based]
Error handling: [e.g., custom AppError class in src/lib/errors.ts]
Logging: [e.g., Pino logger via src/lib/logger.ts]
Auth: [e.g., JWT via middleware in src/middleware/auth.ts]

## Data Model (Key Entities)
- User: [key fields, relationships]
- [Entity]: [key fields, relationships]

## Integration Points
- [Database]: [type, connection, where configured]
- [External API]: [what, where consumed]
- [Queue/Cache]: [if any]

## Known Issues / Tech Debt
- [Notable TODOs, known fragile areas, missing tests]

## Agent Routing
Recommended frontend flavor: [e.g., frontend-engineer--react]
Recommended backend flavor: [e.g., backend-engineer--node]
Domain context needed: [yes/no, which domains]
```

### When to Force a Full Refresh

Include `--fresh` in your prompt or say "research the codebase from scratch"
to bypass the cache. Use when:
- You just made major architectural changes
- A large PR was merged that restructured the project
- The profile feels wrong or outdated
- First time using the system on this project

---

## Research Modes (for full research or profile updates)

### Mode 1: Pre-Flight Check (< 2 minutes)

Use for straightforward tasks or when writing the initial profile.

**Steps:**
1. Scan top-level directory structure
2. Read primary config files (package.json / *.csproj / pyproject.toml, etc.)
3. Check for README, CONTRIBUTING, or docs/ directory
4. Note the testing framework
5. **Write the result to the codebase profile if it doesn't exist**

### Mode 2: Codebase Reconnaissance (5-10 minutes)

Use for the first task on a complex codebase, or when profile needs full rewrite.

**Steps:**
1. Run Pre-Flight first
2. Trace architecture: entry points → routing → business logic → data layer
3. Read 2-3 representative files per layer to learn conventions
4. Document naming, error handling, test patterns
5. Identify integration points
6. Scan for TODOs, tech debt, known issues
7. Check git log for recent activity patterns
8. **Write the full result to the codebase profile**

### Mode 3: Domain Research

Use when the task involves business domains. Domain research is NOT cached
in the codebase profile because domain context is task-specific.

**Steps:**
1. Search codebase for domain terminology
2. Read schema files, model definitions, enum values
3. Check for internal docs explaining business rules
4. Identify where domain rules are enforced in code
5. Note gaps

**For regulated domains:** Delegate to `subject-matter-expert` subagent
after inline research. Mandatory.

### Mode 4: Technology Research

Use when evaluating a library, API, or approach. Not cached.

**Steps:**
1. Check existing dependencies for related packages
2. Read relevant config and current implementation
3. Identify the decision point
4. Note compatibility constraints

---

## Token Cost Comparison

| Approach | Tokens | When |
|----------|--------|------|
| Full Codebase Recon (Mode 2) | ~15-25K | First run, or forced refresh |
| Staleness Check + Cached Profile | ~2-3K | Every subsequent run |
| Pre-Flight only (Mode 1) | ~3-5K | Simple tasks, new projects |
| Domain Research (Mode 3) | ~5-10K | Task-specific, not cached |

On a project where you run 3 orchestrated tasks per day, the profile cache
saves roughly **30-60K tokens per day** — roughly one full subagent's worth.
