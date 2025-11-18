
# RealmWeaver Roadmap & TODO

This document outlines key user stories and technical tasks to guide the future development of RealmWeaver.

---

## 1. Data Model: Worldbuilding & Entities
**Goal:** Deepen the simulation of the world by expanding how entities are defined and related.

### 1.1. Dynamic Entity Relationships (Bi-Directional Graph)
**As a GM, I want to define specific relationships between NPCs (e.g., "Sibling", "Rival", "Debtor") so that the social web of my campaign is explicit and queryable.**
- [ ] Update `NPC` type to include a `relationships` array (targetId, type, description).
- [ ] Update `Faction` type to track standing/reputation with other factions.
- [ ] Create a visual "Relationship Graph" view using a library like `react-flow` to visualize connections.
- [ ] Update `CampaignService` to handle cascading updates when relationships change.

### 1.2. Custom Entity Tagging & Schema Extension
**As a GM, I want to add custom tags and fields to entities (e.g., "Undead", "Merchant", "Key Item") so I can filter and organize my world my way.**
- [ ] Add a generic `tags` string array to all base entity interfaces.
- [ ] Implement a "Tag Manager" in the settings to color-code specific tags.
- [ ] Create a "Filter" component in Dashboards to filter lists by tags.
- [ ] Allow users to define custom Key/Value pairs (e.g., "Shop Inventory" for Locations).

### 1.3. Dedicated Calendar & Time Tracking system
**As a GM, I want to track the passage of time and associate events with specific dates so the world feels alive and reactive.**
- [ ] Create a `Calendar` entity (name, months, days per week).
- [ ] Create a `TimelineEvent` entity linked to the calendar.
- [ ] Add a "Current Date" state to the global Campaign store.
- [ ] Update `SessionLogs` to automatically attach the in-game date.

### 1.4. Visual Assets & Media Gallery
**As a GM, I want to attach images (maps, character portraits) to entities so I can show them to players or use them for inspiration.**
- [ ] Add `imageUrl` fields to NPC, Location, and Item types.
- [ ] Implement an image uploader/paster that stores data as Base64 (or integrates with local storage).
- [ ] Create a "Theater View" modal to display an image full-screen for players.
- [ ] Integrate Gemini Vision capabilities to generate descriptions *from* uploaded images.

### 1.5. Stat Block Integration (5e SRD)
**As a GM, I want structured stat blocks for NPCs and Monsters instead of just text fields so I can run combat smoother.**
- [ ] Create a structured `StatBlock` type (AC, HP, Speed, Actions, etc.).
- [ ] Import Open5e or SRD data to allow auto-filling stats for common monsters.
- [ ] Create a formatted "Stat Block Renderer" component that looks like the official books.
- [ ] Allow the AI to generate structured JSON stat blocks based on narrative descriptions.

---

## 2. Context Integration: Data Model into DM Coach
**Goal:** Make the AI smarter by feeding it the *right* data at the *right* time.

### 2.1. Semantic Search & Vector Database (Major Gap)
**As a GM, I want the Coach to answer questions about obscure lore written months ago without me manually selecting it.**
- [ ] *Architectural Consideration:* The current context injection relies on user selection. This is limiting.
- [ ] Implement a client-side vector store (like `transformers.js` embeddings or a lightweight vector DB) to index all Articles, Descriptions, and Logs.
- [ ] When the user chats with the Coach, semantic search retrieves the most relevant chunks of text from the entire campaign and injects them into the context window.

### 2.2. @Mention Entity Referencing
**As a GM, I want to type "@NPCName" in the chat to force the AI to look up that specific entity's details and use them in the answer.**
- [ ] Implement a Mentions input component in `DmCoach` (trigger on '@').
- [ ] Parse the input string to extract referenced IDs.
- [ ] Fetch full JSON objects for referenced entities and append to the system prompt context window.
- [ ] Highlight referenced entities in the chat output with links to their editors.

### 2.3. Session History Awareness
**As a GM, I want the Coach to remember what happened in previous sessions (via Session Logs) so it doesn't contradict established events.**
- [ ] Create a "Recent History" context builder that grabs the last N `SessionLog` summaries.
- [ ] Vectorize Session Logs (optional/future) or simply concat "Notable Events" into the prompt.
- [ ] Allow the user to "Pin" specific session logs as permanent context.
- [ ] Update system instructions to prioritize "Notable Events" over static backstory.

### 2.4. Player Character Status Tracking
**As a GM, I want the Coach to know my players' classes, levels, and backstories so it can tailor challenges specifically to them.**
- [ ] Inject a summary of all `PlayerCharacters` (Name, Class, Level, Passive Perception) into the Coach context.
- [ ] Allow the AI to suggest skill checks based on specific PC proficiencies (e.g., "Ask the Rogue to roll Thieves' Tools").
- [ ] Update generation prompts to specifically request hooks related to PC "Bonds" and "Flaws".
- [ ] Track "Active Party" selection in case players are missing.

### 2.5. Secret vs. Public Knowledge Separation
**As a GM, I want to ask "What do the players know about X?" and get an answer derived only from Public descriptions, excluding GM Secrets.**
- [ ] Train/Instruct the AI to distinguish between `description` (Public) and `secrets` (Private) fields.
- [ ] Add a toggle in the Coach: "GM Mode" (sees all) vs "Player Mode" (sees only public info).
- [ ] When generating "Read Aloud" text, explicitly instruct the model to IGNORE content in `secrets` fields unless revealed.
- [ ] Allow marking specific Session Log entries as "Secret".

---

## 3. Capabilities: DM Coach Session Support
**Goal:** Provide real-time tools that speed up gameplay mechanics and improvisation.

### 3.1. Intelligent Combat Tracker
**As a GM, I want to track initiative and HP within the Coach so I don't have to switch to a different app during fights.**
- [ ] Create a `CombatEncounter` state (List of combatants, initiative order, current HP).
- [ ] Add a "Roll Initiative" tool that auto-rolls for NPCs.
- [ ] Allow text-based updates via Coach (e.g., User types "Goblin 1 takes 5 damage", Coach updates state).
- [ ] Display a "Turn Order" widget in the Coach sidebar.

### 3.2. Rules Reference & Arbiter
**As a GM, I want to ask "How does Grappling work?" and get the exact 5e rule text immediately.**
- [ ] Integrate a searchable 5e SRD JSON database.
- [ ] Add a "Rules Lookup" tool to the Coach.
- [ ] Allow the AI to interpret complex rule interactions (e.g., "Can I cast a bonus action spell and a cantrip?").
- [ ] Provide page references (PHB/DMG) where possible.

### 3.3. Loot & Shop Generator
**As a GM, I want to generate a shop inventory or loot pile instantly based on the current location's wealth level.**
- [ ] Add a specialized "Generate Loot" button in the Coach.
- [ ] Input parameters: CR, Location Type, Wealth Level.
- [ ] Output: A list of items (linked to `Item` entities) with gold values.
- [ ] Allow one-click "Add to Party Inventory" (if Party Inventory system is built).

### 3.4. NPC Roleplay Simulator
**As a GM, I want to have a "practice conversation" with an NPC via the Coach to find their voice before the session.**
- [ ] Add a "Roleplay Mode" to the Chat.
- [ ] User selects an NPC. The AI adopts that persona fully (using Traits/Quotes/Motivations).
- [ ] The AI responds *as* the character, not as an assistant.
- [ ] Provide "Mood cues" (e.g., *The merchant looks nervous*) alongside dialogue.

### 3.5. Audio & Ambience DJ
**As a GM, I want the Coach to suggest music or ambience tracks based on the current scene's mood.**
- [ ] Map `Scene.type` and `Scene.theme` to a list of keywords (e.g., "Spooky", "Tavern", "Battle").
- [ ] Integrate with a free API (like YouTube or Spotify widgets) to suggest generic playlists.
- [ ] Display a "Now Playing" suggestion box when a Scene is selected.
- [ ] Allow saving "Theme Songs" to specific Locations or NPCs.

---

## 4. Capabilities: Storyline Management
**Goal:** manage the macro-level flow of the narrative.

### 4.1. Quest & Plot Thread Tracker
**As a GM, I want to track active Quests, their stages, and their outcomes so I don't drop plot threads.**
- [ ] Create a `Quest` entity (Title, Giver, Objectives, Status: Active/Completed/Failed).
- [ ] Link Quests to specific Adventures or Locations.
- [ ] Create a "Quest Board" dashboard view.
- [ ] Update Session Logs to allow tagging "Quest Progress".

### 4.2. Branching Narrative Flowchart
**As a GM, I want to visualize my scenes as a flowchart so I can plan non-linear adventures.**
- [ ] Upgrade the `Adventure` view to support a canvas-based node editor (React Flow).
- [ ] Treat `Scenes` as nodes and links as edges.
- [ ] Allow defining "Decision Points" on the edges (e.g., "If players sneak in -> Scene A; If they attack -> Scene B").
- [ ] AI assistance to suggest "What happens next?" branches.

### 4.3. Act & Arc Structure
**As a GM, I want to organize adventures into larger "Acts" or "Campaign Arcs" to manage pacing.**
- [ ] Introduce a hierarchy layer: `Campaign -> Arc -> Adventure -> Scene`.
- [ ] specific "Arc Dashboard" showing the high-level emotional beat of the story.
- [ ] Allow "Archiving" completed Arcs to declutter the sidebar.
- [ ] AI analysis of "Pacing" (e.g., "You have too many combat encounters in a row").

### 4.4. Dynamic World State Changes
**As a GM, I want the death of an NPC or destruction of a location to update the world state automatically.**
- [ ] Add a status field to entities (Alive/Dead, Intact/Ruined).
- [ ] If an NPC is marked "Dead", auto-update their Faction to remove them.
- [ ] AI Prompting: "Since [NPC] is dead, who takes over [Faction]?"
- [ ] Display "Deceased" or "Destroyed" badges on entities visually.

### 4.5. Player Agency Tracker
**As a GM, I want to record key player choices that will have consequences later.**
- [ ] Add a "Key Decisions" section to the Campaign dashboard.
- [ ] Allow linking a Decision to a future "consequence date" or event.
- [ ] Coach prompt: "Remind me of consequences triggered by [Event]."
- [ ] Visualization of "The Butterfly Effect" (Decision -> Outcome).

---

## 5. General Integration & Quality of Life
**Goal:** Make the app feel like a cohesive, professional product.

### 5.1. "Wiki-Style" Cross-Linking
**As a GM, when I type the name of an NPC in any text field, I want it to automatically become a clickable link to that NPC.**
- [ ] Implement a text parser that runs on `onBlur` or `Markdown` rendering.
- [ ] Scan text against a dictionary of all entity names.
- [ ] Replace matches with internal links `[[entityId]]`.
- [ ] Render these links as tooltips showing a mini-summary of the entity on hover.

### 5.2. Global Command Palette (Ctrl+K)
**As a GM, I want to press Ctrl+K to instantly search for and jump to any entity, or trigger a generator.**
- [ ] Implement a global search index of all entities.
- [ ] Add a Command Palette UI (cmdk library).
- [ ] commands: "Go to [Name]", "Create New NPC", "Roll d20", "Open Coach".
- [ ] Fuzzy search capabilities for quick navigation.

### 5.3. Mobile/Tablet Responsive Mode
**As a GM, I want to run the session from my tablet with a layout optimized for touch and limited screen space.**
- [ ] Refactor the `CampaignSidebar` to be a collapsible drawer on mobile.
- [ ] Create a "Run Mode" view that hides editing tools and focuses on Read-Aloud text and stats.
- [ ] Increase touch target sizes for buttons.
- [ ] Prevent keyboard auto-popup on read-only views.

### 5.4. Professional PDF Export Styling
**As a GM, I want to export my adventure looking like a real D&D module (Homebrewery style) to share with others.**
- [ ] Improve the `ExportModal` with styling options.
- [ ] Use CSS print media queries to format the Markdown as 2-column layouts.
- [ ] Include paper texture backgrounds and parchment styling.
- [ ] Auto-generate a Table of Contents for the PDF.

### 5.5. Cloud Sync & Authentication (Future)
**As a user, I want to log in and sync my campaigns across devices so I can prep on desktop and run on tablet.**
- [ ] Implement Firebase or Supabase for backend persistence.
- [ ] Add User Authentication (Google Auth).
- [ ] Migrate from `localStorage` to cloud database.
- [ ] Implement "Offline First" architecture (PouchDB/RxDB) to allow running games without internet.
