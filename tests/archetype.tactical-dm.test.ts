import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestEnvironment, type CreateCampaignStoreFn } from './helpers/testStoreFactory';

// TTRPG Realism Notes:
// Tactical DMs design encounters as puzzles. The arena with pillars (topple-able cover),
// a pit (forced movement hazard), and mid-fight reinforcements (dire wolf on round 3) is
// a classic tactical design.
// The wolf encounter uses Pack Tactics, which is the defining mechanic of wolf fights in 5e.
// Adding combatants mid-fight (dire wolf) is extremely common in tactical play.
// Status effects (POISONED, paralyzed) tracked in combatant notes is how DMs actually use
// combat trackers -- the `notes` field does heavy lifting.
// The encounter archival pattern (only the active encounter at session end gets archived)
// is important: a tactical DM might run 2-3 encounters per session, and the system needs
// to handle this.
// Gorrak's "Reckless Attack" giving advantage on attacks against him is a core 5e Barbarian
// mechanic noted in combatant notes to support tactical information.

setupTestEnvironment();

let createCampaignStore: CreateCampaignStoreFn;

beforeAll(async () => {
    const mod = await import('../services/campaignService');
    createCampaignStore = mod.createCampaignStore;
});

describe('Viktor the Tactical DM: Multi-encounter session with HP tracking and dice rolls', () => {

    function setupTacticalCampaign() {
        const service = createCampaignStore({ persist: false });
        service.init();
        service.prepareNewCampaign();
        service.createCampaign(
            'Iron Arena',
            'A war-torn frontier where warbands clash over territory.',
            'custom'
        );
        const campaign = () => service.getState().campaigns[0];
        return { service, campaign };
    }

    describe('Phase 1: Setup -- arena, NPCs, adventure, session, go live', () => {
        it('creates the campaign, location with POIs, NPCs, adventure, and starts session', () => {
            const { service, campaign } = setupTacticalCampaign();

            const arenaId = service.createLocation({
                name: 'The Bloodspire Arena',
                description: 'A circular arena carved into a rocky mesa.',
                secrets: 'Trap doors release dire wolves on round 3.',
                subLocationIds: [],
                history: [],
                pointsOfInterest: [
                    {
                        id: 'poi-pillar',
                        name: 'Stone Pillars',
                        passivePerceptionDC: 10,
                        description: 'Six stone pillars provide three-quarters cover.',
                        investigationChecks: [
                            { id: 'inv-pillar', description: 'DC 12 Investigation', outcome: 'Pillars can be toppled.' }
                        ],
                        interactions: [
                            { id: 'int-pillar', description: 'DC 16 Athletics to topple a pillar', outcome: '2d10 bludgeoning in a 10ft line.' }
                        ]
                    }
                ]
            });

            expect(campaign().locations.find(l => l.id === arenaId)).toBeDefined();
            expect(campaign().locations.find(l => l.id === arenaId)!.pointsOfInterest).toHaveLength(1);
        });
    });

    describe('Phase 2: Run multi-round wolf encounter with mid-fight reinforcements', () => {
        it('tracks HP changes, dice rolls, and adding a new combatant mid-fight', () => {
            const { service, campaign } = setupTacticalCampaign();

            const arenaId = service.createLocation({
                name: 'The Bloodspire Arena',
                description: 'A circular arena.',
                secrets: 'Trap doors.',
                subLocationIds: [], history: [],
            });

            const kolvirId = service.createNpc({
                name: 'Arena Master Kolvir',
                description: 'A scarred dwarf in gilded half-plate.',
                traits: 'Announces combatants with dramatic flair.',
                backstory: 'Former gladiator.',
                motivations: 'Keep the crowds entertained.',
                secrets: 'Kolvir rigs fights.',
                stats: 'Use Veteran stat block.',
                exampleQuote: '"Ladies and gentlemen -- tonight, blood pays the toll!"',
                knowsPlayerHistory: [], relationships: [], history: [],
            });

            const gorrakId = service.createNpc({
                name: 'Gorrak the Unbroken',
                description: 'A towering half-orc with ritual scars.',
                traits: 'Roars at the start of every turn.',
                backstory: 'Undefeated champion.',
                motivations: 'Maintain his winning streak.',
                secrets: 'Gorrak is going blind in his left eye.',
                stats: 'Use Berserker stat block. HP 67.',
                exampleQuote: '"BLEED FOR THE SPIRE!"',
                knowsPlayerHistory: [], relationships: [], history: [],
            });

            const whisperId = service.createNpc({
                name: 'Whisper',
                description: 'A lithe tiefling with ash-grey skin.',
                traits: 'Never speaks during combat.',
                backstory: 'A former assassin.',
                motivations: 'Earn enough gold to buy passage.',
                secrets: "Whisper's daggers are coated in carrion crawler mucus.",
                stats: 'Use Assassin stat block. HP 78.',
                exampleQuote: '"..."',
                knowsPlayerHistory: [], relationships: [], history: [],
            });

            const trialAdventureId = service.createFullAdventure({
                title: 'Trial of the Bloodspire',
                hook: 'To earn passage, the party must survive three rounds in the arena.',
                theme: 'gladiatorial combat, tactical, survival',
                level: 5,
                scenes: [
                    {
                        title: 'Round 1: The Pack',
                        type: 'combat', status: 'planned',
                        readAloudText: 'Six lean wolves lope into the arena.',
                        gmNotes: 'Six wolves. Pack Tactics.',
                        skillChecks: [],
                        rewards: 'Crowd favor. Short rest between rounds.',
                        npcIds: [kolvirId],
                        locationId: arenaId,
                    },
                    {
                        title: 'Round 2: The Champions',
                        type: 'combat', status: 'planned',
                        readAloudText: 'Gorrak steps into the arena, greatsword over his shoulder.',
                        gmNotes: 'Gorrak and Whisper fight as a team.',
                        skillChecks: [
                            { id: 'sc-v-1', skill: 'Perception', dc: 16, description: 'Notice Whisper repositioning for a flank.' }
                        ],
                        rewards: 'Freedom passage. 500gp purse.',
                        npcIds: [gorrakId, whisperId, kolvirId],
                        locationId: arenaId,
                    }
                ]
            });

            const adv = campaign().adventures.find(a => a.id === trialAdventureId)!;
            const packSceneId = adv.scenes[0].id;
            const championsSceneId = adv.scenes[1].id;

            const sessionId = service.createSessionLog({
                title: 'Session 12: Trial of the Bloodspire',
                status: 'planned',
                sessionDate: '2026-03-21T20:00:00.000Z',
                adventureId: trialAdventureId,
                plannedSceneIds: [packSceneId, championsSceneId],
                prepNotes: 'Wolf tactics: Pack Tactics, prone. Champions: Gorrak Reckless, Whisper flanks. Trap doors on round 3.',
                relatedPlotIds: [],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
            });

            const session = () => campaign().sessionLogs.find(s => s.id === sessionId)!;

            service.goLive(sessionId);
            expect(session().status).toBe('active');
            expect(campaign().activeSceneId).toBe(packSceneId);

            // Set up wolf encounter
            service.updateEncounter({
                id: 'enc-wolves',
                round: 1,
                turnIndex: 0,
                combatants: [
                    { id: 'c-pc1', name: 'Thorin Ironforge', type: 'pc', initiative: 15, hp: 44, maxHp: 44, ac: 18, notes: '' },
                    { id: 'c-pc2', name: 'Lyralei Starweaver', type: 'pc', initiative: 18, hp: 32, maxHp: 32, ac: 15, notes: 'Mage Armor active' },
                    { id: 'c-pc3', name: 'Brother Aldous', type: 'pc', initiative: 10, hp: 38, maxHp: 38, ac: 16, notes: 'Cleric' },
                    { id: 'c-wolf1', name: 'Wolf 1', type: 'monster', initiative: 14, hp: 11, maxHp: 11, ac: 13, notes: 'Pack Tactics' },
                    { id: 'c-wolf2', name: 'Wolf 2', type: 'monster', initiative: 14, hp: 11, maxHp: 11, ac: 13, notes: 'Pack Tactics' },
                    { id: 'c-wolf3', name: 'Wolf 3', type: 'monster', initiative: 12, hp: 11, maxHp: 11, ac: 13, notes: 'Pack Tactics' },
                    { id: 'c-wolf4', name: 'Wolf 4', type: 'monster', initiative: 12, hp: 11, maxHp: 11, ac: 13, notes: 'Pack Tactics' },
                    { id: 'c-wolf5', name: 'Wolf 5', type: 'monster', initiative: 8, hp: 11, maxHp: 11, ac: 13, notes: 'Pack Tactics' },
                    { id: 'c-wolf6', name: 'Wolf 6', type: 'monster', initiative: 8, hp: 11, maxHp: 11, ac: 13, notes: 'Pack Tactics' },
                ]
            });

            expect(campaign().activeEncounter!.combatants).toHaveLength(9);

            // Log dice rolls for round 1
            service.addDiceRollToSession({
                id: 'roll-burn1',
                formula: '3d6',
                results: [4, 5, 3],
                total: 12,
                timestamp: new Date().toISOString(),
                note: 'Lyralei: Burning Hands on Wolf 1, 2, 3',
            });

            // Update after round 1: wolf 1 dead, wolf 2 and 3 damaged
            service.updateEncounter({
                id: 'enc-wolves',
                round: 2,
                turnIndex: 0,
                combatants: [
                    { id: 'c-pc1', name: 'Thorin Ironforge', type: 'pc', initiative: 15, hp: 44, maxHp: 44, ac: 18, notes: '' },
                    { id: 'c-pc2', name: 'Lyralei Starweaver', type: 'pc', initiative: 18, hp: 28, maxHp: 32, ac: 15, notes: 'Mage Armor, took bite' },
                    { id: 'c-pc3', name: 'Brother Aldous', type: 'pc', initiative: 10, hp: 38, maxHp: 38, ac: 16, notes: 'Cleric' },
                    { id: 'c-wolf1', name: 'Wolf 1', type: 'monster', initiative: 14, hp: 0, maxHp: 11, ac: 13, notes: 'DEAD - Burning Hands' },
                    { id: 'c-wolf2', name: 'Wolf 2', type: 'monster', initiative: 14, hp: 5, maxHp: 11, ac: 13, notes: 'Pack Tactics, burned' },
                    { id: 'c-wolf3', name: 'Wolf 3', type: 'monster', initiative: 12, hp: 5, maxHp: 11, ac: 13, notes: 'Pack Tactics, burned' },
                    { id: 'c-wolf4', name: 'Wolf 4', type: 'monster', initiative: 12, hp: 11, maxHp: 11, ac: 13, notes: 'Pack Tactics' },
                    { id: 'c-wolf5', name: 'Wolf 5', type: 'monster', initiative: 8, hp: 11, maxHp: 11, ac: 13, notes: 'Pack Tactics' },
                    { id: 'c-wolf6', name: 'Wolf 6', type: 'monster', initiative: 8, hp: 11, maxHp: 11, ac: 13, notes: 'Pack Tactics' },
                ]
            });

            // Log round 2 rolls
            service.addDiceRollToSession({
                id: 'roll-thorin-r2',
                formula: '1d20+7',
                results: [14],
                total: 21,
                timestamp: new Date().toISOString(),
                note: 'Thorin: Greataxe vs Wolf 2',
            });

            service.addDiceRollToSession({
                id: 'roll-thorin-dmg',
                formula: '1d12+4',
                results: [9],
                total: 13,
                timestamp: new Date().toISOString(),
                note: 'Thorin: Greataxe damage (Wolf 2 killed)',
            });

            // Round 3: Kolvir releases a dire wolf (mid-fight reinforcement)
            service.updateEncounter({
                id: 'enc-wolves',
                round: 3,
                turnIndex: 0,
                combatants: [
                    { id: 'c-pc1', name: 'Thorin Ironforge', type: 'pc', initiative: 15, hp: 38, maxHp: 44, ac: 18, notes: 'Took wolf bite' },
                    { id: 'c-pc2', name: 'Lyralei Starweaver', type: 'pc', initiative: 18, hp: 28, maxHp: 32, ac: 15, notes: 'Mage Armor' },
                    { id: 'c-pc3', name: 'Brother Aldous', type: 'pc', initiative: 10, hp: 31, maxHp: 38, ac: 16, notes: 'Took wolf bites x2' },
                    { id: 'c-wolf1', name: 'Wolf 1', type: 'monster', initiative: 14, hp: 0, maxHp: 11, ac: 13, notes: 'DEAD' },
                    { id: 'c-wolf2', name: 'Wolf 2', type: 'monster', initiative: 14, hp: 0, maxHp: 11, ac: 13, notes: 'DEAD' },
                    { id: 'c-wolf3', name: 'Wolf 3', type: 'monster', initiative: 12, hp: 0, maxHp: 11, ac: 13, notes: 'DEAD' },
                    { id: 'c-wolf4', name: 'Wolf 4', type: 'monster', initiative: 12, hp: 3, maxHp: 11, ac: 13, notes: 'Wounded' },
                    { id: 'c-wolf5', name: 'Wolf 5', type: 'monster', initiative: 8, hp: 0, maxHp: 11, ac: 13, notes: 'DEAD' },
                    { id: 'c-wolf6', name: 'Wolf 6', type: 'monster', initiative: 8, hp: 0, maxHp: 11, ac: 13, notes: 'DEAD' },
                    { id: 'c-direwolf', name: 'Dire Wolf (Arena Hazard)', type: 'monster', initiative: 16, hp: 37, maxHp: 37, ac: 14, notes: 'Released by Kolvir! Pack Tactics.' },
                ]
            });

            service.addAutoEvent('combat', 'Arena Master Kolvir activated trap door -- Dire Wolf released into the arena!');

            // Phase 2 assertions
            expect(campaign().activeEncounter!.combatants).toHaveLength(10);
            expect(campaign().activeEncounter!.round).toBe(3);
            expect(campaign().activeEncounter!.turnIndex).toBe(0);

            const wolves = campaign().activeEncounter!.combatants.filter(c => c.name.startsWith('Wolf') && c.hp === 0);
            expect(wolves).toHaveLength(5);

            const wolf4 = campaign().activeEncounter!.combatants.find(c => c.id === 'c-wolf4')!;
            expect(wolf4.hp).toBe(3);

            const direWolf = campaign().activeEncounter!.combatants.find(c => c.id === 'c-direwolf')!;
            expect(direWolf.hp).toBe(37);

            const thorin = campaign().activeEncounter!.combatants.find(c => c.id === 'c-pc1')!;
            expect(thorin.hp).toBe(38);

            expect(session().diceRolls).toHaveLength(3);

            const combatAutoEvent = session().structuredNotes.find(n => n.type === 'combat');
            expect(combatAutoEvent).toBeDefined();

            const diceRollNotes = session().structuredNotes.filter(n => n.type === 'dice-roll');
            expect(diceRollNotes).toHaveLength(3);
        });
    });

    describe('Phase 3: Advance scene, run Encounter 2 (Champions)', () => {
        it('overwrites the active encounter with a new one for the second scene', () => {
            const { service, campaign } = setupTacticalCampaign();

            const gorrakId = service.createNpc({
                name: 'Gorrak the Unbroken', description: 'A towering half-orc.',
                traits: '', backstory: '', motivations: '', secrets: '', stats: '',
                exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
            });

            const whisperId = service.createNpc({
                name: 'Whisper', description: 'A lithe tiefling.',
                traits: '', backstory: '', motivations: '', secrets: '', stats: '',
                exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
            });

            const trialAdventureId = service.createFullAdventure({
                title: 'Trial of the Bloodspire',
                hook: 'Survive three rounds.',
                theme: 'gladiatorial',
                level: 5,
                scenes: [
                    {
                        title: 'Round 1: The Pack', type: 'combat', status: 'planned',
                        readAloudText: 'Wolves.', gmNotes: 'Six wolves.',
                        skillChecks: [], rewards: '', npcIds: [], locationId: undefined,
                    },
                    {
                        title: 'Round 2: The Champions', type: 'combat', status: 'planned',
                        readAloudText: 'Gorrak steps in.', gmNotes: 'Champions fight.',
                        skillChecks: [
                            { id: 'sc-v-1', skill: 'Perception', dc: 16, description: 'Notice Whisper flanking.' }
                        ],
                        rewards: 'Freedom.', npcIds: [gorrakId, whisperId], locationId: undefined,
                    }
                ]
            });

            const adv = campaign().adventures.find(a => a.id === trialAdventureId)!;
            const packSceneId = adv.scenes[0].id;
            const championsSceneId = adv.scenes[1].id;

            const sessionId = service.createSessionLog({
                title: 'Session 12: Trial of the Bloodspire',
                status: 'planned',
                sessionDate: '2026-03-21T20:00:00.000Z',
                adventureId: trialAdventureId,
                plannedSceneIds: [packSceneId, championsSceneId],
                prepNotes: '',
                relatedPlotIds: [],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
            });

            const session = () => campaign().sessionLogs.find(s => s.id === sessionId)!;

            service.goLive(sessionId);

            // Set up wolf encounter
            service.updateEncounter({
                id: 'enc-wolves',
                round: 3,
                turnIndex: 0,
                combatants: [
                    { id: 'c-pc1', name: 'Thorin', type: 'pc', initiative: 15, hp: 38, maxHp: 44, ac: 18, notes: '' },
                    { id: 'c-wolf4', name: 'Wolf 4', type: 'monster', initiative: 12, hp: 3, maxHp: 11, ac: 13, notes: 'Wounded' },
                    { id: 'c-direwolf', name: 'Dire Wolf', type: 'monster', initiative: 16, hp: 37, maxHp: 37, ac: 14, notes: '' },
                ]
            });

            service.addDiceRollToSession({
                id: 'roll-burn1', formula: '3d6', results: [4, 5, 3], total: 12,
                timestamp: new Date().toISOString(), note: 'Burning Hands',
            });

            service.addDiceRollToSession({
                id: 'roll-thorin-r2', formula: '1d20+7', results: [14], total: 21,
                timestamp: new Date().toISOString(), note: 'Greataxe attack',
            });

            service.addDiceRollToSession({
                id: 'roll-thorin-dmg', formula: '1d12+4', results: [9], total: 13,
                timestamp: new Date().toISOString(), note: 'Greataxe damage',
            });

            // Advance to Round 2 (Champions scene)
            service.advanceScene();

            const packScene = campaign().adventures.find(a => a.id === trialAdventureId)!.scenes[0];
            const champScene = campaign().adventures.find(a => a.id === trialAdventureId)!.scenes[1];
            expect(packScene.status).toBe('completed');
            expect(champScene.status).toBe('in-progress');
            expect(campaign().activeSceneId).toBe(championsSceneId);

            // Set up champions encounter (overwrites the wolf encounter in activeEncounter)
            service.updateEncounter({
                id: 'enc-champions',
                round: 1,
                turnIndex: 0,
                combatants: [
                    { id: 'c-pc1', name: 'Thorin Ironforge', type: 'pc', initiative: 12, hp: 44, maxHp: 44, ac: 18, notes: 'Short rested' },
                    { id: 'c-pc2', name: 'Lyralei Starweaver', type: 'pc', initiative: 20, hp: 32, maxHp: 32, ac: 15, notes: 'Mage Armor' },
                    { id: 'c-pc3', name: 'Brother Aldous', type: 'pc', initiative: 8, hp: 38, maxHp: 38, ac: 16, notes: 'Short rested' },
                    { id: 'c-gorrak', name: 'Gorrak the Unbroken', type: 'npc', initiative: 16, hp: 67, maxHp: 67, ac: 13, notes: 'Reckless Attack every round.' },
                    { id: 'c-whisper', name: 'Whisper', type: 'npc', initiative: 19, hp: 78, maxHp: 78, ac: 15, notes: 'Sneak Attack 3d6. Poison daggers DC 13.' },
                ]
            });

            service.addDiceRollToSession({
                id: 'roll-whisper-poison',
                formula: '1d20+6',
                results: [18],
                total: 24,
                timestamp: new Date().toISOString(),
                note: 'Whisper stabs Thorin with poisoned dagger',
            });

            // Update encounter after round 2
            service.updateEncounter({
                id: 'enc-champions',
                round: 2,
                turnIndex: 0,
                combatants: [
                    { id: 'c-pc1', name: 'Thorin Ironforge', type: 'pc', initiative: 12, hp: 30, maxHp: 44, ac: 18, notes: 'POISONED (paralyzed 1 round)' },
                    { id: 'c-pc2', name: 'Lyralei Starweaver', type: 'pc', initiative: 20, hp: 32, maxHp: 32, ac: 15, notes: 'Mage Armor' },
                    { id: 'c-pc3', name: 'Brother Aldous', type: 'pc', initiative: 8, hp: 38, maxHp: 38, ac: 16, notes: '' },
                    { id: 'c-gorrak', name: 'Gorrak the Unbroken', type: 'npc', initiative: 16, hp: 34, maxHp: 67, ac: 13, notes: 'Reckless Attack. Half HP.' },
                    { id: 'c-whisper', name: 'Whisper', type: 'npc', initiative: 19, hp: 78, maxHp: 78, ac: 15, notes: 'Untouched. Repositioning.' },
                ]
            });

            // Phase 3 assertions
            expect(campaign().activeEncounter!.id).toBe('enc-champions');
            expect(campaign().activeEncounter!.combatants).toHaveLength(5);
            expect(campaign().activeEncounter!.round).toBe(2);

            const thorin = campaign().activeEncounter!.combatants.find(c => c.id === 'c-pc1')!;
            expect(thorin.notes).toContain('POISONED');
            expect(thorin.hp).toBe(30);

            const gorrak = campaign().activeEncounter!.combatants.find(c => c.id === 'c-gorrak')!;
            expect(gorrak.hp).toBe(34);

            const whisper = campaign().activeEncounter!.combatants.find(c => c.id === 'c-whisper')!;
            expect(whisper.hp).toBe(78);
        });
    });

    describe('Phase 4: End session -- verify encounter archival', () => {
        it('archives only the active encounter at session end, not intermediate encounters', () => {
            const { service, campaign } = setupTacticalCampaign();

            const trialAdventureId = service.createFullAdventure({
                title: 'Trial of the Bloodspire',
                hook: 'Survive.',
                theme: 'gladiatorial',
                level: 5,
                scenes: [
                    {
                        title: 'Round 1: The Pack', type: 'combat', status: 'planned',
                        readAloudText: '', gmNotes: '',
                        skillChecks: [], rewards: '', npcIds: [], locationId: undefined,
                    },
                    {
                        title: 'Round 2: The Champions', type: 'combat', status: 'planned',
                        readAloudText: '', gmNotes: '',
                        skillChecks: [], rewards: '', npcIds: [], locationId: undefined,
                    }
                ]
            });

            const adv = campaign().adventures.find(a => a.id === trialAdventureId)!;
            const [packSceneId, championsSceneId] = adv.scenes.map(s => s.id);

            const sessionId = service.createSessionLog({
                title: 'Session 12: Trial of the Bloodspire',
                status: 'planned',
                sessionDate: '2026-03-21T20:00:00.000Z',
                adventureId: trialAdventureId,
                plannedSceneIds: [packSceneId, championsSceneId],
                prepNotes: '',
                relatedPlotIds: [],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
            });

            const session = () => campaign().sessionLogs.find(s => s.id === sessionId)!;

            service.goLive(sessionId);

            // First encounter (wolves)
            service.updateEncounter({
                id: 'enc-wolves',
                round: 3,
                turnIndex: 0,
                combatants: [
                    { id: 'c-pc1', name: 'Thorin', type: 'pc', initiative: 15, hp: 38, maxHp: 44, ac: 18, notes: '' },
                ]
            });

            service.addDiceRollToSession({
                id: 'roll-1', formula: '3d6', results: [4, 5, 3], total: 12,
                timestamp: new Date().toISOString(), note: 'Burning Hands',
            });
            service.addDiceRollToSession({
                id: 'roll-2', formula: '1d20+7', results: [14], total: 21,
                timestamp: new Date().toISOString(), note: 'Greataxe attack',
            });
            service.addDiceRollToSession({
                id: 'roll-3', formula: '1d12+4', results: [9], total: 13,
                timestamp: new Date().toISOString(), note: 'Greataxe damage',
            });

            service.addAutoEvent('combat', 'Arena Master Kolvir activated trap door -- Dire Wolf released!');

            service.advanceScene();

            // Second encounter (champions) -- overwrites wolf encounter
            service.updateEncounter({
                id: 'enc-champions',
                round: 2,
                turnIndex: 0,
                combatants: [
                    { id: 'c-pc1', name: 'Thorin', type: 'pc', initiative: 12, hp: 30, maxHp: 44, ac: 18, notes: 'POISONED' },
                    { id: 'c-gorrak', name: 'Gorrak', type: 'npc', initiative: 16, hp: 34, maxHp: 67, ac: 13, notes: 'Half HP' },
                    { id: 'c-whisper', name: 'Whisper', type: 'npc', initiative: 19, hp: 78, maxHp: 78, ac: 15, notes: '' },
                ]
            });

            service.addDiceRollToSession({
                id: 'roll-4', formula: '1d20+6', results: [18], total: 24,
                timestamp: new Date().toISOString(), note: 'Whisper poison attack',
            });

            service.endSession();

            expect(session().status).toBe('completed');
            expect(campaign().activeEncounter).toBeUndefined();
            expect(campaign().activeSessionId).toBeUndefined();

            // Only the active encounter at endSession time is archived
            // (the wolf encounter was replaced by champions encounter via updateEncounter)
            expect(session().encounterLog).toHaveLength(1);
            expect(session().encounterLog[0].sessionId).toBe(sessionId);

            // Total dice rolls: 4
            expect(session().diceRolls).toHaveLength(4);

            // Check structured note types
            const noteTypes = session().structuredNotes.map(n => n.type);
            expect(noteTypes).toContain('dice-roll');
            expect(noteTypes).toContain('scene-transition');
            expect(noteTypes).toContain('combat');
        });
    });
});
