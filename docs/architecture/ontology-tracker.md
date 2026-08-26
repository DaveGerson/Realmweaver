# Ontology Element Tracker

> **Purpose:** the single place that answers "which elements of the Realmweaver
> ontological model are NOT in use in the shipped app today?" It covers two kinds of
> gap: **(A)** adopted model extensions that are documented but not yet implemented, and
> **(B)** elements of the shipped model that exist in code but have no live consumer.
>
> **Maintenance contract:** when an element ships, flip its Status here (and delete the
> row once it is fully live and covered by `semantic-model.html`). When a new extension
> is adopted into the model without being implemented, add it here first. Keep this file
> in lockstep with [`semantic-model.html`](semantic-model.html) §11 and
> [`ontology-proposal-evaluation.md`](ontology-proposal-evaluation.md) (which holds the
> full rationale per element — IDs are shared).

**Status vocabulary:** `not-implemented` (adopted into the model, no code yet) ·
`partial` (some consumers wired, others missing) · `dormant` (in the shipped model, no
live writer/reader) · `transient` (in the type vocabulary by design, never persisted).

---

## A. Adopted extensions — in the model, not in the code

E1–E11 adopted 2026-08-25 from the DDAO/ADRAS proposal evaluation; E12 and the E2
amendment adopted 2026-08-26 from the Option 3 (tree-style) evaluation — see the
evaluation doc's Addendum. None of these exist in
`types/`, `services/`, or any UI surface yet. **Every id-bearing field below must be
registered in `_purgeEntityReferences`, both id-remap passes, the backlink scanner, and
the continuity checker's broken-reference rule when implemented** (the N-place contract,
`semantic-model.html` §7).

| ID | Element | Kind | Landing spot(s) | Status |
|----|---------|------|-----------------|--------|
| E1 | `Secret.revealsSecretId?` — clue→revelation FK; `Secret.isVital?` | schema (optional fields) | `types/Secret.ts` · purge sweep + both remap passes + broken-ref lint + backlinks (full N-place contract, reviewer-verified) · `SecretsTracker` picker/toggle/badge | **`implemented` 2026-08-26** (Wave 2 build) |
| E2 | Mystery lints: Three-Clue Rule (warning) · unreachable revelation (error) · undeliverable secret (warning) · revealed-revelation-without-revealed-clues (info). *Amended 2026-08-26 (Option 3):* the Three-Clue threshold is per-revelation overridable via optional `Secret.cluesNeeded?` (default 3) | lint rules (needs E1) | `services/continuityChecker.ts` (`checkMysteryEdges` + broken-ref widening) · `types/Secret.ts` (`cluesNeeded?`, template-import-validated) | **`implemented` 2026-08-26** (Wave 2 build, incl. the amendment) |
| E3 | Party-knowledge AI wiring: secrets reveal-state in GM context (GM-ONLY unrevealed + established party knowledge sections); hard revealed-only rule for player-facing output; `'player-safe'` context variant | derivation (zero schema) | `services/contextBuilder.ts` · `services/ai/dmCoach.ts` (split GM/player recap calls) · `services/aiService.ts` + `SessionEndWizard` (playerSafe wiring) | **`implemented` 2026-08-26** (canary-tested; Wave 1 build) |
| E4 | `Plot.escalation?` — Front/threat-clock track (`doom`, ordered `steps[]` with `triggered` / `triggeredInSessionId`) | schema (optional field) | `types/Plot.ts` · `SessionEndWizard` · `services/ai/worldSimulation.ts` · purge sweep (`triggeredInSessionId`) · fully-escalated lint | `not-implemented` |
| E5 | Modeling principle: GM craft lands as warning-severity lint, never schema-level cardinality constraints | principle | applies to all future rules | adopted (standing) |
| E6 | `SessionLog.sceneOutcomes?` — `Record<sceneId, { outcome: 'as-planned' \| 'diverged' \| 'skipped'; note? }>` (mirrors `plotProgressions`) | schema (optional field) | `types/SessionLog.ts` · `SessionEndWizard` · `SessionPrepWizard` · `contextBuilder` Tier 2 · purge sweep (keys) | `not-implemented` |
| E7 | `Campaign.safety?: { lines: string[]; veils: string[] }` + Tier-1 injection into **all** context variants | schema + derivation | `types/Campaign.ts` · `CampaignSettingEditor` · `services/contextBuilder.ts` | `not-implemented` |
| E8 | `Secret.knownByEntityIds?` — "who knows it", split from `linkedEntityIds` ("about") | schema (untyped id-set) | `types/Secret.ts` · purge sweep · `utils/backlinkUtils.ts` · SecretsTracker / DM Coach | `not-implemented` |
| E9 | `PlotStatus` widened with `'abandoned'` | vocabulary widening | `types/Plot.ts` · plot editor/dashboard status pickers · dormant-plot lint interaction | `not-implemented` |
| E10 | Context derivations: location ancestor chain in scene context · faction-control-in-scene (controlling faction + present members) | derivation (zero schema) | `services/contextBuilder.ts` | `not-implemented` |
| E11 | Craft lints: unreachable plot (warning) · hook naming no entity (info, via `TextMatchingEngine`) · faction with empty `goals` but members/holdings (info) | lint rules (zero schema) | `services/continuityChecker.ts` · `services/linking/matchingEngine.ts` | `not-implemented` |
| E12 | `Scene.expectedDurationMinutes?` — planned-time estimate; Session Prep Wizard sums selected scenes into a session-length total. Non-id-bearing: does **not** join the N-place contract. *(Adopted 2026-08-26 from Option 3.)* | schema (optional field) | `types/Scene.ts` · `SessionPrepWizard` · optional AI wire field in the scene schema | `not-implemented` |
| E13 | `Faction.partyStanding?: 'hostile' \| 'wary' \| 'neutral' \| 'friendly' \| 'allied'` — the party's standing with a faction; absent ⇒ untracked. Non-id-bearing. No lint, no nag, not world-sim-writable. *(Adopted 2026-08-26 from Option 4/DND-AO.)* | schema (optional field) | `types/Faction.ts` · FactionEditor picker + dashboard badge · `contextBuilder` (rides E10's faction-control derivation) | `not-implemented` |

### Suggested implementation order (value-to-effort, from the evaluation)

1. **E3** — highest leverage, zero schema; closes the player-facing GM-truth leak.
2. **E1 + E2** — one optional FK unlocks the whole mystery-lint family.
3. **E7** — one field + one context section; an AI-generation product needs it.
4. **E10 + E11** — pure derivations/lints, no schema; can ship independently any time.
5. **E4** — highest design weight; also fixes the world simulator's memorylessness.
6. **E6, E8, E9, E12, E13** — cheap, independent, schedule opportunistically.

*(The Option 3 evaluation's other adoption — the DM-facing "How a Campaign Fits
Together" explainer — shipped directly into `docs/USER_GUIDE.md` on 2026-08-26 and is
therefore not tracked here; a phase-2 in-app help-dialog port is UI work, not an
ontology element.)*

---

## B. Shipped model elements with no live consumer

Elements that exist in `types/` today but are not doing work in the product. Verified
against the codebase on 2026-08-25.

| Element | Where | Status | Detail |
|---------|-------|--------|--------|
| `NPC.knowsPlayerHistory[]` | `types/NPC.ts` | `dormant` (deprecated) | Written only as `[]` by factories (`utils/entityUtils.ts`), import backfill, and duplication; no UI writer or reader. Kept for save compatibility; outside the purge sweep (accepted legacy). Candidate for removal in a future save-format migration. |
| `campaign.secrets` → AI layer | `types/Secret.ts` | ~~`partial`~~ resolved 2026-08-26 | Gap closed by E3: reveal-state now reaches the GM context variants (GM-ONLY + party-knowledge sections) and the `player-safe` variant structurally excludes unrevealed secrets from player-facing generation. |
| `RollableTable` / `RollableTableEntry` | `types/RollableTable.ts` | `transient` (by design) | DM Coach AI output only; never persisted on `Campaign`, carries no `id`. Listed here so nobody mistakes it for a persisted graph node. |
| `EntityType` enum coverage | `types/Graph.ts` | `partial` (by design) | The graph view's node vocabulary covers 7 kinds; Plot, SessionLog, and PlayerCharacter are not graph nodes today. Tracked as a known vocabulary gap (see `semantic-model.html` §9's planned `EntityKind` consolidation). |
| `Encounter.sceneId` / `Encounter.sessionId` dangling refs | `types/Encounter.ts` | in use, unswept (by design) | Display-only provenance stamped at combat start; outside the purge sweep, dangles harmlessly. Listed to record that the omission is intentional, not an oversight. |
| `Campaign.secrets?` optionality | `types/Campaign.ts` | `partial` (growing tax) | Still the only optional entity array, and the mystery expansion multiplied its consumers — every one must read `campaign.secrets ?? []`. *Reconciliation finding 2026-08-26:* candidate for promotion to a required, migrated array (backfilled by `migrateCampaignsData` / `normaliseRequiredArrays`) the next time a lane touches the migration path. |

---

*Rationale and rejected alternatives:*
[`ontology-proposal-evaluation.md`](ontology-proposal-evaluation.md). *Shipped-model
reference:* [`semantic-model.html`](semantic-model.html).
