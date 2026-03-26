# Realmweaver UI Component Audit -- Follow-Up Report

> **Status:** ACTIVE — 45 of 70 findings addressed (34 in DM Workflow sprint 2026-03-24, 11 in Phase 7 Convention Cleanup 2026-03-26). Remaining items tracked below. Combat items intentionally deferred (D&D Beyond handles combat better).

**Date:** 2026-03-24
**Type:** Follow-up audit on post-refactoring state
**Prior Audit:** docs/ux-audit/UX-AUDIT-REPORT.md (2026-03-24)
**Method:** 4 parallel audit teams, each combining UX/accessibility and TTRPG domain expertise
**Scope:** ~85 .tsx component files across all feature areas

---

## 1. Executive Summary

The UX refactoring sprint successfully addressed the most critical systemic issues identified in the first audit. Native dialogs are gone. The slate/stone color split is resolved. Monolithic components have been decomposed. Dashboard search, keyboard navigation, entity color centralization, and focus traps are all in place. The composite UX score has meaningfully improved.

However, this follow-up audit reveals a second layer of issues that become visible now that the foundational problems are fixed. Three themes dominate:

1. **Touch/mobile parity gaps.** Numerous interactive elements use `opacity-0 group-hover:opacity-100` patterns that are completely invisible and inaccessible on touch devices. This is the most widespread issue, affecting session tools, the running log, wizards, and dashboards. Given that DMs commonly use tablets at the game table, this is a functional gap for the primary use case.

2. **Missing DM workflow features.** The combat tracker lacks condition tracking (the number one thing DMs forget in combat). The session prep wizard has no prep notes field. Player characters are read-only after import. Scene editors have no tab organization. These are not polish issues -- they are feature gaps that prevent DMs from doing core tasks within the app.

3. **Inconsistent patterns across similar components.** Some dashboards use `useEntitySearch` and `useRovingTabIndex` while others don't. Some generators have chat mode while others lack it. Some editors use `TabLayout` while structurally similar editors are flat scrolls. These inconsistencies create a "two speeds" feel where certain entity types have polished UX and others feel half-finished.

**Finding count:** 4 Critical, 18 High, 28 Medium, 20 Low (70 total)

---

## 2. Team 1: Campaign Management & Onboarding

### components/layout/Header.tsx

#### H-T1-1: Campaign dropdown menu has no keyboard navigation
**Finding:** The dropdown menu (line 117) opens/closes via click with outside-click dismiss, but has no keyboard support: no Escape to close, no arrow key navigation, no focus management when the menu opens.
**UX Rationale:** WCAG 2.1.1 requires all functionality be operable via keyboard. A dropdown menu must support Escape, arrow keys, and Enter/Space.
**DM Rationale:** DMs using keyboard shortcuts (Ctrl+K for command palette is supported) expect consistent keyboard interaction throughout.
**Priority:** High
**Suggested Change:** Add `onKeyDown` handler: Escape closes, ArrowDown/ArrowUp navigate items, Enter activates. Use `role="menu"` and `role="menuitem"`.

#### H-T1-2: Tool buttons lose labels below lg breakpoint
**Finding:** Header tool buttons (Continuity, Evocation Wizard, World Sim, Session Weaver) show labels only at `lg:` breakpoint. On medium screens (768-1024px), DMs see a row of identical amber icons with no labels. Icons for different tools are not distinctive enough to be self-explanatory.
**UX Rationale:** Icon-only toolbars require learned recognition. No hover tooltips on touch devices.
**DM Rationale:** A DM on a tablet sees amber icons and must tap each to discover functionality. Session Weaver and Evocation Wizard could easily be confused.
**Priority:** Medium
**Suggested Change:** On medium screens, show abbreviated labels or use a "More tools" overflow menu that expands to show labeled options.

#### H-T1-3: Header returns null when no active campaign
**Finding:** When `activeCampaign` is null (line 86-88), the header renders nothing. WelcomeScreen, CampaignCreator, and CrossCampaignDashboard have no app-level header.
**UX Rationale:** A consistent app shell across all states reduces cognitive load. CrossCampaignDashboard has no mock mode toggle or app branding.
**DM Rationale:** Navigating from an active campaign to "All Campaigns" causes the entire top of the screen to change, which is disorienting.
**Priority:** Medium
**Suggested Change:** Render a minimal header (logo, app name, mock mode toggle) when no campaign is active.

#### H-T1-4: Stale copy references Google Search
**Finding:** CampaignCreator.tsx line 354-357 says "Official settings use Google Search to find canon lore" but the app has migrated to Claude. This is stale copy from the Gemini era.
**UX Rationale:** Misleading information erodes user trust.
**DM Rationale:** A DM choosing "Official Setting" specifically for canon-aware search will be disappointed.
**Priority:** High
**Suggested Change:** Update copy to reflect current AI provider capabilities, or remove the note.

### components/views/FirstCampaignWizard.tsx

#### H-T1-5: Back button destroys forward-step edits
**Finding:** Going Back from step 3 (Locations) to step 2 (NPCs) and then Next again regenerates locations from scratch, losing all step 3 edits.
**UX Rationale:** Users expect Back to be non-destructive. Forward-step data should be preserved or the user should be warned.
**DM Rationale:** A DM who carefully edited 4 location names will be frustrated when they're wiped by a round-trip.
**Priority:** High
**Suggested Change:** On forward transitions (steps 2 to 3, 3 to 4), check if drafts already exist. If so, show a confirmation: "Regenerate or keep current?" via `useConfirmDialog`.

#### H-T1-6: Step 4 save has no loading state or error handling
**Finding:** "Save All & Finish" (line 296-338) creates entities synchronously with no loading indicator and no error handling. If the store throws on any entity, partial save occurs silently.
**UX Rationale:** Every other step transition shows a spinner -- this one doesn't. Inconsistent and risky.
**DM Rationale:** The final "save everything" step is where trust matters most.
**Priority:** High
**Suggested Change:** Wrap save loop in try/catch. Show loading state on button. On error, show error banner and don't advance.

#### H-T1-7: Step 4 scenes are read-only
**Finding:** NPCs and locations can be edited/removed in their respective steps, but scenes in the adventure preview (step 4) are display-only. Inconsistent user agency.
**UX Rationale:** Steps 2 and 3 allow full editing; step 4 breaks this pattern.
**DM Rationale:** DMs reviewing generated scenes commonly want to cut one that doesn't fit.
**Priority:** Medium
**Suggested Change:** Add a "Remove" button per scene card (trash icon, same pattern as NPC/Location cards).

#### H-T1-8: World description prompt lacks quality guidance
**Finding:** Step 1's 20-character minimum provides length validation but no content guidance. The placeholder disappears once typing starts.
**UX Rationale:** Character-count validation tells "how much" but not "what."
**DM Rationale:** A first-time DM needs prompts about what dimensions to include (tone, conflict, magic level).
**Priority:** Medium
**Suggested Change:** Add persistent bullet prompts below the textarea: "Tone?", "Central conflict?", "What makes magic/tech unique?"

### components/layout/CampaignSidebar.tsx

#### H-T1-9: Plus buttons navigate instead of creating
**Finding:** Plus buttons on "Party & Characters" (line 330) and "Plots & Arcs" (line 376) navigate to the dashboard view -- same action as clicking the label. The icon promises creation, the action delivers navigation.
**UX Rationale:** Plus icon communicates "create new entity" but doesn't deliver it.
**DM Rationale:** A DM in session expecting to quickly add a PC gets navigated away from their current view.
**Priority:** Medium
**Suggested Change:** Wire plus buttons to `onShowGenerator` with appropriate type, or show an inline quick-add popover.

#### H-T1-10: Drag and drop uses direct DOM manipulation
**Finding:** Drag handlers (lines 129, 137-138, 144, 162) use `classList.add/remove`, bypassing React's rendering model. Cleanup at line 162 uses `document.querySelectorAll('.border-amber-500')` as a catch-all.
**UX Rationale:** Fragile cleanup can strip classes from unrelated components.
**DM Rationale:** Scene reordering via drag-and-drop is a common DM workflow. Visual glitches erode trust.
**Priority:** Medium
**Suggested Change:** Track drag target in React state. Apply highlight classes via conditional className in JSX.

### components/layout/sidebar/sidebarUtils.ts

#### H-T1-11: Missing type entries cause potential runtime crash
**Finding:** `RECENT_TYPE_ICON` and `RECENT_TYPE_COLOR` maps filter out `sessionLog`, `playerCharacter`, and `note` types. If these appear in recent/pinned items, `Icons[undefined]` throws a runtime error.
**UX Rationale:** Latent crash in a frequently-used feature.
**DM Rationale:** Session logs and player characters are among the most frequently accessed entities.
**Priority:** High
**Suggested Change:** Include these types with correct icon/color values, or add a runtime guard with fallback defaults.

### components/views/CrossCampaignDashboard.tsx

#### H-T1-12: Delete uses inline double-click instead of ConfirmDialog
**Finding:** Campaign deletion uses `confirmDelete` state toggle (line 79) instead of `useConfirmDialog`. No ARIA announcements, no explanation of consequences.
**UX Rationale:** Inconsistent with the rest of the app which uses `useConfirmDialog` for destructive actions.
**DM Rationale:** Accidentally deleting a campaign with 50+ hours of prep is catastrophic.
**Priority:** High
**Suggested Change:** Replace with `useConfirmDialog` with a descriptive message about permanent data loss.

### components/views/WelcomeScreen.tsx

#### H-T1-13: No import path on welcome screen
**Finding:** Single CTA ("Create a Campaign") with no secondary path for importing. A user who deleted their last campaign has no way to restore from backup without creating a throwaway campaign first.
**UX Rationale:** Dead-end for a common recovery flow.
**DM Rationale:** DMs frequently share exports between devices or restore from backup.
**Priority:** Medium
**Suggested Change:** Add a secondary "Import Campaign" text link below the primary button.

---

## 3. Team 2: Entity Creation & Editing

### Dashboards

#### H-T2-1: Missing keyboard navigation on 6 dashboards
**Finding:** NPC and Location dashboards have `useRovingTabIndex`, but Faction, Item, Adventure, Article, SessionLog, and PlayerCharacter dashboards do not.
**UX Rationale:** Keyboard-only users can arrow-navigate NPC/Location grids but must Tab-per-card on other dashboards. WCAG 2.1.1 requires parity.
**DM Rationale:** DMs with many factions or items need efficient grid navigation.
**Priority:** High
**Suggested Change:** Add `useRovingTabIndex({ columns: 3 })` to all remaining dashboards. Mechanical 5-line addition per file.

#### H-T2-2: Inconsistent search hook usage
**Finding:** Six dashboards (Adventure, Article, SessionLog, PlayerCharacter, Plot, Note) manually implement search instead of using `useEntitySearch`. Implementations differ subtly in case handling and field matching.
**UX Rationale:** Different dashboards handle search differently, creating inconsistent behavior.
**DM Rationale:** Search consistency during session prep matters when jumping between dashboards.
**Priority:** Medium
**Suggested Change:** Refactor remaining dashboards to use `useEntitySearch`. Extend hook's generic constraint to accept `title` field (currently requires `name`).

#### H-T2-3: Note dashboard lacks AI integration and entity color convention
**Finding:** NoteDashboard has no `isMockMode`/`campaignContext` props, no AI creation, and uses unique yellow styling instead of ENTITY_TYPE_CONFIG colors.
**UX Rationale:** Visual inconsistency with all other dashboards. Missing AI assistance that every other entity type has.
**DM Rationale:** "Turn this bullet point into a plot hook" is a common DM need. Notes are the only entity without AI-assisted creation.
**Priority:** Medium
**Suggested Change:** Add AI expand button, adopt entity color convention, pass `isMockMode`/`campaignContext`.

#### H-T2-4: Entity cards lack completeness indicator
**Finding:** Dashboard cards show a text snippet but no indication of content richness. A fully detailed NPC looks identical to a name-only stub.
**UX Rationale:** Cards don't communicate entity "readiness" for session use.
**DM Rationale:** During prep, DMs need to quickly identify which entities need more work vs which are ready.
**Priority:** Medium
**Suggested Change:** Add a small completeness indicator (colored dot or fractional badge) based on non-empty key fields.

### Generators

#### H-T2-5: SceneGenerator missing chat mode and using non-standard loading
**Finding:** SceneGenerator is the only AI generator without dual-mode (chat + form) and uses a custom inline loading overlay instead of `SkeletonGeneratorOverlay`.
**UX Rationale:** Loading state inconsistency. Missing chat mode means scenes can't be iteratively refined.
**DM Rationale:** Scene creation is inherently iterative -- DMs want to say "add a trap here" or "make the NPC more threatening." Chat mode is especially valuable for scenes.
**Priority:** High
**Suggested Change:** Add `EntityChatGenerator` integration with `SceneEditor` preview. Replace custom overlay with `SkeletonGeneratorOverlay`.

#### H-T2-6: Form-mode generators have no prompt chips
**Finding:** Prompt chips only appear in chat mode. Form-mode textareas get no preset suggestions, creating a blank-page problem.
**UX Rationale:** Higher friction start than chat mode. Blank textarea with no guidance.
**DM Rationale:** New DMs don't know what level of detail the AI expects.
**Priority:** High
**Suggested Change:** Render prompt chips as clickable buttons below the form textarea that populate the prompt field on click.

#### H-T2-7: No structured inputs in form generators
**Finding:** All form generators have only a single textarea. No dropdowns for CR, alignment, rarity, biome, etc.
**UX Rationale:** Zero guidance beyond the textarea. Structured inputs pre-populate useful context.
**DM Rationale:** DMs often know specific parameters: "CR 5 undead for a swamp" or "rare magic weapon for level 8."
**Priority:** Medium
**Suggested Change:** Add 1-2 optional structured fields per generator (NPC: alignment/CR; Item: rarity; Location: biome; Adventure: level-range/party-size). Values append to prompt string.

#### H-T2-8: PlayerCharacterImporter has no manual entry path
**Finding:** Only supports PDF upload. No manual entry, no AI creation, no text paste.
**UX Rationale:** Dead end for non-PDF workflows (D&D Beyond, other VTTs, handwritten sheets).
**DM Rationale:** Many DMs need to quickly add a PC with just basic stats for session prep. Not all players provide PDF sheets promptly.
**Priority:** Medium
**Suggested Change:** Add a "Quick Add" manual form with essential PC fields (name, species, class, level, ability scores).

### Editors

#### H-T2-9: PlayerCharacterEditor is entirely read-only
**Finding:** No fields are editable. `onUpdate` prop is received but never called. `formData` is initialized but only read.
**UX Rationale:** Imported characters can't be corrected or updated. PDF parser errors have no recourse.
**DM Rationale:** PCs level up. Stats change. Backstory gets appended. A read-only view is a dead end.
**Priority:** High
**Suggested Change:** Make social traits (personality, ideals, bonds, flaws) and backstory editable with standard `handleChange`/`handleBlur`. Add an "Edit Stats" toggle for ability scores.

#### H-T2-10: SceneEditor has no tab organization
**Finding:** 12+ fields in a single flat scroll (347 lines). No tabs despite being the longest flat-layout editor. Other complex editors (NPC, Location, Faction) use `TabLayout`.
**UX Rationale:** Must scroll through everything to reach NPC list or SceneResourcesPanel at bottom.
**DM Rationale:** During prep, DMs focus on one aspect at a time. Tabs like "Narrative", "Mechanics", "Connections" would match DM prep flow.
**Priority:** High
**Suggested Change:** Add 3-tab layout using `TabLayout`: Narrative (title, type, read-aloud, GM notes), Mechanics (skill checks, rewards), Connections (location, NPCs, resources).

#### H-T2-11: ItemEditor missing history tracking and structured fields
**Finding:** Only editor without `EntityHistoryManager`. Also missing standard D&D item fields: attunement, weight, value, itemType.
**UX Rationale:** No undo path when DM regenerates an item description.
**DM Rationale:** Items are central to player motivation. Attunement, rarity, and item type are standard D&D properties DMs always need.
**Priority:** Medium
**Suggested Change:** Add `EntityHistoryManager`. Add optional fields for `attunement`, `weight`, `value`, `itemType`.

#### H-T2-12: NoteEditor has no BacklinksPanel or LinkedText
**Finding:** Notes exist in isolation from the entity graph. No BacklinksPanel, no EntityLink integration, no relationship discovery.
**UX Rationale:** Only editable entity type without BacklinksPanel.
**DM Rationale:** Notes that reference specific entities ("Have Garrick betray the party at Broken Bridge") would benefit from auto-linking.
**Priority:** Medium
**Suggested Change:** Add `BacklinksPanel` and `LinkedText` preview of note content.

#### H-T2-13: No save indicator in editors
**Finding:** All editors use on-blur save but provide no visual "saving..." or "saved" feedback. Only EntityQuickCard has a "saved" flash.
**UX Rationale:** Invisible auto-save creates anxiety. Users don't know if edits were persisted.
**DM Rationale:** During intense session prep, DMs editing many fields need confidence their work is saved.
**Priority:** Medium
**Suggested Change:** Add a save-status indicator to editor headers using `saveStatus` from campaignService state.

### Shared Components

#### H-T2-14: EntityCreationPanel chat container has fixed 480px height
**Finding:** Chat panel is `h-[480px]` (line 66). On long conversations, this constrains the chat area. On large monitors, it wastes space.
**UX Rationale:** Fixed height with two-column layout leaves ~200px visible chat history (~3 messages).
**DM Rationale:** Chat-based creation often involves 5-8 exchanges. Hard to reference earlier context.
**Priority:** Medium
**Suggested Change:** Replace `h-[480px]` with `min-h-[480px] max-h-[70vh]`.

#### H-T2-15: RegenerateButton panel lacks dialog semantics
**Finding:** Expanded regeneration panel (line 153-240) has no `role="dialog"`, no `aria-modal`, no focus trapping.
**UX Rationale:** Screen readers don't announce the popup. Keyboard users can tab past the panel. This component appears in every editor field -- accessibility gaps multiply.
**DM Rationale:** AI regeneration is a core workflow.
**Priority:** Medium
**Suggested Change:** Add `role="dialog"`, `aria-label`, and focus trapping to the panel.

---

## 4. Team 3: Session Running & DM Tools

### components/views/session/RunningLog.tsx

#### H-T3-1: Running log hidden on mobile for 2 of 3 tabs [CRITICAL]
**Finding:** Running log is only visible on the "active" tab on mobile. DMs cannot take notes while using the dice roller (tools tab) or reviewing upcoming scenes (scenes tab). This forces constant tab switching.
**UX Rationale:** The running log is the session's permanent record. Hiding it on most views is a fundamental layout failure.
**DM Rationale:** This is the most critical session runner issue. A DM using tools cannot simultaneously log what happened. Note-taking must be accessible from all contexts.
**Priority:** Critical
**Suggested Change:** Make the running log a persistent bottom panel on mobile, always visible regardless of active tab. Even a collapsed single-line input bar ("Add note...") that expands on focus would suffice.

#### H-T3-2: Star/importance toggle invisible on touch devices
**Finding:** Uses `opacity-0 group-hover:opacity-100`. Mobile users cannot mark notes as important.
**UX Rationale:** Touch devices have no hover state. Feature is completely broken on the platform most DMs use at the table.
**DM Rationale:** Starring important notes is designed for post-session review. If DMs can't star on mobile, the feature fails for its primary use case.
**Priority:** High
**Suggested Change:** Always show on mobile: `opacity-100 md:opacity-0 md:group-hover:opacity-100`.

#### H-T3-3: No ability to edit or delete notes
**Finding:** Notes cannot be edited or removed after creation.
**UX Rationale:** Typos during rushed note-taking persist in the permanent record.
**DM Rationale:** Midsession typing is fast and error-prone. Wrong NPC names or typos feed into AI recap generation (garbage in, garbage out).
**Priority:** Medium
**Suggested Change:** Add edit icon alongside star button. On click, convert to inline editable input. Add delete button.

### components/tools/CombatTracker.tsx

#### H-T3-4: No condition tracking [CRITICAL]
**Finding:** No way to track D&D conditions (Stunned, Poisoned, Grappled, Concentration, etc.) -- only freeform notes.
**UX Rationale:** Freeform notes for structured data is error-prone.
**DM Rationale:** Conditions are the #1 thing DMs forget during combat, leading to rules errors that frustrate players. "Wait, wasn't the ogre stunned?" This is the biggest feature gap in the combat tracker.
**Priority:** Critical
**Suggested Change:** Add conditions dropdown/chip system per combatant with D&D 5e preset conditions. Display as colored badges. Add Concentration as special tracked state.

#### H-T3-5: Previous Turn function exists but no UI button
**Finding:** `prevTurn()` function exists (line 74-84) but is never exposed in the UI.
**UX Rationale:** Accidental turn advances cannot be undone.
**DM Rationale:** "Oops, I skipped the cleric's turn" is extremely common.
**Priority:** High
**Suggested Change:** Add "Previous Turn" button in the header next to "Next Turn".

#### H-T3-6: Combat panel overflows mobile at w-[500px]
**Finding:** Combat tracker slide-out is hardcoded at `w-[500px]`, wider than most mobile viewports.
**UX Rationale:** Creates horizontal scroll or hidden content on tablets.
**DM Rationale:** DMs using tablets at the table will find the combat tracker unusable.
**Priority:** High
**Suggested Change:** Replace with `w-full max-w-[500px]`.

#### H-T3-7: HP can go arbitrarily negative with no state indication
**Finding:** No visual distinction between 0 HP and negative HP. No automatic "Down" or "Dead" indicators.
**UX Rationale:** No feedback at critical HP thresholds.
**DM Rationale:** 0 HP = unconscious. Negative-maxHP = instant death in D&D 5e.
**Priority:** Medium
**Suggested Change:** Add visual state indicators at HP boundaries: "Down" badge at 0 HP, "Dead" badge at negative-maxHP.

#### H-T3-8: No initiative rolling mechanism
**Finding:** Adding combatants from roster sets initiative to 0. No "Roll All" button.
**UX Rationale:** DM must manually edit each combatant's initiative after adding.
**DM Rationale:** Rolling initiative is 5-10 extra interactions that could be automated.
**Priority:** Medium
**Suggested Change:** Add "Roll All Initiatives" button (random d20 for each combatant with no initiative set).

### components/views/session/ActiveScenePanel.tsx

#### H-T3-9: No copy-to-clipboard on read-aloud text
**Finding:** Read-aloud text box (line 100-110) has no copy button.
**UX Rationale:** DMs frequently paste read-aloud into VTT chat or Discord. Manual select-and-copy is friction during live play.
**DM Rationale:** "Read Aloud" is the single most-used block during a scene. Hybrid sessions need one-click sharing.
**Priority:** High
**Suggested Change:** Add copy-to-clipboard icon button in top-right of read-aloud section.

#### H-T3-10: Skill check roll has no modifier input
**Finding:** Roll button (line 229-236) rolls raw d20 vs DC with no modifier, proficiency bonus, or advantage/disadvantage input.
**UX Rationale:** Small touch target (`px-2 py-0.5`, below 44px minimum).
**DM Rationale:** D&D skill checks always add a modifier. A raw d20 roll is functionally useless for actual gameplay.
**Priority:** High
**Suggested Change:** Add modifier input field. Increase button padding. Consider advantage/disadvantage toggle.

### components/views/session/SceneListPanel.tsx

#### H-T3-11: Beat delete button invisible on touch devices
**Finding:** Uses `opacity-0 group-hover:opacity-100`. Mobile users cannot delete beats.
**UX Rationale:** Complete feature gap on the platform most DMs use at the table.
**DM Rationale:** DMs add beats on the fly and need to clean up irrelevant ones.
**Priority:** High
**Suggested Change:** Always visible on mobile. Use `opacity-100 md:opacity-0 md:group-hover:opacity-100`.

### components/dialogs/DmCoach.tsx

#### H-T3-12: Not using DialogShell; full overlay on mobile
**Finding:** DM Coach is positioned `absolute` with `inset-y-0 right-0 w-full max-w-md`. No DialogShell, no Escape handler, no focus trap. On mobile, completely overlays session content.
**UX Rationale:** Violates CLAUDE.md convention. No keyboard dismiss.
**DM Rationale:** DMs need to reference session content while using the coach. Full overlay forces close-read-remember-reopen workflow.
**Priority:** High
**Suggested Change:** Either use DialogShell or render as half-height bottom sheet on mobile. Add Escape handler regardless.

#### H-T3-13: NPC roleplay selector is flat dropdown of all campaign NPCs
**Finding:** All NPCs in a flat list (line 474-484). No filtering, no scene-aware sorting.
**UX Rationale:** Campaigns with 30+ NPCs make finding the right one slow.
**DM Rationale:** "The players are talking to the blacksmith" -- scrolling through 50 NPCs mid-conversation creates dead air at the table.
**Priority:** High
**Suggested Change:** Add `<optgroup label="In This Scene">` for active scene NPCs, then `<optgroup label="Other NPCs">` for rest.

### components/dialogs/SessionPrepWizard.tsx

#### H-T3-14: No prep notes field [CRITICAL]
**Finding:** The wizard guides through adventure, scenes, entities, plots -- but never asks for personal prep notes. `prepNotes` is initialized empty and never populated.
**UX Rationale:** Gap in the guided flow.
**DM Rationale:** "Remember to introduce the thieves' guild contact", "Use a Scottish accent for the new NPC" -- these notes ARE the core of session prep. The wizard covers logistics but not creative prep.
**Priority:** Critical
**Suggested Change:** Add "Prep Notes" step between "Plot Threads" and "Review", or add prep notes textarea to Review step.

#### H-T3-15: Extra NPCs/Locations list has no search
**Finding:** "Add extra" section (lines 561-584, 636-660) renders ALL remaining entities as flat list. No filtering.
**UX Rationale:** Unusable for campaigns with 30+ entities.
**DM Rationale:** DM searching for a specific NPC has to visually scan the entire list.
**Priority:** Medium
**Suggested Change:** Add search input above the lists.

### components/dialogs/SessionEndWizard.tsx

#### H-T3-16: AI recap auto-triggers regardless of note count
**Finding:** Auto-triggers on mount (line 109-115) even with sparse notes, producing low-quality recaps at the cost of an API call.
**UX Rationale:** Removes user agency. DMs may want to write their own recap first.
**DM Rationale:** Short sessions with 5 notes produce thin recaps. Many DMs prefer their own recap for accuracy.
**Priority:** Medium
**Suggested Change:** Only auto-trigger if `structuredNotes.length >= 5`. Otherwise show "Generate AI Recap" button.

### components/views/SessionRunner.tsx

#### H-T3-17: Session timer resets on re-mount
**Finding:** `startedAtRef` initialized with `Date.now()` on mount (line 49). Not persisted. Navigating away and back resets the timer.
**UX Rationale:** Timer inaccuracy if component re-mounts.
**DM Rationale:** Session length is a pacing metric DMs rely on.
**Priority:** Medium
**Suggested Change:** Persist `startedAt` on session log entity and derive elapsed time from persisted timestamp.

#### H-T3-18: FAB menu lacks keyboard support
**Finding:** Mobile FAB menu (line 344-400) has no Escape handler, no focus trap, no `role="menu"`.
**UX Rationale:** Primary mobile interaction point is inaccessible to keyboard users.
**DM Rationale:** Low direct impact but important for inclusive design.
**Priority:** Medium
**Suggested Change:** Add Escape handler, `role="menu"` / `role="menuitem"`.

### components/tools/SecretsTracker.tsx

#### H-T3-19: No entity linking despite data model support
**Finding:** `linkedEntityIds: []` exists in data model but has no UI. Secrets can't be connected to NPCs, locations, or plots.
**UX Rationale:** Dead schema with no UI. Entity-linked secrets enable powerful cross-referencing.
**DM Rationale:** "This NPC knows Secret X" and "This location contains Clue Y" are fundamental DM mental models.
**Priority:** Medium
**Suggested Change:** Add entity picker in the expanded secret card or add form.

#### H-T3-20: Delete uses timed double-click instead of ConfirmDialog
**Finding:** Inconsistent with rest of app. 3-second timeout is too short for multitasking DMs.
**UX Rationale:** Accessibility gap and inconsistency.
**DM Rationale:** Accidentally deleting a secret during live session has no recovery.
**Priority:** Medium
**Suggested Change:** Replace with `useConfirmDialog`.

---

## 5. Team 4: Advanced Features & Visualization

### components/dialogs/EvocationWizard.tsx

#### H-T4-1: 50/50 split layout not responsive
**Finding:** `w-1/2` split (line 295) on left and right panels. Below ~1024px the panels are too narrow.
**UX Rationale:** Multi-field forms need width. Cramped on tablets and small laptops.
**DM Rationale:** DMs on tablets during session prep will struggle.
**Priority:** High
**Suggested Change:** `flex-col lg:flex-row` with `w-full lg:w-1/2`.

#### H-T4-2: Edit buttons use hover-only visibility
**Finding:** Entity edit buttons (line 710) are `opacity-0 group-hover:opacity-100`. Invisible on touch.
**UX Rationale:** Touch and keyboard users cannot discover or activate edit.
**DM Rationale:** DMs reviewing generated content on tablets can't edit entities.
**Priority:** High
**Suggested Change:** Always visible or visible on `focus-visible` as well.

#### H-T4-3: No Select All / Deselect All toggle
**Finding:** No bulk selection in `ResultsSection` (line 339-343).
**UX Rationale:** Individually toggling 15+ entities is tedious.
**DM Rationale:** DMs often want to deselect all then cherry-pick, or select all and deselect bad ones.
**Priority:** Medium
**Suggested Change:** Add header-level checkbox per category.

#### H-T4-4: No per-entity progress during batch generation
**Finding:** Detailed mode fires all generations in parallel but shows only a single loading message (line 146-208). No per-entity progress.
**UX Rationale:** 30+ seconds with no progress indication looks broken.
**DM Rationale:** DMs wonder if the wizard is stuck.
**Priority:** Medium
**Suggested Change:** Track completion counter. Update message as each promise resolves.

### components/dialogs/WorldSimulationWizard.tsx

#### H-T4-5: Range slider labels don't match positions
**Finding:** Linear 1-180 slider with evenly spaced labels ("1 day", "1 week", "1 month", "6 months"). Day 7 is at 3.9% but "1 week" text sits at 33%.
**UX Rationale:** Spatial mapping is misleading. Users will overshoot dramatically.
**DM Rationale:** "I wanted one week but got six weeks" is frustrating.
**Priority:** High
**Suggested Change:** Make slider use preset stops (logarithmic) or remove misleading text labels and rely on quick-pick buttons.

#### H-T4-6: Before/After diffs truncated with no expand
**Finding:** `line-clamp-3` on proposed changes (line 345-346) with no expand mechanism. Long descriptions are silently truncated.
**UX Rationale:** Undermines the review step's purpose.
**DM Rationale:** DMs need full "after" text to judge whether changes fit their vision.
**Priority:** Medium
**Suggested Change:** Add "Show more" toggle on clamped text.

#### H-T4-7: No cancel option during generation
**Finding:** Loading step has no cancel. Must wait for API call to complete or close entire wizard (line 400-402).
**UX Rationale:** Long-running AI calls should be cancellable.
**DM Rationale:** DM who accidentally clicked simulate shouldn't wait 15+ seconds.
**Priority:** Medium
**Suggested Change:** Add Cancel button with `AbortController`.

### components/dialogs/ContinuityChecker.tsx

#### H-T4-8: Error severity icon conflicts with dismiss icon
**Finding:** `SeverityIcon` uses `Icons.X` for errors (line 53). Same icon as "close/dismiss." Two X icons on same card.
**UX Rationale:** Violates consistency heuristics. DMs may click wrong X.
**DM Rationale:** Scanning quickly during prep, DMs may confuse severity indicator with dismiss button.
**Priority:** Medium
**Suggested Change:** Use `Icons.AlertCircle` or `Icons.XCircle` for error severity.

#### H-T4-9: No re-run button
**Finding:** Checker runs once on mount. No way to refresh results after fixing issues without closing and reopening dialog.
**UX Rationale:** Stale results after fixes are made.
**DM Rationale:** DMs who fix a broken reference immediately want to verify resolution.
**Priority:** Medium
**Suggested Change:** Add "Re-check" button that re-runs `checkContinuity(campaign)`.

### components/dialogs/ExportModal.tsx

#### H-T4-10: No loading state, success feedback, or entity count preview
**Finding:** Clicking export fires the callback with no visible feedback. No summary of what will be exported.
**UX Rationale:** Silent operation creates uncertainty about success.
**DM Rationale:** DMs exporting before a session want to be sure the file was saved.
**Priority:** High
**Suggested Change:** Add loading state, success toast, and entity count summary.

### components/visualizers/RelationshipGraph.tsx

#### H-T4-11: TYPE_COLORS hardcoded instead of using ENTITY_TYPE_CONFIG
**Finding:** Line 13-21 uses hardcoded hex values instead of deriving from `ENTITY_TYPE_CONFIG`. Violates CLAUDE.md convention.
**UX Rationale:** Colors will diverge when entity config is updated.
**DM Rationale:** Inconsistent colors between sidebar/dashboards and graph confuse DMs.
**Priority:** High
**Suggested Change:** Import `ENTITY_TYPE_CONFIG` and map its color tokens to hex values for D3.

#### H-T4-12: No empty state in graph
**Finding:** Zero-entity campaign shows empty dark canvas with no message.
**UX Rationale:** Looks broken. Users won't know if data is missing or filters are hiding everything.
**DM Rationale:** New campaigns get a confusing blank graph.
**Priority:** Medium
**Suggested Change:** Render centered "No entities to display" message when `nodes.length === 0`.

#### H-T4-13: Node circles too small for touch targets
**Finding:** Node circles are 8px radius (16px diameter). Below 44px minimum touch target.
**UX Rationale:** Clicking small circles is difficult on touch screens.
**DM Rationale:** DMs on tablets showing the graph to players can't easily tap nodes.
**Priority:** Medium
**Suggested Change:** Add invisible larger hit area (transparent circle with r=22) behind visible nodes.

### components/visualizers/PlotTimeline.tsx

#### H-T4-14: Session header row not sticky [CRITICAL]
**Finding:** Session header scrolls away when campaign has many plots (10+). Users lose column context.
**UX Rationale:** Without sticky headers, users can't tell which session a status dot belongs to.
**DM Rationale:** Complex campaigns with parallel plots are exactly where this timeline is most needed and most broken.
**Priority:** Critical (for campaigns with 10+ plots)
**Suggested Change:** Make session header row `sticky top-0 z-10 bg-slate-900`.

#### H-T4-15: No scroll indicator for horizontal overflow
**Finding:** No visual indicator that session columns are scrollable (line 258-260). Hidden scrollbars on macOS mean overflow content is invisible.
**UX Rationale:** Users think only visible sessions exist.
**DM Rationale:** Long campaigns with 20+ sessions will have most sessions hidden.
**Priority:** Medium
**Suggested Change:** Add fade gradient or scroll arrows on the right edge when content overflows.

#### H-T4-16: Tooltip clips at viewport edges
**Finding:** Tooltip (line 189-191) uses `position: fixed` with no viewport clamping.
**UX Rationale:** Tooltips near edges are clipped and unreadable.
**DM Rationale:** First and last session columns are most affected.
**Priority:** Medium
**Suggested Change:** Clamp position to viewport bounds.

### components/RealmChat/RealmChatWidget.tsx

#### H-T4-17: Fixed dimensions not responsive
**Finding:** `w-[450px] h-[700px]` (line 245-246). Overflows on mobile, undersized on large screens.
**UX Rationale:** Fixed pixel dimensions are a responsive design anti-pattern.
**DM Rationale:** DMs on phones during sessions get a broken UI.
**Priority:** High
**Suggested Change:** `w-full sm:w-[450px] max-w-[calc(100vw-3rem)]` and `h-[calc(100vh-6rem)] sm:h-[700px]`.

#### H-T4-18: Entity picker has no search
**Finding:** Entity picker overlay (line 305-320) lists all entities with no filter input.
**UX Rationale:** Unmanageable for campaigns with 50+ entities.
**DM Rationale:** Rich campaigns can't quickly find entities to load into chat.
**Priority:** Medium
**Suggested Change:** Add search input using `useEntitySearch`.

### components/common/CommandPalette.tsx

#### H-T4-19: Not using DialogShell
**Finding:** CommandPalette implements its own backdrop and dialog (line 531-540) instead of using DialogShell. Missing focus trap.
**UX Rationale:** Convention violation. Tab can escape to background elements.
**DM Rationale:** During sessions, keyboard focus glitches break flow.
**Priority:** High
**Suggested Change:** Wrap in DialogShell. Coordinate Escape handling between palette and shell.

#### H-T4-20: Scene selection navigates to adventure without scene context
**Finding:** Selecting a scene (line 449-454) navigates to parent adventure but doesn't highlight or scroll to the specific scene.
**UX Rationale:** Search result lands on wrong level of detail.
**DM Rationale:** DM searching for a specific scene expects to see it, not hunt for it in the adventure.
**Priority:** Medium
**Suggested Change:** Pass scene ID alongside adventure ID. Auto-expand/scroll to scene in adventure editor.

---

## 6. Consolidated Prioritized Change List

### Critical (4)

| # | Component | Issue | Effort |
|---|-----------|-------|--------|
| C1 | RunningLog | Hidden on mobile for 2/3 tabs -- DMs can't take notes while using tools | M |
| C2 | CombatTracker | No condition tracking -- the #1 thing DMs forget in combat | L |
| C3 | SessionPrepWizard | No prep notes field -- the core of what DMs actually prep | S |
| C4 | PlotTimeline | Session header row not sticky -- loses column context with many plots | S |

### High (18)

| # | Component | Issue | Effort |
|---|-----------|-------|--------|
| H1 | Header | Campaign dropdown has no keyboard navigation | S |
| H2 | Header | Stale copy references Google Search post-migration | S |
| H3 | FirstCampaignWizard | Back button destroys forward-step edits | M |
| H4 | FirstCampaignWizard | Step 4 save has no loading/error handling | S |
| H5 | sidebarUtils | Missing type entries cause potential runtime crash | S |
| H6 | CrossCampaignDashboard | Delete uses inline double-click instead of ConfirmDialog | S |
| H7 | 6 Dashboards | Missing useRovingTabIndex keyboard navigation | S |
| H8 | SceneGenerator | Missing chat mode and using non-standard loading | M |
| H9 | All Form Generators | No prompt chips in form mode | S |
| H10 | PlayerCharacterEditor | Entirely read-only after import | M |
| H11 | SceneEditor | No tab organization for 12+ fields | M |
| H12 | ActiveScenePanel | No copy-to-clipboard on read-aloud text | S |
| H13 | ActiveScenePanel | Skill check roll has no modifier input | S |
| H14 | SceneListPanel + RunningLog | Hover-only buttons invisible on touch | S |
| H15 | DmCoach | Not using DialogShell; full overlay on mobile | M |
| H16 | DmCoach | NPC roleplay selector unsorted flat list | S |
| H17 | CombatTracker | Previous Turn button missing from UI | S |
| H18 | CombatTracker | Panel overflows mobile at w-[500px] | S |
| H19 | EvocationWizard | 50/50 layout not responsive | S |
| H20 | EvocationWizard | Edit buttons hover-only | S |
| H21 | WorldSimWizard | Slider labels don't match positions | M |
| H22 | ExportModal | No loading/success feedback | S |
| H23 | RelationshipGraph | TYPE_COLORS hardcoded vs ENTITY_TYPE_CONFIG | S |
| H24 | RealmChatWidget | Fixed dimensions not responsive | S |
| H25 | CommandPalette | Not using DialogShell | S |

### Medium (28)

| # | Component | Issue |
|---|-----------|-------|
| M1 | Header | Tool buttons lose labels below lg |
| M2 | Header | Returns null when no active campaign |
| M3 | FirstCampaignWizard | Scenes read-only in step 4 |
| M4 | FirstCampaignWizard | World description lacks quality guidance |
| M5 | CampaignSidebar | Plus buttons navigate instead of creating |
| M6 | CampaignSidebar | Drag-drop uses direct DOM manipulation |
| M7 | WelcomeScreen | No import path |
| M8 | 6 Dashboards | Inconsistent search hook usage |
| M9 | NoteDashboard | No AI integration, wrong color convention |
| M10 | Entity cards | No completeness indicator |
| M11 | Form generators | No structured inputs (CR, rarity, etc.) |
| M12 | PlayerCharacterImporter | No manual entry path |
| M13 | ItemEditor | Missing history tracking and structured fields |
| M14 | NoteEditor | No BacklinksPanel or LinkedText |
| M15 | All editors | No save indicator |
| M16 | EntityCreationPanel | Fixed 480px chat height |
| M17 | RegenerateButton | Panel lacks dialog semantics |
| M18 | RunningLog | No edit/delete for notes |
| M19 | CombatTracker | HP has no state indicators (Down/Dead) |
| M20 | CombatTracker | No initiative rolling mechanism |
| M21 | SessionRunner | Timer resets on re-mount |
| M22 | SessionRunner | FAB menu lacks keyboard support |
| M23 | SessionPrepWizard | Extra entity lists have no search |
| M24 | SessionEndWizard | AI recap auto-triggers regardless of note count |
| M25 | SecretsTracker | No entity linking despite data model support |
| M26 | SecretsTracker | Delete uses timed double-click |
| M27 | EvocationWizard | No Select All / Deselect All |
| M28 | EvocationWizard | No per-entity progress during batch gen |
| M29 | WorldSimWizard | Before/After diffs truncated with no expand |
| M30 | WorldSimWizard | No cancel during generation |
| M31 | ContinuityChecker | Error icon conflicts with dismiss icon |
| M32 | ContinuityChecker | No re-run button |
| M33 | RelationshipGraph | No empty state message |
| M34 | RelationshipGraph | Node circles too small for touch |
| M35 | PlotTimeline | No scroll indicator for overflow |
| M36 | PlotTimeline | Tooltip clips at viewport edges |
| M37 | RealmChatWidget | Entity picker has no search |
| M38 | CommandPalette | Scene selection doesn't navigate to scene |

### Low (20)

| # | Component | Issue |
|---|-----------|-------|
| L1 | WelcomeScreen | No main landmark |
| L2 | CampaignCreator | Title input has no inline validation |
| L3 | CampaignCreator | DM Style badges have duplicate amber color |
| L4 | CampaignCreator | DM Style buttons lack radiogroup ARIA |
| L5 | CampaignSidebar | Only NPCs expanded by default |
| L6 | CampaignSidebar | No context menu on entity items |
| L7 | Header | z-index values hardcoded without scale |
| L8 | SidebarSearch | Focus ring uses slate instead of amber |
| L9 | SidebarSearch | Clear button has no aria-label |
| L10 | ArticleTreeItem | Uses Scenes icon instead of article icon |
| L11 | CrossCampaignDashboard | Dynamic Tailwind class construction (CDN-dependent) |
| L12 | CrossCampaignDashboard | Delete confirm has no timeout |
| L13 | CrossCampaignDashboard | No empty state illustration |
| L14 | CrossCampaignDashboard | No search/filter for campaigns |
| L15 | SessionLogDashboard | Minor consistency gaps (keyboard nav, search) |
| L16 | AdventureEditor | Missing delete button |
| L17 | EntityCreationPanel | Chat as default may confuse new users |
| L18 | BacklinksPanel | No count in collapsed header |
| L19 | QuickToolsPanel | "tap to cycle" language not universal |
| L20 | Wizard-Sidebar handoff | Post-wizard sidebar doesn't expand all sections |

---

## 7. Quick Wins (Low Effort + High Impact)

These changes are small (S effort) but address High-priority issues:

| # | Change | Files | Impact |
|---|--------|-------|--------|
| 1 | Fix stale "Google Search" copy in CampaignCreator | 1 | Fixes misleading info for every user |
| 2 | Add missing type entries in sidebarUtils.ts | 1 | Prevents potential runtime crash |
| 3 | Use ConfirmDialog for CrossCampaignDashboard delete | 1 | Prevents catastrophic accidental deletion |
| 4 | Add useRovingTabIndex to 6 dashboards | 6 | Keyboard navigation parity |
| 5 | Add prompt chips to form-mode generators | 6 | Dramatically improves first-use experience |
| 6 | Add copy-to-clipboard on read-aloud text | 1 | Most-used feature for DMs in session |
| 7 | Fix hover-only buttons (RunningLog, SceneListPanel) | 2 | Fixes broken mobile functionality |
| 8 | Add Previous Turn button to CombatTracker | 1 | Exposes existing function |
| 9 | Fix combat panel responsive width | 1 | Mobile usability fix |
| 10 | Make PlotTimeline header sticky | 1 | Critical fix for complex campaigns |
| 11 | Add Escape handler to Header dropdown | 1 | Keyboard accessibility |
| 12 | Fix EvocationWizard edit button visibility | 1 | Touch device fix |
| 13 | Fix RealmChat responsive dimensions | 1 | Mobile usability fix |
| 14 | Use ENTITY_TYPE_CONFIG in RelationshipGraph | 1 | Convention compliance |
| 15 | Add export feedback to ExportModal | 1 | User confidence |
| 16 | Add prep notes textarea to SessionPrepWizard Review step | 1 | Core DM workflow gap |

**Total quick wins: 16 changes across ~27 files. Estimated effort: 2-3 days.**

---

## 8. Thematic Work Streams

### Stream A: Touch/Mobile Parity (2-3 days)
Fix all hover-only visibility patterns across the codebase. Establish a project convention: interactive elements must be accessible on touch devices. Grep for `opacity-0 group-hover:opacity-100` and add mobile alternatives.

Covers: H14, H20, M18 (RunningLog star), SceneListPanel beats, EvocationWizard edits, plus any others found via grep.

### Stream B: Combat Tracker Evolution (3-4 days)
Add condition tracking, Previous Turn button, responsive layout, HP state indicators, initiative rolling. This is the highest-impact feature stream for DMs who run combat.

Covers: C2, H17, H18, M19, M20.

### Stream C: Session Workflow Completion (2-3 days)
Add prep notes to SessionPrepWizard. Make running log persistent on mobile. Fix session timer persistence. Wire DM Coach improvements (DialogShell, scene-aware NPC selector).

Covers: C1, C3, H15, H16, M21, M24.

### Stream D: Editor Consistency Pass (3-4 days)
Add tabs to SceneEditor. Make PlayerCharacterEditor editable. Add missing EntityHistoryManager to ItemEditor. Add BacklinksPanel to NoteEditor. Add save indicators to all editors.

Covers: H10, H11, M13, M14, M15.

### Stream E: Generator Enhancement (2-3 days)
Add prompt chips to form-mode generators. Add chat mode to SceneGenerator. Add structured inputs. Add manual PC entry path.

Covers: H8, H9, M11, M12.

### Stream F: Accessibility & Convention Compliance (2 days)
DialogShell for CommandPalette and DmCoach. Keyboard navigation for remaining dashboards. ARIA improvements across RegenerateButton, RelationshipGraph, PlotTimeline.

Covers: H1, H7, H25, M17, M22, M34.
