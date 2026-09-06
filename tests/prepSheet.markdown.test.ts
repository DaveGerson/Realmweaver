/**
 * SPEC — `generateSessionPrepSheetMarkdown` in services/importExportService.ts
 *        (Wave 2, lane SHEET / `docs/design/lazy-dm-lens.md` R3).
 *
 * WHY THIS EXISTS. `Adventure` already has a printable Prep Document tab
 * (`components/editors/PrepDocumentView.tsx`) that compiles NPCs, locations and
 * scenes to markdown. Nothing compiles a *session's* prep the same way, and a
 * Lazy DM preps a session, not an adventure. This function is that missing
 * compiler: one page, assembled from prep the DM has already done, printable or
 * pasteable into any notes app.
 *
 * WHAT IT IS NOT. It makes no AI call, mints no id, and adds no schema. Every
 * field it reads already ships. It is a pure function of (sessionLog, campaign).
 *
 * ── THE CONTRACT ────────────────────────────────────────────────────────────
 *
 * 1. THE HEADER. The first line is `# <session title>`; a blank or missing
 *    title falls back to `# Untitled Session`. The session date follows within
 *    the first few lines as the ISO calendar date (`2026-05-01`) — NOT a
 *    locale-formatted date, because a prep sheet must read the same for every
 *    DM in every timezone. An unparseable or missing date prints no date line
 *    at all; the words "Invalid Date" and "NaN" never reach the page.
 *
 * 2. THE SECTIONS, IN THIS ORDER, EACH ONLY WHEN IT HAS CONTENT:
 *
 *      ## Strong Start      the DM's opening line, parsed out of `prepNotes`
 *      ## Beats             the lightweight checklist, as `- [ ]` / `- [x]`
 *      ## Scenes            planned scenes: read-aloud FIRST LINE, checks, rewards
 *      ## Cast              planned NPCs, one line each, plus voice when known
 *      ## Locations         planned locations, one line each
 *      ## Plot Threads      related plots that are still ACTIVE
 *      ## Secrets & Clues   UNREVEALED secrets linked to that cast/those locations
 *
 *    A session with nothing prepped produces the header and nothing else — no
 *    empty headings, no "None" placeholders. Sections are relatively ordered as
 *    listed; nothing forbids an implementation from adding a section of its own
 *    (e.g. the remaining prep notes) between them.
 *
 * 3. THE STRONG START IS PROSE, NOT STORAGE. It is read with the shipped
 *    `prepNotes` encoding (`utils/strongStartFormat.ts`). The delimiter lines
 *    are machinery: they never appear on the page. Only the strong start goes
 *    in the Strong Start section — the rest of the prep notes is not part of it.
 *    When `prepNotes` carries no well-formed block (empty, absent, plain prose,
 *    markers part-way in, an unclosed marker) there is no Strong Start section
 *    and nothing is promoted.
 *
 * 4. ONE PAGE MEANS ONE PAGE. A scene contributes the FIRST non-empty line of
 *    its read-aloud text and no more — the rest of the box text stays in the
 *    scene. Descriptions are collapsed to a single line (newline runs become a
 *    single space) so every roster entry is one bullet.
 *
 * 5. THE ROSTER, AND ITS FALLBACK. The cast/locations roster is
 *    `plannedNpcIds` / `plannedLocationIds` when the session has them (the Go
 *    Live curation writes them). A session prepped before those fields existed
 *    falls back to the union of the planned scenes' `npcIds` / `locationId` —
 *    the same fallback `SessionRunner` already makes. The choice is made on the
 *    RAW id list: present and non-empty means "use it", even if every id in it
 *    turns out to be dangling — a DM who curated a roster down to nothing did
 *    not ask for the scene roster back. Order follows the id list it came from.
 *    That roster is also what the secrets section is filtered by.
 *
 * 6. IT DEGRADES, IT DOES NOT THROW. Optional arrays are read `?? []`. Ids that
 *    resolve to nothing (a deleted NPC still listed in `plannedNpcIds`, a scene
 *    id from a deleted adventure) are skipped silently — never "Unknown Entity",
 *    never `undefined`, never a crash. A campaign missing `secrets` entirely,
 *    a session missing `beats`/`plannedSceneIds`/`relatedPlotIds`, and a
 *    near-empty object cast to the types all produce a usable page.
 *
 * 7. IT IS PURE AND IDEMPOTENT. Same inputs → byte-identical output, every
 *    time. It mutates neither argument (note that the campaign-wide
 *    `generateMarkdownForCampaign` sorts `campaign.sessionLogs` in place — this
 *    function must not copy that habit). It is synchronous and returns a
 *    string, never a promise: there is no AI in this path.
 */

import { describe, it, expect } from 'vitest';
import type { Campaign, SessionLog } from '../types/index';
import { generateSessionPrepSheetMarkdown } from '../services/importExportService';
import {
    STRONG_START_OPEN,
    STRONG_START_CLOSE,
    composeStrongStartPrepNotes,
} from './helpers/strongStartFormat';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const STRONG_START = 'The bell in the drowned chapel starts ringing by itself.';
const OTHER_NOTES = 'Scottish accent for Angus. Contingency: the guild contact arrives late.';

const makeCampaign = (overrides: Partial<Campaign> = {}): Campaign =>
    ({
        id: 'camp-1',
        title: 'The Sunken Crown',
        settingType: 'custom',
        setting: 'A drowned empire of brass and salt',
        articles: [],
        npcs: [
            {
                id: 'npc-brannock',
                name: 'Brannock Vane',
                description: 'A wiry harbourmaster\nwith a bad limp.',
                traits: 'Suspicious',
                backstory: '',
                motivations: '',
                secrets: '',
                stats: '',
                exampleQuote: '',
                voiceNotes: 'Clipped sentences; never uses contractions.',
                knowsPlayerHistory: [],
                relationships: [],
                history: [],
            },
            {
                id: 'npc-mira',
                name: 'Mira Solt',
                description: 'Temple archivist, ink-stained.',
                traits: '',
                backstory: '',
                motivations: '',
                secrets: '',
                stats: '',
                exampleQuote: '',
                knowsPlayerHistory: [],
                relationships: [],
                history: [],
            },
            {
                id: 'npc-offstage',
                name: 'Kess Dural',
                description: 'Never planned for tonight.',
                traits: '',
                backstory: '',
                motivations: '',
                secrets: '',
                stats: '',
                exampleQuote: '',
                knowsPlayerHistory: [],
                relationships: [],
                history: [],
            },
        ],
        locations: [
            {
                id: 'loc-chapel',
                name: 'The Drowned Chapel',
                description: 'A flooded nave, pews under three feet of water.',
                secrets: '',
                subLocationIds: [],
                history: [],
                aspects: ['Water sloshes with every footstep.', 'Cold as the crypt below.'],
            },
            {
                id: 'loc-docks',
                name: 'Saltwharf Docks',
                description: 'Rope, tar, and\nrumour.',
                secrets: '',
                subLocationIds: [],
                history: [],
            },
            {
                id: 'loc-waste',
                name: 'The Ember Waste',
                description: 'Nowhere near tonight.',
                secrets: '',
                subLocationIds: [],
                history: [],
            },
        ],
        factions: [],
        items: [],
        adventures: [
            {
                id: 'adv-1',
                title: 'Bells Below',
                level: 3,
                hook: 'A chapel that will not stay drowned.',
                theme: 'Salt gothic',
                scenes: [
                    {
                        id: 'sc-1',
                        title: 'Bell in the Nave',
                        type: 'exploration',
                        status: 'planned',
                        readAloudText:
                            'The bell is ringing.\nNobody is pulling the rope.\nThe water is warm.',
                        gmNotes: 'GM only — the bell is bait.',
                        skillChecks: [
                            { id: 'sk-1', skill: 'Perception', dc: 14, description: 'Spot the wire.' },
                            { id: 'sk-2', skill: '   ', dc: 0, description: 'Half-authored, skip me.' },
                        ],
                        rewards: 'A brass key, green with age.',
                        locationId: 'loc-chapel',
                        npcIds: ['npc-brannock'],
                    },
                    {
                        id: 'sc-2',
                        title: 'Harbour Bargain',
                        type: 'social',
                        status: 'planned',
                        readAloudText: '',
                        gmNotes: '',
                        skillChecks: [],
                        rewards: '',
                        npcIds: ['npc-mira'],
                    },
                    {
                        id: 'sc-3',
                        title: 'Never Prepped',
                        type: 'combat',
                        status: 'planned',
                        readAloudText: 'Should not appear.',
                        gmNotes: '',
                        skillChecks: [],
                        rewards: '',
                        npcIds: [],
                    },
                ],
            },
        ],
        sessionLogs: [],
        playerCharacters: [],
        plots: [
            {
                id: 'plot-active',
                title: 'The Tide Cult',
                description: 'Someone is feeding the deep.',
                status: 'active',
                relatedEntityIds: [],
            },
            {
                id: 'plot-dormant',
                title: 'An Old Debt',
                description: 'Cold since session one.',
                status: 'dormant',
                relatedEntityIds: [],
            },
            {
                id: 'plot-unrelated',
                title: 'The Ember Pact',
                description: 'Not this session.',
                status: 'active',
                relatedEntityIds: [],
            },
        ],
        notes: [],
        secrets: [
            {
                id: 'sec-cast',
                title: 'The bell is a lure',
                content: 'Brannock rings it himself\nto draw the drowned up.',
                category: 'secret',
                isRevealed: false,
                linkedEntityIds: ['npc-brannock'],
                createdAt: '2026-04-01T00:00:00.000Z',
            },
            {
                id: 'sec-location',
                title: 'The chapel floor is hollow',
                content: 'There is a crypt beneath the nave.',
                category: 'clue',
                isRevealed: false,
                linkedEntityIds: ['loc-chapel'],
                createdAt: '2026-04-01T00:00:00.000Z',
            },
            {
                id: 'sec-spent',
                title: 'Already told at the table',
                content: 'The party knows this one.',
                category: 'revelation',
                isRevealed: true,
                linkedEntityIds: ['npc-brannock'],
                createdAt: '2026-04-01T00:00:00.000Z',
            },
            {
                id: 'sec-offstage',
                title: 'A whisper about Kess',
                content: 'Nothing to do with tonight.',
                category: 'rumor',
                isRevealed: false,
                linkedEntityIds: ['npc-offstage'],
                createdAt: '2026-04-01T00:00:00.000Z',
            },
            {
                id: 'sec-floating',
                title: 'Linked to nothing at all',
                content: 'A free-floating secret.',
                category: 'secret',
                isRevealed: false,
                createdAt: '2026-04-01T00:00:00.000Z',
            },
        ],
        ...overrides,
    }) as unknown as Campaign;

const makeSession = (overrides: Partial<SessionLog> = {}): SessionLog =>
    ({
        id: 'log-1',
        title: 'Session Four',
        status: 'planned',
        sessionDate: '2026-05-01T18:00:00.000Z',
        adventureId: 'adv-1',
        plannedSceneIds: ['sc-1', 'sc-2'],
        prepNotes: composeStrongStartPrepNotes(STRONG_START, OTHER_NOTES),
        plannedNpcIds: ['npc-brannock', 'npc-mira'],
        plannedLocationIds: ['loc-chapel', 'loc-docks'],
        relatedPlotIds: ['plot-active', 'plot-dormant'],
        runningNotes: '',
        structuredNotes: [],
        encounterLog: [],
        beats: [
            { id: 'b-1', title: 'Ambush at the ford', isCompleted: false, notes: 'Use the rain.' },
            { id: 'b-2', title: 'The bell answers', isCompleted: true },
        ],
        recap: '',
        notableEvents: '',
        looseEnds: '',
        ...overrides,
    }) as unknown as SessionLog;

/** A session with every optional slot empty but structurally valid. */
const emptySession = (): SessionLog =>
    makeSession({
        adventureId: undefined,
        plannedSceneIds: [],
        prepNotes: '',
        plannedNpcIds: [],
        plannedLocationIds: [],
        relatedPlotIds: [],
        beats: [],
    });

// ── Helpers ───────────────────────────────────────────────────────────────────

const linesOf = (md: string): string[] => md.split('\n').map(l => l.trimEnd());
const headingsOf = (md: string): string[] => linesOf(md).filter(l => l.startsWith('## '));
const at = (md: string, heading: string): number => md.indexOf(heading);

/** Text of one `## ` section, up to the next `## ` heading (or end of page). */
const section = (md: string, heading: string): string => {
    const start = md.indexOf(heading);
    if (start === -1) return '';
    const rest = md.slice(start + heading.length);
    const next = rest.indexOf('\n## ');
    return next === -1 ? rest : rest.slice(0, next);
};

// ── 1. The header ─────────────────────────────────────────────────────────────

describe('session prep sheet — the header', () => {
    it('opens with the session title as an H1', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());

        expect(linesOf(md)[0]).toBe('# Session Four');
    });

    it('prints the session date as an ISO calendar date near the top', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());

        expect(md).toContain('2026-05-01');
        expect(linesOf(md).slice(0, 5).join('\n')).toContain('2026-05-01');
    });

    it('falls back to "Untitled Session" for a blank title', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession({ title: '   ' }), makeCampaign());

        expect(linesOf(md)[0]).toBe('# Untitled Session');
    });

    const badDates: Array<[string, string]> = [
        ['an empty date', ''],
        ['a corrupted date', 'not-a-date'],
    ];

    it.each(badDates)('prints no date line and no error text for %s', (_label, sessionDate) => {
        const md = generateSessionPrepSheetMarkdown(makeSession({ sessionDate }), makeCampaign());

        expect(md).not.toContain('Invalid Date');
        expect(md).not.toContain('NaN');
        expect(md).not.toContain('undefined');
    });
});

// ── 2. Sections appear only when they have content, in a fixed order ──────────

describe('session prep sheet — section presence and order', () => {
    it('emits every section when the session is fully prepped', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());

        expect(md).toContain('## Strong Start');
        expect(md).toContain('## Beats');
        expect(md).toContain('## Scenes');
        expect(md).toContain('## Cast');
        expect(md).toContain('## Locations');
        expect(md).toContain('## Plot Threads');
        expect(md).toContain('## Secrets & Clues');
    });

    it('orders them strong start → beats → scenes → cast → locations → plots → secrets', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());

        const order = [
            at(md, '## Strong Start'),
            at(md, '## Beats'),
            at(md, '## Scenes'),
            at(md, '## Cast'),
            at(md, '## Locations'),
            at(md, '## Plot Threads'),
            at(md, '## Secrets & Clues'),
        ];

        expect(order.every(i => i !== -1)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    it('emits nothing but the header for a session with nothing prepped', () => {
        const md = generateSessionPrepSheetMarkdown(emptySession(), makeCampaign());

        expect(linesOf(md)[0]).toBe('# Session Four');
        expect(headingsOf(md)).toEqual([]);
    });

    const emptySectionCases: Array<[string, string, Partial<SessionLog>]> = [
        ['Strong Start', '## Strong Start', { prepNotes: '' }],
        ['Beats', '## Beats', { beats: [] }],
        ['Scenes', '## Scenes', { plannedSceneIds: [] }],
        ['Plot Threads', '## Plot Threads', { relatedPlotIds: [] }],
    ];

    it.each(emptySectionCases)('drops the %s section when that prep is empty', (_label, heading, patch) => {
        const md = generateSessionPrepSheetMarkdown(makeSession(patch), makeCampaign());

        expect(md).not.toContain(heading);
    });

    it('drops the cast and location sections when the roster is empty', () => {
        const md = generateSessionPrepSheetMarkdown(
            makeSession({ plannedNpcIds: [], plannedLocationIds: [], plannedSceneIds: [] }),
            makeCampaign(),
        );

        expect(md).not.toContain('## Cast');
        expect(md).not.toContain('## Locations');
    });

    it('drops the secrets section when the campaign has no secrets array at all', () => {
        const md = generateSessionPrepSheetMarkdown(
            makeSession(),
            makeCampaign({ secrets: undefined }),
        );

        expect(md).not.toContain('## Secrets & Clues');
        expect(md).toContain('## Cast');
    });
});

// ── 3. The strong start ───────────────────────────────────────────────────────

describe('session prep sheet — the strong start', () => {
    it('leads the page with the DM\'s own opening words', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());

        expect(section(md, '## Strong Start')).toContain(STRONG_START);
        expect(at(md, '## Strong Start')).toBeLessThan(at(md, '## Beats'));
    });

    it('never prints the delimiters that carry it', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());

        expect(md).not.toContain(STRONG_START_OPEN);
        expect(md).not.toContain(STRONG_START_CLOSE);
        expect(md).not.toContain('===');
    });

    it('keeps the rest of the prep notes out of the strong start section', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());

        expect(section(md, '## Strong Start')).not.toContain('Scottish accent for Angus');
    });

    it('quotes a multi-line strong start line by line', () => {
        const multiline = 'The bell rings.\nNobody is in the chapel.';
        const md = generateSessionPrepSheetMarkdown(
            makeSession({ prepNotes: composeStrongStartPrepNotes(multiline, '') }),
            makeCampaign(),
        );

        const lines = linesOf(md);
        expect(lines).toContain('> The bell rings.');
        expect(lines).toContain('> Nobody is in the chapel.');
    });

    it('reads a block written with Windows line endings', () => {
        const crlf = composeStrongStartPrepNotes(STRONG_START, OTHER_NOTES).replace(/\n/g, '\r\n');
        const md = generateSessionPrepSheetMarkdown(makeSession({ prepNotes: crlf }), makeCampaign());

        expect(section(md, '## Strong Start')).toContain(STRONG_START);
    });

    const notAStrongStart: Array<[string, string]> = [
        ['prep notes are plain prose', 'Remember the docks. Angus is Scottish.'],
        [
            'the markers appear part-way through the prose',
            `Remember the docks.\n${STRONG_START_OPEN}\n${STRONG_START}\n${STRONG_START_CLOSE}`,
        ],
        ['the opening marker is never closed', `${STRONG_START_OPEN}\n${STRONG_START}\nand the docks.`],
    ];

    it.each(notAStrongStart)('renders no strong start section when %s', (_label, prepNotes) => {
        const md = generateSessionPrepSheetMarkdown(makeSession({ prepNotes }), makeCampaign());

        expect(md).not.toContain('## Strong Start');
        expect(md).not.toContain(STRONG_START_OPEN);
    });

    it('renders no strong start section when prepNotes is absent entirely', () => {
        const md = generateSessionPrepSheetMarkdown(
            makeSession({ prepNotes: undefined as unknown as string }),
            makeCampaign(),
        );

        expect(md).not.toContain('## Strong Start');
    });
});

// ── Beats ─────────────────────────────────────────────────────────────────────

describe('session prep sheet — beats are a checklist', () => {
    it('renders each beat as a markdown checkbox reflecting its completion', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());
        const lines = linesOf(md);

        expect(lines).toContain('- [ ] Ambush at the ford');
        expect(lines).toContain('- [x] The bell answers');
    });

    it('keeps the beats in the order the DM wrote them', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());

        expect(md.indexOf('Ambush at the ford')).toBeLessThan(md.indexOf('The bell answers'));
    });

    it('carries a beat\'s notes when it has them, and adds nothing when it does not', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());

        expect(section(md, '## Beats')).toContain('Use the rain.');
    });

    it('skips a beat with no title — an empty checklist row is noise', () => {
        const md = generateSessionPrepSheetMarkdown(
            makeSession({
                beats: [
                    { id: 'b-1', title: '   ', isCompleted: false },
                    { id: 'b-2', title: 'Real beat', isCompleted: false },
                ],
            }),
            makeCampaign(),
        );

        expect(linesOf(md).filter(l => l.startsWith('- [')).length).toBe(1);
        expect(md).toContain('- [ ] Real beat');
    });

    it('does not throw when the session predates beats entirely', () => {
        expect(() =>
            generateSessionPrepSheetMarkdown(makeSession({ beats: undefined }), makeCampaign()),
        ).not.toThrow();
    });
});

// ── 4. Scenes ─────────────────────────────────────────────────────────────────

describe('session prep sheet — the planned scenes', () => {
    it('lists only the planned scenes, in plannedSceneIds order', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());
        const scenes = section(md, '## Scenes');

        expect(scenes).toContain('Bell in the Nave');
        expect(scenes).toContain('Harbour Bargain');
        expect(scenes).not.toContain('Never Prepped');
        expect(scenes.indexOf('Bell in the Nave')).toBeLessThan(scenes.indexOf('Harbour Bargain'));
    });

    it('names the scene\'s location when it resolves', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());
        const scenes = section(md, '## Scenes');

        expect(scenes).toContain('The Drowned Chapel');
    });

    it('carries only the FIRST line of the read-aloud text', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());

        expect(md).toContain('The bell is ringing.');
        expect(md).not.toContain('Nobody is pulling the rope.');
        expect(md).not.toContain('The water is warm.');
    });

    it('lists the scene\'s skill checks with skill and DC', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());
        const scenes = section(md, '## Scenes');

        expect(scenes).toContain('Perception');
        expect(scenes).toContain('14');
        expect(scenes).toContain('Spot the wire.');
    });

    it('skips a half-authored skill check with no skill name', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());

        expect(md).not.toContain('Half-authored, skip me.');
    });

    it('carries the scene\'s rewards', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());

        expect(md).toContain('A brass key, green with age.');
    });

    it('adds no empty read-aloud/skill-check/reward furniture for a bare scene', () => {
        const md = generateSessionPrepSheetMarkdown(
            makeSession({ plannedSceneIds: ['sc-2'] }),
            makeCampaign(),
        );
        const scenes = section(md, '## Scenes');

        expect(scenes).toContain('Harbour Bargain');
        expect(scenes).not.toMatch(/Rewards/i);
        expect(scenes).not.toMatch(/Skill Check/i);
        expect(scenes).not.toContain('undefined');
    });

    it('skips a planned scene id that no longer resolves, without a placeholder', () => {
        const md = generateSessionPrepSheetMarkdown(
            makeSession({ plannedSceneIds: ['sc-1', 'sc-deleted'] }),
            makeCampaign(),
        );

        expect(md).toContain('Bell in the Nave');
        expect(md).not.toMatch(/unknown/i);
        expect(md).not.toContain('sc-deleted');
    });

    it('drops the scenes section when every planned id is dangling', () => {
        const md = generateSessionPrepSheetMarkdown(
            makeSession({ plannedSceneIds: ['sc-gone-1', 'sc-gone-2'] }),
            makeCampaign(),
        );

        expect(md).not.toContain('## Scenes');
    });

    it('finds a planned scene even when the session names no adventure', () => {
        const md = generateSessionPrepSheetMarkdown(
            makeSession({ adventureId: undefined, plannedSceneIds: ['sc-1'] }),
            makeCampaign(),
        );

        expect(md).toContain('Bell in the Nave');
    });
});

// ── 5. The roster: cast, locations, and the pre-curation fallback ─────────────

describe('session prep sheet — the planned cast and locations', () => {
    it('lists the planned NPCs in plannedNpcIds order with a one-line description', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());
        const cast = section(md, '## Cast');

        expect(cast).toContain('Brannock Vane');
        expect(cast).toContain('Mira Solt');
        expect(cast).not.toContain('Kess Dural');
        expect(cast.indexOf('Brannock Vane')).toBeLessThan(cast.indexOf('Mira Solt'));
    });

    it('collapses a multi-line description onto one line', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());

        expect(md).toContain('A wiry harbourmaster with a bad limp.');
        expect(linesOf(md)).not.toContain('with a bad limp.');
    });

    it('carries voice notes when the NPC has them', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());

        expect(section(md, '## Cast')).toContain('Clipped sentences; never uses contractions.');
    });

    it('adds no voice line for an NPC that has none', () => {
        const md = generateSessionPrepSheetMarkdown(
            makeSession({ plannedNpcIds: ['npc-mira'] }),
            makeCampaign(),
        );
        const cast = section(md, '## Cast');

        expect(cast).toContain('Mira Solt');
        expect(cast).not.toMatch(/voice/i);
    });

    it('lists the planned locations in plannedLocationIds order', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());
        const locs = section(md, '## Locations');

        expect(locs).toContain('The Drowned Chapel');
        expect(locs).toContain('Saltwharf Docks');
        expect(locs).not.toContain('The Ember Waste');
    });

    // Lazy DM step 5 ("develop fantastic locations") — R3's aspects line.
    it('carries aspects when the location has them', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());

        expect(section(md, '## Locations')).toContain(
            'Aspects: Water sloshes with every footstep.; Cold as the crypt below.',
        );
    });

    it('adds no aspects line for a location that has none', () => {
        const md = generateSessionPrepSheetMarkdown(
            makeSession({ plannedLocationIds: ['loc-docks'] }),
            makeCampaign(),
        );
        const locs = section(md, '## Locations');

        expect(locs).toContain('Saltwharf Docks');
        expect(locs).not.toMatch(/aspects/i);
    });

    it('drops blank aspect entries and joins the rest with a semicolon', () => {
        const campaign = makeCampaign({
            locations: [
                {
                    id: 'loc-chapel',
                    name: 'The Drowned Chapel',
                    description: 'A flooded nave.',
                    secrets: '',
                    subLocationIds: [],
                    history: [],
                    aspects: ['  ', 'Real aspect one.', '', '   Real aspect two.  '],
                },
            ],
        });
        const md = generateSessionPrepSheetMarkdown(
            makeSession({ plannedLocationIds: ['loc-chapel'], plannedNpcIds: [] }),
            campaign,
        );

        expect(section(md, '## Locations')).toContain(
            'Aspects: Real aspect one.; Real aspect two.',
        );
    });

    it('does not throw and adds no aspects line when aspects is a malformed value', () => {
        const campaign = makeCampaign({
            locations: [
                {
                    id: 'loc-chapel',
                    name: 'The Drowned Chapel',
                    description: 'A flooded nave.',
                    secrets: '',
                    subLocationIds: [],
                    history: [],
                    aspects: 'not an array' as unknown as string[],
                },
            ],
        });

        let md = '';
        expect(() => {
            md = generateSessionPrepSheetMarkdown(
                makeSession({ plannedLocationIds: ['loc-chapel'], plannedNpcIds: [] }),
                campaign,
            );
        }).not.toThrow();
        expect(section(md, '## Locations')).toContain('The Drowned Chapel');
        expect(md).not.toMatch(/aspects/i);
    });

    it('skips a planned id whose entity was deleted, without a placeholder', () => {
        const md = generateSessionPrepSheetMarkdown(
            makeSession({
                plannedNpcIds: ['npc-brannock', 'npc-deleted'],
                plannedLocationIds: ['loc-deleted'],
            }),
            makeCampaign(),
        );

        expect(md).toContain('Brannock Vane');
        expect(md).not.toMatch(/unknown/i);
        expect(md).not.toContain('npc-deleted');
        expect(md).not.toContain('## Locations');
    });

    it('falls back to the planned scenes\' cast when the session predates plannedNpcIds', () => {
        const md = generateSessionPrepSheetMarkdown(
            makeSession({ plannedNpcIds: undefined, plannedLocationIds: undefined }),
            makeCampaign(),
        );

        // sc-1 carries npc-brannock + loc-chapel; sc-2 carries npc-mira.
        expect(section(md, '## Cast')).toContain('Brannock Vane');
        expect(section(md, '## Cast')).toContain('Mira Solt');
        expect(section(md, '## Locations')).toContain('The Drowned Chapel');
        expect(section(md, '## Locations')).not.toContain('Saltwharf Docks');
    });

    it('prefers the curated roster over the scene fallback when both exist', () => {
        const md = generateSessionPrepSheetMarkdown(
            makeSession({ plannedNpcIds: ['npc-mira'], plannedSceneIds: ['sc-1'] }),
            makeCampaign(),
        );
        const cast = section(md, '## Cast');

        expect(cast).toContain('Mira Solt');
        expect(cast).not.toContain('Brannock Vane');
    });
});

// ── Plots ─────────────────────────────────────────────────────────────────────

describe('session prep sheet — active related plots', () => {
    it('lists the related plots that are still active', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());
        const plots = section(md, '## Plot Threads');

        expect(plots).toContain('The Tide Cult');
        expect(plots).toContain('Someone is feeding the deep.');
    });

    it('leaves out a related plot that is dormant or resolved', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());

        expect(md).not.toContain('An Old Debt');
    });

    it('leaves out an active plot that this session is not related to', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());

        expect(md).not.toContain('The Ember Pact');
    });

    it('drops the section when every related plot has gone quiet', () => {
        const md = generateSessionPrepSheetMarkdown(
            makeSession({ relatedPlotIds: ['plot-dormant'] }),
            makeCampaign(),
        );

        expect(md).not.toContain('## Plot Threads');
    });

    it('skips a related plot id that no longer resolves', () => {
        const md = generateSessionPrepSheetMarkdown(
            makeSession({ relatedPlotIds: ['plot-active', 'plot-deleted'] }),
            makeCampaign(),
        );

        expect(md).toContain('The Tide Cult');
        expect(md).not.toContain('plot-deleted');
        expect(md).not.toMatch(/unknown/i);
    });
});

// ── Secrets ───────────────────────────────────────────────────────────────────

describe('session prep sheet — unrevealed secrets for tonight\'s roster', () => {
    it('includes an unrevealed secret linked to a planned NPC', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());
        const secrets = section(md, '## Secrets & Clues');

        expect(secrets).toContain('The bell is a lure');
    });

    it('includes an unrevealed secret linked to a planned location', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());

        expect(section(md, '## Secrets & Clues')).toContain('The chapel floor is hollow');
    });

    it('excludes a secret the party has already been told', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());

        expect(md).not.toContain('Already told at the table');
    });

    it('excludes a secret linked only to somebody who is not on stage tonight', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());

        expect(md).not.toContain('A whisper about Kess');
    });

    it('excludes a secret linked to nothing at all', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());

        expect(md).not.toContain('Linked to nothing at all');
    });

    it('collapses the secret body onto one line', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());

        expect(md).toContain('Brannock rings it himself to draw the drowned up.');
    });

    it('follows the scene-derived roster when the session predates plannedNpcIds', () => {
        const md = generateSessionPrepSheetMarkdown(
            makeSession({ plannedNpcIds: undefined, plannedLocationIds: undefined }),
            makeCampaign(),
        );

        expect(section(md, '## Secrets & Clues')).toContain('The bell is a lure');
        expect(md).not.toContain('A whisper about Kess');
    });
});

// ── 6. Degradation on old and degenerate saves ────────────────────────────────

describe('session prep sheet — it degrades, it does not throw', () => {
    it('survives a session object that predates every optional field', () => {
        const oldSave = {
            id: 'log-old',
            title: 'Session Zero',
            status: 'planned',
            sessionDate: '2026-01-02T00:00:00.000Z',
            prepNotes: 'Just some prose.',
            runningNotes: '',
            structuredNotes: [],
            encounterLog: [],
            recap: '',
            notableEvents: '',
            looseEnds: '',
        } as unknown as SessionLog;

        let md = '';
        expect(() => {
            md = generateSessionPrepSheetMarkdown(oldSave, makeCampaign());
        }).not.toThrow();
        expect(linesOf(md)[0]).toBe('# Session Zero');
        expect(headingsOf(md)).toEqual([]);
    });

    it('survives a campaign object that is missing its entity arrays', () => {
        const bareCampaign = {
            id: 'camp-bare',
            title: 'Bare',
            setting: '',
            settingType: 'custom',
        } as unknown as Campaign;

        let md = '';
        expect(() => {
            md = generateSessionPrepSheetMarkdown(makeSession(), bareCampaign);
        }).not.toThrow();
        expect(md.startsWith('# Session Four')).toBe(true);
        expect(md).not.toContain('undefined');
    });

    it('survives the most degenerate pair of objects the types allow', () => {
        const md = generateSessionPrepSheetMarkdown(
            { id: 'x' } as unknown as SessionLog,
            { id: 'y' } as unknown as Campaign,
        );

        expect(typeof md).toBe('string');
        expect(md.startsWith('# ')).toBe(true);
        expect(md).not.toContain('undefined');
    });

    it('never emits a "null"/"undefined"/"[object Object]" artefact on the happy path', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());

        expect(md).not.toContain('undefined');
        expect(md).not.toContain('null');
        expect(md).not.toContain('[object Object]');
    });
});

// ── 7. Purity, idempotence, and the absence of AI ─────────────────────────────

describe('session prep sheet — pure, idempotent, AI-free', () => {
    it('returns a string synchronously — this path makes no AI call', () => {
        const md = generateSessionPrepSheetMarkdown(makeSession(), makeCampaign());

        expect(typeof md).toBe('string');
        expect(md).not.toHaveProperty('then');
    });

    it('produces byte-identical output for the same inputs', () => {
        const log = makeSession();
        const campaign = makeCampaign();

        expect(generateSessionPrepSheetMarkdown(log, campaign)).toBe(
            generateSessionPrepSheetMarkdown(log, campaign),
        );
    });

    it('mutates neither the session nor the campaign', () => {
        const log = makeSession();
        const campaign = makeCampaign();
        const logBefore = JSON.parse(JSON.stringify(log));
        const campaignBefore = JSON.parse(JSON.stringify(campaign));

        generateSessionPrepSheetMarkdown(log, campaign);

        expect(JSON.parse(JSON.stringify(log))).toEqual(logBefore);
        expect(JSON.parse(JSON.stringify(campaign))).toEqual(campaignBefore);
    });

    it('does not reorder the campaign\'s session logs the way the campaign-wide export does', () => {
        const campaign = makeCampaign({
            sessionLogs: [
                makeSession({ id: 'later', sessionDate: '2026-09-01T00:00:00.000Z' }),
                makeSession({ id: 'earlier', sessionDate: '2026-01-01T00:00:00.000Z' }),
            ],
        });

        generateSessionPrepSheetMarkdown(makeSession(), campaign);

        expect(campaign.sessionLogs.map(l => l.id)).toEqual(['later', 'earlier']);
    });
});
