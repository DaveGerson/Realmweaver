import React, { useState, useEffect, useMemo } from 'react';
import type { Campaign, Adventure, NPC, Location, Faction, Item, Scene, Article, AdventureForBatchAdd } from './types';
import type { BatchAddData } from './types';
import { WelcomeScreen } from './components/WelcomeScreen';
import { CampaignCreator } from './components/CampaignCreator';
import { CampaignSelector } from './components/CampaignSelector';
import { Header } from './components/Header';
import { CampaignSidebar } from './components/CampaignSidebar';
import { AdventureEditor } from './components/AdventureEditor';
import { AdventureDashboard } from './components/AdventureDashboard';
import { NpcGenerator } from './components/NpcGenerator';
import { LocationGenerator } from './components/LocationGenerator';
import { FactionGenerator } from './components/FactionGenerator';
import { ItemGenerator } from './components/ItemGenerator';
import { SceneGenerator } from './components/SceneGenerator';
import { ArticleGenerator } from './components/ArticleGenerator';
import { NpcEditor } from './components/NpcEditor';
import { LocationEditor } from './components/LocationEditor';
import { FactionEditor } from './components/FactionEditor';
import { ItemEditor } from './components/ItemEditor';
import { SceneEditor } from './components/SceneEditor';
import { ArticleEditor } from './components/ArticleEditor';
import { DmCoach } from './components/DmCoach';
import { EvocationWizard } from './components/EvocationWizard';
import { Icons } from './components/Icons';
import { runSmokeTests } from './smokeTest';
import { produce } from 'immer';
import { ExportModal } from './components/ExportModal';
import { importCampaignFromJson, exportCampaignAsJson, exportCampaignAsObsidian } from './services/importExportService';

export type EditorView = 'setting' | 'npcs' | 'locations' | 'factions' | 'items' | 'adventures' | 'lorebook';
export type GeneratorType = 'npc' | 'location' | 'faction' | 'item' | 'scene' | 'article';
type AppStatus = 'loading' | 'welcome' | 'selecting' | 'creating' | 'editing';

const CAMPAIGNS_STORAGE_KEY = 'realmweaver-campaigns';
const ACTIVE_CAMPAIGN_ID_KEY = 'realmweaver-active-campaign-id';

const App: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [isMockMode, setIsMockMode] = useState(true);
  const [appStatus, setAppStatus] = useState<AppStatus>('loading');
  
  const [activeView, setActiveView] = useState<EditorView>('setting');
  const [activeGenerator, setActiveGenerator] = useState<GeneratorType | null>(null);

  const [selectedAdventureId, setSelectedAdventureId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedFactionId, setSelectedFactionId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  
  const [isCoachOpen, setIsCoachOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);


  // Load campaigns from local storage on initial mount
  useEffect(() => {
    const savedCampaigns = localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
    const savedActiveId = localStorage.getItem(ACTIVE_CAMPAIGN_ID_KEY);

    if (savedCampaigns) {
      try {
        const campaignsData: Campaign[] = JSON.parse(savedCampaigns);
        setCampaigns(campaignsData);
        if (savedActiveId && campaignsData.some(c => c.id === savedActiveId)) {
          setActiveCampaignId(savedActiveId);
          setAppStatus('editing');
        } else if (campaignsData.length > 0) {
          setAppStatus('selecting');
        } else {
           setAppStatus('welcome');
        }
      } catch (e) {
        console.error("Failed to parse saved campaigns, clearing storage.", e);
        localStorage.removeItem(CAMPAIGNS_STORAGE_KEY);
        localStorage.removeItem(ACTIVE_CAMPAIGN_ID_KEY);
        setAppStatus('welcome');
      }
    } else {
      setAppStatus('welcome');
    }
  }, []);

  // Persist campaigns to local storage whenever they change
  useEffect(() => {
    if (appStatus !== 'loading') {
      localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(campaigns));
    }
  }, [campaigns, appStatus]);

  // Persist active campaign ID
  useEffect(() => {
    if (activeCampaignId) {
      localStorage.setItem(ACTIVE_CAMPAIGN_ID_KEY, activeCampaignId);
    } else {
      localStorage.removeItem(ACTIVE_CAMPAIGN_ID_KEY);
    }
  }, [activeCampaignId]);

  useEffect(() => {
    runSmokeTests(isMockMode);
  }, [isMockMode]);

  const activeCampaign = useMemo(() => campaigns.find(c => c.id === activeCampaignId), [campaigns, activeCampaignId]);

  const handleSaveCampaign = () => {
    // The useEffect for `campaigns` state handles saving automatically.
    // This function can be used for explicit save actions if needed in the UI.
    console.log("Campaign state saved.");
  };

  const resetSelections = () => {
    setSelectedNpcId(null);
    setSelectedLocationId(null);
    setSelectedFactionId(null);
    setSelectedItemId(null);
    setSelectedAdventureId(null);
    setSelectedSceneId(null);
    setSelectedArticleId(null);
    setActiveGenerator(null);
  };
  
  const handleCreateCampaign = (title: string, setting: string) => {
    const newCampaign: Campaign = { id: crypto.randomUUID(), title, setting, articles: [], adventures: [], npcs: [], locations: [], factions: [], items: [] };
    setCampaigns(prev => [...prev, newCampaign]);
    setActiveCampaignId(newCampaign.id);
    setAppStatus('editing');
    setActiveView('setting');
  };

  const handleDeleteCampaign = (id: string) => {
    if (window.confirm("Are you sure you want to permanently delete this campaign?")) {
        setCampaigns(prev => prev.filter(c => c.id !== id));
        if (activeCampaignId === id) {
            setActiveCampaignId(null);
            setAppStatus('selecting');
        }
    }
  };

  const handleSelectCampaign = (id: string) => {
    setActiveCampaignId(id);
    setAppStatus('editing');
  };

  const handleImportCampaign = async (file: File) => {
    try {
        const importedCampaign = await importCampaignFromJson(file);
        
        // Check if a campaign with the same ID already exists. If so, generate a new ID.
        if (campaigns.some(c => c.id === importedCampaign.id)) {
            console.warn("Imported campaign has a conflicting ID. Assigning a new one.");
            importedCampaign.id = crypto.randomUUID();
        }

        setCampaigns(prev => [...prev, importedCampaign]);
        alert(`Campaign "${importedCampaign.title}" imported successfully!`);
        setActiveCampaignId(null);
        setAppStatus('selecting');

    } catch (error) {
        console.error("Import failed:", error);
        alert(`Import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };
  
  const handleUpdateCampaign = (updatedData: Partial<Campaign>) => {
    setCampaigns(prev => produce(prev, draft => {
      const campaign = draft.find(c => c.id === activeCampaignId);
      if (campaign) Object.assign(campaign, updatedData);
    }));
  };
  
  // --- WORLD ENTITY HANDLERS ---
  const handleNpcCreated = (newNpcData: Omit<NPC, 'id'>) => {
    const newNpc: NPC = { ...newNpcData, id: crypto.randomUUID() };
    setCampaigns(prev => produce(prev, draft => { 
        const campaign = draft.find(c => c.id === activeCampaignId);
        if (campaign) campaign.npcs.push(newNpc);
    }));
    setActiveGenerator(null);
    setSelectedNpcId(newNpc.id);
  };

  const handleUpdateNpc = (id: string, updatedData: Partial<NPC>) => {
      setCampaigns(prev => produce(prev, draft => {
          const campaign = draft.find(c => c.id === activeCampaignId);
          if (!campaign) return;
          const npcIndex = campaign.npcs.findIndex(n => n.id === id);
          if (npcIndex === -1) return;
          
          const oldNpc = campaign.npcs[npcIndex];
          const oldFactionId = oldNpc.factionId;
          Object.assign(oldNpc, updatedData);
          const newFactionId = campaign.npcs[npcIndex].factionId;

          if (oldFactionId !== newFactionId) {
              if (oldFactionId) {
                  const oldFaction = campaign.factions.find(f => f.id === oldFactionId);
                  if (oldFaction) oldFaction.memberIds = oldFaction.memberIds.filter(memberId => memberId !== id);
              }
              if (newFactionId) {
                  const newFaction = campaign.factions.find(f => f.id === newFactionId);
                  if (newFaction && !newFaction.memberIds.includes(id)) newFaction.memberIds.push(id);
              }
          }
      }));
  };

  const handleDeleteNpc = (id: string) => {
    setCampaigns(prev => produce(prev, draft => {
        const campaign = draft.find(c => c.id === activeCampaignId);
        if (!campaign) return;
        campaign.npcs = campaign.npcs.filter(n => n.id !== id);
        campaign.adventures.forEach(adv => {
            adv.scenes.forEach(scene => {
                scene.npcIds = scene.npcIds.filter(npcId => npcId !== id);
            });
        });
    }));
    if (selectedNpcId === id) setSelectedNpcId(null);
  };

  const handleLocationCreated = (newLocationData: Omit<Location, 'id'>) => {
    const newLocation: Location = { ...newLocationData, id: crypto.randomUUID() };
    setCampaigns(prev => produce(prev, draft => {
        const campaign = draft.find(c => c.id === activeCampaignId);
        if(campaign) campaign.locations.push(newLocation)
    }));
    setActiveGenerator(null);
    setSelectedLocationId(newLocation.id);
  };
  
  const handleUpdateLocation = (id: string, updatedData: Partial<Location>) => {
    setCampaigns(prev => produce(prev, draft => {
        const campaign = draft.find(c => c.id === activeCampaignId);
        if (!campaign) return;
        const locIndex = campaign.locations.findIndex(l => l.id === id);
        if (locIndex === -1) return;
        const oldLoc = { ...campaign.locations[locIndex] };
        Object.assign(campaign.locations[locIndex], updatedData);
        const newLoc = campaign.locations[locIndex];

        if (oldLoc.parentLocationId !== newLoc.parentLocationId) {
          if (oldLoc.parentLocationId) {
            const oldParent = campaign.locations.find(p => p.id === oldLoc.parentLocationId);
            if (oldParent) oldParent.subLocationIds = oldParent.subLocationIds.filter(subId => subId !== id);
          }
          if (newLoc.parentLocationId) {
            const newParent = campaign.locations.find(p => p.id === newLoc.parentLocationId);
            if (newParent && !newParent.subLocationIds.includes(id)) newParent.subLocationIds.push(id);
          }
        }
    }));
  };
  
  const handleFactionCreated = (newFactionData: Omit<Faction, 'id'>) => {
    const newFaction: Faction = { ...newFactionData, id: crypto.randomUUID() };
    setCampaigns(prev => produce(prev, draft => {
        const campaign = draft.find(c => c.id === activeCampaignId);
        if(campaign) campaign.factions.push(newFaction)
    }));
    setActiveGenerator(null);
    setSelectedFactionId(newFaction.id);
  };

  const handleUpdateFaction = (id: string, updatedData: Partial<Faction>) => {
    setCampaigns(prev => produce(prev, draft => {
        const campaign = draft.find(c => c.id === activeCampaignId);
        if (!campaign) return;
        const faction = campaign.factions.find(f => f.id === id);
        if (faction) Object.assign(faction, updatedData);
    }));
  };

  const handleDeleteFaction = (id: string) => {
    setCampaigns(prev => produce(prev, draft => {
      const campaign = draft.find(c => c.id === activeCampaignId);
      if (!campaign) return;
      campaign.factions = campaign.factions.filter(f => f.id !== id);
      campaign.npcs.forEach(npc => { if (npc.factionId === id) npc.factionId = undefined; });
    }));
    if (selectedFactionId === id) setSelectedFactionId(null);
  };
  
  const handleItemCreated = (newItemData: Omit<Item, 'id'>) => {
    const newItem: Item = { ...newItemData, id: crypto.randomUUID() };
    setCampaigns(prev => produce(prev, draft => {
        const campaign = draft.find(c => c.id === activeCampaignId);
        if (campaign) campaign.items.push(newItem);
    }));
    setActiveGenerator(null);
    setSelectedItemId(newItem.id);
  };

  const handleUpdateItem = (id: string, updatedData: Partial<Item>) => {
    setCampaigns(prev => produce(prev, draft => {
        const campaign = draft.find(c => c.id === activeCampaignId);
        if (!campaign) return;
        const item = campaign.items.find(i => i.id === id);
        if (item) Object.assign(item, updatedData);
    }));
  };

  const handleDeleteItem = (id: string) => {
    setCampaigns(prev => produce(prev, draft => {
        const campaign = draft.find(c => c.id === activeCampaignId);
        if (campaign) campaign.items = campaign.items.filter(i => i.id !== id);
    }));
    if (selectedItemId === id) setSelectedItemId(null);
  };

  // --- LORE ARTICLE HANDLERS ---
  const handleArticleCreated = (newArticleData: Omit<Article, 'id'>) => {
    const newArticle: Article = { ...newArticleData, id: crypto.randomUUID() };
    setCampaigns(prev => produce(prev, draft => {
        const campaign = draft.find(c => c.id === activeCampaignId);
        if (campaign) campaign.articles.push(newArticle);
    }));
    setActiveGenerator(null);
    setSelectedArticleId(newArticle.id);
  };

  const handleUpdateArticle = (id: string, updatedData: Partial<Article>) => {
    setCampaigns(prev => produce(prev, draft => {
        const campaign = draft.find(c => c.id === activeCampaignId);
        if (!campaign) return;
        const articleIndex = campaign.articles.findIndex(a => a.id === id);
        if (articleIndex === -1) return;
        const oldArticle = { ...campaign.articles[articleIndex] };
        Object.assign(campaign.articles[articleIndex], updatedData);
        const newArticle = campaign.articles[articleIndex];

        if (oldArticle.parentArticleId !== newArticle.parentArticleId) {
            if (oldArticle.parentArticleId) {
                const oldParent = campaign.articles.find(p => p.id === oldArticle.parentArticleId);
                if (oldParent) oldParent.subArticleIds = oldParent.subArticleIds.filter(subId => subId !== id);
            }
            if (newArticle.parentArticleId) {
                const newParent = campaign.articles.find(p => p.id === newArticle.parentArticleId);
                if (newParent && !newParent.subArticleIds.includes(id)) newParent.subArticleIds.push(id);
            }
        }
    }));
  };

  const handleDeleteArticle = (id: string) => {
    setCampaigns(prev => produce(prev, draft => {
        const campaign = draft.find(c => c.id === activeCampaignId);
        if (!campaign) return;
        const articleToDelete = campaign.articles.find(a => a.id === id);
        if (!articleToDelete) return;

        // Remove from parent's subArticleIds
        if (articleToDelete.parentArticleId) {
            const parent = campaign.articles.find(p => p.id === articleToDelete.parentArticleId);
            if (parent) parent.subArticleIds = parent.subArticleIds.filter(subId => subId !== id);
        }

        // Un-parent all children
        articleToDelete.subArticleIds.forEach(childId => {
            const child = campaign.articles.find(c => c.id === childId);
            if (child) child.parentArticleId = undefined; // Set children to be top-level
        });
        
        // Delete article
        campaign.articles = campaign.articles.filter(a => a.id !== id);
    }));
    if (selectedArticleId === id) setSelectedArticleId(null);
  };

  // --- ADVENTURE & SCENE HANDLERS ---
  const handleFullAdventureCreated = (adventureData: AdventureForBatchAdd) => {
    const newAdventure: Adventure = {
        id: crypto.randomUUID(),
        title: adventureData.title,
        hook: adventureData.hook,
        theme: adventureData.theme,
        level: adventureData.level,
        scenes: (adventureData.scenes || []).map(sceneData => ({
            ...sceneData,
            id: crypto.randomUUID(),
        }))
    };
    setCampaigns(prev => produce(prev, draft => {
        const campaign = draft.find(c => c.id === activeCampaignId);
        if (campaign) {
            campaign.adventures.push(newAdventure);
        }
    }));
    setSelectedAdventureId(newAdventure.id);
    setActiveGenerator(null);
  };

  const handleUpdateAdventure = (id: string, updatedData: Partial<Adventure>) => {
    setCampaigns(prev => produce(prev, draft => {
        const campaign = draft.find(c => c.id === activeCampaignId);
        if (!campaign) return;
        const adventure = campaign.adventures.find(a => a.id === id);
        if (adventure) Object.assign(adventure, updatedData);
    }));
  };

  const handleSceneCreated = (adventureId: string, newSceneData: Omit<Scene, 'id'>) => {
    const newScene: Scene = { ...newSceneData, id: crypto.randomUUID() };
    setCampaigns(prev => produce(prev, draft => {
        const campaign = draft.find(c => c.id === activeCampaignId);
        if (!campaign) return;
        const adventure = campaign.adventures.find(a => a.id === adventureId);
        if (adventure) adventure.scenes.push(newScene);
    }));
    setActiveGenerator(null);
    setSelectedSceneId(newScene.id);
  };

  const handleUpdateScene = (adventureId: string, sceneId: string, updatedData: Partial<Scene>) => {
    setCampaigns(prev => produce(prev, draft => {
        const campaign = draft.find(c => c.id === activeCampaignId);
        if (!campaign) return;
        const adventure = campaign.adventures.find(a => a.id === adventureId);
        if (!adventure) return;
        const scene = adventure.scenes.find(s => s.id === sceneId);
        if (scene) Object.assign(scene, updatedData);
    }));
  };

  const handleDeleteScene = (adventureId: string, sceneId: string) => {
    setCampaigns(prev => produce(prev, draft => {
        const campaign = draft.find(c => c.id === activeCampaignId);
        if (!campaign) return;
        const adventure = campaign.adventures.find(a => a.id === adventureId);
        if (adventure) adventure.scenes = adventure.scenes.filter(s => s.id !== sceneId);
    }));
    if (selectedSceneId === sceneId) setSelectedSceneId(null);
  };

  const handleReorderScene = (adventureId: string, draggedSceneId: string, targetSceneId: string) => {
    setCampaigns(prev => produce(prev, draft => {
        const campaign = draft.find(c => c.id === activeCampaignId);
        if (!campaign) return;
        const adventure = campaign.adventures.find(a => a.id === adventureId);
        if (!adventure) return;

        const draggedIndex = adventure.scenes.findIndex(s => s.id === draggedSceneId);
        const targetIndex = adventure.scenes.findIndex(s => s.id === targetSceneId);

        if (draggedIndex > -1 && targetIndex > -1) {
            const [draggedItem] = adventure.scenes.splice(draggedIndex, 1);
            adventure.scenes.splice(targetIndex, 0, draggedItem);
        }
    }));
  };

  const handleBatchAddToCampaign = (data: BatchAddData) => {
    setCampaigns(prev => produce(prev, draft => {
        const campaign = draft.find(c => c.id === activeCampaignId);
        if (!campaign) return;
        
        // 1. Create all new entities and add them to the campaign draft
        const newNpcs = data.npcs.map(npcData => ({ ...npcData, id: crypto.randomUUID(), knowsPlayerHistory: [] }));
        const newLocations = data.locations.map(locData => ({ ...locData, id: crypto.randomUUID(), subLocationIds: [], connections: locData.connections || [] }));
        const newFactions = data.factions.map(facData => ({ ...facData, id: crypto.randomUUID(), leaderId: undefined, memberIds: [] }));
        const newItems = data.items.map(itemData => ({ ...itemData, id: crypto.randomUUID() }));
        const newAdventures = data.adventures.map(advData => {
            const newAdventure: Adventure = { 
                ...advData, 
                id: crypto.randomUUID(),
                scenes: (advData.scenes || []).map(sceneData => ({
                    ...sceneData,
                    id: crypto.randomUUID(),
                    locationId: undefined, // ensure these are not set by default
                    npcIds: [],
                }))
            };
            return newAdventure;
        });

        campaign.npcs.push(...newNpcs);
        campaign.locations.push(...newLocations);
        campaign.factions.push(...newFactions);
        campaign.items.push(...newItems);
        campaign.adventures.push(...newAdventures);

        // 2. Update existing entities with links from the new entities
        newNpcs.forEach(npc => {
            if (npc.factionId) {
                const faction = campaign.factions.find(f => f.id === npc.factionId);
                if (faction) {
                    faction.memberIds.push(npc.id);
                }
            }
        });

        newLocations.forEach(loc => {
            if (loc.parentLocationId) {
                const parent = campaign.locations.find(p => p.id === loc.parentLocationId);
                if (parent) {
                    parent.subLocationIds.push(loc.id);
                }
            }
        });
    }));
    setIsWizardOpen(false);
  };

  // --- Memos for selected items ---
  const selectedAdventure = useMemo(() => activeCampaign?.adventures.find(a => a.id === selectedAdventureId) || null, [activeCampaign, selectedAdventureId]);
  const selectedScene = useMemo(() => selectedAdventure?.scenes.find(s => s.id === selectedSceneId) || null, [selectedAdventure, selectedSceneId]);
  const selectedNpc = useMemo(() => activeCampaign?.npcs.find(n => n.id === selectedNpcId) || null, [activeCampaign, selectedNpcId]);
  const selectedLocation = useMemo(() => activeCampaign?.locations.find(l => l.id === selectedLocationId) || null, [activeCampaign, selectedLocationId]);
  const selectedFaction = useMemo(() => activeCampaign?.factions.find(f => f.id === selectedFactionId) || null, [activeCampaign, selectedFactionId]);
  const selectedItem = useMemo(() => activeCampaign?.items.find(i => i.id === selectedItemId) || null, [activeCampaign, selectedItemId]);
  const selectedArticle = useMemo(() => activeCampaign?.articles.find(a => a.id === selectedArticleId) || null, [activeCampaign, selectedArticleId]);
  
  const handleSelectView = (view: EditorView) => {
    setActiveView(view);
    resetSelections();
  };

  const renderMainContent = () => {
      if (!activeCampaign) return null;

      // Render Generators
      if (activeGenerator === 'npc') return <ContentWrapper title="Generate New NPC"><NpcGenerator onNpcCreated={handleNpcCreated} isMockMode={isMockMode} /></ContentWrapper>;
      if (activeGenerator === 'location') return <ContentWrapper title="Generate New Location"><LocationGenerator onLocationCreated={handleLocationCreated} isMockMode={isMockMode} /></ContentWrapper>;
      if (activeGenerator === 'faction') return <ContentWrapper title="Generate New Faction"><FactionGenerator onFactionCreated={handleFactionCreated} isMockMode={isMockMode} /></ContentWrapper>;
      if (activeGenerator === 'item') return <ContentWrapper title="Generate New Item"><ItemGenerator onItemCreated={handleItemCreated} isMockMode={isMockMode} /></ContentWrapper>;
      if (activeGenerator === 'article') return <ContentWrapper title="Create New Lore Article"><ArticleGenerator onArticleCreated={handleArticleCreated} isMockMode={isMockMode} /></ContentWrapper>;
      if (activeGenerator === 'scene' && selectedAdventure) return <ContentWrapper title="Create New Scene"><SceneGenerator onSceneCreated={(s) => handleSceneCreated(selectedAdventure.id, s)} isMockMode={isMockMode} /></ContentWrapper>;

      // Render Editors & Dashboards
      if (activeView === 'adventures' && !selectedAdventure) {
        return <AdventureDashboard 
                    adventures={activeCampaign.adventures} 
                    onAdventureCreated={handleFullAdventureCreated}
                    onSelectAdventure={(id) => {
                        resetSelections();
                        setActiveView('adventures');
                        setSelectedAdventureId(id);
                    }}
                    isMockMode={isMockMode}
                />;
      }
      
      if (selectedScene && selectedAdventure) return <SceneEditor scene={selectedScene} allNpcs={activeCampaign.npcs} allLocations={activeCampaign.locations} onUpdate={(id, data) => handleUpdateScene(selectedAdventure.id, id, data)} onDelete={(id) => handleDeleteScene(selectedAdventure.id, id)} isMockMode={isMockMode} />;
      if (selectedAdventure) return <AdventureEditor adventure={selectedAdventure} campaign={activeCampaign} onUpdate={handleUpdateAdventure} />;
      if (selectedArticle) return <ArticleEditor article={selectedArticle} allArticles={activeCampaign.articles} onUpdate={handleUpdateArticle} onDelete={handleDeleteArticle} isMockMode={isMockMode} />;
      if (selectedNpc) return <NpcEditor npc={selectedNpc} factions={activeCampaign.factions} onUpdate={handleUpdateNpc} onDelete={handleDeleteNpc} isMockMode={isMockMode} />;
      if (selectedLocation) return <LocationEditor location={selectedLocation} allLocations={activeCampaign.locations} onUpdate={handleUpdateLocation} isMockMode={isMockMode} />;
      if (selectedFaction) return <FactionEditor faction={selectedFaction} allNpcs={activeCampaign.npcs} onUpdate={handleUpdateFaction} onDelete={handleDeleteFaction} isMockMode={isMockMode} />;
      if (selectedItem) return <ItemEditor item={selectedItem} onUpdate={handleUpdateItem} onDelete={handleDeleteItem} isMockMode={isMockMode} />;

      // Render Top-Level Views
      if (activeView === 'setting') return <CampaignSettingEditor campaign={activeCampaign} onUpdate={handleUpdateCampaign} />;

      // Fallback Placeholders
      const placeholders = {
        npcs: { icon: "NPCs", text: "Select an NPC from the sidebar to edit them, or create a new one." },
        locations: { icon: "Locations", text: "Select a location from the sidebar to edit it, or create a new one." },
        factions: { icon: "Factions", text: "Select a faction from the sidebar to edit it, or create a new one." },
        items: { icon: "Items", text: "Select an item from the sidebar to edit it, or create a new one." },
        lorebook: { icon: "FileCode", text: "Select a lore article from the sidebar to edit it, or create a new one." },
      };
      
      if (activeView in placeholders) {
          const { icon, text } = placeholders[activeView as keyof typeof placeholders];
          return <EditorPlaceholder icon={icon as keyof typeof Icons} text={text} />;
      }

      return <EditorPlaceholder icon="Campaign" text="Select an item from the sidebar to get started." />;
  };

  const renderApp = () => {
    switch(appStatus) {
      case 'loading':
        return null;
      case 'welcome':
        return <WelcomeScreen onStart={() => setAppStatus('creating')} />;
      case 'selecting':
        return <CampaignSelector campaigns={campaigns} onSelect={handleSelectCampaign} onDelete={handleDeleteCampaign} onCreateNew={() => setAppStatus('creating')} />;
      case 'creating':
        return <CampaignCreator onCreateCampaign={handleCreateCampaign} />;
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
                }}
                onSelect={(type, id) => {
                  resetSelections();
                  if (type === 'scene' || type === 'adventure') {
                    setActiveView('adventures');
                  } else if (type === 'article') {
                    setActiveView('lorebook');
                  } else {
                    setActiveView(type as EditorView);
                  }
                  
                  if (type === 'adventure') setSelectedAdventureId(id);
                  if (type === 'scene') setSelectedSceneId(id);
                  if (type === 'npc') setSelectedNpcId(id);
                  if (type === 'location') setSelectedLocationId(id);
                  if (type === 'faction') setSelectedFactionId(id);
                  if (type === 'item') setSelectedItemId(id);
                  if (type === 'article') setSelectedArticleId(id);
                }}
                onShowGenerator={setActiveGenerator}
                onReorderScene={handleReorderScene}
              />
              <main className="flex-1 overflow-y-auto custom-scrollbar">
                {renderMainContent()}
              </main>
            </div>
          );
        }
        return null;
    }
  };

  return (
    <div className="bg-slate-950 text-slate-200 h-screen flex flex-col font-sans">
      <Header 
        activeCampaign={activeCampaign}
        isMockMode={isMockMode} 
        onToggleMockMode={() => setIsMockMode(p => !p)} 
        onToggleCoach={() => setIsCoachOpen(p => !p)}
        onToggleWizard={() => setIsWizardOpen(true)}
        onSaveCampaign={handleSaveCampaign}
        onSwitchCampaign={() => { setActiveCampaignId(null); setAppStatus('selecting'); }}
        onCreateNew={() => { setActiveCampaignId(null); setAppStatus('creating'); }}
        onImportCampaign={handleImportCampaign}
        onShowExportModal={() => setIsExportModalOpen(true)}
      />
      <div className="flex-1 overflow-hidden flex relative">
        {renderApp()}
        {isCoachOpen && activeCampaign && ( <DmCoach campaign={activeCampaign} onClose={() => setIsCoachOpen(false)} isMockMode={isMockMode} /> )}
        {isWizardOpen && activeCampaign && ( <EvocationWizard campaign={activeCampaign} onClose={() => setIsWizardOpen(false)} onAddToCampaign={handleBatchAddToCampaign} isMockMode={isMockMode} /> )}
        {isExportModalOpen && activeCampaign && (
            <ExportModal
                campaignTitle={activeCampaign.title}
                onClose={() => setIsExportModalOpen(false)}
                onExportJson={() => {
                    exportCampaignAsJson(activeCampaign);
                    setIsExportModalOpen(false);
                }}
                onExportObsidian={() => {
                    exportCampaignAsObsidian(activeCampaign);
                    setIsExportModalOpen(false);
                }}
            />
        )}
      </div>
    </div>
  );
};

// --- Helper Components ---
const CampaignSettingEditor = ({ campaign, onUpdate }: { campaign: Campaign, onUpdate: (data: Partial<Campaign>) => void }) => {
    const [formData, setFormData] = useState({ title: campaign.title, setting: campaign.setting });
    useEffect(() => { setFormData({ title: campaign.title, setting: campaign.setting })}, [campaign]);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleBlur = () => onUpdate(formData);

    return (
        <div className="p-6 md:p-8 h-full space-y-8 animate-in fade-in duration-300">
          <header className="space-y-2">
            <div className="flex items-center gap-3 text-indigo-400"> <Icons.Setting className="w-8 h-8" /> <h1 className="text-3xl font-bold font-serif text-slate-100">Campaign Setting</h1> </div>
            <p className="text-slate-400">Define the high-level details of your world. This sets the stage for all adventures to come.</p>
          </header>
          <div className="space-y-6 bg-slate-900/50 p-6 rounded-xl border border-slate-800/50">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Campaign Title</label>
              <input type="text" name="title" value={formData.title} onChange={handleChange} onBlur={handleBlur} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">World Setting</label>
              <textarea name="setting" value={formData.setting} onChange={handleChange} onBlur={handleBlur} rows={10} className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all resize-y" placeholder="Describe the world's history, key conflicts, and overall mood..." />
            </div>
          </div>
        </div>
    );
};

const EditorPlaceholder = ({ icon, text }: { icon: keyof typeof Icons, text: string }) => {
    const Icon = Icons[icon];
    return (
        <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center">
            <Icon className="w-16 h-16 mb-4" /> <p>{text}</p>
        </div>
    );
};

const ContentWrapper: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="p-6 md:p-8 h-full space-y-8 animate-in fade-in duration-300">
    <header className="space-y-2">
        <div className="flex items-center gap-3 text-indigo-400">
            <Icons.Sparkles className="w-8 h-8" />
            <h1 className="text-3xl font-bold font-serif text-slate-100">{title}</h1>
        </div>
    </header>
    <div className="max-w-md">
        {children}
    </div>
  </div>
);


export default App;
