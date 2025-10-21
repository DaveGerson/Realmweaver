import React, { useState, useEffect, useMemo } from 'react';
import type { Campaign, Adventure, NPC, Location, Faction, Item, Scene } from './types';
import type { BatchAddData } from './types';
import { WelcomeScreen } from './components/WelcomeScreen';
import { CampaignCreator } from './components/CampaignCreator';
import { Header } from './components/Header';
import { CampaignSidebar } from './components/CampaignSidebar';
import { AdventureEditor } from './components/AdventureEditor';
import { AdventureCreator } from './components/AdventureCreator';
import { NpcGenerator } from './components/NpcGenerator';
import { LocationGenerator } from './components/LocationGenerator';
import { FactionGenerator } from './components/FactionGenerator';
import { ItemGenerator } from './components/ItemGenerator';
import { SceneGenerator } from './components/SceneGenerator';
import { NpcEditor } from './components/NpcEditor';
import { LocationEditor } from './components/LocationEditor';
import { FactionEditor } from './components/FactionEditor';
import { ItemEditor } from './components/ItemEditor';
import { SceneEditor } from './components/SceneEditor';
import { DmCoach } from './components/DmCoach';
import { EvocationWizard } from './components/EvocationWizard';
import { Icons } from './components/Icons';
import { runSmokeTests } from './smokeTest';
import { produce } from 'immer';

export type EditorView = 'setting' | 'npcs' | 'locations' | 'factions' | 'items' | 'adventures';
export type GeneratorType = 'npc' | 'location' | 'faction' | 'item' | 'adventure' | 'scene';

const App: React.FC = () => {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isMockMode, setIsMockMode] = useState(true);
  const [appStatus, setAppStatus] = useState<'welcome' | 'creating' | 'editing'>('welcome');
  
  const [activeView, setActiveView] = useState<EditorView>('setting');
  const [activeGenerator, setActiveGenerator] = useState<GeneratorType | null>(null);

  const [selectedAdventureId, setSelectedAdventureId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedFactionId, setSelectedFactionId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  
  const [isCoachOpen, setIsCoachOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  useEffect(() => {
    runSmokeTests(isMockMode);
  }, [isMockMode]);

  const resetSelections = () => {
    setSelectedNpcId(null);
    setSelectedLocationId(null);
    setSelectedFactionId(null);
    setSelectedItemId(null);
    setSelectedAdventureId(null);
    setSelectedSceneId(null);
    setActiveGenerator(null);
  };
  
  const handleCreateCampaign = (title: string, setting: string) => {
    const newCampaign: Campaign = { id: crypto.randomUUID(), title, setting, adventures: [], npcs: [], locations: [], factions: [], items: [] };
    setCampaign(newCampaign);
    setAppStatus('editing');
    setActiveView('setting');
  };
  
  const handleUpdateCampaign = (updatedData: Partial<Campaign>) => {
    setCampaign(prev => prev ? { ...prev, ...updatedData } : null);
  };
  
  // --- WORLD ENTITY HANDLERS ---
  const handleNpcCreated = (newNpcData: Omit<NPC, 'id'>) => {
    const newNpc: NPC = { ...newNpcData, id: crypto.randomUUID() };
    setCampaign(prev => produce(prev, draft => { if (draft) draft.npcs.push(newNpc); }));
    setActiveGenerator(null);
    setSelectedNpcId(newNpc.id);
  };

  const handleUpdateNpc = (id: string, updatedData: Partial<NPC>) => {
      setCampaign(prev => produce(prev, draft => {
          if (!draft) return;
          const npcIndex = draft.npcs.findIndex(n => n.id === id);
          if (npcIndex === -1) return;
          const oldNpc = draft.npcs[npcIndex];
          const oldFactionId = oldNpc.factionId;
          Object.assign(oldNpc, updatedData);
          const newFactionId = draft.npcs[npcIndex].factionId;

          if (oldFactionId !== newFactionId) {
              if (oldFactionId) {
                  const oldFaction = draft.factions.find(f => f.id === oldFactionId);
                  if (oldFaction) oldFaction.memberIds = oldFaction.memberIds.filter(memberId => memberId !== id);
              }
              if (newFactionId) {
                  const newFaction = draft.factions.find(f => f.id === newFactionId);
                  if (newFaction && !newFaction.memberIds.includes(id)) newFaction.memberIds.push(id);
              }
          }
      }));
  };

  const handleDeleteNpc = (id: string) => {
    setCampaign(prev => produce(prev, draft => {
        if (!draft) return;
        draft.npcs = draft.npcs.filter(n => n.id !== id);
        draft.adventures.forEach(adv => {
            adv.scenes.forEach(scene => {
                scene.npcIds = scene.npcIds.filter(npcId => npcId !== id);
            });
        });
    }));
    if (selectedNpcId === id) setSelectedNpcId(null);
  };

  const handleLocationCreated = (newLocationData: Omit<Location, 'id'>) => {
    const newLocation: Location = { ...newLocationData, id: crypto.randomUUID() };
    setCampaign(prev => produce(prev, draft => { if(draft) draft.locations.push(newLocation) }));
    setActiveGenerator(null);
    setSelectedLocationId(newLocation.id);
  };
  
  const handleUpdateLocation = (id: string, updatedData: Partial<Location>) => {
    setCampaign(prev => produce(prev, draft => {
        if (!draft) return;
        const locIndex = draft.locations.findIndex(l => l.id === id);
        if (locIndex === -1) return;
        const oldLoc = { ...draft.locations[locIndex] };
        Object.assign(draft.locations[locIndex], updatedData);
        const newLoc = draft.locations[locIndex];

        if (oldLoc.parentLocationId !== newLoc.parentLocationId) {
          if (oldLoc.parentLocationId) {
            const oldParent = draft.locations.find(p => p.id === oldLoc.parentLocationId);
            if (oldParent) oldParent.subLocationIds = oldParent.subLocationIds.filter(subId => subId !== id);
          }
          if (newLoc.parentLocationId) {
            const newParent = draft.locations.find(p => p.id === newLoc.parentLocationId);
            if (newParent && !newParent.subLocationIds.includes(id)) newParent.subLocationIds.push(id);
          }
        }
    }));
  };
  
  const handleFactionCreated = (newFactionData: Omit<Faction, 'id'>) => {
    const newFaction: Faction = { ...newFactionData, id: crypto.randomUUID() };
    setCampaign(prev => produce(prev, draft => { if(draft) draft.factions.push(newFaction) }));
    setActiveGenerator(null);
    setSelectedFactionId(newFaction.id);
  };

  const handleUpdateFaction = (id: string, updatedData: Partial<Faction>) => {
    setCampaign(prev => produce(prev, draft => {
        if (!draft) return;
        const faction = draft.factions.find(f => f.id === id);
        if (faction) Object.assign(faction, updatedData);
    }));
  };

  const handleDeleteFaction = (id: string) => {
    setCampaign(prev => produce(prev, draft => {
      if (!draft) return;
      draft.factions = draft.factions.filter(f => f.id !== id);
      draft.npcs.forEach(npc => { if (npc.factionId === id) npc.factionId = undefined; });
    }));
    if (selectedFactionId === id) setSelectedFactionId(null);
  };
  
  const handleItemCreated = (newItemData: Omit<Item, 'id'>) => {
    const newItem: Item = { ...newItemData, id: crypto.randomUUID() };
    setCampaign(prev => produce(prev, draft => { if (draft) draft.items.push(newItem); }));
    setActiveGenerator(null);
    setSelectedItemId(newItem.id);
  };

  const handleUpdateItem = (id: string, updatedData: Partial<Item>) => {
    setCampaign(prev => produce(prev, draft => {
        if (!draft) return;
        const item = draft.items.find(i => i.id === id);
        if (item) Object.assign(item, updatedData);
    }));
  };

  const handleDeleteItem = (id: string) => {
    setCampaign(prev => produce(prev, draft => { if (draft) draft.items = draft.items.filter(i => i.id !== id); }));
    if (selectedItemId === id) setSelectedItemId(null);
  };

  // --- ADVENTURE & SCENE HANDLERS ---
  const handleAdventureCreated = (adventureData: Omit<Adventure, 'id' | 'scenes'>) => {
    const newAdventure: Adventure = { ...adventureData, id: crypto.randomUUID(), scenes: [] };
    setCampaign(prev => produce(prev, draft => { if (draft) draft.adventures.push(newAdventure); }));
    setActiveGenerator(null);
    setSelectedAdventureId(newAdventure.id);
  };

  const handleUpdateAdventure = (id: string, updatedData: Partial<Adventure>) => {
    setCampaign(prev => produce(prev, draft => {
        if (!draft) return;
        const adventure = draft.adventures.find(a => a.id === id);
        if (adventure) Object.assign(adventure, updatedData);
    }));
  };

  const handleSceneCreated = (adventureId: string, newSceneData: Omit<Scene, 'id'>) => {
    const newScene: Scene = { ...newSceneData, id: crypto.randomUUID() };
    setCampaign(prev => produce(prev, draft => {
        if (!draft) return;
        const adventure = draft.adventures.find(a => a.id === adventureId);
        if (adventure) adventure.scenes.push(newScene);
    }));
    setActiveGenerator(null);
    setSelectedSceneId(newScene.id);
  };

  const handleUpdateScene = (adventureId: string, sceneId: string, updatedData: Partial<Scene>) => {
    setCampaign(prev => produce(prev, draft => {
        if (!draft) return;
        const adventure = draft.adventures.find(a => a.id === adventureId);
        if (!adventure) return;
        const scene = adventure.scenes.find(s => s.id === sceneId);
        if (scene) Object.assign(scene, updatedData);
    }));
  };

  const handleDeleteScene = (adventureId: string, sceneId: string) => {
    setCampaign(prev => produce(prev, draft => {
        if (!draft) return;
        const adventure = draft.adventures.find(a => a.id === adventureId);
        if (adventure) adventure.scenes = adventure.scenes.filter(s => s.id !== sceneId);
    }));
    if (selectedSceneId === sceneId) setSelectedSceneId(null);
  };

  const handleReorderScene = (adventureId: string, draggedSceneId: string, targetSceneId: string) => {
    setCampaign(prev => produce(prev, draft => {
        if (!draft) return;
        const adventure = draft.adventures.find(a => a.id === adventureId);
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
    setCampaign(prev => produce(prev, draft => {
        if (!draft) return;
        
        // 1. Create all new entities and add them to the campaign draft
        const newNpcs = data.npcs.map(npcData => ({ ...npcData, id: crypto.randomUUID(), knowsPlayerHistory: [] }));
        const newLocations = data.locations.map(locData => ({ ...locData, id: crypto.randomUUID(), subLocationIds: [] }));
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

        draft.npcs.push(...newNpcs);
        draft.locations.push(...newLocations);
        draft.factions.push(...newFactions);
        draft.items.push(...newItems);
        draft.adventures.push(...newAdventures);

        // 2. Update existing entities with links from the new entities
        newNpcs.forEach(npc => {
            if (npc.factionId) {
                const faction = draft.factions.find(f => f.id === npc.factionId);
                if (faction) {
                    faction.memberIds.push(npc.id);
                }
            }
        });

        newLocations.forEach(loc => {
            if (loc.parentLocationId) {
                const parent = draft.locations.find(p => p.id === loc.parentLocationId);
                if (parent) {
                    parent.subLocationIds.push(loc.id);
                }
            }
        });
    }));
    setIsWizardOpen(false);
  };

  // --- Memos for selected items ---
  const selectedAdventure = useMemo(() => campaign?.adventures.find(a => a.id === selectedAdventureId) || null, [campaign, selectedAdventureId]);
  const selectedScene = useMemo(() => selectedAdventure?.scenes.find(s => s.id === selectedSceneId) || null, [selectedAdventure, selectedSceneId]);
  const selectedNpc = useMemo(() => campaign?.npcs.find(n => n.id === selectedNpcId) || null, [campaign, selectedNpcId]);
  const selectedLocation = useMemo(() => campaign?.locations.find(l => l.id === selectedLocationId) || null, [campaign, selectedLocationId]);
  const selectedFaction = useMemo(() => campaign?.factions.find(f => f.id === selectedFactionId) || null, [campaign, selectedFactionId]);
  const selectedItem = useMemo(() => campaign?.items.find(i => i.id === selectedItemId) || null, [campaign, selectedItemId]);
  
  const handleSelectView = (view: EditorView) => {
    setActiveView(view);
    resetSelections();
  };

  const renderMainContent = () => {
      if (!campaign) return null;

      // Render Generators
      if (activeGenerator === 'npc') return <ContentWrapper title="Generate New NPC"><NpcGenerator onNpcCreated={handleNpcCreated} isMockMode={isMockMode} /></ContentWrapper>;
      if (activeGenerator === 'location') return <ContentWrapper title="Generate New Location"><LocationGenerator onLocationCreated={handleLocationCreated} isMockMode={isMockMode} /></ContentWrapper>;
      if (activeGenerator === 'faction') return <ContentWrapper title="Generate New Faction"><FactionGenerator onFactionCreated={handleFactionCreated} isMockMode={isMockMode} /></ContentWrapper>;
      if (activeGenerator === 'item') return <ContentWrapper title="Generate New Item"><ItemGenerator onItemCreated={handleItemCreated} isMockMode={isMockMode} /></ContentWrapper>;
      if (activeGenerator === 'adventure') return <ContentWrapper title="Create New Adventure"><AdventureCreator onAdventureCreated={handleAdventureCreated} /></ContentWrapper>;
      if (activeGenerator === 'scene' && selectedAdventure) return <ContentWrapper title="Create New Scene"><SceneGenerator onSceneCreated={(s) => handleSceneCreated(selectedAdventure.id, s)} isMockMode={isMockMode} /></ContentWrapper>;

      // Render Editors
      if (selectedScene && selectedAdventure) return <SceneEditor scene={selectedScene} allNpcs={campaign.npcs} allLocations={campaign.locations} onUpdate={(id, data) => handleUpdateScene(selectedAdventure.id, id, data)} onDelete={(id) => handleDeleteScene(selectedAdventure.id, id)} isMockMode={isMockMode} />;
      if (selectedAdventure) return <AdventureEditor adventure={selectedAdventure} campaign={campaign} onUpdate={handleUpdateAdventure} />;
      if (selectedNpc) return <NpcEditor npc={selectedNpc} factions={campaign.factions} onUpdate={handleUpdateNpc} onDelete={handleDeleteNpc} isMockMode={isMockMode} />;
      if (selectedLocation) return <LocationEditor location={selectedLocation} allLocations={campaign.locations} onUpdate={handleUpdateLocation} isMockMode={isMockMode} />;
      if (selectedFaction) return <FactionEditor faction={selectedFaction} allNpcs={campaign.npcs} onUpdate={handleUpdateFaction} onDelete={handleDeleteFaction} isMockMode={isMockMode} />;
      if (selectedItem) return <ItemEditor item={selectedItem} onUpdate={handleUpdateItem} onDelete={handleDeleteItem} isMockMode={isMockMode} />;

      // Render Top-Level Views
      if (activeView === 'setting') return <CampaignSettingEditor campaign={campaign} onUpdate={handleUpdateCampaign} />;

      // Fallback Placeholders
      const placeholders = {
        npcs: { icon: "NPCs", text: "Select an NPC from the sidebar to edit them, or create a new one." },
        locations: { icon: "Locations", text: "Select a location from the sidebar to edit it, or create a new one." },
        factions: { icon: "Factions", text: "Select a faction from the sidebar to edit it, or create a new one." },
        items: { icon: "Items", text: "Select an item from the sidebar to edit it, or create a new one." },
        adventures: { icon: "Adventures", text: "Select an adventure or scene from the sidebar to edit it, or create a new one." },
      };
      
      // FIX: The original check `activeView !== 'setting'` was redundant and caused a type error.
      // Using `in` provides a safe type guard to check if activeView is a key in placeholders.
      if (activeView in placeholders) {
          const { icon, text } = placeholders[activeView as keyof typeof placeholders];
          return <EditorPlaceholder icon={icon as keyof typeof Icons} text={text} />;
      }

      return <EditorPlaceholder icon="Campaign" text="Select an item from the sidebar to get started." />;
  };

  const renderApp = () => {
    switch(appStatus) {
      case 'welcome':
        return <WelcomeScreen onStart={() => setAppStatus('creating')} />;
      case 'creating':
        return <CampaignCreator onCreateCampaign={handleCreateCampaign} />;
      case 'editing':
        if (campaign) {
          return (
            <div className="flex-1 flex overflow-hidden">
              <CampaignSidebar
                campaign={campaign}
                activeView={activeView}
                onSelectView={handleSelectView}
                selectedIds={{
                  adventure: selectedAdventureId,
                  scene: selectedSceneId,
                  npc: selectedNpcId,
                  location: selectedLocationId,
                  faction: selectedFactionId,
                  item: selectedItemId,
                }}
                onSelect={(type, id) => {
                  resetSelections();
                  setActiveView(type === 'scene' || type === 'adventure' ? 'adventures' : type as EditorView);
                  if (type === 'adventure') setSelectedAdventureId(id);
                  if (type === 'scene') setSelectedSceneId(id);
                  if (type === 'npc') setSelectedNpcId(id);
                  if (type === 'location') setSelectedLocationId(id);
                  if (type === 'faction') setSelectedFactionId(id);
                  if (type === 'item') setSelectedItemId(id);
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
      default:
        return <WelcomeScreen onStart={() => setAppStatus('creating')} />;
    }
  };

  return (
    <div className="bg-slate-950 text-slate-200 h-screen flex flex-col font-sans">
      <Header 
        isMockMode={isMockMode} 
        onToggleMockMode={() => setIsMockMode(p => !p)} 
        onToggleCoach={() => setIsCoachOpen(p => !p)}
        onToggleWizard={() => setIsWizardOpen(true)}
      />
      <div className="flex-1 overflow-hidden flex relative">
        {renderApp()}
        {isCoachOpen && campaign && ( <DmCoach campaign={campaign} onClose={() => setIsCoachOpen(false)} isMockMode={isMockMode} /> )}
        {isWizardOpen && campaign && ( <EvocationWizard campaign={campaign} onClose={() => setIsWizardOpen(false)} onAddToCampaign={handleBatchAddToCampaign} isMockMode={isMockMode} /> )}
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