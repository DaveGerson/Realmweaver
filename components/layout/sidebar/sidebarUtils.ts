
import type { Campaign } from '@/types/index';
import { ENTITY_TYPE_CONFIG } from '@/utils/entityUtils';
import type { CommandPaletteEntityType } from '@/components/common/CommandPalette';
import { Icons } from '@/components/common/Icons';

// ─── Icon / colour maps derived from ENTITY_TYPE_CONFIG ─────────────────────
// Shared by PinnedEntities and RecentItems

// Build maps from ENTITY_TYPE_CONFIG for all hyphenated keys used by
// CommandPaletteEntityType. ENTITY_TYPE_CONFIG now has a 'scene' entry
// (blue), which is the single source of truth CLAUDE.md requires — do not
// re-add a hardcoded scene override here, or the sidebar's Recent/Pinned
// lists will drift out of sync with EntityQuickCard/CommandPalette/
// RelationshipGraph, which all derive scene's color from the same config.
const _baseIconEntries = Object.entries(ENTITY_TYPE_CONFIG).map(
  ([k, v]) => [k, v.icon as keyof typeof Icons]
);

export const RECENT_TYPE_ICON: Record<CommandPaletteEntityType, keyof typeof Icons> = {
  ...Object.fromEntries(_baseIconEntries),
} as Record<CommandPaletteEntityType, keyof typeof Icons>;

const _baseColorEntries = Object.entries(ENTITY_TYPE_CONFIG).map(
  ([k, v]) => [k, `text-${v.color}-400`]
);

export const RECENT_TYPE_COLOR: Record<CommandPaletteEntityType, string> = {
  ...Object.fromEntries(_baseColorEntries),
} as Record<CommandPaletteEntityType, string>;

// ─── Pinned entity name resolution ───────────────────────────────────────────
// Returns null if the entity no longer exists (e.g. was deleted).

export function resolvePinnedEntityName(campaign: Campaign, type: string, id: string): string | null {
  switch (type) {
    case 'npc': return campaign.npcs.find(e => e.id === id)?.name ?? null;
    case 'location': return campaign.locations.find(e => e.id === id)?.name ?? null;
    case 'faction': return campaign.factions.find(e => e.id === id)?.name ?? null;
    case 'item': return campaign.items.find(e => e.id === id)?.name ?? null;
    case 'adventure': return campaign.adventures.find(e => e.id === id)?.title ?? null;
    case 'article': return campaign.articles.find(e => e.id === id)?.title ?? null;
    case 'session-log': return campaign.sessionLogs?.find(e => e.id === id)?.title ?? null;
    case 'player-character': return campaign.playerCharacters?.find(e => e.id === id)?.characterSocial?.characterName ?? null;
    case 'plot': return campaign.plots?.find(e => e.id === id)?.title ?? null;
    // Findings #92/#102: 'scene' and 'note' are pinnable (QuickCardEntityType
    // includes both, and EntityQuickCard's pin button calls pinEntity
    // unconditionally) but were missing here, so a pinned scene/note fell
    // into `default: return null` and PinnedEntities dropped the row —
    // leaving an unremovable pin permanently occupying one of the 15 slots.
    case 'scene': {
      for (const adv of campaign.adventures) {
        const scene = adv.scenes.find(s => s.id === id);
        if (scene) return scene.title;
      }
      return null;
    }
    case 'note': return campaign.notes?.find(e => e.id === id)?.title ?? null;
    default: return null;
  }
}
