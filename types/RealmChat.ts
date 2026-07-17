
import type { NPC, Location, Faction, Item, Adventure, Article, AdventureForBatchAdd, Scene } from './index';

export type DraftEntityStatus = 'draft' | 'approved';

export type DraftEntity = 
  | ({ type: 'npc'; data: Partial<NPC>; status: DraftEntityStatus } & { id: string })
  | ({ type: 'location'; data: Partial<Location>; status: DraftEntityStatus } & { id: string })
  | ({ type: 'faction'; data: Partial<Faction>; status: DraftEntityStatus } & { id: string })
  | ({ type: 'item'; data: Partial<Item>; status: DraftEntityStatus } & { id: string })
  | ({ type: 'adventure'; data: Partial<AdventureForBatchAdd>; status: DraftEntityStatus } & { id: string })
  | ({ type: 'article'; data: Partial<Article>; status: DraftEntityStatus } & { id: string })
  | ({ type: 'scene'; data: Partial<Scene>; status: DraftEntityStatus } & { id: string });

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  suggestions?: string[]; // Quick replies suggested by AI
  timestamp: number;
}

export interface RealmChatResponse {
  message: string;
  suggestions: string[];
  draftEntities: DraftEntity[]; // Entities created or updated in this turn
}

export type ModelTier = 'performance' | 'medium' | 'quality';
