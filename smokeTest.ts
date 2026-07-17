
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
    chatWithRealmWeaver,
} from './services/aiService';
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
    // 1. Standard Generation
    const npc = await generateNpc('test npc prompt', isMockMode);
    success &&= testLog(!!(npc && npc.name), 'generateNpc: Success', 'generateNpc: Failed', npc);

    const location = await generateLocation('test location prompt', isMockMode);
    success &&= testLog(!!(location && location.name && typeof location.secrets === 'string'), 'generateLocation: Success', 'generateLocation: Failed', location);

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

    // 2. DM Tools & Utilities
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

    // Always test PDF parsing in Mock Mode to ensure logic flow is correct
    if (isMockMode) {
      const parsedPdf = await parseCharacterSheetPdf('mock-base64-pdf', isMockMode);
      success &&= testLog(!!(parsedPdf && parsedPdf.characterSocial.characterName === 'Elowyn'), 'parseCharacterSheetPdf: Success', 'parseCharacterSheetPdf: Failed', parsedPdf);
    } else {
      console.log('... Skipping parseCharacterSheetPdf test in non-mock mode (requires a real PDF file).');
    }

  } catch (e) {
    console.error('❌ Service function test failed with error:', e);
    success = false;
  }
  console.groupEnd();
  return success;
};

const testRealmChat = async (isMockMode: boolean) => {
    console.groupCollapsed('Smoke Test: RealmChat');
    let success = true;
    try {
        // 1. General Chat
        const generalResponse = await chatWithRealmWeaver(
            [{ id: '1', role: 'user', text: 'Hello', timestamp: Date.now() }],
            [],
            [],
            'Mock Context',
            'medium',
            isMockMode
        );
        success &&= testLog(!!(generalResponse.message), 'General Chat Response: Success', 'General Chat Response: Failed', generalResponse);

        // 2. General Chat with Intent
        const intentResponse = await chatWithRealmWeaver(
            [{ id: '2', role: 'user', text: 'Create an NPC', timestamp: Date.now() }],
            [],
            [],
            'Mock Context',
            'medium',
            isMockMode
        );
        success &&= testLog(intentResponse.draftEntities.length > 0, 'Intent Draft Creation: Success', 'Intent Draft Creation: Failed (No draft created)', intentResponse);

        // 3. Focused Chat
        const focusedResponse = await chatWithRealmWeaver(
            [{ id: '3', role: 'user', text: 'Make it scary', timestamp: Date.now() }],
            [],
            [],
            'Mock Context',
            'medium',
            isMockMode,
            'npc'
        );
        success &&= testLog(focusedResponse.draftEntities.some(d => d.type === 'npc'), 'Focused Draft Creation: Success', 'Focused Draft Creation: Failed', focusedResponse);

    } catch (e) {
        console.error('❌ RealmChat test failed with error:', e);
        success = false;
    }
    console.groupEnd();
    return success;
}

const testCampaignHandlers = async (isMockMode: boolean) => {
    console.groupCollapsed('Smoke Test: State Logic & Relationships (Frontend Simulation)');
    
    // Use an isolated, non-persisted instance of the campaign service for testing
    const testService = createCampaignStore({ persist: false });
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
    const findPcByName = (name: string) => getActiveCampaign()?.playerCharacters.find(e => e.characterSocial.characterName === name);
    const findNoteByTitle = (title: string) => getActiveCampaign()?.notes.find(e => e.title === title);
    const findPlotByTitle = (title: string) => getActiveCampaign()?.plots.find(e => e.title === title);
    const findSessionByTitle = (title: string) => getActiveCampaign()?.sessionLogs.find(e => e.title === title);
    
    try {
        // --- 1. Setup & Creation ---
        testService.createCampaign('Full Lifecycle Test Campaign', 'A world for testing.', 'custom');
        success &&= testLog(testService.getState().campaigns.length === 1, '1a. Campaign Creation', 'createCampaign failed');
        
        testService.createCampaign('Official Test', 'Canon Lore', 'official', 'Forgotten Realms');
        const officialC = testService.getActiveCampaign();
        success &&= testLog(!!(officialC && officialC.settingType === 'official' && officialC.officialSetting === 'Forgotten Realms'), '1b. Official Campaign Creation', 'Official campaign creation failed');
        
        // Switch back to first campaign for main tests
        const firstCampaignId = testService.getState().campaigns[0].id;
        testService.selectCampaign(firstCampaignId);
        
        const mockData = await generateCampaignFill('full test', { npcs: true, locations: true, factions: true, adventures: true, items: true }, true);
        testService.batchAddToCampaign(mockData);
        success &&= testLog(!!getActiveCampaign()?.adventures.length, '1c. Batch Add Data', 'batchAddToCampaign failed');
        
        // --- 2. Manual Creation ---
        const articleId = testService.createArticle({ title: 'Test Article', category: 'history', content: 'History', parentArticleId: undefined, subArticleIds: [] });
        const subArticleId = testService.createArticle({ title: 'Sub Article', category: 'history', content: 'Sub History', parentArticleId: undefined, subArticleIds: [] });
        const itemId = testService.createItem({ name: 'Test Item', description: 'Desc', rarity: 'common', properties: 'Props' });
        const noteId = testService.createNote({ title: 'Test Note', content: 'Note Content', tags: [] });
        const pcId = testService.createPlayerCharacter({ playerName: 'TestPlayer', characterSocial: { characterName: 'TestPC' } as any, characterStatistics: { classes: { charClass: 'Fighter', level: 1 } } as any });
        const plotId = testService.createPlot({ title: 'Test Plot', description: 'Plot Desc', status: 'active', relatedEntityIds: [] });
        const sessionId = testService.createSessionLog({ title: 'Test Session', sessionDate: new Date().toISOString(), status: 'planned', plannedSceneIds: [], prepNotes: '', runningNotes: '', structuredNotes: [], relatedPlotIds: [], recap: '', notableEvents: '', looseEnds: '', encounterLog: [] });

        success &&= testLog(!!findArticleByTitle('Test Article'), '2a. Article Creation', 'Article creation failed');
        success &&= testLog(!!getActiveCampaign()?.items.find(i => i.id === itemId), '2b. Item Creation', 'Item creation failed');
        success &&= testLog(!!findNoteByTitle('Test Note'), '2c. Note Creation', 'Note creation failed');
        success &&= testLog(!!findPcByName('TestPC'), '2d. Player Character Creation', 'PC creation failed');
        success &&= testLog(!!findPlotByTitle('Test Plot'), '2e. Plot Creation', 'Plot creation failed');
        success &&= testLog(!!findSessionByTitle('Test Session'), '2f. Session Log Creation', 'Session Log creation failed');
        
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
        
        // Active Scene Test
        const firstSceneId = adventure?.scenes[0].id;
        if (firstSceneId) {
            testService.setActiveScene(firstSceneId);
            success &&= testLog(getActiveCampaign()?.activeSceneId === firstSceneId, '4d. Set Active Scene', 'Active Scene not set');
            testService.setActiveScene(null);
            success &&= testLog(getActiveCampaign()?.activeSceneId === undefined, '4e. Unset Active Scene', 'Active Scene not unset');
        }
        
        // Encounter Update Test
        const encounter = { id: 'e1', round: 2, turnIndex: 1, combatants: [] };
        testService.updateEncounter(encounter);
        success &&= testLog(getActiveCampaign()?.activeEncounter?.round === 2, '4f. Encounter Update', 'Encounter update failed');

        // Plot & Session Updates
        testService.updatePlot(plotId, { status: 'resolved' });
        const updatedPlot = findPlotByTitle('Test Plot');
        success &&= testLog(updatedPlot?.status === 'resolved', '4g. Plot Update', 'Plot update failed');

        testService.updateSessionLog(sessionId, { status: 'active', runningNotes: 'Notes...' });
        const updatedSession = findSessionByTitle('Test Session');
        success &&= testLog(updatedSession?.status === 'active' && updatedSession.runningNotes === 'Notes...', '4h. Session Update', 'Session update failed');


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
                '4i. Location Circular Dependency Prevention',
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

        if (pcId) testService.deletePlayerCharacter(pcId);
        success &&= testLog(!findPcByName('TestPC'), '5g. Player Character Deletion', 'PC was not deleted');

        if (plotId) testService.deletePlot(plotId);
        success &&= testLog(!findPlotByTitle('Test Plot'), '5h. Plot Deletion', 'Plot was not deleted');

        if (sessionId) testService.deleteSessionLog(sessionId);
        success &&= testLog(!findSessionByTitle('Test Session'), '5i. Session Log Deletion', 'Session Log was not deleted');

    } catch(e) {
        console.error('❌ State handler test failed with error:', e);
        success = false;
    }
    console.groupEnd();
    return success;
};

const testImportExport = async () => {
    console.groupCollapsed('Smoke Test: Import/Export Cycle');
    const testService = createCampaignStore({ persist: false });
    testService.init = () => {
        testService._updateState(draft => {
            draft.campaigns = []; draft.activeCampaignId = null; draft.appStatus = 'welcome';
        });
    };
    testService.init();
    let success = true;

    try {
        testService.createCampaign('Export Test', 'A world to be exported', 'custom');
        testService.createNpc({ name: 'Export NPC', description: 'desc', traits: 'traits', backstory: 'bs', motivations: 'motive', secrets: 'secret', stats: 'stats', exampleQuote: 'quote', knowsPlayerHistory: [], relationships: [], history: [] });
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
  // Dev-only safety net: this suite wipes real localStorage save keys and fires
  // live AI calls, so it must never execute in a production build regardless of
  // how/where it gets invoked from.
  if (!import.meta.env.DEV) {
    console.warn('[SmokeTest] Skipped: smoke tests only run in development builds.');
    return;
  }
  // Clear any saved campaign from a previous session to ensure a clean test run.
  localStorage.removeItem('realmweaver-campaigns');
  localStorage.removeItem('realmweaver-active-campaign-id');
  console.log(`%c🚀 Running application smoke tests... (Mock Mode: ${isMockMode})`, 'color: #7c3aed; font-size: 1.2em; font-weight: bold;');
  const servicesOk = await testServiceFunctions(isMockMode);
  const realmChatOk = await testRealmChat(isMockMode);
  const handlersOk = await testCampaignHandlers(isMockMode);
  const importExportOk = await testImportExport();
  if (servicesOk && realmChatOk && handlersOk && importExportOk) {
    console.log('%c✅ All smoke tests passed.', 'color: #10b981; font-size: 1.2em; font-weight: bold;');
  } else {
    console.log('%c❌ Some smoke tests failed. Check console for details.', 'color: #ef4444; font-size: 1.2em; font-weight: bold;');
  }
};
