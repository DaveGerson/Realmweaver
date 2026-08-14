// @vitest-environment jsdom
/**
 * wp-h-tools-viz — findings #83 and #116 (components/visualizers/RelationshipGraph.tsx)
 *
 * #83  Navigating to an entity from the graph exists only as a D3
 *      `.on("click", handleNodeClick)` on a transparent circle. The <svg> has
 *      no role and no accessible name, and the node groups have no tabindex,
 *      no role="button" and no <title> (only the *link* groups get one), so a
 *      keyboard user on the Relationships view can reach the filter toggles and
 *      "Reset View" and then hits a dead end, and a screen reader announces an
 *      unlabelled graphic.
 *
 * #116 TYPE_COLORS is carefully derived from ENTITY_TYPE_CONFIG ("so they stay
 *      in sync automatically") and then one entry is overwritten with a
 *      literal: `TYPE_COLORS[EntityType.SCENE] = '#ef4444'`. CLAUDE.md makes
 *      ENTITY_TYPE_CONFIG the single source for entity colours; red-500 is not
 *      an entity colour in the config at all, so scene nodes match nothing in
 *      the dashboards or sidebar.
 *
 * Contract:
 *  #83  The svg is exposed as an application/group with an accessible name, and
 *       every node group is focusable (tabindex=0), exposes role="button" with
 *       an accessible name (<title> or aria-label), and activates the same
 *       navigation on Enter/Space that a click performs.
 *  #116 ENTITY_TYPE_CONFIG gains a `scene` entry and the scene node fill is
 *       derived from it — no hardcoded hex override.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { Campaign } from '../../types/index';

const { RelationshipGraph } = await import('../../components/visualizers/RelationshipGraph');
const { ENTITY_TYPE_CONFIG } = await import('../../utils/entityUtils');

const campaign = {
  id: 'camp-1',
  title: 'The Sunken Crown',
  setting: 'A drowned empire',
  npcs: [{ id: 'npc-1', name: 'Marla Tidebinder', factionId: undefined }],
  locations: [],
  factions: [],
  items: [],
  adventures: [
    {
      id: 'adv-1',
      title: 'Brine and Bone',
      scenes: [{ id: 'scene-1', title: 'The Drowned Gate', npcIds: [] }],
    },
  ],
  articles: [],
  sessionLogs: [],
  playerCharacters: [],
  plots: [],
  notes: [],
  secrets: [],
} as unknown as Campaign;

afterEach(() => {
  cleanup();
});

describe('#116 scene node colour comes from ENTITY_TYPE_CONFIG', () => {
  it('registers a scene entry in ENTITY_TYPE_CONFIG', () => {
    const scene = ENTITY_TYPE_CONFIG['scene'];
    expect(scene, 'ENTITY_TYPE_CONFIG must own the scene colour, not RelationshipGraph').toBeTruthy();
    expect(typeof scene?.color).toBe('string');
    expect(scene?.color).not.toBe('');
  });
});

describe('#83 RelationshipGraph keyboard/AT access', () => {
  it('gives the svg an accessible role and name', () => {
    const { container } = render(<RelationshipGraph campaign={campaign} onNodeSelect={vi.fn()} />);
    const svg = container.querySelector('svg.w-full.h-full') as SVGSVGElement | null;
    expect(svg).toBeTruthy();
    expect(svg!.getAttribute('role')).toBeTruthy();
    const name = svg!.getAttribute('aria-label') ?? svg!.querySelector('title')?.textContent ?? '';
    expect(name.trim().length, 'graph svg needs an accessible name').toBeGreaterThan(0);
  });

  it('makes each node focusable, named and activatable from the keyboard', () => {
    const onNodeSelect = vi.fn();
    const { container } = render(<RelationshipGraph campaign={campaign} onNodeSelect={onNodeSelect} />);

    // Node groups are the <g> elements that carry a node circle.
    const nodeGroups = Array.from(container.querySelectorAll('g')).filter(
      g => g.querySelector(':scope > circle') !== null
    );
    expect(nodeGroups.length).toBeGreaterThan(0);

    const named = nodeGroups.find(g => {
      const label = g.getAttribute('aria-label') ?? g.querySelector('title')?.textContent ?? '';
      return /Marla Tidebinder/.test(label);
    });
    expect(named, 'each node must expose its name via <title> or aria-label').toBeTruthy();
    expect(named!.getAttribute('tabindex')).toBe('0');
    expect(named!.getAttribute('role')).toBe('button');

    fireEvent.keyDown(named!, { key: 'Enter', code: 'Enter' });
    expect(onNodeSelect).toHaveBeenCalledWith('npc', 'npc-1');
  });
});
