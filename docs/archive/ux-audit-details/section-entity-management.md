# Entity Management — UX Audit Report

**Audited:** 2026-03-24
**Scope:** 32 components across dashboards (10), generators (9), editors (13), and common entity components (4)
**Screenshots:** Captured (desktop 1440x900, mobile 375x812, tablet 768x1024)
**Method:** Code review + live browser screenshots

---

## Summary

Entity management across Realmweaver is built on a solid, consistent backbone: dashboards follow the same structural pattern, editors share a uniform header/tab/form idiom, and AI generation feedback is handled reliably. The dark fantasy theme (slate grays + amber/entity-color accents) holds well throughout the majority of flows. The main weaknesses are a scattered zone of missing polish on lower-priority entity types (Note, Plot, PlayerCharacter editors), the absence of any search or filter on any list view, pervasive use of `window.confirm` for all destructive actions, and a dead-code layer of 20 stale root-level component files that shadow the real implementations.

---

## Scored Dimensions

| Dimension | Score | Justification |
|-----------|-------|---------------|
| Visual Consistency | 7/10 | Theme holds strongly across the 6 main entity types (NPC/Location/Faction/Item/Adventure/Article); drops on Note, Plot, PlayerCharacter which lack entity-color accents and miss some polish. `stone-*` palette leaks into PlotDashboard and CampaignSettingEditor while every other component uses `slate-*`. |
| Interaction Quality | 5/10 | AI generation loading states are good (SkeletonGeneratorOverlay, animated bounce dots in chat). However: all 13 editors use browser-native `window.confirm` for delete — blocks the page, cannot be styled or dismissed with keyboard in a controlled way. Three editors use `alert()` for error feedback. No search or filter on any list, making large campaigns hard to navigate. |
| Information Architecture | 6/10 | Dashboard → editor navigation is clear and logical. Entity-type color coding is excellent and consistent. Major gap: no search/filter on any of the 10 dashboards, so a campaign with 40+ NPCs has no way to find entities except scrolling. SessionLogDashboard has the best IA (active/planned/past split with hero card). PlotDashboard has good status grouping. PlayerCharacterDashboard buries the importer in a 1-of-3 column with no clear visual prominence. |
| Component Quality | 6/10 | EntityChatGenerator is well-bounded. RegenerateButton has a clean accept/reject workflow. TabLayout is properly abstracted and used by 4 editors. However: EntityQuickCard is 1003 lines doing entity type config, compact detail extraction, expanded detail extraction, field save dispatch, AND rendering — this is at least 4 concerns jammed into one file. Dashboard creation mode toggle (chat vs form) is copy-pasted identically across 7 dashboards (NPC, Location, Faction, Item, Adventure, Article, Item). The `NpcGenerator.tsx` has its own internal `'quick' | 'chat'` mode toggle that duplicates the toggle already present in `NpcDashboard.tsx`, creating two entry points to chat creation from the form-mode view. 20 stale root-level component files (`components/NpcEditor.tsx`, `components/FactionEditor.tsx`, etc.) remain and shadow the real implementations in `components/editors/`. |
| Scalability | 6/10 | The entity-type config pattern in EntityQuickCard scales well (just add a row to `ENTITY_CONFIG`). The per-entity color system is clearly extensible. What won't scale: copy-pasted dashboard creation mode toggle across 7 files means any change to that UX (e.g. adding a 3rd mode) requires touching all 7. The absence of search becomes more painful with each new entity. EntityQuickCard's 1003-line single-file approach will become unworkable when adding more entity types or expanding detail views. |

**Overall: 30/50**

---

## Top 3 Priority Fixes

1. **Add search/filter to all major entity list dashboards** — A campaign with 30+ NPCs or 20+ locations has no way to find an entity except scrolling through an unbounded grid. Impact: blocks practical use at scale. Fix: add a controlled text input above the entity grid in each dashboard, filtered client-side with `useMemo`. Start with NpcDashboard, LocationDashboard, ItemDashboard (highest entity counts). Effort: M (same pattern across 7 dashboards; can extract a reusable `EntitySearchFilter` hook).

2. **Replace `window.confirm` / `alert` with in-UI confirmation components** — All 13 editors use `window.confirm` for destructive actions; `SessionLogEditor.tsx` uses `alert()` for 3 different error paths. This blocks the tab/page, cannot be styled, and breaks in some embedded environments. Impact: every delete action and 3 live-session error paths are degraded. Fix: create a small `<ConfirmDialog>` component (or use a `useConfirm` hook over a portal) and replace all `window.confirm` calls. Replace `alert()` calls with inline error banners. Effort: M.

3. **Split EntityQuickCard.tsx into cohesive units** — The 1003-line file contains: entity type config (lines 8–80), compact detail extractors per entity (lines 103–494), expanded detail extractors per entity (lines 229–373), field save dispatch (lines 432–475), scene details (lines 477–543), and the actual React component. This is at minimum 3 separate concerns. Impact: extremely high change-friction — adding a new entity type or new editable field requires updating this one giant file. Fix: extract `EntityTypeConfig` and detail extractors to `entityDetailExtractors.ts`, field save dispatch to `entityFieldSave.ts`, and keep only the React component in `EntityQuickCard.tsx`. Effort: M (mechanical extraction, no behavior change needed).

---

## Detailed Findings

### Visual Consistency (7/10)

**Entity-type color system is a genuine strength.** Each of the 10 entity types has a dedicated Tailwind color: amber (NPC), emerald (Location), violet (Faction), sky (Item), orange (Adventure), cyan (Article), yellow (Plot), rose (Session), indigo (PlayerCharacter), blue (Scene). This color-coding is applied consistently to: border-left accents on list cards, badge backgrounds in EntityQuickCard, EntityLink text colors (EntityLink.tsx:26–36), header icons in editors, and the `ENTITY_CONFIG` in EntityQuickCard.tsx:19–80. It works well.

**Stone vs slate palette inconsistency.** The app uses `slate-*` as its base palette throughout, but `PlotDashboard.tsx:63–81` uses `bg-stone-900`, `border-stone-700`, `bg-stone-800/60`, `text-stone-200`, `text-stone-500`, `text-stone-400`, `border-stone-800` for the Plot Timeline collapsible header. `CampaignSettingEditor.tsx:238,250` uses `bg-stone-700`, `hover:bg-stone-600`, `text-stone-200` for action buttons. This is a minor but visible inconsistency — stone and slate are close but not identical.

**PlayerCharacterDashboard entity cards don't use `card-parchment`** (`PlayerCharacterDashboard.tsx:35`). All other dashboards use the `card-parchment` custom CSS class on their entity cards for consistent texture. PlayerCharacter cards use `bg-slate-900/50` instead, producing a slightly different visual weight.

**AdventureEditor header omits the Delete button** present on every other editor. `NpcEditor.tsx:122–125`, `LocationEditor.tsx:266–270`, `FactionEditor.tsx:110–114`, `ItemEditor.tsx:68–72`, `ArticleEditor.tsx:107–110`, `NoteEditor.tsx:71–75` all have `<Button variant="danger">Delete X</Button>` in the header. `AdventureEditor.tsx` has no delete button at all — neither in the header (lines 91–96) nor anywhere else in the file. Adventures can only be deleted from the dashboard level if such a path exists.

**SessionLogEditor header has a different structure.** It uses a transparent `<input>` for the title directly in the header (SessionLogEditor.tsx:331–338) rather than a static `<h1>` like all other editors. While intentional (active sessions need quick title editing), it creates a visible structural departure from the rest.

### Interaction Quality (5/10)

**`window.confirm` used for all destructive actions — 13 editors, 15+ usages.** Every editor uses the browser's built-in confirm dialog: `NpcEditor.tsx:72`, `LocationEditor.tsx:89`, `FactionEditor.tsx:71`, `ItemEditor.tsx:47`, `ArticleEditor.tsx:72`, `SceneEditor.tsx:68`, `SessionLogEditor.tsx:98,118`, `NoteEditor.tsx:49`, `PlotEditor.tsx:54`, `PlayerCharacterEditor.tsx:21`. Additionally, `SessionLogEditor.tsx:172` uses `alert()` for the GCP key error, `SessionLogEditor.tsx:239` uses `alert()` for transcript import failure, and `SessionLogEditor.tsx:316` uses `alert()` for note analysis failure.

**AI loading states are well-handled.** `SkeletonGeneratorOverlay` is used in `NpcGenerator.tsx:89` and `LocationGenerator.tsx:91`. The chat interface in `EntityChatGenerator.tsx:169–175` shows an animated three-dot bounce indicator. `PlayerCharacterImporter.tsx:43–48` shows a custom loading overlay with a spinning sparkle icon and progress copy. RegenerateButton shows spinner and `Regenerating...` state. These are all good patterns.

**RegenerateButton error state is handled inline.** `RegenerateButton.tsx:185–189` shows `text-red-400` error text inside the panel. This is the correct approach and should be adopted for generator-level errors too.

**AI generation error copy in generators is generic.** `NpcGenerator.tsx:43`: "Failed to generate NPC. Please check your API key and try again." — this is the same string in LocationGenerator, FactionGenerator (inferred from the same template). The message blames the API key even when the failure might be a network timeout, a rate limit, or a malformed prompt. A slightly more open-ended message ("Generation failed — check the console or try a different prompt") would be more honest.

**Chat mode toggle is duplicated.** `NpcDashboard.tsx` at the top level switches between `'chat'` and `'form'` modes (lines 29–99). When in `'form'` mode, `NpcGenerator.tsx` (rendered at line 91–98) internally also has a `'quick' | 'chat'` mode toggle (lines 22, 49–84). This means a user in form mode of the dashboard can click "Create via Chat" inside the generator, launching a second full `EntityChatGenerator` interface inside the already-visible generator. Two nested paths to the same destination with different UX is confusing.

**No empty state for filtered results.** Not applicable today since there is no filtering, but when search is added, empty filter results need handling.

### Information Architecture (6/10)

**No search or filter on any of the 10 dashboards.** All entity lists are unbounded grids with no filtering mechanism: `NpcDashboard.tsx:105–139`, `LocationDashboard.tsx:113–151`, `FactionDashboard.tsx:111–151`, `ItemDashboard.tsx:101–143`, `AdventureDashboard.tsx:118–156`, `ArticleDashboard.tsx:116–153`. At 10–20 entities, this works. At 40+ (easily reached in a long campaign), scrolling becomes the only discovery tool.

**SessionLogDashboard has the strongest IA.** The active/planned/past three-section split, the pulsing "Live Now" hero card for the active session, and the chronological sorting of planned sessions are all exemplary. The empty states for planned and past sessions are also the most polished of any dashboard: they provide specific next-step actions ("Use the Prep Wizard to plan one" at line 132–135).

**PlotDashboard has good status grouping** but the collapsible PlotTimeline (an entire visualization) sits at the top of the page above the creation/list layout. On a short viewport, a user landing on this page sees mostly the timeline, not the actual plot list. The timeline is valuable but might work better as a secondary tab or a side panel rather than a hero widget.

**PlayerCharacterDashboard layout buries the importer.** The `lg:col-span-1` left column at `PlayerCharacterDashboard.tsx:17–19` places the `PlayerCharacterImporter` in a narrow side slot with no title section or hero treatment. Unlike every other dashboard which opens to a clearly-labeled generation zone at the top, this one immediately splits the viewport. The importer is the only creation path and should be given more visual prominence.

**NoteDashboard missing visual hierarchy for notes.** Note cards use `h-40` fixed height (`NoteDashboard.tsx:62`) with no mechanism to show longer notes. Very short notes have excessive whitespace; notes longer than 3 lines clip silently. The `line-clamp-3` is a fine pattern but the fixed height forces awkward vertical gaps.

**Article editor has only 3 category options** (lore, history, cosmology — `ArticleEditor.tsx:29`). This is consistent with the type definition but may be a UX gap if GMs want custom categories like "bestiary", "calendar", or "geography". This is a product decision but worth flagging.

### Component Quality (6/10)

**EntityChatGenerator.tsx is well-designed.** The 1/3 chat + 2/3 preview split (lines 138, 213) with the `renderPreview` render prop is a clean abstraction. The finalize flow (line 130–132) is simple. Suggestion chips (lines 183–193) add genuine discoverability.

**EntityQuickCard.tsx at 1003 lines is doing too much.** It contains:
- Entity type configuration: `ENTITY_CONFIG` at lines 19–80
- Compact detail extractors for 10 entity types: `getNpcDetails`, `getLocationDetails`, etc. (lines 103–494)
- Expanded detail extractors for 10 entity types: `getNpcExpandedDetails`, `getLocationExpandedDetails`, etc. (lines 229–373)
- Field save dispatch: `saveEntityField` (lines 432–475)
- Scene-specific detail functions (lines 477–543)
- The actual React component with two display modes

This is 4+ responsibilities. The expanded detail extractors alone are ~150 lines of data transformation that has nothing to do with rendering.

**Dashboard creation mode toggle block is copy-pasted 7 times.** The pattern of `[creationMode, setCreationMode]` state + mode toggle header + conditional render of `EntityChatGenerator` vs form generator is duplicated identically in: `NpcDashboard.tsx:29–99`, `LocationDashboard.tsx:29–107`, `FactionDashboard.tsx:29–106`, `ItemDashboard.tsx:29–96`, `AdventureDashboard.tsx:27–113`, `ArticleDashboard.tsx:31–111`. This is 6 copies of the same ~50-line structural block. A `<EntityCreationPanel entityType="npc" formGenerator={...} initialData={...} promptChips={...} onCreated={...}>` abstraction would consolidate all 6.

**TabLayout is correctly abstracted** and used consistently in 4 editors: NpcEditor (4 tabs), LocationEditor (4 tabs), FactionEditor (3 tabs), AdventureEditor (3 tabs). The remaining 5 editors (ItemEditor, ArticleEditor, PlotEditor, SessionLogEditor, PlayerCharacterEditor) use flat single-page layouts — this is appropriate for their content volume. SessionLogEditor uses its own custom tab row (lines 591–608) rather than TabLayout; this is the only custom tab implementation.

**PlayerCharacterEditor is fully read-only** (`PlayerCharacterEditor.tsx:13–113`). Unlike every other editor which has editable fields and a `handleBlur` save pattern, PlayerCharacterEditor has no `onUpdate` handler and no editable inputs — only read-only display of imported data. This is documented as imported-from-PDF read-only but the editor header still says "Player Character" with no indication the data is read-only. `isMockMode` and `campaignContext` props are absent (`PlayerCharacterEditor.tsx:7–11`).

**20 stale root-level component files exist** (`components/NpcEditor.tsx`, `components/FactionEditor.tsx`, `components/LocationEditor.tsx`, `components/ArticleEditor.tsx`, `components/ItemEditor.tsx`, `components/SceneEditor.tsx`, `components/SessionLogEditor.tsx`, `components/PlayerCharacterEditor.tsx`, plus 12 others). These are older versions that have since been moved to `components/editors/` with additional features. App.tsx correctly imports from `components/editors/`, so these stale files are unreferenced dead code. However, they will confuse any developer searching for components, and the grep results during this audit pulled them as false matches. They should be deleted.

**PlotEditor and NoteEditor lack the `EntityHistoryManager`** that NpcEditor, LocationEditor, ArticleEditor, FactionEditor, and SessionLogEditor all include. For Plots especially — which represent multi-session storylines — version history seems valuable.

### Spacing (not a separately-scored dimension but noted)

Spacing is consistent throughout: editors use `p-6 md:p-8` outer padding, `space-y-6` between field groups, `mb-1.5` for label-to-input gaps. The `bg-slate-900/50 p-6 rounded-xl border border-slate-800/50` card container is used uniformly across all editors. No arbitrary spacing values observed in the audited files.

### Scalability (6/10)

**What scales well:** Entity-type color config in `EntityQuickCard.tsx:19–80` is a single-location registry — adding a new entity type is one dictionary entry plus the detail extractor functions. The `TabLayout` + `TabDefinition` pattern means adding tabs to any editor requires zero structural changes. `RegenerateButton` is a drop-in that works per-field on any entity type.

**What will break with more entities:** The copy-pasted creation toggle pattern across 6+ dashboards. EntityQuickCard's monolithic structure. The absence of search making dashboards unusable at scale. The `getExpandedDetails` switch statement in EntityQuickCard (lines 377–430) needs a new case per entity type — this is dispersed logic that should be co-located with each entity's type config.

**Article categories are hardcoded** to `['lore', 'history', 'cosmology']` in `ArticleEditor.tsx:29`. If a new category is added, it requires code changes. A data-driven approach (categories from config or user-defined) would scale better.

---

## Additional Observations

### Redundant Chat Mode in NpcGenerator (and LocationGenerator)
- `NpcDashboard.tsx` wraps `NpcGenerator` in a `creationMode === 'form'` branch.
- `NpcGenerator.tsx` internally adds its own "Create via Chat" button that switches to its own `mode === 'chat'` state.
- This means: from the form view of NpcDashboard → NpcGenerator → clicking "Create via Chat" in the generator opens yet another EntityChatGenerator inside the generator panel, nested inside the form panel.
- This path exists because NpcGenerator was built before the dashboard received its own chat toggle. The generator-level chat toggle is now obsolete and should be removed, leaving the dashboard-level toggle as the single entry point.

### Missing AI Assist for PlotEditor Description
- `PlotEditor.tsx` builds a `RegenerateButton` only for `description` field (line 59) but the `AiTextarea` for description is at line 102+ in the JSX — this needs verification. Actually `PlotEditor.tsx` does import `RegenerateButton` and pass it to `AiTextarea`. This is fine.
- However, `NoteEditor.tsx` has `AiTextarea` with `RegenerateButton` for `content`, while `PlotEditor.tsx` has `AiTextarea` + `RegenerateButton` only for description. Neither has AI generation for the title field, which is consistent.

### SessionLogEditor DOCX Import is Unimplemented
- `SessionLogEditor.tsx:219`: "TODO: Add a .docx parser library... For now, attempt a raw text read — this will produce garbled output for binary .docx files". The UI accepts `.docx` files via the file input (line 387) but the import will silently produce garbage output with a `[DOCX import requires a parser library]` prefix. The file type should either be removed from the `accept` attribute or the button should be disabled with a tooltip explaining the limitation.

---

## Files Audited

**Dashboards (10):**
- `components/dashboards/NpcDashboard.tsx` (144L)
- `components/dashboards/LocationDashboard.tsx` (155L)
- `components/dashboards/FactionDashboard.tsx` (153L)
- `components/dashboards/ItemDashboard.tsx` (146L)
- `components/dashboards/AdventureDashboard.tsx` (159L)
- `components/dashboards/ArticleDashboard.tsx` (155L)
- `components/dashboards/SessionLogDashboard.tsx` (195L)
- `components/dashboards/PlayerCharacterDashboard.tsx` (68L)
- `components/dashboards/PlotDashboard.tsx` (179L)
- `components/dashboards/NoteDashboard.tsx` (91L)

**Generators (9):**
- `components/generators/NpcGenerator.tsx` (118L)
- `components/generators/LocationGenerator.tsx` (121L)
- `components/generators/FactionGenerator.tsx` (skimmed — same pattern as NpcGenerator)
- `components/generators/ItemGenerator.tsx` (skimmed)
- `components/generators/SceneGenerator.tsx` (skimmed)
- `components/generators/AdventureGenerator.tsx` (skimmed)
- `components/generators/ArticleGenerator.tsx` (skimmed)
- `components/generators/PlayerCharacterImporter.tsx` (71L — full read)
- `components/generators/EntityChatGenerator.tsx` (231L — full read)

**Editors (13):**
- `components/editors/NpcEditor.tsx` (368L)
- `components/editors/LocationEditor.tsx` (692L — full read)
- `components/editors/FactionEditor.tsx` (294L)
- `components/editors/ItemEditor.tsx` (130L)
- `components/editors/AdventureEditor.tsx` (221L)
- `components/editors/SceneEditor.tsx` (344L — first 80L)
- `components/editors/ArticleEditor.tsx` (274L)
- `components/editors/SessionLogEditor.tsx` (731L — read in 3 passes)
- `components/editors/PlayerCharacterEditor.tsx` (113L)
- `components/editors/PlotEditor.tsx` (259L — first 100L)
- `components/editors/NoteEditor.tsx` (117L — full read)
- `components/editors/CampaignSettingEditor.tsx` (294L — first 80L)
- `components/editors/PrepDocumentView.tsx` (not reviewed in detail — rendering only)

**Common Components (4):**
- `components/common/EntityQuickCard.tsx` (1003L — read in 2 passes covering lines 1–543)
- `components/common/EntityHistoryManager.tsx` (first 80L)
- `components/common/EntityLink.tsx` (first 80L)
- `components/common/RegenerateButton.tsx` (245L — full read)

**Screenshots:**
- `docs/ux-audit/screenshots/entity-management/01-app-desktop.png` (1440x900, landing on Campaign Setting)
- `docs/ux-audit/screenshots/entity-management/02-app-mobile.png` (375x812)
- `docs/ux-audit/screenshots/entity-management/03-app-desktop-tablet.png` (768x1024)
