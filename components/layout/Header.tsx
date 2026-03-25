
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Icons } from '../common/Icons';
import type { Campaign } from '../../types/index';
import type { SaveStatus } from '../../services/campaignService';
import { getModifierSymbol } from '../../utils/keyboardShortcuts';
import { isFeatureVisible } from '../../utils/dmStyleUtils';

interface HeaderProps {
  activeCampaign: Campaign | null;
  isMockMode: boolean;
  onToggleMockMode: () => void;
  onToggleCoach: () => void;
  onToggleWizard: () => void;
  onToggleWorldSim: () => void;
  onToggleContinuityChecker: () => void;
  continuityIssueCount?: number;
  onSaveCampaign: () => void;
  onSwitchCampaign: () => void;
  onAllCampaigns?: () => void;
  onCreateNew: () => void;
  onImportCampaign: (file: File) => void;
  onShowExportModal: () => void;
  onToggleSidebar?: () => void;
  onShowShortcutsHelp?: () => void;
  onOpenCommandPalette?: () => void;
  saveStatus?: SaveStatus;
  lastSavedAt?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  activeCampaign,
  isMockMode,
  onToggleMockMode,
  onToggleCoach,
  onToggleWizard,
  onToggleWorldSim,
  onToggleContinuityChecker,
  continuityIssueCount = 0,
  onSaveCampaign,
  onSwitchCampaign,
  onAllCampaigns,
  onCreateNew,
  onImportCampaign,
  onShowExportModal,
  onToggleSidebar,
  onShowShortcutsHelp,
  onOpenCommandPalette,
  saveStatus = 'saved',
  lastSavedAt
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
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

  // Focus the first menu item when the menu opens
  useEffect(() => {
    if (isMenuOpen) {
      requestAnimationFrame(() => {
        const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
        first?.focus();
      });
    }
  }, [isMenuOpen]);

  const handleMenuKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isMenuOpen) return;
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    );
    const focused = document.activeElement as HTMLElement;
    const currentIdx = items.indexOf(focused);

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsMenuOpen(false);
        menuButtonRef.current?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (items.length > 0) {
          const next = currentIdx < items.length - 1 ? currentIdx + 1 : 0;
          items[next]?.focus();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (items.length > 0) {
          const prev = currentIdx > 0 ? currentIdx - 1 : items.length - 1;
          items[prev]?.focus();
        }
        break;
      case 'Home':
        e.preventDefault();
        items[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        items[items.length - 1]?.focus();
        break;
    }
  }, [isMenuOpen]);

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
    return (
      <header className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-900 flex-shrink-0 relative z-[60]">
        <div className="flex items-center gap-2">
          <Icons.Campaign className="w-6 h-6 text-amber-400" />
          <h1 className="text-lg font-bold font-serif text-slate-100">Realmweaver</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className={`hidden md:inline text-xs font-medium ${isMockMode ? 'text-amber-400' : 'text-slate-500'}`}>
            Mock Mode
          </span>
          <button
            onClick={onToggleMockMode}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
              isMockMode ? 'bg-amber-600' : 'bg-slate-700'
            }`}
            role="switch"
            aria-checked={isMockMode}
            aria-label="Mock Mode"
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isMockMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </header>
    );
  }

  const dmStyle = activeCampaign.dmStyle ?? 'standard';
  const featureOverrides = activeCampaign.featureOverrides ?? {};
  const showContinuityChecker = isFeatureVisible('continuity-checker', dmStyle, featureOverrides);
  const showKeyboardShortcuts = isFeatureVisible('keyboard-shortcuts', dmStyle, featureOverrides);

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
          <div className="relative" ref={menuRef} onKeyDown={handleMenuKeyDown}>
              <button
                ref={menuButtonRef}
                onClick={() => setIsMenuOpen(p => !p)}
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
                className="flex items-center gap-2 group"
              >
                  <span className="text-base font-semibold text-slate-300 group-hover:text-white transition-colors truncate max-w-[150px] sm:max-w-xs">{activeCampaign.title}</span>
                  <Icons.ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {isMenuOpen && (
                  <div
                    className="absolute top-full mt-2 w-60 bg-slate-800 border border-slate-700 rounded-md shadow-lg z-[60] animate-in fade-in duration-150"
                    role="menu"
                    aria-label="Campaign menu"
                  >
                      <div className="p-1">
                          {onAllCampaigns && (
                              <button onClick={() => { onAllCampaigns(); setIsMenuOpen(false); }} role="menuitem" className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-amber-300 hover:bg-slate-700 rounded-md transition-colors font-medium focus:outline-none focus:bg-slate-700">
                                  <Icons.AllCampaigns className="w-4 h-4" /> All Campaigns
                              </button>
                          )}
                          <button onClick={() => { onSwitchCampaign(); setIsMenuOpen(false); }} role="menuitem" className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded-md transition-colors focus:outline-none focus:bg-slate-700">
                              <Icons.Campaign className="w-4 h-4" /> Switch Campaign
                          </button>
                          <button onClick={() => { onCreateNew(); setIsMenuOpen(false); }} role="menuitem" className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded-md transition-colors focus:outline-none focus:bg-slate-700">
                              <Icons.Plus className="w-4 h-4" /> Create New Campaign
                          </button>
                          <div className="h-px bg-slate-700 my-1" role="separator"></div>
                          <button onClick={() => { handleImportClick(); setIsMenuOpen(false); }} role="menuitem" className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded-md transition-colors focus:outline-none focus:bg-slate-700">
                            <Icons.FileUp className="w-4 h-4" /> Import Campaign
                          </button>
                          <button onClick={() => { onShowExportModal(); setIsMenuOpen(false); }} role="menuitem" className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded-md transition-colors focus:outline-none focus:bg-slate-700">
                              <Icons.FileDown className="w-4 h-4" /> Export Campaign
                          </button>
                      </div>
                  </div>
              )}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-6">
          {/* Command Palette Search Button */}
          {onOpenCommandPalette && (
            <button
              onClick={onOpenCommandPalette}
              className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-sm text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
              title={`Search (${getModifierSymbol()}+K)`}
              aria-label={`Search (${getModifierSymbol()}+K)`}
            >
              <Icons.Search className="w-4 h-4" />
              <span className="hidden lg:inline">Search</span>
              <kbd className="hidden lg:inline-flex items-center px-1 py-0.5 rounded border border-slate-600 text-slate-500 text-xs font-mono">
                {getModifierSymbol()}K
              </kbd>
            </button>
          )}

          {/* Auto-Save Indicator */}
          <div
            className="hidden sm:flex items-center gap-2 text-sm text-slate-400 cursor-help"
            title={`Force save (${getModifierSymbol()}+S) — Last saved: ${formatLastSaved(lastSavedAt)}`}
          >
             {saveStatus === 'saving' && (
                 <>
                    <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-amber-400">Saving...</span>
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

          {/* Continuity Checker */}
          {showContinuityChecker && (
          <button
            onClick={onToggleContinuityChecker}
            className="relative flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-amber-500 rounded-md p-1 sm:-m-1"
            aria-label="Check campaign continuity"
            title="Check Continuity"
          >
            <Icons.Factions className="w-5 h-5 text-amber-400" />
            <span className="hidden md:inline lg:hidden">Check</span>
            <span className="hidden lg:inline">Continuity</span>
            {continuityIssueCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold leading-none px-0.5">
                {continuityIssueCount > 99 ? '99+' : continuityIssueCount}
              </span>
            )}
          </button>
          )}
          <button
            onClick={onToggleWizard}
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-amber-500 rounded-md p-1 sm:-m-1"
            aria-label="Toggle Evocation Wizard"
            title="Evocation Wizard"
          >
            <Icons.Wizard className="w-5 h-5 text-amber-400" />
            <span className="hidden md:inline lg:hidden">Evocation</span>
            <span className="hidden lg:inline">Evocation Wizard</span>
          </button>
          <button
            onClick={onToggleWorldSim}
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-amber-500 rounded-md p-1 sm:-m-1"
            aria-label="World Simulation — what happened off-screen?"
            title="World Simulation — what happened off-screen?"
          >
            <Icons.WorldSim className="w-5 h-5 text-amber-400" />
            <span className="hidden md:inline">World Sim</span>
          </button>
          <button
              onClick={onToggleCoach}
              className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-amber-500 rounded-md p-1 sm:-m-1"
              aria-label="Toggle Session Weaver"
              title="Session Weaver"
            >
            <Icons.Coach className="w-5 h-5 text-amber-400" />
            <span className="hidden md:inline lg:hidden">Session</span>
            <span className="hidden lg:inline">Session Weaver</span>
          </button>
          {/* Keyboard Shortcuts Help */}
          {onShowShortcutsHelp && showKeyboardShortcuts && (
            <button
              onClick={onShowShortcutsHelp}
              className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-amber-500 rounded-md p-1 sm:-m-1"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
            >
              <Icons.Keyboard className="w-5 h-5 text-slate-400" />
            </button>
          )}

          <div className="flex items-center gap-2 sm:gap-3">
              <span className={`hidden md:inline text-xs font-medium ${isMockMode ? 'text-amber-400' : 'text-slate-500'}`}>
                Mock Mode
              </span>
              <button
                onClick={onToggleMockMode}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                  isMockMode ? 'bg-amber-600' : 'bg-slate-700'
                }`}
                role="switch"
                aria-checked={isMockMode}
                aria-label="Mock Mode"
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
