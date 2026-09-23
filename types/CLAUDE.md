# CLAUDE.md — `types/`

Pure type declarations. No runtime code, no imports outside `types/`. One file per entity, re-exported by the
`types/index.ts` barrel — **always import from `@/types/index`** (or `../types/index`), never from a leaf file, or
two modules end up holding structurally-identical-but-separately-imported types.

| File | Declares |
|------|----------|
| `Campaign.ts` | `Campaign`, `SettingType` — the root aggregate; every entity array hangs off it. |
| `NPC.ts` | `NPC` (incl. optional `voiceNotes?` — non-id-bearing, read as `?? ''`), `EntityRelationship`; re-exports `HistoryEntry` / `HistoryReferenceType` from `common`. |
| `Location.ts` | `Location` (incl. optional `aspects?` — Lazy DM step 5's sensory one-liners, non-id-bearing, read as `?? []`, empty is `undefined` never `[]`), `LocationConnection`, `PointOfInterest`, `PoiInteraction`, `LootItem`. |
| `Faction.ts` | `Faction`. |
| `Item.ts` | `Item`, `ItemRarity`, `ItemType`. |
| `Adventure.ts` | `Adventure` — a container of `Scene[]`. |
| `Scene.ts` | `Scene`, `SceneType`, `SceneStatus`. |
| `Article.ts` | `Article`, `ArticleCategory`. |
| `Plot.ts` | `Plot`, `PlotStatus`, `PlotClock` — incl. the optional pressure fields `clock?` (`{ segments, filled }`, non-id-bearing; always read through `utils/plotClock.normalizePlotClock`) and `ifIgnored?` (the plot's own move when the party does nothing). |
| `Note.ts` | `Note`. |
| `Secret.ts` | `Secret` — incl. the optional E1/E2 mystery-edge fields: `revealsSecretId?` (id-bearing clue→revelation FK — in the purge-sweep / both-remap-passes / backlink / broken-ref contract), `isVital?`, and `cluesNeeded?` (read as `cluesNeeded ?? 3`). |
| `SessionLog.ts` | `SessionLog`, `SessionLogEntry`, `SessionLogEntryType` (incl. `'world-moved'` — a plot clock ticked), `SessionStatus`, `PlotSessionStatus`, `Beat`, `SessionStage` — the optional `SessionLog.stage?` is the live where/who/what of the table (unstructured play); its `locationId` / `npcIds` are **id-bearing** and in the purge-sweep / both-remap-passes contract, `npcIds` is backfilled by `normaliseRequiredArrays` when a stage is present. |
| `PlayerCharacter.ts` | `PlayerCharacter` (incl. optional `playerFlags?: string[]` — Table Pulse, "what this player wants more of", non-id-bearing, top-level, read as `?? []`; survives `normalizePlayerCharacter`, `duplicateCampaign` and template import via the wholesale spread), `CharacterSocial`, `CharacterStatistics`, `AbilityScores`, `Skills`, `ProficiencyLevel`, `ClassLevel`. |
| `Encounter.ts` | `Encounter`, `Combatant`, `CombatantType` — live combat state, distinct from a `'combat'` Scene's prep data. |
| `SkillCheck.ts` | `SkillCheck`. |
| `DiceRoll.ts` | `DiceRoll`. |
| `RollableTable.ts` | `RollableTable`, `RollableTableEntry` — AI output only, never persisted on `Campaign`. |
| `Evocation.ts` | `AdventureForBatchAdd`, `BatchAddData` — the AI-generation wire shapes. |
| `RealmChat.ts` | `ChatMessage`, `DraftEntity`, `DraftEntityStatus`, `RealmChatResponse`, `ModelTier`. |
| `Graph.ts` | `EntityType` (a real `enum`, uppercase members), `GraphNode`, `GraphLink` for `RelationshipGraph`. |
| `CampaignSetting.ts` | `DmStyle` (`'guided' | 'standard' | 'power'`). |
| `common.ts` | `HistoryEntry`, `HistoryReferenceType`. |
| `speech-recognition.d.ts` | Ambient Web Speech API declarations. **Not** in the barrel — global by being a `.d.ts`. |

## Identity fields

The `id: string` + `name: string` rule is the *aspiration*; the actual shapes differ and code must not assume `name`:

- **`name`**: `NPC`, `Location`, `Faction`, `Item` (also `PointOfInterest`, `GraphNode`, `Combatant`).
- **`title`**: `Adventure`, `Scene`, `Article`, `Plot`, `Note`, `Secret`, `SessionLog`, `Campaign`, `RollableTable`.
- **Neither**: `PlayerCharacter` — display name is `characterSocial.characterName`, owner is `playerName`.
  `utils/entityDetailExtractors.ts`'s `lookupEntity` is the canonical per-type name resolver.
- **No `id` at all**: `RollableTable` / `RollableTableEntry` (transient AI output), `AbilityScores`, `Skills`,
  `CharacterSocial`, `CharacterStatistics`, `ClassLevel`.

Anything generic over entities (`useEntitySearch`, dashboards) requires `{ id, name }`, so `title`-keyed entities must
be mapped to a `{ ...e, name: e.title }` copy at the call site. Do not "fix" this by adding a redundant `name`.

## `mentionedEntityIds`

Optional `string[]` on exactly six types — `NPC`, `Location`, `Faction`, `Article`, `Plot`, `Scene`. Those are the only
possible @-mention **sources**; everything else is a mention **target** only. `Item` deliberately has no such field
(no editor mounts `MentionInput` for items). Adding the field to a new type means adding it to
`utils/backlinkUtils.ts`'s `scanAllMentionSources` in the same change, or its mentions produce no backlinks.

## `Campaign` arrays

Required: `articles`, `adventures`, `npcs`, `locations`, `factions`, `items`, `sessionLogs`, `playerCharacters`,
`plots`, `notes`. Optional: `secrets?` — the one entity array that can legitimately be `undefined` on an older save,
so read it as `campaign.secrets ?? []`. Non-array optional state: `activeEncounter`, `activeSceneId`,
`activeSessionId`, `pinnedEntities`, `dmStyle`, `featureOverrides`, `wizardDismissed`, `styleProfile`, `gcpApiKey`.

Declaring an array required in this file is a promise, not an enforcement — a save written by an older build still
lacks it. The backfill lives in **two** places that are kept in lockstep: `migrateCampaignsData` in
`services/campaignService.ts` (localStorage/import path) and `normaliseRequiredArrays` in
`services/importExportService.ts` (JSON-file path). A new required array needs an entry in both, plus
`ID_BEARING_ARRAY_KEYS` in `importExportService.ts` if its entries carry ids.

## Versioning & migration

**`Campaign` has no `version` field, and adding one to this interface is not how schema versioning works here.**
`version` exists only on the serialised JSON envelope:

- `CURRENT_CAMPAIGN_VERSION` (currently `1`) lives in `services/importExportService.ts`.
- `exportCampaignAsJson` stamps `version` onto the exported object; `applyMigrations` reads `data['version']`
  (absent ⇒ `0`, which warns) and stamps the current value after migrating.
- `validateImportedCampaign` rejects `version > CURRENT_CAMPAIGN_VERSION` **before** any mutation, so a newer file
  can never be laundered into an older build.
- In-memory and in-localStorage campaigns are unversioned; `migrateCampaignsData` upgrades them structurally by
  shape-sniffing (e.g. legacy `plots[].name` → `title`, `plots[].keyNpcIds` → `relatedEntityIds`).

Bumping the schema means: bump `CURRENT_CAMPAIGN_VERSION`, add the `if (version < N)` branch in `applyMigrations`,
and mirror the same transformation in `migrateCampaignsData`.

## `AdventureForBatchAdd` — the normalization contract

`types/Evocation.ts`:

```ts
export type AdventureForBatchAdd = Omit<Adventure, 'id' | 'scenes'> & {
    scenes: (Omit<Scene, 'id' | 'status' | 'npcIds'> & Partial<Pick<Scene, 'status' | 'npcIds'>>)[];
};
```

The real provider's `sceneSchema` (`services/ai/realmWeaver.ts`) requires only
`title`, `type`, `readAloudText`, `gmNotes`, `skillChecks`, `rewards` — it never returns `id`, `status`, `npcIds`,
`locationId` or `mentionedEntityIds`. The RealmChat draft-adventure path has no post-processing step at all, so it can
omit `skillChecks` too. `status`/`npcIds` are typed **optional rather than removed** so the ~20 call sites that *do*
supply them (notably `evocationWizard.postProcessResult`) keep compiling, while a consumer of the raw provider shape
gets a compiler error instead of a false promise.

Defaulting happens at exactly two places, both in `services/campaignService.ts`, and both build from
`createDefaultScene()` and spread the AI data **over** it so every current and future `Scene` field is normalised in
one move:

| Where | Does |
|-------|------|
| `createFullAdventure(adventureData)` | `{ ...createDefaultScene(), ...sceneData, id: crypto.randomUUID(), npcIds: ?? [], status: ?? 'planned', skillChecks: ?? [] }` |
| `batchAddToCampaign(...)` | Same construction for `advData.scenes`, plus name-or-id resolution of `npc.factionId` / `location.parentLocationId`. |

A third normaliser lives in `services/aiService.ts`: `toAdventureForBatchAdd` narrows mock-mode `scenes[].type` /
`scenes[].status` (typed as plain `string` in `mockService.ts`) to their literal unions, falling back to `'social'` /
`'planned'`. It is used only by `generateStarterAdventure`'s mock branch.

**Never consume `AdventureForBatchAdd.scenes` directly in a component or editor** — go through the campaignService
methods, or you will dereference `undefined` `npcIds` / `skillChecks`. Guarded by
`tests/ship/wp-c-ai-services.adventure-scene-normalization.test.ts`.

`BatchAddData` applies the same "omit what the store mints" rule to the other types: `npcs` omit `id` +
`knowsPlayerHistory`, `locations` omit `id` + `subLocationIds`, `factions` omit `id` + `leaderId` + `memberIds`,
`items` omit `id`.

## Two different `ModelTier`s

`types/RealmChat.ts` exports `ModelTier = 'performance' | 'medium' | 'quality'` — the RealmChat widget's user-facing
picker. `services/ai/modelConfig.ts` exports a *different* `ModelTier = 'lite' | 'standard' | 'quality'` — the provider
tier. `services/ai/realmChat.ts`'s `mapTierToModel` bridges them (`performance→lite`, `medium→standard`,
`quality→quality`). Importing `ModelTier` from `@/types/index` gives you the **RealmChat** one; provider code must
import from `@/services/ai/modelConfig`.

## Adding an entity type

Type-side steps (the full 13-step list is in the root `CLAUDE.md`): create `types/NewEntity.ts` with `id` plus a
`name` or `title`, export it from `types/index.ts`, add the array to `Campaign`, then backfill it in **both**
`migrateCampaignsData` and `normaliseRequiredArrays` and add the key to `ID_BEARING_ARRAY_KEYS`.

## Gotchas

| Rule | Why |
|------|-----|
| Import from `types/index.ts`, never a leaf file | Barrel is the contract; leaf paths drift. |
| Don't assume `.name` | Half the entities key on `title`; `PlayerCharacter` on neither. |
| Runtime code never lives here | These files are erased at build; a default value belongs in `utils/entityUtils.ts`. |
| A required array is a promise, not a guarantee | Old saves lack it — backfill in both migration paths. |
| Don't add `version` to `Campaign` | It is a JSON-envelope field owned by `importExportService.ts`. |
| `AdventureForBatchAdd` scenes are partial | Normalise via `campaignService`, never consume raw. |
| New `mentionedEntityIds` field → update `scanAllMentionSources` | Otherwise mentions produce no backlinks. |
| `ModelTier` is ambiguous — check the import path | Two unrelated unions share the name. |

Ship-hardening rationale for the `AdventureForBatchAdd` and `PlayerCharacter` shapes is in
`docs/ship-readiness/remediation-plan.md` (findings #7 and the wp-j PC-schema group).
