# CLAUDE.md — `components/`

Every React component in the app. Hooks live in `hooks/` (see `hooks/CLAUDE.md`); all data access goes through
`services/campaignService.ts` and `services/aiService.ts` (see `services/CLAUDE.md`).

| Directory | Responsibility |
|-----------|----------------|
| `common/` | Shared building blocks — dialogs, buttons, entity links, mention input, toasts, skeletons. |
| `dashboards/` | One per entity type. Creation panel + searchable/keyboard-navigable card grid. |
| `generators/` | AI creation forms (`*Generator.tsx`) + `EntityChatGenerator` + `PlayerCharacterImporter`. |
| `editors/` | Detail views. Tabbed, inline AI-assist, per-field store writes. |
| `layout/` | `Header`, `CampaignSidebar` (+ `sidebar/`), `ContentWrapper`, `ViewRouter`, `StatusBanners`. |
| `dialogs/` | Multi-step / long-running modals: `DmCoach`, `EvocationWizard`, `WorldSimulationWizard`, `ContinuityChecker`, `SessionPrepWizard`, `SessionEndWizard`, `ExportModal`. |
| `views/` | Top-level screens: `WelcomeScreen`, `CampaignCreator`, `FirstCampaignWizard`, `CrossCampaignDashboard`, `SessionRunner` (+ `session/`). |
| `tools/` | `CombatTracker`, `DiceRoller`, `SecretsTracker`. |
| `visualizers/` | `RelationshipGraph`, `PlotTimeline` — heavy deps (React Flow, dagre, D3); `RelationshipGraph` is `React.lazy`-loaded from `ViewRouter`. |
| `RealmChat/` | `RealmChatWidget` — the only place indigo is allowed. |

## Three-tier hierarchy

### Dashboards

`useEntitySearch(entities, [...fields])` + `useRovingTabIndex({ direction, columns })` + a creation panel.

- Entities keyed on `title` (article, plot, note, session log, adventure, PC) are **normalised to a `{ ...e, name: e.title }`
  copy** inside a `useMemo` before being handed to `useEntitySearch` (the hook's generic requires `name`), then
  re-associated back to the originals by id. Do not filter the originals against the normalised copies by index.
- `columns` must mirror the grid's actual Tailwind classes at every breakpoint —
  `grid-cols-1 sm:grid-cols-2` → `{ base: 1, sm: 2 }`, `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` →
  `{ base: 1, md: 2, xl: 3 }` — or ArrowDown lands on the wrong card above the breakpoint.
- Visually separate groups get **separate roving groups** (`PlotDashboard` has three: active / dormant / resolved;
  `SessionLogDashboard` has planned / past). Keyboard navigation must not walk across a heading.
- Cards spread `{...getRovingProps(index)}` onto the card `<button>`. Where the card is a separate component
  (`NpcCard`, `LocationCard`, …) it is wrapped in `React.memo`; the dashboards that render cards inline are not.
- `EntityCreationPanel` is used by the six dashboards with a dual chat/form AI creation flow: NPC, location, faction,
  item, adventure, article. Plot and note dashboards use a local title-only creator, `PlayerCharacterDashboard` uses
  `PlayerCharacterImporter`, and `SessionLogDashboard` creates from `createDefaultSession()`. Any *new* AI-generated
  entity type gets `EntityCreationPanel`.

### Generators

Props are `onXCreated`, `isMockMode`, `campaignContext` (+ entity-specific lookups). They call `services/aiService.ts`
directly — never `services/ai/*`. In-flight requests are guarded (`isMountedRef` set in an effect body so it survives
StrictMode's mount → cleanup → remount, or a monotonic request id) so a stale response never writes into an unmounted
or superseded panel.

### Editors

Props are the entity, its lookup arrays, `campaign`, `onUpdate(id, updates)`, `onDelete(id)`, `isMockMode`, and
`onNavigate` (for `EntityLink` / `LinkedText` clicks).

- **Editors are not keyed by entity id.** `ViewRouter` renders `<NpcEditor npc={selectedNpc} …/>` at a fixed position,
  so navigating from entity A to entity B of the same type reuses the mounted editor. Every piece of editor state that
  is per-entity must handle that transition explicitly (reset the active tab on `[entity.id]`, flush pending writes —
  see `useDebouncedFieldCommit`).
- Local `formData` mirrors the entity prop; incoming props are merged with
  `reconcileEntityFormData(prev, prevSeen, incoming)` from `utils/formReconciliation.ts` — field-by-field, so an async
  store update (AI generation, bidirectional relationship sync) can't discard an unblurred edit. A changed `id` adopts
  the incoming entity wholesale.
- Plain inputs commit on blur; `MentionInput`-backed fields commit through `useDebouncedFieldCommit`.
- Destructive actions use `useConfirmDialog().confirm(...)`, never `window.confirm`.

## `common/` building blocks

### DialogShell

Wraps every modal (`ConfirmDialog`, `CommandPalette`, `KeyboardShortcutsHelp`, `DmStylePanel`, all of `dialogs/`, the
generator preview modals, `FirstCampaignWizard`, `SessionRunner`). Props: `isOpen`, `onClose`, `children`,
`className`, `ariaLabel`. Renders `role="dialog" aria-modal="true"` with a `bg-black/60` backdrop, and returns `null`
when closed.

- **Escape contract:** `handleKeyDown` returns early if `e.defaultPrevented`. A child that already consumed the
  keystroke (`MentionInput` closing its suggestion dropdown calls `preventDefault()` + `stopPropagation()`) keeps the
  dialog open. Any new nested pop-up that swallows Escape MUST `preventDefault()`; any host with its own Escape
  handling (e.g. `DmCoach`'s panel-scoped `onKeyDown`) MUST check `!e.defaultPrevented`.
- **Focus trap:** on open (inside a `requestAnimationFrame`) it queries `FOCUSABLE_SELECTORS`, filters to *reachable*
  elements, and focuses the first — falling back to the dialog itself. Tab/Shift+Tab wrap over the same filtered list.
  Cleanup restores focus to `document.activeElement` captured at open.
- **Reachability** (`isReachable`) rejects anything under `[inert] / [hidden] / [aria-hidden="true"]` and anything
  `display:none` / `visibility:hidden`. It deliberately does not use `offsetParent` / `getClientRects` alone — jsdom
  does no layout. The extra stacking check (`elementFromPoint` at the control's centre) only runs when `hasRealLayout()`
  probes true, so jsdom tests are unaffected; it exists for in-dialog overlays that don't mark the covered layer inert
  (`EvocationWizard`'s `absolute inset-0` edit overlay).
- **Scroll-clip exemption:** `isScrollClipped` returns true when the control's box falls outside a scrollable
  ancestor's visible box; such a control is treated as reachable, because `focus()` scrolls it into view. Without it,
  Tab-wrap would skip every below-the-fold control in a scrolling dialog.
- **Backdrop click** requires the press to have *started* on the backdrop (`mousedown` target === backdrop) and, when a
  `mouseup` was observed, to have *ended* there too. A text-selection drag out of the panel — or into it — must never
  close the dialog.
- Body scroll is locked (`document.body.style.overflow`) while open and restored on close.

### MentionInput

Controlled `value` / `onChange` textarea (or `singleLine` input) that intercepts `@` and offers an entity
autocomplete. Also exports `findMentionedIdsInText`, `resolveMentionCandidates`, `renderMentionedText`,
`buildMentionedEntityContext`.

- **Seeding:** pass `initialMentions={resolveMentionCandidates(campaign, entity.mentionedEntityIds)}`. It seeds the
  internal name→id map *and* a `seededIdsRef` snapshot. Both are **resynced whenever the seeded id SET changes** — keyed
  on the sorted, joined ids, not on the array identity, because callers recompute that array on every unrelated store
  update. Without the resync, navigating A → B under the same mounted editor would keep reporting A's ids into B.
- Every report is the **union** of freshly parsed ids and the seeded set, so renaming an entity doesn't drop a backlink
  from prose that still spells the old name. Accepted trade-off: deleting the prose alone no longer untracks a mention.
- Matching is longest-name-first with consumed spans and a Unicode-aware trailing boundary
  (`@Name(?![\p{L}\p{N}])`), mirroring `services/linking/matchingEngine.ts` and `LinkedText`. Keep the three in sync.
- Candidates are read from `campaignService.getState()` when the dropdown opens (not from props), so newly created
  entities appear without a remount.
- ARIA: the input is a `combobox`; `aria-expanded` / `aria-controls` / `aria-activedescendant` are only set when the
  real listbox is rendered (`isOpen && filtered.length > 0`) — the "no matches" state is not a listbox, so pointing at
  its id would be a dangling IDREF.
- Callers that need a merged id set across several mention fields keep the per-field sets in a **ref** and diff a sorted
  key before writing to the store: `onMentionedIdsChange` fires on every keystroke even when the set is unchanged, and
  a store write from inside a `setState` updater double-fires under StrictMode.

### EntityCreationPanel

`entityLabel`, `chatPanel`, `formPanel`, `defaultMode = 'chat'`. Owns only the chat↔form toggle and its heading; the
panels themselves are passed in (`EntityChatGenerator` and the entity's `*Generator`).

### StatusBanners (`layout/`)

`ConflictBanner` (`role="alert"`, `aria-live="assertive"`) and `BackupRecoveryBanner` (`role="status"`,
`aria-live="polite"`). Rendered from `App.tsx` above the content area. They are the only consumers of
`campaignService`'s `conflictDetected` / `recoveredFromBackup` flags — wired to `resolveConflict('reload' | 'overwrite')`
and `dismissBackupRecoveryNotice()`. Autosave stays paused until the GM picks a side, so this banner must never be
conditionally hidden.

### Others

| Component | Contract |
|-----------|----------|
| `Button` | `variant`: primary / secondary / ghost / danger / icon; `size`: sm / md / lg (ignored by `icon`, which is fixed `p-2` and circular). Extra classes merge via `twMerge`. |
| `EntityLink` | Inline entity name → hover (200 ms) / tap `EntityQuickCard` popover; `onNavigate(type, id)` is the caller's job. Colour per type comes from a local `ENTITY_TEXT_CLASS` map that includes `scene` (blue). |
| `LinkedText` | Scans prose for entity names and renders `EntityLink`s. Subscribes to the store itself; `entries` (and their compiled RegExps) memo on **`campaign` only**, never on `text` — keying on text recompiled every matcher on every keystroke. Names shorter than 3 chars are ignored; matching is longest-first against the ORIGINAL text (no lowercased copy — offsets would drift on characters that change length under `toLowerCase()`). |
| `EntityQuickCard` | Portal popover positioned via `utils/popoverPosition.ts`; type config derived from `ENTITY_TYPE_CONFIG` with `scene` defined card-locally. Inline field edits go through `utils/entityFieldSave.ts`. |
| `BacklinksPanel` | Reads the store, calls `computeBacklinks`, groups results, caps each group at 5 with a "Show all" expander. |
| `TabLayout` | `tabs: TabDefinition[]`, `activeTab`, `onTabChange`; renders `role="tablist"` / `role="tab"` / `role="tabpanel"`. The caller renders the active panel's children. |
| `Textarea` | `inputBaseClasses` / `textareaBaseClasses` (use these for form fields) + `AiTextarea`, which slots a `RegenerateButton` into the label row. |
| `RegenerateButton` | Per-field AI regeneration with tweak → preview → accept/reject. A monotonic `requestIdRef` discards results from a superseded or dismissed panel. Uses `generateEnhancedText` from `aiService`. |
| `ErrorBoundary` | `scope`: `'view'` (default, used per-view in `App.tsx` with `key={activeView}`) or `'root'` (`index.tsx`) — the copy differs because a root throw is not isolated. "Reload App" calls `campaignService.flushPendingSave()` before `location.reload()`. |
| `ToastContainer` | Presentational; `useToast`'s provider owns the queue. Each toast auto-dismisses after 4 s and is `role="alert" aria-live="polite"`. |
| `CommandPalette` | Global entity/action search; `RecentItem` / `CommandPaletteEntityType` are exported from here and consumed by `useEntitySelection`. |
| `SkeletonCard` | `SkeletonCard`, `SkeletonCardGrid`, `SkeletonGeneratorOverlay` — loading placeholders for dashboards and generators. |
| `SceneResourcesPanel`, `SceneSmartLinkBar`, `LinkSuggestionsPanel`, `EntityHistoryManager`, `DmStylePanel`, `GenerateHerePanel`, `StepIndicator`, `Breadcrumbs`, `KeyboardShortcutsHelp` | Single-purpose panels; each documents its own contract in its file docblock. |

## Styling

Slate + amber dark theme. Entity accent colours come from `ENTITY_TYPE_CONFIG` in `utils/entityUtils.ts` — including
`scene: blue`. Never hardcode a per-entity colour.

**Indigo is reserved for `RealmChat/RealmChatWidget.tsx`.** No `indigo-*` utility class may appear anywhere else in
`components/`. (`RelationshipGraph` has an `indigo` hex entry in its node-colour lookup; that is a canvas colour, not a
Tailwind class. Two docblocks in `common/` still describe an indigo AI-button convention that the code no longer
follows — the rendered classes are amber.)

**Dynamic class names need the safelist.** Tailwind is compiled at build time (`@tailwindcss/vite` + `index.css`), so a
template literal like `` `bg-${color}-900/60` `` is invisible to the class scanner. Either use a static class map
(`PlayerCharacterDashboard`'s `PC_ACCENT_CLASSES` is the model) or make sure the shade is covered by the
`@source inline(...)` safelist in `index.css`. `tests/ship/wp-i2-build-test-infra.tailwind-safelist.test.ts` guards it.

## Gotchas

| Rule | Why |
|------|-----|
| Import AI from `services/aiService.ts` only | Mock mode is enforced at the facade. |
| Icons from `common/Icons.tsx` | Never import `lucide-react` directly. |
| Named exports only | No `export default` anywhere in `components/`. |
| `<Button>` for action buttons | Raw `<button>` only for cards, tabs, chips, toggles, and elements with a semantic role (`role="option"`, `role="tab"`). |
| `DialogShell` for every modal | Focus trap, Escape contract, scroll lock, backdrop-drag guard. |
| Child that eats Escape must `preventDefault()` | That is the whole handshake with `DialogShell` / `DmCoach`. |
| `useConfirmDialog` / `useToast`, never `window.confirm` / `window.alert` | Branded, non-blocking. |
| `roving columns` must match the rendered grid | Otherwise arrow keys move to the wrong card. |
| Editors are not remounted per entity | Reset per-entity state on `[entity.id]` and flush pending writes. |
| New view → `App.tsx` **and** `ViewRouter.tsx` (+ `CampaignSidebar.tsx`) | Three call sites, all required. |
| Indigo only in `RealmChat/` | Reserved for the AI assistant widget. |
| No `stone-*` | Use `slate-*`. |

Component regression tests live in `tests/ship/wp-d-linking.*`, `wp-e-app-shell.*`, `wp-f1-session-editors.*`,
`wp-f2-entity-editors.*`, `wp-g1-worldsim-dialogs.*`, `wp-g2-wizards-coach.*`, `wp-h-tools-viz.*`, plus
`tests/components/` and `tests/mentionInput.test.ts`. Rationale for the hardened behaviours above is in
`docs/ship-readiness/remediation-plan.md`.
