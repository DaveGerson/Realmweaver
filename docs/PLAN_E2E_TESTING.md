# Execution Plan: E2E Test Coverage Expansion

> **Priority:** 1 (run before new features to catch regressions)
> **Predecessor:** Phases A-E complete, Playwright infrastructure ready
> **Estimated agents:** 1 (e2e-test-engineer), sequential test suites
> **Risk Level:** LOW (testing only, no production code changes)
> **Branch:** `test/e2e-coverage`

---

## Current State

- **Playwright:** Installed, configured (`playwright.config.ts`)
- **Projects:** chromium (desktop), mobile-chrome (Pixel 5)
- **Existing tests:** 5 smoke tests in `e2e/smoke.spec.ts`
- **Unit tests:** 97 passing across 8 Vitest files
- **App:** React SPA on localhost:3000, mock mode for offline testing

## Strategy

Every E2E test must:
1. Enable mock mode first (no API key dependency)
2. Create a fresh campaign if needed (tests are independent)
3. Use role-based selectors (`getByRole`, `getByText`, `getByLabel`)
4. Assert on visible UI state, not implementation details
5. Take screenshots at key steps for debugging

---

## Test Suites (Ordered by Priority)

### Suite 1: Campaign Lifecycle (`e2e/campaign.spec.ts`)

**Agent:** e2e-test-engineer
**Depends on:** None
**Priority:** CRITICAL — all other tests need campaigns

| Test | What it verifies |
|------|-----------------|
| Create campaign with custom setting | CampaignCreator → DM Style selector → campaign loads |
| Create campaign with official setting | Forgotten Realms dropdown → campaign loads |
| Switch between campaigns | Create 2 campaigns, switch, verify correct data |
| Delete campaign | Delete with confirmation, verify removed |
| Import/export campaign | Export JSON → import → verify entities match |
| Campaign persists across reload | Create campaign, reload page, verify still there |

### Suite 2: Entity CRUD (`e2e/entity-crud.spec.ts`)

**Agent:** e2e-test-engineer
**Depends on:** Suite 1 (needs campaign creation helper)
**Priority:** CRITICAL — core app functionality

| Test | What it verifies |
|------|-----------------|
| Generate NPC (mock mode) | Dashboard → Generate → form → submit → NPC appears in list |
| Edit NPC fields | Open editor → change name/description → blur → verify saved |
| Delete NPC | Delete button → confirm → removed from list |
| Generate Location | Same pattern as NPC |
| Generate Faction | Same pattern, verify member linkage |
| Generate Adventure with scenes | Adventure → verify scenes created |
| Create Article | Lorebook → create article |
| Create Plot | Plot dashboard → create plot |
| Generate Item | Item dashboard → generate |

### Suite 3: Navigation (`e2e/navigation.spec.ts`)

**Agent:** e2e-test-engineer
**Depends on:** Suite 2 (needs entities to navigate between)
**Priority:** HIGH — validates the entire navigation overhaul

| Test | What it verifies |
|------|-----------------|
| Sidebar navigation between views | Click NPC → Location → Faction → verify correct dashboard |
| EntityLink hover shows QuickCard | Hover NPC's faction link → card appears with details |
| EntityLink click navigates | Click faction link in NPC editor → faction editor opens |
| Back button returns to previous | Navigate NPC→Faction→Back → NPC editor again |
| Recent items in sidebar | Visit 3 entities → Recent section shows them in order |
| Pin entity from QuickCard | Hover → expand card → pin → verify in sidebar Pinned section |
| Unpin entity | Click unpin in sidebar → removed from Pinned |
| Command palette (Ctrl+K) | Open palette → type entity name → select → navigates |
| Breadcrumbs show path | Open NPC → breadcrumbs show Campaign > NPCs > NPC Name |
| Backlinks panel shows references | Create NPC in faction → faction editor shows NPC in Referenced By |

### Suite 4: Session Runner (`e2e/session-runner.spec.ts`)

**Agent:** e2e-test-engineer
**Depends on:** Suite 2
**Priority:** HIGH — validates the core gameplay loop

| Test | What it verifies |
|------|-----------------|
| Session Prep Wizard full flow | Open wizard → select adventure → scenes → review → go live |
| Session Runner loads with scene | Active scene panel shows title, read-aloud, NPCs |
| Scene advancement | Click "Next Scene" → new scene becomes active |
| Add note to running log | Type note → add → appears in log with timestamp |
| Beats mode | Add beat → check it off → verify completed state |
| Quick NPC generation | Quick NPC button → generate → preview → save → appears in scene |
| End session wizard | End session → recap generated → plots reviewed → session saved |

### Suite 5: DM Tools (`e2e/dm-tools.spec.ts`)

**Agent:** e2e-test-engineer
**Depends on:** Suite 4 (needs active session)
**Priority:** MEDIUM

| Test | What it verifies |
|------|-----------------|
| DM Coach — Narrate mode | Open coach → select Narrate → enter prompt → result appears |
| DM Coach — Template prompts | Chips visible → click chip → fills textarea |
| DM Coach — NPC Roleplay | Select Roleplay → pick NPC → send message → in-character response |
| DM Coach — Send to Notes | Generate result → Send to Notes → appears in running log |
| Combat Tracker — add combatants | Open tracker → add NPC combatant → roll initiative → display |
| Secrets Tracker — CRUD | Add secret → reveal it → filter by category → delete |
| Continuity Checker | Create orphaned NPC → open checker → issue appears |
| Dice Roller | Open roller → roll d20 → result appears |

### Suite 6: Editors — Tabbed Layout (`e2e/editors.spec.ts`)

**Agent:** e2e-test-engineer
**Depends on:** Suite 2
**Priority:** MEDIUM

| Test | What it verifies |
|------|-----------------|
| NPC editor tabs | All 4 tabs render, switching preserves data |
| Location editor tabs | All 4 tabs render, connections tab shows hierarchy |
| Faction editor tabs | All 3 tabs render, members list works |
| Scene editor tabs | All 3 tabs render, SceneResourcesPanel shows NPC details |
| Adventure editor tabs | All 3 tabs, scenes tab lists scenes |
| LinkedText auto-linking | Entity name in description renders as clickable link |
| Expandable QuickCard edit | Expand card → edit field → blur → verify saved |

### Suite 7: Mobile (`e2e/mobile.spec.ts`)

**Agent:** e2e-test-engineer
**Project:** mobile-chrome (Pixel 5 viewport)
**Depends on:** Suites 1-2
**Priority:** MEDIUM

| Test | What it verifies |
|------|-----------------|
| Sidebar opens as drawer | Hamburger button → sidebar slides in → backdrop visible |
| Sidebar closes on backdrop tap | Tap backdrop → drawer closes |
| Dashboard cards stack vertically | Cards in single column, no horizontal overflow |
| Session Runner mobile tabs | 3-tab layout: Scenes / Active / Tools |
| Touch targets min 44px | Key buttons meet minimum touch size |
| EntityQuickCard as bottom sheet | Tap EntityLink → card appears as bottom sheet |
| Command palette works on mobile | Ctrl+K or / → palette opens full-width |

### Suite 8: DM Style & Features (`e2e/dm-style.spec.ts`)

**Agent:** e2e-test-engineer
**Depends on:** Suite 1
**Priority:** LOW

| Test | What it verifies |
|------|-----------------|
| Guided mode hides advanced features | Create guided campaign → combat/secrets/graph not in sidebar |
| Power mode shows everything | Create power campaign → all features visible |
| Feature override toggle | Guided mode → open DM Style panel → enable combat → appears |
| Style persists across reload | Set power mode → reload → still power mode |

---

## Shared Test Helpers (`e2e/helpers.ts`)

Create reusable helpers:

```typescript
export async function enableMockMode(page: Page): Promise<void>
export async function createCampaign(page: Page, options?: { title?: string; dmStyle?: string }): Promise<void>
export async function navigateToView(page: Page, view: string): Promise<void>
export async function generateEntity(page: Page, type: string, prompt?: string): Promise<void>
export async function openEntityEditor(page: Page, entityName: string): Promise<void>
export async function startSession(page: Page): Promise<void>
```

---

## Execution Sequence

```
Suite 1 (Campaign) ──────────────────────────── [sequential, builds helpers]
   ↓
Suite 2 (Entity CRUD) ──┐
Suite 3 (Navigation)  ──┤ [parallel after Suite 1]
Suite 7 (Mobile)       ──┘
   ↓
Suite 4 (Session Runner) ──┐
Suite 5 (DM Tools)        ──┤ [parallel after Suite 2]
Suite 6 (Editors)          ──┘
   ↓
Suite 8 (DM Style) ──────── [last, independent]
   ↓
GATE: All suites pass on both chromium and mobile-chrome
```

## Gate Criteria

- All tests pass on `chromium` project
- All mobile tests pass on `mobile-chrome` project
- No flaky tests (run 3x, all pass)
- Coverage: every feature from Phases A-E has at least 1 E2E test
- `npm run build` still passes
- `npm test` (unit) still passes
