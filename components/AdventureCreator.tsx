import React, { useState } from 'react';
import { Button } from './common/Button';
import { Icons } from './Icons';
import type { Adventure } from '../types';

interface AdventureCreatorProps {
  onAdventureCreated: (adventureData: Omit<Adventure, 'id' | 'scenes'>) => void;
}

export const AdventureCreator: React.FC<AdventureCreatorProps> = ({ onAdventureCreated }) => {
  const [title, setTitle] = useState('');
  const [hook, setHook] = useState('');
  const [theme, setTheme] = useState('');
  const [level, setLevel] = useState(1);

  const handleCreate = () => {
    if (title.trim()) {
      onAdventureCreated({ title, hook, theme, level: level || 1 });
      setTitle('');
      setHook('');
      setTheme('');
      setLevel(1);
    }
  };
  
  return (
    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 space-y-3">
      <div className="flex items-center gap-2">
        <Icons.Sparkles className="w-5 h-5 text-indigo-400" />
        <h3 className="text-md font-semibold text-slate-200 font-serif">Add New Adventure</h3>
      </div>
       <div className="space-y-3">
            <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Title</label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none"
                    placeholder="The Sunken Temple"
                    required
                />
            </div>
             <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Target Level</label>
                <input
                    type="number"
                    value={level}
                    min={1}
                    max={20}
                    onChange={(e) => setLevel(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none"
                />
            </div>
        </div>
      <Button onClick={handleCreate} disabled={!title.trim()} className="w-full">
          <Icons.Adventures className="w-4 h-4 mr-2" />
          Create Adventure
      </Button>
    </div>
  );
};
