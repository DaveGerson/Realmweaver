
// types/Campaign.ts
import type { Adventure } from './Adventure';
import type { NPC } from './NPC';
import type { Location } from './Location';
import type { Faction } from './Faction';
import type { Item } from './Item';
import type { Article } from './Article';
import type { SessionLog } from './SessionLog';
import type { PlayerCharacter } from './PlayerCharacter';
import type { Note } from './Note';
import type { Encounter } from './Encounter';

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
  playerCharacters: PlayerCharacter[];
  notes: Note[];
  activeEncounter?: Encounter;
  activeSceneId?: string; // The ID of the scene currently being played in the session
}
