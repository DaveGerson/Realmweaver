
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
      if (activeGenerator === 'scene' && selectedAdventure) return <ContentWrapper title="Create New Scene" icon="Scenes"><SceneGenerator onSceneCreated={(s) => campaignService.createScene(selectedAdventure.id, s)} isMockMode={isMockMode} /></ContentWrapper>;

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
            setActiveView('npcs');
            setSelectedNpcId(newId);
        }} onSelectNpc={setSelectedNpcId} isMockMode={isMockMode} />;
      if (activeView === 'locations') return <LocationDashboard locations={activeCampaign.locations} onLocationCreated={(locData) => {
            const newId = campaignService.createLocation(locData);
            setActiveView('locations');
            setSelectedLocationId(newId);
        }} onSelectLocation={setSelectedLocationId} isMockMode={isMockMode} />;
      if (activeView === 'factions') return <FactionDashboard factions={activeCampaign.factions} onFactionCreated={(facData) => {
            const newId = campaignService.createFaction(facData);
            setActiveView('factions');
            setSelectedFactionId(newId);
        }} onSelectFaction={setSelectedFactionId} isMockMode={isMockMode} />;
      if (activeView === 'items') return <ItemDashboard items={activeCampaign.items} onItemCreated={(itemData) => {
            const newId = campaignService.createItem(itemData);
            setActiveView('items');
            setSelectedItemId(newId);
        }} onSelectItem={setSelectedItemId} isMockMode={isMockMode} />;
      if (activeView === 'lorebook') return <ArticleDashboard articles={activeCampaign.articles} onArticleCreated={(artData) => {
            const newId = campaignService.createArticle(artData);
            setActiveView('lorebook');
            setSelectedArticleId(newId);
        }} onSelectArticle={setSelectedArticleId} isMockMode={isMockMode} />;

      // Fallback to Campaign Setting Editor
      if (activeView === 'setting') {
          return (
              <ContentWrapper title="Campaign Setting" icon="Setting">
                  <CampaignSettingEditor campaign={activeCampaign} onUpdate={campaignService.updateCampaign} />
              </ContentWrapper>
          );
      }

      return null;
  };

  const appContent = () => {
    switch (appStatus) {
      case 'welcome':
        return <WelcomeScreen onStart={() => campaignService.prepareNewCampaign()} />;
      case 'creating':
        return <CampaignCreator onCreateCampaign={campaignService.createCampaign} />;
      case 'selecting':
        return <CampaignSelector campaigns={campaigns} onSelect={campaignService.selectCampaign} onDelete={campaignService.deleteCampaign} onCreateNew={() => campaignService.prepareNewCampaign()} />;
      case 'editing':
      case 'loading':
        if (activeCampaign) {
          return (
            <>
              <Header 
                activeCampaign={activeCampaign}
                isMockMode={isMockMode}
                onToggleMockMode={() => setIsMockMode(p => !p)}
                onToggleCoach={() => setIsCoachOpen(p => !p)}
                onToggleWizard={() => setIsWizardOpen(p => !p)}
                onSaveCampaign={campaignService.saveCampaign}
                onSwitchCampaign={campaignService.switchToCampaignSelector}
                onCreateNew={campaignService.startNewCampaignCreation}
                onImportCampaign={handleImportCampaign}
                onShowExportModal={() => setIsExportModalOpen(true)}
              />
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
                      switch(type) {
                          case 'adventure': setActiveView('adventures'); setSelectedAdventureId(id); break;
                          case 'scene': setSelectedSceneId(id); break;
                          case 'npc': setActiveView('npcs'); setSelectedNpcId(id); break;
                          case 'location': setActiveView('locations'); setSelectedLocationId(id); break;
                          case 'faction': setActiveView('factions'); setSelectedFactionId(id); break;
                          case 'item': setActiveView('items'); setSelectedItemId(id); break;
                          case 'article': setActiveView('lorebook'); setSelectedArticleId(id); break;
                          case 'session-log': setActiveView('session-logs'); setSelectedSessionLogId(id); break;
                          case 'player-character': setActiveView('player-characters'); setSelectedPlayerCharacterId(id); break;
                      }
                  }}
                  onShowGenerator={(type) => {
                    if (type === 'scene') {
                      if (!selectedAdventureId) {
                        alert("Please select an adventure first to add a scene to it.");
                        return;
                      }
                    }
                    setActiveGenerator(type);
                  }}
                  onReorderScene={campaignService.reorderScene}
                />
                <main className="flex-1 overflow-y-auto bg-slate-950 text-slate-100">
                  {renderMainContent()}
                </main>
                {isCoachOpen && <DmCoach campaign={activeCampaign} onClose={() => setIsCoachOpen(false)} isMockMode={isMockMode} />}
                {isWizardOpen && <EvocationWizard campaign={activeCampaign} onClose={() => setIsWizardOpen(false)} onAddToCampaign={campaignService.batchAddToCampaign} isMockMode={isMockMode}/>}
                {isExportModalOpen && <ExportModal 
                  campaignTitle={activeCampaign.title}
                  onClose={() => setIsExportModalOpen(false)} 
                  onExportJson={() => { exportCampaignAsJson(activeCampaign); setIsExportModalOpen(false); }}
                  onExportObsidian={() => { exportCampaignAsObsidian(activeCampaign); setIsExportModalOpen(false); }}
                />}
              </div>
            </>
          );
        }
        return null; // or a loading spinner
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


// A local wrapper component for consistent page layouts in simple generator/editor views
const ContentWrapper: React.FC<{ title: string; children: React.ReactNode, icon?: keyof typeof Icons }> = ({ title, children, icon }) => {
    const Icon = icon ? Icons[icon] : null;
    return (
        <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
            <div className="flex items-center gap-3 text-indigo-400">
                {Icon && <Icon className="w-8 h-8" />}
                <h1 className="text-3xl font-bold font-serif text-slate-100">{title}</h1>
            </div>
            {children}
        </div>
    );
};

// Local component for editing the top-level campaign settings.
const CampaignSettingEditor: React.FC<{campaign: Campaign, onUpdate: (data: Partial<Campaign>) => void}> = ({ campaign, onUpdate }) => {
  const [formData, setFormData] = useState({ title: campaign.title, setting: campaign.setting });

  useEffect(() => {
    setFormData({ title: campaign.title, setting: campaign.setting });
  }, [campaign]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBlur = () => {
    if (formData.title !== campaign.title || formData.setting !== campaign.setting) {
      onUpdate(formData);
    }
  };

  return (
    <div className="space-y-6 bg-slate-900/50 p-6 rounded-xl border border-slate-800/50 max-w-2xl">
        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Campaign Title</label>
            <input type="text" name="title" value={formData.title} onChange={handleChange} onBlur={handleBlur} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"/>
        </div>
        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">World Setting Synopsis</label>
            <textarea name="setting" value={formData.setting} onChange={handleChange} onBlur={handleBlur} rows={12} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600 resize-y" placeholder="A high-level description of the world, its history, and its current state..." />
        </div>
    </div>
  )
};

export default App;
