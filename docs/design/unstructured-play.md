# Unstructured Play — Running a Session Off the Rails

> **Status:** SHIPPED (2026-09-06). This document is the design record for the
> "less railroady" pass on the Session Runner and the Lazy-DM / Monte-Cook
> capability build that landed alongside it.
> **Prompted by:** the product owner running a real session and finding the
> design "a little too railroady" — built for a DM who arrives with an ordered
> list of scenes and wants to walk it, not for the DM who arrives with a
> situation, follows the players, and improvises the rest.
> **Grounding:** `lazy-dm-lens.md` (Shea's method vs. Cook's posture, R1–R5),
> `storyteller-first-design.md` (P1–P8, the plan of record), `dm-archetypes.md`
> (Archetype 2, the Lazy DM; Archetype 6, the Player-Driven Improviser), and
> the live source tree.

---

## 1. Where the railroad lived

Before this pass the Session Runner had one centre of gravity: **the active
prepped Scene**. Every panel hung off it.

| Surface | What it assumed |
|---|---|
| `SessionLog.adventureId` (singular) + `plannedSceneIds` | tonight's scenes come from ONE adventure, in order |
| `ActiveScenePanel` | "No active scene. Select a scene from the list or advance." — a freeform session had a dead centre column |
| "NPCs Present", cast dynamics, the Combat Tracker's auto-roster, the Callback Machine's scene line, the AI context's "NPCs in Scene" | all derived from `activeScene.npcIds`; with no scene there was no one in the room |
| `handleSelectScene` | clicking any other scene marked the current one **completed** — peeking at scene 4 finished scene 2 |
| `advanceScene` / "Next Scene" (the primary button) | a track, walked forward |
| `Plot` | a title, a description and a status — nothing that says what the world does when the party looks away |
| Session start | the wizard, or nothing; "just sit down and play" had no button |

The prior storyteller waves (Tonight's Table, the Callback Machine, the lazy
prep path, beats, secrets tooling) had already made **prep** lazy-friendly. This
pass makes **play** structure-optional.

## 2. The design in one paragraph

Add a **Stage** — the live where/who/what of the table, owned by the session
and independent of any prepped scene — and make the scene list a **menu**
instead of a track: scenes can come from any adventure, entering one does not
finish the last one, leaving one keeps the room on the Stage, and unused prep
goes back on the shelf without comment. Give plots **pressure** (a countdown
clock and an "if ignored" move) so the world can move on its own. Read the
**spotlight** off the running log so "review the characters" costs nothing.
Add a **one-click freeform start**. Every piece is optional, nothing nags, and
a fully scene-driven session behaves exactly as before.

## 3. What shipped

### 3.1 The Stage (`SessionLog.stage?: SessionStage`)

```ts
interface SessionStage {
  locationId?: string;  // a linked Location (id-bearing)
  place?: string;       // a freeform place when nothing is linked
  npcIds: string[];     // NPCs the DM put on stage beyond the scene's cast (id-bearing)
  focus?: string;       // one line: what is happening right now
}
```

- Rendered by `components/views/session/StagePanel.tsx` at the top of the
  centre column, scene or no scene. Place: search your locations or type three
  words ("a nameless roadside shrine"), with **Save as a location** to promote
  the words to canon. Cast: the scene's own people as fixed chips, the DM's
  additions as removable chips, **Add someone** from a search. Focus: one
  input, committed on Enter/blur.
- **Union rule.** `presentNpcs = sceneCast ∪ stage.npcIds`;
  `presentLocation = stage location ?? scene location`. Every consumer that
  used to read the scene alone now reads the union: NPC cards, cast dynamics,
  the Combat Tracker's auto-roster, Quick NPC's auto-link (a Quick NPC made
  with no scene walks straight onto the Stage), Complicate This / GM Intrusion's
  situation line, and `contextBuilder`'s "NPCs in Scene" + a new **On Stage
  Now** section (place + present are player-visible; `focus` is GM-only).
- **Lifecycle.** Entering a prepped scene clears the Stage (the scene now says
  where the party is). Leaving a scene — "Done" or "Set Aside" — seeds the
  Stage from that scene's place and cast (honouring the prep roster rule from
  finding #26) merged with whoever was already added, so the room persists
  past the script. Advancing past the last scene does the same instead of
  leaving the table nowhere.
- **Every change is logged.** `Moved to: …`, `<Name> enters the scene`,
  `<Name> leaves the scene`, `Now: …` land in the running log as
  `scene-transition` entries — an improvised session gets a timeline for free,
  which is what the recap generator eats.
- **Integrity.** `locationId`/`npcIds` are swept by `_purgeEntityReferences`,
  remapped by `duplicateCampaign` and `importTemplateData`, and
  `normaliseRequiredArrays` guarantees `npcIds` on import.

Store methods: `updateStage`, `setStageLocation(locationId | null, place?)`,
`addNpcToStage`, `removeNpcFromStage`, `setStageFocus`.

### 3.2 The scene menu

- `plannedSceneIds` and `activeSceneId` are resolved **campaign-wide** via
  `resolveSceneById` (`utils/storyDerivations.ts`); `goLive` and `advanceScene`
  no longer require the session's adventure to own the scene. A scene from
  another adventure is labelled with where it came from.
- **Pull a scene from the shelf** (`deriveSceneShelf`): every `planned` /
  `in-progress` scene in the campaign not already in tonight's list, one click
  to add (`addPlannedScene`).
- **Put back on the shelf** (`removePlannedScene`): drops the scene from
  tonight, reopens a started scene as `planned`, steps out of it if it was
  live. The scene itself is untouched — unused prep is inventory.
- `enterScene(sceneId)`: the previous scene stays `in-progress` (shown as
  paused — "come back any time"), a completed scene the DM returns to is
  reopened. `leaveScene({ complete })`: "Done" vs "Set Aside".
- "Next Scene" is still there for the DM who did plan a sequence; it is no
  longer the only exit and hides when nothing follows.
- Beats gain **Play** — the beat's title becomes the Stage's focus.

### 3.3 Pressure on plots (`Plot.clock?`, `Plot.ifIgnored?`)

The Apocalypse World / Blades in the Dark front-and-clock idea, in the smallest
form that helps: `clock: { segments, filled }` (4/6/8 offered; any positive
integer is valid) and `ifIgnored: string` ("what the world does if the party
does nothing"). Set in the Plot editor's **Pressure** block; ticked from the
Session Runner's Active Plots panel (`tickPlotClock`, logged as a
`world-moved` entry); read on Tonight's Table's open threads, in the AI
context's plot lines (`[clock 3/6] … — if ignored: …`), and by the Continuity
Checker's new `clock-expired` **info** rule. Never auto-ticked, never
required, never red. Shared helpers: `utils/plotClock.ts`,
`components/common/ClockPips.tsx`.

### 3.4 Spotlight (zero schema)

Player characters are not @-mention candidates, so their presence is read off
running-log **text**: a note that names the character (full name, or a first
name of three or more letters, Unicode word boundaries) or tags the id counts
as a moment. `countPcSpotlightInSession` drives the runner's **Spotlight
tonight** strip ("quiet so far" is a call to action, not an error);
`derivePcSpotlight` drives Tonight's Table's **Spotlight** panel, quietest
first. Stated as the heuristic it is.

### 3.5 The on-ramp

**Just start playing** (Tonight's Table) / **Start Now** (Session Manager):
`createFreeformSession()` mints a planned freeform session with an empty Stage
and hands the id to the same `goLive` path the wizard uses. `goLive` is now
idempotent for the session that is already live (the wizard called it and then
`App.handleGoLive` called it again, logging "Session started" twice).

### 3.6 The Lazy DM / Monte Cook capability build (parallel lanes)

Designed by a research pass (`lazy-dm-research.md`, scratch) that mapped both
schools against what had already shipped, then built as five parallel lanes:

| Lane | Feature | School |
|---|---|---|
| Quick Tools | **GM Intrusion** (zero-precondition live complication, works in session 1 with nothing dormant), **Browse the shelf** (pick the dormant piece to spend), **Extras** (name + one-line throwaway NPCs, promote on demand), **Quick Tables** (canned, zero-latency) | Cook; Cook; Shea step 6; craft |
| Prep wizard | **Suggest a few** beats (a scene menu, keep what you like), **Lazy DM checklist** (informational mirror of the eight steps), **Strong start styles** (previously on / drop into action / reincorporate) | Shea steps 3, method, 2 |
| Table Pulse | `PlayerCharacter.playerFlags?` ("what this player wants more of") + **Ask the Table** in the DM Coach (between-session questions) | Shea step 1 + Cook |
| Locations | `Location.aspects?` — two or three sensory one-liners, generated with the location or retrofitted | Shea step 5 |
| Canon capture | **Make this canon** on a running-log note (live and post-hoc): note → NPC / Location / Item / Note | Cook |

## 4. What laziness still rules out (unchanged)

The standing rejections in `lazy-dm-lens.md` §5 hold: no per-entity status
ledgers the DM must keep current (a clock is the DM's tool, ticked when the
fiction says so; it is never a required field and never a lint above `info`),
no encounter-balancing math, no AI surface that opens on an empty prompt box
(every new generator here builds its request from campaign state), and no
branching "what if" planner — the Stage records what *is*, it never scripts
what *may*.

## 5. Honest limits

- The spotlight is text matching. A character called by a nickname the log
  never spells out reads as quiet. Making PCs @-mentionable would sharpen it
  and is the natural follow-up.
- The Stage cast is additive over the scene cast; the scene's own people cannot
  be sent out of the room from the Stage (finish or set aside the scene, then
  edit the Stage). This keeps finding #26's roster contract intact.
- Improvised scenes are beats + the Stage, not `Scene` records. "Save this
  situation as a scene" (choosing an adventure) is a possible next step; it was
  left out to avoid minting adventures the DM did not ask for.
