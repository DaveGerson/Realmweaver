
// types/SessionLog.ts
import type { Encounter } from './Encounter';

export type SessionStatus = 'planned' | 'active' | 'completed';

export interface SessionLogEntry {
  id: string;
  timestamp: string; // ISO string
  content: string;
  taggedEntityIds: string[];
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

  // Post-Session
  recap: string;
  notableEvents: string;
  looseEnds: string;
}
