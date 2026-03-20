# Agent Knowledge Architecture

How to make agents faster, smarter, and more domain-aware without
burning tokens on redundant research every session.

---

## The Problem

Right now, each agent starts with only its system prompt and whatever the
orchestrator passes in the delegation. A domain expert "knows" industry
terminology because the LLM has training data — but it doesn't know YOUR
specific processes, YOUR system configurations, YOUR data models, or YOUR
internal terminology.

Every session, agents rediscover this context by reading files, or worse,
they hallucinate it from training data that may be outdated or generic.

## The Solution: Knowledge Layers

Agents can be pre-loaded with domain knowledge at four layers, from
cheapest to most powerful:

```
Layer 1: Baked-In Knowledge (system prompt)
    ↓  Free — already in the agent's context on spawn
Layer 2: Reference Packs (files read on demand)
    ↓  Cheap — ~1-5K tokens per file, read once
Layer 3: Skills (structured procedures + assets)
    ↓  Moderate — loaded when triggered
Layer 4: MCP Servers (live tool access)
    ↓  Powerful — real-time data, but requires infrastructure
```

### Layer 1: Baked-In Knowledge (System Prompt)

**What:** Domain facts, terminology, business rules, and patterns written
directly into the agent's prompt (developer_instructions in Codex, the
markdown body in Claude Code).

**Cost:** Zero additional tokens — it's always in context when the agent
spawns.

**Best for:** Stable domain knowledge that rarely changes — regulatory
frameworks, industry terminology, standard procedures, your company's
business model.

**Example:** The subject-matter-expert agent already has regulatory
references, compliance frameworks, and business process definitions baked
in. This is knowledge that Opus "knows" from training but might not apply
correctly without the prompt grounding it in your specific context.

**Limitation:** The prompt can't be too long (~500 lines max is the sweet
spot for Claude Code skills, similar for Codex). And it's static — you
have to edit the file to update it.

**How to maximize it:**
- Include YOUR system names and platforms (CRM, ERP, data warehouse, etc.)
- Include YOUR internal terminology where it differs from industry standard
- Include YOUR organizational structure (departments, teams, roles)
- Include YOUR key business entities and their relationships
- Include common failure modes or edge cases specific to your operation

### Layer 2: Reference Packs (Files Read on Demand)

**What:** Structured markdown or text files that agents read when they need
specific domain knowledge. Heavier than a system prompt, but loaded only
when relevant.

**Cost:** ~1-5K tokens per file. Agent reads it once per session, then has
the knowledge for the rest of that session.

**Best for:** Detailed domain knowledge that's too large for a system prompt
but doesn't change often — data dictionaries, system schemas, API docs,
compliance checklists, process documentation.

**Location:**
- Global: `~/.claude/knowledge/` or `~/.codex/knowledge/`
- Project: `.claude/knowledge/` or `.codex/knowledge/`

**Example reference packs for your domains:**

```
knowledge/
├── systems/
│   ├── data-model.md          ← Key tables, relationships, field meanings
│   ├── api-reference.md       ← REST/SOAP endpoints, auth, common queries
│   └── common-queries.md      ← SQL patterns for common lookups
├── operations/
│   ├── process-workflows.md   ← Business process definitions and states
│   ├── business-rules.md      ← Domain-specific validation rules
│   └── sla-definitions.md     ← Service level agreements and metrics
├── compliance/
│   ├── audit-checklist.md     ← What auditors and inspectors look for
│   ├── regulatory-standards.md ← Applicable regulations and standards
│   └── retention-rules.md     ← Data retention requirements per regulation
├── contracts/
│   ├── contract-structures.md ← Contract types, billing rules, SLAs
│   ├── vendor-management.md   ← Vendor processes and requirements
│   └── pricing-models.md      ← Pricing logic and revenue recognition
└── internal/
    ├── data-dictionary.md     ← Company-wide field naming conventions
    ├── system-landscape.md    ← What systems exist, what they own, integrations
    └── acronyms.md            ← Internal acronyms and abbreviations
```

**How agents use them:** The orchestrator includes in delegation prompts:
```
DOMAIN KNOWLEDGE: Read .codex/knowledge/systems/data-model.md before
designing the schema. This contains our actual table structure.
```

Or the agent's own prompt says:
```
Before working with operational data, read the reference pack at
knowledge/systems/ for the actual data model and common query patterns.
```

**How to create them:** You can create these yourself, OR use this prompt
to have an agent create them from existing documentation:

```
I have documentation about our [SYSTEM] at [path or paste].
Read it and create a structured reference pack at .codex/knowledge/systems/
with three files:
1. data-model.md — key tables, relationships, field descriptions
2. api-reference.md — endpoints, authentication, common operations
3. common-queries.md — SQL patterns for the most common lookups

Format each file for quick scanning: tables, not prose. An agent reading
this should understand the system in 60 seconds.
```

### Layer 3: Skills (Structured Procedures + Assets)

**What:** Claude Code skills and Codex skills — bundled procedures with
associated scripts, templates, and reference files that teach an agent
how to perform specific tasks.

**Cost:** Loaded when triggered by the agent's task description. Variable
token cost depending on skill size.

**Best for:** Repeatable workflows — "how to generate a compliance report",
"how to create a work order", "how to run a utilization analysis". These
combine knowledge WITH procedure.

**Claude Code skills:**
```
~/.claude/skills/
├── compliance-report/
│   ├── SKILL.md              ← Instructions for generating the report
│   ├── scripts/
│   │   └── pull_data.py      ← Script to query compliance data
│   └── templates/
│       └── report-template.md ← Output template
├── data-query/
│   ├── SKILL.md              ← How to query the data warehouse safely
│   └── references/
│       └── schema.md         ← Schema reference
```

Agent frontmatter references the skill:
```yaml
---
name: data-analyst--domain
skills:
  - path: ~/.claude/skills/compliance-report/SKILL.md
  - path: ~/.claude/skills/data-query/SKILL.md
---
```

**Codex skills:**
```toml
[[skills.config]]
path = "~/.codex/skills/compliance-report/SKILL.md"

[[skills.config]]
path = "~/.codex/skills/data-query/SKILL.md"
```

**The difference from reference packs:** A reference pack is "here's what
the data model looks like." A skill is "here's how to run a compliance
trend analysis, step by step, with the SQL templates and output format."

### Layer 4: MCP Servers (Live Tool Access)

**What:** Model Context Protocol servers that give agents real-time access to
external systems — databases, APIs, documentation portals, internal tools.

**Cost:** Requires infrastructure setup (running server, authentication).
Token cost per tool call. Most powerful but highest setup effort.

**Best for:** Live data that changes constantly — current system status,
open work orders, real-time compliance status, active exceptions,
resource availability.

**Example MCP servers for your domains:**

| MCP Server | What It Provides | Agent Use Case |
|-----------|-----------------|----------------|
| Operations DB MCP | Query operational records, work orders, status tracking | Data analyst querying system health |
| Compliance DB MCP | Regulatory status, audit findings, compliance tracking | Auditor checking regulatory compliance |
| System Status MCP | Current system status, resource utilization | Orchestrator understanding operational context |
| Docs MCP | Internal wiki, procedures, manuals | Any agent needing to reference SOPs |
| Databricks MCP | Query data warehouse tables, run notebooks | Data scientist accessing analytics data |

**Claude Code MCP config** (in `.claude/settings.json` or agent frontmatter):
```json
{
  "mcpServers": {
    "operations": {
      "command": "node",
      "args": ["./mcp-servers/operations-server.js"],
      "env": { "OPS_API_URL": "...", "OPS_API_KEY": "..." }
    }
  }
}
```

**Codex MCP config** (in agent TOML or config.toml):
```toml
[mcp_servers.operations]
url = "http://localhost:3100/mcp"
startup_timeout_sec = 20
```

**Building MCP servers is a separate project.** Start with reference packs
(Layer 2) — they cover 80% of the value with 5% of the effort. Graduate to
MCP servers when you need live data access.

---

## Choosing the Right Layer

| Knowledge Type | Layer | Example |
|---------------|-------|---------|
| Industry regulations, terminology | 1 (Prompt) | Regulatory references, compliance frameworks |
| Your company's specific rules | 1 (Prompt) or 2 (Reference) | Organization-specific business rules |
| System schemas, data models | 2 (Reference Pack) | Database table structure |
| API documentation | 2 (Reference Pack) | REST API reference |
| Repeatable analysis workflows | 3 (Skill) | Monthly compliance report process |
| SQL query templates | 2 (Reference) or 3 (Skill) | Common data warehouse queries |
| Live system data | 4 (MCP Server) | Current open work orders |
| Current system status | 4 (MCP Server) | Resource utilization, availability |
| Internal documentation | 2 (Reference) or 4 (MCP) | SOPs, manuals, wiki |

**Rule of thumb:** Start at Layer 1, promote to Layer 2 when the prompt gets
too long, promote to Layer 3 when you need procedures not just knowledge,
promote to Layer 4 when you need live data.

---

## Global vs Project Knowledge

### Global Knowledge (lives in ~/.claude/ or ~/.codex/)

Knowledge that applies across ALL your projects:

```
~/.codex/
├── agents/          ← Global agent roster (already set up)
├── references/      ← Global orchestration references (already set up)
├── knowledge/       ← NEW: Global domain knowledge
│   ├── systems/
│   │   ├── data-model.md
│   │   ├── api-reference.md
│   │   └── common-queries.md
│   ├── operations/
│   │   ├── process-workflows.md
│   │   └── business-rules.md
│   ├── compliance/
│   │   └── audit-checklist.md
│   └── internal/
│       ├── system-landscape.md
│       └── data-dictionary.md
└── skills/          ← NEW: Global reusable skills
    ├── compliance-report/
    │   ├── SKILL.md
    │   └── templates/
    └── data-query/
        ├── SKILL.md
        └── references/
```

**How agents find global knowledge:** The agent's prompt includes:
```
For domain knowledge, check ~/.codex/knowledge/[domain]/ or
.codex/knowledge/[domain]/ (project-level override).
```

**Or the orchestrator includes it in delegation:**
```
DOMAIN KNOWLEDGE: Read ~/.codex/knowledge/systems/data-model.md
```

### Project Knowledge (lives in .claude/ or .codex/ within a project)

Knowledge specific to ONE project:

```
.codex/
├── agents/          ← Project-specific agent overrides or additions
├── references/      ← Orchestration references
├── knowledge/       ← NEW: Project-specific domain knowledge
│   ├── data-model.md         ← THIS project's specific schema
│   ├── business-rules.md     ← THIS project's domain rules
│   └── api-contracts.md      ← APIs THIS project consumes/produces
└── team-context/    ← Runtime state (mission logs, profiles, plans)
```

### Resolution Order

When an agent needs knowledge, it looks for the most specific version:

1. **Project knowledge** (`.codex/knowledge/`) — wins if it exists
2. **Global knowledge** (`~/.codex/knowledge/`) — fallback
3. **Baked-in knowledge** (agent prompt) — always available

This means you can have a global reference that's accurate for most
projects, but override specific details in a project that differs.

---

## Making a Domain-Expert Agent with Pre-Loaded Knowledge

### Example: Inventory Management Expert (Global)

**Step 1: Create the knowledge pack**

Create `~/.codex/knowledge/systems/data-model.md` with the actual schema:

```markdown
# Data Model — Key Tables

## ASSETS
| Column | Type | Description |
|--------|------|-------------|
| ASSET_ID | VARCHAR | Unique asset identifier |
| ASSET_TYPE | VARCHAR | Asset type classification |
| ASSET_STATUS | VARCHAR | ACTIVE, INACTIVE, MAINTENANCE, RETIRED |
...

## WORK_ORDERS
| Column | Type | Description |
|--------|------|-------------|
| WO_NUMBER | VARCHAR | Work order number |
| WO_TYPE | VARCHAR | ROUTINE, NON_ROUTINE, COMPLIANCE, CORRECTIVE |
| ASSET_ID | VARCHAR | FK → ASSETS.ASSET_ID |
...

## Common Joins
- WORK_ORDERS → ASSETS via ASSET_ID
- COMPLIANCE_RECORDS → WORK_ORDERS via WO_NUMBER
...
```

**Step 2: Create the agent**

`~/.codex/agents/domain-expert.toml`:
```toml
name = "domain-expert"
description = "Domain system specialist. Use when tasks involve operational data, work orders, compliance records, asset tracking, or inventory management. Knows the data model, API, and common query patterns."
model = "gpt-5.4"
model_reasoning_effort = "high"
sandbox_mode = "read-only"

developer_instructions = """
# Domain System Expert

You are a specialist in the operational management system as configured
for this organization.

BEFORE answering any question about the system, read these reference files:
- ~/.codex/knowledge/systems/data-model.md (table structure)
- ~/.codex/knowledge/systems/api-reference.md (API endpoints)
- ~/.codex/knowledge/systems/common-queries.md (SQL patterns)

If project-level overrides exist at .codex/knowledge/systems/, read those
instead — they take precedence.

## What You Know
- Data model: tables, relationships, field meanings, valid values
- Common query patterns for operational analysis
- Compliance tracking and workflow
- Asset tracking and inventory management
- Work order lifecycle and status transitions
- Integration points with other systems (reporting, planning, finance)

## Principles
- Always reference the data model doc for table/column names. Do not guess.
- Validate SQL against the known schema before returning it.
- Note when a query might be expensive (large table scans, missing indexes).
- Flag when data might be sensitive (PII, security-critical).

## Output
1. Answer or analysis
2. SQL queries used (with comments)
3. Data model references (which tables, which joins)
4. Caveats (data quality, known gaps, performance concerns)
"""
```

**Step 3: The orchestrator uses it automatically**

When a task involves domain data, the orchestrator routes to `domain-expert`
via the talent-mapper/routing procedure. The expert reads its knowledge
pack on spawn, and works with accurate schema info — no research needed.

---

## Getting Started — Practical Next Steps

### Immediate (today/tomorrow)
1. Create `~/.codex/knowledge/` and `~/.claude/knowledge/` directories
2. Start with ONE domain you use most (probably your primary data system)
3. Create a data-model.md for that domain — even a partial one is valuable
4. Reference it from the relevant agent's prompt

### Next Week
5. Add 2-3 more knowledge packs (compliance, operations, contracts)
6. Create a skill for your most common repeatable workflow (e.g., monthly
   compliance report)
7. Update the orchestrator's delegation templates to include knowledge
   pack references when relevant

### Later
8. If you need live data access, build an MCP server for your most-queried
   system (likely your data warehouse or primary operational system)
9. Create project-specific knowledge overrides for projects with unique
   domain needs

### Prompt to Bootstrap Knowledge Packs

Use this with either CLI to create a knowledge pack from existing docs:

```
I need to create a domain knowledge pack for [SYSTEM/DOMAIN].

Here is documentation about this system: [paste or point to file]

Create a structured knowledge pack at [~/.codex/knowledge/DOMAIN/ OR
.codex/knowledge/DOMAIN/] with:

1. data-model.md — Tables/entities, relationships, key fields. Use tables,
   not prose. An agent should understand the schema in 60 seconds.
2. common-operations.md — The 10-15 most common things people do with this
   system, with step-by-step procedures or SQL templates.
3. terminology.md — Domain-specific terms, abbreviations, status codes,
   and their meanings.

Keep each file under 200 lines. Optimize for agent consumption — scannable
structure, no fluff.
```
