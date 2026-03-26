
import React from 'react';
import { twMerge } from 'tailwind-merge';

interface SidebarEntityListItem {
  id: string;
  name: string;
}

interface SidebarEntityListProps {
  items: SidebarEntityListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyMessage?: string;
}

export const SidebarEntityList: React.FC<SidebarEntityListProps> = React.memo(({
  items,
  selectedId,
  onSelect,
  emptyMessage,
}) => {
  if (items.length === 0 && emptyMessage) {
    return <p className="px-2 py-1 text-xs text-slate-600 italic">{emptyMessage}</p>;
  }

  return (
    <>
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className={twMerge(
            'w-full text-left text-sm truncate pr-2 pl-2 py-1 rounded-md',
            selectedId === item.id ? 'bg-slate-700 text-white' : 'hover:bg-slate-800 text-slate-400'
          )}
          title={item.name}
        >
          {item.name}
        </button>
      ))}
    </>
  );
});
