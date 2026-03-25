# Session & Gameplay — UX Audit Report

**Date:** 2026-03-24
**Auditor:** GSD UI Auditor (Claude Sonnet 4.6)
**Baseline:** Abstract UX standards + `docs/design/dm-archetypes.md` + `docs/design/session-cockpit-review.md`
**Screenshots:** Captured (dev server at localhost:3000) — landing state is Campaign Setting view; SessionRunner requires an active live session to render, so screenshots reflect the app shell, not the session cockpit.
**Scope:** `SessionRunner.tsx` (1,389 lines), `DmCoach.tsx` (760 lines), `CombatTracker.tsx` (347 lines), `DiceRoller.tsx` (275 lines), `SecretsTracker.tsx` (475 lines) — 3,246 lines total

---

## Summary

The Session & Gameplay section is architecturally ambitious and feature-rich, delivering a 3-column session cockpit with real-time tools, AI assistance, secrets tracking, plot management, and voice capture. The implementation substantially exceeds what was present at Phase A baseline. However, the primary component (`SessionRunner.tsx`) has grown to 1,389 lines with 22 `useState` hooks and 22 other hooks, making it a decomposition risk. The design system is coherent but has a slate/stone color split that leaks into the DmCoach prompt chip area and the "Previously..." recap banner. The most significant UX gaps — identified by the cockpit review's own Priority Matrix — are that three P0 items (UNI-1, UNI-2, UNI-3) have partial implementations but not fully resolved: plot status IS now persisted, Quick NPC now has a preview step, but DM Coach output does not auto-log to the running log timeline.

---

## Scored Dimensions

| Dimension | Score | Justification |
|-----------|-------|---------------|
| Visual Consistency | 7/10 | Dark fantasy theme is cohesive; amber/slate palette applied correctly across all 5 components. Two stone-color leaks (DmCoach prompt chips `bg-stone-700`, SessionRunner recap banner `bg-stone-800/40`) break the otherwise all-slate session surface. DmCoach uses `bg-slate-900` while SessionRunner uses `bg-slate-950` as its base — a one-shade split that creates subtle seam artifacts at the panel boundary. |
| Interaction Quality | 6/10 | Session flow is logical. Combat Tracker auto-population from scene NPCs is excellent UX. The `window.confirm()` call in `CombatTracker.tsx:93` is a platform-native blocking dialog that violates the dark theme and feels out of place. The SecretsTracker panel is constrained by a `style={{ maxHeight: '400px' }}` inline override (`SessionRunner.tsx:1081`) instead of Tailwind, which will break on short viewports. DM Coach output not flowing into the running log is the single most impactful interaction gap. |
| Information Architecture | 6/10 | 3-column layout is structurally sound for power users. Left column (scenes + beats) is 224px — tight but workable. Right column (tools) is 256px — at capacity once dice roller and secrets panel are both expanded simultaneously. The running log is fixed at `h-44 md:h-56` (176px/224px), which limits visibility to roughly 6-8 entries before scrolling; a DM mid-session needs more visual breathing room. Plot status cycling via click is non-obvious: affordance text ("click to change") is invisible until hover (`opacity-0 group-hover:opacity-100`), which is a discoverability failure. |
| Component Quality | 5/10 | SessionRunner at 1,389 lines with a single exported component and no internal sub-component splits is the headline quality issue. It holds 22 `useState` calls across unrelated domains: note input, combat panel visibility, NPC generation lifecycle, skill check roll results, speech recognition, beat input, mobile tabs, and FAB state. This violates single-responsibility. The other four components (DmCoach at 760 lines, SecretsTracker at 475 lines, CombatTracker at 347 lines, DiceRoller at 275 lines) are bounded and appropriate. |
| Scalability | 5/10 | Combat tracker at 500px fixed width (`w-[500px]`) cannot accommodate 12+ combatants without a full-screen mode — the Tactical DM archetype's critical gap. The secrets panel has a hard `maxHeight: 400px` inline style that will fight responsive layout. The right column has no overflow strategy when both dice roller and secrets panel are expanded — they stack and require scrolling the entire column. The architecture supports additional tools (FAB menu, QuickTools buttons) but the layout will degrade past the current tool count. |

**Overall: 29/50**

---

## Top 3 Priority Fixes

1. **DM Coach output never reaches the running log** — affects all four archetypes that use the coach mid-session (Worldbuilder, Lazy DM, New DM, Forever DM); generated narration and improv suggestions disappear when the panel closes — **fix: in `SessionRunner.tsx`, pass an `onLogCoachOutput` callback into `DmCoach` that calls `campaignService.addAutoEvent('coach-used', ...)` when a result is generated; this is a 2-hour effort (S) and resolves UNI-2, the highest cross-archetype P0 gap in the Priority Matrix**

2. **SessionRunner.tsx decomposition** — 1,389 lines with 22 `useState` calls is a maintenance and onboarding hazard; any new feature must thread through the entire component to access shared state — **fix: extract `<SceneListPanel>`, `<ActiveScenePanel>`, `<QuickToolsPanel>`, `<RunningLog>`, and `<QuickNpcGenerator>` as separate components in `components/views/session/`; each gets the slice of props it needs; parent holds only coordinator state (which panel is open, mobile tab); estimated effort L but the codebase has a clear seam at each JSX block**

3. **No session timer in the cockpit header** — three archetypes (New DM, Tactical DM, Forever DM) identify this as critical; a Forever DM running two campaigns in one day needs hard time awareness; the feature is completely absent — **fix: add `sessionStartTime: string | null` to `SessionLog` state, set it when "Go Live" triggers the session runner, display `HH:MM elapsed` in the header row alongside the session title; M effort, resolves UNI-4**

---

## Detailed Findings

### Visual Consistency (7/10)

**Stone/slate color split — DmCoach prompt chips**
- `DmCoach.tsx:389`: Suggestion chip buttons use `bg-stone-700 text-stone-300 hover:bg-stone-600 hover:text-stone-100`. All surrounding surfaces in both the DmCoach panel (`bg-slate-900`) and SessionRunner (`bg-slate-950/bg-slate-900`) use the `slate` palette. Stone and slate render as visually similar warm-vs-neutral grays, but the chips sit noticeably warmer against the slate background. Change to `bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-slate-100`.

**Stone/slate split — recap banner**
- `SessionRunner.tsx:682`: "Previously..." recap banner uses `bg-stone-800/40 border border-stone-700/40`. This is the only stone surface in SessionRunner's JSX. Change to `bg-slate-800/40 border border-slate-700/40`.

**Background shade discontinuity at DmCoach/SessionRunner boundary**
- DmCoach root: `bg-slate-900/80 backdrop-blur-md` (`DmCoach.tsx:272`). SessionRunner right column: `bg-slate-900` (`SessionRunner.tsx:891`). The coach panel slides over the top of the right column; the backdrop blur creates a visible seam where slate-900 and slate-900/80 overlap. Consider making the coach panel use `bg-slate-950/90` to read as distinctly layered above the session surface.

**Indigo accent used for DM Coach, amber for everything else**
- The DM Coach consistently uses `indigo` as its accent (header icon `text-indigo-400`, active tool button `bg-indigo-600`, focus rings `focus:ring-indigo-500`). The rest of the session surface uses amber. This two-accent split is intentional (differentiating AI-mode surfaces) and works well — the cognitive distinction between "AI assistant surface" (indigo) and "session content surface" (amber) is clear and consistent.

**Text-[10px] usage throughout**
- 15+ uses of `text-[10px]` across the 5 components for micro-labels (faction badges, relationship chips, type indicators, combat tracker labels). While below the Tailwind scale minimum (`text-xs` = 12px), this is deliberate for high-density information surfaces. No accessibility critical issue at 14in monitor distance, but warrants monitoring on mobile. At 375px viewport, `text-[10px]` badge text on faction chips in the NPC cards would be at the border of legibility.

---

### Interaction Quality (6/10)

**CRITICAL — DM Coach output never auto-logs to running log**
- `DmCoach.tsx` has an `onSendToNotes` prop that allows the DM to manually click "Send to Notes" on a result. But this is a deliberate action, not automatic. The cockpit review's UNI-2 (Priority Matrix P0) requires Coach outputs to appear in the running log automatically within 1 second of generation completing. Currently: Coach generates → result shows in panel → DM closes panel → result is gone. The `onSendToNotes` callback exists in the prop interface (`DmCoach.tsx:75`) but is only triggered by user action.
- **Fix:** Add an `onResultGenerated?: (content: string, type: 'coach-used') => void` callback to DmCoachProps. Call it in `handleGenerate` after `setResult(resultData)` (`DmCoach.tsx:157`) and in `handleRoleplaySend` after the NPC response (`DmCoach.tsx:235`). In SessionRunner, wire this to `campaignService.addAutoEvent('coach-used', content)`.
- **Effort:** S

**HIGH — `window.confirm()` for combat clear**
- `CombatTracker.tsx:93`: `if(window.confirm("Clear all combatants and reset rounds?"))` blocks the thread, shows a browser-native dialog that ignores the app theme, and on mobile often fires by accident. The SecretsTracker already implements a correct alternative: the two-step "Sure?" button pattern (`SecretsTracker.tsx:97-104`). Apply the same pattern to the CombatTracker reset button.
- **Effort:** S

**HIGH — Plot status cycle affordance is invisible**
- `SessionRunner.tsx:1112`: The "click to change" hint text uses `opacity-0 group-hover:opacity-100`. On a touchscreen, hover states don't fire; the affordance never appears. The action (click a plot to cycle its status) has no visible indication that plots are interactive until hover. Add a small cycle icon or a persistent `text-[10px] text-slate-600 uppercase` label "click to cycle" below the status badge. On touch, all group-hover patterns should have a visible fallback.
- **Effort:** S

**MEDIUM — SecretsTracker panel height via inline style**
- `SessionRunner.tsx:1081`: `style={{ maxHeight: '400px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}` — inline styles in a Tailwind CDN project create specificity conflicts and are invisible in IDE Tailwind tooling. This also means the secrets panel height is a magic number that doesn't respond to viewport height. On a 768px tall display (laptop), the secrets panel consumes more than half the viewport height of the right column, displacing the plots section off-screen.
- **Fix:** Replace with Tailwind classes: `max-h-[400px] overflow-hidden flex flex-col`. Long-term, consider making this height dynamic with a percentage (`max-h-[40vh]`).
- **Effort:** S

**MEDIUM — Running log fixed height too small**
- `SessionRunner.tsx:1134`: `h-44 md:h-56` (176px / 224px). At `text-sm` with `py-0.5`, each log entry is approximately 28px tall. This means the DM can see roughly 6-8 entries before scrolling mid-session. The log is meant to be the "single timeline of truth" — it should be resizable or larger by default, especially on desktop.
- **Fix:** Consider `h-48 md:h-64 lg:h-72` or add a drag-to-resize handle. Alternatively, allow the DM to toggle the log to a fullscreen overlay. At minimum, bump `md:h-56` to `md:h-72`.
- **Effort:** S

**MEDIUM — Voice capture (mic button) hidden behind conditional**
- `SessionRunner.tsx:1234`: `{hasSpeechRecognition && ...}` — the mic button only renders if `window.SpeechRecognition` or `window.webkitSpeechRecognition` is detected. On Firefox and Safari iOS, this is not available. The button silently disappears. This is acceptable behavior but there is no fallback message and no indication to the DM that the feature is unavailable on their browser. Add a disabled/grayed mic button with a tooltip "Voice capture requires Chrome or Edge" when the API is not detected.
- **Effort:** S

**LOW — DM Coach "Low-Latency" toggle label is opaque**
- `DmCoach.tsx:281`: The `useLiteModel` toggle is labeled "Low-Latency" when active. Most DMs will not understand what "Low-Latency" means without context. The underlying tradeoff is speed vs. quality. Rename to "Fast (less detailed)" / "Full quality" or provide a tooltip: "Uses a smaller AI model for faster responses — results may be less detailed."
- **Effort:** XS

---

### Information Architecture (6/10)

**HIGH — No session timer**
- SessionRunner header (`SessionRunner.tsx:477-503`) contains: Live dot, session title, adventure title, DM Coach button, End Session button. No elapsed time. Three archetypes rate this as medium-to-critical. A session timer is a zero-complexity addition that would be referred to constantly by the DM.
- **Fix:** Store `startedAt: string` on the session log when "Go Live" is triggered. In SessionRunner, derive elapsed time with `useEffect` + `setInterval(1000)` and display as `HH:MM` in the header. Persist the start time so it survives page refresh.
- **Effort:** S

**MEDIUM — Empty state when no adventure is linked is unhelpful**
- `SessionRunner.tsx:880-886`: When there is no active scene, the center panel shows "No active scene. Select a scene from the list or advance." with a faint Adventures icon. But if no adventure is linked to the session at all (`sessionLog.adventureId` is null), the scene list on the left says "No scenes planned" and the center panel is blank. For a Lazy DM running an impromptu session, this reads as failure rather than flexibility.
- **Fix:** When no adventure is linked, replace the empty state with a "Free Session" mode: a larger note-taking surface, the "Beats" section promoted to center column, and a clear headline like "Running a free session — use beats and notes to track what happens."
- **Effort:** M

**MEDIUM — Right-column tool overflow with no strategy**
- The quick tools right column (`w-full md:w-64`) presents: DM Coach button, Combat Tracker button (conditional), Dice Roller toggle + inline content, Quick NPC toggle + inline form, Secrets & Clues toggle + 400px panel, Active Plots section, Prep Notes section. If all expandable tools are open simultaneously, the column overflows its container with no overflow strategy. The column has `overflow-y-auto` on the outer wrapper, but the SecretsTracker is rendered inside a height-constrained `div` that uses inline `overflow: hidden`, creating a conflicting clip. The plots section can be scrolled past but the panel ordering means plots and prep notes are frequently below the viewport.
- **Fix:** Consider making the right column a proper panel with a top-level vertical tab strip (DM Coach, Combat, Dice, NPC, Secrets, Plots) that shows one tool at a time, rather than stacking all expanded tools simultaneously.
- **Effort:** M-L

**LOW — "Add a beat..." input is visually subordinate**
- `SessionRunner.tsx:652-669`: The beats section input is at the very bottom of the left column. On a 900px tall viewport, with scenes listed above and "Last Session" recap above that, the beats input may be below the fold in the left column. Beats are the Lazy DM's primary prep artifact and should be more prominent.
- **Effort:** S

**LOW — Scenes that have no planned adventure show a misleading empty list**
- When `plannedScenes.length === 0` (`SessionRunner.tsx:598-600`), the left column shows "No scenes planned" in italic. There is no prompt to link an adventure or create scenes. A new DM may interpret this as a broken state. Add an action: "Link an adventure to see scenes here" or "This is a free session — use beats below."
- **Effort:** XS

---

### Component Quality (5/10)

**CRITICAL — SessionRunner.tsx is a monolith**

At 1,389 lines, `SessionRunner.tsx` is a single exported component (`SessionRunner`, line 75) with no internal sub-component definitions exported from the file. It has 22 `useState` calls managing six independent concerns:

| Concern | State Variables |
|---------|----------------|
| Note input | `noteInput`, `noteTags`, `noteMentionedEntityIds`, `showImportantOnly` |
| Combat panel | `showCombatPanel`, `showEndWizard` |
| Dice roller | `showDiceRoller` |
| Quick NPC lifecycle | `showQuickNpc`, `npcPrompt`, `npcGenerating`, `npcError`, `npcPreview`, `npcEditMode`, `npcEditData` |
| Skill check rolls | `skillCheckRolls` |
| Voice capture | `isRecording` |
| Session recap | `showRecap` |
| Beats input | `beatInput` |
| Mobile layout | `mobileTab`, `fabOpen` |
| Secrets panel | `showSecrets` |

These concerns do not share state — `npcPreview` has no relationship to `showCombatPanel`. The only reason they are co-located is that the component renders them in adjacent JSX regions. Each concern would be cleanly extractable:

- `<SceneListPanel scenes npcs locations activeSceneId onSelectScene onAdvance>` — left column
- `<ActiveScenePanel scene npcs locations skillChecks onSkillRoll onNavigate>` — center column
- `<QuickNpcGenerator isMockMode campaign onNpcSaved>` — right column widget
- `<RunningLog notes sessionLog onAddNote onToggleMic>` — bottom panel
- `<SessionFab onOpenCoach onOpenCombat onOpenDice>` — mobile FAB

The `useMemo` derivations (scene lists, NPC maps, relationship maps, plot statuses) would move into their respective sub-components, eliminating the large upfront computation block.

**The component is currently functional and not broken.** But adding the next feature (session timer, panic button, search, etc.) requires understanding the full 1,389-line surface. Each PR touching SessionRunner risks introducing state interaction bugs.

**DmCoach.tsx is at a viable boundary (760 lines)**

DmCoach contains one exported component and three sub-components (`RoleplayPanel`, `TextResultDisplay`, `RollableTableDisplay`). The sub-component split is well-chosen: each handles a distinct display format. The `ToolButton` and `ActiveToolIcon` mini-components at the bottom are appropriate extractions. No decomposition required.

**CombatTracker.tsx has a good internal split (347 lines)**

The `AddCombatantMenu` sub-component is correctly extracted. The main `CombatTracker` component handles encounter state, and the menu handles form state. The HP duplicate regex (`npc.stats?.match(...)` at `CombatTracker.tsx:328`) duplicates logic from `SessionRunner.tsx:30-33` (`parseHpFromStats`). Extract the HP parser into `utils/combatUtils.ts` and share it.

**SecretsTracker.tsx is clean (475 lines)**

`SecretCard` and `AddSecretForm` are properly extracted. Category configuration is defined as a constant record outside the component, avoiding re-computation. The `campaignService` is called directly (not via props), which is consistent with the project pattern. No issues.

**DiceRoller.tsx is clean (275 lines)**

The component is bounded and focused. Formula parsing is delegated to `utils/diceUtils.ts`. Roll history is capped at 20 entries to prevent memory growth. The only note: the `handleLogRoll` function silently does nothing when `onLogRoll` is not provided — this is intentional fallback behavior and is fine, but could benefit from a title attribute on the history items that explains the click action only when the prop is present.

---

### Scalability (5/10)

**Combat tracker is not scalable to Tactical DM use**

The combat tracker slide-out panel at `w-[500px]` (`SessionRunner.tsx:1349`) was identified in the cockpit review (Archetype 4) as too narrow for complex encounters. At 500px with a 12-column grid, each combatant row is barely readable. For 10+ combatants, the DM must scroll the panel. There is no full-screen mode. The `CombatTracker` component itself is clean and stateless — adding a full-screen variant would require only a wrapper change in SessionRunner plus a toggle button.

No condition tracking is implemented. The `Combatant` type's `notes` field is being used as a workaround (`notes: npc.traits || ''` at `SessionRunner.tsx:258`). Adding conditions requires a type change and UI additions, but the architecture does not preclude it.

**Right column tool stack has no capacity budget**

The right column currently renders 5 tool buttons + up to 3 expanded inline panels + plots + prep notes. The `SecretsTracker` panel is the most space-hungry at 400px max-height. If Beats were promoted to the right column (a reasonable future option), or if a "Quick Items" or "Random Encounter" tool were added, the column would be at capacity. The current stacking model does not scale beyond the current feature set.

**SessionRunner architecture cannot absorb P1/P2 features without decomposition**

The cockpit review identifies the following P1 features as unimplemented: session timer (UNI-4), running log full-text search (UNI-7), dice rolls integrated into running log timeline (UNI-8). Each of these would add more `useState` calls and more JSX to an already saturated component. Before implementing P1 features, the decomposition work is prerequisite — otherwise each addition increases the cognitive cost of future changes exponentially.

**No keyboard shortcuts for session actions**

The cockpit review identifies `CTQ-2.1` as "time from thought to captured note must be under 3 seconds." Currently the note input requires a mouse click to focus. There is no `/` shortcut or global keyboard focus binding for the note input. Adding keyboard shortcuts to a monolithic component is possible but harder to reason about than in a decomposed component where the `RunningLog` component owns its own `useEffect` for `document.addEventListener('keydown', ...)`.

---

## Design Doc Gap Analysis

The `session-cockpit-review.md` defines a Priority Matrix with P0 and P1 items. Status against current implementation:

### P0 Items (must be resolved before P1 work)

| ID | Story | Status |
|----|-------|--------|
| UNI-1 | Plot status persists to campaign data | RESOLVED — `campaignService.updatePlotProgression()` is called in `SessionRunner.tsx:368`. Plot status is written through the service layer and will survive refresh. |
| UNI-2 | DM Coach output auto-logs to running log | PARTIAL — `onSendToNotes` prop exists; user must click "Send to Notes" manually. No automatic logging on generation. CTQ-2.3 ("within 1 second of generation completing") is not met. |
| UNI-3 | Quick NPC has preview/edit step before save | RESOLVED — `npcPreview` state, edit mode, and discard path are all implemented (`SessionRunner.tsx:992-1071`). CTQ satisfaction: preview shows name, traits, description, quote — meets CTQ-1.6 threshold. |

### P1 Items (high priority cross-archetype)

| ID | Story | Status |
|----|-------|--------|
| UNI-4 | Session timer in header | NOT IMPLEMENTED |
| UNI-5 | Voice capture available in Session Runner | RESOLVED — mic button is present in the running log input area (`SessionRunner.tsx:1234`). Uses `window.SpeechRecognition`. No fallback for unsupported browsers. |
| UNI-6 | Post-session in session end flow | RESOLVED — `SessionEndWizard` is invoked from `handleEndSession()` (`SessionRunner.tsx:241-243`). Wizard dialog handles recap and loose ends inline. |
| UNI-7 | Running log full-text search | NOT IMPLEMENTED |
| UNI-8 | Dice rolls integrated into running log timeline | PARTIAL — `onLogRoll={(roll) => campaignService.addDiceRollToSession(roll)}` is wired (`SessionRunner.tsx:925`), and `ENTRY_TYPE_STYLES` includes a `dice-roll` entry. Dice rolls can be manually logged via "Log to Session" button in DiceRoller. But they are not automatically interleaved — the DM must click "Log to Session" explicitly. |
| UNI-9 | Entity popovers/quick cards | PARTIAL — `EntityLink` and `LinkedText` are wired in scene content (read-aloud text, GM notes, NPC names, faction names). However, these navigate to the entity editor, not a popover. CTQ-1.1 ("popover within 200ms displaying backstory, relationships, faction") is not met. |
| US-1.5 / UNI | Secrets & Clues tracker | RESOLVED — `SecretsTracker` component is implemented, wired to the right panel with a toggle button, and supports reveal/unrevealed status with session-of-reveal metadata. The `Secret` type supports 4 categories. CTQ-1.7 (50+ entries) is architecturally supported. |
| US-2.1 | Bullet-point/beats sessions (no adventure required) | PARTIAL — "Beats" section exists in the left column. Session runner works without a linked adventure. But the empty center panel when no adventure is linked reads as failure, not flexibility. CTQ-2.2 ("no empty states that imply failure") is not met. |
| US-3.5 | Coach template prompts (5+ suggestions per tool) | RESOLVED — `TEMPLATE_PROMPTS` in `DmCoach.tsx:22-44` provides 5 prompts per tool (narrate, improvise, table). Context tokens resolve `[location]` and `[NPC]` placeholders from the active scene context. |
| US-4.1 | Condition tracking in CombatTracker | NOT IMPLEMENTED — only freeform `notes` field |
| US-4.8 | Auto-populate HP from entity data | PARTIAL — `parseHpFromStats()` in `SessionRunner.tsx:29-34` attempts to parse HP from NPC stats strings. Falls back to HP: 10 for NPCs and `estimatePcHp()` for PCs. Does not read from a structured HP field; depends on free-text parsing. |

### Untracked Gaps Observed in Code Audit

**DM Coach context is still not "deep"** (CTQ-1.4): `DmCoach.tsx:144-153` uses `buildCampaignContext()` with a `3200` token budget for the `'coach'` variant. The active context string is appended. This is better than "just campaign title + setting," but CTQ-1.4 requires "full NPC profiles, location description, and active plot summaries." The `buildCampaignContext` call's actual content depends on the implementation of `contextBuilder.ts`, which is outside this audit's scope — but the cap of 3,200 tokens means rich campaigns will hit the budget and truncate.

**No running log search** (UNI-7): Filtering exists for `showImportantOnly` (`SessionRunner.tsx:221-225`) but there is no text search input or indexing. With 50+ notes after a long session, finding an improvised detail from earlier in the session is impossible without scrolling.

**No session timer** (UNI-4): Completely absent. The header has capacity (it is not overloaded).

---

## Patterns and Themes

**Theme 1: Feature completeness is high; integration depth is shallow**

The individual features (dice roller, secrets tracker, combat tracker, NPC generator, DM Coach) are each well-built in isolation. The gaps are almost entirely in the integration layer: Coach output does not flow to the log, dice rolls require a manual log click, entity links navigate away rather than showing popovers. The architecture supports these integrations (callbacks and service methods exist), but the wires have not been connected.

**Theme 2: The Lazy DM is the most underserved archetype**

The cockpit review identifies the Lazy DM as needing the cockpit to "replace their single text file." Currently, running a session without a linked adventure renders the center column empty. Beats exist but are a left-column afterthought. The free-session mode needs a first-class implementation. Every other feature (scenes, read-aloud, GM notes, skill checks) is optimized for the Prep-Heavy Worldbuilder archetype who has structured all content in advance.

**Theme 3: The component architecture needs to precede, not follow, P1 feature work**

Each planned P1 feature (session timer, log search, entity popovers, dice-to-log auto-integration) will add `useState` calls and JSX blocks to `SessionRunner.tsx`. At 1,389 lines the component is at the practical limit of single-file readability. Implementing P1 features first and decomposing second is the wrong order — decompose first, then implement features with confidence.

**Theme 4: Mobile responsiveness is thoughtful but incomplete**

The mobile tab bar (Scenes / Active / Tools), min-h-[44px] touch targets throughout, and the FAB with tool shortcuts are genuinely good mobile adaptations. However, the `text-[10px]` badge text will be at the limit of legibility on 375px screens, and the running log is hidden on Scenes and Tools tabs (`mobileTab === 'tools' || mobileTab === 'scenes' ? "hidden md:flex" : "flex"`), which means a mobile DM on the Scenes tab who wants to quickly add a note must tab-switch, which interrupts their flow.

---

## Screenshots

Screenshots captured at `docs/ux-audit/screenshots/session-gameplay/`:
- `desktop.png` (1440x900) — app landing state showing Campaign Setting view
- `mobile.png` (375x812) — mobile rendering of Campaign Setting view
- `tablet.png` (768x1024) — tablet rendering of Campaign Setting view

Note: The Session Runner view requires an active live session. Screenshots capture the general app shell and visual design system. A functional audit of the session cockpit required code review of the 5 component files.

---

## Files Audited

| File | Lines | Notes |
|------|-------|-------|
| `components/views/SessionRunner.tsx` | 1,389 | Primary focus — monolith risk |
| `components/dialogs/DmCoach.tsx` | 760 | Well-structured; 3 sub-components |
| `components/tools/CombatTracker.tsx` | 347 | Clean; `window.confirm()` issue |
| `components/tools/DiceRoller.tsx` | 275 | Clean and focused |
| `components/tools/SecretsTracker.tsx` | 475 | Clean; inline style leak in parent |
| `docs/design/dm-archetypes.md` | — | Design reference |
| `docs/design/session-cockpit-review.md` | — | User stories and gap analysis reference |
