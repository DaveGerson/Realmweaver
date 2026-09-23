// @vitest-environment jsdom
/**
 * Roadmap N4 — dashboards and the command palette keep their DOM bounded at
 * scale, while small campaigns render exactly as before.
 */
import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react';
import type { NPC, Location } from '../types/index';
import { NpcDashboard } from '../components/dashboards/NpcDashboard';
import { LocationDashboard } from '../components/dashboards/LocationDashboard';
import { CommandPalette, MAX_ENTITY_RESULTS } from '../components/common/CommandPalette';
import { INCREMENTAL_LIST_DEFAULTS } from '../hooks/useIncrementalList';
import { ConfirmDialogProvider } from '../hooks/useConfirmDialog';
import { ToastProvider } from '../hooks/useToast';

const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ToastProvider><ConfirmDialogProvider>{children}</ConfirmDialogProvider></ToastProvider>
);

beforeEach(() => {
  (Element.prototype as any).scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function makeNpcs(n: number): NPC[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `npc-${i}`,
    name: `Villager ${String(i).padStart(3, '0')}`,
    description: `A resident of the town, number ${i}.`,
    traits: 'curious',
  })) as unknown as NPC[];
}

function npcCards(): HTMLElement[] {
  // querySelectorAll, not *ByRole: role queries over hundreds of nodes are
  // slow in jsdom and this file is about node counts, not a11y names.
  return Array.from(document.querySelectorAll<HTMLElement>('button')).filter(b => /Villager \d{3}/.test(b.textContent || ''));
}

function renderNpcs(n: number) {
  return render(
    <NpcDashboard
      npcs={makeNpcs(n)}
      onNpcCreated={() => {}}
      onSelectNpc={() => {}}
      isMockMode
    />,
    { wrapper: Providers },
  );
}

describe('N4 — NpcDashboard with 300 NPCs', () => {
  it('bounds the rendered card count and total DOM size', () => {
    const { container } = renderNpcs(300);
    expect(screen.getByText('Existing NPCs (300)')).toBeTruthy();
    expect(npcCards().length).toBe(INCREMENTAL_LIST_DEFAULTS.initialCount);

    // Total DOM: the whole dashboard (creation panel included) stays far below
    // what 300 live cards would produce (~7 nodes per card).
    const totalNodes = container.querySelectorAll('*').length;
    const { container: small } = renderNpcs(0);
    const baseline = small.querySelectorAll('*').length;
    expect(totalNodes - baseline).toBeLessThan(INCREMENTAL_LIST_DEFAULTS.initialCount * 10);

    expect(screen.getByText(/Showing 60 of 300 NPCs/)).toBeTruthy();
  });

  it('"Show more" grows the grid by a page', () => {
    renderNpcs(300);
    fireEvent.click(screen.getByText(/Show more \(240 remaining\)/));
    expect(npcCards().length).toBe(120);
  });

  it('keyboard End reaches the 300th NPC (window grows, focus lands)', () => {
    renderNpcs(300);
    const first = npcCards()[0];
    act(() => first.focus());
    fireEvent.keyDown(first, { key: 'End' });
    expect(document.activeElement?.textContent).toContain('Villager 299');
  });

  it('search filters across ALL NPCs, not only the rendered window, and resets the window', () => {
    renderNpcs(300);
    fireEvent.change(screen.getByPlaceholderText('Search NPCs...'), { target: { value: 'Villager 29' } });
    // 290-299 => 10 matches — below the threshold, all rendered (they all
    // sit beyond the initial 60-card window, so this proves the filter runs
    // over the full list).
    const cards = npcCards();
    expect(cards.length).toBe(10);
    expect(cards.some(c => c.textContent?.includes('Villager 299'))).toBe(true);
    expect(screen.queryByTestId('incremental-list-footer')).toBeNull();
  });

  it('small campaigns render every card and no footer', () => {
    renderNpcs(100);
    expect(npcCards().length).toBe(100);
    expect(screen.queryByTestId('incremental-list-footer')).toBeNull();
  });
});

describe('N4 — LocationDashboard with 300 locations', () => {
  it('renders a bounded window', () => {
    const locations = Array.from({ length: 300 }, (_, i) => ({
      id: `loc-${i}`, name: `Hamlet ${i}`, description: '', type: 'town', secrets: '',
    })) as unknown as Location[];
    render(
      <LocationDashboard
        locations={locations}
        onLocationCreated={() => {}}
        onSelectLocation={() => {}}
        isMockMode
      />,
      { wrapper: Providers },
    );
    const cards = Array.from(document.querySelectorAll('button')).filter(b => /Hamlet \d+/.test(b.textContent || ''));
    expect(cards.length).toBe(INCREMENTAL_LIST_DEFAULTS.initialCount);
  });
});

describe('N4 — CommandPalette global result cap', () => {
  function renderPalette(npcs: NPC[]) {
    const noop = () => {};
    render(
      <CommandPalette
        isOpen
        onClose={noop}
        npcs={npcs}
        locations={[]}
        factions={[]}
        items={[]}
        adventures={[]}
        articles={[]}
        sessionLogs={[]}
        plots={[]}
        playerCharacters={[]}
        notes={[]}
        recentItems={[]}
        onSelectNpc={noop}
        onSelectLocation={noop}
        onSelectFaction={noop}
        onSelectItem={noop}
        onSelectAdventure={noop}
        onSelectArticle={noop}
        onSelectSessionLog={noop}
        onSelectPlot={noop}
        onSelectPlayerCharacter={noop}
        onSelectScene={noop}
        onSelectNote={noop}
        onNavigateTo={noop}
        onOpenCoach={noop}
      />,
    );
  }

  it('caps entity options and shows an "N more — refine your search" row', () => {
    renderPalette(makeNpcs(300));
    fireEvent.change(screen.getByPlaceholderText(/Search entities/i), { target: { value: 'Villager' } });
    const options = screen.getAllByRole('option').filter(o => /Villager/.test(o.textContent || ''));
    expect(options.length).toBe(MAX_ENTITY_RESULTS);
    expect(screen.getByTestId('command-palette-overflow').textContent).toBe(
      `${300 - MAX_ENTITY_RESULTS} more — refine your search`,
    );
  });

  it('ArrowDown never lands on the overflow row', () => {
    // Just over the cap keeps this keyboard walk cheap.
    renderPalette(makeNpcs(MAX_ENTITY_RESULTS + 3));
    const input = screen.getByPlaceholderText(/Search entities/i);
    fireEvent.change(input, { target: { value: 'Villager' } });
    // Park on the LAST capped entity option (hover sets the active index),
    // then step down once. "Villager" matches no quick action, so the
    // overflow row is the only thing below — and it is not navigable: the
    // active item stays on the last real option.
    const entityOptions = screen.getAllByRole('option').filter(o => /Villager/.test(o.textContent || ''));
    fireEvent.mouseEnter(entityOptions[entityOptions.length - 1]);
    expect(input.getAttribute('aria-activedescendant')).toBe(entityOptions[entityOptions.length - 1].id);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const activeId = input.getAttribute('aria-activedescendant');
    expect(activeId).toBeTruthy();
    const active = document.getElementById(activeId!);
    expect(active?.getAttribute('role')).toBe('option');
    expect(active).toBe(entityOptions[entityOptions.length - 1]);
    expect(screen.getByTestId('command-palette-overflow').getAttribute('role')).toBe('presentation');
  });

  it('shows no overflow row when matches fit under the cap', () => {
    renderPalette(makeNpcs(30));
    fireEvent.change(screen.getByPlaceholderText(/Search entities/i), { target: { value: 'Villager' } });
    expect(screen.getAllByRole('option').filter(o => /Villager/.test(o.textContent || '')).length).toBe(30);
    expect(screen.queryByTestId('command-palette-overflow')).toBeNull();
  });
});
