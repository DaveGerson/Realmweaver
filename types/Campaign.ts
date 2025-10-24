// types/Campaign.ts
import type { Adventure } from './Adventure';
import type { NPC } from './NPC';
import type { Location } from './Location';
import type { Faction } from './Faction';
import type { Item } from './Item';
import type { Article } from './Article';
import type { SessionLog } from './SessionLog';

export interface Campaign {
  id: string;
  title: string;
  setting: string;
  articles: Article[];
  adventures: Adventure[];
  npcs: NPC[];
  locations: Location[];
  factions: Faction[];
  items: Item[];
  sessionLogs: SessionLog[];
}
