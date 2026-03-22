
import React, { useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Icons } from '@/components/common/Icons';
import { campaignService } from '@/services/campaignService';
import type { NPC, Location, Faction, Item, Adventure, Article, Plot, SessionLog, PlayerCharacter } from '@/types/index';

// ─── Entity type configuration ──────────────────────────────────────────────

export type QuickCardEntityType = 'npc' | 'location' | 'faction' | 'item' | 'adventure' | 'article' | 'plot' | 'session-log' | 'player-character';

interface EntityTypeConfig {
  label: string;
  badgeClass: string;       // bg-* text-* classes for the type badge
  borderClass: string;      // left-border accent class
  Icon: React.ElementType;
}

const ENTITY_CONFIG: Record<QuickCardEntityType, EntityTypeConfig> = {
  npc: {
    label: 'NPC',
    badgeClass: 'bg-amber-900/60 text-amber-300',
    borderClass: 'border-l-amber-500',
    Icon: Icons.NPCs,
  },
  location: {
    label: 'Location',
    badgeClass: 'bg-emerald-900/60 text-emerald-300',
    borderClass: 'border-l-emerald-500',
    Icon: Icons.Locations,
  },
  faction: {
    label: 'Faction',
    badgeClass: 'bg-violet-900/60 text-violet-300',
    borderClass: 'border-l-violet-500',
    Icon: Icons.Factions,
  },
  item: {
    label: 'Item',
    badgeClass: 'bg-sky-900/60 text-sky-300',
    borderClass: 'border-l-sky-500',
    Icon: Icons.Items,
  },
  adventure: {
    label: 'Adventure',
    badgeClass: 'bg-orange-900/60 text-orange-300',
    borderClass: 'border-l-orange-500',
    Icon: Icons.Adventures,
  },
  article: {
    label: 'Article',
    badgeClass: 'bg-cyan-900/60 text-cyan-300',
    borderClass: 'border-l-cyan-500',
    Icon: Icons.FileText,
  },
  plot: {
    label: 'Plot',
    badgeClass: 'bg-yellow-900/60 text-yellow-300',
    borderClass: 'border-l-yellow-500',
    Icon: Icons.Plot,
  },
  'session-log': {
    label: 'Session',
    badgeClass: 'bg-rose-900/60 text-rose-300',
    borderClass: 'border-l-rose-500',
    Icon: Icons.SessionLog,
  },
  'player-character': {
    label: 'Character',
    badgeClass: 'bg-indigo-900/60 text-indigo-300',
    borderClass: 'border-l-indigo-500',
    Icon: Icons.PlayerCharacters,
  },
};

// ─── Entity detail extractors ────────────────────────────────────────────────

interface EntityDetail {
  label: string;
  value: string;
}

function truncate(text: string, maxLen = 80): string {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen).trimEnd() + '…' : text;
}

function getNpcDetails(npc: NPC, campaign: ReturnType<typeof campaignService.getActiveCampaign>): EntityDetail[] {
  const details: EntityDetail[] = [];

  if (npc.description) {
    // First sentence of description acts as race/class hint
    const firstLine = npc.description.split(/[.\n]/)[0].trim();
    if (firstLine) details.push({ label: 'Description', value: truncate(firstLine, 60) });
  }
  if (npc.traits) {
    details.push({ label: 'Traits', value: truncate(npc.traits, 80) });
  }
  if (npc.factionId && campaign) {
    const faction = campaign.factions.find(f => f.id === npc.factionId);
    if (faction) details.push({ label: 'Faction', value: faction.name });
  }
  if (npc.motivations) {
    details.push({ label: 'Motivation', value: truncate(npc.motivations, 80) });
  }
  return details.slice(0, 4);
}

function getLocationDetails(loc: Location, campaign: ReturnType<typeof campaignService.getActiveCampaign>): EntityDetail[] {
  const details: EntityDetail[] = [];

  if (loc.description) {
    const firstLine = loc.description.split(/[.\n]/)[0].trim();
    if (firstLine) details.push({ label: 'Atmosphere', value: truncate(firstLine, 80) });
  }
  const connectionCount = (loc.connections?.length ?? 0) + (loc.subLocationIds?.length ?? 0);
  if (connectionCount > 0) {
    details.push({ label: 'Connections', value: String(connectionCount) });
  }
  if (loc.parentLocationId && campaign) {
    const parent = campaign.locations.find(l => l.id === loc.parentLocationId);
    if (parent) details.push({ label: 'Within', value: parent.name });
  }
  if (loc.controllingFactionId && campaign) {
    const faction = campaign.factions.find(f => f.id === loc.controllingFactionId);
    if (faction) details.push({ label: 'Controlled by', value: faction.name });
  }
  return details.slice(0, 4);
}

function getFactionDetails(faction: Faction, campaign: ReturnType<typeof campaignService.getActiveCampaign>): EntityDetail[] {
  const details: EntityDetail[] = [];

  if (faction.alignment) details.push({ label: 'Alignment', value: faction.alignment });
  if (faction.goals) details.push({ label: 'Goals', value: truncate(faction.goals, 80) });
  if (faction.memberIds.length > 0) {
    details.push({ label: 'Members', value: String(faction.memberIds.length) });
  }
  if (faction.headquartersLocationId && campaign) {
    const hq = campaign.locations.find(l => l.id === faction.headquartersLocationId);
    if (hq) details.push({ label: 'HQ', value: hq.name });
  }
  return details.slice(0, 4);
}

function getItemDetails(item: Item): EntityDetail[] {
  const details: EntityDetail[] = [];

  details.push({ label: 'Rarity', value: item.rarity });
  if (item.description) {
    const firstLine = item.description.split(/[.\n]/)[0].trim();
    if (firstLine) details.push({ label: 'Description', value: truncate(firstLine, 80) });
  }
  if (item.properties) {
    details.push({ label: 'Properties', value: truncate(item.properties, 80) });
  }
  return details.slice(0, 4);
}

function getAdventureDetails(adventure: Adventure): EntityDetail[] {
  const details: EntityDetail[] = [];

  details.push({ label: 'Scenes', value: String(adventure.scenes?.length ?? 0) });
  if (adventure.level) details.push({ label: 'Level', value: String(adventure.level) });
  if (adventure.theme) details.push({ label: 'Theme', value: truncate(adventure.theme, 60) });
  if (adventure.hook) details.push({ label: 'Hook', value: truncate(adventure.hook, 80) });
  return details.slice(0, 4);
}

function getArticleDetails(article: Article, campaign: ReturnType<typeof campaignService.getActiveCampaign>): EntityDetail[] {
  const details: EntityDetail[] = [];

  details.push({ label: 'Category', value: article.category });
  if (article.content) {
    const firstLine = article.content.split(/[.\n]/)[0].trim();
    if (firstLine) details.push({ label: 'Content', value: truncate(firstLine, 80) });
  }
  const relatedCount = article.relatedEntityIds?.length ?? 0;
  if (relatedCount > 0) {
    details.push({ label: 'References', value: String(relatedCount) });
  }
  if (article.parentArticleId && campaign) {
    const parent = campaign.articles.find(a => a.id === article.parentArticleId);
    if (parent) details.push({ label: 'Under', value: parent.title });
  }
  return details.slice(0, 4);
}

function getPlotDetails(plot: Plot): EntityDetail[] {
  const details: EntityDetail[] = [];

  details.push({ label: 'Status', value: plot.status });
  if (plot.description) {
    const firstLine = plot.description.split(/[.\n]/)[0].trim();
    if (firstLine) details.push({ label: 'Summary', value: truncate(firstLine, 80) });
  }
  if (plot.relatedEntityIds.length > 0) {
    details.push({ label: 'Entities', value: String(plot.relatedEntityIds.length) });
  }
  return details.slice(0, 4);
}

function getSessionLogDetails(log: SessionLog): EntityDetail[] {
  const details: EntityDetail[] = [];

  if (log.sessionDate) details.push({ label: 'Date', value: log.sessionDate });
  details.push({ label: 'Status', value: log.status });
  if (log.recap) {
    const firstLine = log.recap.split(/[.\n]/)[0].trim();
    if (firstLine) details.push({ label: 'Recap', value: truncate(firstLine, 80) });
  } else if (log.runningNotes) {
    const firstLine = log.runningNotes.split(/[.\n]/)[0].trim();
    if (firstLine) details.push({ label: 'Notes', value: truncate(firstLine, 80) });
  }
  if (log.structuredNotes.length > 0) {
    details.push({ label: 'Entries', value: String(log.structuredNotes.length) });
  }
  return details.slice(0, 4);
}

function getPlayerCharacterDetails(pc: PlayerCharacter): EntityDetail[] {
  const details: EntityDetail[] = [];

  const { characterSocial, characterStatistics } = pc;
  if (characterSocial.species) details.push({ label: 'Race', value: characterSocial.species });
  const { classes } = characterStatistics;
  if (classes) {
    const classStr = classes.subclass
      ? `${classes.subclass} ${classes.charClass} ${classes.level}`
      : `${classes.charClass} ${classes.level}`;
    details.push({ label: 'Class', value: classStr });
  }
  if (characterSocial.background) details.push({ label: 'Background', value: characterSocial.background });
  if (characterSocial.personality) {
    details.push({ label: 'Personality', value: truncate(characterSocial.personality, 80) });
  }
  return details.slice(0, 4);
}

function lookupEntity(
  entityType: QuickCardEntityType,
  entityId: string,
  campaign: ReturnType<typeof campaignService.getActiveCampaign>
): { name: string; details: EntityDetail[] } | null {
  if (!campaign) return null;

  switch (entityType) {
    case 'npc': {
      const npc = campaign.npcs.find(n => n.id === entityId);
      if (!npc) return null;
      return { name: npc.name, details: getNpcDetails(npc, campaign) };
    }
    case 'location': {
      const loc = campaign.locations.find(l => l.id === entityId);
      if (!loc) return null;
      return { name: loc.name, details: getLocationDetails(loc, campaign) };
    }
    case 'faction': {
      const faction = campaign.factions.find(f => f.id === entityId);
      if (!faction) return null;
      return { name: faction.name, details: getFactionDetails(faction, campaign) };
    }
    case 'item': {
      const item = campaign.items.find(i => i.id === entityId);
      if (!item) return null;
      return { name: item.name, details: getItemDetails(item) };
    }
    case 'adventure': {
      const adventure = campaign.adventures.find(a => a.id === entityId);
      if (!adventure) return null;
      return { name: adventure.title, details: getAdventureDetails(adventure) };
    }
    case 'article': {
      const article = campaign.articles.find(a => a.id === entityId);
      if (!article) return null;
      return { name: article.title, details: getArticleDetails(article, campaign) };
    }
    case 'plot': {
      const plot = campaign.plots.find(p => p.id === entityId);
      if (!plot) return null;
      return { name: plot.title, details: getPlotDetails(plot) };
    }
    case 'session-log': {
      const log = campaign.sessionLogs.find(s => s.id === entityId);
      if (!log) return null;
      return { name: log.title, details: getSessionLogDetails(log) };
    }
    case 'player-character': {
      const pc = campaign.playerCharacters.find(p => p.id === entityId);
      if (!pc) return null;
      return { name: pc.characterSocial.characterName, details: getPlayerCharacterDetails(pc) };
    }
    default:
      return null;
  }
}

// ─── Popover positioning ─────────────────────────────────────────────────────

interface PopoverPosition {
  top: number;
  left: number;
  openUpward: boolean;
}

function calculatePosition(triggerRect: DOMRect): PopoverPosition {
  const CARD_HEIGHT = 240;
  const CARD_WIDTH = 280;
  const MARGIN = 8;
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  // Prefer opening below; flip upward if not enough space
  const openUpward = triggerRect.bottom + CARD_HEIGHT + MARGIN > viewportHeight
    && triggerRect.top - CARD_HEIGHT - MARGIN >= 0;

  const top = openUpward
    ? triggerRect.top + window.scrollY - CARD_HEIGHT - MARGIN
    : triggerRect.bottom + window.scrollY + MARGIN;

  // Align left with trigger but prevent overflowing right edge
  let left = triggerRect.left + window.scrollX;
  if (left + CARD_WIDTH > viewportWidth - MARGIN) {
    left = viewportWidth - CARD_WIDTH - MARGIN;
  }
  if (left < MARGIN) left = MARGIN;

  return { top, left, openUpward };
}

// ─── EntityQuickCard (the floating card) ────────────────────────────────────

export interface EntityQuickCardProps {
  entityType: QuickCardEntityType;
  entityId: string;
  triggerRect: DOMRect;
  /** Called when user clicks "View" or the card's navigate action */
  onNavigate: (entityType: QuickCardEntityType, entityId: string) => void;
  /** Called when the popover should close */
  onClose: () => void;
}

export const EntityQuickCard: React.FC<EntityQuickCardProps> = ({
  entityType,
  entityId,
  triggerRect,
  onNavigate,
  onClose,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const config = ENTITY_CONFIG[entityType];

  const campaign = campaignService.getActiveCampaign();
  const entityData = lookupEntity(entityType, entityId, campaign);

  // Position
  const { top, left } = calculatePosition(triggerRect);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close on outside click
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use capture so we intercept before the trigger's own pointer handler
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [onClose]);

  const handleCopyName = useCallback(() => {
    if (entityData?.name) {
      navigator.clipboard.writeText(entityData.name).catch(() => {
        // Clipboard API may not be available in all contexts; silently ignore
      });
    }
    onClose();
  }, [entityData, onClose]);

  const handleNavigate = useCallback(() => {
    onNavigate(entityType, entityId);
    onClose();
  }, [onNavigate, entityType, entityId, onClose]);

  // ── Mobile bottom sheet ───────────────────────────────────────────────────
  // On screens narrower than 768px, render as a fixed bottom sheet overlay.
  const isMobile = window.innerWidth < 768;

  if (isMobile) {
    return ReactDOM.createPortal(
      <div
        className="fixed inset-0 z-50 flex flex-col justify-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onPointerDown={(e) => {
          // Close when tapping the backdrop (not the card itself)
          if (e.target === e.currentTarget) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`Quick info: ${entityData?.name ?? 'Entity'}`}
      >
        <div
          ref={cardRef}
          className={`bg-stone-800 border-t-2 border-stone-600 border-l-4 ${config.borderClass} rounded-t-xl p-4 pb-safe w-full max-h-[60vh] overflow-y-auto shadow-xl`}
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <QuickCardContent
            config={config}
            entityData={entityData}
            entityType={entityType}
            onNavigate={handleNavigate}
            onCopyName={handleCopyName}
            onClose={onClose}
          />
        </div>
      </div>,
      document.body
    );
  }

  // ── Desktop popover ───────────────────────────────────────────────────────
  return ReactDOM.createPortal(
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="false"
      aria-label={`Quick info: ${entityData?.name ?? 'Entity'}`}
      className={`fixed z-50 w-72 bg-stone-800 border border-stone-600 border-l-4 ${config.borderClass} rounded-lg shadow-xl`}
      style={{ top, left }}
    >
      <QuickCardContent
        config={config}
        entityData={entityData}
        entityType={entityType}
        onNavigate={handleNavigate}
        onCopyName={handleCopyName}
        onClose={onClose}
      />
    </div>,
    document.body
  );
};

// ─── Inner card content (shared between mobile/desktop) ──────────────────────

interface QuickCardContentProps {
  config: EntityTypeConfig;
  entityData: { name: string; details: EntityDetail[] } | null;
  entityType: QuickCardEntityType;
  onNavigate: () => void;
  onCopyName: () => void;
  onClose: () => void;
}

const QuickCardContent: React.FC<QuickCardContentProps> = ({
  config,
  entityData,
  entityType,
  onNavigate,
  onCopyName,
  onClose,
}) => {
  if (!entityData) {
    return (
      <div className="p-3 text-stone-400 text-sm">
        Entity not found.
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <config.Icon className="w-4 h-4 flex-shrink-0 text-stone-400" />
          <span className="font-semibold text-stone-100 text-sm truncate">{entityData.name}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${config.badgeClass}`}>
            {config.label}
          </span>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-stone-300 transition-colors p-0.5"
            aria-label="Close"
          >
            <Icons.X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Details */}
      {entityData.details.length > 0 && (
        <dl className="px-3 pb-2 space-y-1">
          {entityData.details.map((detail, i) => (
            <div key={i} className="flex gap-1.5 text-xs">
              <dt className="text-stone-500 flex-shrink-0 w-20 truncate">{detail.label}</dt>
              <dd className="text-stone-300 min-w-0 break-words">{detail.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Action buttons */}
      <div className="border-t border-stone-700 px-3 py-2 flex items-center gap-2">
        <button
          onClick={onNavigate}
          className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors min-h-[44px] sm:min-h-0 py-2 sm:py-1 px-1"
          aria-label={`View ${entityData.name}`}
        >
          <Icons.FolderOpen className="w-3.5 h-3.5" />
          View
        </button>
        <button
          onClick={onNavigate}
          className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 transition-colors min-h-[44px] sm:min-h-0 py-2 sm:py-1 px-1"
          aria-label={`Edit ${entityData.name}`}
        >
          <Icons.Edit className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          onClick={onCopyName}
          className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 transition-colors min-h-[44px] sm:min-h-0 py-2 sm:py-1 px-1 ml-auto"
          aria-label={`Copy name: ${entityData.name}`}
        >
          <Icons.Clipboard className="w-3.5 h-3.5" />
          Copy Name
        </button>
      </div>
    </div>
  );
};
