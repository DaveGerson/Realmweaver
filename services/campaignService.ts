
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
    SessionLogEntry,
    SessionLogEntryType,
    PlayerCharacter,
    BatchAddData,
    Plot,
    Encounter,
    SettingType,
    Note,
    DiceRoll,
    PlotSessionStatus,
    Secret
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
                    // Initialize with "Winter's Daughter" Campaign (Necrotic Gnome, Dolmenwood)
                    const campaignId = crypto.randomUUID();

                    // Factions
                    const druneFactionId = crypto.randomUUID();
                    const frostElvesFactionId = crypto.randomUUID();
                    const churchFactionId = crypto.randomUUID();

                    // NPCs
                    const princessId = crypto.randomUUID();
                    const sirChydeId = crypto.randomUUID();
                    const dolmbraceId = crypto.randomUUID();
                    const haithionId = crypto.randomUUID();
                    const briarAnneId = crypto.randomUUID();
                    const griddlegrimId = crypto.randomUUID();
                    const grimmlegridgeId = crypto.randomUUID();
                    const lordMantleId = crypto.randomUUID();

                    // Locations
                    const dolmenwoodId = crypto.randomUUID();
                    const whythingStonesId = crypto.randomUUID();
                    const burialMoundId = crypto.randomUUID();
                    const priestQuartersId = crypto.randomUUID();
                    const hallOfHoundsId = crypto.randomUUID();
                    const towerOnLakeId = crypto.randomUUID();
                    const princessTowerId = crypto.randomUUID();

                    // Items
                    const bindingRingId = crypto.randomUUID();
                    const hubrisBladeId = crypto.randomUUID();
                    const freezingMirrorId = crypto.randomUUID();
                    const fungiPouchId = crypto.randomUUID();
                    const portraitId = crypto.randomUUID();

                    // Adventure & Scenes
                    const advId = crypto.randomUUID();
                    const scene1Id = crypto.randomUUID();
                    const scene2Id = crypto.randomUUID();
                    const scene3Id = crypto.randomUUID();
                    const scene4Id = crypto.randomUUID();
                    const scene5Id = crypto.randomUUID();
                    const scene6Id = crypto.randomUUID();
                    const scene7Id = crypto.randomUUID();
                    const scene8Id = crypto.randomUUID();
                    const scene9Id = crypto.randomUUID();
                    const scene10Id = crypto.randomUUID();

                    // Plots
                    const plotForbiddenLoveId = crypto.randomUUID();
                    const plotColdPrinceId = crypto.randomUUID();

                    const wintersDaughterCampaign: Campaign = {
                        id: campaignId,
                        title: "Winter's Daughter",
                        settingType: "custom",
                        setting: "Dolmenwood \u2014 a weird fairy tale forest where the mortal world and the immortal realm of Fairy lie close together. Ancient standing stones mark ley lines, mysterious Drune cultists guard stone circles, and the threat of the banished Cold Prince lingers in every frigid wind. The forest is thick with brambles, twisted trees, and the faint sound of unearthly laughter drifting from the glades.",
                        activeEncounter: { id: crypto.randomUUID(), round: 1, turnIndex: 0, combatants: [] },
                        notes: [],
                        playerCharacters: [],
                        articles: [
                            {
                                id: crypto.randomUUID(),
                                title: "The War of Mortal and Fairy",
                                category: "history",
                                content: "Nine centuries ago, mortals waged war against the fey armies of the Cold Prince, who ruled all of Dolmenwood under an eternal cloak of frost and snow. The mortal armies were ultimately victorious, and the Cold Prince was exiled into his dominion in Fairy. But the threat of his return has never fully faded \u2014 every winter, the magic that banishes him weakens, and frigid winds whisper of his desire to reclaim the mortal world.\n\nAmong the heroes of the war was Sir Chyde, a near-mythical knight who slew the fairy giant Butter-for-Bones with a fabled sword. His tomb, built beside the standing stones where he first met his forbidden love, became a site of pilgrimage \u2014 until the Church sealed it when fey influence began creeping in from the other side.",
                                subArticleIds: [],
                                relatedEntityIds: []
                            },
                            {
                                id: crypto.randomUUID(),
                                title: "The Standing Stones of Dolmenwood",
                                category: "lore",
                                content: "The standing stones \u2014 known locally as 'Whything Stones' \u2014 are ancient markers of ley line intersections throughout the Dolmenwood forest. Rune-etched and mossy, they thrum with magical energy that can be felt by those attuned to the arcane.\n\nThe Drune, a secretive cult of arcanists, jealously guard these stone circles. Common folk avoid the stones after dark, fearful of the Drune's reputation for kidnapping and human sacrifice. The stones serve as focal points for powerful rituals and are said to thin the boundary between the mortal world and the realm of Fairy.",
                                subArticleIds: [],
                                relatedEntityIds: []
                            }
                        ],
                        plots: [
                            {
                                id: plotForbiddenLoveId,
                                title: "The Forbidden Love",
                                description: "The centuries-old love story between Sir Chyde and Princess Snowfall-at-Dusk. The knight's spirit lingers in his tomb, bound by the magical ring that connects their souls. The princess waits in her tower prison in Fairy, holding a perpetual wedding feast for the day her love arrives.",
                                status: "active",
                                relatedEntityIds: [sirChydeId, princessId]
                            },
                            {
                                id: plotColdPrinceId,
                                title: "The Cold Prince's Shadow",
                                description: "The banished fairy lord who once ruled all Dolmenwood under eternal winter. Though exiled, the Cold Prince's threat lingers \u2014 every year the magic weakening, frigid winds whispering of his return. The discovery of a doorway between worlds in Sir Chyde's tomb could be exactly what the Cold Prince needs to reclaim his dominion.",
                                status: "active",
                                relatedEntityIds: []
                            }
                        ],
                        sessionLogs: [
                            {
                                id: crypto.randomUUID(),
                                title: "Session 1: Into the Dolmenwood",
                                status: "planned",
                                sessionDate: new Date().toISOString(),
                                adventureId: advId,
                                plannedSceneIds: [scene1Id, scene2Id, scene3Id, scene4Id],
                                prepNotes: "The party has received either dreams from the Lady or an inheritance charter. They are journeying into Dolmenwood to find the burial mound.\n\nKey decisions:\n- Will they intervene in the Drune sacrifice or leave it be?\n- How will they enter the tomb (slab or worm hole)?\n- Will they fight or negotiate with the guardians?\n\nRemember: The Drune are DANGEROUS (CR 5 each). Don't let players pick a fight without understanding the risk.",
                                runningNotes: "",
                                structuredNotes: [],
                                relatedPlotIds: [],
                                recap: "",
                                notableEvents: "",
                                looseEnds: "",
                                encounterLog: []
                            }
                        ],
                        factions: [
                            {
                                id: druneFactionId,
                                name: "The Drune",
                                description: "A secretive cult of arcanists known as 'watchers of the wood.' They jealously guard the standing stone circles and ley lines of Dolmenwood. Common folk are terrified of their occult machinations, including kidnapping and rumours of human sacrifice.",
                                goals: "Protect the stone circles and ley lines. Maintain their power over Dolmenwood's magical infrastructure.",
                                alignment: "Neutral Evil",
                                resources: "Powerful magic, stone circle network, influence through fear.",
                                influence: "One of the most powerful factions in Dolmenwood, greatly feared for their occult powers.",
                                memberIds: [dolmbraceId, haithionId],
                                headquartersLocationId: whythingStonesId
                            },
                            {
                                id: frostElvesFactionId,
                                name: "The Frost Elves",
                                description: "The people of the Cold Prince \u2014 immortal fairies as fair as snow and as cruel as ice. They dwell in the realm of Fairy (also called Frigia), serving their banished lord. Some have secretly journeyed to Princess Snowfall-at-Dusk's tower to attend the perpetual wedding feast.",
                                goals: "Serve the Cold Prince. Some secretly support the princess's hope for reunion with Sir Chyde.",
                                alignment: "Neutral",
                                resources: "Fairy magic, immunity to cold, ice weapons, innate spellcasting.",
                                influence: "Rulers of Frigia in Fairy. Minimal direct influence in the mortal world.",
                                memberIds: [princessId, griddlegrimId, grimmlegridgeId],
                                headquartersLocationId: princessTowerId
                            },
                            {
                                id: churchFactionId,
                                name: "The Church of the One True God",
                                description: "The dominant mortal religion. Their clergy sealed Sir Chyde's tomb centuries ago when fey influence began creeping in, placing magical wards and guardians to prevent further encroachment from Fairy.",
                                goals: "Protect the mortal world from fey corruption. Maintain the sealing of the tomb.",
                                alignment: "Lawful Neutral",
                                resources: "Holy wards, animated religious objects, consecrated guardians.",
                                influence: "Major religious authority in Dolmenwood.",
                                memberIds: [],
                                headquartersLocationId: undefined
                            }
                        ],
                        npcs: [
                            {
                                id: princessId,
                                name: "Princess Snowfall-at-Dusk",
                                description: "Beautiful, ageless, otherworldly. Blonde hair the colour of winter sun. Pale skin scintillating like fresh snow. Blue crystalline eyes. Clad in white floaty gown with a star on her brow \u2014 a flashing crystal bound with silver cord.",
                                traits: "Dignified, benevolent, resigned to her fate but not without hope. Excited at the possibilities strangers present.",
                                motivations: "To be reunited with her love, Sir Chyde, who was tragically taken from her by his mortality.",
                                secrets: "She is magically banned from leaving her tower glade. Her professed love in the 'Dreams of the Lady' hook is a trick \u2014 she wants PCs to retrieve Sir Chyde's binding ring for her. She can grant a single wish via Royal Decree.",
                                backstory: "The seventeenth daughter of the Cold Prince, she fell in love with Sir Chyde during the ancient war between mortals and fairies. Her father imprisoned her in a forlorn tower in Fairy when he discovered their forbidden love.",
                                stats: "AC 15, HP 44, CR 2. Innate spellcasting (charm person, hold person, invisibility, sleep 3/day each). Icicle Dagger +7 to hit. Can grant a wish once in her life.",
                                exampleQuote: "The ring holds the key... My eternal salvation...",
                                factionId: frostElvesFactionId,
                                knowsPlayerHistory: [],
                                relationships: [],
                                history: []
                            },
                            {
                                id: sirChydeId,
                                name: "The Ghost of Sir Chyde",
                                description: "Pale, semi-transparent azure phantom. Thin, drawn with age. Armoured in ghostly plate mail with helm visor raised. Forlorn and love-lost. Kneeling before the portrait of his beloved.",
                                traits: "Maudlin, desperate, beseeching. Does not appreciate tomb robbers but will plead for help to be reunited with the princess.",
                                motivations: "Join his beloved in Fairy via the magical stairs and finally take her hand in marriage after centuries of separation.",
                                secrets: "His spirit is bound to Sir Chyde's binding ring \u2014 he cannot move more than 10 feet from it. If the ring is removed, he manifests once per day to haunt whoever stole it. He can possess living beings.",
                                backstory: "A near-mythical hero who fought in the war against the Cold Prince. He fell in love with the princess at the Whything Stones. After his death, the power of his binding ring called his spirit back from the beyond.",
                                stats: "AC 17, HP 55, CR 4. Ethereal Sight, Incorporeal Movement, Ring-Bound, Ring-Juvenation. Knight's Punch +6 to hit (4d6+3 necrotic). Can possess humanoids (DC 16 Cha save).",
                                exampleQuote: "Please... help me reach my beloved. The stairs in the lower chambers lead to her realm. Take my ring there, and my soul will follow.",
                                factionId: undefined,
                                knowsPlayerHistory: [],
                                relationships: [],
                                history: []
                            },
                            {
                                id: dolmbraceId,
                                name: "Dolmbrace",
                                description: "Hooded man in black cloak performing a ritual sacrifice at the Whything Stones. Mumbling incantations in an odd tongue. Knife held aloft \u2014 silver, curved. Wears a golden torc in the form of an owl.",
                                traits: "Regards peaceful strangers as auspicious. May offer PCs a role aiding the sacrifice. Powerful spellcaster \u2014 not to be trifled with.",
                                motivations: "Complete the ritual sacrifice at the Whything Stones to honour the ley lines.",
                                secrets: "6th-level spellcaster. The Drune sect also assisted in the ancient war against the Cold Prince and respect the sanctity of Sir Chyde's tomb.",
                                backstory: "A Drune ritualist performing a sacrifice at the standing stones beside the burial mound.",
                                stats: "AC 13 (16 with mage armour), HP 39, CR 5. 6th-level spellcaster (spell save DC 14). Green Flame-Wreathed Staff, Conjure Dolmen (Recharge 6). Cantrips: blade ward, dancing lights, friends. Spells up to 3rd level.",
                                exampleQuote: "Auspicious... strangers arrive as the stones align. Perhaps you would aid our work?",
                                factionId: druneFactionId,
                                knowsPlayerHistory: [],
                                relationships: [],
                                history: []
                            },
                            {
                                id: haithionId,
                                name: "Haithion",
                                description: "Second hooded ritualist at the Whything Stones. Black cloak, golden torc shaped like an owl. Partner to Dolmbrace in the ceremony.",
                                traits: "Focused on the ritual. Will defend the ceremony alongside Dolmbrace.",
                                motivations: "Complete the ritual sacrifice at the Whything Stones.",
                                secrets: "6th-level spellcaster, same capabilities as Dolmbrace.",
                                backstory: "A Drune ritualist performing a sacrifice alongside Dolmbrace.",
                                stats: "AC 13 (16 with mage armour), HP 39, CR 5. 6th-level spellcaster (spell save DC 14). Green Flame-Wreathed Staff, Conjure Dolmen (Recharge 6). Cantrips: blade ward, dancing lights, friends. Spells up to 3rd level.",
                                exampleQuote: "The stones demand tribute. Do not interfere.",
                                factionId: druneFactionId,
                                knowsPlayerHistory: [],
                                relationships: [],
                                history: []
                            },
                            {
                                id: briarAnneId,
                                name: "Briar-Anne",
                                description: "Young woman bound to the central standing stone. Wild-eyed, ecstatic, possibly under the influence of a drug or potion. Face daubed with glowing blue paint. Clad in black lacy gown. Red braided hair.",
                                traits: "Does not wish to be 'rescued' \u2014 she is a willing sacrifice to the creature Big Chook that lurks in the depths of Lake Longmere.",
                                motivations: "Willing sacrifice; believes this is her purpose.",
                                secrets: "She has been prepared by the Drune for this role. She speaks Woldish.",
                                backstory: "A willing sacrifice chosen by the Drune for their ritual at the Whything Stones.",
                                stats: "Commoner; speaks Woldish.",
                                exampleQuote: "Do not pity me! This is my calling!",
                                factionId: undefined,
                                knowsPlayerHistory: [],
                                relationships: [],
                                history: []
                            },
                            {
                                id: griddlegrimId,
                                name: "Griddlegrim",
                                description: "Scrawny goblin with big head, spindly neck. Dark grey warty skin. Huge yellow beady eyes. Dressed in purple velvet finery. Jovial with a whimsical sense of humour. Rides in a palanquin on the back of the troll Grimmlegridge.",
                                traits: "Checks names of visitors to the princess's tower. Allows invited wedding guests to enter. Will let uninvited people in if they eat a mushroom from his pouch.",
                                motivations: "Guard the entrance to the tower. Serve the princess.",
                                secrets: "His shroom pouch is magical \u2014 eating a mushroom invokes a random magical effect.",
                                backstory: "A Dolmenwood goblin serving as the doorman for Princess Snowfall-at-Dusk's tower.",
                                stats: "AC 14, HP 21, CR 1. Innate Spellcasting (minor illusion, prestidigitation at will; darkness, sleep 3/day; charm person, phantasmal force 1/day). Silver Allergy.",
                                exampleQuote: "Name? Name! You must have a name on the list! No? Well... perhaps a mushroom would help...",
                                factionId: frostElvesFactionId,
                                knowsPlayerHistory: [],
                                relationships: [],
                                history: []
                            },
                            {
                                id: grimmlegridgeId,
                                name: "Grimmlegridge",
                                description: "Hulking, obese troll (10 feet tall). Hairless clay-like flesh. Hessian clothes, ragged and filthy. Bulging pouch of moss-covered humanoid bones. Glowering, moody simpleton.",
                                traits: "Does what Griddlegrim tells him. Secretly wants to squash PCs and add their bodies to his moss-corpse collection at the forest edge.",
                                motivations: "Serve as doorman and muscle for the tower entrance.",
                                secrets: "Vulnerable to acid and fire. Regenerates 10 HP per round unless damaged by acid or fire.",
                                backstory: "A Dolmenwood troll serving as the muscle at the tower entrance, carrying Griddlegrim in a palanquin on his back.",
                                stats: "AC 15, HP 84, CR 5. Regeneration 10. Mossy Fist +7 to hit (2d6+4 bludgeoning, DC 15 Con or mossy growths). Silver Allergy. Vulnerable to acid and fire.",
                                exampleQuote: "Grimmlegridge squash?",
                                factionId: frostElvesFactionId,
                                knowsPlayerHistory: [],
                                relationships: [],
                                history: []
                            },
                            {
                                id: lordMantleId,
                                name: "Lord Mantle-of-Runes",
                                description: "A frost elf friend of the princess. Announced by a cawing white raven.",
                                traits: "Ally of Princess Snowfall-at-Dusk.",
                                motivations: "Support the princess and attend the perpetual wedding feast.",
                                secrets: "",
                                backstory: "A frost elf noble who has secretly journeyed to the princess's tower to attend the wedding feast.",
                                stats: "Frost Elf Noble",
                                exampleQuote: "",
                                factionId: frostElvesFactionId,
                                knowsPlayerHistory: [],
                                relationships: [],
                                history: []
                            }
                        ],
                        locations: [
                            {
                                id: dolmenwoodId,
                                name: "Dolmenwood",
                                description: "A dense, tangled forest where the mortal world and the realm of Fairy overlap. Brambles half-bury the paths. Twisted trees seem to close in around travellers. Ancient standing stones mark intersections of ley lines. The forest is home to talking toads, ghostly owls, tipsy goblin merchants, and stranger things.",
                                secrets: "The boundary between the mortal world and Fairy is thin here. Ley lines crisscross beneath the forest floor.",
                                subLocationIds: [whythingStonesId, burialMoundId],
                                connections: [],
                                loot: [],
                                history: []
                            },
                            {
                                id: whythingStonesId,
                                name: "The Whything Stones",
                                description: "An ancient circle of rune-etched standing stones in a forest clearing. The stones reflect eldritch markings in moonlight and are clad with dangling mossy beards. The air hums with latent magical energy.",
                                secrets: "This is where Sir Chyde and the princess first met. The Drune now use it for their rituals. The burial mound is nearby.",
                                parentLocationId: dolmenwoodId,
                                subLocationIds: [],
                                connections: [],
                                loot: [],
                                history: [],
                                pointsOfInterest: [
                                    { id: crypto.randomUUID(), name: "The Central Stone", passivePerceptionDC: 10, description: "The largest standing stone, where sacrifices are bound during Drune rituals.", investigationChecks: [], interactions: [] },
                                    { id: crypto.randomUUID(), name: "The Burial Mound Entrance", passivePerceptionDC: 12, description: "A heavy granite slab nearby, overgrown with lichen and sweet-smelling wild roses, seals the entrance to the burial mound.", investigationChecks: [], interactions: [] }
                                ]
                            },
                            {
                                id: burialMoundId,
                                name: "The Burial Mound",
                                description: "A flat-topped hillock, evidently man-made, rising from the tangled Dolmenwood forest. A heavy granite slab, overgrown with lichen and sweet-smelling wild roses, seals the entrance. Inside lies a dank, musty tomb sealed for centuries.",
                                secrets: "Sir Chyde's tomb. The lower level contains a warded pool that serves as a portal to Fairy. The tomb was sealed by the Church when fey influence began creeping in.",
                                parentLocationId: dolmenwoodId,
                                subLocationIds: [priestQuartersId, hallOfHoundsId],
                                connections: [],
                                loot: [],
                                history: [],
                                pointsOfInterest: [
                                    { id: crypto.randomUUID(), name: "Hall of Guardians (Area 5)", passivePerceptionDC: 14, description: "Musty, wet chamber with 4 animated religious objects on plinths. Dusty mosaic on the floor depicts Sir Chyde piercing the heart of a fairy knight. Double doors inscribed 'The Most Dear'.", investigationChecks: [], interactions: [] },
                                    { id: crypto.randomUUID(), name: "Blindfolded Statue (Area 6)", passivePerceptionDC: 12, description: "White marble statue of a fair maiden with a star on her brow, blindfolded, finger raised to her lips. Stairs behind lead down to the lower level.", investigationChecks: [], interactions: [] },
                                    { id: crypto.randomUUID(), name: "Freezing Mirror (Area 7)", passivePerceptionDC: 10, description: "Full-length silver-framed mirror, engraved with crucifixes and unicorns at play. Passing in front requires DC 20 Constitution save or be frozen still (petrified condition). Worth 1,000gp.", investigationChecks: [], interactions: [] },
                                    { id: crypto.randomUUID(), name: "Family Crypt (Area 8)", passivePerceptionDC: 12, description: "Two floating skeletons dancing a waltz in mid-air, covered in slime vapour. Five stone coffers with brass plaques naming Sir Chyde's family members. A fissure in the floor leads down to Fairy.", investigationChecks: [], interactions: [] },
                                    { id: crypto.randomUUID(), name: "Chapel of St Sedge (Area 9)", passivePerceptionDC: 14, description: "Decaying pews, stone altar with candle. Statue of St Sedge the holy crusader. Tapestry conceals a hidden door.", investigationChecks: [], interactions: [] },
                                    { id: crypto.randomUUID(), name: "Knight's Tomb (Area 13)", passivePerceptionDC: 10, description: "The ghost of Sir Chyde kneels before a portrait of his beloved. Stone coffer contains his skeleton wearing copper bracelets with amethyst owl eyes (1,000gp each). On his finger: Sir Chyde's binding ring.", investigationChecks: [], interactions: [] },
                                    { id: crypto.randomUUID(), name: "Warded Pool (Area 14)", passivePerceptionDC: 10, description: "Shimmering vaulted chamber with a pool and a white marble maiden statue. Ghostly votive candles ward the bottom of the stairs. Passing through transports characters to Fairy.", investigationChecks: [], interactions: [] }
                                ]
                            },
                            {
                                id: priestQuartersId,
                                name: "The Abandoned Priest's Quarters",
                                description: "A damp chamber accessible through a worm hole or hidden door. Rubble from a collapsed wall. 3 wormtongues lurk in the narrow tunnel. A mouldy writing desk with a locked drawer containing a brass sheet about Sir Chyde's hunting dogs.",
                                secrets: "Hidden flagstone in the NE corner. Beneath it: a locked metal box trapped with a poison dart (DC 15 to disarm). Inside: silver crucifix (50gp), scroll of hold person, prayer book (500gp), box of 20 holy wafers (cure 1hp each).",
                                parentLocationId: burialMoundId,
                                subLocationIds: [],
                                connections: [],
                                loot: [],
                                history: []
                            },
                            {
                                id: hallOfHoundsId,
                                name: "Hall of Hounds",
                                description: "Carved pillars depicting holy war scenes. Massive double doors of smooth stone, locked and warded by magic. Two stone hounds chained to the door base, larger than life.",
                                secrets: "Inscription: 'Call to the Companions.' Speaking the names of Sir Chyde's hounds (Flaegr and Chedr) opens the doors. Touching without the password animates the stone hounds to attack.",
                                parentLocationId: burialMoundId,
                                subLocationIds: [],
                                connections: [],
                                loot: [],
                                history: []
                            },
                            {
                                id: towerOnLakeId,
                                name: "Tower on a Frozen Lake",
                                description: "A wintry glade emerges beyond the warded pool. Bitter cold, 2 feet of deep snow, sparkling sunshine glinting off crystalline snow. A frozen lake surrounds a white marble tower. Purple crack in the sky drips sticky purple liquid. Hoar-clad forest at the edges with ominous fir-woods and mossy corpses.",
                                secrets: "The tower is Princess Snowfall-at-Dusk's prison in Fairy. Characters who came through the tomb ward can pass back, but it is impassable to others. 1d6 days have passed in the mortal world.",
                                subLocationIds: [princessTowerId],
                                connections: [],
                                loot: [],
                                history: [],
                                pointsOfInterest: [
                                    { id: crypto.randomUUID(), name: "Frozen Lake", passivePerceptionDC: 10, description: "DC 10 Acrobatics or fall prone, 1d4 damage. The ice is thick enough to walk on but treacherous.", investigationChecks: [], interactions: [] },
                                    { id: crypto.randomUUID(), name: "Hoar-Clad Forest", passivePerceptionDC: 13, description: "Giant spiders, frost elves, and winter wolves lurk among the frost-covered trees at the edges of the glade.", investigationChecks: [], interactions: [] }
                                ]
                            },
                            {
                                id: princessTowerId,
                                name: "The Princess's Tower",
                                description: "A white marble tower with solid cherry wood door, black iron fittings. Icy walls (DC 20 Athletics to climb). Frost-patterned windows. A thin plume of bluish smoke rises from the summit.",
                                secrets: "This is Princess Snowfall-at-Dusk's magical prison. She cannot leave the tower glade.",
                                parentLocationId: towerOnLakeId,
                                subLocationIds: [],
                                connections: [],
                                loot: [],
                                history: [],
                                pointsOfInterest: [
                                    { id: crypto.randomUUID(), name: "Entrance Hall (Area 16)", passivePerceptionDC: 10, description: "Hulking clay-like troll doorman (Grimmlegridge) with a scrawny goblin rider (Griddlegrim). Garlands of white roses and pale blue forget-me-nots. Winter hats and coats. Fireplace with electric blue flames.", investigationChecks: [], interactions: [] },
                                    { id: crypto.randomUUID(), name: "Fairy Kitchen (Area 17)", passivePerceptionDC: 10, description: "Delicious aroma of currants and spice. 2 frost elf cooks (chubby, blue skin, pearly eyes) preparing food for the feast. Steam from bubbling broth.", investigationChecks: [], interactions: [] },
                                    { id: crypto.randomUUID(), name: "Wedding Feast Hall (Area 18)", passivePerceptionDC: 10, description: "Amply bedecked feasting table with roast swans, mountains of fruit, ice wines, violet spirits. 5 frost elf knights and 7 frost elf nobles sit as guests. WARNING: Mortals who eat or drink must DC 20 Wisdom save or be cursed with fairy melancholia forever.", investigationChecks: [], interactions: [] },
                                    { id: crypto.randomUUID(), name: "Princess's Bedchamber (Area 19)", passivePerceptionDC: 10, description: "Canopy bed with snow dust and white wolf skins. Dressing table with jewellery (30 ice-jewels at 200gp each, 12 fairy silver necklaces at 150gp each, platinum hoarfrost brooch worth 1,000gp). Wardrobe with 20 fur coats and gowns.", investigationChecks: [], interactions: [] }
                                ]
                            }
                        ],
                        items: [
                            {
                                id: bindingRingId,
                                name: "Sir Chyde's Binding Ring",
                                description: "A bronze band set with a moonstone, with fittings in the form of woven branches. This ring was given to Sir Chyde by Princess Snowfall-at-Dusk as a pledge of her love.",
                                rarity: "legendary",
                                properties: "Binds the souls of two lovers together for eternity. The ghost of Sir Chyde is tethered to this ring and cannot exist more than 10' from it. Wearing the ring opens the magical door in the warded pool (area 14) leading to Fairy. If the ring is brought to the princess's tower, the two worlds begin to drift apart and the lovers can be reunited. If the ring is crushed, Sir Chyde's soul is released to the afterlife."
                            },
                            {
                                id: hubrisBladeId,
                                name: "Hubris Blade",
                                description: "A longsword of fairy construction with wavy blood grooves, surrounded by a white glow.",
                                rarity: "rare",
                                properties: "Weapon (longsword), rare. +2 to attack and damage rolls. Curse: In combat, you must succeed on a DC 16 Wisdom saving throw or be compelled to attack the largest or toughest target. You cannot willingly surrender or retreat until that target is defeated or has surrendered to you."
                            },
                            {
                                id: freezingMirrorId,
                                name: "Freezing Mirror",
                                description: "A full-length (5 feet) silver-framed mirror, beautifully wrought, engraved with crucifixes and unicorns at play. Magical and ancient.",
                                rarity: "rare",
                                properties: "Wondrous item, rare. Passing in front requires DC 20 Constitution saving throw or be frozen still (petrified condition). Worth 1,000gp. Covering bypasses the effect. 20 HP, damage threshold 10. Removing from the tomb causes its properties to fade after one month. Unfreezing: holy water, cure wounds, or sunlight."
                            },
                            {
                                id: fungiPouchId,
                                name: "Pouch of Limitless Fungi",
                                description: "A bulging moss-covered pouch made of humanoid bones, belonging to the Dolmenwood goblin Griddlegrim.",
                                rarity: "uncommon",
                                properties: "Wondrous item, uncommon. Contains an endless supply of magical mushrooms. Eating one invokes a random magical effect (roll on table). The pouch is a fairy item and may have unpredictable side effects."
                            },
                            {
                                id: portraitId,
                                name: "Portrait of the Lady of the Wood",
                                description: "A hanging portrait depicting a fair maiden with long blonde hair and white robe, a star upon her brow, amid a stone circle (the Whything Stones). Aged and damp.",
                                rarity: "uncommon",
                                properties: "If restored, worth 1,500gp. Commissioned by Sir Chyde as a portrait of his forbidden love, Princess Snowfall-at-Dusk."
                            }
                        ],
                        adventures: [
                            {
                                id: advId,
                                title: "Winter's Daughter",
                                level: 3,
                                hook: "Two hooks lead PCs to the burial mound: either recurring dreams of a beautiful elf lady who promises her heart if the PCs retrieve her stolen ring, or an inheritance from a distant relative of Sir Chyde's family, with a charter revealing the tomb's location and the fabled treasures within.",
                                theme: "Dark Fairy Tale, Dungeon Crawl, Romance",
                                scenes: [
                                    {
                                        id: scene1Id,
                                        title: "Approaching the Burial Mound",
                                        type: "exploration",
                                        readAloudText: "The forest path grows wild and tangled. Brambles half-bury the trail, and the twisted trees seem to lean inward, as if trying to block your passage. Through the dense canopy, you catch glimpses of a flat-topped hillock rising unnaturally from the undergrowth \u2014 clearly man-made. A low, incomprehensible mumbling drifts from somewhere ahead.",
                                        gmNotes: "Random events every 5 minutes (1-in-6): ghostly violet-eyed owl (DC 12 Wis or unconscious 1d6 rounds), 1d4 tipsy goblin merchants from Fairy, gusts of wind (DC 12 Dex or 2d6 bludgeoning), huge warty toad that croaks 'Betrayal'. Mumbling leads to area 2.",
                                        skillChecks: [
                                            { id: crypto.randomUUID(), skill: "Perception", dc: 12, description: "Notice the burial mound through the trees." },
                                            { id: crypto.randomUUID(), skill: "Survival", dc: 10, description: "Follow the slime trails from the worm hole." }
                                        ],
                                        rewards: "",
                                        npcIds: [],
                                        locationId: dolmenwoodId,
                                        status: 'planned'
                                    },
                                    {
                                        id: scene2Id,
                                        title: "Sacrifice at the Whything Stones",
                                        type: "social",
                                        readAloudText: "You enter a clearing dominated by a ring of ancient standing stones, their surfaces etched with eldritch markings that catch the moonlight. Two hooded figures in black cloaks stand before the central stone, chanting in an unknown tongue. A young woman with red braided hair is bound to the stone, her face daubed with glowing blue paint. She appears ecstatic, not afraid.",
                                        gmNotes: "The Drune ritualists (Dolmbrace & Haithion) regard strangers as auspicious. They may offer PCs a role in the sacrifice. Briar-Anne is WILLING \u2014 she does not want to be rescued. If PCs attack the Drune, these are CR 5 spellcasters who can easily annihilate a low-level party. Let players know these are dangerous. The ritual takes 1 hour to complete; the woman's throat is slit and her blood collected.",
                                        skillChecks: [
                                            { id: crypto.randomUUID(), skill: "Arcana", dc: 15, description: "Understand the ritual's purpose." },
                                            { id: crypto.randomUUID(), skill: "Persuasion", dc: 14, description: "Convince the Drune to share information about the tomb." }
                                        ],
                                        rewards: "",
                                        npcIds: [dolmbraceId, haithionId, briarAnneId],
                                        locationId: whythingStonesId,
                                        status: 'planned'
                                    },
                                    {
                                        id: scene3Id,
                                        title: "The Tomb Entrance",
                                        type: "exploration",
                                        readAloudText: "A heavy granite slab, thick with centuries of lichen and crowned with sweet-smelling wild roses, seals what appears to be an entrance into the mound. The stone is massive \u2014 it would take tremendous effort to move.",
                                        gmNotes: "DC 20 Strength to move the slab (advantage if 2+ creatures cooperate). Breaking: 60 HP, damage threshold 5. If the Drune ritual is underway, they won't appreciate the noise. Stairs descend 20 feet into dusty, deathly silent darkness. DC 12 Investigation notices scratches \u2014 something heavy was dragged up the stairs long ago. Worm hole (area 4) is an alternate entrance \u2014 2' wide, 3 wormtongues inside (AC 14, HP 22, CR 1/2).",
                                        skillChecks: [
                                            { id: crypto.randomUUID(), skill: "Athletics", dc: 20, description: "Move the granite slab." },
                                            { id: crypto.randomUUID(), skill: "Investigation", dc: 12, description: "Notice the drag marks on stairs." }
                                        ],
                                        rewards: "",
                                        npcIds: [],
                                        locationId: burialMoundId,
                                        status: 'planned'
                                    },
                                    {
                                        id: scene4Id,
                                        title: "Hall of Guardians",
                                        type: "combat",
                                        readAloudText: "You descend into a musty, dank chamber. The air is stifling, the ceiling and walls dripping with moisture. Four mouldy objects stand on plinths in the corners \u2014 a crucifix, a wooden cherub statue, a holy book, and a huge candle. Dust coats the floor thickly. Heavy stone double doors stand at the far end, inscribed 'The Most Dear' in archaic script.",
                                        gmNotes: "The 4 animated religious objects (AC 17, HP 17, CR 1/4 each) attack any non-Lawful character who enters. They float into the air and enlarge slightly. They sermonize in shrill tones about the PCs' misdeeds. Dusty floor conceals a mosaic of Sir Chyde piercing a fairy knight's heart. The objects are vulnerable to countering their sermons (DC 16 Religion or DC 14 Deception). If reduced to 0 HP, they burst into mould spores (DC 14 Con or incapacitated by coughing).",
                                        skillChecks: [
                                            { id: crypto.randomUUID(), skill: "Religion", dc: 16, description: "Counter the sermon to stop combat." },
                                            { id: crypto.randomUUID(), skill: "Perception", dc: 14, description: "Notice the mosaic under the dust." }
                                        ],
                                        rewards: "",
                                        npcIds: [],
                                        locationId: burialMoundId,
                                        status: 'planned'
                                    },
                                    {
                                        id: scene5Id,
                                        title: "The Family Crypt & Fissure",
                                        type: "exploration",
                                        readAloudText: "Two skeletons waltz through the air in a slow, ghostly dance, arm in arm, slick with an opalescent moisture. One wears a pearl necklace, the other a gold medallion. Five stone coffers line the walls, each with a tarnished brass plaque. A dark fissure splits the floor, and sheets of transparent slime drip from a crack in the ceiling above.",
                                        gmNotes: "The floating skeletons (modified, fly 30ft, chaotic neutral) welcome strangers to dance. They attack if coffers are disturbed. The fissure leads down to Fairy (area 15) \u2014 looking down shows glimpses of glimmering light like sunlight off snow. The slime vapour coats anyone it touches (DC 20 Dex or become weightless, drift to ceiling). Coffers contain family skeletons. Jewellery on skeletons worth 500gp each.",
                                        skillChecks: [
                                            { id: crypto.randomUUID(), skill: "Arcana", dc: 15, description: "Identify the fissure as a portal to Fairy." },
                                            { id: crypto.randomUUID(), skill: "Dexterity", dc: 20, description: "Avoid the slime vapour." }
                                        ],
                                        rewards: "Jewellery worth 500gp each (pearl necklace, gold medallion).",
                                        npcIds: [],
                                        locationId: burialMoundId,
                                        status: 'planned'
                                    },
                                    {
                                        id: scene6Id,
                                        title: "The Knight's Tomb",
                                        type: "social",
                                        readAloudText: "Beyond the great doors, you find a chamber of quiet reverence. A pale, semi-transparent figure in ghostly plate armour kneels before a hanging portrait of a beautiful maiden amid standing stones. Tarnished silver candlesticks flank a stone coffer carved with leaf patterns and a likeness of a noble knight. The ghost turns to you with hollow, desperate eyes.",
                                        gmNotes: "Sir Chyde's ghost beseeches the PCs to bring his ring to the lower level stairs (areas 6 or 7) which lead to Fairy where his beloved waits. He does NOT appreciate tomb robbers. His skeleton lies in the coffer with copper bracelets (amethyst owl eyes, 1,000gp each) and the binding ring on his finger. The ghost is tethered to the ring \u2014 he cannot move more than 10' from it. If the ring is taken without agreeing to help, he will haunt the thief.",
                                        skillChecks: [
                                            { id: crypto.randomUUID(), skill: "Persuasion", dc: 10, description: "Gain Sir Chyde's trust." },
                                            { id: crypto.randomUUID(), skill: "History", dc: 14, description: "Recognize the knight from legends." }
                                        ],
                                        rewards: "Sir Chyde's Binding Ring, copper bracelets with amethyst eyes (1,000gp each), Portrait of the Lady (1,500gp if restored).",
                                        npcIds: [sirChydeId],
                                        locationId: burialMoundId,
                                        status: 'planned'
                                    },
                                    {
                                        id: scene7Id,
                                        title: "The Warded Pool",
                                        type: "exploration",
                                        readAloudText: "You descend pristine stone stairs beneath a carved archway of interwoven stone trees. At the bottom, dozens of ghostly votive candles float in mid-air, their flames guttering as if in an unfelt breeze. Beyond them, a shimmering pool fills a vaulted chamber. In the center of the pool stands a white marble statue of a maiden \u2014 the same face as the portrait and the blindfolded statue above.",
                                        gmNotes: "The candles are a ward \u2014 it is impossible to pass without passing through them. Passing through triggers a wave of religious awe and the vaulted chamber dissolves, reforming as an outdoor scene: a white tower on an island in a frozen lake. PCs arrive in Fairy (area 15). Returning through the ward is possible but impassable to others. 1d6 days pass in the mortal world. The ward is immune to fairy magic but can be dispelled by non-fairies (DC 20, 9th-level equivalent).",
                                        skillChecks: [
                                            { id: crypto.randomUUID(), skill: "Arcana", dc: 15, description: "Understand the ward's nature." },
                                            { id: crypto.randomUUID(), skill: "Religion", dc: 12, description: "Recognize the votive candles as a Church ward." }
                                        ],
                                        rewards: "",
                                        npcIds: [],
                                        locationId: burialMoundId,
                                        status: 'planned'
                                    },
                                    {
                                        id: scene8Id,
                                        title: "Tower on the Frozen Lake",
                                        type: "exploration",
                                        readAloudText: "Reality shimmers and reforms. You stand in bitter cold, breath condensing in streams of vapour. Two feet of pristine, crunchy snow covers the ground. A frozen lake stretches before you, and upon an island at its centre rises a white marble tower. Above, a purple crack splits the sky, occasionally dripping sticky purple liquid onto the crystalline snow. Sparkling sunshine glints off everything. From the forest's edge, you hear the distant howl of wolves.",
                                        gmNotes: "This is Fairy \u2014 the realm of the Cold Prince. Random events (1-in-6 every 5 min): 1d3 frost elf knights on white chargers, goblin sleigh-rider bringing gifts, cawing white raven announcing Lord Mantle-of-Runes, 2d6 winter wolves. The frozen lake requires DC 10 Acrobatics to walk on. The tower door is solid cherry wood. Griddlegrim and Grimmlegridge guard the entrance.",
                                        skillChecks: [
                                            { id: crypto.randomUUID(), skill: "Acrobatics", dc: 10, description: "Cross the frozen lake." },
                                            { id: crypto.randomUUID(), skill: "Perception", dc: 13, description: "Spot winter wolves in the forest." }
                                        ],
                                        rewards: "",
                                        npcIds: [griddlegrimId, grimmlegridgeId],
                                        locationId: towerOnLakeId,
                                        status: 'planned'
                                    },
                                    {
                                        id: scene9Id,
                                        title: "The Wedding Feast",
                                        type: "social",
                                        readAloudText: "You climb the stairs into a grand hall bedecked for a celebration that has clearly been waiting for a very long time. The feasting table groans under the weight of roast swans stuffed with blackbirds, mountains of fruit dripping with syrup, ice wines chilling in buckets, and violet spirits in crystal decanters. Around the table sit a dozen fairy folk \u2014 haughty knights in frosty plate and foppish nobles in flouncy silk \u2014 all uncomfortably subdued, quietly sipping wine. They have been waiting for centuries.",
                                        gmNotes: "WARNING: Any mortal who eats or drinks must DC 20 Wisdom save or be cursed with fairy melancholia (permanent curse \u2014 50% chance of disadvantage on Wis/Cha saves daily until they work towards returning to Fairy. Remove curse can break it). The frost elf guests are ambivalent but will call guards if disturbed. 4 frost elf guards stand at the edges (AC 18, HP 55, CR 3 \u2014 Multiattack with Spear of Ice). 5 frost elf knights and 7 frost elf nobles. All have Silver Allergy.",
                                        skillChecks: [
                                            { id: crypto.randomUUID(), skill: "Wisdom", dc: 20, description: "Resist fairy melancholia from eating/drinking." },
                                            { id: crypto.randomUUID(), skill: "Insight", dc: 14, description: "Sense the timeless, uncanny nature of the feast." }
                                        ],
                                        rewards: "",
                                        npcIds: [],
                                        locationId: princessTowerId,
                                        status: 'planned'
                                    },
                                    {
                                        id: scene10Id,
                                        title: "The Princess's Plea",
                                        type: "social",
                                        readAloudText: "The bedchamber is a vision of winter elegance \u2014 a canopy bed veiled with snow dust and white wolf skins, a dressing table glittering with ice-jewels, and melting icicles burning with electric blue flames in the fireplace. Before you stands the woman from the portrait, from the statue, from your dreams. Princess Snowfall-at-Dusk. She is exactly as beautiful as you imagined, and more. Her crystalline blue eyes fix upon you with desperate hope.",
                                        gmNotes: "The princess wants the PCs to return to the tomb, retrieve Sir Chyde's binding ring from his coffer, and bring it to her. His soul will follow the ring, allowing the lovers to be reunited and finally married. She can offer jewels as reward (see furnishings) or, if truly moved, grant a single wish via Royal Decree. TWIST: If the ring is brought, the two worlds begin to drift apart. Within days, areas 14 and 15 cease to exist as doorways. The reunion does NOT break the princess's magical ban \u2014 she remains imprisoned. Deeper magic would be needed for that.",
                                        skillChecks: [
                                            { id: crypto.randomUUID(), skill: "Insight", dc: 16, description: "Sense the princess's desperation may hide ulterior motives." },
                                            { id: crypto.randomUUID(), skill: "Persuasion", dc: 12, description: "Negotiate better rewards." }
                                        ],
                                        rewards: "Ice-jewels (200gp each x 30), fairy silver necklaces (150gp each x 12), platinum hoarfrost brooch (1,000gp), potentially a wish.",
                                        npcIds: [princessId],
                                        locationId: princessTowerId,
                                        status: 'planned'
                                    }
                                ]
                            }
                        ]
                    };

                    draft.campaigns = [wintersDaughterCampaign];
                    draft.activeCampaignId = campaignId;
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
                    secrets: [],
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
                (articleToDelete.subArticleIds || []).forEach(childId => {
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
