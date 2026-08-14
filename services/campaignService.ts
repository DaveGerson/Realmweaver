
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
import { importCampaignFromJsonValidated } from './importExportService';
import { parseCharacterSheetPdf } from './aiService';
import { storageService } from './storageService';
import { autoLinkScenes, autoLinkNpcFactions } from './linking/autoLinker';
import { createDefaultPlayerCharacter, createDefaultScene } from '../utils/entityUtils';

type AppStatus = 'loading' | 'welcome' | 'selecting' | 'creating' | 'editing';
export type SaveStatus = 'idle' | 'saved' | 'saving' | 'error' | 'quota-warning';

/**
 * Migrates a raw, possibly-old-shape array of campaign objects (freshly
 * `JSON.parse`d from localStorage or a backup slot) into the current
 * `Campaign[]` shape: backfills required array fields older/hand-edited saves
 * may be missing, and migrates legacy field names.
 *
 * Shared by every ingestion path that parses persisted campaign JSON
 * (init()'s happy path AND its backup-recovery path) so they cannot drift
 * apart the way init() and importExportService.normaliseRequiredArrays once
 * did (finding #35).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateCampaignsData(campaignsData: any[]): Campaign[] {
    return campaignsData.map(c => ({
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
            relatedPlotIds: l.relatedPlotIds || [],
            // Backfilled in lockstep with importExportService.normaliseRequiredArrays
            // (finding #35) — goLive()/advanceScene() dereference plannedSceneIds
            // unconditionally once an adventureId is set.
            plannedSceneIds: l.plannedSceneIds || [],
            encounterLog: l.encounterLog || [],
        })),
        playerCharacters: c.playerCharacters || [],
        npcs: (c.npcs || []).map((n: any) => ({ ...n, relationships: n.relationships || [], history: n.history || [] })),
        locations: (c.locations || []).map((l: any) => ({ ...l, history: l.history || [] })),
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
        activeEncounter: c.activeEncounter || { id: crypto.randomUUID(), round: 1, turnIndex: 0, combatants: [] },
    }));
}

/** Reads a File's contents as text via FileReader (works in both browser and jsdom test envs). */
function _readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve((event.target?.result as string) ?? '');
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

/**
 * Finding #38: `importExportService.validateImportedCampaign` (owned by
 * wp-b-import-export) doesn't know about the legacy `plots[].name` /
 * `plots[].keyNpcIds` shape — its generic title-entity validator auto-names
 * an untitled plot "Unnamed Plot N" and its array-normaliser resets a missing
 * `relatedEntityIds` to `[]`, which happens BEFORE campaignService ever sees
 * the data and permanently destroys the legacy field values. `init()` (via
 * `migrateCampaignsData`) migrates this exact legacy shape correctly because
 * it reads localStorage JSON directly, with no intervening validator.
 *
 * To make the import path apply the identical migration without editing
 * `importExportService.ts` (out of scope for wp-a-persistence), this rewrites
 * the raw file contents BEFORE handing them to `importCampaignFromJsonValidated`
 * — by the time the validator sees the plot, `title`/`relatedEntityIds` are
 * already populated exactly as `migrateCampaignsData` would have set them, so
 * the validator's own fallback naming never has a reason to fire.
 * Falls back to the original file untouched if it isn't valid JSON (the
 * validator's own parse-error handling still applies unchanged) or contains
 * no `plots` array.
 */
async function _preMigrateLegacyPlotFields(file: File): Promise<File> {
    let raw: string;
    try {
        raw = await _readFileAsText(file);
    } catch {
        return file;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return file; // Let importCampaignFromJsonValidated report the parse error as usual.
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return file;
    const data = parsed as Record<string, unknown>;
    if (!Array.isArray(data.plots)) return file;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data.plots = (data.plots as any[]).map((p) => {
        if (!p || typeof p !== 'object') return p;
        return {
            ...p,
            title: p.title || p.name || undefined,
            relatedEntityIds: p.relatedEntityIds || p.keyNpcIds || undefined,
        };
    });

    return new File([JSON.stringify(data)], file.name, { type: file.type || 'application/json' });
}

type CampaignState = {
  campaigns: Campaign[];
  activeCampaignId: string | null;
  appStatus: AppStatus;
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
  /** True when another browser tab has modified campaign data since this tab last saved. */
  conflictDetected: boolean;
  /**
   * True when init() had to recover the campaign library from a rotating
   * backup slot because the primary saved payload failed to parse (finding
   * #1 / idx7). The GM is silently continuing from a slightly older
   * snapshot unless this is surfaced — a dismissible banner (owned by
   * wp-e-app-shell) should read this and call
   * `campaignService.dismissBackupRecoveryNotice()`.
   */
  recoveredFromBackup: boolean;
};

/**
 * Creates an isolated, fully functional campaign store.
 * This factory pattern allows the main app to use a singleton instance
 * while enabling isolated instances for testing.
 */
export function createCampaignStore(config: { persist?: boolean } = {}) {
    const shouldPersist = config.persist ?? true;
    const AUTO_SAVE_DELAY_MS = 2000;
    // Bounded max-wait (finding #8): even if edits keep re-arming the 2s
    // debounce (e.g. continuous typing in a textarea), force a flush this
    // often so a long uninterrupted burst is never entirely lost.
    const AUTO_SAVE_MAX_WAIT_MS = 10000;

    let state: CampaignState = {
        campaigns: [],
        activeCampaignId: null,
        appStatus: 'loading',
        saveStatus: 'idle',
        lastSavedAt: null,
        conflictDetected: false,
        recoveredFromBackup: false,
    };

    let saveTimeout: any = null;
    let maxWaitTimeout: any = null;
    // Finding idx7: monotonic token guarding against a stale in-flight
    // persistToStorage() call clobbering saveStatus/lastSavedAt after a
    // newer save has already completed.
    let saveSequenceToken = 0;
    // Finding idx6: disposer for init()'s window/document listeners + the
    // storageService conflict subscription, so a re-`init()` call (or a
    // caller that wants to tear a store down) doesn't leave a prior
    // registration's closures still firing alongside a new one.
    let _disposeInit: (() => void) | null = null;

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

    /**
     * Writes state to storage. The primary `localStorage.setItem` calls (via
     * storageService.save) happen synchronously, before the first `await` —
     * that's what lets `flushPendingSaveSync()` (finding #8, unload flush)
     * guarantee data is on disk by the time a `pagehide`/`beforeunload`
     * handler returns, even though this function is `async` overall.
     *
     * The `await` below (finding #9) waits for DURABLE confirmation of the
     * write — for a plain localStorage write that's immediate, but for a
     * quota-fallback IndexedDB write it's the real async completion. Only
     * once that resolves do we stamp `lastSavedAt` / report a non-error
     * status; a write that never durably lands (e.g. IndexedDB unavailable
     * in private browsing) now surfaces `saveStatus: 'error'` instead of a
     * false "saved"/"quota-warning".
     */
    const persistToStorage = async () => {
        if (!shouldPersist || state.appStatus === 'loading') {
            return;
        }

        // Finding #13 (blocker): while a cross-tab conflict is flagged and
        // unresolved, this tab's in-memory snapshot may be stale relative to
        // what the other tab already wrote. Refuse to save until the user
        // resolves it via resolveConflict('reload' | 'overwrite') — writing
        // now would silently clobber the other tab's newer data.
        if (state.conflictDetected) {
            return;
        }

        // Finding idx7 (verifier follow-up on #9): persistToStorage is async
        // and fire-and-forget from several call sites (scheduleSave's
        // setTimeout, the max-wait timer, flushPendingSaveSync,
        // saveCampaign). If a slow write is still awaiting durability
        // confirmation when a LATER save already completed, the slow one's
        // `_internalUpdate` could stamp `saveStatus`/`lastSavedAt` after the
        // newer, more-current result — reporting stale information. A
        // monotonically increasing token lets only the newest in-flight
        // write's completion actually update state.
        const myToken = ++saveSequenceToken;
        const isStillCurrent = () => myToken === saveSequenceToken;

        const campaignsResult = storageService.save(
            CAMPAIGNS_STORAGE_KEY,
            JSON.stringify(state.campaigns)
        );

        let activeIdResult: { success: boolean; quotaWarning: boolean; error?: string; pending?: Promise<void> } =
            { success: true, quotaWarning: false, pending: Promise.resolve() };
        if (state.activeCampaignId) {
            // Finding #0 refinement: the active-campaign-id is a tiny scalar —
            // rotating a 3-slot backup history for it is pure overhead (and
            // used to corrupt the campaigns key's OWN backup buffer before
            // slots were namespaced per-key). Opt it out of backups entirely.
            activeIdResult = storageService.save(
                ACTIVE_CAMPAIGN_ID_KEY,
                state.activeCampaignId,
                { skipBackup: true }
            );
        } else {
            storageService.remove(ACTIVE_CAMPAIGN_ID_KEY);
        }

        const overallSuccess = campaignsResult.success && activeIdResult.success;
        const quotaWarning = campaignsResult.quotaWarning || activeIdResult.quotaWarning;

        if (!overallSuccess) {
            console.error('[campaignService] Failed to save state:', campaignsResult.error);
            if (isStillCurrent()) {
                _internalUpdate(draft => {
                    draft.saveStatus = 'error';
                });
            }
            return;
        }

        try {
            await Promise.all([
                campaignsResult.pending ?? Promise.resolve(),
                activeIdResult.pending ?? Promise.resolve(),
            ]);
        } catch (err) {
            console.error('[campaignService] Save was not durably confirmed:', err);
            if (isStillCurrent()) {
                _internalUpdate(draft => {
                    draft.saveStatus = 'error';
                });
            }
            return;
        }

        if (isStillCurrent()) {
            _internalUpdate(draft => {
                draft.saveStatus = quotaWarning ? 'quota-warning' : 'saved';
                draft.lastSavedAt = new Date().toISOString();
            });
        }
        if (quotaWarning) {
            console.warn('[campaignService] Save succeeded via IndexedDB fallback — localStorage quota exceeded.');
        } else {
            console.log('Campaign auto-saved successfully.');
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
            saveTimeout = null;
            if (maxWaitTimeout) {
                clearTimeout(maxWaitTimeout);
                maxWaitTimeout = null;
            }
            persistToStorage();
        }, AUTO_SAVE_DELAY_MS);

        // Arm the max-wait timer only for the FIRST pending change in a burst
        // (finding #8) — re-arming it on every keystroke would defeat the
        // point, since it needs to fire on a fixed cadence regardless of
        // continued activity.
        if (!maxWaitTimeout) {
            maxWaitTimeout = setTimeout(() => {
                maxWaitTimeout = null;
                if (saveTimeout) {
                    clearTimeout(saveTimeout);
                    saveTimeout = null;
                }
                persistToStorage();
            }, AUTO_SAVE_MAX_WAIT_MS);
        }
    };

    /**
     * Flushes any pending debounced save immediately and synchronously
     * (finding #8). Used by the page-lifecycle handlers registered in init()
     * so navigating away / closing the tab never discards an uncommitted
     * burst of edits still waiting out the debounce window.
     */
    const flushPendingSaveSync = () => {
        if (!shouldPersist) return;
        // Finding #0 refinement: only actually persist when a save was
        // genuinely pending. A real unload fires `visibilitychange`,
        // `pagehide` AND `beforeunload` in quick succession — without this
        // guard the first flush does the real work and the next two fire a
        // redundant save each, rotating fresh (identical) copies through the
        // backup buffer and evicting older, actually-useful generations.
        const hadPendingSave = saveTimeout !== null || maxWaitTimeout !== null;
        if (saveTimeout) {
            clearTimeout(saveTimeout);
            saveTimeout = null;
        }
        if (maxWaitTimeout) {
            clearTimeout(maxWaitTimeout);
            maxWaitTimeout = null;
        }
        if (!hadPendingSave) return;
        // Fire-and-forget: the synchronous localStorage write inside happens
        // before this call returns; the rest (durability confirmation) can
        // resolve after the page has started unloading.
        void persistToStorage();
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
     * relatedEntityIds + mentionedEntityIds, SessionLog relatedPlotIds +
     * plotProgressions (for when the deleted entity is a Plot), Faction
     * leaderId/headquartersLocationId, Location.connections, Secret
     * linkedEntityIds + revealedInSessionId, SessionLog
     * structuredNotes[].taggedEntityIds + plannedNpcIds + plannedLocationIds,
     * and Campaign.pinnedEntities (finding #10).
     *
     * Called from every entity delete method — including
     * deleteScene/deleteSessionLog/deletePlayerCharacter/deleteNote/
     * deleteSecret, not just NPC/Location/Faction/Plot/Article (verifier
     * follow-up on #10: those five were wired to the individual-array splice
     * but never called this sweep, so e.g. a deleted scene's id survived in
     * every mentionedEntityIds array and a deleted note/secret/session-log/PC
     * id survived in pinnedEntities forever).
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
            if (loc.connections) {
                loc.connections = loc.connections.filter(c => c.targetLocationId !== entityId);
            }
        });

        draftCampaign.factions.forEach(faction => {
            if (faction.mentionedEntityIds) {
                faction.mentionedEntityIds = faction.mentionedEntityIds.filter(id => id !== entityId);
            }
            if (faction.leaderId === entityId) {
                faction.leaderId = undefined;
            }
            if (faction.headquartersLocationId === entityId) {
                faction.headquartersLocationId = undefined;
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
            if (log.structuredNotes) {
                log.structuredNotes.forEach(entry => {
                    if (entry.taggedEntityIds) {
                        entry.taggedEntityIds = entry.taggedEntityIds.filter(id => id !== entityId);
                    }
                });
            }
            // Finding idx1/idx2 (verifier follow-up on #10/#26): session-prep
            // planned rosters are id-bearing arrays too — an NPC/Location
            // deleted after a session is prepped otherwise stays listed as
            // "planned" forever.
            if (log.plannedNpcIds) {
                log.plannedNpcIds = log.plannedNpcIds.filter(id => id !== entityId);
            }
            if (log.plannedLocationIds) {
                log.plannedLocationIds = log.plannedLocationIds.filter(id => id !== entityId);
            }
        });

        (draftCampaign.secrets || []).forEach(secret => {
            if (secret.linkedEntityIds) {
                secret.linkedEntityIds = secret.linkedEntityIds.filter(id => id !== entityId);
            }
            // Finding idx1 (verifier follow-up on #10): deleting the session
            // log a secret was revealed in must not leave a dangling pointer.
            if (secret.revealedInSessionId === entityId) {
                secret.revealedInSessionId = undefined;
            }
        });

        if (draftCampaign.pinnedEntities) {
            draftCampaign.pinnedEntities = draftCampaign.pinnedEntities.filter(p => p.id !== entityId);
        }
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
            // Finding idx6: an idempotence guard — re-calling init() on a
            // store that already registered listeners (or a caller that
            // wants a clean re-init) must not accumulate a second set of
            // window/document listeners alongside the first, still-active
            // set (each firing its own persistToStorage against the same
            // localStorage keys on every teardown event).
            if (_disposeInit) {
                _disposeInit();
                _disposeInit = null;
            }

            if (!shouldPersist) {
                _internalUpdate(draft => { draft.appStatus = 'welcome'; });
                return;
            }

            // Wire cross-tab conflict detection (5.5).
            // The window `storage` event fires when ANOTHER tab writes to localStorage.
            //
            // Finding #13 (blocker): an earlier version of this handler reloaded
            // this tab's `draft.campaigns` from the other tab's snapshot right
            // here — which silently threw away whatever THIS tab had edited
            // in-memory but not yet saved (a tab mid-edit could lose everything
            // it typed on every conflicting autosave). Policy (b): merely raise
            // the flag. `persistToStorage` refuses to write while it is set, so
            // the stale tab can no longer clobber the other tab's newer data,
            // and nothing is discarded until the user explicitly picks a side
            // via `resolveConflict('reload' | 'overwrite')` — wp-e's Header
            // banner is expected to read `state.conflictDetected` and call it.
            const unsubscribeConflict = storageService.onConflict((key) => {
                if (key === CAMPAIGNS_STORAGE_KEY) {
                    _internalUpdate(draft => {
                        draft.conflictDetected = true;
                    });
                }
            });

            // Flush any pending debounced save synchronously when the page is being
            // hidden/unloaded (finding #8) — otherwise a GM who types for a while and
            // then immediately closes the tab loses the entire uncommitted burst,
            // since the 2s/10s debounce timers never get a chance to fire.
            let removeWindowListeners: (() => void) | null = null;
            if (typeof window !== 'undefined') {
                const flushOnTeardown = () => flushPendingSaveSync();
                const onVisibilityChange = () => {
                    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                        flushOnTeardown();
                    }
                };
                window.addEventListener('pagehide', flushOnTeardown);
                window.addEventListener('beforeunload', flushOnTeardown);
                if (typeof document !== 'undefined') {
                    document.addEventListener('visibilitychange', onVisibilityChange);
                }
                removeWindowListeners = () => {
                    window.removeEventListener('pagehide', flushOnTeardown);
                    window.removeEventListener('beforeunload', flushOnTeardown);
                    if (typeof document !== 'undefined') {
                        document.removeEventListener('visibilitychange', onVisibilityChange);
                    }
                };
            }

            _disposeInit = () => {
                unsubscribeConflict();
                removeWindowListeners?.();
            };

            // Use the async, IndexedDB-aware `load()` (not `loadSync()`) so that data
            // which only made it to IndexedDB — because a previous save() hit the
            // localStorage quota and fell back to IDB — is not silently lost on the
            // next app load. Kept as a fire-and-forget inner async block (rather than
            // marking `init` itself `async`) so `init`'s public signature stays
            // `() => void` for callers/tests that replace it with a synchronous stub.
            // `appStatus` starts (and stays) 'loading' until this resolves, which the
            // UI already renders a loading state for.
            void (async () => {
                // Finding #3 (wp-e-app-shell, service half — storageService.load()/
                // campaignService.init() live in files owned by wp-a-persistence):
                // storageService.load() reads `globalThis.localStorage` outside any
                // try block, so in a browser that throws SecurityError on localStorage
                // access (Firefox with all cookies blocked, Safari private mode) this
                // whole IIFE rejected unhandled and appStatus was stranded at
                // 'loading' forever — a permanently blank page with no recovery path.
                // Wrapping the read (and the state-derivation below) in try/catch
                // guarantees `init()` always resolves to a renderable appStatus.
                let savedCampaigns: string | null = null;
                let savedActiveId: string | null = null;
                try {
                    [savedCampaigns, savedActiveId] = await Promise.all([
                        storageService.load(CAMPAIGNS_STORAGE_KEY),
                        storageService.load(ACTIVE_CAMPAIGN_ID_KEY),
                    ]);
                } catch (e) {
                    console.error('[campaignService] Failed to read from storage during init():', e);
                    _internalUpdate(draft => { draft.appStatus = 'welcome'; });
                    return;
                }

                _internalUpdate(draft => {
                    if (savedCampaigns) {
                        try {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const campaignsData: any[] = JSON.parse(savedCampaigns);
                            draft.campaigns = migrateCampaignsData(campaignsData);

                            if (savedActiveId && draft.campaigns.some(c => c.id === savedActiveId)) {
                                draft.activeCampaignId = savedActiveId;
                                draft.appStatus = 'editing';
                            } else if (draft.campaigns.length > 0) {
                                draft.appStatus = 'selecting';
                            } else {
                                draft.appStatus = 'welcome';
                            }
                        } catch (e) {
                            // Finding #1: a JSON.parse failure here used to `remove()` the
                            // primary key (which also nukes the IndexedDB copy), destroying
                            // the user's entire campaign library with no chance of recovery.
                            // Instead, walk the rotating backup buffer (5.6) newest-first and
                            // recover from the first slot that parses — getBackups() is
                            // synchronous, so this is safe to do inside the Immer recipe.
                            console.error("Failed to parse saved campaigns — attempting backup recovery.", e);

                            let recovered = false;
                            const backups = storageService.getBackups(CAMPAIGNS_STORAGE_KEY);
                            for (const backup of backups) {
                                try {
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    const backupData: any[] = JSON.parse(backup.data);
                                    draft.campaigns = migrateCampaignsData(backupData);
                                    recovered = true;
                                    break;
                                } catch {
                                    // This slot is also corrupt — try the next-oldest one.
                                }
                            }

                            if (recovered) {
                                // Finding idx7: surface the recovery rather than
                                // continuing silently on a possibly-older
                                // snapshot — a GM who doesn't know can overwrite
                                // the corrupt-but-newer payload without ever
                                // finding out data was rolled back.
                                draft.recoveredFromBackup = true;
                                if (savedActiveId && draft.campaigns.some(c => c.id === savedActiveId)) {
                                    draft.activeCampaignId = savedActiveId;
                                    draft.appStatus = 'editing';
                                } else if (draft.campaigns.length > 0) {
                                    draft.appStatus = 'selecting';
                                } else {
                                    draft.appStatus = 'welcome';
                                }
                            } else {
                                // No backup slot parsed either. Deliberately do NOT call
                                // storageService.remove() — the corrupt-but-possibly
                                // hand-recoverable payload is left in place (under its
                                // original key) so the GM still has a chance at manual
                                // recovery / export instead of silent, total data loss.
                                draft.appStatus = 'welcome';
                            }
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

        /**
         * Tears down the listeners `init()` registered (finding idx6):
         * the storageService conflict subscription and the
         * pagehide/beforeunload/visibilitychange handlers. Safe to call
         * even if init() was never called or was already disposed. Tests
         * that construct multiple `persist: true` stores in the same jsdom
         * environment should call this in `afterEach` so an old store's
         * handlers don't keep firing (and writing) alongside a new one.
         */
        destroy() {
            _disposeInit?.();
            _disposeInit = null;
        },

        // --- Campaign Level Actions ---
        saveCampaign() {
            // Manual save trigger (forces immediate save)
            if (saveTimeout) clearTimeout(saveTimeout);
            if (maxWaitTimeout) clearTimeout(maxWaitTimeout);
            saveTimeout = null;
            maxWaitTimeout = null;
            _internalUpdate(draft => { draft.saveStatus = 'saving'; });
            setTimeout(persistToStorage, 0);
        },

        /**
         * Resolves a cross-tab conflict raised by init()'s `storage`-event
         * listener (finding #13). `persistToStorage` refuses to write while
         * `conflictDetected` is true, so the GM must explicitly choose:
         *   - 'reload': discard this tab's in-memory campaigns and adopt
         *     whatever is currently persisted (the other tab's write).
         *   - 'overwrite': keep this tab's in-memory campaigns exactly as
         *     they are and force-save them now, superseding the other tab.
         * Either way `conflictDetected` is cleared afterward so autosave
         * resumes. Intended to be called from a banner (owned by
         * wp-e-app-shell) that reads `getState().conflictDetected`.
         */
        resolveConflict(choice: 'reload' | 'overwrite') {
            if (choice === 'reload') {
                _internalUpdate(draft => {
                    draft.conflictDetected = false;
                    try {
                        const fresh = storageService.loadSync(CAMPAIGNS_STORAGE_KEY);
                        if (fresh) {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const parsed: any[] = JSON.parse(fresh);
                            draft.campaigns = migrateCampaignsData(parsed);
                            if (draft.activeCampaignId && !draft.campaigns.some(c => c.id === draft.activeCampaignId)) {
                                draft.activeCampaignId = null;
                                draft.appStatus = 'selecting';
                            }
                        }
                    } catch {
                        // The other tab's on-disk snapshot doesn't parse — keep
                        // this tab's current in-memory campaigns rather than
                        // losing them to a corrupt reload.
                    }
                });
            } else {
                _internalUpdate(draft => { draft.conflictDetected = false; });
                // Force-save now that the block has been explicitly lifted —
                // don't wait out the debounce, the user just made a decision.
                void persistToStorage();
            }
        },

        /** Dismisses the "recovered from backup" notice (finding idx7). */
        dismissBackupRecoveryNotice() {
            _internalUpdate(draft => { draft.recoveredFromBackup = false; });
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
            // Finding idx4 (verifier follow-up on #11): `remap()` MINTS a
            // fresh id for any id not already in the table, so it never
            // actually returns undefined for a defined input — the
            // `remap(x) ?? x` form previously used here (and in the
            // connections/relationships/plotProgressions mappers below) was
            // dead code that silently converted an unknown/dangling id into
            // a brand-new random UUID rather than genuinely preserving it as
            // the comment claimed. `idMap` is pre-populated with every id
            // actually owned by an entity in this campaign (see the
            // pre-registration pass below), so a TRUE pure lookup — one that
            // can really fall through to `?? id` — is what makes the
            // "preserve, don't mint a fresh dangling ref" promise real for
            // optional/outbound reference fields.
            const remapIds = (ids: string[] | undefined): string[] =>
                (ids ?? []).map(id => idMap.get(id) ?? id);

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
                    // Finding idx2 (verifier follow-up on #11): a history
                    // entry's referenceId points at a sessionLog or article id
                    // (see HistoryEntry.referenceType) — without remapping it,
                    // EntityHistoryManager resolves it against the SOURCE
                    // campaign's ids, which don't exist in the copy.
                    history: (n.history ?? []).map(h => ({ ...h, referenceId: remap(h.referenceId) })),
                    relationships: (n.relationships ?? []).map(r => ({
                        ...r,
                        // Finding idx4: pure lookup, not the dead `remap(x) ?? x` form.
                        targetId: idMap.get(r.targetId) ?? r.targetId,
                    })),
                    mentionedEntityIds: remapIds(n.mentionedEntityIds),
                })),

                locations: source.locations.map(l => ({
                    ...l,
                    id: remapRequired(l.id),
                    parentLocationId: remap(l.parentLocationId),
                    subLocationIds: (l.subLocationIds ?? []).map(remapRequired),
                    history: (l.history ?? []).map(h => ({ ...h, referenceId: remap(h.referenceId) })),
                    controllingFactionId: remap(l.controllingFactionId),
                    connections: (l.connections ?? []).map(c => ({
                        ...c,
                        // Finding idx4: pure lookup, not the dead `remap(x) ?? x` form.
                        targetLocationId: idMap.get(c.targetLocationId) ?? c.targetLocationId,
                    })),
                    mentionedEntityIds: remapIds(l.mentionedEntityIds),
                })),

                factions: source.factions.map(f => ({
                    ...f,
                    id: remapRequired(f.id),
                    leaderId: remap(f.leaderId),
                    memberIds: (f.memberIds ?? []).map(remapRequired),
                    headquartersLocationId: remap(f.headquartersLocationId),
                    mentionedEntityIds: remapIds(f.mentionedEntityIds),
                })),

                items: source.items.map(i => ({ ...i, id: remapRequired(i.id) })),

                articles: source.articles.map(a => ({
                    ...a,
                    id: remapRequired(a.id),
                    parentArticleId: remap(a.parentArticleId),
                    subArticleIds: (a.subArticleIds ?? []).map(remapRequired),
                    relatedEntityIds: remapIds(a.relatedEntityIds),
                    mentionedEntityIds: remapIds(a.mentionedEntityIds),
                })),

                adventures: source.adventures.map(adv => ({
                    ...adv,
                    id: remapRequired(adv.id),
                    scenes: adv.scenes.map(s => ({
                        ...s,
                        id: remapRequired(s.id),
                        locationId: remap(s.locationId),
                        npcIds: (s.npcIds ?? []).map(remapRequired),
                        mentionedEntityIds: remapIds(s.mentionedEntityIds),
                    })),
                })),

                sessionLogs: (source.sessionLogs ?? []).map(l => ({
                    ...l,
                    id: remapRequired(l.id),
                    // Clear "active" status — no live session in a copy
                    status: (l.status === 'active' ? 'planned' : l.status) as typeof l.status,
                    adventureId: remap(l.adventureId),
                    plannedSceneIds: (l.plannedSceneIds ?? []).map(remapRequired),
                    // Finding idx2 (verifier follow-up on #11/#26): these were
                    // riding through the `...l` spread untouched, so a
                    // duplicated campaign's session logs pointed at the
                    // SOURCE campaign's NPC/Location ids.
                    plannedNpcIds: remapIds(l.plannedNpcIds),
                    plannedLocationIds: remapIds(l.plannedLocationIds),
                    relatedPlotIds: (l.relatedPlotIds ?? []).map(remapRequired),
                    plotProgressions: l.plotProgressions
                        ? Object.fromEntries(
                              // Finding idx4: pure lookup, not the dead `remap(x) ?? x` form.
                              Object.entries(l.plotProgressions).map(([plotId, status]) => [idMap.get(plotId) ?? plotId, status])
                          )
                        : l.plotProgressions,
                    structuredNotes: (l.structuredNotes ?? []).map(entry => ({
                        ...entry,
                        taggedEntityIds: remapIds(entry.taggedEntityIds),
                    })),
                })),

                playerCharacters: (source.playerCharacters ?? []).map(pc => ({
                    ...pc,
                    id: remapRequired(pc.id),
                })),

                plots: (source.plots ?? []).map(p => ({
                    ...p,
                    id: remapRequired(p.id),
                    relatedEntityIds: remapIds(p.relatedEntityIds),
                    mentionedEntityIds: remapIds(p.mentionedEntityIds),
                })),

                notes: (source.notes ?? []).map(n => ({ ...n, id: remapRequired(n.id) })),

                secrets: (source.secrets ?? []).map(s => ({
                    ...s,
                    id: remapRequired(s.id),
                    linkedEntityIds: remapIds(s.linkedEntityIds),
                    revealedInSessionId: remap(s.revealedInSessionId),
                })),
            };

            updateState(draft => {
                draft.campaigns.push(newCampaign);
            });

            return newCampaignId;
        },
        /**
         * Imports a campaign from an exported JSON file.
         *
         * Finding #12: uses `importCampaignFromJsonValidated` (rather than the
         * throw-on-error `importCampaignFromJson` wrapper) so the structural
         * validation warnings collected by `validateImportedCampaign` (e.g.
         * "N NPC(s) were removed because they were missing a required id
         * field") are not silently discarded — they are returned to the
         * caller alongside the title so the UI can surface each one. On
         * validation failure, throws (preserving the previous catch/throw
         * contract callers already rely on).
         *
         * Finding #38: runs the imported campaign through the same
         * `migrateCampaignsData` mapper `init()` uses, so legacy fields
         * (`plots[].name` → `title`, `plots[].keyNpcIds` → `relatedEntityIds`,
         * and every other required-array backfill) are migrated identically
         * regardless of which ingestion path the data came through.
         */
        async importCampaign(file: File): Promise<{ title: string; warnings: string[] }> {
            try {
                const preMigratedFile = await _preMigrateLegacyPlotFields(file);
                const result = await importCampaignFromJsonValidated(preMigratedFile);
                if (!result.success || !result.campaign) {
                    throw new Error(result.errors.join(' '));
                }
                const warnings = result.warnings;
                const rawCampaign = result.campaign;

                let finalTitle = rawCampaign.title;
                updateState(draft => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const campaignToImport: any = { ...rawCampaign };
                    if (draft.campaigns.some(c => c.id === campaignToImport.id)) {
                        campaignToImport.id = crypto.randomUUID();
                    }

                    const [migrated] = migrateCampaignsData([campaignToImport]);
                    finalTitle = migrated.title;

                    draft.campaigns.push(migrated);
                    draft.activeCampaignId = null;
                    draft.appStatus = 'selecting';
                });
                return { title: finalTitle, warnings };
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
         *
         * Template JSON is documented as accepting the same shape produced by
         * "Export Campaign" — so every entity array a full export can contain
         * (npcs, locations, factions, adventures, items, articles, notes,
         * secrets, session logs, player characters, plots) is carried through
         * here (finding #93); nothing is silently dropped on the floor.
         */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        importTemplateData(templateData: any) {
            updateState(draft => {
                const campaign = getActiveCampaignFromState(draft);
                if (!campaign) return;

                // --- Build an ID-remap table -----------------------------------
                // Pre-register every id actually OWNED by an entity in the
                // template (two-pass, like duplicateCampaign) so `remap()` is a
                // pure lookup rather than a minter. A reference to an id that no
                // entity in the template owns (a typo, a dangling pointer left
                // over from a hand-edited export, `undefined`) resolves to
                // `undefined` and is dropped — NOT turned into a fresh UUID that
                // points at nothing (finding #93).
                const idMap = new Map<string, string>();
                const registerId = (id: unknown) => {
                    if (typeof id === 'string' && id && !idMap.has(id)) {
                        idMap.set(id, crypto.randomUUID());
                    }
                };
                const rawNpcs: any[] = templateData.npcs || [];
                const rawFactions: any[] = templateData.factions || [];
                const rawLocations: any[] = templateData.locations || [];
                const rawItems: any[] = templateData.items || [];
                const rawArticles: any[] = templateData.articles || [];
                const rawAdventures: any[] = templateData.adventures || [];
                const rawPlots: any[] = templateData.plots || [];
                const rawNotes: any[] = templateData.notes || [];
                const rawSecrets: any[] = templateData.secrets || [];
                const rawSessionLogs: any[] = templateData.sessionLogs || [];
                const rawPlayerCharacters: any[] = templateData.playerCharacters || [];

                rawNpcs.forEach(n => registerId(n.id));
                rawFactions.forEach(f => registerId(f.id));
                rawLocations.forEach(l => {
                    registerId(l.id);
                    // Finding #93's verifier follow-up: PointOfInterest ids must
                    // be pre-registered too — LootItem.pointOfInterestId is a
                    // cross-reference to one, and without registering it here
                    // the PoI gets re-minted with a bare, unregistered
                    // crypto.randomUUID() below while the preserved loot item
                    // keeps pointing at the TEMPLATE's old (now dangling) id.
                    (l.pointsOfInterest || []).forEach((poi: any) => registerId(poi.id));
                });
                rawItems.forEach(i => registerId(i.id));
                rawArticles.forEach(a => registerId(a.id));
                rawAdventures.forEach(a => {
                    registerId(a.id);
                    (a.scenes || []).forEach((s: any) => registerId(s.id));
                });
                rawPlots.forEach(p => registerId(p.id));
                rawNotes.forEach(n => registerId(n.id));
                rawSecrets.forEach(s => registerId(s.id));
                rawSessionLogs.forEach(l => registerId(l.id));
                rawPlayerCharacters.forEach(pc => registerId(pc.id));

                const remap = (oldId: unknown): string | undefined =>
                    typeof oldId === 'string' && oldId ? idMap.get(oldId) : undefined;
                // Every entity we are about to CREATE has already been
                // pre-registered above, so this always resolves — the `??`
                // fallback only covers the pathological case of an entity
                // with no `id` field at all in the source template.
                const remapRequired = (oldId: unknown): string => remap(oldId) ?? crypto.randomUUID();
                const remapIds = (ids: unknown): string[] =>
                    Array.isArray(ids) ? (ids.map(id => remap(id)).filter((id): id is string => !!id)) : [];

                // Override title/setting from template
                if (templateData.title) campaign.title = templateData.title;
                if (templateData.setting) campaign.setting = templateData.setting;
                if (templateData.settingType) campaign.settingType = templateData.settingType;

                // --- NPCs ---
                rawNpcs.forEach((n: any) => {
                    const newId = remapRequired(n.id);
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
                        factionId: remap(n.factionId),
                        // Finding #93's verifier follow-up: this was the last
                        // remaining silently-blanked NPC array — playerId
                        // references are remappable now that playerCharacters
                        // are imported and registered too.
                        knowsPlayerHistory: (n.knowsPlayerHistory || [])
                            .map((h: any) => ({ ...h, playerId: remap(h.playerId) }))
                            .filter((h: any) => !!h.playerId),
                        relationships: (n.relationships || [])
                            .map((r: any) => ({ ...r, id: r.id || crypto.randomUUID(), targetId: remap(r.targetId) }))
                            .filter((r: any) => !!r.targetId),
                        history: (n.history || []).map((h: any) => ({
                            ...h,
                            id: h.id || crypto.randomUUID(),
                            referenceId: remap(h.referenceId),
                        })),
                        mentionedEntityIds: remapIds(n.mentionedEntityIds),
                    };
                    campaign.npcs.push(npc);
                });

                // --- Factions ---
                rawFactions.forEach((f: any) => {
                    const newId = remapRequired(f.id);
                    const faction: Faction = {
                        id: newId,
                        name: f.name || 'Unnamed Faction',
                        description: f.description || '',
                        goals: f.goals || '',
                        alignment: f.alignment,
                        resources: f.resources,
                        influence: f.influence,
                        memberIds: remapIds(f.memberIds),
                        headquartersLocationId: remap(f.headquartersLocationId),
                        leaderId: remap(f.leaderId),
                        mentionedEntityIds: remapIds(f.mentionedEntityIds),
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
                rawLocations.forEach((l: any) => {
                    const newId = remapRequired(l.id);
                    const location: Location = {
                        id: newId,
                        name: l.name || 'Unnamed Location',
                        description: l.description || '',
                        secrets: l.secrets || '',
                        // Finding #93's verifier follow-up: loot.pointOfInterestId
                        // is a cross-reference to a PointOfInterest — remap it
                        // (dropping it, not leaving it dangling, if unresolved)
                        // now that PoI ids are pre-registered above and minted
                        // via remapRequired below instead of a bare fresh UUID.
                        loot: (l.loot || []).map((item: any) => ({
                            ...item,
                            id: item.id || crypto.randomUUID(),
                            pointOfInterestId: remap(item.pointOfInterestId),
                        })),
                        parentLocationId: remap(l.parentLocationId),
                        subLocationIds: remapIds(l.subLocationIds),
                        connections: (l.connections || [])
                            .map((c: any) => ({ ...c, id: c.id || crypto.randomUUID(), targetLocationId: remap(c.targetLocationId) }))
                            .filter((c: any) => !!c.targetLocationId),
                        pointsOfInterest: (l.pointsOfInterest || []).map((poi: any) => ({
                            ...poi,
                            id: remapRequired(poi.id),
                            investigationChecks: poi.investigationChecks || [],
                            interactions: poi.interactions || [],
                        })),
                        controllingFactionId: remap(l.controllingFactionId),
                        history: (l.history || []).map((h: any) => ({
                            ...h,
                            id: h.id || crypto.randomUUID(),
                            referenceId: remap(h.referenceId),
                        })),
                        mentionedEntityIds: remapIds(l.mentionedEntityIds),
                    };
                    campaign.locations.push(location);
                });

                // --- Adventures (with Scenes) ---
                rawAdventures.forEach((a: any) => {
                    const advId = remapRequired(a.id);
                    const adventure: Adventure = {
                        id: advId,
                        title: a.title || 'Untitled Adventure',
                        level: a.level || 1,
                        hook: a.hook || '',
                        theme: a.theme || '',
                        scenes: (a.scenes || []).map((s: any) => ({
                            id: remapRequired(s.id),
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
                            locationId: remap(s.locationId),
                            npcIds: remapIds(s.npcIds),
                            mentionedEntityIds: remapIds(s.mentionedEntityIds),
                        })),
                    };
                    campaign.adventures.push(adventure);
                });

                // --- Items ---
                rawItems.forEach((i: any) => {
                    const item: Item = {
                        id: remapRequired(i.id),
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

                // --- Articles ---
                rawArticles.forEach((a: any) => {
                    const article: Article = {
                        id: remapRequired(a.id),
                        title: a.title || 'Untitled Article',
                        category: a.category || 'lore',
                        content: a.content || '',
                        parentArticleId: remap(a.parentArticleId),
                        subArticleIds: remapIds(a.subArticleIds),
                        relatedEntityIds: remapIds(a.relatedEntityIds),
                        mentionedEntityIds: remapIds(a.mentionedEntityIds),
                    };
                    campaign.articles.push(article);
                });

                // --- Notes ---
                rawNotes.forEach((n: any) => {
                    const note: Note = {
                        id: remapRequired(n.id),
                        title: n.title || 'Untitled Note',
                        content: n.content || '',
                        tags: n.tags || [],
                        createdAt: n.createdAt || new Date().toISOString(),
                        lastModified: n.lastModified || new Date().toISOString(),
                    };
                    campaign.notes.push(note);
                });

                // --- Secrets ---
                rawSecrets.forEach((s: any) => {
                    const secret: Secret = {
                        id: remapRequired(s.id),
                        title: s.title || 'Untitled Secret',
                        content: s.content || '',
                        category: s.category || 'secret',
                        isRevealed: s.isRevealed ?? false,
                        revealedInSessionId: remap(s.revealedInSessionId),
                        linkedEntityIds: remapIds(s.linkedEntityIds),
                        createdAt: s.createdAt || new Date().toISOString(),
                        notes: s.notes,
                    };
                    if (!campaign.secrets) campaign.secrets = [];
                    campaign.secrets.push(secret);
                });

                // --- Session Logs ---
                rawSessionLogs.forEach((l: any) => {
                    const log: SessionLog = {
                        id: remapRequired(l.id),
                        title: l.title || 'Untitled Session',
                        // An imported template shouldn't claim to have a live session.
                        status: l.status === 'active' ? 'planned' : (l.status || 'planned'),
                        sessionDate: l.sessionDate || '',
                        adventureId: remap(l.adventureId),
                        plannedSceneIds: remapIds(l.plannedSceneIds),
                        plannedNpcIds: remapIds(l.plannedNpcIds),
                        plannedLocationIds: remapIds(l.plannedLocationIds),
                        prepNotes: l.prepNotes || '',
                        relatedPlotIds: remapIds(l.relatedPlotIds),
                        plotProgressions: l.plotProgressions
                            ? Object.fromEntries(
                                  Object.entries(l.plotProgressions)
                                      .map(([plotId, status]) => [remap(plotId), status])
                                      .filter(([plotId]) => !!plotId)
                              )
                            : undefined,
                        runningNotes: l.runningNotes || '',
                        structuredNotes: (l.structuredNotes || []).map((entry: any) => ({
                            ...entry,
                            id: entry.id || crypto.randomUUID(),
                            taggedEntityIds: remapIds(entry.taggedEntityIds),
                        })),
                        encounterLog: l.encounterLog || [],
                        diceRolls: l.diceRolls,
                        beats: l.beats,
                        recap: l.recap || '',
                        notableEvents: l.notableEvents || '',
                        looseEnds: l.looseEnds || '',
                    };
                    if (!campaign.sessionLogs) campaign.sessionLogs = [];
                    campaign.sessionLogs.push(log);
                });

                // --- Player Characters ---
                rawPlayerCharacters.forEach((pc: any) => {
                    if (!campaign.playerCharacters) campaign.playerCharacters = [];
                    campaign.playerCharacters.push({
                        ...pc,
                        id: remapRequired(pc.id),
                    });
                });

                // --- Plots ---
                rawPlots.forEach((p: any) => {
                    const plot: Plot = {
                        id: remapRequired(p.id),
                        title: p.title || 'Untitled Plot',
                        description: p.description || '',
                        status: p.status || 'active',
                        relatedEntityIds: remapIds(p.relatedEntityIds),
                        mentionedEntityIds: remapIds(p.mentionedEntityIds),
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
                    // Drop a factionId that doesn't resolve to an existing faction
                    // in this campaign (e.g. a chat-generator preview's synthetic
                    // 'preview' id) rather than persisting a dangling reference.
                    if (newNpc.factionId && !campaign.factions.some(f => f.id === newNpc.factionId)) {
                        newNpc.factionId = undefined;
                    }
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
            if (!newLocation.subLocationIds) newLocation.subLocationIds = [];

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
            if (!newFaction.memberIds) newFaction.memberIds = [];
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
                // The real provider's sceneSchema (and the RealmChat
                // draft-adventure path, which has no postProcess step at all)
                // omit npcIds/status/skillChecks (finding #7 and its verifier
                // follow-up — the earlier fix only defaulted npcIds/status,
                // leaving skillChecks undefined for ActiveScenePanel/SceneEditor
                // to crash on). Build from createDefaultScene() and spread the
                // AI data over it so every Scene field is normalised in one
                // move, including any future field this type gains.
                scenes: (adventureData.scenes || []).map(sceneData => ({
                    ...createDefaultScene(),
                    ...sceneData,
                    id: crypto.randomUUID(),
                    npcIds: sceneData.npcIds ?? [],
                    status: sceneData.status ?? 'planned',
                    skillChecks: sceneData.skillChecks ?? [],
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

                // Clear adventureId on any session logs referencing this adventure,
                // and strip the adventure's (now deleted) scenes from planned lists
                const deletedSceneIds = new Set(adventure.scenes.map(s => s.id));
                if (campaign.sessionLogs) {
                    campaign.sessionLogs.forEach(log => {
                        if (log.adventureId === id) log.adventureId = undefined;
                        if (log.plannedSceneIds?.some(sid => deletedSceneIds.has(sid))) {
                            log.plannedSceneIds = log.plannedSceneIds.filter(sid => !deletedSceneIds.has(sid));
                        }
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

                // Cleanup all cross-entity references (e.g. @-mentions of this
                // scene, pinnedEntities) before removing it — verifier follow-up
                // on #10: this delete path never called the sweep at all.
                _purgeEntityReferences(campaign, sceneId);

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

                // Cleanup all cross-entity references — most notably
                // Secret.revealedInSessionId, which otherwise keeps pointing at
                // a session log that no longer exists (verifier follow-up on #10).
                _purgeEntityReferences(campaign, id);

                campaign.sessionLogs = (campaign.sessionLogs || []).filter(l => l.id !== id);
            });
        },

        createPlayerCharacter(newPcData: Omit<PlayerCharacter, 'id'>) {
            // Normalize against a fully-populated default: AI-parsed PDF sheets
            // (and hand-authored Quick Add drafts) may omit fields that
            // CharacterStatistics/CharacterSocial declare as required — e.g. a
            // blank Features & Traits page omits `specialActions` entirely.
            // This MUST be a deep merge: a shallow spread of
            // `characterStatistics` would wipe the default actions/specialActions
            // whenever the parse includes a partial characterStatistics object.
            const defaults = createDefaultPlayerCharacter();
            const normalized: Omit<PlayerCharacter, 'id'> = {
                ...defaults,
                ...newPcData,
                characterSocial: { ...defaults.characterSocial, ...newPcData.characterSocial },
                characterStatistics: {
                    ...defaults.characterStatistics,
                    ...newPcData.characterStatistics,
                    classes: { ...defaults.characterStatistics.classes, ...newPcData.characterStatistics?.classes },
                    attributes: { ...defaults.characterStatistics.attributes, ...newPcData.characterStatistics?.attributes },
                    skills: { ...defaults.characterStatistics.skills, ...newPcData.characterStatistics?.skills },
                    actions: newPcData.characterStatistics?.actions ?? defaults.characterStatistics.actions,
                    specialActions: newPcData.characterStatistics?.specialActions ?? defaults.characterStatistics.specialActions,
                },
            };
            const newPc: PlayerCharacter = { ...normalized, id: crypto.randomUUID() };
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
                if (!campaign) return;
                // Cleanup all cross-entity references (pinnedEntities, etc.)
                // before removing it (verifier follow-up on #10).
                _purgeEntityReferences(campaign, id);
                campaign.playerCharacters = (campaign.playerCharacters || []).filter(p => p.id !== id);
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
                if (!campaign) return;
                // Cleanup all cross-entity references (pinnedEntities, etc.)
                // before removing it (verifier follow-up on #10).
                _purgeEntityReferences(campaign, id);
                campaign.notes = (campaign.notes || []).filter(n => n.id !== id);
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
                if (!campaign) return;
                // Cleanup all cross-entity references (pinnedEntities, etc.)
                // before removing it (verifier follow-up on #10).
                _purgeEntityReferences(campaign, id);
                campaign.secrets = (campaign.secrets || []).filter(s => s.id !== id);
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
                // Finding #7's verifier follow-up: this path has no
                // normalization of its own either, relying entirely on the
                // caller having already run evocationWizard.postProcessResult
                // — build from createDefaultScene() so npcIds/status/
                // skillChecks are always populated regardless of caller.
                const newAdventures = data.adventures.map(advData => ({
                    ...advData,
                    id: crypto.randomUUID(),
                    scenes: (advData.scenes || []).map(s => ({
                        ...createDefaultScene(),
                        ...s,
                        id: crypto.randomUUID(),
                        npcIds: s.npcIds ?? [],
                        status: s.status ?? 'planned',
                        skillChecks: s.skillChecks ?? [],
                    })),
                }));
        
                campaign.factions.push(...newFactions);
                campaign.locations.push(...newLocations);
                campaign.npcs.push(...newNpcs);
                campaign.items.push(...newItems);
                campaign.adventures.push(...newAdventures);
        
                const allNpcsInDraft = campaign.npcs;
                const allLocationsInDraft = campaign.locations;
                const allFactionsInDraft = campaign.factions;
        
                // Finding #74: `npc.factionId` / `location.parentLocationId` may already
                // be a resolved id (e.g. EvocationWizard's "Detailed" mode links a
                // generated NPC/Location to an EXISTING faction/location by UUID, not
                // by name) rather than the AI-generated name string the maps below are
                // keyed on. Resolve BOTH cases so the reverse relationship
                // (faction.memberIds / parent.subLocationIds) is always established —
                // a name-only lookup silently drops the reverse link for any
                // already-resolved id, breaking the bidirectional NPC<->Faction and
                // Location-hierarchy invariant.
                allNpcsInDraft.forEach(npc => {
                    const factionRef = npc.factionId;
                    if (!factionRef) return;
                    const resolvedFactionId = factionNameMap.get(factionRef.toLowerCase())
                        ?? (allFactionsInDraft.some(f => f.id === factionRef) ? factionRef : undefined);
                    if (resolvedFactionId) {
                        const faction = allFactionsInDraft.find(f => f.id === resolvedFactionId);
                        if (faction && !faction.memberIds.includes(npc.id)) faction.memberIds.push(npc.id);
                        npc.factionId = resolvedFactionId;
                    }
                });

                allLocationsInDraft.forEach(loc => {
                    const parentRef = loc.parentLocationId;
                    if (!parentRef) return;
                    const resolvedParentId = locationNameMap.get(parentRef.toLowerCase())
                        ?? (allLocationsInDraft.some(l => l.id === parentRef) ? parentRef : undefined);
                    if (resolvedParentId && resolvedParentId !== loc.id) {
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
