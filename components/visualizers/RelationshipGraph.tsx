
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
  Position,
} from 'reactflow';
import dagre from 'dagre';
import type { Campaign } from '../../types/index';
import { Icons } from '../common/Icons';
import { Button } from '../common/Button';
import { twMerge } from 'tailwind-merge';

interface RelationshipGraphProps {
  campaign: Campaign;
  onNodeSelect: (type: string, id: string) => void;
}

type EntityType = 'npc' | 'faction' | 'location' | 'scene' | 'article';

const nodeWidth = 172;
const nodeHeight = 36;

// Helper to layout graph elements using Dagre
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = direction === 'TB' ? Position.Top : Position.Left;
    node.sourcePosition = direction === 'TB' ? Position.Bottom : Position.Right;

    // We are shifting the dagre node position (anchor=center center) to the top left
    // so it matches the React Flow node anchor point (top left).
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });

  return { nodes: layoutedNodes, edges };
};

export const RelationshipGraph: React.FC<RelationshipGraphProps> = ({ campaign, onNodeSelect }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [filters, setFilters] = useState<Record<EntityType, boolean>>({
      npc: true,
      faction: true,
      location: true,
      scene: true,
      article: true
  });

  // --- Graph Construction ---
  useEffect(() => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // 1. Factions (Top Level)
    if (filters.faction) {
        campaign.factions.forEach(faction => {
            newNodes.push({
                id: faction.id,
                type: 'default',
                style: { background: '#312e81', color: '#fff', border: '1px solid #6366f1', borderRadius: '4px', width: 170 }, // Indigo
                data: { type: 'faction', id: faction.id, label: faction.name },
                position: { x: 0, y: 0 },
            });
        });
    }

    // 2. NPCs (Members of Factions)
    if (filters.npc) {
        campaign.npcs.forEach(npc => {
            newNodes.push({
                id: npc.id,
                type: 'default',
                style: { background: '#14532d', color: '#fff', border: '1px solid #22c55e', borderRadius: '50%', width: 100, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', textAlign: 'center' }, // Green
                data: { type: 'npc', id: npc.id, label: npc.name },
                position: { x: 0, y: 0 },
            });

            if (filters.faction && npc.factionId) {
                newEdges.push({
                    id: `${npc.id}-${npc.factionId}`,
                    source: npc.id,
                    target: npc.factionId,
                    label: 'Member',
                    type: 'smoothstep',
                    animated: true,
                    style: { stroke: '#6366f1' },
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
                });
            }
        });
    }

    // 3. Locations (Hierarchy)
    if (filters.location) {
        campaign.locations.forEach(loc => {
            newNodes.push({
                id: loc.id,
                type: 'input', // Use input for locations to allow many outputs (scenes)
                style: { background: '#78350f', color: '#fff', border: '1px solid #f59e0b', borderRadius: '8px', width: 160 }, // Amber
                data: { type: 'location', id: loc.id, label: loc.name },
                position: { x: 0, y: 0 },
            });

            if (loc.parentLocationId) {
                 newEdges.push({
                    id: `${loc.id}-${loc.parentLocationId}`,
                    source: loc.id,
                    target: loc.parentLocationId,
                    label: 'Inside',
                    type: 'smoothstep',
                    style: { stroke: '#f59e0b' },
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' },
                });
            }
            
            // Spatial connections
            loc.connections?.forEach(conn => {
                 newEdges.push({
                    id: `${loc.id}-${conn.targetLocationId}-conn`,
                    source: loc.id,
                    target: conn.targetLocationId,
                    type: 'default',
                    style: { stroke: '#f59e0b', strokeDasharray: 5 },
                });
            });
        });
    }

    // 4. Articles (Knowledge Graph)
    if (filters.article) {
        campaign.articles.forEach(art => {
             newNodes.push({
                id: art.id,
                type: 'default',
                style: { background: '#1e3a8a', color: '#93c5fd', border: '1px solid #3b82f6', width: 150 }, // Blue
                data: { type: 'article', id: art.id, label: art.title },
                position: { x: 0, y: 0 },
            });
            
            if (art.parentArticleId) {
                newEdges.push({
                    id: `${art.id}-${art.parentArticleId}`,
                    source: art.id,
                    target: art.parentArticleId,
                    type: 'smoothstep',
                    style: { stroke: '#3b82f6' },
                });
            }
        });
    }

    // 5. Scenes (The Events)
    if (filters.scene) {
        campaign.adventures.forEach(adv => {
            adv.scenes.forEach(scene => {
                newNodes.push({
                    id: scene.id,
                    type: 'output',
                    style: { background: '#7f1d1d', color: '#fff', border: '1px solid #ef4444', transform: 'rotate(45deg)', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: '9px' }, // Red Diamond
                    data: { type: 'scene', id: scene.id, label: scene.title, adventureId: adv.id }, // Pass Adventure ID too
                    position: { x: 0, y: 0 },
                });

                // Link Scene to Location
                if (filters.location && scene.locationId) {
                    newEdges.push({
                        id: `${scene.id}-${scene.locationId}`,
                        source: scene.locationId,
                        target: scene.id,
                        label: 'Setting',
                        style: { stroke: '#ef4444' },
                    });
                }

                // Link NPCs to Scene
                if (filters.npc && scene.npcIds) {
                    scene.npcIds.forEach(npcId => {
                        newEdges.push({
                            id: `${npcId}-${scene.id}`,
                            source: npcId,
                            target: scene.id,
                            style: { stroke: '#ef4444', strokeDasharray: 5 },
                        });
                    });
                }
            });
        });
    }

    // Apply Layout
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges);
    
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

  }, [campaign, filters, setNodes, setEdges]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const { type, id, adventureId } = node.data;
    // Special handling for scenes which are nested in adventures
    if (type === 'scene' && adventureId) {
        // We need a way to tell the main app to open the adventure AND select the scene.
        // Currently the sidebar supports this via 'scene' type logic.
        onNodeSelect('scene', id);
    } else {
        onNodeSelect(type, id);
    }
  }, [onNodeSelect]);

  const toggleFilter = (type: EntityType) => {
      setFilters(prev => ({...prev, [type]: !prev[type]}));
  }

  return (
    <div className="h-full w-full bg-slate-950 relative animate-in fade-in duration-500">
        <div className="absolute top-4 left-4 z-10 bg-slate-900/80 backdrop-blur p-2 rounded-lg border border-slate-800 flex flex-col gap-2 shadow-xl">
            <h3 className="text-xs font-bold text-slate-400 uppercase px-1">Graph Filters</h3>
            <FilterToggle label="Factions" color="bg-indigo-600" active={filters.faction} onClick={() => toggleFilter('faction')} />
            <FilterToggle label="NPCs" color="bg-green-600" active={filters.npc} onClick={() => toggleFilter('npc')} />
            <FilterToggle label="Locations" color="bg-amber-600" active={filters.location} onClick={() => toggleFilter('location')} />
            <FilterToggle label="Scenes" color="bg-red-600" active={filters.scene} onClick={() => toggleFilter('scene')} />
            <FilterToggle label="Lore" color="bg-blue-600" active={filters.article} onClick={() => toggleFilter('article')} />
        </div>
        <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
            attributionPosition="bottom-right"
            minZoom={0.1}
        >
            <MiniMap 
                nodeStrokeColor={(n) => {
                    if (n.data.type === 'faction') return '#6366f1';
                    if (n.data.type === 'npc') return '#22c55e';
                    if (n.data.type === 'location') return '#f59e0b';
                    if (n.data.type === 'scene') return '#ef4444';
                    return '#3b82f6';
                }}
                nodeColor={(n) => {
                    if (n.data.type === 'faction') return '#312e81';
                    if (n.data.type === 'npc') return '#14532d';
                    if (n.data.type === 'location') return '#78350f';
                    if (n.data.type === 'scene') return '#7f1d1d';
                    return '#1e3a8a';
                }}
                style={{ background: '#0f172a' }}
            />
            <Background color="#334155" gap={16} />
            <Controls className="bg-slate-800 border-slate-700 fill-slate-200" />
        </ReactFlow>
    </div>
  );
};

const FilterToggle = ({ label, color, active, onClick }: { label: string, color: string, active: boolean, onClick: () => void }) => (
    <button 
        onClick={onClick}
        className={twMerge(
            "flex items-center gap-2 px-2 py-1 rounded text-xs font-medium transition-all",
            active ? "bg-slate-800 text-slate-200" : "bg-slate-900 text-slate-600 hover:text-slate-400"
        )}
    >
        <div className={twMerge("w-2 h-2 rounded-full", active ? color : "bg-slate-700")} />
        {label}
    </button>
);
