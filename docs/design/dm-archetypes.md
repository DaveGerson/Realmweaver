# Realmweaver DM Archetype Personas

> **Purpose:** Product design reference defining 7 Dungeon Master archetypes grounded in real-world TTRPG community research.
> **Date:** 2026-03-22 (v2 — added Digital-First DM, Published Module Runner, and Design Philosophy)
> **Audience:** Realmweaver product and engineering teams

---

## Research Basis

These archetypes are synthesized from multiple real-world sources:

- **Sly Flourish 2016 DM Survey** (6,600 respondents): session frequency, prep time, homebrew vs. published splits
- **Sly Flourish Twitter/YouTube polls** (2,900-3,800 respondents per poll, 2020-2025): prep time distribution, tool usage
- **EN World DM Burnout Poll** (2022): community-wide data on burnout prevalence
- **Return of the Lazy Dungeon Master** by Mike Shea (Sly Flourish): the eight-step prep methodology
- **Matt Colville's "Running the Game"** YouTube series (2016-present): DM philosophy, player/audience taxonomy
- **The Angry GM** (theangrygm.com): Investment/Ownership framework, GM-as-player philosophy
- **Robin Laws' "Robin's Laws of Good Game Mastering"**: seven player archetypes (Tactician, Power Gamer, Method Actor, etc.)
- **RPGnet, D&D Beyond Forums, r/DMAcademy, r/DnDBehindTheScreen**: community discussions on prep anxiety, tool frustration, worldbuilder's disease
- **Tool ecosystem research**: World Anvil, LegendKeeper, Notion, Obsidian, GM Binder, Kobold Plus Fight Club, Improved Initiative, Shieldmaiden, D&D Beyond

### Key Demographic Context

- Estimated 3 million active tabletop DMs worldwide, 13.7 million active tabletop D&D players
- 36% of D&D players are 25 or younger; only 13% are above 40. The core DM demographic skews 25-40
- Most DMs play weekly for about four hours with one to two hours of prep time (Sly Flourish 2016 survey, n=6,600)
- About one-third of DMs spend 3+ hours prepping for a four-hour session; nearly half spend one hour or less
- Over half of DMs (55%) play at home; ~16% play on Roll20; ~5% at local game shops
- Two-thirds of DMs run their own homebrew adventures; one-third run published modules
- Over half of DMs use their own settings; 38% use the Forgotten Realms

---

## Design Philosophy: Where Realmweaver Fits in the DM Toolchain

### Core Positioning

Realmweaver is a **campaign management and AI-assisted prep tool**, not a Virtual Tabletop (VTT). This distinction is fundamental to every design decision.

**Realmweaver is for the DM's brain, not the player's screen.**

The tool serves two primary play contexts:
1. **Theatre of the Mind** — DMs who narrate everything verbally, using no maps or tokens
2. **In-Person / IRL Play** — DMs running physical table sessions with books, dice, and printed handouts

These two contexts represent the majority of actual play. Over 55% of D&D sessions happen at home around a physical table (Sly Flourish 2016 survey). Even groups that use VTTs for remote play still need a separate prep tool — VTTs are presentation layers, not thinking tools.

### What Realmweaver Is NOT

- **Not a VTT.** No battlemaps, no token movement, no fog of war, no player-facing shared screens. Roll20, Foundry, Owlbear Rodeo, and Talespire own this space and have years of feature depth. Attempting parity would dilute the product.
- **Not a rules engine.** No character builders, no automated dice rolling, no spell slot tracking. D&D Beyond owns rules and character management.
- **Not a player-facing tool.** Realmweaver is the DM's private workspace. Players never log in, never see the interface. Anything shared with players is exported (handouts, recaps) or read aloud.

### Deliberate Integration Points

Rather than competing with VTTs and rules tools, Realmweaver complements them:

| Tool | Realmweaver's Relationship |
|------|---------------------------|
| **D&D Beyond** | Primary integration target. Import character sheets (PDF parsing already exists). Reference stat blocks. Realmweaver handles what D&D Beyond doesn't: campaign narrative, NPC relationships, plot tracking, session continuity. |
| **VTTs (Roll20, Foundry, Owlbear)** | No integration planned. DMs who use VTTs use Realmweaver for prep and the VTT for presentation. These are complementary, not competing. |
| **Obsidian / Notion** | Export target. Many DMs maintain personal wikis. Realmweaver's Obsidian markdown export bridges this workflow. |
| **Physical play aids** | Realmweaver generates content the DM reads aloud, prints, or references on a laptop at the table. The output is narrative, not visual. |

### Design Implications

This positioning shapes feature priorities:

1. **Text over graphics.** NPC cards, location descriptions, and scene briefs are optimized for the DM to read and narrate, not for players to view on a shared screen.
2. **Speed over spectacle.** Mid-session tools (DM Coach, quick entity creation, combat tracker) prioritize getting the DM an answer in seconds, not rendering a beautiful display.
3. **Narrative over mechanics.** The combat tracker manages initiative order and HP — the minimum needed for Theatre of the Mind combat. It is not a tactical grid.
4. **Prep-to-table pipeline.** Every feature should answer: "How does this help the DM at the table tonight?" Content that only lives in a wiki without a path to session use is a worldbuilder trap.
5. **AI as collaborator, not automator.** AI generates drafts and suggestions. The DM always has final creative authority. The tool should feel like a knowledgeable co-DM, not a content factory.

---

## Archetype 1: The Prep-Heavy Worldbuilder

### Profile
- **Experience Level:** Intermediate to veteran (3-10+ years DMing)
- **Session Frequency:** Weekly or biweekly
- **Prep Style:** Heavy (4-10+ hours per session; often continuous background worldbuilding)
- **Play Style:** Narrative/sandbox hybrid with deep lore underpinning
- **Tech Comfort:** Power user — actively seeks and adopts specialized tools
- **Group Size:** 4-5 players
- **Campaign Length:** Long campaigns (1-3 years), occasionally "forever campaigns"

### Real-World Basis

This archetype maps directly to the "worldbuilder's disease" phenomenon well-documented across RPGnet, r/DnDBehindTheScreen, and r/worldbuilding — the compulsion to develop every corner of a setting before (or instead of) running sessions. In the Sly Flourish 2016 survey, this DM falls in the top quartile of prep time (3+ hours per session) and overwhelmingly runs homebrew settings. They are the primary audience for World Anvil and LegendKeeper. Matt Colville describes the tension between the "world as it exists in the DM's head" and "the world as the players experience it" — this DM often prioritizes the former. The Angry GM's framework identifies this DM as having high "Ownership" but potentially misaligned "Investment."

### Core Motivations
- Creative expression through worldbuilding — the world is the work of art
- Internal consistency and verisimilitude in every detail
- Legacy and depth — players discovering layered connections
- Pride in craft when players say "this feels like a real place"

### Pain Points
- Unused prep is demoralizing (the #1 cause of worldbuilder burnout)
- Tools are either too shallow or too complex (World Anvil's depth vs. its BBCode complexity)
- No bridge from lore to session — encyclopedic knowledge that doesn't distill into session prep
- Players don't engage with the lore ("I wrote 20 pages of elven history and they asked 'do they have a shop?'")
- Continuity tracking is manual — which NPCs know what, which factions were introduced

### Tool Usage Patterns
- **Primary:** World Anvil, LegendKeeper, Notion, Obsidian (with TTRPG plugins), OneNote
- **Secondary:** Inkarnate/Wonderdraft for maps, AI image generators for portraits, GM Binder for handouts
- **Pain:** Information scattered across platforms — wiki has lore, Google Docs has session notes, a spreadsheet tracks NPC relationships
- **Wish:** A single tool connecting worldbuilding lore → session prep → in-session reference

### Session Workflow
1. **Between sessions (ongoing):** Continuously adds to world wiki. This is recreation, not obligation.
2. **Pre-session (4-10 hours):** Writes boxed text, designs encounters/maps, prepares NPC dialogue, creates handouts, designs contingency paths.
3. **During session:** Frequently references notes. Struggles when players deviate. Delivers rich descriptions but can over-narrate.
4. **Post-session:** Writes detailed recap. Updates wiki with new canon. Begins next prep cycle immediately.

### Key Needs from a Session Cockpit
- Contextual lore surfacing when NPCs/locations are mentioned
- Prep-to-session pipeline marking content as "session-ready"
- AI-assisted content recycling for unused prep
- Relationship and continuity tracking (who met whom, who knows what)
- Rich entity detail with fast-access summary view

---

## Archetype 2: The Lazy DM / Improvisational Storyteller

### Profile
- **Experience Level:** Intermediate to veteran (2-10+ years; usually tried heavy prep and moved away)
- **Session Frequency:** Weekly
- **Prep Style:** Minimal to moderate (30 minutes to 2 hours, structured around eight-step checklist)
- **Play Style:** Narrative/improv with emergent story; strongly player-driven
- **Tech Comfort:** Comfortable but selective — adopts tools only if they reduce friction
- **Group Size:** 4-6 players
- **Campaign Length:** Variable — comfortable with both one-shots and long campaigns

### Real-World Basis

Directly modeled on the community around Mike Shea's *Return of the Lazy Dungeon Master*, which codified a prep methodology based on eight modular steps: (1) Review the characters, (2) Create a strong start, (3) Outline potential scenes, (4) Define secrets and clues, (5) Develop fantastic locations, (6) Outline important NPCs, (7) Choose relevant monsters, (8) Select magic item rewards. The core philosophy: "You're not building a story, you're setting up little dishes of pre-cooked food so you can improvise the meal at the table." In poll data, this DM falls in the 45-48% who spend one hour or less prepping. Many evolved FROM Archetype 1 after experiencing burnout.

### Core Motivations
- Collaborative storytelling — best moments emerge from player choices, not DM scripts
- Efficiency without sacrifice — every minute of prep should translate to play value
- Player agency — forcing players down a pre-written path feels like a failure
- The joy of surprise — enjoys being surprised by the game as much as the players do

### Pain Points
- Tools assume heavy prep — blank pages and extensive forms are the wrong interface
- Improv is hard to search — improvised details live only in memory unless written down immediately
- Continuity gaps — with minimal notes, details from past sessions get forgotten
- Secrets and clues management — powerful technique but hard to track which are revealed vs. floating

### Tool Usage Patterns
- **Primary:** A single text file, Google Doc, or plain markdown note per session
- **At the table:** Phone for name generators, browser tab for random tables
- **Explicitly avoids:** Heavyweight wiki tools, complex databases, anything requiring "setup"
- **Wish:** A tool that captures improv details during play and organizes them automatically

### Session Workflow
1. **Pre-session (30 min - 2 hours):** Eight-step checklist. Strong opening, 3-5 bullet-point scenes, 5-10 secrets/clues, 2-3 locations, key NPCs, monsters, rewards.
2. **During session:** Improvises heavily. Deploys prepped content as opportunities arise. Reskins prep when players go off-script.
3. **Post-session (10-15 min):** Jots down key decisions, new NPCs, threads to revisit. Often skipped due to fatigue.

### Key Needs from a Session Cockpit
- Bullet-point-first interface — no forms, no required fields
- Smart capture during play — quick tagging of improvised details
- Secrets and clues tracker with revealed/unrevealed status
- Lightweight session history — quick "what happened last session"
- AI-powered gap filling — flesh out improvised NPCs after the session

---

## Archetype 3: The New/Nervous DM

### Profile
- **Experience Level:** New (0-1 years; often 0-10 sessions of DMing experience)
- **Session Frequency:** Biweekly or irregular
- **Prep Style:** Variable — either over-preps from anxiety or under-preps from not knowing what to prepare
- **Play Style:** Following the module; tentatively incorporating roleplay; learning by doing
- **Tech Comfort:** Comfortable with general tech but unfamiliar with TTRPG-specific tools
- **Group Size:** 3-5 players (often a friend group trying D&D together)
- **Campaign Length:** Published module or short homebrew arc (3-12 sessions)

### Real-World Basis

The fastest-growing DM segment. D&D's mainstream cultural moment (Stranger Things, Critical Role, Baldur's Gate 3) has brought millions of new players, and someone in the group has to DM. r/DMAcademy exists primarily to serve this archetype. Matt Colville's "Running the Game" Episode 1 is the most-recommended resource for new DMs. The Alpine DM identifies two root causes of new-DM anxiety: enjoyment-driven over-preparation (worldbuilding as coping) and anxiety-driven over-preparation (fear of failure). The 2024 Dungeon Master's Guide was explicitly redesigned to be more accessible to first-time DMs.

### Core Motivations
- Not wanting to let friends down — agreed to DM because nobody else would
- Learning the rules while simultaneously running the game
- Having a "real D&D experience" (influenced by actual-play shows)
- Getting through the session — success = "we played for 3 hours and everyone had fun"

### Pain Points
- Blank canvas paralysis — open-ended tools that say "build your world!" are terrifying
- Rules lookup during play kills momentum and amplifies anxiety
- Not knowing what to prep — contradictory advice ("prep more!" vs. "don't over-prep!")
- Encounter balance terror — fear of accidentally TPK-ing the party in session 2
- Actual-play comparison syndrome — Matt Mercer makes it look effortless

### Tool Usage Patterns
- **Primary:** D&D Beyond, physical module book/PDF, maybe a Google Doc
- **At the table:** Physical dice, printed character sheets, phone for rules lookup
- **Has tried and abandoned:** Looked at Roll20/Foundry and found setup overwhelming. Glanced at World Anvil free tier and closed the tab.
- **Wish:** A step-by-step tool that says "for your next session, you need to know these 5 things"

### Session Workflow
1. **Pre-session (1-5 hours):** Reads and re-reads module chapter. Highlights NPC names. Watches YouTube guidance. Worries about unexpected player actions.
2. **During session:** Frequently references module. Panics when players ask about uncovered content. Combat is slow (looking up stat blocks). Roleplay improves session over session.
3. **Post-session:** Exhales with relief. Texts group asking if everyone had fun. Googles "how to handle [situation]."

### Key Needs from a Session Cockpit
- Guided prep mode — "Here's what you need to know for this session"
- Quick rules reference — searchable, contextual, doesn't require leaving session
- Encounter confidence tools — difficulty indicators, "what to do if this goes wrong"
- NPC cheat sheets — name, appearance, motivation, key info, voice hint on one card
- "What would a good DM do here?" AI assist for when they're stuck
- Post-session learning prompts ("Things that went well", "Things to try differently")

---

## Archetype 4: The Tactical Combat DM

### Profile
- **Experience Level:** Intermediate to veteran (2-15+ years; often entered through wargaming or video game RPGs)
- **Session Frequency:** Weekly
- **Prep Style:** Moderate, concentrated on encounter design (2-4 hours, mostly building encounters and maps)
- **Play Style:** Tactical/combat-focused with narrative framing; believes combat IS storytelling
- **Tech Comfort:** Power user for combat tools; moderate for everything else
- **Group Size:** 4-6 players (prefers consistent group for balanced encounter design)
- **Campaign Length:** Medium to long campaigns with dungeon-crawl or adventure-path structure

### Real-World Basis

Traces lineage to D&D's wargaming roots. Robin Laws' "Tactician" player type — "looking to solve complex, realistic problems with clear, consistent rules." Kobold Plus Fight Club is the defining tool for encounter building. Improved Initiative is the standard initiative tracker. "The Monsters Know What They're Doing" by Keith Ammann is essential reading — approaching every monster as a tactical actor with optimal combat strategies. These DMs care deeply about action economy, CR accuracy (and its documented flaws), and monster design.

### Core Motivations
- Fair challenge — combat should be dangerous but winnable
- Mechanical mastery — encounter design as puzzle-solving
- Dramatic tension through mechanics — terrain, monster behavior, reinforcement pacing
- Player tactical agency — meaningful decisions beyond "I hit it with my sword"

### Pain Points
- CR is unreliable — a rough estimate at best depending on party composition
- Initiative tracking is clunky — managing 8-12 combatants with HP, conditions, legendary actions
- Encounter design tools are siloed — Kobold builds, Improved Initiative tracks, D&D Beyond has stat blocks
- Non-combat prep gets neglected — narrative connective tissue between combats feels thin
- Combat pacing — keeping combat moving with 5-6 players while tracking everything

### Tool Usage Patterns
- **Primary:** Kobold Plus Fight Club, Improved Initiative or Shieldmaiden, D&D Beyond for stat blocks
- **Secondary:** Dungeondraft/Inkarnate for battle maps, Owlbear Rodeo/Roll20 for VTT grid combat
- **At the table:** Laptop with initiative tracker, printed stat blocks, battle map, minis/tokens
- **Wish:** Unified combat management — encounter building + initiative + stat blocks + conditions in one tool

### Session Workflow
1. **Pre-session (2-4 hours):** Designs 2-3 encounters. Selects monsters by theme AND tactical interest. Calculates XP budgets. Designs maps and terrain. Writes monster tactics. Brief narrative transitions.
2. **During session:** Combat is centerpiece. Runs monsters tactically (cover, flanking, retreating). Tracks everything simultaneously. Describes combat cinematically. Abbreviated roleplay between combats.
3. **Post-session:** Evaluates encounter balance. Notes what worked for future use.

### Key Needs from a Session Cockpit
- Integrated combat tracker — initiative, HP, conditions, legendary/lair actions in one view
- Encounter builder with smart balancing beyond raw CR
- Monster quick-reference — stat blocks accessible with one click during combat
- Combat pacing tools — turn timer, "on deck" notification, condition reference
- Post-combat encounter review — damage dealt, rounds lasted, players downed

---

## Archetype 5: The Forever DM / Burnout-Risk Veteran

### Profile
- **Experience Level:** Veteran (5-20+ years; has DMed across multiple editions and possibly multiple systems)
- **Session Frequency:** Weekly or biweekly, sometimes running 2-3 concurrent campaigns/groups
- **Prep Style:** Efficiency-optimized moderate prep (1-3 hours); personal shortcuts refined over years
- **Play Style:** Mixed — adapts to the group; has a "house style" refined over decades
- **Tech Comfort:** Comfortable; willing to invest in tools with significant long-term payoff
- **Group Size:** 4-6 per group; may manage 8-15 players across multiple groups
- **Campaign Length:** Long campaigns running continuously for years; simultaneously manages multiple arcs

### Real-World Basis

The "Forever DM" is one of the most-discussed identities in the TTRPG community. EN World's burnout poll drew extensive discussion — burnout is near-universal among long-term DMs. The supply-demand problem: ~1 DM per 4-5 players means "it's not a choice, it's a lack of alternatives." The 3 Wise DMs blog identifies the "Servant DM" pattern as "the fastest path to burnout" — putting players' experience above their own enjoyment. The Angry GM pushes back: "the GM IS a player, the game has to engage the GM." These DMs are the most likely to pay for tools (StartPlaying.games has paid over $50 million to GMs since 2019).

### Core Motivations
- Sustainability — keep DMing without it consuming their life
- Quality maintenance — high standards refined over years; won't sacrifice for speed
- Obligation management — multiple groups depend on them; canceling disappoints 4-6 people
- Creative renewal — after hundreds of sessions, novelty is harder to find
- Wanting to be a player — rarely (or never) gets to experience the other side of the screen

### Pain Points
- Prep fatigue across multiple campaigns — context-switching between worlds is cognitively expensive
- Institutional knowledge problem — after 50+ sessions, only the DM remembers session 12
- Diminishing creative returns — they know their own patterns and struggle to break out
- Tool switching cost — data spread across several tools; migration is an unacceptable time investment
- Guilt about wanting to stop — expressing burnout feels like letting people down

### Tool Usage Patterns
- **Primary:** Refined personal system (Notion/Obsidian with custom templates, or long-running OneNote). Some use Foundry VTT.
- **Secondary:** Multiple D&D Beyond subscriptions, encounter builders, random generators, "emergency one-shot" bookmarks
- **Relationship with tools:** Pragmatic — evaluates on ROI: "will this save more time than setup costs?"
- **Wish:** A tool that handles the boring parts (scheduling, recap generation, NPC tracking, continuity) while leaving creative parts to the DM

### Session Workflow
1. **Pre-session (1-3 hours x N campaigns):** Efficient, practiced. Reviews previous session notes. Identifies 2-3 key scenes. Preps only the immediate horizon. Reuses/reskins content across campaigns.
2. **During session:** Runs on experience and instinct. Improvises competently. Manages table dynamics almost unconsciously. May feel like "going through the motions" during burnout.
3. **Post-session (often skipped):** Too tired for detailed notes. Jots 3-4 bullet points. Relies on memory. This is where continuity problems develop.

### Key Needs from a Session Cockpit
- Session recap automation — AI-generated summaries from minimal input
- Cross-campaign management — multiple campaigns with clear separation and easy switching
- Content generation for speed — "I need a tavern, three NPCs, and a reason they're arguing — go"
- Continuity safety net — automatic tracking of unresolved hooks, NPC appearances, promises made
- Prep templates optimized for speed — one-page sheets pre-filled with campaign context
- Migration and import — bring existing campaign data from Notion, Obsidian, Google Docs

---

## Archetype 6: The Digital-First DM

### Profile
- **Experience Level:** Intermediate to veteran (3-15+ years; comfortable with both analog and digital tools)
- **Session Frequency:** Weekly or biweekly
- **Prep Style:** Moderate (2-4 hours), structured around digital workflows
- **Play Style:** Mixed — narrative with digital reference; runs Theatre of the Mind but with a laptop or tablet always open
- **Tech Comfort:** High — actively evaluates and adopts tools; maintains a curated digital toolkit
- **Group Size:** 4-6 players (in-person, remote, or hybrid)
- **Campaign Length:** Medium to long campaigns; values the compound returns of good tooling over time

### Real-World Basis

This archetype emerged alongside the proliferation of DM-facing digital tools from 2015 onward. These DMs are the power users of D&D Beyond, the early adopters of LegendKeeper, the people who built elaborate Notion databases before TTRPG-specific tools existed. They are distinct from the Tactical Combat DM (who is digital-first *for combat*) — the Digital-First DM uses technology across the entire DM workflow: prep, session management, note-taking, and post-session review. They are over-represented in online DM communities because they are, by nature, terminally online. r/DMAcademy tool recommendation threads are written by and for this archetype.

The key distinction: this DM doesn't use digital tools because they're trendy — they use them because analog tools hit a ceiling. A physical notebook can't search across 40 sessions of notes. Index cards can't show faction relationship webs. The Digital-First DM hit the limits of paper and never looked back.

### Core Motivations
- **Leverage** — digital tools should make a DM more effective than analog-only could achieve
- **Searchability** — "I know I wrote this down somewhere" should never happen
- **Integration** — tools should talk to each other; data should flow, not be re-entered
- **Professional-grade craft** — running a game should feel as supported as any other serious creative endeavor
- **Reference speed** — at the table, information retrieval must be faster than flipping through a binder

### Pain Points
- **Tool fragmentation** — campaign wiki in one tool, session notes in another, encounter builder in a third, initiative tracker in a fourth. No single tool covers the full DM workflow.
- **Setup cost vs. payoff** — many tools require hours of configuration before they're useful. Templates, custom fields, databases — it's prep for the prep tool.
- **Data portability** — content locked in proprietary formats. What happens when a tool shuts down or the DM wants to switch? Migration is always painful.
- **VTT confusion** — many "DM tools" are actually VTTs that expect a player-facing shared screen. The Digital-First DM running Theatre of the Mind or IRL doesn't need battlemaps — they need NPC relationship graphs and session timelines.
- **Overkill vs. underkill** — Notion is infinitely flexible but requires building everything from scratch. World Anvil has structure but demands BBCode. Nothing is opinionated enough to be useful out of the box while remaining flexible enough for power users.

### Tool Usage Patterns
- **Primary:** D&D Beyond (character/rules reference), Notion or Obsidian (campaign wiki/notes), Google Docs (shared recaps with players)
- **Secondary:** Kobold Plus Fight Club (encounters), random generators, AI chat tools for brainstorming
- **At the table:** Laptop or tablet with 3-4 tabs open — campaign wiki, D&D Beyond, initiative tracker, session notes
- **Explicitly wants:** One tool that replaces 3-4 tabs. Structured enough to be useful immediately, flexible enough to not feel constraining.
- **Explicitly avoids:** VTTs (when running TotM/IRL), tools that require player accounts, tools with mandatory player-facing features

### Session Workflow
1. **Pre-session (2-4 hours):** Reviews digital notes from previous sessions. Updates NPC and location entries with new developments. Generates content with AI assistance. Organizes session outline in a structured format (not a wall of text).
2. **During session:** Laptop open at the table (or second monitor for remote). Searches entities by name. References NPC motivations and secrets. Tracks initiative digitally. Takes inline notes as events unfold. Occasionally generates improv content mid-session.
3. **Post-session (30-60 min):** Updates campaign state — marks plot threads as advanced/resolved, adds new NPCs and locations created during play, writes session summary. This is where the compound value of digital tools pays off.

### Key Needs from Realmweaver
- **Unified workspace** — entities, session notes, plots, and AI tools in one application with zero context-switching
- **Fast entity lookup** — global search (Cmd+K) across all entity types, accessible from any view
- **D&D Beyond integration** — import player character sheets; reference stat blocks without leaving the app
- **Structured but flexible entities** — rich fields for those who want them, but never mandatory. A bare-bones NPC (name + 3 bullet points) is as valid as a fully fleshed-out one.
- **Export and portability** — JSON and markdown export so data is never locked in. Obsidian export for DMs who maintain external wikis.
- **Session-aware UI** — the tool should know whether the DM is prepping or playing, and surface different tools accordingly
- **Keyboard-driven navigation** — power users want shortcuts, not clicks

### Why Realmweaver Fits This Archetype

Realmweaver's architecture — AI-assisted generation, structured entity types, campaign context injection, Theatre of the Mind combat tracker, and text-first output — is precisely what the Digital-First DM needs. The tool doesn't try to be a VTT. It doesn't ask the DM to build a database schema. It provides opinionated structure (NPCs have motivations, factions have goals, plots have status) while keeping AI generation a prompt away. The Digital-First DM is Realmweaver's most natural power user.

---

## Archetype 7: The Published Module Runner

### Profile
- **Experience Level:** Any (new DMs often start here; veterans use modules to reduce prep)
- **Session Frequency:** Weekly or biweekly
- **Prep Style:** Module-guided (1-3 hours reading ahead, adapting content, and adding personal touches)
- **Play Style:** Narrative with module backbone; improvises around the published structure
- **Tech Comfort:** Moderate — uses digital tools for reference but doesn't build elaborate systems
- **Group Size:** 4-6 players
- **Campaign Length:** Module-defined (Curse of Strahd: 30-50 sessions, Lost Mine of Phandelver: 8-12 sessions, Vecna: Eve of Ruin: 15-25 sessions)

### Real-World Basis

Published adventures are the backbone of organized D&D play and the entry point for most new campaigns. One-third of all DMs run published modules (Sly Flourish 2016 survey). D&D Beyond's marketplace, Roll20's module sales, and the success of third-party publishers (Kobold Press, MCDM, Ghostfire Gaming) all confirm massive demand. But running a published module is not the same as reading it — the DM must reorganize, annotate, adapt, and fill gaps.

The dirty secret of published modules: **they are poorly organized for actual play.** Curse of Strahd buries critical NPC motivations across 12 chapters. Storm King's Thunder has locations the party may never visit occupying 40 pages. Waterdeep: Dragon Heist has four villain paths but the DM must choose one and ignore three-quarters of the book. The community response — "Curse of Strahd DM guides," "Running Rime of the Frostmaiden" blog series, r/CurseofStrahd with 100K+ members — proves that running a module requires as much prep as homebrew, just different prep.

Sly Flourish's *Return of the Lazy Dungeon Master* dedicates an entire chapter to running published adventures, emphasizing: "Read the whole adventure first. Then prep each session using the eight steps, pulling from the module what you need." The Published Module Runner does exactly this — they treat the module as a raw material source, not a script.

### Core Motivations
- **Story quality guarantee** — published modules are professionally written with tested narrative arcs, interesting villains, and memorable set pieces
- **Reduced creative burden** — the big ideas (plot, setting, major NPCs) are done; the DM focuses on execution and personalization
- **Player expectations** — players hear about Curse of Strahd or Descent into Avernus and want to play *that story*
- **Confidence through structure** — knowing "the answer is in the book somewhere" reduces anxiety
- **Personalization pride** — the best module DMs make the story feel like *their* version, not a generic run

### Pain Points
- **The module is a book, not a tool.** 256 pages of linear text with critical information scattered across chapters. Finding "what does Strahd want in Chapter 4?" requires flipping through the entire book.
- **NPC management is the #1 pain.** Modules introduce dozens of NPCs. Curse of Strahd has 50+. The DM must track: who has the party met? What do they know? What's their current status? The book doesn't help with this.
- **Adaptation is invisible.** Every DM changes the module — adds homebrew NPCs, alters plot points, skips chapters, adjusts difficulty. These changes live in margin notes and Google Docs, disconnected from the module text.
- **Session-to-session continuity.** The module describes a static world. The DM must track how the party's actions have changed that world. "The party allied with the Wereravens in session 4" isn't in the book.
- **Player character integration.** The module's NPCs and plot hooks exist in a vacuum. Connecting them to the specific party's backstories requires manual work for every session.
- **Encounter rebalancing.** Modules are balanced for a "typical" party of 4 at expected levels. Actual parties deviate. The DM constantly adjusts encounters with no tool support.
- **Supplement overload.** Community guides, DMs Guild supplements, Reddit advice threads — there's *too much* supplementary material, and it all needs to be reconciled with the base module.

### Tool Usage Patterns
- **Primary:** Physical book or D&D Beyond digital module, D&D Beyond for stat blocks and rules, a Google Doc or OneNote for session-by-session notes
- **Secondary:** Community guides (r/CurseofStrahd, Sly Flourish adventure guides, DMs Guild supplements), encounter adjusters
- **At the table:** Book open to current chapter, laptop/tablet for D&D Beyond, handwritten or typed session notes
- **Has tried:** Importing module text into Notion/Obsidian and found it takes 10+ hours to reorganize properly
- **Wish:** A tool that lets them reorganize a module around *their* sessions, track NPC status, and integrate homebrew additions without losing the module's backbone

### Session Workflow
1. **First read (one-time, 4-10 hours):** Reads entire module. Highlights key NPCs, plot branches, and potential problems. Reads 2-3 community guides. Makes preliminary decisions (which villain path in Dragon Heist, which ally in Strahd).
2. **Pre-session (1-3 hours):** Re-reads relevant chapter section. Identifies which module NPCs appear. Adds personal touches (connecting module hooks to PC backstories). Notes which information to reveal this session. Adjusts encounters if needed.
3. **During session:** References module for boxed text, NPC dialogue starting points, and room descriptions. Improvises around the module structure. Takes notes on party decisions that deviate from or advance the plot.
4. **Post-session (15-30 min):** Updates NPC status (met/allied/hostile/dead). Notes plot deviations. Marks which module content was covered and what's next. Flags things to prep for next session.

### Key Needs from Realmweaver
- **Module-as-entity-source** — Import or manually enter key module NPCs, locations, factions, and plot threads as Realmweaver entities. The module becomes a structured database, not a wall of text.
- **NPC status tracking** — Beyond name and description: has the party met them? What's the party's relationship? What module secrets do they hold? What's their current status (alive, dead, turned hostile, etc.)?
- **Plot thread decomposition** — Break the module's overarching plot into trackable threads. Mark which are active, which are resolved, which the party hasn't discovered yet.
- **Session-by-session adaptation layer** — The module entities are the "base layer." The DM's session-specific notes, modifications, and additions are an "adaptation layer" on top. Both are visible, neither overwrites the other.
- **AI-powered module expansion** — "Generate 3 additional NPCs for this tavern scene that fit the module's tone." "Create a side quest that connects Player A's backstory to this module location." "Write read-aloud text for this room description that's more dramatic." This is where Realmweaver's AI excels — generating content *within the context of an existing narrative framework.*
- **Adventure structure visualization** — See the module's chapters/scenes as a navigable structure, with the party's current position marked.
- **Quick reference during play** — Search across all module entities. "What was the name of the NPC in the tavern in Vallaki?" should return an answer in one search, not require flipping through a 256-page book.
- **Community supplement integration** — Import supplementary NPCs, encounters, or plot additions from community guides and DMs Guild content alongside the base module entities.

### Why Realmweaver Fits This Archetype

Realmweaver's entity system (NPCs, Locations, Factions, Adventures, Scenes, Plots) maps directly to the structure of a published module. The DM can decompose "Curse of Strahd" into: an Adventure with Scenes for each chapter, NPCs for each major character, Locations for each notable place, Factions for each power group, and Plots for each narrative thread. Once decomposed, Realmweaver's AI can generate *additional* content that's contextually consistent with the module's setting (via campaign context injection). The session log system tracks what happened vs. what the module expected. The plot tracker monitors thread status across sessions. This is the workflow that module runners already do manually in Google Docs — Realmweaver structures and accelerates it.

---

## Cross-Archetype Analysis

### Overlap Map

| Need | Worldbuilder | Lazy DM | New DM | Tactical DM | Forever DM | Digital-First | Module Runner |
|------|:-----------:|:-------:|:------:|:-----------:|:----------:|:-------------:|:-------------:|
| NPC quick reference | HIGH | HIGH | HIGH | MEDIUM | HIGH | CRITICAL | CRITICAL |
| Session recap | MEDIUM | HIGH | MEDIUM | LOW | CRITICAL | HIGH | HIGH |
| Encounter balancing | LOW | MEDIUM | HIGH | CRITICAL | MEDIUM | MEDIUM | HIGH |
| Lore/world wiki | CRITICAL | LOW | LOW | LOW | MEDIUM | HIGH | MEDIUM |
| AI content generation | HIGH | MEDIUM | HIGH | MEDIUM | HIGH | HIGH | HIGH |
| Combat tracker (TotM) | MEDIUM | LOW | HIGH | HIGH | MEDIUM | MEDIUM | MEDIUM |
| Continuity tracking | HIGH | HIGH | LOW | LOW | CRITICAL | CRITICAL | CRITICAL |
| Guided/structured prep | LOW | LOW | CRITICAL | MEDIUM | LOW | LOW | HIGH |
| Improv capture | LOW | CRITICAL | MEDIUM | LOW | HIGH | HIGH | MEDIUM |
| Cross-campaign mgmt | LOW | LOW | LOW | LOW | CRITICAL | MEDIUM | LOW |
| Global search / Cmd+K | MEDIUM | HIGH | LOW | MEDIUM | HIGH | CRITICAL | CRITICAL |
| Module decomposition | LOW | LOW | HIGH | LOW | MEDIUM | LOW | CRITICAL |
| Plot thread tracking | MEDIUM | MEDIUM | LOW | LOW | HIGH | HIGH | CRITICAL |
| D&D Beyond integration | LOW | LOW | HIGH | HIGH | MEDIUM | HIGH | HIGH |
| Export / portability | MEDIUM | LOW | LOW | LOW | MEDIUM | CRITICAL | LOW |

### Willingness to Pay (Estimated)

1. **Forever DM** — Highest. Values time over money. Will pay $10-15/month without hesitation.
2. **Worldbuilder** — High. Already paying for similar tools. Price-sensitive above $15/month.
3. **Digital-First DM** — High. Evaluates on ROI — if it replaces 3 tools, pays for itself. Sweet spot $8-12/month.
4. **Published Module Runner** — Moderate-high. Already buying modules ($30-50 each); a tool that makes them usable is an easy sell. Sweet spot $5-10/month.
5. **Tactical DM** — Moderate. Will pay for combat-specific tools, but Realmweaver's TotM combat tracker may underwhelm. Sweet spot $5-10/month.
6. **Lazy DM** — Low-moderate. Resistant unless tool genuinely reduces their already-minimal prep.
7. **New DM** — Low individually, but high volume. Free tier essential for acquisition.

### Realmweaver Fit Score

How well Realmweaver's current architecture and design philosophy serve each archetype:

| Archetype | Fit | Rationale |
|-----------|:---:|-----------|
| **Digital-First DM** | ★★★★★ | Realmweaver's ideal user. Unified workspace, AI-assisted generation, structured entities, keyboard-driven — everything this archetype wants. |
| **Published Module Runner** | ★★★★☆ | Entity system maps perfectly to module decomposition. AI expansion within module context is a killer feature. Needs better import and guided setup workflows. |
| **Prep-Heavy Worldbuilder** | ★★★★☆ | Deep entity model with history tracking. Needs richer cross-references and wiki-style navigation to fully satisfy. |
| **Forever DM / Burnout-Risk** | ★★★★☆ | Multi-campaign support exists. AI recap generation and continuity tracking directly address burnout. Needs cross-campaign content reuse. |
| **Lazy DM / Improviser** | ★★★☆☆ | AI improv tools exist (DM Coach, RealmChat). But the interface adds ceremony — needs a bullet-point-first quick-capture mode. |
| **New/Nervous DM** | ★★☆☆☆ | No onboarding, no guidance, no guardrails. Powerful tools but intimidating without scaffolding. High priority for guided workflows. |
| **Tactical Combat DM** | ★★☆☆☆ | Theatre of the Mind combat tracker serves basic initiative/HP. By design, Realmweaver will never match dedicated combat tools (Improved Initiative, Shieldmaiden). This archetype is best served indirectly — prep NPCs and encounters in Realmweaver, run combat in a dedicated tracker. |

### Archetype Migration Paths

```
New DM ──────┬──> Worldbuilder (discovers they love building worlds)
             ├──> Lazy DM (discovers improv is more fun than scripting)
             ├──> Tactical DM (discovers they love encounter design)
             ├──> Module Runner (sticks with published content, gets good at adapting)
             └──> Drops out (most common; the DM shortage is real)

Module Runner ──> Worldbuilder (module inspires homebrew setting expansion)
              ──> Lazy DM (module provides structure, learns to improv within it)
              ──> Digital-First DM (discovers power of digital tooling through Realmweaver)

Worldbuilder ──> Forever DM (takes on more groups who want their world)
             ──> Lazy DM (burns out on prep, discovers Sly Flourish)
             ──> Digital-First DM (natural evolution as campaign complexity grows)

Lazy DM ─────> Digital-First DM (finds tools that match their minimal-ceremony philosophy)

Any Archetype ──> Forever DM (by default, over time, because nobody else will DM)
Any Experienced ──> Digital-First DM (as campaign data grows, analog tools hit limits)

Forever DM ────> Burnout / Hiatus ──> Returns as Lazy DM (refuses to over-prep again)
                                  ──> Returns as Module Runner (outsources creative burden)
```

### Primary vs. Secondary Archetypes

Based on design philosophy alignment and market fit:

**Primary (design for these first):**
1. **Digital-First DM** — The core user. Every feature decision should ask "does this help the Digital-First DM?"
2. **Published Module Runner** — Underserved market with high demand. Realmweaver's entity + AI architecture is uniquely suited.
3. **Forever DM / Burnout-Risk** — High willingness to pay, clear pain points Realmweaver addresses.

**Secondary (serve well, don't distort product for):**
4. **Prep-Heavy Worldbuilder** — Strong natural fit, but resist the pull toward becoming "World Anvil with AI."
5. **Lazy DM / Improviser** — Serve through speed and minimal ceremony, not through feature depth.

**Tertiary (accommodate, don't target):**
6. **New/Nervous DM** — Serve through onboarding and guided workflows, not by simplifying core features.
7. **Tactical Combat DM** — Acknowledge the TotM combat tracker serves basic needs; point to dedicated tools for deeper combat management.
