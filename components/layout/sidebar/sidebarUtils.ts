
import type { Campaign } from '@/types/index';
import { ENTITY_TYPE_CONFIG } from '@/utils/entityUtils';
import type { CommandPaletteEntityType } from '@/components/common/CommandPalette';
import { Icons } from '@/components/common/Icons';

// ─── Icon / colour maps derived from ENTITY_TYPE_CONFIG ─────────────────────
// Shared by PinnedEntities and RecentItems

export const RECENT_TYPE_ICON: Record<CommandPaletteEntityType, keyof typeof Icons> = Object.fromEntries(
  (Object.keys(ENTITY_TYPE_CONFIG) as string[])
    .filter(k => k !== 'sessionLog' && k !== 'playerCharacter' && k !== 'note')
    .map(k => [k, ENTITY_TYPE_CONFIG[k].icon as keyof typeof Icons])
) as Record<CommandPaletteEntityType, keyof typeof Icons>;

export const RECENT_TYPE_COLOR: Record<CommandPaletteEntityType, string> = Object.fromEntries(
  (Object.keys(ENTITY_TYPE_CONFIG) as string[])
    .filter(k => k !== 'sessionLog' && k !== 'playerCharacter' && k !== 'note')
    .map(k => [k, `text-${ENTITY_TYPE_CONFIG[k].color}-400`])
) as Record<CommandPaletteEntityType, string>;

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
    default: return null;
  }
}
