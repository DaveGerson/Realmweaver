import React from 'react';
import type { Campaign } from '../types';
import { Icons } from './Icons';
import { Button } from './common/Button';

interface CampaignSelectorProps {
  campaigns: Campaign[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onCreateNew: () => void;
}

export const CampaignSelector: React.FC<CampaignSelectorProps> = ({ campaigns, onSelect, onDelete, onCreateNew }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl mx-auto animate-in fade-in duration-500">
        <header className="text-center mb-8">
            {/* FIX: Corrected icon to use the 'Campaign' alias for BookHeart from Icons.ts */}
            <Icons.Campaign className="w-12 h-12 mx-auto text-indigo-500" />
            <h1 className="mt-4 text-3xl font-bold font-serif text-slate-100">Your Campaigns</h1>
            <p className="mt-1 text-slate-400">
                Select a campaign to continue your journey, or create a new one.
            </p>
        </header>

        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 space-y-4">
            <div className="max-h-96 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                {campaigns.map(campaign => (
                    <div key={campaign.id} className="group flex items-center gap-3 p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 transition-all">
                        <div className="flex-grow cursor-pointer" onClick={() => onSelect(campaign.id)}>
                            <h3 className="font-semibold text-lg text-slate-100 group-hover:text-indigo-400 transition-colors">{campaign.title}</h3>
                            <p className="text-sm text-slate-400 line-clamp-2">{campaign.setting || 'No setting description provided.'}</p>
                        </div>
                        <button onClick={() => onDelete(campaign.id)} className="p-2 rounded-md text-slate-500 hover:bg-red-900/50 hover:text-red-400 transition-colors" aria-label={`Delete campaign ${campaign.title}`}>
                            <Icons.Trash className="w-4 h-4" />
                        </button>
                    </div>
                ))}
                {campaigns.length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                        <p>You haven't created any campaigns yet.</p>
                    </div>
                )}
            </div>
            <Button onClick={onCreateNew} size="lg" className="w-full">
                <Icons.Plus className="w-4 h-4 mr-2" />
                Create New Campaign
            </Button>
        </div>
      </div>
    </div>
  );
};
