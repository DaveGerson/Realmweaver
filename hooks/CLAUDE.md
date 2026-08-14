# CLAUDE.md — `hooks/`

Seven hooks. Two of them (`useToast`, `useConfirmDialog`) also export the **provider** that owns their state; those
providers are mounted once in `index.tsx`, outside `<App/>`.

| Hook | Shape |
|------|-------|
| `useToast` | `ToastProvider` + `useToast(): { addToast(message, variant?) }` |
| `useConfirmDialog` | `ConfirmDialogProvider` + `useConfirmDialog(): { confirm(title, message, options?): Promise<boolean> }` |
| `useDebouncedFieldCommit` | `(entityId, onUpdate, delayMs = 400) => { commit(field, value), flush() }` |
| `useEntitySearch` | `(entities, searchFields) => { filteredEntities, searchTerm, setSearchTerm }` |
| `useRovingTabIndex` | `({ direction?, columns? }) => { getRovingProps(index) }` (+ exported `resolveColumns`) |
| `useEntitySelection` | `({ activeCampaign, onSidebarClose }) => EntitySelectionState` — App-shell navigation state |
| `useModalState` | `() => ModalState` — App-shell modal flags |

## useDebouncedFieldCommit

Debounced per-field store commits for editor fields that write through `onUpdate(entityId, updates)` on every
keystroke — i.e. `MentionInput`-backed fields, where there is no blur event to commit on. Local `formData` still
updates immediately; only the store write coalesces.

```ts
const { commit } = useDebouncedFieldCommit<NPC>(npc.id, onUpdate);
const onFieldChange = (field: keyof NPC) => (value: string) => {
  setFormData(prev => ({ ...prev, [field]: value }));
  commit(field, value);
};
```

**Why it is mandatory here:** editors are not remounted when the GM navigates between two entities of the same type —
`ViewRouter` renders `<NpcEditor npc={selectedNpc}/>` at a fixed position with no `key`. A naive field-keyed
`setTimeout` therefore either fires with the *old* id closed over, or gets cancelled by the first keystroke into the
new entity. The hook keys everything to `idRef`:

- `commit(field, value)` stores the value in a pending map and (re)arms one timer per field. When a timer fires it
  writes `{ [field]: value }` against `idRef.current`.
- An effect on `[entityId]` detects `idRef.current !== entityId` and **flushes synchronously before updating
  `idRef`** — the previous entity's pending edits land on the previous entity.
- The unmount cleanup flushes against the id current *at unmount*, not at mount.
- `flush()` clears all timers and issues **one** merged `onUpdate(id, {...allPendingFields})`; it is a no-op when
  nothing is pending. It is also returned for callers that need an explicit flush point.
- `onUpdate` is held in a ref, so passing an inline callback does not re-arm anything.

Adopted by `NpcEditor`, `LocationEditor`, `FactionEditor`, `ArticleEditor`, `PlotEditor`. **Any editor that gains a
`MentionInput` (or any other keystroke-level store write) must use it.** Contract test:
`tests/ship/wp-review.debounced-field-commit.test.tsx`, plus
`tests/ship/wp-f2-entity-editors.mention-field-commits.test.tsx`.

## useConfirmDialog

`confirm()` returns a promise that resolves `true` / `false`; the provider renders a single `ConfirmDialog` and holds
the pending `resolve` in a ref.

- **Concurrency:** a second `confirm()` while one is pending calls the previous `resolve(false)` first, then takes
  over the dialog. The superseded promise settles rather than hanging forever — a caller awaiting it sees a cancel, so
  never treat "the dialog I opened is gone" as an approval.
- Provider unmount also settles a pending promise with `false`.
- Options: `{ confirmLabel, cancelLabel, variant: 'default' | 'danger' }`.
- `useConfirmDialog()` throws outside `ConfirmDialogProvider` — tests that render a component with a delete action must
  wrap it.

## useToast

`addToast(message, variant?)` with `variant: 'success' | 'error' | 'info'` (default `'info'`). The queue is capped at
`MAX_TOASTS = 3`, dropping the **oldest** entries. Ids come from `crypto.randomUUID()`. Auto-dismiss (4 s) lives in
`ToastContainer`, not here. Throws outside `ToastProvider`.

## useEntitySearch

Case-insensitive substring match across the named fields of `entities`. The term goes through `useDeferredValue`, so
filtering doesn't block typing.

- **Memo contract:** the memo is keyed on `[entities, fieldKey, deferredSearchTerm]` where
  `fieldKey = searchFields.join(',')`. Every call site passes an inline array literal, so keying on `searchFields`
  identity would miss the cache on every render. **Do not "fix" this by depending on the array itself**; if you need
  dynamic fields, keep them stable by name.
- The generic requires `{ id: string; name: string }`. Entities keyed on `title` must be mapped to a `{ ...e, name }`
  copy in a `useMemo` by the caller (see `components/CLAUDE.md`).
- An empty/whitespace term returns the original `entities` reference unchanged.
- Fields that are `null` / `undefined` are skipped; everything else is `String(value)`-coerced, so array fields match
  on their joined form.

Guarded by `tests/ship/wp-e-app-shell.entity-search-memo.test.tsx`.

## useRovingTabIndex

Arrow-key navigation over a grid or list. Spread `getRovingProps(index)` — `{ tabIndex, onKeyDown, ref }` — onto each
item element. Only the tracked item carries `tabIndex 0`.

- `direction`: `'horizontal' | 'vertical' | 'both'` (default `'both'`). Left/Right move by 1, Up/Down move by
  `columns`, Home/End jump to the ends. Handled keys are `preventDefault()`ed; out-of-range targets are ignored (no
  wrap-around).
- `columns`: a number, or a `ResponsiveColumns` map (`{ base, sm?, md?, lg?, xl?, '2xl'? }`) resolved against
  `window.innerWidth` at Tailwind's default breakpoints, widest match first. It must mirror the grid's actual
  `grid-cols-*` classes. `resolveColumns` is exported for tests.
- **Ref-callback identity is cached per index.** A fresh closure per render makes React detach (call with `null`) and
  re-attach every item's ref on every commit — including unrelated re-renders such as the two store notifications an
  autosave cycle emits — which briefly emptied the registry and reset the tracked index to 0. Do not inline a new ref
  callback.
- The `null` (detach) branch trims trailing empty slots and, if the tracked index fell off the end (a search filter
  shrank the list), clamps it and re-anchors `tabIndex = 0` so the grid stays Tab-reachable.
- The tracked index lives in a ref, so changing it does not re-render; `tabIndex` is written directly onto the DOM
  nodes during `moveFocus`.

Tests: `tests/useRovingTabIndex.test.ts`, `tests/ship/wp-e-app-shell.roving-tabindex-registry.test.tsx`,
`tests/ship/wp-f2-entity-editors.dashboard-roving-tabindex.test.tsx`.

## useEntitySelection

The single hook every in-campaign navigation funnels through. Used only by `App.tsx`. Owns `activeView`,
`activeGenerator`, one `selected*Id` per entity type, the resolved entity memos, `recentItems` (max 10, de-duped,
newest first), `navStack`, and `breadcrumbSegments`.

- `handleSelect(type, id)` is the canonical entry point: `pushNavStack(label)` **before** `resetSelections()` (the push
  reads the current selection from this render's closure), then set the view and the new id, then `trackRecentItem`.
  Every branch — including `'scene'` — must call `resetSelections()`, or a stale `selected*Id` wins in `ViewRouter`'s
  editor-precedence chain and the wrong editor keeps rendering.
- `handleSelect('scene', id)` resolves the parent adventure itself and sets `activeView: 'adventures'` +
  `selectedAdventureId` + `selectedSceneId`.
- `pushNavStack` **dedupes against the top of the stack**: two synchronous `handleSelect` calls in one click handler
  (the sidebar's scene button fires `adventure` then `scene`) both read the same stale closure and would otherwise push
  two identical entries for one logical navigation. Depth capped at 20.
- `handleGoBack` pops one entry and restores view + ids; `handleSelectView` clears the whole stack.
- `handleEntityNavigate(entityType, entityId)` is the bridge from `EntityLink`'s `QuickCardEntityType` to
  `handleSelect` — this is what editors receive as `onNavigate`.
- Selections are batched into a single commit, which is exactly why editors and `MentionInput` never unmount across an
  entity switch. See `useDebouncedFieldCommit` and `MentionInput`'s seeding contract.

Tests: `tests/ship/wp-e-app-shell.entity-selection.test.tsx`.

## useModalState

Plain `useState` flags for the app-shell modals plus the mobile sidebar, with `set*` / `toggle*` pairs. Used only by
`App.tsx`.

- `closeTopModal()` closes the highest-priority open modal and returns whether it closed anything:
  commandPalette > shortcutsHelp > continuityChecker > coach > wizard > worldSim > exportModal. `App.tsx`'s
  document-level shortcut handler calls it for the `'close'` shortcut and currently ignores the boolean — it is there
  for callers that need to fall through when nothing was open.
- `isFirstCampaignWizardOpen` and `isSidebarOpen` are deliberately **not** in that chain.
- A modal owned elsewhere (e.g. `SessionRunner`'s combat panel) is invisible to `closeTopModal` — either register it
  here or give it its own scoped Escape handling.
- The returned callbacks are recreated every render; nothing memoizes on them today. Do not add one without
  `useCallback`.

## Gotchas

| Rule | Why |
|------|-----|
| `useToast` / `useConfirmDialog` need their providers | Both throw otherwise; wrap in tests. |
| Never treat a superseded `confirm()` as approval | It resolves `false`. |
| Keystroke-level store writes go through `useDebouncedFieldCommit` | Editors are reused across entities. |
| Don't key `useEntitySearch`'s memo on the `searchFields` array | Inline literals defeat the cache. |
| Don't inline `useRovingTabIndex`'s ref callback | React detaches/reattaches every ref on every commit. |
| `columns` must mirror the rendered grid at every breakpoint | Arrow keys otherwise move to the wrong card. |
| `pushNavStack` before `resetSelections` | It reads the pre-navigation selection from the current closure. |
| New entity type → new `selected*Id` + `handleSelect` branch + breadcrumb label | All in `useEntitySelection`. |

Rationale for the hardened behaviours above is in `docs/ship-readiness/remediation-plan.md`.
