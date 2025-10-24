

import type { Campaign, NPC, Location, Item, Scene, Faction, BatchAddData, Article, PlayerCharacter } from './types/index';
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
    generatePoiFromLoot,
    parseDocumentForEntities,
    generateChatResponse,
    parseCharacterSheetPdf,
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
  console.groupCollapsed('Smoke Test: Service Functions (Backend Simulation)');
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

    const poi = await generatePoiFromLoot('test loot prompt', undefined, isMockMode);
    success &&= testLog(!!(poi && poi.name && Array.isArray(poi.investigationChecks)), 'generatePoiFromLoot: Success', 'generatePoiFromLoot: Failed', poi);

    const parsedDoc = await parseDocumentForEntities('test doc content', isMockMode);
    success &&= testLog(!!(parsedDoc && parsedDoc.npcs), 'parseDocumentForEntities: Success', 'parseDocumentForEntities: Failed', parsedDoc);

    const chatResponse = await generateChatResponse([{ role: 'user', text: 'test chat' }], undefined, isMockMode);
    success &&= testLog(typeof chatResponse === 'string' && chatResponse.length > 0, 'generateChatResponse: Success', 'generateChatResponse: Failed', chatResponse);

    const parsedPdf = await parseCharacterSheetPdf('mock-base64-pdf', isMockMode);
    success &&= testLog(!!(parsedPdf && parsedPdf.characterSocial.characterName === 'Elowyn'), 'parseCharacterSheetPdf: Success', 'parseCharacterSheetPdf: Failed', parsedPdf);

  } catch (e) {
    console.error('❌ Service function test failed with error:', e);
    success = false;
  }
  console.groupEnd();
  return success;
};

const testCampaignHandlers = async (isMockMode: boolean) => {
    console.groupCollapsed('Smoke Test: State Logic & Relationships (Frontend Simulation)');
    
    // Use an isolated instance of the campaign service for testing
    const testService = createCampaignStore();
    testService.init = () => {
        testService._updateState(draft => {
            draft.campaigns = []; draft.activeCampaignId = null; draft.appStatus = 'welcome';
        });
    };
    testService.init();

    let success = true;

    // --- State Accessors ---
    const getActiveCampaign = () => testService.getActiveCampaign();
    const findNpcByName = (name: string) => getActiveCampaign()?.npcs.find(e => e.name === name);
    const findFactionByName = (name: string) => getActiveCampaign()?.factions.find(e => e.name === name);
    const findLocationByName = (name: string) => getActiveCampaign()?.locations.find(e => e.name === name);
    const findArticleByTitle = (title: string) => getActiveCampaign()?.articles.find(e => e.title === title);
    
    try {
        // --- 1. Setup ---
        testService.createCampaign('Full Lifecycle Test Campaign', 'A world for testing.');
        success &&= testLog(testService.getState().campaigns.length === 1, '1a. Campaign Creation', 'createCampaign failed');
        const mockData = await generateCampaignFill('full test', { npcs: true, locations: true, factions: true, adventures: true, items: true }, true);
        testService.batchAddToCampaign(mockData);
        success &&= testLog(!!getActiveCampaign()?.adventures.length, '1b. Batch Add Data', 'batchAddToCampaign failed');
        
        // --- 2. Manual Creation ---
        const articleId = testService.createArticle({ title: 'Test Article', category: 'history', content: 'History', parentArticleId: undefined, subArticleIds: [] });
        const subArticleId = testService.createArticle({ title: 'Sub Article', category: 'history', content: 'Sub History', parentArticleId: undefined, subArticleIds: [] });
        const itemId = testService.createItem({ name: 'Test Item', description: 'Desc', rarity: 'common', properties: 'Props' });
        success &&= testLog(!!findArticleByTitle('Test Article'), '2a. Article Creation', 'Article creation failed');
        success &&= testLog(!!getActiveCampaign()?.items.find(i => i.id === itemId), '2b. Item Creation', 'Item creation failed');
        
        // --- 3. Link Verification (from Batch Add) ---
        let elara = findNpcByName('Elara');
        const emeraldEnclave = findFactionByName('The Emerald Enclave');
        let sunkenTemple = findLocationByName('The Sunken Temple');
        let tidalChamber = findLocationByName('The Tidal Chamber');
        const adventure = getActiveCampaign()?.adventures[0];
        success &&= testLog(!!(elara && emeraldEnclave && elara.factionId === emeraldEnclave.id && emeraldEnclave.memberIds.includes(elara.id)), '3a. NPC-Faction Link', 'NPC-Faction link failed');
        success &&= testLog(!!(tidalChamber && sunkenTemple && tidalChamber.parentLocationId === sunkenTemple.id && sunkenTemple.subLocationIds.includes(tidalChamber.id)), '3b. Location Hierarchy Link', 'Location hierarchy link failed');
        success &&= testLog(!!(adventure && elara && adventure.scenes[0].npcIds.includes(elara.id)), '3c. Scene-NPC Link', 'Scene NPC link failed');
        success &&= testLog(!!(adventure && sunkenTemple && adventure.scenes[0].locationId === sunkenTemple.id), '3d. Scene-Location Link', 'Scene location link failed');

        // --- 4. Update, Relinking & Edge Cases ---
        const shadowSyndicatePreUpdate = findFactionByName('The Shadow Syndicate');
        if (elara && shadowSyndicatePreUpdate) {
            testService.updateNpc(elara.id, { factionId: shadowSyndicatePreUpdate.id });
        }
        // Re-fetch entities after update to avoid stale references
        const updatedEnclave = findFactionByName('The Emerald Enclave');
        const updatedShadowSyndicate = findFactionByName('The Shadow Syndicate');
        elara = findNpcByName('Elara'); // Re-fetch elara to get updated factionId
        success &&= testLog(!!(updatedEnclave && elara && !updatedEnclave.memberIds.includes(elara.id)), '4a. NPC Faction Update (Old Faction)', 'Old faction did not remove member');
        success &&= testLog(!!(updatedShadowSyndicate && elara && updatedShadowSyndicate.memberIds.includes(elara.id)), '4b. NPC Faction Update (New Faction)', 'New faction did not add member');
        
        testService.updateArticle(subArticleId, { parentArticleId: articleId });
        const parentArticle = findArticleByTitle('Test Article');
        success &&= testLog(!!(parentArticle && parentArticle.subArticleIds.includes(subArticleId)), '4c. Article Hierarchy Update', 'Article hierarchy update failed');
        
        if (sunkenTemple && tidalChamber) {
            const parentIdBefore = sunkenTemple.parentLocationId;
            
            // Temporarily spy on console.error to check if the correct error is logged without polluting the test output.
            const originalConsoleError = console.error;
            let capturedErrorArgs: unknown[] = [];
            console.error = (...args: unknown[]) => {
                capturedErrorArgs = args;
            };
            
            testService.updateLocation(sunkenTemple.id, { parentLocationId: tidalChamber.id }); // This should trigger the error and abort.

            // Restore the original console.error
            console.error = originalConsoleError;

            const updatedSunkenTemple = findLocationByName('The Sunken Temple');

            const stateWasUnchanged = updatedSunkenTemple?.parentLocationId === parentIdBefore;
            const correctErrorWasLogged = capturedErrorArgs.some(arg => 
                typeof arg === 'string' && arg.includes('would create a circular dependency')
            );
            
            success &&= testLog(
                stateWasUnchanged && correctErrorWasLogged,
                '4d. Location Circular Dependency Prevention',
                `Location circular dependency prevention failed. State changed: ${!stateWasUnchanged}, Error logged: ${correctErrorWasLogged}`
            );
        }

        // --- 5. Deletion & Cleanup ---
        if (elara) testService.deleteNpc(elara.id);
        const adventureAfterNpcDelete = getActiveCampaign()?.adventures[0];
        success &&= testLog(!findNpcByName('Elara'), '5a. NPC Deletion', 'NPC was not deleted');
        success &&= testLog(!!(adventureAfterNpcDelete && elara && !adventureAfterNpcDelete.scenes[0].npcIds.includes(elara.id)), '5b. Scene Cleanup on NPC Deletion', 'NPC not removed from scene');

        const shadowSyndicate = findFactionByName('The Shadow Syndicate');
        if (shadowSyndicate) testService.deleteFaction(shadowSyndicate.id);
        const kaelen = findNpcByName('Kaelen');
        success &&= testLog(!findFactionByName('The Shadow Syndicate'), '5c. Faction Deletion', 'Faction was not deleted');
        success &&= testLog(!!(kaelen && kaelen.factionId === undefined), '5d. NPC Cleanup on Faction Deletion', 'NPC not unassigned from deleted faction');

        sunkenTemple = findLocationByName('The Sunken Temple');
        if (sunkenTemple) testService.deleteLocation(sunkenTemple.id);
        const cleanedTidalChamber = findLocationByName('The Tidal Chamber');
        success &&= testLog(!findLocationByName('The Sunken Temple'), '5e. Parent Location Deletion', 'Parent location was not deleted');
        success &&= testLog(!!(cleanedTidalChamber && cleanedTidalChamber.parentLocationId === undefined), '5f. Child Cleanup on Parent Deletion', 'Child location was not un-parented');

    } catch(e) {
        console.error('❌ State handler test failed with error:', e);
        success = false;
    }
    console.groupEnd();
    return success;
};

const testImportExport = async () => {
    console.groupCollapsed('Smoke Test: Import/Export Cycle');
    const testService = createCampaignStore();
    testService.init = () => {
        testService._updateState(draft => {
            draft.campaigns = []; draft.activeCampaignId = null; draft.appStatus = 'welcome';
        });
    };
    testService.init();
    let success = true;

    try {
        testService.createCampaign('Export Test', 'A world to be exported');
        testService.createNpc({ name: 'Export NPC', description: 'desc', traits: 'traits', backstory: 'bs', motivations: 'motive', secrets: 'secret', stats: 'stats', exampleQuote: 'quote', knowsPlayerHistory: [] });
        const originalCampaign = testService.getActiveCampaign();
        if (!originalCampaign) return testLog(false, '', 'Failed to get campaign for export');

        const exportedJson = JSON.stringify(originalCampaign, null, 2);
        success &&= testLog(!!exportedJson, '1. Export to JSON string', 'Export failed');

        const file = new File([exportedJson], "campaign.json", { type: "application/json" });
        await testService.importCampaign(file);
        
        const { campaigns } = testService.getState();
        success &&= testLog(campaigns.length === 2, '2. Campaign Import', 'Campaign count is incorrect after import');
        
        const importedCampaign = campaigns.find(c => c.title === 'Export Test' && c.id !== originalCampaign.id);
        success &&= testLog(!!importedCampaign, '3a. Imported campaign found', 'Could not find imported campaign');
        success &&= testLog(importedCampaign?.npcs.length === 1 && importedCampaign.npcs[0].name === 'Export NPC', '3b. Imported data is correct', 'Imported data is incorrect');

    } catch (e) {
        console.error('❌ Import/Export test failed with error:', e);
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
  const importExportOk = await testImportExport();
  if (servicesOk && handlersOk && importExportOk) {
    console.log('%c✅ All smoke tests passed.', 'color: #10b981; font-size: 1.2em; font-weight: bold;');
  } else {
    console.log('%c❌ Some smoke tests failed. Check console for details.', 'color: #ef4444; font-size: 1.2em; font-weight: bold;');
  }
};