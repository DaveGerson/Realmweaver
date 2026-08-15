
export enum EntityType {
  LOCATION = 'LOCATION',
  NPC = 'NPC',
  ITEM = 'ITEM',
  FACTION = 'FACTION',
  ADVENTURE = 'ADVENTURE',
  SCENE = 'SCENE',
  ARTICLE = 'ARTICLE'
}

// Mimics d3.SimulationNodeDatum to avoid direct dependency issues in type checking if d3 types aren't globally available
export interface GraphNode {
  id: string;
  group: EntityType;
  name: string;
  
  // d3 simulation properties
  index?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

// Mimics d3.SimulationLinkDatum
export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  label?: string;
  index?: number;
}
