
# RealmWeaver User Guide

<p align="center">
  <img src="../public/favicon.svg" alt="RealmWeaver Logo" width="96">
</p>

<h3 align="center">Your AI-powered companion for crafting unforgettable campaigns.</h3>

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Campaign Management](#campaign-management)
3. [Building Your World](#building-your-world)
4. [Session Prep](#session-prep)
5. [Running a Session](#running-a-session)
6. [After the Session](#after-the-session)
7. [Advanced Features](#advanced-features)
8. [Keyboard Shortcuts](#keyboard-shortcuts)
9. [DM Style Settings](#dm-style-settings)
10. [Mock Mode](#mock-mode)
11. [Import and Export](#import-and-export)

---

## Getting Started

### First Launch and the First Campaign Wizard

When you open RealmWeaver for the first time, you land on the **Welcome Screen**. Click **"Create a Campaign"** to begin, or click **"Import an existing campaign"** to load a previously exported RealmWeaver JSON file and pick up right where you left off. After you name your world and write a brief setting description, the **First Campaign Wizard** launches automatically. This five-step guided setup walks you through:

1. **World Description** — refine your campaign's setting (at least a sentence or two works; more detail produces better AI output)
2. **Starting NPCs** — the AI generates a set of characters based on your setting; edit names, traits, and secrets before saving
3. **Starting Locations** — the AI proposes key places that fit your world; expand cards to add hidden details
4. **Starter Adventure** — a first adventure with scenes is generated and ready to customize
5. **Go** — all approved content is added to your campaign in one click

You can skip the wizard and build manually at any time by clicking **"Skip"**.

### Using a Demo Template

When creating a campaign, you can load one of four pre-built templates — **The Sunken Vault** (classic dungeon crawl), **The Crown Conspiracy** (political intrigue), **The Untamed Wilds** (sandbox exploration), or **The Festival of Shadows** (one-shot) — to see a fully populated campaign and explore how everything fits together before building your own.

Separately, the First Campaign Wizard's **"Try a Demo World"** button quick-fills the world-description field with the *Winter's Daughter* sample setting. That is a starting prompt, not a populated campaign — the AI then generates NPCs, locations and an adventure from it as usual.

### Interface Overview

RealmWeaver has three persistent areas:

- **Sidebar (left)** — your campaign's table of contents, organized by entity type. All entity sections start expanded so your content is immediately visible. Hover any category and click the **+** icon to create a new entity. After completing the First Campaign Wizard, all sections automatically expand to reveal the content that was just created.
- **Main workspace (center)** — shows dashboards, editors, generators, and tools depending on what is selected.
- **Header (top)** — the campaign menu (switch campaigns, create, import, export), global search, the save indicator, and quick access to the Continuity Checker, Evocation Wizard, World Simulation, Session Weaver (session prep), DM Coach, the keyboard shortcuts list, and the Mock Mode toggle.

### Button Visual Hierarchy

Buttons throughout RealmWeaver follow a consistent design system so you always know what a click will do:

- **Amber (primary)** — the main action on any panel or dialog (e.g., Generate, Add to Campaign, Save)
- **Gray (secondary)** — alternative or neutral actions alongside a primary button (e.g., Skip, Cancel, Back)
- **Ghost (subtle)** — low-emphasis actions that should not compete visually (e.g., inline edit toggles, expand/collapse controls)
- **Red (destructive)** — actions that delete or permanently remove data; these always require confirmation

---

## Campaign Management

### Creating and Switching Campaigns

Click the campaign title in the header to return to the **Campaign Selector**. From there you can switch between campaigns, create a new one, or access the **Cross-Campaign Dashboard** for a bird's-eye view of all your campaigns at once.

### Cross-Campaign Dashboard

The Cross-Campaign Dashboard shows all your campaigns as cards, each displaying entity counts, active plot count, last session date, and DM Style badge. Use the **search bar** at the top to filter campaigns by title or setting name — useful when you have many campaigns and want to jump to one quickly. From this view you can:

- Switch to any campaign with one click
- Duplicate a campaign (useful for branching what-if scenarios)
- Delete a campaign you no longer need

### Campaign Setting Editor

Found under **Setting** in the sidebar, this is where you configure your campaign's core properties:

- **Title** — your campaign's name
- **Setting Type** — choose **Custom** to write your own world description, or **Official** to pick a published setting (Forgotten Realms, Ravenloft, Eberron, DragonLance, etc.). Official settings make generators search for lore-accurate content.
- **World Setting Synopsis** — a free-form description of your world, its history, and current state. This text is the single most important input for AI consistency. Write two to five paragraphs for best results.
- **Writing Style Profile** — see [Style Matching](#style-matching) below.
- **Google Cloud API Key** — optional; enables real-time voice transcription in session logs.

### Saving, Backups, and Multiple Tabs

RealmWeaver saves continuously in the background. The **save indicator** sits in the header (hidden on very narrow screens) and shows one of four states:

| Indicator | Meaning |
|-----------|---------|
| **Saving...** (spinner) | A write is in flight |
| **Saved** | Everything is on disk. Hover the indicator to see the exact time of the last save |
| **Save Failed (Retry)** | The write failed. Click the indicator to retry immediately |
| **Saved (fallback storage)** | Your browser's localStorage is full, so the save was written to a fallback IndexedDB store instead. Your data is safe, but free up storage space to restore normal saving |

Saves are debounced — a burst of typing settles into one write — but a save is never delayed more than ten seconds, and any pending write is flushed when you close, reload, or switch away from the tab. Press **Ctrl+S** (**Cmd+S**) at any time to force a save.

Every save also rotates three recent backup snapshots. If RealmWeaver ever finds your saved data unreadable at startup, it loads the most recent intact backup and shows a **recovery notice** across the top of the app:

> Your saved campaign data couldn't be read and was recovered from a recent backup — a small amount of very recent work may be missing.

Click **Dismiss** once you have checked your campaign over.

**Working in two tabs at once.** If another browser tab writes campaign data while this tab has its own unsaved changes, RealmWeaver pauses autosave here and shows a conflict banner:

> This campaign was changed in another browser tab. Autosave is paused here until you choose which copy to keep.

You get two choices, and autosave resumes as soon as you pick one:

- **Reload other tab's version** — discard this tab's in-memory copy and adopt the saved snapshot the other tab wrote
- **Keep mine** — force this tab's copy over the other tab's, overwriting it

Neither choice merges the two copies. If you are unsure which is newer, export a JSON backup from one tab before deciding.

---

## Building Your World

### How a Campaign Fits Together

You don't need to know anything about data modeling to use RealmWeaver — the app thinks about your campaign the same way you already talk about it. Everything you create lives in one of three layers:

- **The world** — the setting you build: characters, places, organizations, objects, and lore.
- **The story** — what you plan to happen: adventures broken into scenes, ongoing plot threads, and the secrets you're waiting to reveal.
- **The table** — what actually happens: session plans and logs, your players' characters, live combat, and quick notes.

Every connection in RealmWeaver reads as a plain sentence — *a scene takes place at a location; a faction is led by an NPC*. Here is each layer in those terms. Every one of these connections is optional: a lone NPC with no faction is perfectly valid, and nothing breaks if you skip a link. One more thing worth knowing before you read: every type keeps one accent color everywhere in the app — dashboards, search results, the relationship graph — so once you know that NPCs are amber and locations are emerald, you can read any screen at a glance.

**The world — the setting you build**

- **NPCs** *(amber)* — everyone your players might meet. Find them under **NPCs** in the sidebar.
  - An NPC *belongs to* a faction.
  - An NPC *has named relationships* with other NPCs and player characters — "rival", "mentor", "family".
  - An NPC *keeps a history* of what has happened to them, session by session.
- **Locations** *(emerald)* — the places. Find them under **Locations**.
  - A location *sits inside* a bigger location — "The Crypt" inside "The Ruined Monastery" inside "The Ashen Vale".
  - A location *connects to* other locations, and *is controlled by* a faction.
  - A location *holds* points of interest and hidden loot.
- **Factions** *(violet)* — organizations with shared goals. Find them under **Factions**.
  - A faction *has members* and *is led by* an NPC.
  - A faction *keeps its headquarters at* a location, and *controls* territory.
- **Items** *(sky)* — treasures, artifacts, and key props, under **Items**. An item points at nothing — the rest of your world points at it: mention an item in lore, a plot, or a secret to weave it into the story.
- **Lorebook Articles** *(cyan)* — your world encyclopedia: lore, history, cosmology. Find them under **Lorebook**.
  - An article *nests under* a parent article, building a tree.
  - An article *can reference* anything else in your campaign.

**The story — what you plan to happen**

- **Adventures** *(orange)* — story arcs with a hook, a theme, and a level. Find them under **Adventures**.
  - An adventure *contains* an ordered list of scenes.
- **Scenes** *(blue)* — your prep unit for one moment of play: combat, social, exploration, or puzzle. They live inside their adventure in the sidebar.
  - A scene *takes place at* a location and *features* NPCs.
  - A scene *carries* read-aloud text, private GM notes, skill checks, and rewards.
- **Plots** *(yellow)* — ongoing storyline threads, tracked as active, dormant, or resolved across sessions. Find them under **Plots**.
  - A plot *involves* anything in your world — NPCs, locations, factions, items.
- **Secrets** — what the players don't know yet: secrets, clues, revelations, and rumors. They live in the [Secrets & Clues Tracker](#secrets-and-clues-tracker).
  - A secret *concerns* the entities it is linked to — the NPC who holds it, the place where it is buried.
  - A secret *is marked revealed* when the moment comes, and *remembers which session* revealed it.

**The table — what actually happened**

- **Session Logs** *(rose)* — one per game night. Find them under **Session Logs**; the [Session Prep Wizard](#session-prep-wizard) builds one, and the Session Runner runs it.
  - Before play, a session *plans* the scenes, NPCs, and locations you expect to use.
  - During play, its running log *records* events as they happen.
  - After play, it *keeps* the recap and loose ends, and *records how each plot moved* — advanced, stalled, or unchanged.
- **Player Characters** *(teal)* — your players' heroes, under **Player Characters**. Like items, they point at nothing — the rest of the world *points at them*: NPC relationships, session plans, mentions.
- **Live combat** — initiative and HP for the current fight, in the [Combat Tracker](#combat-tracker). A combat *scene* is your prep; the live fight is its own thing at the table, and when the session ends it *is archived into* that session's log.
- **Notes** *(slate)* — quick freeform thoughts, under **Notes**. Deliberately connected to nothing, so you can jot without filing.

Two things are worth knowing about how the layers behave:

- **Connections maintain themselves.** Assign an NPC to a faction and the faction's member list updates too; type an `@`-mention in any description and both entities remember it; delete anything and every reference to it is cleaned up automatically (see [Linking Entities](#linking-entities)).
- **Player choices aren't pre-scripted.** RealmWeaver doesn't ask you to author branching decision trees. You prep scenes and secrets, your players do something unexpected at the table, and the running log and Session End Wizard *record* what actually happened — the world updates to match reality, not the other way around.

**A build order that works** (start anywhere — this is a well-worn path, not a rule):

1. **Set the stage** — create the campaign and write a world synopsis in the Campaign Setting Editor.
2. **Sketch the world** — a handful of NPCs, locations, and factions; link them as you go.
3. **Plan the story** — create an Adventure, then break it into ordered Scenes.
4. **Open plot threads** — add Plots for the storylines you want to track, linked to the entities they involve.
5. **Plant secrets and clues** — in the Secrets & Clues Tracker, write down what's hidden and connect each entry to who or where it lives.
6. **Prep the session** — the Session Prep Wizard turns your scenes, cast, and plots into a plan.
7. **Play, then close the loop** — run the session with the Session Runner, and let the Session End Wizard capture the recap, loose ends, and plot progress that feed your next prep.

Prefer a visual tour? The [campaign model walkthrough](architecture/campaign-model-walkthrough.html) covers this same picture as an interactive page — a clickable map of all twelve types with one example story running through it (open it in a browser).

### Entity Types

RealmWeaver organizes campaign content into these entity types, all accessible from the sidebar:

| Type | What it covers |
|------|---------------|
| **NPCs** | Characters — allies, villains, shopkeepers, anyone the players might meet |
| **Locations** | Places — cities, dungeons, taverns, regions; can be nested in hierarchies |
| **Factions** | Organizations, guilds, cults, governments, any group with shared goals |
| **Items** | Artifacts, weapons, treasures, key props |
| **Adventures** | Story arcs that contain ordered scenes |
| **Scenes** | Individual encounters, set pieces, or story beats within an adventure |
| **Lorebook Articles** | Lore entries, historical records, religion, culture, world encyclopedia |
| **Session Logs** | Records of past, present, and future game sessions |
| **Player Characters** | Your players' characters, imported or entered manually |
| **Plots** | Ongoing storyline threads tracked across sessions |
| **Notes** | Quick freeform notes that do not fit other categories |

### Two Ways to Create Entities

Every entity type offers two creation modes, selectable via tabs at the top of the creation panel:

**Form Mode (Prompt + Structured Inputs)**
Write a description of what you want in the prompt field. Use **prompt chips** — quick-select buttons like "A mysterious merchant" or "A guard captain with a secret" — to fill the field instantly. Click **Create** and the AI generates a fully detailed entity using your world setting and existing campaign content as context.

**Chat Mode**
Switch to the Chat tab to talk with the AI conversationally. Describe what you have in mind, ask for changes, and iterate until the entity feels right. The AI builds a live draft in the right panel as you chat. When satisfied, click **Add to Campaign**.

### Editing Entities

Click any entity in the sidebar to open its editor. Every field is editable. Look for the **sparkle icon** next to text fields — clicking it asks the AI to generate or rewrite that specific field using the entity's other information as context.

Edits save themselves as you type. In the NPC, Location, Faction, Article, and Plot editors, the rich `@`-mention fields settle a moment after you stop typing, and anything still in flight is written out the instant you click away to another entity — so jumping straight from one NPC to the next never strands a half-typed paragraph on the wrong character.

### Linking Entities

Connections make your world feel alive and improve AI generation quality:

- **NPCs to Factions** — assign an NPC to a faction in the NPC editor; both sides update automatically
- **Locations to Locations** — set a parent location to build hierarchies (e.g., "The Dragon's Lair" inside "Volcanic Peaks"); cycle detection prevents invalid nesting
- **Scenes to NPCs and Locations** — link a scene to the characters and places it involves
- **Articles to Entities** — reference any number of NPCs, locations, or factions from a lore article

When you delete an entity, all references to it across your campaign are automatically removed.

### Deleting Adventures

To delete an adventure, open it in the editor and use the **Delete** button. Deleting an adventure also removes all its scenes and cleans up any references to those scenes elsewhere in your campaign.

### Adventures and Scenes

An **Adventure** is a folder containing an ordered sequence of **Scenes**. Create an adventure first, then add scenes to it. Each generated scene includes:

- **Read-Aloud Text** — descriptive prose ready to read directly to your players, with a copy button
- **GM Notes** — private notes on goals, motivations, and outcomes
- **Skill Checks** — relevant checks and DCs
- **Rewards** — loot, gold, or story payoffs

Drag and drop scenes in the sidebar to reorder them. Open an adventure and click the **Prep Document** tab to compile the entire adventure into a clean, printable markdown document that includes linked NPCs, locations, and scenes.

### Backlinks Panel

The **Backlinks Panel** appears in entity editors and shows every other entity in your campaign that references the current one. The collapsed header displays a count at a glance (for example, "Referenced By (3)"), so you can quickly see how connected an entity is without opening the panel. Expand it to see the full list and click any entry to navigate there directly.

Backlinks cover structural links (faction membership, scene casts, location hierarchy, article references) *and* `@`-mentions typed into any entity's text — NPCs, locations, factions, articles, plots, and scenes are all scanned as mention sources. Session logs, player characters, and notes get backlinks too: opening a player character shows the articles, plots, and NPC relationships that point at them.

### Entity History and Versions

NPCs, Locations, and several other entity types maintain a version history. Use the **History** panel in the editor to see previous versions and restore earlier drafts if an AI-assist edit went in the wrong direction.

### Lorebook Articles

The Lorebook is your campaign encyclopedia. Articles are ideal for historical events, religious pantheons, cultural practices, magical systems, and legends. The AI reads Lorebook content when generating new entities, so well-written articles improve consistency across your whole world. Articles support nested organization in the sidebar as a tree structure.

---

## Session Prep

### Tonight's Table

**Tonight's Table** sits at the top of the sidebar and answers one question: what matters tonight. It reads what you have already written, so there is nothing to keep up to date.

- **Previously on** — the recap and loose ends from your last completed session, in the words you wrote them.
- **Open threads** — your active plot threads, stalest first, each labelled with how many sessions have passed since one moved it forward. A thread nobody has touched in four sessions sits at the top.
- **Who's been offstage** — your cast ranked by how long since the table saw them. An NPC counts as on stage when the running log tags them, when a session plans them, or when a planned scene features them.
- **Loaded guns** — secrets you have not revealed yet that concern someone or somewhere the next session already plans to visit, or that was on stage last time.

One button, **Prep tonight's session**, opens the Session Prep Wizard from here. Click any thread or name to go straight to it.

### Session Prep Wizard

Open the **Session Weaver** from the header (or start a session directly from a Session Log). The wizard walks you through five steps:

1. **Adventure** — choose which adventure you are running, or run a session without an adventure
2. **Scenes** — select which scenes from the adventure to include; planned and in-progress scenes are pre-checked
3. **NPCs and Locations** — the wizard automatically pulls NPCs and locations linked to your selected scenes; add or remove extras with a search filter
4. **Plot Threads** — select which active plots are in play this session
5. **Go Live** — set a session title and write optional prep notes, then launch the Session Runner

If no adventure is selected, the scenes and entities steps are skipped automatically.

Would rather prep light? Toggle **Lazy prep** on the first step and the wizard trades those middle steps for three quick moves: write a strong start — the first thing you'll say when the session starts — list a few beats for what might happen, and take a glance at your still-unrevealed secrets. It works alongside whichever adventure you picked, so the cast and places you would have gathered anyway are still there for that glance, then you go live the same way.

### Preparing Without the Wizard

You can also prep manually:

- Create a **Session Log** and link it to an adventure
- Review your **adventures and scenes** in the editor
- Open the **Prep Document** in your adventure for a printable overview
- Check your **Plots** dashboard to review active storylines
- Use **DM Coach** for narration and improv practice

---

## Running a Session

### Session Runner Layout

The Session Runner is a three-column live-game interface:

- **Left column — Scene List** — the planned scenes for the session in order; click any scene to jump to it; the current scene is highlighted
- **Center column — Active Scene** — the full active scene view: read-aloud text with a copy button, GM notes, linked NPCs with relationship dynamics summary, linked location, and a Next Scene button
- **Right column — Quick Tools** — DM Coach shortcut, dice roller, Secrets Tracker, plot status cycling, and Quick NPC Generator

On mobile, the three columns collapse into tabs you can swipe between, and a floating **Quick Tools** button appears in the bottom-right corner with shortcuts to DM Coach, the Dice Roller, and — when your DM Style mode shows them — the Combat Tracker and Secrets & Clues. The menu is fully keyboard-operable: opening it moves focus to the first item, Up/Down arrows move between items, and Escape closes it and returns focus to the button.

### Beats

Beats are a loose checklist that belongs to the session as a whole, not to any single scene — quick one-line prompts for what might happen tonight rather than a fully worked-out plan. List a few from the Session Prep Wizard before the table sits down, or add one straight from the Scene List panel while you play. Check one off when it lands, edit the wording if the story bends, or remove it if you never got to it — nothing here is locked in, so jot down more than you expect to use.

### Running Log

The Running Log sits at the bottom of the Session Runner. Use it to capture notes without leaving the screen:

- Type a note and hit Enter (or use the **voice button** to dictate hands-free via browser speech recognition)
- Tag notes as Combat, NPC, Decision, Loot, or Discovery
- Use `@` to mention entities by name — they become clickable links
- Toggle **Important Only** to filter the log to highlighted entries
- System events such as scene transitions, dice rolls, and NPC creation are automatically logged with color-coded icons

### Voice Capture

Tap the microphone icon in the Running Log to start voice capture. RealmWeaver uses browser speech recognition to transcribe your words in real time. Speak naturally — the captured text appears as a note entry. The microphone button only appears in browsers that support speech recognition.

For a longer-form transcript, open a Session Log and use **AI Scribe**, which streams audio to Google's live transcription service and appends the result to your running notes. AI Scribe requires a Google Cloud API key in Campaign Settings; if the connection fails you get a toast telling you to check the key.

### Quick NPC Generator

In the right panel of the Session Runner, the **Quick NPC Generator** lets you create a new NPC on the fly without leaving the runner. The new NPC is immediately added to your campaign and can be linked to the active scene.

### Session Timer

A live session timer displays in the Session Runner header, counting up from when the session started. The start time persists if you navigate away and return.

### Combat Tracker

Access the **Combat Tracker** from the quick tools panel or the sidebar. Add combatants (NPCs, player characters, or ad-hoc monsters), set initiative values, track current/max HP, and advance through rounds. Each combatant also has a freeform **Notes** field — use it for conditions, resistances, or tactics reminders.

Details worth knowing at the table:

- **Sort by initiative** reorders the list without changing whose turn it is. Sorting mid-fight never skips or rewinds a turn.
- **Next/Previous turn** wrap around the order; wrapping forward past the last combatant advances the round, wrapping backward decrements it (never below round 1).
- **HP is not clamped.** The ▲/▼ steppers and the HP field accept values above max HP (temporary hit points) and at or below zero (downed or dying), so the tracker never fights your bookkeeping.
- **Escape** closes the Combat Tracker slide-out. If a dialog is open on top of it, Escape closes that dialog first and leaves the tracker open.
- The active encounter is archived into the session log when you **end the session**. Clicking **End Combat** mid-session clears the board and writes a one-line summary event to the running log — it does not archive that fight's combatant detail, so record anything you want to keep as a note first.

### Dice Roller

The Dice Roller lives in the Session Runner's quick tools. Type a formula (`2d6+4`, `4d6kh3`, `2d20kl1`) or use the preset buttons. `kh`/`kl` keep the highest or lowest N dice — handy for advantage, disadvantage, and ability-score rolls.

Every roll lands in a **History** list. Each history entry is a button — click it (or focus it with Tab and press Enter) to log that roll into the session's running notes, optionally with a note of your own. Logged rolls record the dice that actually counted toward the total, so a `4d6kh3` entry logs the three kept dice, not all four. Logging the same roll twice creates two separate log entries rather than overwriting the first.

---

## After the Session

### Session End Wizard

When you click **End Session** in the Session Runner, the **Session End Wizard** opens and guides you through five steps:

1. **AI Recap** — the wizard reads the notes you captured in the Running Log and writes a summary, also detecting unresolved loose ends. It runs automatically on open once you have five or more logged notes; with fewer, it tells you how many notes it found and waits for you to click **Generate AI Recap** (sparse notes produce unreliable recaps). The generated text is fully editable, and **Regenerate** re-runs it. If generation fails, the error is shown inline with a **Try Again** button.
2. **Plot Status** — for each plot linked to the session, click it to cycle Advanced → Stalled → Unchanged
3. **Loose Ends** — review the AI-suggested loose ends and add your own; these carry forward into the next session
4. **Player Recap** — the AI generates a player-facing version of the recap (spoiler-free) you can copy and share with your group
5. **Save and End** — saves everything and closes the runner

Everything the wizard collects — the GM recap, loose ends, per-plot progressions, and the player-facing recap — is written to the session log when you finish. Reopening the wizard on a session that already has a saved recap loads those values back in rather than starting blank, so a second pass edits your existing text instead of overwriting it with an empty field.

### Session Logs

All session data is stored in **Session Logs**, accessible from the sidebar. Each log records the adventure played, planned scenes, running notes, structured note entries, plot progressions, loose ends, the GM recap, and the player-facing recap. You can edit any field after the session ends. Only one session can be live at a time — the **Start Session** button on a session log is disabled while another log is already active.

---

## Advanced Features

### World Simulation

Access from the header under the tools menu. The **World Simulation Wizard** lets you fast-forward time between sessions and see what your world has been doing without the players:

1. Set how much time has passed (1 day to 6 months)
2. Click **Simulate** — the AI generates world events involving your factions, NPCs, locations, and plots, rated as Minor, Major, or Critical
3. Review the events and the specific entity field changes each one proposes
4. Approve or reject individual events
5. Click **Apply** — approved changes are written directly to your campaign, and a confirmation screen reports exactly how many events were applied and how many entity fields were actually updated. Click **Done** to close.

The simulation only ever rewrites prose. It can touch NPCs (description, traits, backstory, motivations, secrets, stats, example quote), factions (description, goals, alignment, resources, influence), locations (description, secrets), plots (description), and adventures (hook, theme) — nothing else. Structural data such as entity IDs, relationship links, and faction membership is never modified, so a bad suggestion can reword an NPC but cannot rewire your world. If an approved event's proposed changes all fall outside that list, the confirmation screen reports zero field updates.

This is useful before a time-skip, to simulate faction politics while players were off-screen, or to give the world a sense of momentum.

### Continuity Checker

Access from the header. The Continuity Checker scans your entire campaign data against eight rule-based checks and surfaces issues at three severity levels:

- **Errors** (red) — definite problems, such as scenes referencing deleted NPCs
- **Warnings** (amber) — likely issues, such as an adventure with no scenes
- **Info** (blue) — notable gaps worth reviewing, such as NPCs without a faction

Click any issue to navigate directly to the entity with the problem. Dismiss issues you have intentionally set up that way. Run the checker before session prep to catch problems before they surface at the table.

The checker deliberately does not flag items that no lore article references — an item can legitimately live in a scene's rewards or in a player's pack, and the app has no way for you to "fix" the flag.

### Secrets and Clues Tracker

Available from the **Quick Tools** panel in the Session Runner, and from the sidebar in Standard and Power modes (Guided mode hides it unless you turn it back on with a feature override). The Secrets Tracker lets you catalog four types of information:

- **Secrets** — hidden truths players do not know yet
- **Clues** — discoverable hints pointing toward secrets
- **Revelations** — information the players have already learned
- **Rumors** — hearsay that may or may not be true

Each entry can be linked to specific entities — the NPC who holds the secret, the location where the clue can be found, the faction the revelation implicates. Use the category filter tabs to focus on one type at a time.

### Relationship Graph

Access from the **Relationships** view in the sidebar. The graph is a live, interactive visualization of how all your entities connect:

- **Nodes** use each entity type's own accent color — NPCs (amber), locations (emerald), factions (violet), items (sky), adventures (orange), scenes (blue), and articles (cyan) — the same colors used on dashboard cards and search badges
- **Edges** show relationships — faction membership, scene links, location hierarchy, article references
- **Click** any node to jump to that entity's editor
- **Zoom and pan** to explore dense connection webs
- **Toggle entity type filters** to reduce clutter

The graph is keyboard-navigable: press **Tab** to step through nodes (the focused node gets an amber ring) and **Enter** or **Space** to open the focused entity. Each node carries its entity name as its accessible label, and the graph itself is labeled for screen readers.

The graph uses D3 force-directed layout and updates as your world grows.

### Plot Timeline

Found inside the **Plots** view. The Plot Timeline shows each of your active plots as a horizontal row, with sessions as columns. For each session, a colored dot shows the plot's status that session: Advanced (filled), Stalled (ring), or Unchanged (hollow). Hover a dot for the exact status. Six rotating accent colors keep plots visually distinct even at scale.

Plot names and session headers are buttons — click or Tab to them and press Enter to navigate. Each status cell is focusable too, announcing its session and status (for example "Session 4: Advanced") and jumping to that session on Enter or Space, so the timeline can be read and driven entirely from the keyboard.

### RealmChat

The **RealmChat widget** (indigo chat icon in the bottom-right corner) is a floating conversational AI assistant. Unlike the entity generators in dashboards, RealmChat is open-ended and multi-turn:

- Chat freely — ask it to create entities, iterate on ideas, or brainstorm
- Drafts appear in the right panel of the widget as you chat
- Click any draft to open a full entity editor inline
- Click **Approve** to add the finished entity to your campaign

RealmChat persists your conversation history for the browser session, per campaign, and clears it when you start a new chat. Use the model selector to choose between **Fast**, **Smart** (the default), and **Best** (deepest reasoning) depending on what you are asking for.

### Evocation Wizard

Access from the header. The Evocation Wizard generates multiple connected entities at once — useful for rapidly populating a new region, establishing a faction web, or seeding a starting adventure.

**Simple mode** — give a single theme ("A gothic-horror city under a vampire's curse") and receive a set of interconnected NPCs, locations, factions, and an adventure.

**Detailed mode** — write separate prompts for each entity you want, each aware of the others.

**Ingest mode** — paste existing notes, a wiki article, or any text document. The wizard parses it to extract and structure entities.

**Chat mode** — an iterative approach where you build content conversationally.

After generation, preview all results, edit individual entities, select which ones to add, and discard anything that does not fit. Nothing is committed until you approve it.

### Style Matching

Found in the **Campaign Setting Editor** under the Writing Style Profile section. Once you have at least five entities with descriptive text (NPCs, locations, adventures), click **Generate Style Profile**. The AI reads a sample of your descriptions and produces a 200-word style guide that captures your writing voice — tone, vocabulary, sentence structure, use of metaphor, thematic preferences.

Once saved, this profile is automatically injected into every AI generation prompt. The result is AI content that reads like *you* wrote it. You can regenerate the profile as your campaign grows, or clear it to return to the AI's default voice.

---

## Keyboard Shortcuts

### Command Palette (Ctrl+K or Cmd+K)

Press **Ctrl+K** (Windows/Linux) or **Cmd+K** (Mac) from anywhere in the app to open the Command Palette. Type to search across all entity types — NPCs, locations, factions, items, adventures, articles, session logs, plots, player characters, and scenes — by name. Results appear instantly with type badges. Press **Enter** or click a result to navigate directly to that entity. Press **Escape** to close.

The Command Palette also shows **Recent Items** — the last several entities you opened — at the top when the search field is empty.

Selecting a scene from the Command Palette opens that scene directly, not just its parent adventure.

### Global Shortcuts

Press **?** at any time to see this list in-app.

| Shortcut | Action |
|----------|--------|
| **Ctrl+K** / **Cmd+K** | Open search / command palette |
| **/** | Open search / command palette |
| **Ctrl+N** / **Cmd+N** | New entity — jumps to the current view's dashboard |
| **Ctrl+S** / **Cmd+S** | Force an immediate save |
| **Escape** | Close the active modal |
| **?** | Show the keyboard shortcuts list |

Single-key shortcuts (**/** and **?**) are suppressed while you are typing in a text field, so they never interrupt writing. The modifier shortcuts work everywhere.

### Other Keyboard Navigation

- **Arrow keys** — navigate lists in dashboards (roving tabindex pattern)
- **Enter or Space** — activate the focused item in a list
- **Tab** — move between interactive elements in the standard order

Dialogs trap Tab inside themselves while open and skip controls that are hidden behind an in-dialog overlay, so Tab never lands on something you cannot see. Escape closes the topmost layer only — if a picker or sub-dialog is open inside a wizard, the first Escape closes that, not the whole wizard. Clicking a dialog's dimmed backdrop closes it, but a text selection that starts inside the dialog and releases over the backdrop does not, so dragging to select text can no longer discard your work.

---

## DM Style Settings

RealmWeaver has three experience modes, set in the **Campaign Setting Editor** under DM Style:

| Mode | Who it is for | What changes |
|------|--------------|--------------|
| **Guided** | New DMs or players new to the app | Hides advanced tools to reduce overwhelm: Continuity Checker, World Graph, Secrets & Clues, Combat Tracker, and the keyboard shortcuts help |
| **Standard** | Most DMs | All core features visible; advanced tools accessible |
| **Power** | Experienced DMs who want everything | All features and panels always shown |

Switching modes does not delete anything — it only shows or hides controls. Individual features can also be manually toggled on or off regardless of mode using the feature override toggles in the settings panel. This lets you, for example, run in Guided mode but enable the Combat Tracker. The override list shows exactly those five features — every toggle in it changes something on screen.

---

## Mock Mode

Toggle **Mock Mode** in the header to use RealmWeaver without any AI API calls.

In Mock Mode:
- All generation buttons return pre-written, realistic sample data
- The full UI and every workflow is functional
- Wizards, the Session Runner, and all dialogs work normally
- Useful for learning the app, offline preparation, or demonstrating it to others

One exception: **AI Scribe** live audio transcription in the Session Log editor still calls the real Google transcription service and still needs a Google Cloud API key. Everything else routes through the mock.

Switch back off to use your actual AI backend.

---

## Import and Export

### Exporting

Click **Export** in the header to save your campaign data:

- **JSON** — a complete backup of all campaign data. Can be re-imported into RealmWeaver. Use this for backups and for moving campaigns between devices.
- **Obsidian Markdown** — exports your campaign as a folder of interlinked markdown files, compatible with Obsidian, Logseq, or any markdown editor.

### Importing

- **Campaign JSON** — re-import a previously exported RealmWeaver campaign
- **PDF Character Sheets** — upload a PDF character sheet for a player character; the AI parses it to extract name, class, level, stats, and backstory automatically. Files are capped at **3 MB** — larger PDFs are rejected immediately with their size in the error message rather than failing partway through upload. Most character-sheet exports are well under this; if yours is not, print it to a smaller PDF or export a flattened copy.

**What you see after an import.** A clean import shows a success toast naming the campaign. If the file needed repairs — a field that was not a list and got reset, entries dropped for missing IDs, a legacy `name` field migrated to `title` — you get a single toast listing every warning, so nothing is lost to a toast queue that only shows three at a time. Read it before you start editing; it tells you exactly what was changed on the way in.

Files exported by a **newer version of RealmWeaver** are rejected outright with a clear message rather than partially imported. Update the app first.

### Data Storage

RealmWeaver stores all data in your browser's **localStorage**, falling back to **IndexedDB** if localStorage runs out of room (see [Saving, Backups, and Multiple Tabs](#saving-backups-and-multiple-tabs)). This means:
- Your data stays on your device — nothing is sent to a server except AI generation requests
- Data persists between browser sessions
- Clearing browser data or cookies will delete your campaigns, backups and all — export regular backups
- Data is tied to your browser; a different browser or device will not see the same campaigns

---

Happy weaving, Dungeon Master.
