import { describe, it, expect, beforeAll, vi } from 'vitest';
import { setupTestEnvironment, type CreateCampaignStoreFn } from './helpers/testStoreFactory';

// TTRPG Realism Notes:
// This scenario reflects how worldbuilders actually construct settings: geography first, then
// social structures (factions), then populating with NPCs, then layering on lore.
// The cycle detection test matters because worldbuilders frequently reorganize their location
// hierarchies as they discover better nesting (e.g., "wait, this district should actually be
// inside a different city").
// The NPC faction-switching test reflects a common worldbuilding scenario: a character's
// allegiance shifts during world design as the DM refines their narrative.
// Cascade deletion is critical for worldbuilders because they accumulate hundreds of entities
// and deleting one must not leave orphaned references that cause UI crashes.
// The four-level location hierarchy (Continent > City > District > Building) is the typical
// depth a prep-heavy DM creates.

setupTestEnvironment();

let createCampaignStore: CreateCampaignStoreFn;

beforeAll(async () => {
    const mod = await import('../services/campaignService');
    createCampaignStore = mod.createCampaignStore;
});

describe('Marcus the Worldbuilder: Interconnected world with hierarchies and cascade deletion', () => {

    function setupWorldbuilderCampaign() {
        const service = createCampaignStore({ persist: false });
        service.init();
        service.prepareNewCampaign();
        service.createCampaign(
            'The Shattered Kingdoms',
            'A dark fantasy realm where five kingdoms were sundered by a magical cataclysm called the Sundering. The survivors cling to civilization in fortified city-states surrounded by blighted wasteland.',
            'custom'
        );
        const campaign = () => service.getState().campaigns[0];
        return { service, campaign };
    }

    describe('Phase 1: Build the geographic hierarchy (Region > City > District > Building)', () => {
        it('creates a 4-level location hierarchy with correct bidirectional links', () => {
            const { service, campaign } = setupWorldbuilderCampaign();

            // Step 1: Continent-level location
            const continentId = service.createLocation({
                name: 'The Shattered Kingdoms',
                description: 'A vast continent scarred by the Sundering.',
                secrets: 'The Sundering was not a natural catastrophe.',
                subLocationIds: [],
                history: [],
            });

            // Step 2: City with parent
            const ashenmereId = service.createLocation({
                name: 'Ashenmere',
                description: 'A fortified city built around a lake of grey water.',
                secrets: 'The grey lake is not natural water.',
                parentLocationId: continentId,
                subLocationIds: [],
                history: [],
            });

            // Step 3: District with parent
            const thornmarketId = service.createLocation({
                name: 'The Thornmarket',
                description: 'A sprawling open-air bazaar.',
                secrets: 'Sits above a sealed entrance to the Undercroft.',
                parentLocationId: ashenmereId,
                subLocationIds: [],
                history: [],
                pointsOfInterest: [
                    {
                        id: 'poi-1',
                        name: 'The Whispering Fountain',
                        passivePerceptionDC: 14,
                        description: 'A crumbling stone fountain at the market center.',
                        investigationChecks: [
                            { id: 'inv-1', description: 'DC 15 Arcana check while touching the water', outcome: 'The fountain is a scrying focus.' }
                        ],
                        interactions: [
                            { id: 'int-1', description: 'Dropping a coin into the fountain', outcome: 'The water briefly clears and shows a vision.' }
                        ]
                    }
                ]
            });

            // Step 4: Building inside the district
            const tavernId = service.createLocation({
                name: 'The Rusted Compass',
                description: 'A cramped tavern with low ceilings.',
                secrets: 'Sable is a retired spy for the Crown of Ashenmere.',
                parentLocationId: thornmarketId,
                subLocationIds: [],
                history: [],
            });

            const locs = campaign().locations;
            const continent = locs.find(l => l.id === continentId)!;
            const ashenmere = locs.find(l => l.id === ashenmereId)!;
            const thornmarket = locs.find(l => l.id === thornmarketId)!;
            const tavern = locs.find(l => l.id === tavernId)!;

            // Continent is parent: should have ashenmereId in its subLocationIds
            expect(continent.subLocationIds).toContain(ashenmereId);
            expect(continent.parentLocationId).toBeUndefined();

            // Ashenmere: parent is continent, has thornmarket as child
            expect(ashenmere.parentLocationId).toBe(continentId);
            expect(ashenmere.subLocationIds).toContain(thornmarketId);

            // Thornmarket: parent is ashenmere, has tavern as child
            expect(thornmarket.parentLocationId).toBe(ashenmereId);
            expect(thornmarket.subLocationIds).toContain(tavernId);

            // Tavern: parent is thornmarket, no children
            expect(tavern.parentLocationId).toBe(thornmarketId);
            expect(tavern.subLocationIds).toHaveLength(0);
        });
    });

    describe('Phase 2: Cycle detection in location hierarchy', () => {
        it('rejects an update that would create a circular parent chain', () => {
            const { service, campaign } = setupWorldbuilderCampaign();

            const continentId = service.createLocation({
                name: 'The Shattered Kingdoms',
                description: 'Continent',
                secrets: '',
                subLocationIds: [],
                history: [],
            });

            const ashenmereId = service.createLocation({
                name: 'Ashenmere',
                description: 'City',
                secrets: '',
                parentLocationId: continentId,
                subLocationIds: [],
                history: [],
            });

            const thornmarketId = service.createLocation({
                name: 'The Thornmarket',
                description: 'District',
                secrets: '',
                parentLocationId: ashenmereId,
                subLocationIds: [],
                history: [],
            });

            const tavernId = service.createLocation({
                name: 'The Rusted Compass',
                description: 'Building',
                secrets: '',
                parentLocationId: thornmarketId,
                subLocationIds: [],
                history: [],
            });

            // Attempt to create a cycle: set continent's parent to the tavern
            service.updateLocation(continentId, { parentLocationId: tavernId });

            const locs = campaign().locations;
            const continent = locs.find(l => l.id === continentId)!;
            const tavern = locs.find(l => l.id === tavernId)!;

            // Continent's parentLocationId should remain undefined (cycle rejected)
            expect(continent.parentLocationId).toBeUndefined();
            // Tavern's subLocationIds should NOT contain continentId
            expect(tavern.subLocationIds).not.toContain(continentId);
            // Existing hierarchy intact
            expect(continent.subLocationIds).toContain(ashenmereId);
        });
    });

    describe('Phase 3: Create factions and assign NPCs (bidirectional sync)', () => {
        it('auto-syncs NPC faction assignment to the faction memberIds', () => {
            const { service, campaign } = setupWorldbuilderCampaign();

            const ashenmereId = service.createLocation({
                name: 'Ashenmere',
                description: 'City',
                secrets: '',
                subLocationIds: [],
                history: [],
            });

            const ashenCrownId = service.createFaction({
                name: 'The Ashen Crown',
                description: 'The ruling council of Ashenmere.',
                goals: 'Maintain control of Ashenmere.',
                memberIds: [],
                alignment: 'Lawful Neutral',
                resources: '200 soldiers',
                influence: 'Absolute authority within Ashenmere walls.',
                headquartersLocationId: ashenmereId,
            });

            const aldricId = service.createNpc({
                name: 'Councillor Aldric Valdris',
                description: 'A gaunt man in his sixties.',
                traits: 'Speaks slowly and deliberately.',
                backstory: 'Third son of a minor house.',
                motivations: 'Monopolize the grey lake.',
                secrets: 'Aldric has already been drinking the grey lake water.',
                stats: 'Use Noble stat block.',
                exampleQuote: '"Patience is the deadliest weapon."',
                factionId: ashenCrownId,
                knowsPlayerHistory: [],
                relationships: [],
                history: [],
            });

            const seraId = service.createNpc({
                name: 'Captain Sera Vex',
                description: 'A stocky woman with close-cropped red hair.',
                traits: 'Cracks her knuckles before speaking.',
                backstory: 'Rose through the ranks of the Ashenmere guard.',
                motivations: 'Protect the citizens of Ashenmere.',
                secrets: 'Sera has been secretly training a militia.',
                stats: 'Use Knight stat block.',
                exampleQuote: '"Politics is just violence with better manners."',
                factionId: ashenCrownId,
                knowsPlayerHistory: [],
                relationships: [],
                history: [],
            });

            const ashenCrown = campaign().factions.find(f => f.id === ashenCrownId)!;
            expect(ashenCrown.memberIds).toContain(aldricId);
            expect(ashenCrown.memberIds).toContain(seraId);
            expect(campaign().npcs.find(n => n.id === aldricId)!.factionId).toBe(ashenCrownId);
            expect(campaign().npcs.find(n => n.id === seraId)!.factionId).toBe(ashenCrownId);
            expect(ashenCrown.headquartersLocationId).toBe(ashenmereId);
        });
    });

    describe('Phase 4: Move an NPC between factions', () => {
        it('updates both old and new faction memberIds when NPC switches factions', () => {
            const { service, campaign } = setupWorldbuilderCampaign();

            const ashenCrownId = service.createFaction({
                name: 'The Ashen Crown',
                description: 'The ruling council.',
                goals: 'Control Ashenmere.',
                memberIds: [],
                alignment: 'Lawful Neutral',
                resources: '200 soldiers',
                influence: 'Absolute authority.',
            });

            const syndicateId = service.createFaction({
                name: 'The Undercroft Syndicate',
                description: 'A criminal network.',
                goals: 'Control the black market.',
                memberIds: [],
                alignment: 'Chaotic Neutral',
                resources: 'Network of informants',
                influence: 'Controls the flow of illegal goods.',
            });

            const aldricId = service.createNpc({
                name: 'Councillor Aldric Valdris',
                description: 'A gaunt man.',
                traits: '',
                backstory: '',
                motivations: '',
                secrets: '',
                stats: '',
                exampleQuote: '',
                factionId: ashenCrownId,
                knowsPlayerHistory: [],
                relationships: [],
                history: [],
            });

            const seraId = service.createNpc({
                name: 'Captain Sera Vex',
                description: 'A stocky woman.',
                traits: '',
                backstory: '',
                motivations: '',
                secrets: '',
                stats: '',
                exampleQuote: '',
                factionId: ashenCrownId,
                knowsPlayerHistory: [],
                relationships: [],
                history: [],
            });

            // Sera defects to the Syndicate
            service.updateNpc(seraId, { factionId: syndicateId });

            const ashenCrown = campaign().factions.find(f => f.id === ashenCrownId)!;
            const syndicate = campaign().factions.find(f => f.id === syndicateId)!;
            const sera = campaign().npcs.find(n => n.id === seraId)!;

            expect(sera.factionId).toBe(syndicateId);
            expect(ashenCrown.memberIds).not.toContain(seraId);
            expect(ashenCrown.memberIds).toContain(aldricId);
            expect(syndicate.memberIds).toContain(seraId);
        });
    });

    describe('Phase 5: Build lore article hierarchy', () => {
        it('auto-syncs parent article subArticleIds when child article is created', () => {
            const { service, campaign } = setupWorldbuilderCampaign();

            const aldricId = service.createNpc({
                name: 'Councillor Aldric Valdris',
                description: 'A gaunt man.',
                traits: '', backstory: '', motivations: '', secrets: '', stats: '',
                exampleQuote: '', factionId: undefined, knowsPlayerHistory: [], relationships: [], history: [],
            });

            const sunderingArticleId = service.createArticle({
                title: 'The Sundering',
                category: 'history',
                content: 'The Sundering occurred 300 years ago.',
                subArticleIds: [],
                relatedEntityIds: [],
            });

            const velorathArticleId = service.createArticle({
                title: 'Archmage Velorath',
                category: 'lore',
                content: 'Velorath was the most powerful wizard of the Third Age.',
                parentArticleId: sunderingArticleId,
                subArticleIds: [],
                relatedEntityIds: [aldricId],
            });

            const sundering = campaign().articles.find(a => a.id === sunderingArticleId)!;
            const velorath = campaign().articles.find(a => a.id === velorathArticleId)!;

            expect(sundering.subArticleIds).toContain(velorathArticleId);
            expect(velorath.parentArticleId).toBe(sunderingArticleId);
            expect(velorath.relatedEntityIds).toContain(aldricId);
        });
    });

    describe('Phase 6: Cascade deletion -- delete an NPC and verify cleanup', () => {
        it('removing an NPC cleans up faction memberIds, scene npcIds, and article relatedEntityIds', () => {
            const { service, campaign } = setupWorldbuilderCampaign();

            const ashenmereId = service.createLocation({
                name: 'Ashenmere', description: 'City', secrets: '', subLocationIds: [], history: [],
            });

            const ashenCrownId = service.createFaction({
                name: 'The Ashen Crown', description: '', goals: '', memberIds: [],
                alignment: 'Lawful Neutral', resources: '', influence: '',
            });

            const aldricId = service.createNpc({
                name: 'Councillor Aldric Valdris', description: 'A gaunt man.',
                traits: '', backstory: '', motivations: '', secrets: '', stats: '',
                exampleQuote: '', factionId: ashenCrownId, knowsPlayerHistory: [], relationships: [], history: [],
            });

            const seraId = service.createNpc({
                name: 'Captain Sera Vex', description: 'A stocky woman.',
                traits: '', backstory: '', motivations: '', secrets: '', stats: '',
                exampleQuote: '', factionId: ashenCrownId, knowsPlayerHistory: [], relationships: [], history: [],
            });

            // Create an article referencing Aldric
            service.createArticle({
                title: 'Archmage Velorath',
                category: 'lore',
                content: 'Velorath triggered the Sundering.',
                subArticleIds: [],
                relatedEntityIds: [aldricId],
            });

            // Create an adventure with a scene that references both Aldric and Sera
            const adventureId = service.createFullAdventure({
                title: 'The Grey Prophecy',
                hook: 'Grey lake visions are driving citizens mad.',
                theme: 'mystery, horror, political intrigue',
                level: 5,
                scenes: [
                    {
                        title: 'Audience with the Council',
                        type: 'social',
                        status: 'planned',
                        readAloudText: 'The council chamber is a vast stone hall.',
                        gmNotes: 'Aldric will try to hire the party privately.',
                        skillChecks: [],
                        rewards: '50gp advance payment.',
                        npcIds: [aldricId, seraId],
                        locationId: ashenmereId,
                    }
                ]
            });

            // Delete Aldric
            service.deleteNpc(aldricId);

            const c = campaign();
            expect(c.npcs.find(n => n.id === aldricId)).toBeUndefined();
            expect(c.factions.find(f => f.id === ashenCrownId)!.memberIds).not.toContain(aldricId);

            // Scene npcIds cleaned
            const adventure = c.adventures.find(a => a.id === adventureId)!;
            expect(adventure.scenes[0].npcIds).not.toContain(aldricId);
            expect(adventure.scenes[0].npcIds).toContain(seraId);

            // Article relatedEntityIds cleaned
            const article = c.articles.find(a => a.title === 'Archmage Velorath')!;
            expect(article.relatedEntityIds).not.toContain(aldricId);
        });
    });

    describe('Phase 7: Delete a location and verify hierarchy cleanup', () => {
        it('deleting a location un-parents its children and removes it from parent subLocationIds', () => {
            const { service, campaign } = setupWorldbuilderCampaign();

            const continentId = service.createLocation({
                name: 'The Shattered Kingdoms', description: 'Continent', secrets: '',
                subLocationIds: [], history: [],
            });

            const ashenmereId = service.createLocation({
                name: 'Ashenmere', description: 'City', secrets: '',
                parentLocationId: continentId, subLocationIds: [], history: [],
            });

            const thornmarketId = service.createLocation({
                name: 'The Thornmarket', description: 'District', secrets: '',
                parentLocationId: ashenmereId, subLocationIds: [], history: [],
            });

            const tavernId = service.createLocation({
                name: 'The Rusted Compass', description: 'Tavern', secrets: '',
                parentLocationId: thornmarketId, subLocationIds: [], history: [],
            });

            // Create an adventure with a scene linked to ashenmere (not thornmarket)
            const adventureId = service.createFullAdventure({
                title: 'The Grey Prophecy',
                hook: 'Mystery',
                theme: 'horror',
                level: 5,
                scenes: [{
                    title: 'Audience with the Council',
                    type: 'social',
                    status: 'planned',
                    readAloudText: '',
                    gmNotes: '',
                    skillChecks: [],
                    rewards: '',
                    npcIds: [],
                    locationId: ashenmereId,
                }]
            });

            // Delete the Thornmarket district
            service.deleteLocation(thornmarketId);

            const locs = campaign().locations;

            // Thornmarket is gone
            expect(locs.find(l => l.id === thornmarketId)).toBeUndefined();

            // Ashenmere's subLocationIds no longer contains thornmarketId
            const ashenmere = locs.find(l => l.id === ashenmereId)!;
            expect(ashenmere.subLocationIds).not.toContain(thornmarketId);

            // Tavern's parentLocationId is now undefined (orphaned, not deleted)
            const tavern = locs.find(l => l.id === tavernId)!;
            expect(tavern).toBeDefined();
            expect(tavern.parentLocationId).toBeUndefined();

            // Adventure scene locationId (pointing at ashenmere) is unaffected
            const adventure = campaign().adventures.find(a => a.id === adventureId)!;
            expect(adventure.scenes[0].locationId).toBe(ashenmereId);
        });
    });
});
