
import React, { FC, useState, useEffect, useMemo, useSyncExternalStore, Suspense } from 'react';
import { WelcomeScreen } from './components/views/WelcomeScreen';
import { CampaignCreator } from './components/views/CampaignCreator';
import { FirstCampaignWizard } from './components/views/FirstCampaignWizard';
import { CrossCampaignDashboard } from './components/views/CrossCampaignDashboard';
import { Header } from './components/layout/Header';
import { CampaignSidebar } from './components/layout/CampaignSidebar';
import { ViewRouter } from './components/layout/ViewRouter';
import type { ExportEntityCounts } from './components/dialogs/ExportModal';

// Lazy-loaded dialogs — only bundled when opened
const DmCoach = React.lazy(() => import('./components/dialogs/DmCoach').then(m => ({ default: m.DmCoach })));
const EvocationWizard = React.lazy(() => import('./components/dialogs/EvocationWizard').then(m => ({ default: m.EvocationWizard })));
const WorldSimulationWizard = React.lazy(() => import('./components/dialogs/WorldSimulationWizard').then(m => ({ default: m.WorldSimulationWizard })));
const ExportModal = React.lazy(() => import('./components/dialogs/ExportModal').then(m => ({ default: m.ExportModal })));
const ContinuityChecker = React.lazy(() => import('./components/dialogs/ContinuityChecker').then(m => ({ default: m.ContinuityChecker })));
import { RealmChatWidget } from './components/RealmChat/RealmChatWidget';
import { Breadcrumbs } from './components/common/Breadcrumbs';
import { CommandPalette } from './components/common/CommandPalette';
import { KeyboardShortcutsHelp } from './components/common/KeyboardShortcutsHelp';
import { campaignService } from './services/campaignService';
import { buildCampaignContext } from './services/contextBuilder';
import { checkContinuity } from './services/continuityChecker';
import { exportCampaignAsJson, exportCampaignAsObsidian } from './services/importExportService';
import { analyzeWritingStyle } from './services/aiService';
import { matchShortcut } from './utils/keyboardShortcuts';
import { runSmokeTests } from './smokeTest';
import { useToast } from '@/hooks/useToast';
import { useModalState } from '@/hooks/useModalState';
import { useEntitySelection } from '@/hooks/useEntitySelection';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

export type EditorView = 'setting' | 'npcs' | 'locations' | 'factions' | 'items' | 'adventures' | 'lorebook' | 'session-logs' | 'player-characters' | 'plots' | 'combat' | 'relationships' | 'session-runner' | 'secrets';
export type GeneratorType = 'npc' | 'location' | 'faction' | 'item' | 'scene' | 'article';

export interface NavStackEntry {
  view: EditorView;
  selectedId: string | null;
  adventureId?: string | null;
  sceneId?: string | null;
  label: string;
}

const App: FC = () => {
  const { campaigns, activeCampaignId, appStatus, saveStatus, lastSavedAt } = useSyncExternalStore(
    campaignService.subscribe,
    campaignService.getState
  );

  const { addToast } = useToast();
  const [isMockMode, setIsMockMode] = useState(true);
  // Holds template data loaded in CampaignCreator; imported once campaign transitions to 'editing'
  const [pendingTemplateData, setPendingTemplateData] = useState<Record<string, unknown> | null>(null);
  const [sidebarExpandAll, setSidebarExpandAll] = useState(false);

  const activeCampaign = useMemo(
    () => campaigns.find(c => c.id === activeCampaignId),
    [campaigns, activeCampaignId]
  );
  const isOfficialSetting = activeCampaign?.settingType === 'official';

  const modals = useModalState();
  const {
    isCoachOpen, isWizardOpen, isWorldSimOpen, isFirstCampaignWizardOpen,
    isExportModalOpen, isContinuityCheckerOpen, isShortcutsHelpOpen,
    isCommandPaletteOpen, isSidebarOpen,
    setIsCoachOpen, setIsWizardOpen, setIsWorldSimOpen, setIsFirstCampaignWizardOpen,
    setIsExportModalOpen, setIsContinuityCheckerOpen, setIsSidebarOpen,
    setIsShortcutsHelpOpen, setIsCommandPaletteOpen,
    toggleCoach, toggleWizard, toggleWorldSim, toggleSidebar,
    toggleCommandPalette, toggleShortcutsHelp, toggleContinuityChecker,
    closeTopModal,
  } = modals;

  const sel = useEntitySelection({
    activeCampaign,
    onSidebarClose: () => setIsSidebarOpen(false),
  });
  const {
    selectedAdventureId, selectedSceneId, selectedNpcId, selectedLocationId,
    selectedFactionId, selectedItemId, selectedArticleId, selectedSessionLogId,
    selectedPlayerCharacterId, selectedPlotId,
    navStack, activeView, activeGenerator, recentItems,
    selectedAdventure, selectedScene, selectedNpc, selectedLocation,
    selectedFaction, selectedItem, selectedArticle, selectedSessionLog,
    selectedPlayerCharacter, selectedPlot,
    breadcrumbSegments,
    handleSelect, handleSelectView, handleGoBack, handleEntityNavigate,
    resetSelections, setActiveGenerator,
    setSelectedAdventureId, setSelectedSceneId, setSelectedNpcId,
    setSelectedLocationId, setSelectedFactionId, setSelectedItemId,
    setSelectedArticleId, setSelectedSessionLogId,
    setSelectedPlayerCharacterId, setSelectedPlotId, setActiveView,
  } = sel;

  // --- Effects ---

  useEffect(() => {
    runSmokeTests(isMockMode).catch(err => console.error('Smoke tests failed:', err));
  }, [isMockMode]);

  // When campaign transitions to 'editing' with pending template data, bulk-import the entities
  useEffect(() => {
    if (appStatus === 'editing' && pendingTemplateData) {
      campaignService.importTemplateData(pendingTemplateData);
      setPendingTemplateData(null);
    }
  }, [appStatus, pendingTemplateData]);

  // Auto-show First Campaign Wizard for new empty campaigns
  useEffect(() => {
    if (
      activeCampaign &&
      !activeCampaign.wizardDismissed &&
      activeCampaign.npcs.length === 0 &&
      activeCampaign.adventures.length === 0 &&
      activeCampaign.locations.length === 0
    ) {
      setIsFirstCampaignWizardOpen(true);
    } else {
      setIsFirstCampaignWizardOpen(false);
    }
  }, [activeCampaign?.id]);

  // Global keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const action = matchShortcut(e);
      if (!action) return;
      e.preventDefault();
      switch (action) {
        case 'search':
          toggleCommandPalette();
          break;
        case 'new-entity':
          resetSelections();
          break;
        case 'save':
          campaignService.saveCampaign();
          break;
        case 'close':
          closeTopModal();
          break;
        case 'help':
          toggleShortcutsHelp();
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, isShortcutsHelpOpen, isContinuityCheckerOpen, isCoachOpen, isWizardOpen, isWorldSimOpen, isExportModalOpen]);

  // Auto-generate style profile once entity count crosses 5 and no profile exists yet.
  useEffect(() => {
    if (!activeCampaign) return;
    if (activeCampaign.styleProfile) return;
    const totalEntities =
      activeCampaign.npcs.length + activeCampaign.locations.length +
      activeCampaign.factions.length + activeCampaign.items.length +
      activeCampaign.articles.length + activeCampaign.adventures.length;
    if (totalEntities < 5) return;
    const samples: string[] = [
      ...activeCampaign.npcs.slice(0, 10).map(n => n.description).filter(Boolean),
      ...activeCampaign.locations.slice(0, 5).map(l => l.description).filter(Boolean),
      ...activeCampaign.adventures.slice(0, 3).map(a => a.hook).filter(Boolean),
    ] as string[];
    if (samples.length === 0) return;
    analyzeWritingStyle(samples, isMockMode, campaignContext)
      .then(profile => { if (profile) campaignService.setStyleProfile(profile); })
      .catch(err => console.warn('[StyleMatching] Auto-analysis failed:', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeCampaign?.id,
    activeCampaign?.styleProfile,
    (activeCampaign?.npcs.length ?? 0) +
      (activeCampaign?.locations.length ?? 0) +
      (activeCampaign?.factions.length ?? 0) +
      (activeCampaign?.items.length ?? 0) +
      (activeCampaign?.articles.length ?? 0) +
      (activeCampaign?.adventures.length ?? 0),
  ]);

  // Continuity issue count — debounced so it doesn't run on every state change
  const [continuityIssueCount, setContinuityIssueCount] = useState(0);
  useEffect(() => {
    if (!activeCampaign) { setContinuityIssueCount(0); return; }
    const timer = setTimeout(() => {
      const issues = checkContinuity(activeCampaign);
      setContinuityIssueCount(issues.filter(i => i.severity === 'error' || i.severity === 'warning').length);
    }, 5000);
    return () => clearTimeout(timer);
  }, [activeCampaign]);

  // --- Campaign context (AI generation) ---
  const campaignContext = useMemo(() => {
    if (!activeCampaign) return undefined;
    return buildCampaignContext({
      variant: 'generation',
      campaign: activeCampaign,
      activeSceneId: activeCampaign.activeSceneId,
      activeSessionId: activeCampaign.activeSessionId,
    });
  }, [activeCampaign]);

  // --- Active scene NPC IDs for DM Coach NPC grouping (H16) ---
  const activeSceneNpcIds = useMemo(() => {
    if (!activeCampaign?.activeSceneId) return [];
    const adventure = activeCampaign.adventures.find(a =>
        a.scenes.some(s => s.id === activeCampaign.activeSceneId)
    );
    const scene = adventure?.scenes.find(s => s.id === activeCampaign.activeSceneId);
    return scene?.npcIds ?? [];
  }, [activeCampaign?.activeSceneId, activeCampaign?.adventures]);

  // --- DM Coach context — includes current user selection for richer in-session help ---
  const coachContext = useMemo(() => {
    if (!activeCampaign) return '';
    return buildCampaignContext({
      variant: 'coach',
      campaign: activeCampaign,
      activeSceneId: activeCampaign.activeSceneId,
      activeSessionId: activeCampaign.activeSessionId,
      focusSelection: {
        selectedNpcId,
        selectedLocationId,
        selectedSceneId,
        selectedAdventureId,
      },
    });
  }, [activeCampaign, activeCampaign?.activeSceneId, activeCampaign?.activeSessionId, selectedNpcId, selectedLocationId, selectedSceneId, selectedAdventureId]);

  // --- Campaign-level handlers ---

  const handleImportCampaign = async (file: File) => {
    try {
      const title = await campaignService.importCampaign(file);
      addToast(`Campaign "${title}" imported successfully!`, 'success');
    } catch (error) {
      console.error('Import failed:', error);
      addToast(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const handleImportPC = (file: File): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (event.target?.result) {
          try {
            const base64 = (event.target.result as string).split(',')[1];
            const newId = await campaignService.createPlayerCharacterFromPdf(base64, isMockMode);
            resolve(newId);
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error('Could not read file.'));
        }
      };
      reader.onerror = () => reject(new Error('Error reading file.'));
      reader.readAsDataURL(file);
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleAddEntityFromChat = (type: string, data: any) => {
    switch (type) {
      case 'npc': { const npcId = campaignService.createNpc(data); handleSelect('npc', npcId); break; }
      case 'location': { const locId = campaignService.createLocation(data); handleSelect('location', locId); break; }
      case 'faction': { const facId = campaignService.createFaction(data); handleSelect('faction', facId); break; }
      case 'item': { const itemId = campaignService.createItem(data); handleSelect('item', itemId); break; }
      case 'article': { const artId = campaignService.createArticle(data); handleSelect('article', artId); break; }
      case 'adventure': { const advId = campaignService.createFullAdventure(data); handleSelect('adventure', advId); break; }
      default: console.warn('Unknown entity type from chat:', type);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleUpdateEntityFromChat = (type: string, id: string, data: any) => {
    switch (type) {
      case 'npc': campaignService.updateNpc(id, data); break;
      case 'location': campaignService.updateLocation(id, data); break;
      case 'faction': campaignService.updateFaction(id, data); break;
      case 'item': campaignService.updateItem(id, data); break;
      case 'article': campaignService.updateArticle(id, data); break;
      case 'adventure': campaignService.updateAdventure(id, data); break;
      default: console.warn('Unknown entity type update from chat:', type);
    }
  };

  const handleGoLive = (sessionLogId: string) => {
    campaignService.goLive(sessionLogId);
    setActiveView('session-runner');
    resetSelections();
  };

  const handleEndSession = () => {
    campaignService.endSession();
    setActiveView('session-logs');
    resetSelections();
  };

  // --- App content switch ---

  const appContent = () => {
    switch (appStatus) {
      case 'welcome':
        return <WelcomeScreen onStart={() => campaignService.prepareNewCampaign()} onImportCampaign={handleImportCampaign} />;
      case 'creating':
        return (
          <CampaignCreator
            onCreateCampaign={campaignService.createCampaign}
            onTemplateSelected={(templateData) => setPendingTemplateData(templateData)}
          />
        );
      case 'selecting':
        return (
          <CrossCampaignDashboard
            campaigns={campaigns}
            activeCampaignId={activeCampaignId}
            onSwitchCampaign={campaignService.selectCampaign}
            onCreateCampaign={() => campaignService.prepareNewCampaign()}
            onDuplicateCampaign={(id) => campaignService.duplicateCampaign(id)}
            onDeleteCampaign={campaignService.deleteCampaign}
          />
        );
      case 'editing':
      case 'loading':
        if (activeCampaign) {
          return (
            <>
              <Header
                activeCampaign={activeCampaign}
                isMockMode={isMockMode}
                onToggleMockMode={() => setIsMockMode(p => !p)}
                onToggleCoach={toggleCoach}
                onToggleWizard={toggleWizard}
                onToggleWorldSim={toggleWorldSim}
                onToggleContinuityChecker={toggleContinuityChecker}
                continuityIssueCount={continuityIssueCount}
                onSaveCampaign={campaignService.saveCampaign}
                onSwitchCampaign={campaignService.switchToCampaignSelector}
                onAllCampaigns={campaignService.switchToCampaignSelector}
                onCreateNew={campaignService.startNewCampaignCreation}
                onImportCampaign={handleImportCampaign}
                onShowExportModal={() => setIsExportModalOpen(true)}
                onToggleSidebar={toggleSidebar}
                onShowShortcutsHelp={toggleShortcutsHelp}
                onOpenCommandPalette={toggleCommandPalette}
                saveStatus={saveStatus}
                lastSavedAt={lastSavedAt}
              />
              <div className="flex-1 flex overflow-hidden relative">
                {/* Mobile Sidebar Overlay */}
                {isSidebarOpen && (
                  <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                  />
                )}

                {/* Sidebar Container */}
                <div className={`
                  fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 transform transition-transform duration-200 ease-in-out flex-shrink-0
                  md:relative md:translate-x-0 md:h-auto md:inset-y-auto
                  ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                `}>
                  <CampaignSidebar
                    campaign={activeCampaign}
                    activeView={activeView}
                    onSelectView={handleSelectView}
                    selectedIds={{
                      adventure: selectedAdventureId,
                      scene: selectedSceneId,
                      npc: selectedNpcId,
                      location: selectedLocationId,
                      faction: selectedFactionId,
                      item: selectedItemId,
                      article: selectedArticleId,
                      sessionLog: selectedSessionLogId,
                      playerCharacter: selectedPlayerCharacterId,
                      plot: selectedPlotId,
                    }}
                    onSelect={handleSelect}
                    recentItems={recentItems}
                    onSelectRecent={(type, id) => handleSelect(type as Parameters<typeof handleSelect>[0], id)}
                    pinnedEntities={activeCampaign?.pinnedEntities}
                    onSelectPinned={(type, id) => handleSelect(type as Parameters<typeof handleSelect>[0], id)}
                    onUnpin={(type, id) => campaignService.unpinEntity(type, id)}
                    onShowGenerator={(type) => {
                      if (type === 'scene') {
                        if (!selectedAdventureId) {
                          addToast('Please select an adventure first to add a scene to it.', 'info');
                          return;
                        }
                      }
                      setActiveGenerator(type);
                    }}
                    onReorderScene={campaignService.reorderScene}
                    onSetDmStyle={campaignService.setDmStyle}
                    onSetFeatureOverride={campaignService.setFeatureOverride}
                    onClearFeatureOverride={campaignService.clearFeatureOverride}
                    expandAllSections={sidebarExpandAll}
                  />
                </div>

                <main className="flex-1 overflow-y-auto bg-slate-900 text-slate-100 relative w-full">
                  {activeView !== 'session-runner' && (
                    <Breadcrumbs
                      segments={breadcrumbSegments}
                      canGoBack={navStack.length > 0}
                      onGoBack={handleGoBack}
                    />
                  )}
                  <ErrorBoundary>
                    <ViewRouter
                      campaign={activeCampaign}
                      activeView={activeView}
                      activeGenerator={activeGenerator}
                      isOfficialSetting={isOfficialSetting}
                      isMockMode={isMockMode}
                      campaignContext={campaignContext}
                      selectedAdventure={selectedAdventure}
                      selectedScene={selectedScene}
                      selectedNpc={selectedNpc}
                      selectedLocation={selectedLocation}
                      selectedFaction={selectedFaction}
                      selectedItem={selectedItem}
                      selectedArticle={selectedArticle}
                      selectedSessionLog={selectedSessionLog}
                      selectedPlayerCharacter={selectedPlayerCharacter}
                      selectedPlot={selectedPlot}
                      onEndSession={handleEndSession}
                      onOpenCoach={() => setIsCoachOpen(true)}
                      onNavigate={handleEntityNavigate}
                      onResetSelections={resetSelections}
                      onSetActiveView={setActiveView}
                      onSetActiveGenerator={setActiveGenerator}
                      onSetSelectedAdventureId={setSelectedAdventureId}
                      onSetSelectedSceneId={setSelectedSceneId}
                      onSetSelectedNpcId={setSelectedNpcId}
                      onSetSelectedLocationId={setSelectedLocationId}
                      onSetSelectedFactionId={setSelectedFactionId}
                      onSetSelectedItemId={setSelectedItemId}
                      onSetSelectedArticleId={setSelectedArticleId}
                      onSetSelectedSessionLogId={setSelectedSessionLogId}
                      onSetSelectedPlayerCharacterId={setSelectedPlayerCharacterId}
                      onSetSelectedPlotId={setSelectedPlotId}
                      onGoLive={handleGoLive}
                      onImportPC={handleImportPC}
                      onAddToast={addToast}
                    />
                  </ErrorBoundary>
                </main>

                {/* Floating Widgets */}
                <RealmChatWidget
                  campaign={activeCampaign}
                  onAddToCampaign={handleAddEntityFromChat}
                  onUpdateCampaign={handleUpdateEntityFromChat}
                  isMockMode={isMockMode}
                  onNavigate={handleEntityNavigate}
                />

                {isFirstCampaignWizardOpen && (
                  <ErrorBoundary>
                    <FirstCampaignWizard
                      worldSetting={activeCampaign.setting || ''}
                      isMockMode={isMockMode}
                      onDismiss={() => {
                        campaignService.dismissWizard();
                        setIsFirstCampaignWizardOpen(false);
                      }}
                      onComplete={(view) => {
                        setIsFirstCampaignWizardOpen(false);
                        setSidebarExpandAll(true);
                        handleSelectView(view);
                      }}
                    />
                  </ErrorBoundary>
                )}

                {isCoachOpen && (
                  <ErrorBoundary>
                    <Suspense fallback={null}>
                      <DmCoach
                        campaign={activeCampaign}
                        activeContext={coachContext}
                        activeSceneNpcIds={activeSceneNpcIds}
                        onClose={() => setIsCoachOpen(false)}
                        onSendToNotes={(content) => campaignService.addAutoEvent('coach-used', content)}
                        onResultGenerated={(content) => campaignService.addAutoEvent('coach-used', content)}
                        isMockMode={isMockMode}
                        onNavigate={handleEntityNavigate}
                      />
                    </Suspense>
                  </ErrorBoundary>
                )}

                {isWizardOpen && (
                  <ErrorBoundary>
                    <Suspense fallback={null}>
                      <EvocationWizard
                        campaign={activeCampaign}
                        onClose={() => setIsWizardOpen(false)}
                        onAddToCampaign={(data) => {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          const count = Object.values(data).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0) as number;
                          campaignService.batchAddToCampaign(data);
                          setIsWizardOpen(false);
                          if (count > 0) {
                            addToast(`${count} entit${count === 1 ? 'y' : 'ies'} added to your campaign!`, 'success');
                          }
                        }}
                        isMockMode={isMockMode}
                      />
                    </Suspense>
                  </ErrorBoundary>
                )}

                {isWorldSimOpen && (
                  <ErrorBoundary>
                    <Suspense fallback={null}>
                      <WorldSimulationWizard
                        campaign={activeCampaign}
                        isMockMode={isMockMode}
                        onClose={() => setIsWorldSimOpen(false)}
                        onApplyEvents={(_events) => { setIsWorldSimOpen(false); }}
                      />
                    </Suspense>
                  </ErrorBoundary>
                )}

                {isExportModalOpen && (
                  <ErrorBoundary>
                    <Suspense fallback={null}>
                      <ExportModal
                        campaignTitle={activeCampaign.title}
                        onClose={() => setIsExportModalOpen(false)}
                        onExportJson={() => exportCampaignAsJson(activeCampaign)}
                        onExportObsidian={() => exportCampaignAsObsidian(activeCampaign)}
                        entityCounts={{
                          npcs: activeCampaign.npcs.length,
                          locations: activeCampaign.locations.length,
                          factions: activeCampaign.factions.length,
                          items: activeCampaign.items.length,
                          adventures: activeCampaign.adventures.length,
                          articles: activeCampaign.articles.length,
                          sessionLogs: (activeCampaign.sessionLogs ?? []).length,
                          plots: (activeCampaign.plots ?? []).length,
                          playerCharacters: (activeCampaign.playerCharacters ?? []).length,
                        } satisfies ExportEntityCounts}
                      />
                    </Suspense>
                  </ErrorBoundary>
                )}

                {isContinuityCheckerOpen && (
                  <ErrorBoundary>
                    <Suspense fallback={null}>
                      <ContinuityChecker
                        campaign={activeCampaign}
                        onNavigate={handleEntityNavigate}
                        onClose={() => setIsContinuityCheckerOpen(false)}
                      />
                    </Suspense>
                  </ErrorBoundary>
                )}

                <ErrorBoundary>
                  <KeyboardShortcutsHelp
                    isOpen={isShortcutsHelpOpen}
                    onClose={() => setIsShortcutsHelpOpen(false)}
                  />
                </ErrorBoundary>

                <CommandPalette
                  isOpen={isCommandPaletteOpen}
                  onClose={() => setIsCommandPaletteOpen(false)}
                  npcs={activeCampaign.npcs}
                  locations={activeCampaign.locations}
                  factions={activeCampaign.factions}
                  items={activeCampaign.items}
                  adventures={activeCampaign.adventures}
                  articles={activeCampaign.articles}
                  sessionLogs={activeCampaign.sessionLogs || []}
                  plots={activeCampaign.plots || []}
                  playerCharacters={activeCampaign.playerCharacters || []}
                  recentItems={recentItems}
                  onSelectNpc={(id) => handleSelect('npc', id)}
                  onSelectLocation={(id) => handleSelect('location', id)}
                  onSelectFaction={(id) => handleSelect('faction', id)}
                  onSelectItem={(id) => handleSelect('item', id)}
                  onSelectAdventure={(id) => handleSelect('adventure', id)}
                  onSelectArticle={(id) => handleSelect('article', id)}
                  onSelectSessionLog={(id) => handleSelect('session-log', id)}
                  onSelectPlot={(id) => handleSelect('plot', id)}
                  onSelectPlayerCharacter={(id) => handleSelect('player-character', id)}
                  onNavigateTo={(view) => { handleSelectView(view as EditorView); }}
                  onOpenCoach={() => setIsCoachOpen(true)}
                />
              </div>
            </>
          );
        }
        return null;
      default:
        return <div>Unhandled App Status</div>;
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
      {appContent()}
    </div>
  );
};

export default App;
