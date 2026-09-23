
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
  /**
   * How this character SOUNDS: accent, cadence, verbal tics, register.
   * ("Clipped sentences, never uses contractions, calls everyone 'pet'.")
   *
   * Wave 2 / P3 (docs/design/storyteller-first-design.md). Non-id-bearing, so
   * it joins no integrity contract — nothing points at it and it points at
   * nothing. Optional: every save written before this field existed lacks it,
   * and `createDefaultNpc()` does not mint it, so always read it defensively
   * (`npc.voiceNotes ?? ''`).
   */
  voiceNotes?: string;
  factionId?: string;
  knowsPlayerHistory: { playerId: string; details: string }[]; // Deprecated but kept for compatibility
  relationships: EntityRelationship[];
  history: HistoryEntry[];
  mentionedEntityIds?: string[]; // IDs of entities referenced via @-mentions in text fields
}
