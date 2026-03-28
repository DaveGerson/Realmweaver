import { describe, it, expect } from 'vitest';
import { computeBacklinks } from '../utils/backlinkUtils';
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
// Helpers
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
        sessionDate: '2026-01-01', plannedSceneIds: [], prepNotes: '',
        relatedPlotIds: [], runningNotes: '', structuredNotes: [],
        encounterLog: [], recap: '', notableEvents: '', looseEnds: '',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// NPC Backlinks
// ---------------------------------------------------------------------------

describe('computeBacklinks for NPC', () => {
    it('returns empty object when NPC has no references', () => {
        const campaign = makeCampaign({ npcs: [makeNpc()] });
        const result = computeBacklinks('npc-1', 'npc', campaign);
        expect(result).toEqual({});
    });

    it('finds faction where NPC is leader', () => {
        const faction = makeFaction({ leaderId: 'npc-1' });
        const campaign = makeCampaign({
            npcs: [makeNpc()],
            factions: [faction],
        });
        const result = computeBacklinks('npc-1', 'npc', campaign);
        expect(result.faction).toHaveLength(1);
        expect(result.faction[0].relationshipLabel).toBe('Leader of');
        expect(result.faction[0].id).toBe('fac-1');
    });

    it('finds faction where NPC is member', () => {
        const faction = makeFaction({ memberIds: ['npc-1'] });
        const campaign = makeCampaign({
            npcs: [makeNpc()],
            factions: [faction],
        });
        const result = computeBacklinks('npc-1', 'npc', campaign);
        expect(result.faction).toHaveLength(1);
        expect(result.faction[0].relationshipLabel).toBe('Member of');
    });

    it('prefers leader over member when NPC is both', () => {
        const faction = makeFaction({ leaderId: 'npc-1', memberIds: ['npc-1'] });
        const campaign = makeCampaign({
            npcs: [makeNpc()],
            factions: [faction],
        });
        const result = computeBacklinks('npc-1', 'npc', campaign);
        expect(result.faction).toHaveLength(1);
        expect(result.faction[0].relationshipLabel).toBe('Leader of');
    });

    it('finds scenes that include the NPC', () => {
        const adventure = makeAdventure({
            scenes: [{
                id: 'sc-1', title: 'Encounter', type: 'combat', status: 'planned',
                readAloudText: '', gmNotes: '', skillChecks: [], rewards: '',
                npcIds: ['npc-1'],
            }],
        });
        const campaign = makeCampaign({
            npcs: [makeNpc()],
            adventures: [adventure],
        });
        const result = computeBacklinks('npc-1', 'npc', campaign);
        expect(result.scene).toHaveLength(1);
        expect(result.scene[0].name).toBe('Encounter');
        expect(result.scene[0].relationshipLabel).toBe('Appears in');
    });

    it('finds other NPCs with relationships targeting this NPC', () => {
        const otherNpc = makeNpc({
            id: 'npc-2', name: 'Ally NPC',
            relationships: [{ id: 'r1', targetId: 'npc-1', relationType: 'Ally', description: 'Friends' }],
        });
        const campaign = makeCampaign({
            npcs: [makeNpc(), otherNpc],
        });
        const result = computeBacklinks('npc-1', 'npc', campaign);
        expect(result.npc).toHaveLength(1);
        expect(result.npc[0].name).toBe('Ally NPC');
    });

    it('only adds one entry per NPC even if multiple relationships exist', () => {
        const otherNpc = makeNpc({
            id: 'npc-2', name: 'Other',
            relationships: [
                { id: 'r1', targetId: 'npc-1', relationType: 'Ally', description: '' },
                { id: 'r2', targetId: 'npc-1', relationType: 'Rival', description: '' },
            ],
        });
        const campaign = makeCampaign({ npcs: [makeNpc(), otherNpc] });
        const result = computeBacklinks('npc-1', 'npc', campaign);
        expect(result.npc).toHaveLength(1);
    });

    it('finds articles referencing this NPC', () => {
        const article = makeArticle({ relatedEntityIds: ['npc-1'] });
        const campaign = makeCampaign({
            npcs: [makeNpc()],
            articles: [article],
        });
        const result = computeBacklinks('npc-1', 'npc', campaign);
        expect(result.article).toHaveLength(1);
        expect(result.article[0].relationshipLabel).toBe('Referenced by');
    });

    it('finds plots involving this NPC', () => {
        const plot = makePlot({ relatedEntityIds: ['npc-1'] });
        const campaign = makeCampaign({
            npcs: [makeNpc()],
            plots: [plot],
        });
        const result = computeBacklinks('npc-1', 'npc', campaign);
        expect(result.plot).toHaveLength(1);
        expect(result.plot[0].relationshipLabel).toBe('Involved in');
    });

    it('sorts entries alphabetically within each group', () => {
        const campaign = makeCampaign({
            npcs: [makeNpc()],
            factions: [
                makeFaction({ id: 'f1', name: 'Zebra Guild', memberIds: ['npc-1'] }),
                makeFaction({ id: 'f2', name: 'Alpha Guild', memberIds: ['npc-1'] }),
            ],
        });
        const result = computeBacklinks('npc-1', 'npc', campaign);
        expect(result.faction).toHaveLength(2);
        expect(result.faction[0].name).toBe('Alpha Guild');
        expect(result.faction[1].name).toBe('Zebra Guild');
    });
});

// ---------------------------------------------------------------------------
// Location Backlinks
// ---------------------------------------------------------------------------

describe('computeBacklinks for Location', () => {
    it('finds child locations (parent of)', () => {
        const child = makeLocation({ id: 'loc-2', name: 'Inner Chamber', parentLocationId: 'loc-1' });
        const campaign = makeCampaign({
            locations: [makeLocation(), child],
        });
        const result = computeBacklinks('loc-1', 'location', campaign);
        expect(result.location).toHaveLength(1);
        expect(result.location[0].relationshipLabel).toBe('Parent of');
    });

    it('finds connected locations', () => {
        const other = makeLocation({
            id: 'loc-2', name: 'Adjacent Room',
            connections: [{ id: 'conn-1', targetLocationId: 'loc-1', description: 'Door' }],
        });
        const campaign = makeCampaign({
            locations: [makeLocation(), other],
        });
        const result = computeBacklinks('loc-1', 'location', campaign);
        const locEntries = result.location ?? [];
        expect(locEntries.some(e => e.relationshipLabel === 'Connected to')).toBe(true);
    });

    it('finds factions headquartered at this location', () => {
        const faction = makeFaction({ headquartersLocationId: 'loc-1' });
        const campaign = makeCampaign({
            locations: [makeLocation()],
            factions: [faction],
        });
        const result = computeBacklinks('loc-1', 'location', campaign);
        expect(result.faction).toHaveLength(1);
        expect(result.faction[0].relationshipLabel).toBe('Headquarters of');
    });

    it('finds scenes set at this location', () => {
        const adventure = makeAdventure({
            scenes: [{
                id: 'sc-1', title: 'Market Scene', type: 'social', status: 'planned',
                readAloudText: '', gmNotes: '', skillChecks: [], rewards: '',
                npcIds: [], locationId: 'loc-1',
            }],
        });
        const campaign = makeCampaign({
            locations: [makeLocation()],
            adventures: [adventure],
        });
        const result = computeBacklinks('loc-1', 'location', campaign);
        expect(result.scene).toHaveLength(1);
        expect(result.scene[0].relationshipLabel).toBe('Setting for');
    });

    it('finds articles referencing this location', () => {
        const article = makeArticle({ relatedEntityIds: ['loc-1'] });
        const campaign = makeCampaign({
            locations: [makeLocation()],
            articles: [article],
        });
        const result = computeBacklinks('loc-1', 'location', campaign);
        expect(result.article).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// Faction Backlinks
// ---------------------------------------------------------------------------

describe('computeBacklinks for Faction', () => {
    it('finds NPCs belonging to this faction', () => {
        const npc = makeNpc({ factionId: 'fac-1' });
        const campaign = makeCampaign({
            npcs: [npc],
            factions: [makeFaction()],
        });
        const result = computeBacklinks('fac-1', 'faction', campaign);
        expect(result.npc).toHaveLength(1);
        expect(result.npc[0].relationshipLabel).toBe('Member');
    });

    it('finds locations controlled by this faction', () => {
        const loc = makeLocation({ controllingFactionId: 'fac-1' });
        const campaign = makeCampaign({
            locations: [loc],
            factions: [makeFaction()],
        });
        const result = computeBacklinks('fac-1', 'faction', campaign);
        expect(result.location).toHaveLength(1);
        expect(result.location[0].relationshipLabel).toBe('Controls');
    });

    it('finds articles and plots referencing this faction', () => {
        const article = makeArticle({ relatedEntityIds: ['fac-1'] });
        const plot = makePlot({ relatedEntityIds: ['fac-1'] });
        const campaign = makeCampaign({
            factions: [makeFaction()],
            articles: [article],
            plots: [plot],
        });
        const result = computeBacklinks('fac-1', 'faction', campaign);
        expect(result.article).toHaveLength(1);
        expect(result.plot).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// Item Backlinks
// ---------------------------------------------------------------------------

describe('computeBacklinks for Item', () => {
    it('finds articles referencing this item', () => {
        const article = makeArticle({ relatedEntityIds: ['item-1'] });
        const campaign = makeCampaign({
            items: [makeItem()],
            articles: [article],
        });
        const result = computeBacklinks('item-1', 'item', campaign);
        expect(result.article).toHaveLength(1);
    });

    it('finds plots involving this item', () => {
        const plot = makePlot({ relatedEntityIds: ['item-1'] });
        const campaign = makeCampaign({
            items: [makeItem()],
            plots: [plot],
        });
        const result = computeBacklinks('item-1', 'item', campaign);
        expect(result.plot).toHaveLength(1);
    });

    it('returns empty when item has no references', () => {
        const campaign = makeCampaign({ items: [makeItem()] });
        const result = computeBacklinks('item-1', 'item', campaign);
        expect(result).toEqual({});
    });
});

// ---------------------------------------------------------------------------
// Adventure Backlinks
// ---------------------------------------------------------------------------

describe('computeBacklinks for Adventure', () => {
    it('finds session logs played under this adventure', () => {
        const log = makeSessionLog({ adventureId: 'adv-1' });
        const campaign = makeCampaign({
            adventures: [makeAdventure()],
            sessionLogs: [log],
        });
        const result = computeBacklinks('adv-1', 'adventure', campaign);
        expect(result['session-log']).toHaveLength(1);
        expect(result['session-log'][0].relationshipLabel).toBe('Played in');
    });

    it('finds articles referencing this adventure', () => {
        const article = makeArticle({ relatedEntityIds: ['adv-1'] });
        const campaign = makeCampaign({
            adventures: [makeAdventure()],
            articles: [article],
        });
        const result = computeBacklinks('adv-1', 'adventure', campaign);
        expect(result.article).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// Article Backlinks
// ---------------------------------------------------------------------------

describe('computeBacklinks for Article', () => {
    it('finds child articles (parent of)', () => {
        const child = makeArticle({ id: 'art-2', title: 'Sub-Article', parentArticleId: 'art-1' });
        const campaign = makeCampaign({
            articles: [makeArticle(), child],
        });
        const result = computeBacklinks('art-1', 'article', campaign);
        expect(result.article).toHaveLength(1);
        expect(result.article[0].relationshipLabel).toBe('Parent of');
    });

    it('finds articles that reference this article via relatedEntityIds', () => {
        const other = makeArticle({ id: 'art-2', title: 'Referencing Article', relatedEntityIds: ['art-1'] });
        const campaign = makeCampaign({
            articles: [makeArticle(), other],
        });
        const result = computeBacklinks('art-1', 'article', campaign);
        expect(result.article).toHaveLength(1);
        expect(result.article[0].relationshipLabel).toBe('Referenced by');
    });

    it('does not include self-references', () => {
        const article = makeArticle({ relatedEntityIds: ['art-1'] });
        const campaign = makeCampaign({ articles: [article] });
        const result = computeBacklinks('art-1', 'article', campaign);
        expect(result.article).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Plot Backlinks
// ---------------------------------------------------------------------------

describe('computeBacklinks for Plot', () => {
    it('finds session logs that tracked this plot', () => {
        const log = makeSessionLog({ relatedPlotIds: ['plot-1'] });
        const campaign = makeCampaign({
            plots: [makePlot()],
            sessionLogs: [log],
        });
        const result = computeBacklinks('plot-1', 'plot', campaign);
        expect(result['session-log']).toHaveLength(1);
        expect(result['session-log'][0].relationshipLabel).toBe('Tracked in');
    });

    it('finds articles referencing this plot', () => {
        const article = makeArticle({ relatedEntityIds: ['plot-1'] });
        const campaign = makeCampaign({
            plots: [makePlot()],
            articles: [article],
        });
        const result = computeBacklinks('plot-1', 'plot', campaign);
        expect(result.article).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// Scene Backlinks
// ---------------------------------------------------------------------------

describe('computeBacklinks for Scene', () => {
    it('finds the parent adventure containing the scene', () => {
        const adventure = makeAdventure({
            scenes: [{
                id: 'sc-1', title: 'Scene 1', type: 'combat', status: 'planned',
                readAloudText: '', gmNotes: '', skillChecks: [], rewards: '', npcIds: [],
            }],
        });
        const campaign = makeCampaign({ adventures: [adventure] });
        const result = computeBacklinks('sc-1', 'scene', campaign);
        expect(result.adventure).toHaveLength(1);
        expect(result.adventure[0].name).toBe('Test Adventure');
        expect(result.adventure[0].relationshipLabel).toBe('Part of');
    });

    it('returns empty when scene is not found in any adventure', () => {
        const campaign = makeCampaign({ adventures: [makeAdventure()] });
        const result = computeBacklinks('nonexistent', 'scene', campaign);
        expect(result).toEqual({});
    });
});

// ---------------------------------------------------------------------------
// Unknown entity type
// ---------------------------------------------------------------------------

describe('computeBacklinks for unknown type', () => {
    it('returns empty object', () => {
        const campaign = makeCampaign();
        const result = computeBacklinks('x', 'unknown-type', campaign);
        expect(result).toEqual({});
    });
});
