
// types/SessionLog.ts
import type { Encounter } from './Encounter';
import type { DiceRoll } from './DiceRoll';

export type SessionStatus = 'planned' | 'active' | 'completed';

export type SessionLogEntryType = 'manual' | 'scene-transition' | 'combat' | 'npc-created' | 'dice-roll' | 'coach-used';

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
  
  // Plot Tracking
  relatedPlotIds: string[]; // IDs of plots advanced in this session

  // Execution - Unstructured
  runningNotes: string; 
  
  // Execution - Structured
  structuredNotes: SessionLogEntry[];

  // Combat History
  encounterLog: Encounter[]; // Archived encounters from this session

  // Dice Rolls
  diceRolls?: DiceRoll[];

  // Post-Session
  recap: string;
  notableEvents: string;
  looseEnds: string;
}
