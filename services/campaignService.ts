
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
    SessionLogEntryType,
    PlayerCharacter,
    BatchAddData,
    Plot,
    Encounter,
    SettingType,
    Note,
    DiceRoll,
    PlotSessionStatus,
    Secret,
    Beat,
    DmStyle
} from '../types/index';
import { importCampaignFromJson } from './importExportService';
import { parseCharacterSheetPdf } from './aiService';
import { storageService } from './storageService';
import { autoLinkScenes, autoLinkNpcFactions } from './linking/autoLinker';

type AppStatus = 'loading' | 'welcome' | 'selecting' | 'creating' | 'editing';
export type SaveStatus = 'idle' | 'saved' | 'saving' | 'error' | 'quota-warning';

type CampaignState = {
  campaigns: Campaign[];
  activeCampaignId: string | null;
  appStatus: AppStatus;
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
  /** True when another browser tab has modified campaign data since this tab last saved. */
  conflictDetected: boolean;
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
        conflictDetected: false,
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

        const campaignsResult = storageService.save(
            CAMPAIGNS_STORAGE_KEY,
            JSON.stringify(state.campaigns)
        );

        let activeIdResult = { success: true, quotaWarning: false };
        if (state.activeCampaignId) {
            activeIdResult = storageService.save(
                ACTIVE_CAMPAIGN_ID_KEY,
                state.activeCampaignId
            );
        } else {
            storageService.remove(ACTIVE_CAMPAIGN_ID_KEY);
        }

        const overallSuccess = campaignsResult.success && activeIdResult.success;
        const quotaWarning = campaignsResult.quotaWarning || activeIdResult.quotaWarning;

        if (overallSuccess) {
            _internalUpdate(draft => {
                draft.saveStatus = quotaWarning ? 'quota-warning' : 'saved';
                draft.lastSavedAt = new Date().toISOString();
            });
            if (quotaWarning) {
                console.warn('[campaignService] Save succeeded via IndexedDB fallback — localStorage quota exceeded.');
            } else {
                console.log('Campaign auto-saved successfully.');
            }
        } else {
            console.error('[campaignService] Failed to save state:', campaignsResult.error);
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
            if (oldParent) {
                oldParent.subArticleIds = (oldParent.subArticleIds || []).filter(id => id !== articleId);
            }
        }
        if (newParentId) {
            const newParent = draftCampaign.articles.find(a => a.id === newParentId);
            if (newParent) {
                if (!newParent.subArticleIds) newParent.subArticleIds = [];
                if (!newParent.subArticleIds.includes(articleId)) newParent.subArticleIds.push(articleId);
            }
        }
    };

    /**
     * Sweeps every known cross-entity reference array/field for a deleted
     * entity's id and strips it out. Safe to call unconditionally for any
     * deleted entity type (NPC, Location, Faction, Item, Plot, etc.) since it
     * only ever matches by exact id equality — entities that never reference
     * the deleted id are left untouched.
     *
     * Covers: NPC relationships + mentionedEntityIds, Location/Faction/Scene
     * mentionedEntityIds, Plot relatedEntityIds + mentionedEntityIds, Article
     * relatedEntityIds + mentionedEntityIds, and SessionLog relatedPlotIds +
     * plotProgressions (for when the deleted entity is a Plot).
     */
    const _purgeEntityReferences = (draftCampaign: Campaign, entityId: string) => {
        draftCampaign.npcs.forEach(npc => {
            if (npc.relationships) {
                npc.relationships = npc.relationships.filter(r => r.targetId !== entityId);
            }
            if (npc.mentionedEntityIds) {
                npc.mentionedEntityIds = npc.mentionedEntityIds.filter(id => id !== entityId);
            }
        });

        draftCampaign.locations.forEach(loc => {
            if (loc.mentionedEntityIds) {
                loc.mentionedEntityIds = loc.mentionedEntityIds.filter(id => id !== entityId);
            }
        });

        draftCampaign.factions.forEach(faction => {
            if (faction.mentionedEntityIds) {
                faction.mentionedEntityIds = faction.mentionedEntityIds.filter(id => id !== entityId);
            }
        });

        draftCampaign.adventures.forEach(adv => {
            adv.scenes.forEach(scene => {
                if (scene.mentionedEntityIds) {
                    scene.mentionedEntityIds = scene.mentionedEntityIds.filter(id => id !== entityId);
                }
            });
        });

        (draftCampaign.plots || []).forEach(plot => {
            if (plot.relatedEntityIds) {
                plot.relatedEntityIds = plot.relatedEntityIds.filter(id => id !== entityId);
            }
            if (plot.mentionedEntityIds) {
                plot.mentionedEntityIds = plot.mentionedEntityIds.filter(id => id !== entityId);
            }
        });

        draftCampaign.articles.forEach(article => {
            if (article.relatedEntityIds) {
                article.relatedEntityIds = article.relatedEntityIds.filter(id => id !== entityId);
            }
            if (article.mentionedEntityIds) {
                article.mentionedEntityIds = article.mentionedEntityIds.filter(id => id !== entityId);
            }
        });

        (draftCampaign.sessionLogs || []).forEach(log => {
            if (log.relatedPlotIds) {
                log.relatedPlotIds = log.relatedPlotIds.filter(id => id !== entityId);
            }
            if (log.plotProgressions && entityId in log.plotProgressions) {
                delete log.plotProgressions[entityId];
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

            // Wire cross-tab conflict detection (5.5).
            // The window `storage` event fires when ANOTHER tab writes to localStorage.
            // We set a flag so the UI can prompt the user to reload.
            storageService.onConflict((key) => {
                if (key === CAMPAIGNS_STORAGE_KEY) {
                    _internalUpdate(draft => {
                        draft.conflictDetected = true;
                    });
                }
            });

            // Use the async, IndexedDB-aware `load()` (not `loadSync()`) so that data
            // which only made it to IndexedDB — because a previous save() hit the
            // localStorage quota and fell back to IDB — is not silently lost on the
            // next app load. Kept as a fire-and-forget inner async block (rather than
            // marking `init` itself `async`) so `init`'s public signature stays
            // `() => void` for callers/tests that replace it with a synchronous stub.
            // `appStatus` starts (and stays) 'loading' until this resolves, which the
            // UI already renders a loading state for.
            void (async () => {
                const [savedCampaigns, savedActiveId] = await Promise.all([
                    storageService.load(CAMPAIGNS_STORAGE_KEY),
                    storageService.load(ACTIVE_CAMPAIGN_ID_KEY),
                ]);

                _internalUpdate(draft => {
                    if (savedCampaigns) {
                        try {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const campaignsData: any[] = JSON.parse(savedCampaigns);
                            // Migrate old data: ensure arrays exists
                            draft.campaigns = campaignsData.map(c => ({
                                ...c,
                                settingType: c.settingType || 'custom',
                                plots: (c.plots || []).map((p: any) => ({
                                    ...p,
                                    title: p.title || p.name || 'Untitled Plot',
                                    relatedEntityIds: p.relatedEntityIds || p.keyNpcIds || [],
                                })),
                                notes: c.notes || [],
                                secrets: c.secrets || [],
                                articles: (c.articles || []).map((a: any) => ({
                                    ...a,
                                    subArticleIds: a.subArticleIds || [],
                                    relatedEntityIds: a.relatedEntityIds || [],
                                })),
                                sessionLogs: (c.sessionLogs || []).map((l: any) => ({
                                    ...l,
                                    structuredNotes: l.structuredNotes || [],
                                    relatedPlotIds: l.relatedPlotIds || []
                                })),
                                playerCharacters: c.playerCharacters || [],
                                npcs: (c.npcs || []).map((n: any) => ({...n, relationships: n.relationships || [], history: n.history || []})),
                                locations: (c.locations || []).map((l: any) => ({...l, history: l.history || []})),
                                // Ensure required array fields exist on factions/adventures too — older or
                                // hand-edited/imported saves can be missing these, and CRUD code
                                // (_synchronizeNpcFactionLink, deleteFaction, deleteLocation, etc.)
                                // assumes they are always present.
                                factions: (c.factions || []).map((f: any) => ({ ...f, memberIds: f.memberIds || [] })),
                                adventures: (c.adventures || []).map((a: any) => ({
                                    ...a,
                                    scenes: (a.scenes || []).map((s: any) => ({ ...s, npcIds: s.npcIds || [] })),
                                })),
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
                            storageService.remove(CAMPAIGNS_STORAGE_KEY);
                            storageService.remove(ACTIVE_CAMPAIGN_ID_KEY);
                            draft.appStatus = 'welcome';
                        }
                    } else {
                        // No saved campaigns — show welcome screen for fresh onboarding.
                        // The demo campaign ("Winter's Daughter") is now available as a
                        // template via utils/demoTemplates.ts instead of being auto-seeded.
                        draft.appStatus = 'welcome';
                    }
                });
            })();
        },

        // --- Campaign Level Actions ---
        saveCampaign() { 
            // Manual save trigger (forces immediate save)
            if (saveTimeout) clearTimeout(saveTimeout);
            _internalUpdate(draft => { draft.saveStatus = 'saving'; });
            setTimeout(persistToStorage, 0);
        },
        createCampaign(title: string, setting: string, settingType: SettingType = 'custom', officialSetting?: string, dmStyle: DmStyle = 'standard') {
            updateState(draft => {
                const newCampaign: Campaign = {
                    id: crypto.randomUUID(),
                    title,
                    setting,
                    settingType,
                    officialSetting,
                    dmStyle,
                    featureOverrides: {},
                    articles: [],
                    adventures: [],
                    npcs: [],
                    locations: [],
                    factions: [],
                    items: [],
                    sessionLogs: [],
                    playerCharacters: [],
                    plots: [],
                    notes: [],
                    secrets: [],
                    activeEncounter: { id: crypto.randomUUID(), round: 1, turnIndex: 0, combatants: [] }
                };
                draft.campaigns.push(newCampaign);
                draft.activeCampaignId = newCampaign.id;
                draft.appStatus = 'editing';
            });
        },
        setDmStyle(style: DmStyle) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (campaign) campaign.dmStyle = style;
            });
        },
        setFeatureOverride(feature: string, visible: boolean) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (campaign) {
                    if (!campaign.featureOverrides) campaign.featureOverrides = {};
                    campaign.featureOverrides[feature] = visible;
                }
            });
        },
        clearFeatureOverride(feature: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (campaign && campaign.featureOverrides) {
                    delete campaign.featureOverrides[feature];
                }
            });
        },
        dismissWizard() {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (campaign) campaign.wizardDismissed = true;
            });
        },
        deleteCampaign(id: string) {
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
        },
        selectCampaign(id: string) {
            // Selection involves reading/UI changes mostly, but we track it via _internalUpdate to avoid marking "selecting" as a save-worthy event unless needed,
            // though saving activeCampaignId is good.
            updateState(draft => { draft.activeCampaignId = id; draft.appStatus = 'editing'; });
        },

        /**
         * Deep-clones a campaign, generating new UUIDs for the campaign and all
         * entity IDs (preserving internal cross-references with a remap table).
         * Appends " (Copy)" to the title. Does NOT switch to the new campaign.
         * Returns the new campaign ID.
         */
        duplicateCampaign(campaignId: string): string {
            const source = state.campaigns.find(c => c.id === campaignId);
            if (!source) return '';

            // Build a full remap table: old ID → new ID for every entity
            const idMap = new Map<string, string>();
            const remap = (oldId: string | undefined): string | undefined => {
                if (!oldId) return undefined;
                if (!idMap.has(oldId)) idMap.set(oldId, crypto.randomUUID());
                return idMap.get(oldId)!;
            };
            const remapRequired = (oldId: string): string => remap(oldId) as string;

            const newCampaignId = crypto.randomUUID();

            // Pre-register all entity IDs so cross-references resolve correctly
            source.npcs.forEach(e => idMap.set(e.id, crypto.randomUUID()));
            source.locations.forEach(e => idMap.set(e.id, crypto.randomUUID()));
            source.factions.forEach(e => idMap.set(e.id, crypto.randomUUID()));
            source.items.forEach(e => idMap.set(e.id, crypto.randomUUID()));
            source.articles.forEach(e => idMap.set(e.id, crypto.randomUUID()));
            source.adventures.forEach(adv => {
                idMap.set(adv.id, crypto.randomUUID());
                adv.scenes.forEach(s => idMap.set(s.id, crypto.randomUUID()));
            });
            source.sessionLogs?.forEach(e => idMap.set(e.id, crypto.randomUUID()));
            source.playerCharacters?.forEach(e => idMap.set(e.id, crypto.randomUUID()));
            source.plots?.forEach(e => idMap.set(e.id, crypto.randomUUID()));
            source.notes?.forEach(e => idMap.set(e.id, crypto.randomUUID()));
            source.secrets?.forEach(e => idMap.set(e.id, crypto.randomUUID()));

            const newCampaign: Campaign = {
                ...source,
                id: newCampaignId,
                title: `${source.title} (Copy)`,
                // Reset session / encounter state — don't clone live state
                activeSceneId: undefined,
                activeSessionId: undefined,
                activeEncounter: { id: crypto.randomUUID(), round: 1, turnIndex: 0, combatants: [] },
                wizardDismissed: true, // Copied campaign is not "new"
                pinnedEntities: [],

                npcs: source.npcs.map(n => ({
                    ...n,
                    id: remapRequired(n.id),
                    factionId: remap(n.factionId),
                    history: n.history ?? [],
                    relationships: (n.relationships ?? []).map(r => ({
                        ...r,
                        targetId: remap(r.targetId) ?? r.targetId,
                    })),
                })),

                locations: source.locations.map(l => ({
                    ...l,
                    id: remapRequired(l.id),
                    parentLocationId: remap(l.parentLocationId),
                    subLocationIds: (l.subLocationIds ?? []).map(remapRequired),
                    history: l.history ?? [],
                })),

                factions: source.factions.map(f => ({
                    ...f,
                    id: remapRequired(f.id),
                    leaderId: remap(f.leaderId),
                    memberIds: (f.memberIds ?? []).map(remapRequired),
                    headquartersLocationId: remap(f.headquartersLocationId),
                })),

                items: source.items.map(i => ({ ...i, id: remapRequired(i.id) })),

                articles: source.articles.map(a => ({
                    ...a,
                    id: remapRequired(a.id),
                    parentArticleId: remap(a.parentArticleId),
                    subArticleIds: (a.subArticleIds ?? []).map(remapRequired),
                    relatedEntityIds: (a.relatedEntityIds ?? []).map(remapRequired),
                })),

                adventures: source.adventures.map(adv => ({
                    ...adv,
                    id: remapRequired(adv.id),
                    scenes: adv.scenes.map(s => ({
                        ...s,
                        id: remapRequired(s.id),
                        locationId: remap(s.locationId),
                        npcIds: (s.npcIds ?? []).map(remapRequired),
                    })),
                })),

                sessionLogs: (source.sessionLogs ?? []).map(l => ({
                    ...l,
                    id: remapRequired(l.id),
                    // Clear "active" status — no live session in a copy
                    status: (l.status === 'active' ? 'planned' : l.status) as typeof l.status,
                    adventureId: remap(l.adventureId),
                    plannedSceneIds: (l.plannedSceneIds ?? []).map(remapRequired),
                    relatedPlotIds: (l.relatedPlotIds ?? []).map(remapRequired),
                    plotProgressions: l.plotProgressions
                        ? Object.fromEntries(
                              Object.entries(l.plotProgressions).map(([plotId, status]) => [remap(plotId) ?? plotId, status])
                          )
                        : l.plotProgressions,
                })),

                playerCharacters: (source.playerCharacters ?? []).map(pc => ({
                    ...pc,
                    id: remapRequired(pc.id),
                })),

                plots: (source.plots ?? []).map(p => ({
                    ...p,
                    id: remapRequired(p.id),
                    relatedEntityIds: (p.relatedEntityIds ?? []).map(remapRequired),
                })),

                notes: (source.notes ?? []).map(n => ({ ...n, id: remapRequired(n.id) })),

                secrets: (source.secrets ?? []).map(s => ({ ...s, id: remapRequired(s.id) })),
            };

            updateState(draft => {
                draft.campaigns.push(newCampaign);
            });

            return newCampaignId;
        },
        async importCampaign(file: File): Promise<string> {
            try {
                const importedCampaign = await importCampaignFromJson(file);
                updateState(draft => {
                    if (draft.campaigns.some(c => c.id === importedCampaign.id)) {
                        importedCampaign.id = crypto.randomUUID();
                    }
                    // Ensure compatibility
                    importedCampaign.settingType = importedCampaign.settingType || 'custom';
                    importedCampaign.plots = importedCampaign.plots || [];
                    importedCampaign.notes = importedCampaign.notes || [];
                    importedCampaign.sessionLogs = (importedCampaign.sessionLogs || []).map((l: any) => ({
                        ...l, 
                        structuredNotes: l.structuredNotes || [],
                        relatedPlotIds: l.relatedPlotIds || []
                    }));
                    importedCampaign.playerCharacters = importedCampaign.playerCharacters || [];
                    importedCampaign.npcs = (importedCampaign.npcs || []).map(n => ({...n, relationships: n.relationships || [], history: n.history || []}));
                    importedCampaign.locations = (importedCampaign.locations || []).map(l => ({...l, history: l.history || []}));
                    // Imported JSON is only lightly validated (id/name checks) — backfill
                    // required array fields on factions/adventures so later CRUD (faction
                    // membership sync, location/adventure deletion, etc.) can't crash on
                    // an undefined array.
                    importedCampaign.factions = (importedCampaign.factions || []).map(f => ({ ...f, memberIds: f.memberIds || [] }));
                    importedCampaign.adventures = (importedCampaign.adventures || []).map(a => ({
                        ...a,
                        scenes: (a.scenes || []).map(s => ({ ...s, npcIds: s.npcIds || [] })),
                    }));
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

        /**
         * Bulk-imports template data into the active campaign.
         * Remaps template IDs to fresh UUIDs and creates all entities in a single
         * state update so that the campaign is populated immediately after creation.
         * Template JSON may contain: npcs, locations, factions, adventures, plots, items.
         */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        importTemplateData(templateData: any) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;

                // Build an ID-remap table so cross-references stay consistent
                const idMap = new Map<string, string>();
                const remap = (oldId: string | undefined | null): string | undefined => {
                    if (!oldId) return undefined;
                    if (!idMap.has(oldId)) idMap.set(oldId, crypto.randomUUID());
                    return idMap.get(oldId);
                };

                // Override title/setting from template
                if (templateData.title) campaign.title = templateData.title;
                if (templateData.setting) campaign.setting = templateData.setting;
                if (templateData.settingType) campaign.settingType = templateData.settingType;

                // --- NPCs ---
                const rawNpcs: any[] = templateData.npcs || [];
                rawNpcs.forEach((n: any) => {
                    const newId = remap(n.id)!;
                    const npc: NPC = {
                        id: newId,
                        name: n.name || 'Unnamed NPC',
                        description: n.description || '',
                        traits: n.traits || '',
                        backstory: n.backstory || '',
                        motivations: n.motivations || '',
                        secrets: n.secrets || '',
                        stats: n.stats || '',
                        exampleQuote: n.exampleQuote || '',
                        factionId: n.factionId ? remap(n.factionId) : undefined,
                        knowsPlayerHistory: [],
                        relationships: [],
                        history: [],
                    };
                    campaign.npcs.push(npc);
                });

                // --- Factions ---
                const rawFactions: any[] = templateData.factions || [];
                rawFactions.forEach((f: any) => {
                    const newId = remap(f.id)!;
                    const faction: Faction = {
                        id: newId,
                        name: f.name || 'Unnamed Faction',
                        description: f.description || '',
                        goals: f.goals || '',
                        alignment: f.alignment,
                        resources: f.resources,
                        influence: f.influence,
                        memberIds: (f.memberIds || []).map((mid: string) => remap(mid)).filter(Boolean) as string[],
                        headquartersLocationId: f.headquartersLocationId ? remap(f.headquartersLocationId) : undefined,
                        leaderId: f.leaderId ? remap(f.leaderId) : undefined,
                    };
                    campaign.factions.push(faction);
                });

                // Back-fill faction membership on NPCs now that both arrays are populated
                campaign.factions.forEach(faction => {
                    faction.memberIds.forEach(memberId => {
                        const npc = campaign.npcs.find(n => n.id === memberId);
                        if (npc && !npc.factionId) npc.factionId = faction.id;
                    });
                });

                // --- Locations ---
                const rawLocations: any[] = templateData.locations || [];
                rawLocations.forEach((l: any) => {
                    const newId = remap(l.id)!;
                    const location: Location = {
                        id: newId,
                        name: l.name || 'Unnamed Location',
                        description: l.description || '',
                        secrets: l.secrets || '',
                        loot: [],
                        parentLocationId: l.parentLocationId ? remap(l.parentLocationId) : undefined,
                        subLocationIds: (l.subLocationIds || []).map((sid: string) => remap(sid)).filter(Boolean) as string[],
                        connections: [],
                        pointsOfInterest: (l.pointsOfInterest || []).map((poi: any) => ({
                            ...poi,
                            id: crypto.randomUUID(),
                            investigationChecks: poi.investigationChecks || [],
                            interactions: poi.interactions || [],
                        })),
                        controllingFactionId: l.controllingFactionId ? remap(l.controllingFactionId) : undefined,
                        history: [],
                    };
                    campaign.locations.push(location);
                });

                // --- Adventures (with Scenes) ---
                const rawAdventures: any[] = templateData.adventures || [];
                rawAdventures.forEach((a: any) => {
                    const advId = crypto.randomUUID();
                    const adventure: Adventure = {
                        id: advId,
                        title: a.title || 'Untitled Adventure',
                        level: a.level || 1,
                        hook: a.hook || '',
                        theme: a.theme || '',
                        scenes: (a.scenes || []).map((s: any) => ({
                            id: crypto.randomUUID(),
                            title: s.title || 'Untitled Scene',
                            type: s.type || 'exploration',
                            status: 'planned' as const,
                            readAloudText: s.readAloudText || '',
                            gmNotes: s.gmNotes || '',
                            skillChecks: (s.skillChecks || []).map((sc: any) => ({
                                ...sc,
                                id: crypto.randomUUID(),
                            })),
                            rewards: s.rewards || '',
                            locationId: s.locationId ? remap(s.locationId) : undefined,
                            npcIds: (s.npcIds || []).map((nid: string) => remap(nid)).filter(Boolean) as string[],
                        })),
                    };
                    campaign.adventures.push(adventure);
                });

                // --- Items ---
                const rawItems: any[] = templateData.items || [];
                rawItems.forEach((i: any) => {
                    const item: Item = {
                        id: crypto.randomUUID(),
                        name: i.name || 'Unnamed Item',
                        description: i.description || '',
                        rarity: i.rarity || 'common',
                        properties: i.properties || '',
                        itemType: i.itemType,
                        attunement: i.attunement,
                        weight: i.weight,
                        value: i.value,
                    };
                    campaign.items.push(item);
                });

                // --- Plots ---
                const rawPlots: any[] = templateData.plots || [];
                rawPlots.forEach((p: any) => {
                    const plot: Plot = {
                        id: crypto.randomUUID(),
                        title: p.title || 'Untitled Plot',
                        description: p.description || '',
                        status: p.status || 'active',
                        relatedEntityIds: (p.relatedEntityIds || []).map((eid: string) => remap(eid)).filter(Boolean) as string[],
                    };
                    campaign.plots.push(plot);
                });

                // --- Auto-link scenes and NPC factions from text ---
                const allScenes = campaign.adventures.flatMap(a => a.scenes);
                const sceneResult = autoLinkScenes(allScenes, campaign.npcs, campaign.locations);
                const factionResult = autoLinkNpcFactions(campaign.npcs as any[], campaign.factions);
                console.log(
                    `[autoLinker] Linked ${sceneResult.npcsAdded} NPC refs in ${sceneResult.scenesUpdated} scenes, ` +
                    `${sceneResult.locationsSet} locations, ${factionResult.npcsUpdated} NPC-faction links`
                );
            });
        },

        // --- Pinned entities ---
        pinEntity(type: string, id: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;
                if (!campaign.pinnedEntities) campaign.pinnedEntities = [];
                // No duplicates
                const alreadyPinned = campaign.pinnedEntities.some(p => p.type === type && p.id === id);
                if (alreadyPinned) return;
                // Prepend; enforce max 15
                campaign.pinnedEntities.unshift({ type, id });
                if (campaign.pinnedEntities.length > 15) {
                    campaign.pinnedEntities = campaign.pinnedEntities.slice(0, 15);
                }
            });
        },
        unpinEntity(type: string, id: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign || !campaign.pinnedEntities) return;
                campaign.pinnedEntities = campaign.pinnedEntities.filter(
                    p => !(p.type === type && p.id === id)
                );
            });
        },
        isPinned(type: string, id: string): boolean {
            const campaign = getActiveCampaignFromState(state);
            if (!campaign || !campaign.pinnedEntities) return false;
            return campaign.pinnedEntities.some(p => p.type === type && p.id === id);
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

        // --- Style Profile ---
        setStyleProfile(profile: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (campaign) {
                    campaign.styleProfile = profile;
                }
            });
        },
        clearStyleProfile() {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (campaign) {
                    campaign.styleProfile = undefined;
                }
            });
        },

        // --- Entity Actions (Creators return the new ID for selection) ---
        createNpc(newNpcData: Omit<NPC, 'id'>) {
            const newNpc: NPC = { ...newNpcData, id: crypto.randomUUID() };
            // Ensure new fields are present if not passed
            if (!newNpc.relationships) newNpc.relationships = [];
            if (!newNpc.history) newNpc.history = [];

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

                // Cleanup all cross-entity references (articles, plots, other NPCs' relationships, etc.)
                _purgeEntityReferences(campaign, id);

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
            // Ensure history is initialized
            if (!newLocation.history) newLocation.history = [];
            
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
                
                // Cleanup all cross-entity references (articles, plots, NPC relationships, etc.)
                _purgeEntityReferences(campaign, id);

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

                // Cleanup all cross-entity references (articles, plots, NPC relationships, etc.)
                _purgeEntityReferences(campaign, id);

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
                if (!campaign) return;
                _purgeEntityReferences(campaign, id);
                campaign.items = campaign.items.filter(i => i.id !== id);
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
                (articleToDelete.subArticleIds || []).forEach(childId => {
                    const child = campaign.articles.find(c => c.id === childId);
                    if (child) child.parentArticleId = undefined;
                });

                // Cleanup all cross-entity references (e.g. @-mentions of this article)
                _purgeEntityReferences(campaign, id);

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
        deleteAdventure(id: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;
                const adventure = campaign.adventures.find(a => a.id === id);
                if (!adventure) return;

                // Clear activeSceneId if it belongs to this adventure
                if (campaign.activeSceneId && adventure.scenes.some(s => s.id === campaign.activeSceneId)) {
                    campaign.activeSceneId = undefined;
                }

                // Clear adventureId on any session logs referencing this adventure
                if (campaign.sessionLogs) {
                    campaign.sessionLogs.forEach(log => {
                        if (log.adventureId === id) log.adventureId = undefined;
                    });
                }

                // Cleanup all cross-entity references (e.g. @-mentions of this adventure)
                _purgeEntityReferences(campaign, id);

                campaign.adventures = campaign.adventures.filter(a => a.id !== id);
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

                // Clear activeSceneId if it referenced the deleted scene
                if (campaign.activeSceneId === sceneId) {
                    campaign.activeSceneId = undefined;
                }

                // Strip the deleted scene id out of every session's planned scene list
                (campaign.sessionLogs || []).forEach(log => {
                    if (log.plannedSceneIds?.includes(sceneId)) {
                        log.plannedSceneIds = log.plannedSceneIds.filter(id => id !== sceneId);
                    }
                });
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
            // Ensure compatibility
            if (!newLog.structuredNotes) newLog.structuredNotes = [];
            if (!newLog.relatedPlotIds) newLog.relatedPlotIds = [];
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
                if (!campaign) return;

                // Clear the live-session pointers if the deleted log was the active one
                if (campaign.activeSessionId === id) {
                    campaign.activeSessionId = undefined;
                    campaign.activeSceneId = undefined;
                }

                campaign.sessionLogs = (campaign.sessionLogs || []).filter(l => l.id !== id);
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

        createPlot(newPlotData: Omit<Plot, 'id'>) {
            const newPlot: Plot = { ...newPlotData, id: crypto.randomUUID() };
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (campaign) {
                    campaign.plots = [...(campaign.plots || []), newPlot];
                }
            });
            return newPlot.id;
        },
        updatePlot(id: string, updatedData: Partial<Plot>) {
             updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign || !campaign.plots) return;
                const plot = campaign.plots.find(n => n.id === id);
                if (plot) {
                    Object.assign(plot, updatedData);
                }
            });
        },
        deletePlot(id: string) {
             updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;
                _purgeEntityReferences(campaign, id);
                campaign.plots = (campaign.plots || []).filter(n => n.id !== id);
            });
        },

        createNote(newNoteData: Omit<Note, 'id' | 'createdAt' | 'lastModified'>) {
            const newNote: Note = {
                ...newNoteData,
                id: crypto.randomUUID(),
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString()
            };
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

        // --- Secret CRUD ---
        createSecret(newSecretData: Omit<Secret, 'id' | 'createdAt'>): string {
            const newSecret: Secret = {
                ...newSecretData,
                id: crypto.randomUUID(),
                createdAt: new Date().toISOString(),
            };
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (campaign) {
                    if (!campaign.secrets) campaign.secrets = [];
                    campaign.secrets.push(newSecret);
                }
            });
            return newSecret.id;
        },
        updateSecret(id: string, updates: Partial<Secret>) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign || !campaign.secrets) return;
                const secret = campaign.secrets.find(s => s.id === id);
                if (secret) Object.assign(secret, updates);
            });
        },
        deleteSecret(id: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (campaign) {
                    campaign.secrets = (campaign.secrets || []).filter(s => s.id !== id);
                }
            });
        },
        revealSecret(id: string, sessionId?: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign || !campaign.secrets) return;
                const secret = campaign.secrets.find(s => s.id === id);
                if (secret) {
                    secret.isRevealed = true;
                    if (sessionId) secret.revealedInSessionId = sessionId;
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

        // --- Session Runner Methods ---

        /**
         * Starts a live session: sets the campaign's activeSessionId,
         * marks the session log as 'active', and activates the first planned scene.
         */
        goLive(sessionLogId: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;

                // Deactivate any currently active session
                campaign.sessionLogs?.forEach(log => {
                    if (log.status === 'active') log.status = 'planned';
                });

                const session = campaign.sessionLogs?.find(s => s.id === sessionLogId);
                if (!session) return;

                session.status = 'active';
                campaign.activeSessionId = sessionLogId;

                // Set session date if not already set
                if (!session.sessionDate || session.sessionDate === '') {
                    session.sessionDate = new Date().toISOString();
                }

                // Persist session start timestamp for the in-session timer
                if (!session.startedAt) {
                    session.startedAt = new Date().toISOString();
                }

                // Activate the first planned scene if adventure is linked
                if (session.adventureId && session.plannedSceneIds.length > 0) {
                    campaign.activeSceneId = session.plannedSceneIds[0];
                    // Set scene statuses
                    const adventure = campaign.adventures.find(a => a.id === session.adventureId);
                    if (adventure) {
                        adventure.scenes.forEach(scene => {
                            if (session.plannedSceneIds.includes(scene.id)) {
                                if (scene.id === session.plannedSceneIds[0]) {
                                    scene.status = 'in-progress';
                                } else {
                                    scene.status = scene.status === 'completed' ? 'completed' : 'planned';
                                }
                            }
                        });
                    }
                }

                // Log session start event
                if (!session.structuredNotes) session.structuredNotes = [];
                session.structuredNotes.push({
                    id: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                    content: `Session started: "${session.title}"`,
                    taggedEntityIds: [],
                });
            });
        },

        /**
         * Advances to the next scene in the active session.
         * Marks the current scene as 'completed' and the next as 'in-progress'.
         */
        advanceScene() {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign || !campaign.activeSessionId) return;

                const session = campaign.sessionLogs?.find(s => s.id === campaign.activeSessionId);
                if (!session || !session.adventureId) return;

                const adventure = campaign.adventures.find(a => a.id === session.adventureId);
                if (!adventure) return;

                const currentIndex = session.plannedSceneIds.indexOf(campaign.activeSceneId || '');
                if (currentIndex === -1) return;

                // Mark current scene completed
                const currentScene = adventure.scenes.find(s => s.id === session.plannedSceneIds[currentIndex]);
                if (currentScene) currentScene.status = 'completed';

                // Advance to next scene
                const nextIndex = currentIndex + 1;
                if (nextIndex < session.plannedSceneIds.length) {
                    const nextSceneId = session.plannedSceneIds[nextIndex];
                    campaign.activeSceneId = nextSceneId;
                    const nextScene = adventure.scenes.find(s => s.id === nextSceneId);
                    if (nextScene) nextScene.status = 'in-progress';

                    // Auto-log scene transition
                    const nextSceneName = nextScene?.title || 'Unknown';
                    if (!session.structuredNotes) session.structuredNotes = [];
                    session.structuredNotes.push({
                        id: crypto.randomUUID(),
                        timestamp: new Date().toISOString(),
                        content: `Scene transition: moved to "${nextSceneName}"`,
                        taggedEntityIds: [],
                        type: 'scene-transition',
                        isImportant: false,
                    });
                } else {
                    // No more scenes — clear active scene
                    campaign.activeSceneId = undefined;
                }
            });
        },

        /**
         * Sets a specific scene's status during a live session.
         */
        setSceneStatus(adventureId: string, sceneId: string, status: 'planned' | 'in-progress' | 'completed') {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;
                const adventure = campaign.adventures.find(a => a.id === adventureId);
                if (!adventure) return;
                const scene = adventure.scenes.find(s => s.id === sceneId);
                if (scene) scene.status = status;

                // Auto-log scene completion
                if (status === 'completed' && campaign.activeSessionId) {
                    const session = campaign.sessionLogs?.find(s => s.id === campaign.activeSessionId);
                    if (session) {
                        if (!session.structuredNotes) session.structuredNotes = [];
                        session.structuredNotes.push({
                            id: crypto.randomUUID(),
                            timestamp: new Date().toISOString(),
                            content: `Scene completed: "${scene.title}"`,
                            taggedEntityIds: [],
                            type: 'scene-transition',
                            isImportant: false,
                        });
                    }
                }
            });
        },

        /**
         * Ends the active session: archives active encounter to session log,
         * marks session as completed, clears active state.
         */
        endSession() {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign || !campaign.activeSessionId) return;

                const session = campaign.sessionLogs?.find(s => s.id === campaign.activeSessionId);
                if (session) {
                    session.status = 'completed';

                    // Archive the active encounter if one exists
                    if (campaign.activeEncounter) {
                        if (!session.encounterLog) session.encounterLog = [];
                        session.encounterLog.push({
                            ...campaign.activeEncounter,
                            sessionId: session.id,
                        });
                        campaign.activeEncounter = undefined;
                    }
                }

                // Clear active session state
                campaign.activeSessionId = undefined;
                campaign.activeSceneId = undefined;
            });
        },

        /**
         * Adds a structured note entry to the active session's running log.
         */
        addSessionRunnerNote(content: string, taggedEntityIds: string[] = [], type: SessionLogEntryType = 'manual', tags: string[] = []) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign || !campaign.activeSessionId) return;

                const session = campaign.sessionLogs?.find(s => s.id === campaign.activeSessionId);
                if (!session) return;

                if (!session.structuredNotes) session.structuredNotes = [];
                session.structuredNotes.push({
                    id: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                    content,
                    taggedEntityIds,
                    type,
                    tags: tags.length > 0 ? tags : undefined,
                    isImportant: false,
                });
            });
        },

        addDiceRollToSession(roll: DiceRoll) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign || !campaign.activeSessionId) return;
                const session = campaign.sessionLogs?.find(s => s.id === campaign.activeSessionId);
                if (!session) return;
                if (!session.diceRolls) session.diceRolls = [];
                session.diceRolls.push(roll);

                // Also add to structuredNotes so dice rolls appear in the running log timeline
                if (!session.structuredNotes) session.structuredNotes = [];
                const noteLabel = roll.note ? `${roll.note}: ` : '';
                session.structuredNotes.push({
                    id: crypto.randomUUID(),
                    timestamp: roll.timestamp || new Date().toISOString(),
                    content: `${noteLabel}${roll.formula} → [${roll.results.join(', ')}] = ${roll.total}`,
                    taggedEntityIds: [],
                    type: 'dice-roll',
                    isImportant: false,
                });
            });
        },

        /**
         * Adds an auto-generated event entry to the active session's running log.
         */
        addAutoEvent(type: SessionLogEntryType, content: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign || !campaign.activeSessionId) return;
                const session = campaign.sessionLogs?.find(s => s.id === campaign.activeSessionId);
                if (!session) return;
                if (!session.structuredNotes) session.structuredNotes = [];
                session.structuredNotes.push({
                    id: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                    content,
                    taggedEntityIds: [],
                    type: type || 'manual',
                    isImportant: false,
                });
            });
        },

        /**
         * Updates a plot's session-level progression status (advanced/stalled/unchanged).
         */
        updatePlotProgression(plotId: string, status: PlotSessionStatus) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign || !campaign.activeSessionId) return;
                const session = campaign.sessionLogs?.find(s => s.id === campaign.activeSessionId);
                if (!session) return;
                if (!session.plotProgressions) session.plotProgressions = {};
                session.plotProgressions[plotId] = status;
            });
        },

        /**
         * Toggles the isImportant flag on a session log note.
         */
        toggleNoteImportance(noteId: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign || !campaign.activeSessionId) return;
                const session = campaign.sessionLogs?.find(s => s.id === campaign.activeSessionId);
                if (!session || !session.structuredNotes) return;
                const note = session.structuredNotes.find(n => n.id === noteId);
                if (note) note.isImportant = !note.isImportant;
            });
        },

        /**
         * Deletes a structured note from the active session log.
         */
        deleteSessionNote(noteId: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign || !campaign.activeSessionId) return;
                const session = campaign.sessionLogs?.find(s => s.id === campaign.activeSessionId);
                if (!session?.structuredNotes) return;
                session.structuredNotes = session.structuredNotes.filter(n => n.id !== noteId);
            });
        },

        /**
         * Updates the text content of a structured note in the active session log.
         */
        updateSessionNoteContent(noteId: string, content: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign || !campaign.activeSessionId) return;
                const session = campaign.sessionLogs?.find(s => s.id === campaign.activeSessionId);
                if (!session?.structuredNotes) return;
                const note = session.structuredNotes.find(n => n.id === noteId);
                if (note) note.content = content;
            });
        },

        /**
         * Persists the session start timestamp so the timer survives re-mounts.
         * Only writes if startedAt is not already set.
         */
        setSessionStartedAt(sessionLogId: string, isoTimestamp: string) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;
                const session = campaign.sessionLogs?.find(s => s.id === sessionLogId);
                if (!session || session.startedAt) return; // already persisted
                session.startedAt = isoTimestamp;
            });
        },

        // --- Beat Methods ---

        addBeat(title: string, notes?: string): string {
            const beatId = crypto.randomUUID();
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign || !campaign.activeSessionId) return;
                const session = campaign.sessionLogs?.find(s => s.id === campaign.activeSessionId);
                if (!session) return;
                if (!session.beats) session.beats = [];
                session.beats.push({ id: beatId, title, notes, isCompleted: false });
            });
            return beatId;
        },

        updateBeat(id: string, updates: Partial<Beat>): void {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign || !campaign.activeSessionId) return;
                const session = campaign.sessionLogs?.find(s => s.id === campaign.activeSessionId);
                if (!session?.beats) return;
                const beat = session.beats.find(b => b.id === id);
                if (beat) Object.assign(beat, updates);
            });
        },

        deleteBeat(id: string): void {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign || !campaign.activeSessionId) return;
                const session = campaign.sessionLogs?.find(s => s.id === campaign.activeSessionId);
                if (!session?.beats) return;
                session.beats = session.beats.filter(b => b.id !== id);
            });
        },

        toggleBeatComplete(id: string): void {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign || !campaign.activeSessionId) return;
                const session = campaign.sessionLogs?.find(s => s.id === campaign.activeSessionId);
                if (!session?.beats) return;
                const beat = session.beats.find(b => b.id === id);
                if (beat) beat.isCompleted = !beat.isCompleted;
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
        
                const newLocations = data.locations.map(locData => ({ 
                    ...locData, 
                    id: crypto.randomUUID(), 
                    subLocationIds: [], 
                    connections: locData.connections || [], 
                    pointsOfInterest: locData.pointsOfInterest || [], 
                    loot: locData.loot || [],
                    history: locData.history || []
                }));
                newLocations.forEach(l => locationNameMap.set(l.name.toLowerCase(), l.id));
        
                const newNpcs = data.npcs.map(npcData => ({ 
                    ...npcData, 
                    id: crypto.randomUUID(), 
                    knowsPlayerHistory: [],
                    relationships: [],
                    history: [] 
                }));
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
