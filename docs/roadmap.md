# Realmweaver Roadmap — Prioritized by Value / Effort

> **Generated:** 2026-07-17, following the 16-area architecture review + 13-agent fix fleet + adversarial
> remediation pass (branch `claude/codebase-review-roadmap-0utya9`, commits `0922913`/`a99c7ed`).
> **Verified against current code**, not the review snapshot alone — many findings the review flagged were
> already resolved by the fix fleet (cascade-deletion purge, `duplicateCampaign` ID remap, IndexedDB load
> wiring, `ErrorBoundary` reset-on-nav, `ConfirmDialog`→`DialogShell` composition, mic-dictation toast,
> combat `turnIndex` desync, skill-check staleness, ai-proxy error-envelope swallow bug, unauthenticated
> proxy bind, JSON-retry scoping, continuity-checker cycle dedup, `NoteDashboard` sidebar wiring, and more).
> Every item below was re-checked against the live source tree at write time; effort estimates cite the
> actual files and line ranges involved.

---

## 1. Method

**Value** is scored 1–5 per persona (New DM, Lazy DM, Forever DM, Tactical DM, Worldbuilder) based on how
directly the item advances that persona's jobs-to-be-done, as exercised by `tests/archetype.*.test.ts` and
observed pain points in the current UI. **Aggregate** is the sum across all five (max 25) — a rough
population-weighted proxy, not a claim that all five personas are equally represented among real users.

**Effort** is S / M / L / XL, sized by engineering reality, not guesswork:
- **S** (≈1–2 days): a localized fix in 1–2 files, no schema/type changes, no cross-cutting regression risk.
- **M** (≈3–5 days): touches 3–8 files or one subsystem's public contract (e.g. a service's exported
  function signature, a shared component's props), needs a manual regression pass across its consumers.
- **L** (≈1–2 weeks): a refactor across a whole subsystem (e.g. all 12 entity types in `campaignService.ts`,
  all 7 generator components, all 13 editors) or a new capability requiring new state/type plumbing.
- **XL** (≈2–4+ weeks or multi-session): a new data model, a new cross-cutting architecture layer, or a
  refactor that touches the app shell's central prop-threading (`App.tsx` ↔ `ViewRouter.tsx` ↔
  `CampaignSidebar.tsx` ↔ `useEntitySelection.ts`) where every one of the 13 entity types must be re-verified.

**Priority** = value-density (`aggregate ÷ effort-weight`, S=1/M=2/L=3/XL=5), **except** that reliability and
platform items which sit underneath every other feature — CI, the Tailwind build, session-note durability,
list virtualization, and the test-infrastructure bootstrap other refactors depend on for a safety net — are
floated to the top of NOW regardless of their computed density. A cheap fix nobody will notice (e.g. an
`aria-live` attribute) is lower priority than a fix that unblocks five later features even if its raw value
score is modest.

---

## 2. Persona Profiles

### New DM
**Job-to-be-done:** Run a first campaign without knowing D&D conventions cold; wants the app to supply
structure and confidence, not just a blank canvas.
**Top 3 pain points today:**
1. `FirstCampaignWizard.tsx`'s dismiss path (Escape, backdrop click, header ✕) discards all hand-edited
   drafts with zero confirmation, while a much smaller action (regenerating one step) *is* confirm-gated.
2. `DmCoach.tsx` clears the prompt box on every tool-tab switch (`setPrompt('')`), punishing exploration.
3. `WelcomeScreen`/`CampaignCreator` still offer no seed questions, starter templates, or "what good looks
   like" guidance — the onboarding gap the 2026-03-22 archetype audit graded D+ is still largely unaddressed.

### Lazy DM
**Job-to-be-done:** Minimal prep, maximum AI leverage; wants one click to get usable content and to never
lose a fast improvised note mid-session.
**Top 3 pain points today:**
1. Session notes/dice/beats persist only through `campaignService`'s 2-second debounced localStorage save
   (`scheduleSave`, `services/campaignService.ts`) with no `beforeunload`/`visibilitychange` flush — a
   crashed tab or closed laptop loses the last burst of live-session activity outright.
2. Every AI generation call is a single buffered request with no streaming and no cancellation
   (`services/ai/providers/claude-cli.ts`, all 7 `components/generators/*.tsx`) — nothing to look at during
   a 30–120s quality-tier wait, and switching away mid-request doesn't stop a stale result reopening later.
3. `services/ai/audioTranscription.ts` bypasses the `aiService.ts` facade entirely (imported directly by
   `SessionLogEditor.tsx`) with no mock — it's the one feature a Lazy DM can't exercise/trust offline.

### Forever DM
**Job-to-be-done:** Run one world across years and hundreds of sessions; wants the store to hold up at
scale and never silently drop or corrupt long-accumulated data.
**Top 3 pain points today:**
1. No dashboard grid or `CommandPalette` result list virtualizes — a 300-NPC, 200-scene campaign renders
   every card/result as a live DOM node on every keystroke (`components/dashboards/*.tsx`,
   `components/common/CommandPalette.tsx`).
2. CRUD for all 12 entity types is hand-duplicated in `services/campaignService.ts` (1765 lines) rather than
   driven by one generic, parameterized factory — every entity-specific integrity rule has to be
   remembered and applied by hand for each of the 12 types individually.
3. Zero cross-campaign content reuse — no entity-level "copy to campaign," no shared entity library, despite
   `campaignService.ts`'s multi-campaign model being otherwise sound.

### Tactical DM
**Job-to-be-done:** Run combat-forward sessions with fast, reliable initiative/HP/condition bookkeeping.
**Top 3 pain points today:**
1. `handleEndCombat` (`components/views/SessionRunner.tsx`) resets `campaign.activeEncounter` to empty and
   logs only a one-line auto-event summary — the full combatant/HP/round detail of a fight that ends mid-
   session (as opposed to at session-end) is gone forever, unlike `endSession()`'s proper archival to
   `session.encounterLog`.
2. `Combatant` (`types/Encounter.ts`) has an optional `ac` field that's never rendered anywhere in
   `CombatTracker.tsx`, HP is only ±1-steppable (no damage/heal delta input), and there is no structured
   condition system — `notes?: string` is a freeform blob.
3. `NPC.stats` (`types/NPC.ts:21`) is a freeform string, so AC/CR/speed/saves are never machine-readable —
   `SceneGenerator.tsx` can't produce an encounter-balance readout and there's no XP-budget/difficulty
   calculator anywhere in the app.

### Worldbuilder
**Job-to-be-done:** Build deep, cross-referenced lore — NPCs, locations, factions, articles — and keep it
navigable as the web of relationships grows.
**Top 3 pain points today:**
1. `RelationshipGraph.tsx`'s only interaction surface is a D3 `on('click', ...)` handler with no `tabindex`,
   `role`, or keyboard path, and no `role="img"`/`aria-label` on the `<svg>` — the graph is a total black box
   to keyboard/screen-reader users, despite being one of only two ways to jump directly to an entity.
2. `LinkedText.tsx` hand-rolls its own tokenizer/word-boundary matcher instead of routing through the
   `services/linking` engine registry every other consumer uses — `services/linking/matchingEngine.ts`'s
   `isWordBoundary` was fixed to be Unicode-aware (`/[\p{L}\p{N}]/u`), but `LinkedText.tsx`'s duplicate
   (line 106) is still the old ASCII-only regex, so inline entity links in NPC/Location/Article descriptions
   still mis-link fantasy names with diacritics differently than the "Detected" suggestion UI does.
3. `utils/entityUtils.ts`'s `buildEntityContext` — fully implemented, fully unit-tested, documented as the
   `RegenerateButton` context builder — has zero call sites in production; all 9 editors hand-roll a
   divergent inline template string instead, so AI-assisted regeneration context quality varies by editor
   with no single source of truth.

---

## 3. Roadmap

### NOW — Reliability & Platform (ship before anything else)

These block or silently undermine everything downstream: a broken CI gate means every other item on this
roadmap can regress unnoticed; an unstyled/CDN-dependent production build is a correctness risk in its own
right; and a scale/durability bug in the store is a trust-destroying failure mode no feature work outweighs.

---

**N1. CI Pipeline (typecheck + test + build gate)**
No `.github/workflows` directory exists at all. `npm run typecheck` (`tsc --noEmit`) already exists as a
script but nothing invokes it automatically — a contributor can introduce a real type error, `npm test`
(vitest only) and `npm run build` (esbuild transpile only, no type-checking) both still go green, and it
merges. This is the single highest-density item on the roadmap: it costs almost nothing and silently gates
every other item below.
Personas: all. Value — New DM 3, Lazy DM 3, Forever DM 3, Tactical DM 3, Worldbuilder 3 · **Aggregate 15**
Effort: **S** — the `typecheck` script already exists (`package.json`); add one `.github/workflows/ci.yml`
running `npm run typecheck && npm test && npm run build` on PR.
Dependencies: none.

**N2. Tailwind Build-Time Migration**
`index.html:9` still loads `<script src="https://cdn.tailwindcss.com">` and JIT-compiles in the browser —
Tailwind's own docs say this build is unsupported for production. No purge, a hard runtime dependency on a
third-party CDN (unstyled app if blocked by a CSP/proxy/ad-blocker), and real first-paint cost.
Personas: all (visual reliability). Value — 3/3/3/3/3 · **Aggregate 15**
Effort: **M** — install `tailwindcss`/`postcss`/`autoprefixer`, add `tailwind.config.ts`/`postcss.config.js`,
replace the CDN `<script>` with a compiled stylesheet import; also requires auditing dynamically-constructed
Tailwind class strings across dashboards/badges (flagged by the prior UX audit as CDN-only-safe patterns)
so purge doesn't strip classes assembled via template literals.
Dependencies: none, but should land before any component-level test suite (N6) that snapshots styling.

**N3. Session-Runner Data Durability & Autosave Cost**
Two related defects in the same save path: (1) `services/campaignService.ts`'s `scheduleSave` only ever
flushes on a 2-second debounce with no `beforeunload`/`visibilitychange` listener, so a crashed tab, closed
laptop, or accidental refresh loses the newest burst of session notes/dice/beats outright — exactly the
data a Lazy or Tactical DM is entering fastest during live play. (2) `services/storageService.ts`'s
`_rotateBackups` (line 174) unconditionally runs 3 extra localStorage read/write round-trips over the full
serialized campaign JSON on **every** `save()` call (line 258), i.e. every 2-second autosave tick, not just
on a meaningful interval — for a large campaign this quadruples the blocking-I/O cost of every keystroke's
eventual autosave.
Personas: Lazy DM 5, Tactical DM 5, Forever DM 4, New DM 2, Worldbuilder 2 · **Aggregate 18**
Effort: **M** — add a `flushSave()` path invoked from a `beforeunload`/`visibilitychange` handler (wired in
`components/views/SessionRunner.tsx` or centrally in `campaignService.ts`), and throttle `_rotateBackups` to
run on a longer interval (or move it off the critical path) independently of the primary write cadence.
Dependencies: none.

**N4. Dashboard & Command Palette List Virtualization at Scale**
None of the 10 entity dashboards (`components/dashboards/*.tsx`) virtualize their card grid — every
NPC/Location/Faction/Item card is a live DOM subtree rendered on every keystroke in the search box.
`components/common/CommandPalette.tsx` groups results with only a per-group cap in places, not a global one;
a 150+ NPC / 80+ location campaign easily produces hundreds of unbounded DOM nodes on a single keypress.
This is the exact "Forever DM" and "Worldbuilder" failure mode — the app degrades precisely as a campaign
becomes rich enough to matter.
Personas: Forever DM 5, Worldbuilder 5, Tactical DM 2, Lazy DM 2, New DM 1 · **Aggregate 15**
Effort: **M** — introduce a windowed/virtualized list (e.g. a small custom windowing hook, avoiding a new
heavy dependency) behind a size threshold (~100 items) for the 10 dashboard grids and the `CommandPalette`
result lists, reusing the existing `React.memo`-wrapped `*Card` components as row renderers.
Dependencies: none, but pairs naturally with N6 (regression-test the new windowing logic).

**N5. AI Response Buffer Truncation & Error Visibility**
`vite-plugin-ai-proxy.ts`'s stdin-piped invocation path (`invokeClaudeCli`, line ~207) only pushes stdout
chunks `if (totalBytes <= MAX_BUFFER)` (1MB) — bytes beyond that are **silently dropped**, not errored. A
large `generateCampaignFill`/`generateAdventure` response (multi-scene JSON, several full entities) that
exceeds 1MB comes back truncated mid-object, and the only symptom any persona sees is `claude-cli.ts`'s
generic "invalid JSON response" error with zero indication the real cause was silent truncation. This
corrupts or fails exactly the highest-value "AI does the heavy lifting" calls every persona relies on.
Personas: Lazy DM 4, Worldbuilder 4, Forever DM 3, Tactical DM 2, New DM 2 · **Aggregate 15**
Effort: **S** — fail fast with a clear "response exceeded buffer, try a smaller/simpler request" error
instead of silently truncating (raising `MAX_BUFFER` for schema-generation calls is a reasonable companion
change, but the fail-fast signal is the must-fix half); full chunked/SSE streaming is a larger, separate
NEXT item (X5).
Dependencies: none.

**N6. Component Test Infrastructure Bootstrap**
There is no `@testing-library/react` (or any render/interaction test tooling) anywhere in `package.json`.
`tests/components/` currently holds three files (`CombatTracker.test.ts`, `PlotTimeline.test.ts`,
`SceneSmartLinkBar.test.ts`) that exercise **pure extracted functions**, not actual component rendering —
none of the 13 editors, 9 dialogs, 6 hooks, or 2 visualizers have any mount-and-interact test coverage. This
is the single biggest risk multiplier sitting underneath nearly every structural item in NEXT/LATER (the
generic CRUD factory, generator consolidation, selection-state consolidation): without a render-test
harness, those refactors have no regression net beyond manual QA.
Personas: all (foundational). Value — 3/3/3/3/3 · **Aggregate 15**
Effort: **M** — add `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`;
configure Vitest's `jsdom` environment; build one render helper wrapping `ToastProvider`/confirm-dialog
context; land 2–3 exemplar tests (e.g. `DialogShell`'s focus trap, one editor's blur-commit dirty-check) to
prove the harness out before other teams build on it.
Dependencies: should land before X1 (generic CRUD factory), L1 (generator consolidation), and L6 (selection
state consolidation) — all three are far riskier to attempt blind.

---

### NEXT — Structural paydown + persona-facing features

**X1. Generic Entity CRUD Factory**
`services/campaignService.ts` hand-duplicates create/update/delete for all 12 entity types rather than
driving them from one parameterized helper — the exact reason cascade-deletion rules (already remediated
once via `_purgeEntityReferences`, called from `deleteNpc`/`deleteLocation`/`deleteFaction`/etc.) are easy to
apply to some entity types and forget for the next one added. A generic
`makeEntityCrud<T>(getArray, setArray, { onCreate?, onDelete? })` factory would make integrity rules a
one-time, centrally-enforced concern instead of a 12-times-repeated one.
Personas: Forever DM 5, Worldbuilder 4, Tactical DM 2, Lazy DM 2, New DM 1 · **Aggregate 14**
Effort: **L** — full rewrite of the CRUD triplets in a 1765-line file, one entity type at a time, with a
regression pass against `tests/campaignService.*.test.ts` and all 5 `tests/archetype.*.test.ts` files after
each type migrates.
Dependencies: N6 (test harness) strongly recommended first.

**X2. ModelTier Unification**
Two structurally incompatible types share the name `ModelTier`: `types/RealmChat.ts:29`
(`'performance' | 'medium' | 'quality'`, used by `RealmChatWidget.tsx`) vs.
`services/ai/modelConfig.ts:27` (`'lite' | 'standard' | 'quality'`, the one CLAUDE.md actually documents and
every provider in `services/ai/providers/*` uses). `services/ai/realmChat.ts` hand-rolls a private
`mapTierToModel` to bridge them instead of importing `modelConfig.ts`'s resolvers — a silent
wrong-model-tier risk with zero compiler protection since both are structurally valid string unions.
Personas: Lazy DM 3, Worldbuilder 3, New DM 2, Forever DM 2, Tactical DM 2 · **Aggregate 12**
Effort: **S** — rename the RealmChat-local type (e.g. `RealmChatModelTier`) and have
`RealmChatWidget.tsx`/`realmChat.ts` call `modelConfig.ts`'s `resolveGeminiModelName`/`mapTierToCliModel`
directly instead of maintaining a second mapping table.
Dependencies: none.

**X3. Audio Transcription Facade Compliance**
`services/ai/audioTranscription.ts` is imported directly by `SessionLogEditor.tsx` (lines 14–15), violating
CLAUDE.md's "components import ONLY from `aiService.ts`" rule. There's no `isMockMode` parameter and no
stub in `ai/mockService.ts` — it's the one AI-adjacent feature that can't be exercised offline/in tests, and
it still talks to `@google/genai`'s Gemini Live API directly with a raw `gcpApiKey`, entirely outside the
Claude migration the rest of the AI layer completed.
Personas: Lazy DM 4, Tactical DM 3, Forever DM 3, New DM 2, Worldbuilder 2 · **Aggregate 14**
Effort: **M** — add an `isMockMode`-aware `startAudioTranscription` wrapper + mock in `aiService.ts`/
`mockService.ts`, reroute `SessionLogEditor.tsx`'s import through it.
Dependencies: none.

**X4. DialogShell Portal + Background Inert**
`components/common/DialogShell.tsx` renders inline in the component tree (no `ReactDOM.createPortal`) and
never sets `aria-hidden`/`inert` on background content while open — every one of the app's ~10+ modals
(wizards, coaches, continuity checker, export) inherits this. A dialog opened from inside a container with
`overflow-hidden`/`transform`/`filter` on an ancestor can have its `fixed inset-0` backdrop clipped or
mispositioned, and a screen-reader user in browse mode (not just Tab order) can still reach content behind
an open modal.
Personas: all (every dialog in the app). Value — 3/3/3/3/3 · **Aggregate 15**
Effort: **M** — wrap `DialogShell`'s content in `createPortal(..., document.body)` and toggle
`aria-hidden`/`inert` on the app root's other children while `isOpen`; requires a manual pass over every
`DialogShell` consumer to confirm z-index/positioning still resolves correctly once portaled.
Dependencies: none, but do before N6's exemplar `DialogShell` test so the test captures the corrected
behavior.

**X5. Streaming AI Responses**
No streaming exists anywhere in the AI layer — `generateText`/`generateWithSchema`/`generateChatCompletion`
in `services/ai/providers/claude-cli.ts` are single buffered request/responses with up to a 120-second
timeout and zero progress feedback. Combined with N5's silent-truncation fix, this is the natural next step:
give the UI something to show during long quality-tier calls instead of a spinner.
Personas: Lazy DM 5, New DM 4, Worldbuilder 4, Forever DM 3, Tactical DM 2 · **Aggregate 18**
Effort: **L** — needs chunked/SSE plumbing through `vite-plugin-ai-proxy.ts`'s `/api/ai/generate` endpoint,
a streaming-aware method on the provider interface (`services/ai/providers/types.ts`), and incremental
rendering in the 7 `components/generators/*.tsx` forms plus `EntityChatGenerator.tsx`.
Dependencies: N5 (buffer/error handling) should land first so the streaming path doesn't inherit the same
silent-truncation failure mode.

**X6. Combat Encounter Full-State Archiving**
`handleEndCombat` (`components/views/SessionRunner.tsx`, line ~225) resets `campaign.activeEncounter` to
`{ combatants: [], round: 1, turnIndex: 0 }` and logs only a generic one-line `addAutoEvent` summary. Unlike
`endSession()` (`services/campaignService.ts`, ~line 1604), which properly pushes the outgoing encounter
onto `session.encounterLog`, ending combat *mid-session* (running two fights in one session and ending the
first before the second) permanently discards the first fight's full combatant/HP/round detail.
Personas: Tactical DM 5, Forever DM 3, New DM 1, Lazy DM 1, Worldbuilder 1 · **Aggregate 11**
Effort: **S** — push the outgoing `activeEncounter` onto `session.encounterLog` inside `handleEndCombat` (or
a new `campaignService.endCombat()` method) before clearing it, mirroring `endSession()`'s existing pattern.
Dependencies: none.

**X7. Structured Combat Essentials (AC display, HP delta, condition chips)**
Three related, long-standing gaps in `components/tools/CombatTracker.tsx`: (1) `Combatant.ac` (`types/
Encounter.ts:16`) is declared but never rendered anywhere in the tracker UI; (2) HP adjustment is ±1
steppers with no "apply N damage/healing" delta input; (3) `Combatant.notes?: string` is the only place to
track conditions — no chip system, no duration tracking, no standard 5e condition list. All three were
already identified as low-effort, high-value fixes in the prior UX audit and remain unaddressed.
Personas: Tactical DM 5, New DM 2, Lazy DM 2, Forever DM 1, Worldbuilder 1 · **Aggregate 11**
Effort: **M** — render the existing `ac` field (small UI change), add a delta-input control per combatant
row, and add a `conditions: string[]` field to `Combatant` (`types/Encounter.ts`) plus a picker/badge UI.
Dependencies: none; pairs well with L5 (structured NPC stat blocks) but doesn't require it.

**X8. Keyboard-Accessible Relationship Graph**
`components/visualizers/RelationshipGraph.tsx` wires node selection exclusively through
`nodeGroup.append('circle')...on('click', handleNodeClick)` with no `tabindex`, `role`, or `keydown` handler,
and the top-level `<svg>` has no `role`/`aria-label`. A keyboard-only or screen-reader user has no way to
discover or select any node — the graph is the single least accessible surface in the app, and it's one of
only two ways (with dashboards) to jump directly to an entity from its relationships.
Personas: Worldbuilder 5, Forever DM 2, New DM 1, Lazy DM 1, Tactical DM 1 · **Aggregate 10**
Effort: **M** — add an accessible fallback list (or make D3 node groups focusable with `tabindex=0`,
`role="button"`, Enter/Space handling mirroring the click handler) and a descriptive `role="img"`/
`aria-label` summarizing node/link counts on the `<svg>`.
Dependencies: none.

**X9. DM Coach & Wizard Reliability Polish**
Two small, high-friction bugs bundled together because both live in the "trust the app during a guided
flow" surface: (1) `DmCoach.tsx` calls `setPrompt('')` on every tool-tab switch, wiping in-progress typing;
(2) `FirstCampaignWizard.tsx`'s dismiss path (`DialogShell`'s Escape/backdrop-click, header ✕, footer "Skip")
all call `onDismiss` with zero confirmation, discarding all hand-edited NPC/location/adventure drafts, even
though the *much* lower-stakes "regenerate this step" action already gates itself behind
`useConfirmDialog`; (3) `handleStep4Next`'s batch-save loop (`for (const draft of npcDrafts) { ...
createNpc(...) }`, line ~345) has no per-item idempotency tracking, so retrying after a mid-loop failure
re-creates already-saved entities as duplicates.
Personas: New DM 5, Lazy DM 4, Forever DM 1, Tactical DM 1, Worldbuilder 1 · **Aggregate 12**
Effort: **S** — persist `DmCoach`'s prompt per-tool (`Record<CoachTool, string>` instead of one shared
string); route `FirstCampaignWizard`'s `onDismiss` through `useConfirmDialog` once step > 1 with unsaved
drafts; track which drafts have already been persisted in the batch-save loop so a retry only saves the
remainder.
Dependencies: none.

**X10. Entity-Type-Config & Factory Completeness**
`utils/entityUtils.ts`'s `ENTITY_TYPE_CONFIG` (line 12) is typed `Record<string, {...}>` rather than a
closed union of the actual supported entity keys, and has **no entry for `'secret'`** despite `Secret`
having full CRUD (`campaignService.createSecret`/`deleteSecret`) and being one of CLAUDE.md's twelve core
entity types. Separately, `createDefaultSecret`/`createDefaultNote`/`createDefaultPlayerCharacter` don't
exist alongside the other nine `createDefault*` factories — any future "quick add Secret/Note/PC" UI has no
canonical default to reach for. Today this is latent (nothing yet renders a Secret through
`ENTITY_TYPE_CONFIG`), but it's a one-line-away runtime crash (`Cannot read properties of undefined`) the
moment `Secret` is added to any `QuickCardEntityType`/`CommandPalette`/`RelationshipGraph` surface.
Personas: Worldbuilder 3, Forever DM 3, New DM 1, Lazy DM 1, Tactical DM 1 · **Aggregate 9**
Effort: **S** — add a `'secret'` entry, change the type to `Record<EntityTypeKey, {...}>` so a future
omission is a compile error, and add the three missing `createDefault*` factories.
Dependencies: none.

**X11. buildEntityContext Consolidation**
`utils/entityUtils.ts`'s `buildEntityContext` (line 74) is fully implemented and covered by 12 unit tests
in `tests/entityUtils.test.ts`, documented as "used as the `entityContext` prop on `RegenerateButton`" — but
has zero call sites in `components/`. All 9 editors (`NpcEditor.tsx`, `LocationEditor.tsx`, etc.) instead
build their own inline template string for the same purpose, each diverging slightly (different blank-field
filler text, inconsistent faction-name resolution). A fix to one copy's AI-regen context silently doesn't
apply to the other 8.
Personas: Worldbuilder 4, Forever DM 3, Lazy DM 2, New DM 1, Tactical DM 1 · **Aggregate 11**
Effort: **M** — wire `buildEntityContext` into the 9 editors' `RegenerateButton` usages, replacing the
inline template strings; verify against `tests/entityUtils.test.ts`'s existing expectations for each entity
type.
Dependencies: none.

---

### LATER — Depth features + larger structural bets

**L1. Generator Consolidation & Cancellation**
Six of the seven "quick generate" forms (`AdventureGenerator.tsx`, `ArticleGenerator.tsx`,
`ItemGenerator.tsx`, `FactionGenerator.tsx`, `SceneGenerator.tsx`, `LocationGenerator.tsx`,
`NpcGenerator.tsx`) are near-duplicate ~150–200 line files differing only in field config and prompt chips.
None of the AI calls anywhere in this layer use `AbortController` — a slow request that outlives the
component (unmount, campaign switch) still resolves and silently creates an entity via a stale closure.
Personas: Lazy DM 4, New DM 3, Worldbuilder 2, Forever DM 2, Tactical DM 1 · **Aggregate 12**
Effort: **L** — extract a shared, generic `QuickGeneratorForm` (or a `useQuickGenerate(generateFn)` hook)
parameterized by field config and the generate function; thread an `AbortController` through
`aiService.ts`'s generate functions, aborted on unmount.
Dependencies: N6 (test harness), so the consolidation has render-test coverage as it lands.

**L2. Component Render Test Coverage Expansion**
Building on N6's bootstrap, extend real render/interaction tests to the highest-risk untested surfaces:
the 13 editors' blur-commit/prop-reset lifecycle, the 9 dialogs' focus-trap/Escape behavior, and the 6
hooks' state-machine logic (`useEntitySelection`'s nav-stack, `useModalState`'s close-priority chain).
Personas: all (regression safety net). Value — 2/2/2/2/2 · **Aggregate 10**
Effort: **L** — ongoing; budget roughly one representative editor, one dialog, and `useEntitySelection`'s
back-navigation round-trip as the first wave.
Dependencies: N6.

**L3. Prep-to-Play Continuity Bridge**
`SessionPrepWizard.tsx` and `SessionRunner.tsx` don't currently carry loose ends/unresolved plot threads
forward from one session to the next — a Lazy DM re-prepping for session 12 gets no auto-surfaced summary
of what was left hanging in session 11, despite `Plot.status`/`session.plotProgressions` already tracking
exactly that data.
Personas: Lazy DM 5, Forever DM 4, New DM 2, Tactical DM 1, Worldbuilder 1 · **Aggregate 13**
Effort: **L** — surface unresolved (`status !== 'resolved'`) plots and the prior session's `plotProgressions`
in `SessionPrepWizard.tsx`'s opening step, and thread a "continue this thread" affordance into
`SessionRunner.tsx`'s scene/plot linking.
Dependencies: none directly, but benefits from X11 (consistent entity-context building) for any AI-assisted
recap generation involved.

**L4. Cross-Campaign Entity Reuse (Entity Library)**
Zero cross-campaign content reuse exists today — no entity-level "copy to campaign," no shared template
system, despite `campaignService.ts`'s multi-campaign model otherwise being sound. A Forever DM running a
long-lived setting across multiple concurrent campaigns has to hand-recreate recurring NPCs/factions in
each one.
Personas: Forever DM 5, Worldbuilder 3, New DM 1, Lazy DM 1, Tactical DM 1 · **Aggregate 11**
Effort: **XL** — needs a campaign-agnostic entity representation, a "copy to campaign" UI surfaced from
`EntityQuickCard.tsx`/dashboards, and ID-remapping logic analogous to `duplicateCampaign`'s existing
remap table but crossing campaign boundaries.
Dependencies: X1 (generic CRUD factory) makes the remapping/copy logic far less error-prone to implement
once, rather than 12 times.

**L5. Structured NPC Stat Blocks + Encounter Difficulty Calculator**
`NPC.stats` (`types/NPC.ts:21`) remains a freeform string ("could be a link to a stat block"), so AC/CR/
speed/saves/actions are never machine-readable. There's no encounter-difficulty calculator anywhere (no
XP-budget/CR-vs-party-level/Easy-Medium-Hard-Deadly signal), and `SceneGenerator.tsx` can't produce an
encounter-balance readout because it has no structured data to reason over.
Personas: Tactical DM 5, New DM 3, Lazy DM 1, Forever DM 1, Worldbuilder 1 · **Aggregate 11**
Effort: **L** — add structured optional fields to `types/NPC.ts` (AC, CR, speed, ability scores, actions)
without breaking the existing freeform `stats` field for backward compatibility, extend `NpcEditor.tsx` with
structured inputs, and add a difficulty calculator consuming those fields plus party level/size.
Dependencies: X7 (structured combat essentials) should land first — the condition/AC UI plumbing in
`CombatTracker.tsx` is shared groundwork.

**L6. Selection/Navigation State Consolidation**
`useEntitySelection.ts` fuses ID-selection state, a 20-entry navigation-history stack, breadcrumb
derivation, and recent-items tracking, threaded as roughly 40 individually-named props through
`App.tsx` → `ViewRouter.tsx` and `App.tsx` → `CampaignSidebar.tsx`. This is the direct structural cause of
CLAUDE.md's 13-step "add a new entity type" checklist — a forgotten setter in `ViewRouterProps` silently
breaks navigation for that one entity type with no compile-time signal tying the files together.
Personas: all (structural, indirect). Value — 2/2/2/2/2 · **Aggregate 10**
Effort: **XL** — collapse the per-entity id/setter/resolved-entity triplets into the existing
`EntitySelectionState` object (or a context provider) and re-verify all 13 entity types' navigation,
back-stack, and breadcrumb behavior.
Dependencies: N6 + L2 (needs render/interaction tests on `useEntitySelection`'s back-navigation round-trip
before attempting this safely).

**L7. Linking Engine Unification**
`components/common/LinkedText.tsx` still hand-rolls its own tokenizer/word-boundary matcher (line ~106)
instead of routing through `services/linking`'s `engineRegistry`/`getMatchingEngine()` the way
`SceneSmartLinkBar.tsx` and `LinkSuggestionsPanel.tsx` correctly do. The shared engine's Unicode word-
boundary bug was already fixed (`matchingEngine.ts` now uses `/[\p{L}\p{N}]/u`), but `LinkedText.tsx`'s
independent copy wasn't, so inline entity links in NPC/Location/Article descriptions and the "Detected"
suggestion UI a few lines above them in the same form can now disagree on the same text. The engine's match
`confidence` is also still hardcoded to `1.0`, so same-name collisions (two NPCs named "Marcus") are
resolved silently by array order with zero disambiguation signal to callers filtering on `minConfidence`.
Personas: Worldbuilder 4, Forever DM 2, New DM 1, Lazy DM 1, Tactical DM 1 · **Aggregate 9**
Effort: **M** — route `LinkedText.tsx` through `getMatchingEngine().findMatches()`, deleting its duplicate
tokenizer; add real confidence scoring (or at least surface tied-candidate ambiguity as multiple entity IDs
per match) to `TextMatchingEngine`.
Dependencies: none.

**L8. New-DM Onboarding Revamp**
`WelcomeScreen.tsx` remains close to a logo + tagline + one button; `CampaignCreator.tsx` has no seed
questions or "what good looks like" scaffolding for the Custom World textarea; there are no starter campaign
templates beyond the single "Winter's Daughter" default baked into `utils/demoTemplates.ts` (itself drifted
from the real `NPC`/`Location` types — missing required `history`/`relationships` fields — and 95% unused,
since `FirstCampaignWizard.tsx` only reads its `.setting` string).
Personas: New DM 5, Lazy DM 2, Forever DM 1, Tactical DM 1, Worldbuilder 1 · **Aggregate 10**
Effort: **L** — a 3-step value-explainer for `WelcomeScreen.tsx`, seed-question scaffolding in
`CampaignCreator.tsx`, and 2–3 real starter templates built from actual `NPC`/`Location`/`Faction` factories
(`utils/entityUtils.ts`'s `createDefault*` functions) rather than `demoTemplates.ts`'s drifted shadow types.
Dependencies: X10 (entity-type-config completeness) if starter templates are to include Secrets/Notes/PCs.

**L9. Import/Export Foreign-Tool Adapters**
`services/importExportService.ts` only round-trips Realmweaver's own JSON — no Obsidian/Markdown import, no
adapters for other worldbuilding tools. Export-to-Markdown exists (`importExportService.ts` has Markdown
generation for NPCs/Locations), but the reverse direction doesn't, so a Forever DM migrating from another
tool has no path in.
Personas: Forever DM 4, Worldbuilder 3, New DM 1, Lazy DM 1, Tactical DM 1 · **Aggregate 10**
Effort: **XL** — no existing parser scaffold; needs a new adapter interface, at minimum a Markdown/
frontmatter parser mapped onto the `NPC`/`Location`/`Article` shapes, plus the same required-array-field
defaulting `validateImportedCampaign` already does for native JSON imports.
Dependencies: none, but benefits from X1's cleaner CRUD surface to target.

---

## 4. Master Table

| Item | New DM | Lazy DM | Forever DM | Tactical DM | Worldbuilder | Aggregate | Effort | Priority | Dependencies |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| N1. CI Pipeline | 3 | 3 | 3 | 3 | 3 | 15 | S | P0 | none |
| N2. Tailwind Build Migration | 3 | 3 | 3 | 3 | 3 | 15 | M | P0 | none |
| N3. Session-Runner Data Durability | 2 | 5 | 4 | 5 | 2 | 18 | M | P0 | none |
| N4. Dashboard & Palette Virtualization | 1 | 2 | 5 | 2 | 5 | 15 | M | P0 | none |
| N5. AI Buffer Truncation & Error Visibility | 2 | 4 | 3 | 2 | 4 | 15 | S | P0 | none |
| N6. Component Test Infra Bootstrap | 3 | 3 | 3 | 3 | 3 | 15 | M | P0 | none |
| X1. Generic Entity CRUD Factory | 1 | 2 | 5 | 2 | 4 | 14 | L | P2 | N6 |
| X2. ModelTier Unification | 2 | 3 | 2 | 2 | 3 | 12 | S | P1 | none |
| X3. Audio Transcription Facade Compliance | 2 | 4 | 3 | 3 | 2 | 14 | M | P1 | none |
| X4. DialogShell Portal + Inert | 3 | 3 | 3 | 3 | 3 | 15 | M | P1 | none |
| X5. Streaming AI Responses | 4 | 5 | 3 | 2 | 4 | 18 | L | P2 | N5 |
| X6. Combat Encounter Full-State Archiving | 1 | 1 | 3 | 5 | 1 | 11 | S | P1 | none |
| X7. Structured Combat Essentials | 2 | 2 | 1 | 5 | 1 | 11 | M | P2 | none |
| X8. Keyboard-Accessible Relationship Graph | 1 | 1 | 2 | 1 | 5 | 10 | M | P2 | none |
| X9. DM Coach & Wizard Reliability Polish | 5 | 4 | 1 | 1 | 1 | 12 | S | P1 | none |
| X10. Entity-Type-Config Completeness | 1 | 1 | 3 | 1 | 3 | 9 | S | P1 | none |
| X11. buildEntityContext Consolidation | 1 | 2 | 3 | 1 | 4 | 11 | M | P2 | none |
| L1. Generator Consolidation & Cancellation | 3 | 4 | 2 | 1 | 2 | 12 | L | P3 | N6 |
| L2. Component Render Test Expansion | 2 | 2 | 2 | 2 | 2 | 10 | L | P3 | N6 |
| L3. Prep-to-Play Continuity Bridge | 2 | 5 | 4 | 1 | 1 | 13 | L | P3 | X11 (soft) |
| L4. Cross-Campaign Entity Reuse | 1 | 1 | 5 | 1 | 3 | 11 | XL | P3 | X1 |
| L5. Structured NPC Stat Blocks + Difficulty Calc | 3 | 1 | 1 | 5 | 1 | 11 | L | P3 | X7 |
| L6. Selection/Navigation State Consolidation | 2 | 2 | 2 | 2 | 2 | 10 | XL | P3 | N6, L2 |
| L7. Linking Engine Unification | 1 | 1 | 2 | 1 | 4 | 9 | M | P2 | none |
| L8. New-DM Onboarding Revamp | 5 | 2 | 1 | 1 | 1 | 10 | L | P3 | X10 (soft) |
| L9. Import/Export Foreign-Tool Adapters | 1 | 1 | 4 | 1 | 3 | 10 | XL | P3 | X1 (soft) |

*Priority tiers: **P0** = ship first (reliability/platform gate, NOW section). **P1** = highest value-density
after the gate. **P2** = solid density, do next. **P3** = valuable but lower density and/or large effort —
long-tail depth work.*

---

## 5. Per-Persona "If We Only Shipped Three Things" Shortlists

**New DM**
1. X9 — DM Coach & Wizard Reliability Polish (stop punishing exploration and accidental dismissal)
2. L8 — New-DM Onboarding Revamp (close the D+ onboarding gap directly)
3. X5 — Streaming AI Responses (a spinner reads as "is this broken?" to someone new to the app)

**Lazy DM**
1. N3 — Session-Runner Data Durability (never lose a fast improvised note again)
2. X5 — Streaming AI Responses (feedback during every "just generate it for me" wait)
3. L3 — Prep-to-Play Continuity Bridge (minimal prep means the app should remember what's unresolved)

**Forever DM**
1. N4 — Dashboard & Command Palette Virtualization (the app must not degrade as the world grows)
2. X1 — Generic Entity CRUD Factory (referential integrity has to scale past 12 hand-maintained copies)
3. L4 — Cross-Campaign Entity Reuse (years of world-building shouldn't be re-typed per campaign)

**Tactical DM**
1. X6 — Combat Encounter Full-State Archiving (a fight's detail should never just vanish)
2. X7 — Structured Combat Essentials: AC, HP delta, conditions (the core bookkeeping loop, done properly)
3. L5 — Structured NPC Stat Blocks + Encounter Difficulty Calculator (turn freeform stats into real tools)

**Worldbuilder**
1. X8 — Keyboard-Accessible Relationship Graph (the graph is currently invisible to a whole class of users)
2. N4 — Dashboard & Command Palette Virtualization (shared with Forever DM — deep lore means many entities)
3. L7 — Linking Engine Unification (one consistent linking behavior everywhere lore text is rendered)
