
import { produce } from 'immer';
import type { 
    Campaign, 
    Adventure, 
    NPC, 
    Location, 
    Faction, 
    Item, 
    Scene, 
    Article, 
    AdventureForBatchAdd, 
    SessionLog,
    BatchAddData
} from '../types/index';
import { importCampaignFromJson } from './importExportService';

type AppStatus = 'loading' | 'welcome' | 'selecting' | 'creating' | 'editing';

type CampaignState = {
  campaigns: Campaign[];
  activeCampaignId: string | null;
  appStatus: AppStatus;
};

/**
 * Creates an isolated, fully functional campaign store.
 * This factory pattern allows the main app to use a singleton instance
 * while enabling isolated instances for testing.
 */
export function createCampaignStore() {
    let state: CampaignState = {
        campaigns: [],
        activeCampaignId: null,
        appStatus: 'loading',
    };

    const CAMPAIGNS_STORAGE_KEY = 'realmweaver-campaigns';
    const ACTIVE_CAMPAIGN_ID_KEY = 'realmweaver-active-campaign-id';

    const listeners = new Set<() => void>();

    const notify = () => {
        listeners.forEach(listener => listener());
    };

    const saveState = () => {
        if (state.appStatus !== 'loading') {
            try {
                // FIX: Corrected typo from CAMPAIGIGNS_STORAGE_KEY to CAMPAIGNS_STORAGE_KEY
                localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(state.campaigns));
                if (state.activeCampaignId) {
                    localStorage.setItem(ACTIVE_CAMPAIGN_ID_KEY, state.activeCampaignId);
                } else {
                    localStorage.removeItem(ACTIVE_CAMPAIGN_ID_KEY);
                }
            } catch (e) {
                console.error("Failed to save state to localStorage", e);
            }
        }
    };

    const updateState = (updater: (draft: CampaignState) => void) => {
        state = produce(state, updater);
        saveState();
        notify();
    };

    const getActiveCampaignFromState = (currentState: CampaignState) => {
        if (!currentState.activeCampaignId) return null;
        return currentState.campaigns.find(c => c.id === currentState.activeCampaignId) || null;
    }

    const service = {
        // --- Store subscription & state access ---
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        getState() { return state; },
        getActiveCampaign() { return getActiveCampaignFromState(state); },
        _updateState: updateState, // Exposed for test state manipulation

        // --- Initialization ---
        init() {
            const savedCampaigns = localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
            const savedActiveId = localStorage.getItem(ACTIVE_CAMPAIGN_ID_KEY);

            updateState(draft => {
                if (savedCampaigns) {
                    try {
                        const campaignsData: Campaign[] = JSON.parse(savedCampaigns);
                        draft.campaigns = campaignsData;
                        if (savedActiveId && campaignsData.some(c => c.id === savedActiveId)) {
                            draft.activeCampaignId = savedActiveId;
                            draft.appStatus = 'editing';
                        } else if (campaignsData.length > 0) {
                            draft.appStatus = 'selecting';
                        } else {
                            draft.appStatus = 'welcome';
                        }
                    } catch (e) {
                        console.error("Failed to parse saved campaigns, clearing storage.", e);
                        localStorage.removeItem(CAMPAIGNS_STORAGE_KEY);
                        localStorage.removeItem(ACTIVE_CAMPAIGN_ID_KEY);
                        draft.appStatus = 'welcome';
                    }
                } else {
                    draft.appStatus = 'welcome';
                }
            });
        },

        // --- Campaign Level Actions ---
        saveCampaign() { console.log("Campaign state saved."); saveState(); },
        createCampaign(title: string, setting: string) {
            updateState(draft => {
                const newCampaign: Campaign = { id: crypto.randomUUID(), title, setting, articles: [], adventures: [], npcs: [], locations: [], factions: [], items: [], sessionLogs: [] };
                draft.campaigns.push(newCampaign);
                draft.activeCampaignId = newCampaign.id;
                draft.appStatus = 'editing';
            });
        },
        deleteCampaign(id: string) {
            if (window.confirm("Are you sure you want to permanently delete this campaign?")) {
                updateState(draft => {
                    draft.campaigns = draft.campaigns.filter(c => c.id !== id);
                    if (draft.activeCampaignId === id) {
                        draft.activeCampaignId = null;
                        draft.appStatus = 'selecting';
                    }
                });
            }
        },
        selectCampaign(id: string) { updateState(draft => { draft.activeCampaignId = id; draft.appStatus = 'editing'; }); },
        async importCampaign(file: File): Promise<string> {
            try {
                const importedCampaign = await importCampaignFromJson(file);
                updateState(draft => {
                    if (draft.campaigns.some(c => c.id === importedCampaign.id)) {
                        importedCampaign.id = crypto.randomUUID();
                    }
                    draft.campaigns.push(importedCampaign);
                    draft.activeCampaignId = null;
                    draft.appStatus = 'selecting';
                });
                return importedCampaign.title;
            } catch (error) {
                console.error("Import failed:", error);
                throw error;
            }
        },
        updateCampaign(updatedData: Partial<Campaign>) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (campaign) Object.assign(campaign, updatedData);
            });
        },
        startNewCampaignCreation() { updateState(draft => { draft.appStatus = 'creating'; }); },
        switchToCampaignSelector() { updateState(draft => { draft.activeCampaignId = null; draft.appStatus = 'selecting'; }); },
        prepareNewCampaign() { updateState(draft => { draft.activeCampaignId = null; draft.appStatus = 'creating'; }); },

        // --- Entity Actions (Creators return the new ID for selection) ---
        createNpc(newNpcData: Omit<NPC, 'id'>) {
            const newNpc: NPC = { ...newNpcData, id: crypto.randomUUID() };
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (campaign) campaign.npcs.push(newNpc);
            });
            return newNpc.id;
        },
        updateNpc(id: string, updatedData: Partial<NPC>) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
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
            });
        },
        deleteNpc(id: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;
                const npcToDelete = campaign.npcs.find(n => n.id === id);
                if (!npcToDelete) return;
                
                if (npcToDelete.factionId) {
                    const faction = campaign.factions.find(f => f.id === npcToDelete.factionId);
                    if (faction) faction.memberIds = faction.memberIds.filter(memberId => memberId !== id);
                }
                
                campaign.npcs = campaign.npcs.filter(n => n.id !== id);
                campaign.adventures.forEach(adv => adv.scenes.forEach(scene => {
                    scene.npcIds = scene.npcIds.filter(npcId => npcId !== id);
                }));
            });
        },

        createLocation(newLocationData: Omit<Location, 'id'>) {
            const newLocation: Location = { ...newLocationData, id: crypto.randomUUID() };
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if(campaign) campaign.locations.push(newLocation)
            });
            return newLocation.id;
        },
        updateLocation(id: string, updatedData: Partial<Location>) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
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
            });
        },
        deleteLocation(id: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
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
                campaign.adventures.forEach(adv => adv.scenes.forEach(scene => {
                    if (scene.locationId === id) scene.locationId = undefined;
                }));
                campaign.locations = campaign.locations.filter(l => l.id !== id);
            });
        },
        
        createFaction(newFactionData: Omit<Faction, 'id'>) {
            const newFaction: Faction = { ...newFactionData, id: crypto.randomUUID() };
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if(campaign) campaign.factions.push(newFaction)
            });
            return newFaction.id;
        },
        updateFaction(id: string, updatedData: Partial<Faction>) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;
                const faction = campaign.factions.find(f => f.id === id);
                if (faction) Object.assign(faction, updatedData);
            });
        },
        deleteFaction(id: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;
                campaign.factions = campaign.factions.filter(f => f.id !== id);
                campaign.npcs.forEach(npc => { if (npc.factionId === id) npc.factionId = undefined; });
            });
        },
        
        createItem(newItemData: Omit<Item, 'id'>) {
            const newItem: Item = { ...newItemData, id: crypto.randomUUID() };
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (campaign) campaign.items.push(newItem);
            });
            return newItem.id;
        },
        updateItem(id: string, updatedData: Partial<Item>) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;
                const item = campaign.items.find(i => i.id === id);
                if (item) Object.assign(item, updatedData);
            });
        },
        deleteItem(id: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (campaign) campaign.items = campaign.items.filter(i => i.id !== id);
            });
        },

        createArticle(newArticleData: Omit<Article, 'id'>) {
            const newArticle: Article = { ...newArticleData, id: crypto.randomUUID() };
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (campaign) campaign.articles.push(newArticle);
            });
            return newArticle.id;
        },
        updateArticle(id: string, updatedData: Partial<Article>) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
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
            });
        },
        deleteArticle(id: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;
                const articleToDelete = campaign.articles.find(a => a.id === id);
                if (!articleToDelete) return;
        
                if (articleToDelete.parentArticleId) {
                    const parent = campaign.articles.find(p => p.id === articleToDelete.parentArticleId);
                    if (parent) parent.subArticleIds = parent.subArticleIds.filter(subId => subId !== id);
                }
        
                articleToDelete.subArticleIds.forEach(childId => {
                    const child = campaign.articles.find(c => c.id === childId);
                    if (child) child.parentArticleId = undefined;
                });
                
                campaign.articles = campaign.articles.filter(a => a.id !== id);
            });
        },
        
        createFullAdventure(adventureData: AdventureForBatchAdd) {
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
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (campaign) campaign.adventures.push(newAdventure);
            });
            return newAdventure.id;
        },
        updateAdventure(id: string, updatedData: Partial<Adventure>) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;
                const adventure = campaign.adventures.find(a => a.id === id);
                if (adventure) Object.assign(adventure, updatedData);
            });
        },
        createScene(adventureId: string, newSceneData: Omit<Scene, 'id'>) {
            const newScene: Scene = { ...newSceneData, id: crypto.randomUUID() };
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;
                const adventure = campaign.adventures.find(a => a.id === adventureId);
                if (adventure) adventure.scenes.push(newScene);
            });
            return newScene.id;
        },
        updateScene(adventureId: string, sceneId: string, updatedData: Partial<Scene>) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;
                const adventure = campaign.adventures.find(a => a.id === adventureId);
                if (!adventure) return;
                const scene = adventure.scenes.find(s => s.id === sceneId);
                if (scene) Object.assign(scene, updatedData);
            });
        },
        deleteScene(adventureId: string, sceneId: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;
                const adventure = campaign.adventures.find(a => a.id === adventureId);
                if (adventure) adventure.scenes = adventure.scenes.filter(s => s.id !== sceneId);
            });
        },
        reorderScene(adventureId: string, draggedSceneId: string, targetSceneId: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;
                const adventure = campaign.adventures.find(a => a.id === adventureId);
                if (!adventure) return;
        
                const draggedIndex = adventure.scenes.findIndex(s => s.id === draggedSceneId);
                const targetIndex = adventure.scenes.findIndex(s => s.id === targetSceneId);
        
                if (draggedIndex > -1 && targetIndex > -1) {
                    const [draggedItem] = adventure.scenes.splice(draggedIndex, 1);
                    adventure.scenes.splice(targetIndex, 0, draggedItem);
                }
            });
        },
        
        createSessionLog(newLogData: Omit<SessionLog, 'id'>) {
            const newLog: SessionLog = { ...newLogData, id: crypto.randomUUID() };
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (campaign) {
                    campaign.sessionLogs = [...(campaign.sessionLogs || []), newLog];
                }
            });
            return newLog.id;
        },
        updateSessionLog(id: string, updatedData: Partial<SessionLog>) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign || !campaign.sessionLogs) return;
                const log = campaign.sessionLogs.find(l => l.id === id);
                if (log) Object.assign(log, updatedData);
            });
        },
        deleteSessionLog(id: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (campaign) {
                    campaign.sessionLogs = (campaign.sessionLogs || []).filter(l => l.id !== id);
                }
            });
        },

        batchAddToCampaign(data: BatchAddData) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;
        
                const factionNameMap = new Map<string, string>();
                const locationNameMap = new Map<string, string>();
                const npcNameMap = new Map<string, string>();
        
                campaign.factions.forEach(f => factionNameMap.set(f.name.toLowerCase(), f.id));
                campaign.locations.forEach(l => locationNameMap.set(l.name.toLowerCase(), l.id));
                campaign.npcs.forEach(n => npcNameMap.set(n.name.toLowerCase(), n.id));
        
                const newFactions = data.factions.map(facData => ({ ...facData, id: crypto.randomUUID(), leaderId: undefined, memberIds: [] }));
                newFactions.forEach(f => factionNameMap.set(f.name.toLowerCase(), f.id));
        
                const newLocations = data.locations.map(locData => ({ ...locData, id: crypto.randomUUID(), subLocationIds: [], connections: locData.connections || [], pointsOfInterest: locData.pointsOfInterest || [], loot: locData.loot || [] }));
                newLocations.forEach(l => locationNameMap.set(l.name.toLowerCase(), l.id));
        
                const newNpcs = data.npcs.map(npcData => ({ ...npcData, id: crypto.randomUUID(), knowsPlayerHistory: [] }));
                newNpcs.forEach(n => npcNameMap.set(n.name.toLowerCase(), n.id));
                
                const newItems = data.items.map(itemData => ({ ...itemData, id: crypto.randomUUID() }));
                const newAdventures = data.adventures.map(advData => ({ ...advData, id: crypto.randomUUID(), scenes: (advData.scenes || []).map(s => ({ ...s, id: crypto.randomUUID() }))}));
        
                campaign.factions.push(...newFactions);
                campaign.locations.push(...newLocations);
                campaign.npcs.push(...newNpcs);
                campaign.items.push(...newItems);
                campaign.adventures.push(...newAdventures);
        
                const allNpcsInDraft = campaign.npcs;
                const allLocationsInDraft = campaign.locations;
                const allFactionsInDraft = campaign.factions;
        
                allNpcsInDraft.forEach(npc => {
                    const factionName = npc.factionId;
                    if (factionName && factionNameMap.has(factionName.toLowerCase())) {
                        const resolvedFactionId = factionNameMap.get(factionName.toLowerCase())!;
                        const faction = allFactionsInDraft.find(f => f.id === resolvedFactionId);
                        if (faction && !faction.memberIds.includes(npc.id)) faction.memberIds.push(npc.id);
                        npc.factionId = resolvedFactionId;
                    }
                });
        
                allLocationsInDraft.forEach(loc => {
                    const parentLocationName = loc.parentLocationId;
                    if (parentLocationName && locationNameMap.has(parentLocationName.toLowerCase())) {
                        const resolvedParentId = locationNameMap.get(parentLocationName.toLowerCase())!;
                        const parent = allLocationsInDraft.find(p => p.id === resolvedParentId);
                        if (parent && !parent.subLocationIds.includes(loc.id)) parent.subLocationIds.push(loc.id);
                        loc.parentLocationId = resolvedParentId;
                    }
                });
                
                campaign.adventures.forEach(adv => {
                    adv.scenes.forEach(scene => {
                        const locationName = scene.locationId;
                        if (locationName && locationNameMap.has(locationName.toLowerCase())) {
                            scene.locationId = locationNameMap.get(locationName.toLowerCase());
                        }
                        if (scene.npcIds && Array.isArray(scene.npcIds)) {
                            scene.npcIds = scene.npcIds
                                .map(npcIdOrName => npcNameMap.get(npcIdOrName.toLowerCase()) || npcIdOrName)
                                .filter(id => allNpcsInDraft.some(npc => npc.id === id));
                        }
                    });
                });
            });
        },
    };
    
    // Auto-initialize the store when the module is imported
    service.init();

    return service;
}

export const campaignService = createCampaignStore();
