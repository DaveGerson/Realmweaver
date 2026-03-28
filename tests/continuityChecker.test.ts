import { describe, it, expect } from 'vitest';
import { checkContinuity } from '../services/continuityChecker';
import type { Campaign } from '../types/Campaign';
import type { NPC } from '../types/NPC';
import type { Location } from '../types/Location';
import type { Faction } from '../types/Faction';
import type { Item } from '../types/Item';
import type { Adventure } from '../types/Adventure';
import type { Article } from '../types/Article';
import type { Plot } from '../types/Plot';
import type { SessionLog } from '../types/SessionLog';

// ---------------------------------------------------------------------------
// Helpers — entity and campaign factories
// ---------------------------------------------------------------------------

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
    return {
        id: 'c-1',
        title: 'Test Campaign',
        settingType: 'custom',
        setting: 'Test',
        npcs: [],
        locations: [],
        factions: [],
        items: [],
        adventures: [],
        articles: [],
        sessionLogs: [],
        playerCharacters: [],
        plots: [],
        notes: [],
        ...overrides,
    };
}

function makeNpc(overrides: Partial<NPC> = {}): NPC {
    return {
        id: 'npc-1', name: 'Test NPC', description: '', traits: '',
        backstory: '', motivations: '', secrets: '', stats: '',
        exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
        ...overrides,
    };
}

function makeLocation(overrides: Partial<Location> = {}): Location {
    return {
        id: 'loc-1', name: 'Test Location', description: '', secrets: '',
        subLocationIds: [], history: [],
        ...overrides,
    };
}

function makeFaction(overrides: Partial<Faction> = {}): Faction {
    return {
        id: 'fac-1', name: 'Test Faction', description: '', goals: '', memberIds: [],
        ...overrides,
    };
}

function makeItem(overrides: Partial<Item> = {}): Item {
    return {
        id: 'item-1', name: 'Test Item', description: '', rarity: 'common', properties: '',
        ...overrides,
    };
}

function makeAdventure(overrides: Partial<Adventure> = {}): Adventure {
    return {
        id: 'adv-1', title: 'Test Adventure', level: 1, hook: '', theme: '', scenes: [],
        ...overrides,
    };
}

function makeArticle(overrides: Partial<Article> = {}): Article {
    return {
        id: 'art-1', title: 'Test Article', category: 'lore', content: '', subArticleIds: [],
        ...overrides,
    };
}

function makePlot(overrides: Partial<Plot> = {}): Plot {
    return {
        id: 'plot-1', title: 'Test Plot', description: '', status: 'active', relatedEntityIds: [],
        ...overrides,
    };
}

function makeSessionLog(overrides: Partial<SessionLog> = {}): SessionLog {
    return {
        id: 'sl-1', title: 'Session 1', status: 'completed',
        sessionDate: '2026-01-15', plannedSceneIds: [], prepNotes: '',
        relatedPlotIds: [], runningNotes: '', structuredNotes: [],
        encounterLog: [], recap: '', notableEvents: '', looseEnds: '',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Clean campaign
// ---------------------------------------------------------------------------

describe('checkContinuity — clean campaign', () => {
    it('returns no issues for an empty campaign', () => {
        const issues = checkContinuity(makeCampaign());
        expect(issues).toEqual([]);
    });

    it('returns no issues for a well-formed campaign', () => {
        const campaign = makeCampaign({
            npcs: [makeNpc({ factionId: 'fac-1' })],
            factions: [makeFaction({ memberIds: ['npc-1'] })],
            locations: [makeLocation()],
            items: [makeItem()],
            adventures: [makeAdventure({
                scenes: [{
                    id: 'sc-1', title: 'Scene 1', type: 'combat', status: 'planned',
                    readAloudText: 'You enter.', gmNotes: 'Surprise round',
                    skillChecks: [], rewards: '', npcIds: ['npc-1'], locationId: 'loc-1',
                }],
            })],
            articles: [makeArticle({ relatedEntityIds: ['npc-1', 'loc-1', 'fac-1', 'item-1'] })],
        });
        const issues = checkContinuity(campaign);
        // The only issue might be orphan-related or empty-faction, but this is well-linked
        const errors = issues.filter(i => i.severity === 'error');
        expect(errors).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Rule 1: Broken references
// ---------------------------------------------------------------------------

describe('checkContinuity — broken references', () => {
    it('detects NPC referencing a deleted faction', () => {
        const campaign = makeCampaign({
            npcs: [makeNpc({ factionId: 'deleted-faction' })],
        });
        const issues = checkContinuity(campaign);
        const brokenRef = issues.find(i => i.ruleId === 'broken-ref' && i.title.includes('NPC references missing faction'));
        expect(brokenRef).toBeDefined();
        expect(brokenRef!.severity).toBe('error');
        expect(brokenRef!.entityIds).toContain('npc-1');
    });

    it('detects faction with a deleted leader', () => {
        const campaign = makeCampaign({
            factions: [makeFaction({ leaderId: 'deleted-npc' })],
        });
        const issues = checkContinuity(campaign);
        const brokenRef = issues.find(i => i.ruleId === 'broken-ref' && i.title.includes('missing leader'));
        expect(brokenRef).toBeDefined();
    });

    it('detects faction with a deleted headquarters location', () => {
        const campaign = makeCampaign({
            factions: [makeFaction({ headquartersLocationId: 'deleted-loc' })],
        });
        const issues = checkContinuity(campaign);
        const brokenRef = issues.find(i => i.ruleId === 'broken-ref' && i.title.includes('headquarters'));
        expect(brokenRef).toBeDefined();
    });

    it('detects scene referencing a deleted location', () => {
        const campaign = makeCampaign({
            adventures: [makeAdventure({
                scenes: [{
                    id: 'sc-1', title: 'Scene', type: 'combat', status: 'planned',
                    readAloudText: '', gmNotes: '', skillChecks: [], rewards: '',
                    npcIds: [], locationId: 'deleted-loc',
                }],
            })],
        });
        const issues = checkContinuity(campaign);
        const brokenRef = issues.find(i => i.ruleId === 'broken-ref' && i.title.includes('Scene references missing location'));
        expect(brokenRef).toBeDefined();
    });

    it('detects scene referencing a deleted NPC', () => {
        const campaign = makeCampaign({
            adventures: [makeAdventure({
                scenes: [{
                    id: 'sc-1', title: 'Scene', type: 'combat', status: 'planned',
                    readAloudText: '', gmNotes: '', skillChecks: [], rewards: '',
                    npcIds: ['deleted-npc'],
                }],
            })],
        });
        const issues = checkContinuity(campaign);
        const brokenRef = issues.find(i => i.ruleId === 'broken-ref' && i.title.includes('Scene references missing NPC'));
        expect(brokenRef).toBeDefined();
    });

    it('detects article with broken entity links', () => {
        const campaign = makeCampaign({
            articles: [makeArticle({ relatedEntityIds: ['deleted-entity'] })],
        });
        const issues = checkContinuity(campaign);
        const brokenRef = issues.find(i => i.ruleId === 'broken-ref' && i.title.includes('Article has a broken entity link'));
        expect(brokenRef).toBeDefined();
    });

    it('does not flag valid article entity links', () => {
        const campaign = makeCampaign({
            npcs: [makeNpc()],
            articles: [makeArticle({ relatedEntityIds: ['npc-1'] })],
        });
        const issues = checkContinuity(campaign);
        const brokenRef = issues.find(i => i.ruleId === 'broken-ref' && i.title.includes('Article'));
        expect(brokenRef).toBeUndefined();
    });

    it('detects location with missing controlling faction', () => {
        const campaign = makeCampaign({
            locations: [makeLocation({ controllingFactionId: 'deleted-faction' })],
        });
        const issues = checkContinuity(campaign);
        const brokenRef = issues.find(i => i.ruleId === 'broken-ref' && i.title.includes('missing controlling faction'));
        expect(brokenRef).toBeDefined();
    });

    it('does not flag valid controlling faction', () => {
        const campaign = makeCampaign({
            locations: [makeLocation({ controllingFactionId: 'fac-1' })],
            factions: [makeFaction()],
        });
        const issues = checkContinuity(campaign);
        const brokenRef = issues.find(i => i.ruleId === 'broken-ref' && i.title.includes('controlling faction'));
        expect(brokenRef).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Rule 2: Circular location hierarchy
// ---------------------------------------------------------------------------

describe('checkContinuity — circular location hierarchy', () => {
    it('detects a direct self-referencing parent', () => {
        const campaign = makeCampaign({
            locations: [makeLocation({ id: 'loc-1', parentLocationId: 'loc-1' })],
        });
        const issues = checkContinuity(campaign);
        const circular = issues.find(i => i.ruleId === 'circular-location');
        expect(circular).toBeDefined();
        expect(circular!.severity).toBe('error');
    });

    it('detects a two-node cycle', () => {
        const campaign = makeCampaign({
            locations: [
                makeLocation({ id: 'loc-1', name: 'A', parentLocationId: 'loc-2' }),
                makeLocation({ id: 'loc-2', name: 'B', parentLocationId: 'loc-1' }),
            ],
        });
        const issues = checkContinuity(campaign);
        const circular = issues.filter(i => i.ruleId === 'circular-location');
        expect(circular.length).toBeGreaterThanOrEqual(1);
    });

    it('detects a three-node cycle', () => {
        const campaign = makeCampaign({
            locations: [
                makeLocation({ id: 'loc-1', name: 'A', parentLocationId: 'loc-2' }),
                makeLocation({ id: 'loc-2', name: 'B', parentLocationId: 'loc-3' }),
                makeLocation({ id: 'loc-3', name: 'C', parentLocationId: 'loc-1' }),
            ],
        });
        const issues = checkContinuity(campaign);
        const circular = issues.filter(i => i.ruleId === 'circular-location');
        expect(circular.length).toBeGreaterThanOrEqual(1);
    });

    it('does not flag a valid parent chain', () => {
        const campaign = makeCampaign({
            locations: [
                makeLocation({ id: 'loc-1', name: 'Region' }),
                makeLocation({ id: 'loc-2', name: 'City', parentLocationId: 'loc-1' }),
                makeLocation({ id: 'loc-3', name: 'District', parentLocationId: 'loc-2' }),
            ],
        });
        const issues = checkContinuity(campaign);
        const circular = issues.filter(i => i.ruleId === 'circular-location');
        expect(circular).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Rule 3: Orphaned entities
// ---------------------------------------------------------------------------

describe('checkContinuity — orphaned entities', () => {
    it('detects an orphaned NPC (no references anywhere)', () => {
        const campaign = makeCampaign({
            npcs: [makeNpc()],
        });
        const issues = checkContinuity(campaign);
        const orphan = issues.find(i => i.ruleId === 'orphan' && i.title === 'Orphaned NPC');
        expect(orphan).toBeDefined();
        expect(orphan!.severity).toBe('info');
    });

    it('does not flag NPC that belongs to a faction', () => {
        const campaign = makeCampaign({
            npcs: [makeNpc({ factionId: 'fac-1' })],
            factions: [makeFaction({ memberIds: ['npc-1'] })],
        });
        const issues = checkContinuity(campaign);
        const orphan = issues.find(i => i.ruleId === 'orphan' && i.title === 'Orphaned NPC');
        expect(orphan).toBeUndefined();
    });

    it('does not flag NPC referenced in a scene', () => {
        const campaign = makeCampaign({
            npcs: [makeNpc()],
            adventures: [makeAdventure({
                scenes: [{
                    id: 'sc-1', title: 'Scene', type: 'combat', status: 'planned',
                    readAloudText: '', gmNotes: '', skillChecks: [], rewards: '',
                    npcIds: ['npc-1'],
                }],
            })],
        });
        const issues = checkContinuity(campaign);
        const orphan = issues.find(i => i.ruleId === 'orphan' && i.title === 'Orphaned NPC');
        expect(orphan).toBeUndefined();
    });

    it('does not flag NPC referenced in another NPC relationship', () => {
        const campaign = makeCampaign({
            npcs: [
                makeNpc({ id: 'npc-1' }),
                makeNpc({
                    id: 'npc-2', name: 'Other',
                    relationships: [{ id: 'r1', targetId: 'npc-1', relationType: 'Ally', description: '' }],
                }),
            ],
        });
        const issues = checkContinuity(campaign);
        const orphan = issues.find(i => i.ruleId === 'orphan' && i.entityIds.includes('npc-1'));
        expect(orphan).toBeUndefined();
    });

    it('detects an orphaned location', () => {
        const campaign = makeCampaign({
            locations: [makeLocation()],
        });
        const issues = checkContinuity(campaign);
        const orphan = issues.find(i => i.ruleId === 'orphan' && i.title === 'Orphaned location');
        expect(orphan).toBeDefined();
    });

    it('does not flag location with a parent', () => {
        const campaign = makeCampaign({
            locations: [
                makeLocation({ id: 'loc-1' }),
                makeLocation({ id: 'loc-2', parentLocationId: 'loc-1' }),
            ],
        });
        const issues = checkContinuity(campaign);
        // loc-2 has a parent so it's not orphaned
        const orphan = issues.find(i => i.ruleId === 'orphan' && i.entityIds.includes('loc-2'));
        expect(orphan).toBeUndefined();
    });

    it('detects an orphaned item', () => {
        const campaign = makeCampaign({
            items: [makeItem()],
        });
        const issues = checkContinuity(campaign);
        const orphan = issues.find(i => i.ruleId === 'orphan' && i.title === 'Orphaned item');
        expect(orphan).toBeDefined();
    });

    it('does not flag item referenced in an article', () => {
        const campaign = makeCampaign({
            items: [makeItem()],
            articles: [makeArticle({ relatedEntityIds: ['item-1'] })],
        });
        const issues = checkContinuity(campaign);
        const orphan = issues.find(i => i.ruleId === 'orphan' && i.title === 'Orphaned item');
        expect(orphan).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Rule 4: Empty factions
// ---------------------------------------------------------------------------

describe('checkContinuity — empty factions', () => {
    it('detects a faction with no members', () => {
        const campaign = makeCampaign({
            factions: [makeFaction()],
        });
        const issues = checkContinuity(campaign);
        const empty = issues.find(i => i.ruleId === 'empty-faction');
        expect(empty).toBeDefined();
        expect(empty!.severity).toBe('warning');
    });

    it('does not flag faction with memberIds', () => {
        const campaign = makeCampaign({
            factions: [makeFaction({ memberIds: ['npc-1'] })],
            npcs: [makeNpc()],
        });
        const issues = checkContinuity(campaign);
        const empty = issues.find(i => i.ruleId === 'empty-faction');
        expect(empty).toBeUndefined();
    });

    it('does not flag faction when NPCs have its factionId', () => {
        const campaign = makeCampaign({
            factions: [makeFaction()],
            npcs: [makeNpc({ factionId: 'fac-1' })],
        });
        const issues = checkContinuity(campaign);
        const empty = issues.find(i => i.ruleId === 'empty-faction');
        expect(empty).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Rule 5: Dormant active plots
// ---------------------------------------------------------------------------

describe('checkContinuity — dormant plots', () => {
    it('detects active plot not advanced in recent sessions', () => {
        const campaign = makeCampaign({
            plots: [makePlot()],
            sessionLogs: [
                makeSessionLog({ id: 'sl-1', relatedPlotIds: ['plot-1'], plotProgressions: { 'plot-1': 'stalled' } }),
                makeSessionLog({ id: 'sl-2', sessionDate: '2026-01-10', relatedPlotIds: [] }),
                makeSessionLog({ id: 'sl-3', sessionDate: '2026-01-05', relatedPlotIds: [] }),
            ],
        });
        const issues = checkContinuity(campaign);
        const dormant = issues.find(i => i.ruleId === 'dormant-plot');
        expect(dormant).toBeDefined();
        expect(dormant!.severity).toBe('warning');
    });

    it('does not flag plot that was advanced in a recent session', () => {
        const campaign = makeCampaign({
            plots: [makePlot()],
            sessionLogs: [
                makeSessionLog({
                    id: 'sl-1',
                    relatedPlotIds: ['plot-1'],
                    plotProgressions: { 'plot-1': 'advanced' },
                }),
            ],
        });
        const issues = checkContinuity(campaign);
        const dormant = issues.find(i => i.ruleId === 'dormant-plot');
        expect(dormant).toBeUndefined();
    });

    it('does not flag resolved or dormant plots', () => {
        const campaign = makeCampaign({
            plots: [
                makePlot({ id: 'p1', status: 'resolved' }),
                makePlot({ id: 'p2', status: 'dormant' }),
            ],
            sessionLogs: [],
        });
        const issues = checkContinuity(campaign);
        const dormant = issues.filter(i => i.ruleId === 'dormant-plot');
        expect(dormant).toEqual([]);
    });

    it('produces no issues when there are no active plots', () => {
        const campaign = makeCampaign({ plots: [] });
        const issues = checkContinuity(campaign);
        const dormant = issues.filter(i => i.ruleId === 'dormant-plot');
        expect(dormant).toEqual([]);
    });

    it('only considers completed sessions', () => {
        const campaign = makeCampaign({
            plots: [makePlot()],
            sessionLogs: [
                makeSessionLog({
                    id: 'sl-1',
                    status: 'planned', // not completed
                    relatedPlotIds: ['plot-1'],
                    plotProgressions: { 'plot-1': 'advanced' },
                }),
            ],
        });
        const issues = checkContinuity(campaign);
        const dormant = issues.find(i => i.ruleId === 'dormant-plot');
        // The planned session is filtered out, so the plot is still "dormant"
        expect(dormant).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// Rule 6: Scenes without content
// ---------------------------------------------------------------------------

describe('checkContinuity — scenes without content', () => {
    it('detects scene with empty readAloudText and gmNotes', () => {
        const campaign = makeCampaign({
            adventures: [makeAdventure({
                scenes: [{
                    id: 'sc-1', title: 'Empty Scene', type: 'combat', status: 'planned',
                    readAloudText: '', gmNotes: '', skillChecks: [], rewards: '', npcIds: [],
                }],
            })],
        });
        const issues = checkContinuity(campaign);
        const empty = issues.find(i => i.ruleId === 'empty-scene');
        expect(empty).toBeDefined();
        expect(empty!.severity).toBe('info');
    });

    it('detects scene with whitespace-only content', () => {
        const campaign = makeCampaign({
            adventures: [makeAdventure({
                scenes: [{
                    id: 'sc-1', title: 'WS Scene', type: 'combat', status: 'planned',
                    readAloudText: '   ', gmNotes: '\n\t', skillChecks: [], rewards: '', npcIds: [],
                }],
            })],
        });
        const issues = checkContinuity(campaign);
        const empty = issues.find(i => i.ruleId === 'empty-scene');
        expect(empty).toBeDefined();
    });

    it('does not flag scene with readAloudText', () => {
        const campaign = makeCampaign({
            adventures: [makeAdventure({
                scenes: [{
                    id: 'sc-1', title: 'Full Scene', type: 'combat', status: 'planned',
                    readAloudText: 'You enter a dimly lit room.', gmNotes: '',
                    skillChecks: [], rewards: '', npcIds: [],
                }],
            })],
        });
        const issues = checkContinuity(campaign);
        const empty = issues.find(i => i.ruleId === 'empty-scene');
        expect(empty).toBeUndefined();
    });

    it('does not flag scene with gmNotes', () => {
        const campaign = makeCampaign({
            adventures: [makeAdventure({
                scenes: [{
                    id: 'sc-1', title: 'Notes Scene', type: 'combat', status: 'planned',
                    readAloudText: '', gmNotes: 'Surprise round',
                    skillChecks: [], rewards: '', npcIds: [],
                }],
            })],
        });
        const issues = checkContinuity(campaign);
        const empty = issues.find(i => i.ruleId === 'empty-scene');
        expect(empty).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Rule 7: Adventures without scenes
// ---------------------------------------------------------------------------

describe('checkContinuity — adventures without scenes', () => {
    it('detects adventure with zero scenes', () => {
        const campaign = makeCampaign({
            adventures: [makeAdventure()],
        });
        const issues = checkContinuity(campaign);
        const empty = issues.find(i => i.ruleId === 'empty-adventure');
        expect(empty).toBeDefined();
        expect(empty!.severity).toBe('info');
    });

    it('does not flag adventure with scenes', () => {
        const campaign = makeCampaign({
            adventures: [makeAdventure({
                scenes: [{
                    id: 'sc-1', title: 'S1', type: 'combat', status: 'planned',
                    readAloudText: 'x', gmNotes: '', skillChecks: [], rewards: '', npcIds: [],
                }],
            })],
        });
        const issues = checkContinuity(campaign);
        const empty = issues.find(i => i.ruleId === 'empty-adventure');
        expect(empty).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Rule 8: Duplicate entity names
// ---------------------------------------------------------------------------

describe('checkContinuity — duplicate names', () => {
    it('detects duplicate NPC names', () => {
        const campaign = makeCampaign({
            npcs: [
                makeNpc({ id: 'n1', name: 'Goblin' }),
                makeNpc({ id: 'n2', name: 'Goblin' }),
            ],
        });
        const issues = checkContinuity(campaign);
        const dupe = issues.find(i => i.ruleId === 'duplicate-name' && i.title.includes('NPC'));
        expect(dupe).toBeDefined();
        expect(dupe!.severity).toBe('warning');
        expect(dupe!.entityIds).toContain('n1');
        expect(dupe!.entityIds).toContain('n2');
    });

    it('detects case-insensitive duplicates', () => {
        const campaign = makeCampaign({
            npcs: [
                makeNpc({ id: 'n1', name: 'Goblin' }),
                makeNpc({ id: 'n2', name: 'goblin' }),
            ],
        });
        const issues = checkContinuity(campaign);
        const dupe = issues.find(i => i.ruleId === 'duplicate-name');
        expect(dupe).toBeDefined();
    });

    it('detects duplicates with leading/trailing whitespace trimmed', () => {
        const campaign = makeCampaign({
            locations: [
                makeLocation({ id: 'l1', name: 'Forest' }),
                makeLocation({ id: 'l2', name: '  Forest  ' }),
            ],
        });
        const issues = checkContinuity(campaign);
        const dupe = issues.find(i => i.ruleId === 'duplicate-name' && i.title.includes('Location'));
        expect(dupe).toBeDefined();
    });

    it('detects duplicate faction names', () => {
        const campaign = makeCampaign({
            factions: [
                makeFaction({ id: 'f1', name: 'Guild' }),
                makeFaction({ id: 'f2', name: 'Guild' }),
            ],
        });
        const issues = checkContinuity(campaign);
        const dupe = issues.find(i => i.ruleId === 'duplicate-name' && i.title.includes('Faction'));
        expect(dupe).toBeDefined();
    });

    it('detects duplicate item names', () => {
        const campaign = makeCampaign({
            items: [
                makeItem({ id: 'i1', name: 'Potion' }),
                makeItem({ id: 'i2', name: 'Potion' }),
            ],
        });
        const issues = checkContinuity(campaign);
        const dupe = issues.find(i => i.ruleId === 'duplicate-name' && i.title.includes('Item'));
        expect(dupe).toBeDefined();
    });

    it('does not flag unique names', () => {
        const campaign = makeCampaign({
            npcs: [
                makeNpc({ id: 'n1', name: 'Alice' }),
                makeNpc({ id: 'n2', name: 'Bob' }),
            ],
        });
        const issues = checkContinuity(campaign);
        const dupe = issues.find(i => i.ruleId === 'duplicate-name');
        expect(dupe).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// ID uniqueness
// ---------------------------------------------------------------------------

describe('checkContinuity — issue IDs', () => {
    it('produces unique IDs for all issues', () => {
        // Campaign with many issues
        const campaign = makeCampaign({
            npcs: [
                makeNpc({ id: 'n1', name: 'Goblin', factionId: 'deleted-fac' }),
                makeNpc({ id: 'n2', name: 'Goblin' }),
            ],
            factions: [makeFaction({ leaderId: 'deleted-npc', headquartersLocationId: 'deleted-loc' })],
            locations: [makeLocation()],
            items: [makeItem()],
            adventures: [makeAdventure()],
        });
        const issues = checkContinuity(campaign);
        const ids = issues.map(i => i.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
    });
});

// ---------------------------------------------------------------------------
// Combined scenario
// ---------------------------------------------------------------------------

describe('checkContinuity — combined scenario', () => {
    it('finds multiple issue types simultaneously', () => {
        const campaign = makeCampaign({
            npcs: [
                makeNpc({ id: 'n1', factionId: 'deleted-fac' }), // broken ref
                makeNpc({ id: 'n2', name: 'Lone Wolf' }),         // orphaned
            ],
            factions: [makeFaction()],                             // empty faction
            locations: [
                makeLocation({ id: 'l1', parentLocationId: 'l1' }), // circular
            ],
            adventures: [makeAdventure()],                        // no scenes
            items: [makeItem()],                                   // orphaned item
        });
        const issues = checkContinuity(campaign);
        const ruleIds = new Set(issues.map(i => i.ruleId));

        expect(ruleIds.has('broken-ref')).toBe(true);
        expect(ruleIds.has('orphan')).toBe(true);
        expect(ruleIds.has('empty-faction')).toBe(true);
        expect(ruleIds.has('circular-location')).toBe(true);
        expect(ruleIds.has('empty-adventure')).toBe(true);
    });
});
