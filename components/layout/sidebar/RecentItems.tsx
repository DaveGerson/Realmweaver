
import React, { useState } from 'react';
import { Icons } from '@/components/common/Icons';
import type { RecentItem, CommandPaletteEntityType } from '@/components/common/CommandPalette';
import { RECENT_TYPE_ICON, RECENT_TYPE_COLOR } from './sidebarUtils';

interface RecentItemsProps {
  recentItems: RecentItem[];
  onSelectRecent: (type: CommandPaletteEntityType, id: string) => void;
}

export const RecentItems: React.FC<RecentItemsProps> = React.memo(({ recentItems, onSelectRecent }) => {
  const [showAll, setShowAll] = useState(false);

  if (recentItems.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 px-3 pt-3 pb-1">
        <Icons.Clock className="w-3.5 h-3.5 text-slate-500" />
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recent</h3>
      </div>
      <div className="space-y-0.5">
        {(showAll ? recentItems : recentItems.slice(0, 5)).map(item => {
          const iconKey = RECENT_TYPE_ICON[item.type];
          const Icon = Icons[iconKey];
          const colorClass = RECENT_TYPE_COLOR[item.type];
          return (
            <button
              key={`${item.type}-${item.id}`}
              onClick={() => onSelectRecent(item.type, item.id)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
              title={item.name}
            >
              <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${colorClass}`} />
              <span className="truncate">{item.name}</span>
            </button>
          );
        })}
        {recentItems.length > 5 && (
          <button
            onClick={() => setShowAll(prev => !prev)}
            className="w-full text-left text-xs text-slate-500 hover:text-slate-300 px-3 py-1 transition-colors"
          >
            {showAll ? 'Show less' : `Show ${recentItems.length - 5} more...`}
          </button>
        )}
      </div>
    </div>
  );
});
