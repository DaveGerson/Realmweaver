// @vitest-environment jsdom
/**
 * Roadmap X11 — buildEntityContext consolidation.
 *
 * Every editor used to hand-roll its own inline template string for
 * RegenerateButton's `entityContext` prop, each diverging slightly (different
 * "Not specified" filler, NPC faction name never resolved, adventure/item
 * fields missing from the shared builder). Contract now:
 *   1. No editor defines an inline template-literal entity context.
 *   2. Every editor that mounts RegenerateButton imports buildEntityContext.
 *   3. The prop an editor actually passes equals buildEntityContext's output
 *      for that entity (render-level check for NPC — incl. faction resolution —
 *      and Item — incl. itemType).
 */
import React from 'react';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { Campaign, Faction, Item, NPC } from '../types/index';

const captured = vi.hoisted(() => ({ contexts: [] as string[] }));

vi.mock('../components/common/RegenerateButton', () => ({
  RegenerateButton: (props: { entityContext: string }) => {
    captured.contexts.push(props.entityContext);
    return null;
  },
}));

vi.mock('../services/aiService', () => ({
  generateNpc: vi.fn(),
  generateEnhancedText: vi.fn(),
}));

const storeState = { campaigns: [], activeCampaignId: null, saveStatus: 'idle', lastSavedAt: null, appStatus: 'editing' };
vi.mock('../services/campaignService', () => ({
  campaignService: {
    subscribe: () => () => {},
    getState: () => storeState,
    getActiveCampaign: () => undefined,
    updateNpc: vi.fn(),
    updateLocation: vi.fn(),
  },
}));

const { NpcEditor } = await import('../components/editors/NpcEditor');
const { ItemEditor } = await import('../components/editors/ItemEditor');
const { ConfirmDialogProvider } = await import('../hooks/useConfirmDialog');
const { buildEntityContext } = await import('../utils/entityUtils');

afterEach(() => {
  cleanup();
  captured.contexts = [];
});

const repoRoot = resolve(__dirname, '..');
const EDITORS = [
  'NpcEditor', 'LocationEditor', 'FactionEditor', 'ItemEditor', 'AdventureEditor',
  'ArticleEditor', 'PlotEditor', 'NoteEditor', 'SceneEditor',
];

describe('X11 — editors build RegenerateButton context via buildEntityContext', () => {
  it.each(EDITORS)('%s has no inline template-literal entity context', (name) => {
    const src = readFileSync(join(repoRoot, 'components/editors', `${name}.tsx`), 'utf8');
    expect(src).toContain('<RegenerateButton');
    expect(src).toMatch(/import \{[^}]*\bbuildEntityContext\b[^}]*\} from '..\/..\/utils\/entityUtils'/);
    expect(src).not.toMatch(/EntityContext\s*=\s*`/);
    expect(src).toMatch(/EntityContext\s*=\s*buildEntityContext\(/);
  });

  it('NpcEditor passes the shared context, resolving the faction name from its factions prop', () => {
    const faction: Faction = { id: 'f1', name: 'City Watch', description: '', goals: '', alignment: '', resources: '', influence: '', memberIds: ['n1'] };
    const npc = {
      id: 'n1', name: 'Captain Vex', description: 'A tired officer', traits: 'Blunt', backstory: '',
      motivations: 'Keep the peace', secrets: '', stats: '', exampleQuote: '', factionId: 'f1',
      knowsPlayerHistory: [], relationships: [], history: [],
    } as NPC;
    const campaign = {
      id: 'c1', title: 'T', npcs: [npc], locations: [], factions: [faction], items: [], adventures: [],
      articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
    } as unknown as Campaign;

    render(
      <ConfirmDialogProvider>
        <NpcEditor npc={npc} factions={[faction]} allNpcs={[npc]} campaign={campaign} onUpdate={() => {}} onDelete={() => {}} isMockMode />
      </ConfirmDialogProvider>,
    );

    expect(captured.contexts.length).toBeGreaterThan(0);
    const expected = buildEntityContext('npc', npc, { factions: [faction] });
    expect(expected).toContain('Faction: City Watch');
    for (const ctx of captured.contexts) expect(ctx).toBe(expected);
    expect(captured.contexts.join('\n')).not.toContain('Not specified');
  });

  it('ItemEditor passes the shared context, including itemType', () => {
    const item: Item = { id: 'i1', name: 'Emberbrand', description: 'A warm blade', rarity: 'rare', properties: '', itemType: 'weapon' };

    render(
      <ConfirmDialogProvider>
        <ItemEditor item={item} onUpdate={() => {}} onDelete={() => {}} isMockMode />
      </ConfirmDialogProvider>,
    );

    expect(captured.contexts.length).toBeGreaterThan(0);
    const expected = buildEntityContext('item', item);
    expect(expected).toContain('Type: weapon');
    for (const ctx of captured.contexts) expect(ctx).toBe(expected);
  });
});
