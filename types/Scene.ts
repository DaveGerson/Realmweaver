
// types/Scene.ts
import type { SkillCheck } from './SkillCheck';

export type SceneType = 'combat' | 'social' | 'exploration' | 'puzzle';

export interface Scene {
  id: string;
  title: string;
  type: SceneType;
  readAloudText: string; // Box text for players
  gmNotes: string; // GM-facing notes, scene goals, etc.
  skillChecks: SkillCheck[]; // Explicit skill checks in the scene
  rewards: string; // Loot, XP, or other rewards
  locationId?: string; // Reference to a campaign-level Location
  npcIds: string[]; // References to campaign-level NPCs
}
