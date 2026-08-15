// @vitest-environment jsdom
/**
 * wp-f1-session-editors — finding #109
 *
 * SceneEditor accepts `campaignContext?: string` and forwards it to generateNpc
 * and to five RegenerateButton instances — but ViewRouter (the only place the
 * real, non-preview scene editor is rendered) never passes it, while the
 * sibling SceneGenerator two blocks above does. Every regeneration of
 * read-aloud text / GM notes / rewards, and every "Generate NPC for this
 * scene", therefore runs with no world context.
 *
 * Contract: ViewRouter must pass campaignContext to SceneEditor (CLAUDE.md:
 * "Always pass campaignContext"). Ideally the prop becomes required so the
 * omission is a compile error.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { Campaign, Scene, Adventure } from '../../types/index';

const sceneEditorProps: Record<string, unknown>[] = [];

vi.mock('@/components/editors/SceneEditor', () => ({
  SceneEditor: (props: Record<string, unknown>) => {
    sceneEditorProps.push(props);
    return <div data-testid="scene-editor-stub" />;
  },
}));

const { ViewRouter } = await import('../../components/layout/ViewRouter');

afterEach(() => {
  sceneEditorProps.length = 0;
  cleanup();
});

const scene = {
  id: 'scene-1',
  title: 'The Drowned Vault',
  type: 'social',
  readAloudText: '',
  gmNotes: '',
  rewards: '',
  npcIds: [],
  skillChecks: [],
} as unknown as Scene;

const adventure = { id: 'adv-1', title: 'Salt & Ruin', scenes: [scene] } as unknown as Adventure;

const campaign = {
  id: 'camp-1',
  title: 'Test Campaign',
  npcs: [], locations: [], factions: [], items: [], adventures: [adventure],
  articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

const CONTEXT = 'Campaign: Test Campaign\nSetting: A drowned empire';

describe('wp-f1-session-editors #109 — ViewRouter must give SceneEditor campaign context', () => {
  it('passes campaignContext through to SceneEditor', () => {
    const noop = () => {};
    const props = {
      campaign,
      activeView: 'adventures',
      activeGenerator: null,
      isOfficialSetting: false,
      isMockMode: true,
      campaignContext: CONTEXT,
      selectedAdventure: adventure,
      selectedScene: scene,
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

    expect(sceneEditorProps.length).toBeGreaterThan(0);
    expect(sceneEditorProps[0].campaignContext).toBe(CONTEXT);
  });
});
