# Ontology Proposal Evaluation — DDAO & ADRAS

> **Date:** 2026-08-25
> **Status:** Adopted (documentation-level). The adopted extensions below are part of the
> Realmweaver ontological model but are **not yet implemented in code** — implementation
> status is tracked element-by-element in [`ontology-tracker.md`](ontology-tracker.md).

Two externally produced ontology proposals for D&D campaign/adventure modeling were
evaluated against Realmweaver's shipped semantic model
([`semantic-model.html`](semantic-model.html) — 12 node types, 21 edge kinds, the untyped
any-entity overlay, and the integrity machinery in `services/campaignService.ts`):

- **Option 1 — DDAO** ("D&D Adventure Design Ontology"): a large OWL/RDF-style class
  taxonomy (~90 classes) with object/data properties, SHACL-style constraints, controlled
  vocabularies, and inference rules.
- **Option 2 — ADRAS** ("Adventure Design & Runtime Schema"): a six-layer schema whose
  central thesis is a formal split between a *design plane* (authored content) and a
  *runtime plane* (played sessions), bridged by `realizes`/`amends` relations, plus tiered
  knowledge, Fronts/Portents/Dooms, and GM-craft rules expressed as machine-checkable
  axioms.

Each proposal was evaluated independently against the actual `types/` files,
`services/continuityChecker.ts`, `services/contextBuilder.ts`, and
`services/ai/worldSimulation.ts`, then the two evaluations were synthesized. Where both
evaluations converged independently on the same recommendation, that is treated as the
strongest adoption signal.

---

## Verdict

Roughly **70% of both proposals duplicates what Realmweaver already has**, usually in a
deliberately lighter form that suits a localStorage-backed SPA better than a triplestore
(e.g. DDAO's `Fact/Rumor/Secret/Revelation` subclass tree is already
`Secret.category: 'secret' | 'clue' | 'revelation' | 'rumor'`; ADRAS's
`Session`+`Recap`+`realizes` is already `SessionLog` with planning ids and
scene-transition log entries).

Their core architectural idioms — subclass hierarchies, typed-everything edges,
schema-level cardinality constraints, symmetric properties, OWL/SPARQL machinery — would
**fight the codebase's load-bearing design decisions**: flat per-campaign entity arrays
keyed by collection, string-literal unions instead of subclasses, exactly three
bidi-maintained edge pairs, the untyped any-entity id-set overlay, and cascade deletion
via `_purgeEntityReferences`. Every new entity type costs the 13-step checklist
(`CLAUDE.md`) and every new id-bearing edge joins the hand-maintained N-place integrity
contract that `semantic-model.html` §7 names as the standing risk.

The valuable residue is small, specific, and lands almost entirely as **optional fields
on existing types, new `continuityChecker` lint rules, and `contextBuilder`
derivations** — no new entity types.

---

## Adopted extensions

These are now part of the Realmweaver ontological model. IDs (`E1`–`E11`) are stable and
shared with [`ontology-tracker.md`](ontology-tracker.md), which carries live
implementation status.

### Convergent recommendations (flagged independently by both evaluations)

**E1 — Clue→Revelation edge (`Secret.revealsSecretId?`, `Secret.isVital?`).**
`Secret.category` already distinguishes `'clue'` from `'revelation'`, but nothing records
*which* clues point at *which* revelation, so the classic mystery failure — players miss
the one clue and the campaign dead-ends — is invisible today. One optional FK on
`types/Secret.ts` (meaningful when `category === 'clue'`), registered in
`_purgeEntityReferences` and the broken-reference lint; a "supports revelation" picker in
`SecretsTracker`. Source: DDAO `Clue reveals LorePiece` + ADRAS `reveals`/`answers`.

**E2 — Mystery lint rules (Three-Clue Rule family).** New `continuityChecker.ts` rules in
the existing pure-function pattern, enabled by E1:
- *warning* — a vital, unrevealed revelation with fewer than 3 clues pointing at it
  (the Three-Clue Rule);
- *error* — an unrevealed revelation with **zero** inbound clues (unreachable);
- *warning* — an unrevealed secret with empty `linkedEntityIds` and no inbound clue
  (undeliverable: no NPC, location, or item in the world can ever surface it — ADRAS's
  `Secret ⊑ carriedBy min 1 Prop`, translated);
- *info* — a revelation marked `isRevealed` while none of its clues are (players learned
  it another way — worth confirming).

**E3 — Party-knowledge wiring into the AI layer.** Verified gap: `campaign.secrets` is
read only by the store and the continuity checker — it never reaches
`contextBuilder.ts` or any `services/ai/*` module, and nothing prevents unrevealed
GM-truth from leaking into player-facing output (`SessionLog.playerRecap`). Adopted:
a Tier-2 context section (GM variants: unrevealed secrets linked to the active scene's
entities, flagged GM-ONLY; revealed secrets as established party knowledge) and a hard
"revealed-only" rule for player-facing generation, ideally as a fourth
`ContextVariant: 'player-safe'` that also omits `secrets` prose fields and `gmNotes`.
Zero schema change. Source: ADRAS `KnowledgeState`; DDAO `visibility`/`knownBy`
(distilled).

**E4 — Plot escalation track (Fronts / threat clocks).** Realmweaver has no
"the world moves without the PCs" structure: `Plot.status` is flat, `plotProgressions`
records the past, and `generateWorldEvents` is memoryless (each run forgets it ever ran,
so there is no persistent antagonist arc). Adopted shape — extend `types/Plot.ts`, **not**
a new entity type:

```ts
escalation?: {
  doom?: string;                       // what happens if the threat is never opposed
  steps: Array<{
    id: string;
    title: string;                     // visible escalation step ("portent")
    triggered: boolean;
    triggeredInSessionId?: string;     // join _purgeEntityReferences
  }>;
}
```

`SessionEndWizard` ticks steps the way it cycles `plotProgressions`; the world-sim prompt
includes untriggered steps of active plots and may propose "trigger step N" (gated the
same way `WORLD_SIM_WRITABLE_FIELDS` gates fields today); `continuityChecker` gains a
*warning* for a fully escalated but still-active plot ("this threat has come due").
This subsumes DDAO's simpler `clockSegments`/`clockProgress` (each step ≈ a clock
segment). Source: ADRAS `Front → Portent → ImpendingDoom`; DDAO `DoomClock`.

**E5 — GM craft as lint, never as schema constraints.** Both proposals' axiom/constraint
sections are their most adoptable content *only* when reimplemented as warning-severity
`continuityChecker` rules. Hard cardinalities ("Scene occursAt exactly 1") would make
every freshly AI-generated entity invalid — the wire shapes (`AdventureForBatchAdd`,
`BatchAddData`) deliberately arrive unlinked, and `Scene.locationId` is optional by
design. This is a standing modeling principle, not a single feature.

### Single-source recommendations (adopted)

**E6 — `SessionLog.sceneOutcomes?`** *(ADRAS)* — the useful kernel of the
design-plane/runtime-plane thesis. Today a session records *that* a scene ran
(`Scene.status`) but never *how it went*; divergence from plan survives only as prose.
Adopted as a second attributed edge map mirroring `plotProgressions`:

```ts
sceneOutcomes?: Record<string /* sceneId */, {
  outcome: 'as-planned' | 'diverged' | 'skipped';
  note?: string;
}>;
```

Written by `SessionEndWizard`, keys swept by `_purgeEntityReferences`, consumed by
`SessionPrepWizard` ("last session diverged at X: …") and `contextBuilder` Tier 2.
Runtime truth stays on the runtime object; design-plane amendment remains a human act
(see Rejected: `amends` automation).

**E7 — Campaign safety profile (lines & veils)** *(DDAO)* —
`Campaign.safety?: { lines: string[]; veils: string[] }`, edited in
`CampaignSettingEditor` and injected **Tier-1 into every `contextBuilder` variant**
("HARD LIMITS — never depict … / Keep off-screen …"). The two evaluations disagreed here
(the ADRAS pass argued a Note suffices); the DDAO argument wins for this product
specifically: Realmweaver *generates* content, so there is a real enforcement point — the
model must be told what is off the table or it will eventually cross it.

**E8 — `Secret.knownByEntityIds?`** *(DDAO)* — split "who knows it" from
`linkedEntityIds` ("who/what it's about"). Cheap (one untyped id-set, registered in the
purge sweep and backlink scan) and unlocks the DM Coach question "which NPC could reveal
this?".

**E9 — Widen `PlotStatus` with `'abandoned'`** *(DDAO `ThreadStatus`)* — today the only
honest options for a dropped thread are deletion or mislabeling it `dormant` (which the
dormant-plot lint then nags about). Backward-compatible union widening plus the status
pickers.

**E10 — Inference rules as pure `contextBuilder` derivations** *(DDAO §8)* — zero schema
change, immediate AI-grounding gain:
- *location ancestor chain*: walk `parentLocationId` (the cycle-guarded chain exists) so
  scene context reads "The Gatehouse — in the Ruined Monastery, in the Ashen Vale";
- *faction control in scene*: `Location.controllingFactionId` + `Faction.memberIds` are
  both stored but neither reaches the AI today — the coach variant can state "this
  location is controlled by ⟨faction⟩; present members: …".

**E11 — Zero-schema craft lints** *(ADRAS)* — three rules implementable today:
- *warning* — active `Plot` with empty `relatedEntityIds` (unreachable: nothing in the
  world leads into it);
- *info* — `Adventure.hook` text that names no existing entity (checkable with the
  existing `TextMatchingEngine`);
- *info* — a `Faction` with empty/whitespace `goals` while it controls locations or has
  members (the world-sim prompt literally runs on `goals`, so an empty one silently
  produces a dead faction in every simulation).

---

## Rejected (both evaluations concurred)

| Rejected concept | Why it fights this codebase |
|---|---|
| Subclass hierarchies (`Agent`→NPC/PC/Creature…, `LorePiece`→Fact/Rumor…, Location ladders) | Behavior keys off which `Campaign` array an entity lives in; "subclassing" is expressed as union-typed fields on flat types. Each new type costs the 13-step checklist plus migration lockstep. |
| `SceneGraph` / `Transition` / `KnowledgeGate` / `Prerequisite` branching machinery | An authoring-paradigm shift with no UI to carry it; `plannedSceneIds` + ordered `Adventure.scenes` is how sessions are actually prepped. If ever wanted, start with a single optional `Scene.leadsToSceneIds?`. |
| `WorldStateFlag` / `Resource` / `StateChange` / `Consequence` engine | A campaign-simulation runtime with no query engine to pay it off; every edge would join the N-place integrity contract. |
| Symmetric properties (`opposes`, `alliesWith`) | Each costs a new `_synchronize*` bidi helper; the store maintains exactly 3 bidi pairs, deliberately. Adopted relations must be forward-only + scan-derived. |
| Schema-level cardinalities (`occursAt exactly 1`, `hasHook min 1`) | Breaks the AI-first workflow — generated entities deliberately arrive unlinked. Lint instead (E5). |
| `AdventureElement` superclass with per-entity `version` | Contradicts the codified rule that `version` lives only on the export envelope. |
| Per-entity 4-/5-state `visibility`, `canonStatus`, `Reliability` scores | The distinctions with product behavior behind them are already structural (`readAloudText` vs `gmNotes`; `Secret.isRevealed`; `category: 'rumor'`). E3's derivations capture the residual value. |
| XP budgets / CR / StatBlock mechanics | `NPC.stats` is deliberately a free string; real encounter math means shipping SRD data and a rules engine. |
| Reified `Goal` / `Motivation` / `Agenda` entities | `NPC.motivations` / `Faction.goals` prose is what the AI layer consumes; reification is authoring burden with no expressible query payoff. |
| `Asset` / `Map` / `Handout` binary storage | Binary payloads in a localStorage/IndexedDB layer whose quota machinery exists for text. |
| `Prop` as a class; `Deity`; `Party` as agent | Already expressible: Item/Article + `Secret.linkedEntityIds`; an NPC or Article; `campaign.playerCharacters`. |
| `Path`/`Route` travel mechanics (distance, danger tier) | Travel logistics is outside the product loop; `LocationConnection` prose suffices. (Optional `travelTime?`/`distance?` may ride along later if a UI wants it.) |
| `HistoricalEvent` causality graph (`causedBy`/`precedes`) | Prerequisite missing: the app has no fictional calendar (even the world sim takes user-entered `daysPassed`). |
| ADRAS `amends` as automation (runtime records rewriting the design plane) | Reverses a documented safety decision: `WORLD_SIM_WRITABLE_FIELDS` forbids AI-driven structural rewiring. Divergence is *recorded* (E6); design-plane amendment stays human. |
| Foreshadow⇄Payoff general ledger; per-agent `knowsAbout` confidence matrix | The load-bearing cases are E1 and E8; the general versions are bookkeeping few GMs will feed. |
| Design-plane `Beat` micro-unit | Name-collides with the shipped runtime `Beat` (`SessionLog.beats` prep checklist). Any future adoption must rename one — flagged as a terminology trap. |

---

## Addendum (2026-08-26): Option 3 — tree-style ontology

A third external proposal was evaluated after the first two: a much simpler,
plain-language indented-tree ontology (Campaign → Story → Scene, with Quests,
Dungeons/Chambers, Creatures, Choices/Consequences, and box-diagram visualizations).
The product owner's stated interest was primarily its value **as a communication
vehicle** — explaining the schema model to DMs who don't know data-modeling concepts.

**Verdict:** as a *schema*, the weakest of the three — essentially DDAO's taxonomy
re-drawn as a tree, with nearly everything either already shipped, already adopted
(E1–E11), or already in the rejected table above, and no new arguments for the
rejected items it re-asserts (quest prerequisite chains, faction↔faction
allies/enemies edges, XP/CR/reward tracks, Choice/Event/Consequence engines, numeric
scalars like danger/urgency/importance ratings, Atmosphere objects). As a
*presentation*, the strongest of the three: plain-verb edge labels that read as
sentences ("a Scene takes place at a Location"), an indented containment tree, and a
"how do I build one" step order are exactly the right form for a DM-facing
explanation — and Realmweaver's real model, being one aggregate root with a single
nested collection, renders in that form even more cleanly than Option 3's own model
does.

**Adopted:**

- **E12 — `Scene.expectedDurationMinutes?`** — the one surviving schema field:
  optional, non-id-bearing (so it does *not* join the N-place integrity contract),
  landing on `types/Scene.ts` with the Session Prep Wizard summing planned scenes
  into "you've planned ≈N hours of game" (the archetype research's four-hour-session
  baseline gives it a real consumer). The companion `pacing` enum was declined as
  redundant with `Scene.type` + `gmNotes`.
- **E2 amendment — `Secret.cluesNeeded?`** — an optional per-revelation override of
  the Three-Clue lint threshold (default 3), recorded on the E2 tracker row rather
  than as a new element.
- **The communication vehicle itself — implemented.** A DM-facing
  "How a Campaign Fits Together" section now opens the *Building Your World* chapter
  of [`../USER_GUIDE.md`](../USER_GUIDE.md): the real 12-node model in plain-verb
  tree form on the shipped world/story/table three-tier frame, plus a re-grounded
  build order. A phase-2 in-app port (a small `DialogShell` help popover, the
  `KeyboardShortcutsHelp` pattern) is possible later but was deliberately not made a
  tracked model element — it is UI work, not ontology.

**The do-not-inherit checklist.** Any future DM-facing text adapted from Option 3
must not import its vocabulary where it contradicts the shipped model. The eleven
mismatches, for the record: (1) Campaign→**Story**→Scene vs. our
Campaign→**Adventure**→Scene; (2) "scenes contain encounters" vs. our Scene-as-prep-
unit / Encounter-as-live-combat-runtime split; (3) first-class
**Quest/Objective** machinery vs. our Plot + Adventure + prose rewards; (4)
**Dungeon/Chamber** types vs. nested Locations + points of interest; (5) a
**Creature** bestiary with stat math vs. `NPC.stats` as a free string; (6)
pre-authored **Choice/Option/Event/Consequence** branching vs. recording outcomes at
the table (a philosophy the explainer states positively); (7) four-way Lore trees
vs. Article categories + NPC-resident character lore; (8) separate
Mystery/Clue/Hidden-Lore node types vs. the single `Secret` with categories (+E1);
(9) faction↔faction alliance edges (rejected); (10) hard cardinalities
("a story must have 2+ scenes") vs. everything-optional (E5); (11) omitting the
table tier entirely, which is half of Realmweaver.

---

## Addendum (2026-08-26): Option 4 — DND-AO (five-domain ontology)

A fourth external proposal was evaluated after the first three: "DND-AO," a five-domain
taxonomy (Narrative, Spatial, Entity, Mechanical, Epistemic) with a predicate list, a
worked example scene, and a closing pitch for bidirectional cross-entity querying.

**Verdict:** the highest-overlap proposal yet — with three evaluations absorbed, nearly
every DND-AO concept is shipped (Scene/Encounter split, location hierarchy + PoIs,
`LocationConnection`, `SkillCheck`/DC gates, `PoiInteraction` as the trigger primitive,
faction goals/resources), already adopted (its epistemic domain maps 1:1 onto E1/E2/E3/E8;
its PC-backstory linkage onto P5; its NPC Voice/Mannerisms onto P3's `voiceNotes`), or
already in the rejected table with no new argument (Actor/Monster subclass trees, CR
budgets, Quest machinery, scene transitions, `opposes`/`alliesWith`, the
Consequence/WorldState engine, typed connection/travel mechanics). Its epistemic domain
is the fourth independent convergence on the clue→revelation edge — recorded as further
evidence for E1/E2's priority. Its "bidirectional querying" pitch is already delivered
architecturally by forward-only edges + scan-derived backlinks.

**Adopted:**

- **E13 — `Faction.partyStanding?: 'hostile' | 'wary' | 'neutral' | 'friendly' |
  'allied'`** — the one surviving schema field: the party's current standing with a
  faction, today expressible only as scattered prose. Optional, non-id-bearing (joins no
  integrity contract), absent ⇒ untracked. Lands on `types/Faction.ts`, edited in the
  faction editor (picker + dashboard badge), consumed by E10's faction-control-in-scene
  derivation ("controlled by ⟨faction⟩ — hostile to the party"). Deliberately **no** lint,
  no nag, no session-end step, and not world-sim-writable — kept under the lazy-lens
  bookkeeping ceiling. Adjacent to the rejected `Resource`/`StateChange` engine, which
  stands: the new argument Option 4 brings is reputation as faction-*intrinsic* state DMs
  already track by hand, not as event-engine output; a single coarse enum is `Plot.status`'s
  weight class, not a runtime.

**Declined residue** (each with the honest reason): NPC/scene-level starting attitudes
(E13 is the faction-level default; per-scene matrices are prep bookkeeping); sub-location
sensory fields (re-asserts the Option 3 Atmosphere rejection — `readAloudText` is the
delivery mechanism; the residue is a prompt-engineering nudge, not schema); structured NPC
Ideals/Bonds/Flaws (the AI consumes `traits`/`motivations` prose whole; the field-worthy
NPC axis was voice, already in build); Personal Character Quest (is P5's gated hooks; no
argument to un-gate); clue `pointsTo Location` / `exposes weakness` (E1 + `linkedEntityIds`
+ content prose cover it; a third typed clue role isn't worth an N-place contract seat);
scene pacing tags (the Rest-inclusive framing is noted as a genuinely better argument than
Option 3's version, but the native fix if ever needed is widening `SceneType` with
`'downtime'` — an E9-style move — not a parallel DM-tagged intensity enum; P6 Tier 1
derives pacing for free).

**Toolkit note** (owner-requested focus): Option 4's compound-query example ("sub-locations
controlled by faction X containing a clue pointing to Y") exposes a real but narrow gap —
no shipped surface answers a set-returning question chained across ≥2 edges (backlinks are
one-hop, search is text-only, the graph has type toggles but no focus mode and no Secret
nodes, R4 is one hop; planned P6 is health checks, not querying). A query engine remains
rightly rejected. Two curated compound filters are recorded as feature (not ontology)
recommendations for the storyteller/lazy track: **T1** — widen R4's "here now" by one hop
(controlling faction + location ancestor chain, reusing E10's derivations; size S, zero
schema); **T2** — a RelationshipGraph focus lens (2-hop neighborhood dimming around a
selected node, optionally with an unrevealed-clue count badge; size M, zero schema).

**Validations recorded:** epistemic domain ≙ E1/E2/E3/E8 (E3 implemented, E1/E2 in build);
Voice/Mannerisms ≙ P3 (in build); Scene/Encounter and prep/runtime split ≙ shipped;
sub-location granularity ≙ shipped hierarchy; PC backstory linkage ≙ P5; faction
goals/resources ≙ shipped verbatim; the bidirectional-querying pitch ≙ the shipped
forward-only + derived-backlinks architecture, which delivers it without symmetric writes.

---

## Sources

- Option 1 (DDAO) and Option 2 (ADRAS): externally supplied proposals, evaluated
  2026-08-25 on branch `claude/evaluate-ontology-proposals-ww3eto`.
- Option 3 (tree-style ontology): externally supplied proposal, evaluated 2026-08-26
  on the same branch (see Addendum above).
- Option 4 (DND-AO, five-domain ontology): externally supplied proposal, evaluated
  2026-08-26 on the same branch (see Addendum above).
- Baseline: [`semantic-model.html`](semantic-model.html) as of the ship-readiness merge
  (2026-08-15), verified against `types/*.ts`, `services/campaignService.ts`,
  `services/continuityChecker.ts`, `services/contextBuilder.ts`,
  `services/ai/worldSimulation.ts`.
