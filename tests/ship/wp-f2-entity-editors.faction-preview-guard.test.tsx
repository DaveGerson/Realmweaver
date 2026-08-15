// @vitest-environment jsdom
/**
 * wp-f2-entity-editors — finding #71 (UI half)
 *
 * FactionDashboard renders FactionEditor as the LIVE PREVIEW of the chat
 * generator with `faction={{ ...data, id: 'preview' }}` (FactionDashboard.tsx:479),
 * and the Members tab — including the "Generate member NPC" panel — is fully
 * interactive there. `handleGenerateMemberNpc` (FactionEditor.tsx:128) calls
 * `campaignService.createNpc({ ...npcData, factionId: faction.id })`, so
 * clicking it while the faction is still an unsaved draft writes a real NPC
 * into the campaign pointing at the non-existent faction 'preview'.
 *
 * Contract: while the editor renders a draft (preview), the generate-here
 * affordance must not be usable — absent, or rendered disabled. It must still
 * be offered for a real, saved faction.
 *
 * The test passes BOTH possible preview signals (`isPreview` and the synthetic
 * `id: 'preview'`) so either implementation of the guard satisfies it.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { Campaign, Faction, NPC } from '../../types/index';

const generateNpc = vi.fn(async () => ({ name: 'Generated' }));
vi.mock('../../services/aiService', () => ({
  generateNpc: (...args: unknown[]) => generateNpc(...(args as [])),
  generateEnhancedText: vi.fn(),
}));

const createNpc = vi.fn(() => 'npc-generated');
const storeState = { campaigns: [], activeCampaignId: null, saveStatus: 'idle', lastSavedAt: null, appStatus: 'editing' };
vi.mock('../../services/campaignService', () => ({
  campaignService: {
    createNpc: (...args: unknown[]) => createNpc(...(args as [])),
    subscribe: () => () => {},
    getState: () => storeState,
    getActiveCampaign: () => undefined,
  },
}));

const { FactionEditor } = await import('../../components/editors/FactionEditor');
const { ConfirmDialogProvider } = await import('../../hooks/useConfirmDialog');

afterEach(() => {
  createNpc.mockClear();
  generateNpc.mockClear();
  cleanup();
});

const campaign = {
  id: 'camp-1', title: 'Test Campaign',
  npcs: [], locations: [], factions: [], items: [], adventures: [],
  articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

const allNpcs = [{ id: 'npc-1', name: 'Aldric', relationships: [], history: [] } as unknown as NPC];

function makeFaction(id: string): Faction {
  return {
    id,
    name: 'The Ashen Compact',
    description: 'Brokers of burnt bargains',
    goals: 'Control the harbour',
    alignment: 'Lawful Evil',
    memberIds: [],
  } as unknown as Faction;
}

function renderEditor(faction: Faction, extraProps: Record<string, unknown> = {}) {
  const utils = render(
    <ConfirmDialogProvider>
      <FactionEditor
        faction={faction}
        allNpcs={allNpcs}
        allLocations={[]}
        campaign={campaign}
        onUpdate={() => {}}
        onDelete={() => {}}
        isMockMode
        {...(extraProps as object)}
      />
    </ConfirmDialogProvider>,
  );
  // Switch to the Members tab, where the generate panel lives.
  const membersTab = Array.from(utils.container.querySelectorAll('button'))
    .find(b => /members/i.test(b.textContent || ''));
  expect(membersTab, 'Members tab button not found').toBeTruthy();
  fireEvent.click(membersTab!);
  return utils;
}

function findGenerateMemberButton(container: HTMLElement): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button'))
    .find(b => /generate member npc/i.test(b.textContent || '')) as HTMLButtonElement | undefined;
}

describe('wp-f2-entity-editors #71 — no NPC generation from an unsaved faction draft', () => {
  it('does not offer an enabled "Generate member NPC" trigger in preview', () => {
    const { container } = renderEditor(makeFaction('preview'), { isPreview: true });

    const btn = findGenerateMemberButton(container);
    // Either the affordance is gone, or it is rendered disabled.
    expect(btn === undefined || btn.disabled).toBe(true);
  });

  it('still offers the trigger for a real, saved faction', () => {
    const { container } = renderEditor(makeFaction('fac-1'));

    const btn = findGenerateMemberButton(container);
    expect(btn, 'saved factions must keep the generate-here panel').toBeTruthy();
    expect(btn!.disabled).toBe(false);
  });
});
