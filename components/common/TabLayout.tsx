
import React from 'react';
import { twMerge } from 'tailwind-merge';

export interface TabDefinition {
  id: string;
  label: string;
  icon?: React.ElementType;
}

interface TabLayoutProps {
  tabs: TabDefinition[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: React.ReactNode;
}

export const TabLayout: React.FC<TabLayoutProps> = ({ tabs, activeTab, onTabChange, children }) => {
  return (
    <div className="flex flex-col">
      {/* Tab bar */}
      <div className="border-b border-slate-800 overflow-x-auto">
        <nav className="-mb-px flex space-x-1 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={twMerge(
                  'flex items-center whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm focus:outline-none transition-colors',
                  isActive
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-slate-500 hover:text-slate-200 hover:border-slate-500'
                )}
              >
                {Icon && <Icon className="w-4 h-4 mr-2 flex-shrink-0" />}
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {children}
      </div>
    </div>
  );
};
