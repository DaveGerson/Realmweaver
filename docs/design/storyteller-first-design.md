# Storyteller-First Design — What the Schema Work Doesn't Cover

> **Status:** PROPOSAL — nothing below is adopted. This document exists to surface the
> objectives the recent ontology work (E1–E12) does *not* address: the needs of the DM
> as a **storyteller**, across the whole arc of a campaign from session zero to finale.
> **Date:** 2026-08-26
> **Grounding:** `dm-archetypes.md` (personas + fit gaps), `USER_GUIDE.md` (shipped
> product), `ontology-proposal-evaluation.md` + `ontology-tracker.md` (adopted E1–E12
> and the standing rejections), `session-cockpit-review.md` (the 67 user stories),
> `roadmap.md` (planned direction), `semantic-model.html` (shipped model). Every
> "builds on" claim below was verified against the live source tree.

---

## The framing

The ontology pass produced exactly what a data modeler should want: referential
integrity, lint rules, context derivations, knowledge-state hygiene. E1–E12 make the
**data** trustworthy. But a DM does not sit down on Thursday night worrying about
dangling foreign keys. They worry about whether the story is *sagging*, whether the
blacksmith they improvised in session 3 will ever come back, whether Torvald's player
has noticed his backstory hasn't mattered in three months, and what they are actually
going to open with in ninety minutes.

Everything the app currently checks is **data health**. Almost nothing checks **story
health**. Everything the app surfaces is **what exists**. Almost nothing surfaces
**what matters tonight**. The proposals below fill that layer — and deliberately land
the way E1–E12 did: optional fields, derivations, AI functions behind the
`aiService.ts` facade, and views. No subclass trees, no new integrity machinery beyond
what each CANDIDATE explicitly costs.

**Boundaries respected throughout:** localStorage-backed SPA, text-first, DM-private
(never player-facing screens), not a VTT, not a rules engine, AI-generation-first,
E5's "GM craft is lint, never schema constraint" principle.

---

## The proposals, ranked by storyteller impact per effort

### P1. Tonight's Table — a story-first campaign home

**The problem:** opening a mid-campaign world greets the DM with dashboards and entity
counts — a database answering "what data exists?" when the DM is asking "what matters
tonight?"

**The design:** a campaign landing view (a new `EditorView` entry — the story-shaped
sibling of the entity dashboards) that assembles, with zero clicks:

- **Previously on** — the last completed session's `recap` and `looseEnds`, verbatim,
  at the top. Not a link to a session log; the text itself.
- **Open threads, by age** — active plots sorted by how many sessions since their
  `plotProgressions` entry last read `'advanced'` (derivable today by walking
  `sessionLogs` in date order). A thread stalled for 4 sessions renders hot, not
  buried.
- **Who's been offstage** — NPCs ranked by last appearance, derived from
  `structuredNotes[].taggedEntityIds`, scene `npcIds` of played sessions, and
  `plannedNpcIds`. "Last seen: session 9" under a name is a story prompt in itself.
- **Loaded guns** — unrevealed secrets/clues (`Secret.isRevealed === false`) linked to
  entities that *are* scheduled or recently active; once E1/E2 land, vital revelations
  short on clues surface here too.
- **One button:** "Prep tonight's session" → the existing `SessionPrepWizard`.

This is the storyteller generalization of roadmap **L3** (which feeds unresolved plots
into the prep wizard): L3 answers the question once you've opened the wizard; Tonight's
Table makes the question the *front door*. It also replaces the current implicit home
(`CrossCampaignDashboard.tsx` literally ranks campaigns by
`npcs.length + locations.length + …` — the data-admin instinct in one line).

- **Personas:** Lazy DM (finds the story with zero prep), Forever DM (context-switch
  between worlds in one screen), Published Module Runner (where are we in the book).
- **Builds on (verified):** `SessionLog.recap`/`looseEnds`/`plotProgressions`/
  `structuredNotes` (`types/SessionLog.ts`), `Plot.status` (`types/Plot.ts`),
  `Secret.isRevealed` (`types/Secret.ts`), `components/dialogs/SessionPrepWizard.tsx`,
  the derivation style already used in `services/contextBuilder.ts`, view plumbing in
  `App.tsx`/`ViewRouter.tsx`/`CampaignSidebar.tsx`.
- **Size:** M. **Schema:** none — pure derivation over shipped data. The "sessions
  since advanced" and "last seen" derivations belong in a shared util so P4/P6 reuse
  them.

### P2. The Callback Machine — grounded improvisation by reincorporation

**The problem:** when players go sideways, the DM needs a complication *from their own
world* in five seconds, but the DM Coach demands a typed prompt and generic random
tables produce generic results.

**The design:** a one-click, zero-prompt "Complicate this" button in the Session
Runner's quick tools. On click, the app samples 2–3 pieces of the campaign's own
*dormant* material — an offstage NPC (P1's last-seen derivation), an unrevealed secret
linked to a present entity, a dormant plot, an unused planned scene — and asks the
improv AI for one complication that **reincorporates** them into the current scene.
Output lands as a card with "Use it" (auto-logs to the running log, and offers
one-tap `isRevealed` flip if a secret was spent) or "Another" (resamples).

This is the improv-craft principle of reincorporation ("the best twist is the thing
you already established") turned into a button — and it is simultaneously the answer
to the Worldbuilder's #1 pain in `dm-archetypes.md`: *unused prep is demoralizing*.
The Callback Machine is the machine that spends unused prep. It is deliberately
distinct from the cockpit review's US-3.6 panic button (which reads the current scene
and suggests a next move): the panic button looks *forward* from the present; this
looks *backward* into the world's dormant inventory. They can share a surface.

- **Personas:** Lazy DM (the archetype's whole thesis), Forever DM (novelty from their
  own back catalog), Worldbuilder (prep recycling), New DM (no prompt engineering).
- **Builds on (verified):** `generateImprovisation` (`services/ai/dmCoach.ts:127`,
  facade at `services/aiService.ts:81`), the `'coach'` `ContextVariant`
  (`services/contextBuilder.ts`), `components/views/session/QuickToolsPanel.tsx`,
  `SessionLogEntry.type: 'coach-used'` (`types/SessionLog.ts:17`) for auto-logging,
  `campaign.secrets` + `Secret.linkedEntityIds` for the sampler.
- **Size:** M (the sampler is the only new logic; generation and logging paths exist).
  **Schema:** none. Needs a `mockService.ts` entry like every AI function.

### P3. NPC voice cards & the quote ledger

**The problem:** by session 20 the DM cannot remember how Serah talks, so a beloved
NPC's voice drifts session to session — the most audible continuity failure at the
table, and one no lint can catch.

**The design:** two small moves that compound:

1. **`NPC.voiceNotes?: string`** — accent, cadence, verbal tics, register ("clipped
   sentences, never uses contractions, calls everyone 'pet'"). One optional field,
   edited in `NpcEditor`, rendered at the top of the NPC card in the Session Runner's
   active scene panel, and injected into roleplay generation.
2. **The quote ledger** — a "log a line" action on running-log entries tagged to an
   NPC (and in the roleplay coach) that appends the spoken line to the NPC's existing
   `history: HistoryEntry[]` with `referenceType: 'session'`. No new collection: the
   history mechanism already exists and already survives the purge sweep. The NPC's
   card then shows their 3 most recent actual lines next to `exampleQuote`.

`generateNpcRoleplay` (`services/ai/realmChat.ts:165`, called from
`DmCoach.tsx:291` with a hand-built `buildNpcContext`) then receives voiceNotes +
recent ledger quotes — the AI stays in the voice the *table has actually heard*, not
the voice from the character sheet written six months ago. This also completes the
cockpit review's US-3.4 (voice hints for New DMs) from the veteran's direction:
US-3.4 generates a starting voice; this preserves a lived one.

- **Personas:** Worldbuilder (craft pride), Forever DM (50-session consistency),
  New DM (confidence to do voices at all).
- **Builds on (verified):** `NPC.exampleQuote` + `NPC.history` (`types/NPC.ts`),
  `HistoryEntry` (`types/common.ts`), `generateNpcRoleplay` + its DmCoach call site,
  `components/views/session/ActiveScenePanel.tsx`, `EntityHistoryManager`.
- **Size:** S. **Schema:** `NPC.voiceNotes?: string` — **CANDIDATE** for the ontology
  tracker (non-id-bearing; does not join the N-place contract). The quote ledger is
  zero schema.

### P4. Engraved moments & the "previously on…" cold open

**The problem:** the moments players will retell for years — the natural 20 at the
worst time, the betrayal nobody saw coming — are flattened into the same
`structuredNotes` stream as "bought 3 torches," and nothing ever plays them back.

**The design:** the star already exists (`SessionLogEntry.isImportant`); what's
missing is the *payoff* for pressing it. Two consumers:

1. **The Moments reel** — a campaign-level chronological view of every starred entry
   across all sessions (a filter-view over `sessionLogs[].structuredNotes`, zero
   schema), each linking back to its session. This is the campaign's emotional spine,
   readable in two minutes — and the input to P7's Chronicle.
2. **The cold open** — a "Generate cold open" action in session prep / at go-live: a
   ~150-word read-aloud "Previously on…" composed by AI from the last session's recap
   + loose ends + the most recent engraved moments, written in the campaign's
   `styleProfile` voice. Rendered in the read-aloud style the runner already uses,
   copy button included. Opening narration is the highest-leverage 60 seconds of any
   session — recaps exist today as *records*; this turns them into *performance
   material*.

- **Personas:** all five; especially Forever DM (recap automation is their CRITICAL
  in the overlap map) and New DM (a strong start, scripted for them).
- **Builds on (verified):** `SessionLogEntry.isImportant` (`types/SessionLog.ts:26`),
  `generateSessionRecap` (facade `services/aiService.ts:172`), `Campaign.styleProfile`
  (`types/Campaign.ts`) + `services/ai/styleMatching.ts`, the read-aloud block styling
  in `ActiveScenePanel.tsx`, `SessionPrepWizard.tsx` step 5.
- **Size:** M. **Schema:** none (deliberately: reuse `isImportant` rather than mint an
  `engraved` flag until the reel proves the star needs a second tier).

### P5. The Campaign Charter — session zero as a first-class object

**The problem:** the app treats a campaign as born when the world synopsis is written,
but real campaigns are born at session zero — pillars agreed, player appetites stated,
PC backstory hooks handed to the DM — and none of that has anywhere to live, so the
AI can't honor it and the app can't check it.

**The design:** a "Charter" section in `CampaignSettingEditor` (plus an optional step
in the `FirstCampaignWizard`), three parts:

1. **Pillars** — `Campaign.pillars?: string[]`: 3–5 declared tones/themes ("gothic
   dread," "found family," "low magic, high cost"). Injected **Tier-1** into every
   `contextBuilder` variant, exactly the mechanism E7 (safety lines/veils) already
   adopted — E7 says what the AI must never generate; pillars say what it should
   *aim at*. The two belong side by side in the same editor.
2. **Player flags** — `PlayerCharacter.playerFlags?: string[]`: what each *player*
   (not character) wants more of ("loves tactical combat," "here for romance plots,"
   "hates puzzles"). Consumed by generation context and P6's spotlight check.
3. **Backstory hooks** — `PlayerCharacter.hooks?: Array<{ id: string; text: string;
   status: 'unused' | 'seeded' | 'paid-off'; sessionId?: string }>`: the trackable
   version of "my sister disappeared in that city." The `SessionEndWizard` offers a
   hook-status pass the same way it cycles `plotProgressions`; generators and the
   Callback Machine treat `'unused'` hooks as premium dormant material.

**This deliberately challenges a standing rejection, in its scoped form.** The
evaluation rejected the "Foreshadow⇄Payoff general ledger" as "bookkeeping few GMs
will feed." That rejection stands for the *general* ledger — but PC backstory hooks
are the one place the objection fails: the bookkeeping is already done *for* the DM,
by the players, at session zero, in writing (`CharacterSocial.backstory/bonds` prose
exists today — unqueryable). Nothing new must be fed during play beyond a one-tap
status at session end. And it is the only mechanism that can ever answer the
storyteller question the archetype docs and the module runner's needs list both
circle: **"whose backstory hasn't mattered yet?"** — plus the Module Runner's
explicit wish, "connect module hooks to PC backstories," which is currently manual
work every session.

- **Personas:** all — New DM (session zero guidance), Forever DM (per-player
  fairness at scale), Module Runner (backstory integration), Worldbuilder (players
  engaging with the world through their own hooks).
- **Builds on (verified):** `Campaign` optional-field pattern (`types/Campaign.ts`),
  `CharacterSocial.backstory/bonds/ideals/flaws` (`types/PlayerCharacter.ts:40`),
  Tier-1 injection point in `services/contextBuilder.ts` (E7's landing spot),
  `SessionEndWizard.tsx` step 2's cycling pattern, `PlayerCharacterImporter`.
- **Size:** M. **Schema:** three **CANDIDATEs** for the tracker —
  `Campaign.pillars?` (non-id-bearing), `PlayerCharacter.playerFlags?`
  (non-id-bearing), `PlayerCharacter.hooks?` (**id-bearing** via `sessionId`: joins
  the N-place contract — purge sweep, both id-remap passes, broken-reference lint —
  and the proposal accepts that cost knowingly).

### P6. The Story Health review — the continuity checker's narrative twin

**The problem:** the Continuity Checker can prove the data is consistent while the
story is quietly dying — sagging pacing, a spotlight hogged by two PCs, an antagonist
offstage so long the players forgot to fear them — and no rule-based lint over
foreign keys will ever say so.

**The design:** a second tab on the existing checker dialog ("Data" / "Story"), two
tiers:

- **Tier 1 — derived, free, instant** (same pure-function pattern as
  `continuityChecker.ts`, extended to warn about *narrative* shape): PC spotlight
  imbalance over the last N sessions (from `taggedEntityIds` + planned rosters);
  major NPC offstage streaks (P1's derivation, thresholded); pacing monoculture
  (`Scene.type` mix of recently played scenes — five social scenes in a row, or zero,
  is worth a nudge; E6's `sceneOutcomes` sharpens this to what actually ran); every
  charter hook still `'unused'` after N sessions; a pillar no recent session recap
  plausibly touches.
- **Tier 2 — AI review, on demand:** "Review my story" feeds the last 3–5 recaps,
  loose ends, plot states, and the charter into a new `aiService` function that
  returns structured findings — where momentum is sagging, which promises the text
  made that nothing has kept, what motif keeps recurring that the DM could
  deliberately lean into (motif *detection* instead of the rejected motif
  *bookkeeping*), and tone drift against the pillars ("the last three sessions read
  as heist comedy; your charter says gothic dread — intentional?"). Findings are
  suggestions with navigation links, never auto-applied — E5's principle, honored at
  the narrative level.

The cockpit review's US-5.4 ("automated continuity tracker" for hooks/promises) is
the nearest prior art; this supersets it and gives it a home, a data source (P5's
charter), and a clear split from the rule-based checker rather than a vague "AI
analysis" bullet.

- **Personas:** Forever DM (the institutional-memory problem is their defining pain),
  Worldbuilder (arc craft), New DM (post-session coaching the archetype doc says
  doesn't exist).
- **Builds on (verified):** `services/continuityChecker.ts` (dialog + severity UI in
  `components/dialogs/ContinuityChecker.tsx`), `Scene.type` (`types/Scene.ts`),
  `SessionLog` recaps/notes, E6/E4 once implemented, P5's charter fields.
- **Size:** L (Tier 1 alone is M and ships independently). **Schema:** none beyond
  P5's candidates.

### P7. The Chronicle — endings, retrospectives, and the campaign as keepsake

**The problem:** campaigns end — and the app, like every campaign tool before it,
pretends they don't: there is no support for landing a finale and nothing to hold
after three years except a JSON export.

**The design:** two halves, one for the ending and one for after it:

1. **Finale ledger** — when the DM declares the endgame (a button, not a schema
   state), a derived view lists the *debts the finale must pay*: unresolved active
   plots, unrevealed vital secrets (E1's `isVital`), un-paid-off charter hooks (P5),
   NPCs with open relationship threads, unfired escalation steps (E4). It is
   Tonight's Table pointed at the horizon instead of at Thursday. Everything on it
   already exists or is already adopted; the view is assembly.
2. **The Chronicle export** — an AI-composed narrative book of the finished campaign:
   a chapter per session built from recaps, the engraved-moments reel (P4) as the
   highlight thread, a dramatis personae from the NPC/PC casts, the fates of the
   plots, and an epilogue prompt ("what happened to Vallaki after?") the DM answers
   or generates. Composed in the campaign's `styleProfile` voice, exported as
   markdown through the exact pipeline `generateMarkdownForCampaign` already uses
   (`services/importExportService.ts:621`), so it lands in Obsidian or a print
   stylesheet for the table's copy. Text-first, no binaries — the keepsake is prose,
   which is the one keepsake this product can make better than anyone.

A retrospective ritual and a physical-feeling artifact are also the burnout
counterweight the Forever DM archetype keeps asking for sideways: proof the years
added up to something.

- **Personas:** Forever DM (closure + keepsake), Worldbuilder (the world as artifact),
  every table (the group's shared memory).
- **Builds on (verified):** `generateMarkdownForCampaign` + `downloadFile`
  (`services/importExportService.ts`), `generateSessionRecap` facade, `styleProfile`,
  P4's reel, E1/E4/E9 adopted fields, `PlotStatus` incl. E9's `'abandoned'`.
- **Size:** L. **Schema:** none — the finale ledger is derivation; the Chronicle is
  export-time composition. (Resist the urge to add `Campaign.status: 'ended'`; a
  campaign is "in endgame" when the DM opens the ledger, and "finished" when the
  Chronicle is exported.)

### P8. The writing-room pass — language and framing

**The problem:** the app's own vocabulary keeps telling the DM they are doing data
entry — "entities," "dashboards," count badges, empty states that read like a report
of missing rows — when every adjacent surface (read-aloud styling, the plain-verb
model explainer that just shipped in the USER_GUIDE) proves the product knows how to
speak storyteller.

**The design:** a deliberate, small, copy-and-framing sweep — no information
architecture change, no renamed code identifiers:

- Empty states become invitations with a generate affordance: "No NPCs yet" → "No one
  lives here yet. Who does the party meet first?" (every dashboard already mounts
  `EntityCreationPanel`; the invitation should point at it).
- `CrossCampaignDashboard` cards lead with the last recap's first line and "last
  played N days ago," demoting the entity-count row (today it *sorts campaigns by
  total entity count* — `CrossCampaignDashboard.tsx:234`).
- Surface labels shift to the USER_GUIDE's own three-tier language (The World / The
  Story / The Table) in the sidebar's section grouping — the explainer taught this
  vocabulary; the chrome should speak it.
- Section headers and toasts get one editorial pass against a short voice guide
  ("write like a co-DM, not a console").

This is the cheapest proposal here and the one that changes the answer to "does it
read like a writing room?" on every single screen. It also compounds P1: Tonight's
Table restructures the front door; this pass makes everything behind it match.

- **Personas:** all; disproportionately New DM (tone is onboarding) and Lazy DM
  (ceremony reads as work).
- **Builds on (verified):** `components/common/EntityCreationPanel.tsx`, the
  three-tier frame in `docs/USER_GUIDE.md` ("How a Campaign Fits Together"),
  `CampaignSidebar.tsx` section structure, `CrossCampaignDashboard.tsx`.
- **Size:** S–M. **Schema:** none.

---

## Tempting but rejected

- **A general foreshadow⇄payoff / motif ledger.** The evaluation's rejection stands:
  bookkeeping few GMs will feed. P5 challenges it *only* for PC backstory hooks
  (players feed it, once, at session zero); P6 gets motifs by *detection* over prose
  instead of by ledger. Anything wider re-fails the original test.
- **A player-facing portal for recaps/moments.** "Realmweaver is the DM's private
  workspace. Players never log in" is load-bearing product positioning
  (`dm-archetypes.md`, Design Philosophy). Sharing stays export-shaped: the player
  recap and the Chronicle are things the DM *hands over*.
- **A fictional in-world calendar / event timeline.** The prerequisite the ontology
  evaluation named (`HistoricalEvent` rejection) is still missing, and session-count
  ("last seen: session 9") is the time unit DMs actually think in. Every derivation
  above uses session ordinals on purpose.
- **Emotion/engagement analytics ("burnout detection," per-player fun scores).**
  US-5.11 already floated self-tracking; going further into inferred sentiment is
  unfeedable data plus an uncomfortable product. Spotlight *presence* (who was in
  scenes) is checkable; spotlight *enjoyment* is the DM's job.
- **A "drama engine" over symmetric NPC↔NPC / faction↔faction edges.** Symmetric
  properties are rejected machinery (each pair costs a `_synchronize*` helper).
  `EntityRelationship` prose + P3's voice work + the world simulator already carry
  interpersonal drama without new bidi edges.
- **Branching "what if the players choose X" story planning.** Rejected
  `SceneGraph`/`Choice` machinery, and contrary to the product's stated philosophy —
  the app *records* what happened rather than scripting what may. The Callback
  Machine is the improv-native answer to the same anxiety.
- **Ambience: music, soundboards, art mood boards.** Not text-first, binary payloads
  in a text-quota storage layer (rejected `Asset` storage), and other tools own it.
- **Renaming entity types in code to storyteller words.** P8 changes surface copy
  only. Renaming `Article` to "Legend" through 13 steps × N files is churn with zero
  table-night payoff.

---

## Summary and sequencing

| # | Proposal | Size | Schema | Serves most |
|---|----------|:----:|--------|-------------|
| P1 | Tonight's Table (story-first home) | M | none | Lazy, Forever, Module Runner |
| P2 | Callback Machine (reincorporation improv) | M | none | Lazy, Worldbuilder, New |
| P3 | NPC voice cards + quote ledger | S | CANDIDATE `NPC.voiceNotes?` | Worldbuilder, Forever, New |
| P4 | Engraved moments + cold open | M | none | all |
| P5 | Campaign Charter (pillars, flags, hooks) | M | CANDIDATEs `Campaign.pillars?`, `PlayerCharacter.playerFlags?`, `PlayerCharacter.hooks?` (id-bearing) | all |
| P6 | Story Health review | L (Tier 1: M) | none beyond P5 | Forever, Worldbuilder, New |
| P7 | The Chronicle (finale ledger + keepsake) | L | none | Forever, Worldbuilder |
| P8 | Writing-room language pass | S–M | none | all |

Natural order: **P1 → P3 → P2 → P4 → P8 → P5 → P6 → P7.** P1 builds the last-seen /
thread-age derivations that P2, P6, and P7 reuse; P3 is the cheapest visible craft
win; P5 must precede P6's charter-dependent checks; P7 is the capstone that consumes
nearly everything above it. None of it blocks, or is blocked by, E1–E12 — the two
tracks meet in the middle: the ontology work makes the data trustworthy, and this
track makes the data *tell the DM a story*.

> **Superseded in part:** the integrated sequencing below (added 2026-08-26 after the
> Lazy DM lens analysis) is the current plan of record.

---

## Lazy DM lens integration (2026-08-26)

[`lazy-dm-lens.md`](lazy-dm-lens.md) audited this document against the two "lazy"
prep schools (Michael E. Shea's eight-step Lazy DM method and Monte Cook's
player-driven prep posture — distinct schools, both covered there with correct
attribution). Its findings fold into this plan as follows:

**Re-ranking for the lazy persona.** Through that lens the order is
**P2 > P1 > P4 > P8 > P3 > P5 > P6 > P7** — P2 (the Callback Machine) is Shea's
"little dishes of pre-cooked food" implemented as a button, and rises to
co-headliner alongside P1. The overall build order below reflects this: P1 and P2
ship in the same wave (P2 consumes P1's derivations).

**The P5 constraint is confirmed.** The lens flagged `hooks[].status` cycling as the
one item in this document that brushes anti-lazy territory (a ledger the DM must
keep current). The constraint is now part of P5's definition: pillars and player
flags ship first; hooks ship only strictly optional — never surfaced as a gap,
never a nag, filled by players at session zero.

**Five refinements join the track** as first-class items (full specs in
`lazy-dm-lens.md` §4):

| # | Refinement | Size | Schema |
|---|-----------|:----:|--------|
| R1 | Lazy prep path in the Session Prep Wizard (Strong Start → Beats → Secrets check → Go); surfaces the shipped `beats` mechanism at prep time | M | none preferred (reuse `prepNotes`; `SessionLog.strongStart?` is a fallback CANDIDATE) |
| R2 | "Generate ten, keep what you like" in the Secrets Tracker | M | none |
| R3 | One-page session prep sheet (the Prep Document, per session) | M | none |
| R4 | "Here now" filter in the Secrets Tracker (active scene's cast + location) | S | none |
| R5 | Carry unfinished beats forward at session end | S | none |

**Integrated sequencing (plan of record):**

- **Wave 1** — P1 + P2 + R4 + R5, alongside E3 (party-knowledge AI wiring). Zero
  schema across the board. P1's derivations are shared infrastructure for P2.
- **Wave 2** — R1 + P4 + P3 + R2 + R3, alongside E1/E2 (mystery lints sharpen P1's
  loaded-guns panel and P2's sampler).
- **Gate** — the P5 scope decision (pillars/flags now; hooks strictly-optional or
  deferred). Then P5 alongside E7 (same editor, same Tier-1 injection point).
- **Wave 3** — P6 Tier 1, E4 (escalation; also fixes the world simulator's
  memorylessness), then P6 Tier 2.
- **Capstone** — P7 when a real campaign approaches its ending; E6/E8/E9/E12/E13 ride
  opportunistically in whichever wave touches their files.

**Toolkit riders from the Option 4 (DND-AO) evaluation, 2026-08-26** — features, not
tracker elements (full rationale in the evaluation doc's Option 4 addendum): **T1** —
widen R4's "here now" filter by one hop (the active location's controlling faction and
parent-location chain, reusing E10's derivations; S, zero schema); **T2** — a
RelationshipGraph focus lens (dim outside a selected node's 2-hop neighborhood, optional
unrevealed-clue count badge; M, zero schema). Slot opportunistically from Wave 3 —
T1's file (`SecretsTracker.tsx`) is owned by the Wave 2 build until it lands.

---

## Unstructured-play addendum (2026-09-06)

Waves 1 and 2 shipped as planned. The next pass —
[`unstructured-play.md`](unstructured-play.md) — turned from **prep** to **play**: the
Session Runner gained the **Stage** (a scene-optional live where/who/what), the scene list
became a **menu** that can draw from any adventure with a shelf to pull from and put back,
plots gained **pressure** (a countdown clock and an "if ignored" move — the smallest useful
form of E4), the party **spotlight** is read off the running log, and a session can start with
one click. The P5 gate moved by one field: `PlayerCharacter.playerFlags?` (player appetites)
shipped as Table Pulse; `Campaign.pillars?` and `PlayerCharacter.hooks?` remain gated. Ten
Lazy DM / Monte Cook capabilities from a fresh research pass landed alongside (GM Intrusion,
browse the shelf, Extras, Quick Tables, scene-menu suggestions, Lazy DM checklist, strong-start
styles, Ask the Table, location aspects, Make this canon).
