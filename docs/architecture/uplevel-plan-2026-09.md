# Realmweaver Uplevel Plan — September 2026

> **Branch:** `claude/codebase-refactor-improvements-jn4m0d` · **Written:** 2026-09-23
> **Companion docs:** `docs/roadmap.md` (scored backlog, now updated), `docs/design/lazy-dm-lens.md`,
> `docs/design/unstructured-play.md`

This pass did two things at once:

1. **Folded in the Lazy DM toolkit.** `claude/dnd-unstructured-campaigns-dwsjxk` (Tonight's Table, the Stage,
   scene-as-menu, plot clocks, strong starts, secrets & clues, GM intrusions, quick tables, canon capture — 9
   commits, ~30k lines, ~30 new test files) is merged as the new base.
2. **Fanned out eight parallel work packages** over the open roadmap, each in an isolated worktree, each merged
   back as one reviewed, squashed commit with its own tests.

What follows is (A) what shipped and why it matters, (B) the larger changes this work now makes possible, in
dependency order, and (C) how to keep the system healthy while doing them.

---

## A. What shipped in this pass

| Package | Roadmap | What changed | Why it matters |
|---|---|---|---|
| **Lazy DM toolkit** | — | The unstructured-play branch, merged whole | The app's centre of gravity moves from "database of lore" to "what do I need at the table tonight" |
| **Store** | X1, X6 | `makeEntityCrud(key, spec)` drives CRUD for 11 collections; `makeHierarchy()` replaces duplicated Location/Article tree code; `endCombat()` archives mid-session fights; `endSession()` no longer logs blank encounters | Integrity rules (purge on delete, no-op on unknown id, cycle veto) are enforced once instead of hand-copied 11×. `campaignService.ts` −179 lines despite gaining features |
| **Combat** | X7, L5 (calc) | AC column, damage/heal delta input, 16 timed 5e condition chips, CR/level per combatant, `utils/encounterDifficulty.ts` XP-budget rating | The Tactical DM's core loop is finally structured data rather than a notes blob |
| **AI layer** | L1, X2 | `AbortSignal` from component → facade → provider → retry → proxy (which kills the `claude` child); `useAiRequest` hook; 7 near-duplicate generators collapsed onto `QuickGeneratorForm` with a Cancel button; one tier vocabulary via `modelConfig.toModelTier()` | No more stale generations creating entities after you navigated away; no orphaned CLI processes; one place to add streaming (see B1) |
| **Entity model** | X10, X11, X3/X9 residuals | `ENTITY_TYPE_CONFIG` typed against a closed `EntityTypeKey` (+ `secret` = fuchsia); every editor's regen context via `buildEntityContext`; AI Scribe reachable in Mock Mode; DM Coach keeps per-tool drafts | A missing entity config is now a compile error; AI regen quality no longer varies editor-to-editor |
| **UI platform** | X4, N4 | `DialogShell` portals to `body` and inerts the background via a modal stack; dashboards >100 items render incrementally; command palette caps at 50 with "N more" | Screen-reader users can't wander behind modals; a 300-NPC campaign renders 60 cards, not 300 |
| **Linking** | L7 | `LinkedText` routes through the shared engine; real confidence scores; aliases honoured; same-name collisions surfaced as `ambiguous` + `candidates`, never auto-applied; index cached per candidate array | Inline links, suggestions and auto-linking can no longer disagree, and "two NPCs named Marcus" is visible instead of silently wrong |
| **Continuity** | L3 | `utils/continuityThreads.ts` (built on `storyDerivations`) ranks loose ends; prep wizard gets an opt-in "Previously on…" carry-forward; the runner gets a click-to-navigate Loose Ends panel | Closes the Lazy DM loop: what was left hanging last session is in front of you when you prep the next |
| **Onboarding** | L8 | Build → Prep → Run explainer, template cards, "Prep in 15 minutes the Lazy DM way" path straight to Tonight's Table, seed questions + quality nudge in the creator | New DMs get a guided first 5 minutes, and the Lazy DM path is discoverable on day one |
| **Hygiene** | — | `tsconfig`/vitest exclude `.claude/` and `dist/`; a real timing bug in the `confirm-concurrency` ship test fixed (the PENDING race started before unmount) | Worktree-based parallel work no longer pollutes typecheck/test discovery; one chronic CI flake gone |

Every package landed with tests: the suite went from 1,020 tests (main) → 2,300 (after the Lazy DM merge) → **2,618 across 228 files after the eight packages, all green**, with typecheck clean and `vite build` succeeding.

---

## B. The bigger changes — proposed, in dependency order

Each item names what this pass unblocked, the concrete shape, and a size (S/M/L/XL as in `roadmap.md`).

### Wave 1 — finish the Lazy DM loop (highest user value)

**B1. Streaming generation (roadmap X5) — L, now much cheaper.**
The two hard prerequisites landed in this pass: cancellation is plumbed end to end, and the seven generators
are one component. Shape: an SSE route in `vite-plugin-ai-proxy.ts` (`claude --output-format stream-json`),
an optional `onDelta` in `providers/types.ts`, and a single streaming preview in `QuickGeneratorForm` +
`EntityChatGenerator`. The Stage-side zero-prompt tools (strong start, extras, GM intrusion) benefit most:
they're used live at the table, where a 30-second spinner is the difference between "useful" and "ignored".

**B2. One session loop, one state machine — M.**
Today the loop is spread across Tonight's Table, `SessionPrepWizard`, `SessionRunner`/Stage,
`SessionEndWizard` and canon capture, each deriving "where are we" independently. Make the loop explicit:
`SessionLog.status` plus a derived `sessionPhase` (`prep → live → wrap → recap`) with one selector in
`storyDerivations`, and let Tonight's Table become the single "next action" surface ("3 loose ends · strong
start missing · 2 secrets unrevealed · 1 clock about to fill"). `continuityThreads` and `lazyChecklist` are the
inputs; this is mostly wiring, not new data.

**B3. Player-facing companion view — M.**
The Lazy DM merge added a `'player-safe'` context variant (no GM prose, no unrevealed secrets). That is the
hard part of a player handout / recap surface. Ship a read-only "Table view" (revealed secrets as a clue
board, recap of last session, the party's known NPCs) that a GM can put on a second screen or export.

### Wave 2 — structure the game rules

**B4. SRD rules reference for the combat tracker — L.**
The tracker now has structured AC/CR/conditions but no rules text behind them. Import the SRD 5.2.1
(CC-BY-4.0) conditions and monster stat blocks as static data: condition chips show their rules text, "Add from
SRD" drops a monster's stat block into the encounter, and `encounterDifficulty` reads the same CR table. Pure
reference data — no AI involved.

**B5. Structured NPC stat blocks (rest of L5) — L.**
Add optional structured fields to `NPC` (AC, HP, CR, speed, abilities, actions) alongside the freeform
`stats` string, parse the freeform string opportunistically (the combat package already exports
`parseNpcCombatStats`), and let `SceneGenerator` produce a difficulty readout for its encounters.

### Wave 3 — structural paydown the new features lean on

**B6. Navigation state consolidation (roadmap L6) — XL, now tractable.**
`useEntitySelection` threads ~40 per-entity props through `App → ViewRouter → CampaignSidebar`. With
`EntityTypeKey` now a closed union, replace the per-type id/setter/resolved triplets with a single
`EntityRef = { type: EntityTypeKey; id: string }` selection plus a `NavigationContext`. This is also what
shrinks the 13-step "add an entity type" checklist to about 6.

**B7. Split `campaignService.ts` into slices — L.**
The CRUD factory makes the seams obvious: `entities` (factory + specs), `sessionRuntime` (Stage, scene menu,
clocks, combat), `integrity` (purge sweep, remap passes, migrations), `persistence` (autosave, conflict,
backups). Keep one `createCampaignStore` facade so no caller changes.

**B8. Implement the `anthropic-api` provider — M.**
It's a stub that throws, so a statically hosted build has no AI at all. Implement it server-side in the proxy
(never ship the key to the client) using tool-use for schema-enforced JSON, and document a minimal
deploy target (a small Node host serving `dist/` + `/api/ai/*`). This is the step from "runs on the GM's
laptop" to "shareable URL".

### Wave 4 — reach

**B9. Cross-campaign entity library (L4) — XL.** Now a spec-level concern thanks to the factory and the
existing two-pass remap: "copy to campaign" = remap one entity's owned ids into another campaign's pass.

**B10. Markdown / Obsidian import (L9) — XL.** Export already writes Obsidian; add the reverse through
`validateImportedCampaign` so migrating GMs have a way in.

---

## C. Keeping the system healthy

- **Test-suite runtime is now a real cost.** The suite grew from 1,020 to 2,618 tests; under
  parallel load, 5-second timeouts in jsdom-heavy ship tests show up as flakes. Recommended: shard `npm test`
  in CI (`vitest --shard`), set a per-file `testTimeout` for the handful of full-App render suites, and treat
  any recurring timeout as a bug in the test's timing assumptions (as the `confirm-concurrency` fix showed).
- **Bundle budget.** Add a CI check on the main chunk size before streaming and SRD reference data land, so
  growth is a conscious decision.
- **E2E the new loops.** Add Playwright journeys for: Welcome → Lazy DM path → Tonight's Table → Go Live →
  end session → next prep shows loose ends; and a dialog-over-dialog a11y check for the new inert behaviour.
- **Parallel-agent workflow.** This pass ran eight isolated worktrees against one base, told each agent the
  files it owned, re-based them mid-flight when the Lazy DM merge landed, and squash-merged each result. The
  only cross-package collision (onboarding's Lazy DM path vs. the new background-inert dialogs hiding
  Tonight's Table behind the auto-opened wizard) was caught by tests at merge time and fixed as a product
  decision. Repeat the pattern: disjoint file ownership, one base-change broadcast, merge-time full test run.
