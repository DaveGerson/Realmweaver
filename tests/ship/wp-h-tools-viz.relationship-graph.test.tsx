// @vitest-environment jsdom
/**
 * wp-h-tools-viz — findings #83, #116, C7 and P7 (components/visualizers/RelationshipGraph.tsx)
 *
 * C7   The edge assembly emitted nine edge kinds but silently omitted two that
 *      exist in the data model and are authored through the UI:
 *      `npc.relationships[].targetId` (NpcEditor's "Connections" tab) and
 *      `faction.headquartersLocationId` (FactionEditor). A GM who built a web of
 *      NPC rivalries opened the view literally named RelationshipGraph and saw
 *      those NPCs as unconnected dots.
 *
 * P7   `initializeGraph` wipes the SVG and appends a fresh <g> at identity, but
 *      d3-zoom keeps the current transform on the unchanged <svg> node. Any
 *      filter toggle therefore snapped the view back to the default framing, and
 *      the next scroll-wheel tick teleported it back to the stale transform.
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
 *  C7   An NPC relationship renders an edge labelled with its relationType, and a
 *       faction's headquarters renders an 'hq-at' edge to the location.
 *  P7   The <g> re-created on a filter toggle carries the zoom transform stored
 *       on the <svg> node.
 */

import React from 'react';
import * as d3 from 'd3';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { Campaign } from '../../types/index';

const { RelationshipGraph } = await import('../../components/visualizers/RelationshipGraph');
const { ENTITY_TYPE_CONFIG } = await import('../../utils/entityUtils');

const campaign = {
  id: 'camp-1',
  title: 'The Sunken Crown',
  setting: 'A drowned empire',
  npcs: [
    {
      id: 'npc-1',
      name: 'Marla Tidebinder',
      factionId: undefined,
      relationships: [
        { id: 'rel-1', targetId: 'npc-2', relationType: 'Rival', description: 'Contests the harbour' },
        // Dangling target — a player character is never a graph node, so this
        // edge must be dropped rather than crashing d3.forceLink.
        { id: 'rel-2', targetId: 'pc-1', relationType: 'Patron', description: '' },
      ],
    },
    { id: 'npc-2', name: 'Corvin Ashgrave', factionId: undefined, relationships: [] },
  ],
  locations: [{ id: 'loc-1', name: 'Saltmarsh Keep', connections: [] }],
  factions: [
    { id: 'fac-1', name: 'The Tidewardens', memberIds: [], headquartersLocationId: 'loc-1' },
  ],
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

  it('does not suppress focus without providing a replacement indicator, and shows one on focus', () => {
    const { container } = render(<RelationshipGraph campaign={campaign} onNodeSelect={vi.fn()} />);
    const nodeGroups = Array.from(container.querySelectorAll('g')).filter(
      g => g.querySelector(':scope > circle') !== null
    );
    const target = nodeGroups.find(g => g.querySelector('title')?.textContent?.includes('Marla Tidebinder'));
    expect(target).toBeTruthy();

    // The fix must not merely hide the browser's default focus ring without
    // replacing it with something visible.
    expect(target!.getAttribute('style') ?? '').not.toMatch(/outline:\s*none/);

    const ring = target!.querySelector('circle.node-ring') as SVGCircleElement | null;
    expect(ring, 'visible node circle must be identifiable for a focus indicator').toBeTruthy();

    fireEvent.focus(target!);
    expect(ring!.getAttribute('stroke')).toBe('#f59e0b');
    expect(Number(ring!.getAttribute('stroke-width'))).toBeGreaterThan(1.5);

    fireEvent.blur(target!);
    expect(ring!.getAttribute('stroke')).toBe('#fff');
  });
});

// Link groups are the <g> elements that carry a <line>; each one's <title> is the
// edge label, so this is the full set of edges the graph actually drew.
const edgeLabels = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('g'))
    .filter(g => g.querySelector(':scope > line') !== null)
    .map(g => g.querySelector(':scope > title')?.textContent ?? '');

describe('C7 the graph draws every authored relationship kind', () => {
  it('renders an edge per npc.relationships entry, labelled with its relationType', () => {
    const { container } = render(<RelationshipGraph campaign={campaign} onNodeSelect={vi.fn()} />);
    expect(edgeLabels(container), 'NPC-to-NPC relationships must be visible in the RelationshipGraph').toContain('Rival');
  });

  it('drops relationship edges whose target is not a graph node', () => {
    const { container } = render(<RelationshipGraph campaign={campaign} onNodeSelect={vi.fn()} />);
    expect(edgeLabels(container)).not.toContain('Patron');
  });

  it("renders an 'hq-at' edge from a faction to its headquarters location", () => {
    const { container } = render(<RelationshipGraph campaign={campaign} onNodeSelect={vi.fn()} />);
    expect(edgeLabels(container)).toContain('hq-at');
  });
});

describe('P7 pan/zoom survives a filter toggle', () => {
  it('re-applies the stored zoom transform to the <g> rebuilt on re-render', () => {
    const { container, getByRole } = render(
      <RelationshipGraph campaign={campaign} onNodeSelect={vi.fn()} />
    );
    const svg = container.querySelector('svg.w-full.h-full') as SVGSVGElement;

    // Stand in for the GM having panned and zoomed: d3-zoom parks the current
    // transform on the <svg> node under `__zoom`.
    const panned = d3.zoomIdentity.translate(120, -45).scale(2.5);
    (svg as unknown as { __zoom: unknown }).__zoom = panned;

    // Any filter toggle re-runs initializeGraph, which wipes and rebuilds the <g>.
    fireEvent.click(getByRole('button', { name: 'Items' }));

    const g = svg.querySelector('g') as SVGGElement;
    expect(g.getAttribute('transform')).toBe(panned.toString());
  });
});
