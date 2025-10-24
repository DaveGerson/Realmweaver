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
    success &&= testLog(!!(location && location.name && Array.isArray(location.pointsOfInterest)), 'generateLocation: Success', 'generateLocation: Failed', location);
    
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
    console.groupCollapsed('Smoke Test: Full Lifecycle & Relational Logic');
    let campaigns: Campaign[] = [];
    let activeCampaignId: string | null = null;
    let success = true;

    // --- State Accessors ---
    const getActiveCampaign = () => campaigns.find(c => c.id === activeCampaignId);
    const findNpcByName = (name: string) => getActiveCampaign()?.npcs.find(e => e.name === name);
    const findFactionByName = (name: string) => getActiveCampaign()?.factions.find(e => e.name === name);
    const findLocationByName = (name: string) => getActiveCampaign()?.locations.find(e => e.name === name);

    // --- Handlers (mirroring App.tsx logic) ---
    const handleCreateCampaign = (title: string, setting: string) => {
        const newCampaign: Campaign = { id: crypto.randomUUID(), title, setting, articles: [], adventures: [], npcs: [], locations: [], factions: [], items: [] };
        campaigns = produce(campaigns, draft => { draft.push(newCampaign) });
        activeCampaignId = newCampaign.id;
    };
    
    const handleBatchAddToCampaign = (data: BatchAddData) => {
      campaigns = produce(campaigns, draft => {
          const campaign = draft.find(c => c.id === activeCampaignId);
          if (!campaign) return;

          const factionNameMap = new Map<string, string>();
          const locationNameMap = new Map<string, string>();
          const npcNameMap = new Map<string, string>();
          
          campaign.factions.forEach(f => factionNameMap.set(f.name.toLowerCase(), f.id));
          campaign.locations.forEach(l => locationNameMap.set(l.name.toLowerCase(), l.id));
          campaign.npcs.forEach(n => npcNameMap.set(n.name.toLowerCase(), n.id));

          const newFactions = data.factions.map(d => ({ ...d, id: crypto.randomUUID(), memberIds: [] }));
          newFactions.forEach(e => factionNameMap.set(e.name.toLowerCase(), e.id));
          
          const newLocations = data.locations.map(d => ({ ...d, id: crypto.randomUUID(), subLocationIds: [] }));
          newLocations.forEach(e => locationNameMap.set(e.name.toLowerCase(), e.id));
          
          const newNpcs = data.npcs.map(d => ({ ...d, id: crypto.randomUUID(), knowsPlayerHistory: [] }));
          newNpcs.forEach(e => npcNameMap.set(e.name.toLowerCase(), e.id));

          const newItems = data.items.map(d => ({ ...d, id: crypto.randomUUID() }));
          const newAdventures = data.adventures.map(d => ({ ...d, id: crypto.randomUUID(), scenes: d.scenes.map(s => ({...s, id: crypto.randomUUID()})) }));

          campaign.factions.push(...newFactions);
          campaign.locations.push(...newLocations);
          campaign.npcs.push(...newNpcs);
          campaign.items.push(...newItems);
          campaign.adventures.push(...newAdventures);

          campaign.npcs.forEach(npc => {
              const factionName = npc.factionId;
              if (factionName && factionNameMap.has(factionName.toLowerCase())) {
                  const resolvedId = factionNameMap.get(factionName.toLowerCase())!;
                  npc.factionId = resolvedId;
                  const faction = campaign.factions.find(f => f.id === resolvedId);
                  if (faction && !faction.memberIds.includes(npc.id)) faction.memberIds.push(npc.id);
              }
          });

          campaign.locations.forEach(loc => {
              const parentName = loc.parentLocationId;
              if (parentName && locationNameMap.has(parentName.toLowerCase())) {
                  const resolvedId = locationNameMap.get(parentName.toLowerCase())!;
                  loc.parentLocationId = resolvedId;
                  const parent = campaign.locations.find(p => p.id === resolvedId);
                  if (parent && !parent.subLocationIds.includes(loc.id)) parent.subLocationIds.push(loc.id);
              }
          });
          
          campaign.adventures.forEach(adv => {
            adv.scenes.forEach(scene => {
                const locName = scene.locationId;
                if(locName && locationNameMap.has(locName.toLowerCase())) {
                    scene.locationId = locationNameMap.get(locName.toLowerCase());
                }
                if(scene.npcIds) {
                    scene.npcIds = scene.npcIds.map(name => npcNameMap.get(name.toLowerCase()) || name);
                }
            })
          })
      });
    };

    const handleUpdateNpc = (id: string, updatedData: Partial<NPC>) => {
       campaigns = produce(campaigns, draft => {
          const campaign = draft.find(c => c.id === activeCampaignId);
          if (!campaign) return;
          const npc = campaign.npcs.find(n => n.id === id);
          if(!npc) return;
          
          const oldFactionId = npc.factionId;
          Object.assign(npc, updatedData);
          const newFactionId = npc.factionId;

          if (oldFactionId !== newFactionId) {
              if (oldFactionId) {
                  const oldFaction = campaign.factions.find(f => f.id === oldFactionId);
                  if (oldFaction) oldFaction.memberIds = oldFaction.memberIds.filter(mId => mId !== id);
              }
              if (newFactionId) {
                  const newFaction = campaign.factions.find(f => f.id === newFactionId);
                  if (newFaction && !newFaction.memberIds.includes(id)) newFaction.memberIds.push(id);
              }
          }
      });
    };

    const handleDeleteFaction = (id: string) => {
        campaigns = produce(campaigns, draft => {
            const c = draft.find(c => c.id === activeCampaignId);
            if (!c) return;
            c.factions = c.factions.filter(f => f.id !== id);
            c.npcs.forEach(npc => { if (npc.factionId === id) npc.factionId = undefined; });
        });
    };

     const handleDeleteLocation = (id: string) => {
        campaigns = produce(campaigns, draft => {
            const campaign = draft.find(c => c.id === activeCampaignId);
            if (!campaign) return;
            const locToDelete = campaign.locations.find(l => l.id === id);
            if (!locToDelete) return;
            if (locToDelete.parentLocationId) {
                const parent = campaign.locations.find(p => p.id === locToDelete.parentLocationId);
                if (parent) parent.subLocationIds = parent.subLocationIds.filter(subId => subId !== id);
            }
            locToDelete.subLocationIds.forEach(childId => {
                const child = campaign.locations.find(c => c.id === childId);
                if (child) child.parentLocationId = undefined;
            });
            campaign.locations = campaign.locations.filter(l => l.id !== id);
        });
    };

    try {
        // --- Test Execution ---
        handleCreateCampaign('Full Lifecycle Test Campaign', 'A world for testing the whole data flow.');
        success &&= testLog(campaigns.length === 1, '1. Campaign Creation', 'handleCreateCampaign failed');

        // 2. Batch Add & Relationship Resolution
        const mockData = await generateCampaignFill('full test', { npcs: true, locations: true, factions: true, adventures: true, items: true }, true);
        handleBatchAddToCampaign(mockData);
        
        const elara = findNpcByName('Elara');
        const kaelen = findNpcByName('Kaelen');
        const emeraldEnclave = findFactionByName('The Emerald Enclave');
        const shadowSyndicate = findFactionByName('The Shadow Syndicate');
        const sunkenTemple = findLocationByName('The Sunken Temple');
        const tidalChamber = findLocationByName('The Tidal Chamber');
        const adventure = getActiveCampaign()?.adventures[0];

        success &&= testLog(elara?.factionId === emeraldEnclave?.id, '2a. NPC-Faction Link (Elara)', 'Elara faction link failed');
        success &&= testLog(emeraldEnclave?.memberIds.includes(elara!.id) === true, '2b. Faction-NPC Link (Enclave)', 'Enclave member link failed');
        success &&= testLog(kaelen?.factionId === shadowSyndicate?.id, '2c. NPC-Faction Link (Kaelen)', 'Kaelen faction link failed');
        success &&= testLog(shadowSyndicate?.memberIds.includes(kaelen!.id) === true, '2d. Faction-NPC Link (Syndicate)', 'Syndicate member link failed');
        success &&= testLog(tidalChamber?.parentLocationId === sunkenTemple?.id, '2e. Location Hierarchy (Child)', 'Child location parent link failed');
        success &&= testLog(sunkenTemple?.subLocationIds.includes(tidalChamber!.id) === true, '2f. Location Hierarchy (Parent)', 'Parent location sub-location link failed');
        success &&= testLog(adventure?.scenes[0].locationId === sunkenTemple?.id, '2g. Scene-Location Link', 'Scene location link failed');
        success &&= testLog(adventure?.scenes[0].npcIds[0] === elara?.id, '2h. Scene-NPC Link', 'Scene NPC link failed');
        
        // 3. Update & Relinking
        handleUpdateNpc(elara!.id, { factionId: shadowSyndicate!.id });
        const updatedElara = findNpcByName('Elara');
        const updatedEnclave = findFactionByName('The Emerald Enclave');
        const updatedSyndicate = findFactionByName('The Shadow Syndicate');
        success &&= testLog(updatedElara?.factionId === shadowSyndicate!.id, '3a. NPC Faction Update', 'NPC factionId did not update');
        success &&= testLog(updatedEnclave?.memberIds.includes(elara!.id) === false, '3b. Old Faction Cleanup', 'Old faction did not remove member');
        success &&= testLog(updatedSyndicate?.memberIds.includes(elara!.id) === true, '3c. New Faction Update', 'New faction did not add member');

        // 4. Deletion & Cleanup
        handleDeleteFaction(shadowSyndicate!.id);
        const deletedSyndicate = findFactionByName('The Shadow Syndicate');
        const cleanedKaelen = findNpcByName('Kaelen');
        const cleanedElara = findNpcByName('Elara');
        success &&= testLog(!deletedSyndicate, '4a. Faction Deletion', 'Faction was not deleted');
        success &&= testLog(cleanedKaelen?.factionId === undefined, '4b. Faction Deletion Cleanup (Kaelen)', 'Kaelen was not unassigned from deleted faction');
        success &&= testLog(cleanedElara?.factionId === undefined, '4c. Faction Deletion Cleanup (Elara)', 'Elara was not unassigned from deleted faction');
        
        handleDeleteLocation(sunkenTemple!.id); // Delete the parent
        const deletedTemple = findLocationByName('The Sunken Temple');
        const cleanedTidalChamber = findLocationByName('The Tidal Chamber');
        success &&= testLog(!deletedTemple, '4d. Location Deletion', 'Parent location was not deleted');
        success &&= testLog(cleanedTidalChamber?.parentLocationId === undefined, '4e. Parent Location Deletion Cleanup', 'Child location was not un-parented');

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