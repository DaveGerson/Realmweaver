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
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { Campaign, Location } from '../../types/index';

const generateNpc = vi.fn(async () => { throw new Error('proxy 500'); });
vi.mock('../../services/aiService', () => ({
  generateNpc: (...args: unknown[]) => generateNpc(...(args as [])),
  generatePoiFromLoot: vi.fn(),
  generateEnhancedText: vi.fn(),
}));

const storeState = { campaigns: [], activeCampaignId: null, saveStatus: 'idle', lastSavedAt: null, appStatus: 'editing' };
vi.mock('../../services/campaignService', () => ({
  campaignService: {
    createNpc: vi.fn(() => 'npc-generated'),
    subscribe: () => () => {},
    getState: () => storeState,
    getActiveCampaign: () => undefined,
  },
}));

const { LocationEditor } = await import('../../components/editors/LocationEditor');
const { ConfirmDialogProvider } = await import('../../hooks/useConfirmDialog');
const { ToastProvider } = await import('../../hooks/useToast');

afterEach(() => {
  generateNpc.mockClear();
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
});
