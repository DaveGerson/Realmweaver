
# RealmWeaver User Guide

<p align="center">
  <img src="https://storage.googleapis.com/aistudio-ux-team-bucket/apps/lu-lp/logo.png" alt="RealmWeaver Logo" width="120">
</p>

<h3 align="center">Your AI-powered companion for crafting unforgettable campaigns.</h3>

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [The Interface](#the-interface)
3. [Building Your World](#building-your-world)
4. [Crafting Adventures & Scenes](#crafting-adventures--scenes)
5. [RealmChat: Your Creative Partner](#realmchat-your-creative-partner)
6. [DM Coach: In-Session Assistant](#dm-coach-in-session-assistant)
7. [Evocation Wizard: Batch World-Building](#evocation-wizard-batch-world-building)
8. [Session Management](#session-management)
9. [Combat Tracker](#combat-tracker)
10. [Plot Tracking](#plot-tracking)
11. [Player Characters](#player-characters)
12. [Relationship Graph](#relationship-graph)
13. [Lorebook (Articles)](#lorebook-articles)
14. [Import & Export](#import--export)
15. [Tips & Best Practices](#tips--best-practices)
16. [Mock Mode](#mock-mode)

---

## Getting Started

### Creating Your First Campaign

1. Launch RealmWeaver — you'll land on the **Welcome Screen**.
2. Click **"Create New Campaign"**.
3. Fill in the **Campaign Creator**:
   - **Campaign Title** — name your world (e.g., "The Sundered Crown").
   - **Setting Type** — choose **Custom** to write your own world description, or **Official** to select a published setting like Forgotten Realms.
   - **World Setting** — describe your world in a few sentences. This is important! The AI uses this description as context for everything it generates. More detail here means more consistent content later.
4. Click **"Weave Campaign"** to enter the main editor.

### Switching Between Campaigns

Click the campaign name in the header to return to the **Campaign Selector**, where you can switch between campaigns or create new ones.

---

## The Interface

RealmWeaver has three main areas:

### Campaign Sidebar (Left)

Your campaign's table of contents. Everything is organized into categories:

- **Setting** — your world description and configuration
- **NPCs** — characters in your world
- **Locations** — places, organized in hierarchies
- **Factions** — organizations and groups
- **Items** — artifacts, equipment, treasures
- **Adventures** — story arcs (expand to see scenes)
- **Lorebook** — lore articles and world encyclopedia
- **Session Logs** — records of past and planned sessions
- **Player Characters** — your players' characters
- **Plots** — storyline threads you're tracking

Hover over any category and click the **+** icon to create a new entity.

### Main Editor (Center)

Your primary workspace. Depending on what you've selected, this area shows:
- A **dashboard** listing all entities of a type
- An **editor** for a specific entity's details
- A **generator** form for creating new content
- A **tool** like the combat tracker or relationship graph

### Header (Top)

Quick access to powerful tools:
- **DM Coach** — in-session assistance
- **Evocation Wizard** — batch content generation
- **Mock Mode** toggle — test without API calls
- **Export** — save your campaign data
- **Session Runner** — run a live game session

---

## Building Your World

### Generating Entities

All entity types (NPCs, locations, factions, items) follow the same creation pattern:

1. In the sidebar, hover over the category (e.g., "NPCs") and click the **+** icon.
2. The **generator** appears in the main area. Write a description of what you want:
   - *Good:* "A grizzled old ranger who lost his wolf companion and now runs a lonely tavern at the edge of the wilds."
   - *Vague:* "Make an NPC." (Works, but you'll get generic results.)
3. Click **"Create"**. The AI generates a fully detailed entity using your campaign's world setting and existing content as context.
4. The new entity appears in the sidebar and its editor opens automatically.

**Pro Tips:**
- The more detail in your prompt, the better the result.
- For NPCs, check **"Generate from existing lore"** to create characters based on published D&D material (uses Google Search).
- You can also create entities via **RealmChat** for a more conversational experience.

### Editing Entities

Click any entity in the sidebar to open its editor. Every field is editable.

**AI-Assist:** Look for the sparkle icon next to text fields. Click it to have the AI generate or rewrite that specific field — it uses all the other information about the entity as context, so results are consistent.

### Linking Entities Together

Connections make your world feel alive:

- **NPCs → Factions:** Assign an NPC to a faction in the NPC editor. Both sides update automatically.
- **Locations → Locations:** Set a parent location to build hierarchies (e.g., "The Dragon's Lair" inside "Volcanic Peaks").
- **Scenes → NPCs & Locations:** Link scenes to the characters and places they involve.
- **Articles → Entities:** Reference any number of NPCs, locations, or factions in a lore article.

When you delete an entity, all references to it across your campaign are automatically cleaned up.

---

## Crafting Adventures & Scenes

### Adventures

An **Adventure** is a story arc — a folder that contains an ordered sequence of **Scenes**.

1. Click **+** next to "Adventures" in the sidebar.
2. Give it a title, description, and target level range.
3. Your adventure appears in the sidebar. Expand it to see (and create) scenes.

### Scenes

**Scenes** are the building blocks of adventures — individual encounters, story beats, or set pieces.

1. Hover over your adventure in the sidebar and click **+** to add a scene.
2. Describe the scene you want:
   - *Example:* "The players must negotiate with a suspicious and vain red dragon who is hoarding a stolen artifact they need."
3. The AI generates a complete scene with:
   - **Read-Aloud Text** — evocative descriptions to read directly to your players
   - **GM Notes** — your private notes on goals, motivations, and outcomes
   - **Skill Checks** — relevant checks the players might attempt
   - **Rewards** — loot, gold, or story rewards

**Reordering Scenes:** Drag and drop scenes in the sidebar to change their order within an adventure.

### The Prep Document

Open an adventure and click the **"Prep Document"** tab. RealmWeaver compiles your entire adventure — scenes, linked NPCs, locations, and all — into a clean, copy-pasteable markdown document. Perfect for your session notes or printing.

---

## RealmChat: Your Creative Partner

Click the **chat icon** in the bottom-right corner to open RealmChat.

### What It Does

RealmChat is a conversational AI assistant. Instead of filling out forms, you can *talk* to the AI about what you want to create:

- "I need a mysterious shopkeeper who's secretly a spy for the thieves' guild."
- "Create a haunted library that connects to the shadowfell."
- "Surprise me with a faction that would oppose the Iron Crown."

### The Draft Workflow

As you chat, the AI builds **drafts** of entities in the background:

1. **Chat** — describe what you want, iterate on ideas, ask for changes
2. **Preview** — click any draft to see it in full detail
3. **Edit** — modify the draft before adding it
4. **Approve** — click "Approve" to add the finished entity to your campaign

### Performance Modes

Choose your AI model tier:
- **Performance** — fastest responses, good for quick ideas
- **Medium** — balanced speed and quality (default)
- **Quality** — deepest reasoning, best for complex or nuanced content

---

## DM Coach: In-Session Assistant

Access the DM Coach from the **header** — it's designed for use *during* your game sessions.

### Narrator

Need to describe something on the fly?

- Type: "Describe a bustling fantasy marketplace at dusk"
- Get: Beautiful, evocative read-aloud text instantly

### Improviser

Players doing the unexpected?

- Type: "The players just tried to adopt the goblin they were supposed to fight"
- Get: Creative consequences, future plot hooks, and NPC reactions

### Rollable Tables

Need a random table fast?

- Type: "A d6 table for random tavern patrons" or "Items in a wizard's pocket"
- Get: A structured, rollable table you can use immediately

### Low-Latency Mode

Toggle this on for faster responses during live play. Uses a lighter AI model optimized for speed — perfect for in-the-moment improvisation where every second counts.

### Context Awareness

The DM Coach automatically knows:
- Your active scene, adventure, and location
- Which NPCs are present
- Recent session notes
- Whatever entity you're currently editing

No need to re-explain your world — the Coach already knows.

---

## Evocation Wizard: Batch World-Building

Access the Evocation Wizard from the **header**. It generates multiple connected entities at once.

### Simple Mode

Give it a single theme:
- *Example:* "A gothic-horror city plagued by a mysterious vampire curse."
- **Result:** A set of related NPCs, locations, factions, and even a starting adventure — all interconnected.

### Detailed Mode

For more control, add multiple specific prompts:
- "A corrupt city guard captain who takes bribes"
- "A hidden underground resistance movement"
- "A marketplace where illegal potions are sold"

Each prompt generates its own entity, all aware of each other.

### Ingest Mode

Have existing notes, a wiki page, or a document? Paste the text and the Wizard will parse it to extract entities.

### Chat Mode

An iterative approach — chat with the AI to gradually build out content, refining as you go.

### Reviewing Results

After generation, you can:
- **Preview** everything the Wizard created
- **Edit** individual entities before adding them
- **Select** which pieces to add to your campaign
- **Discard** anything that doesn't fit

---

## Session Management

### Session Logs

Session logs track your game sessions — past, present, and future.

1. Click **+** next to "Session Logs" to create a new one.
2. Add a title, date, and link to the adventure you'll be running.
3. Use the editor to record notes, events, and outcomes.

### Voice Notes

The session log editor supports **microphone-enabled note analysis**:
- Record voice notes during play
- The AI structures your voice notes into organized categories: events, decisions, combat, loot
- Hands-free note-taking while you focus on running the game

### Session Runner

For live sessions, use the **Session Runner** (accessible from the header):
- Scene-by-scene progression through your adventure
- Quick access to DM Coach, combat tracker, and dice tools
- Integrated note-taking
- One-click scene advancement

---

## Combat Tracker

Access from the sidebar under **Combat** or directly from the Session Runner.

### Running an Encounter

1. Add combatants (NPCs and player characters)
2. Roll or set initiative values
3. Track HP, conditions, and turn order
4. Advance through rounds

The combat tracker integrates with your session log — encounter results are recorded automatically.

---

## Plot Tracking

Plots help you manage storylines across multiple sessions so you never drop a thread.

### Creating Plots

1. Click **+** next to "Plots" in the sidebar.
2. Give your plot a title, description, and status (Active, Completed, Failed, On Hold).
3. Link related entities — which NPCs are involved? Which locations matter?

### Tracking Progress

As sessions progress, update your plots:
- Move from Active to Completed when resolved
- Add session references showing when the plot advanced
- Note key decisions that affect the plot's direction

---

## Player Characters

### Adding Player Characters

Two ways to add PCs:

1. **Manual Entry** — click **+** next to "Player Characters" and fill in the details
2. **PDF Import** — upload a character sheet PDF and the AI will parse it automatically, extracting name, class, level, stats, and more

### What PCs Do

Player character data feeds into AI generation:
- The DM Coach considers PC classes, levels, and backstories
- Generated challenges can be tailored to your specific party
- Skill check suggestions reference PC proficiencies

---

## Relationship Graph

Access from the sidebar under **Relationships**.

The relationship graph is an interactive visualization of how your entities connect:

- **Nodes** represent NPCs, factions, locations, and other entities
- **Edges** show relationships — faction membership, location connections, scene involvement
- **Click** any node to jump to that entity's editor
- **Zoom, pan, and drag** to explore your world's web of connections

The graph auto-layouts using force-directed algorithms, so it reorganizes as your world grows.

---

## Lorebook (Articles)

The Lorebook is your campaign's encyclopedia — a place for deep lore, world history, religious systems, cultural notes, and anything that doesn't fit neatly into other entity types.

### Creating Articles

1. Click **+** next to "Lorebook" in the sidebar.
2. Write or generate your article using AI.
3. Link related entities — articles can reference any number of NPCs, locations, and factions.

Articles are especially useful for:
- Historical events
- Religious pantheons
- Cultural practices
- Magical systems
- Legends and myths

The AI uses Lorebook content as context when generating new content, keeping your world consistent.

---

## Import & Export

### Exporting

Click **Export** in the header to save your campaign:

- **JSON** — full-fidelity backup, can be re-imported into RealmWeaver
- **Obsidian Markdown** — export as a folder of markdown files for use in Obsidian or any markdown editor

### Importing

- **JSON** — import a previously exported RealmWeaver campaign
- **PDF Character Sheets** — import player character data from PDF character sheets

### Data Storage

RealmWeaver saves all data to your browser's **localStorage**. This means:
- Your data stays on your device — nothing is sent to a server (except AI generation requests to Google Gemini)
- Data persists between browser sessions
- Clearing browser data will delete your campaigns — use Export to create backups!
- Data is specific to your browser — a different browser or device won't have your campaigns

---

## Tips & Best Practices

### Writing Better Prompts

The AI generates better content when you give it more to work with:

| Instead of... | Try... |
|---------------|--------|
| "Make an NPC" | "A half-elf bard who performs at the Silver Harp tavern and secretly works as an informant for the city guard" |
| "Create a location" | "A crumbling wizard's tower in the Mistwood forest, now inhabited by a colony of intelligent spiders who trade in rare mushrooms" |
| "Generate a scene" | "The players arrive at a peace negotiation between two rival merchant guilds, but discover that the mediator has been charmed by a hidden fey" |

### Building a Consistent World

1. **Fill in your campaign setting first** — this is the foundation for all AI generation.
2. **Link entities to each other** — the more connections, the more consistent AI-generated content will be.
3. **Use the Evocation Wizard for initial world-building** — generate a batch of connected entities to establish your world's baseline.
4. **Write Lorebook articles for important lore** — the AI references these when generating new content.

### Preparing for Sessions

1. Create a **Session Log** for your upcoming session.
2. Review and organize scenes in your adventure.
3. Open the **Prep Document** for a printable overview.
4. Check your **Plots** to remember active storylines.
5. Use the **Session Runner** when it's game time.

### During Sessions

1. Open the **DM Coach** for quick narration, improv help, and tables.
2. Turn on **Low-Latency Mode** in the Coach for faster responses.
3. Use **Voice Notes** to capture what happens without breaking flow.
4. Track combat with the **Combat Tracker**.

### After Sessions

1. Update your **Session Log** with a recap (or let the AI help write one).
2. Update **Plot** statuses — what advanced? What's new?
3. Create any new NPCs, locations, or items that emerged during play.
4. **Export a backup** of your campaign.

---

## Mock Mode

Toggle **Mock Mode** in the header to use RealmWeaver without an AI API key.

In mock mode:
- All AI features return pre-written sample data
- The full UI and workflow is functional
- Great for learning the app before connecting your API key
- Useful for offline preparation or demos

All the same buttons, workflows, and features work — you just get consistent sample output instead of AI-generated content.

---

Happy weaving, Dungeon Master!
