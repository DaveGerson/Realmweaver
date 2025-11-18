

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
    PlayerCharacter,
    BatchAddData,
    Note,
    Encounter
} from '../types/index';
import { importCampaignFromJson } from './importExportService';
import { parseCharacterSheetPdf } from './geminiService';

type AppStatus = 'loading' | 'welcome' | 'selecting' | 'creating' | 'editing';
export type SaveStatus = 'idle' | 'saved' | 'saving' | 'error';

type CampaignState = {
  campaigns: Campaign[];
  activeCampaignId: string | null;
  appStatus: AppStatus;
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
};

/**
 * Creates an isolated, fully functional campaign store.
 * This factory pattern allows the main app to use a singleton instance
 * while enabling isolated instances for testing.
 */
export function createCampaignStore(config: { persist?: boolean } = {}) {
    const shouldPersist = config.persist ?? true;
    const AUTO_SAVE_DELAY_MS = 2000;

    let state: CampaignState = {
        campaigns: [],
        activeCampaignId: null,
        appStatus: 'loading',
        saveStatus: 'idle',
        lastSavedAt: null,
    };

    let saveTimeout: any = null;

    const CAMPAIGNS_STORAGE_KEY = 'realmweaver-campaigns';
    const ACTIVE_CAMPAIGN_ID_KEY = 'realmweaver-active-campaign-id';

    const listeners = new Set<() => void>();

    const notify = () => {
        listeners.forEach(listener => listener());
    };

    // Internal update that changes state but DOES NOT trigger auto-save
    // Used for updating 'saveStatus' or 'appStatus' without creating a save loop
    const _internalUpdate = (updater: (draft: CampaignState) => void) => {
        state = produce(state, updater);
        notify();
    };

    const persistToStorage = () => {
        if (!shouldPersist || state.appStatus === 'loading') {
            return;
        }
        try {
            localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(state.campaigns));
            if (state.activeCampaignId) {
                localStorage.setItem(ACTIVE_CAMPAIGN_ID_KEY, state.activeCampaignId);
            } else {
                localStorage.removeItem(ACTIVE_CAMPAIGN_ID_KEY);
            }
            
            // Update status to saved
            _internalUpdate(draft => {
                draft.saveStatus = 'saved';
                draft.lastSavedAt = new Date().toISOString();
            });
            console.log("Campaign auto-saved successfully.");
        } catch (e) {
            console.error("Failed to save state to localStorage", e);
            _internalUpdate(draft => {
                draft.saveStatus = 'error';
            });
        }
    };

    const scheduleSave = () => {
        if (!shouldPersist) return;

        // Update status to saving immediately
        _internalUpdate(draft => {
            draft.saveStatus = 'saving';
        });

        // Debounce the actual write
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }
        saveTimeout = setTimeout(() => {
            persistToStorage();
        }, AUTO_SAVE_DELAY_MS);
    };

    // Public update that triggers the auto-save workflow
    const updateState = (updater: (draft: CampaignState) => void) => {
        state = produce(state, updater);
        notify();
        scheduleSave();
    };

    const getActiveCampaignFromState = (currentState: CampaignState) => {
        if (!currentState.activeCampaignId) return null;
        return currentState.campaigns.find(c => c.id === currentState.activeCampaignId) || null;
    }
    
    // --- Relationship Management & Validation Helpers ---

    const _synchronizeNpcFactionLink = (draftCampaign: Campaign, npcId: string, oldFactionId?: string, newFactionId?: string) => {
        if (oldFactionId === newFactionId) return;

        if (oldFactionId) {
            const oldFaction = draftCampaign.factions.find(f => f.id === oldFactionId);
            if (oldFaction) oldFaction.memberIds = oldFaction.memberIds.filter(id => id !== npcId);
        }
        if (newFactionId) {
            const newFaction = draftCampaign.factions.find(f => f.id === newFactionId);
            if (newFaction && !newFaction.memberIds.includes(npcId)) newFaction.memberIds.push(npcId);
        }
    };

    const _isLocationParentingAllowed = (draftCampaign: Campaign, childId: string, newParentId: string): boolean => {
        let currentId: string | undefined = newParentId;
        while (currentId) {
            if (currentId === childId) return false; // Cycle detected
            const current = draftCampaign.locations.find(l => l.id === currentId);
            if (!current) return true;
            currentId = current.parentLocationId;
        }
        return true;
    };

    const _synchronizeLocationHierarchy = (draftCampaign: Campaign, locationId: string, oldParentId?: string, newParentId?: string) => {
        if (oldParentId === newParentId) return;

        if (oldParentId) {
            const oldParent = draftCampaign.locations.find(l => l.id === oldParentId);
            if (oldParent) oldParent.subLocationIds = oldParent.subLocationIds.filter(id => id !== locationId);
        }
        if (newParentId) {
            const newParent = draftCampaign.locations.find(l => l.id === newParentId);
            if (newParent && !newParent.subLocationIds.includes(locationId)) newParent.subLocationIds.push(locationId);
        }
    };
    
    const _isArticleParentingAllowed = (draftCampaign: Campaign, childId: string, newParentId: string): boolean => {
        let currentId: string | undefined = newParentId;
        while (currentId) {
            if (currentId === childId) return false; // Cycle detected
            const current = draftCampaign.articles.find(a => a.id === currentId);
            if (!current) return true;
            currentId = current.parentArticleId;
        }
        return true;
    };

    const _synchronizeArticleHierarchy = (draftCampaign: Campaign, articleId: string, oldParentId?: string, newParentId?: string) => {
        if (oldParentId === newParentId) return;

        if (oldParentId) {
            const oldParent = draftCampaign.articles.find(a => a.id === oldParentId);
            if (oldParent) oldParent.subArticleIds = oldParent.subArticleIds.filter(id => id !== articleId);
        }
        if (newParentId) {
            const newParent = draftCampaign.articles.find(a => a.id === newParentId);
            if (newParent && !newParent.subArticleIds.includes(articleId)) newParent.subArticleIds.push(articleId);
        }
    };

    const _removeEntityFromArticles = (draftCampaign: Campaign, entityId: string) => {
        draftCampaign.articles.forEach(article => {
            if (article.relatedEntityIds) {
                article.relatedEntityIds = article.relatedEntityIds.filter(id => id !== entityId);
            }
        });
    };


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
            if (!shouldPersist) {
                _internalUpdate(draft => { draft.appStatus = 'welcome'; });
                return;
            }
            const savedCampaigns = localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
            const savedActiveId = localStorage.getItem(ACTIVE_CAMPAIGN_ID_KEY);

            _internalUpdate(draft => {
                if (savedCampaigns) {
                    try {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const campaignsData: any[] = JSON.parse(savedCampaigns);
                        // Migrate old data: ensure notes array exists
                        draft.campaigns = campaignsData.map(c => ({
                            ...c,
                            notes: c.notes || [],
                            sessionLogs: c.sessionLogs || [],
                            playerCharacters: c.playerCharacters || [],
                            // Ensure activeEncounter is initialized if missing in older saves
                            activeEncounter: c.activeEncounter || { id: crypto.randomUUID(), round: 1, turnIndex: 0, combatants: [] }
                        }));

                        if (savedActiveId && draft.campaigns.some(c => c.id === savedActiveId)) {
                            draft.activeCampaignId = savedActiveId;
                            draft.appStatus = 'editing';
                        } else if (draft.campaigns.length > 0) {
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
        saveCampaign() { 
            // Manual save trigger (forces immediate save)
            if (saveTimeout) clearTimeout(saveTimeout);
            _internalUpdate(draft => { draft.saveStatus = 'saving'; });
            setTimeout(persistToStorage, 0);
        },
        createCampaign(title: string, setting: string) {
            updateState(draft => {
                const newCampaign: Campaign = { 
                    id: crypto.randomUUID(), 
                    title, 
                    setting, 
                    articles: [], 
                    adventures: [], 
                    npcs: [], 
                    locations: [], 
                    factions: [], 
                    items: [], 
                    sessionLogs: [], 
                    playerCharacters: [], 
                    notes: [],
                    activeEncounter: { id: crypto.randomUUID(), round: 1, turnIndex: 0, combatants: [] }
                };
                draft.campaigns.push(newCampaign);
                draft.activeCampaignId = newCampaign.id;
                draft.appStatus = 'editing';
            });
        },
        deleteCampaign(id: string) {
            if (window.confirm("Are you sure you want to permanently delete this campaign?")) {
                updateState(draft => {
                    const initialCampaignCount = draft.campaigns.length;
                    draft.campaigns = draft.campaigns.filter(c => c.id !== id);
        
                    // If a campaign was actually deleted
                    if (draft.campaigns.length < initialCampaignCount) {
                        if (draft.campaigns.length === 0) {
                            // Last campaign was deleted, go to welcome screen
                            draft.activeCampaignId = null;
                            draft.appStatus = 'welcome';
                        } else if (draft.activeCampaignId === id) {
                            // Active campaign was deleted, but others remain, go to selector
                            draft.activeCampaignId = null;
                            draft.appStatus = 'selecting';
                        }
                    }
                });
            }
        },
        selectCampaign(id: string) { 
            // Selection involves reading/UI changes mostly, but we track it via _internalUpdate to avoid marking "selecting" as a save-worthy event unless needed, 
            // though saving activeCampaignId is good.
            updateState(draft => { draft.activeCampaignId = id; draft.appStatus = 'editing'; }); 
        },
        async importCampaign(file: File): Promise<string> {
            try {
                const importedCampaign = await importCampaignFromJson(file);
                updateState(draft => {
                    if (draft.campaigns.some(c => c.id === importedCampaign.id)) {
                        importedCampaign.id = crypto.randomUUID();
                    }
                    // Ensure compatibility
                    importedCampaign.notes = importedCampaign.notes || [];
                    importedCampaign.sessionLogs = importedCampaign.sessionLogs || [];
                    importedCampaign.playerCharacters = importedCampaign.playerCharacters || [];
                    importedCampaign.activeEncounter = importedCampaign.activeEncounter || { id: crypto.randomUUID(), round: 1, turnIndex: 0, combatants: [] };
                    
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
        startNewCampaignCreation() { _internalUpdate(draft => { draft.appStatus = 'creating'; }); },
        switchToCampaignSelector() { 
            // Switching is a navigational event, persist active ID change immediately
            updateState(draft => { draft.activeCampaignId = null; draft.appStatus = 'selecting'; }); 
        },
        prepareNewCampaign() { _internalUpdate(draft => { draft.activeCampaignId = null; draft.appStatus = 'creating'; }); },
        
        setActiveScene(sceneId: string | null) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (campaign) {
                    campaign.activeSceneId = sceneId || undefined;
                }
            });
        },

        // --- Entity Actions (Creators return the new ID for selection) ---
        createNpc(newNpcData: Omit<NPC, 'id'>) {
            const newNpc: NPC = { ...newNpcData, id: crypto.randomUUID() };
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (campaign) {
                    campaign.npcs.push(newNpc);
                    // Also handle initial faction assignment
                    if (newNpc.factionId) {
                        _synchronizeNpcFactionLink(campaign, newNpc.id, undefined, newNpc.factionId);
                    }
                }
            });
            return newNpc.id;
        },
        updateNpc(id: string, updatedData: Partial<NPC>) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;
                const npc = campaign.npcs.find(n => n.id === id);
                if (!npc) return;
                
                const oldFactionId = npc.factionId;
                Object.assign(npc, updatedData);
                const newFactionId = npc.factionId;

                _synchronizeNpcFactionLink(campaign, id, oldFactionId, newFactionId);
            });
        },
        deleteNpc(id: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;
                const npcIndex = campaign.npcs.findIndex(n => n.id === id);
                if (npcIndex === -1) return;
                
                const npcToDelete = campaign.npcs[npcIndex];
                
                // Unlink from faction
                _synchronizeNpcFactionLink(campaign, id, npcToDelete.factionId, undefined);
                
                // Cleanup article references
                _removeEntityFromArticles(campaign, id);

                // Remove from NPC list
                campaign.npcs.splice(npcIndex, 1);
                
                // Remove from all scenes
                campaign.adventures.forEach(adv => adv.scenes.forEach(scene => {
                    scene.npcIds = scene.npcIds.filter(npcId => npcId !== id);
                }));
            });
        },

        createLocation(newLocationData: Omit<Location, 'id'>) {
            const newLocation: Location = { ...newLocationData, id: crypto.randomUUID() };
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if(campaign) {
                    campaign.locations.push(newLocation);
                    if (newLocation.parentLocationId) {
                        _synchronizeLocationHierarchy(campaign, newLocation.id, undefined, newLocation.parentLocationId);
                    }
                }
            });
            return newLocation.id;
        },
        updateLocation(id: string, updatedData: Partial<Location>) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;
                const location = campaign.locations.find(l => l.id === id);
                if (!location) return;

                const oldParentId = location.parentLocationId;
                
                // Validate before applying changes
                if ('parentLocationId' in updatedData && updatedData.parentLocationId && !_isLocationParentingAllowed(campaign, id, updatedData.parentLocationId)) {
                    console.error(`Invalid parenting update for Location ${id}: would create a circular dependency.`);
                    return; // Abort update if parenting is invalid
                }
                
                Object.assign(location, updatedData);
                const newParentId = location.parentLocationId;
        
                _synchronizeLocationHierarchy(campaign, id, oldParentId, newParentId);
            });
        },
        deleteLocation(id: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;
                const locIndex = campaign.locations.findIndex(l => l.id === id);
                if (locIndex === -1) return;

                const locToDelete = campaign.locations[locIndex];
        
                // Unlink from parent
                _synchronizeLocationHierarchy(campaign, id, locToDelete.parentLocationId, undefined);
                
                // Un-parent all children
                locToDelete.subLocationIds.forEach(childId => {
                    const child = campaign.locations.find(c => c.id === childId);
                    if (child) child.parentLocationId = undefined;
                });
                
                // Cleanup article references
                _removeEntityFromArticles(campaign, id);

                // Remove the location
                campaign.locations.splice(locIndex, 1);
                
                // Clean up references
                campaign.adventures.forEach(adv => adv.scenes.forEach(scene => {
                    if (scene.locationId === id) scene.locationId = undefined;
                }));
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
                const factionToDelete = campaign.factions.find(f => f.id === id);
                if (!factionToDelete) return;

                // Unlink all member NPCs
                factionToDelete.memberIds.forEach(npcId => {
                    const npc = campaign.npcs.find(n => n.id === npcId);
                    if (npc) npc.factionId = undefined;
                });
                
                // Cleanup Location control references
                campaign.locations.forEach(loc => {
                    if (loc.controllingFactionId === id) loc.controllingFactionId = undefined;
                });

                // Cleanup article references
                _removeEntityFromArticles(campaign, id);
                
                // Remove faction
                campaign.factions = campaign.factions.filter(f => f.id !== id);
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
                if (campaign) {
                    campaign.articles.push(newArticle);
                    if(newArticle.parentArticleId) {
                        _synchronizeArticleHierarchy(campaign, newArticle.id, undefined, newArticle.parentArticleId);
                    }
                }
            });
            return newArticle.id;
        },
        updateArticle(id: string, updatedData: Partial<Article>) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;
                const article = campaign.articles.find(a => a.id === id);
                if (!article) return;
                
                const oldParentId = article.parentArticleId;
                
                if ('parentArticleId' in updatedData && updatedData.parentArticleId && !_isArticleParentingAllowed(campaign, id, updatedData.parentArticleId)) {
                     console.error(`Invalid parenting update for Article ${id}: would create a circular dependency.`);
                    return;
                }

                Object.assign(article, updatedData);
                const newParentId = article.parentArticleId;
        
                _synchronizeArticleHierarchy(campaign, id, oldParentId, newParentId);
            });
        },
        deleteArticle(id: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;
                const articleIndex = campaign.articles.findIndex(a => a.id === id);
                if (articleIndex === -1) return;

                const articleToDelete = campaign.articles[articleIndex];
                
                // Unlink from parent
                _synchronizeArticleHierarchy(campaign, id, articleToDelete.parentArticleId, undefined);
        
                // Un-parent all children
                articleToDelete.subArticleIds.forEach(childId => {
                    const child = campaign.articles.find(c => c.id === childId);
                    if (child) child.parentArticleId = undefined;
                });
                
                // Remove the article
                campaign.articles.splice(articleIndex, 1);
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

        createPlayerCharacter(newPcData: Omit<PlayerCharacter, 'id'>) {
            const newPc: PlayerCharacter = { ...newPcData, id: crypto.randomUUID() };
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (campaign) {
                    campaign.playerCharacters = [...(campaign.playerCharacters || []), newPc];
                }
            });
            return newPc.id;
        },
        async createPlayerCharacterFromPdf(pdfBase64: string, isMockMode: boolean) {
            const activeCampaign = this.getActiveCampaign();
            const campaignContext = activeCampaign ? `Campaign Title: ${activeCampaign.title}\nSetting: ${activeCampaign.setting}` : undefined;
            const pcData = await parseCharacterSheetPdf(pdfBase64, isMockMode, campaignContext);
            return this.createPlayerCharacter(pcData);
        },
        updatePlayerCharacter(id: string, updatedData: Partial<PlayerCharacter>) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign || !campaign.playerCharacters) return;
                const pc = campaign.playerCharacters.find(p => p.id === id);
                if (pc) Object.assign(pc, updatedData);
            });
        },
        deletePlayerCharacter(id: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (campaign) {
                    campaign.playerCharacters = (campaign.playerCharacters || []).filter(p => p.id !== id);
                }
            });
        },

        createNote(newNoteData: Omit<Note, 'id' | 'createdAt' | 'lastModified'>) {
            const now = new Date().toISOString();
            const newNote: Note = { ...newNoteData, id: crypto.randomUUID(), createdAt: now, lastModified: now };
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (campaign) {
                    campaign.notes = [...(campaign.notes || []), newNote];
                }
            });
            return newNote.id;
        },
        updateNote(id: string, updatedData: Partial<Note>) {
             updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign || !campaign.notes) return;
                const note = campaign.notes.find(n => n.id === id);
                if (note) {
                    Object.assign(note, { ...updatedData, lastModified: new Date().toISOString() });
                }
            });
        },
        deleteNote(id: string) {
             updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (campaign) {
                    campaign.notes = (campaign.notes || []).filter(n => n.id !== id);
                }
            });
        },

        updateEncounter(updatedEncounter: Encounter) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (campaign) {
                    campaign.activeEncounter = updatedEncounter;
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

export const campaignService = createCampaignStore({ persist: true });
