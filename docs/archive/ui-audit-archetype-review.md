# DM Archetype Technical UI Audit

> **Date:** 2026-03-22
> **Scope:** Component-level evaluation of Realmweaver UI through 5 DM Archetype lenses
> **Method:** Automated code-level analysis of 15 key components against archetype needs

---

## Executive Summary

| Archetype | Grade | Verdict |
|-----------|:-----:|---------|
| Prep-Heavy Worldbuilder | **C+** | Structure exists but stops one layer short of encyclopedic depth. No cross-references, no backlinks, no wiki-links. |
| Lazy DM / Improviser | **C+** | Right building blocks but structurally misaligned. Most flows add ceremony before content lands. |
| New/Nervous DM | **D+** | Designed for experienced DMs. Zero onboarding, no guidance, no confidence-building guardrails. |
| Tactical Combat DM | **C** | Minimum viable combat loop only. No AC in tracker, no conditions, no encounter balance, NPC stats are freeform strings. |
| Forever DM / Burnout-Risk | **C+** | Solid multi-campaign model; no cross-campaign content reuse, weak migration support, no session-to-session continuity bridge. |

**Lowest-hanging fruit across all archetypes:**
1. Add cross-entity navigation links in all editors (the routing infrastructure exists in App.tsx but is never wired to editors)
2. Add AC column to CombatTracker (field exists in type, never rendered)
3. Add damage/heal delta input to CombatTracker (replacing ±1 steppers)
4. Remove empty-prompt guard in NpcGenerator (or add "Surprise me" button)
5. Merge "Start Session" and "Go Live" into a single action

---

## Archetype 1: The Prep-Heavy Worldbuilder — Grade C+

### Component Scores

| Component | Grade | Key Issue |
|-----------|-------|-----------|
| CampaignSidebar | B | Global filter + article tree are great; entity sections show only names |
| NpcDashboard | D+ | Cards show only name + 2-line description; no faction badge, no relationship count |
| NpcEditor | B- | Rich fields (backstory, secrets, motivations); relationships are dead-end dropdowns |
| ArticleEditor | C | Hierarchy works; `relatedEntityIds` is flat checkboxes, only 3 article categories |
| RelationshipGraph | B | D3 force graph with entity type filters; no edge labels, no drill-down |

### Top Strengths
1. **Hierarchical Lorebook** — `CampaignSidebar.tsx` recursive `ArticleTreeItem` with cycle detection
2. **NPC Field Depth** — 7+ editable fields with per-field AI assist and `EntityHistoryManager`
3. **Multi-Entity Relationship Graph** — Location hierarchy, faction links, and connections all wired as edges

### Top Pain Points
1. **NPC Dashboard has no metadata on cards** — No faction badge, location tag, relationship count, or sort controls. Campaign with 40+ NPCs is unnavigable.
2. **Relationship editor is a dead end** — Plain `<select>` dropdowns with no "jump to entity" button. Every cross-reference requires manual sidebar navigation.
3. **Article `relatedEntityIds` is flat and untyped** — No distinction between "describes" and "mentions." No navigation to linked entities.
4. **Only 3 article categories** — `lore`, `history`, `cosmology`. Worldbuilders need 8-12 (geography, religion, bestiary, magic, etc.).
5. **Relationship Graph has no edge labels** — Unlabeled edges between 50+ nodes are visually indistinguishable.

### Critical Missing Features
- Global full-text search across all entity types
- `[[Wiki-link]]` syntax for inline entity mentions
- Backlinks panel (auto-list of entities referencing the current one)
- Entity tag/label system for multi-tag filtering
- Read-only "reader mode" for articles
- NPC location assignment field

### Priority Fixes
1. **(Low)** Add faction badge + relationship count to NPC dashboard cards
2. **(Low)** Expand article categories to 8-12
3. **(Medium)** Add edge labels to RelationshipGraph
4. **(Medium)** Add "Jump to entity" button on relationship rows and related entity lists
5. **(Medium)** Add backlinks section to NpcEditor and ArticleEditor
6. **(Medium-High)** Global full-text search / command palette
7. **(High)** Wiki-link syntax in text fields

---

## Archetype 2: The Lazy DM / Improviser — Grade C+

### Component Scores

| Component | Grade | Key Issue |
|-----------|-------|-----------|
| NpcGenerator | B | Single prompt + one click is great; requires non-empty prompt |
| EntityChatGenerator | C+ | Good conversational flow but no "save as-is" escape hatch |
| SessionLogEditor | C | Two tabs, structured tagging, confirmation dialog — friction during live play |
| DmCoach | B+ | 3-tool segmented control is fast; prompt clears on tool switch |
| RealmChatWidget | C | Draft approval modal adds mandatory review step |

### Top Strengths
1. **NpcGenerator single-field generation** — `NpcGenerator.tsx:105-134`: one textarea, one button
2. **DmCoach "Improviser" tool** — Perfectly framed for improv with "Send to Notes" button
3. **Live AI Scribe** — Microphone transcription means hands-free note-taking

### Top Pain Points
1. **DmCoach clears prompt on tool switch** — `DmCoach.tsx:78`: `setPrompt('')` wipes work when switching tabs
2. **NpcGenerator requires non-empty prompt** — `NpcGenerator.tsx:29-32`: blocks "just give me something" flow
3. **Ending a session requires 2 confirmations + tab switch** — 4 actions including a `window.confirm` interrupt
4. **RealmChat requires draft approval** — Mandatory review modal for every AI-proposed entity
5. **EntityChatGenerator has no "save now" escape hatch** — Must complete AI's preferred flow or abandon

### Critical Missing Features
- One-tap "Random Entity" button bypassing prompt requirement
- Persistent prompt memory across DmCoach tool tabs
- "Quick Note" global hotkey for 2-second improv capture
- 8-step Lazy DM prep template for SessionLogEditor
- Auto-open Live Scribe on session start

### Priority Fixes
1. **(Low)** Remove empty-prompt guard or add "Surprise me" button
2. **(Low)** Preserve DmCoach prompt across tool switches (use `Record<CoachTool, string>`)
3. **(Low)** Replace `window.confirm()` with inline confirmation UI
4. **(Medium)** Add "Save Now" shortcut to EntityChatGenerator and RealmChat
5. **(Medium)** Add 8-step Lazy DM prep template

---

## Archetype 3: The New/Nervous DM — Grade D+

### Component Scores

| Component | Grade | Key Issue |
|-----------|-------|-----------|
| WelcomeScreen | D | Near-empty; zero onboarding value |
| CampaignCreator | C | Good defaults but no guidance on "what does good look like" |
| CampaignSelector | C- | Empty state gives no direction; delete is unguarded |
| EvocationWizard | B- | Most hand-holding in app; mode names are jargon |
| CombatTracker | D | Pure bookkeeping; no rules hints, no difficulty signals |

### Top Strengths
1. **Official Setting default** — `CampaignCreator.tsx:22-23`: Forgotten Realms pre-selected reduces blank-canvas paralysis
2. **Reassuring micro-copy** — "Start with the big picture. You can add details later."
3. **Google Search lore hint** — Amber note signals "the AI knows this world"

### Top Pain Points
1. **WelcomeScreen is essentially empty** — Logo, tagline, one button. No explanation, no feature teaser, no onboarding.
2. **Custom World textarea has no scaffolding** — Placeholder is a meta-instruction, not an example. No seed questions.
3. **CampaignSelector empty state is a dead end** — "You haven't created any campaigns yet." with no link or guidance.
4. **EvocationWizard uses insider jargon** — "Ingest" is a developer term. "Evocation" is unexplained D&D jargon.
5. **CombatTracker has zero rules assistance** — No CR/difficulty indicator, no condition reference, no danger warnings.

### Critical Missing Features
- Guided onboarding / first-run wizard
- Starter campaign templates (Classic Dungeon Crawl, Town Mystery, etc.)
- Difficulty/complexity indicators on features
- Tooltips and contextual help on all major features
- Encounter difficulty feedback in CombatTracker
- Progress indicators ("your campaign is ready to play")
- Campaign delete confirmation dialog

### Priority Fixes
1. **(Low)** Add confirmation dialog to campaign delete
2. **(Low)** Replace WelcomeScreen with 3-step value explainer
3. **(Low-Medium)** Add setting description prompts/examples
4. **(Medium)** Add mode descriptions to EvocationWizard tabs; rename "Ingest" to "Import Text"
5. **(Medium)** Add starter campaign templates
6. **(Higher)** Add encounter difficulty indicator using existing `estimatePcHp` utility

---

## Archetype 4: The Tactical Combat DM — Grade C

### Component Scores

| Component | Grade | Key Issue |
|-----------|-------|-----------|
| CombatTracker | C+ | No AC column, no conditions, HP delta missing, no stat-block peek |
| NpcEditor | D+ | `stats` is unstructured string; no structured stat-block fields |
| SceneGenerator | D | No encounter-balance output, no combatant list, no CR/difficulty |
| types/Encounter.ts | C | `ac` is optional but never rendered; no condition array |
| types/NPC.ts | D | `stats: string` — freeform blob; no AC, CR, speed, saves, actions |

### Top Strengths
1. **Color-coded HP thresholds** — Green/yellow/red at-a-glance feedback
2. **Roster tab for quick-add** — Click campaign NPC/PC directly into combat
3. **Round counter prominently displayed** — Large, high-contrast, always visible

### Top Pain Points
1. **AC is typed but never shown** — `Encounter.ts:15` declares `ac?: number`; tracker UI never renders it
2. **HP adjustment is ±1 steppers** — No "apply 17 damage" input. Must click 17 times or overwrite field.
3. **Conditions are freeform notes** — No chip system, no duration tracking, no 5e condition list
4. **NPC stats are freeform string** — Fragile regex to extract HP; AC/CR/speed inaccessible
5. **No encounter difficulty calculator** — No XP budget, no CR-vs-party-level, no Easy/Medium/Hard/Deadly

### Critical Missing Features
- AC column in combat tracker (field exists, UI absent)
- Bulk damage/heal delta input
- Structured condition chip system (14 standard 5e conditions)
- Structured NPC stat block fields (AC, CR, speed, ability scores, actions)
- Encounter difficulty calculator
- Stat block quick-view sidebar during combat
- Multi-select damage application (AoE)
- Concentration/duration tracking

### Priority Fixes
1. **(Low)** Render existing `ac` field in tracker grid — ~20-line change
2. **(Low)** Add damage/heal delta input per combatant row
3. **(Medium)** Add structured condition chip system
4. **(Medium)** Add structured NPC stat block fields to type and editor
5. **(Medium)** Add encounter difficulty calculator

---

## Archetype 5: The Forever DM / Burnout-Risk — Grade C+

### Component Scores

| Component | Grade | Key Issue |
|-----------|-------|-----------|
| campaignService.ts | B | Multi-campaign model sound; no cross-campaign APIs |
| CampaignSelector | C | Full-page navigation to switch; shows only title + setting |
| SessionLogEditor | B+ | AI recap + live mic are strong; auto-save ergonomic |
| importExportService.ts | D+ | JSON round-trip only; no import from external tools |
| Header | C+ | Campaign switch is 2-click dropdown; tool labels hidden on small screens |

### Top Strengths
1. **AI session recap generation** — One button converts raw notes to narrative recap, saving 20-30 min
2. **Multi-campaign persistence always-on** — All campaigns stored, switching restores context
3. **Live microphone transcription** — Hands-free note-taking during play

### Top Pain Points
1. **Campaign switching requires full navigation** — No keyboard shortcut, no recent-campaigns tray
2. **Campaign selector shows zero statistics** — No entity counts, last session date, or player count
3. **Import accepts only Realmweaver JSON** — No Notion, World Anvil, or Obsidian import
4. **Header campaign-switch is buried in a 2-click dropdown** — No visual hierarchy for power users
5. **Zero cross-campaign content reuse** — No entity cloning, no template system

### Critical Missing Features
- Entity-level copy-to-campaign
- Obsidian/Markdown import (export exists, import doesn't)
- Foreign tool import adapters
- Campaign dashboard/overview with statistics
- Quick-switch keyboard shortcut
- Auto-carry loose ends to next session
- Cross-campaign plot/arc tracking

### Priority Fixes
1. **(Low)** Add entity counts to CampaignSelector cards
2. **(Low)** Promote "Switch Campaign" to persistent header button + keyboard shortcut
3. **(Low)** Auto-carry loose ends when creating new SessionLog
4. **(Medium)** Add entity-level "Copy to Campaign" action
5. **(Medium)** Add Obsidian markdown import
6. **(High)** Implement campaign-agnostic Entity Library for cross-campaign reuse
