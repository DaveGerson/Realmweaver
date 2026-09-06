
// types/SessionLog.ts
import type { Encounter } from './Encounter';
import type { DiceRoll } from './DiceRoll';

export interface Beat {
  id: string;
  title: string;
  notes?: string;
  isCompleted: boolean;
}

export type SessionStatus = 'planned' | 'active' | 'completed';

export type PlotSessionStatus = 'advanced' | 'stalled' | 'unchanged';

// `entity-created` is the auto entry for a Location/Item/Note promoted from a
// note via "Make this canon" (a promoted NPC uses `npc-created`, which the
// roster tooling already understands). Auto entries are never themselves
// offered for promotion, so a promotion note can't be re-canonised.
export type SessionLogEntryType = 'manual' | 'scene-transition' | 'combat' | 'npc-created' | 'entity-created' | 'dice-roll' | 'coach-used' | 'world-moved';

/**
 * The Stage — where the party is and who is with them RIGHT NOW, independent
 * of any prepped Scene. It is the live, DM-edited truth of the table: a
 * freeform session runs entirely on it, and a scene-driven session layers it
 * over the active scene (scene cast ∪ stage cast). Entering a prepped scene
 * clears it; leaving a scene seeds it from that scene so the room persists
 * when the script ends. Session-scoped, so it lives on the SessionLog.
 *
 * `locationId` and `npcIds` are id-bearing: they are swept by
 * `_purgeEntityReferences` and remapped by both id-remap passes.
 */
export interface SessionStage {
  /** A campaign Location the party is at, when one is linked. */
  locationId?: string;
  /** A freeform place ("a nameless roadside shrine") when nothing is linked. */
  place?: string;
  /** NPCs the DM has put on stage, beyond the active scene's own cast. */
  npcIds: string[];
  /** One line: what is happening right now. */
  focus?: string;
}

export interface SessionLogEntry {
  id: string;
  timestamp: string; // ISO string
  content: string;
  taggedEntityIds: string[];
  type?: SessionLogEntryType;
  tags?: string[];      // User-applied category tags like "Combat", "Decision", "Loot"
  isImportant?: boolean; // Starred/flagged entries
}

export interface SessionLog {
  id: string;
  title: string;
  status: SessionStatus;
  
  // Scheduling
  sessionDate: string; 
  
  // Planning Context
  adventureId?: string;
  plannedSceneIds: string[];
  prepNotes: string;
  plannedNpcIds?: string[];
  plannedLocationIds?: string[];
  
  // Plot Tracking
  relatedPlotIds: string[]; // IDs of plots advanced in this session
  plotProgressions?: Record<string, PlotSessionStatus>; // Per-plot status for this session

  // Execution - Unstructured
  runningNotes: string; 
  
  // Execution - Structured
  structuredNotes: SessionLogEntry[];

  // Combat History
  encounterLog: Encounter[]; // Archived encounters from this session

  // Dice Rolls
  diceRolls?: DiceRoll[];

  // Beats (lightweight freeform planning checklist)
  beats?: Beat[];

  // The Stage — live where/who/what, independent of prepped scenes (unstructured play)
  stage?: SessionStage;

  // Session Timer
  startedAt?: string; // ISO string, persisted on first go-live so timer survives re-mounts

  // Post-Session
  recap: string;
  notableEvents: string;
  looseEnds: string;
  playerRecap?: string;
}
