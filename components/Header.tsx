import React, { useState, useEffect, useRef } from 'react';
import { Icons } from './Icons';
import type { Campaign } from '../types/index';

interface HeaderProps {
  activeCampaign: Campaign | null;
  isMockMode: boolean;
  onToggleMockMode: () => void;
  onToggleCoach: () => void;
  onToggleWizard: () => void;
  onSaveCampaign: () => void;
  onSwitchCampaign: () => void;
  onCreateNew: () => void;
  onImportCampaign: (file: File) => void;
  onShowExportModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  activeCampaign, 
  isMockMode, 
  onToggleMockMode, 
  onToggleCoach, 
  onToggleWizard, 
  onSaveCampaign,
  onSwitchCampaign,
  onCreateNew,
  onImportCampaign,
  onShowExportModal
}) => {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSave = () => {
    onSaveCampaign();
    setSaveStatus('saved');
    setTimeout(() => {
      setSaveStatus('idle');
    }, 2000);
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          onImportCampaign(file);
      }
      // Reset file input to allow importing the same file again
      if(importInputRef.current) {
          importInputRef.current.value = "";
      }
  };

  if (!activeCampaign) {
    return null; // Don't render header if no campaign is active
  }

  return (
    <>
      <header className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-900 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
              <Icons.Campaign className="w-6 h-6 text-indigo-400" />
              <h1 className="text-lg font-bold font-serif text-slate-100">RealmWeaver</h1>
          </div>
          <div className="h-6 w-px bg-slate-700"></div>
          <div className="relative" ref={menuRef}>
              <button onClick={() => setIsMenuOpen(p => !p)} className="flex items-center gap-2 group">
                  <span className="text-md font-semibold text-slate-300 group-hover:text-white transition-colors">{activeCampaign.title}</span>
                  <Icons.ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {isMenuOpen && (
                  <div className="absolute top-full mt-2 w-60 bg-slate-800 border border-slate-700 rounded-md shadow-lg z-20 animate-in fade-in duration-150">
                      <div className="p-1">
                          <button onClick={() => { onSwitchCampaign(); setIsMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded-md transition-colors">
                              <Icons.Campaign className="w-4 h-4" /> Switch Campaign
                          </button>
                          <button onClick={() => { onCreateNew(); setIsMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded-md transition-colors">
                              <Icons.Plus className="w-4 h-4" /> Create New Campaign
                          </button>
                          <div className="h-px bg-slate-700 my-1"></div>
                          <button onClick={() => { handleImportClick(); setIsMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded-md transition-colors">
                            <Icons.FileUp className="w-4 h-4" /> Import Campaign
                          </button>
                          <button onClick={() => { onShowExportModal(); setIsMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded-md transition-colors">
                              <Icons.FileDown className="w-4 h-4" /> Export Campaign
                          </button>
                      </div>
                  </div>
              )}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 rounded-md p-1 -m-1"
            aria-label="Save Campaign"
          >
            <Icons.Save className={`w-5 h-5 ${saveStatus === 'saved' ? 'text-green-400' : 'text-indigo-400'}`} />
            <span>{saveStatus === 'saved' ? 'Saved!' : 'Save Campaign'}</span>
          </button>
          <button 
            onClick={onToggleWizard} 
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 rounded-md p-1 -m-1"
            aria-label="Toggle Evocation Wizard"
          >
            <Icons.Wizard className="w-5 h-5 text-indigo-400" />
            <span>Evocation Wizard</span>
          </button>
           <button 
              onClick={onToggleCoach} 
              className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 rounded-md p-1 -m-1"
              aria-label="Toggle DM Coach"
            >
            <Icons.Coach className="w-5 h-5 text-indigo-400" />
            <span>DM Coach</span>
          </button>
          <div className="flex items-center gap-3">
              <span className={`text-xs font-medium ${isMockMode ? 'text-indigo-400' : 'text-slate-500'}`}>
                Mock Mode
              </span>
              <button
                onClick={onToggleMockMode}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                  isMockMode ? 'bg-indigo-600' : 'bg-slate-700'
                }`}
                role="switch"
                aria-checked={isMockMode}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isMockMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
          </div>
        </div>
      </header>
      <input
        type="file"
        ref={importInputRef}
        onChange={handleFileSelected}
        className="hidden"
        accept=".json"
      />
    </>
  );
};
