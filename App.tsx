
import React, { FC, useState, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Adventure, Scene } from './types/index';
import { WelcomeScreen } from './components/views/WelcomeScreen';
import { CampaignCreator } from './components/views/CampaignCreator';
import { CampaignSelector } from './components/views/CampaignSelector';
import { Header } from './components/layout/Header';
import { CampaignSidebar } from './components/layout/CampaignSidebar';
import { AdventureEditor } from './components/editors/AdventureEditor';
import { AdventureDashboard } from './components/dashboards/AdventureDashboard';
import { SceneGenerator } from './components/generators/SceneGenerator';
import { NpcEditor } from './components/editors/NpcEditor';
import { LocationEditor } from './components/editors/LocationEditor';
import { FactionEditor } from './components/editors/FactionEditor';
import { ItemEditor } from './components/editors/ItemEditor';
import { SceneEditor } from './components/editors/SceneEditor';
import { ArticleEditor } from './components/editors/ArticleEditor';
import { SessionLogEditor } from './components/editors/SessionLogEditor';
import { PlayerCharacterEditor } from './components/editors/PlayerCharacterEditor';
import { PlotEditor } from './components/editors/PlotEditor';
import { CampaignSettingEditor } from './components/editors/CampaignSettingEditor';
import { CombatTracker } from './components/tools/CombatTracker';
import { RelationshipGraph } from './components/visualizers/RelationshipGraph';
import { ContentWrapper } from './components/layout/ContentWrapper';
import { DmCoach } from './components/dialogs/DmCoach';
import { EvocationWizard } from './components/dialogs/EvocationWizard';
import { runSmokeTests } from './smokeTest';
import { ExportModal } from './components/dialogs/ExportModal';
import { exportCampaignAsJson, exportCampaignAsObsidian } from './services/importExportService';
import { NpcDashboard } from './components/dashboards/NpcDashboard';
import { LocationDashboard } from './components/dashboards/LocationDashboard';
import { FactionDashboard } from './components/dashboards/FactionDashboard';
import { ItemDashboard } from './components/dashboards/ItemDashboard';
import { ArticleDashboard } from './components/dashboards/ArticleDashboard';
import { SessionLogDashboard } from './components/dashboards/SessionLogDashboard';
import { PlayerCharacterDashboard } from './components/dashboards/PlayerCharacterDashboard';
import { PlotDashboard } from './components/dashboards/PlotDashboard';
import { campaignService } from './services/campaignService';
import { RealmChatWidget } from './components/RealmChat/RealmChatWidget';
import { SessionRunner } from './components/views/SessionRunner';
import { buildCampaignContext } from './utils/entityUtils';


export type EditorView = 'setting' | 'npcs' | 'locations' | 'factions' | 'items' | 'adventures' | 'lorebook' | 'session-logs' | 'player-characters' | 'plots' | 'combat' | 'relationships' | 'session-runner';
export type GeneratorType = 'npc' | 'location' | 'faction' | 'item' | 'scene' | 'article';

const App: FC = () => {
  const { campaigns, activeCampaignId, appStatus, saveStatus, lastSavedAt } = useSyncExternalStore(
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
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  
  const [isCoachOpen, setIsCoachOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);


  useEffect(() => {
    runSmokeTests(isMockMode).catch(err => console.error('Smoke tests failed:', err));
  }, [isMockMode]);

  const activeCampaign = useMemo(() => campaigns.find(c => c.id === activeCampaignId), [campaigns, activeCampaignId]);
  const isOfficialSetting = activeCampaign?.settingType === 'official';
  const campaignContext = useMemo(() => activeCampaign ? buildCampaignContext(activeCampaign) : undefined, [activeCampaign]);

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
    setSelectedPlotId(null);
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

    // Generic handler for RealmChat additions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleAddEntityFromChat = (type: string, data: any) => {
        switch (type) {
            case 'npc': 
                const npcId = campaignService.createNpc(data);
                handleSelect('npc', npcId);
                break;
            case 'location': 
                const locId = campaignService.createLocation(data);
                handleSelect('location', locId);
                break;
            case 'faction': 
                const facId = campaignService.createFaction(data);
                handleSelect('faction', facId);
                break;
            case 'item': 
                const itemId = campaignService.createItem(data);
                handleSelect('item', itemId);
                break;
            case 'article': 
                const artId = campaignService.createArticle(data);
                handleSelect('article', artId);
                break;
            case 'adventure':
                const advId = campaignService.createFullAdventure(data);
                handleSelect('adventure', advId);
                break;
            default:
                console.warn("Unknown entity type from chat:", type);
        }
    };

    // Generic handler for RealmChat updates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleUpdateEntityFromChat = (type: string, id: string, data: any) => {
        switch (type) {
            case 'npc': 
                campaignService.updateNpc(id, data);
                break;
            case 'location': 
                campaignService.updateLocation(id, data);
                break;
            case 'faction': 
                campaignService.updateFaction(id, data);
                break;
            case 'item': 
                campaignService.updateItem(id, data);
                break;
            case 'article': 
                campaignService.updateArticle(id, data);
                break;
            case 'adventure':
                campaignService.updateAdventure(id, data);
                break;
            default:
                console.warn("Unknown entity type update from chat:", type);
        }
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
  const selectedPlot = useMemo(() => activeCampaign?.plots?.find(n => n.id === selectedPlotId) || null, [activeCampaign, selectedPlotId]);
  
  // --- Context Construction for Session Weaver ---
  const currentContext = useMemo(() => {
      if (!activeCampaign) return '';
      let context = `Campaign: ${activeCampaign.title}\n`;
      
      // 1. Setting Context
      if (activeCampaign.settingType === 'official' && activeCampaign.officialSetting) {
          context += `Official Setting: ${activeCampaign.officialSetting}.\n`;
          if (activeCampaign.setting) {
            context += `Supplemental Lore: ${activeCampaign.setting}\n\n`;
          }
      } else {
          context += `Setting: ${activeCampaign.setting}\n\n`;
      }

      // 2. ACTIVE SESSION CONTEXT (Priority High)
      const activeSession = activeCampaign.sessionLogs?.find(s => s.status === 'active');
      if (activeSession) {
          context += `--- ACTIVE SESSION IN PROGRESS: "${activeSession.title}" ---\n`;
          if (activeSession.prepNotes) context += `DM Prep Notes: ${activeSession.prepNotes}\n`;
          if (activeSession.runningNotes) context += `Current Session Notes: ${activeSession.runningNotes}\n`;
          
          // Inject Active Adventure Context
          if (activeSession.adventureId) {
              const adv = activeCampaign.adventures.find(a => a.id === activeSession.adventureId);
              if (adv) {
                  context += `Current Adventure: "${adv.title}" (Theme: ${adv.theme})\n`;
                  if (adv.hook) context += `Adventure Hook: ${adv.hook}\n`;
              }
          }
          
          // Find previously completed session for continuity
          const pastSessions = activeCampaign.sessionLogs
            .filter(s => s.status === 'completed')
            .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
          
          if (pastSessions.length > 0) {
              context += `PREVIOUS SESSION RECAP (${pastSessions[0].title}): ${pastSessions[0].recap}\n`;
              if (pastSessions[0].looseEnds) context += `UNRESOLVED THREADS: ${pastSessions[0].looseEnds}\n`;
          }
          
          context += `\n`;
      }

      // 3. Helper to append related lore to context
      const appendRelatedLore = (entityId: string) => {
          const relatedArticles = activeCampaign.articles.filter(a => a.relatedEntityIds?.includes(entityId));
          if (relatedArticles.length > 0) {
              context += `\nRELEVANT LORE:\n`;
              relatedArticles.forEach(article => {
                  context += `- ${article.title} (${article.category}): ${article.content.substring(0, 300)}${article.content.length > 300 ? '...' : ''}\n`;
              });
              context += `\n`;
          }
      };

      // 4. ACTIVE SCENE STATE (Manual Scene Selection Override)
      if (activeCampaign.activeSceneId) {
         let activeScene: Scene | undefined;
         let activeAdventure: Adventure | undefined;
         // Find scene and adventure
         for (const adv of activeCampaign.adventures) {
             const s = adv.scenes.find(s => s.id === activeCampaign.activeSceneId);
             if (s) {
                 activeScene = s;
                 activeAdventure = adv;
                 break;
             }
         }
         
         if (activeScene && activeAdventure) {
             context += `--- CURRENT SCENE ---\n`;
             context += `Scene: "${activeScene.title}" (Adventure: "${activeAdventure.title}")\n`;
             context += `Type: ${activeScene.type}\n`;
             if (activeScene.readAloudText) context += `Description: "${activeScene.readAloudText}"\n`;
             if (activeScene.gmNotes) context += `GM Notes: ${activeScene.gmNotes}\n`;
             
             // Active Location Context
             if (activeScene.locationId) {
                 const loc = activeCampaign.locations.find(l => l.id === activeScene.locationId);
                 if (loc) {
                     context += `Current Location: ${loc.name}. ${loc.description}\n`;
                     appendRelatedLore(loc.id);
                 }
             }
             
             // Active NPCs Context
             if (activeScene.npcIds.length > 0) {
                 const npcs = activeCampaign.npcs.filter(n => activeScene!.npcIds.includes(n.id));
                 context += `NPCs Present: ${npcs.map(n => `${n.name} (${n.traits})`).join('; ')}\n`;
                 npcs.forEach(n => appendRelatedLore(n.id));
             }
             context += `\n`;
         }
      }

      // 5. CURRENT USER FOCUS (Editor Selection)
      // If the user is viewing something *different* than the active scene, give context on that too.
      let selectionContext = '';
      if (selectedScene && selectedAdventure && selectedScene.id !== activeCampaign.activeSceneId) {
          selectionContext += `USER IS VIEWING SCENE: "${selectedScene.title}" (Adventure: ${selectedAdventure.title})\n`;
          if (selectedScene.gmNotes) selectionContext += `Notes: ${selectedScene.gmNotes}\n`;
      } else if (selectedLocation) {
          selectionContext += `USER IS VIEWING LOCATION: "${selectedLocation.name}"\n`;
          if (selectedLocation.description) selectionContext += `Desc: ${selectedLocation.description}\n`;
      } else if (selectedNpc) {
          selectionContext += `USER IS VIEWING NPC: "${selectedNpc.name}"\n`;
          if (selectedNpc.traits) selectionContext += `Traits: ${selectedNpc.traits}\n`;
      }

      if (selectionContext) {
          context += `--- CURRENT USER FOCUS ---\n${selectionContext}`;
      }

      return context;
  }, [activeCampaign, activeCampaign?.activeSceneId, activeCampaign?.sessionLogs, selectedScene, selectedAdventure, selectedLocation, selectedNpc, selectedFaction]);


  const handleSelectView = (view: EditorView) => {
    setActiveView(view);
    resetSelections();
    setIsSidebarOpen(false);
  };
  
    const handleSelect = (type: 'adventure' | 'scene' | 'npc' | 'location' | 'faction' | 'item' | 'article' | 'session-log' | 'player-character' | 'plot', id: string) => {
        if (type === 'scene') {
            const parentAdventure = activeCampaign?.adventures.find(adv => adv.scenes.some(s => s.id === id));
            if (parentAdventure) {
                setActiveView('adventures');
                setSelectedAdventureId(parentAdventure.id);
                setSelectedSceneId(id);
            }
        } else {
            resetSelections();
            switch(type) {
                case 'adventure': setActiveView('adventures'); setSelectedAdventureId(id); break;
                case 'npc': setActiveView('npcs'); setSelectedNpcId(id); break;
                case 'location': setActiveView('locations'); setSelectedLocationId(id); break;
                case 'faction': setActiveView('factions'); setSelectedFactionId(id); break;
                case 'item': setActiveView('items'); setSelectedItemId(id); break;
                case 'article': setActiveView('lorebook'); setSelectedArticleId(id); break;
                case 'session-log': setActiveView('session-logs'); setSelectedSessionLogId(id); break;
                case 'player-character': setActiveView('player-characters'); setSelectedPlayerCharacterId(id); break;
                case 'plot': setActiveView('plots'); setSelectedPlotId(id); break;
            }
        }
        setIsSidebarOpen(false);
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

  const renderMainContent = () => {
      if (!activeCampaign) return null;

      // Session Runner takes priority when active
      if (activeView === 'session-runner' && activeCampaign.activeSessionId) {
          const activeSessionLog = activeCampaign.sessionLogs?.find(s => s.id === activeCampaign.activeSessionId);
          if (activeSessionLog) {
              return (
                  <SessionRunner
                      campaign={activeCampaign}
                      sessionLog={activeSessionLog}
                      isMockMode={isMockMode}
                      onEndSession={handleEndSession}
                      onOpenCoach={() => setIsCoachOpen(true)}
                  />
              );
          }
      }

      // Render Generators
      if (activeGenerator === 'scene' && selectedAdventure) return <ContentWrapper title="Create New Scene" icon="Scenes"><SceneGenerator onSceneCreated={(s) => campaignService.createScene(selectedAdventure.id, s)} isMockMode={isMockMode} isOfficialSetting={isOfficialSetting} campaignContext={campaignContext} /></ContentWrapper>;

      // Render Editors & Dashboards - Editors take priority if an item is selected
      if (selectedPlayerCharacter) return <PlayerCharacterEditor pc={selectedPlayerCharacter} onUpdate={campaignService.updatePlayerCharacter} onDelete={(id) => { campaignService.deletePlayerCharacter(id); resetSelections(); }} />;
      
      if (selectedSessionLog) return (
        <SessionLogEditor
            log={selectedSessionLog}
            onUpdate={campaignService.updateSessionLog}
            onDelete={(id) => { campaignService.deleteSessionLog(id); resetSelections(); }}
            isMockMode={isMockMode}
            onGoLive={handleGoLive}
        />
      );
      
      if (selectedPlot) return <PlotEditor plot={selectedPlot} onUpdate={campaignService.updatePlot} onDelete={(id) => { campaignService.deletePlot(id); resetSelections(); }} isMockMode={isMockMode} />;
      if (selectedScene && selectedAdventure) return <SceneEditor scene={selectedScene} allNpcs={activeCampaign.npcs} allLocations={activeCampaign.locations} onUpdate={(id, data) => campaignService.updateScene(selectedAdventure.id, id, data)} onDelete={(id) => { campaignService.deleteScene(selectedAdventure.id, id); setSelectedSceneId(null); }} isMockMode={isMockMode} isActiveScene={activeCampaign.activeSceneId === selectedScene.id} onSetActive={campaignService.setActiveScene} />;
      if (selectedAdventure) return <AdventureEditor adventure={selectedAdventure} campaign={activeCampaign} onUpdate={campaignService.updateAdventure} />;
      
      if (selectedArticle) return (
        <ArticleEditor 
            article={selectedArticle} 
            allArticles={activeCampaign.articles} 
            onUpdate={campaignService.updateArticle} 
            onDelete={(id) => { campaignService.deleteArticle(id); resetSelections(); }} 
            isMockMode={isMockMode} 
        />
      );
      
      if (selectedNpc) return (
        <NpcEditor 
            npc={selectedNpc} 
            factions={activeCampaign.factions} 
            allNpcs={activeCampaign.npcs} 
            playerCharacters={activeCampaign.playerCharacters} 
            onUpdate={campaignService.updateNpc} 
            onDelete={(id) => { campaignService.deleteNpc(id); resetSelections(); }} 
            isMockMode={isMockMode} 
        />
      );
      
      if (selectedLocation) return (
        <LocationEditor 
            location={selectedLocation} 
            allLocations={activeCampaign.locations} 
            allFactions={activeCampaign.factions} 
            onUpdate={campaignService.updateLocation} 
            onDelete={(id) => { campaignService.deleteLocation(id); resetSelections(); }} 
            isMockMode={isMockMode} 
        />
      );
      
      if (selectedFaction) return (
        <FactionEditor 
            faction={selectedFaction} 
            allNpcs={activeCampaign.npcs} 
            allLocations={activeCampaign.locations}
            onUpdate={campaignService.updateFaction} 
            onDelete={(id) => { campaignService.deleteFaction(id); resetSelections(); }} 
            isMockMode={isMockMode} 
        />
      );
      if (selectedItem) return <ItemEditor item={selectedItem} onUpdate={campaignService.updateItem} onDelete={(id) => { campaignService.deleteItem(id); resetSelections(); }} isMockMode={isMockMode} />;

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
                    isOfficialSetting={isOfficialSetting}
                    campaignContext={campaignContext}
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
      if (activeView === 'plots') return <PlotDashboard plots={activeCampaign.plots || []} onPlotCreated={(noteData) => {
            const newId = campaignService.createPlot(noteData);
            setActiveView('plots');
            setSelectedPlotId(newId);
      }} onSelectPlot={setSelectedPlotId} />;
      if (activeView === 'npcs') return <NpcDashboard npcs={activeCampaign.npcs} factions={activeCampaign.factions} onNpcCreated={(npcData) => {
            const newId = campaignService.createNpc(npcData);
            setActiveView('npcs');
            setSelectedNpcId(newId);
        }} onSelectNpc={setSelectedNpcId} isMockMode={isMockMode} isOfficialSetting={isOfficialSetting} campaignContext={campaignContext} />;
      if (activeView === 'locations') return <LocationDashboard locations={activeCampaign.locations} factions={activeCampaign.factions} onLocationCreated={(locData) => {
            const newId = campaignService.createLocation(locData);
            setActiveView('locations');
            setSelectedLocationId(newId);
        }} onSelectLocation={setSelectedLocationId} isMockMode={isMockMode} isOfficialSetting={isOfficialSetting} campaignContext={campaignContext} />;
      if (activeView === 'factions') return <FactionDashboard factions={activeCampaign.factions} npcs={activeCampaign.npcs} locations={activeCampaign.locations} onFactionCreated={(facData) => {
            const newId = campaignService.createFaction(facData);
            setActiveView('factions');
            setSelectedFactionId(newId);
        }} onSelectFaction={setSelectedFactionId} isMockMode={isMockMode} isOfficialSetting={isOfficialSetting} campaignContext={campaignContext} />;
      if (activeView === 'items') return <ItemDashboard items={activeCampaign.items} onItemCreated={(itemData) => {
            const newId = campaignService.createItem(itemData);
            setActiveView('items');
            setSelectedItemId(newId);
        }} onSelectItem={setSelectedItemId} isMockMode={isMockMode} isOfficialSetting={isOfficialSetting} campaignContext={campaignContext} />;
      if (activeView === 'lorebook') return <ArticleDashboard articles={activeCampaign.articles} npcs={activeCampaign.npcs} locations={activeCampaign.locations} factions={activeCampaign.factions} onArticleCreated={(artData) => {
            const newId = campaignService.createArticle(artData);
            setActiveView('lorebook');
            setSelectedArticleId(newId);
        }} onSelectArticle={setSelectedArticleId} isMockMode={isMockMode} isOfficialSetting={isOfficialSetting} campaignContext={campaignContext} />;

      // Combat Tracker View
      if (activeView === 'combat') {
        return <CombatTracker 
            encounter={activeCampaign.activeEncounter || { id: 'default', round: 1, turnIndex: 0, combatants: [] }} 
            onUpdate={campaignService.updateEncounter} 
            campaignNpcs={activeCampaign.npcs}
            campaignPcs={activeCampaign.playerCharacters || []}
        />;
      }

      // Relationship Graph View
      if (activeView === 'relationships') {
          return <RelationshipGraph 
            campaign={activeCampaign} 
            onNodeSelect={(type, id) => handleSelect(type as any, id)} 
          />;
      }

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
                onToggleSidebar={() => setIsSidebarOpen(p => !p)}
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
                  fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 transform transition-transform duration-200 ease-in-out
                  md:relative md:translate-x-0
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
                        plot: selectedPlotId
                    }}
                    onSelect={handleSelect}
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
                </div>

                <main className="flex-1 overflow-y-auto bg-slate-900 text-slate-100 relative w-full">
                  {renderMainContent()}
                </main>
                
                {/* Floating Widgets */}
                <RealmChatWidget 
                  campaign={activeCampaign} 
                  onAddToCampaign={handleAddEntityFromChat}
                  onUpdateCampaign={handleUpdateEntityFromChat}
                  isMockMode={isMockMode} 
                />
                
                {isCoachOpen && <DmCoach campaign={activeCampaign} activeContext={currentContext} onClose={() => setIsCoachOpen(false)} onSendToNotes={(content) => campaignService.addAutoEvent('coach-used', content)} isMockMode={isMockMode} />}
                {isWizardOpen && <EvocationWizard 
                    campaign={activeCampaign} 
                    onClose={() => setIsWizardOpen(false)} 
                    onAddToCampaign={(data) => {
                        const count = Object.values(data).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0) as number;
                        campaignService.batchAddToCampaign(data);
                        setIsWizardOpen(false);
                        if (count > 0) {
                            alert(`${count} entit${count === 1 ? 'y' : 'ies'} added to your campaign!`);
                        }
                    }} 
                    isMockMode={isMockMode}
                />}
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
