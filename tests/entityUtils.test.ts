import { describe, it, expect } from 'vitest';
import {
    ENTITY_TYPE_CONFIG,
    buildEntityContext,
    estimatePcHp,
    createDefaultNpc,
    createDefaultLocation,
    createDefaultFaction,
    createDefaultItem,
    createDefaultArticle,
    createDefaultAdventure,
    createDefaultScene,
    createDefaultSession,
    createDefaultPlot,
    createDefaultPlayerCharacter,
    createDefaultNote,
    createDefaultSecret,
    normalizePlayerCharacter,
    isEntityTypeKey,
    getEntityTypeConfig,
    type EntityTypeKey,
} from '../utils/entityUtils';
import type { Campaign } from '../types/Campaign';
import type { PlayerCharacter } from '../types/PlayerCharacter';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMinimalCampaign(overrides: Partial<Campaign> = {}): Campaign {
    return {
        id: 'c-1',
        title: 'Test Campaign',
        settingType: 'custom',
        setting: 'A dark fantasy realm',
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

function makePlayerCharacter(overrides: Partial<PlayerCharacter> = {}): PlayerCharacter {
    return {
        id: 'pc-1',
        playerName: 'Alice',
        characterSocial: {
            characterName: 'Thorn',
            background: 'Outlander',
            species: 'Human',
            personality: 'Gruff but kind',
            appearance: 'Tall and scarred',
            backstory: 'Born in the wild',
            ideals: 'Freedom',
            bonds: 'My clan',
            flaws: 'Quick to anger',
        },
        characterStatistics: {
            classes: { charClass: 'Barbarian', level: 5 },
            attributes: {
                strength: 18,
                dexterity: 14,
                constitution: 16,
                intelligence: 8,
                wisdom: 10,
                charisma: 10,
            },
            skills: {
                acrobatics: 'none', animal_handling: 'none', arcana: 'none',
                athletics: 'proficient', deception: 'none', history: 'none',
                insight: 'none', intimidation: 'proficient', investigation: 'none',
                medicine: 'none', nature: 'none', perception: 'none',
                performance: 'none', persuasion: 'none', religion: 'none',
                sleight_of_hand: 'none', stealth: 'none', survival: 'proficient',
            },
            actions: ['Reckless Attack'],
            specialActions: ['Rage'],
        },
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// ENTITY_TYPE_CONFIG
// ---------------------------------------------------------------------------

describe('ENTITY_TYPE_CONFIG', () => {
    it('includes all core entity types', () => {
        const coreTypes = [
            'npc', 'location', 'faction', 'item', 'adventure',
            'article', 'sessionLog', 'playerCharacter', 'plot', 'note',
            'scene', 'secret',
        ] as const;
        for (const type of coreTypes) {
            expect(ENTITY_TYPE_CONFIG[type]).toBeDefined();
        }
    });

    it('provides aliased keys for hyphenated entity types', () => {
        expect(ENTITY_TYPE_CONFIG['session-log']).toBeDefined();
        expect(ENTITY_TYPE_CONFIG['session-log'].color).toBe(ENTITY_TYPE_CONFIG['sessionLog'].color);
        expect(ENTITY_TYPE_CONFIG['player-character']).toBeDefined();
        expect(ENTITY_TYPE_CONFIG['player-character'].color).toBe(ENTITY_TYPE_CONFIG['playerCharacter'].color);
    });

    it('every entry has icon, color, and label', () => {
        for (const [key, config] of Object.entries(ENTITY_TYPE_CONFIG)) {
            expect(config.icon, `${key}.icon should be a non-empty string`).toBeTruthy();
            expect(config.color, `${key}.color should be a non-empty string`).toBeTruthy();
            expect(config.label, `${key}.label should be a non-empty string`).toBeTruthy();
        }
    });

    it('uses the documented color assignments', () => {
        expect(ENTITY_TYPE_CONFIG.npc.color).toBe('amber');
        expect(ENTITY_TYPE_CONFIG.location.color).toBe('emerald');
        expect(ENTITY_TYPE_CONFIG.faction.color).toBe('violet');
        expect(ENTITY_TYPE_CONFIG.item.color).toBe('sky');
        expect(ENTITY_TYPE_CONFIG.adventure.color).toBe('orange');
        expect(ENTITY_TYPE_CONFIG.article.color).toBe('cyan');
        expect(ENTITY_TYPE_CONFIG.sessionLog.color).toBe('rose');
        expect(ENTITY_TYPE_CONFIG.playerCharacter.color).toBe('teal');
        expect(ENTITY_TYPE_CONFIG.plot.color).toBe('yellow');
        expect(ENTITY_TYPE_CONFIG.note.color).toBe('slate');
        expect(ENTITY_TYPE_CONFIG.scene.color).toBe('blue');
        expect(ENTITY_TYPE_CONFIG.secret.color).toBe('fuchsia');
    });

    // X10: 'secret' was missing, so rendering a Secret through any config-driven
    // surface crashed on `undefined.color`.
    it('has a secret entry with a real Icons key and a non-indigo color', () => {
        expect(ENTITY_TYPE_CONFIG.secret).toEqual({ icon: 'Lock', color: 'fuchsia', label: 'Secrets' });
        for (const config of Object.values(ENTITY_TYPE_CONFIG)) {
            expect(config.color, 'indigo is reserved for RealmChat').not.toBe('indigo');
        }
    });

    it('gives each entry a distinct color except the kebab aliases', () => {
        const canonical = Object.entries(ENTITY_TYPE_CONFIG).filter(([k]) => !k.includes('-'));
        const colors = canonical.map(([, c]) => c.color);
        expect(new Set(colors).size).toBe(colors.length);
    });

    it('isEntityTypeKey / getEntityTypeConfig narrow open-ended strings safely', () => {
        const keys: EntityTypeKey[] = ['npc', 'secret', 'session-log', 'player-character'];
        for (const k of keys) {
            expect(isEntityTypeKey(k)).toBe(true);
            expect(getEntityTypeConfig(k)).toBe(ENTITY_TYPE_CONFIG[k]);
        }
        expect(isEntityTypeKey('dragon')).toBe(false);
        expect(isEntityTypeKey('toString')).toBe(false); // no prototype leakage
        expect(getEntityTypeConfig('dragon')).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// createDefaultNote / createDefaultSecret (X10)
// ---------------------------------------------------------------------------

describe('createDefaultNote / createDefaultSecret', () => {
    it('createDefaultNote returns a complete Note with an empty id', () => {
        const note = createDefaultNote();
        expect(note.id).toBe('');
        expect(note.title).toBe('New Note');
        expect(note.content).toBe('');
        expect(note.tags).toEqual([]);
        expect(Number.isNaN(Date.parse(note.createdAt))).toBe(false);
        expect(note.lastModified).toBe(note.createdAt);
    });

    it('createDefaultSecret returns an unrevealed secret with an empty id', () => {
        const secret = createDefaultSecret();
        expect(secret.id).toBe('');
        expect(secret.title).toBe('New Secret');
        expect(secret.category).toBe('secret');
        expect(secret.isRevealed).toBe(false);
        expect(secret.linkedEntityIds).toEqual([]);
        expect(Number.isNaN(Date.parse(secret.createdAt))).toBe(false);
    });

    it('returns fresh arrays on every call', () => {
        expect(createDefaultNote().tags).not.toBe(createDefaultNote().tags);
        expect(createDefaultSecret().linkedEntityIds).not.toBe(createDefaultSecret().linkedEntityIds);
    });
});

// ---------------------------------------------------------------------------
// buildCampaignContext — REMOVED (finding #121): entityUtils no longer
// exports a buildCampaignContext. The single implementation now lives in
// services/contextBuilder.ts (see tests/ship/wp-j-types-utils.dead-context-builder.test.ts).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// buildEntityContext
// ---------------------------------------------------------------------------

describe('buildEntityContext', () => {
    it('builds NPC context with available fields', () => {
        const npc = {
            id: 'n1', name: 'Gandalf', description: 'A wise wizard', traits: 'Enigmatic',
            backstory: 'Ancient spirit', motivations: 'Protect Middle-earth',
            secrets: '', stats: '', exampleQuote: '',
            knowsPlayerHistory: [], relationships: [], history: [],
        };
        const ctx = buildEntityContext('npc', npc);
        expect(ctx).toContain('Name: Gandalf');
        expect(ctx).toContain('Description: A wise wizard');
        expect(ctx).toContain('Traits: Enigmatic');
        expect(ctx).toContain('Motivations: Protect Middle-earth');
        expect(ctx).toContain('Backstory: Ancient spirit');
    });

    it('resolves faction name for NPC when campaign is provided', () => {
        const npc = { id: 'n1', name: 'Guard', factionId: 'f1', description: '', traits: '', backstory: '', motivations: '', secrets: '', stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [] };
        const campaign = makeMinimalCampaign({
            factions: [{ id: 'f1', name: 'City Watch', description: '', goals: '', memberIds: [] }],
        });
        const ctx = buildEntityContext('npc', npc, campaign);
        expect(ctx).toContain('Faction: City Watch');
    });

    it('builds location context', () => {
        const loc = { id: 'l1', name: 'Dark Forest', description: 'Ominous trees', secrets: 'Hidden temple', subLocationIds: [], history: [] };
        const ctx = buildEntityContext('location', loc);
        expect(ctx).toContain('Name: Dark Forest');
        expect(ctx).toContain('Description: Ominous trees');
        expect(ctx).toContain('Secrets: Hidden temple');
    });

    it('builds faction context', () => {
        const faction = { id: 'f1', name: 'Thieves Guild', description: 'Underground org', goals: 'Control the city', alignment: 'Neutral Evil', resources: 'Spy network', memberIds: [] };
        const ctx = buildEntityContext('faction', faction);
        expect(ctx).toContain('Name: Thieves Guild');
        expect(ctx).toContain('Goals: Control the city');
        expect(ctx).toContain('Alignment: Neutral Evil');
        expect(ctx).toContain('Resources: Spy network');
    });

    it('builds item context', () => {
        const item = { id: 'i1', name: 'Holy Sword', rarity: 'legendary', description: 'Glows in the dark', properties: '+3 to hit' };
        const ctx = buildEntityContext('item', item);
        expect(ctx).toContain('Name: Holy Sword');
        expect(ctx).toContain('Rarity: legendary');
        expect(ctx).toContain('Properties: +3 to hit');
    });

    it('builds scene context', () => {
        const scene = { id: 's1', title: 'Ambush', type: 'combat', readAloudText: 'The road narrows...', gmNotes: 'Surprise round', rewards: '100 XP', status: 'planned', skillChecks: [], npcIds: [] };
        const ctx = buildEntityContext('scene', scene);
        expect(ctx).toContain('Title: Ambush');
        expect(ctx).toContain('Type: combat');
        expect(ctx).toContain('Read-Aloud: The road narrows...');
        expect(ctx).toContain('GM Notes: Surprise round');
        expect(ctx).toContain('Rewards: 100 XP');
    });

    it('builds article context with truncated content', () => {
        const longContent = 'A'.repeat(500);
        const article = { id: 'a1', title: 'Lore Entry', category: 'lore', content: longContent, subArticleIds: [] };
        const ctx = buildEntityContext('article', article);
        expect(ctx).toContain('Title: Lore Entry');
        expect(ctx).toContain('Category: lore');
        // Content should be truncated to 300 chars
        const contentLine = ctx.split('\n').find(l => l.startsWith('Content summary:'));
        expect(contentLine!.length).toBeLessThanOrEqual('Content summary: '.length + 300);
    });

    it('builds plot context', () => {
        const plot = { id: 'p1', title: 'Conspiracy', status: 'active', description: 'A dark plot', relatedEntityIds: [] };
        const ctx = buildEntityContext('plot', plot);
        expect(ctx).toContain('Title: Conspiracy');
        expect(ctx).toContain('Status: active');
        expect(ctx).toContain('Description: A dark plot');
    });

    it('builds note context', () => {
        const note = { id: 'no1', title: 'My Note', content: 'Some thoughts', tags: ['Idea', 'Plot'], createdAt: '', lastModified: '' };
        const ctx = buildEntityContext('note', note);
        expect(ctx).toContain('Title: My Note');
        expect(ctx).toContain('Tags: Idea, Plot');
        expect(ctx).toContain('Content: Some thoughts');
    });

    it('falls back to name for unknown entity type', () => {
        const ctx = buildEntityContext('unknown', { name: 'Mystery' });
        expect(ctx).toBe('Name: Mystery');
    });

    it('returns empty string for unknown entity type without name', () => {
        const ctx = buildEntityContext('unknown', {});
        expect(ctx).toBe('');
    });

    it('omits empty fields from NPC context', () => {
        const npc = { id: 'n1', name: 'Bob', description: '', traits: '', backstory: '', motivations: '', secrets: '', stats: '', exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [] };
        const ctx = buildEntityContext('npc', npc);
        expect(ctx).toBe('Name: Bob');
    });

    // X11 extensions — every editor's RegenerateButton now goes through here.
    it('resolves NPC faction from a bare { factions } lookup (NpcEditor has no full campaign)', () => {
        const npc = { id: 'n1', name: 'Guard', factionId: 'f1', description: '', traits: '', backstory: '', motivations: '' };
        const ctx = buildEntityContext('npc', npc, { factions: [{ id: 'f1', name: 'City Watch', description: '', goals: '', memberIds: [] }] });
        expect(ctx).toBe('Name: Guard\nFaction: City Watch');
    });

    it('omits the faction line when the factionId does not resolve', () => {
        const npc = { id: 'n1', name: 'Guard', factionId: 'gone' };
        expect(buildEntityContext('npc', npc, { factions: [] })).toBe('Name: Guard');
    });

    it('includes item type and faction influence', () => {
        expect(buildEntityContext('item', { name: 'Blade', rarity: 'rare', itemType: 'weapon' }))
            .toBe('Name: Blade\nRarity: rare\nType: weapon');
        expect(buildEntityContext('faction', { name: 'Guild', influence: 'Citywide' }))
            .toBe('Name: Guild\nInfluence: Citywide');
    });

    it('builds adventure context', () => {
        const adv = { id: 'a1', title: 'The Sunken Crypt', level: 3, theme: 'Horror', hook: 'A drowned bell tolls', scenes: [] };
        expect(buildEntityContext('adventure', adv))
            .toBe('Title: The Sunken Crypt\nLevel: 3\nTheme: Horror\nHook: A drowned bell tolls');
        expect(buildEntityContext('adventure', { title: 'Bare', level: 1, theme: '', hook: '' }))
            .toBe('Title: Bare\nLevel: 1');
    });

    it('builds secret context', () => {
        const secret = { ...createDefaultSecret(), title: 'The Duke is a lich', content: 'Phylactery in the chapel', category: 'revelation' as const };
        expect(buildEntityContext('secret', secret))
            .toBe('Title: The Duke is a lich\nCategory: revelation\nRevealed: no\nContent: Phylactery in the chapel');
    });

    it('never emits the old "Not specified" filler', () => {
        const ctxs = [
            buildEntityContext('npc', createDefaultNpc()),
            buildEntityContext('location', createDefaultLocation()),
            buildEntityContext('faction', createDefaultFaction()),
            buildEntityContext('item', createDefaultItem()),
            buildEntityContext('adventure', createDefaultAdventure()),
            buildEntityContext('scene', createDefaultScene()),
            buildEntityContext('article', createDefaultArticle()),
            buildEntityContext('plot', createDefaultPlot()),
            buildEntityContext('note', createDefaultNote()),
        ];
        for (const ctx of ctxs) {
            expect(ctx).not.toMatch(/Not specified/i);
            expect(ctx.length).toBeGreaterThan(0);
        }
    });

    it('includes a plot\'s clock and if-ignored move, and an NPC\'s voice notes', () => {
        const plot = { title: 'The Red Tithe', status: 'active', description: '', clock: { segments: 6, filled: 4 }, ifIgnored: 'The mill burns' };
        expect(buildEntityContext('plot', plot))
            .toBe('Title: The Red Tithe\nStatus: active\nClock: 4/6\nIf ignored: The mill burns');
        expect(buildEntityContext('plot', { title: 'T', status: 'dormant', clock: { segments: 0, filled: 0 } }))
            .toBe('Title: T\nStatus: dormant');
        expect(buildEntityContext('npc', { name: 'Mags', voiceNotes: '  gravelly, never finishes a sentence ' }))
            .toBe('Name: Mags\nVoice: gravelly, never finishes a sentence');
    });

    it('falls back to title for unknown title-keyed entities', () => {
        expect(buildEntityContext('unknown', { title: 'Session 4' })).toBe('Title: Session 4');
    });
});

// ---------------------------------------------------------------------------
// estimatePcHp
// ---------------------------------------------------------------------------

describe('estimatePcHp', () => {
    it('calculates HP using CON modifier and level', () => {
        // CON 16 -> mod +3, level 5 -> 10 + 3*5 = 25
        const pc = makePlayerCharacter();
        expect(estimatePcHp(pc)).toBe(25);
    });

    it('handles CON of 10 (modifier 0)', () => {
        const pc = makePlayerCharacter();
        pc.characterStatistics.attributes.constitution = 10;
        pc.characterStatistics.classes.level = 3;
        // mod 0, level 3 -> 10 + 0*3 = 10
        expect(estimatePcHp(pc)).toBe(10);
    });

    it('handles low CON (negative modifier)', () => {
        const pc = makePlayerCharacter();
        pc.characterStatistics.attributes.constitution = 6;
        pc.characterStatistics.classes.level = 2;
        // mod = floor((6-10)/2) = -2, HP = 10 + (-2)*2 = 6
        expect(estimatePcHp(pc)).toBe(6);
    });

    it('enforces minimum of 1 HP', () => {
        const pc = makePlayerCharacter();
        pc.characterStatistics.attributes.constitution = 3;
        pc.characterStatistics.classes.level = 10;
        // mod = floor((3-10)/2) = -4, HP = 10 + (-4)*10 = -30 -> clamped to 1
        expect(estimatePcHp(pc)).toBe(1);
    });

    it('returns 20 when CON is missing', () => {
        const pc = makePlayerCharacter();
        (pc.characterStatistics.attributes as any).constitution = undefined;
        expect(estimatePcHp(pc)).toBe(20);
    });

    it('returns 20 when level is missing', () => {
        const pc = makePlayerCharacter();
        (pc.characterStatistics.classes as any).level = undefined;
        expect(estimatePcHp(pc)).toBe(20);
    });

    it('returns 20 when characterStatistics is undefined', () => {
        const pc = { id: 'pc-1', playerName: 'Bob' } as any;
        expect(estimatePcHp(pc)).toBe(20);
    });
});

// ---------------------------------------------------------------------------
// Default factory functions
// ---------------------------------------------------------------------------

describe('createDefaultNpc', () => {
    it('returns an NPC with empty id and default name', () => {
        const npc = createDefaultNpc();
        expect(npc.id).toBe('');
        expect(npc.name).toBe('New NPC');
    });

    it('has empty arrays for relationships, history, knowsPlayerHistory', () => {
        const npc = createDefaultNpc();
        expect(npc.relationships).toEqual([]);
        expect(npc.history).toEqual([]);
        expect(npc.knowsPlayerHistory).toEqual([]);
    });

    it('has empty strings for all text fields', () => {
        const npc = createDefaultNpc();
        expect(npc.description).toBe('');
        expect(npc.traits).toBe('');
        expect(npc.backstory).toBe('');
        expect(npc.motivations).toBe('');
        expect(npc.secrets).toBe('');
        expect(npc.stats).toBe('');
        expect(npc.exampleQuote).toBe('');
    });
});

describe('createDefaultLocation', () => {
    it('returns a Location with default values', () => {
        const loc = createDefaultLocation();
        expect(loc.id).toBe('');
        expect(loc.name).toBe('New Location');
        expect(loc.description).toBe('');
        expect(loc.secrets).toBe('');
        expect(loc.subLocationIds).toEqual([]);
        expect(loc.connections).toEqual([]);
        expect(loc.pointsOfInterest).toEqual([]);
        expect(loc.loot).toEqual([]);
        expect(loc.history).toEqual([]);
    });
});

describe('createDefaultFaction', () => {
    it('returns a Faction with default values', () => {
        const faction = createDefaultFaction();
        expect(faction.id).toBe('');
        expect(faction.name).toBe('New Faction');
        expect(faction.description).toBe('');
        expect(faction.goals).toBe('');
        expect(faction.alignment).toBe('');
        expect(faction.resources).toBe('');
        expect(faction.influence).toBe('');
        expect(faction.memberIds).toEqual([]);
    });
});

describe('createDefaultItem', () => {
    it('returns an Item with default rarity of common', () => {
        const item = createDefaultItem();
        expect(item.id).toBe('');
        expect(item.name).toBe('New Item');
        expect(item.rarity).toBe('common');
        expect(item.description).toBe('');
        expect(item.properties).toBe('');
    });
});

describe('createDefaultArticle', () => {
    it('returns an Article with default category of lore', () => {
        const article = createDefaultArticle();
        expect(article.id).toBe('');
        expect(article.title).toBe('New Article');
        expect(article.category).toBe('lore');
        expect(article.content).toBe('');
        expect(article.subArticleIds).toEqual([]);
    });
});

describe('createDefaultAdventure', () => {
    it('returns an Adventure with default values', () => {
        const adv = createDefaultAdventure();
        expect(adv.id).toBe('');
        expect(adv.title).toBe('New Adventure');
        expect(adv.level).toBe(1);
        expect(adv.hook).toBe('');
        expect(adv.theme).toBe('');
        expect(adv.scenes).toEqual([]);
    });
});

describe('createDefaultScene', () => {
    it('returns a Scene with default status planned and type social', () => {
        const scene = createDefaultScene();
        expect(scene.id).toBe('');
        expect(scene.title).toBe('New Scene');
        expect(scene.type).toBe('social');
        expect(scene.status).toBe('planned');
        expect(scene.readAloudText).toBe('');
        expect(scene.gmNotes).toBe('');
        expect(scene.skillChecks).toEqual([]);
        expect(scene.rewards).toBe('');
        expect(scene.npcIds).toEqual([]);
    });
});

describe('createDefaultSession', () => {
    it('returns a SessionLog with planned status', () => {
        const session = createDefaultSession();
        expect(session.id).toBe('');
        expect(session.title).toBe('New Session');
        expect(session.status).toBe('planned');
        expect(session.plannedSceneIds).toEqual([]);
        expect(session.structuredNotes).toEqual([]);
        expect(session.encounterLog).toEqual([]);
        expect(session.relatedPlotIds).toEqual([]);
    });

    it('sets sessionDate to current ISO date', () => {
        const before = new Date().toISOString().slice(0, 10);
        const session = createDefaultSession();
        expect(session.sessionDate).toBeTruthy();
        // Should be a valid ISO date string from today
        expect(session.sessionDate.slice(0, 10)).toBe(before);
    });
});

describe('createDefaultPlot', () => {
    it('returns a Plot with active status', () => {
        const plot = createDefaultPlot();
        expect(plot.id).toBe('');
        expect(plot.title).toBe('New Plot Arc');
        expect(plot.description).toBe('');
        expect(plot.status).toBe('active');
        expect(plot.relatedEntityIds).toEqual([]);
    });
});

describe('normalizePlayerCharacter (finding #63)', () => {
    it('backfills a PC missing characterStatistics entirely, preserving parsed fields', () => {
        const malformed = {
            id: 'pc-ghost',
            playerName: 'Riley',
            characterSocial: { characterName: 'Ghost' },
        } as unknown as PlayerCharacter;

        const normalized = normalizePlayerCharacter(malformed);

        expect(normalized.id).toBe('pc-ghost');
        expect(normalized.characterSocial.characterName).toBe('Ghost');
        expect(normalized.characterSocial.species).toBe('');
        expect(normalized.characterStatistics).toBeDefined();
        expect(normalized.characterStatistics.classes).toEqual({ charClass: '', level: 1 });
        expect(normalized.characterStatistics.attributes.strength).toBe(0);
        expect(normalized.characterStatistics.skills.athletics).toBe('none');
        expect(normalized.characterStatistics.actions).toEqual([]);
        expect(normalized.characterStatistics.specialActions).toEqual([]);
    });

    it('preserves fully-populated parsed values verbatim, backfilling nothing', () => {
        const full: PlayerCharacter = {
            id: 'pc-1',
            ...createDefaultPlayerCharacter(),
            playerName: 'Dana',
            characterSocial: {
                characterName: 'Kaelen', background: 'Soldier', species: 'Human',
                personality: 'Stoic', appearance: '', backstory: '', ideals: '', bonds: '', flaws: '',
            },
            characterStatistics: {
                classes: { charClass: 'Fighter', subclass: 'Champion', level: 3 },
                attributes: { strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 11, charisma: 8 },
                skills: { ...createDefaultPlayerCharacter().characterStatistics.skills, athletics: 'proficient' },
                actions: ['Longsword'],
                specialActions: ['Second Wind'],
            },
        };

        const normalized = normalizePlayerCharacter(full);
        expect(normalized).toEqual(full);
    });

    it('backfills only the missing nested sub-object, keeping siblings untouched', () => {
        const partial = {
            id: 'pc-2',
            playerName: 'Sam',
            characterSocial: {
                characterName: 'Nameless Wanderer', background: '', species: '',
                personality: '', appearance: '', backstory: '', ideals: '', bonds: '', flaws: '',
            },
            characterStatistics: {
                classes: { charClass: 'Rogue', level: 5 },
                attributes: { strength: 8, dexterity: 18, constitution: 12, intelligence: 14, wisdom: 10, charisma: 13 },
                skills: {},
                // actions/specialActions omitted
            },
        } as unknown as PlayerCharacter;

        const normalized = normalizePlayerCharacter(partial);
        expect(normalized.characterStatistics.classes).toEqual({ charClass: 'Rogue', level: 5 });
        expect(normalized.characterStatistics.attributes.dexterity).toBe(18);
        expect(normalized.characterStatistics.actions).toEqual([]);
        expect(normalized.characterStatistics.specialActions).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Factory isolation — each call produces a fresh object
// ---------------------------------------------------------------------------

describe('factory isolation', () => {
    it('createDefaultNpc returns independent objects', () => {
        const a = createDefaultNpc();
        const b = createDefaultNpc();
        a.name = 'Modified';
        expect(b.name).toBe('New NPC');
    });

    it('createDefaultFaction returns independent objects', () => {
        const a = createDefaultFaction();
        const b = createDefaultFaction();
        a.memberIds.push('x');
        expect(b.memberIds).toEqual([]);
    });
});
