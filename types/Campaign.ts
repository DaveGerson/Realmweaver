
// types/Campaign.ts
import type { Adventure } from './Adventure';
import type { NPC } from './NPC';
import type { Location } from './Location';
import type { Faction } from './Faction';
import type { Item } from './Item';
import type { Article } from './Article';
import type { SessionLog } from './SessionLog';
import type { PlayerCharacter } from './PlayerCharacter';
import type { Plot } from './Plot';
import type { Encounter } from './Encounter';
import type { Note } from './Note';
import type { Secret } from './Secret';
import type { DmStyle } from './CampaignSetting';

export type SettingType = 'custom' | 'official';

export interface Campaign {
  id: string;
  title: string;
  settingType: SettingType;
  officialSetting?: string; // e.g., "Forgotten Realms", "Eberron"
  setting: string; // User overrides or custom setting description
  articles: Article[];
  adventures: Adventure[];
  npcs: NPC[];
  locations: Location[];
  factions: Faction[];
  items: Item[];
  sessionLogs: SessionLog[];
  playerCharacters: PlayerCharacter[];
  plots: Plot[];
  notes: Note[];
  secrets?: Secret[];
  activeEncounter?: Encounter;
  activeSceneId?: string; // The ID of the scene currently being played in the session
  activeSessionId?: string; // The ID of the currently live session (Session Runner)
  pinnedEntities?: Array<{ type: string; id: string }>;
  dmStyle?: DmStyle; // Progressive disclosure setting for feature visibility
  featureOverrides?: Record<string, boolean>; // Per-feature manual overrides (bypasses dmStyle)
  wizardDismissed?: boolean; // Set to true when the First Campaign Wizard has been dismissed or completed
  styleProfile?: string; // AI-generated description of the DM's writing voice and style
}
