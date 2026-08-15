# CLAUDE.md — `utils/`

Pure(-ish) helpers shared across components. Nothing here holds state. Two files reach into
`services/campaignService.ts` (`entityFieldSave.ts`, `entityDetailExtractors.ts`); the rest take everything they need
as arguments and are safe to call inside `useMemo`.

| File | Exports |
|------|---------|
| `entityUtils.ts` | `ENTITY_TYPE_CONFIG`, `buildEntityContext`, `estimatePcHp`, the `createDefault*` factories, `normalizePlayerCharacter`. |
| `backlinkUtils.ts` | `computeBacklinks`, `BacklinkEntry`, `GroupedBacklinks`. |
| `entityDetailExtractors.ts` | `QuickCardEntityType`, `EntityDetail`, `ExpandedDetail`, `get*Details` / `get*ExpandedDetails`, `getExpandedDetails`, `lookupEntity`, `truncate`. |
| `entityFieldSave.ts` | `saveEntityField(entityType, entityId, fieldKey, value)` — inline quick-card edit dispatcher. |
| `dmStyleUtils.ts` | `isFeatureVisible`, `FEATURE_LABELS`, `OVERRIDEABLE_FEATURES`, `GUIDED_HIDDEN` (consumed by `DmStylePanel` to derive its "Hides:" copy). |
| `diceUtils.ts` | `parseFormula`, `rollDice`, `formatFormula`, `ParsedFormula`, `RollResult`. |
| `keyboardShortcuts.ts` | `SHORTCUTS`, `matchShortcut`, `formatShortcut`, `getModifierSymbol`, `KeyboardShortcut`. |
| `formReconciliation.ts` | `reconcileEntityFormData(prev, prevSeen, incoming)`. |
| `popoverPosition.ts` | `calculatePopoverPosition(triggerRect, isExpanded)`, `PopoverPosition`. |
| `demoTemplates.ts` | `WINTERS_DAUGHTER_SETTING`, `getWintersDaughterTemplate()`. |

## `ENTITY_TYPE_CONFIG` (entityUtils.ts)

The single source of truth for every entity's **icon name**, **Tailwind color name**, and **plural label**. Never
hardcode an entity accent color anywhere else — several ship-hardening findings (#99, #106, #116) were exactly that.

```
npc amber · location emerald · faction violet · item sky · adventure orange · article cyan
sessionLog rose · playerCharacter teal · plot yellow · note slate · scene blue
```

- `color` is a bare Tailwind color name; consumers compose the shade (`text-${color}-400`, `bg-${c}-900/50`).
- `icon` is a **key into `components/common/Icons.tsx`**, not a lucide export name (`npc → 'NPCs'`,
  `article → 'BookCopy'`, `sessionLog → 'SessionLog'`, `scene → 'Scenes'`, `plot → 'Plot'`).
- Two entity types carry **duplicate hyphenated aliases** — `'session-log'` and `'player-character'` mirror
  `sessionLog` / `playerCharacter` — because `QuickCardEntityType` and `CommandPaletteEntityType` use kebab-case.
  Add both spellings for any new multi-word type; `tests/entityUtils.test.ts` asserts the pair agrees on `color`.
- `scene` exists here (blue) specifically so `CommandPalette`, `sidebarUtils`, and `RelationshipGraph` stop
  hardcoding a scene color. Consumers: `CrossCampaignDashboard`, `RelationshipGraph`, `EntityQuickCard`,
  `CommandPalette`, `LinkSuggestionsPanel`, `CampaignSidebar` / `sidebar/sidebarUtils.ts`, `SecretsTracker`,
  `PlayerCharacterDashboard`.

**Adding a color here is a two-file change.** Build-time Tailwind only emits CSS for class names it finds as literal
strings, and every consumer above composes its classes at runtime from `config.color`. `index.css` carries an explicit
`@source inline(...)` safelist over `{text,bg,border,border-l} × {the config colors} × {300,400,500,700,900}` plus the
`{bg,border}-…/{10..60}` opacity variants. A new color that is not in that safelist renders **unstyled** in a
production build (it will look fine in `npm run dev`). `tests/ship/wp-i2-build-test-infra.tailwind-safelist.test.ts`
runs a real `vite build` and greps the emitted CSS for the full cross-product.

## `createDefault*` factories (entityUtils.ts)

`createDefaultNpc`, `createDefaultLocation`, `createDefaultFaction`, `createDefaultItem`, `createDefaultArticle`,
`createDefaultAdventure`, `createDefaultScene`, `createDefaultSession`, `createDefaultPlot`,
`createDefaultPlayerCharacter`. There is deliberately **no** `createDefaultNote` / `createDefaultSecret` — both are
minted wholesale by `campaignService.createNote` / `createSecret`, which own their `createdAt` / `lastModified`
stamps.

- Every factory returns `id: ''`. The store mints the real `crypto.randomUUID()`; a factory must never mint one, or
  duplicating/importing an entity produces an id that was never registered in the remap table.
- `createDefaultScene()` is the normalisation base for AI-generated scenes — see `types/CLAUDE.md`
  (`AdventureForBatchAdd`). Every new `Scene` field added there is automatically normalised everywhere.
- `createDefaultPlayerCharacter()` returns `Omit<PlayerCharacter, 'id'>` and is fully populated (all 6 abilities, all
  18 skills). **A shallow spread over it is not enough** — spreading a partial `characterStatistics` wipes the default
  `actions` / `specialActions` / `skills`. Use `normalizePlayerCharacter(pc)`, which deep-merges `characterSocial`,
  `characterStatistics`, `classes`, `attributes`, and `skills` and preserves `id` verbatim. Anything ingesting a
  parsed character sheet (or reading a PC persisted before this existed) must go through it.
- `estimatePcHp(pc)` is a deliberate approximation (`10 + conMod × level`, floor 1, fallback 20) for the combat
  tracker — not a rules-accurate HP calculation.

## `buildEntityContext(entityType, entity, campaign?)` (entityUtils.ts)

Builds the compact `entityContext` string for `RegenerateButton`'s per-field AI regeneration. Handles `npc`,
`location`, `faction`, `item`, `scene`, `article`, `plot`, `note`; every other type falls through to
`Name: ${entity.name}` (so `title`-keyed types get an empty string). Empty fields are dropped. `npc` is the only
branch that reads `campaign` (to resolve the faction name). Add a case when a new entity type gains inline
regeneration.

## `backlinkUtils.ts`

`computeBacklinks(entityId, entityType, campaign)` — pure, `useMemo`-safe, returns `GroupedBacklinks` (entity type →
`BacklinkEntry[]`, each group sorted by `name`). Empty groups are dropped. Consumed only by
`components/common/BacklinksPanel.tsx`.

Two shared sweeps back every scanner, and they exist so per-type coverage can't drift again (findings #46–#48):

- **`scanAllMentionSources`** — sweeps the six types that can hold `mentionedEntityIds` (`npcs`, `locations`,
  `factions`, `articles`, `plots`, and all scenes flattened out of `adventures`) for an @-mention of the target,
  labelled `"Mentioned in"`. Items are excluded as a *source* by design: `Item` has no `mentionedEntityIds` and no
  editor mounts `MentionInput` for it. **Any type that gains `mentionedEntityIds` must be added here.**
- **`computeGenericRelatedEntitySweep`** — for types that can only ever be a *target*: scans
  `articles[].relatedEntityIds` and `plots[].relatedEntityIds` (`"Referenced by"`) plus `npcs[].relationships[].targetId`
  (`"Relationship with"` — `NpcEditor` lets a relationship point at a PlayerCharacter).

Per-type coverage:

| `entityType` | Inbound references found |
|---|---|
| `npc` | faction leader/member, scenes via `npcIds` (labelled `"<Adventure> — Appears in"`), other NPCs' relationships, article + plot `relatedEntityIds`, mentions |
| `location` | child locations (`parentLocationId`), other locations' `connections`, faction HQ, scenes via `locationId`, article refs, mentions |
| `faction` | member NPCs, controlled locations, article refs, plot refs, mentions |
| `item` | article refs, plot refs, mentions |
| `adventure` | session logs (`adventureId`), article refs, mentions |
| `article` | child articles (`parentArticleId`), other articles' `relatedEntityIds`, mentions |
| `plot` | session logs (`relatedPlotIds`), article refs, mentions |
| `scene` | **parent adventure only** — no mention sweep, no `relatedEntityIds` sweep |
| `session-log`, `player-character`, `note` | the generic sweep above |
| anything else | `{}` |

Two honest limits: `computeBacklinksForScene` reports only `"Part of"` its adventure — it is currently unreachable
from the UI (no editor mounts `BacklinksPanel` for scenes), so extend it before wiring one up. And an entity type with
no `case` silently returns `{}`, which renders as "no references" rather than an error. Coverage is pinned by
`tests/backlinkUtils.test.ts` and `tests/ship/wp-d-linking.backlinks-coverage.test.ts`.

## `dmStyleUtils.ts`

`isFeatureVisible(feature, style = 'standard', featureOverrides = {})`. An explicit `featureOverrides[feature]` always
wins; otherwise `guided` hides `GUIDED_HIDDEN`, `standard` hides `STANDARD_HIDDEN` (empty today), `power` hides
nothing.

`FEATURE_LABELS` is the settings-panel source of truth and `OVERRIDEABLE_FEATURES = Object.keys(FEATURE_LABELS)` —
**order matters**, it drives display order in `DmStylePanel`. Only five keys exist, and that is the point (finding
#91): `'continuity-checker'`, `'relationship-graph'`, `'secrets-tracker'`, `'combat-tracker'`,
`'keyboard-shortcuts'`. `'plot-timeline'`, `'backlinks-panel'` and `'advanced-context'` were **removed** because
nothing called `isFeatureVisible` for them — a labelled toggle with no call site is an inert switch that persists an
override and changes nothing on screen. Adding a key here without a matching `isFeatureVisible('<key>', …)` call site
recreates that bug; `tests/ship/wp-j-types-utils.dm-style-feature-gates.test.ts` guards the invariant.

## `diceUtils.ts`

`parseFormula` accepts exactly `^(\d+)d(\d+)(kh\d+|kl\d+)?([+-]\d+)?$` (trimmed, lower-cased) and returns `null` on
anything else — including `d20` with no leading count, whitespace inside the formula, and multi-term expressions like
`1d8+1d6`. Bounds: `1 ≤ count ≤ 100`, `1 ≤ sides ≤ 1000`, `keep ≤ count`. `rollDice` returns `{ results, keptResults,
total }` — `results` is every die rolled, `keptResults` is the kh/kl subset, and `total` adds the modifier to
`keptResults` only. Log both: dropping `results` loses the advantage/disadvantage evidence the dice log shows
(`tests/ship/wp-h-tools-viz.dice-log-integrity.test.tsx`). `Math.random` is not injectable — tests use `vi.spyOn(Math, 'random')`.

## Others

- **`entityDetailExtractors.ts`** owns `QuickCardEntityType` (10 kebab-case members) as the single source of truth;
  `EntityQuickCard` re-exports it. `lookupEntity` is the canonical name resolver per type (`adventure`/`article`/
  `plot`/`session-log` → `.title`, `player-character` → `characterSocial.characterName`, `scene` → searched across all
  adventures). `ExpandedDetail.fieldKey` is what `saveEntityField` writes to; a row without it is read-only.
- **`entityFieldSave.ts`** dispatches to the right `campaignService.update*`. `scene` is special — it walks
  `campaign.adventures` to find the owning adventure id first. `player-character` is intentionally absent (nested
  structure, no inline editing); unknown types are a silent no-op.
- **`formReconciliation.ts`** — `reconcileEntityFormData` merges a new entity prop into locally-edited form state
  field-by-field: a field is overwritten only if it still equals what was last seen, so an async store update (AI
  generation, bidirectional relationship sync) can't discard an unblurred edit. A changed `id` always fully adopts the
  incoming entity.
- **`keyboardShortcuts.ts`** — `matchShortcut(event)` returns an action string or `null`. Bare-key shortcuts
  (`/`, `Escape`, `?`) are suppressed while focus is in an input/textarea/contenteditable; `ctrlOrMeta` shortcuts are
  not. `App.tsx` dispatches on the returned action.
- **`demoTemplates.ts`** carries only the setting prose. The full demo campaign payload was removed because a data
  literal produced by a called function is not tree-shakeable and shipped in the entry chunk. A new importable demo
  belongs in `data/templates/*.json` behind the existing dynamic import, never as an inline literal here.

## Gotchas

| Rule | Why |
|------|-----|
| Never hardcode an entity color/icon | `ENTITY_TYPE_CONFIG` is the single source; findings #99/#106/#116 were all violations. |
| New `ENTITY_TYPE_CONFIG` color → update `index.css`'s `@source inline` safelist | Runtime-composed classes are invisible to build-time Tailwind; dev looks fine, prod is unstyled. |
| New multi-word entity type → add both `camelCase` and `kebab-case` keys | Quick-card / command-palette types are kebab-case. |
| Factories return `id: ''` | The store mints ids; a factory-minted id escapes the import/duplicate remap. |
| Deep-merge PCs via `normalizePlayerCharacter` | A shallow spread wipes `skills` / `actions`. |
| New `mentionedEntityIds` field → add to `scanAllMentionSources` | Otherwise the type's mentions produce no backlinks. |
| New `FEATURE_LABELS` key needs a real `isFeatureVisible` call site | Otherwise the toggle is inert (finding #91). |
| Keep `utils/` pure and `useMemo`-safe | `backlinkUtils` and `entityUtils` are called during render. |

Ship-hardening rationale for the above is in `docs/ship-readiness/remediation-plan.md`; regression tests are in
`tests/entityUtils.test.ts`, `tests/backlinkUtils.test.ts`, `tests/dmStyleUtils.test.ts`, `tests/diceUtils.test.ts`,
and the `tests/ship/wp-d-linking.*` / `wp-j-types-utils.*` suites.
