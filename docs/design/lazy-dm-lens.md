# The Lazy DM Lens

> **Status:** ANALYSIS — informs a possible enhancement track; nothing below is adopted.
> **Date:** 2026-08-26
> **Prompted by:** the product owner's "Monte Cook lazy dungeon master" — a conflation worth
> untangling before building anything. The *Lazy Dungeon Master* method is Michael E. Shea's
> (Sly Flourish); Monte Cook's prep philosophy is a distinct body of advice under his own name.
> Both are covered below, correctly attributed, because both usefully press on Realmweaver.
> **Grounding:** `docs/design/dm-archetypes.md` (Archetype 2 is already Shea's method, correctly
> cited), `docs/design/storyteller-first-design.md` (P1–P8), `docs/USER_GUIDE.md`,
> `docs/design/session-cockpit-review.md` (historical, most gaps resolved — used only where its
> claims still check out against source), `docs/architecture/ontology-tracker.md` (E1–E12),
> `docs/architecture/ontology-proposal-evaluation.md` (standing rejections), and the live source
> tree — every "verified" claim below was checked against the file it cites.

---

## 1. Two schools, correctly attributed

### Sly Flourish's Lazy Dungeon Master (Michael E. Shea)

*The Lazy Dungeon Master* (2011) and its expansion *Return of the Lazy Dungeon Master* (2020)
codify prep into eight modular steps, each producing a small, discardable artifact: **(1)** review
the characters, **(2)** create a strong start, **(3)** outline potential scenes, **(4)** define
secrets and clues, **(5)** develop fantastic locations, **(6)** outline important NPCs, **(7)**
choose relevant monsters, **(8)** select magic item rewards. The governing metaphor is Shea's own:
*"you're not building a story, you're setting up little dishes of pre-cooked food so you can
improvise the meal at the table."* Total prep time is 30 minutes to two hours; the technique most
associated with the method — 5–10 secrets and clues you can drop into *any* scene, discarding the
ones you never use without a second thought — is step 4. `docs/design/dm-archetypes.md`'s
Archetype 2 already models this correctly (it names Shea, the book, and the eight steps
verbatim); that attribution does not need fixing. What follows treats it as one of two lenses,
not the only one.

### Monte Cook's player-driven prep

Monte Cook (co-designer of D&D 3rd Edition; founder of Monte Cook Games — Numenera, the Cypher
System, Invisible Sun) publishes a philosophy, not a checklist. Its core moves: prep whatever
specific thing most excites *you*, the GM, rather than working a fixed list of categories; stay
willing to throw prepared material away the instant players go somewhere else; and treat player
choice as the actual engine of the story rather than an obstacle to route around. Two concrete
artifacts carry the philosophy into practice. The **GM Intrusion** (Cypher System / Numenera)
formalizes improvisation itself as a rewarded table mechanic: instead of pre-scripting a
complication, the GM introduces one live, in exchange for XP the player can accept or buy off —
improvising *is* the technique, not a fallback from failed prep. *Your Best Game Ever* (2020)
frames "best game" as a whole-table property — group chemistry, being a fan of your players,
prioritizing fun over any specific plotted outcome — argued at the level of the campaign and the
group, not the session. Monte Cook Games also ships explicitly near-zero-prep products (*Weird
Discoveries*, *Who the Devil Are You?*) built to run from a few pages read minutes before the
table sits down. This lens is now represented by `dm-archetypes.md`'s Archetype 6, the
Player-Driven Improviser; it is a second, distinct voice the product owner's phrasing folded
into Shea's.

### Where they agree, where they diverge

**Agree:** both are explicit reactions against exhaustive scripted prep (what
`dm-archetypes.md` calls "worldbuilder's disease"); both hold that player choice, not a DM
script, should drive the story; both insist prep should be usable at the table, not admired on a
shelf; both treat improvisation as a skill worth building confidence in, never a failure state.

| Axis | Shea | Cook |
|---|---|---|
| Form | a numbered, repeatable checklist producing discrete artifacts | a mindset/prioritization principle plus one concrete mechanic |
| Unit of design | per-session (a weekly loop) | whole-table/whole-campaign (session zero, group chemistry) *and* moment-to-moment (the Intrusion) |
| Signature technique | secrets & clues — over-prepare a cheap list, discard freely | the GM Intrusion — improvise live, formally rewarded |
| System dependence | system-agnostic; written for and adopted by D&D tables | the Intrusion is Cypher-System-specific (an XP currency); the ethos ports, the mechanic doesn't |
| What's literally written down beforehand | a short list per step | often nothing beyond whatever excited the GM enough to write it |

The practical upshot for this document: Shea's method maps onto discrete *product surfaces*
(a checklist has steps, and steps have homes); Cook's maps onto *product posture* — how readily
the app lets a DM discard, improvise, and follow the players rather than the plan. Section 2
below is organized around Shea's eight steps because they are checkable against real screens;
Cook's contribution shows up as a cross-cutting test applied throughout — does this feature assume
the DM's prep survives contact with the table, or does it help when it doesn't?

---

## 2. The weekly loop through Realmweaver as shipped

| Step | Real surface today | Fit |
|---|---|---|
| 1. Review the characters | Player Characters dashboard, `PlayerCharacterImporter`; Session Prep Wizard step 3 auto-gathers scene-linked NPCs | **Partial.** Nothing surfaces *what a given player wants more of* — the shared "read the room" input both schools open with has no home. (P5's proposed `playerFlags` would be the first.) |
| 2. Create a strong start | `SessionPrepWizard`'s step 5 "Prep Notes" freeform textarea (verified: `components/dialogs/SessionPrepWizard.tsx`) | **No first-class home.** Prep Notes is an undifferentiated field for "personal reminders, accents, contingencies" — an opening hook can live there, but it isn't distinguished from any other note, and nothing re-surfaces it prominently once the session goes live. |
| 3. Outline potential scenes | Two homes that don't talk to each other: formal `Scene` entities inside an `Adventure` (five structured fields — read-aloud text, GM notes, skill checks, rewards, plus type/status), or the `SessionLog.beats` checklist — a genuinely lightweight `{title, notes?, isCompleted}` list, added and checked off live in the Session Runner (verified: `types/SessionLog.ts`'s `Beat`, `components/views/session/SceneListPanel.tsx`, `campaignService.addBeat`/`toggleBeatComplete`/`deleteBeat`) | **The tool already exists, in the wrong place.** Beats are exactly Shea's step-3 primitive — no entity, no required fields, check-and-discard. But `SessionPrepWizard` step 2 ("Scenes") only lists formal `Scene`s; there is no wizard step for beats, so a DM who wants to outline five loose scene ideas before the table sits down has to open the live Session Runner to do it. It is also undocumented: `docs/USER_GUIDE.md`'s Running a Session section never mentions Beats, and its one "Beat Tracking" bullet (under Adventures and Scenes) describes something `Scene` doesn't actually have a field for. |
| 4. Define secrets and clues | Secrets & Clues Tracker (`components/tools/SecretsTracker.tsx`) | **Strong structural match, missing the "discard freely" half.** Four categories, any-entity linking, revealed/unrevealed toggle, category filters — but nothing treats an unused secret as a normal outcome the way Shea's "just make another one" framing does: no bulk-generate, no lightweight retire affordance beyond an ordinary delete. |
| 5. Develop fantastic locations | Location entities + AI generation | **Beats paper.** A generated location with a cycle-checked place in the hierarchy is faster and safer to produce than an index-card sketch. |
| 6. Outline important NPCs | NPC dashboard/editor for pre-session work; Session Runner's Quick NPC Generator for live improv | **Beats paper, clearly.** The Quick NPC Generator already runs a full preview → regenerate/edit → save/discard loop, auto-links the new NPC to the active scene, and auto-logs its creation to the running log (verified: `components/views/session/QuickNpcGenerator.tsx`). This is the single step where Realmweaver is unambiguously better than a notecard. |
| 7. Choose relevant monsters | Combat Tracker's ad-hoc combatants | **Right-sized on purpose.** A name, HP, and a notes field is exactly this step's weight for a Lazy DM; Realmweaver's deliberate non-goal of stat blocks and CR math (`dm-archetypes.md`'s "What Realmweaver Is NOT") costs the Tactical DM more than it costs this persona. |
| 8. Select magic item rewards | `Item` entities, `Scene.rewards` free text | **No real friction.** Both are light enough already. |

**Already beats paper, broadly:** autosave with a 10-second flush ceiling and three rotating
backups (per `dm-archetypes.md`'s Lazy DM reconciliation, "closed the laptop, lost the last
twenty minutes" is gone); the Running Log's tags, `@`-mentions, and importance-starring; DM Coach
auto-logging its own output to the running log (verified wired via `campaignService.addAutoEvent`
in `components/dialogs/DmCoach.tsx`); and the Session End Wizard's sparse-notes guard, which
refuses to auto-generate (and therefore half-hallucinate) a recap below five logged notes.

**Slower than a notebook:** logging a secret means opening a separate tool and a four-field form
(title, content, category, links) versus a one-line bullet; the formal `Scene` path for step 3
means five structured fields versus a phone note. Both are avoidable today by using Beats and a
loose secrets note instead — but the wizard doesn't point a DM there.

**No home at all:** the strong start (step 2), and player-appetite input for step 1. Notably, the
"previously on" context this loop opens with — recap and loose ends — *is* both fully built and
split across two different panels (recap truncated to 300 characters in `SceneListPanel`, loose
ends in `ActiveScenePanel`), which is exactly the fragmentation `storyteller-first-design.md`'s P1
diagnoses at the campaign-landing level; it is equally true at the per-session level.

---

## 3. P1–P8 and E1–E12 through the lazy lens

| Rank | Proposal | Why, for this lens |
|---|---|---|
| 1 | **P2 — Callback Machine** | Is Shea's "little dishes of pre-cooked food" implemented as a button: zero-prompt, spends dormant secrets/NPCs/plots instead of demanding a typed prompt. The single closest thing in the P-doc to this method's actual mechanism. |
| 2 | **P1 — Tonight's Table** | Assembles the "what happened last time" front door this section found split across two Session Runner panels; pure derivation, zero DM upkeep — Cook's posture test and Shea's method both pass it cleanly. |
| 3 | **P4 — Engraved moments + cold open** | The cold open is an AI-composed version of a *recap*, not of Shea's step 2 — see Section 4, R1, for why this doesn't fully close the strong-start gap even though it looks like it should. Still a clean, zero-upkeep win on its own terms. |
| 4 | **P8 — Writing-room pass** | Cheap, cosmetic, and the P-doc itself names this persona as disproportionately served — "ceremony reads as work" is a direct hit on a DM who spends 30 minutes prepping. |
| 5 | **P3 — NPC voice cards** | Genuinely useful, but it's craft depth for a 50-session NPC, closer to the Worldbuilder's and Forever DM's concern than to a 30-minute weekly loop. |
| 6 | **P5 — Campaign Charter** *(mixed)* | `pillars?` and `playerFlags?` are exactly right — write once at session zero, then feed step 1 for free forever, zero ongoing upkeep. `hooks[]` with a DM-maintained `status` field is different: it is the one piece of P5 that asks for a ledger kept current during play. Not anti-lazy on its face (Forever DM and New DM both want it more), but flag it — see Section 5. |
| 7 | **P6 — Story Health review** *(mixed)* | Tier 1 (derived, free) is neutral-to-good. Tier 2 is a dialog to open and read on demand — not upkeep, but not lazy-serving either; it is a Forever DM / Worldbuilder feature that happens to not cost this persona anything if ignored. |
| 8 | **P7 — The Chronicle** | Valuable and correctly orthogonal: no weekly upkeep, but no weekly payoff either. Lowest priority *for this lens specifically*, not lowest overall. |

**Anti-lazy flag:** nothing in P1–P8 actively threatens the method, but P5's `hooks[].status`
cycling is the one piece that asks a DM to keep a list current across sessions — precisely the
kind of "bookkeeping few GMs will feed" the ontology evaluation already rejected in its general
form (`docs/architecture/ontology-proposal-evaluation.md`'s "Foreshadow⇄Payoff general ledger"
row). P5's scoped version survives that rejection only because the *player* fills it once, at
session zero; if it ships, it should stay strictly optional and never surface as a gap or a
missed step for a DM who ignores it.

**E1–E12, briefly:** almost all of it is invisible to the weekly loop by design — E1/E2 (mystery
lints), E4 (escalation), E7 (safety lines), E9 (status widening) are schema and lint plumbing that
costs a lazy DM nothing to leave unused, consistent with E5's own principle that GM craft is lint,
never a requirement. E12 (`Scene.expectedDurationMinutes?`, a prep-time total in the wizard) is a
small win only for a DM who is already using formal Scenes — it does nothing for a beats-only
prep. E3 (player-safe AI context) and E10 (context derivations) quietly improve the AI a lazy DM
already leans on hardest without asking for any new input — the best-shaped kind of change for
this persona. None of E1–E12 threaten the method.

---

## 4. Concrete "lazy mode" refinements

**R1 — A lazy prep path in the Session Prep Wizard.** Add an alternate step sequence, selectable
next to today's "No adventure (freeform session)" choice: **Strong Start → Beats → Secrets check
→ Go**, wired to the `beats` mechanism that already ships on `SessionLog` but that the wizard
never surfaces (Section 2, step 3). The "Strong Start" step is a single labeled textarea distinct
from general Prep Notes — plain copy, no field name shown ("Write the first thing you'll say when
the session starts"), consistent with `docs/design/schema-presentation-guide.md`'s tone rules —
and it is *not* the same thing as P4's cold open: P4 composes a recap of the *past* from AI; this
is the DM's own words for what happens *next*, written before the table sits down, exactly
Shea's step 2. Builds on: `types/SessionLog.ts`'s `Beat`, `campaignService.addBeat` /
`toggleBeatComplete` / `deleteBeat` (all shipped), `components/dialogs/SessionPrepWizard.tsx`'s
existing step-order machinery (`computeStepOrder` already branches on the adventure-free path).
Size: **M**. Schema: one **candidate** field, `SessionLog.strongStart?: string` (non-id-bearing) —
try reusing `prepNotes` with a UI-level split first, and only mint the new field if that proves
too cramped; either way it does not join the N-place contract.

**R2 — "Generate ten, keep what you like" in the Secrets Tracker.** A single button that asks the
AI for roughly ten secrets/clues from campaign context in one pass, shown as checkable cards; only
the checked ones are created. This is Shea's step 4 verbatim — over-prepare cheaply, discard the
rest with no cost — and it reuses a pattern the app already has (`QuickNpcGenerator.tsx`'s
generate → preview → keep/discard loop, `EvocationWizard`'s multi-entity preview-then-select
flow). Builds on: `components/tools/SecretsTracker.tsx`, the `aiService.ts` facade, a new
`mockService.ts` entry (required for every AI function). Size: **M**. Schema: none — the shipped
`Secret` type is unchanged.

**R3 — A one-page session prep sheet.** `Adventure` already has a printable "Prep Document" tab
that compiles NPCs, locations, and scenes to markdown (`components/editors/PrepDocumentView.tsx`,
`services/importExportService.ts`'s markdown pipeline) — but nothing compiles a *session's* prep
the same way. A Lazy DM preps a session, not an adventure. Assemble one page from data the wizard
has already collected at Go Live — strong start (R1), beats, the selected NPC/location roster,
active plot threads, and any secrets linked to those entities — into the same printable markdown
form. Builds on: the `PrepDocumentView` precedent, `services/importExportService.ts`'s existing
markdown generation, `SessionLog.plannedNpcIds` / `plannedLocationIds` / `relatedPlotIds` (already
persisted at Go Live). Size: **M**. Schema: none — pure assembly over shipped fields.

**R4 — Scene-context filtering in the Secrets Tracker.** Today the tracker's only navigation is
its four category tabs; add a "here now" filter that shows only secrets linked to the active
scene's NPCs and location. This directly answers Section 2's "slower than a notebook" finding —
a DM mid-scene currently scrolls a flat list instead of glancing at what's actually deployable in
the room. Builds on: `SecretsTracker.tsx`'s existing `linkedEntityIds` filtering logic, the active
scene's `npcIds` / `locationId` already available in the Session Runner. Size: **S**. Schema:
none.

**R5 — Carry unfinished beats forward.** A beat left unchecked at session end currently has
nowhere to go — the next `SessionLog` starts with an empty `beats` array. Offer, in the Session
End Wizard's Loose Ends step, to fold any incomplete beat's title into the loose-ends text (or,
slightly more ambitiously, pre-seed the *next* session's beats from them when that session is
prepped). This is the continuity gap `dm-archetypes.md` names for this persona directly ("with
minimal notes, details from past sessions get forgotten"). Builds on:
`components/dialogs/SessionEndWizard.tsx`'s Loose Ends step, `SessionLog.beats`. Size: **S**.
Schema: none.

---

## 5. What laziness rules out

- **Any per-entity status field the DM must keep current across sessions beyond what already
  exists.** `Plot.status` and `plotProgressions` already ask for a once-per-session tap; that is
  the ceiling. A general foreshadow⇄payoff ledger, per-agent knowledge-confidence matrices, or
  anything shaped like "mark this thing's state every time it changes" is bookkeeping this method
  exists specifically to avoid — and it is already the standing rejection in
  `docs/architecture/ontology-proposal-evaluation.md`'s rejected table. P5's `hooks[].status` (§3)
  is the one live proposal that brushes against this line; keep it strictly optional.
- **Encounter-balancing machinery — XP budgets, CR math, stat-block automation.** Also already
  rejected on architectural grounds (no rules engine, `NPC.stats` is deliberately free text), and
  doubly wrong for this lens specifically: step 7 of the method is "choose relevant monsters," not
  "calculate a fair fight." Building this would serve the Tactical DM at this persona's expense.
- **Any AI surface that requires a crafted prompt as the entry point.** Both schools' shared
  center of gravity is that the DM should not have to *write* their way into help — Shea's steps
  are checklists, not writing prompts; Cook's GM Intrusion is a click-and-go table action, not a
  paragraph. A "help me" feature that opens on an empty textarea (as several DM Coach tools still
  effectively do without a chip clicked first) fights this lens even where it technically has the
  right underlying context.
- **A branching "what if the players choose X" planning tool.** Rejected already
  (`SceneGraph`/`Choice` machinery) and directly contrary to what both schools argue for: Cook's
  ethos is explicit that the DM should be "comfortable throwing it all away to react to the
  fiction," and Shea's method preps *scenes*, not *decision trees*, precisely so a diverging party
  never invalidates the prep. The Callback Machine (P2) is this lens's actual answer to the same
  anxiety a branching tool would try to solve.
