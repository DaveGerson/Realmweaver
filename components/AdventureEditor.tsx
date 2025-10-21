
import React, { useState, useEffect } from 'react';
import type { Adventure, Campaign } from '../types';
import { Icons } from './Icons';
import { PrepDocumentView } from './PrepDocumentView';
import { twMerge } from 'tailwind-merge';

interface AdventureEditorProps {
  adventure: Adventure;
  campaign: Campaign;
  onUpdate: (id: string, updatedData: Partial<Adventure>) => void;
}

export const AdventureEditor: React.FC<AdventureEditorProps> = ({ adventure, campaign, onUpdate }) => {
  const [formData, setFormData] = useState(adventure);
  const [activeTab, setActiveTab] = useState<'details' | 'prepDoc'>('details');

  useEffect(() => {
    setFormData(adventure);
  }, [adventure]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const isNumber = e.target.type === 'number';
    setFormData(prev => ({ ...prev, [name]: isNumber ? parseInt(value) || 0 : value }));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (JSON.stringify(formData) !== JSON.stringify(adventure)) {
        const { name, value } = e.target;
        const isNumber = e.target.type === 'number';
        onUpdate(adventure.id, { [name]: isNumber ? parseInt(value) || 0 : value });
    }
  };

  return (
    <div className="p-6 md:p-8 h-full flex flex-col overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
      <header className="space-y-4">
        <div className="flex items-center gap-3 text-indigo-400">
          <Icons.Adventures className="w-8 h-8" />
          <h1 className="text-3xl font-bold font-serif text-slate-100">Adventure: {adventure.title}</h1>
        </div>
        
        <div className="border-b border-slate-800">
          <nav className="-mb-px flex space-x-6">
            <TabButton isActive={activeTab === 'details'} onClick={() => setActiveTab('details')}>
              <Icons.Setting className="w-4 h-4 mr-2" /> Details
            </TabButton>
            <TabButton isActive={activeTab === 'prepDoc'} onClick={() => setActiveTab('prepDoc')}>
              <Icons.FileCode className="w-4 h-4 mr-2" /> Prep Document
            </TabButton>
          </nav>
        </div>
      </header>
      
      {activeTab === 'details' && (
        <div className="space-y-6 bg-slate-900/50 p-6 rounded-xl border border-slate-800/50 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Adventure Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                onBlur={handleBlur}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"
                placeholder="The Sunken City of Zylos"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Target Level</label>
              <input
                type="number"
                name="level"
                min={1}
                max={20}
                value={formData.level}
                onChange={handleChange}
                onBlur={handleBlur}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">One-Sentence Hook</label>
            <textarea
              name="hook"
              value={formData.hook}
              onChange={handleChange}
              onBlur={handleBlur}
              rows={2}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600 resize-y"
              placeholder="A mysterious artifact is discovered, but it's part of a key to an ancient, powerful prison..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Themes & Mood</label>
            <input
              type="text"
              name="theme"
              value={formData.theme}
              onChange={handleChange}
              onBlur={handleBlur}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"
              placeholder="Cosmic Horror, Investigation, Desperate Survival"
            />
          </div>
        </div>
      )}

      {activeTab === 'prepDoc' && (
        <PrepDocumentView adventure={adventure} campaign={campaign} />
      )}
    </div>
  );
};

const TabButton: React.FC<{isActive: boolean, onClick: () => void, children: React.ReactNode}> = ({ isActive, onClick, children }) => (
  <button
    onClick={onClick}
    className={twMerge(
      'flex items-center whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm focus:outline-none',
      isActive
        ? 'border-indigo-500 text-indigo-400'
        : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'
    )}
  >
    {children}
  </button>
)
