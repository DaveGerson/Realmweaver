/**
 * SPEC — Wave 2, lane SECRETS (E2): the mystery lint family, plus the
 * broken-reference stop of the E1 integrity contract.
 *
 * `services/continuityChecker.ts` gains four rules and one extension, all in
 * the existing pure-function idiom: every issue carries `severity`, `ruleId`,
 * a plain-sentence `title` and `description`, parallel `entityIds` /
 * `entityTypes` arrays, and a `suggestedFix` phrased as an action the GM can
 * actually take in this app. `checkContinuity` stays pure and total — it never
 * throws, never mutates, and reads `campaign.secrets ?? []` because that array
 * is legitimately absent on an older save.
 *
 * SHARED DEFINITIONS (identical to the backlink scanner and the tracker badge):
 *   - "revelation" = a secret with `category === 'revelation'`.
 *   - "inbound clue of S" = any secret whose `revealsSecretId === S.id`,
 *     whatever its own category. A self-reference does not count.
 *   - unrevealed = `isRevealed` is falsy. `undefined` counts as unrevealed, so
 *     a secret written before `isRevealed` was always populated is treated as
 *     hidden, never as told.
 *   - the three-clue threshold of a revelation R is `R.cluesNeeded ?? 3`.
 *
 * THE RULES
 *
 * 1. `three-clue` (warning). A VITAL, UNREVEALED revelation with FEWER than
 *    `cluesNeeded ?? 3` inbound clues — but at least one. Zero inbound clues is
 *    deliberately excluded: `unreachable-revelation` already reports that case
 *    at error severity and says it more strongly, and one revelation must not
 *    produce two issues saying the same thing. A non-vital revelation is never
 *    reported by this rule (E5: GM craft is lint, and only where the GM has
 *    said the mystery depends on it).
 *
 * 2. `unreachable-revelation` (error). An UNREVEALED revelation with ZERO
 *    inbound clues — vital or not. Nothing in the campaign can lead the party
 *    to it.
 *
 * 3. `undeliverable-secret` (warning). ANY unrevealed secret — every category —
 *    whose `linkedEntityIds` is empty or absent AND which has zero inbound
 *    clues. No NPC, location, item or clue in the world can ever surface it.
 *    This rule and rule 2 may both fire on the same brand-new revelation: they
 *    are different findings (no clue structure vs. no anchor in the world) and
 *    both are actionable.
 *
 * 4. `revelation-without-revealed-clues` (info). A REVEALED revelation that has
 *    at least one inbound clue and none of those clues is revealed. The party
 *    learned it some other way — worth confirming. A revealed revelation with
 *    no clues at all is not reported: "none of its clues are revealed" is
 *    vacuous with zero clues.
 *
 * 5. `broken-ref` (error, the existing rule extended). A secret whose
 *    `revealsSecretId` is set but names no secret in the campaign. Validated
 *    wherever the field appears, whatever the holder's category — an id-bearing
 *    field is checked by its presence, not by the category it is "meant" for.
 *
 * A campaign with no secrets array, an empty one, or only already-revealed
 * secrets produces none of these issues. `three-clue` and
 * `revelation-without-revealed-clues` further require actual use of the new
 * fields to fire at all — but `unreachable-revelation` and
 * `undeliverable-secret` key off pre-existing fields (`category`,
 * `isRevealed`, `linkedEntityIds`) and so DO fire against an old save that
 * never touched a new field, whenever it genuinely has an unreachable
 * revelation or an unlinked secret. That is intended: see the "silence by
 * default" tests below for the narrower, actually-silent cases, and the rule
 * suites further down for the deliberately-still-loud ones.
 */

import { describe, it, expect } from 'vitest';
import { checkContinuity, type ContinuityIssue } from '../services/continuityChecker';
import type { Campaign } from '../types/Campaign';
import type { Secret } from '../types/Secret';

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
        // Anchored by default so the undeliverable rule doesn't fire in every
        // fixture that isn't about it.
        linkedEntityIds: ['npc-anchor'],
        createdAt: '2026-05-01T00:00:00.000Z',
        ...overrides,
    };
}

const byRule = (issues: ContinuityIssue[], ruleId: string) =>
    issues.filter(i => i.ruleId === ruleId);

/** A vital revelation with `n` inbound clues, all anchored. */
function mysteryWith(n: number, revelationOverrides: Partial<Secret> = {}): Secret[] {
    const clues: Secret[] = [];
    for (let i = 0; i < n; i++) {
        clues.push(makeSecret({
            id: `clue-${i}`,
            title: `Clue ${i}`,
            category: 'clue',
            revealsSecretId: 'rev-1',
        }));
    }
    return [
        makeSecret({
            id: 'rev-1',
            title: 'The Duke is the drowned god',
            category: 'revelation',
            isVital: true,
            ...revelationOverrides,
        }),
        ...clues,
    ];
}

// ---------------------------------------------------------------------------
// Nothing fires on campaigns that never opted in
// ---------------------------------------------------------------------------

describe('mystery lints — silence by default', () => {
    const MYSTERY_RULES = [
        'three-clue',
        'unreachable-revelation',
        'undeliverable-secret',
        'revelation-without-revealed-clues',
    ];

    it('reports nothing on a campaign with no secrets array', () => {
        const issues = checkContinuity(makeCampaign());

        expect(issues.filter(i => MYSTERY_RULES.includes(i.ruleId))).toEqual([]);
    });

    it('reports nothing on an empty secrets array', () => {
        const issues = checkContinuity(makeCampaign({ secrets: [] }));

        expect(issues.filter(i => MYSTERY_RULES.includes(i.ruleId))).toEqual([]);
    });

    it('reports nothing about a revealed, anchored secret carrying none of the new fields', () => {
        const issues = checkContinuity(makeCampaign({
            secrets: [makeSecret({ id: 'sec-1', isRevealed: true })],
        }));

        expect(issues.filter(i => MYSTERY_RULES.includes(i.ruleId))).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// 1. Three-Clue Rule
// ---------------------------------------------------------------------------

describe('three-clue — a vital revelation needs enough clues', () => {
    it('warns when a vital unrevealed revelation has fewer than three clues', () => {
        const issues = checkContinuity(makeCampaign({ secrets: mysteryWith(2) }));
        const found = byRule(issues, 'three-clue');

        expect(found).toHaveLength(1);
        expect(found[0].severity).toBe('warning');
        expect(found[0].entityIds).toEqual(['rev-1']);
        expect(found[0].entityTypes).toEqual(['secret']);
        expect(found[0].description).toContain('The Duke is the drowned god');
        expect(found[0].suggestedFix).toBeTruthy();
    });

    it('stays silent at exactly three clues', () => {
        const issues = checkContinuity(makeCampaign({ secrets: mysteryWith(3) }));

        expect(byRule(issues, 'three-clue')).toEqual([]);
    });

    it('stays silent above three clues', () => {
        const issues = checkContinuity(makeCampaign({ secrets: mysteryWith(5) }));

        expect(byRule(issues, 'three-clue')).toEqual([]);
    });

    it('honours a per-revelation cluesNeeded override upward', () => {
        // Four needed, three present.
        const issues = checkContinuity(makeCampaign({ secrets: mysteryWith(3, { cluesNeeded: 4 }) }));

        expect(byRule(issues, 'three-clue')).toHaveLength(1);
    });

    it('honours a per-revelation cluesNeeded override downward', () => {
        // Two needed, two present.
        const issues = checkContinuity(makeCampaign({ secrets: mysteryWith(2, { cluesNeeded: 2 }) }));

        expect(byRule(issues, 'three-clue')).toEqual([]);
    });

    it('treats an absent cluesNeeded as three', () => {
        const withField = checkContinuity(makeCampaign({ secrets: mysteryWith(2, { cluesNeeded: 3 }) }));
        const withoutField = checkContinuity(makeCampaign({ secrets: mysteryWith(2) }));

        expect(byRule(withField, 'three-clue')).toHaveLength(byRule(withoutField, 'three-clue').length);
    });

    it('never fires on a revelation that is not marked vital', () => {
        const issues = checkContinuity(makeCampaign({ secrets: mysteryWith(1, { isVital: undefined }) }));

        expect(byRule(issues, 'three-clue')).toEqual([]);
    });

    it('never fires on a revelation that is already revealed', () => {
        const issues = checkContinuity(makeCampaign({ secrets: mysteryWith(1, { isRevealed: true }) }));

        expect(byRule(issues, 'three-clue')).toEqual([]);
    });

    it('does NOT double-report a vital revelation with zero clues — that is the unreachable error', () => {
        const issues = checkContinuity(makeCampaign({ secrets: mysteryWith(0) }));

        expect(byRule(issues, 'three-clue')).toEqual([]);
        expect(byRule(issues, 'unreachable-revelation')).toHaveLength(1);
    });

    it('counts an inbound edge whatever category the pointing secret carries', () => {
        const issues = checkContinuity(makeCampaign({
            secrets: [
                makeSecret({ id: 'rev-1', title: 'A revelation', category: 'revelation', isVital: true, cluesNeeded: 1 }),
                makeSecret({ id: 'rum-1', title: 'A rumour that points', category: 'rumor', revealsSecretId: 'rev-1' }),
            ],
        }));

        expect(byRule(issues, 'three-clue')).toEqual([]);
    });

    it('reports each under-supplied vital revelation separately', () => {
        const issues = checkContinuity(makeCampaign({
            secrets: [
                makeSecret({ id: 'rev-1', title: 'First truth', category: 'revelation', isVital: true }),
                makeSecret({ id: 'rev-2', title: 'Second truth', category: 'revelation', isVital: true }),
                makeSecret({ id: 'c-1', title: 'Clue one', category: 'clue', revealsSecretId: 'rev-1' }),
                makeSecret({ id: 'c-2', title: 'Clue two', category: 'clue', revealsSecretId: 'rev-2' }),
            ],
        }));
        const found = byRule(issues, 'three-clue');

        expect(found).toHaveLength(2);
        expect(found.map(i => i.entityIds[0]).sort()).toEqual(['rev-1', 'rev-2']);
        // Issue ids are unique within a run (the existing makeId contract).
        expect(new Set(found.map(i => i.id)).size).toBe(2);
    });
});

// ---------------------------------------------------------------------------
// 2. Unreachable revelation
// ---------------------------------------------------------------------------

describe('unreachable-revelation — nothing points at it', () => {
    it('errors on an unrevealed revelation with no inbound clues', () => {
        const issues = checkContinuity(makeCampaign({
            secrets: [makeSecret({ id: 'rev-1', title: 'The drowned god', category: 'revelation' })],
        }));
        const found = byRule(issues, 'unreachable-revelation');

        expect(found).toHaveLength(1);
        expect(found[0].severity).toBe('error');
        expect(found[0].entityIds).toEqual(['rev-1']);
        expect(found[0].entityTypes).toEqual(['secret']);
        expect(found[0].description).toContain('The drowned god');
        expect(found[0].suggestedFix).toBeTruthy();
    });

    it('fires on a non-vital revelation too', () => {
        const issues = checkContinuity(makeCampaign({
            secrets: [makeSecret({ id: 'rev-1', category: 'revelation', isVital: false })],
        }));

        expect(byRule(issues, 'unreachable-revelation')).toHaveLength(1);
    });

    it('treats an undefined isRevealed as unrevealed', () => {
        const legacy = { ...makeSecret({ id: 'rev-1', category: 'revelation' }) } as Secret;
        delete (legacy as Partial<Secret>).isRevealed;

        expect(byRule(checkContinuity(makeCampaign({ secrets: [legacy] })), 'unreachable-revelation'))
            .toHaveLength(1);
    });

    it('stays silent once a single clue points at it', () => {
        const issues = checkContinuity(makeCampaign({ secrets: mysteryWith(1) }));

        expect(byRule(issues, 'unreachable-revelation')).toEqual([]);
    });

    it('stays silent on a revealed revelation', () => {
        const issues = checkContinuity(makeCampaign({
            secrets: [makeSecret({ id: 'rev-1', category: 'revelation', isRevealed: true })],
        }));

        expect(byRule(issues, 'unreachable-revelation')).toEqual([]);
    });

    it('never fires on a non-revelation category', () => {
        const issues = checkContinuity(makeCampaign({
            secrets: [
                makeSecret({ id: 's-1', category: 'secret' }),
                makeSecret({ id: 's-2', category: 'clue' }),
                makeSecret({ id: 's-3', category: 'rumor' }),
            ],
        }));

        expect(byRule(issues, 'unreachable-revelation')).toEqual([]);
    });

    it('does not count a self-reference as an inbound clue', () => {
        const issues = checkContinuity(makeCampaign({
            secrets: [makeSecret({ id: 'rev-1', category: 'revelation', revealsSecretId: 'rev-1' })],
        }));

        expect(byRule(issues, 'unreachable-revelation')).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// 3. Undeliverable secret
// ---------------------------------------------------------------------------

describe('undeliverable-secret — nothing in the world can surface it', () => {
    it('warns on an unrevealed secret with no links and no inbound clue', () => {
        const issues = checkContinuity(makeCampaign({
            secrets: [makeSecret({ id: 's-1', title: 'A truth with no carrier', linkedEntityIds: [] })],
        }));
        const found = byRule(issues, 'undeliverable-secret');

        expect(found).toHaveLength(1);
        expect(found[0].severity).toBe('warning');
        expect(found[0].entityIds).toEqual(['s-1']);
        expect(found[0].entityTypes).toEqual(['secret']);
        expect(found[0].description).toContain('A truth with no carrier');
        expect(found[0].suggestedFix).toBeTruthy();
    });

    it('treats an absent linkedEntityIds array the same as an empty one', () => {
        const secret = makeSecret({ id: 's-1' });
        delete (secret as Partial<Secret>).linkedEntityIds;

        expect(byRule(checkContinuity(makeCampaign({ secrets: [secret] })), 'undeliverable-secret'))
            .toHaveLength(1);
    });

    it('stays silent once the secret is linked to anything', () => {
        const issues = checkContinuity(makeCampaign({
            secrets: [makeSecret({ id: 's-1', linkedEntityIds: ['npc-1'] })],
        }));

        expect(byRule(issues, 'undeliverable-secret')).toEqual([]);
    });

    it('stays silent when an inbound clue can deliver it, even with no links', () => {
        const issues = checkContinuity(makeCampaign({
            secrets: [
                makeSecret({ id: 'rev-1', category: 'revelation', linkedEntityIds: [] }),
                makeSecret({ id: 'clue-1', category: 'clue', revealsSecretId: 'rev-1' }),
            ],
        }));

        expect(byRule(issues, 'undeliverable-secret').map(i => i.entityIds[0])).not.toContain('rev-1');
    });

    it('stays silent on a revealed secret', () => {
        const issues = checkContinuity(makeCampaign({
            secrets: [makeSecret({ id: 's-1', isRevealed: true, linkedEntityIds: [] })],
        }));

        expect(byRule(issues, 'undeliverable-secret')).toEqual([]);
    });

    it('applies to every category, not just revelations', () => {
        const issues = checkContinuity(makeCampaign({
            secrets: [
                makeSecret({ id: 's-1', category: 'secret', linkedEntityIds: [] }),
                makeSecret({ id: 's-2', category: 'clue', linkedEntityIds: [] }),
                makeSecret({ id: 's-3', category: 'rumor', linkedEntityIds: [] }),
            ],
        }));

        expect(byRule(issues, 'undeliverable-secret').map(i => i.entityIds[0]).sort())
            .toEqual(['s-1', 's-2', 's-3']);
    });

    it('co-fires with the unreachable error on a brand-new unanchored revelation', () => {
        // Deliberate: the two rules report different problems, and both are
        // actionable. Neither suppresses the other.
        const issues = checkContinuity(makeCampaign({
            secrets: [makeSecret({ id: 'rev-1', category: 'revelation', linkedEntityIds: [] })],
        }));

        expect(byRule(issues, 'unreachable-revelation')).toHaveLength(1);
        expect(byRule(issues, 'undeliverable-secret')).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// 4. Revealed revelation whose clues are all still hidden
// ---------------------------------------------------------------------------

describe('revelation-without-revealed-clues — the party got there another way', () => {
    it('reports at info severity when a revealed revelation has only unrevealed clues', () => {
        const issues = checkContinuity(makeCampaign({
            secrets: [
                makeSecret({ id: 'rev-1', title: 'The drowned god', category: 'revelation', isRevealed: true }),
                makeSecret({ id: 'clue-1', category: 'clue', revealsSecretId: 'rev-1', isRevealed: false }),
                makeSecret({ id: 'clue-2', category: 'clue', revealsSecretId: 'rev-1', isRevealed: false }),
            ],
        }));
        const found = byRule(issues, 'revelation-without-revealed-clues');

        expect(found).toHaveLength(1);
        expect(found[0].severity).toBe('info');
        expect(found[0].entityIds).toEqual(['rev-1']);
        expect(found[0].entityTypes).toEqual(['secret']);
        expect(found[0].description).toContain('The drowned god');
        expect(found[0].suggestedFix).toBeTruthy();
    });

    it('stays silent when at least one clue is revealed', () => {
        const issues = checkContinuity(makeCampaign({
            secrets: [
                makeSecret({ id: 'rev-1', category: 'revelation', isRevealed: true }),
                makeSecret({ id: 'clue-1', category: 'clue', revealsSecretId: 'rev-1', isRevealed: true }),
                makeSecret({ id: 'clue-2', category: 'clue', revealsSecretId: 'rev-1', isRevealed: false }),
            ],
        }));

        expect(byRule(issues, 'revelation-without-revealed-clues')).toEqual([]);
    });

    it('stays silent on a revealed revelation with no clues at all', () => {
        const issues = checkContinuity(makeCampaign({
            secrets: [makeSecret({ id: 'rev-1', category: 'revelation', isRevealed: true })],
        }));

        expect(byRule(issues, 'revelation-without-revealed-clues')).toEqual([]);
    });

    it('stays silent on an unrevealed revelation', () => {
        const issues = checkContinuity(makeCampaign({ secrets: mysteryWith(3) }));

        expect(byRule(issues, 'revelation-without-revealed-clues')).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// 5. Broken reference — the fifth stop of the E1 integrity contract
// ---------------------------------------------------------------------------

describe('broken-ref — a mystery edge pointing at a secret that no longer exists', () => {
    it('errors when revealsSecretId names no secret in the campaign', () => {
        const issues = checkContinuity(makeCampaign({
            secrets: [makeSecret({ id: 'clue-1', title: 'The wet footprints', category: 'clue', revealsSecretId: 'gone-forever' })],
        }));
        const found = byRule(issues, 'broken-ref').filter(i => i.entityIds.includes('clue-1'));

        expect(found).toHaveLength(1);
        expect(found[0].severity).toBe('error');
        expect(found[0].entityTypes).toEqual(['secret']);
        expect(found[0].description).toContain('The wet footprints');
        expect(found[0].suggestedFix).toBeTruthy();
    });

    it('stays silent when the target exists', () => {
        const issues = checkContinuity(makeCampaign({ secrets: mysteryWith(1) }));

        expect(byRule(issues, 'broken-ref')).toEqual([]);
    });

    it('validates the field wherever it appears, whatever the holder\'s category', () => {
        const issues = checkContinuity(makeCampaign({
            secrets: [makeSecret({ id: 'rum-1', category: 'rumor', revealsSecretId: 'gone-forever' })],
        }));

        expect(byRule(issues, 'broken-ref').filter(i => i.entityIds.includes('rum-1'))).toHaveLength(1);
    });

    it('does not flag an absent or empty revealsSecretId', () => {
        const issues = checkContinuity(makeCampaign({
            secrets: [
                makeSecret({ id: 's-1', category: 'clue' }),
                makeSecret({ id: 's-2', category: 'clue', revealsSecretId: '' }),
            ],
        }));

        expect(byRule(issues, 'broken-ref')).toEqual([]);
    });

    it('does not resolve the edge against non-secret ids', () => {
        // `revealsSecretId` targets a SECRET, not "any entity" — pointing it at
        // an NPC id is still broken.
        const issues = checkContinuity(makeCampaign({
            npcs: [{
                id: 'npc-1', name: 'The Harbourmaster', description: '', traits: '',
                backstory: '', motivations: '', secrets: '', stats: '', exampleQuote: '',
                knowsPlayerHistory: [], relationships: [], history: [],
            }],
            secrets: [makeSecret({ id: 'clue-1', category: 'clue', revealsSecretId: 'npc-1' })],
        }));

        expect(byRule(issues, 'broken-ref').filter(i => i.entityIds.includes('clue-1'))).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// Purity / totality
// ---------------------------------------------------------------------------

describe('checkContinuity — still pure and total with the mystery rules in', () => {
    it('does not mutate the campaign it is given', () => {
        const campaign = makeCampaign({ secrets: mysteryWith(1) });
        const before = JSON.stringify(campaign);

        checkContinuity(campaign);

        expect(JSON.stringify(campaign)).toBe(before);
    });

    it('gives every issue a unique id within one run', () => {
        const issues = checkContinuity(makeCampaign({
            secrets: [
                makeSecret({ id: 'rev-1', category: 'revelation', linkedEntityIds: [] }),
                makeSecret({ id: 'rev-2', category: 'revelation', linkedEntityIds: [] }),
                makeSecret({ id: 'clue-1', category: 'clue', revealsSecretId: 'gone', linkedEntityIds: [] }),
            ],
        }));

        expect(new Set(issues.map(i => i.id)).size).toBe(issues.length);
    });

    it('does not throw on a secret whose fields are all degenerate', () => {
        const weird = {
            id: '', title: '', content: '', category: 'clue', isRevealed: false,
            createdAt: '', revealsSecretId: '', cluesNeeded: 0, isVital: true,
        } as Secret;

        expect(() => checkContinuity(makeCampaign({ secrets: [weird] }))).not.toThrow();
    });
});
