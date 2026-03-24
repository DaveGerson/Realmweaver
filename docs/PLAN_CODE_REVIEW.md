# Execution Plan: Code Review Pass

> **Priority:** 2 (after E2E tests, before new features)
> **Scope:** All changes from Phases C, D, E (Phases A-B were reviewed in prior sessions)
> **Estimated agents:** 3 (code-reviewer, security-reviewer, architect)
> **Risk Level:** LOW (review only, fixes are targeted)
> **Branch:** `fix/code-review-pass`

---

## Review Scope

### Files Changed (Phases C-E)

**144 total source files**, key areas:

| Area | Files | Lines | Concern |
|------|-------|-------|---------|
| `services/campaignService.ts` | 1 | 1916 | God object risk, method count, performance |
| `components/views/SessionRunner.tsx` | 1 | 1389 | Largest component, many responsibilities |
| `App.tsx` | 1 | 1029 | Routing + state — prop threading depth |
| `services/contextBuilder.ts` | 1 | 397 | Token estimation accuracy |
| `services/continuityChecker.ts` | 1 | 489 | Rule correctness, false positives |
| `services/ai/*.ts` | 6 | 1401 | Prompt quality, error handling |
| `components/editors/*.tsx` | 12 | ~4500 | Tab layout data loss, BacklinksPanel perf |
| `components/dashboards/*.tsx` | 9 | ~2500 | Card rendering perf with 100+ entities |
| `components/dialogs/*.tsx` | 4 | ~2000 | Modal z-index, accessibility |
| `components/tools/*.tsx` | 3 | ~800 | SecretsTracker, CombatTracker state |
| `utils/*.ts` | 4 | ~700 | backlinkUtils, dmStyleUtils, diceUtils |

---

## Review Tracks (Run in Parallel)

### Track A: Performance Review

**Agent:** code-reviewer
**Focus:** Can the app handle a large campaign (100+ NPCs, 50+ locations, 20+ sessions)?

| Check | What to look for | Where |
|-------|-----------------|-------|
| **Render perf** | Dashboards re-rendering all cards on any state change | All dashboards |
| **BacklinksPanel** | `computeBacklinks` called on every render in every editor | `BacklinksPanel.tsx`, `backlinkUtils.ts` |
| **LinkedText scanning** | Entity name map rebuilt on every text change | `LinkedText.tsx` |
| **EntityQuickCard portals** | Many open portals if rapid hover | `EntityLink.tsx` |
| **CampaignSidebar** | Full entity list re-rendering on any state change | `CampaignSidebar.tsx` |
| **contextBuilder** | Token counting on every AI call | `contextBuilder.ts` |
| **useSyncExternalStore** | Excessive re-renders from campaignService subscription | All consumers |
| **Continuity checker** | Runs on every state change (via memo in App.tsx) | `App.tsx`, `continuityChecker.ts` |

**Remediation patterns:**
- `React.memo` for pure list items
- `useMemo` with proper dependency arrays
- Debounce continuity checker (run max once per 5 seconds)
- Virtual scrolling for 100+ item lists (if needed)

### Track B: Accessibility & UX Review

**Agent:** code-reviewer
**Focus:** ARIA labels, keyboard navigation, screen reader support, color contrast

| Check | What to look for | Where |
|-------|-----------------|-------|
| **ARIA attributes** | `aria-label`, `aria-expanded`, `role` on interactive elements | All new components |
| **Keyboard navigation** | Can you tab through all interactive elements? Focus trapping in modals? | Modals, QuickCard, TabLayout |
| **Focus management** | After modal close, does focus return to trigger? | DmCoach, ContinuityChecker, SessionPrepWizard |
| **Color-only indicators** | Do any states rely solely on color? (colorblind users) | Category badges, severity indicators |
| **Screen reader text** | Are icon-only buttons labeled? | Pin/unpin, expand/collapse, back button |
| **Touch targets** | 44px minimum on mobile for all interactive elements | Mobile layout |
| **Escape key** | Closes topmost modal | All dialogs |
| **Skip links** | Can keyboard users skip sidebar navigation? | Layout |

### Track C: Security & Correctness Review

**Agent:** security-reviewer
**Focus:** XSS via entity names, injection via AI responses, data integrity

| Check | What to look for | Where |
|-------|-----------------|-------|
| **XSS via entity names** | Entity names rendered as `dangerouslySetInnerHTML`? | LinkedText, EntityLink, QuickCard |
| **AI response injection** | AI-generated content rendered raw? | DmCoach results, RealmChat messages |
| **localStorage size** | Can a large campaign exceed 5MB localStorage limit? | campaignService persistence |
| **Data integrity** | Can cascade deletion leave orphaned references? | campaignService delete methods |
| **Import validation** | Is imported JSON validated before use? | importExportService |
| **Speech API permissions** | Is microphone permission requested gracefully? | SessionRunner voice capture |
| **Prototype pollution** | `Object.assign` or spread with untrusted data? | campaignService, contextBuilder |

### Track D: Architecture & Consistency Review

**Agent:** architect
**Focus:** Pattern consistency, naming conventions, dead code

| Check | What to look for | Where |
|-------|-----------------|-------|
| **Icon imports** | Any remaining direct `lucide-react` imports? | All components |
| **Named exports** | Any `export default` usage? | All files |
| **Type imports** | All types through `types/index.ts` barrel? | All files |
| **Service facade** | Any direct `ai/` module calls from components? | All components |
| **Dead code** | Unused imports, unreachable branches, commented-out code | All files |
| **Prop drilling depth** | Props passed through 4+ levels? Candidates for context | App.tsx → editors |
| **Inconsistent patterns** | Some editors use `campaign.dmStyle`, others don't | All editors |
| **File size** | Any component over 500 lines? Decomposition candidates | SessionRunner, App.tsx, campaignService |
| **Error boundaries** | Are AI errors handled gracefully? No white screen? | All AI-calling components |
| **Mock mode coverage** | Every AI function has mock implementation? | mockService.ts vs geminiService.ts |

---

## Execution Sequence

```
Track A (Performance) ──┐
Track B (Accessibility) ─┤ [all 3 parallel]
Track C (Security)      ──┘
         ↓
Track D (Architecture) ──── [sequential, may reference findings from A-C]
         ↓
Fix Pass ───────────────── [address HIGH/CRITICAL findings]
         ↓
GATE: Build + test pass, no CRITICAL findings open
```

## Severity Classification

| Severity | Definition | Action |
|----------|-----------|--------|
| CRITICAL | Data loss, security vulnerability, crash | Must fix before merge |
| HIGH | Performance regression, accessibility barrier | Fix in this pass |
| MEDIUM | Inconsistency, minor UX issue | Fix if time allows |
| LOW | Style nit, optional improvement | Document for later |

## Gate Criteria

- All CRITICAL findings fixed
- All HIGH findings fixed or documented with mitigation plan
- `npm run build` passes
- `npm test` passes (97 unit + 5 E2E)
- No new TypeScript errors introduced by fixes
