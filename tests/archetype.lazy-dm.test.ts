import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestEnvironment, type CreateCampaignStoreFn } from './helpers/testStoreFactory';

// TTRPG Realism Notes:
// Lazy DMs prep secrets and clues, not detailed scripts. The prepNotes reflect the "Lazy DM"
// format: secrets, clues, key NPCs, strong start, treasure.
// Creating NPCs mid-session is the hallmark of improvisational play.
// The session note pattern (exploration observation, discovery note, RP highlight, combat summary)
// mirrors how real DMs take notes during play.
// Plot tracking per-session ('advanced' vs 'stalled') is how Lazy DMs stay organized across
// sessions without heavy bookkeeping.
// The post-session recap with "loose ends" is critical for this archetype.

setupTestEnvironment();

let createCampaignStore: CreateCampaignStoreFn;

beforeAll(async () => {
    const mod = await import('../services/campaignService');
    createCampaignStore = mod.createCampaignStore;
});

describe('Diana the Lazy DM: Minimal prep, go live, improvise mid-session', () => {

    function setupLazyDmCampaign() {
        const service = createCampaignStore({ persist: false });
        service.init();
        service.prepareNewCampaign();
        service.createCampaign(
            'Curse of the Hollow Wood',
            'A rural farming region where an ancient forest is slowly expanding, swallowing farmsteads.',
            'custom'
        );
        const campaign = () => service.getState().campaigns[0];
        return { service, campaign };
    }

    describe('Phase 0: Setup -- pre-create adventure and plot', () => {
        it('creates campaign with adventure and plot ready for session prep', () => {
            const { service, campaign } = setupLazyDmCampaign();

            const adventureId = service.createFullAdventure({
                title: 'The Hollow Beckons',
                hook: 'Three farmsteads have vanished overnight, swallowed by the expanding treeline.',
                theme: 'horror, investigation, survival',
                level: 3,
                scenes: [
                    {
                        title: 'The Missing Farmstead',
                        type: 'exploration',
                        status: 'planned',
                        readAloudText: 'Where the Greyfield farm once stood, there is only forest.',
                        gmNotes: 'Players can investigate for clues.',
                        skillChecks: [
                            { id: 'sc-1', skill: 'Nature', dc: 13, description: 'Determine the age of the trees.' },
                            { id: 'sc-2', skill: 'Survival', dc: 12, description: 'Track footprints into the wood.' }
                        ],
                        rewards: 'Clue: a trail leading to the heart of the Hollow Wood.',
                        npcIds: [],
                        locationId: undefined,
                    },
                    {
                        title: "The Druid's Warning",
                        type: 'social',
                        status: 'planned',
                        readAloudText: 'A figure steps from behind a mossy boulder.',
                        gmNotes: 'The druid Elara knows the forest is being commanded by a corrupted treant.',
                        skillChecks: [
                            { id: 'sc-3', skill: 'Persuasion', dc: 14, description: 'Convince Elara the party means no harm.' }
                        ],
                        rewards: "Elara provides a charm of bark.",
                        npcIds: [],
                        locationId: undefined,
                    },
                    {
                        title: 'Heart of the Hollow',
                        type: 'combat',
                        status: 'planned',
                        readAloudText: 'The trees part to reveal a clearing dominated by a massive oak.',
                        gmNotes: 'Corrupted Treant fight.',
                        skillChecks: [],
                        rewards: 'The corruption crystal.',
                        npcIds: [],
                        locationId: undefined,
                    }
                ]
            });

            const plotId = service.createPlot({
                title: 'The Expanding Forest',
                description: 'The Hollow Wood is growing, consuming farmland.',
                status: 'active',
                relatedEntityIds: [],
            });

            const adv = campaign().adventures.find(a => a.id === adventureId)!;
            expect(adv.scenes).toHaveLength(3);
            expect(campaign().plots.find(p => p.id === plotId)).toBeDefined();
        });
    });

    describe('Full workflow: Prep -> Go Live -> Improvise -> End', () => {
        it('runs the complete Lazy DM session lifecycle', () => {
            const { service, campaign } = setupLazyDmCampaign();

            // Pre-create adventure
            const adventureId = service.createFullAdventure({
                title: 'The Hollow Beckons',
                hook: 'Three farmsteads have vanished.',
                theme: 'horror, investigation, survival',
                level: 3,
                scenes: [
                    {
                        title: 'The Missing Farmstead',
                        type: 'exploration', status: 'planned',
                        readAloudText: 'Only forest remains.',
                        gmNotes: 'Players investigate.',
                        skillChecks: [
                            { id: 'sc-1', skill: 'Nature', dc: 13, description: 'Determine tree age.' },
                            { id: 'sc-2', skill: 'Survival', dc: 12, description: 'Track footprints.' }
                        ],
                        rewards: 'Trail clue.', npcIds: [], locationId: undefined,
                    },
                    {
                        title: "The Druid's Warning",
                        type: 'social', status: 'planned',
                        readAloudText: 'An old woman draped in vines.',
                        gmNotes: 'Elara knows about the treant.',
                        skillChecks: [
                            { id: 'sc-3', skill: 'Persuasion', dc: 14, description: 'Convince Elara.' }
                        ],
                        rewards: 'Bark charm.', npcIds: [], locationId: undefined,
                    },
                    {
                        title: 'Heart of the Hollow',
                        type: 'combat', status: 'planned',
                        readAloudText: 'A massive oak with a twisted face.',
                        gmNotes: 'Corrupted Treant fight.',
                        skillChecks: [],
                        rewards: 'Corruption crystal.', npcIds: [], locationId: undefined,
                    }
                ]
            });

            const adv = campaign().adventures.find(a => a.id === adventureId)!;
            const [scene1Id, scene2Id, scene3Id] = adv.scenes.map(s => s.id);

            const plotId = service.createPlot({
                title: 'The Expanding Forest',
                description: 'The Hollow Wood is growing.',
                status: 'active',
                relatedEntityIds: [],
            });

            // Phase 1: 45-minute prep -- create session log
            const sessionId = service.createSessionLog({
                title: 'Session 7: Into the Hollow',
                status: 'planned',
                sessionDate: '2026-03-20T19:00:00.000Z',
                adventureId: adventureId,
                plannedSceneIds: [scene1Id, scene2Id, scene3Id],
                prepNotes: 'Secrets: Elara planted the corruption crystal. Clues: Bark samples contain transmutation magic.',
                relatedPlotIds: [plotId],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
            });

            // Phase 1 assertions
            const session = () => campaign().sessionLogs.find(s => s.id === sessionId)!;
            expect(session().status).toBe('planned');
            expect(session().adventureId).toBe(adventureId);
            expect(session().plannedSceneIds).toHaveLength(3);
            expect(session().relatedPlotIds).toContain(plotId);

            // Phase 2: Go live
            service.goLive(sessionId);

            expect(session().status).toBe('active');
            expect(campaign().activeSessionId).toBe(sessionId);
            expect(campaign().activeSceneId).toBe(scene1Id);
            expect(campaign().adventures.find(a => a.id === adventureId)!.scenes[0].status).toBe('in-progress');
            expect(campaign().adventures.find(a => a.id === adventureId)!.scenes[1].status).toBe('planned');
            expect(campaign().adventures.find(a => a.id === adventureId)!.scenes[2].status).toBe('planned');

            const notesAfterGoLive = session().structuredNotes.length;
            expect(notesAfterGoLive).toBeGreaterThan(0);

            // Phase 3: Run scene 1 -- add notes and advance
            service.addSessionRunnerNote(
                'Players found the doll and immediately suspected fey involvement.',
                [],
                'manual',
                ['Exploration']
            );

            service.addSessionRunnerNote(
                'Nature check succeeded -- players now know the growth is magical.',
                [plotId],
                'manual',
                ['Discovery']
            );

            service.advanceScene();

            const advScenes = campaign().adventures.find(a => a.id === adventureId)!.scenes;
            expect(advScenes[0].status).toBe('completed');
            expect(advScenes[1].status).toBe('in-progress');
            expect(campaign().activeSceneId).toBe(scene2Id);

            // Session start note + 2 manual notes + 1 scene-transition note = at least 4
            expect(session().structuredNotes.length).toBeGreaterThanOrEqual(4);
            const sceneTransitionNote = session().structuredNotes.find(n => n.type === 'scene-transition');
            expect(sceneTransitionNote).toBeDefined();

            // Phase 4: Mid-session improvisation -- create NPC on the fly
            const tomasId = service.createNpc({
                name: 'Old Tomas Greyfield',
                description: 'A weathered farmer in his seventies.',
                traits: 'Repeats himself when stressed.',
                backstory: 'Owned the Greyfield farm for 40 years.',
                motivations: 'Save his granddaughter Lira.',
                secrets: 'Tomas saw Elara at the edge of the forest.',
                stats: 'Use Commoner stat block.',
                exampleQuote: '"The trees came alive, I tell you."',
                factionId: undefined,
                knowsPlayerHistory: [],
                relationships: [],
                history: [],
            });

            service.addAutoEvent('npc-created', 'Improvised NPC: Old Tomas Greyfield, farmer who escaped the Hollow Wood expansion');

            service.addSessionRunnerNote(
                'Players convinced Tomas to guide them. Great RP moment.',
                [tomasId],
                'manual',
                ['Social', 'RP Highlight']
            );

            expect(campaign().npcs.find(n => n.id === tomasId)).toBeDefined();
            const npcCreatedNote = session().structuredNotes.find(n => n.type === 'npc-created');
            expect(npcCreatedNote).toBeDefined();
            const tomasNote = session().structuredNotes.find(n => n.taggedEntityIds?.includes(tomasId));
            expect(tomasNote).toBeDefined();

            // Phase 5: Advance to final scene, track plot progression
            service.advanceScene();

            const advScenes2 = campaign().adventures.find(a => a.id === adventureId)!.scenes;
            expect(advScenes2[1].status).toBe('completed');
            expect(advScenes2[2].status).toBe('in-progress');
            expect(campaign().activeSceneId).toBe(scene3Id);

            service.updatePlotProgression(plotId, 'advanced');
            expect(session().plotProgressions?.[plotId]).toBe('advanced');

            service.addSessionRunnerNote(
                'Treant fight was brutal. Players destroyed the corruption crystal.',
                [],
                'manual',
                ['Combat', 'Dramatic']
            );

            // Phase 6: End session and write recap
            service.endSession();

            expect(session().status).toBe('completed');
            expect(campaign().activeSessionId).toBeUndefined();
            expect(campaign().activeSceneId).toBeUndefined();

            // endSession does NOT auto-complete the active scene -- scene 3 remains 'in-progress'
            const finalScenes = campaign().adventures.find(a => a.id === adventureId)!.scenes;
            expect(finalScenes[0].status).toBe('completed');
            expect(finalScenes[1].status).toBe('completed');
            expect(finalScenes[2].status).toBe('in-progress');

            service.updateSessionLog(sessionId, {
                recap: 'The party investigated the vanished Greyfield farm, met the druid Elara, and fought the Corrupted Treant.',
                notableEvents: 'Fighter swore an oath to protect Lira.',
                looseEnds: "Elara's guilt and her relationship with the party.",
            });

            service.updatePlot(plotId, { status: 'resolved' });

            expect(session().recap).toContain('Corrupted Treant');
            expect(session().notableEvents).toContain('Fighter swore an oath');
            expect(session().looseEnds).toContain("Elara");
            expect(campaign().plots.find(p => p.id === plotId)!.status).toBe('resolved');
        });
    });
});
