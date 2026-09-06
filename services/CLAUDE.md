# CLAUDE.md — `services/`

State, persistence, import/export, prompt-context assembly, and rule-based checks.
AI lives in `services/ai/` — see `services/ai/CLAUDE.md`.

| File | Responsibility |
|------|----------------|
| `campaignService.ts` | Immer-based campaign store factory + `campaignService` singleton. All CRUD, relationships, session runtime, autosave. |
| `storageService.ts` | `createStorageService()` + `storageService` singleton. localStorage writes, IndexedDB quota fallback, rotating backups, cross-tab conflict events. |
| `importExportService.ts` | `validateImportedCampaign`, `validateExportRoundTrip`, `exportCampaignAsJson`, `exportCampaignAsObsidian`, `importCampaignFromJsonValidated`, `importCampaignFromJson`, `CURRENT_CAMPAIGN_VERSION`. |
| `contextBuilder.ts` | `buildCampaignContext(options)` — tiered, token-budget-aware `campaignContext` string. |
| `continuityChecker.ts` | `checkContinuity(campaign)` — pure, 10 rule functions emitting 13 distinct `ruleId`s (`checkMysteryEdges` alone emits four E1/E2 mystery lints; `checkExpiredClocks` emits the `info`-only `clock-expired` nudge for an active plot whose countdown is full), returns `ContinuityIssue[]`. |
| `aiService.ts` | The AI facade. See `services/ai/CLAUDE.md`. |
| `linking/autoLinker.ts` | `autoLinkScenes`, `autoLinkNpcFactions` — name-in-prose → id linking, used by `importTemplateData`. |
| `linking/matchingEngine.ts` | `MatchingEngine` + `TextMatchingEngine` (Unicode word-boundary regex, longest-name-first, min 3 chars). |
| `linking/engineRegistry.ts` | `getMatchingEngine` / `setMatchingEngine` / `resetMatchingEngine` — swap the engine in tests. |

## campaignService.ts

`createCampaignStore({ persist })` returns the store; `campaignService = createCampaignStore({ persist: true })`.
The factory calls `service.init()` before returning — constructing a store has side effects.
Tests use `{ persist: false }` (init then just sets `appStatus: 'welcome'`).

- `subscribe(fn)` returns an unsubscribe; `getState()` returns the snapshot (`useSyncExternalStore` pair);
  `_updateState` is exposed for tests only. `CampaignState` also carries `conflictDetected` and
  `recoveredFromBackup`; `SaveStatus` includes `'quota-warning'`.
- **`updateState` vs `_internalUpdate`** — both `produce` + `notify`. `updateState` additionally calls
  `scheduleSave()`. Anything that only touches meta-state (`saveStatus`, `appStatus`, `conflictDetected`,
  `recoveredFromBackup`) MUST use `_internalUpdate` or it re-arms the autosave loop forever.
- **Autosave**: 2 s debounce (`AUTO_SAVE_DELAY_MS`) plus a 10 s max-wait (`AUTO_SAVE_MAX_WAIT_MS`) armed only for the *first* change in a burst.
  `init()` registers `pagehide` / `beforeunload` / `visibilitychange` handlers calling `flushPendingSaveSync()`, which no-ops unless a timer was
  actually pending — a redundant flush would rotate a duplicate through the backup buffer and evict a useful generation.
- **`persistToStorage`** invariants: returns early while `state.conflictDetected` is set (a stale tab must not clobber the other tab); localStorage
  writes happen synchronously *before* the first `await` so unload flushes land; it then awaits `SaveResult.pending` for durable confirmation; a
  monotonic `saveSequenceToken` lets only the newest in-flight write stamp `saveStatus` / `lastSavedAt`. Active-campaign-id saves pass `{ skipBackup: true }`.
- **`init()`** loads via the async `storageService.load()` (IDB-aware), parses, and runs `migrateCampaignsData`. On a `JSON.parse` failure it walks
  `storageService.getBackups(CAMPAIGNS_STORAGE_KEY)` newest-first and sets `recoveredFromBackup`. It never calls `storageService.remove()` on corrupt
  data — the payload stays put for manual recovery. Storage reads are try/caught so `appStatus` always leaves `'loading'`.
- `destroy()` disposes init's listeners + conflict subscription (call it in `afterEach` for `persist: true` stores); `flushPendingSave()` is the public
  sync flush; `resolveConflict('reload' | 'overwrite')` is the only way to clear the save block; `dismissBackupRecoveryNotice()` clears the banner flag.
  `components/layout/StatusBanners.tsx` consumes the last three.
- **`migrateCampaignsData`** is the single migration mapper shared by `init()`, the backup-recovery path, `resolveConflict('reload')`, and
  `importCampaign`. Add every new required-array backfill here *and* in `importExportService.normaliseRequiredArrays` — they are kept in lockstep.

### The Stage & the scene menu (unstructured play)

`docs/design/unstructured-play.md`. The live where/who/what of the table lives on the ACTIVE session as
`SessionLog.stage?: SessionStage` (`{ locationId?, place?, npcIds, focus? }`), independent of any prepped scene.

- Stage writers (all target the active session; the ones that change table truth auto-log a `scene-transition`
  entry): `updateStage(partial)` (silent), `setStageLocation(locationId | null, place?)` ("Moved to: …"; an unknown
  id is treated as null; a linked location clears the freeform place), `addNpcToStage(id): boolean` ("… enters the
  scene"; false when already there or unknown), `removeNpcFromStage(id)` ("… leaves the scene"), `setStageFocus(text)`
  ("Now: …", only when changed and non-empty).
- Scene menu: `enterScene(sceneId)` (previous scene stays `in-progress`; a completed scene is reopened; the Stage is
  reset), `leaveScene({ complete })` ("Done" / "Set Aside"; seeds the Stage from the scene via the same roster rule
  the runner renders with — `plannedNpcIds` / `plannedLocationIds` win when present, finding #26 — merged with the
  prior Stage cast), `addPlannedScene(id): boolean` / `removePlannedScene(id)` (put back on the shelf: reopens an
  in-progress scene as `planned`, clears `activeSceneId` if it was live). `goLive` and `advanceScene` resolve scenes
  **campaign-wide** through `utils/storyDerivations.resolveSceneById` — `plannedSceneIds` may hold scenes from several
  adventures — and `advanceScene` past the last scene seeds the Stage instead of leaving `activeSceneId` empty.
- `goLive` is idempotent for the session that is already live (the prep wizard calls it and then `App.handleGoLive`
  calls it again). `createFreeformSession(title?)` mints a planned freeform log with an empty Stage and does NOT go live.
- `tickPlotClock(plotId, delta = 1)` clamps `Plot.clock.filled` to `[0, segments]` and logs a `world-moved` entry.
- Integrity: `stage.locationId` / `stage.npcIds` are in `_purgeEntityReferences`, `duplicateCampaign`'s remap and
  `importTemplateData`'s remap (unknown ids dropped); `importExportService.normaliseRequiredArrays` and
  `migrateCampaignsData` (lockstep) guarantee `stage.npcIds` on an object Stage and DROP a Stage that is not a plain
  object, and `_ensureStage` replaces rather than patches one that slipped through. `goLive` clears `activeSceneId`
  when the new session has no scene to open on, so a scene-less session never inherits the previous live session's
  scene. `Plot.clock` / `Plot.ifIgnored` are non-id-bearing; `importTemplateData` validates them the way it validates
  `Secret.isVital` / `cluesNeeded`, and validates `PlayerCharacter.playerFlags` the way it validates
  `Location.aspects` (strings only, absent when empty) — every reader of `playerFlags` (`contextBuilder`,
  `dmCoach.generateCheckInQuestions`, `normalizePlayerCharacter`) also tolerates a non-array.

### Cascade deletion

`_purgeEntityReferences(draftCampaign, entityId)` sweeps NPC relationships/mentions, location
connections/mentions, NPC/location `history[].referenceId` (nulled + `referenceType: 'manual'` — the timeline row
itself stays), faction `leaderId`/`headquartersLocationId`/mentions, scene mentions, plot and article
`relatedEntityIds`/mentions, session-log `relatedPlotIds`/`plotProgressions`/`structuredNotes[].taggedEntityIds`/
`plannedNpcIds`/`plannedLocationIds`/`stage.locationId`/`stage.npcIds`, secret `linkedEntityIds`/`revealedInSessionId`/`revealsSecretId`, and `campaign.pinnedEntities`.

All twelve entity deletes call it: `deleteNpc`, `deleteLocation`, `deleteFaction`, `deleteItem`, `deleteArticle`,
`deleteAdventure`, `deleteScene`, `deleteSessionLog`, `deletePlayerCharacter`, `deletePlot`, `deleteNote`,
`deleteSecret`. `deleteCampaign` does not (the whole container goes). `deleteAdventure` also runs the sweep for
each scene the adventure contains (mirroring `deleteScene`). **A new entity type's delete method must call
it, and a new id-bearing field must be added to the sweep** — otherwise dangling ids survive forever.

- `duplicateCampaign` / `importTemplateData` use a **two-pass id remap**: pre-register every id an entity actually
  *owns* (nested scene / PointOfInterest / loot ids included), then resolve references with a pure `idMap.get(id)`
  lookup. Never let the remapper mint a UUID for an unknown id — `duplicateCampaign` preserves it (`?? id`),
  `importTemplateData` drops it.
- `importCampaign(file)` pre-migrates legacy `plots[].name` / `keyNpcIds` in the raw file text *before*
  `importCampaignFromJsonValidated` sees it (the validator would auto-name and blank them), then runs
  `migrateCampaignsData`, remints a colliding campaign id, and returns `{ title, warnings }`.
- `batchAddToCampaign` / `createFullAdventure` build scenes from `createDefaultScene()` before spreading AI data
  over them — never trust a generator for `npcIds` / `status` / `skillChecks`. `batchAddToCampaign` also resolves
  `npc.factionId` / `location.parentLocationId` by **name or already-resolved id** so the reverse links land.
- `createPlayerCharacterFromPdf` calls `parseCharacterSheetPdf` from `aiService` (facade), not `ai/`.

## storageService.ts

- **`SaveResult.pending`** is the durability contract: `success: true` only means the synchronous call was accepted. For a localStorage write
  `pending` is already resolved; for a quota fallback it is the real IndexedDB write, so anything reporting "saved" must await it. Both paths
  attach a no-op `.catch()` so an unawaited `pending` never reports an unhandled rejection.
- **Quota fallback**: on `QuotaExceededError` the value goes to IndexedDB (`realmweaver-db` / `campaigns`), the stale localStorage copy is removed
  once the IDB write lands (`load()` prefers localStorage and would shadow it), and only then are backups rotated. `loadSync()` is
  localStorage-only; `load()` falls back to IDB.
- **Backups**: keys are `` `${primaryKey}__backup_${index}` `` (namespaced per primary key), `MAX_BACKUPS = 3`, slot 1 = newest. Rotation takes the
  value captured *before* the primary write and runs *after* it succeeds, so it never competes for quota; it is skipped for no-op writes
  (`previousValue === value`) and for `{ skipBackup: true }`. Legacy unnamespaced `CAMPAIGNS_BACKUP_<n>` keys are deleted once per service instance.
- `getBackups(primaryKey)` / `restoreFromBackup(primaryKey, index)` **require** the primary key — there is no default, and `restoreFromBackup`
  deliberately does not re-rotate. `onConflict(cb)` fires on the window `storage` event for any key that is not `/__backup_\d+$/` and returns an
  unsubscribe; only `campaignService` narrows it to the campaigns key.
- All globals go through `_ls()` / `_win()` lazy accessors so `vi.stubGlobal` works. Never capture `localStorage` / `window` at module scope.

## importExportService.ts

`validateImportedCampaign` is pure and never throws. Order matters and is load-bearing:

1. Reject a `version > CURRENT_CAMPAIGN_VERSION` file **before any mutation** (no laundering a downgrade).
2. Campaign-level `id` + `title` (legacy `name` → `title`, with a warning).
3. `applyMigrations` (stamps `version`; version 0 warns).
4. Per-array entity validation — entries without an `id` are dropped, missing names/titles auto-named (warnings).
5. `dedupeIdsAcrossCampaign` — campaign-wide id uniqueness, first occurrence wins in `ID_BEARING_ARRAY_KEYS`
   order. Nested `adventures[].scenes`, `locations[].pointsOfInterest`, and `locations[].loot` share the **same**
   `seenIds` set, so a scene id colliding with an NPC id is caught.
6. `normaliseRequiredArrays` — backfills `memberIds`, `subLocationIds`, `npcIds`, etc.

`importCampaignFromJsonValidated` resolves an `ImportValidationResult` (never rejects) — warnings must reach the
UI. `importCampaignFromJson` is the throw-on-error wrapper. `exportCampaignAsJson` strips `gcpApiKey`, stamps
`version`, and returns the `validateExportRoundTrip` result (entity-count comparison) so callers can warn.

## contextBuilder.ts

`buildCampaignContext({ variant, campaign, activeSceneId, activeSessionId, maxTokenEstimate, focusEntityId,
focusEntityType, focusSelection })` — an **options object**, not positional args. `maxTokenEstimate` defaults to
4000, converted at 1 token ≈ 4 chars. `variant` is `'generation' | 'coach' | 'chat' | 'player-safe'` — the last
one (ontology element **E3**) is the player-facing build: it emits no GM-authored private prose (`NPC.secrets`,
`Location.secrets`, `Scene.gmNotes`, session prep/running notes, the plot-threads section) and no unrevealed
`Secret`, while `'generation'` / `'coach'` gain a Tier-2 GM-ONLY section of unrevealed secrets linked to the active
scene's entities. Revealed secrets appear as established party knowledge in all three; `'chat'` gains neither
section. Tier 1 (identity, setting, `styleProfile`, active session/scene, and — when the active session has a
non-empty Stage — an **On Stage Now** section: place and present cast in every variant, the DM's `focus` line
GM-only) always tries first; Tier 2 adds scene participants (the scene's cast ∪ the Stage's cast, deduplicated; the
Stage's ids also count as scene-relevant for the GM-ONLY secrets section), the active location (skipped when the
Stage already named a place), plots (each line carries `[clock n/m]` and `— if ignored: …` when set), focus entity,
and — `coach` only — the active encounter; Tier 3 fills the remainder with roster overviews (skipped for `coach`). Lists fill **entry-by-entry**
(`tryAddList` / `tryAddJoined`, with an "…and N more" marker), and each Tier-3 section takes a fair share via
`nextTier3Quota()` so a greedy roster cannot starve the sections after it. Add new Tier-3 sections through the
same quota helper.

## Gotchas

| Rule | Why |
|------|-----|
| Never mutate `state` directly | Everything goes through `updateState` / `_internalUpdate` (Immer `produce`). |
| Meta-state uses `_internalUpdate` | `updateState` schedules a save → infinite save loop. |
| New delete method → call `_purgeEntityReferences` | Cascade deletion is not automatic. |
| New id-bearing field → add to the purge sweep AND `ID_BEARING_ARRAY_KEYS`/nested dedupe | Dangling ids and duplicate-id corruption. |
| New required array → `migrateCampaignsData` **and** `normaliseRequiredArrays` | The two ingestion paths must not drift. |
| Await `SaveResult.pending` before claiming "saved" | Quota-fallback writes are async. |
| Don't `remove()` unparseable saved data | Backup recovery depends on it still being there. |
| `services/` imports `aiService.ts`, not `ai/*` | Mock mode is enforced at the facade. |
| `linking/matchingEngine` must mirror `components/common/LinkedText.tsx`'s matcher | The two systems disagree otherwise (Unicode boundaries, longest-match). |
| Tests: `createCampaignStore({ persist: false })`, and `destroy()` any `persist: true` store | Init registers real window listeners. |

Ship-hardening rationale for most of the above lives in `docs/ship-readiness/remediation-plan.md`; regression tests
are in `tests/ship/wp-a-persistence.*`, `tests/ship/wp-b-import-export.*`, and `tests/storageService.test.ts`.
