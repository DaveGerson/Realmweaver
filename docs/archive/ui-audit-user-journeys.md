# User Journey Audit: From/To Analysis

> **Date:** 2026-03-22
> **Scope:** 18 user journeys traced through actual code paths
> **Method:** Automated code-level analysis tracing click paths, state transitions, and friction points

---

## Executive Summary

**Overall finding:** Realmweaver's data model and service layer are well-designed, but the UI layer consistently fails to connect features into smooth workflows. Users hit dead ends, invisible state changes, and navigation breaks at nearly every lifecycle transition — especially between prep, live session, and post-session phases.

**Top 5 systemic issues:**
1. **Session Runner blocks all entity navigation** — Clicking entities in the sidebar during `session-runner` view is a silent dead end; the entity editor never renders because session-runner wins the `renderMainContent` priority check
2. **No cross-entity navigation in editors** — App.tsx has `handleSelect(type, id)` routing but it's never passed to any editor as a prop
3. **"Start Session" vs "Go Live" confusion** — Two buttons for one logical action, with different labels and no explanation
4. **No session-to-session continuity bridge** — Loose ends captured at session end are never surfaced in next session's prep
5. **Post-action dead ends everywhere** — After generation, import, export, and session end, users are dropped with no next-action guidance

---

## Journey Scores Overview

| # | Journey | Steps | Friction Points | Score | Most Affected Archetype |
|---|---------|:-----:|:---------------:|:-----:|------------------------|
| 1 | Cold Start → First Campaign | 6 | 3 | 2/5 | New DM |
| 2 | Cold Start → First Entity | 6 | 4 | 2/5 | Improviser |
| 3 | Empty → Populated (Wizard) | 9 | 5 | 2.5/5 | New DM |
| 4 | App Open → Session Prep | 9 | 5 | 2/5 | Occasional DM |
| 5 | Idea → Entity (Quick) | 3 | 4 | 3.5/5 | Improviser |
| 5b | Idea → Entity (Chat) | 5+ | 5 | 2.5/5 | Improviser |
| 6 | Entity → Edited Entity | 7+ | 5 | 2/5 | Worldbuilder |
| 7 | Campaign → Adventure Planning | 10+ | 4 | 2/5 | Narrative Planner |
| 8 | Prep → Live Session | 5 | 4 | 2/5 | New DM |
| 9 | Need NPC → Improvised NPC | 5 | 4 | 3/5 | Improviser |
| 10 | Stuck → AI Assist (DM Coach) | 7 | 5 | 2.5/5 | Improviser |
| 11 | Combat Start → Combat End | 6+ | 6 | 2/5 | Tactical DM |
| 12 | Question → Entity Lookup | 6 | 5 | 2/5 | Reactive DM |
| 13 | Session End → Session Log | 7 | 7 | 2/5 | Improviser |
| 14 | Session End → Plot Update | 5 | 5 | 2/5 | Narrative DM |
| 15 | Session End → Next Prep | 6+ | 6 | 2/5 | Continuity DM |
| 16 | Entity → Related Entities | 6 | 6 | 2/5 | Session DM |
| 17 | Campaign → Export | 3 | 3 | 3/5 | Record-Keeper |
| 18 | Import → Usable Campaign | 6 | 6 | 2/5 | Returning DM |

**Average happiness score: 2.2/5**

---

## Detailed Journey Analysis

### Journey 1: Cold Start → First Campaign

**Critical Discovery:** The WelcomeScreen is NOT the cold start. `campaignService.init()` seeds a "Winter's Daughter" sample campaign on first load, setting `appStatus = 'editing'` immediately. The DM lands in someone else's campaign with no explanation.

| Step | Action | Location |
|------|--------|----------|
| 1 | App loads, init() fires | `campaignService.ts:1757` |
| 2 | Sample campaign seeded | `campaignService.ts:271,842` |
| 3 | User sees pre-populated campaign | No WelcomeScreen shown |
| 4 | Must discover "New Campaign" in header | Header dropdown |
| 5 | CampaignCreator form | `CampaignCreator.tsx:20-125` |
| 6 | Fill title, click "Weave Campaign" | `CampaignCreator.tsx:26-31` |

**Friction:** Sample campaign has no "This is a sample — create your own" explanation. No back button in CampaignCreator. Post-creation landing has no next-step prompt.

**Score: 2/5** | **Archetype:** New DM

---

### Journey 2: Cold Start → First Entity

| Step | Action | Location |
|------|--------|----------|
| 1 | Land on Campaign Setting editor | `App.tsx:58` (default view) |
| 2 | Scan sidebar for "NPCs" | `CampaignSidebar.tsx:191` |
| 3 | Click "NPCs" | Sets `activeView='npcs'` |
| 4 | See NpcDashboard with generator | `NpcDashboard.tsx:17` |
| 5 | Type prompt, click Generate | `NpcGenerator.tsx:132` |
| 6 | Wait for AI, auto-redirect to editor | `App.tsx:535-537` |

**Friction:** Setting screen has no "start here" guidance. No generation time estimate. After creation, no "Create Another" button — must sidebar-click back.

**Score: 2/5** | **Archetype:** Improviser

---

### Journey 3: Empty Campaign → Populated World (Evocation Wizard)

| Step | Action | Location |
|------|--------|----------|
| 1 | Find "Evocation Wizard" in header | `Header.tsx:147-154` |
| 2 | Click to open | `App.tsx:608` sets `isWizardOpen` |
| 3 | Land on Simple mode with 4 tabs | `EvocationWizard.tsx:97,280-311` |
| 4 | Type theme prompt | `EvocationWizard.tsx:101-102` |
| 5 | Click Generate, wait | `EvocationWizard.tsx:318-320` |
| 6 | Review results, toggle selections | `EvocationWizard.tsx:343-350` |
| 7 | Optionally edit entities | `EvocationWizard.tsx:363-414` |
| 8 | Click "Add Selected to Campaign" | `EvocationWizard.tsx:353-358` |
| 9 | Native `alert()`, dropped back to empty view | `App.tsx:685` |

**Friction:** Icon-only button on smaller screens. "Ingest" tab name is jargon. No post-add navigation prompt. No count on submit button. `alert()` is jarring. Edit modal covers entire wizard (z-30) losing results context.

**Score: 2.5/5** | **Archetype:** New DM

---

### Journey 4: App Open → Session Prep

| Step | Action | Location |
|------|--------|----------|
| 1 | App restores active campaign | `campaignService.ts:222-259` |
| 2 | Land on Setting view (always) | `App.tsx:58` — no view persistence |
| 3 | Navigate to Sessions | Sidebar click |
| 4 | Select planned session | `SessionLogDashboard.tsx:68-80` |
| 5 | Review 2-column prep workspace | `SessionLogEditor.tsx:493-570` |
| 6 | Link adventure, select scenes | `SessionLogEditor.tsx:498-533` |
| 7 | Navigate away to read scene content | No in-context preview |
| 8 | Return, click "Start Session" (confusion) | `SessionLogEditor.tsx:455` |
| 9 | Must find "Go Live" for actual runner | `SessionLogEditor.tsx:458-467` |

**Friction:** No view persistence on reload. Scene checklist is blind (title only, no description). "Start Session" vs "Go Live" ambiguity. AI prep notes button is a stub. No path to Prep Document from session editor.

**Score: 2/5** | **Archetype:** Occasional DM

---

### Journey 5: Idea → Entity (NPC Creation)

**Path A — Quick Generate:** 3 required actions (navigate, type, click). Smooth core loop but prompt is required (no random), no cancel during generation, generic error messages.

**Path B — Chat Generate:** 5+ actions. Better control but chat overlay hides NPC list, no "save now" escape, no keyboard shortcut to exit. AI quality locked at `'medium'` with no user lever.

| Dimension | Quick | Chat |
|-----------|-------|------|
| Steps | 3 | 5+ |
| Control | Low | High |
| Speed | Fast | Slow |
| Context of existing NPCs | Not surfaced | Not accessible |

**Score: 3.5/5 (Quick), 2.5/5 (Chat)** | **Archetype:** Improviser

---

### Journey 6: Entity → Edited Entity

**Save model is invisible and inconsistent.** Three different triggers on the same form:
- Text fields save on blur (`NpcEditor.tsx:40-44`)
- Faction select saves on change (`NpcEditor.tsx:50`)
- AI-assist saves immediately after generation (`NpcEditor.tsx:68`)

**Relationship fields have ghost state** — `handleRelationshipChange` updates only local state. If DM never blurs, data is lost on navigation.

No "back to list" button. No cross-entity navigation from relationship rows or faction dropdown.

**Score: 2/5** | **Archetype:** Worldbuilder

---

### Journey 7: Campaign → Adventure Planning

**Scene creation is hidden.** No "Add Scene" button anywhere in `AdventureEditor`. The scene-add button is a hover-reveal `+` icon on adventure rows in the sidebar (`CampaignSidebar.tsx:439`).

SceneGenerator initializes with empty NPC/location (hardcoded `undefined`, `[]`). DM must generate, then separately navigate and link. NPC checkbox list is flat and unsorted with no search.

**Score: 2/5** | **Archetype:** Narrative Planner

---

### Journey 8: Prep Mode → Live Session

**Two-button confusion.** "Start Session" (`SessionLogEditor.tsx:455`) sets `status: 'active'` but does NOT navigate. "Go Live" (`SessionLogEditor.tsx:458`) actually launches SessionRunner. After clicking "Start Session," the label changes to "Session Runner" — two names for the same action.

`campaignService.goLive` sets `status: 'active'` redundantly if "Start Session" was already clicked.

**Score: 2/5** | **Archetype:** New DM

---

### Journey 9: Mid-Session Need NPC → Improvised NPC

**Quick NPC panel** (SessionRunner sidebar) is purpose-built and fast: autoFocus input, Enter to generate, preview with Save/Regenerate/Edit.

**Key issue:** Campaign context sent to AI is only `campaign.title + campaign.setting` (`SessionRunner.tsx:222`). Active scene, location, and present NPCs are NOT included. Generated NPC may be tonally mismatched.

Auto-links to active scene if one exists — good. But silent failure if no active scene (NPC created but unattached, no feedback).

**Score: 3/5** | **Archetype:** Improviser

---

### Journey 10: Narrative Block → AI Assist (DM Coach)

Two entry points (header button + sidebar tool) — good redundancy. Opens as right-panel overlay. Three tools: Narrate, Improvise, Table.

**Issues:**
- `generateNpcDialogue` exists in service layer but no dialogue tab in UI
- Context awareness is shallow — `activeContext` is capped at 3 lines, contents opaque
- Tool switching clears all state
- Coach is ONLY accessible from session-runner view — not from combat tracker or other views

**Score: 2.5/5** | **Archetype:** Improviser

---

### Journey 11: Combat Start → Combat End

| Step | Action |
|------|--------|
| 1 | Click "Combat" in sidebar |
| 2 | Add combatants (Manual or Roster) |
| 3 | Set initiative values (all manual, roster adds at 0) |
| 4 | Sort Initiative |
| 5 | Advance turns via "Next Turn" |
| 6 | Track HP via ±1 or field override |
| 7 | No "End Combat" button in tracker |

**Critical issues:**
- AC never rendered despite existing in type definition
- HP ±1 steppers only (no damage delta input)
- Conditions are freeform text notes
- `prevTurn()` implemented but no UI button calls it
- No "End Combat" — only Reset (deletes all) or Session End Wizard (requires leaving combat view)
- Encounter not auto-saved to history outside session flow

**Score: 2/5** | **Archetype:** Tactical DM

---

### Journey 12: Mid-Session Question → Entity Lookup

**CRITICAL BUG:** Clicking entities in the sidebar while `activeView === 'session-runner'` produces NO visible change. `App.tsx:405` returns SessionRunner before reaching any entity editor branch. The `selectedNpcId` is silently set but never rendered.

The DM must leave the session-runner entirely (losing all session context) to view entity details.

Active scene panel shows NPC name/traits/motivations and location name/description only. No stats, no relationships, no backstory. NPC cards are plain `<div>` — not clickable.

**Score: 2/5** | **Archetype:** Reactive DM

---

### Journey 13: Session End → Session Log

**Session End Wizard** has 5 steps (recap → plots → loose-ends → player-recap → confirm). Well-structured but:
- AI recap is not auto-generated on mount — DM must click generate
- Skipping recap silently breaks player-recap step (empty with no standalone generate button)
- Wizard backdrop click dismisses entire wizard with no "are you sure?" guard
- **Duplicate `endSession()` call:** Wizard calls it, then App.tsx:359 calls it again
- Post-completion drops DM on session list, not the archived session

**Score: 2/5** | **Archetype:** Improviser

---

### Journey 14: Session End → Plot Update

**Two parallel status vocabularies:**
- `PlotSessionStatus` (advanced/stalled/unchanged) on `SessionLog`
- `PlotStatus` (active/resolved/dormant) on `Plot` entity

These NEVER synchronize automatically. Marking a plot "advanced" in the wizard does NOT update the Plot entity's `status` field. Resolving a plot requires manual navigation to PlotEditor.

In-session cycling only shows plots pre-linked to the session. Improvised plots are invisible.

**Score: 2/5** | **Archetype:** Narrative DM

---

### Journey 15: Session End → Next Session Prep

**No designed transition exists.** After the wizard completes:
1. DM lands on SessionLogDashboard
2. Must manually click "Plan New Session"
3. New session is fully blank — no title suggestion, no date default
4. Loose ends from completed session are NOT carried forward
5. No "End & Plan Next" option in the wizard

**Score: 2/5** | **Archetype:** Continuity DM

---

### Journey 16: Entity → Related Entities

**No cross-entity navigation exists anywhere in the codebase.** Despite App.tsx having a working `handleSelect(type, id)` routing function:
- NPC faction field is a `<select>` — no "Go to faction" button
- Relationship rows are `<select>` + text — no "Open NPC" button
- FactionEditor members list is inert text — no click handlers
- LocationEditor parent/connections are non-navigable selects
- NPC editor has no location field at all

**Score: 2/5** | **Archetype:** Session DM

---

### Journey 17: Campaign → Export

3-click flow: Header menu → ExportModal → choose format. Download triggers immediately.

**Issues:** Hidden entry (header menu only), no success/error feedback (modal closes instantly), no error handling in export functions, Obsidian export is single flat file (not per-entity vault).

**Score: 3/5** | **Archetype:** Record-Keeper

---

### Journey 18: Import → Usable Campaign

| Step | Action |
|------|--------|
| 1 | Find "Import" in header dropdown |
| 2 | OS file picker (`.json` only) |
| 3 | Minimal validation (id, title, npcs check) |
| 4 | Compatibility patches applied |
| 5 | `alert()` confirmation |
| 6 | Land on CampaignSelector — must click to open |

**Issues:** Import not auto-activated (extra click needed), generic error message on validation failure, `alert()` for feedback, no import from external formats.

**Score: 2/5** | **Archetype:** Returning DM

---

## Navigation Architecture Issues

### 1. Session Runner is a Navigation Prison
`App.tsx:405` — `if (activeView === 'session-runner' && activeCampaign.activeSessionId)` returns SessionRunner before any entity editor branch. This means ALL sidebar entity navigation is silently dead during live sessions.

**Fix:** Add an entity popover/drawer that renders OVER the session runner without replacing it.

### 2. Editors Are Navigation Dead Ends
No editor receives a navigation callback. The `handleSelect(type, id)` function in App.tsx is never passed as a prop to any editor or viewer component. Every cross-entity reference is a visual label with no interactivity.

**Fix:** Pass `onNavigate: (type: EntityType, id: string) => void` to all editors.

### 3. No View State Persistence
`activeView` defaults to `'setting'` on every page load (`App.tsx:58`). A DM mid-prep who refreshes must re-navigate. `selectedIds` are similarly lost.

**Fix:** Persist `activeView` and `selectedIds` to localStorage alongside `activeCampaignId`.

### 4. Dual-Path Session Activation
"Start Session" and "Go Live" are separate code paths that partially overlap. Both set `status: 'active'`, but only "Go Live" navigates to SessionRunner.

**Fix:** Merge into single "Launch Session" action that sets status AND navigates.

### 5. Post-Action Navigation Gaps
After entity creation, session end, import, export, and batch generation — the user is dropped at a list view with no guidance. No success toast, no "next action" suggestion, no deep-link to the result.

**Fix:** Add contextual next-action prompts after every major operation.

---

## Recommended Journey Improvements (Priority-Ranked)

### Tier 1 — Critical (fixes multiple journeys)

1. **Wire cross-entity navigation to all editors** — Pass `onNavigate` callback from App.tsx. Affects journeys 6, 7, 10, 12, 16.
2. **Add entity popover/drawer to Session Runner** — Clicking entity in sidebar/scene renders overlay without leaving session. Affects journeys 9, 10, 12.
3. **Merge "Start Session" / "Go Live" into single action** — Affects journeys 4, 8.
4. **Persist `activeView` to localStorage** — Affects journey 4.
5. **Add session-to-session loose ends carry-forward** — Affects journeys 13, 14, 15.

### Tier 2 — High Impact

6. **Add post-action navigation prompts** (after generation, import, export, session end)
7. **Add "Quick Note" global hotkey** accessible from any view
8. **Include active scene context in Quick NPC AI prompt** (journey 9)
9. **Auto-generate AI recap on Session End Wizard mount** (journey 13)
10. **Remove duplicate `endSession()` call in App.tsx** (journey 13)

### Tier 3 — Quality of Life

11. **Add "Create Another" button after entity generation**
12. **Add scene management inside AdventureEditor** (journey 7)
13. **Replace all `window.confirm()` / `alert()` with styled modals**
14. **Add success toast after export/import**
15. **Explain sample campaign on cold start with dismiss/create CTA**
