# CLAUDE.md — `tests/`

Vitest unit + component tests. **178 files, 1855 tests, all green.** Playwright specs live in `e2e/` (see
`e2e/CLAUDE.md`) and are excluded from this run.

```bash
npm test                     # vitest run — the whole suite
npm run test:watch           # vitest (watch)
npx vitest run tests/ship    # one directory
npx vitest run tests/ship/wp-a-persistence.autosave-flush.test.ts
npx vitest run -t 'cascade'  # by test name
npm run typecheck            # tsc --noEmit — tests are type-checked too
```

## Configuration

There is **no `vitest.config.ts`** — the config is the `test` block at the bottom of `vite.config.ts`:

```ts
test: { globals: true, environment: 'node', exclude: ['e2e/**', 'node_modules/**'] }
```

Consequences worth knowing:

- **`environment: 'node'` is the default.** A test that renders React must opt in per-file with a
  `// @vitest-environment jsdom` pragma **on the first line** — before any comment block or import. 90 files do this
  today: 73 in `tests/ship/` and 17 storyteller-wave feature suites at the `tests/` top level.
- `globals: true`, so `describe` / `it` / `expect` are ambient — but every file still imports them from `vitest`
  explicitly. Keep doing that; it is what makes the files readable in isolation.
- The `@/` alias and the vite `define` block (provider env vars) apply to tests too, so `services/ai/modelConfig.ts`
  sees the same `process.env.REALMWEAVER_*` substitutions the app does.
- There is no setup file. Global polyfills are per-file, via `tests/helpers/testStoreFactory.ts` or `vi.stubGlobal`.

## Layout

| Path | Contains |
|------|----------|
| `tests/*.test.ts` | Long-standing unit tests for one module each — `entityUtils`, `backlinkUtils`, `diceUtils`, `dmStyleUtils`, `contextBuilder`, `continuityChecker`, `importExportService`, `storageService`, `campaignService.*`, `keyboardShortcuts`, `popoverPosition`, `entityDetailExtractors`, `entityFieldSave`, `entityFormReconciliation`, `mentionInput`, `useRovingTabIndex`, `claudeCliProvider`, `retryProvider`, `aiServiceAdapters`, `evocationWizardSettle`, `smokeTestDevGuard`, `migration-verification`. |
| `tests/archetype.*.test.ts` | Five end-to-end **store** journeys, one per GM persona: `forever-dm`, `lazy-dm`, `new-dm`, `tactical-dm`, `worldbuilder`. |
| `tests/<feature>.<topic>.test.ts[x]` | Storyteller/ontology-wave feature families, one prefix per feature: `tonightsTable.*`, `lazyPrep.*`, `mysteryEdges.*` (integrity / continuity / backlinks), `secretsTracker.mysteryEdges`, `secretsGenerateTen.*`, `secretsHereNow.*`, `voiceCards.*`, `coldOpen.*`, `callbackMachine.*`, `dormantMaterial.*`, `storyDerivations`, `prepSheet.*`, `momentsReel.*`, `beatsCarryForward.*`. The `.tsx` ones carry the jsdom pragma. |
| `tests/components/` | Tests of **pure helpers exported from component modules** (`removeCombatantFromEncounter`, `findUnlinkedEntities`, `getEffectiveSessionStatus` / `getPlotSessionStatus`). Node environment — these never render. |
| `tests/services/` | AI-service contract suites for the party-knowledge wave: `contextBuilder.partyKnowledge` (+ shared `partyKnowledgeFixtures.ts`), `dmCoach.playerSafeRecap`, `dmCoach.coldOpen`, `dmCoach.callbackComplication`. |
| `tests/services/linking/` | `autoLinker`, `matchingEngine`. |
| `tests/helpers/` | `testStoreFactory.ts` — shared test scaffolding. |
| `tests/ship/` | The ship-readiness TDD suite (below). |

## `tests/ship/` — the hardening suite

One test file per finding-cluster from `docs/ship-readiness/remediation-plan.md`, named
`wp-<package>.<topic>.test.ts[x]`. Every finding went **failing test → fix → independent verification**, so each file
opens with a header comment naming the finding numbers it pins and describing the exact failure mode. Read that header
before touching the file it guards — it is the primary record of *why* the code looks the way it does.

| Prefix | Work package |
|--------|--------------|
| `wp-a-persistence` | storage backups, init recovery, autosave flush/durability, cascade deletion, duplication, multi-tab conflict |
| `wp-b-import-export` | validation, import warnings, campaign-template integrity |
| `wp-c-ai-services` | context-builder budget, provider registry env, realmChat errors, dmCoach prompt, audio transcription, continuity, adventure/scene normalization, claude-cli prompt safety |
| `wp-d-linking` | MentionInput, LinkedText tokenizer, backlinks coverage, command palette, link-suggestion memos, quick-card truncation |
| `wp-e-app-shell` | routing, error boundaries, sidebar, header save status, selection/search hooks, roving tabindex, conflict banner |
| `wp-f1-session-editors` | SessionLogEditor, SceneEditor, SessionLogDashboard |
| `wp-f2-entity-editors` | entity editors, dashboards, generators, debounced mention-field commits |
| `wp-g1-worldsim-dialogs` | WorldSimulationWizard, DialogShell, `useConfirmDialog` |
| `wp-g2-wizards-coach` | session wizards, EvocationWizard, DmCoach, DmStylePanel |
| `wp-h-tools-viz` | combat tracker, dice log, secrets, timeline, relationship graph |
| `wp-i1-ai-proxy` | `vite-plugin-ai-proxy.ts` — origin/host guard, body + stdout limits, stdin errors, preview server |
| `wp-i2-build-test-infra` | `index.html`, `vite.config.ts`, `package.json`, Tailwind safelist, e2e helpers, demo templates |
| `wp-j-types-utils` | PC schema normalization, DM-style feature gates, smoke-test opt-in, dead code |
| `wp-review` | cross-cutting contract tests from the review pass (`debounced-field-commit`) |

`wp-i1-ai-proxy.harness.ts` has no `.test.` in its name on purpose — it is the shared fake-server/req/res harness the
`wp-i1` suites import, not a suite itself. A new proxy request helper goes in `authorizedHeaders()` there, once.

Two files in this directory do something unusual and slow, and that is deliberate:

- `wp-i2-build-test-infra.tailwind-safelist.test.ts` runs a **real `vite build`** into a temp dir (120 s timeout) and
  greps the emitted CSS. A source-text scan cannot catch a build-output regression.
- Several `wp-i2` / `migration-verification` tests read source files off disk and assert on their text. They are
  structural guards, not behavioural ones — expect to update the pattern when you legitimately restructure a file, but
  never by deleting the assertion.

### The rule: never weaken a ship test

These tests are the only durable record of 124 real defects. If one fails:

1. **Read the header comment.** It states the failure scenario the test reproduces.
2. Fix the code. A red `tests/ship/*` test means the regression is back, not that the test is stale.
3. Only relax an assertion when the *contract itself* legitimately changed — and then say so in the header comment and
   keep the finding number.

Never delete a ship test, never loosen a matcher to make it pass, never `.skip` one, and never narrow a
`describe`/`it.each` set to dodge a case. Adding assertions is always fine.

## Testing the store

`tests/helpers/testStoreFactory.ts` gives you two things:

```ts
import { setupTestEnvironment, type CreateCampaignStoreFn } from './helpers/testStoreFactory';

setupTestEnvironment();                      // module scope, BEFORE importing campaignService

let createCampaignStore: CreateCampaignStoreFn;
beforeAll(async () => {
  createCampaignStore = (await import('../services/campaignService')).createCampaignStore;
});
```

- `setupTestEnvironment()` installs a minimal `localStorage` polyfill via `vi.stubGlobal`. It must run **before**
  `campaignService` is imported, because the module-level `persist: true` singleton touches storage on load — hence the
  dynamic `await import` inside `beforeAll` rather than a top-level import.
- `makeTestStore(createCampaignStore, title?, setting?, settingType?)` returns `{ service, campaign }` with a fresh
  `{ persist: false }` store that has already run `init()` → `prepareNewCampaign()` → `createCampaign(...)`.
  `campaign()` re-reads `getState().campaigns[0]` so you never hold a stale Immer snapshot.
- Any test that constructs a `{ persist: true }` store must call `service.destroy()` in `afterEach` — `init()`
  registers real `pagehide` / `beforeunload` / `visibilitychange` listeners and a storage-conflict subscription.

The **archetype suites** are the fullest examples of this pattern: each drives a complete GM workflow (prep → go live
→ improvise → recap) against a real store, with comments explaining the tabletop behaviour being modelled. They are
the fastest way to see how the store's methods compose.

## Component tests

`// @vitest-environment jsdom` + `@testing-library/react` (83 files import it; 3 use `renderHook`). Conventions:

- `cleanup()` in `afterEach` — there is no global setup file doing it for you.
- Mock `services/campaignService` with `vi.mock` + `vi.hoisted` when the component only needs a snapshot to render;
  use a real `{ persist: false }` store when the test is about store behaviour.
- Components wrapping `useToast` / `useConfirmDialog` must be rendered inside `ToastProvider` /
  `ConfirmDialogProvider` — both hooks throw otherwise.
- Assert through roles and accessible names, not class names — the a11y suites (`*-a11y.test.tsx`) depend on it.

## Mock mode

Every AI-touching test runs against `services/ai/mockService.ts` (`isMockMode: true`) or a `vi.mock` of
`services/aiService`. **No test may reach the Claude CLI or the network.** `smokeTestDevGuard.test.ts` proxies the
whole `aiService` module to inert async stubs precisely so the smoke-test logic can run without paying the mock's
500 ms-per-call delays. A new AI function needs its mock added in `mockService.ts` before it can be tested.

## Adding a test

- Regression for a shipped bug → `tests/ship/wp-<package>.<topic>.test.ts`, with a header comment stating the failure.
- New behaviour in a single module → `tests/<module>.test.ts`.
- Pure helper exported by a component → `tests/components/`.
- Rendering, focus, or keyboard behaviour → `.test.tsx` + the jsdom pragma.
- Multi-step GM workflow → extend the closest `archetype.*` suite.

## Gotchas

| Rule | Why |
|------|-----|
| jsdom is opt-in, first line of the file | Default environment is `node`; the pragma is ignored if anything precedes it. |
| `setupTestEnvironment()` before importing `campaignService` | The `persist: true` singleton touches `localStorage` at module load. |
| `createCampaignStore({ persist: false })` in tests | A real store schedules autosaves and registers window listeners. |
| `destroy()` any `persist: true` store in `afterEach` | Leaked listeners cross-contaminate later tests. |
| Never weaken, skip, or delete a `tests/ship/*` assertion | It is the only record of the defect it pins. |
| No network, no Claude CLI, ever | Use mock mode or `vi.mock('services/aiService')`. |
| Don't add a global setup file | Per-file setup is deliberate — several suites need different globals. |
| `npm run typecheck` covers tests | A test that only passes with `any` still fails CI. |

CI (`.github/workflows/ci.yml`) runs typecheck → `npm test` → `vite build` → `npm run test:e2e -- --project=chromium`
on every push to `main` and every PR.
