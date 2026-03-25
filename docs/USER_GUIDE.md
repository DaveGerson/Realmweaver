
# RealmWeaver User Guide

<p align="center">
  <img src="https://storage.googleapis.com/aistudio-ux-team-bucket/apps/lu-lp/logo.png" alt="RealmWeaver Logo" width="120">
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

When you open RealmWeaver for the first time, you land on the **Welcome Screen**. Click **"Create New Campaign"** to begin. After you name your world and write a brief setting description, the **First Campaign Wizard** launches automatically. This five-step guided setup walks you through:

1. **World Description** — refine your campaign's setting (at least a sentence or two works; more detail produces better AI output)
2. **Starting NPCs** — the AI generates a set of characters based on your setting; edit names, traits, and secrets before saving
3. **Starting Locations** — the AI proposes key places that fit your world; expand cards to add hidden details
4. **Starter Adventure** — a first adventure with scenes is generated and ready to customize
5. **Go** — all approved content is added to your campaign in one click

You can skip the wizard and build manually at any time by clicking **"Skip"**.

### Using a Demo Template

When creating a campaign, you can load a pre-built template (such as the Winter's Daughter starter scenario) to see a fully populated campaign and explore how everything fits together before building your own.

### Interface Overview

RealmWeaver has three persistent areas:

- **Sidebar (left)** — your campaign's table of contents, organized by entity type. Hover any category and click the **+** icon to create a new entity.
- **Main workspace (center)** — shows dashboards, editors, generators, and tools depending on what is selected.
- **Header (top)** — quick access to tools: DM Coach, Evocation Wizard, Session Runner, Export, and the Mock Mode toggle.

---

## Campaign Management

### Creating and Switching Campaigns

Click the campaign title in the header to return to the **Campaign Selector**. From there you can switch between campaigns, create a new one, or access the **Cross-Campaign Dashboard** for a bird's-eye view of all your campaigns at once.

### Cross-Campaign Dashboard

The Cross-Campaign Dashboard shows all your campaigns as cards, each displaying entity counts, active plot count, last session date, and DM Style badge. From this view you can:

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

---

## Building Your World

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

### Linking Entities

Connections make your world feel alive and improve AI generation quality:

- **NPCs to Factions** — assign an NPC to a faction in the NPC editor; both sides update automatically
- **Locations to Locations** — set a parent location to build hierarchies (e.g., "The Dragon's Lair" inside "Volcanic Peaks"); cycle detection prevents invalid nesting
- **Scenes to NPCs and Locations** — link a scene to the characters and places it involves
- **Articles to Entities** — reference any number of NPCs, locations, or factions from a lore article

When you delete an entity, all references to it across your campaign are automatically removed.

### Adventures and Scenes

An **Adventure** is a folder containing an ordered sequence of **Scenes**. Create an adventure first, then add scenes to it. Each generated scene includes:

- **Read-Aloud Text** — descriptive prose ready to read directly to your players, with a copy button
- **GM Notes** — private notes on goals, motivations, and outcomes
- **Skill Checks** — relevant checks and DCs
- **Rewards** — loot, gold, or story payoffs
- **Beat Tracking** — mark which beats have been hit during play

Drag and drop scenes in the sidebar to reorder them. Open an adventure and click the **Prep Document** tab to compile the entire adventure into a clean, printable markdown document that includes linked NPCs, locations, and scenes.

### Entity History and Versions

NPCs, Locations, and several other entity types maintain a version history. Use the **History** panel in the editor to see previous versions and restore earlier drafts if an AI-assist edit went in the wrong direction.

### Lorebook Articles

The Lorebook is your campaign encyclopedia. Articles are ideal for historical events, religious pantheons, cultural practices, magical systems, and legends. The AI reads Lorebook content when generating new entities, so well-written articles improve consistency across your whole world. Articles support nested organization in the sidebar as a tree structure.

---

## Session Prep

### Session Prep Wizard

Open from the header (or start a session directly from a Session Log). The wizard walks you through five steps:

1. **Adventure** — choose which adventure you are running, or run a session without an adventure
2. **Scenes** — select which scenes from the adventure to include; planned and in-progress scenes are pre-checked
3. **NPCs and Locations** — the wizard automatically pulls NPCs and locations linked to your selected scenes; add or remove extras with a search filter
4. **Plot Threads** — select which active plots are in play this session
5. **Go Live** — set a session title and write optional prep notes, then launch the Session Runner

If no adventure is selected, the scenes and entities steps are skipped automatically.

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

On mobile, the three columns collapse into tabs you can swipe between.

### Running Log

The Running Log sits at the bottom of the Session Runner. Use it to capture notes without leaving the screen:

- Type a note and hit Enter (or use the **voice button** to dictate hands-free via browser speech recognition)
- Tag notes as Combat, NPC, Decision, Loot, or Discovery
- Use `@` to mention entities by name — they become clickable links
- Toggle **Important Only** to filter the log to highlighted entries
- System events such as scene transitions, dice rolls, and NPC creation are automatically logged with color-coded icons

### Voice Capture

Tap the microphone icon in the Running Log to start voice capture. RealmWeaver uses browser speech recognition to transcribe your words in real time. Speak naturally — the captured text appears as a note entry. For higher-quality transcription, add a Google Cloud API key in Campaign Settings.

### Quick NPC Generator

In the right panel of the Session Runner, the **Quick NPC Generator** lets you create a new NPC on the fly without leaving the runner. The new NPC is immediately added to your campaign and can be linked to the active scene.

### Session Timer

A live session timer displays in the Session Runner header, counting up from when the session started. The start time persists if you navigate away and return.

### Combat Tracker

Access the **Combat Tracker** from the quick tools panel or the sidebar. Add combatants (NPCs and player characters), set initiative values, track HP and conditions, and advance through rounds. Encounter results are recorded in the session log automatically.

---

## After the Session

### Session End Wizard

When you click **End Session** in the Session Runner, the **Session End Wizard** opens and guides you through five steps:

1. **AI Recap** — paste or dictate your session notes and click **Generate Recap**. The AI writes a summary of the session and detects unresolved loose ends.
2. **Plot Status** — for each plot linked to the session, mark it as Advanced, Stalled, or Unchanged
3. **Loose Ends** — review the AI-suggested loose ends and add your own; these carry forward into the next session
4. **Player Recap** — the AI generates a player-facing version of the recap (spoiler-free) you can copy and share with your group
5. **Save and End** — saves everything and closes the runner

### Session Logs

All session data is stored in **Session Logs**, accessible from the sidebar. Each log records the adventure played, planned scenes, running notes, structured note entries, plot progressions, loose ends, the GM recap, and the player-facing recap. You can edit any field after the session ends.

---

## Advanced Features

### World Simulation

Access from the header under the tools menu. The **World Simulation Wizard** lets you fast-forward time between sessions and see what your world has been doing without the players:

1. Set how much time has passed (1 day to 6 months)
2. Click **Simulate** — the AI generates world events involving your factions, NPCs, locations, and plots, rated as Minor, Major, or Critical
3. Review the events and the specific entity field changes each one proposes
4. Approve or reject individual events
5. Click **Apply** — approved changes are written directly to your campaign

This is useful before a time-skip, to simulate faction politics while players were off-screen, or to give the world a sense of momentum.

### Continuity Checker

Access from the header. The Continuity Checker scans your entire campaign data against eight rule-based checks and surfaces issues at three severity levels:

- **Errors** (red) — definite problems, such as scenes referencing deleted NPCs
- **Warnings** (amber) — likely issues, such as an adventure with no scenes
- **Info** (blue) — notable gaps worth reviewing, such as NPCs without a faction

Click any issue to navigate directly to the entity with the problem. Dismiss issues you have intentionally set up that way. Run the checker before session prep to catch problems before they surface at the table.

### Secrets and Clues Tracker

Available from the **Quick Tools** panel in the Session Runner, and from the sidebar in Power mode. The Secrets Tracker lets you catalog four types of information:

- **Secrets** — hidden truths players do not know yet
- **Clues** — discoverable hints pointing toward secrets
- **Revelations** — information the players have already learned
- **Rumors** — hearsay that may or may not be true

Each entry can be linked to specific entities — the NPC who holds the secret, the location where the clue can be found, the faction the revelation implicates. Use the category filter tabs to focus on one type at a time.

### Relationship Graph

Access from the **Relationships** view in the sidebar. The graph is a live, interactive visualization of how all your entities connect:

- **Nodes** represent NPCs (green), factions (indigo), locations (amber), items (purple), adventures (blue), scenes (red), and articles (cyan)
- **Edges** show relationships — faction membership, scene links, location hierarchy, article references
- **Click** any node to jump to that entity's editor
- **Zoom and pan** to explore dense connection webs
- **Toggle entity type filters** to reduce clutter

The graph uses D3 force-directed layout and updates as your world grows.

### Plot Timeline

Found inside the **Plots** view. The Plot Timeline shows each of your active plots as a horizontal row, with sessions as columns. For each session, a colored dot shows the plot's status that session: Advanced (filled), Stalled (ring), or Unchanged (hollow). Hover a dot for the exact status. Click a plot row or a session column to navigate there. Six rotating accent colors keep plots visually distinct even at scale.

### RealmChat

The **RealmChat widget** (blue chat icon in the bottom-right corner) is a floating conversational AI assistant. Unlike the entity generators in dashboards, RealmChat is open-ended and multi-turn:

- Chat freely — ask it to create entities, iterate on ideas, or brainstorm
- Drafts appear in the right panel of the widget as you chat
- Click any draft to open a full entity editor inline
- Click **Approve** to add the finished entity to your campaign

RealmChat persists your conversation history for the session (stored in sessionStorage per campaign). Use the model tier selector to choose between **Performance** (fastest), **Medium** (default), or **Quality** (deepest reasoning) depending on your needs.

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

### Other Keyboard Navigation

- **Escape** — closes any open dialog or modal
- **Arrow keys** — navigate lists in dashboards (roving tabindex pattern)
- **Enter or Space** — activate the focused item in a list
- **Tab** — move between interactive elements in the standard order

---

## DM Style Settings

RealmWeaver has three experience modes, set in the **Campaign Setting Editor** under DM Style:

| Mode | Who it is for | What changes |
|------|--------------|--------------|
| **Guided** | New DMs or players new to the app | Hides advanced tools to reduce overwhelm: Continuity Checker, Relationship Graph, Plot Timeline, Backlinks Panel, Secrets Tracker, Combat Tracker, keyboard shortcut hints |
| **Standard** | Most DMs | All core features visible; advanced tools accessible |
| **Power** | Experienced DMs who want everything | All features and panels always shown |

Switching modes does not delete anything — it only shows or hides controls. Individual features can also be manually toggled on or off regardless of mode using the feature override toggles in the settings panel. This lets you, for example, run in Guided mode but enable the Combat Tracker.

---

## Mock Mode

Toggle **Mock Mode** in the header to use RealmWeaver without any AI API calls.

In Mock Mode:
- All generation buttons return pre-written, realistic sample data
- The full UI and every workflow is functional
- Wizards, the Session Runner, and all dialogs work normally
- Useful for learning the app, offline preparation, or demonstrating it to others

Switch back off to use your actual AI backend.

---

## Import and Export

### Exporting

Click **Export** in the header to save your campaign data:

- **JSON** — a complete backup of all campaign data. Can be re-imported into RealmWeaver. Use this for backups and for moving campaigns between devices.
- **Obsidian Markdown** — exports your campaign as a folder of interlinked markdown files, compatible with Obsidian, Logseq, or any markdown editor.

### Importing

- **Campaign JSON** — re-import a previously exported RealmWeaver campaign
- **PDF Character Sheets** — upload a PDF character sheet for a player character; the AI parses it to extract name, class, level, stats, and backstory automatically

### Data Storage

RealmWeaver stores all data in your browser's **localStorage**. This means:
- Your data stays on your device — nothing is sent to a server except AI generation requests
- Data persists between browser sessions
- Clearing browser data or cookies will delete your campaigns — export regular backups
- Data is tied to your browser; a different browser or device will not see the same campaigns

---

Happy weaving, Dungeon Master.
