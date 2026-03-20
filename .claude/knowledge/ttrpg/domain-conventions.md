# TTRPG Domain Conventions for Realmweaver

Terminology, design principles, and genre expectations for tabletop RPG
content. Realmweaver is system-agnostic but defaults to D&D 5e conventions.

---

## Core Terminology

| Term | Meaning in Realmweaver |
|------|----------------------|
| **Campaign** | A complete game world with all entities. One GM, multiple sessions. |
| **Adventure** | A narrative arc containing scenes. Like a "module" or "quest line." |
| **Scene** | A discrete unit of gameplay: combat, social, exploration, or puzzle. |
| **Encounter** | The live mechanical state of a combat (HP, initiative, rounds). |
| **NPC** | Non-Player Character -- any character the GM portrays. |
| **PC / Player Character** | A character controlled by a player. Imported, not AI-generated. |
| **Faction** | An organization, guild, cult, or group with goals and members. |
| **Location** | A place in the world -- can be nested (region > city > tavern). |
| **Article** | A lore entry: history, cosmology, or world-building encyclopedia text. |
| **Session Log** | Record of a single play session with prep, notes, and recap. |
| **Plot** | A cross-session story thread (active/resolved/dormant). |
| **DM / GM** | Dungeon Master / Game Master -- the user of Realmweaver. |
| **Box Text / Read-Aloud** | Descriptive text the GM reads to players to set a scene. |
| **Stat Block** | Mechanical game statistics for a creature or NPC. |
| **DC** | Difficulty Class -- target number for skill checks. |
| **Initiative** | Turn order in combat, determined by rolling. |
| **CR** | Challenge Rating -- difficulty rating for monsters/encounters. |

## D&D 5e Conventions Used

### Ability Scores (6)
Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma

### Skills (18)
Acrobatics, Animal Handling, Arcana, Athletics, Deception, History,
Insight, Intimidation, Investigation, Medicine, Nature, Perception,
Performance, Persuasion, Religion, Sleight of Hand, Stealth, Survival

### Proficiency Levels
none, half, proficient, expertise

### Alignments
Lawful Good, Neutral Good, Chaotic Good, Lawful Neutral, True Neutral,
Chaotic Neutral, Lawful Evil, Neutral Evil, Chaotic Evil

### Item Rarities
common, uncommon, rare, very rare, legendary, artifact

### Scene Types
combat, social, exploration, puzzle

### Common DC Scale
| DC | Difficulty |
|----|-----------|
| 5 | Very Easy |
| 10 | Easy |
| 13 | Medium |
| 15 | Hard |
| 18 | Very Hard |
| 20 | Nearly Impossible |
| 25 | Legendary |

---

## NPC Design Principles

Good AI-generated NPCs should have:

1. **Actionable traits** -- things the GM can physically act out at the table
   (a nervous laugh, always speaking in questions, fidgeting with a coin)
2. **A secret** -- every NPC should know or hide something. This gives the
   GM material when players probe deeper.
3. **Clear motivations** -- what the NPC wants RIGHT NOW, not just backstory.
   Motivations drive scenes. "Wants to find her missing brother" is better
   than "grew up on a farm."
4. **An example quote** -- a single line of dialogue that captures voice and
   personality. GMs use this as a reference for improvisation.
5. **TTRPG-agnostic stats** -- reference existing stat blocks rather than
   inventing numbers. "Use Guard stat block with advantage on Intimidation"
   is more useful than custom stat numbers.

## Adventure & Scene Design

### Adventure Structure
- **Hook**: One sentence that makes players WANT to engage
- **Theme**: Keywords that set tone (horror, mystery, heist, dungeon crawl)
- **Level**: Suggested player level for encounter balancing
- **Scenes**: 2-5 interconnected scenes forming the core narrative

### Scene Structure
- **Read-Aloud Text**: Evocative, sensory-focused. Sights, sounds, smells.
  Keep it to 2-4 sentences. Never describe player actions or reactions.
- **GM Notes**: Goals for the scene, NPC motivations, potential outcomes,
  branching paths, antagonist tactics
- **Skill Checks**: Specific skill + DC + what success/failure means.
  Not "make a check" but "DC 15 Perception to notice the trap"
- **Rewards**: Specific loot, information, or story progression

### Scene Type Guidelines
| Type | Focus | Typical Checks |
|------|-------|---------------|
| Combat | Tactical encounter | Initiative, attack rolls, saves |
| Social | Roleplay, negotiation | Persuasion, Deception, Insight |
| Exploration | Discovery, travel | Perception, Investigation, Survival |
| Puzzle | Problem-solving | Intelligence checks, creative solutions |

## Location Design

- **Sensory description** -- what players experience immediately
- **Secrets** -- things found through investigation (with DCs)
- **Hierarchy** -- locations nest: Region > City > District > Building > Room
- **Points of Interest** -- interactive elements with passive perception DCs
  and investigation checks
- **Connections** -- how this location links to others

## Faction Design

- **Public vs private goals** -- what they claim vs what they actually want
- **Resources** -- concrete assets (gold, soldiers, magic, information)
- **Influence** -- where they have power and how they use it
- **Internal tensions** -- factions with internal conflict are more interesting
- **Leader + members** -- at minimum, name the leader and key members

## Session Management

### Prep Phase
- Link to the adventure being run
- Pre-select scenes planned for the session
- Write prep notes (key NPCs, possible branches, contingencies)
- Track which plots will be advanced

### During Session
- Running notes (freeform) and structured entries (tagged, timestamped)
- Track combat encounters (initiative, HP, rounds)
- Record dice rolls
- Tag entries with related entities

### Post-Session
- Write recap (what happened)
- Note notable events (highlights, surprises)
- Record loose ends (unresolved threads for future sessions)
- Update plot statuses (active/resolved/dormant)

## Plot Tracking

Plots are cross-session story threads:
- **Active**: Currently being pursued by players or NPCs
- **Dormant**: On hold but not forgotten (background events continue)
- **Resolved**: Concluded, with outcomes recorded
- Always link related NPCs, locations, and factions
