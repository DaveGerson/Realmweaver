# Wizards & Dialogs — UX Audit Report

**Audited:** 2026-03-24
**Scope:** components/dialogs/ — 7 files, ~3684 combined lines
**Screenshots:** Captured (desktop 1440x900, dev server on localhost:3000)
**Baseline:** Abstract UX standards (no UI-SPEC.md found)

---

## Summary

The wizard and dialog set is genuinely strong in content design and functional depth. The Session Prep and Session End wizards share a near-identical step-indicator pattern and are the clearest examples of consistent implementation. However, consistency breaks down in four important ways: modal containment strategies diverge (`fixed inset-0` vs. `absolute inset-0`), the accent color palette splits between amber and indigo with no clear semantic rule, the `ContinuityChecker` uses a completely different color token family (`stone-*` vs. `slate-*`), and no dialog implements proper keyboard focus trapping, which is a WCAG 2.1 failure for modal dialogs.

---

## Scored Dimensions

- **Visual Consistency: 6/10** — SessionPrepWizard and SessionEndWizard look like a matched pair; EvocationWizard and ExportModal feel slightly more polished (rounded-2xl vs rounded-xl); ContinuityChecker uses `stone-*` tokens while every other dialog uses `slate-*`, producing a visibly warmer gray that is noticeable in direct comparison.
- **Interaction Quality: 7/10** — Multi-step navigation is smooth where it exists; loading states are covered in all AI-generating dialogs; the step-indicator bar in SessionPrepWizard allows free non-linear jumping which can leave the user in an inconsistent state (scenes step navigable before adventure is selected). DmCoach has no back/close affordance on mobile width.
- **Information Architecture: 8/10** — Step order is logical in all three step-based wizards; WorldSimulationWizard's linear setup→loading→review→applied flow is the clearest of the group; DmCoach's four-tool tab structure is appropriate for an always-open panel. The ExportModal's two-choice grid is optimally simple. Minor issue: SessionEndWizard's recap step does not auto-trigger AI generation on open, requiring the user to discover the "Generate AI Recap" button on a mostly empty screen.
- **Component Quality: 5/10** — SessionPrepWizard and SessionEndWizard copy identical step-indicator JSX (45+ lines each). EvocationWizard contains all four mode view subcomponents in-file with untyped props. `isMockMode` is declared in SessionPrepWizard's interface but never used in the component body. Two `@ts-ignore` comments and one `eslint-disable` comment suppress type errors in EvocationWizard rather than being properly resolved.
- **Scalability: 4/10** — No shared `Wizard`, `WizardStep`, or `StepIndicator` primitive exists. Each step-based wizard re-implements step state, `goNext`/`goPrev` logic, and the step indicator bar independently. Adding a sixth step to any wizard, or creating a new wizard, requires copying ~100 lines of boilerplate and risk divergence.

---

## Issues

### Issue 1 — No keyboard focus trap in any modal dialog
- **Severity:** Critical
- **Location:** All files — SessionPrepWizard.tsx:299, SessionEndWizard.tsx:172, WorldSimulationWizard.tsx:147, EvocationWizard.tsx:273, ExportModal.tsx:14
- **Description:** None of the dialog components implement focus trapping. When a modal opens, keyboard Tab navigation escapes into the obscured background DOM, which is both a WCAG 2.1 Level AA failure (Success Criterion 2.1.2 — No Keyboard Trap; paradoxically, not trapping focus violates the spirit of modal accessibility) and an accessibility failure for screen reader users who expect focus to be confined to the active dialog. Only ContinuityChecker.tsx handles `Escape` key dismissal; the other six do not.
- **Suggested Fix:** Install a lightweight focus-trap library (e.g., `focus-trap-react`) or implement a shared `DialogShell` wrapper component with `useEffect`-based focus trap that captures all Tab/Shift+Tab events and cycles within the dialog's focusable elements. Also add `onKeyDown` Escape handling to SessionPrepWizard, SessionEndWizard, WorldSimulationWizard, EvocationWizard, and ExportModal.
- **Effort:** M

---

### Issue 2 — Step indicator pattern duplicated verbatim; no shared primitive
- **Severity:** High
- **Location:** SessionPrepWizard.tsx:320–345, SessionEndWizard.tsx:189–210
- **Description:** Both wizards contain virtually identical JSX for the clickable step indicator bar (approximately 25 lines each), including the same `twMerge` logic, the same `Icons.CheckCircle` green tick for completed steps, and the same `Icons.ChevronDown` separator rotated -90 degrees. Any future change to the step indicator style (e.g., adding a step number, changing the active color) must be made in two places and risks drift. No `StepIndicator` or `WizardStep` component exists in `components/common/`.
- **Suggested Fix:** Extract a `<StepIndicator steps={steps} currentStep={currentStep} onStepClick={setStep} />` component to `components/common/StepIndicator.tsx`. Each step entry can carry `{ id, label, isComplete }`. Both wizards replace their current indicator JSX with this component. WorldSimulationWizard's inline header-based status hint could also be aligned to this primitive.
- **Effort:** M

---

### Issue 3 — ContinuityChecker uses `stone-*` tokens; all other dialogs use `slate-*`
- **Severity:** High
- **Location:** ContinuityChecker.tsx:216, 219, 253, 267–271, 326–334
- **Description:** `ContinuityChecker` is built on `bg-stone-900`, `border-stone-700`, `text-stone-100/300/400/500`, and `hover:bg-stone-700/800` throughout. Every other dialog in this directory uses `slate-*` equivalents. Stone-900 is `#1c1917` (warm brownish) vs. slate-900 `#0f172a` (cool blue-gray) — a visible hue difference. When ContinuityChecker opens over the rest of the app, its panel will have a perceptibly warmer background than the content beneath it, and if it ever sits adjacent to another panel, the mismatch is immediately obvious.
- **Suggested Fix:** Replace all `stone-*` tokens in ContinuityChecker.tsx with their `slate-*` equivalents (`stone-900` → `slate-900`, `stone-700` → `slate-700`, `stone-100` → `slate-100`, etc.). The functional color uses (amber, red, sky, green) for severity levels are fine and should be kept.
- **Effort:** S

---

### Issue 4 — `isMockMode` prop accepted but never used in SessionPrepWizard
- **Severity:** Medium
- **Location:** SessionPrepWizard.tsx:24–31
- **Description:** The `SessionPrepWizardProps` interface declares `isMockMode: boolean` at line 24, but the destructured props at line 27–31 do not include it (the component body contains zero references to `isMockMode`). The wizard creates a session log and calls `campaignService.goLive()` — no AI generation happens inside it — so no mock mode switching is needed. However, the dead prop in the interface creates a false contract: callers must pass this prop, TypeScript enforces it, and future developers may be confused about its purpose.
- **Suggested Fix:** Remove `isMockMode: boolean` from `SessionPrepWizardProps` at line 24 and verify the calling site in `App.tsx` no longer passes it. If mock mode will be needed in a future AI-assisted "prep notes generation" feature, add it back with a comment explaining the intent.
- **Effort:** S

---

### Issue 5 — No loading state on the WorldSimulationWizard footer button; double-submit possible
- **Severity:** Medium
- **Location:** WorldSimulationWizard.tsx:389–396
- **Description:** The "Simulate World" button at line 392 sets `disabled={false}` unconditionally. The component transitions `step` to `'loading'` on click, which unmounts the button from the DOM — but this relies on a render cycle completing before a second click could fire. On a slow machine or with React concurrent mode, there is a window where multiple `generateWorldEvents` calls could be dispatched. More importantly, `disabled={false}` is explicitly hardcoded rather than derived from state, which is semantically confusing and fragile.
- **Suggested Fix:** Change `disabled={false}` to `disabled={step !== 'setup'}` or introduce a local `isSubmitting` state set to true before the async call and false if an error returns the step to 'setup'. This makes intent explicit and closes the double-submit window.
- **Effort:** S

---

### Issue 6 — EvocationWizard modal positioning (`absolute` vs. `fixed`) breaks when parent is not full-viewport
- **Severity:** Medium
- **Location:** EvocationWizard.tsx:273, ExportModal.tsx:14
- **Description:** Both EvocationWizard and ExportModal use `absolute inset-0` for their overlay, whereas SessionPrepWizard, SessionEndWizard, WorldSimulationWizard, and ContinuityChecker use `fixed inset-0`. `absolute` positioning means the overlay only covers the nearest positioned ancestor element. If the parent container is not the full viewport (e.g., it is a scrolled content pane), the modal will not cover the entire screen and will scroll with the page. This is a latent bug that may already manifest on shorter viewport heights where the app's content pane scrolls.
- **Suggested Fix:** Change `absolute inset-0` to `fixed inset-0` in both EvocationWizard.tsx:273 and ExportModal.tsx:14. Verify z-index values (currently z-20 and z-30 respectively) still stack correctly above other fixed UI elements.
- **Effort:** S

---

### Issue 7 — SessionEndWizard recap step opens empty; AI generation not auto-triggered
- **Severity:** Medium
- **Location:** SessionEndWizard.tsx:222–233
- **Description:** The first step ("AI Recap") renders a centered empty state with an icon and a "Generate AI Recap" button. Users must discover and click this button to begin the primary value of this step. Since the user opened this wizard with the intent to end their session and get a recap, the empty-then-click pattern adds unnecessary friction. The session notes and plot summaries are already available at mount time.
- **Suggested Fix:** Auto-trigger `handleGenerateRecap()` on mount via `useEffect` if `sessionNotesText` or `sessionLog.runningNotes` is non-empty. Provide a "Regenerate" button after the fact. If the AI call fails, show the error state with a "Try Again" button (which is already implemented at line 243–248). This removes the extra click and matches user expectation.
- **Effort:** S

---

### Issue 8 — Amber vs. indigo accent split has no semantic rule
- **Severity:** Medium
- **Location:** DmCoach.tsx:275, 605, 754; EvocationWizard.tsx:277, 283, 551; SessionPrepWizard.tsx:329; SessionEndWizard.tsx:198
- **Description:** The app's stated design system is "amber accents" on a stone/slate dark base. Within this dialog set, DmCoach and EvocationWizard use indigo (`bg-indigo-600`) for their active tab/mode selectors and primary interactive toggles, while SessionPrepWizard and SessionEndWizard use amber (`bg-amber-600`) for their active step and navigation. This creates two competing accent colors within the same dialog layer with no documented rule: indigo appears in "tool selector" contexts, amber in "wizard step/navigation" contexts. This is partly defensible, but it is not communicated anywhere in code or comments.
- **Suggested Fix:** Document the split explicitly in CLAUDE.md (e.g., "amber for primary wizard navigation and session-related CTAs; indigo for AI-tool mode selectors and chat UI"). Alternatively, if the intent is a single accent, audit which uses can be unified. The most jarring divergence is DmCoach's indigo "Send" button (line 605) appearing in an amber-dominant app.
- **Effort:** S

---

### Issue 9 — EvocationWizard edit overlay "Done" button placement is easily missed
- **Severity:** Low
- **Location:** EvocationWizard.tsx:358–363
- **Description:** When editing a generated entity inline, the editing overlay's only close control is a "Done" button positioned `absolute top-2 right-2 z-10` inside the overlay panel. This button is small (`size="sm"`), appears over the scrollable editor content, and has no corresponding "Cancel" or obvious back affordance. Users editing a long NPC in scroll may not be able to see the button without scrolling to the top.
- **Suggested Fix:** Move the "Done" button to a sticky footer bar at the bottom of the editing overlay, consistent with how SessionPrepWizard and SessionEndWizard handle their footer navigation. Add a secondary "Cancel changes" action that restores the original entity state.
- **Effort:** M

---

### Issue 10 — Step progress not communicated to screen readers
- **Severity:** Low
- **Location:** SessionPrepWizard.tsx:320–345, SessionEndWizard.tsx:189–210
- **Description:** The step indicator bar renders buttons with text labels but no `aria-current="step"` attribute on the active step, and no visually-hidden progress announcement (e.g., "Step 2 of 5: Scenes"). Screen reader users navigating the dialog will not know their position in the wizard flow.
- **Suggested Fix:** Add `aria-current="step"` to the active step button. Add a visually-hidden `<span className="sr-only">` element within the step bar region that reads "Step {displayIndex + 1} of {activeSteps.length}: {STEP_LABELS[currentStep]}".
- **Effort:** S

---

## Patterns & Themes

**What is working well:**

The three step-based wizards (SessionPrepWizard, SessionEndWizard, WorldSimulationWizard) share a confident structural pattern: header with title and close button, step/status indicator, scrollable content area, sticky footer with back/next/primary action. This is the right pattern for a multi-stage workflow and it is consistently applied within each file.

The content design across all dialogs is above average for a tool of this type. Empty states are specific (e.g., "This adventure has no scenes yet" rather than "No items"), error messages are actionable, and confirmatory language before destructive actions ("This will mark the session as completed... This cannot be undone") is correctly placed and appropriately worded.

DmCoach is the most feature-complete panel and the most polished standalone tool in this set. Its `RoleplayPanel` is effectively a separate mini-feature with proper loading states, optimistic message injection, error recovery (removing the user message on failure at line 243), and a well-thought-out NPC context preview.

**Structural debt:**

The absence of a shared `Wizard` or `StepIndicator` primitive is the single biggest structural issue. This set currently has three independent wizard implementations that share no code. The pattern is clear enough that extraction would be low-risk and would provide immediate value.

**Accessibility debt:**

Focus trapping is the most consequential missing feature. All other accessibility work (aria-labels on icon buttons, role="dialog", aria-modal, role="switch") is done well. The one component that implements Escape key handling (ContinuityChecker) does it correctly.

**Sizing disparity:**

ExportModal at 60 lines vs. SessionPrepWizard at 890 lines is not a design inconsistency — these are genuinely different complexity levels. ExportModal is a single-screen selection with no state; SessionPrepWizard is a multi-step workflow with derived state and dynamic step routing. The complexity is proportional to the task, not a sign of abstraction failure.

---

## Screenshots

Desktop overview captured: `.planning/ui-reviews/wizards-20260324-164217/desktop-main.png`

Screenshots show the app in "Campaign Setting" view on the main campaign. Wizards are triggered from header buttons and session states; they could not be auto-captured in open state without scripted interaction. The desktop screenshot confirms the overall dark fantasy theme, sidebar navigation layout, and header button positions for Continuity, Evocation Wizard, World Sim, Session Weaver, and Go Live.

---

## Files Audited

| File | Lines | Role |
|------|-------|------|
| `components/dialogs/SessionPrepWizard.tsx` | 890 | Multi-step pre-session wizard |
| `components/dialogs/EvocationWizard.tsx` | 717 | Batch AI world-building wizard |
| `components/dialogs/DmCoach.tsx` | 760 | Live session AI assistance panel |
| `components/dialogs/SessionEndWizard.tsx` | 482 | Multi-step post-session wizard |
| `components/dialogs/WorldSimulationWizard.tsx` | 434 | Time-skip world simulation wizard |
| `components/dialogs/ContinuityChecker.tsx` | 341 | Campaign data integrity checker |
| `components/dialogs/ExportModal.tsx` | 60 | Export format selection modal |
