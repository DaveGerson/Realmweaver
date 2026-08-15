// @vitest-environment jsdom
/**
 * wp-f2-entity-editors — finding #72
 *
 * Every "generate here" handler swallows its error:
 *   LocationEditor.handleGeneratePoi (241)        -> console.error only
 *   LocationEditor.handleGenerateNpcAtLocation (268) -> console.error only
 *   FactionEditor.handleGenerateMemberNpc, SceneEditor.handleGenerateNpcForScene,
 *   PlotEditor.handleGeneratePlotScene, AdventureEditor.handleGenerateNextScene — same.
 * The spinner runs, stops, and nothing appears: indistinguishable from a no-op,
 * so the GM clicks again and again. The quick-generate forms all render an
 * inline error string; these do not.
 *
 * Contract: a failed generate-here call must surface a visible error —
 * `useToast()` (role="alert") or an inline error node — not just console.
 *
 * This test pins the LocationEditor "Generate NPC at this location" panel as
 * the representative; the same treatment is required in the sibling editors.
 * SceneEditor.handleGenerateNpcForScene was the last holdout (its catch was
 * console.error only) — the third case below pins its inline error too.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { Campaign, Location, Plot, Scene } from '../../types/index';

const generateNpc = vi.fn(async () => { throw new Error('proxy 500'); });
const generateScene = vi.fn(async () => { throw new Error('proxy 500'); });
vi.mock('../../services/aiService', () => ({
  generateNpc: (...args: unknown[]) => generateNpc(...(args as [])),
  generateScene: (...args: unknown[]) => generateScene(...(args as [])),
  generatePoiFromLoot: vi.fn(),
  generateEnhancedText: vi.fn(),
}));

const storeState = { campaigns: [], activeCampaignId: null, saveStatus: 'idle', lastSavedAt: null, appStatus: 'editing' };
vi.mock('../../services/campaignService', () => ({
  campaignService: {
    createNpc: vi.fn(() => 'npc-generated'),
    createScene: vi.fn(() => 'scene-generated'),
    subscribe: () => () => {},
    getState: () => storeState,
    getActiveCampaign: () => undefined,
  },
}));

const { LocationEditor } = await import('../../components/editors/LocationEditor');
const { PlotEditor } = await import('../../components/editors/PlotEditor');
const { SceneEditor } = await import('../../components/editors/SceneEditor');
const { ConfirmDialogProvider } = await import('../../hooks/useConfirmDialog');
const { ToastProvider } = await import('../../hooks/useToast');

afterEach(() => {
  generateNpc.mockClear();
  generateScene.mockClear();
  cleanup();
});

const location = {
  id: 'loc-1',
  name: 'The Sunken Ward',
  description: 'A flooded district',
  secrets: '',
  loot: [],
  subLocationIds: [],
  connections: [],
  pointsOfInterest: [],
  history: [],
} as unknown as Location;

const campaign = {
  id: 'camp-1', title: 'Test Campaign',
  npcs: [], locations: [location], factions: [], items: [], adventures: [],
  articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

function byText(container: HTMLElement, re: RegExp): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button'))
    .find(b => re.test(b.textContent || '')) as HTMLButtonElement | undefined;
}

const plot = {
  id: 'plot-1',
  title: 'The Drowned Crown',
  status: 'active' as const,
  description: '',
  relatedEntityIds: [],
} as unknown as Plot;

const plotCampaign = {
  id: 'camp-2', title: 'Test Campaign',
  npcs: [], locations: [], factions: [], items: [],
  adventures: [{ id: 'adv-1', title: 'The Sunken City', scenes: [] }],
  articles: [], sessionLogs: [], playerCharacters: [], plots: [plot], notes: [], secrets: [],
} as unknown as Campaign;

const scene = {
  id: 'scene-1',
  title: 'The Drowned Vault',
  type: 'social',
  readAloudText: '',
  gmNotes: '',
  rewards: '',
  npcIds: [],
  skillChecks: [],
  locationId: undefined,
} as unknown as Scene;

const sceneCampaign = {
  id: 'camp-3', title: 'Test Campaign',
  npcs: [], locations: [], factions: [], items: [], adventures: [],
  articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

describe('wp-f2-entity-editors #72 — failed generate-here calls are visible to the GM', () => {
  it('shows an error when "Generate NPC at this location" rejects', async () => {
    const { container } = render(
      <ToastProvider>
        <ConfirmDialogProvider>
          <LocationEditor
            location={location}
            allLocations={[location]}
            campaign={campaign}
            onUpdate={() => {}}
            onDelete={() => {}}
            isMockMode={false}
            campaignContext="Setting: a drowned empire"
          />
        </ConfirmDialogProvider>
      </ToastProvider>,
    );

    const trigger = byText(container, /generate npc at this location/i);
    expect(trigger, 'generate-here trigger not found').toBeTruthy();
    fireEvent.click(trigger!);

    const submit = byText(container, /^generate$/i);
    expect(submit, 'panel submit button not found').toBeTruthy();
    fireEvent.click(submit!);

    await waitFor(() => expect(generateNpc).toHaveBeenCalled());

    await waitFor(() => {
      const alerts = document.querySelectorAll('[role="alert"]');
      const inlineError = Array.from(document.querySelectorAll('p, span, div'))
        .some(el => /fail|error|could not|unable/i.test(el.textContent || '') && el.children.length === 0);
      expect(
        alerts.length > 0 || inlineError,
        'a failed generation must surface a toast or inline error, not just console.error',
      ).toBe(true);
    });
  });

  it('shows an error when PlotEditor "Generate scene for this plot" rejects (PlotEditor.handleGeneratePlotScene)', async () => {
    // PlotEditor.tsx is unowned in plan.json, but this residual half of
    // finding #72 was assigned to wp-f2 — see verify-reports.json.
    const { container } = render(
      <ToastProvider>
        <ConfirmDialogProvider>
          <PlotEditor
            plot={plot}
            campaign={plotCampaign}
            onUpdate={() => {}}
            onDelete={() => {}}
            isMockMode={false}
            campaignContext="Setting: a drowned empire"
          />
        </ConfirmDialogProvider>
      </ToastProvider>,
    );

    const trigger = byText(container, /generate scene for this plot/i);
    expect(trigger, 'generate-here trigger not found').toBeTruthy();
    fireEvent.click(trigger!);

    const submit = byText(container, /^generate$/i);
    expect(submit, 'panel submit button not found').toBeTruthy();
    fireEvent.click(submit!);

    await waitFor(() => expect(generateScene).toHaveBeenCalled());

    await waitFor(() => {
      const alerts = document.querySelectorAll('[role="alert"]');
      const inlineError = Array.from(document.querySelectorAll('p, span, div'))
        .some(el => /fail|error|could not|unable/i.test(el.textContent || '') && el.children.length === 0);
      expect(
        alerts.length > 0 || inlineError,
        'a failed generation must surface a toast or inline error, not just console.error',
      ).toBe(true);
    });
  });

  it('shows an error when SceneEditor "Generate NPC for this scene" rejects (SceneEditor.handleGenerateNpcForScene)', async () => {
    // The last unfixed handler of finding #72: its catch was console.error
    // only, so a proxy 500 / static-dist 404 left the GM with a stopped
    // spinner and no NPC — indistinguishable from a no-op.
    const { container } = render(
      <ToastProvider>
        <ConfirmDialogProvider>
          <SceneEditor
            scene={scene}
            allNpcs={[]}
            allLocations={[]}
            campaign={sceneCampaign}
            onUpdate={() => {}}
            onDelete={() => {}}
            isMockMode={false}
            campaignContext="Setting: a drowned empire"
          />
        </ConfirmDialogProvider>
      </ToastProvider>,
    );

    // The generate panel lives in the Connections tab; the default tab is 'narrative'.
    const connectionsTab = byText(container, /^Connections$/i);
    expect(connectionsTab, 'Connections tab not found').toBeTruthy();
    fireEvent.click(connectionsTab!);

    const trigger = byText(container, /generate npc for this scene/i);
    expect(trigger, 'generate-here trigger not found').toBeTruthy();
    fireEvent.click(trigger!);

    const submit = byText(container, /^generate$/i);
    expect(submit, 'panel submit button not found').toBeTruthy();
    fireEvent.click(submit!);

    await waitFor(() => expect(generateNpc).toHaveBeenCalled());

    await waitFor(() => {
      const alerts = document.querySelectorAll('[role="alert"]');
      const inlineError = Array.from(document.querySelectorAll('p, span, div'))
        .some(el => /fail|error|could not|unable/i.test(el.textContent || '') && el.children.length === 0);
      expect(
        alerts.length > 0 || inlineError,
        'a failed generation must surface a toast or inline error, not just console.error',
      ).toBe(true);
    });
  });
});
