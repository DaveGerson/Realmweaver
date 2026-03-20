# Realmweaver Entity Model & Relationships

All types live in `types/` with barrel export via `types/index.ts`.
All CRUD operations are in `services/campaignService.ts`.

---

## Campaign (Root Container)

| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID |
| title | string | Campaign name |
| settingType | 'custom' \| 'official' | |
| officialSetting? | string | e.g., "Forgotten Realms" |
| setting | string | Custom or override description |
| activeEncounter? | Encounter | Currently running combat |
| activeSceneId? | string | Scene being played live |
| activeSessionId? | string | Session Runner active session |

**Contains arrays of:** npcs, locations, factions, items, adventures, articles, sessionLogs, playerCharacters, plots, notes

---

## Entity Types

### NPC (`types/NPC.ts`)

| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID |
| name | string | Full name/title/alias |
| description | string | Physical appearance, attire |
| traits | string | 2-3 actionable personality traits/mannerisms |
| backstory | string | Concise history |
| motivations | string | Goals and desires |
| secrets | string | GM-only hidden info |
| stats | string | TTRPG-agnostic capability summary |
| exampleQuote | string | Characteristic dialogue line |
| factionId? | string | FK to Faction |
| relationships | EntityRelationship[] | Connections to other entities |
| history | HistoryEntry[] | Version history for undo/tracking |

### Location (`types/Location.ts`)

| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID |
| name | string | |
| description | string | Read-aloud sensory text |
| secrets | string | Hidden details for investigation |
| loot? | LootItem[] | Items findable here |
| parentLocationId? | string | Hierarchy (with cycle detection) |
| subLocationIds | string[] | Child locations |
| connections? | LocationConnection[] | Paths to other locations |
| pointsOfInterest? | PointOfInterest[] | Interactive elements |
| controllingFactionId? | string | FK to Faction |
| history | HistoryEntry[] | Version history |

### Faction (`types/Faction.ts`)

| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID |
| name | string | |
| description | string | Purpose, public image |
| goals | string | Objectives (plot hooks) |
| leaderId? | string | FK to NPC |
| memberIds | string[] | FK to NPCs |
| alignment? | string | e.g., "Lawful Evil" |
| resources? | string | Assets and tools |
| influence? | string | Where/how they exert power |
| headquartersLocationId? | string | FK to Location |

### Item (`types/Item.ts`)

| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID |
| name | string | |
| description | string | Appearance and history |
| rarity | ItemRarity | common/uncommon/rare/very rare/legendary/artifact |
| properties | string | Mechanical rules text |

### Adventure (`types/Adventure.ts`)

| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID |
| title | string | |
| level | number | Suggested starting level |
| hook | string | One-sentence player hook |
| theme | string | Keywords (e.g., "mystery, horror") |
| scenes | Scene[] | Ordered sequence of scenes |

### Scene (`types/Scene.ts`)

| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID |
| title | string | e.g., "Graveyard Ambush" |
| type | SceneType | combat/social/exploration/puzzle |
| status | SceneStatus | planned/in-progress/completed |
| readAloudText | string | Box text for players |
| gmNotes | string | GM-only: goals, motivations, outcomes |
| skillChecks | SkillCheck[] | Explicit checks in the scene |
| rewards | string | Loot, XP, other rewards |
| locationId? | string | FK to Location |
| npcIds | string[] | FK to NPCs |

### Article (`types/Article.ts`)

| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID |
| title | string | |
| category | ArticleCategory | lore/history/cosmology |
| content | string | Encyclopedic world-building text |
| parentArticleId? | string | Hierarchy support |
| subArticleIds | string[] | Child articles |
| relatedEntityIds? | string[] | Cross-references to any entity |

### SessionLog (`types/SessionLog.ts`)

| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID |
| title | string | Session name |
| status | SessionStatus | planned/active/completed |
| sessionDate | string | Scheduling |
| adventureId? | string | FK to Adventure |
| plannedSceneIds | string[] | Pre-planned scenes |
| prepNotes | string | GM prep |
| relatedPlotIds | string[] | Plots advanced |
| runningNotes | string | Freeform live notes |
| structuredNotes | SessionLogEntry[] | Tagged/categorized entries |
| encounterLog | Encounter[] | Archived combats |
| diceRolls? | DiceRoll[] | Recorded rolls |
| recap | string | Post-session summary |
| notableEvents | string | Highlights |
| looseEnds | string | Unresolved threads |

### Plot (`types/Plot.ts`)

| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID |
| title | string | |
| description | string | |
| status | PlotStatus | active/resolved/dormant |
| relatedEntityIds | string[] | NPCs, Locations, Factions involved |

### PlayerCharacter (`types/PlayerCharacter.ts`)

| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID |
| playerName | string | Real player name |
| characterSocial | CharacterSocial | name, background, species, personality, appearance, backstory, ideals, bonds, flaws |
| characterStatistics | CharacterStatistics | classes, attributes (6 ability scores), skills (18 D&D skills), actions, specialActions |

### Encounter (`types/Encounter.ts`)

| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID |
| sessionId? | string | FK to SessionLog |
| sceneId? | string | FK to Scene |
| round | number | Current combat round |
| turnIndex | number | Active combatant index |
| combatants | Combatant[] | {id, name, type (pc/npc/monster), initiative, hp, maxHp, ac?, notes?} |

---

## Key Relationships

```
Campaign
  |-- npcs[] -----------> NPC.factionId? ---------> Faction
  |-- locations[] ------> Location.parentLocationId -> Location (hierarchy, cycle detection)
  |                        Location.controllingFactionId -> Faction
  |-- factions[] -------> Faction.leaderId --------> NPC
  |                        Faction.memberIds[] ----> NPC[]
  |                        Faction.headquartersLocationId -> Location
  |-- adventures[] -----> Adventure.scenes[] ------> Scene
  |                        Scene.locationId -------> Location
  |                        Scene.npcIds[] ---------> NPC[]
  |-- sessionLogs[] ----> SessionLog.adventureId --> Adventure
  |                        SessionLog.plannedSceneIds -> Scene[]
  |                        SessionLog.relatedPlotIds -> Plot[]
  |-- plots[] ----------> Plot.relatedEntityIds --> any entity
  |-- articles[] -------> Article.parentArticleId -> Article (hierarchy)
  |                        Article.relatedEntityIds -> any entity
  |-- playerCharacters[]
  |-- notes[]
  |-- activeEncounter?
```

## Relationship Management (campaignService)

| Operation | Method | Behavior |
|-----------|--------|----------|
| Link NPC to faction | `linkNpcToFaction(npcId, factionId)` | Sets NPC.factionId, adds to Faction.memberIds (bidirectional) |
| Unlink NPC from faction | `unlinkNpcFromFaction(npcId)` | Clears NPC.factionId, removes from Faction.memberIds |
| Set location parent | `setLocationParent(locationId, parentId)` | With **cycle detection** -- prevents circular hierarchies |
| Link scene to location | `linkSceneToLocation(sceneId, locationId)` | Sets Scene.locationId |
| Link scene to NPCs | `linkSceneToNpcs(sceneId, npcIds)` | Sets Scene.npcIds |
| Delete entity | `delete[Entity](id)` | **Cascade deletion** -- cleans up all references in related entities |
