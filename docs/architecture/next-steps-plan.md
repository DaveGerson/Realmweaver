# Realmweaver — Next Steps Execution Plan

> **Created:** 2026-03-26
> **Scope:** All remaining work from gap analysis — audit items, technical debt, performance, testing, data robustness
> **Approach:** Phased execution with intelligent sequencing. Quick wins first, then building blocks, then features that depend on them.

---

## Audit Cross-Reference

Of the original 70 audit findings (UI-COMPONENT-AUDIT.md):
- **45 addressed** in DM Workflow Sprint + Phases 1-7
- **5 combat items intentionally deferred** (C2, H17, M19, M20 + H18 mobile)
- **20 remaining** (detailed below)

---

## Phase 1: Code Hygiene & Quick Wins

**Goal:** Clean slate before new work. All items are independent, S effort, zero risk.
**Estimated agents:** 1 (or inline)
**Files:** 3-5

| # | Item | File(s) | What |
|---|------|---------|------|
| 1.1 | Fix lucide-react import | `components/common/Textarea.tsx` | Change `import { Sparkles } from 'lucide-react'` to use `Icons.Sparkles` |
| 1.2 | Fix .docx import UX | `components/editors/SessionLogEditor.tsx` | Replace garbled silent failure with user-facing toast: "DOCX import not yet supported. Please paste text or use .txt/.md files." |
| 1.3 | Stale Google Search copy | Verify H2 is actually fixed — grep for "Google" references in AI prompts |
| 1.4 | Anthropic API stub cleanup | `services/ai/providers/anthropic-api.ts` | Add clear "coming soon" messaging; ensure provider selector UI doesn't let users pick it without warning |

**Gate:** `npm run build` clean, 115/115 tests pass.

---

## Phase 2: Remaining Audit Polish (Low-Priority Items)

**Goal:** Close out the remaining Low/Medium audit items to reach near-100% audit coverage.
**Estimated agents:** 3 parallel
**Files:** ~15

### Batch A — Accessibility & ARIA (6 items)

| # | Audit ID | Component | What |
|---|----------|-----------|------|
| 2.1 | L1 | WelcomeScreen | Add `<main>` landmark wrapper |
| 2.2 | L8 | SidebarSearch | Focus ring: `focus:ring-slate-*` → `focus:ring-amber-500` |
| 2.3 | L9 | SidebarSearch | Add `aria-label="Clear search"` to clear button |
| 2.4 | L2 | CampaignCreator | Add inline validation for title input (min length, required) |
| 2.5 | L3 | CampaignCreator | DM Style badges — differentiate duplicate amber colors (use archetype-specific tints or icons) |
| 2.6 | L7 | Header | Replace hardcoded z-index values with a z-index scale (`z-header`, `z-sidebar`, `z-dialog`, `z-toast`) via Tailwind config or CSS variables |

### Batch B — Dashboard & Navigation (5 items)

| # | Audit ID | Component | What |
|---|----------|-----------|------|
| 2.7 | L13 | CrossCampaignDashboard | Add empty state illustration/message when no campaigns exist |
| 2.8 | L15 | SessionLogDashboard | Verify search + keyboard nav consistency with other dashboards |
| 2.9 | M38 | CommandPalette | Wire scene selection to navigate to parent adventure → scene editor |
| 2.10 | L11 | CrossCampaignDashboard | Audit dynamic Tailwind class construction for CDN compatibility — replace computed classes with static variants |
| 2.11 | L12 | CrossCampaignDashboard | Delete confirm — ensure useConfirmDialog (already done in sprint?) or add timeout protection |

### Batch C — Dialog & Component Polish (4 items)

| # | Audit ID | Component | What |
|---|----------|-----------|------|
| 2.12 | H15 | DmCoach | Migrate to DialogShell for proper focus trap, Escape handling, aria-modal (currently has role="dialog" but no focus trap) |
| 2.13 | L6 | CampaignSidebar | Add right-click context menu on entity items (Rename, Delete, Open in New Tab) — or skip if not worth the complexity |
| 2.14 | C1 | RunningLog | Verify mobile persistent bar is fully functional — can DMs add notes from all 3 session tabs? Expand functionality if limited |
| 2.15 | L17 | EntityCreationPanel | Consider form-first default (chat intimidates new users) — or add "Try asking AI" prompt |

**Gate:** `npm run build` clean, all tests pass. Manual verification of DmCoach focus trap on Escape.

---

## Phase 3: Performance Optimization

**Goal:** Cut initial load time, reduce unnecessary re-renders for large campaigns.
**Estimated agents:** 2-3 parallel
**Files:** ~20
**Depends on:** Phase 2 complete (stable component tree before memoization)

### 3A — Code Splitting & Lazy Loading

| # | What | Impact |
|---|------|--------|
| 3.1 | Lazy-load all 7 dialogs (DmCoach, EvocationWizard, WorldSimWizard, ContinuityChecker, SessionPrepWizard, SessionEndWizard, ExportModal) with `React.lazy` + `Suspense` | ~150-200KB off initial bundle |
| 3.2 | Lazy-load visualizers (RelationshipGraph, PlotTimeline) | ~80KB off initial bundle (D3 + dagre) |
| 3.3 | Lazy-load template modules (dungeon-crawl, political-intrigue, sandbox-exploration, one-shot) — already chunked by Vite but verify | Confirm code-split |
| 3.4 | Add `React.Suspense` fallback component (SkeletonCard-based loading state) | UX for lazy boundaries |

### 3B — Memoization & Selector Optimization

| # | What | Impact |
|---|------|--------|
| 3.5 | Add `React.memo` to dashboard entity cards (10 dashboards) | Prevents re-render of all cards when one entity updates |
| 3.6 | Add `React.memo` to EntityQuickCard | Prevents re-render on hover/popover of neighboring cards |
| 3.7 | Add `React.memo` to CampaignSidebar section components | Prevents full sidebar re-render on entity CRUD |
| 3.8 | Memoize `activeCampaign` selector in App.tsx (already uses `useMemo` — verify dependencies are tight) | Reduces cascading re-renders |
| 3.9 | Consider `useDeferredValue` for search inputs in dashboards | Prevents typing jank on large entity lists |

**Gate:** `npm run build` — verify main chunk dropped below 800KB. Lighthouse audit before/after.

---

## Phase 4: Test Infrastructure & Coverage

**Goal:** Establish React component testing foundation; cover critical user paths.
**Estimated agents:** 2-3 parallel
**Files:** 15-20 new test files
**Depends on:** Phase 3 complete (memoized components are easier to test in isolation)

### 4A — Infrastructure Setup

| # | What |
|---|------|
| 4.1 | Install `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` |
| 4.2 | Configure Vitest with jsdom environment for component tests |
| 4.3 | Create test utilities: mock campaignService, mock AI service, render helper with providers (ToastProvider, ConfirmDialogProvider) |
| 4.4 | Create a `tests/components/` directory structure mirroring `components/` |

### 4B — Critical Path Tests

| # | Component | Test Coverage |
|---|-----------|--------------|
| 4.5 | Button | All 5 variants render correctly, size classes, disabled state, className override via twMerge |
| 4.6 | DialogShell | Focus trap activates, Escape closes, aria-modal present, scroll lock |
| 4.7 | useEntitySearch | Filters by name, handles title→name mapping, empty query returns all |
| 4.8 | useConfirmDialog | Opens, resolves true on confirm, resolves false on cancel |
| 4.9 | EntityCreationPanel | Toggles between chat and form modes |
| 4.10 | CampaignSidebar | Renders all sections, expand/collapse works, drag-drop state updates |

### 4C — Entity CRUD Tests

| # | Test Coverage |
|---|--------------|
| 4.11 | campaignService: createNpc/updateNpc/deleteNpc with cascade verification |
| 4.12 | campaignService: deleteAdventure cascade (activeSceneId cleared, SessionLog nulled) |
| 4.13 | campaignService: import/export round-trip (export → import → verify equality) |

**Gate:** 90%+ pass rate on new tests. Coverage report generated.

---

## Phase 5: Data Robustness

**Goal:** Protect user data from loss, corruption, and storage limits.
**Estimated agents:** 2
**Files:** 5-8
**Depends on:** Phase 4 (test infra available for validation tests)

| # | What | Risk Mitigated |
|---|------|----------------|
| 5.1 | Import validation — JSON schema check + version migration on campaign import | Corrupted imports crash app |
| 5.2 | Export validation — verify exported JSON round-trips cleanly before download | Silent data loss |
| 5.3 | Storage quota detection — check `navigator.storage.estimate()` or catch quota errors on save | Silent save failures on large campaigns |
| 5.4 | IndexedDB fallback — when localStorage quota exceeded, overflow to IndexedDB | Campaign size limit |
| 5.5 | Multi-tab conflict detection — use `BroadcastChannel` or `storage` event to warn when another tab modifies state | Last-write-wins data loss |
| 5.6 | Auto-backup — keep last 3 saves in a rotating buffer (localStorage or IndexedDB) | Recovery from corruption |

**Gate:** Unit tests for import validation, quota detection, and round-trip. Manual test: open 2 tabs, modify in one, verify warning in other.

---

## Phase 6: Combat Enhancement (Optional — User Deferred)

**Goal:** Bring combat tracker to "Theatre of the Mind minimum" per DM archetype spec.
**Estimated agents:** 2
**Files:** 3-5
**Depends on:** None (independent feature work)
**Note:** User previously said "other systems like DnD Beyond are better for that." Include only if user opts in.

| # | Audit ID | What | Effort |
|---|----------|------|--------|
| 6.1 | C2 | D&D 5e condition tracking — add `conditions: string[]` to `Combatant` type, condition picker dropdown, active condition badges on combatant rows | L |
| 6.2 | H17 | Previous Turn button | S |
| 6.3 | H18 | Responsive combat panel — `w-[500px]` → `w-full max-w-[500px]` | S |
| 6.4 | M19 | HP state indicators — visual badges for Bloodied (<50%), Down (0 HP), Dead | S |
| 6.5 | M20 | Initiative rolling mechanism — "Roll All" button that auto-assigns d20 rolls | M |

**Gate:** Build clean. Manual playtest: run a 4-combatant encounter through 3 rounds with conditions applied.

---

## Phase 7: Anthropic API Provider (Future)

**Goal:** Direct Anthropic API integration, removing Claude CLI dependency.
**Estimated agents:** 1-2
**Files:** 3-5
**Depends on:** Anthropic SDK availability, API key management UX

| # | What |
|---|------|
| 7.1 | Implement `generateStructuredContent` in anthropic-api.ts using Anthropic SDK tool_use |
| 7.2 | Implement `generateText` for plain text generation |
| 7.3 | Implement `chat` for multi-turn conversation |
| 7.4 | Add API key management UI in settings (encrypted localStorage or environment variable) |
| 7.5 | Add provider switching UI — allow users to choose claude-cli vs anthropic-api |
| 7.6 | Add rate limiting / token budget tracking |

**Gate:** E2E test: generate an NPC via Anthropic API, verify structured output matches type.

---

## Sequencing Rationale

```
Phase 1 (Hygiene)        ──→  Independent, removes noise
  │
Phase 2 (Audit Polish)   ──→  Depends on clean codebase
  │
Phase 3 (Performance)    ──→  Depends on stable component tree
  │
Phase 4 (Testing)        ──→  Depends on memoized components (easier isolation)
  │
Phase 5 (Data)           ──→  Depends on test infra (validation tests)
  │
Phase 6 (Combat)         ──→  Independent, user-deferred — execute if opted in
  │
Phase 7 (API Provider)   ──→  Independent, future — execute when ready
```

Phases 1-2 can run back-to-back quickly. Phase 3-5 build on each other.
Phases 6-7 are independent and can slot in anywhere.

---

## Execution Approach

Same pattern as Phases 1-7: parallel agents scoped to non-overlapping file sets, with build/test gates between phases. Each phase commits and pushes before the next begins.

**Estimated total:** ~5-7 execution sessions across all phases.
