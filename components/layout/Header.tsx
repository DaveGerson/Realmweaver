
import React, { useState, useEffect, useRef } from 'react';
import { Icons } from '../common/Icons';
import type { Campaign } from '../../types/index';
import type { SaveStatus } from '../../services/campaignService';

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
  onToggleSidebar?: () => void;
  saveStatus?: SaveStatus;
  lastSavedAt?: string | null;
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
  onShowExportModal,
  onToggleSidebar,
  saveStatus = 'saved',
  lastSavedAt
}) => {
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

  const formatLastSaved = (isoDate: string | null | undefined) => {
      if (!isoDate) return "Never";
      return new Date(isoDate).toLocaleTimeString();
  };

  if (!activeCampaign) {
    return null; // Don't render header if no campaign is active
  }

  return (
    <>
      <header className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-900 flex-shrink-0 relative z-[60]">
        <div className="flex items-center gap-2 md:gap-4">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="md:hidden p-1 text-slate-400 hover:text-white transition-colors"
            >
              <Icons.Menu className="w-6 h-6" />
            </button>
          )}
          <div className="flex items-center gap-2">
              <Icons.Campaign className="w-6 h-6 text-amber-400 hidden sm:block" />
              <h1 className="text-lg font-bold font-serif text-slate-100 hidden sm:block">RealmWeaver</h1>
          </div>
          <div className="h-6 w-px bg-slate-700 hidden sm:block"></div>
          <div className="relative" ref={menuRef}>
              <button onClick={() => setIsMenuOpen(p => !p)} className="flex items-center gap-2 group">
                  <span className="text-md font-semibold text-slate-300 group-hover:text-white transition-colors truncate max-w-[150px] sm:max-w-xs">{activeCampaign.title}</span>
                  <Icons.ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {isMenuOpen && (
                  <div className="absolute top-full mt-2 w-60 bg-slate-800 border border-slate-700 rounded-md shadow-lg z-[60] animate-in fade-in duration-150">
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
        <div className="flex items-center gap-2 sm:gap-6">
          {/* Auto-Save Indicator */}
          <div
            className="hidden sm:flex items-center gap-2 text-sm text-slate-400 cursor-help"
            title={`Last saved: ${formatLastSaved(lastSavedAt)}`}
          >
             {saveStatus === 'saving' && (
                 <>
                    <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-indigo-400">Saving...</span>
                 </>
             )}
             {saveStatus === 'saved' && (
                 <>
                    <Icons.Save className="w-4 h-4 text-slate-500" />
                    <span>Saved</span>
                 </>
             )}
             {saveStatus === 'error' && (
                 <button onClick={onSaveCampaign} className="flex items-center gap-2 text-red-400 hover:text-red-300">
                    <Icons.X className="w-4 h-4" />
                    <span>Save Failed (Retry)</span>
                 </button>
             )}
          </div>

          <div className="hidden sm:block h-6 w-px bg-slate-700"></div>

          <button
            onClick={onToggleWizard}
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 rounded-md p-1 sm:-m-1"
            aria-label="Toggle Evocation Wizard"
          >
            <Icons.Wizard className="w-5 h-5 text-indigo-400" />
            <span className="hidden lg:inline">Evocation Wizard</span>
          </button>
           <button
              onClick={onToggleCoach}
              className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 rounded-md p-1 sm:-m-1"
              aria-label="Toggle Session Weaver"
            >
            <Icons.Coach className="w-5 h-5 text-indigo-400" />
            <span className="hidden lg:inline">Session Weaver</span>
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
              <span className={`hidden md:inline text-xs font-medium ${isMockMode ? 'text-indigo-400' : 'text-slate-500'}`}>
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
