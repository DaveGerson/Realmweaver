import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestEnvironment, type CreateCampaignStoreFn } from './helpers/testStoreFactory';

// TTRPG Realism Notes:
// Running multiple campaigns simultaneously is the defining characteristic of the Forever DM.
// The test verifies complete data isolation between campaigns -- mixing up NPCs or plot threads
// between campaigns is a real burnout-inducing error.
// The "write recap offline" workflow reflects how veteran DMs often work: they run the session
// at the table with physical notes and enter the recap into their digital tool afterward.
// Plot status transitions (active -> dormant -> active -> resolved) mirror how long-running
// campaigns actually work. Plots go dormant when players pursue other threads.
// The quick note for between-session ideas is a classic Forever DM workflow.
// Plot thread counts matter: a Forever DM typically juggles 3-5 active plot threads per campaign.
// The session recap fields (recap, notableEvents, looseEnds) are used distinctly:
//   recap = what happened, notableEvents = what was memorable, looseEnds = what to remember.

setupTestEnvironment();

let createCampaignStore: CreateCampaignStoreFn;

beforeAll(async () => {
    const mod = await import('../services/campaignService');
    createCampaignStore = mod.createCampaignStore;
});

describe('Evelyn the Forever DM: Manage two campaigns simultaneously with full isolation', () => {

    function setupForeverDmStore() {
        const service = createCampaignStore({ persist: false });
        service.init();
        return service;
    }

    describe('Phase 1: Create two campaigns', () => {
        it('creates two separate campaigns, second one is automatically active', () => {
            const service = setupForeverDmStore();

            service.prepareNewCampaign();
            service.createCampaign(
                'Tides of the Obsidian Sea',
                'A nautical campaign set on an endless ocean dotted with volcanic islands.',
                'custom'
            );
            const campaign1Id = service.getState().activeCampaignId!;
            expect(campaign1Id).toBeTruthy();

            service.prepareNewCampaign();
            service.createCampaign(
                'The Silver Accord',
                'A political intrigue campaign in a city-state where five noble houses compete.',
                'custom'
            );
            const campaign2Id = service.getState().activeCampaignId!;

            expect(service.getState().campaigns).toHaveLength(2);
            expect(campaign1Id).not.toBe(campaign2Id);

            const c1 = service.getState().campaigns.find(c => c.id === campaign1Id)!;
            const c2 = service.getState().campaigns.find(c => c.id === campaign2Id)!;
            expect(c1.title).toBe('Tides of the Obsidian Sea');
            expect(c2.title).toBe('The Silver Accord');

            // Most recently created campaign is active
            expect(service.getState().activeCampaignId).toBe(campaign2Id);
        });
    });

    describe('Full multi-campaign workflow with isolation', () => {
        it('tracks entities across two campaigns with zero cross-contamination', () => {
            const service = setupForeverDmStore();

            // Create Campaign 1
            service.prepareNewCampaign();
            service.createCampaign(
                'Tides of the Obsidian Sea',
                'A nautical campaign set on an endless ocean dotted with volcanic islands.',
                'custom'
            );
            const campaign1Id = service.getState().activeCampaignId!;

            // Create Campaign 2 (becomes active)
            service.prepareNewCampaign();
            service.createCampaign(
                'The Silver Accord',
                'A political intrigue campaign in a city-state where five noble houses compete.',
                'custom'
            );
            const campaign2Id = service.getState().activeCampaignId!;

            const getC1 = () => service.getState().campaigns.find(c => c.id === campaign1Id)!;
            const getC2 = () => service.getState().campaigns.find(c => c.id === campaign2Id)!;

            // Phase 2: Populate Campaign 2 (currently active)
            const mirabelId = service.createNpc({
                name: 'Duchess Mirabel Ashford',
                description: 'An elegant woman in her fifties with silver-streaked auburn hair.',
                traits: 'Pauses before responding. Touches her signet ring when lying.',
                backstory: 'Head of House Ashford. Built her fortune through maritime trade.',
                motivations: "Acquire the Silver Accord artifact to cement House Ashford's dominance.",
                secrets: 'Mirabel has already located the artifact but needs a key.',
                stats: 'Use Noble stat block. Charisma 18.',
                exampleQuote: '"Power is not seized, darling. It is cultivated."',
                knowsPlayerHistory: [],
                relationships: [],
                history: [],
            });

            const plot2Id = service.createPlot({
                title: 'The Silver Accord',
                description: "Five noble houses seek control of the Silver Accord artifact.",
                status: 'active',
                relatedEntityIds: [mirabelId],
            });

            const session2Id = service.createSessionLog({
                title: 'Session 4: The Ashford Gala',
                status: 'planned',
                sessionDate: '2026-03-15T19:00:00.000Z',
                prepNotes: 'Mirabel hosts a gala. The key is hidden in the Ashford vault.',
                relatedPlotIds: [plot2Id],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
                adventureId: undefined,
                plannedSceneIds: [],
            });

            // Write recap directly (offline session)
            service.updateSessionLog(session2Id, {
                status: 'completed',
                recap: "The party attended the Ashford Gala. A tense negotiation with Mirabel's spymaster followed.",
                notableEvents: "Rogue nearly got caught in the vault. Mirabel revealed her estranged daughter is the key.",
                looseEnds: "House Valdric doesn't know they're being targeted. Mirabel's daughter is missing.",
            });

            // Phase 2 assertions
            expect(getC2().npcs).toHaveLength(1);
            expect(getC2().npcs[0].id).toBe(mirabelId);
            expect(getC2().plots).toHaveLength(1);
            expect(getC2().sessionLogs).toHaveLength(1);
            expect(getC2().sessionLogs[0].status).toBe('completed');
            expect(getC2().plots[0].status).toBe('active');
            // Campaign 1 is unaffected
            expect(getC1().npcs).toHaveLength(0);
            expect(getC1().plots).toHaveLength(0);
            expect(getC1().sessionLogs).toHaveLength(0);

            // Phase 3: Switch to Campaign 1
            service.selectCampaign(campaign1Id);

            expect(service.getState().activeCampaignId).toBe(campaign1Id);
            expect(service.getState().appStatus).toBe('editing');

            const rheaId = service.createNpc({
                name: 'Captain Rhea Stormborn',
                description: "A sun-darkened woman with salt-crusted dreadlocks.",
                traits: 'Speaks in nautical metaphors constantly.',
                backstory: 'Former navy officer who turned pirate.',
                motivations: 'Find the Obsidian Compass.',
                secrets: "Rhea is dying of a slow magical curse. She has maybe six months left.",
                stats: 'Use Bandit Captain stat block.',
                exampleQuote: '"The sea doesn\'t care about your plans, love."',
                knowsPlayerHistory: [],
                relationships: [],
                history: [],
            });

            const plot1aId = service.createPlot({
                title: 'The Obsidian Compass',
                description: 'A legendary navigational artifact hidden in the Obsidian Sea.',
                status: 'active',
                relatedEntityIds: [rheaId],
            });

            const plot1bId = service.createPlot({
                title: 'The Kraken Cult',
                description: 'A cult worshipping an ancient kraken is sabotaging ships.',
                status: 'active',
                relatedEntityIds: [],
            });

            const session1Id = service.createSessionLog({
                title: "Session 8: Stormborn's Bargain",
                status: 'planned',
                sessionDate: '2026-03-18T19:00:00.000Z',
                prepNotes: "Rhea offers to share the Obsidian Compass location if the party helps raid a Kraken Cult outpost.",
                relatedPlotIds: [plot1aId, plot1bId],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
                adventureId: undefined,
                plannedSceneIds: [],
            });

            // Run a quick session
            service.goLive(session1Id);

            service.addSessionRunnerNote(
                'Party agreed to help Rhea. Sailed to the Kraken Cult outpost on the Isle of Teeth.',
                [rheaId],
                'manual',
                ['Exploration']
            );

            service.addSessionRunnerNote(
                'Infiltrated the cult outpost. Found evidence the cult is summoning the kraken.',
                [plot1bId],
                'manual',
                ['Discovery']
            );

            service.updatePlotProgression(plot1aId, 'unchanged');
            service.updatePlotProgression(plot1bId, 'advanced');

            service.endSession();

            service.updateSessionLog(session1Id, {
                recap: "The party allied with Captain Rhea and raided the Kraken Cult outpost on the Isle of Teeth.",
                notableEvents: "Warlock made a pact-related discovery at the cult shrine.",
                looseEnds: "Kraken summoning timeline unclear. Rhea's curse is worsening.",
            });

            service.updatePlot(plot1bId, {
                status: 'active',
                description: 'A cult worshipping an ancient kraken. Their base was on the Isle of Teeth. Planning to summon the kraken to the Deepwater Trench.'
            });

            const plot1cId = service.createPlot({
                title: "Rhea's Curse",
                description: "Captain Rhea Stormborn is dying from a sea hag's curse.",
                status: 'dormant',
                relatedEntityIds: [rheaId],
            });

            // Phase 3b assertions
            expect(getC1().npcs).toHaveLength(1);
            expect(getC1().npcs[0].id).toBe(rheaId);
            expect(getC1().plots).toHaveLength(3);
            expect(getC1().sessionLogs).toHaveLength(1);
            expect(getC1().sessionLogs[0].status).toBe('completed');
            expect(getC1().sessionLogs[0].recap).toContain('Isle of Teeth');

            const compassPlot = getC1().plots.find(p => p.id === plot1aId)!;
            const krakenPlot = getC1().plots.find(p => p.id === plot1bId)!;
            const cursePlot = getC1().plots.find(p => p.id === plot1cId)!;

            expect(compassPlot.status).toBe('active');
            expect(krakenPlot.status).toBe('active');
            expect(krakenPlot.description).toContain('Deepwater Trench');
            expect(cursePlot.status).toBe('dormant');

            // Campaign 2 completely unaffected
            expect(getC2().npcs).toHaveLength(1);
            expect(getC2().npcs[0].name).toBe('Duchess Mirabel Ashford');
            expect(getC2().plots).toHaveLength(1);

            // Phase 4: Switch back to Campaign 2
            service.selectCampaign(campaign2Id);

            expect(service.getState().activeCampaignId).toBe(campaign2Id);
            expect(getC2().npcs).toHaveLength(1);
            expect(getC2().npcs[0].id).toBe(mirabelId);
            expect(getC2().npcs[0].name).toBe('Duchess Mirabel Ashford');
            // Rhea is NOT in Campaign 2
            expect(getC2().npcs.find(n => n.name === 'Captain Rhea Stormborn')).toBeUndefined();
            expect(getC2().plots[0].status).toBe('active');

            // Phase 5: Advance Campaign 2's plot
            const session2bId = service.createSessionLog({
                title: 'Session 5: The Valdric Problem',
                status: 'planned',
                sessionDate: '2026-03-22T19:00:00.000Z',
                prepNotes: "Party must decide whether to help Mirabel or betray her.",
                relatedPlotIds: [plot2Id],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
                adventureId: undefined,
                plannedSceneIds: [],
            });

            service.updateSessionLog(session2bId, {
                status: 'completed',
                recap: "The party chose to investigate House Valdric independently. Lord Valdric is the rightful heir.",
                notableEvents: "Major plot twist: Mirabel is the usurper, not the rightful claimant.",
                looseEnds: "Mirabel's spymaster knows the party visited Valdric.",
            });

            const noteId = service.createNote({
                title: 'Plot twist idea for Silver Accord',
                content: "What if Mirabel's estranged daughter IS Lord Valdric's secret ally?",
                tags: ['Plot', 'Idea', 'Silver Accord'],
            });

            service.updatePlot(plot2Id, { status: 'dormant' });

            // Phase 5 assertions
            expect(getC2().sessionLogs).toHaveLength(2);
            expect(getC2().sessionLogs.every(s => s.status === 'completed')).toBe(true);
            expect(getC2().notes.find(n => n.id === noteId)).toBeDefined();
            expect(getC2().notes.find(n => n.id === noteId)!.tags).toEqual(['Plot', 'Idea', 'Silver Accord']);
            expect(getC2().plots.find(p => p.id === plot2Id)!.status).toBe('dormant');

            // Phase 6: Return to Campaign 1 and resolve/activate plots
            service.selectCampaign(campaign1Id);

            service.updatePlot(plot1cId, { status: 'active' });
            service.updatePlot(plot1bId, { status: 'resolved' });

            // Phase 6 assertions
            expect(getC1().plots.find(p => p.id === plot1aId)!.status).toBe('active');
            expect(getC1().plots.find(p => p.id === plot1bId)!.status).toBe('resolved');
            expect(getC1().plots.find(p => p.id === plot1cId)!.status).toBe('active');

            const activePlots1 = getC1().plots.filter(p => p.status === 'active');
            expect(activePlots1).toHaveLength(2);

            // Campaign 2 plot still dormant, not affected
            expect(getC2().plots.find(p => p.id === plot2Id)!.status).toBe('dormant');

            // Phase 7: Final state integrity
            const finalState = service.getState();
            expect(finalState.campaigns).toHaveLength(2);

            const finalC1 = finalState.campaigns.find(c => c.id === campaign1Id)!;
            const finalC2 = finalState.campaigns.find(c => c.id === campaign2Id)!;

            // Campaign 1 final state
            expect(finalC1.npcs).toHaveLength(1);
            expect(finalC1.npcs[0].name).toBe('Captain Rhea Stormborn');
            expect(finalC1.plots).toHaveLength(3);
            expect(finalC1.sessionLogs).toHaveLength(1);
            expect(finalC1.factions).toHaveLength(0);
            expect(finalC1.locations).toHaveLength(0);
            expect(finalC1.adventures).toHaveLength(0);
            expect(finalC1.articles).toHaveLength(0);
            expect(finalC1.items).toHaveLength(0);

            // Campaign 2 final state
            expect(finalC2.npcs).toHaveLength(1);
            expect(finalC2.npcs[0].name).toBe('Duchess Mirabel Ashford');
            expect(finalC2.plots).toHaveLength(1);
            expect(finalC2.sessionLogs).toHaveLength(2);
            expect(finalC2.notes).toHaveLength(1);
            expect(finalC2.factions).toHaveLength(0);
            expect(finalC2.locations).toHaveLength(0);
            expect(finalC2.adventures).toHaveLength(0);
            expect(finalC2.articles).toHaveLength(0);
            expect(finalC2.items).toHaveLength(0);

            // Active campaign is Campaign 1 (last selected)
            expect(finalState.activeCampaignId).toBe(campaign1Id);
        });
    });

    describe('Plot lifecycle: active -> dormant -> active -> resolved', () => {
        it('transitions plot status through the full lifecycle', () => {
            const service = setupForeverDmStore();
            service.prepareNewCampaign();
            service.createCampaign('Test Campaign', 'A test world', 'custom');

            const plotId = service.createPlot({
                title: 'The Ancient Prophecy',
                description: 'A plot that waxes and wanes across sessions.',
                status: 'active',
                relatedEntityIds: [],
            });

            const campaign = () => service.getState().campaigns[0];

            expect(campaign().plots[0].status).toBe('active');

            service.updatePlot(plotId, { status: 'dormant' });
            expect(campaign().plots[0].status).toBe('dormant');

            service.updatePlot(plotId, { status: 'active' });
            expect(campaign().plots[0].status).toBe('active');

            service.updatePlot(plotId, { status: 'resolved' });
            expect(campaign().plots[0].status).toBe('resolved');
        });
    });

    describe('Session recap created offline without goLive/endSession', () => {
        it('can set status to completed directly via updateSessionLog', () => {
            const service = setupForeverDmStore();
            service.prepareNewCampaign();
            service.createCampaign('Test Campaign', 'A test world', 'custom');

            const sessionId = service.createSessionLog({
                title: 'Session run offline',
                status: 'planned',
                sessionDate: '2026-03-15T19:00:00.000Z',
                prepNotes: '',
                relatedPlotIds: [],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
                adventureId: undefined,
                plannedSceneIds: [],
            });

            const campaign = () => service.getState().campaigns[0];
            expect(campaign().sessionLogs[0].status).toBe('planned');

            service.updateSessionLog(sessionId, {
                status: 'completed',
                recap: 'The party fought the dragon and won.',
                notableEvents: 'Rogue grabbed the egg.',
                looseEnds: 'The mother dragon is still alive.',
            });

            expect(campaign().sessionLogs[0].status).toBe('completed');
            expect(campaign().sessionLogs[0].recap).toContain('dragon');
            expect(campaign().sessionLogs[0].notableEvents).toContain('egg');
            expect(campaign().sessionLogs[0].looseEnds).toContain('mother dragon');
        });
    });
});
