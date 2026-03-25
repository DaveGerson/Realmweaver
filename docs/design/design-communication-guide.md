# Realmweaver Design Communication Guide

> **Date:** 2026-03-18
> **Purpose:** Actionable design specifications for the 4 UI proposals from `UI_DESIGN_EVALUATION.md`
> **Audience:** UI Engineers, UX Designers, Frontend Developers

---

## How to Read This Document

Each proposal is translated from narrative description into **implementable specifications** using industry-standard design communication formats:

| Section | What It Contains | Who Uses It |
|---------|-----------------|-------------|
| **Design Tokens** | Exact color values, typography, spacing, motion | Engineers (CSS/Tailwind config) |
| **Component Specs** | Anatomy, variants, states, sizes | Engineers (React components) |
| **Layout Wireframes** | ASCII wireframes with annotations | Engineers + Designers (structure) |
| **Interaction Specs** | Animations, transitions, triggers | Engineers (CSS/JS transitions) |
| **User Flows** | Step-by-step navigation paths | Engineers + QA (integration) |
| **Acceptance Criteria** | Definition of done checklists | QA + Engineers (validation) |

### Notation Conventions

```
[Button Label]     = clickable button
(Link Text)        = clickable link
{dynamic-content}  = variable/data-driven content
●                  = active/selected indicator
...                = truncated content
▼                  = dropdown/expandable
→                  = navigation/flow direction
```

---

## Table of Contents

1. [Shared Foundations](#shared-foundations)
2. [Proposal A: Arcane Codex](#proposal-a-arcane-codex)
3. [Proposal B: Command Center](#proposal-b-command-center)
4. [Proposal C: Storyboard](#proposal-c-storyboard)
5. [Proposal D: Adaptive Forge](#proposal-d-adaptive-forge)
6. [Implementation Priority Matrix](#implementation-priority-matrix)

---

## Shared Foundations

These specifications apply across all proposals unless explicitly overridden.

### Entity Type Color System

All proposals use entity-type color coding. This is the shared palette:

| Entity Type | Color Name | Hex Value | Tailwind Class | Usage |
|-------------|-----------|-----------|----------------|-------|
| NPC | Amber | `#d4a853` | `amber-400` | Card left-border, sidebar icon, graph node |
| Location | Forest Green | `#5a8a5a` | `emerald-600` | Card left-border, sidebar icon, graph node |
| Faction | Royal Purple | `#7a5aaa` | `violet-500` | Card left-border, sidebar icon, graph node |
| Item | Steel Blue | `#5a7a9a` | `sky-600` | Card left-border, sidebar icon, graph node |
| Adventure | Flame Orange | `#c47a3a` | `orange-500` | Card left-border, sidebar icon, graph node |
| Article | Ink Blue | `#4a6a8a` | `cyan-700` | Card left-border, sidebar icon, graph node |
| Session Log | Slate | `#94a3b8` | `slate-400` | Card left-border, sidebar icon |
| Plot | Rose | `#e11d48` | `rose-600` | Card left-border, sidebar icon |
| Player Character | Lime | `#84cc16` | `lime-500` | Card left-border, sidebar icon |

### Component State Conventions

All interactive elements across all proposals follow this state model:

| State | Visual Change | Transition |
|-------|--------------|------------|
| Default | Base styles | — |
| Hover | Background lightens 1 shade, border brightens | 150ms ease-out |
| Active/Pressed | Background darkens 1 shade, scale(0.98) | 50ms ease-in |
| Focus | 2px ring in accent color, 2px offset | 0ms (instant) |
| Disabled | opacity: 0.5, cursor: not-allowed | 0ms |
| Loading | Spinner replaces label, disabled interaction | 150ms fade |

### Accessibility Requirements (All Proposals)

- Minimum touch target: 44×44px
- Text contrast: ≥ 4.5:1 against background (WCAG AA)
- UI element contrast: ≥ 3:1 against adjacent colors
- Focus indicators: visible on all interactive elements
- Keyboard: full navigation via Tab, Enter/Space to activate, Escape to dismiss
- Screen reader: `aria-label` on icon-only buttons, `aria-live` for dynamic content
- Reduced motion: respect `prefers-reduced-motion` media query

### Responsive Breakpoints

| Name | Width | Layout Behavior |
|------|-------|----------------|
| `mobile` | < 640px | Single column, sidebar as overlay |
| `tablet` | 640–1023px | Sidebar collapsible, 2-col grid |
| `desktop` | 1024–1439px | Fixed sidebar + content |
| `wide` | ≥ 1440px | Fixed sidebar + wider content + optional right panel |

---

## Proposal A: Arcane Codex — Thematic Immersion Overhaul

> **Philosophy:** Transform the UI from "dark developer tool" into "magical artifact"
> **Primary Archetype:** Storyteller | **Secondary:** Worldbuilder

### A.1 Design Tokens

#### A.1.1 Color Palette

| Token Name | Hex | RGB | Tailwind Override | Usage |
|-----------|-----|-----|-------------------|-------|
| `codex.bg.primary` | `#1a1510` | `26, 21, 16` | `bg-stone-950` custom | Page background, app shell |
| `codex.bg.secondary` | `#2a2218` | `42, 34, 24` | `bg-stone-900` custom | Cards, panels, sidebar |
| `codex.bg.elevated` | `#3d3428` | `61, 52, 40` | `bg-stone-800` custom | Hover surfaces, tooltips |
| `codex.accent.gold` | `#d4a853` | `212, 168, 83` | `text-amber-400` custom | Primary actions, AI features, active states |
| `codex.accent.gold.hover` | `#e0bc6a` | `224, 188, 106` | — | Hover on gold elements |
| `codex.accent.teal` | `#4a9e8e` | `74, 158, 142` | `text-teal-500` custom | Links, secondary interactive |
| `codex.accent.teal.hover` | `#5db8a6` | `93, 184, 166` | — | Hover on teal elements |
| `codex.danger` | `#a83232` | `168, 50, 50` | `text-red-700` custom | Delete, destructive actions |
| `codex.text.primary` | `#e8dcc8` | `232, 220, 200` | `text-stone-200` custom | Headings, primary text |
| `codex.text.secondary` | `#9a8b74` | `154, 139, 116` | `text-stone-400` custom | Descriptions, helper text |
| `codex.border` | `#3d3428` | `61, 52, 40` | `border-stone-700` custom | Card borders, dividers |
| `codex.border.glow` | `rgba(212,168,83,0.3)` | — | — | Hover border glow on cards |

**Contrast Verification:**
- `codex.text.primary` on `codex.bg.primary`: 11.2:1 ✅
- `codex.text.secondary` on `codex.bg.primary`: 5.1:1 ✅
- `codex.accent.gold` on `codex.bg.primary`: 7.3:1 ✅
- `codex.accent.gold` on `codex.bg.secondary`: 5.8:1 ✅

#### A.1.2 Typography

| Token | Value | CSS | Usage |
|-------|-------|-----|-------|
| `codex.font.heading` | Cinzel | `font-family: 'Cinzel', serif` | All headings (h1–h6), sidebar section headers |
| `codex.font.body` | Roboto | `font-family: 'Roboto', sans-serif` | Body text, form inputs, descriptions |
| `codex.font.size.xs` | 12px / 0.75rem | `font-size: 0.75rem` | Captions, timestamps |
| `codex.font.size.sm` | 14px / 0.875rem | `font-size: 0.875rem` | Body text, sidebar items |
| `codex.font.size.md` | 16px / 1rem | `font-size: 1rem` | Input text, prominent body |
| `codex.font.size.lg` | 20px / 1.25rem | `font-size: 1.25rem` | Section headings (h3) |
| `codex.font.size.xl` | 24px / 1.5rem | `font-size: 1.5rem` | Page titles (h2) |
| `codex.font.size.2xl` | 32px / 2rem | `font-size: 2rem` | Hero headings (h1) |
| `codex.font.weight.normal` | 400 | `font-weight: 400` | Body text |
| `codex.font.weight.medium` | 500 | `font-weight: 500` | Sidebar items, labels |
| `codex.font.weight.bold` | 700 | `font-weight: 700` | Headings |
| `codex.font.line-height` | 1.6 | `line-height: 1.6` | Body text |
| `codex.font.heading-height` | 1.2 | `line-height: 1.2` | Headings |

**CDN Load (add to index.html):**
```html
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
```

#### A.1.3 Motion Tokens

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `codex.motion.fast` | 150ms | ease-out | Hover color/border changes |
| `codex.motion.normal` | 250ms | ease-in-out | Panel slides, card expansion |
| `codex.motion.slow` | 400ms | ease-in-out | Page transitions, modal entrance |
| `codex.motion.glow` | 2000ms | ease-in-out | Pulsing glow on AI elements (infinite loop) |
| `codex.motion.ritual` | 3000ms | linear | AI generation circle animation (infinite loop) |

#### A.1.4 Shadows & Effects

| Token | Value | Usage |
|-------|-------|-------|
| `codex.shadow.card` | `0 2px 8px rgba(0,0,0,0.4)` | Default card shadow |
| `codex.shadow.card.hover` | `0 4px 16px rgba(0,0,0,0.5), 0 0 8px rgba(212,168,83,0.15)` | Card hover (warm glow) |
| `codex.shadow.panel` | `4px 0 16px rgba(0,0,0,0.5)` | Sidebar, slide-out panels |
| `codex.shadow.inner` | `inset 0 2px 4px rgba(0,0,0,0.3)` | Textarea, input fields |

### A.2 Component Specifications

#### A.2.1 Entity Card (Arcane Codex variant)

**Anatomy:**
```
┌─────────────────────────────────────────┐
│▌ ┌────┐                                │  ▌ = entity type color border (3px)
│▌ │icon│  {Entity Name}                 │  icon = entity type icon (20×20)
│▌ └────┘  {subtitle/epithet}            │  Name: Cinzel 16px bold
│▌─────────────────────────────────────── │  subtitle: Roboto 12px, text.secondary
│▌                                        │
│▌ "{description truncated to 2 lines...}"│  description: Roboto 14px italic
│▌                                        │
│▌ ┌──────┐ ┌──────┐ ┌──────┐           │  tags: 12px, pill shape
│▌ │ tag1 │ │ tag2 │ │ tag3 │           │  bg: codex.bg.elevated
│▌ └──────┘ └──────┘ └──────┘           │  text: entity type color
│▌                                        │
│▌                        {last modified} │  timestamp: 12px, text.secondary
└─────────────────────────────────────────┘

Dimensions: min-width 280px, max-width 400px, min-height 160px
Background: codex.bg.secondary
Border: 1px solid codex.border
Border-left: 3px solid {entity-type-color}
Border-radius: 8px
Padding: 16px
Shadow: codex.shadow.card
```

**States:**

| State | Border | Shadow | Background | Transition |
|-------|--------|--------|------------|------------|
| Default | `codex.border` | `codex.shadow.card` | `codex.bg.secondary` | — |
| Hover | `codex.border.glow` | `codex.shadow.card.hover` | `codex.bg.secondary` | 150ms ease-out |
| Active | `codex.border` | `codex.shadow.card` | `codex.bg.elevated` | 50ms |
| Selected | entity color border all sides | `codex.shadow.card.hover` | `codex.bg.secondary` | 150ms |

**Tag Pills:**
- Background: `codex.bg.elevated`
- Text color: matching entity type color
- Border-radius: 9999px (full pill)
- Padding: 2px 8px
- Font: Roboto 12px

#### A.2.2 AI Generator Panel (Arcane Codex variant — "Ritual Circle")

**Anatomy:**
```
┌─────────────────────────────────────────────────────┐
│                                                     │  bg: codex.bg.secondary
│    ╭─────── ✦ Invoke the Weave ✦ ───────╮         │  Header: Cinzel 18px, gold
│    │                                     │         │
│    │  ┌─────────────────────────────┐   │         │  textarea bg: codex.bg.primary
│    │  │                             │   │         │  textarea border: codex.border
│    │  │  {prompt textarea}          │   │         │  inner-shadow: codex.shadow.inner
│    │  │                             │   │         │  font: Roboto 14px
│    │  │                             │   │         │  min-height: 100px
│    │  └─────────────────────────────┘   │         │
│    │                                     │         │
│    │  (Model: ▼)           [✦ Conjure]  │         │  Button: gold bg, dark text
│    │                                     │         │  ✦ = sparkle icon
│    ╰─────────────────────────────────────╯         │
│                                                     │  Outer border: decorative
└─────────────────────────────────────────────────────┘   dashed gold at 30% opacity

During generation:
- Button shows spinner + "Weaving..."
- The decorative border pulses with codex.motion.glow
- Textarea becomes read-only (opacity: 0.7)
```

**Decorative Border CSS:**
```css
.ritual-border {
  border: 2px dashed rgba(212, 168, 83, 0.3);
  border-radius: 12px;
  padding: 24px;
}
.ritual-border.generating {
  animation: ritual-pulse 2s ease-in-out infinite;
}
@keyframes ritual-pulse {
  0%, 100% { border-color: rgba(212, 168, 83, 0.2); }
  50% { border-color: rgba(212, 168, 83, 0.6); }
}
```

#### A.2.3 Button Variants

| Variant | Background | Text | Border | Icon | Usage |
|---------|-----------|------|--------|------|-------|
| `primary` | `#d4a853` (gold) | `#1a1510` (dark) | none | optional | Main CTAs, generate actions |
| `secondary` | `codex.bg.elevated` | `codex.text.primary` | `codex.border` | optional | Cancel, secondary actions |
| `ghost` | transparent | `codex.accent.teal` | none | optional | Inline actions, links |
| `danger` | transparent | `codex.danger` | `codex.danger` | TrashIcon | Delete actions |
| `ai` | `#d4a853` | `#1a1510` | none | SparkleIcon ✦ | AI-powered generation |

**All buttons:** height 40px, padding 12px 16px, border-radius 8px, Roboto 14px medium

### A.3 Layout Wireframe

```
┌──────────────────────────────────────────────────────────────┐
│  HEADER  bg: codex.bg.secondary  h: 56px                    │
│  [⚗ Logo]  {Campaign Title}  ···  [✦ Evocation] [⚔ Session]│
├──────────────┬───────────────────────────────────────────────┤
│  SIDEBAR     │  MAIN CONTENT                                │
│  w: 260px    │  bg: codex.bg.primary                        │
│  bg: codex   │                                              │
│  .bg.secondary│  Breadcrumb: Campaign > NPCs                │
│              │                                              │
│  ┌─ search ─┐│  ╭─── ✦ Invoke the Weave ✦ ───╮            │
│  └──────────┘│  │  [prompt area]               │            │
│              │  │  (Model ▼)      [✦ Conjure]  │            │
│  CAMPAIGN    │  ╰──────────────────────────────╯            │
│  ▸ Setting   │                                              │
│              │  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  WORLD       │  │▌NPC Card │ │▌NPC Card │ │▌NPC Card │     │
│  ● NPCs     │  │▌         │ │▌         │ │▌         │     │
│    Locations │  │▌         │ │▌         │ │▌         │     │
│    Factions  │  └──────────┘ └──────────┘ └──────────┘     │
│    Items     │                                              │
│              │  ┌──────────┐ ┌──────────┐                   │
│  STORY       │  │▌NPC Card │ │▌NPC Card │                   │
│    Adventures│  │▌         │ │▌         │                   │
│    Lorebook  │  └──────────┘ └──────────┘                   │
│              │                                              │
│  SESSION     │                                              │
│    Logs      │                                              │
│    Plots     │                                              │
│    PCs       │                                              │
│              │                                              │
│  TOOLS       │                                              │
│    Combat    │                                              │
│    Graph     │                                              │
├──────────────┴───────────────────────────────────────────────┤
│  STATUS BAR: ✓ Saved · {time}         codex.bg.secondary    │
└──────────────────────────────────────────────────────────────┘
```

### A.4 Welcome Screen Wireframe

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                 bg: radial gradient from                     │
│                 codex.bg.primary center                      │
│                 to rgba(212,168,83,0.05) edges               │
│                                                              │
│                        ·  . ·                                │
│                     ·    ✦    ·          CSS particle effect  │
│                        ·  . ·           (ember/firefly dots) │
│                                                              │
│                    ⚗ REALMWEAVER                             │  Cinzel 48px, gold
│                                                              │
│              "Forge worlds. Weave stories.                   │  Roboto 18px, text.secondary
│               Command the narrative."                        │
│                                                              │
│               [✦ Create New Campaign]                        │  Primary button, large (h:56px)
│               (Load Existing Campaign)                       │  Ghost link, teal
│                                                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### A.5 Empty State Spec

Each entity dashboard shows a themed empty state when no entities exist:

| Entity Type | Illustration Concept | Flavor Text | CTA |
|-------------|---------------------|-------------|-----|
| NPCs | Empty tavern with chairs | "Every great story needs its cast of characters." | [✦ Conjure Your First NPC] |
| Locations | Blank map with compass | "The world awaits its cartographer." | [✦ Conjure Your First Location] |
| Factions | Empty throne room | "Power abhors a vacuum." | [✦ Conjure Your First Faction] |
| Items | Empty treasure chest | "Legends are forged, not found." | [✦ Conjure Your First Item] |
| Adventures | Unlit torch | "The road goes ever on..." | [✦ Conjure Your First Adventure] |
| Articles | Blank tome | "Knowledge is the true magic." | [✦ Conjure Your First Article] |

**Empty state layout:** Centered, illustration (SVG or CSS-only) max 200×200px, flavor text below in Cinzel italic 16px gold, CTA button below.

### A.6 Interaction Specifications

#### Sidebar Texture Effect (CSS gradient, no images)
```css
.codex-sidebar {
  background:
    linear-gradient(180deg, rgba(42,34,24,0.97) 0%, rgba(26,21,16,0.97) 100%),
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(212,168,83,0.02) 2px,
      rgba(212,168,83,0.02) 4px
    );
}
```

#### AI Generation Loading Animation
```css
@keyframes arcane-charge {
  0% { transform: scale(1); opacity: 0.3; }
  50% { transform: scale(1.05); opacity: 0.7; }
  100% { transform: scale(1); opacity: 0.3; }
}
.ai-generating .ritual-border {
  animation: arcane-charge 2s ease-in-out infinite;
  box-shadow: 0 0 20px rgba(212, 168, 83, 0.2);
}
```

#### Drop Cap on Article First Paragraphs
```css
.article-content p:first-of-type::first-letter {
  font-family: 'Cinzel', serif;
  font-size: 3.5rem;
  float: left;
  line-height: 1;
  margin-right: 8px;
  color: #d4a853;
}
```

### A.7 Acceptance Criteria

#### AC-A1: Color System
- [ ] All `slate-*` classes replaced with custom warm equivalents
- [ ] All `indigo-*` accent classes replaced with gold (`#d4a853`) tokens
- [ ] Teal (`#4a9e8e`) used for secondary interactive elements
- [ ] All color combinations pass WCAG AA contrast (4.5:1 text, 3:1 UI)

#### AC-A2: Typography
- [ ] Cinzel font loaded via CDN, applied to all `h1`–`h6` and section headers
- [ ] Roboto retained for body text with warm text colors
- [ ] Drop caps render on article first paragraphs
- [ ] No FOUT (flash of unstyled text) — use `font-display: swap`

#### AC-A3: Cards
- [ ] Entity cards show 3px left border in entity type color
- [ ] Cards have warm inner shadow and glow on hover
- [ ] Tags display as pills with entity-type-colored text
- [ ] Hover animation completes in ≤ 150ms

#### AC-A4: AI Generator
- [ ] Decorative dashed gold border around generator panel
- [ ] Border pulses during generation (2s cycle)
- [ ] Generate button shows sparkle icon (✦)
- [ ] Textarea has inner shadow effect

#### AC-A5: Welcome Screen
- [ ] Particle/ember effect renders (CSS-only, no canvas)
- [ ] Cinzel heading at 48px in gold
- [ ] Tagline in Roboto 18px
- [ ] Respects `prefers-reduced-motion` (disable particles)

#### AC-A6: Empty States
- [ ] Each entity dashboard shows themed empty state
- [ ] Empty state includes illustration, flavor text, and CTA
- [ ] CTA triggers generator with appropriate entity type

---

## Proposal B: Command Center — Information Density & Efficiency Focus

> **Philosophy:** Optimize for power users who treat campaign management like a professional workflow
> **Primary Archetype:** Tactician | **Secondary:** Improviser

### B.1 Design Tokens

#### B.1.1 Color Palette

| Token Name | Hex | RGB | Usage |
|-----------|-----|-----|-------|
| `cmd.bg.primary` | `#0f1117` | `15, 17, 23` | Page background |
| `cmd.bg.secondary` | `#1a1d27` | `26, 29, 39` | Cards, panels |
| `cmd.bg.elevated` | `#252833` | `37, 40, 51` | Hover surfaces, active panels |
| `cmd.bg.input` | `#12141c` | `18, 20, 28` | Input fields, textareas |
| `cmd.accent.indigo` | `#818cf8` | `129, 140, 248` | User actions, navigation, selection |
| `cmd.accent.indigo.hover` | `#a5b4fc` | `165, 180, 252` | Hover on indigo elements |
| `cmd.accent.cyan` | `#22d3ee` | `34, 211, 238` | AI-specific features, AI buttons |
| `cmd.accent.cyan.hover` | `#67e8f9` | `103, 232, 249` | Hover on cyan elements |
| `cmd.text.primary` | `#e2e8f0` | `226, 232, 240` | Primary text |
| `cmd.text.secondary` | `#94a3b8` | `148, 163, 184` | Secondary text, labels |
| `cmd.text.muted` | `#64748b` | `100, 116, 139` | Placeholders, disabled |
| `cmd.border` | `#334155` | `51, 65, 85` | Borders (crisper than current) |
| `cmd.status.green` | `#22c55e` | `34, 197, 94` | Success, healthy |
| `cmd.status.amber` | `#f59e0b` | `245, 158, 11` | Warning, caution |
| `cmd.status.red` | `#ef4444` | `239, 68, 68` | Error, danger |

**Visual Language:**
- **Indigo = human action** (buttons, nav, selections)
- **Cyan = AI action** (AI generate, AI suggest, AI analyze)
- Entity type colors from Shared Foundations apply to borders and icons

**Contrast Verification:**
- `cmd.text.primary` on `cmd.bg.primary`: 13.8:1 ✅
- `cmd.text.secondary` on `cmd.bg.primary`: 7.2:1 ✅
- `cmd.accent.indigo` on `cmd.bg.primary`: 6.1:1 ✅
- `cmd.accent.cyan` on `cmd.bg.primary`: 10.4:1 ✅

#### B.1.2 Typography

| Token | Value | CSS | Usage |
|-------|-------|-----|-------|
| `cmd.font.heading` | Inter | `font-family: 'Inter', sans-serif` | All headings |
| `cmd.font.body` | Inter | `font-family: 'Inter', sans-serif` | Body text |
| `cmd.font.mono` | JetBrains Mono | `font-family: 'JetBrains Mono', monospace` | Stat blocks, data tables, code |
| `cmd.font.size.xs` | 11px / 0.6875rem | `font-size: 0.6875rem` | Table data, timestamps |
| `cmd.font.size.sm` | 13px / 0.8125rem | `font-size: 0.8125rem` | Body text, sidebar (denser) |
| `cmd.font.size.md` | 14px / 0.875rem | `font-size: 0.875rem` | Input text, labels |
| `cmd.font.size.lg` | 16px / 1rem | `font-size: 1rem` | Section headings |
| `cmd.font.size.xl` | 20px / 1.25rem | `font-size: 1.25rem` | Page titles |

**CDN Load:**
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

#### B.1.3 Motion Tokens

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `cmd.motion.instant` | 0ms | — | State toggles, selections |
| `cmd.motion.fast` | 100ms | ease-out | Hover effects |
| `cmd.motion.normal` | 200ms | ease-in-out | Panel resize, slide |
| `cmd.motion.slow` | 300ms | ease-in-out | Modal, command palette |

### B.2 Component Specifications

#### B.2.1 Command Palette (Ctrl+K)

**Anatomy:**
```
┌──────────────────────────────────────────────────────┐
│  🔍 {search query}                              [×] │  h: 48px, Inter 16px
├──────────────────────────────────────────────────────┤  bg: cmd.bg.secondary
│                                                      │  border: cmd.border
│  RECENT                                              │  Section header: 11px uppercase
│  ┌──────────────────────────────────────────────┐   │    tracking-wider, text.muted
│  │  👤  Thalindra Moonshadow          NPC      │   │  Row h: 40px
│  │  📍  The Whispering Woods          Location │   │  Icon: entity type color
│  │  ⚔️  Battle of Thornwall          Scene     │   │  Name: 14px text.primary
│  └──────────────────────────────────────────────┘   │  Type badge: 11px text.secondary
│                                                      │
│  ACTIONS                                             │
│  ┌──────────────────────────────────────────────┐   │
│  │  ✨  Generate NPC...               Ctrl+G N  │   │  Shortcut: mono 11px text.muted
│  │  ✨  Generate Location...          Ctrl+G L  │   │  ✨ = cyan color (AI action)
│  │  📋  Open Combat Tracker           Ctrl+T    │   │
│  │  🗺️  View Relationship Graph       Ctrl+R    │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ↑↓ Navigate  ↵ Select  esc Close                   │  Footer: 11px text.muted
└──────────────────────────────────────────────────────┘

Overlay: rgba(0,0,0,0.5) backdrop
Panel: max-width 640px, centered, top 20% of viewport
Shadow: 0 16px 48px rgba(0,0,0,0.5)
Border-radius: 12px
Max results: 10 visible, scrollable
Fuzzy search: match against entity name, type, tags, description
```

**Keyboard Interactions:**
| Key | Action |
|-----|--------|
| `Ctrl+K` / `Cmd+K` | Open/close palette |
| `↑` / `↓` | Navigate results |
| `Enter` | Select highlighted result |
| `Escape` | Close palette |
| Type text | Filter results (fuzzy match) |
| `>` prefix | Filter to actions only |
| `@` prefix | Filter to entities only |

#### B.2.2 Panel System Layout

**Anatomy:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  HEADER  h: 48px  bg: cmd.bg.secondary                             │
│  [Logo] {Campaign} (▼)  ···  [⌘K] [✨ Evoke] [⚔ Session] [≡]     │
├────┬─────────────────────────────────────┬───────────────────────────┤
│    │                                     │                           │
│ L  │  CENTER PANEL                       │  RIGHT PANEL              │
│ E  │  flex: 1                            │  w: 320px (resizable)     │
│ F  │                                     │  min: 280px, max: 480px   │
│ T  │                                     │                           │
│    │  {Dashboard / Editor content}       │  {Context panel}          │
│ P  │                                     │  - Entity quick view      │
│ A  │                                     │  - AI chat                │
│ N  │                                     │  - Quick reference        │
│ E  │                                     │                           │
│ L  │                                     │                           │
│    │                                     │                           │
│ w: │                                     │                           │
│ 48 │                                     │                           │
│ px │                                     │                           │
│ rail                                     │                           │
│ or │                                     │                           │
│ 240│                                     │                           │
│ px │                                     │                           │
│ exp│                                     │                           │
├────┴─────────────────────────────────────┴───────────────────────────┤
│  STATUS: {save} · {time}        {active session indicator}          │
└──────────────────────────────────────────────────────────────────────┘

Left panel: toggles between icon rail (48px) and expanded (240px) via Ctrl+B
Right panel: toggleable via Ctrl+/ or header button
Drag handle: 4px wide, cursor: col-resize, bg: cmd.border on hover
```

**Icon Rail (collapsed sidebar):**
```
┌────┐
│ ⚙  │  Setting
│ 👤 │  NPCs
│ 📍 │  Locations
│ 🏰 │  Factions
│ ⚔  │  Items
│────│
│ 📖 │  Adventures
│ 📚 │  Lorebook
│────│
│ 📝 │  Sessions
│ 📊 │  Plots
│ 🎭 │  PCs
│────│
│ ⚔  │  Combat
│ 🗺  │  Graph
└────┘
Each icon: 48×48px touch target
Tooltip on hover: entity type name
Active: indigo background highlight
```

#### B.2.3 List View (Dashboard alternate)

**Anatomy — NPC List View:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  ┌─ Filter ──────────────────────────────────────────────────────┐  │
│  │  🔍 {filter}   [Type ▼] [Faction ▼] [Sort: Name ▼]  ≡ │ ⊞  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                            ≡=list ⊞=grid
│  ┌─────┬─────────────────────┬────────┬──────────┬────────┬──────┐ │
│  │     │ Name ▲              │ Race   │ Class    │Faction │ Mod  │ │  header
│  ├─────┼─────────────────────┼────────┼──────────┼────────┼──────┤ │
│  │ ▌👤 │ Thalindra Moonshadow│ H-Elf  │ Ranger   │ Emerald│ 2d   │ │  row h: 40px
│  │ ▌👤 │ Brok Ironforge       │ Dwarf  │ Fighter  │ —      │ 5d   │ │  ▌= entity color
│  │ ▌👤 │ Sera Nightwhisper    │ Tiefling│ Warlock │ Shadow │ 1h   │ │  hover: bg.elevated
│  └─────┴─────────────────────┴────────┴──────────┴────────┴──────┘ │
│                                                                      │
│  Showing 3 of 47 NPCs  ·  [< 1 2 3 ... 10 >]                      │
└──────────────────────────────────────────────────────────────────────┘

Columns are sortable (click header to toggle asc/desc)
▲ = current sort column and direction
Click row → open editor in center panel
Ctrl+Click row → open in right panel (pinned preview)
Double-click cell → inline edit (name, race, class only)
```

**Column Definitions by Entity Type:**

| Entity | Col 1 | Col 2 | Col 3 | Col 4 | Col 5 |
|--------|-------|-------|-------|-------|-------|
| NPC | Name | Race | Class | Faction | Modified |
| Location | Name | Type | Parent | # Children | Modified |
| Faction | Name | Type | # Members | Influence | Modified |
| Item | Name | Type | Rarity | Magical? | Modified |
| Adventure | Name | # Scenes | Status | # NPCs | Modified |
| Article | Name | Category | Parent | Word Count | Modified |

#### B.2.4 Split-View Editing

```
┌──────────────────────────────┬──────────────────────────────┐
│  LEFT ENTITY (pinned)        │  RIGHT ENTITY (browsing)     │
│                              │                              │
│  {NPC Editor: Thalindra}     │  {NPC Editor: Brok}         │
│                              │                              │
│  ┌──────────────────────┐   │  ┌──────────────────────┐   │
│  │  Name: [           ] │   │  │  Name: [           ] │   │
│  │  Race: [           ] │   │  │  Race: [           ] │   │
│  │  ...                 │   │  │  ...                 │   │
│  └──────────────────────┘   │  └──────────────────────┘   │
│                              │                              │
│  [📌 Pinned]   [✕ Close]    │  [📌 Pin]     [✕ Close]     │
└──────────────────────────────┴──────────────────────────────┘

Activated by: Ctrl+Click entity in list, or [📌 Pin] button in editor
Drag handle between panels for resize
```

#### B.2.5 Session Mode Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  HEADER  bg: cmd.bg.secondary  ⚡ SESSION LIVE  {elapsed: 01:32:15} │
│  [Logo] {Campaign}  ···  🎲  📝  [End Session]                      │
├────┬─────────────────────────────────┬───────────────────────────────┤
│    │  ┌──────────────┬──────────────┐│                               │
│ ≡  │  │  INITIATIVE  │  ACTIVE      ││  DM COACH                    │
│ rail│  │  TRACKER     │  SCENE       ││  RIGHT PANEL                 │
│    │  │              │              ││  always open                  │
│ 48 │  │  1. Thalin ●│  "The party  ││                               │
│ px │  │  2. Goblin 1 │  enters..."  ││  [Narration]                 │
│    │  │  3. Brok     │              ││  [Dialogue]                  │
│    │  │  4. Goblin 2 │  NPCs here:  ││  [Plot Twist]               │
│    │  │              │  - Tavern    ││  [Rollable Table]            │
│    │  │              │    keeper    ││                               │
│    │  ├──────────────┼──────────────┤│  ┌─────────────────────────┐ │
│    │  │  QUICK NPC   │  SESSION     ││  │ AI chat area            │ │
│    │  │  LOOKUP      │  NOTES       ││  │                         │ │
│    │  │              │              ││  │                         │ │
│    │  │  🔍 [search] │  {live note  ││  └─────────────────────────┘ │
│    │  │  results...  │   capture}   ││  [Send to Coach]             │
│    │  │              │              ││                               │
│    │  └──────────────┴──────────────┘│                               │
├────┴─────────────────────────────────┴───────────────────────────────┤
│  ⚡ Session Live · 3 players · Scene 2/5 · Last note: 4m ago        │
└──────────────────────────────────────────────────────────────────────┘

Changes from Prep mode:
- Sidebar collapses to icon rail automatically
- Text base size increases: 13px → 16px
- Right panel opens with DM Coach permanently
- Center panel switches to 2×2 configurable grid
- Generators, import/export hidden
- Entity names become hover-peek targets
- Floating action buttons: 🎲 (dice), 📝 (quick note)
```

**Hover-Peek Card (on entity name hover anywhere):**
```
╭──────────────────────────────────╮
│ 👤 Thalindra Moonshadow        │  Entity icon + name
│ Half-Elf Ranger · Emerald Guard │  Race/class · Faction
│─────────────────────────────────│
│ Personality: Cautious, witty    │  Key fields only
│ Goal: Find the lost artifact    │  (not full editor)
│ Last seen: Session 4            │
│─────────────────────────────────│
│ (Click to open full editor)     │  12px text.muted
╰──────────────────────────────────╯

Appears: 300ms hover delay
Position: below cursor, flip if near edge
Shadow: cmd.shadow.elevated
Max-width: 320px
```

#### B.2.6 Keyboard Shortcuts Reference

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Open command palette |
| `Ctrl+B` | Toggle sidebar expand/collapse |
| `Ctrl+/` | Toggle right panel |
| `Ctrl+1` | Focus left panel |
| `Ctrl+2` | Focus center panel |
| `Ctrl+3` | Focus right panel |
| `Ctrl+G N` | Generate NPC |
| `Ctrl+G L` | Generate Location |
| `Ctrl+G F` | Generate Faction |
| `Ctrl+S` | Force save (normally auto-saves) |
| `Ctrl+Enter` | Submit current generation prompt |
| `Escape` | Close modal/palette/dismiss |

### B.3 Acceptance Criteria

#### AC-B1: Command Palette
- [ ] Opens with Ctrl+K, closes with Escape
- [ ] Fuzzy search matches entity names, types, descriptions
- [ ] Results grouped by category (Recent, Entities, Actions)
- [ ] Keyboard navigation (↑/↓/Enter) works without mouse
- [ ] `>` prefix filters to actions, `@` prefix filters to entities
- [ ] Response time < 50ms for filtering on 200+ entities

#### AC-B2: Panel System
- [ ] Left panel toggles between rail (48px) and expanded (240px)
- [ ] Right panel toggleable, resizable via drag (280–480px)
- [ ] Panel state persists across page navigation
- [ ] Responsive: panels collapse on tablet/mobile

#### AC-B3: List View
- [ ] Toggle between grid and list view
- [ ] Columns sortable by click (asc/desc toggle)
- [ ] Inline edit on double-click for name field
- [ ] Ctrl+Click opens entity in right panel (pinned)
- [ ] Filter bar with entity-type-specific filter options

#### AC-B4: Session Mode
- [ ] Toggle via header button or keyboard shortcut
- [ ] Text size increases from 13px to 16px
- [ ] Sidebar auto-collapses to rail
- [ ] DM Coach panel opens automatically
- [ ] Center panel shows 2×2 configurable grid
- [ ] Hover-peek cards appear on entity name hover (300ms delay)
- [ ] Session timer visible and accurate

#### AC-B5: Split View
- [ ] Pin entity to left pane via Ctrl+Click or Pin button
- [ ] Both editors fully functional simultaneously
- [ ] Drag handle resizes panels
- [ ] Changes in either panel save independently

#### AC-B6: Human vs AI Visual Distinction
- [ ] All human-action buttons use indigo accent
- [ ] All AI-action buttons use cyan accent with sparkle icon
- [ ] Color distinction maintained across all views and modes

---

## Proposal C: Storyboard — Visual-First Narrative Design

> **Philosophy:** Treat campaign management as visual storytelling with spatial layouts
> **Primary Archetype:** Storyteller | **Secondary:** Social DM

### C.1 Design Tokens

#### C.1.1 Color Palette

| Token Name | Hex | RGB | Tailwind | Usage |
|-----------|-----|-----|----------|-------|
| `story.bg.primary` | `#1c1917` | `28, 25, 23` | `stone-900` | Page background |
| `story.bg.secondary` | `#292524` | `41, 37, 36` | `stone-800` | Cards, panels |
| `story.bg.elevated` | `#44403c` | `68, 64, 60` | `stone-700` | Hover, active |
| `story.accent.amber` | `#f59e0b` | `245, 158, 11` | `amber-500` | Primary actions, warm UI |
| `story.accent.amber.hover` | `#fbbf24` | `251, 191, 36` | `amber-400` | Hover on amber |
| `story.accent.violet` | `#a78bfa` | `167, 139, 250` | `violet-400` | AI/magical features |
| `story.accent.violet.hover` | `#c4b5fd` | `196, 181, 253` | `violet-300` | Hover on violet |
| `story.text.primary` | `#fafaf9` | `250, 250, 249` | `stone-50` | Primary text |
| `story.text.secondary` | `#a8a29e` | `168, 162, 158` | `stone-400` | Secondary text |
| `story.text.muted` | `#78716c` | `120, 113, 108` | `stone-500` | Placeholders |
| `story.border` | `#44403c` | `68, 64, 60` | `stone-700` | Borders |
| `story.timeline.bg` | `#292524` | `41, 37, 36` | — | Timeline track background |

**Contrast Verification:**
- `story.text.primary` on `story.bg.primary`: 15.4:1 ✅
- `story.text.secondary` on `story.bg.primary`: 6.2:1 ✅
- `story.accent.amber` on `story.bg.primary`: 8.1:1 ✅
- `story.accent.violet` on `story.bg.primary`: 5.9:1 ✅

#### C.1.2 Typography

| Token | Value | CSS | Usage |
|-------|-------|-----|-------|
| `story.font.heading` | Cormorant Garamond | `font-family: 'Cormorant Garamond', serif` | Headings, titles, entity names |
| `story.font.body` | Source Sans 3 | `font-family: 'Source Sans 3', sans-serif` | Body text |
| `story.font.handwritten` | Permanent Marker | `font-family: 'Permanent Marker', cursive` | Personal annotations, session notes only |
| `story.font.size.sm` | 14px | `font-size: 0.875rem` | Body, sidebar |
| `story.font.size.md` | 16px | `font-size: 1rem` | Input text, prominent body |
| `story.font.size.lg` | 22px | `font-size: 1.375rem` | Section headings |
| `story.font.size.xl` | 28px | `font-size: 1.75rem` | Page titles |
| `story.font.size.2xl` | 36px | `font-size: 2.25rem` | Hero headings |

**CDN Load:**
```html
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Source+Sans+3:wght@400;500;600&family=Permanent+Marker&display=swap" rel="stylesheet">
```

#### C.1.3 Motion Tokens

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `story.motion.fast` | 150ms | ease-out | Hover, color changes |
| `story.motion.normal` | 250ms | ease-in-out | Card flip, panel slide |
| `story.motion.slow` | 400ms | ease-in-out | Page transitions, timeline scroll |
| `story.motion.typewriter` | 30ms/char | linear | AI result text reveal |
| `story.motion.card-enter` | 300ms | cubic-bezier(0.34,1.56,0.64,1) | New card bounce-in |

### C.2 Component Specifications

#### C.2.1 Campaign Home — Story Timeline

**Anatomy:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  STORY TIMELINE  h: 160px  bg: story.bg.secondary                  │
│  overflow-x: scroll, snap to session cards                          │
│                                                                      │
│  ════════╤══════════╤══════════╤══════════╤══════════════  ← track  │
│          │          │          │          │                           │
│     ┌────┴───┐ ┌────┴───┐ ┌────┴───┐ ┌────┴───┐                    │
│     │Session │ │Session │ │Session │ │Session │                     │
│     │  #1    │ │  #2    │ │  #3    │ │  #4    │     → scroll        │
│     │ 3/1/26 │ │ 3/8/26 │ │3/12/26 │ │3/15/26 │                    │
│     └────────┘ └────────┘ └────────┘ └────────┘                    │
│                                                                      │
│  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬                  ← plot   │
│     "The Lost Crown" ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ (active)  arcs     │
│          "Faction War" ▬▬▬▬▬▬▬▬▬▬▬▬ (resolved)            colored  │
│                                                              bands  │
└──────────────────────────────────────────────────────────────────────┘

Session card: w: 120px, h: 80px
  bg: story.bg.elevated
  border: story.border
  border-radius: 8px
  Active session: amber left border (3px)
  Hover: scale(1.05), shadow increase

Track: 2px solid story.border
Plot arc bands: 4px tall, colored by plot, 50% opacity
  Hover plot band → tooltip with plot name and status
```

#### C.2.2 Adventure View — Scene Storyboard (Kanban)

**Anatomy:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  ADVENTURE: {Adventure Name}                    Cormorant 28px      │
│  {description excerpt}                          Source Sans 14px    │
│                                                                      │
│  SCENE STORYBOARD  overflow-x: scroll                               │
│                                                                      │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─ ─ ─ ─ ┐ │
│  │ ⚔ Scene 1   │──▶│ 🗣 Scene 2  │──▶│ 🔍 Scene 3  │   │ + Add  │ │
│  │             │   │             │   │             │   │ Scene  │ │
│  │ "The       │   │ "Meeting    │   │ "Exploring │   │        │ │
│  │  Ambush"   │   │  the Elder" │   │  the Ruins" │   └─ ─ ─ ─ ┘ │
│  │             │   │             │   │             │               │
│  │ 📍 Forest  │   │ 📍 Village  │   │ 📍 Ruins   │   Dashed      │
│  │ 👤👤👤     │   │ 👤👤        │   │ 👤          │   border      │
│  │             │   │             │   │             │   card =      │
│  │ ○ Planned  │   │ ● Complete  │   │ ○ Planned  │   "add new"   │
│  └─────────────┘   └─────────────┘   └─────────────┘               │
│                                                                      │
│  ──▶ = flow connector (SVG line, 2px, story.border)                 │
└──────────────────────────────────────────────────────────────────────┘

Scene card: w: 200px, min-h: 220px
  bg: story.bg.secondary
  border: story.border, border-radius: 12px
  Drag-and-drop reorderable (existing DnD already implemented)

Scene type icons:
  ⚔ Combat (red accent on card top)
  🗣 Social (blue accent)
  🔍 Exploration (green accent)
  🎭 Dramatic (purple accent)

Status indicator:
  ○ Planned: outline circle, story.text.muted
  ◐ In Progress: half-filled, amber
  ● Complete: filled, green

NPC avatars: 24×24 circles, stacked with -8px overlap
  Show first 3, then "+N" badge
  Hover → tooltip with names

Flow connectors:
  SVG <line> or <path> elements
  2px stroke, story.border color
  Arrowhead marker at end
```

#### C.2.3 NPC Gallery View

**Anatomy:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  NPC GALLERY                                          Cormorant 28px│
│  🔍 [filter]  [Faction ▼] [Sort ▼]                                 │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │              │  │              │  │              │              │
│  │   ┌──────┐   │  │   ┌──────┐   │  │   ┌──────┐   │              │
│  │   │silho-│   │  │   │silho-│   │  │   │silho-│   │              │
│  │   │uette │   │  │   │uette │   │  │   │uette │   │  Portrait:  │
│  │   │      │   │  │   │      │   │  │   │      │   │  120×120px  │
│  │   └──────┘   │  │   └──────┘   │  │   └──────┘   │  rounded-full│
│  │              │  │              │  │              │  bg: elevated│
│  │  Thalindra   │  │  Brok        │  │  Sera        │              │
│  │  Moonshadow  │  │  Ironforge   │  │  Nightwhisp  │  Name:      │
│  │              │  │              │  │              │  Cormorant  │
│  │  "Half-Elf   │  │  "Dwarf      │  │  "Tiefling   │  18px bold  │
│  │   Ranger"    │  │   Fighter"   │  │   Warlock"   │              │
│  │              │  │              │  │              │  Subtitle:  │
│  │  ┌────────┐  │  │              │  │  ┌────────┐  │  14px muted │
│  │  │Emerald │  │  │              │  │  │Shadow  │  │              │
│  │  │ Guard  │  │  │              │  │  │Council │  │  Faction    │
│  │  └────────┘  │  │              │  │  └────────┘  │  badge      │
│  │  🔗 4 links  │  │  🔗 2 links  │  │  🔗 6 links  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘  Rel count  │
│                                                                      │
│  HOVER STATE reveals:                                               │
│  ╭───────────────────────╮                                          │
│  │ Personality: Cautious │  Tooltip below card                      │
│  │ Goal: Find artifact   │  bg: story.bg.elevated                   │
│  │ Last: Session #4      │  Appears after 300ms                     │
│  ╰───────────────────────╯                                          │
└──────────────────────────────────────────────────────────────────────┘

Card: w: 220px, h: auto (content-driven)
Grid: auto-fill, minmax(220px, 1fr), gap: 16px
Silhouette: generated based on race (elf=tall/thin, dwarf=short/wide)
  or placeholder icon if no race set
```

#### C.2.4 Location Atlas View

**Anatomy:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  LOCATION ATLAS                                                      │
│  Breadcrumb: World > Thornwall Region > Silverwood Forest            │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  🏔 THORNWALL REGION                                          │  │  Parent card
│  │  "A mountainous region..."                                    │  │  bg: story.bg.secondary
│  │                                                                │  │  border: 2px emerald
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │  │
│  │  │ 🌲 Silver-   │  │ 🏰 Castle    │  │ 🏘 Thornwall │       │  │  Child cards
│  │  │    wood       │  │    Dread     │  │    Village   │       │  │  nested inside
│  │  │    Forest     │  │              │  │              │       │  │  parent
│  │  │              │  │              │  │              │       │  │
│  │  │  ┌────────┐  │  │              │  │  ┌────────┐  │       │  │  Grandchild
│  │  │  │Clearing│  │  │              │  │  │Tavern  │  │       │  │  cards nested
│  │  │  └────────┘  │  │              │  │  │Inn     │  │       │  │  further
│  │  │  ┌────────┐  │  │              │  │  └────────┘  │       │  │
│  │  │  │Cave    │  │  │              │  │              │       │  │
│  │  │  └────────┘  │  │              │  │              │       │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘       │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘

Hierarchy depth shown through nesting and size:
  Level 0 (root): full width, 2px border, large text
  Level 1 (region): w: 280px, standard card
  Level 2 (specific): w: 140px, compact card
  Max visible depth: 3 levels (deeper locations shown as count badge)

Click card → expand to fill parent (animated, 300ms)
Breadcrumb updates on drill-down
```

#### C.2.5 AI Generation — "Weave" Experience

**Anatomy:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  ╭──── ✦ Weave into Being ✦ ────╮                                  │
│  │                                │  bg: story.bg.secondary          │
│  │  ┌──────────────────────────┐ │  border: 1px story.accent.violet │
│  │  │                          │ │  border-radius: 16px             │
│  │  │  "Describe your vision..."│ │  textarea: journal-like styling │
│  │  │                          │ │    bg: story.bg.primary           │
│  │  │                          │ │    border-radius: 8px             │
│  │  └──────────────────────────┘ │    line-height: 1.8               │
│  │                                │    font: Source Sans 16px         │
│  │  (Model: ▼)      [✦ Weave]   │                                   │
│  ╰────────────────────────────────╯  Button: violet bg, white text   │
│                                                                      │
│  RESULT (after generation):                                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  {entity name}              Cormorant 24px, typewriter in    │   │
│  │  ─────────────────                                           │   │
│  │  {description text appears character by character}           │   │
│  │  {at 30ms per character using story.motion.typewriter}       │   │
│  │                                                               │   │
│  │  {structured fields fade in after text completes}            │   │
│  │                                                               │   │
│  │  ┌─────────────────┐  ┌─────────────────┐                   │   │
│  │  │ [✓ Accept]       │  │ [↻ Regenerate]  │                   │   │
│  │  └─────────────────┘  └─────────────────┘                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  VARIATIONS TRAY (optional, future):                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                            │
│  │ Option A │ │ Option B │ │ Option C │  Side-by-side alternatives  │
│  │ ● active │ │          │ │          │  Click to preview           │
│  └──────────┘ └──────────┘ └──────────┘                            │
└──────────────────────────────────────────────────────────────────────┘

Typewriter effect CSS:
  Text container uses overflow: hidden
  Width animates from 0 to 100% per line
  Or character-by-character via JS interval (30ms/char)
  Respects prefers-reduced-motion → instant reveal
```

#### C.2.6 "What's Happening Now" Footer Widget

```
┌──────────────────────────────────────────────────────────────────────┐
│  📖 Session #4 (active) · 🎯 "Lost Crown" advanced · ⏭ Next:     │
│     "Exploring the Ruins" · 💾 Saved 2m ago                        │
└──────────────────────────────────────────────────────────────────────┘

h: 40px, bg: story.bg.secondary, border-top: story.border
Fixed to bottom of viewport
Sections separated by · (middle dot)
Each section clickable → navigates to relevant view
Collapsible on mobile (shows icon-only)
```

### C.3 User Flow: Campaign Home Navigation

```
[Campaign Home]
    │
    ├── Click session on timeline
    │       ▼
    │   [Session Log Editor]
    │
    ├── Click plot arc band
    │       ▼
    │   [Plot Editor]
    │
    ├── Click entity node in constellation
    │       ▼
    │   [Entity Editor (type-specific)]
    │
    ├── Click "NPCs" in sidebar
    │       ▼
    │   [NPC Gallery View]
    │       │
    │       ├── Click NPC card
    │       │       ▼
    │       │   [NPC Editor]
    │       │
    │       └── Hover NPC card (300ms)
    │               ▼
    │           [Hover tooltip with key details]
    │
    ├── Click "Adventures" in sidebar
    │       ▼
    │   [Adventure list]
    │       │
    │       └── Click adventure
    │               ▼
    │           [Scene Storyboard view]
    │
    └── Click "Locations" in sidebar
            ▼
        [Location Atlas View]
```

### C.4 Acceptance Criteria

#### AC-C1: Story Timeline
- [ ] Horizontal scrolling timeline shows all sessions chronologically
- [ ] Session cards show date, number, and active indicator
- [ ] Plot arc bands overlay below timeline with distinct colors
- [ ] Hover on plot band shows tooltip with name and status
- [ ] Click session card navigates to session log editor
- [ ] Scroll snaps to session card boundaries

#### AC-C2: Scene Storyboard
- [ ] Scenes displayed as horizontal card sequence
- [ ] Scene type icon and color accent visible on each card
- [ ] Flow connectors (SVG arrows) connect adjacent scenes
- [ ] Drag-and-drop reorders scenes
- [ ] NPC avatar stack shows first 3 + overflow count
- [ ] Status indicator (planned/in-progress/complete) visible
- [ ] "Add Scene" dashed card at end

#### AC-C3: NPC Gallery
- [ ] Grid of visual NPC cards with silhouette/avatar area
- [ ] Faction badge visible on cards
- [ ] Relationship count shown
- [ ] Hover reveals personality, goal, last session
- [ ] Filter by faction, sort by name/modified

#### AC-C4: Location Atlas
- [ ] Parent locations contain child location cards visually nested
- [ ] Up to 3 levels of depth visible
- [ ] Click expands location (animated 300ms)
- [ ] Breadcrumb trail updates on navigation

#### AC-C5: AI "Weave" Experience
- [ ] Generator uses violet accent (distinct from amber user actions)
- [ ] Results appear with typewriter text animation (30ms/char)
- [ ] Structured fields fade in after text completes
- [ ] Accept/Regenerate buttons appear after generation
- [ ] Respects `prefers-reduced-motion`

#### AC-C6: Footer Widget
- [ ] Persistent footer shows active session, plot status, next scene
- [ ] Each section is clickable → navigates to relevant view
- [ ] Collapses to icons on mobile

---

## Proposal D: Adaptive Forge — Mode-Switching Hybrid Design

> **Philosophy:** No single design serves all DM archetypes — build switchable UI modes
> **Primary Archetype:** All archetypes equally, through contextual adaptation

### D.1 Design Tokens

#### D.1.1 Color Palette (Core — Shared Across All Modes)

| Token Name | Hex | RGB | Tailwind | Usage |
|-----------|-----|-----|----------|-------|
| `forge.bg.primary` | `#18181b` | `24, 24, 27` | `zinc-900` | Page background |
| `forge.bg.secondary` | `#27272a` | `39, 39, 42` | `zinc-800` | Cards, panels |
| `forge.bg.elevated` | `#3f3f46` | `63, 63, 70` | `zinc-700` | Hover, active panels |
| `forge.bg.input` | `#18181b` | `24, 24, 27` | `zinc-900` | Inputs (matches primary) |
| `forge.accent.amber` | `#f59e0b` | `245, 158, 11` | `amber-500` | User actions, primary CTAs |
| `forge.accent.amber.hover` | `#fbbf24` | `251, 191, 36` | `amber-400` | Hover on user actions |
| `forge.accent.indigo` | `#818cf8` | `129, 140, 248` | `indigo-400` | AI-specific features |
| `forge.accent.indigo.hover` | `#a5b4fc` | `165, 180, 252` | `indigo-300` | Hover on AI features |
| `forge.text.primary` | `#fafafa` | `250, 250, 250` | `zinc-50` | Primary text |
| `forge.text.secondary` | `#a1a1aa` | `161, 161, 170` | `zinc-400` | Secondary text |
| `forge.text.muted` | `#71717a` | `113, 113, 122` | `zinc-500` | Placeholders |
| `forge.border` | `#3f3f46` | `63, 63, 70` | `zinc-700` | Borders |
| `forge.success` | `#22c55e` | `34, 197, 94` | `green-500` | Success states |
| `forge.warning` | `#f59e0b` | `245, 158, 11` | `amber-500` | Warning states |
| `forge.danger` | `#ef4444` | `239, 68, 68` | `red-500` | Error, destructive |

**Visual Language:**
- **Amber = user actions** (navigation, CRUD, form submission)
- **Indigo = AI actions** (generate, analyze, suggest)
- **Entity type colors** (from Shared Foundations) = content identification

**Contrast Verification:**
- `forge.text.primary` on `forge.bg.primary`: 16.7:1 ✅
- `forge.text.secondary` on `forge.bg.primary`: 6.8:1 ✅
- `forge.accent.amber` on `forge.bg.primary`: 8.1:1 ✅
- `forge.accent.indigo` on `forge.bg.primary`: 6.1:1 ✅

#### D.1.2 Typography

| Token | Value | CSS | Usage |
|-------|-------|-----|-------|
| `forge.font.heading` | Crimson Pro | `font-family: 'Crimson Pro', serif` | All headings — readable serif with personality |
| `forge.font.body` | Inter | `font-family: 'Inter', sans-serif` | Body text, UI labels |
| `forge.font.mono` | JetBrains Mono | `font-family: 'JetBrains Mono', monospace` | Stat blocks, tables, data |
| `forge.font.size.xs` | 12px / 0.75rem | `font-size: 0.75rem` | Captions, badges |
| `forge.font.size.sm` | 14px / 0.875rem | `font-size: 0.875rem` | Body text (prep mode) |
| `forge.font.size.md` | 16px / 1rem | `font-size: 1rem` | Body text (session mode) |
| `forge.font.size.lg` | 20px / 1.25rem | `font-size: 1.25rem` | Section headings |
| `forge.font.size.xl` | 24px / 1.5rem | `font-size: 1.5rem` | Page titles |

**CDN Load:**
```html
<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

#### D.1.3 Motion Tokens

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `forge.motion.fast` | 150ms | ease-out | Hover, toggle |
| `forge.motion.normal` | 250ms | ease-in-out | Panel slide, mode transition |
| `forge.motion.slow` | 400ms | ease-in-out | Full mode switch animation |
| `forge.motion.skeleton` | 1500ms | ease-in-out | Skeleton loading pulse (infinite) |

#### D.1.4 Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `forge.shadow.card` | `0 1px 4px rgba(0,0,0,0.3)` | Cards at rest |
| `forge.shadow.elevated` | `0 4px 12px rgba(0,0,0,0.4)` | Modals, dropdown, floating panels |
| `forge.shadow.focus` | `0 0 0 2px rgba(245,158,11,0.5)` | Focus ring (amber) |
| `forge.shadow.ai-focus` | `0 0 0 2px rgba(129,140,248,0.5)` | Focus ring on AI elements (indigo) |

### D.2 Component Specifications (Shared Core)

#### D.2.1 Entity Card (Enhanced)

**Anatomy:**
```
┌─────────────────────────────────────────┐
│▌                                        │  ▌ = entity type color (3px left border)
│▌ ┌────┐  {Entity Name}       {badge}   │  icon: entity type, 20×20
│▌ │icon│  {subtitle}                     │  Name: Crimson Pro 16px semibold
│▌ └────┘                                │  subtitle: Inter 12px, text.secondary
│▌─────────────────────────────────────── │  badge: entity type pill
│▌                                        │
│▌ {description, 2 lines max}            │  Inter 14px, text.secondary
│▌                                        │
│▌ ┌──────┐ ┌──────┐    🔗 {N} · ⏱ {M} │  tags: pill, bg.elevated
│▌ │ tag  │ │ tag  │                     │  🔗 = relationship count
│▌ └──────┘ └──────┘                     │  ⏱ = last modified (relative)
└─────────────────────────────────────────┘

bg: forge.bg.secondary
border: 1px forge.border
border-left: 3px {entity-type-color}
border-radius: 8px
padding: 16px
shadow: forge.shadow.card
hover: border-color brightens, shadow → forge.shadow.elevated (150ms)
```

#### D.2.2 Button Variants

| Variant | Background | Text | Border | Icon | Usage |
|---------|-----------|------|--------|------|-------|
| `primary` | `forge.accent.amber` | `zinc-900` (dark) | none | optional | User-initiated CTAs |
| `ai` | `forge.accent.indigo` | `white` | none | SparkleIcon ✨ | AI generation, analysis |
| `secondary` | `forge.bg.elevated` | `forge.text.primary` | `forge.border` | optional | Cancel, secondary |
| `ghost` | transparent | `forge.accent.amber` | none | optional | Inline, tertiary |
| `danger` | transparent | `forge.danger` | `forge.danger` | TrashIcon | Delete, destructive |

**Sizes:**
| Size | Height | Padding-x | Font | Icon |
|------|--------|-----------|------|------|
| `sm` | 32px | 12px | 13px | 16px |
| `md` | 40px | 16px | 14px | 20px |
| `lg` | 48px | 24px | 16px | 20px |

#### D.2.3 Loading Skeleton

Replace spinners with skeleton loading in content areas:

```
┌─────────────────────────────────────────┐
│▌ ┌────┐  ████████████████              │  Skeleton pulse animation:
│▌ │░░░░│  ████████                      │  bg: forge.bg.elevated
│▌ └────┘                                │  shimmer: linear-gradient sweep
│▌─────────────────────────────────────── │  animation: forge.motion.skeleton
│▌                                        │  (1500ms ease-in-out infinite)
│▌ ████████████████████████████████      │
│▌ ████████████████████                  │
│▌                                        │
│▌ ┌──────┐ ┌──────┐                     │
│▌ │░░░░░░│ │░░░░░░│                     │
│▌ └──────┘ └──────┘                     │
└─────────────────────────────────────────┘

CSS:
@keyframes skeleton-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(
    90deg,
    var(--forge-bg-elevated) 25%,
    var(--forge-bg-secondary) 50%,
    var(--forge-bg-elevated) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}
```

#### D.2.4 Empty State Pattern

```
┌─────────────────────────────────────────┐
│                                         │
│           ┌─────────────┐               │  Illustration: CSS-only or SVG
│           │   context-   │               │  max: 160×160px
│           │   specific   │               │  opacity: 0.6
│           │   icon/art   │               │
│           └─────────────┘               │
│                                         │
│     {Contextual heading}                │  Crimson Pro 20px, text.primary
│     {Helpful description text}          │  Inter 14px, text.secondary
│                                         │
│        [✨ Generate {Type}]             │  AI button (indigo)
│        (or create manually)             │  Ghost link (amber)
│                                         │
└─────────────────────────────────────────┘
```

### D.3 Mode Specifications

#### D.3.1 Mode Switcher Component

```
Header location (right side):

┌──────────────────────────────────────────────────────────┐
│  [Logo] {Campaign}  ···  [📋 Prep ● ] [⚡ Session] [🗺 Atlas] │
└──────────────────────────────────────────────────────────┘

Active mode: amber bg pill, dark text
Inactive modes: ghost button style
● = active indicator dot

Mode switcher: always visible in header
Transition between modes: forge.motion.slow (400ms)
  - Content area cross-fades
  - Layout elements slide to new positions
  - Sidebar adjusts width/state
```

#### D.3.2 Prep Mode (Default)

**Layout:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  HEADER  [Logo] {Campaign} (▼)  [📋 Prep ●] [⚡Session] [🗺Atlas] │
├──────────────┬───────────────────────────────────────────────────────┤
│  SIDEBAR     │  MAIN CONTENT                                       │
│  w: 260px    │                                                      │
│              │  Breadcrumb: Campaign > {Section} > {Entity}        │
│  ┌─ 🔍 ───┐ │                                                      │
│  └────────┘ │  ┌─ Generator Tray (collapsed) ──────────────────┐   │
│              │  │  [✨ Generate {Type}...               ▼ expand]│   │
│  ● Setting  │  └───────────────────────────────────────────────┘   │
│              │                                                      │
│  WORLD       │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  ● NPCs     │  │▌Card     │ │▌Card     │ │▌Card     │            │
│  ○ Locations │  │▌         │ │▌         │ │▌         │            │
│  ○ Factions  │  └──────────┘ └──────────┘ └──────────┘            │
│  ○ Items    │                                                      │
│              │  Entity Editor (when entity selected):              │
│  STORY       │  ┌──────────────────────────────────────────────┐   │
│  ○ Adventures│  │  {Editor content}                             │   │
│  ○ Lorebook  │  │                                               │   │
│              │  │  ┌────────────────────────────────────────┐  │   │
│  SESSION     │  │  │ [Preview] [Edit]  ← toggle             │  │   │
│  ○ Logs      │  │  └────────────────────────────────────────┘  │   │
│  ○ Plots     │  │                                               │   │
│  ○ PCs       │  └──────────────────────────────────────────────┘   │
│              │                                                      │
│  TOOLS       │                                                      │
│  ○ Combat    │                                                      │
│  ○ Graphs    │                                                      │
├──────────────┴───────────────────────────────────────────────────────┤
│  💾 Saved · {time}                                                  │
└──────────────────────────────────────────────────────────────────────┘

Enhancements over current:
- Search/filter bar in sidebar
- Entity type color dots next to sidebar items (● = colored by type)
- Breadcrumbs in content area
- Generator as collapsible "tray" (not always visible)
- Editor preview toggle (read-only formatted view)
- Loading skeletons instead of spinners
```

**Generator Tray (expanded):**
```
┌─── ✨ Generate NPC ──────────────────────────────────────┐
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ {prompt textarea}                                    │ │  bg: forge.bg.primary
│  │                                                      │ │  min-height: 80px
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  Campaign hints: "Setting: Forgotten Realms,             │  Inter 12px, text.muted
│   Existing NPCs: Thalindra, Brok, Sera"                  │  collapsible
│                                                           │
│  (Model ▼)  (High Quality ☐)        [✨ Generate]        │
│                                                           │
│  Previous: "tavern keeper" · "mysterious stranger"       │  Recent prompts as links
│                                                           │
│  ┌─── Result Preview ───────────────────────────────┐   │
│  │  {Generated entity preview}                       │   │  Only visible after generation
│  │  [✓ Accept]  [↻ Retry]  [✕ Discard]             │   │
│  └───────────────────────────────────────────────────┘   │
│                                                     [▲ collapse]
└───────────────────────────────────────────────────────────┘

Slides up from bottom of content area (250ms ease-in-out)
Does not replace current view — overlays it
Max height: 50% of viewport
```

#### D.3.3 Session Mode

**Layout:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  HEADER  [Logo] {Campaign}  [📋Prep] [⚡Session ●] [🗺Atlas]      │
│  ⚡ SESSION LIVE · {Scene Name} · ⏱ {00:45:22}           🎲  📝   │
├────┬───────────────────────────────────┬─────────────────────────────┤
│    │  CONFIGURABLE 2×2 GRID            │  DM COACH / QUICK REF      │
│ ≡  │                                   │  w: 340px                   │
│ rail│  ┌───────────────┬──────────────┐│                             │
│    │  │ Panel 1:      │ Panel 2:     ││  Tabs:                      │
│ 48 │  │ INITIATIVE    │ ACTIVE SCENE ││  [Coach] [NPCs] [Notes]     │
│ px │  │               │              ││                             │
│    │  │ 1. Thalin  20 │ "The party   ││  ┌───────────────────────┐ │
│    │  │ 2. Goblin  15 │ has arrived  ││  │ AI Coach chat         │ │
│    │  │ 3. Brok    12 │ at the..."   ││  │                       │ │
│    │  │ → current    │              ││  │ "How should the NPC   │ │
│    │  │               │ NPCs:        ││  │  react to the party's │ │
│    │  │ [+ Add]       │ • Tavern     ││  │  accusation?"         │ │
│    │  │ [Next Turn]   │   keeper     ││  │                       │ │
│    │  ├───────────────┼──────────────┤│  │ [AI response here]    │ │
│    │  │ Panel 3:      │ Panel 4:     ││  │                       │ │
│    │  │ QUICK NPC     │ SESSION      ││  └───────────────────────┘ │
│    │  │ LOOKUP        │ NOTES        ││                             │
│    │  │               │              ││  Quick actions:             │
│    │  │ 🔍 [search]   │ {timestamped ││  [Narrate] [Dialogue]      │
│    │  │               │  notes}      ││  [Plot Twist] [Table]      │
│    │  │ Thalindra ►  │              ││  [Skill Check]             │
│    │  │ Brok ►       │ [+ Note]     ││                             │
│    │  │               │ [🎤 Voice]   ││                             │
│    │  └───────────────┴──────────────┘│                             │
├────┴───────────────────────────────────┴─────────────────────────────┤
│  ⚡ Live · 4 players · Scene 2/5 · Notes: 12 · Plots: 2 active     │
└──────────────────────────────────────────────────────────────────────┘

Font size: ALL text increases by +2px in session mode
  forge.font.size.sm: 14px → 16px
  forge.font.size.md: 16px → 18px

Hover-peek on entity names (300ms delay):
  Same as Proposal B spec (see B.2.5)

Panels are configurable:
  Drag panel headers to swap positions
  Dropdown on each panel header to change content type
  Available panel types: Initiative, Active Scene, NPC Lookup,
    Session Notes, Combat Tracker, Plot Tracker

Floating action buttons (bottom-right):
  🎲 = quick dice roll (opens small modal)
  📝 = quick note (adds timestamped note)
  56×56px, round, amber bg, elevated shadow
  Position: fixed, bottom 80px, right 24px
  Stack vertically with 8px gap
```

#### D.3.4 Review Mode

**Layout:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  HEADER  [Logo] {Campaign}  [📋Prep] [⚡Session] [📊Review ●]     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  SESSION #4 REVIEW                        Crimson Pro 28px          │
│  March 15, 2026 · Duration: 3h 22m                                  │
│                                                                      │
│  ┌─── AI Session Summary ────────────────────────────────────────┐  │
│  │  "The party investigated the ruins of Thornwall, discovering  │  │
│  │   the entrance to the hidden vault. Thalindra decoded the     │  │
│  │   runes while Brok held off a wave of undead guardians..."    │  │
│  │                                               [✨ Regenerate]  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─── What Changed ──────────┐  ┌─── Plot Progress ──────────┐    │
│  │                            │  │                             │    │
│  │  Created:                  │  │  "Lost Crown" ████████░░   │    │
│  │  + 2 NPCs (Guard, Ghost)  │  │   → Advanced: found vault  │    │
│  │  + 1 Location (Vault)     │  │                             │    │
│  │                            │  │  "Faction War" ██████░░░░  │    │
│  │  Modified:                 │  │   → Stalled: no new info   │    │
│  │  ~ Thalindra (new secret) │  │                             │    │
│  │  ~ Thornwall (explored)   │  │                             │    │
│  │                            │  │                             │    │
│  │  Referenced:               │  │                             │    │
│  │  ○ Brok, Sera (no changes)│  │                             │    │
│  └────────────────────────────┘  └─────────────────────────────┘    │
│                                                                      │
│  ┌─── Session Notes Timeline ─────────────────────────────────────┐ │
│  │  19:00  "Party arrived at ruins"                               │ │
│  │  19:15  "Thalindra found runes on the door"                   │ │
│  │  19:32  "Combat: 4 skeleton guardians"                        │ │
│  │  20:10  "Vault discovered — session ended on cliffhanger"     │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌─── Next Session Prep Suggestions ─────────────────────────────┐ │
│  │  ✨ AI suggests:                                               │ │
│  │  • Prepare vault interior (generate location?)                │ │
│  │  • Ghost NPC may have information about the Crown             │ │
│  │  • Faction War subplot needs attention — 2 sessions stalled   │ │
│  │                   [✨ Generate Vault]  [✨ Prep Adventure]     │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  [← Back to Prep Mode]                   [→ Start Next Session]     │
└──────────────────────────────────────────────────────────────────────┘

Full-width layout (no sidebar)
Read-only view — no inline editing
AI-generated summary at top
"What Changed" panel auto-detects entity modifications during session
Plot progress bars: visual percentage with status label
```

#### D.3.5 Atlas Mode

**Layout:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  HEADER  [Logo] {Campaign}  [📋Prep] [⚡Session] [🗺Atlas ●]      │
│  Filter: [All Types ▼] [Search: ______]  Cluster: [Faction ▼]      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│           ┌───────┐                                                  │
│           │ NPC 1 │──────────┐                                      │
│           │ name  │          │                                       │
│           └───────┘          │                                       │
│               │         ┌────┴───┐                                   │
│               │         │Faction │                                   │
│          ┌────┴───┐     │  name  │          Full-screen graph        │
│          │ NPC 2  │     └────────┘          (React Flow or D3)       │
│          │ name   │──────────┐                                       │
│          └────────┘          │                                       │
│                         ┌────┴─────┐                                 │
│              ┌──────────│Location  │                                 │
│              │          │  name    │                                  │
│              │          └──────────┘     ┌──────┐  Minimap          │
│         ┌────┴───┐                      │ ░░░░ │  120×90px          │
│         │ Item   │                      │ ░░░░ │  bottom-right      │
│         │ name   │                      └──────┘                     │
│         └────────┘                                                   │
│                                                                      │
├───────────────────────────────────┬──────────────────────────────────┤
│                                   │  RIGHT PANEL (on node click)    │
│                                   │  w: 360px, slide-in             │
│                                   │                                  │
│                                   │  {Entity quick view}            │
│                                   │  All fields read-only           │
│                                   │                                  │
│                                   │  [Open in Editor] [Close]       │
│                                   │                                  │
└───────────────────────────────────┴──────────────────────────────────┘

Graph nodes:
  Shape: rounded rectangle, 120×60px min
  Background: forge.bg.secondary
  Border: 2px in entity-type-color
  Content: Icon (16px) + Name (Inter 13px) + Type badge (11px)
  Hover: border brightens, shadow elevates
  Selected: amber border glow

Graph edges:
  Stroke: forge.border, 2px
  Label: relationship type (Inter 11px, bg.elevated pill)
  Hover edge: stroke brightens to text.secondary

Clustering:
  Nodes grouped by selected criterion (faction, location, adventure)
  Cluster background: entity-type-color at 5% opacity
  Cluster label: above group, Inter 12px uppercase

Controls (top-right overlay):
  [+] Zoom in
  [−] Zoom out
  [⟲] Reset view
  [⛶] Fullscreen
```

### D.4 Mode Transition Specification

| From | To | Animation | Duration |
|------|-----|-----------|----------|
| Prep → Session | Sidebar shrinks to rail, right panel slides in, content cross-fades to grid | 400ms |
| Session → Prep | Rail expands to sidebar, right panel slides out, grid cross-fades to dashboard | 400ms |
| Prep → Atlas | Sidebar fades out, graph fades in from center, minimap slides in | 400ms |
| Atlas → Prep | Graph fades out, sidebar fades in, content fades in | 400ms |
| Any → Review | Full-width content cross-fades in, sidebar fades out | 300ms |

**Implementation note:** Mode switching changes layout CSS classes on the app shell. The same React components render in different configurations — this is a layout concern, not a data concern. Component props like `mode: 'prep' | 'session' | 'review' | 'atlas'` control which variant renders.

### D.5 Implementation Phasing

| Phase | Scope | Effort |
|-------|-------|--------|
| **Phase 1** | Core design system: warm palette (zinc), entity colors, amber/indigo distinction, Crimson Pro headings, loading skeletons, empty states, enhanced cards | 2–3 weeks |
| **Phase 2** | Prep Mode enhancements: sidebar search, breadcrumbs, generator tray, editor preview toggle | 2–3 weeks |
| **Phase 3** | Session Mode: mode switcher, 2×2 grid, DM coach panel, hover-peek, floating actions | 3–4 weeks |
| **Phase 4** | Atlas Mode: full-screen graph, clustering, minimap, node detail panel | 2–3 weeks |
| **Phase 5** | Review Mode: session summary, what-changed detection, plot progress, AI suggestions | 2–3 weeks |

### D.6 Acceptance Criteria

#### AC-D1: Core Design System
- [ ] All `slate-*` replaced with `zinc-*` equivalents
- [ ] Amber accent for user actions, indigo accent for AI actions
- [ ] Entity type color left-borders on all cards
- [ ] Crimson Pro loaded and applied to headings
- [ ] Inter applied to body text
- [ ] Loading skeletons replace spinners in content areas
- [ ] Empty states with illustration, text, and CTA for all entity types
- [ ] All colors pass WCAG AA contrast

#### AC-D2: Mode Switcher
- [ ] Mode switcher visible in header with 3–4 mode buttons
- [ ] Active mode has amber pill background
- [ ] Mode transitions animate over 400ms
- [ ] Current mode persists per campaign in localStorage
- [ ] Mode state does not affect data — only layout/presentation

#### AC-D3: Prep Mode
- [ ] Sidebar search/filter bar functional
- [ ] Breadcrumbs show navigation path
- [ ] Generator tray slides up from bottom, max 50% viewport
- [ ] Generator tray shows campaign context hints
- [ ] Editor preview toggle shows read-only formatted view
- [ ] Previous generation prompts shown as quick-links

#### AC-D4: Session Mode
- [ ] Sidebar auto-collapses to icon rail
- [ ] 2×2 configurable grid in center panel
- [ ] Panel content types swappable via dropdown
- [ ] DM Coach panel permanently visible on right
- [ ] Text size increases by +2px across all elements
- [ ] Hover-peek on entity names (300ms delay)
- [ ] Floating action buttons (dice, note) fixed bottom-right
- [ ] Session timer accurate and visible
- [ ] Non-session features (generators, import) hidden

#### AC-D5: Atlas Mode (Phase 4)
- [ ] Full-screen relationship graph
- [ ] Nodes show icon, name, type with entity-color border
- [ ] Click node opens detail panel (right slide-in)
- [ ] Cluster by faction/location/adventure
- [ ] Minimap visible in corner
- [ ] Search highlights matching nodes
- [ ] Edge labels show relationship types

#### AC-D6: Review Mode (Phase 5)
- [ ] Full-width layout, no sidebar
- [ ] AI session summary at top
- [ ] "What Changed" panel lists created/modified/referenced entities
- [ ] Plot progress bars with status labels
- [ ] Session notes in chronological timeline
- [ ] AI prep suggestions with actionable buttons

---

## Implementation Priority Matrix

### Cross-Proposal: What to Build First Regardless of Choice

These improvements appear in multiple proposals and benefit all users:

| Enhancement | Appears In | Effort | Impact |
|-------------|-----------|--------|--------|
| Entity type color borders on cards | A, B, C, D | Low | High — instant visual scanning |
| Sidebar search/filter | B, D | Low | High — critical for 20+ entities |
| Empty states with CTAs | A, C, D | Low | Medium — better onboarding |
| AI vs User action color distinction | A, B, D | Low | Medium — clearer UI language |
| Warmer color palette (slate→zinc/stone) | A, C, D | Medium | Medium — brand identity |
| Loading skeletons | D | Medium | Low — polish |
| Command palette (Ctrl+K) | B, D | Medium | High — power user productivity |
| Hover-peek on entity names | B, D | Medium | High — session mode essential |
| Session mode (layout switch) | B, D | High | High — core use case underserved |
| Editor preview/read mode | A, D | Medium | Medium — Storyteller satisfaction |

### Recommended Implementation Order

1. **Entity color borders + AI/User color distinction** (1–2 days) — Immediately improves scannability
2. **Sidebar search** (2–3 days) — Unblocks navigation at scale
3. **Empty states** (2–3 days) — Better new user experience
4. **Warm palette migration** (3–5 days) — Brand identity uplift
5. **Command palette** (1 week) — Power user game-changer
6. **Session mode** (2–3 weeks) — Addresses biggest archetype gap
7. **Choose a proposal direction** for deeper investment

---

*This document is a living specification. Update acceptance criteria as implementation progresses and mark items complete with [x].*
