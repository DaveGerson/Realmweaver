/**
 * SPEC — Wave 2, lane SECRETS (E1): the fourth stop of the N-place integrity
 * contract — `utils/backlinkUtils.ts` surfaces the inbound clue→revelation edge.
 *
 * `computeBacklinks(entityId, entityType, campaign)` currently has no `'secret'`
 * case, so it falls through to `default: return {}` and a revelation shows
 * "nothing references this" even when three clues visibly point at it. This
 * lane adds the case.
 *
 * THE ONE DEFINITION USED EVERYWHERE IN THIS LANE — an "inbound clue" of a
 * secret S is any secret whose `revealsSecretId === S.id`, whatever its own
 * category. Keying the edge on the field rather than on `category` means a
 * mis-categorised import cannot make an edge silently invisible; the picker in
 * `SecretsTracker` is what restricts *writing* the field to clue cards. The
 * lints (`tests/mysteryEdges.continuity.test.ts`) and the tracker's inbound
 * count use the same definition.
 *
 * `computeBacklinks(secretId, 'secret', campaign)` returns:
 *
 * 1. **Inbound clues**, grouped under `'secret'`, one `BacklinkEntry` per
 *    pointing secret: `{ id, name: <its title>, entityType: 'secret',
 *    relationshipLabel: 'Clue for' }`. As with every other group, entries are
 *    sorted alphabetically by name.
 * 2. **Articles and plots** whose `relatedEntityIds` contain the secret id,
 *    labelled `'Referenced by'` — `continuityChecker`'s broken-reference rule
 *    already treats a secret id as a legitimate `Article.relatedEntityIds`
 *    target, so that edge must be visible from the secret's side too.
 *
 * A secret pointing at itself is never reported as its own backlink. A secret
 * with no inbound edges returns `{}` — empty groups are dropped, as everywhere
 * else in this module. `campaign.secrets` may legitimately be `undefined` on an
 * older save, and that is not a crash. @-mentions are deliberately out of
 * scope: `MentionInput`'s candidate list has no secrets, so a secret can never
 * be an @-mention target.
 *
 * Every other entity type's backlinks are unchanged by this lane.
 */

import { describe, it, expect } from 'vitest';
import { computeBacklinks } from '../utils/backlinkUtils';
import type { Campaign } from '../types/Campaign';
import type { Secret } from '../types/Secret';
import type { Article } from '../types/Article';
import type { Plot } from '../types/Plot';
import type { NPC } from '../types/NPC';

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

function makeSecret(overrides: Partial<Secret> = {}): Secret {
    return {
        id: 'sec-1',
        title: 'A secret',
        content: 'Content.',
        category: 'secret',
        isRevealed: false,
        createdAt: '2026-05-01T00:00:00.000Z',
        ...overrides,
    };
}

function makeArticle(overrides: Partial<Article> = {}): Article {
    return {
        id: 'art-1', title: 'An article', category: 'lore', content: '', subArticleIds: [],
        ...overrides,
    };
}

function makePlot(overrides: Partial<Plot> = {}): Plot {
    return {
        id: 'plot-1', title: 'A plot', description: '', status: 'active', relatedEntityIds: [],
        ...overrides,
    };
}

function makeNpc(overrides: Partial<NPC> = {}): NPC {
    return {
        id: 'npc-1', name: 'An NPC', description: '', traits: '',
        backstory: '', motivations: '', secrets: '', stats: '',
        exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
        ...overrides,
    };
}

const REVELATION = makeSecret({
    id: 'rev-1',
    title: 'The Duke is the drowned god',
    category: 'revelation',
});

// ---------------------------------------------------------------------------

describe('computeBacklinks — a revelation shows its inbound clues', () => {
    it('lists every secret whose revealsSecretId points at it', () => {
        const campaign = makeCampaign({
            secrets: [
                REVELATION,
                makeSecret({ id: 'clue-1', title: 'The wet footprints', category: 'clue', revealsSecretId: 'rev-1' }),
                makeSecret({ id: 'clue-2', title: 'The sealed casket', category: 'clue', revealsSecretId: 'rev-1' }),
            ],
        });

        const result = computeBacklinks('rev-1', 'secret', campaign);

        expect(result.secret).toBeDefined();
        expect(result.secret.map(e => e.id).sort()).toEqual(['clue-1', 'clue-2']);
        expect(result.secret.every(e => e.relationshipLabel === 'Clue for')).toBe(true);
        expect(result.secret.every(e => e.entityType === 'secret')).toBe(true);
    });

    it('uses the pointing secret\'s title as the entry name', () => {
        const campaign = makeCampaign({
            secrets: [
                REVELATION,
                makeSecret({ id: 'clue-1', title: 'The wet footprints', category: 'clue', revealsSecretId: 'rev-1' }),
            ],
        });

        expect(computeBacklinks('rev-1', 'secret', campaign).secret[0].name)
            .toBe('The wet footprints');
    });

    it('sorts the group alphabetically by name, like every other group', () => {
        const campaign = makeCampaign({
            secrets: [
                REVELATION,
                makeSecret({ id: 'clue-z', title: 'Zephyr in the crypt', category: 'clue', revealsSecretId: 'rev-1' }),
                makeSecret({ id: 'clue-a', title: 'A ledger with nine blank pages', category: 'clue', revealsSecretId: 'rev-1' }),
                makeSecret({ id: 'clue-m', title: 'Mud on the marble', category: 'clue', revealsSecretId: 'rev-1' }),
            ],
        });

        expect(computeBacklinks('rev-1', 'secret', campaign).secret.map(e => e.name)).toEqual([
            'A ledger with nine blank pages',
            'Mud on the marble',
            'Zephyr in the crypt',
        ]);
    });

    it('counts an edge whatever category the pointing secret carries', () => {
        // A mis-categorised import must not make the edge invisible.
        const campaign = makeCampaign({
            secrets: [
                REVELATION,
                makeSecret({ id: 'rum-1', title: 'A rumour that happens to point', category: 'rumor', revealsSecretId: 'rev-1' }),
            ],
        });

        expect(computeBacklinks('rev-1', 'secret', campaign).secret.map(e => e.id)).toEqual(['rum-1']);
    });

    it('ignores clues that point at a different revelation', () => {
        const campaign = makeCampaign({
            secrets: [
                REVELATION,
                makeSecret({ id: 'rev-2', title: 'Another revelation', category: 'revelation' }),
                makeSecret({ id: 'clue-1', title: 'Points elsewhere', category: 'clue', revealsSecretId: 'rev-2' }),
            ],
        });

        expect(computeBacklinks('rev-1', 'secret', campaign)).toEqual({});
    });

    it('never reports a self-reference as its own backlink', () => {
        const campaign = makeCampaign({
            secrets: [makeSecret({ id: 'rev-1', title: 'A loop', category: 'revelation', revealsSecretId: 'rev-1' })],
        });

        expect(computeBacklinks('rev-1', 'secret', campaign)).toEqual({});
    });

    it('returns an empty object for a secret nothing points at', () => {
        const campaign = makeCampaign({
            secrets: [
                REVELATION,
                makeSecret({ id: 'clue-1', title: 'An unattached clue', category: 'clue' }),
            ],
        });

        expect(computeBacklinks('rev-1', 'secret', campaign)).toEqual({});
    });
});

describe('computeBacklinks — a secret shows the articles and plots that reference it', () => {
    it('reports an article whose relatedEntityIds contain the secret', () => {
        const campaign = makeCampaign({
            secrets: [REVELATION],
            articles: [makeArticle({ id: 'art-1', title: 'On the drowning of dukes', relatedEntityIds: ['rev-1'] })],
        });

        const result = computeBacklinks('rev-1', 'secret', campaign);

        expect(result.article).toEqual([
            { id: 'art-1', name: 'On the drowning of dukes', entityType: 'article', relationshipLabel: 'Referenced by' },
        ]);
    });

    it('reports a plot whose relatedEntityIds contain the secret', () => {
        const campaign = makeCampaign({
            secrets: [REVELATION],
            plots: [makePlot({ id: 'plot-1', title: 'The Sunken Succession', relatedEntityIds: ['rev-1'] })],
        });

        expect(computeBacklinks('rev-1', 'secret', campaign).plot).toEqual([
            { id: 'plot-1', name: 'The Sunken Succession', entityType: 'plot', relationshipLabel: 'Referenced by' },
        ]);
    });

    it('reports clue and reference groups side by side', () => {
        const campaign = makeCampaign({
            secrets: [
                REVELATION,
                makeSecret({ id: 'clue-1', title: 'The wet footprints', category: 'clue', revealsSecretId: 'rev-1' }),
            ],
            articles: [makeArticle({ id: 'art-1', title: 'On drowning', relatedEntityIds: ['rev-1'] })],
        });

        const result = computeBacklinks('rev-1', 'secret', campaign);

        expect(Object.keys(result).sort()).toEqual(['article', 'secret']);
    });
});

describe('computeBacklinks — degenerate inputs', () => {
    it('does not throw when the campaign has no secrets array at all', () => {
        const campaign = makeCampaign({ secrets: undefined });

        expect(() => computeBacklinks('rev-1', 'secret', campaign)).not.toThrow();
        expect(computeBacklinks('rev-1', 'secret', campaign)).toEqual({});
    });

    it('returns an empty object for an id that matches no secret', () => {
        const campaign = makeCampaign({ secrets: [REVELATION] });

        expect(computeBacklinks('not-a-secret-at-all', 'secret', campaign)).toEqual({});
    });

    it('still returns {} for an entity type with no case', () => {
        const campaign = makeCampaign({ secrets: [REVELATION] });

        expect(computeBacklinks('rev-1', 'encounter', campaign)).toEqual({});
    });
});

describe('computeBacklinks — no regression for the existing entity types', () => {
    it('still resolves an NPC\'s inbound plot reference', () => {
        const campaign = makeCampaign({
            npcs: [makeNpc({ id: 'npc-1', name: 'The Harbourmaster' })],
            plots: [makePlot({ id: 'plot-1', title: 'The Sunken Succession', relatedEntityIds: ['npc-1'] })],
            secrets: [makeSecret({ id: 'clue-1', category: 'clue', revealsSecretId: 'npc-1' })],
        });

        const result = computeBacklinks('npc-1', 'npc', campaign);

        // The NPC scanner is unchanged: it reports the plot, and a stray secret
        // edge pointed at a non-secret id does not leak into the NPC's groups.
        expect(result.plot).toHaveLength(1);
        expect(result.secret).toBeUndefined();
    });
});
