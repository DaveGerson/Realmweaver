

import React, { useState, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Campaign, Adventure, NPC, Location, Faction, Item, Scene, Article, SessionLog, PlayerCharacter } from './types/index';
import { WelcomeScreen } from './components/WelcomeScreen';
import { CampaignCreator } from './components/CampaignCreator';
import { CampaignSelector } from './components/CampaignSelector';
import { Header } from './components/Header';
import { CampaignSidebar } from './components/CampaignSidebar';
import { AdventureEditor } from './components/AdventureEditor';
import { AdventureDashboard } from './components/dashboards/AdventureDashboard';
import { SceneGenerator } from './components/generators/SceneGenerator';
import { NpcEditor } from './components/NpcEditor';
import { LocationEditor } from './components/LocationEditor';
import { FactionEditor } from './components/FactionEditor';
import { ItemEditor } from './components/ItemEditor';
import { SceneEditor } from './components/SceneEditor';
import { ArticleEditor } from './components/ArticleEditor';
import { SessionLogEditor } from './components/SessionLogEditor';
import { PlayerCharacterEditor } from './components/PlayerCharacterEditor';
import { DmCoach } from './components/DmCoach';
import { EvocationWizard } from './components/EvocationWizard';
import { Icons } from './components/Icons';
import { runSmokeTests } from './smokeTest';
import { ExportModal } from './components/ExportModal';
import { exportCampaignAsJson, exportCampaignAsObsidian } from './services/importExportService';
import { NpcDashboard } from './components/dashboards/NpcDashboard';
import { LocationDashboard } from './components/dashboards/LocationDashboard';
import { FactionDashboard } from './components/dashboards/FactionDashboard';
import { ItemDashboard } from './components/dashboards/ItemDashboard';
import { ArticleDashboard } from './components/dashboards/ArticleDashboard';
import { SessionLogDashboard } from './components/dashboards/SessionLogDashboard';
import { PlayerCharacterDashboard } from './components/dashboards/PlayerCharacterDashboard';
import { campaignService } from './services/campaignService';


export type EditorView = 'setting' | 'npcs' | 'locations' | 'factions' | 'items' | 'adventures' | 'lorebook' | 'session-logs' | 'player-characters';
export type GeneratorType = 'npc' | 'location' | 'faction' | 'item' | 'scene' | 'article';

const App: React.FC = () => {
  const { campaigns, activeCampaignId, appStatus } = useSyncExternalStore(
    campaignService.subscribe,
    campaignService.getState
  );
  
  const [isMockMode, setIsMockMode] = useState(true);
  
  // UI-specific state that remains in the component
  const [activeView, setActiveView] = useState<EditorView>('setting');
  const [activeGenerator, setActiveGenerator] = useState<GeneratorType | null>(null);

  const [selectedAdventureId, setSelectedAdventureId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedFactionId, setSelectedFactionId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [selectedSessionLogId, setSelectedSessionLogId] = useState<string | null>(null);
  const [selectedPlayerCharacterId, setSelectedPlayerCharacterId] = useState<string | null>(null);
  
  const [isCoachOpen, setIsCoachOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);


  useEffect(() => {
    runSmokeTests(isMockMode);
  }, [isMockMode]);

  const activeCampaign = useMemo(() => campaigns.find(c => c.id === activeCampaignId), [campaigns, activeCampaignId]);

  const resetSelections = () => {
    setSelectedNpcId(null);
    setSelectedLocationId(null);
    setSelectedFactionId(null);
    setSelectedItemId(null);
    setSelectedAdventureId(null);
    setSelectedSceneId(null);
    setSelectedArticleId(null);
    setSelectedSessionLogId(null);
    setSelectedPlayerCharacterId(null);
    setActiveGenerator(null);
  };

  const handleImportCampaign = async (file: File) => {
      try {
          const title = await campaignService.importCampaign(file);
          alert(`Campaign "${title}" imported successfully!`);
      } catch (error) {
          console.error("Import failed:", error);
          alert(`Import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
  };

  const handleImportPC = async (file: File) => {
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
                reject(new Error("Could not read file."));
            }
        };
        reader.onerror = () => reject(new Error("Error reading file."));
        reader.readAsDataURL(file);
    });
};

  // --- Memos for selected items ---
  const selectedAdventure = useMemo(() => activeCampaign?.adventures.find(a => a.id === selectedAdventureId) || null, [activeCampaign, selectedAdventureId]);
  const selectedScene = useMemo(() => selectedAdventure?.scenes.find(s => s.id === selectedSceneId) || null, [selectedAdventure, selectedSceneId]);
  const selectedNpc = useMemo(() => activeCampaign?.npcs.find(n => n.id === selectedNpcId) || null, [activeCampaign, selectedNpcId]);
  const selectedLocation = useMemo(() => activeCampaign?.locations.find(l => l.id === selectedLocationId) || null, [activeCampaign, selectedLocationId]);
  const selectedFaction = useMemo(() => activeCampaign?.factions.find(f => f.id === selectedFactionId) || null, [activeCampaign, selectedFactionId]);
  const selectedItem = useMemo(() => activeCampaign?.items.find(i => i.id === selectedItemId) || null, [activeCampaign, selectedItemId]);
  const selectedArticle = useMemo(() => activeCampaign?.articles.find(a => a.id === selectedArticleId) || null, [activeCampaign, selectedArticleId]);
  const selectedSessionLog = useMemo(() => activeCampaign?.sessionLogs?.find(s => s.id === selectedSessionLogId) || null, [activeCampaign, selectedSessionLogId]);
  const selectedPlayerCharacter = useMemo(() => activeCampaign?.playerCharacters?.find(p => p.id === selectedPlayerCharacterId) || null, [activeCampaign, selectedPlayerCharacterId]);

  
  const handleSelectView = (view: EditorView) => {
    setActiveView(view);
    resetSelections();
  };
  
  const renderMainContent = () => {
      if (!activeCampaign) return null;

      // Render Generators
      if (activeGenerator === 'scene' && selectedAdventure) return <ContentWrapper title="Create New Scene"><SceneGenerator onSceneCreated={(s) => campaignService.createScene(selectedAdventure.id, s)} isMockMode={isMockMode} /></ContentWrapper>;

      // Render Editors & Dashboards - Editors take priority if an item is selected
      if (selectedPlayerCharacter) return <PlayerCharacterEditor pc={selectedPlayerCharacter} onUpdate={campaignService.updatePlayerCharacter} onDelete={campaignService.deletePlayerCharacter} />;
      if (selectedSessionLog) return <SessionLogEditor log={selectedSessionLog} onUpdate={campaignService.updateSessionLog} onDelete={campaignService.deleteSessionLog} />;
      if (selectedScene && selectedAdventure) return <SceneEditor scene={selectedScene} allNpcs={activeCampaign.npcs} allLocations={activeCampaign.locations} onUpdate={(id, data) => campaignService.updateScene(selectedAdventure.id, id, data)} onDelete={(id) => campaignService.deleteScene(selectedAdventure.id, id)} isMockMode={isMockMode} />;
      if (selectedAdventure) return <AdventureEditor adventure={selectedAdventure} campaign={activeCampaign} onUpdate={campaignService.updateAdventure} />;
      if (selectedArticle) return <ArticleEditor article={selectedArticle} allArticles={activeCampaign.articles} onUpdate={campaignService.updateArticle} onDelete={campaignService.deleteArticle} isMockMode={isMockMode} />;
      if (selectedNpc) return <NpcEditor npc={selectedNpc} factions={activeCampaign.factions} onUpdate={campaignService.updateNpc} onDelete={campaignService.deleteNpc} isMockMode={isMockMode} />;
      if (selectedLocation) return <LocationEditor location={selectedLocation} allLocations={activeCampaign.locations} onUpdate={campaignService.updateLocation} onDelete={campaignService.deleteLocation} isMockMode={isMockMode} />;
      if (selectedFaction) return <FactionEditor faction={selectedFaction} allNpcs={activeCampaign.npcs} onUpdate={campaignService.updateFaction} onDelete={campaignService.deleteFaction} isMockMode={isMockMode} />;
      if (selectedItem) return <ItemEditor item={selectedItem} onUpdate={campaignService.updateItem} onDelete={campaignService.deleteItem} isMockMode={isMockMode} />;

      // If no specific item is selected, show the corresponding dashboard
      if (activeView === 'adventures') {
        return <AdventureDashboard 
                    adventures={activeCampaign.adventures} 
                    onAdventureCreated={(advData) => {
                        const newId = campaignService.createFullAdventure(advData);
                        setSelectedAdventureId(newId);
                        setActiveGenerator(null);
                    }}
                    onSelectAdventure={(id) => {
                        resetSelections();
                        setActiveView('adventures');
                        setSelectedAdventureId(id);
                    }}
                    isMockMode={isMockMode}
                />;
      }
      if (activeView === 'player-characters') return <PlayerCharacterDashboard 
          playerCharacters={activeCampaign.playerCharacters || []}
          onImport={async (file) => {
            try {
                const newId = await handleImportPC(file);
                resetSelections();
                setActiveView('player-characters');
                setSelectedPlayerCharacterId(newId);
            } catch (error) {
                console.error("PC Import failed:", error);
                alert(`Failed to import character sheet: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
          }}
          onSelectPlayerCharacter={(id) => {
            resetSelections();
            setActiveView('player-characters');
            setSelectedPlayerCharacterId(id);
          }}
          isMockMode={isMockMode}
        />;
      if (activeView === 'session-logs') return <SessionLogDashboard sessionLogs={activeCampaign.sessionLogs || []} onSessionLogCreated={(logData) => {
            const newId = campaignService.createSessionLog(logData);
            setActiveView('session-logs');
            setSelectedSessionLogId(newId);
        }} onSelectSessionLog={setSelectedSessionLogId} />;
      if (activeView === 'npcs') return <NpcDashboard npcs={activeCampaign.npcs} onNpcCreated={(npcData) => {
            const newId = campaignService.createNpc(npcData);
            setActiveGenerator(null);
            setSelectedNpcId(newId);
        }} onSelectNpc={setSelectedNpcId} isMockMode={isMockMode} />;
      if (activeView === 'locations') return <LocationDashboard locations={activeCampaign.locations} onLocationCreated={(locData) => {
            const newId = campaignService.createLocation(locData);
            setActiveGenerator(null);
            setSelectedLocationId(newId);
        }} onSelectLocation={setSelectedLocationId} isMockMode={isMockMode} />;
      if (activeView === 'factions') return <FactionDashboard factions={activeCampaign.factions} onFactionCreated={(facData) => {
            const newId = campaignService.createFaction(facData);
            setActiveGenerator(null);
            setSelectedFactionId(newId);
        }} onSelectFaction={setSelectedFactionId} isMockMode={isMockMode} />;
      if (activeView === 'items') return <ItemDashboard items={activeCampaign.items} onItemCreated={(itemData) => {
            const newId = campaignService.createItem(itemData);
            setActiveGenerator(null);
            setSelectedItemId(newId);
        }} onSelectItem={setSelectedItemId} isMockMode={isMockMode} />;
      if (activeView === 'lorebook') return <ArticleDashboard articles={activeCampaign.articles} onArticleCreated={(articleData) => {
            const newId = campaignService.createArticle(articleData);
            setActiveGenerator(null);
            setSelectedArticleId(newId);
        }} onSelectArticle={setSelectedArticleId} isMockMode={isMockMode} />;

      // Render Top-Level Setting View
      if (activeView === 'setting') return <CampaignSettingEditor campaign={activeCampaign} onUpdate={campaignService.updateCampaign} />;

      // Fallback
      return <EditorPlaceholder icon="Campaign" text="Select an item from the sidebar to get started." />;
  };

  const renderApp = () => {
    switch(appStatus) {
      case 'loading':
        return null;
      case 'welcome':
        return <WelcomeScreen onStart={campaignService.startNewCampaignCreation} />;
      case 'selecting':
        return <CampaignSelector campaigns={campaigns} onSelect={campaignService.selectCampaign} onDelete={campaignService.deleteCampaign} onCreateNew={campaignService.startNewCampaignCreation} />;
      case 'creating':
        return <CampaignCreator onCreateCampaign={(title, setting) => {
            campaignService.createCampaign(title, setting);
            setActiveView('setting');
        }} />;
      case 'editing':
        if (activeCampaign) {
          return (
            <div className="flex-1 flex overflow-hidden">
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
                }}
                onSelect={(type, id) => {
                  resetSelections();
                  if (type === 'scene' || type === 'adventure') {
                    setActiveView('adventures');
                  } else if (type === 'article') {
                    setActiveView('lorebook');
                  } else if (type === 'session-log') {
                    setActiveView('session-logs');
                  } else if (type === 'player-character') {
                    setActiveView('player-characters');
                  }
                   else {
                    setActiveView((type + 's') as EditorView);
                  }

                  switch (type) {
                    case 'adventure': setSelectedAdventureId(id); break;
                    case 'scene': setSelectedSceneId(id); break;
                    case 'npc': setSelectedNpcId(id); break;
                    case 'location': setSelectedLocationId(id); break;
                    case 'faction': setSelectedFactionId(id); break;
                    case 'item': setSelectedItemId(id); break;
                    case 'article': setSelectedArticleId(id); break;
                    case 'session-log': setSelectedSessionLogId(id); break;
                    case 'player-character': setSelectedPlayerCharacterId(id); break;
                  }
                }}
                onShowGenerator={(type) => { resetSelections(); setActiveGenerator(type); }}
                onReorderScene={campaignService.reorderScene}
              />
              <main className="flex-1 overflow-hidden">
                {renderMainContent()}
              </main>
            </div>
          );
        }
        return <CampaignSelector campaigns={campaigns} onSelect={campaignService.selectCampaign} onDelete={campaignService.deleteCampaign} onCreateNew={campaignService.startNewCampaignCreation} />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 flex flex-col font-sans">
        {appStatus === 'editing' && activeCampaign && (
            <Header
                activeCampaign={activeCampaign}
                isMockMode={isMockMode}
                onToggleMockMode={() => setIsMockMode(p => !p)}
                onToggleCoach={() => setIsCoachOpen(p => !p)}
                onToggleWizard={() => setIsWizardOpen(p => !p)}
                onSaveCampaign={campaignService.saveCampaign}
                onSwitchCampaign={campaignService.switchToCampaignSelector}
                onCreateNew={campaignService.prepareNewCampaign}
                onImportCampaign={handleImportCampaign}
                onShowExportModal={() => setIsExportModalOpen(true)}
            />
        )}
        {renderApp()}
        {isCoachOpen && activeCampaign && (
            <DmCoach campaign={activeCampaign} onClose={() => setIsCoachOpen(false)} isMockMode={isMockMode} />
        )}
         {isWizardOpen && activeCampaign && (
            <EvocationWizard campaign={activeCampaign} onClose={() => setIsWizardOpen(false)} onAddToCampaign={(data) => {
                campaignService.batchAddToCampaign(data);
                setIsWizardOpen(false);
            }} isMockMode={isMockMode} />
        )}
         {isExportModalOpen && activeCampaign && (
            <ExportModal 
                campaignTitle={activeCampaign.title}
                onClose={() => setIsExportModalOpen(false)}
                onExportJson={() => { exportCampaignAsJson(activeCampaign); setIsExportModalOpen(false); }}
                onExportObsidian={() => { exportCampaignAsObsidian(activeCampaign); setIsExportModalOpen(false); }}
            />
        )}
    </div>
  );
};

// --- Helper Components ---
const CampaignSettingEditor = ({ campaign, onUpdate }: { campaign: Campaign, onUpdate: (data: Partial<Campaign>) => void }) => {
    const [setting, setSetting] = useState(campaign.setting);
    
    // Ensure local state updates if the underlying campaign object changes
    useEffect(() => {
        setSetting(campaign.setting);
    }, [campaign.setting]);

    return (
        <div className="p-8 h-full overflow-y-auto custom-scrollbar">
            <h1 className="text-3xl font-bold font-serif mb-2 text-slate-100">Campaign Setting</h1>
            <p className="text-slate-400 mb-6">This is the high-level overview of your world. It will be used as context for all future AI generations.</p>
            <textarea
                value={setting}
                onChange={e => setSetting(e.target.value)}
                onBlur={() => onUpdate({ setting })}
                rows={20}
                className="w-full bg-slate-900 border border-slate-700 rounded-md p-4 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all resize-y"
                placeholder="Describe your world's history, major conflicts, key themes, and current state..."
            />
        </div>
    );
};

const ContentWrapper = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div className="p-8 h-full overflow-y-auto custom-scrollbar">
    <h1 className="text-3xl font-bold font-serif mb-6 text-slate-100">{title}</h1>
    <div className="max-w-2xl mx-auto">{children}</div>
  </div>
);

const EditorPlaceholder = ({ icon, text }: { icon: keyof typeof Icons, text: string }) => {
    const Icon = Icons[icon];
    return (
        <div className="flex flex-col items-center justify-center h-full text-slate-600">
            <Icon className="w-24 h-24 mb-4" />
            <p className="text-lg">{text}</p>
        </div>
    );
};

export default App;
