
// types/Scene.ts
import type { SkillCheck } from './SkillCheck';

export type SceneType = 'combat' | 'social' | 'exploration' | 'puzzle';

/**
 * Represents a discrete unit of gameplay or narrative within an **Adventure**.
 * A Scene contains the static preparation data (Read-aloud text, GM notes, Skill checks)
 * needed to run a specific segment of the game.
 * 
 * Note: A Scene of type 'combat' describes the setup for a fight, whereas an
 * **Encounter** object tracks the dynamic mechanical state (HP, Initiative) of that fight while it runs.
 */
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
