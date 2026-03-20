# Task Sequencing & QA Gates

How the orchestrator sequences multi-step work with quality checkpoints
between phases. This ensures that downstream work builds on verified
upstream output — not assumptions.

---

## Why Sequencing Matters

Without sequencing, the orchestrator dispatches agents and hopes for the
best. With sequencing, work flows through explicit phases where each
phase's output is verified before the next phase begins. This is critical
when:

- Backend API shape must be confirmed before frontend consumes it
- Database schema must be validated before services write to it
- Business logic must be domain-validated before tests codify it
- Infrastructure must be verified before deployment scripts reference it

## Execution Modes

The orchestrator selects one of these modes based on task structure:

### Mode 1: Parallel Independent (default for non-dependent steps)

Steps with no dependencies run simultaneously. Fastest execution.

```
Step 1: Backend ──┐
Step 2: Frontend ──┼──→ Integration
Step 3: Infra    ──┘
```

**Use when:** Steps touch completely separate files and domains.

### Mode 2: Sequential Pipeline (for dependent chains)

Steps run one after another. Each step's output feeds the next.

```
Step 1: Design ──→ Step 2: Implement ──→ Step 3: Test ──→ Step 4: Review
         │                   │                  │                │
      QA Gate            QA Gate           QA Gate         QA Gate
```

**Use when:** Each step depends on the previous step's output.

### Mode 3: Phased Delivery (most common for real tasks)

Work is organized into phases. Within each phase, steps can run in
parallel. Between phases, a QA gate verifies all work before proceeding.

```
Phase 1: Foundation          Phase 2: Implementation      Phase 3: Quality
┌─────────────────┐         ┌─────────────────────┐     ┌───────────────┐
│ Architect: design│         │ Backend: API routes  │     │ Test: unit    │
│ SME: domain rules│ ──QA──→ │ Frontend: UI         │──QA→│ Test: e2e     │
│ Data Eng: schema │         │ Data: pipeline       │     │ Security: scan│
└─────────────────┘         └─────────────────────┘     │ Code: review  │
                                                         └───────────────┘
```

**Use when:** Work has natural phases where upstream output shapes
downstream work.

---

## QA Gates

A QA gate is a verification checkpoint between phases (or steps). The
orchestrator runs the gate before proceeding to the next phase.

### Gate Types

| Gate | Who Runs It | What It Checks | When to Use |
|------|------------|----------------|-------------|
| **Build Check** | Orchestrator (inline) | Does the code compile? Do imports resolve? | After any implementation phase |
| **Test Gate** | test-engineer subagent | Do existing tests pass? | After code changes |
| **Schema Validation** | SME or auditor subagent | Does the data model match business rules? | After schema/migration work |
| **Contract Check** | Orchestrator (inline) | Do API contracts match between producer and consumer? | Between backend and frontend phases |
| **Auditor Review** | auditor subagent | Does work meet safety/compliance guardrails? | After regulated-domain work |
| **Code Review** | code-reviewer subagent | Quality, consistency, bugs | Before integration/merge |
| **Integration Check** | Orchestrator (inline) | Does everything work together? | After all implementation phases |

### Gate Actions

A gate produces one of three outcomes:

| Outcome | Meaning | Action |
|---------|---------|--------|
| **PASS** | All checks satisfied | Proceed to next phase |
| **PASS WITH NOTES** | Minor issues found, non-blocking | Proceed, but log issues for later cleanup |
| **FAIL** | Blocking issues found | Fix issues before proceeding (use failure-handling.md) |

### Gate Configuration in the Execution Plan

When writing the execution plan, the orchestrator specifies gates:

```
## Execution Plan

**Sequencing Mode**: Phased Delivery

### Phase 1: Foundation
- **Step 1a**: architect — Design API contracts and data model
- **Step 1b**: subject-matter-expert — Validate business rules
- **Gate**: Contract Check + Schema Validation
  - Verify API contracts are complete and internally consistent
  - Verify data model matches SME's business rules
  - FAIL if: missing endpoints, conflicting field types, business rule gaps

### Phase 2: Implementation
- **Step 2a**: backend-engineer--node — Implement API routes
- **Step 2b**: frontend-engineer--react — Build UI components
- **Step 2c**: data-engineer — Create migrations and seed data
- **Gate**: Build Check + Test Gate
  - Run build/compile
  - Run existing test suite
  - Verify API response shapes match frontend expectations
  - FAIL if: build breaks, tests fail, contract mismatch

### Phase 3: Quality
- **Step 3a**: test-engineer — Write tests for new code
- **Step 3b**: security-reviewer — Audit for vulnerabilities
- **Gate**: Test Gate + Auditor Review (if MEDIUM+ risk)
  - All new tests pass
  - No critical/high security findings
  - Auditor signs off on compliance
  - FAIL if: test failures, critical security issues, auditor HALT

### Final: Integration & Merge
- code-reviewer — Final quality pass
- Orchestrator — Commit, merge, completion report
```

---

## Standard Phase Templates

### Template: Full Feature (Backend + Frontend + Tests)

```
Phase 1: Design
  - architect: API contracts, data model
  - SME: domain validation (if regulated)
  Gate: Contract + Schema validation

Phase 2: Data Layer
  - data-engineer: migrations, seed data
  Gate: Build check, migration reversible

Phase 3: Backend
  - backend-engineer: API implementation
  Gate: Build check, API returns expected shapes

Phase 4: Frontend
  - frontend-engineer: UI consuming the API
  Gate: Build check, UI renders with mock/real data

Phase 5: Testing
  - test-engineer: unit + integration tests
  Gate: All tests pass

Phase 6: Review
  - security-reviewer + code-reviewer
  - auditor (if MEDIUM+ risk)
  Gate: No blockers, ship verdict
```

### Template: Data Pipeline

```
Phase 1: Design
  - architect: pipeline design, data flow
  - SME: business rules for transformations
  Gate: Design reviewed

Phase 2: Schema & Ingestion
  - data-engineer: source schema, ingestion logic
  Gate: Sample data loads correctly

Phase 3: Transformation
  - data-engineer or data-scientist: transform logic
  Gate: Output matches expected shape, row counts sane

Phase 4: Validation
  - data-analyst: verify output data quality
  - SME: spot-check business rule compliance
  Gate: Data quality checks pass

Phase 5: Visualization (if needed)
  - visualization-expert: dashboards, charts
  Gate: Renders correctly with real data
```

### Template: Analysis / Report

```
Phase 1: Define
  - data-analyst: clarify the question, identify data sources
  - SME: confirm the question is well-framed
  Gate: Question approved, data sources identified

Phase 2: Explore
  - data-analyst: exploratory queries, data profiling
  Gate: Data supports the analysis (no fatal quality issues)

Phase 3: Analyze
  - data-analyst or data-scientist: core analysis
  Gate: Results reviewed for sanity (no obvious errors)

Phase 4: Present
  - visualization-expert: charts and visual story
  - data-analyst: written narrative and recommendations
  Gate: Final review for accuracy and clarity
```

---

## Orchestrator Sequencing Procedure

When the orchestrator writes an execution plan with sequencing:

1. **Identify dependencies** between work packages. Draw the DAG
   (directed acyclic graph) of what depends on what.

2. **Group into phases.** Steps with no dependencies on each other go in
   the same phase (parallel). Steps that depend on prior output go in
   later phases (sequential).

3. **Define QA gates between phases.** For each phase boundary, specify:
   - What's checked
   - Who checks it (inline orchestrator check, or subagent)
   - What constitutes PASS vs FAIL
   - Whether FAIL is blocking (must fix) or advisory (log and continue)

4. **Present the sequenced plan to the user** before executing. The user
   should see the phases, gates, and what each gate checks.

5. **Execute phase by phase.** After each phase:
   - Run the QA gate
   - Log the gate result in the mission log
   - If PASS: prepare handoff briefs and proceed to next phase
   - If FAIL: follow failure-handling.md (fix and retry, max 1 retry)
   - If FAIL after retry: stop and report to user with diagnosis

6. **Between phases, update the shared context.** Later phases need to
   know what earlier phases produced (API shapes, schema, etc.). The
   handoff brief and shared context doc should reflect the verified
   output, not the planned output.

---

## Mission Log Entries for Gates

```
### QA Gate — Phase 1 → Phase 2
Gate type: Contract Check + Schema Validation
Checks:
  - API contracts complete: ✅ PASS
  - Field types consistent: ✅ PASS
  - Business rules covered: ⚠️ PASS WITH NOTES (missing edge case for expired compliance records with active exceptions)
  - SME validation: ✅ PASS
Result: PASS WITH NOTES
Notes: Expired record + active exception interaction not fully specified. Logged as follow-up.
Action: Proceeding to Phase 2. Note added to shared context for backend-engineer.
```

---

## Rules

- **Every phase boundary gets a gate.** No exceptions. Even a simple
  "does it build?" check prevents cascading failures.
- **Gates are cheap insurance.** A 2-minute build check costs far less
  than a frontend agent building against a broken API for 10 minutes.
- **Log every gate result.** The mission log is the audit trail.
- **PASS WITH NOTES is not a free pass.** Notes must be addressed before
  the final integration step. The orchestrator tracks them.
- **Fail fast.** If Phase 1 fails, don't start Phase 2 hoping it'll
  work out. Fix Phase 1 first.
