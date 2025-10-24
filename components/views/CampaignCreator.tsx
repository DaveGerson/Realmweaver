
import React, { useState } from 'react';
import { Button } from '../common/Button';
import { Icons } from '../common/Icons';

interface CampaignCreatorProps {
  onCreateCampaign: (title: string, setting: string) => void;
}

export const CampaignCreator: React.FC<CampaignCreatorProps> = ({ onCreateCampaign }) => {
  const [title, setTitle] = useState('');
  const [setting, setSetting] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onCreateCampaign(title, setting);
    }
  };
  
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl mx-auto animate-in fade-in duration-500">
            <header className="text-center mb-8">
                <Icons.Sparkles className="w-12 h-12 mx-auto text-indigo-500" />
                <h1 className="mt-4 text-3xl font-bold font-serif text-slate-100">Create Your Campaign</h1>
                <p className="mt-1 text-slate-400">
                Start with the big picture. You can add adventures and details later.
                </p>
            </header>

            <form onSubmit={handleSubmit} className="bg-slate-900/50 p-8 rounded-xl border border-slate-800 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Campaign Title</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"
                        placeholder="The Sundered Crown"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">World Setting</label>
                    <textarea
                        value={setting}
                        onChange={(e) => setSetting(e.target.value)}
                        rows={5}
                        className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600 resize-y"
                        placeholder="A high-level description of the world, its history, and its current state..."
                    />
                </div>

                <Button type="submit" size="lg" className="w-full">
                    <Icons.Campaign className="w-4 h-4 mr-2" />
                    Weave Campaign
                </Button>
            </form>
        </div>
    </div>
  );
};
