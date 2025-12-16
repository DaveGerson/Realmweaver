
export type PlotStatus = 'active' | 'resolved' | 'dormant';

export interface Plot {
  id: string;
  title: string;
  description: string;
  status: PlotStatus;
  relatedEntityIds: string[]; // IDs of NPCs, Locations, Factions involved in this plot
}
