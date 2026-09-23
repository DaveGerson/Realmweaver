
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

/**
 * RealmChat uses the canonical app-wide model tier (`lite` | `standard` |
 * `quality`) from `services/ai/modelConfig.ts`. The former RealmChat-only
 * union (`performance` | `medium` | `quality`) is retired; its values are
 * still accepted by `aiService.chatWithRealmWeaver` and normalised via
 * `modelConfig.toModelTier` (`performance` → `lite`, `medium` → `standard`).
 */
export type { ModelTier, LegacyRealmChatTier } from '../services/ai/modelConfig';
