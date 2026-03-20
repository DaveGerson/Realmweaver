# Guardrail Presets

Used by:
- **Orchestrator** — for inline risk triage on LOW-risk tasks (skip auditor)
- **Auditor** — as a starting point for formal review on MEDIUM+ risk tasks

---

## Risk Triage (Orchestrator runs this inline)

Assess the task's risk level. If LOW, apply guardrails inline and skip the
auditor subagent. If MEDIUM or above, invoke the auditor.

| Signal | Risk Level |
|--------|-----------|
| Simple code changes, no regulated data, no infra | LOW |
| Read-only data analysis or exploration | LOW |
| New feature in existing patterns, no compliance data | LOW-MEDIUM |
| Multiple agents writing to same codebase area | MEDIUM |
| Agents need Bash access | MEDIUM |
| Task touches databases or data pipelines | MEDIUM |
| New third-party integrations or dependencies | MEDIUM |
| Infrastructure changes (Docker, CI/CD, deploy) | HIGH |
| Production systems or shared resources | HIGH |
| Regulated data (compliance, audit-controlled, industry-regulated) | HIGH |
| Regulatory-reportable data, audit trail systems | CRITICAL |
| Schema migrations on production databases | CRITICAL |

**When in doubt, err toward the auditor.** A false escalation costs time.
A missed risk causes real harm.

---

## Preset: Standard Development (LOW risk)

Apply by default when no elevated risk signals are present.

**Scope:**
- Write access: project `src/` and `tests/` directories
- Read access: entire project
- Blocked from write: `.env`, `secrets/`, CI/CD config, deploy scripts,
  `node_modules/`, lock files

**Tool restrictions:**
- Implementation agents: Read, Write, Edit, Glob, Grep, Bash
- Review agents: Read, Glob, Grep (no Write, no Bash)

**Process:**
- No auditor required
- Orchestrator applies these guardrails in delegation prompts
- Code reviewer does final pass

## Preset: Data Analysis / Reporting (LOW risk)

**Scope:**
- Read-only access to all data sources
- Write access: output/report directories only
- No modification of source data

**Tool restrictions:**
- Data agents: Read, Write (output only), Glob, Grep, Bash
- Bash restricted to query execution and analysis scripts

**Process:**
- PII masking required in any output leaving the pipeline
- Large result sets (>10K rows) must be aggregated, not dumped raw
- No auditor required unless output is published externally

## Preset: Infrastructure Changes (HIGH risk — auditor required)

**Scope:**
- Changes scoped to infrastructure files (Dockerfile, compose, CI/CD, terraform)
- Application code changes blocked unless explicitly approved

**Tool restrictions:**
- DevOps agent: Read, Write, Edit, Glob, Grep, Bash
- All other agents: read-only on infra files

**Process:**
- Auditor pre-execution review REQUIRED
- Rollback plan documented before execution
- No production changes without explicit user confirmation
- DNS, firewall, and IAM changes BLOCKED without human review

## Preset: Regulated Data (HIGH/CRITICAL risk — auditor required)

For tasks touching regulated data, compliance systems, or audit-controlled operations.

**Scope:**
- Write access restricted to specific service/module directories
- Subject-matter-expert MUST validate before any write to compliance tables
- Historical records: append-only (no updates, no deletes)

**Tool restrictions:**
- Implementation agents: Read, Write, Edit, Glob, Grep (NO Bash on data)
- SME: Read-only (advisory role)

**Process:**
- Auditor pre-execution review REQUIRED
- SME domain context brief REQUIRED before implementation
- Audit trail required: every write must log who, when, what, why
- Data retention per regulatory requirements (typically 5+ years)
- Post-execution auditor review with compliance scan
- Consider: "Would this survive a regulatory audit? An external audit?"

## Preset: Security-Sensitive (HIGH risk — auditor required)

For tasks involving authentication, authorization, or secrets management.

**Scope:**
- Auth-related code isolated to a single agent
- No other agent may modify auth files

**Tool restrictions:**
- Implementing agent: full access but scoped to auth directories
- All others: no write access to auth code

**Process:**
- Auditor pre-execution review REQUIRED
- Security reviewer post-execution review REQUIRED
- No hardcoded credentials (enforce env vars or secret manager)
- No credentials in logs, error messages, or API responses

---

## Per-Agent Boundary Template

The orchestrator includes this in every delegation prompt when guardrails
are active:

```
BOUNDARIES:
- ALLOWED: [specific file paths/patterns this agent may write]
- BLOCKED: [specific file paths/patterns off-limits]
- TOOLS: [restricted tool list, if applicable]
- SPECIAL: [e.g., "Must validate schema with SME before writing migrations"]
```

---

## Trust Levels & Permission Manifest

When the auditor reviews a plan, it produces a Permission Manifest that
specifies trust levels per agent. The orchestrator enforces these.

### Trust Levels

| Level | permissionMode | What It Means | When to Use |
|-------|---------------|--------------|-------------|
| **Full Autonomy** | `auto-edit` | Agent works freely within its path boundaries | Trusted implementation in well-scoped areas |
| **Supervised** | `auto-edit` + checkpoint | Agent works freely, but auditor verifies output before handoff to next agent | Sensitive implementation (e.g., compliance data) |
| **Restricted** | `default` | Agent must request approval for each write | Uncertain scope, new/untested agent, or broad file access |
| **Plan Only** | read-only tools | Agent reads and proposes but cannot execute | Architecture review, exploration, pre-approval design |

### Permission Manifest Format

The auditor includes this in the Guardrails Report:

```
### Permission Manifest

| Agent | Trust Level | permissionMode | Tools | Conditions |
|-------|------------|----------------|-------|------------|
| backend-engineer--node | Full Autonomy | auto-edit | Read, Write, Edit, Glob, Grep | Within src/api/* only |
| data-engineer | Supervised | auto-edit | Read, Write, Edit, Glob, Grep | Auditor verifies migration before apply |
| frontend-engineer--react | Full Autonomy | auto-edit | Read, Write, Edit, Glob, Grep, Bash | Within src/ui/* only |
| security-reviewer | Plan Only | default | Read, Glob, Grep | Report findings only |
```

### Orchestrator Enforcement

The orchestrator applies the manifest when delegating:

- **Full Autonomy**: No additional constraints beyond path boundaries
- **Supervised**: Add to delegation prompt: "After completing your task,
  STOP. Do not proceed to integration. Your output will be verified by the
  auditor before the next step."
- **Restricted**: Add to delegation prompt: "Request approval before
  modifying any files. Describe what you intend to change and wait for
  confirmation."
- **Plan Only**: Override the agent's tools to read-only: `tools: Read, Glob, Grep`

### Auditor Elevated Access

The orchestrator may grant the auditor temporary execution capabilities
for verification tasks (running tests, builds, lints). This does NOT change
the auditor's base permissionMode — it's a one-time delegation for a
specific command. Format in the orchestrator's delegation to the auditor:

```
TASK: Verification — run [specific command]
ELEVATED ACCESS: Temporary Bash for this verification only
SCOPE: Execute only the specified command. Do not modify files.
RETURN: Command output and pass/fail verdict
```
