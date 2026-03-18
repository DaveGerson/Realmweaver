
export type CombatantType = 'pc' | 'npc' | 'monster';

/**
 * Represents a participant in a combat encounter.
 * Tracks dynamic state like current HP and Initiative.
 */
export interface Combatant {
  id: string;
  name: string;
  type: CombatantType;
  initiative: number;
  hp: number;
  maxHp: number;
  ac?: number;
  notes?: string; // Status effects, conditions
}

/**
 * Represents the active, mechanical state of a combat scenario (D&D 5e mechanics).
 * Unlike a **Scene**, which contains the static preparation data, an Encounter tracks
 * dynamic values like Initiative order, current HP, rounds, and turns during live gameplay.
 */
export interface Encounter {
  id: string;
  sessionId?: string; // Links this encounter to a specific session
  sceneId?: string; // Links this encounter to the scene it originated from
  round: number;
  turnIndex: number; // Index of the currently active combatant in the sorted list
  combatants: Combatant[];
}
