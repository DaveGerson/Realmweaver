
import type { Campaign, Adventure, NPC, Location, Item, Scene, Faction, BatchAddData, AdventureForBatchAdd, Article } from './types/index';
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
import { createCampaignStore } from './services/campaignService';

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
    
    // Use an isolated instance of the campaign service for testing
    const testService = createCampaignStore();
    // Override init to prevent localStorage side-effects and start fresh
    testService.init = () => {
        // This is a bit of a hack to reset state without exposing a reset method
        // In a real app, the factory might take an initial state.
        testService._updateState(draft => {
            draft.campaigns = [];
            draft.activeCampaignId = null;
            draft.appStatus = 'welcome';
        });
    };
    testService.init();

    let success = true;

    // --- State Accessors ---
    const getActiveCampaign = () => testService.getActiveCampaign();
    const findNpcByName = (name: string) => getActiveCampaign()?.npcs.find(e => e.name === name);
    const findFactionByName = (name: string) => getActiveCampaign()?.factions.find(e => e.name === name);
    const findLocationByName = (name: string) => getActiveCampaign()?.locations.find(e => e.name === name);
    
    try {
        // --- Test Execution ---
        testService.createCampaign('Full Lifecycle Test Campaign', 'A world for testing the whole data flow.');
        const { campaigns } = testService.getState();
        success &&= testLog(campaigns.length === 1, '1. Campaign Creation', 'createCampaign failed');

        // 2. Batch Add & Relationship Resolution
        const mockData = await generateCampaignFill('full test', { npcs: true, locations: true, factions: true, adventures: true, items: true }, true);
        testService.batchAddToCampaign(mockData);
        
        const elara = findNpcByName('Elara');
        const kaelen = findNpcByName('Kaelen');
        const emeraldEnclave = findFactionByName('The Emerald Enclave');
        const shadowSyndicate = findFactionByName('The Shadow Syndicate');
        const sunkenTemple = findLocationByName('The Sunken Temple');
        const tidalChamber = findLocationByName('The Tidal Chamber');
        const adventure = getActiveCampaign()?.adventures[0];

        success &&= testLog(!!(elara && emeraldEnclave && elara.factionId === emeraldEnclave.id), '2a. NPC-Faction Link (Elara)', 'Elara faction link failed');
        success &&= testLog(!!(elara && emeraldEnclave && emeraldEnclave.memberIds.includes(elara.id)), '2b. Faction-NPC Link (Enclave)', 'Enclave member link failed');
        success &&= testLog(!!(kaelen && shadowSyndicate && kaelen.factionId === shadowSyndicate.id), '2c. NPC-Faction Link (Kaelen)', 'Kaelen faction link failed');
        success &&= testLog(!!(kaelen && shadowSyndicate && shadowSyndicate.memberIds.includes(kaelen.id)), '2d. Faction-NPC Link (Syndicate)', 'Syndicate member link failed');
        success &&= testLog(!!(tidalChamber && sunkenTemple && tidalChamber.parentLocationId === sunkenTemple.id), '2e. Location Hierarchy (Child)', 'Child location parent link failed');
        success &&= testLog(!!(sunkenTemple && tidalChamber && sunkenTemple.subLocationIds.includes(tidalChamber.id)), '2f. Location Hierarchy (Parent)', 'Parent location sub-location link failed');
        success &&= testLog(!!(adventure && sunkenTemple && adventure.scenes[0].locationId === sunkenTemple.id), '2g. Scene-Location Link', 'Scene location link failed');
        success &&= testLog(!!(adventure && elara && adventure.scenes[0].npcIds[0] === elara.id), '2h. Scene-NPC Link', 'Scene NPC link failed');
        
        // 3. Update & Relinking
        if (elara && shadowSyndicate) {
          testService.updateNpc(elara.id, { factionId: shadowSyndicate.id });
        }
        const updatedElara = findNpcByName('Elara');
        const updatedEnclave = findFactionByName('The Emerald Enclave');
        const updatedSyndicate = findFactionByName('The Shadow Syndicate');
        success &&= testLog(!!(updatedElara && shadowSyndicate && updatedElara.factionId === shadowSyndicate.id), '3a. NPC Faction Update', 'NPC factionId did not update');
        success &&= testLog(!!(elara && updatedEnclave && !updatedEnclave.memberIds.includes(elara.id)), '3b. Old Faction Cleanup', 'Old faction did not remove member');
        success &&= testLog(!!(elara && updatedSyndicate && updatedSyndicate.memberIds.includes(elara.id)), '3c. New Faction Update', 'New faction did not add member');

        // 4. Deletion & Cleanup
        if (shadowSyndicate) {
          testService.deleteFaction(shadowSyndicate.id);
        }
        const deletedSyndicate = findFactionByName('The Shadow Syndicate');
        const cleanedKaelen = findNpcByName('Kaelen');
        const cleanedElara = findNpcByName('Elara');
        success &&= testLog(!deletedSyndicate, '4a. Faction Deletion', 'Faction was not deleted');
        success &&= testLog(!!(cleanedKaelen && cleanedKaelen.factionId === undefined), '4b. Faction Deletion Cleanup (Kaelen)', 'Kaelen was not unassigned from deleted faction');
        success &&= testLog(!!(cleanedElara && cleanedElara.factionId === undefined), '4c. Faction Deletion Cleanup (Elara)', 'Elara was not unassigned from deleted faction');
        
        if (sunkenTemple) {
            testService.deleteLocation(sunkenTemple.id); // Delete the parent
        }
        const deletedTemple = findLocationByName('The Sunken Temple');
        const cleanedTidalChamber = findLocationByName('The Tidal Chamber');
        success &&= testLog(!deletedTemple, '4d. Location Deletion', 'Parent location was not deleted');
        success &&= testLog(!!(cleanedTidalChamber && cleanedTidalChamber.parentLocationId === undefined), '4e. Parent Location Deletion Cleanup', 'Child location was not un-parented');

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
