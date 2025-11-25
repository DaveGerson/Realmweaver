
import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import * as d3 from 'd3';
import type { Campaign } from '../../types/index';
import { EntityType, GraphNode, GraphLink } from '../../types/index';
import { twMerge } from 'tailwind-merge';

interface RelationshipGraphProps {
  campaign: Campaign;
  onNodeSelect: (type: string, id: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  [EntityType.NPC]: '#22c55e',      // Green-500
  [EntityType.LOCATION]: '#f59e0b', // Amber-500
  [EntityType.FACTION]: '#6366f1',  // Indigo-500
  [EntityType.ITEM]: '#a855f7',     // Purple-500
  [EntityType.ADVENTURE]: '#3b82f6',// Blue-500
  [EntityType.SCENE]: '#ef4444',    // Red-500
  [EntityType.ARTICLE]: '#06b6d4',  // Cyan-500
  [EntityType.QUEST]: '#ec4899',    // Pink-500
  [EntityType.EVENT]: '#eab308',    // Yellow-500
};

export const RelationshipGraph: React.FC<RelationshipGraphProps> = ({ campaign, onNodeSelect }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<Record<EntityType, boolean>>({
      [EntityType.NPC]: true,
      [EntityType.FACTION]: true,
      [EntityType.LOCATION]: true,
      [EntityType.ADVENTURE]: true,
      [EntityType.SCENE]: true,
      [EntityType.ARTICLE]: true,
      [EntityType.ITEM]: false,
      [EntityType.QUEST]: false,
      [EntityType.EVENT]: false,
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

      // 2. NPCs
      if (filters[EntityType.NPC]) {
          campaign.npcs.forEach(n => {
              nodes.push({ id: n.id, group: EntityType.NPC, name: n.name });
              if (filters[EntityType.FACTION] && n.factionId) {
                  links.push({ source: n.id, target: n.factionId });
              }
          });
      }

      // 3. Locations
      if (filters[EntityType.LOCATION]) {
          campaign.locations.forEach(l => {
              nodes.push({ id: l.id, group: EntityType.LOCATION, name: l.name });
              if (filters[EntityType.LOCATION] && l.parentLocationId) {
                  links.push({ source: l.id, target: l.parentLocationId });
              }
              if (filters[EntityType.FACTION] && l.controllingFactionId) {
                  links.push({ source: l.id, target: l.controllingFactionId });
              }
              if (filters[EntityType.LOCATION] && l.connections) {
                  l.connections.forEach(c => {
                      // Only link if target exists
                      if (campaign.locations.some(loc => loc.id === c.targetLocationId)) {
                          links.push({ source: l.id, target: c.targetLocationId });
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
                      links.push({ source: a.id, target: s.id }); // Adventure -> Scene

                      if (filters[EntityType.LOCATION] && s.locationId) {
                          links.push({ source: s.id, target: s.locationId });
                      }
                      if (filters[EntityType.NPC] && s.npcIds) {
                          s.npcIds.forEach(nid => {
                              links.push({ source: s.id, target: nid });
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
                  links.push({ source: a.id, target: a.parentArticleId });
              }
              if (a.relatedEntityIds) {
                  a.relatedEntityIds.forEach(rid => {
                      // Check if target exists in current node set to avoid d3 errors
                      // Note: This check is slightly expensive O(N^2) in naive impl, but map-based check would be better. 
                      // D3 link force will fail if target doesn't exist.
                      // However, since we filter nodes based on filters, we just need to know if the target entity type is enabled.
                      // Simplification: We'll trust D3 to filter or we check existence.
                      // Better to check if the ID matches any node we just added.
                      // We will do a cleanup pass at the end.
                      links.push({ source: a.id, target: rid });
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

    // Create mutable copies for D3 to mutate
    const simulationNodes = nodes.map(n => ({...n}));
    const simulationLinks = links.map(l => ({...l}));

    const simulation = d3.forceSimulation<GraphNode>(simulationNodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(simulationLinks).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide(30));

    const link = g.append("g")
      .attr("stroke", "#475569") // slate-600
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(simulationLinks)
      .join("line")
      .attr("stroke-width", 1.5);

    const node = g.append("g")
      .selectAll("g")
      .data(simulationNodes)
      .join("g")
      .call(d3.drag<SVGGElement, GraphNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Node circles
    node.append("circle")
      .attr("r", 8)
      .attr("fill", d => TYPE_COLORS[d.group] || '#94a3b8')
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        event.stopPropagation();
        const typeMap: Record<string, string> = {
            [EntityType.NPC]: 'npc',
            [EntityType.LOCATION]: 'location',
            [EntityType.FACTION]: 'faction',
            [EntityType.ADVENTURE]: 'adventure',
            [EntityType.SCENE]: 'scene', // Special handling usually needed for sidebar
            [EntityType.ARTICLE]: 'article',
            [EntityType.ITEM]: 'item'
        };
        const mappedType = typeMap[d.group];
        if (mappedType) {
            onNodeSelect(mappedType, d.id);
        }
      });

    // Node labels
    node.append("text")
      .text(d => d.name)
      .attr("x", 12)
      .attr("y", 4)
      .attr("fill", "#e2e8f0") // slate-200
      .style("font-size", "10px")
      .style("font-family", "sans-serif")
      .style("pointer-events", "none")
      .style("text-shadow", "2px 2px 4px #000"); // Shadow for readability

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as GraphNode).x!)
        .attr("y1", d => (d.source as GraphNode).y!)
        .attr("x2", d => (d.target as GraphNode).x!)
        .attr("y2", d => (d.target as GraphNode).y!);

      node
        .attr("transform", d => `translate(${d.x},${d.y})`);
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
  }

  return (
    <div className="w-full h-full rounded-lg overflow-hidden bg-slate-950 border border-slate-700 shadow-inner relative" ref={containerRef}>
      <div className="absolute top-4 left-4 z-10 bg-slate-900/80 backdrop-blur p-2 rounded-lg border border-slate-800 flex flex-col gap-2 shadow-xl">
            <h3 className="text-xs font-bold text-slate-400 uppercase px-1">Graph Filters</h3>
            <FilterToggle label="Factions" color={TYPE_COLORS[EntityType.FACTION]} active={filters[EntityType.FACTION]} onClick={() => toggleFilter(EntityType.FACTION)} />
            <FilterToggle label="NPCs" color={TYPE_COLORS[EntityType.NPC]} active={filters[EntityType.NPC]} onClick={() => toggleFilter(EntityType.NPC)} />
            <FilterToggle label="Locations" color={TYPE_COLORS[EntityType.LOCATION]} active={filters[EntityType.LOCATION]} onClick={() => toggleFilter(EntityType.LOCATION)} />
            <FilterToggle label="Adventures" color={TYPE_COLORS[EntityType.ADVENTURE]} active={filters[EntityType.ADVENTURE]} onClick={() => toggleFilter(EntityType.ADVENTURE)} />
            <FilterToggle label="Scenes" color={TYPE_COLORS[EntityType.SCENE]} active={filters[EntityType.SCENE]} onClick={() => toggleFilter(EntityType.SCENE)} />
            <FilterToggle label="Lore" color={TYPE_COLORS[EntityType.ARTICLE]} active={filters[EntityType.ARTICLE]} onClick={() => toggleFilter(EntityType.ARTICLE)} />
            <FilterToggle label="Items" color={TYPE_COLORS[EntityType.ITEM]} active={filters[EntityType.ITEM]} onClick={() => toggleFilter(EntityType.ITEM)} />
        </div>
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
  );
};

const FilterToggle = ({ label, color, active, onClick }: { label: string, color: string, active: boolean, onClick: () => void }) => (
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
