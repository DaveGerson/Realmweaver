// @vitest-environment jsdom
/**
 * wp-f2-entity-editors — finding #104
 *
 * PlotDashboard's PlotCard (line 206) and NoteDashboard's note cards
 * (NoteDashboard.tsx:980) render bare <button> elements with no
 * `{...getRovingProps(index)}`; neither file imports useRovingTabIndex —
 * unlike the NPC, Location, Faction, Item, Adventure, Article,
 * PlayerCharacter and SessionLog dashboards. CLAUDE.md requires every
 * dashboard to use useRovingTabIndex for keyboard grid navigation. Today a
 * keyboard user must Tab through every card individually and arrow keys do
 * nothing, so the interaction model silently changes between views.
 *
 * Contract: cards form a roving-tabindex group — exactly one card is in the
 * tab order (tabIndex 0), the rest are -1, and an arrow key moves focus to the
 * next card.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { Note, Plot } from '../../types/index';
import { PlotDashboard } from '../../components/dashboards/PlotDashboard';
import { NoteDashboard } from '../../components/dashboards/NoteDashboard';

afterEach(cleanup);

const plots = [
  { id: 'plot-1', title: 'The Drowned Crown', description: 'A lost regalia', status: 'active', relatedEntityIds: [] },
  { id: 'plot-2', title: 'Salt in the Ledger', description: 'Guild fraud', status: 'active', relatedEntityIds: [] },
  { id: 'plot-3', title: 'The Tidewatcher', description: 'A watcher stirs', status: 'active', relatedEntityIds: [] },
] as unknown as Plot[];

function plotCards(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button'))
    .filter(b => plots.some(p => (b.textContent || '').includes(p.title))) as HTMLButtonElement[];
}

/**
 * Active Arcs renders `grid-cols-1 sm:grid-cols-2`, so the roving group's
 * `columns` option (finding #104) must resolve differently depending on
 * viewport width. jsdom defaults `window.innerWidth` to 1024 (>= the 640px
 * `sm` breakpoint), so tests that care about the resolved column count set
 * it explicitly rather than relying on that default.
 */
function setViewportWidth(width: number): () => void {
  const original = window.innerWidth;
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  return () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: original });
  };
}

describe('wp-f2-entity-editors #104 — plot cards are a roving-tabindex group', () => {
  it('puts exactly one card in the tab order', () => {
    const { container } = render(
      <PlotDashboard
        plots={plots}
        sessionLogs={[]}
        onPlotCreated={() => {}}
        onSelectPlot={() => {}}
      />,
    );

    const cards = plotCards(container);
    expect(cards.length).toBe(3);

    const tabIndexes = cards.map(c => c.tabIndex);
    expect(tabIndexes.filter(t => t === 0).length).toBe(1);
    expect(tabIndexes.filter(t => t === -1).length).toBe(2);
  });

  it('moves focus to the adjacent card below on a single-column (mobile) viewport', () => {
    // Below the `sm` (640px) breakpoint the grid is `grid-cols-1`, so the
    // roving group resolves to 1 column and ArrowDown must land on the very
    // next card, exactly like a single-column list.
    const restoreViewport = setViewportWidth(375);
    try {
      const { container } = render(
        <PlotDashboard
          plots={plots}
          sessionLogs={[]}
          onPlotCreated={() => {}}
          onSelectPlot={vi.fn()}
        />,
      );

      const cards = plotCards(container);
      cards[0].focus();
      fireEvent.keyDown(cards[0], { key: 'ArrowDown' });

      expect(document.activeElement).toBe(cards[1]);
    } finally {
      restoreViewport();
    }
  });

  it('skips a full row (2 columns) on ArrowDown once the `sm` grid breakpoint is active (finding #104)', () => {
    // At >= 640px the grid is `grid-cols-1 sm:grid-cols-2` (PlotDashboard.tsx),
    // so the roving group's `columns` must resolve to 2 here too — otherwise
    // ArrowDown lands on the card to the right (index 1) instead of the card
    // below it (index 2), which is what the verifier's #104 finding caught.
    const restoreViewport = setViewportWidth(1024);
    try {
      const { container } = render(
        <PlotDashboard
          plots={plots}
          sessionLogs={[]}
          onPlotCreated={() => {}}
          onSelectPlot={vi.fn()}
        />,
      );

      const cards = plotCards(container);
      cards[0].focus();
      fireEvent.keyDown(cards[0], { key: 'ArrowDown' });

      expect(document.activeElement).toBe(cards[2]);
      expect(document.activeElement).not.toBe(cards[1]);
    } finally {
      restoreViewport();
    }
  });
});

const notes = [
  { id: 'note-1', title: 'Table rules', content: 'No phones', tags: ['table'], lastModified: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'note-2', title: 'Session prep', content: 'Open on the docks', tags: ['prep'], lastModified: '2026-01-02T00:00:00.000Z', createdAt: '2026-01-02T00:00:00.000Z' },
] as unknown as Note[];

describe('wp-f2-entity-editors #104 — note cards are a roving-tabindex group', () => {
  it('puts exactly one note card in the tab order', () => {
    const { container } = render(
      <NoteDashboard notes={notes} onNoteCreated={() => {}} onSelectNote={() => {}} isMockMode />,
    );

    const cards = Array.from(container.querySelectorAll('button'))
      .filter(b => notes.some(n => (b.textContent || '').includes(n.title))) as HTMLButtonElement[];
    expect(cards.length).toBe(2);

    const tabIndexes = cards.map(c => c.tabIndex);
    expect(tabIndexes.filter(t => t === 0).length).toBe(1);
    expect(tabIndexes.filter(t => t === -1).length).toBe(1);
  });
});
