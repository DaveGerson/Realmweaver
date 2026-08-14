// @vitest-environment jsdom
/**
 * wp-f2-entity-editors — finding #22 (editor half)
 *
 * LocationEditor:292  `allLocations.filter(l => location.subLocationIds.includes(l.id))`
 * FactionEditor:137   `allNpcs.filter(npc => faction.memberIds.includes(npc.id))`
 *
 * Both dereference an array field with no `|| []` guard, unlike every other
 * array field in the same files (`formData.connections || []`, `formData.loot || []`).
 * AI drafts omit these fields and `createLocation`/`createFaction` do not
 * backfill them, so approving a location or faction from RealmChat renders the
 * editor for an entity whose array is `undefined` — a TypeError during render
 * that drops the whole app into the ErrorBoundary right after the user clicks
 * "approve".
 *
 * Contract: the editors must render an entity that is missing
 * `subLocationIds` / `memberIds` (treating it as empty), independently of
 * whatever the store now backfills.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { Campaign, Faction, Location, NPC } from '../../types/index';

vi.mock('../../services/aiService', () => ({
  generateNpc: vi.fn(),
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
const { FactionEditor } = await import('../../components/editors/FactionEditor');
const { ConfirmDialogProvider } = await import('../../hooks/useConfirmDialog');

afterEach(cleanup);

const campaign = {
  id: 'camp-1', title: 'Test Campaign',
  npcs: [], locations: [], factions: [], items: [], adventures: [],
  articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

describe('wp-f2-entity-editors #22 — editors survive AI-created entities', () => {
  it('LocationEditor renders a location whose subLocationIds is undefined', () => {
    // Exactly what aiService.generateLocation returns, given an id by createLocation.
    const aiLocation = {
      id: 'loc-ai',
      name: 'The Sunken Ward',
      description: 'A flooded district',
      secrets: '',
      loot: [],
      connections: [],
      pointsOfInterest: [],
      history: [],
      // subLocationIds intentionally absent
    } as unknown as Location;

    expect(() =>
      render(
        <ConfirmDialogProvider>
          <LocationEditor
            location={aiLocation}
            allLocations={[aiLocation]}
            campaign={campaign}
            onUpdate={() => {}}
            onDelete={() => {}}
            isMockMode
          />
        </ConfirmDialogProvider>,
      ),
    ).not.toThrow();
  });

  it('FactionEditor renders a faction whose memberIds is undefined', () => {
    const aiFaction = {
      id: 'fac-ai',
      name: 'The Ashen Compact',
      description: 'Brokers of burnt bargains',
      goals: 'Control the harbour',
      alignment: 'Lawful Evil',
      // memberIds intentionally absent
    } as unknown as Faction;

    const npcs = [{ id: 'npc-1', name: 'Aldric', relationships: [], history: [] } as unknown as NPC];

    expect(() =>
      render(
        <ConfirmDialogProvider>
          <FactionEditor
            faction={aiFaction}
            allNpcs={npcs}
            allLocations={[]}
            campaign={campaign}
            onUpdate={() => {}}
            onDelete={() => {}}
            isMockMode
          />
        </ConfirmDialogProvider>,
      ),
    ).not.toThrow();
  });
});
