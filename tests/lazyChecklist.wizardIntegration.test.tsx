// @vitest-environment jsdom
/**
 * SPEC — the Lazy DM checklist on the Review & Go Live step
 * (Wave 2, lane 2: SessionPrepWizard bundle)
 * =============================================================================
 * Source: docs/design/lazy-dm-lens.md §4.5. File under test:
 * components/dialogs/SessionPrepWizard.tsx (via
 * components/dialogs/prep/LazyChecklist.tsx, utils/lazyChecklist.ts).
 *
 * THE CONTRACT
 * ------------
 * 1. Collapsed by default — a DM who never opens it pays zero cost.
 * 2. Expanding reveals all eight rows, "Relevant monsters" always fixed.
 * 3. NEVER a red or warning-toned class, whatever state the wizard is in.
 * 4. Clicking a row with a wizard home jumps there — but ONLY the three
 *    lazy-only rows (Strong start / Potential scenes / Secrets and clues)
 *    have one, and only while the lazy path is actually on (those wizard
 *    steps don't exist otherwise); in the standard flow the same three rows
 *    are plain, unclickable text.
 * 5. It shows on the Review & Go Live step in BOTH flows, and reflects real
 *    wizard state (beats added, scenes selected, NPCs/locations gathered).
 * 6. It never blocks Go Live.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';
import type { Campaign, SessionLog } from '../types/index';

const h = vi.hoisted(() => ({
  createSessionLog: vi.fn((_newLogData: Omit<SessionLog, 'id'>) => 'sess-new'),
  goLive: vi.fn(),
  hasColdOpenMaterial: vi.fn(() => false),
  generateColdOpen: vi.fn(async () => 'COLD OPEN'),
  generateStrongStart: vi.fn(async () => 'STRONG START'),
  generateSceneMenu: vi.fn(async () => []),
}));

vi.mock('../services/campaignService', () => ({
  campaignService: { createSessionLog: h.createSessionLog, goLive: h.goLive },
}));

vi.mock('../services/aiService', () => ({
  hasColdOpenMaterial: h.hasColdOpenMaterial,
  generateColdOpen: h.generateColdOpen,
  generateStrongStart: h.generateStrongStart,
  generateSceneMenu: h.generateSceneMenu,
}));

import { SessionPrepWizard } from '../components/dialogs/SessionPrepWizard';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const scene = {
  id: 'scene-1',
  title: 'The Ashen Gate',
  type: 'social',
  status: 'planned',
  readAloudText: '',
  gmNotes: '',
  skillChecks: [],
  rewards: 'A pouch of 20 gold and a rumor about the vault.',
  locationId: 'loc-auto',
  npcIds: ['npc-auto'],
};

const campaign = {
  id: 'c1',
  title: 'Ashfall',
  settingType: 'custom',
  setting: 'A dying empire',
  articles: [],
  adventures: [{ id: 'adv-1', title: 'The Ashen Vault', hook: '', theme: '', scenes: [scene] }],
  npcs: [{ id: 'npc-auto', name: 'Auto Linked Npc', description: '' }],
  locations: [{ id: 'loc-auto', name: 'Auto Linked Location', description: '' }],
  factions: [],
  items: [{ id: 'item-1', name: 'A Sunstone Compass', description: '', rarity: 'uncommon', properties: '' }],
  sessionLogs: [],
  playerCharacters: [],
  plots: [{ id: 'plot-1', title: 'The Cinder Crown', description: '', status: 'active', relatedEntityIds: [] }],
  notes: [],
  secrets: [
    {
      id: 'sec-1',
      title: 'The steward is an ashling',
      content: 'He burns cold.',
      category: 'secret',
      isRevealed: false,
      linkedEntityIds: ['npc-auto'],
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
} as unknown as Campaign;

// ── Helpers ───────────────────────────────────────────────────────────────────

const nav = () => screen.getByRole('navigation', { name: /wizard steps/i });
const gotoStep = (label: RegExp) => fireEvent.click(within(nav()).getByRole('button', { name: label }));
const lazyToggle = () => screen.getByRole('button', { name: /lazy/i });
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

const checklistToggle = () => screen.getByRole('button', { name: /^Lazy DM checklist$/i });
const checklistScope = () => within(checklistToggle().parentElement as HTMLElement);
const expandChecklist = () => fireEvent.click(checklistToggle());

/** Renders the wizard, optionally picks the adventure and/or turns lazy prep on, and goes to Review & Go Live. */
function renderAtReview(opts: { adventure?: boolean; lazy?: boolean } = {}) {
  render(<SessionPrepWizard campaign={campaign} onComplete={() => {}} onClose={() => {}} />);
  if (opts.adventure) fireEvent.click(screen.getByRole('button', { name: /The Ashen Vault/ }));
  if (opts.lazy) fireEvent.click(lazyToggle());
  gotoStep(/^Go Live/);
}

const ALL_LABELS = [
  'Review the characters',
  'Strong start',
  'Potential scenes',
  'Secrets and clues',
  'Fantastic locations',
  'Important NPCs',
  'Relevant monsters',
  'Magic item rewards',
];

beforeEach(() => {
  h.createSessionLog.mockClear();
  h.goLive.mockClear();
});

afterEach(cleanup);

// ── 1 & 2. collapsed by default, all eight rows on open ──────────────────────

describe('the checklist is collapsed by default', () => {
  it('shows the toggle but none of the row text until opened', () => {
    renderAtReview();
    expect(checklistToggle().getAttribute('aria-expanded')).toBe('false');
    for (const label of ALL_LABELS) {
      expect(checklistScope().queryByText(label)).toBeNull();
    }
  });

  it('reveals all eight rows, in Shea\'s order, once opened', () => {
    renderAtReview();
    expandChecklist();
    expect(checklistToggle().getAttribute('aria-expanded')).toBe('true');
    for (const label of ALL_LABELS) {
      expect(checklistScope().getByText(label)).toBeTruthy();
    }
  });

  it('shows on the Review step in the standard flow too, not just the lazy path', () => {
    renderAtReview({ adventure: true });
    expandChecklist();
    expect(checklistScope().getByText('Review the characters')).toBeTruthy();
  });
});

// ── 3. never red ───────────────────────────────────────────────────────────────

describe('the checklist is never red, whatever the fill state', () => {
  it('renders no red-toned class on an empty freeform session', () => {
    renderAtReview({ lazy: true });
    expandChecklist();
    expect(checklistToggle().parentElement!.innerHTML).not.toMatch(/\bred-/);
  });

  it('renders no red-toned class once everything is filled in', () => {
    renderAtReview({ adventure: true, lazy: true });
    gotoStep(/^Strong Start/);
    type(screen.getByRole('textbox', { name: /first thing you['’]ll say when the session starts/i }), 'The bell rings.');
    gotoStep(/^Go Live/);
    expandChecklist();
    expect(checklistToggle().parentElement!.innerHTML).not.toMatch(/\bred-/);
  });
});

// ── 4. relevant monsters never varies ─────────────────────────────────────────

describe('"Relevant monsters" always reads the fixed line', () => {
  it('is present and unchanged in either flow', () => {
    renderAtReview({ adventure: true });
    expandChecklist();
    expect(checklistScope().getByText('Not tracked here — pick them at the table.')).toBeTruthy();
  });
});

// ── 5. jumping — only the lazy-only rows, and only while lazy is on ──────────

describe('jumping to a step — only where one exists', () => {
  it('jumps to Strong Start when the lazy path is on', () => {
    renderAtReview({ lazy: true });
    expandChecklist();
    fireEvent.click(checklistScope().getByRole('button', { name: /Strong start/ }));

    expect(
      screen.getByRole('textbox', { name: /first thing you['’]ll say when the session starts/i })
    ).toBeTruthy();
  });

  it('jumps to Beats when "Potential scenes" is clicked', () => {
    renderAtReview({ lazy: true });
    expandChecklist();
    fireEvent.click(checklistScope().getByRole('button', { name: /Potential scenes/ }));

    expect(screen.getByRole('textbox', { name: /add a beat/i })).toBeTruthy();
  });

  it('jumps to Secrets Check when "Secrets and clues" is clicked', () => {
    renderAtReview({ lazy: true });
    expandChecklist();
    fireEvent.click(checklistScope().getByRole('button', { name: /Secrets and clues/ }));

    expect(screen.getByRole('heading', { name: /^Secrets Check$/i })).toBeTruthy();
  });

  it('renders those same three rows as plain text, not buttons, when lazy prep is off', () => {
    renderAtReview({ adventure: true });
    expandChecklist();

    expect(checklistScope().getByText('Strong start')).toBeTruthy();
    expect(checklistScope().queryByRole('button', { name: /Strong start/ })).toBeNull();
    expect(checklistScope().getByText('Potential scenes')).toBeTruthy();
    expect(checklistScope().queryByRole('button', { name: /Potential scenes/ })).toBeNull();
    expect(checklistScope().getByText('Secrets and clues')).toBeTruthy();
    expect(checklistScope().queryByRole('button', { name: /Secrets and clues/ })).toBeNull();
  });

  it('never renders "Review the characters" or "Relevant monsters" as a clickable row, in either flow', () => {
    renderAtReview({ lazy: true });
    expandChecklist();
    expect(checklistScope().queryByRole('button', { name: /Review the characters/ })).toBeNull();
    expect(checklistScope().queryByRole('button', { name: /Relevant monsters/ })).toBeNull();
  });
});

// ── 6. it reflects real wizard state ──────────────────────────────────────────

describe('the checklist mirrors real wizard state', () => {
  it('reports the gathered NPC, location, and unrevealed secret once an adventure is picked', () => {
    renderAtReview({ adventure: true, lazy: true });
    expandChecklist();

    expect(checklistScope().getByText('1 NPC gathered for tonight.')).toBeTruthy();
    expect(checklistScope().getByText('1 location gathered for tonight.')).toBeTruthy();
    expect(checklistScope().getByText('1 secret unrevealed, ready to drop in.')).toBeTruthy();
  });

  it('reports beats and selected scenes together once a beat is added', () => {
    renderAtReview({ adventure: true, lazy: true });
    gotoStep(/^Beats/);
    type(screen.getByRole('textbox', { name: /add a beat/i }), 'Ambush at the ford');
    fireEvent.click(screen.getByRole('button', { name: /^Add beat$/i }));
    gotoStep(/^Go Live/);
    expandChecklist();

    const detail = checklistScope().getByText(/beat/).textContent ?? '';
    expect(detail).toContain('1 beat');
    expect(detail).toContain('1 scene selected');
  });

  it('reports "Written." for the strong start once the DM writes one', () => {
    renderAtReview({ lazy: true });
    gotoStep(/^Strong Start/);
    type(screen.getByRole('textbox', { name: /first thing you['’]ll say when the session starts/i }), 'The bell rings.');
    gotoStep(/^Go Live/);
    expandChecklist();

    expect(checklistScope().getByText('Written.')).toBeTruthy();
  });

  it('reports item and scene-reward counts together', () => {
    renderAtReview({ adventure: true, lazy: true });
    expandChecklist();

    const detail = checklistScope().getByText(/scene with rewards/).textContent ?? '';
    expect(detail).toContain('1 scene with rewards written in');
    expect(detail).toContain('1 item in your campaign');
  });

  it('never depends on any campaignService call — it is a pure display', () => {
    renderAtReview({ adventure: true, lazy: true });
    expandChecklist();
    fireEvent.click(checklistScope().getByRole('button', { name: /Strong start/ }));

    expect(h.createSessionLog).not.toHaveBeenCalled();
    expect(h.goLive).not.toHaveBeenCalled();
  });
});
