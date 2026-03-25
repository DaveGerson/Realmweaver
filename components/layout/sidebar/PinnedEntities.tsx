
import React from 'react';
import { Icons } from '@/components/common/Icons';
import type { Campaign } from '@/types/index';
import type { CommandPaletteEntityType } from '@/components/common/CommandPalette';
import { RECENT_TYPE_ICON, RECENT_TYPE_COLOR, resolvePinnedEntityName } from './sidebarUtils';

interface PinnedEntitiesProps {
  campaign: Campaign;
  pinnedEntities: Array<{ type: string; id: string }>;
  onSelectPinned: (type: string, id: string) => void;
  onUnpin: (type: string, id: string) => void;
}

export const PinnedEntities: React.FC<PinnedEntitiesProps> = ({
  campaign,
  pinnedEntities,
  onSelectPinned,
  onUnpin,
}) => {
  if (pinnedEntities.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 px-3 pt-3 pb-1">
        <Icons.Star className="w-3.5 h-3.5 text-amber-500" />
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pinned</h3>
      </div>
      <div className="space-y-0.5">
        {pinnedEntities.slice(0, 15).map(pinned => {
          const iconKey = RECENT_TYPE_ICON[pinned.type as CommandPaletteEntityType];
          const Icon = iconKey ? Icons[iconKey] : Icons.Star;
          const colorClass = RECENT_TYPE_COLOR[pinned.type as CommandPaletteEntityType] ?? 'text-slate-400';
          const name = resolvePinnedEntityName(campaign, pinned.type, pinned.id);
          if (!name) return null;
          return (
            <div key={`${pinned.type}-${pinned.id}`} className="flex items-center group">
              <button
                onClick={() => onSelectPinned(pinned.type, pinned.id)}
                className="flex-1 flex items-center gap-2 px-3 py-1.5 text-sm rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors min-w-0"
                title={name}
              >
                <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${colorClass}`} />
                <span className="truncate">{name}</span>
              </button>
              <button
                onClick={() => onUnpin(pinned.type, pinned.id)}
                className="flex-shrink-0 mr-2 p-1 text-slate-600 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-all"
                title="Unpin"
                aria-label={`Unpin ${name}`}
              >
                <Icons.X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
