import type { Campaign, Adventure, NPC, Location, Item, Scene, Faction, BatchAddData, AdventureForBatchAdd, Article } from './types';
import { 
    generateNpc, 
    generateLocation, 
    generateItem, 
    generateScene,
    generateFaction,
    generateAdventure,
    generateArticle,
    generateNarration,
    generateImprovisation,
    generateRollableTable,
    generateCampaignFill,
    generateEnhancedText,
} from './services/geminiService';
import { produce } from 'immer';

// --- Helper for logging test results ---
const testLog = (condition: boolean, successMsg: string, failureMsg: string, data?: unknown) => {
  if (condition) {
    console.log(`✅ ${successMsg}`);
  } else {
    console.error(`❌ ${failureMsg}`, data);
  }
  return condition;
};


// --- Test Suites ---

const testServiceFunctions = async (isMockMode: boolean) => {
  console.groupCollapsed('Smoke Test: Service Functions');
  let success = true;
  try {
    const npc = await generateNpc('test npc prompt', false, isMockMode);
    success &&= testLog(!!(npc && npc.name), 'generateNpc: Success', 'generateNpc: Failed', npc);
    
    const location = await generateLocation('test location prompt', isMockMode);
    success &&= testLog(!!(location && location.name), 'generateLocation: Success', 'generateLocation: Failed', location);
    
    const item = await generateItem('test item prompt', isMockMode);
    success &&= testLog(!!(item && item.name), 'generateItem: Success', 'generateItem: Failed', item);

    const scene = await generateScene('test scene prompt', isMockMode);
    success &&= testLog(!!(scene && scene.title && scene.readAloudText), 'generateScene: Success', 'generateScene: Failed', scene);
    
    const faction = await generateFaction('test faction prompt', isMockMode);
    success &&= testLog(!!(faction && faction.name), 'generateFaction: Success', 'generateFaction: Failed', faction);
    
    const adventure = await generateAdventure('test adventure prompt', isMockMode);
    success &&= testLog(!!(adventure && adventure.title && Array.isArray(adventure.scenes)), 'generateAdventure: Success', 'generateAdventure: Failed', adventure);
    
    const article = await generateArticle('test article prompt', isMockMode);
    success &&= testLog(!!(article && article.title && article.content), 'generateArticle: Success', 'generateArticle: Failed', article);

    const narration = await generateNarration('test narration prompt', undefined, false, isMockMode);
    success &&= testLog(typeof narration === 'string' && narration.length > 0, 'generateNarration: Success', 'generateNarration: Failed', narration);

    const improv = await generateImprovisation('test improv prompt', undefined, false, isMockMode);
    success &&= testLog(typeof improv === 'string' && improv.length > 0, 'generateImprovisation: Success', 'generateImprovisation: Failed', improv);

    const table = await generateRollableTable('test table prompt', undefined, false, isMockMode);
    success &&= testLog(!!(table && table.title && Array.isArray(table.entries)), 'generateRollableTable: Success', 'generateRollableTable: Failed', table);

    const fill = await generateCampaignFill('test fill prompt', { npcs: true, locations: true, factions: true, adventures: true, items: true }, isMockMode);
    success &&= testLog(!!(fill && fill.npcs && fill.locations && fill.factions && fill.adventures && fill.items), 'generateCampaignFill: Success', 'generateCampaignFill: Failed', fill);

    const enhancedText = await generateEnhancedText('test enhance prompt', undefined, isMockMode);
    success &&= testLog(typeof enhancedText === 'string' && enhancedText.length > 0, 'generateEnhancedText: Success', 'generateEnhancedText: Failed', enhancedText);

  } catch (e) {
    console.error('❌ Service function test failed with error:', e);
    success = false;
  }
  console.groupEnd();
  return success;
};

const testCampaignHandlers = async (isMockMode: boolean) => {
    console.groupCollapsed('Smoke Test: App State Handlers (Multi-Campaign)');
    let campaigns: Campaign[] = [];
    let activeCampaignId: string | null = null;
    let success = true;

    const getActiveCampaign = () => campaigns.find(c => c.id === activeCampaignId);

    try {
        // --- Handlers (mirroring App.tsx logic) ---
        const handleCreateCampaign = (title: string, setting: string) => {
            const newCampaign: Campaign = { id: crypto.randomUUID(), title, setting, articles: [], adventures: [], npcs: [], locations: [], factions: [], items: [] };
            campaigns = produce(campaigns, draft => { draft.push(newCampaign) });
            activeCampaignId = newCampaign.id;
        };
        const handleUpdateCampaign = (updatedData: Partial<Campaign>) => {
            campaigns = produce(campaigns, draft => {
                const campaignIndex = draft.findIndex(c => c.id === activeCampaignId);
                if (campaignIndex !== -1) Object.assign(draft[campaignIndex], updatedData);
            });
        };
        const handleNpcCreated = (newNpcData: Omit<NPC, 'id'>) => {
            const newNpc: NPC = { ...newNpcData, id: crypto.randomUUID() };
            campaigns = produce(campaigns, draft => {
                const c = draft.find(c => c.id === activeCampaignId);
                if (c) c.npcs.push(newNpc);
            });
            return newNpc;
        };
        const handleUpdateNpc = (id: string, updatedData: Partial<NPC>) => {
            campaigns = produce(campaigns, draft => {
                const c = draft.find(c => c.id === activeCampaignId);
                if (!c) return;
                const npcIndex = c.npcs.findIndex(n => n.id === id);
                if (npcIndex === -1) return;
                Object.assign(c.npcs[npcIndex], updatedData);
            });
        };
         const handleDeleteNpc = (id: string) => {
            campaigns = produce(campaigns, draft => {
                const c = draft.find(c => c.id === activeCampaignId);
                if (c) c.npcs = c.npcs.filter(n => n.id !== id);
            });
        };
        const handleLocationCreated = (newLocationData: Omit<Location, 'id'>) => {
            const newLocation: Location = { ...newLocationData, id: crypto.randomUUID() };
            campaigns = produce(campaigns, draft => {
                const c = draft.find(c => c.id === activeCampaignId);
                if(c) c.locations.push(newLocation);
            });
            return newLocation;
        };
        const handleFactionCreated = (newFactionData: Omit<Faction, 'id'>) => {
            const newFaction: Faction = { ...newFactionData, id: crypto.randomUUID() };
            campaigns = produce(campaigns, draft => {
                const c = draft.find(c => c.id === activeCampaignId);
                if(c) c.factions.push(newFaction);
            });
            return newFaction;
        };
        const handleAdventureCreated = (adventureData: Omit<Adventure, 'id' | 'scenes'>) => {
            const newAdventure: Adventure = { ...adventureData, id: crypto.randomUUID(), scenes: [] };
            campaigns = produce(campaigns, draft => {
                const c = draft.find(c => c.id === activeCampaignId);
                if (c) c.adventures.push(newAdventure);
            });
            return newAdventure;
        };
        const handleSceneCreated = (adventureId: string, newSceneData: Omit<Scene, 'id'>) => {
            const newScene: Scene = { ...newSceneData, id: crypto.randomUUID() };
            campaigns = produce(campaigns, draft => {
                const c = draft.find(c => c.id === activeCampaignId);
                if (!c) return;
                const adventure = c.adventures.find(a => a.id === adventureId);
                if (adventure) adventure.scenes.push(newScene);
            });
            return newScene;
        };
        const handleDeleteCampaign = (id: string) => {
            campaigns = campaigns.filter(c => c.id !== id);
            if (activeCampaignId === id) {
                activeCampaignId = null;
            }
        };

        // --- Test Execution ---
        
        // 1. Creation of first campaign
        handleCreateCampaign('Test Campaign 1', 'A world of floating islands.');
        success &&= testLog(campaigns.length === 1 && campaigns[0].title === 'Test Campaign 1', 'handleCreateCampaign (1)', 'handleCreateCampaign (1) failed');
        success &&= testLog(activeCampaignId === campaigns[0].id, 'Active Campaign set correctly (1)', 'Active Campaign not set (1)');
        
        const npc = handleNpcCreated({ ...(await generateNpc('test npc', false, isMockMode)), factionId: undefined });
        handleLocationCreated({ ...(await generateLocation('loc 1', isMockMode)), parentLocationId: undefined, subLocationIds: [] });
        handleFactionCreated({ ...(await generateFaction('test faction', isMockMode)), leaderId: undefined, memberIds: [] });
        const adventure = handleAdventureCreated({ title: 'Test Adventure', hook: 'A test', theme: 'testing', level: 1 });
        handleSceneCreated(adventure.id, { ...(await generateScene('scene 1', isMockMode)), locationId: undefined, npcIds: [] });
        
        const campaign1 = getActiveCampaign();
        success &&= testLog(
            campaign1?.npcs.length === 1 && campaign1.locations.length === 1 && campaign1.factions.length === 1 && campaign1.adventures.length === 1 && campaign1.adventures[0].scenes.length === 1,
            'Entity Creation (Campaign 1)', 'Entity Creation (Campaign 1) failed', campaign1
        );

        // 2. Create and switch to a second campaign
        handleCreateCampaign('Test Campaign 2', 'An underwater kingdom.');
        success &&= testLog(campaigns.length === 2 && getActiveCampaign()?.title === 'Test Campaign 2', 'handleCreateCampaign (2)', 'handleCreateCampaign (2) failed');
        
        handleNpcCreated({ ...(await generateNpc('merman', false, isMockMode)), factionId: undefined });
        const campaign2 = getActiveCampaign();
        success &&= testLog(campaign2?.npcs.length === 1, 'Entity Creation (Campaign 2)', 'Entity Creation (Campaign 2) failed');
        success &&= testLog(campaigns[0].npcs.length === 1, 'Campaign 1 state preserved', 'Campaign 1 state was mutated');

        // 3. Switch back and update first campaign
        activeCampaignId = campaigns[0].id;
        handleUpdateCampaign({ title: 'New Title for Campaign 1' });
        success &&= testLog(getActiveCampaign()?.title === 'New Title for Campaign 1', 'handleUpdateCampaign', 'handleUpdateCampaign failed');
        
        handleUpdateNpc(npc.id, { name: 'New NPC Name' });
        success &&= testLog(getActiveCampaign()?.npcs[0].name === 'New NPC Name', 'handleUpdateNpc', 'handleUpdateNpc failed');

        // 4. Deletion
        handleDeleteCampaign(campaigns[1].id);
        success &&= testLog(campaigns.length === 1, 'handleDeleteCampaign', 'handleDeleteCampaign failed');
        
        // Switch to a non-existent campaign
        activeCampaignId = 'non-existent';
        success &&= testLog(getActiveCampaign() === undefined, 'Active campaign is correctly undefined after deletion', 'Active campaign was not cleared');
        
        activeCampaignId = campaigns[0].id; // Reset for final check
        handleDeleteNpc(npc.id);
        success &&= testLog(getActiveCampaign()?.npcs.length === 0, 'handleDeleteNpc', 'handleDeleteNpc failed');
        
    } catch(e) {
        console.error('❌ App handler test failed with error:', e);
        success = false;
    }
    console.groupEnd();
    return success;
};

export const runSmokeTests = async (isMockMode: boolean) => {
  // Clear any saved campaign from a previous session to ensure a clean test run.
  localStorage.removeItem('realmweaver-campaigns');
  localStorage.removeItem('realmweaver-active-campaign-id');
  console.log(`%c🚀 Running application smoke tests... (Mock Mode: ${isMockMode})`, 'color: #7c3aed; font-size: 1.2em; font-weight: bold;');
  const servicesOk = await testServiceFunctions(isMockMode);
  const handlersOk = await testCampaignHandlers(isMockMode);
  if (servicesOk && handlersOk) {
    console.log('%c✅ All smoke tests passed.', 'color: #10b981; font-size: 1.2em; font-weight: bold;');
  } else {
    console.log('%c❌ Some smoke tests failed. Check console for details.', 'color: #ef4444; font-size: 1.2em; font-weight: bold;');
  }
};