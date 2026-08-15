
import React from 'react';
import { Icons } from '@/components/common/Icons';

interface SidebarSearchProps {
  filterText: string;
  onFilterChange: (value: string) => void;
  onClear: () => void;
}

export const SidebarSearch: React.FC<SidebarSearchProps> = ({ filterText, onFilterChange, onClear }) => {
  return (
    <div className="mb-3 px-1">
      <div className="relative">
        <Icons.Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
        <input
          type="text"
          value={filterText}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Filter entities..."
          className="w-full bg-slate-800 border border-slate-700 rounded-md pl-8 pr-7 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
        />
        {filterText && (
          <button
            onClick={onClear}
            title="Clear filter"
            aria-label="Clear filter"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            <Icons.X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
