# Agent Routing — Stack Detection & Flavor Matching

The orchestrator runs this procedure inline during Phase 2.5. No subagent
needed — this is a lookup/detection task, not a reasoning task.

---

## Step 1: Detect Tech Stack

Check these files (most reliable first). Stop once you have a clear picture.

**Package managers (strongest signals):**
```
package.json          → Node.js / JavaScript / TypeScript
*.csproj / *.sln      → .NET / C#
pyproject.toml        → Python (modern)
requirements.txt      → Python (legacy)
go.mod                → Go
Cargo.toml            → Rust
Gemfile               → Ruby
build.gradle / pom.xml → Java / Kotlin
```

**Framework config (refines the stack):**
```
next.config.*         → Next.js (React)
nuxt.config.*         → Nuxt (Vue)
angular.json          → Angular
svelte.config.*       → SvelteKit
appsettings.json      → ASP.NET Core
manage.py / wsgi.py   → Django
```

**Read the dependency list** for framework-level detail:
- `package.json` → check `dependencies` and `devDependencies`
- `*.csproj` → check `<PackageReference>` entries
- `pyproject.toml` → check `[project.dependencies]`

## Step 2: Inventory Available Agents

```bash
ls ~/.claude/agents/*.md .claude/agents/*.md 2>/dev/null
```

Parse filenames into a roster. Agents with `--` are flavored variants:
```
backend-engineer            [base]
backend-engineer--node      Node.js flavor
backend-engineer--python    Python flavor
frontend-engineer           [base]
frontend-engineer--react    React flavor
frontend-engineer--dotnet   .NET flavor
```

## Step 3: Match

For each role needed in the plan:

1. **Exact flavor match exists** → Use it
2. **No flavor match, base exists** → Use base, note that a flavor would
   improve quality. If the task is substantial, call `talent-builder` to
   create the flavor before proceeding.
3. **No agent at all** → Call `talent-builder` to create it

## Quick Reference: When Flavors Matter Most

Flavors provide the biggest lift when the stack has **strong conventions**
that a generic agent would miss:

| Stack | Why a Flavor Helps |
|-------|-------------------|
| React/Next.js | Server Components, App Router vs Pages, hooks patterns |
| .NET/Blazor | Render modes, DI patterns, Razor syntax, EF conventions |
| Python/FastAPI | Async patterns, Pydantic v2, Depends() injection |
| Python/Django | ORM patterns, DRF serializers, migration conventions |
| Node/NestJS | Decorators, modules, providers, guards |
| Go | Error handling patterns, goroutine safety, interface design |

For stacks with lighter conventions (simple Express, basic Flask), the base
agent is often sufficient.
