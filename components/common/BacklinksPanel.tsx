
/**
 * BacklinksPanel — shows all entities that reference the current entity.
 *
 * Reads the active campaign from the store (reactive via useSyncExternalStore),
 * calls computeBacklinks, and renders grouped results with EntityLink entries.
 * Each group is capped at 5 entries and has a "Show all" expander.
 */

import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { campaignService } from '@/services/campaignService';
import { computeBacklinks } from '@/utils/backlinkUtils';
import { EntityLink } from '@/components/common/EntityLink';
import { Icons } from '@/components/common/Icons';
import type { QuickCardEntityType } from '@/components/common/EntityQuickCard';
import type { BacklinkEntry, GroupedBacklinks } from '@/utils/backlinkUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BacklinksPanelProps {
  entityId: string;
  entityType: string;
  onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
}

// ─── Group header config ──────────────────────────────────────────────────────

interface GroupConfig {
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  label: string;
}

const GROUP_CONFIG: Record<string, GroupConfig> = {
  npc: {
    icon: Icons.NPCs,
    colorClass: 'text-amber-400',
    label: 'NPCs',
  },
  location: {
    icon: Icons.Locations,
    colorClass: 'text-emerald-400',
    label: 'Locations',
  },
  faction: {
    icon: Icons.Factions,
    colorClass: 'text-violet-400',
    label: 'Factions',
  },
  item: {
    icon: Icons.Items,
    colorClass: 'text-sky-400',
    label: 'Items',
  },
  adventure: {
    icon: Icons.Adventures,
    colorClass: 'text-orange-400',
    label: 'Adventures',
  },
  article: {
    icon: Icons.FileText,
    colorClass: 'text-cyan-400',
    label: 'Articles',
  },
  plot: {
    icon: Icons.Plot,
    colorClass: 'text-yellow-400',
    label: 'Plots',
  },
  scene: {
    icon: Icons.Scenes,
    colorClass: 'text-blue-400',
    label: 'Scenes',
  },
  'session-log': {
    icon: Icons.SessionLog,
    colorClass: 'text-rose-400',
    label: 'Session Logs',
  },
};

const DEFAULT_GROUP_CONFIG: GroupConfig = {
  icon: Icons.FileText,
  colorClass: 'text-slate-400',
  label: 'Other',
};

const ENTRIES_CAP = 5;

// ─── Sub-component: one group ─────────────────────────────────────────────────

interface BacklinkGroupProps {
  entityType: string;
  entries: BacklinkEntry[];
  onNavigate?: (entityType: QuickCardEntityType, entityId: string) => void;
}

const BacklinkGroup: React.FC<BacklinkGroupProps> = ({ entityType, entries, onNavigate }) => {
  const [expanded, setExpanded] = useState(false);

  const config = GROUP_CONFIG[entityType] ?? DEFAULT_GROUP_CONFIG;
  const GroupIcon = config.icon;
  const visible = expanded ? entries : entries.slice(0, ENTRIES_CAP);
  const hasMore = entries.length > ENTRIES_CAP;

  return (
    <div className="space-y-1.5">
      {/* Group header */}
      <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${config.colorClass}`}>
        <GroupIcon className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{config.label}</span>
        <span className="ml-auto text-slate-500 font-normal normal-case tracking-normal">
          {entries.length}
        </span>
      </div>

      {/* Entries */}
      <ul className="space-y-1 pl-5">
        {visible.map((entry) => (
          <li key={`${entry.entityType}-${entry.id}`} className="flex items-center gap-2 text-sm">
            {onNavigate ? (
              <EntityLink
                entityType={entry.entityType as QuickCardEntityType}
                entityId={entry.id}
                label={entry.name}
                onNavigate={onNavigate}
              />
            ) : (
              <span className="text-slate-300">{entry.name}</span>
            )}
            <span className="text-slate-500 text-xs">({entry.relationshipLabel})</span>
          </li>
        ))}
      </ul>

      {/* Expander */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="pl-5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          {expanded
            ? 'Show fewer'
            : `Show all (${entries.length})`}
        </button>
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const BacklinksPanel: React.FC<BacklinksPanelProps> = ({
  entityId,
  entityType,
  onNavigate,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Reactive subscription so the panel updates when campaign state changes
  const state = useSyncExternalStore(campaignService.subscribe, campaignService.getState);
  const campaign = useMemo(() => {
    return state.campaigns.find((c) => c.id === state.activeCampaignId) ?? null;
  }, [state.campaigns, state.activeCampaignId]);

  const backlinks = useMemo((): GroupedBacklinks => {
    if (!campaign) return {};
    return computeBacklinks(entityId, entityType, campaign);
  }, [entityId, entityType, campaign]);

  const groupEntries = Object.entries(backlinks);
  const totalCount = groupEntries.reduce((sum, [, entries]) => sum + entries.length, 0);

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 overflow-hidden">
      {/* Panel header — always visible, acts as collapse toggle */}
      <button
        type="button"
        onClick={() => setIsCollapsed((prev) => !prev)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-700/50 transition-colors"
        aria-expanded={!isCollapsed}
      >
        <Icons.Link className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span className="text-sm font-semibold text-slate-200 flex-1">
          Referenced By{isCollapsed && totalCount > 0 ? ` (${totalCount})` : ''}
        </span>
        {!isCollapsed && totalCount > 0 && (
          <span className="text-xs bg-slate-700 text-slate-300 rounded-full px-2 py-0.5 font-mono">
            {totalCount}
          </span>
        )}
        {isCollapsed ? (
          <Icons.ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <Icons.ChevronUp className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Panel body */}
      {!isCollapsed && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-700">
          {groupEntries.length === 0 ? (
            <p className="text-sm text-slate-500 italic py-2">
              No other entities reference this one.
            </p>
          ) : (
            <div className="space-y-4 mt-3">
              {groupEntries.map(([type, entries]) => (
                <BacklinkGroup
                  key={type}
                  entityType={type}
                  entries={entries}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
