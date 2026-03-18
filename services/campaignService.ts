
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
    Plot,
    Encounter,
    SettingType,
    Note,
    DiceRoll
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
                        // Migrate old data: ensure arrays exists
                        draft.campaigns = campaignsData.map(c => ({
                            ...c,
                            settingType: c.settingType || 'custom',
                            plots: c.plots || [],
                            notes: c.notes || [],
                            sessionLogs: (c.sessionLogs || []).map((l: any) => ({
                                ...l, 
                                structuredNotes: l.structuredNotes || [],
                                relatedPlotIds: l.relatedPlotIds || []
                            })),
                            playerCharacters: c.playerCharacters || [],
                            npcs: (c.npcs || []).map((n: any) => ({...n, relationships: n.relationships || [], history: n.history || []})),
                            locations: (c.locations || []).map((l: any) => ({...l, history: l.history || []})),
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
                    // Initialize with "The Night Before Wintermas" Campaign
                    const wintermasId = crypto.randomUUID();
                    
                    // Factions
                    const happyJoyId = crypto.randomUUID();
                    const santaFactionId = crypto.randomUUID();

                    // NPCs
                    const quentinId = crypto.randomUUID();
                    const frostyId = crypto.randomUUID();
                    const daveGrinchId = crypto.randomUUID();
                    const santaId = crypto.randomUUID();
                    
                    // Locations
                    const frostholdId = crypto.randomUUID();
                    const northPoleId = crypto.randomUUID();
                    const grottoId = crypto.randomUUID();
                    const domeId = crypto.randomUUID();

                    // Items
                    const crownId = crypto.randomUUID();
                    const statueId = crypto.randomUUID();

                    // Adventure & Scenes
                    const advId = crypto.randomUUID();
                    const scene1Id = crypto.randomUUID();
                    const scene2Id = crypto.randomUUID();
                    const scene3Id = crypto.randomUUID();
                    const scene4Id = crypto.randomUUID();
                    const scene5Id = crypto.randomUUID();

                    const wintermasCampaign: Campaign = {
                        id: wintermasId,
                        title: "The Night Before Wintermas",
                        settingType: "custom",
                        setting: "A dark, cynical fantasy world where 'Wintermas' is celebrated, but the dangers are real. Children are tough, the countryside is full of monsters, and a 'morally suspect' corporation named HappyJoy Toy and Tobacco Company wants to eliminate the competition: Santa Claus. Santa himself is possessed by an Eldritch entity.",
                        activeEncounter: { id: crypto.randomUUID(), round: 1, turnIndex: 0, combatants: [] },
                        articles: [],
                        plots: [],
                        notes: [],
                        sessionLogs: [
                            {
                                id: crypto.randomUUID(),
                                title: "Session 1: The Job Interview",
                                status: "planned",
                                sessionDate: new Date().toISOString(),
                                adventureId: advId,
                                plannedSceneIds: [scene1Id],
                                prepNotes: "Intro: Players are huddled in the archway of the HappyJoy tower in Frosthold. It's the night before Wintermas. Wind is howling.\nGoal: Get hired by Quentin Happyjoy Junior to infiltrate the North Pole.\nKey Info: Santa is the target. 250g upfront, 750g on completion. Kill Santa or steal his distribution means.\nTransport: Teleportation by corporate mages. Return via enchanted snowglobe.",
                                runningNotes: "",
                                structuredNotes: [],
                                relatedPlotIds: [],
                                recap: "",
                                notableEvents: "",
                                looseEnds: "",
                                encounterLog: []
                            }
                        ],
                        playerCharacters: [],
                        factions: [
                            {
                                id: happyJoyId,
                                name: "HappyJoy Toy and Tobacco Company",
                                description: "A morally suspect toy company based in Frosthold. They produce dubiously virtuous products like 'teddy bears that really smoke'.",
                                goals: "Eliminate Santa Claus to secure a monopoly on Wintermas gifts.",
                                alignment: "Lawful Evil",
                                resources: "Vast wealth, corporate mages, team of gnomes.",
                                influence: "Major employer in the Northern Region.",
                                memberIds: [quentinId],
                                headquartersLocationId: frostholdId
                            },
                            {
                                id: santaFactionId,
                                name: "The Workshop (Corrupted)",
                                description: "Santa's operation at the North Pole. Currently corrupted by an Old One entity possessing Santa.",
                                goals: "Prepare for the arrival of the Old One into this world.",
                                alignment: "Chaotic Evil",
                                resources: "Infinite manufacturing capability, mind-controlled gnomes, magical constructs.",
                                influence: "Global gift distribution network.",
                                memberIds: [santaId, frostyId],
                                headquartersLocationId: domeId
                            }
                        ],
                        npcs: [
                            {
                                id: quentinId,
                                name: "Quentin Happyjoy Junior",
                                description: "The greyest man you have ever seen. Corporate businessman before his time. Sits behind a dark mahogany desk with a magical Newton's Cradle.",
                                traits: "Unimpressed, speaks in corporate buzzwords ('KPIs'), skirts over the topic of murder.",
                                exampleQuote: "We need you to thoroughly achieve your KPIs regarding the competition.",
                                backstory: "Founder's son, desperate to prove himself by taking out the biggest rival in the industry.",
                                motivations: "Profit, market dominance, pleasing the board.",
                                secrets: "He knows the mission is likely suicide; none of the previous scouts returned.",
                                stats: "Commoner (Non-combatant)",
                                factionId: happyJoyId,
                                knowsPlayerHistory: [],
                                relationships: [],
                                history: []
                            },
                            {
                                id: frostyId,
                                name: "Frosty the Snowman",
                                description: "Large construct made of snow. Coal eyes, carrot nose, three blue gems on chest. Arms carved along sides.",
                                traits: "Initially friendly but menacing. Encourages players to leave to 'save the magic'. Goes berserk if allies die.",
                                exampleQuote: "Wintermas isn't until tomorrow! You'll have to wait for your presents!",
                                backstory: "Guardian of the North Pole entrance.",
                                motivations: "Protect the entrance to the crevasse.",
                                secrets: "Weak to fire. Has a 'Chilling Ray' attack.",
                                stats: "Large Construct (CR 5). Multiattack, Chilling Ray, Snow Meld.",
                                factionId: santaFactionId,
                                knowsPlayerHistory: [],
                                relationships: [],
                                history: []
                            },
                            {
                                id: daveGrinchId,
                                name: "Dave Grinch",
                                description: "Wild-eyed gnome with bright green hair. Found in a cage in the Holding Cells.",
                                traits: "Half-mad, irrational, hates Christmas/Wintermas passionately.",
                                exampleQuote: "I hate the joy! It's just not right!",
                                backstory: "His tribe of Ice Gnomes (natural artificers) went missing. He tracked them here and was imprisoned.",
                                motivations: "Free his tribe, kill Santa.",
                                secrets: "Knows the solution to the Cookie Puzzle (The Moon cookie allows passage).",
                                stats: "Gnome (Non-combatant). Dies in one hit.",
                                factionId: undefined, // Prisoner
                                knowsPlayerHistory: [],
                                relationships: [],
                                history: []
                            },
                            {
                                id: santaId,
                                name: "Santa Claus (The Host)",
                                description: "Very fat, very tall man wearing a crown and large bulky robes. Possessed by an Old One.",
                                traits: "Jolly voice but says terrifying things. attempts to possess players mentally.",
                                exampleQuote: "You have interrupted the plan. We prepare for my arrival.",
                                backstory: "The ancient figure of Wintermas, now a puppet for an eldritch horror.",
                                motivations: "Complete the ritual to bring the Old One fully into the world.",
                                secrets: "The Crown of Domination controls him. Knocking it off breaks the possession.",
                                stats: "Large Humanoid (CR 9). Legendary Actions. Crown of Domination ability.",
                                factionId: santaFactionId,
                                knowsPlayerHistory: [],
                                relationships: [],
                                history: []
                            }
                        ],
                        locations: [
                            {
                                id: frostholdId,
                                name: "Frosthold",
                                description: "A circular walled town atop a hill. Tough town with a tough reputation. People work hard processing bone and ivory. Currently celebrating Wintermas.",
                                secrets: "The town is unusually happy today due to the holiday, masking the grim reality of daily life.",
                                subLocationIds: [],
                                connections: [],
                                loot: [],
                                history: [],
                                pointsOfInterest: [
                                    { id: crypto.randomUUID(), name: "HappyJoy HQ", passivePerceptionDC: 10, description: "A tall, narrow 5-storey tower. A brass sign reads 'HappyJoy Toy and Tobacco Company'.", investigationChecks: [], interactions: [] },
                                    { id: crypto.randomUUID(), name: "The Legitimate Business Tavern", passivePerceptionDC: 12, description: "A single-storey building acting as a fence for stolen items.", investigationChecks: [], interactions: [] }
                                ]
                            },
                            {
                                id: northPoleId,
                                name: "The North Pole",
                                description: "A desolate icy plain. A huge cliff of ice stretches hundreds of metres up. A jagged crevasse cuts into the face.",
                                secrets: "Patrolled by flying Paindeer and strewn with candy mines along the top.",
                                subLocationIds: [grottoId],
                                connections: [],
                                loot: [],
                                history: []
                            },
                            {
                                id: grottoId,
                                name: "Santa's Grotto",
                                description: "A beautiful cavern lit with warm golden light. Candy cane picket fences, gingerbread houses, and a giant Wintermas tree.",
                                secrets: "Everything is slightly corrupt; gingerbread is mouldy, a creeping sense of something sinister.",
                                parentLocationId: northPoleId,
                                subLocationIds: [domeId],
                                connections: [],
                                loot: [],
                                history: [],
                                pointsOfInterest: [
                                    { id: crypto.randomUUID(), name: "Santa's Cookie Lab", passivePerceptionDC: 10, description: "Smells of sugar and cinnamon. Contains strange machinery and magical dusts.", investigationChecks: [], interactions: [] },
                                    { id: crypto.randomUUID(), name: "Ho Ho Holding Cells", passivePerceptionDC: 10, description: "Locked door with candy cane bars. Contains Dave Grinch.", investigationChecks: [], interactions: [] },
                                    { id: crypto.randomUUID(), name: "Paindeer Stables", passivePerceptionDC: 12, description: "Smells of chocolate and hay. Contains sleeping Paindeer and a magical statue.", investigationChecks: [], interactions: [] }
                                ]
                            },
                            {
                                id: domeId,
                                name: "Santa's Workshop (The Dome)",
                                description: "A giant stone dome, half a mile in diameter. Enchanted roof shows stars. Rows of stone altars where gnomes work with frozen smiles.",
                                secrets: "The gnomes are mind-controlled. The central plinth holds Santa and the portal.",
                                parentLocationId: grottoId,
                                subLocationIds: [],
                                connections: [],
                                loot: [],
                                history: []
                            }
                        ],
                        items: [
                            {
                                id: crownId,
                                name: "Crown of Domination",
                                description: "A simple spiked design cut from dark stone. Surprisingly light.",
                                rarity: "legendary",
                                properties: "Allows the wearer to dominate the mind of creatures. Cursed: The item's creator influences the wearer. Requires attunement."
                            },
                            {
                                id: statueId,
                                name: "Wondrous Statue (Rudolf)",
                                description: "A small statue of a Paindeer with a ruby nose.",
                                rarity: "rare",
                                properties: "Once per day as a bonus action, summon Rudolf to cast a ray of red light (4d10 radiant damage)."
                            }
                        ],
                        adventures: [
                            {
                                id: advId,
                                title: "The Night Before Wintermas",
                                level: 5,
                                hook: "Hired by a morally suspect toy company to infiltrate the North Pole and kill Santa.",
                                theme: "Dark Comedy, Holiday, Dungeon Crawl",
                                scenes: [
                                    {
                                        id: scene1Id,
                                        title: "Reception & Briefing",
                                        type: "social",
                                        readAloudText: "You’re huddled in the large stone archway of a tall and narrow 5-storey tower. A discrete brass sign on the door advertises… HappyJoy Toy and Tobacco Company. Your interview is in 5 minutes.",
                                        gmNotes: "Introduce Quentin Happyjoy. He gives the quest: Infiltrate, steal/disable distribution, kill Santa. Pay: 250g now, 750g later. Give players the Snowglobe for return transport.",
                                        skillChecks: [],
                                        rewards: "250gp per player.",
                                        npcIds: [quentinId],
                                        locationId: frostholdId,
                                        status: 'planned'
                                    },
                                    {
                                        id: scene2Id,
                                        title: "The Approach (Frosty)",
                                        type: "combat",
                                        readAloudText: "You land in a flash of light on an icy plain. 50 figures stand in neat rows before the crevasse. Snowmen. The largest one shifts, turning coal eyes towards you.",
                                        gmNotes: "Frosty tries to turn them away. If they persist, he attacks. Two animated snowmen sidekicks are hidden nearby (DC18 Perception).",
                                        skillChecks: [{ id: crypto.randomUUID(), skill: "Perception", dc: 18, description: "Spot the animated snowman sidekicks." }],
                                        rewards: "",
                                        npcIds: [frostyId],
                                        locationId: northPoleId,
                                        status: 'planned'
                                    },
                                    {
                                        id: scene3Id,
                                        title: "Cavern of Christmas Lights",
                                        type: "exploration",
                                        readAloudText: "A long passage tapering to a point. Ethereal Wintermas lanterns float about. A deep rumbling sound echoes as the ice walls slowly move closer together.",
                                        gmNotes: "Race against time. The walls are closing. Paindeer fly overhead. Run as a skill challenge or timed combat.",
                                        skillChecks: [{ id: crypto.randomUUID(), skill: "Athletics", dc: 14, description: "Sprint through the closing gap." }],
                                        rewards: "",
                                        npcIds: [],
                                        locationId: northPoleId,
                                        status: 'planned'
                                    },
                                    {
                                        id: scene4Id,
                                        title: "The Grotto Investigation",
                                        type: "puzzle",
                                        readAloudText: "A central square dominated by a Wintermas tree. Paths lead to the Cookie Lab, Holding Cells, and Stables. A shimmering portal stands in the center.",
                                        gmNotes: "Players must solve the Cookie Puzzle to enter the portal. Clues are with Dave Grinch in the cells. Looting the stables yields the Rudolf statue.",
                                        skillChecks: [{ id: crypto.randomUUID(), skill: "Investigation", dc: 15, description: "Find the hidden key to the cells." }],
                                        rewards: "Wondrous Statue (Rudolf).",
                                        npcIds: [daveGrinchId],
                                        locationId: grottoId,
                                        status: 'planned'
                                    },
                                    {
                                        id: scene5Id,
                                        title: "Showdown at the Workshop",
                                        type: "combat",
                                        readAloudText: "A huge stone dome. Rows of entranced gnomes. On the central plinth, Santa wheels around. 'Ho Ho Ho... Wintermas isn't until tomorrow!'",
                                        gmNotes: "Santa tries to possess players (DC 15 Cha). When Santa falls, the Old One's Avatar emerges from the crown. Players can fight it or accept its offer of power.",
                                        skillChecks: [],
                                        rewards: "Crown of Domination (Cursed).",
                                        npcIds: [santaId],
                                        locationId: domeId,
                                        status: 'planned'
                                    }
                                ]
                            }
                        ]
                    };

                    draft.campaigns = [wintermasCampaign];
                    draft.activeCampaignId = wintermasId;
                    draft.appStatus = 'editing';
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
        createCampaign(title: string, setting: string, settingType: SettingType = 'custom', officialSetting?: string) {
            updateState(draft => {
                const newCampaign: Campaign = { 
                    id: crypto.randomUUID(), 
                    title, 
                    setting,
                    settingType,
                    officialSetting,
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
                if (campaign) {
                    campaign.plots = (campaign.plots || []).filter(n => n.id !== id);
                }
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
        addSessionRunnerNote(content: string, taggedEntityIds: string[] = []) {
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
