
// types/Secret.ts

export interface Secret {
  id: string;
  title: string;
  content: string;          // The actual secret/clue text
  category: 'secret' | 'clue' | 'revelation' | 'rumor';
  isRevealed: boolean;      // Has this been revealed to players?
  revealedInSessionId?: string;  // Which session it was revealed in
  linkedEntityIds?: string[];     // Related entities (NPCs, locations, etc.)
  createdAt: string;        // ISO date
  notes?: string;           // DM notes about this secret
}
