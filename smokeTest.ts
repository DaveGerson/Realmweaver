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
    console.groupCollapsed('Smoke Test: App State Handlers');
    let campaign: Campaign | null = null;
    let success = true;

    try {
        // --- Handlers (mirroring App.tsx logic) ---
        const handleCreateCampaign = (title: string, setting: string) => {
            campaign = { id: crypto.randomUUID(), title, setting, articles: [], adventures: [], npcs: [], locations: [], factions: [], items: [] };
        };
        const handleUpdateCampaign = (updatedData: Partial<Campaign>) => {
            campaign = produce(campaign, draft => { if (draft) Object.assign(draft, updatedData) });
        };
        const handleNpcCreated = (newNpcData: Omit<NPC, 'id'>) => {
            const newNpc: NPC = { ...newNpcData, id: crypto.randomUUID() };
            campaign = produce(campaign, draft => { if (draft) draft.npcs.push(newNpc); });
            return newNpc;
        };
        const handleUpdateNpc = (id: string, updatedData: Partial<NPC>) => {
            campaign = produce(campaign, draft => {
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
            });
        };
         const handleDeleteNpc = (id: string) => {
            campaign = produce(campaign, draft => { if (draft) draft.npcs = draft.npcs.filter(n => n.id !== id); });
        };
        const handleLocationCreated = (newLocationData: Omit<Location, 'id'>) => {
            const newLocation: Location = { ...newLocationData, id: crypto.randomUUID() };
            campaign = produce(campaign, draft => { if(draft) draft.locations.push(newLocation) });
            return newLocation;
        };
         const handleUpdateLocation = (id: string, updatedData: Partial<Location>) => {
            campaign = produce(campaign, draft => {
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
            });
        };
        const handleFactionCreated = (newFactionData: Omit<Faction, 'id'>) => {
            const newFaction: Faction = { ...newFactionData, id: crypto.randomUUID() };
            campaign = produce(campaign, draft => { if(draft) draft.factions.push(newFaction) });
            return newFaction;
        };
         const handleDeleteFaction = (id: string) => {
            campaign = produce(campaign, draft => {
              if (!draft) return;
              draft.factions = draft.factions.filter(f => f.id !== id);
              draft.npcs.forEach(npc => { if (npc.factionId === id) npc.factionId = undefined; });
            });
        };
        const handleItemCreated = (newItemData: Omit<Item, 'id'>) => {
            const newItem: Item = { ...newItemData, id: crypto.randomUUID() };
            campaign = produce(campaign, draft => { if (draft) draft.items.push(newItem); });
            return newItem;
        };
        const handleDeleteItem = (id: string) => {
            campaign = produce(campaign, draft => { if (draft) draft.items = draft.items.filter(i => i.id !== id); });
        };
        const handleArticleCreated = (newArticleData: Omit<Article, 'id'>) => {
            const newArticle: Article = { ...newArticleData, id: crypto.randomUUID() };
            campaign = produce(campaign, draft => { if (draft) draft.articles.push(newArticle); });
            return newArticle;
        };
        const handleUpdateArticle = (id: string, updatedData: Partial<Article>) => {
            campaign = produce(campaign, draft => {
                if (!draft) return;
                const articleIndex = draft.articles.findIndex(a => a.id === id);
                if (articleIndex === -1) return;
                const oldArticle = { ...draft.articles[articleIndex] };
                Object.assign(draft.articles[articleIndex], updatedData);
                const newArticle = draft.articles[articleIndex];
                if (oldArticle.parentArticleId !== newArticle.parentArticleId) {
                    if (oldArticle.parentArticleId) {
                        const oldParent = draft.articles.find(p => p.id === oldArticle.parentArticleId);
                        if (oldParent) oldParent.subArticleIds = oldParent.subArticleIds.filter(subId => subId !== id);
                    }
                    if (newArticle.parentArticleId) {
                        const newParent = draft.articles.find(p => p.id === newArticle.parentArticleId);
                        if (newParent && !newParent.subArticleIds.includes(id)) newParent.subArticleIds.push(id);
                    }
                }
            });
        };
        const handleDeleteArticle = (id: string) => {
            campaign = produce(campaign, draft => {
                if (!draft) return;
                const article = draft.articles.find(a => a.id === id);
                if (!article) return;
                if (article.parentArticleId) {
                    const parent = draft.articles.find(p => p.id === article.parentArticleId);
                    if (parent) parent.subArticleIds = parent.subArticleIds.filter(subId => subId !== id);
                }
                article.subArticleIds.forEach(childId => {
                    const child = draft.articles.find(c => c.id === childId);
                    if (child) child.parentArticleId = undefined;
                });
                draft.articles = draft.articles.filter(a => a.id !== id);
            });
        };
        const handleAdventureCreated = (adventureData: Omit<Adventure, 'id' | 'scenes'>) => {
            const newAdventure: Adventure = { ...adventureData, id: crypto.randomUUID(), scenes: [] };
            campaign = produce(campaign, draft => { if (draft) draft.adventures.push(newAdventure); });
            return newAdventure;
        };
        const handleUpdateAdventure = (id: string, updatedData: Partial<Adventure>) => {
            campaign = produce(campaign, draft => {
                if (!draft) return;
                const adventure = draft.adventures.find(a => a.id === id);
                if (adventure) Object.assign(adventure, updatedData);
            });
        };
        const handleSceneCreated = (adventureId: string, newSceneData: Omit<Scene, 'id'>) => {
            const newScene: Scene = { ...newSceneData, id: crypto.randomUUID() };
            campaign = produce(campaign, draft => {
                if (!draft) return;
                const adventure = draft.adventures.find(a => a.id === adventureId);
                if (adventure) adventure.scenes.push(newScene);
            });
            return newScene;
        };
         const handleUpdateScene = (adventureId: string, sceneId: string, updatedData: Partial<Scene>) => {
            campaign = produce(campaign, draft => {
                if (!draft) return;
                const adventure = draft.adventures.find(a => a.id === adventureId);
                if (!adventure) return;
                const scene = adventure.scenes.find(s => s.id === sceneId);
                if (scene) Object.assign(scene, updatedData);
            });
        };
         const handleDeleteScene = (adventureId: string, sceneId: string) => {
            campaign = produce(campaign, draft => {
                if (!draft) return;
                const adventure = draft.adventures.find(a => a.id === adventureId);
                if (adventure) adventure.scenes = adventure.scenes.filter(s => s.id !== sceneId);
            });
        };
         const handleReorderScene = (adventureId: string, draggedSceneId: string, targetSceneId: string) => {
            campaign = produce(campaign, draft => {
                if (!draft) return;
                const adventure = draft.adventures.find(a => a.id === adventureId);
                if (!adventure) return;
                const draggedIndex = adventure.scenes.findIndex(s => s.id === draggedSceneId);
                const targetIndex = adventure.scenes.findIndex(s => s.id === targetSceneId);
                if (draggedIndex > -1 && targetIndex > -1) {
                    const [draggedItem] = adventure.scenes.splice(draggedIndex, 1);
                    adventure.scenes.splice(targetIndex, 0, draggedItem);
                }
            });
        };
        const handleBatchAddToCampaign = (data: BatchAddData) => {
            campaign = produce(campaign, draft => {
                if (!draft) return;
                const newNpcs = data.npcs.map(d => ({ ...d, id: crypto.randomUUID(), knowsPlayerHistory: [] }));
                draft.npcs.push(...newNpcs);
                newNpcs.forEach(npc => {
                    if (npc.factionId) {
                        const faction = draft.factions.find(f => f.id === npc.factionId);
                        if (faction) faction.memberIds.push(npc.id);
                    }
                });
            });
        };

        // --- Test Execution ---
        
        // 1. Creation
        handleCreateCampaign('Test Campaign', 'A world of floating islands.');
        success &&= testLog(!!(campaign && campaign.title === 'Test Campaign'), 'handleCreateCampaign', 'handleCreateCampaign failed');
        
        const npc = handleNpcCreated({ ...(await generateNpc('test npc', false, isMockMode)), factionId: undefined });
        const loc1 = handleLocationCreated({ ...(await generateLocation('loc 1', isMockMode)), parentLocationId: undefined, subLocationIds: [] });
        const loc2 = handleLocationCreated({ ...(await generateLocation('loc 2', isMockMode)), parentLocationId: undefined, subLocationIds: [] });
        const faction = handleFactionCreated({ ...(await generateFaction('test faction', isMockMode)), leaderId: undefined, memberIds: [] });
        const item = handleItemCreated({ ...(await generateItem('test item', isMockMode)) });
        const article1 = handleArticleCreated({ ...(await generateArticle('article 1', isMockMode)), parentArticleId: undefined, subArticleIds: [] });
        const article2 = handleArticleCreated({ ...(await generateArticle('article 2', isMockMode)), parentArticleId: undefined, subArticleIds: [] });
        const adventure = handleAdventureCreated({ title: 'Test Adventure', hook: 'A test', theme: 'testing', level: 1 });
        const scene1 = handleSceneCreated(adventure.id, { ...(await generateScene('scene 1', isMockMode)), locationId: undefined, npcIds: [] });
        const scene2 = handleSceneCreated(adventure.id, { ...(await generateScene('scene 2', isMockMode)), locationId: undefined, npcIds: [] });
        success &&= testLog(
            campaign?.npcs.length === 1 && campaign.locations.length === 2 && campaign.factions.length === 1 && campaign.items.length === 1 && campaign.articles.length === 2 && campaign.adventures.length === 1 && campaign.adventures[0].scenes.length === 2,
            'Entity Creation', 'Entity Creation failed', campaign
        );

        // 2. Updates & Linking
        handleUpdateCampaign({ title: 'New Title' });
        success &&= testLog(campaign?.title === 'New Title', 'handleUpdateCampaign', 'handleUpdateCampaign failed');
        
        handleUpdateNpc(npc.id, { name: 'New NPC Name', factionId: faction.id });
        success &&= testLog(campaign?.npcs[0].name === 'New NPC Name' && campaign?.factions[0].memberIds.includes(npc.id), 'handleUpdateNpc & Linking', 'handleUpdateNpc & Linking failed');

        handleUpdateLocation(loc1.id, { parentLocationId: loc2.id });
        success &&= testLog(campaign?.locations.find(l=>l.id===loc1.id)?.parentLocationId === loc2.id && campaign?.locations.find(l=>l.id===loc2.id)?.subLocationIds.includes(loc1.id), 'handleUpdateLocation & Linking', 'handleUpdateLocation & Linking failed');
        
        handleUpdateArticle(article1.id, { parentArticleId: article2.id });
        success &&= testLog(campaign?.articles.find(a=>a.id===article1.id)?.parentArticleId === article2.id && campaign?.articles.find(a=>a.id===article2.id)?.subArticleIds.includes(article1.id), 'handleUpdateArticle & Linking', 'handleUpdateArticle & Linking failed');

        handleUpdateAdventure(adventure.id, { title: 'New Adventure Title' });
        success &&= testLog(campaign?.adventures[0].title === 'New Adventure Title', 'handleUpdateAdventure', 'handleUpdateAdventure failed');

        handleUpdateScene(adventure.id, scene1.id, { title: 'New Scene Title' });
        success &&= testLog(campaign?.adventures[0].scenes[0].title === 'New Scene Title', 'handleUpdateScene', 'handleUpdateScene failed');

        // 3. Reordering
        handleReorderScene(adventure.id, scene2.id, scene1.id);
        success &&= testLog(campaign?.adventures[0].scenes[0].id === scene2.id, 'handleReorderScene', 'handleReorderScene failed', campaign?.adventures[0].scenes);
        
        // 4. Batch Add
        const batchData: BatchAddData = {
            npcs: [{ ...(await generateNpc('batch npc', false, isMockMode)), factionId: faction.id }],
            locations: [], factions: [], adventures: [], items: [],
        };
        handleBatchAddToCampaign(batchData);
        success &&= testLog(campaign?.npcs.length === 2 && campaign.factions[0].memberIds.length === 2, 'handleBatchAddToCampaign', 'handleBatchAddToCampaign failed', campaign);

        // 5. Deletion & Cleanup
        handleDeleteScene(adventure.id, scene1.id);
        success &&= testLog(campaign?.adventures[0].scenes.length === 1, 'handleDeleteScene', 'handleDeleteScene failed');
        
        handleDeleteArticle(article2.id);
        success &&= testLog(campaign?.articles.length === 1 && campaign?.articles.find(a=>a.id===article1.id)?.parentArticleId === undefined, 'handleDeleteArticle & Cleanup', 'handleDeleteArticle & Cleanup failed');

        handleDeleteItem(item.id);
        success &&= testLog(campaign?.items.length === 0, 'handleDeleteItem', 'handleDeleteItem failed');

        handleDeleteFaction(faction.id);
        success &&= testLog(campaign?.factions.length === 0 && campaign?.npcs.every(n => !n.factionId), 'handleDeleteFaction & Cleanup', 'handleDeleteFaction & Cleanup failed');
        
        handleDeleteNpc(npc.id);
        success &&= testLog(campaign?.npcs.length === 1, 'handleDeleteNpc', 'handleDeleteNpc failed');
        
    } catch(e) {
        console.error('❌ App handler test failed with error:', e);
        success = false;
    }
    console.groupEnd();
    return success;
};

export const runSmokeTests = async (isMockMode: boolean) => {
  // Clear any saved campaign from a previous session to ensure a clean test run.
  localStorage.removeItem('realmweaver-campaign');
  console.log(`%c🚀 Running application smoke tests... (Mock Mode: ${isMockMode})`, 'color: #7c3aed; font-size: 1.2em; font-weight: bold;');
  const servicesOk = await testServiceFunctions(isMockMode);
  const handlersOk = await testCampaignHandlers(isMockMode);
  if (servicesOk && handlersOk) {
    console.log('%c✅ All smoke tests passed.', 'color: #10b981; font-size: 1.2em; font-weight: bold;');
  } else {
    console.log('%c❌ Some smoke tests failed. Check console for details.', 'color: #ef4444; font-size: 1.2em; font-weight: bold;');
  }
};
