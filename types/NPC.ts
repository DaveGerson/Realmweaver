
// types/NPC.ts
import type { HistoryEntry } from './common';
export type { HistoryReferenceType, HistoryEntry } from './common';

export interface EntityRelationship {
  id: string;
  targetId: string;
  relationType: string; // e.g., "Ally", "Rival", "Family"
  description: string;
}

export interface NPC {
  id: string;
  name: string;
  description: string; // Physical appearance, mannerisms
  traits: string; // Memorable personality traits or mannerisms
  backstory: string;
  motivations: string;
  secrets: string; // What they know or are hiding
  stats: string; // Could be a simple string for key stats or a link to a stat block
  exampleQuote: string; // A memorable line of dialogue.
  factionId?: string;
  knowsPlayerHistory: { playerId: string; details: string }[]; // Deprecated but kept for compatibility
  relationships: EntityRelationship[];
  history: HistoryEntry[];
  mentionedEntityIds?: string[]; // IDs of entities referenced via @-mentions in text fields
}
