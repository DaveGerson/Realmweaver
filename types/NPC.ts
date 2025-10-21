
// types/NPC.ts
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
  knowsPlayerHistory: { playerId: string; details: string }[];
}
