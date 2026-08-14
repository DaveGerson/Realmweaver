# CLAUDE.md — `e2e/`

Playwright end-to-end specs. 14 spec files, ~112 tests, driving the real app in a browser. Unit tests live in
`tests/` (see `tests/CLAUDE.md`) and are excluded from this run; `vite.config.ts`'s vitest block excludes `e2e/**`
symmetrically.

```bash
npm run test:e2e                                   # all projects
npm run test:e2e -- --project=chromium             # what CI runs
npm run test:e2e -- --project=mobile-chrome        # Pixel 5 viewport
npm run test:e2e:ui                                # interactive runner
npm run test:e2e:headed
npx playwright test e2e/smoke.spec.ts -g 'welcome' # one file / one test
```

## Config (`playwright.config.ts`, repo root)

| Setting | Value / why |
|---------|-------------|
| `testDir` | `./e2e` |
| `baseURL` | `http://127.0.0.1:4200` — **not** `localhost`. Vite binds to `127.0.0.1` (`vite.config.ts`'s `host`); on hosts whose Node resolver prefers `::1` the two don't connect. |
| `webServer` | `npm run dev`, 60 s startup timeout, `reuseExistingServer: !process.env.CI`. |
| `globalSetup` | `./e2e/global-setup.ts` |
| `projects` | `chromium` (Desktop Chrome) and `mobile-chrome` (Pixel 5). |
| retries / workers | 2 / 1 on CI, 0 / auto locally. `fullyParallel: true`. |

**Port 4200 is `strictPort: true`** in `vite.config.ts`. A taken port fails loudly instead of drifting to 4201, which
would leave this config validating a stale or unrelated server. Do not "helpfully" remove `strictPort`, and do not
change the port in one file only — `vite.config.ts`, `playwright.config.ts` (`baseURL` + `webServer.url`), and
`global-setup.ts`'s fallback all name 4200.

`global-setup.ts` closes the other half of that hole: Playwright's `webServer` readiness probe only checks that
*something* answers 200 on the port, so with `reuseExistingServer` it will happily adopt an unrelated process. The
setup does one `fetch(baseURL)` and asserts the body contains `<title>RealmWeaver</title>` before any spec runs,
failing with an actionable message otherwise. It is a no-op safety net on CI (which always launches fresh) — it exists
for the local dev path.

`mobile-chrome` is currently **excluded from CI** (`.github/workflows/ci.yml`): `Header.tsx` renders `relative z-[60]`
while `DialogShell`'s overlay and the mobile sidebar sit at `z-50` / `z-40`, so on narrow viewports the header paints
above modals and intercepts the clicks the helpers make. Re-enable the project there once the stacking order is fixed
(content < header < sidebar < modal).

## Specs

| File | Covers |
|------|--------|
| `smoke.spec.ts` | App loads, campaign creation, mock mode default, basic navigation. |
| `campaign.spec.ts` | Campaign lifecycle: create, persist across reload, switch, delete. |
| `navigation.spec.ts` | Sidebar switching, breadcrumbs, back button, recent items, command palette. |
| `entity-crud.spec.ts` | NPC, Location, Faction, Adventure CRUD. |
| `entity-crud-extended.spec.ts` | Items, Articles, Player Characters, Plots, Notes. |
| `editors.spec.ts` | Editor tab navigation, field editing, dropdowns. |
| `generators.spec.ts` | Quick-generate vs chat mode, prompt chips, `EntityChatGenerator`. |
| `dialogs.spec.ts` | ExportModal, EvocationWizard, WorldSimulationWizard, SessionEndWizard, FirstCampaignWizard, ContinuityChecker. |
| `dm-tools.spec.ts` | DM Coach, Continuity Checker, Secrets & Clues, shortcuts help. |
| `session-runner.spec.ts` | Session prep wizard and the live session runner. |
| `tools.spec.ts` | CombatTracker, DiceRoller, SecretsTracker. |
| `visualizers.spec.ts` | RelationshipGraph, PlotTimeline. |
| `realm-chat.spec.ts` | The floating RealmChat widget. |
| `mobile.spec.ts` | Pins its own `test.use({ viewport: { width: 393, height: 851 }, isMobile: true })` so it is meaningful under either project. |

Each spec opens with a "Strategy notes" header explaining which selectors it relies on and why. Read it before
changing a selector.

## `helpers.ts`

Every spec builds on these. Do not re-implement them inline.

| Export | Contract |
|--------|----------|
| `gotoFresh(page)` | Clears every `realmweaver*` localStorage key, then sets `realmweaver-campaigns` to `'[]'` and reloads. Waits for the "Create a campaign" button. |
| `createCampaign(page, opts?)` | Welcome / CrossCampaignDashboard / header-dropdown → template-select → "Start From Scratch" → form → submit. Waits for the sidebar heading, then dismisses `FirstCampaignWizard` if it auto-opened. Options: `{ title, dmStyle, settingType, setting }`. |
| `enableMockMode(page)` | Ensures the header `[role="switch"]` reads `aria-checked="true"`. Returns silently if the toggle isn't mounted. |
| `navigateToView(page, label)` | Opens the mobile drawer if the sidebar is off-screen, then clicks the sidebar button whose accessible name matches `label` (case-insensitive regex). |
| `waitForDashboard(page)` | `expect(page.locator('main')).toBeVisible()`. |
| `openCampaignSelector(page)` | Header dropdown → the `role="menuitem"` named exactly "All Campaigns". |
| `waitForAutoSave(page, expectedTitle)` | Polls `localStorage['realmweaver-campaigns']` until it contains the title. The header "Saved" indicator is `hidden sm:flex`, so it is not a reliable signal. |

**`gotoFresh` sets `'[]'` rather than removing the key on purpose.** With the key absent, `campaignService.init()`
seeds the demo campaign and jumps straight to `'editing'`; an empty array lands on `'welcome'`.

Two private primitives do the waiting, and new helpers must use them:

- `isVisibleWithin(locator, timeout)` — `locator.waitFor({ state: 'visible', timeout })` wrapped to resolve
  `true`/`false` instead of throwing.
- `raceVisible([{ locator, timeout }, …])` — waits on mutually-exclusive candidates **concurrently** and resolves the
  index of the first visible one, or `-1` once all have genuinely timed out. Probing candidates serially pays each
  timeout in turn; racing them returns almost instantly in the common case without ever under-waiting.

### The `isVisible({ timeout })` pitfall

`Locator.isVisible()` **does not wait** — Playwright's own types mark its `timeout` option as deprecated and ignored.
Using it as a boolean probe is a race: the element may appear a moment later and the probe still reports `false`.

`helpers.ts` relied on that ignored timeout six times. The worst was `createCampaign`'s
`skipWizardBtn.isVisible({ timeout: 500 })` — `FirstCampaignWizard` auto-opens from a React effect after the campaign
transitions to `'editing'`, so the instant check regularly lost the race, the fixed full-screen overlay was never
dismissed, and every later action in the test was swallowed. The five `{ force: true }` clicks in the same file were
suppressing exactly the actionability errors that would have surfaced it.

Both are gone: `helpers.ts` now has **zero** `isVisible({…})` calls and **zero** `force: true`, and
`tests/ship/wp-i2-build-test-infra.e2e-helpers.test.ts` reads the file and asserts it stays that way — including that
the "Skip wizard" branch is driven by `waitFor` / `toBeVisible` / `Promise.race`.

**That guard covers `helpers.ts` only.** The specs still contain 21 `isVisible({ timeout }).catch(() => false)`
probes for genuinely optional UI. They are tolerable there because a false negative skips an assertion rather than
poisoning the rest of the test — but do not copy the pattern into a helper, and prefer `isVisibleWithin` when adding
one to a spec.

## Conventions

- Every test starts from `gotoFresh(page)` and builds its own state — specs are independent and run
  `fullyParallel`. Never rely on ordering or on a campaign a previous test created.
- Select by role and accessible name (`getByRole('button', { name: /…/i })`), placeholder, or `aria-*` attribute.
  Class names and DOM shape are not contracts. Where a locator has to be structural (the header campaign dropdown),
  it is isolated in `helpers.ts` so there is one place to fix.
- Mock mode is on by default in `App.tsx`; call `enableMockMode(page)` after `createCampaign` when a spec toggles it
  or exercises a generator. **No e2e test may reach the Claude CLI or the network.**
- Screenshots go to `e2e/screenshots/*.png` via explicit `page.screenshot({ path: … })`. That directory is
  gitignored, as are `playwright-report/` and `test-results/` — screenshots are for local inspection, not assertions.
  There is no visual-regression baseline in this repo.

## Gotchas

| Rule | Why |
|------|-----|
| `127.0.0.1`, never `localhost` | Vite binds v4; a `::1`-preferring resolver silently fails to connect. |
| Port 4200 with `strictPort` — change it in all four places or none | A drifted port validates the wrong server. |
| Never pass `timeout` to `isVisible()` | It is ignored; use `isVisibleWithin` / `waitFor` / `toBeVisible`. |
| Never add `force: true` to a click | It hides the actionability error that is telling you something overlaps. |
| New helper → genuinely waiting primitive | `tests/ship/wp-i2-build-test-infra.e2e-helpers.test.ts` fails otherwise. |
| `gotoFresh` writes `'[]'`, doesn't remove the key | A missing key seeds the demo campaign instead of the welcome screen. |
| Don't assert on the header "Saved" text | It is `hidden sm:flex`; use `waitForAutoSave`. |
| Each test creates its own campaign | Specs run in parallel with no shared state. |

Rationale for the helper hardening is finding #33 in `docs/ship-readiness/remediation-plan.md`.
