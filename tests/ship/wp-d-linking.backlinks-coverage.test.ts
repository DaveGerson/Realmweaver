/**
 * wp-d-linking — findings #46, #47, #48
 *
 * `computeBacklinks` in utils/backlinkUtils.ts:
 *   #46 falls through to `default: return {}` for entity types that DO mount
 *       BacklinksPanel — 'session-log' (SessionLogEditor), 'player-character'
 *       (PlayerCharacterEditor) and 'note' (NoteEditor) — so those three
 *       editors always claim "No other entities reference this one".
 *   #47 computeBacklinksForAdventure never scans mentionedEntityIds at all,
 *       even though adventures ARE @-mention candidates
 *       (MentionInput.buildAllMentionCandidates includes them).
 *   #48 the per-type @-mention sweeps are copy-pasted inconsistently:
 *       item omits campaign.factions; article and plot omit scenes.
 *
 * Contract: any entity that can be the TARGET of an @-mention must see that
 * mention as a "Mentioned in" backlink, from every source type that can hold
 * mentionedEntityIds (npcs, locations, factions, items, articles, plots,
 * scenes); and every entity type BacklinksPanel is mounted for must be able to
 * report inbound relatedEntityIds references.
 */

import { describe, it, expect } from 'vitest';
import { computeBacklinks } from '../../utils/backlinkUtils';
import type { Campaign } from '../../types/Campaign';
import type { NPC } from '../../types/NPC';
import type { Location } from '../../types/Location';
import type { Faction } from '../../types/Faction';
import type { Item } from '../../types/Item';
import type { Adventure } from '../../types/Adventure';
import type { Article } from '../../types/Article';
import type { Plot } from '../../types/Plot';
import type { Scene } from '../../types/Scene';
import type { SessionLog } from '../../types/SessionLog';

// ── Fixture helpers (mirrors tests/backlinkUtils.test.ts) ────────────────────

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
    } as Campaign;
}

function makeNpc(overrides: Partial<NPC> = {}): NPC {
    return {
        id: 'npc-1', name: 'Sera', description: '', traits: '',
        backstory: '', motivations: '', secrets: '', stats: '',
        exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
        ...overrides,
    };
}

function makeLocation(overrides: Partial<Location> = {}): Location {
    return {
        id: 'loc-1', name: 'Salvation', description: '', secrets: '',
        subLocationIds: [], history: [],
        ...overrides,
    };
}

function makeFaction(overrides: Partial<Faction> = {}): Faction {
    return {
        id: 'fac-1', name: 'The Guild', description: '', goals: '', memberIds: [],
        ...overrides,
    };
}

function makeItem(overrides: Partial<Item> = {}): Item {
    return {
        id: 'item-1', name: 'Blade of Nine Eyes', description: '', rarity: 'common', properties: '',
        ...overrides,
    };
}

function makeScene(overrides: Partial<Scene> = {}): Scene {
    return {
        id: 'scene-1', title: 'The Ambush', type: 'combat', status: 'planned',
        readAloudText: '', gmNotes: '', skillChecks: [], rewards: '', npcIds: [],
        ...overrides,
    };
}

function makeAdventure(overrides: Partial<Adventure> = {}): Adventure {
    return {
        id: 'adv-1', title: 'Curse of the Crimson Throne', level: 1, hook: '', theme: '', scenes: [],
        ...overrides,
    };
}

function makeArticle(overrides: Partial<Article> = {}): Article {
    return {
        id: 'art-1', title: 'The Sundering', category: 'lore', content: '', subArticleIds: [],
        ...overrides,
    };
}

function makePlot(overrides: Partial<Plot> = {}): Plot {
    return {
        id: 'plot-1', title: 'The Crimson Plot', description: '', status: 'active', relatedEntityIds: [],
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

function flatten(groups: Record<string, { id: string }[]>): string[] {
    return Object.values(groups).flat().map(e => e.id);
}

// ── #46 — types BacklinksPanel is mounted for but computeBacklinks ignores ──

describe('wp-d-linking #46 — backlinks must work for session-log / player-character / note', () => {
    it('finds an article that references a player character via relatedEntityIds', () => {
        const pc = { id: 'pc-1', characterSocial: { characterName: 'Vex' } } as any;
        const campaign = makeCampaign({
            playerCharacters: [pc],
            articles: [makeArticle({ relatedEntityIds: ['pc-1'] })],
        });

        const result = computeBacklinks('pc-1', 'player-character', campaign);
        expect(flatten(result)).toContain('art-1');
    });

    it('finds an article that references a session log via relatedEntityIds', () => {
        const campaign = makeCampaign({
            sessionLogs: [makeSessionLog()],
            articles: [makeArticle({ relatedEntityIds: ['sl-1'] })],
        });

        const result = computeBacklinks('sl-1', 'session-log', campaign);
        expect(flatten(result)).toContain('art-1');
    });

    it('finds an article that references a note via relatedEntityIds', () => {
        const note = {
            id: 'note-1', title: 'Table notes', content: '', tags: [],
            createdAt: '2026-01-01', lastModified: '2026-01-01',
        };
        const campaign = makeCampaign({
            notes: [note],
            articles: [makeArticle({ relatedEntityIds: ['note-1'] })],
        });

        const result = computeBacklinks('note-1', 'note', campaign);
        expect(flatten(result)).toContain('art-1');
    });
});

// ── #47 — adventures are mention targets but have no mention sweep ──────────

describe('wp-d-linking #47 — adventure backlinks must include @-mentions', () => {
    it('lists NPCs and plots that @-mention the adventure, alongside existing session-log links', () => {
        const campaign = makeCampaign({
            adventures: [makeAdventure()],
            npcs: [makeNpc({ id: 'npc-1', name: 'Sera', mentionedEntityIds: ['adv-1'] } as Partial<NPC>)],
            plots: [makePlot({ mentionedEntityIds: ['adv-1'] } as Partial<Plot>)],
            sessionLogs: [makeSessionLog({ adventureId: 'adv-1' } as Partial<SessionLog>)],
        });

        const result = computeBacklinks('adv-1', 'adventure', campaign);

        // existing behaviour must survive the fix
        expect(flatten(result)).toContain('sl-1');
        // @-mention sweep is missing today
        expect(flatten(result)).toContain('npc-1');
        expect(flatten(result)).toContain('plot-1');
        expect(result.npc?.[0].relationshipLabel).toBe('Mentioned in');
    });
});

// ── #48 — inconsistent per-type mention source lists ────────────────────────

describe('wp-d-linking #48 — every mention source type must be scanned', () => {
    it('item backlinks include factions that @-mention the item', () => {
        const campaign = makeCampaign({
            items: [makeItem()],
            factions: [makeFaction({ mentionedEntityIds: ['item-1'] } as Partial<Faction>)],
        });

        const result = computeBacklinks('item-1', 'item', campaign);
        expect(flatten(result)).toContain('fac-1');
        expect(result.faction?.[0].relationshipLabel).toBe('Mentioned in');
    });

    it('article backlinks include scenes that @-mention the article', () => {
        const scene = makeScene({ mentionedEntityIds: ['art-1'] });
        const campaign = makeCampaign({
            articles: [makeArticle()],
            adventures: [makeAdventure({ scenes: [scene] })],
        });

        const result = computeBacklinks('art-1', 'article', campaign);
        expect(flatten(result)).toContain('scene-1');
    });

    it('plot backlinks include scenes that @-mention the plot', () => {
        const scene = makeScene({ mentionedEntityIds: ['plot-1'] });
        const campaign = makeCampaign({
            plots: [makePlot()],
            adventures: [makeAdventure({ scenes: [scene] })],
        });

        const result = computeBacklinks('plot-1', 'plot', campaign);
        expect(flatten(result)).toContain('scene-1');
    });
});
