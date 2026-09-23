
// types/Location.ts
import type { HistoryEntry } from './common';

export interface LocationConnection {
  id: string;
  targetLocationId: string;
  description: string;
}

export interface PoiInteraction {
  id:string;
  description: string; // e.g., "On a DC 15 Arcana check", "If a player pulls the left lever"
  outcome: string; // e.g., "Players notice this is the work of a powerful necromancer", "An alarm goes off"
}

export interface PointOfInterest {
  id: string;
  name: string;
  passivePerceptionDC: number;
  description: string; // Read-aloud text if passive perception is met
  investigationChecks: PoiInteraction[];
  interactions: PoiInteraction[];
}

export interface LootItem {
  id: string;
  description: string;
  pointOfInterestId?: string;
}

export interface Location {
  id: string;
  name: string;
  description: string;
  secrets: string;
  loot?: LootItem[];
  parentLocationId?: string;
  subLocationIds: string[];
  connections?: LocationConnection[];
  pointsOfInterest?: PointOfInterest[];
  controllingFactionId?: string; // The faction that controls or influences this area
  history: HistoryEntry[];
  mentionedEntityIds?: string[]; // IDs of entities referenced via @-mentions in text fields
  /**
   * Sly Flourish's "develop fantastic locations" step (Lazy DM step 5):
   * 2-3 short, sensory one-liners lighter than the full `description` — a
   * GM can read one aloud or paraphrase it without consulting a paragraph.
   * Optional, non-id-bearing; absent on every save that predates this field
   * and on any location the GM never bothered to add them to — read as
   * `?? []` everywhere. An empty list is stored as `undefined`, never `[]`.
   */
  aspects?: string[];
}
