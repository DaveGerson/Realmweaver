
// types/Faction.ts
export interface Faction {
  id: string;
  name: string;
  description: string;
  goals: string;
  leaderId?: string;
  memberIds: string[];
  alignment?: string;
  resources?: string;
  influence?: string;
  headquartersLocationId?: string;
  mentionedEntityIds?: string[]; // IDs of entities referenced via @-mentions in text fields
}
