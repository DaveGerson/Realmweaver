
import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import * as d3 from 'd3';
import type { Campaign } from '../../types/index';
import { EntityType, GraphNode, GraphLink } from '../../types/index';
import { twMerge } from 'tailwind-merge';
import { ENTITY_TYPE_CONFIG } from '@/utils/entityUtils';
import { Icons } from '@/components/common/Icons';

interface RelationshipGraphProps {
  campaign: Campaign;
  onNodeSelect: (type: string, id: string) => void;
}

// Map Tailwind color tokens used in ENTITY_TYPE_CONFIG to D3-usable hex values.
const TAILWIND_COLOR_TO_HEX: Record<string, string> = {
  amber:   '#f59e0b',
  emerald: '#10b981',
  violet:  '#8b5cf6',
  sky:     '#38bdf8',
  orange:  '#f97316',
  cyan:    '#06b6d4',
  rose:    '#f43f5e',
  teal:    '#14b8a6',
  yellow:  '#eab308',
  slate:   '#94a3b8',
  blue:    '#3b82f6',
  red:     '#ef4444',
  purple:  '#a855f7',
  green:   '#22c55e',
  indigo:  '#6366f1',
  pink:    '#ec4899',
};

// EntityType enum values (uppercase) mapped to ENTITY_TYPE_CONFIG keys (lowercase).
const ENTITY_TYPE_TO_CONFIG_KEY: Record<string, string> = {
  [EntityType.NPC]:       'npc',
  [EntityType.LOCATION]:  'location',
  [EntityType.FACTION]:   'faction',
  [EntityType.ITEM]:      'item',
  [EntityType.ADVENTURE]: 'adventure',
  [EntityType.SCENE]:     'scene',
  [EntityType.ARTICLE]:   'article',
};

// Derive TYPE_COLORS from ENTITY_TYPE_CONFIG so they stay in sync automatically.
const TYPE_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(ENTITY_TYPE_TO_CONFIG_KEY).map(([entityTypeKey, configKey]) => {
    const config = ENTITY_TYPE_CONFIG[configKey];
    const hex = config ? (TAILWIND_COLOR_TO_HEX[config.color] ?? '#94a3b8') : '#94a3b8';
    return [entityTypeKey, hex];
  })
);

export const RelationshipGraph: React.FC<RelationshipGraphProps> = ({ campaign, onNodeSelect }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  // Store node positions so they survive filter toggles
  const nodePositionCacheRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  const [filters, setFilters] = useState<Partial<Record<EntityType, boolean>>>({
      [EntityType.NPC]: true,
      [EntityType.FACTION]: true,
      [EntityType.LOCATION]: true,
      [EntityType.ADVENTURE]: true,
      [EntityType.SCENE]: true,
      [EntityType.ARTICLE]: true,
      [EntityType.ITEM]: false,
  });

  const { nodes, links } = useMemo(() => {
      const nodes: GraphNode[] = [];
      const links: GraphLink[] = [];

      // 1. Factions
      if (filters[EntityType.FACTION]) {
          campaign.factions.forEach(f => {
              nodes.push({ id: f.id, group: EntityType.FACTION, name: f.name });
          });
      }

      // Build a set of faction leader IDs so NPC->Faction links can say "leads"
      const factionLeaderIds = new Set(
          campaign.factions.filter(f => f.leaderId).map(f => f.leaderId as string)
      );

      // 2. NPCs
      if (filters[EntityType.NPC]) {
          campaign.npcs.forEach(n => {
              nodes.push({ id: n.id, group: EntityType.NPC, name: n.name });
              if (filters[EntityType.FACTION] && n.factionId) {
                  const label = factionLeaderIds.has(n.id) ? 'leads' : 'member-of';
                  links.push({ source: n.id, target: n.factionId, label });
              }
          });
      }

      // 3. Locations
      if (filters[EntityType.LOCATION]) {
          campaign.locations.forEach(l => {
              nodes.push({ id: l.id, group: EntityType.LOCATION, name: l.name });
              if (filters[EntityType.LOCATION] && l.parentLocationId) {
                  links.push({ source: l.id, target: l.parentLocationId, label: 'within' });
              }
              if (filters[EntityType.FACTION] && l.controllingFactionId) {
                  links.push({ source: l.id, target: l.controllingFactionId, label: 'controlled-by' });
              }
              if (filters[EntityType.LOCATION] && l.connections) {
                  l.connections.forEach(c => {
                      if (campaign.locations.some(loc => loc.id === c.targetLocationId)) {
                          links.push({ source: l.id, target: c.targetLocationId, label: 'connected-to' });
                      }
                  });
              }
          });
      }

      // 4. Adventures & Scenes
      if (filters[EntityType.ADVENTURE]) {
          campaign.adventures.forEach(a => {
              nodes.push({ id: a.id, group: EntityType.ADVENTURE, name: a.title });

              if (filters[EntityType.SCENE]) {
                  a.scenes.forEach(s => {
                      nodes.push({ id: s.id, group: EntityType.SCENE, name: s.title });
                      links.push({ source: a.id, target: s.id, label: 'contains' });

                      if (filters[EntityType.LOCATION] && s.locationId) {
                          links.push({ source: s.id, target: s.locationId, label: 'set-in' });
                      }
                      if (filters[EntityType.NPC] && s.npcIds) {
                          s.npcIds.forEach(nid => {
                              links.push({ source: s.id, target: nid, label: 'features' });
                          });
                      }
                  });
              }
          });
      }

      // 5. Articles
      if (filters[EntityType.ARTICLE]) {
          campaign.articles.forEach(a => {
              nodes.push({ id: a.id, group: EntityType.ARTICLE, name: a.title });
              if (filters[EntityType.ARTICLE] && a.parentArticleId) {
                  links.push({ source: a.id, target: a.parentArticleId, label: 'child-of' });
              }
              if (a.relatedEntityIds) {
                  a.relatedEntityIds.forEach(rid => {
                      links.push({ source: a.id, target: rid, label: 'references' });
                  });
              }
          });
      }

      // 6. Items
      if (filters[EntityType.ITEM]) {
          campaign.items.forEach(i => {
              nodes.push({ id: i.id, group: EntityType.ITEM, name: i.name });
          });
      }

      // Filter links to ensure source/target both exist in nodes
      const nodeIds = new Set(nodes.map(n => n.id));
      const validLinks = links.filter(l => nodeIds.has(l.source as string) && nodeIds.has(l.target as string));

      return { nodes, links: validLinks };
  }, [campaign, filters]);


  const initializeGraph = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .attr("role", "application")
      .attr("aria-label", "Entity relationship graph")
      .style("max-width", "100%")
      .style("height", "100%")
      .style("background-color", "#020617"); // slate-950

    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });

    svg.call(zoom);
    zoomRef.current = zoom;

    // Create mutable copies for D3 to mutate.
    // Restore cached positions so filter toggles don't scatter the graph.
    const posCache = nodePositionCacheRef.current;
    const simulationNodes = nodes.map(n => {
      const cached = posCache.get(n.id);
      return cached
        ? { ...n, x: cached.x, y: cached.y, fx: undefined, fy: undefined }
        : { ...n };
    });
    const simulationLinks = links.map(l => ({...l}));

    // Use a lower alpha when any cached positions exist so the layout
    // settles gently rather than exploding from random positions.
    const hasCachedPositions = simulationNodes.some(n => n.x !== undefined);
    const startAlpha = hasCachedPositions ? 0.3 : 1;

    const simulation = d3.forceSimulation<GraphNode>(simulationNodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(simulationLinks).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide(30))
      .alpha(startAlpha);

    // Each link is a <g> containing a <line> and an optional <text> label
    const linkGroup = g.append("g")
      .selectAll<SVGGElement, GraphLink>("g")
      .data(simulationLinks)
      .join("g");

    linkGroup.append("title")
      .text((d: GraphLink) => d.label ?? '');

    const link = linkGroup.append("line")
      .attr("stroke", "#475569") // slate-600
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1.5);

    // Edge label text — subtle, small font
    const linkLabel = linkGroup.append("text")
      .text((d: GraphLink) => d.label ?? '')
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "#78716c") // slate-500
      .attr("font-size", "9px")
      .attr("font-family", "sans-serif")
      .style("pointer-events", "none")
      .style("user-select", "none")
      .attr("paint-order", "stroke")
      .attr("stroke", "#020617") // slate-950 background
      .attr("stroke-width", "3px")
      .attr("stroke-linejoin", "round");

    const nodeGroup = g.append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(simulationNodes)
      .join("g")
      .attr("tabindex", 0)
      .attr("role", "button")
      .on("keydown", handleNodeKeyDown)
      .on("focus", handleNodeFocus)
      .on("blur", handleNodeBlur)
      .call(d3.drag<SVGGElement, GraphNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Accessible name for keyboard/AT users — mirrors the link groups' <title>.
    nodeGroup.append("title")
      .text((d: GraphNode) => d.name);

    // Invisible large hit area for touch-friendly interaction (44px diameter = r:22).
    // This circle captures click/touch events; the visible circle below provides the visual.
    nodeGroup.append("circle")
      .attr("r", 22)
      .attr("fill", "transparent")
      .style("cursor", "pointer")
      .on("click", handleNodeClick);

    // Visible node circle (r:8 = 16px visual diameter)
    nodeGroup.append("circle")
      .attr("class", "node-ring")
      .attr("r", 8)
      .attr("fill", (d: GraphNode) => TYPE_COLORS[d.group] || '#94a3b8')
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .style("pointer-events", "none"); // Hit area handled by the transparent circle above

    // Node labels
    nodeGroup.append("text")
      .text((d: GraphNode) => d.name)
      .attr("x", 12)
      .attr("y", 4)
      .attr("fill", "#e2e8f0") // slate-200
      .style("font-size", "10px")
      .style("font-family", "sans-serif")
      .style("pointer-events", "none")
      .style("text-shadow", "2px 2px 4px #000");

    function handleNodeClick(event: MouseEvent | KeyboardEvent, d: GraphNode) {
      event.stopPropagation();
      const typeMap: Record<string, string> = {
          [EntityType.NPC]: 'npc',
          [EntityType.LOCATION]: 'location',
          [EntityType.FACTION]: 'faction',
          [EntityType.ADVENTURE]: 'adventure',
          [EntityType.SCENE]: 'scene',
          [EntityType.ARTICLE]: 'article',
          [EntityType.ITEM]: 'item'
      };
      const mappedType = typeMap[d.group];
      if (mappedType) {
          onNodeSelect(mappedType, d.id);
      }
    }

    function handleNodeKeyDown(event: KeyboardEvent, d: GraphNode) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      handleNodeClick(event, d);
    }

    // Explicit focus indicator for keyboard users — the node group itself has
    // no visible chrome, so relying on the browser's default outline on an
    // SVG <g> is unreliable. Highlight the visible node circle instead.
    function handleNodeFocus(event: FocusEvent) {
      d3.select(event.currentTarget as SVGGElement).select<SVGCircleElement>("circle.node-ring")
        .attr("stroke", "#f59e0b") // amber-400
        .attr("stroke-width", 3);
    }

    function handleNodeBlur(event: FocusEvent) {
      d3.select(event.currentTarget as SVGGElement).select<SVGCircleElement>("circle.node-ring")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5);
    }

    simulation.on("tick", () => {
      link
        .attr("x1", (d: GraphLink) => ((d.source as GraphNode).x ?? 0))
        .attr("y1", (d: GraphLink) => ((d.source as GraphNode).y ?? 0))
        .attr("x2", (d: GraphLink) => ((d.target as GraphNode).x ?? 0))
        .attr("y2", (d: GraphLink) => ((d.target as GraphNode).y ?? 0));

      linkLabel
        .attr("x", (d: GraphLink) => (((d.source as GraphNode).x ?? 0) + ((d.target as GraphNode).x ?? 0)) / 2)
        .attr("y", (d: GraphLink) => (((d.source as GraphNode).y ?? 0) + ((d.target as GraphNode).y ?? 0)) / 2);

      nodeGroup
        .attr("transform", (d: GraphNode) => `translate(${d.x},${d.y})`);

      // Continuously update position cache so the next render can restore positions
      simulationNodes.forEach(n => {
        if (n.x !== undefined && n.y !== undefined) {
          posCache.set(n.id, { x: n.x, y: n.y });
        }
      });
    });

    function dragstarted(event: any, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: GraphNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => simulation.stop();

  }, [nodes, links, onNodeSelect]);

  useEffect(() => {
    const cleanup = initializeGraph();
    return () => {
      if (cleanup) cleanup();
    }
  }, [initializeGraph]);

  const toggleFilter = (type: EntityType) => {
      setFilters(prev => ({...prev, [type]: !prev[type]}));
  };

  const handleResetView = () => {
      if (svgRef.current && zoomRef.current) {
          d3.select(svgRef.current)
            .transition()
            .duration(300)
            .call(zoomRef.current.transform, d3.zoomIdentity);
      }
  };

  // Empty state: no nodes to show
  if (nodes.length === 0) {
    return (
      <div className="w-full h-full rounded-lg overflow-hidden bg-slate-950 border border-slate-700 shadow-inner flex flex-col items-center justify-center gap-3 px-8">
        <Icons.WorldGraph className="w-12 h-12 text-slate-600" />
        <p className="text-slate-400 text-sm text-center max-w-xs">
          No entity relationships to display. Create NPCs, locations, and factions to see connections.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-lg overflow-hidden bg-slate-950 border border-slate-700 shadow-inner relative" ref={containerRef}>
      {/* Filter panel — top-left */}
      <div className="absolute top-4 left-4 z-10 bg-slate-900/80 backdrop-blur p-2 rounded-lg border border-slate-800 flex flex-col gap-2 shadow-xl">
            <h3 className="text-xs font-bold text-slate-400 uppercase px-1">Graph Filters</h3>
            <FilterToggle label="Factions" color={TYPE_COLORS[EntityType.FACTION]} active={filters[EntityType.FACTION]} onClick={() => toggleFilter(EntityType.FACTION)} />
            <FilterToggle label="NPCs" color={TYPE_COLORS[EntityType.NPC]} active={filters[EntityType.NPC]} onClick={() => toggleFilter(EntityType.NPC)} />
            <FilterToggle label="Locations" color={TYPE_COLORS[EntityType.LOCATION]} active={filters[EntityType.LOCATION]} onClick={() => toggleFilter(EntityType.LOCATION)} />
            <FilterToggle label="Adventures" color={TYPE_COLORS[EntityType.ADVENTURE]} active={filters[EntityType.ADVENTURE]} onClick={() => toggleFilter(EntityType.ADVENTURE)} />
            <FilterToggle label="Scenes" color={TYPE_COLORS[EntityType.SCENE]} active={filters[EntityType.SCENE]} onClick={() => toggleFilter(EntityType.SCENE)} />
            <FilterToggle label="Lore" color={TYPE_COLORS[EntityType.ARTICLE]} active={filters[EntityType.ARTICLE]} onClick={() => toggleFilter(EntityType.ARTICLE)} />
            <FilterToggle label="Items" color={TYPE_COLORS[EntityType.ITEM]} active={filters[EntityType.ITEM]} onClick={() => toggleFilter(EntityType.ITEM)} />
            <div className="border-t border-slate-700 mt-1 pt-1">
                <button
                    onClick={handleResetView}
                    className="flex items-center gap-2 px-2 py-1 rounded text-xs font-medium transition-all w-full bg-amber-600/20 text-amber-400 hover:bg-amber-600/40 hover:text-amber-300"
                    title="Reset pan and zoom to initial view"
                >
                    <Icons.RefreshCw className="w-3 h-3" />
                    Reset View
                </button>
            </div>
        </div>
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
  );
};

const FilterToggle = ({ label, color, active, onClick }: { label: string, color: string, active: boolean | undefined, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={twMerge(
            "flex items-center gap-2 px-2 py-1 rounded text-xs font-medium transition-all w-full",
            active ? "bg-slate-800 text-slate-200" : "bg-slate-950 text-slate-600 hover:text-slate-400"
        )}
    >
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: active ? color : '#334155' }} />
        {label}
    </button>
);
