// types/Adventure.ts
import type { Scene } from './Scene';

export interface Adventure {
  id: string;
  title: string;
  level: number;
  hook: string; // A one-sentence hook
  theme: string; // e.g., "Cosmic Horror, Investigation"
  scenes: Scene[];
}
