// @vitest-environment jsdom
/**
 * wp-f2-entity-editors — finding #64
 *
 * ViewRouter renders AdventureEditor (lines 240-246) with only
 * `adventure / campaign / onUpdate / onDelete / onNavigate` — no `isMockMode`
 * and no `campaignContext`, unlike every sibling editor in the same file.
 * AdventureEditor defaults `isMockMode = false`, and App.tsx starts in mock
 * mode, so "Generate next scene" and the RegenerateButtons in that editor fire
 * REAL provider calls while the rest of the app is mocked. With no key/CLI the
 * request rejects and `handleGenerateNextScene` only console.errors — the
 * spinner stops and nothing happens. Any scene that does get generated is
 * generated with no world context, violating the "always pass campaignContext"
 * rule in CLAUDE.md.
 *
 * Contract: ViewRouter must forward both props to AdventureEditor. (Dropping
 * the `= false` default so the omission is a type error is the belt-and-braces
 * half of the fix; AdventureDashboard's chat preview needs the same props.)
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { Adventure, Campaign } from '../../types/index';

const adventureEditorProps: Record<string, unknown>[] = [];

vi.mock('@/components/editors/AdventureEditor', () => ({
  AdventureEditor: (props: Record<string, unknown>) => {
    adventureEditorProps.push(props);
    return <div data-testid="adventure-editor-stub" />;
  },
}));

const { ViewRouter } = await import('../../components/layout/ViewRouter');

afterEach(() => {
  adventureEditorProps.length = 0;
  cleanup();
});

const adventure = { id: 'adv-1', title: 'Salt & Ruin', scenes: [] } as unknown as Adventure;

const campaign = {
  id: 'camp-1', title: 'Test Campaign',
  npcs: [], locations: [], factions: [], items: [], adventures: [adventure],
  articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

const CONTEXT = 'Campaign: Test Campaign\nSetting: A drowned empire';

describe('wp-f2-entity-editors #64 — ViewRouter must give AdventureEditor mock mode + context', () => {
  it('forwards isMockMode and campaignContext', () => {
    const noop = () => {};
    const props = {
      campaign,
      activeView: 'adventures',
      activeGenerator: null,
      isOfficialSetting: false,
      isMockMode: true,
      campaignContext: CONTEXT,
      selectedAdventure: adventure,
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
    } as unknown as React.ComponentProps<typeof ViewRouter>;

    render(<ViewRouter {...props} />);

    expect(adventureEditorProps.length).toBeGreaterThan(0);
    expect(adventureEditorProps[0].isMockMode).toBe(true);
    expect(adventureEditorProps[0].campaignContext).toBe(CONTEXT);
  });
});
