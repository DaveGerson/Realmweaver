// types/Faction.ts
export interface Faction {
  id: string;
  name: string;
  description: string;
  goals: string;
  leaderId?: string;
  memberIds: string[];
}
