
export type CombatantType = 'pc' | 'npc' | 'monster';

/**
 * A condition applied to a combatant (e.g. "Poisoned").
 * `roundsRemaining` is optional — omitted means the condition lasts until removed.
 * When set, it decrements each time the encounter's round advances and the
 * condition is dropped when it reaches 0.
 */
export interface CombatCondition {
  name: string;
  roundsRemaining?: number;
}

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
  /** Challenge rating as printed in a stat block ("1/4", "5"). Used by the difficulty readout. */
  cr?: string;
  /** Character level (PCs). Used to derive party XP thresholds. */
  level?: number;
  /** Structured conditions. Optional — encounters saved before this field existed have none. */
  conditions?: CombatCondition[];
  notes?: string; // Freeform notes
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
