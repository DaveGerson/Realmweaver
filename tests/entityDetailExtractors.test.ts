import { describe, it, expect } from 'vitest';
import {
    truncate,
    getNpcDetails,
    getLocationDetails,
    getFactionDetails,
    getItemDetails,
    getAdventureDetails,
    getArticleDetails,
    getPlotDetails,
    getSessionLogDetails,
    getPlayerCharacterDetails,
    getSceneDetails,
    getNpcExpandedDetails,
    getLocationExpandedDetails,
    getFactionExpandedDetails,
    getItemExpandedDetails,
    getAdventureExpandedDetails,
    getArticleExpandedDetails,
    getPlotExpandedDetails,
    getSessionLogExpandedDetails,
    getPlayerCharacterExpandedDetails,
    getSceneExpandedDetails,
} from '../utils/entityDetailExtractors';
import type { NPC } from '../types/NPC';
import type { Location } from '../types/Location';
import type { Faction } from '../types/Faction';
import type { Item } from '../types/Item';
import type { Adventure } from '../types/Adventure';
import type { Article } from '../types/Article';
import type { Plot } from '../types/Plot';
import type { SessionLog } from '../types/SessionLog';
import type { PlayerCharacter } from '../types/PlayerCharacter';
import type { Scene } from '../types/Scene';

// ---------------------------------------------------------------------------
// Helpers — minimal entity factories
// ---------------------------------------------------------------------------

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
        id: 'adv-1', title: 'Test Adventure', level: 5, hook: 'A great hook', theme: 'Mystery', scenes: [],
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

function makePlayerCharacter(overrides: Partial<PlayerCharacter> = {}): PlayerCharacter {
    return {
        id: 'pc-1', playerName: 'Alice',
        characterSocial: {
            characterName: 'Thorn', background: 'Outlander', species: 'Human',
            personality: 'Gruff but kind', appearance: '', backstory: '',
            ideals: 'Freedom', bonds: 'My clan', flaws: 'Quick to anger',
        },
        characterStatistics: {
            classes: { charClass: 'Barbarian', level: 5 },
            attributes: { strength: 18, dexterity: 14, constitution: 16, intelligence: 8, wisdom: 10, charisma: 10 },
            skills: {
                acrobatics: 'none', animal_handling: 'none', arcana: 'none',
                athletics: 'proficient', deception: 'none', history: 'none',
                insight: 'none', intimidation: 'proficient', investigation: 'none',
                medicine: 'none', nature: 'none', perception: 'none',
                performance: 'none', persuasion: 'none', religion: 'none',
                sleight_of_hand: 'none', stealth: 'none', survival: 'proficient',
            },
            actions: [], specialActions: [],
        },
        ...overrides,
    };
}

function makeScene(overrides: Partial<Scene> = {}): Scene {
    return {
        id: 'sc-1', title: 'Scene 1', type: 'combat', status: 'planned',
        readAloudText: '', gmNotes: '', skillChecks: [], rewards: '', npcIds: [],
        ...overrides,
    };
}

// Campaign-like object for functions that accept campaign parameter
function makeCampaignLike(overrides: any = {}): any {
    return {
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

// ---------------------------------------------------------------------------
// truncate
// ---------------------------------------------------------------------------

describe('truncate', () => {
    it('returns the full string when shorter than maxLen', () => {
        expect(truncate('hello', 80)).toBe('hello');
    });

    it('truncates and adds ellipsis when longer than maxLen', () => {
        const long = 'A'.repeat(100);
        const result = truncate(long, 80);
        expect(result.length).toBeLessThanOrEqual(82); // 80 chars + ellipsis char
        expect(result.endsWith('\u2026')).toBe(true);
    });

    it('returns empty string for empty input', () => {
        expect(truncate('')).toBe('');
    });

    it('returns empty string for falsy input', () => {
        expect(truncate(undefined as any)).toBe('');
        expect(truncate(null as any)).toBe('');
    });

    it('uses default maxLen of 80', () => {
        const exactly80 = 'A'.repeat(80);
        expect(truncate(exactly80)).toBe(exactly80);

        const over80 = 'A'.repeat(81);
        expect(truncate(over80).endsWith('\u2026')).toBe(true);
    });

    it('trims trailing whitespace before adding ellipsis', () => {
        const input = 'A'.repeat(78) + '  ' + 'B'.repeat(10); // 90 chars total
        const result = truncate(input, 80);
        // Should not have trailing space before the ellipsis
        expect(result).not.toMatch(/\s\u2026$/);
    });
});

// ---------------------------------------------------------------------------
// Compact detail extractors
// ---------------------------------------------------------------------------

describe('getNpcDetails', () => {
    it('returns up to 4 details', () => {
        const npc = makeNpc({
            description: 'Tall and fierce. Strong build.',
            traits: 'Brave',
            motivations: 'Protect the realm',
            factionId: 'fac-1',
        });
        const campaign = makeCampaignLike({
            factions: [{ id: 'fac-1', name: 'Royal Guard' }],
        });
        const details = getNpcDetails(npc, campaign);
        expect(details.length).toBeLessThanOrEqual(4);
        expect(details.some(d => d.label === 'Description')).toBe(true);
        expect(details.some(d => d.label === 'Traits')).toBe(true);
        expect(details.some(d => d.label === 'Faction')).toBe(true);
        expect(details.some(d => d.label === 'Motivation')).toBe(true);
    });

    it('extracts first sentence of description', () => {
        const npc = makeNpc({ description: 'Tall and fierce. Strong build.' });
        const details = getNpcDetails(npc, null);
        const desc = details.find(d => d.label === 'Description');
        expect(desc?.value).toBe('Tall and fierce');
    });

    it('returns empty array when NPC has no populated fields', () => {
        const npc = makeNpc();
        const details = getNpcDetails(npc, null);
        expect(details).toEqual([]);
    });

    it('handles NPC without faction reference gracefully', () => {
        const npc = makeNpc({ factionId: 'nonexistent' });
        const campaign = makeCampaignLike();
        const details = getNpcDetails(npc, campaign);
        // Should not include faction since it cannot be resolved
        expect(details.some(d => d.label === 'Faction')).toBe(false);
    });
});

describe('getLocationDetails', () => {
    it('shows connection count', () => {
        const loc = makeLocation({
            connections: [{ id: 'c1', targetLocationId: 'x', description: '' }],
            subLocationIds: ['y'],
        });
        const details = getLocationDetails(loc, null);
        const conn = details.find(d => d.label === 'Connections');
        expect(conn?.value).toBe('2');
    });

    it('resolves parent location name', () => {
        const loc = makeLocation({ parentLocationId: 'loc-2' });
        const campaign = makeCampaignLike({
            locations: [{ id: 'loc-2', name: 'The Kingdom' }],
        });
        const details = getLocationDetails(loc, campaign);
        expect(details.some(d => d.label === 'Within' && d.value === 'The Kingdom')).toBe(true);
    });

    it('resolves controlling faction', () => {
        const loc = makeLocation({ controllingFactionId: 'fac-1' });
        const campaign = makeCampaignLike({
            factions: [{ id: 'fac-1', name: 'Dark Council' }],
        });
        const details = getLocationDetails(loc, campaign);
        expect(details.some(d => d.label === 'Controlled by' && d.value === 'Dark Council')).toBe(true);
    });
});

describe('getFactionDetails', () => {
    it('shows alignment, goals, member count, and HQ', () => {
        const faction = makeFaction({
            alignment: 'Lawful Good',
            goals: 'Protect the innocent',
            memberIds: ['n1', 'n2'],
            headquartersLocationId: 'loc-1',
        });
        const campaign = makeCampaignLike({
            locations: [{ id: 'loc-1', name: 'Castle' }],
        });
        const details = getFactionDetails(faction, campaign);
        expect(details.some(d => d.label === 'Alignment' && d.value === 'Lawful Good')).toBe(true);
        expect(details.some(d => d.label === 'Members' && d.value === '2')).toBe(true);
        expect(details.some(d => d.label === 'HQ' && d.value === 'Castle')).toBe(true);
    });
});

describe('getItemDetails', () => {
    it('always includes rarity', () => {
        const item = makeItem();
        const details = getItemDetails(item);
        expect(details[0].label).toBe('Rarity');
        expect(details[0].value).toBe('common');
    });

    it('includes description first sentence and properties', () => {
        const item = makeItem({
            description: 'A glowing blade. Forged in fire.',
            properties: '+1 to attack rolls',
        });
        const details = getItemDetails(item);
        expect(details.some(d => d.label === 'Description' && d.value === 'A glowing blade')).toBe(true);
        expect(details.some(d => d.label === 'Properties')).toBe(true);
    });
});

describe('getAdventureDetails', () => {
    it('includes scene count, level, theme, and hook', () => {
        const adv = makeAdventure({
            scenes: [makeScene(), makeScene({ id: 'sc-2' })],
        });
        const details = getAdventureDetails(adv);
        expect(details.some(d => d.label === 'Scenes' && d.value === '2')).toBe(true);
        expect(details.some(d => d.label === 'Level' && d.value === '5')).toBe(true);
        expect(details.some(d => d.label === 'Theme')).toBe(true);
        expect(details.some(d => d.label === 'Hook')).toBe(true);
    });
});

describe('getArticleDetails', () => {
    it('always includes category', () => {
        const article = makeArticle();
        const details = getArticleDetails(article, null);
        expect(details[0].label).toBe('Category');
        expect(details[0].value).toBe('lore');
    });

    it('includes reference count and parent article name', () => {
        const article = makeArticle({
            relatedEntityIds: ['x', 'y'],
            parentArticleId: 'art-2',
        });
        const campaign = makeCampaignLike({
            articles: [{ id: 'art-2', title: 'Parent Lore' }],
        });
        const details = getArticleDetails(article, campaign);
        expect(details.some(d => d.label === 'References' && d.value === '2')).toBe(true);
        expect(details.some(d => d.label === 'Under' && d.value === 'Parent Lore')).toBe(true);
    });
});

describe('getPlotDetails', () => {
    it('always includes status', () => {
        const plot = makePlot();
        const details = getPlotDetails(plot);
        expect(details[0].label).toBe('Status');
        expect(details[0].value).toBe('active');
    });

    it('includes entity count when entities are linked', () => {
        const plot = makePlot({ relatedEntityIds: ['x', 'y', 'z'] });
        const details = getPlotDetails(plot);
        expect(details.some(d => d.label === 'Entities' && d.value === '3')).toBe(true);
    });
});

describe('getSessionLogDetails', () => {
    it('includes date, status, and structured note count', () => {
        const log = makeSessionLog({
            structuredNotes: [
                { id: 'e1', timestamp: '', content: 'Event 1', taggedEntityIds: [] },
                { id: 'e2', timestamp: '', content: 'Event 2', taggedEntityIds: [] },
            ],
        });
        const details = getSessionLogDetails(log);
        expect(details.some(d => d.label === 'Date' && d.value === '2026-01-15')).toBe(true);
        expect(details.some(d => d.label === 'Status' && d.value === 'completed')).toBe(true);
        expect(details.some(d => d.label === 'Entries' && d.value === '2')).toBe(true);
    });

    it('shows recap when available, otherwise running notes', () => {
        const logWithRecap = makeSessionLog({ recap: 'The party won.' });
        expect(getSessionLogDetails(logWithRecap).some(d => d.label === 'Recap')).toBe(true);

        const logWithNotes = makeSessionLog({ runningNotes: 'The fight continues.' });
        expect(getSessionLogDetails(logWithNotes).some(d => d.label === 'Notes')).toBe(true);
    });
});

describe('getPlayerCharacterDetails', () => {
    it('includes race, class, background, and personality', () => {
        const pc = makePlayerCharacter();
        const details = getPlayerCharacterDetails(pc);
        expect(details.some(d => d.label === 'Race' && d.value === 'Human')).toBe(true);
        expect(details.some(d => d.label === 'Class' && d.value === 'Barbarian 5')).toBe(true);
        expect(details.some(d => d.label === 'Background' && d.value === 'Outlander')).toBe(true);
    });

    it('includes subclass in class string when present', () => {
        const pc = makePlayerCharacter();
        pc.characterStatistics.classes.subclass = 'Berserker';
        const details = getPlayerCharacterDetails(pc);
        const classDetail = details.find(d => d.label === 'Class');
        expect(classDetail?.value).toBe('Berserker Barbarian 5');
    });
});

describe('getSceneDetails', () => {
    it('always includes scene type', () => {
        const scene = makeScene();
        const details = getSceneDetails(scene, null);
        expect(details[0].label).toBe('Type');
        expect(details[0].value).toBe('combat');
    });

    it('resolves location name', () => {
        const scene = makeScene({ locationId: 'loc-1' });
        const campaign = makeCampaignLike({
            locations: [{ id: 'loc-1', name: 'Dungeon' }],
        });
        const details = getSceneDetails(scene, campaign);
        expect(details.some(d => d.label === 'Location' && d.value === 'Dungeon')).toBe(true);
    });

    it('shows NPC count', () => {
        const scene = makeScene({ npcIds: ['n1', 'n2'] });
        const details = getSceneDetails(scene, null);
        expect(details.some(d => d.label === 'NPCs' && d.value === '2')).toBe(true);
    });

    it('returns at most 4 details', () => {
        const scene = makeScene({
            locationId: 'loc-1',
            npcIds: ['n1'],
            readAloudText: 'You enter a dark cave. The air is cold.',
        });
        const campaign = makeCampaignLike({
            locations: [{ id: 'loc-1', name: 'Cave' }],
        });
        const details = getSceneDetails(scene, campaign);
        expect(details.length).toBeLessThanOrEqual(4);
    });
});

// ---------------------------------------------------------------------------
// Expanded detail extractors
// ---------------------------------------------------------------------------

describe('getNpcExpandedDetails', () => {
    it('includes editable Name, Description, Traits, Motivations, Secrets fields', () => {
        const npc = makeNpc({ description: 'Brave', traits: 'Bold', motivations: 'Glory', secrets: 'Cursed' });
        const details = getNpcExpandedDetails(npc, null);
        const editableFields = details.filter(d => d.editable);
        expect(editableFields.length).toBeGreaterThanOrEqual(5); // name, desc, traits, motivations, secrets
        expect(details.find(d => d.fieldKey === 'name')).toBeDefined();
        expect(details.find(d => d.fieldKey === 'description')).toBeDefined();
    });

    it('includes non-editable backstory and stats when populated', () => {
        const npc = makeNpc({ backstory: 'Lost prince', stats: 'AC 15' });
        const details = getNpcExpandedDetails(npc, null);
        const backstory = details.find(d => d.label === 'Backstory');
        expect(backstory?.editable).toBe(false);
        const stats = details.find(d => d.label === 'Stats');
        expect(stats?.editable).toBe(false);
    });

    it('includes faction name when resolved', () => {
        const npc = makeNpc({ factionId: 'fac-1' });
        const campaign = makeCampaignLike({
            factions: [{ id: 'fac-1', name: 'Thieves Guild' }],
        });
        const details = getNpcExpandedDetails(npc, campaign);
        expect(details.some(d => d.label === 'Faction' && d.value === 'Thieves Guild')).toBe(true);
    });
});

describe('getItemExpandedDetails', () => {
    it('has Name, Rarity, Description, Properties', () => {
        const item = makeItem({ description: 'Shiny', properties: 'Magic' });
        const details = getItemExpandedDetails(item);
        expect(details.length).toBe(4);
        expect(details[0].fieldKey).toBe('name');
        expect(details[1].label).toBe('Rarity');
        expect(details[1].editable).toBe(false);
        expect(details[2].fieldKey).toBe('description');
        expect(details[3].fieldKey).toBe('properties');
    });
});

describe('getAdventureExpandedDetails', () => {
    it('has Title, Hook, Theme (editable) and Level, Scenes (non-editable)', () => {
        const adv = makeAdventure({ scenes: [makeScene()] });
        const details = getAdventureExpandedDetails(adv);
        expect(details.find(d => d.fieldKey === 'title')?.editable).toBe(true);
        expect(details.find(d => d.fieldKey === 'hook')?.editable).toBe(true);
        expect(details.find(d => d.label === 'Level')?.editable).toBe(false);
        expect(details.find(d => d.label === 'Scenes')?.value).toBe('1');
    });
});

describe('getPlotExpandedDetails', () => {
    it('includes Title (editable), Status (non-editable), Description (editable)', () => {
        const plot = makePlot({ description: 'A sinister plan' });
        const details = getPlotExpandedDetails(plot);
        expect(details.find(d => d.fieldKey === 'title')?.editable).toBe(true);
        expect(details.find(d => d.label === 'Status')?.editable).toBe(false);
        expect(details.find(d => d.fieldKey === 'description')?.editable).toBe(true);
    });
});

describe('getSessionLogExpandedDetails', () => {
    it('includes Title (editable), Status (non-editable), Recap (editable)', () => {
        const log = makeSessionLog({ recap: 'Party defeated the dragon' });
        const details = getSessionLogExpandedDetails(log);
        expect(details.find(d => d.fieldKey === 'title')?.editable).toBe(true);
        expect(details.find(d => d.label === 'Status')?.editable).toBe(false);
        expect(details.find(d => d.fieldKey === 'recap')?.editable).toBe(true);
    });

    it('includes optional fields when populated', () => {
        const log = makeSessionLog({
            prepNotes: 'Prepare encounter',
            notableEvents: 'TPK avoided',
            looseEnds: 'Missing artifact',
        });
        const details = getSessionLogExpandedDetails(log);
        expect(details.some(d => d.label === 'Prep Notes')).toBe(true);
        expect(details.some(d => d.label === 'Notable Events')).toBe(true);
        expect(details.some(d => d.label === 'Loose Ends')).toBe(true);
    });
});

describe('getPlayerCharacterExpandedDetails', () => {
    it('includes character fields and proficiency bonus', () => {
        const pc = makePlayerCharacter();
        const details = getPlayerCharacterExpandedDetails(pc);
        expect(details.find(d => d.label === 'Name')?.value).toBe('Thorn');
        expect(details.find(d => d.label === 'Race')?.value).toBe('Human');
        expect(details.find(d => d.label === 'Background')?.value).toBe('Outlander');
        // Proficiency for level 5: ceil(5/4) + 1 = 3
        expect(details.find(d => d.label === 'Proficiency')?.value).toBe('+3');
    });

    it('all fields are non-editable', () => {
        const pc = makePlayerCharacter();
        const details = getPlayerCharacterExpandedDetails(pc);
        for (const detail of details) {
            expect(detail.editable).toBe(false);
        }
    });

    it('includes ideals, bonds, flaws when present', () => {
        const pc = makePlayerCharacter();
        const details = getPlayerCharacterExpandedDetails(pc);
        expect(details.some(d => d.label === 'Ideals')).toBe(true);
        expect(details.some(d => d.label === 'Bonds')).toBe(true);
        expect(details.some(d => d.label === 'Flaws')).toBe(true);
    });
});

describe('getSceneExpandedDetails', () => {
    it('includes editable read-aloud and GM notes fields', () => {
        const scene = makeScene({
            readAloudText: 'Darkness surrounds you.',
            gmNotes: 'Surprise round for goblins',
        });
        const details = getSceneExpandedDetails(scene, null);
        const readAloud = details.find(d => d.fieldKey === 'readAloudText');
        expect(readAloud?.editable).toBe(true);
        expect(readAloud?.multiline).toBe(true);

        const gmNotes = details.find(d => d.fieldKey === 'gmNotes');
        expect(gmNotes?.editable).toBe(true);
    });

    it('resolves location and NPC names from campaign', () => {
        const scene = makeScene({
            locationId: 'loc-1',
            npcIds: ['npc-1', 'npc-2'],
        });
        const campaign = makeCampaignLike({
            locations: [{ id: 'loc-1', name: 'Dark Forest' }],
            npcs: [
                { id: 'npc-1', name: 'Goblin Chief' },
                { id: 'npc-2', name: 'Elven Scout' },
            ],
        });
        const details = getSceneExpandedDetails(scene, campaign);
        expect(details.some(d => d.label === 'Location' && d.value === 'Dark Forest')).toBe(true);
        expect(details.some(d => d.label === 'NPCs' && d.value === 'Goblin Chief, Elven Scout')).toBe(true);
    });
});

describe('getFactionExpandedDetails', () => {
    it('resolves leader and HQ from campaign', () => {
        const faction = makeFaction({
            leaderId: 'npc-1',
            headquartersLocationId: 'loc-1',
            alignment: 'Chaotic Evil',
            memberIds: ['npc-1', 'npc-2'],
        });
        const campaign = makeCampaignLike({
            npcs: [{ id: 'npc-1', name: 'Dark Lord' }],
            locations: [{ id: 'loc-1', name: 'Shadow Keep' }],
        });
        const details = getFactionExpandedDetails(faction, campaign);
        expect(details.some(d => d.label === 'Leader' && d.value === 'Dark Lord')).toBe(true);
        expect(details.some(d => d.label === 'HQ' && d.value === 'Shadow Keep')).toBe(true);
        expect(details.some(d => d.label === 'Members' && d.value === '2')).toBe(true);
    });
});

describe('getLocationExpandedDetails', () => {
    it('includes editable name, description, secrets', () => {
        const loc = makeLocation({ description: 'A dark cave', secrets: 'Hidden treasure' });
        const details = getLocationExpandedDetails(loc, null);
        expect(details.find(d => d.fieldKey === 'name')?.editable).toBe(true);
        expect(details.find(d => d.fieldKey === 'description')?.editable).toBe(true);
        expect(details.find(d => d.fieldKey === 'secrets')?.editable).toBe(true);
    });

    it('includes non-editable parent and controlling faction when resolved', () => {
        const loc = makeLocation({
            parentLocationId: 'loc-2',
            controllingFactionId: 'fac-1',
        });
        const campaign = makeCampaignLike({
            locations: [{ id: 'loc-2', name: 'The Continent' }],
            factions: [{ id: 'fac-1', name: 'Empire' }],
        });
        const details = getLocationExpandedDetails(loc, campaign);
        expect(details.some(d => d.label === 'Within' && d.value === 'The Continent' && !d.editable)).toBe(true);
        expect(details.some(d => d.label === 'Controlled by' && d.value === 'Empire' && !d.editable)).toBe(true);
    });
});

describe('getArticleExpandedDetails', () => {
    it('truncates content to 500 characters', () => {
        const longContent = 'A'.repeat(1000);
        const article = makeArticle({ content: longContent });
        const details = getArticleExpandedDetails(article, null);
        const contentDetail = details.find(d => d.fieldKey === 'content');
        expect(contentDetail?.value.length).toBeLessThanOrEqual(500);
    });

    it('includes reference count and parent article', () => {
        const article = makeArticle({
            relatedEntityIds: ['x', 'y'],
            parentArticleId: 'art-2',
        });
        const campaign = makeCampaignLike({
            articles: [{ id: 'art-2', title: 'Parent Article' }],
        });
        const details = getArticleExpandedDetails(article, campaign);
        expect(details.some(d => d.label === 'Under' && d.value === 'Parent Article')).toBe(true);
        expect(details.some(d => d.label === 'References' && d.value === '2')).toBe(true);
    });
});
