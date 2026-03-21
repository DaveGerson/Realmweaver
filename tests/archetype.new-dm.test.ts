import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestEnvironment, type CreateCampaignStoreFn } from './helpers/testStoreFactory';

// TTRPG Realism Notes:
// New DMs follow published modules closely. The entire adventure structure mirrors the
// "Lost Mine of Phandelver" opening encounter.
// Player character import is one of the first things a new DM does -- they need to know
// their players' abilities to run encounters.
// The detailed skill checks with specific DCs reflect how anxious new DMs prep.
// The combat tracker workflow (set up encounter, roll dice, update HP, advance turns) is
// exactly how a nervous DM runs their first fight -- methodically and by the book.
// The 3-round timer for Sildar is a classic module mechanic that creates urgency.
// Initiative order matters: Lyralei (Dex 14) with initiative 18 and Thorin (Dex 12) with 15
// is realistic for their modifiers.

setupTestEnvironment();

let createCampaignStore: CreateCampaignStoreFn;

beforeAll(async () => {
    const mod = await import('../services/campaignService');
    createCampaignStore = mod.createCampaignStore;
});

describe('Nadia the New DM: Follow a published module with detailed scene prep and combat tracking', () => {

    function setupNewDmCampaign() {
        const service = createCampaignStore({ persist: false });
        service.init();
        service.prepareNewCampaign();
        service.createCampaign(
            'Lost Mine of Phandelver',
            'The Sword Coast region of the Forgotten Realms, near the frontier town of Phandalin.',
            'official',
            'Forgotten Realms'
        );
        const campaign = () => service.getState().campaigns[0];
        return { service, campaign };
    }

    describe('Phase 1: Set up player characters', () => {
        it('creates campaign with official setting and imports two player characters', () => {
            const { service, campaign } = setupNewDmCampaign();

            const c = campaign();
            expect(c.settingType).toBe('official');
            expect(c.officialSetting).toBe('Forgotten Realms');

            const thorinPcId = service.createPlayerCharacter({
                playerName: 'Jake',
                characterSocial: {
                    characterName: 'Thorin Ironforge',
                    background: 'Soldier',
                    species: 'Mountain Dwarf',
                    personality: 'Gruff but fiercely loyal.',
                    appearance: 'Stocky even for a dwarf. Braided auburn beard.',
                    backstory: 'Served in the Mithral Hall garrison for 20 years.',
                    ideals: 'Honor and duty above all.',
                    bonds: 'My old commander saved my life.',
                    flaws: 'I am inflexible in my thinking.',
                },
                characterStatistics: {
                    classes: { charClass: 'Fighter', subclass: 'Champion', level: 1 },
                    attributes: { strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 13, charisma: 8 },
                    skills: {
                        acrobatics: 'none', animal_handling: 'none', arcana: 'none',
                        athletics: 'proficient', deception: 'none', history: 'none',
                        insight: 'none', intimidation: 'proficient', investigation: 'none',
                        medicine: 'none', nature: 'none', perception: 'proficient',
                        performance: 'none', persuasion: 'none', religion: 'none',
                        sleight_of_hand: 'none', stealth: 'none', survival: 'none',
                    },
                    actions: ['Greataxe: +5 to hit, 1d12+3 slashing'],
                    specialActions: ['Second Wind: Bonus action, regain 1d10+1 HP, 1/short rest'],
                }
            });

            const lyraleiPcId = service.createPlayerCharacter({
                playerName: 'Mia',
                characterSocial: {
                    characterName: 'Lyralei Starweaver',
                    background: 'Sage',
                    species: 'High Elf',
                    personality: 'Endlessly curious.',
                    appearance: 'Tall and willowy with silver hair and violet eyes.',
                    backstory: 'Left the elven academy to study magic in the field.',
                    ideals: 'Knowledge is the path to power.',
                    bonds: 'I have an ancient text that holds a terrible secret.',
                    flaws: 'I overlook obvious solutions in favor of complicated ones.',
                },
                characterStatistics: {
                    classes: { charClass: 'Wizard', subclass: undefined, level: 1 },
                    attributes: { strength: 8, dexterity: 14, constitution: 12, intelligence: 16, wisdom: 13, charisma: 10 },
                    skills: {
                        acrobatics: 'none', animal_handling: 'none', arcana: 'proficient',
                        athletics: 'none', deception: 'none', history: 'proficient',
                        insight: 'none', intimidation: 'none', investigation: 'proficient',
                        medicine: 'none', nature: 'none', perception: 'none',
                        performance: 'none', persuasion: 'none', religion: 'none',
                        sleight_of_hand: 'none', stealth: 'none', survival: 'none',
                    },
                    actions: ['Quarterstaff: +1 to hit, 1d6-1 bludgeoning', 'Fire Bolt: +5 to hit, 1d10 fire'],
                    specialActions: ['Arcane Recovery: Regain spell slots on short rest, 1/day'],
                }
            });

            const pcs = campaign().playerCharacters;
            expect(pcs).toHaveLength(2);

            const thorin = pcs.find(p => p.id === thorinPcId)!;
            expect(thorin.characterSocial.characterName).toBe('Thorin Ironforge');
            expect(thorin.characterStatistics.classes.charClass).toBe('Fighter');
            expect(thorin.characterStatistics.classes.level).toBe(1);
            expect(thorin.characterStatistics.attributes.strength).toBe(16);

            const lyralei = pcs.find(p => p.id === lyraleiPcId)!;
            expect(lyralei.characterSocial.characterName).toBe('Lyralei Starweaver');
            expect(lyralei.characterStatistics.classes.charClass).toBe('Wizard');
            expect(lyralei.characterStatistics.classes.level).toBe(1);
            expect(lyralei.characterStatistics.attributes.intelligence).toBe(16);
        });
    });

    describe('Phase 2: Prep the Goblin Ambush adventure', () => {
        it('creates adventure with detailed scenes, skill checks, and NPC references', () => {
            const { service, campaign } = setupNewDmCampaign();

            const sildarId = service.createNpc({
                name: 'Sildar Hallwinter',
                description: 'A middle-aged human male with a neatly trimmed beard.',
                traits: 'Speaks formally, using titles even for common folk.',
                backstory: 'A retired soldier and agent of the Lords\' Alliance.',
                motivations: 'Rescue Gundren Rockseeker.',
                secrets: 'Sildar knows the location of Cragmaw Castle.',
                stats: 'Use Knight stat block. HP reduced to 27.',
                exampleQuote: '"The Alliance sent me here for a reason."',
                knowsPlayerHistory: [],
                relationships: [],
                history: [],
            });

            const klargId = service.createNpc({
                name: 'Klarg',
                description: 'A hulking bugbear with matted brown fur.',
                traits: 'Roars before speaking. Refers to himself in the third person.',
                backstory: 'Appointed leader of the Cragmaw hideout goblins by King Grol.',
                motivations: 'Impress King Grol.',
                secrets: 'Klarg is terrified of wolves.',
                stats: 'Use Bugbear stat block. HP 27, AC 16.',
                exampleQuote: '"KLARG IS MIGHTY!"',
                knowsPlayerHistory: [],
                relationships: [],
                history: [],
            });

            const goblinAdventureId = service.createFullAdventure({
                title: 'Goblin Arrows',
                hook: 'Your patron Gundren Rockseeker hired you to escort a supply wagon to Phandalin.',
                theme: 'ambush, rescue, dungeon crawl',
                level: 1,
                scenes: [
                    {
                        title: 'Goblin Ambush on the Triboar Trail',
                        type: 'combat',
                        status: 'planned',
                        readAloudText: 'Around a bend in the trail, you spot two dead horses.',
                        gmNotes: 'Four goblins hiding in the trees.',
                        skillChecks: [
                            { id: 'sc-na-1', skill: 'Perception', dc: 13, description: 'Spot the goblin ambushers.' },
                            { id: 'sc-na-2', skill: 'Survival', dc: 10, description: 'Follow the goblin trail.' }
                        ],
                        rewards: 'Each goblin carries 1d6 cp.',
                        npcIds: [],
                        locationId: undefined,
                    },
                    {
                        title: "Cragmaw Hideout: Klarg's Chamber",
                        type: 'combat',
                        status: 'planned',
                        readAloudText: 'The cave opens into a large chamber.',
                        gmNotes: 'Klarg fights with his wolf Ripper.',
                        skillChecks: [
                            { id: 'sc-na-3', skill: 'Stealth', dc: 14, description: "Approach Klarg's chamber." },
                            { id: 'sc-na-4', skill: 'Medicine', dc: 10, description: 'Stabilize Sildar Hallwinter.' }
                        ],
                        rewards: "Klarg's treasure: 600 cp, 110 sp.",
                        npcIds: [klargId, sildarId],
                        locationId: undefined,
                    }
                ]
            });

            const adv = campaign().adventures.find(a => a.id === goblinAdventureId)!;
            expect(adv.scenes).toHaveLength(2);

            const ambushScene = adv.scenes[0];
            expect(ambushScene.skillChecks).toHaveLength(2);
            expect(ambushScene.skillChecks[0].dc).toBe(13);
            expect(ambushScene.skillChecks[1].dc).toBe(10);
            expect(ambushScene.status).toBe('planned');

            const klargScene = adv.scenes[1];
            expect(klargScene.npcIds).toContain(klargId);
            expect(klargScene.npcIds).toContain(sildarId);
            expect(klargScene.status).toBe('planned');
        });
    });

    describe('Phase 3 to 5: Full session lifecycle with combat tracking', () => {
        it('runs session from goLive through combat to endSession with encounter archival', () => {
            const { service, campaign } = setupNewDmCampaign();

            // Create NPCs
            const sildarId = service.createNpc({
                name: 'Sildar Hallwinter', description: 'A middle-aged human male.',
                traits: '', backstory: '', motivations: '', secrets: '', stats: '',
                exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
            });

            const klargId = service.createNpc({
                name: 'Klarg', description: 'A hulking bugbear.',
                traits: '', backstory: '', motivations: '', secrets: '', stats: '',
                exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
            });

            const goblinAdventureId = service.createFullAdventure({
                title: 'Goblin Arrows',
                hook: 'Escort a supply wagon.',
                theme: 'ambush, rescue',
                level: 1,
                scenes: [
                    {
                        title: 'Goblin Ambush on the Triboar Trail',
                        type: 'combat', status: 'planned',
                        readAloudText: 'Dead horses on the trail.',
                        gmNotes: 'Four goblins hiding.',
                        skillChecks: [
                            { id: 'sc-na-1', skill: 'Perception', dc: 13, description: 'Spot goblins.' },
                            { id: 'sc-na-2', skill: 'Survival', dc: 10, description: 'Follow trail.' }
                        ],
                        rewards: '1d6 cp each.', npcIds: [], locationId: undefined,
                    },
                    {
                        title: "Cragmaw Hideout: Klarg's Chamber",
                        type: 'combat', status: 'planned',
                        readAloudText: 'A large chamber with a fire pit.',
                        gmNotes: 'Klarg fights.',
                        skillChecks: [
                            { id: 'sc-na-3', skill: 'Stealth', dc: 14, description: "Approach Klarg's." },
                            { id: 'sc-na-4', skill: 'Medicine', dc: 10, description: 'Stabilize Sildar.' }
                        ],
                        rewards: 'Klarg\'s treasure.', npcIds: [klargId, sildarId], locationId: undefined,
                    }
                ]
            });

            const adv = campaign().adventures.find(a => a.id === goblinAdventureId)!;
            const ambushSceneId = adv.scenes[0].id;
            const klargSceneId = adv.scenes[1].id;

            // Create session log
            const sessionLogId = service.createSessionLog({
                title: 'Session 1: Goblin Arrows',
                status: 'planned',
                sessionDate: '2026-03-22T18:00:00.000Z',
                adventureId: goblinAdventureId,
                plannedSceneIds: [ambushSceneId, klargSceneId],
                prepNotes: 'Remember: Klarg is afraid of wolves. Sildar at 1 HP and dying -- 3 round timer.',
                relatedPlotIds: [],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
            });

            const session = () => campaign().sessionLogs.find(s => s.id === sessionLogId)!;

            // Phase 3: Go live
            service.goLive(sessionLogId);

            expect(session().status).toBe('active');
            expect(campaign().activeSceneId).toBe(ambushSceneId);
            const ambushScene = campaign().adventures.find(a => a.id === goblinAdventureId)!.scenes[0];
            expect(ambushScene.status).toBe('in-progress');

            // Phase 4: Set up combat encounter
            service.updateEncounter({
                id: 'enc-ambush-test',
                round: 1,
                turnIndex: 0,
                combatants: [
                    { id: 'c-thorin', name: 'Thorin Ironforge', type: 'pc', initiative: 15, hp: 12, maxHp: 12, ac: 16, notes: '' },
                    { id: 'c-lyralei', name: 'Lyralei Starweaver', type: 'pc', initiative: 18, hp: 8, maxHp: 8, ac: 12, notes: '' },
                    { id: 'c-goblin1', name: 'Goblin Archer 1', type: 'monster', initiative: 14, hp: 7, maxHp: 7, ac: 15, notes: 'Hiding in treeline' },
                    { id: 'c-goblin2', name: 'Goblin Archer 2', type: 'monster', initiative: 11, hp: 7, maxHp: 7, ac: 15, notes: 'Hiding in treeline' },
                    { id: 'c-goblin3', name: 'Goblin Rusher 1', type: 'monster', initiative: 9, hp: 7, maxHp: 7, ac: 15, notes: 'Scimitar' },
                    { id: 'c-goblin4', name: 'Goblin Rusher 2', type: 'monster', initiative: 6, hp: 7, maxHp: 7, ac: 15, notes: 'Scimitar' },
                ]
            });

            expect(campaign().activeEncounter?.combatants).toHaveLength(6);

            // Log a dice roll
            service.addDiceRollToSession({
                id: 'roll-1',
                formula: '1d20+5',
                results: [17],
                total: 22,
                timestamp: new Date().toISOString(),
                note: 'Thorin attacks Goblin Archer 1 with Greataxe',
            });

            expect(session().diceRolls).toHaveLength(1);
            expect(session().diceRolls![0].formula).toBe('1d20+5');
            expect(session().diceRolls![0].total).toBe(22);

            // Dice roll also adds to structuredNotes as 'dice-roll' type
            const diceRollNote = session().structuredNotes.find(n => n.type === 'dice-roll');
            expect(diceRollNote).toBeDefined();
            expect(diceRollNote!.content).toContain('1d20+5');

            // Update encounter: Goblin 1 killed (hp 0), turnIndex advanced
            service.updateEncounter({
                id: campaign().activeEncounter!.id,
                round: 1,
                turnIndex: 1,
                combatants: [
                    { id: 'c-thorin', name: 'Thorin Ironforge', type: 'pc', initiative: 15, hp: 12, maxHp: 12, ac: 16, notes: '' },
                    { id: 'c-lyralei', name: 'Lyralei Starweaver', type: 'pc', initiative: 18, hp: 8, maxHp: 8, ac: 12, notes: '' },
                    { id: 'c-goblin1', name: 'Goblin Archer 1', type: 'monster', initiative: 14, hp: 0, maxHp: 7, ac: 15, notes: 'DEAD' },
                    { id: 'c-goblin2', name: 'Goblin Archer 2', type: 'monster', initiative: 11, hp: 7, maxHp: 7, ac: 15, notes: '' },
                    { id: 'c-goblin3', name: 'Goblin Rusher 1', type: 'monster', initiative: 9, hp: 7, maxHp: 7, ac: 15, notes: '' },
                    { id: 'c-goblin4', name: 'Goblin Rusher 2', type: 'monster', initiative: 6, hp: 7, maxHp: 7, ac: 15, notes: '' },
                ]
            });

            expect(campaign().activeEncounter!.turnIndex).toBe(1);
            expect(campaign().activeEncounter!.combatants.find(c => c.id === 'c-goblin1')!.hp).toBe(0);
            expect(campaign().activeEncounter!.combatants.find(c => c.id === 'c-goblin1')!.notes).toBe('DEAD');

            // Phase 5: Advance scene and end session
            service.advanceScene();

            const finalScenes = campaign().adventures.find(a => a.id === goblinAdventureId)!.scenes;
            expect(finalScenes[0].status).toBe('completed');
            expect(finalScenes[1].status).toBe('in-progress');

            service.addSessionRunnerNote(
                'Klarg fight went well. Lyralei cast Sleep on the wolf. Thorin went toe-to-toe with Klarg.',
                [klargId, sildarId],
                'manual',
                ['Combat']
            );

            service.endSession();

            expect(session().status).toBe('completed');
            expect(campaign().activeSessionId).toBeUndefined();

            // Encounter archived to encounterLog
            expect(session().encounterLog).toHaveLength(1);
            expect(session().encounterLog[0].sessionId).toBe(sessionLogId);
            expect(campaign().activeEncounter).toBeUndefined();

            // Klarg scene still 'in-progress' -- endSession does NOT auto-complete the active scene
            const klargScene = campaign().adventures.find(a => a.id === goblinAdventureId)!.scenes[1];
            expect(klargScene.status).toBe('in-progress');
        });
    });
});
