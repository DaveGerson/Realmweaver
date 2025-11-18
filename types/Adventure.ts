
// types/Adventure.ts
import type { Scene } from './Scene';

/**
 * Represents a narrative arc or storyline within a campaign.
 * An Adventure acts as a container for a sequence of **Scenes**.
 * It defines the high-level theme, hook, and level range for the enclosed story segments.
 */
export interface Adventure {
  id: string;
  title: string;
  level: number;
  hook: string; // A one-sentence hook
  theme: string; // e.g., "Cosmic Horror, Investigation"
  scenes: Scene[];
}
