
export type PlotStatus = 'active' | 'resolved' | 'dormant';

/**
 * A countdown clock on a plot (the "front" / progress-clock idea from
 * Apocalypse World and Blades in the Dark): `segments` slices, `filled` of
 * them ticked. It is the DM's tool for making the world move on its own when
 * the party looks the other way — optional, never a nag, never auto-ticked.
 */
export interface PlotClock {
  segments: number;
  filled: number;
}

export interface Plot {
  id: string;
  title: string;
  description: string;
  status: PlotStatus;
  relatedEntityIds: string[]; // IDs of NPCs, Locations, Factions involved in this plot
  mentionedEntityIds?: string[]; // IDs of entities referenced via @-mentions in text fields
  /** Optional countdown — non-id-bearing. Read `filled` as `Math.min(filled, segments)`. */
  clock?: PlotClock;
  /** What happens next if the party does nothing about this — the plot's own move. */
  ifIgnored?: string;
}
