// @vitest-environment jsdom
/**
 * wp-f2-entity-editors — finding #64 (adventure-side twin of #71)
 *
 * AdventureDashboard's and AdventureGenerator's chat-preview panels render
 * AdventureEditor with the synthetic id 'preview'
 * (AdventureDashboard.tsx:143, AdventureGenerator.tsx:134). There is no
 * such adventure in the campaign, so `campaignService.createScene('preview', ...)`
 * (called by AdventureEditor.handleGenerateNextScene) silently no-ops — the
 * GM clicks "Generate next scene", the spinner runs and stops, and nothing
 * is added, indistinguishable from success.
 *
 * Contract: mirroring FactionEditor's isPreview guard, the "Generate next
 * scene" trigger must be disabled (not just silently ineffective) while
 * adventure.id === 'preview'. It must still be offered for a real, saved
 * adventure.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { Adventure, Campaign } from '../../types/index';

vi.mock('../../services/aiService', () => ({
  generateScene: vi.fn(),
}));

const storeState = { campaigns: [], activeCampaignId: null, saveStatus: 'idle', lastSavedAt: null, appStatus: 'editing' };
vi.mock('../../services/campaignService', () => ({
  campaignService: {
    createScene: vi.fn(() => 'scene-generated'),
    subscribe: () => () => {},
    getState: () => storeState,
    getActiveCampaign: () => undefined,
  },
}));

const { AdventureEditor } = await import('../../components/editors/AdventureEditor');
const { ConfirmDialogProvider } = await import('../../hooks/useConfirmDialog');

afterEach(cleanup);

function makeAdventure(id: string): Adventure {
  return { id, title: 'Salt & Ruin', hook: '', theme: '', level: 1, scenes: [] } as unknown as Adventure;
}

const campaign = {
  id: 'camp-1', title: 'Test Campaign',
  npcs: [], locations: [], factions: [], items: [], adventures: [],
  articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

function findGenerateSceneButton(container: HTMLElement): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button'))
    .find(b => /generate next scene/i.test(b.textContent || '')) as HTMLButtonElement | undefined;
}

function renderEditor(adventure: Adventure) {
  return render(
    <ConfirmDialogProvider>
      <AdventureEditor
        adventure={adventure}
        campaign={campaign}
        onUpdate={() => {}}
        isMockMode
      />
    </ConfirmDialogProvider>,
  );
}

describe('wp-f2-entity-editors #64 — no live scene generation from an unsaved adventure preview', () => {
  it('does not offer an enabled "Generate next scene" trigger for adventure.id === "preview"', () => {
    const { container } = renderEditor(makeAdventure('preview'));
    const scenesTab = Array.from(container.querySelectorAll('button')).find(b => /scenes/i.test(b.textContent || ''));
    expect(scenesTab, 'Scenes tab button not found').toBeTruthy();
    fireEvent.click(scenesTab!);

    const btn = findGenerateSceneButton(container);
    expect(btn === undefined || btn.disabled).toBe(true);
  });

  it('still offers the trigger for a real, saved adventure', () => {
    const { container } = renderEditor(makeAdventure('adv-1'));
    const scenesTab = Array.from(container.querySelectorAll('button')).find(b => /scenes/i.test(b.textContent || ''));
    expect(scenesTab, 'Scenes tab button not found').toBeTruthy();
    fireEvent.click(scenesTab!);

    const btn = findGenerateSceneButton(container);
    expect(btn, 'saved adventures must keep the generate-here panel').toBeTruthy();
    expect(btn!.disabled).toBe(false);
  });
});
