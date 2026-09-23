// @vitest-environment jsdom
/**
 * SPEC — Tonight's Table view wiring (Wave 1, lane P1)
 *
 * A new screen in Realmweaver is three call sites, and this file pins all
 * three:
 *
 * 1. `EditorView` in App.tsx gains `'tonight'`, so every navigation surface
 *    can name the screen.
 *
 * 2. `ViewRouter` renders `TonightsTable` for that view, handing it the
 *    campaign, the entity-link navigator, and the go-live callback it needs to
 *    take the GM into the session it just prepped. Nothing is selected when a
 *    view is chosen, so the branch sits above the editor branches and below
 *    the live Session Runner, which always wins.
 *
 * 3. `CampaignSidebar` carries a "Tonight's Table" entry at the very top of
 *    the nav — above the Campaign State group and its Session Timeline entry,
 *    because this is the front door, not another shelf. It reports itself as
 *    the current page when it is, and it is never hidden by the DM style: a
 *    guided GM needs the front door most.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import type { Campaign, SessionLog } from '../types/index';
import type { EditorView } from '../App';
import { CampaignSidebar } from '../components/layout/CampaignSidebar';
import { ToastProvider } from '../hooks/useToast';
import { ConfirmDialogProvider } from '../hooks/useConfirmDialog';

const h = vi.hoisted(() => ({ tableProps: [] as Record<string, unknown>[] }));

vi.mock('@/components/views/TonightsTable', () => ({
  TonightsTable: (props: Record<string, unknown>) => {
    h.tableProps.push(props);
    return <div data-testid="tonights-table-stub" />;
  },
}));

const { ViewRouter } = await import('../components/layout/ViewRouter');

// --- fixtures -------------------------------------------------------------

function makeCampaign(over: Record<string, unknown> = {}): Campaign {
  return {
    id: 'camp-1',
    title: 'Ashfall',
    setting: 'A dying empire',
    settingType: 'custom',
    npcs: [],
    locations: [],
    factions: [],
    items: [],
    adventures: [],
    articles: [],
    sessionLogs: [] as SessionLog[],
    playerCharacters: [],
    plots: [],
    notes: [],
    secrets: [],
    ...over,
  } as unknown as Campaign;
}

const campaign = makeCampaign();

const emptyIds = {
  adventure: null, scene: null, npc: null, location: null, faction: null,
  item: null, article: null, sessionLog: null, playerCharacter: null, plot: null, note: null,
};

const noop = () => {};

function routerProps(over: Record<string, unknown>) {
  return {
    campaign,
    activeView: 'tonight',
    activeGenerator: null,
    isOfficialSetting: false,
    isMockMode: true,
    campaignContext: 'Campaign: Ashfall',
    selectedAdventure: null,
    selectedScene: null,
    selectedNpc: null,
    selectedLocation: null,
    selectedFaction: null,
    selectedItem: null,
    selectedArticle: null,
    selectedSessionLog: null,
    selectedPlayerCharacter: null,
    selectedPlot: null,
    selectedNote: null,
    onEndSession: noop,
    onOpenCoach: noop,
    onNavigate: noop,
    onResetSelections: noop,
    onSetActiveView: noop,
    onSetActiveGenerator: noop,
    onSetSelectedAdventureId: noop,
    onSetSelectedSceneId: noop,
    onSetSelectedNpcId: noop,
    onSetSelectedLocationId: noop,
    onSetSelectedFactionId: noop,
    onSetSelectedItemId: noop,
    onSetSelectedArticleId: noop,
    onSetSelectedSessionLogId: noop,
    onSetSelectedPlayerCharacterId: noop,
    onSetSelectedPlotId: noop,
    onSetSelectedNoteId: noop,
    onGoLive: noop,
    onImportPC: async () => '',
    onAddToast: noop,
    ...over,
  } as unknown as React.ComponentProps<typeof ViewRouter>;
}

/** Sibling views inside ViewRouter reach for useToast / useConfirmDialog. */
const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ToastProvider><ConfirmDialogProvider>{children}</ConfirmDialogProvider></ToastProvider>
);

function renderRouter(over: Record<string, unknown> = {}) {
  return render(<Providers><ViewRouter {...routerProps(over)} /></Providers>);
}

beforeEach(() => { h.tableProps.length = 0; });
afterEach(cleanup);

// --- 1. the view name -----------------------------------------------------

describe('EditorView — the screen has a name', () => {
  it('accepts "tonight"', () => {
    const view: EditorView = 'tonight';
    expect(view).toBe('tonight');
  });
});

// --- 2. routing -----------------------------------------------------------

describe('ViewRouter — Tonight\'s Table is a view like any other', () => {
  it('renders it for the tonight view', () => {
    renderRouter();
    expect(screen.getByTestId('tonights-table-stub')).toBeTruthy();
  });

  it('hands it the campaign and both callbacks', () => {
    const onNavigate = vi.fn();
    const onGoLive = vi.fn();
    renderRouter({ onNavigate, onGoLive });
    expect(h.tableProps).toHaveLength(1);
    expect(h.tableProps[0].campaign).toBe(campaign);
    expect(h.tableProps[0].onNavigate).toBe(onNavigate);
    expect(h.tableProps[0].onGoLive).toBe(onGoLive);
  });

  it('stays out of the way of every other view', () => {
    renderRouter({ activeView: 'notes' });
    expect(screen.queryByTestId('tonights-table-stub')).toBeNull();
  });

  it('yields to a live session', () => {
    const live = {
      id: 'sess-live', title: 'Tonight', status: 'active', sessionDate: '2026-01-01',
      plannedSceneIds: [], prepNotes: '', relatedPlotIds: [], runningNotes: '',
      structuredNotes: [], encounterLog: [], recap: '', notableEvents: '', looseEnds: '',
    } as unknown as SessionLog;
    const withLive = makeCampaign({ activeSessionId: 'sess-live', sessionLogs: [live] });
    renderRouter({ campaign: withLive, activeView: 'session-runner' });
    expect(screen.queryByTestId('tonights-table-stub')).toBeNull();
  });
});

// --- 3. the sidebar entry -------------------------------------------------

function renderSidebar(over: Record<string, unknown> = {}) {
  const onSelectView = vi.fn();
  render(
    <CampaignSidebar
      campaign={(over.campaign as Campaign) ?? campaign}
      activeView={(over.activeView as EditorView) ?? 'setting'}
      onSelectView={onSelectView}
      selectedIds={emptyIds}
      onSelect={noop}
      onShowGenerator={noop}
      onReorderScene={noop}
    />
  );
  return { onSelectView };
}

describe('CampaignSidebar — the front door sits at the top', () => {
  it('carries a Tonight\'s Table entry', () => {
    renderSidebar();
    expect(screen.getByRole('button', { name: /tonight.s table/i })).toBeTruthy();
  });

  it('takes the GM there', () => {
    const { onSelectView } = renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: /tonight.s table/i }));
    expect(onSelectView).toHaveBeenCalledWith('tonight');
  });

  it('sits above the Session Timeline entry', () => {
    renderSidebar();
    const buttons = screen.getAllByRole('button');
    const tonight = buttons.findIndex(b => /tonight.s table/i.test(b.textContent ?? ''));
    const timeline = buttons.findIndex(b => /session timeline/i.test(b.textContent ?? ''));
    expect(tonight).toBeGreaterThanOrEqual(0);
    expect(timeline).toBeGreaterThanOrEqual(0);
    expect(tonight).toBeLessThan(timeline);
  });

  it('reports itself as the current page when it is', () => {
    renderSidebar({ activeView: 'tonight' });
    expect(screen.getByRole('button', { name: /tonight.s table/i }).getAttribute('aria-current')).toBe('page');
    cleanup();
    renderSidebar({ activeView: 'setting' });
    expect(screen.getByRole('button', { name: /tonight.s table/i }).getAttribute('aria-current')).toBeNull();
  });

  it('stays visible for a guided GM', () => {
    renderSidebar({ campaign: makeCampaign({ dmStyle: 'guided' }) });
    expect(screen.getByRole('button', { name: /tonight.s table/i })).toBeTruthy();
  });
});
