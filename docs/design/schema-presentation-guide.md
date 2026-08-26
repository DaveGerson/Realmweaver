# Schema Presentation Guide

> **Purpose:** How Realmweaver presents its campaign model to Dungeon Masters — on any surface:
> the user guide, the HTML walkthrough, future in-app help. This is the consistency contract
> between those surfaces. The engineering truth lives in
> [`../architecture/semantic-model.html`](../architecture/semantic-model.html); this guide governs
> how that truth is *said*. DM-facing text describes the **shipped model only** — never the
> Section 11 / tracker extensions (E1–E12) until they ship.
> **Audience:** anyone writing DM-facing model explanations. Primary readers of the output:
> the New/Nervous DM and the Published Module Runner ([`dm-archetypes.md`](dm-archetypes.md)).

---

## 1. The fixed skeleton: three tiers, one build order

Every presentation of the model, at any depth, hangs off the same frame, in the same order,
with these exact framings:

1. **The world** — *the setting you build*: NPCs, Locations, Factions, Items, Lorebook Articles.
2. **The story** — *what you plan to happen*: Adventures containing Scenes, Plots, Secrets.
3. **The table** — *what actually happened*: Session Logs, Player Characters, live combat, Notes.

Never drop the table tier — it is half the product. When a "how do I start" order is given, it is
always the same seven steps: set the stage → sketch the world → plan the story → open plot
threads → plant secrets → prep the session → play and close the loop. Present it as a well-worn
path, never a rule.

## 2. The sentence rule and the canonical verbs

Every connection is expressed as a plain-language sentence with a fixed verb. One verb per real
edge, used identically on every surface. Never invent a synonym; never show the field name.

| Sentence (canonical form) | Underlying edge |
|---|---|
| An NPC **belongs to** a faction. / A faction **has members**. | `NPC.factionId` ↔ `Faction.memberIds` |
| A faction **is led by** an NPC. | `Faction.leaderId` |
| A faction **keeps its headquarters at** a location. | `Faction.headquartersLocationId` |
| A location **is controlled by** a faction. / A faction **controls** territory. | `Location.controllingFactionId` |
| A location **sits inside** a bigger location. | `Location.parentLocationId` |
| A location **connects to** other locations. | `Location.connections` |
| A location **holds** points of interest and hidden loot. | `pointsOfInterest` / `loot` |
| An NPC **has named relationships** with NPCs and player characters. | `NPC.relationships` |
| An NPC (or location) **keeps a history** of what happened to it. | `history[]` |
| An article **nests under** a parent article. | `Article.parentArticleId` |
| An article (or plot) **can reference** / **involves** anything. | `relatedEntityIds` |
| An adventure **contains** an ordered list of scenes. | `Adventure.scenes` |
| A scene **takes place at** a location. | `Scene.locationId` |
| A scene **features** NPCs. | `Scene.npcIds` |
| A scene **carries** read-aloud text, GM notes, skill checks, rewards. | scene content fields |
| A secret **concerns** the entities it is linked to. | `Secret.linkedEntityIds` |
| A secret **is marked revealed** / **was revealed in** a session. | `isRevealed` / `revealedInSessionId` |
| A session **plans** scenes, NPCs, and locations. | `plannedSceneIds` / `plannedNpcIds` / `plannedLocationIds` |
| A session's running log **records** events as they happen. | `structuredNotes` |
| A session **records how each plot moved** — advanced, stalled, or unchanged. | `plotProgressions` |
| A fight **is archived into** its session's log. | `SessionLog.encounterLog` |
| Anything **mentions** anything (typed as an `@`-mention); both sides remember it. | `mentionedEntityIds` |

State the sentences flat ("An NPC **belongs to** a faction"), and say **once per surface** that
every connection is optional — never hedge each individual sentence with "can", and never phrase
a connection as a requirement.

Items, player characters, and notes have no outbound sentences. Say so as a feature, in this
shape: "*it points at nothing — the rest of the world points at it*" (items, PCs), "*deliberately
connected to nothing, so you can jot without filing*" (notes).

## 3. Vocabulary: allow / deny

**Allowed nouns** (the shipped model's own names, always these): campaign · NPC · location ·
faction · item · lorebook article · adventure · scene · plot (or plot thread) · secret, clue,
revelation, rumor · session (or session log) · player character · combat / fight · note ·
`@`-mention · point of interest.

**Denied vocabulary** — distilled from the eleven-point do-not-inherit checklist in
[`../architecture/ontology-proposal-evaluation.md`](../architecture/ontology-proposal-evaluation.md)
(Addendum). Never use, on any DM-facing surface:

- **"Story" as a container** — the container between campaign and scene is the *Adventure*.
- **"Scenes contain encounters"** — a scene is prep; a live fight (encounter) is table runtime.
  Keep the split explicit whenever both appear.
- **Quest / Objective** machinery — say adventures, plots, and rewards.
- **Dungeon / Chamber** as types — say nested locations and points of interest.
- **Creature / bestiary / CR / stat-block math** — NPC stats are freeform text.
- **Choice / Option / Consequence trees** — Realmweaver records what happened at the table; it
  never asks the DM to pre-author branches. State this positively when player agency comes up.
- **Lore class trees** (World/Character/Mythical/Hidden lore) — articles have categories; NPC
  lore lives on the NPC.
- **Mystery / Clue / Hidden-Lore as separate types** — there is one Secret with four categories.
- **Faction↔faction alliance/enemy links** — not in the model; describe rivalries in prose.
- **Hard cardinalities** ("an adventure must have at least two scenes") — everything is optional
  by design; craft advice is phrased as advice, never as a requirement of the model.

## 4. Progressive disclosure: three levels

1. **Glance** — the three tier names, each with its one-line framing and its entity names.
   Nothing else. This is the whole model in under a minute; it must survive alone.
2. **Sentence** — per entity: bold name, accent, a one-clause identity, *where you meet it in
   the app* (sidebar item, tracker, wizard), and its canonical sentences from §2. This is the
   overview's floor **and its ceiling**: an overview never goes deeper.
3. **Field detail** — individual fields, statuses, and options. This belongs to the surface
   where the DM edits the thing (editors, the HTML walkthrough's expanded views, contextual
   help) — never to the overview. On interactive surfaces, level 3 may sit behind a disclosure
   affordance (expandable card, popover); levels 1 and 2 are never collapsed or hidden.

Every sentence-level entry anchors the entity to the app: name the sidebar item, or the tool
(Secrets & Clues Tracker, Combat Tracker), or the wizard (Session Prep Wizard, Session End
Wizard). An entity the DM cannot go touch is not explained, only described.

## 5. Identity carriers: accent color and icon

`ENTITY_TYPE_CONFIG` (`utils/entityUtils.ts`) is the single source of entity accents and icons:
npc amber · location emerald · faction violet · item sky · adventure orange · article cyan ·
sessionLog rose · playerCharacter teal · plot yellow · note slate · scene blue.

- **Rich surfaces (in-app, HTML):** use the real accent color dot/chip and the real icon,
  exactly as the app's dashboards and search badges do.
- **Plain markdown:** carry the accent as a *word* — "**NPCs** *(amber)*" — plus one sentence
  telling the DM the color is the same everywhere in the app. Never approximate accents with
  emoji dots: the palette collides (amber/orange/yellow; sky/blue/cyan) and would teach the
  wrong identities. Icons are omitted in markdown.
- Secrets and live combat have **no accent** in the config; do not assign them one anywhere.
- Indigo is reserved for RealmChat on every surface, DM-facing docs included.

## 6. Notation ban

DM-facing text never shows the machinery. Concretely, no:

- cardinality notation (`[0..∞]`, `1:N`, "min 1"), arrows, or `↔`;
- `snake_case` / `camelCase` field names, code font, or type names (`SessionLog` → "session log");
- enum dumps — fold options into a sentence ("tracked as active, dormant, or resolved"), and
  only when the DM can set them;
- data-modeling terms — *entity, schema, hierarchy, bidirectional, reference, metadata* — without
  a plain-word lead doing the actual work ("a location sits inside a bigger location" first;
  "hierarchies" may then name the feature). *Foreign key, cardinality, ontology, graph node*
  never appear at all.

## 7. Tone

Second person, present tense, confident and warm — the voice of the user guide. Open by
disarming ("You don't need to know anything about data modeling…"). Use in-world examples with
concrete fantasy names ("The Crypt" inside "The Ruined Monastery"). State design philosophy
positively ("the world updates to match reality, not the other way around"), never as a missing
feature. Short sentences; bold leads; no exclamation marks; no emoji. When the app maintains
something automatically (both sides of a link, cleanup on delete), say so — self-maintaining
connections are the model's best selling point to a nervous DM.
