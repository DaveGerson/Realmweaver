
import { useState } from 'react';

export interface ModalState {
  isCoachOpen: boolean;
  isWizardOpen: boolean;
  isWorldSimOpen: boolean;
  isFirstCampaignWizardOpen: boolean;
  isExportModalOpen: boolean;
  isContinuityCheckerOpen: boolean;
  isShortcutsHelpOpen: boolean;
  isCommandPaletteOpen: boolean;
  isSidebarOpen: boolean;

  setIsCoachOpen: (v: boolean) => void;
  setIsWizardOpen: (v: boolean) => void;
  setIsWorldSimOpen: (v: boolean) => void;
  setIsFirstCampaignWizardOpen: (v: boolean) => void;
  setIsExportModalOpen: (v: boolean) => void;
  setIsContinuityCheckerOpen: (v: boolean) => void;
  setIsShortcutsHelpOpen: (v: boolean) => void;
  setIsCommandPaletteOpen: (v: boolean) => void;
  setIsSidebarOpen: (v: boolean) => void;

  toggleCoach: () => void;
  toggleWizard: () => void;
  toggleWorldSim: () => void;
  toggleSidebar: () => void;
  toggleCommandPalette: () => void;
  toggleShortcutsHelp: () => void;
  toggleContinuityChecker: () => void;

  /**
   * Close the topmost open modal in priority order:
   * commandPalette > shortcutsHelp > continuityChecker > coach > wizard > worldSim > exportModal
   * Returns true if any modal was closed, false if all were already closed.
   */
  closeTopModal: () => boolean;
}

export function useModalState(): ModalState {
  const [isCoachOpen, setIsCoachOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isWorldSimOpen, setIsWorldSimOpen] = useState(false);
  const [isFirstCampaignWizardOpen, setIsFirstCampaignWizardOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isContinuityCheckerOpen, setIsContinuityCheckerOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleCoach = () => setIsCoachOpen(prev => !prev);
  const toggleWizard = () => setIsWizardOpen(prev => !prev);
  const toggleWorldSim = () => setIsWorldSimOpen(prev => !prev);
  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);
  const toggleCommandPalette = () => setIsCommandPaletteOpen(prev => !prev);
  const toggleShortcutsHelp = () => setIsShortcutsHelpOpen(prev => !prev);
  const toggleContinuityChecker = () => setIsContinuityCheckerOpen(prev => !prev);

  const closeTopModal = (): boolean => {
    if (isCommandPaletteOpen) { setIsCommandPaletteOpen(false); return true; }
    if (isShortcutsHelpOpen) { setIsShortcutsHelpOpen(false); return true; }
    if (isContinuityCheckerOpen) { setIsContinuityCheckerOpen(false); return true; }
    if (isCoachOpen) { setIsCoachOpen(false); return true; }
    if (isWizardOpen) { setIsWizardOpen(false); return true; }
    if (isWorldSimOpen) { setIsWorldSimOpen(false); return true; }
    if (isExportModalOpen) { setIsExportModalOpen(false); return true; }
    return false;
  };

  return {
    isCoachOpen,
    isWizardOpen,
    isWorldSimOpen,
    isFirstCampaignWizardOpen,
    isExportModalOpen,
    isContinuityCheckerOpen,
    isShortcutsHelpOpen,
    isCommandPaletteOpen,
    isSidebarOpen,

    setIsCoachOpen,
    setIsWizardOpen,
    setIsWorldSimOpen,
    setIsFirstCampaignWizardOpen,
    setIsExportModalOpen,
    setIsContinuityCheckerOpen,
    setIsShortcutsHelpOpen,
    setIsCommandPaletteOpen,
    setIsSidebarOpen,

    toggleCoach,
    toggleWizard,
    toggleWorldSim,
    toggleSidebar,
    toggleCommandPalette,
    toggleShortcutsHelp,
    toggleContinuityChecker,

    closeTopModal,
  };
}
