
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

  // Session Timer
  startedAt?: string; // ISO string, persisted on first go-live so timer survives re-mounts

  // Post-Session
  recap: string;
  notableEvents: string;
  looseEnds: string;
  playerRecap?: string;
}
