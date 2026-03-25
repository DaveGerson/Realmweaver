# Onboarding & Setup — UX Audit Report

**Audited:** 2026-03-24
**Baseline:** Abstract UX standards (no UI-SPEC.md found)
**Screenshots:** Captured (dev server at http://localhost:3000)
**Scope:** WelcomeScreen, CampaignCreator, FirstCampaignWizard, CampaignSelector (CrossCampaignDashboard in practice), plus App.tsx appStatus routing

---

## Summary

The onboarding flow has a high-quality visual baseline — the dark fantasy theme is consistent, the CampaignCreator form and CrossCampaignDashboard are well-executed components. However, the critical user journey is broken at the start: a new user who has never opened the app is never shown the welcome screen or creation flow because the service layer immediately seeds a full demo campaign and drops them into the editing shell. The `WelcomeScreen` component and `CampaignSelector` component are both functionally orphaned by this seeding behavior. The `FirstCampaignWizard` is a strong UX addition but carries several interaction gaps: no minimum-character feedback for Step 1, missing explicit "add an NPC manually" affordance, and back-navigation on steps 2–4 destroys AI-generated work without warning.

---

## Scored Dimensions

- **Visual Consistency: 7/10** — The dark fantasy theme (stone/slate grays + amber accent) is held tightly across all components. Campaign form and CrossCampaignDashboard are polished. Key inconsistency: CampaignCreator mixes `slate-*` tokens (form background, inputs, labels) with `stone-*` tokens used by FirstCampaignWizard and CrossCampaignDashboard — two similar but distinct gray families on the same screen path. WelcomeScreen uses `slate-100` for the heading but CampaignCreator uses `slate-100` too; however the wizard uses `stone-100`. The `bg-slate-900/50` form card in CampaignCreator is lighter than expected given `stone-900` is the app's canvas. Template cards in TemplateSelectorStep use `stone-800` borders/backgrounds while the campaign form immediately below uses `slate-*`, creating a visible tonal shift.

- **Interaction Quality: 5/10** — Loading states in FirstCampaignWizard are good (spinner + contextual label on each Next button). Error banner is correctly placed and styled. However: (1) the Step 1 "Next" button silently does nothing if the textarea has <20 characters — there is no inline validation message, just a disabled state with no explanation; (2) clicking Back on steps 2–4 navigates to the previous step but the previously generated data (NPCs, locations) is still held in state — this is fine, BUT the user doesn't know this and the Back button has no tooltip or confirmation; (3) the Regenerate button in steps 2–4 has no confirmation and silently destroys manual edits; (4) `handleImportCampaign` and `handleImportPC` in App.tsx use `alert()` for both success and failure — a jarring, out-of-theme interaction that bypasses the existing toast/error system.

- **Information Architecture: 4/10** — The biggest structural problem in the audit: a brand-new user who clears their browser data (or uses incognito) never sees the welcome screen. `campaignService.init()` (line 2204 of campaignService.ts) auto-seeds the "Winter's Daughter" demo campaign and immediately sets `appStatus = 'editing'`. The `WelcomeScreen` component is unreachable through normal new-user flow. This conflates "demo data" with "first-time onboarding" — new users arrive inside a foreign campaign with no orientation, no explanation of what Realmweaver is, and no invitation to create their own work. A second IA issue: `CampaignSelector.tsx` is a complete component that is never rendered — `App.tsx` routes the `selecting` state to `CrossCampaignDashboard` instead. The orphaned component creates maintenance confusion. A third issue: the CampaignCreator wizard step (template selection) has no "back to campaigns" affordance — there is a "Back to templates" link on the campaign form, but once in the template-selector step there is no way to cancel back to the `selecting` state except through browser history.

- **Component Quality: 7/10** — FirstCampaignWizard is the best component in scope: clean step-based state machine, well-isolated draft types (NpcDraft, LocationDraft), `useCallback` on mutation handlers, and the expand/collapse pattern on NpcCard/LocationCard is elegant. CampaignCreator is clearly factored with TemplateSelectorStep as a sub-component and EntityCountBadge/TemplateCard as further sub-components. CrossCampaignDashboard follows the same pattern well. Weaknesses: CampaignSelector.tsx is a dead component that nobody called a `onSwitchCampaign` prop that matches CrossCampaignDashboard's `onSwitchCampaign` — slight divergence in contract. Button.tsx has a typo at line 21: `'focus-amber'` is an invalid Tailwind class (should be `focus:ring-amber-500` which is already there — the `focus-amber` token does nothing). CampaignCreator's `handleSubmit` calls `onCreateCampaign` only when `title.trim()` is truthy, but the `<input required>` HTML attribute also enforces this — double validation with no user-facing message for the JS guard.

- **Scalability: 6/10** — The seeding approach in campaignService.ts will become a maintenance burden: the 300-line demo campaign object is embedded inline in the service file (lines 276–920), tightly coupling the service's initialization logic with content. The template system (CampaignCreator step 1) is the right abstraction — but the "Winter's Daughter" seed bypasses it entirely and goes through a different code path. The CampaignCreator two-step flow (template-select → campaign-form) is extensible. FirstCampaignWizard's 5-step structure with typed `WizardStep = 1 | 2 | 3 | 4 | 5` is readable but will require significant refactoring to add a step (manual step-by-step if/else blocks in the footer, not a step config array). CrossCampaignDashboard scales well to many campaigns via CSS grid.

---

## Issues

### Issue 1 — New Users Never See the Welcome/Creation Flow
- **Severity:** Critical
- **Location:** `services/campaignService.ts:275–920` (the `else` branch in `init()`)
- **Description:** When no saved campaigns exist in localStorage, `init()` generates a full pre-populated "Winter's Daughter" campaign and sets `appStatus = 'editing'`. First-time users never reach `WelcomeScreen` or `CampaignCreator`. They land inside an unfamiliar campaign with no orientation. The `WelcomeScreen` component at `components/views/WelcomeScreen.tsx` is functionally unreachable for the intended "new user" audience.
- **Suggested Fix:** Replace the inline seeding with an explicit onboarding path. When no saved campaigns exist, set `appStatus = 'welcome'`. Move the "Winter's Daughter" demo data into a template file under `data/templates/` (using the existing template infrastructure) and offer it as a template option in the TemplateSelectorStep. The welcome → template-select → campaign-form flow then becomes the true first-run experience.
- **Effort:** M

### Issue 2 — Step 1 Validation Is Silent (No User Feedback)
- **Severity:** High
- **Location:** `components/views/FirstCampaignWizard.tsx:641–659` (Step 1 primary action), `components/views/FirstCampaignWizard.tsx:240–241` (`handleStep1Next` guard)
- **Description:** The "Next" button on step 1 is `disabled` when the textarea has fewer than 20 characters. The hint text at line 472 says "Minimum 20 characters" but uses `text-stone-500` (very low contrast) and is positioned below the fold on smaller viewports. There is no inline counter, no focus-activated message, and no visual state change when the user presses Enter or taps Next while under the limit. Users cannot tell if the button is intentionally disabled or broken.
- **Suggested Fix:** Add a character counter near the textarea (e.g., `{worldDescription.trim().length}/20 minimum`) that turns amber when count is sufficient. Add an inline validation message on first submit attempt: "Tell us a bit more — at least 20 characters helps the AI generate your world." The existing error state system (red banner at lines 452–456) is already in place.
- **Effort:** S

### Issue 3 — CampaignSelector.tsx Is an Orphaned Component
- **Severity:** High
- **Location:** `components/views/CampaignSelector.tsx` (entire file), `App.tsx:954–963` (routing)
- **Description:** `CampaignSelector.tsx` is a complete, standalone component that is imported in App.tsx (line 7) but never rendered. The `selecting` appStatus now routes to `CrossCampaignDashboard`. `CampaignSelector` has different prop contracts: it takes `onSelect` (CrossCampaignDashboard uses `onSwitchCampaign`) and lacks Duplicate support. The component will silently diverge from the real UI as both files evolve. It creates confusion for developers and inflates the bundle.
- **Suggested Fix:** Delete `components/views/CampaignSelector.tsx` and remove its import from App.tsx. If a simpler list-only selector is ever needed, derive it from CrossCampaignDashboard or document the reason for keeping it.
- **Effort:** S

### Issue 4 — Back Navigation in FirstCampaignWizard Destroys Manual Edits Without Warning
- **Severity:** High
- **Location:** `components/views/FirstCampaignWizard.tsx:629–638` (Back button, steps 2–4)
- **Description:** The Back button on steps 2–4 navigates to the previous step using `setStep(s => (s - 1) as WizardStep)`. The in-memory draft state is preserved (NPCs/locations remain in state), so this is actually safe — BUT there is no visual signal that edits are preserved. If the user goes back to step 1 and changes the world description, then presses Next, `handleStep1Next` regenerates the NPCs array, **overwriting** any manual edits made on step 2. There is also no warning before Regenerate overwrites manual edits on steps 2, 3, and 4.
- **Suggested Fix:** (a) For Back navigation: show a tooltip or footer note "Your edits are preserved" — low effort, high reassurance. (b) For Regenerate: add a confirm dialog ("This will replace your current NPCs. Continue?") or use a non-destructive pattern (generate into a preview then let user swap). (c) For step 1's Next when drafts already exist: ask "Regenerate with updated setting? Your current NPCs will be replaced."
- **Effort:** M

### Issue 5 — `slate-*` vs `stone-*` Token Inconsistency Across Onboarding Flow
- **Severity:** Medium
- **Location:** `components/views/CampaignCreator.tsx:289` (`bg-slate-900/50 p-8 rounded-xl border border-slate-800`), `components/views/CampaignCreator.tsx:307` (`bg-slate-950 border border-slate-700`), `components/views/WelcomeScreen.tsx:15` (`text-slate-100`), vs `components/views/FirstCampaignWizard.tsx:422` (`bg-stone-900`), `components/views/CrossCampaignDashboard.tsx:96` (`bg-stone-800 border border-stone-700`)
- **Description:** CampaignCreator uses `slate-*` for all form elements, card backgrounds, and typography. FirstCampaignWizard, CrossCampaignDashboard, TemplateCard (in CampaignCreator itself), and the Button component's focus ring use `stone-*` or `slate-*` inconsistently. The TemplateSelectorStep uses `stone-800/stone-700` cards (lines 79, 86), while the campaign form card just below uses `slate-900/50` and `slate-800`. At 1440px these read as slightly different gray families. The app's primary canvas is `slate-900` (App.tsx line 1044) but the sidebar is also `slate-900`; FirstCampaignWizard is `stone-900` — visually similar but semantically inconsistent.
- **Suggested Fix:** Pick one gray family for onboarding flows. The rest of the app (CrossCampaignDashboard, FirstCampaignWizard) uses `stone-*`, which matches the project's "dark fantasy/parchment" aesthetic better than Slate. Update CampaignCreator and WelcomeScreen to use `stone-*` throughout. Update the Button component's secondary/ghost variants to use `stone-*` instead of `slate-*`.
- **Effort:** S

### Issue 6 — `alert()` Used for Import Results in App.tsx
- **Severity:** Medium
- **Location:** `App.tsx:268–273` (`handleImportCampaign`), `App.tsx:284–293` (`handleImportPC`)
- **Description:** Campaign import success and failure are surfaced via `alert("Campaign "..." imported successfully!")` and `alert("Import failed: ...")`. This is a browser-native modal that: breaks the dark theme entirely, is inaccessible on some platforms, cannot be dismissed with Escape in the same flow as the rest of the app, and has no consistent visual language with the rest of the app's error/success patterns.
- **Suggested Fix:** Replace with the existing toast or banner pattern already used in CampaignCreator (the red error banner at lines 262–266) and FirstCampaignWizard (lines 452–456). A `useToast` hook or a simple `appNotification` state in App.tsx with a dismissible banner at the top of the main content area would be consistent.
- **Effort:** S

### Issue 7 — No Cancel / Exit Affordance From Template Selector Step
- **Severity:** Medium
- **Location:** `components/views/CampaignCreator.tsx:259–275` (template-select render block)
- **Description:** Once a user enters the `creating` appStatus (by clicking "Create New Campaign" from the CrossCampaignDashboard), they land on the TemplateSelectorStep. There is a "Start From Scratch" skip link at the bottom, but no "Cancel" / "Go Back" option to return to the campaign selector. If a user clicked "Create New" by accident, they have no way out except the browser's back button or a page reload.
- **Suggested Fix:** Add a "Back to campaigns" link at the top of TemplateSelectorStep (similar to the existing "Back to templates" button on the campaign form at line 291). It should call `campaignService.switchToCampaignSelector()`.
- **Effort:** S

### Issue 8 — Button.tsx Contains an Invalid Tailwind Class
- **Severity:** Low
- **Location:** `components/common/Button.tsx:21`
- **Description:** The `primary` variant class string contains `'focus-amber'` which is not a valid Tailwind utility. The surrounding `focus:ring-amber-500` already handles the focus ring. `focus-amber` does nothing but adds noise to the class list.
- **Suggested Fix:** Remove `focus-amber` from line 21. The string should read: `'bg-amber-600 text-white hover:bg-amber-500 focus:ring-amber-500'`.
- **Effort:** S

### Issue 9 — WelcomeScreen CTA Label Mismatch After First Use
- **Severity:** Low
- **Location:** `components/views/WelcomeScreen.tsx:19`
- **Description:** The CTA button reads "Create Your First Campaign" — this label is only accurate for a brand new user. If the WelcomeScreen were ever reached by a returning user who deleted all their campaigns (the `appStatus = 'welcome'` branch at campaignService.ts line 924), the button label would be misleading. The word "First" implies they have never done this before.
- **Suggested Fix:** Change label to "Create a Campaign" or pass a `isFirstTime` prop to conditionally show "Create Your First Campaign" vs "Create a New Campaign". Since the welcome state is only reached after deletion (line 924), the less presumptuous label is always appropriate.
- **Effort:** S

### Issue 10 — ProgressBar Miscalculates Percentage on Step 1
- **Severity:** Low
- **Location:** `components/views/FirstCampaignWizard.tsx:53–63`
- **Description:** The progress bar formula is `((step - 1) / (totalSteps - 1)) * 100`. On step 1 of 5, this gives 0% — the bar is completely empty and visually looks identical to "not started." On step 5 it gives 100%. This is technically correct for a start→finish model, but the 0% empty bar on step 1 gives no sense of progress and makes the bar feel like a broken element rather than an indicator of forward momentum.
- **Suggested Fix:** Use `(step / totalSteps) * 100` so step 1 shows 20% and step 5 shows 100%. The bar now always shows some fill, conveying that the user has begun.
- **Effort:** S

---

## Patterns & Themes

**Theme 1: Seeding Bypasses the Designed Flow**
The onboarding flow (WelcomeScreen → CampaignCreator → FirstCampaignWizard) is architecturally correct but operationally bypassed by the demo-seeding behavior in `campaignService.init()`. This is the most impactful finding: the app's best-path UX for new users is invisible to them. The template system in CampaignCreator is the right abstraction for demo content — the seed data should become a template.

**Theme 2: Two Gray Families Competing**
The `slate-*` vs `stone-*` split runs throughout the onboarding components and follows a rough boundary: components written earlier (WelcomeScreen, CampaignCreator) use `slate-*`, components written later (FirstCampaignWizard, CrossCampaignDashboard, TemplateCard) use `stone-*`. The visual difference is subtle at dark values but creates a noticeable tonal inconsistency at medium values (labels, card backgrounds). Standardizing on `stone-*` would match the "fantasy" aesthetic better and the `stone-*` components are more numerous and more recent.

**Theme 3: Interaction States Well-Handled in Wizard, Missed in App Shell**
FirstCampaignWizard has thoughtful loading states (contextual spinner labels on each step's async operation), error banners, and step-based disabled buttons. These patterns are strong. However the App.tsx shell still falls back to `alert()` for import results, and the CampaignCreator has no inline validation message — suggesting the wizard was built to a higher UX standard than the surrounding scaffolding.

**Theme 4: Dead Code Creates Maintenance Risk**
CampaignSelector.tsx is an orphaned component that diverges from the live CrossCampaignDashboard in prop shape and capabilities. As CrossCampaignDashboard adds features (confirm-to-delete, duplicate, session count), CampaignSelector will silently fall further behind, eventually misleading a developer who finds it and thinks it represents the real UI.

---

## Screenshots

| File | Description |
|------|-------------|
| `screenshots/onboarding/01-welcome-screen.png` | App state on first load — demo campaign seeds immediately, no welcome screen shown (illustrates Issue 1) |
| `screenshots/onboarding/02-template-selector.png` | TemplateSelectorStep — 4 template cards in 2-col grid, "Start From Scratch" skip link at bottom |
| `screenshots/onboarding/03-campaign-form-top.png` | CampaignCreator form top — Campaign Title, Setting Type radio, Official Setting dropdown with amber Google Search note |
| `screenshots/onboarding/04-campaign-form-dm-style.png` | CampaignCreator form — DM Style 3-card selector with Guided/Standard/Power options, "Weave Campaign" CTA |
| `screenshots/onboarding/05-cross-campaign-dashboard.png` | CrossCampaignDashboard — campaign cards with entity count badges, Continue/Duplicate/Delete actions, Create New dashed card |
| `screenshots/onboarding/05b-from-header-menu.png` | Header dropdown — "All Campaigns / Switch Campaign / Create New Campaign" menu options |
| `screenshots/onboarding/06-welcome-mobile.png` | Mobile (375px) — app lands in editing state (same Issue 1 evidence), no welcome screen |
| `screenshots/onboarding/09-cross-campaign-mobile.png` | CrossCampaignDashboard at 375px — single column, Duplicate/Delete icons only (text hidden via `hidden sm:inline`) |
| `screenshots/onboarding/10-first-campaign-wizard-step1.png` | FirstCampaignWizard Step 1 modal — overlaid on editing shell, progress bar empty at 0%, textarea with placeholder |
