import { describe, it, expect } from 'vitest';
import type { Campaign, SessionLog, Plot, Secret, Adventure, Scene } from '../types/index';
import {
    computeContinuityThreads,
    formatThreadsForPrep,
    resolveContinuityEntity,
} from '../utils/continuityThreads';

const session = (over: Partial<SessionLog> & { id: string; sessionDate: string }): SessionLog => ({
    title: over.id,
    status: 'completed',
    plannedSceneIds: [],
    prepNotes: '',
    relatedPlotIds: [],
    runningNotes: '',
    structuredNotes: [],
    encounterLog: [],
    recap: '',
    notableEvents: '',
    looseEnds: '',
    ...over,
});

const plot = (over: Partial<Plot> & { id: string }): Plot => ({
    title: over.id,
    description: '',
    status: 'active',
    relatedEntityIds: [],
    ...over,
});

const scene = (over: Partial<Scene> & { id: string }): Scene => ({
    title: over.id,
    type: 'social',
    status: 'planned',
    readAloudText: '',
    gmNotes: '',
    skillChecks: [],
    rewards: '',
    npcIds: [],
    ...over,
});

const secret = (over: Partial<Secret> & { id: string }): Secret => ({
    title: over.id,
    content: '',
    category: 'secret',
    isRevealed: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
});

const makeCampaign = (over: Partial<Campaign> = {}): Campaign => ({
    id: 'c1',
    title: 'Test',
    settingType: 'custom',
    setting: '',
    articles: [],
    adventures: [],
    npcs: [],
    locations: [],
    factions: [],
    items: [],
    sessionLogs: [],
    playerCharacters: [],
    plots: [],
    notes: [],
    secrets: [],
    ...over,
});

describe('computeContinuityThreads — session ordering (shared with storyDerivations)', () => {
    it('reads loose ends from the newest completed session, ignoring planned and live ones', () => {
        const c = makeCampaign({
            sessionLogs: [
                session({ id: 's1', sessionDate: '2026-01-01', looseEnds: 'old' }),
                session({ id: 's3', sessionDate: '2026-03-01', status: 'planned', looseEnds: 'planned' }),
                session({ id: 's2', sessionDate: '2026-02-01', looseEnds: 'newest completed' }),
                session({ id: 'live', sessionDate: '2026-04-01', status: 'active', looseEnds: 'live' }),
            ],
        });
        const threads = computeContinuityThreads(c).filter(t => t.kind === 'session-loose-ends');
        expect(threads.map(t => t.entityId)).toEqual(['s2']);
    });

    it('breaks date ties by array order (later = newer)', () => {
        const c = makeCampaign({
            plots: [plot({ id: 'pa', title: 'A' }), plot({ id: 'pb', title: 'B' })],
            sessionLogs: [
                session({ id: 'a', sessionDate: '2026-01-01', relatedPlotIds: ['pa'] }),
                session({ id: 'b', sessionDate: '2026-01-01', relatedPlotIds: ['pb'] }),
            ],
        });
        expect(computeContinuityThreads(c).map(t => t.entityId)).toEqual(['pb', 'pa']);
    });

    it('returns [] for an empty campaign', () => {
        expect(computeContinuityThreads(makeCampaign())).toEqual([]);
    });
});

describe('computeContinuityThreads — plots', () => {
    it('excludes resolved plots and includes active + dormant', () => {
        const c = makeCampaign({
            plots: [
                plot({ id: 'p-active', title: 'Active' }),
                plot({ id: 'p-dormant', title: 'Dormant', status: 'dormant' }),
                plot({ id: 'p-resolved', title: 'Resolved', status: 'resolved' }),
            ],
        });
        const ids = computeContinuityThreads(c).map(t => t.id);
        expect(ids).toContain('plot:p-active');
        expect(ids).toContain('plot:p-dormant');
        expect(ids).not.toContain('plot:p-resolved');
    });

    it('ranks plots by recency of progression and annotates last-session progression', () => {
        const c = makeCampaign({
            plots: [
                plot({ id: 'old', title: 'Old thread' }),
                plot({ id: 'new', title: 'New thread', description: 'The heir is missing.' }),
                plot({ id: 'never', title: 'Never touched' }),
            ],
            sessionLogs: [
                session({ id: 's1', sessionDate: '2026-01-01', relatedPlotIds: ['old'] }),
                session({ id: 's2', sessionDate: '2026-02-01', plotProgressions: { new: 'stalled' } }),
            ],
        });
        const threads = computeContinuityThreads(c);
        expect(threads.map(t => t.entityId)).toEqual(['new', 'old', 'never']);
        const newT = threads[0];
        expect(newT.lastTouchedSessionId).toBe('s2');
        expect(newT.lastProgression).toBe('stalled');
        expect(newT.summary).toContain('Last session: stalled.');
        expect(newT.summary).toContain('The heir is missing.');
        expect(newT.navigateTo).toEqual({ type: 'plot', id: 'new' });
        expect(threads[1].summary).toContain('Last touched in "s1"');
        expect(threads[2].lastTouchedSessionId).toBeUndefined();
        expect(threads[2].summary).toContain('Not yet touched in play.');
    });

    it('sorts active before dormant at equal recency, then by title', () => {
        const c = makeCampaign({
            plots: [
                plot({ id: 'd', title: 'Aardvark', status: 'dormant' }),
                plot({ id: 'b', title: 'Beta' }),
                plot({ id: 'a', title: 'Alpha' }),
            ],
        });
        expect(computeContinuityThreads(c).map(t => t.entityId)).toEqual(['a', 'b', 'd']);
    });
});

describe('computeContinuityThreads — previous session loose ends', () => {
    it('surfaces the most recent completed session looseEnds text first', () => {
        const c = makeCampaign({
            plots: [plot({ id: 'p' })],
            sessionLogs: [
                session({ id: 's1', sessionDate: '2026-01-01', looseEnds: 'Old stuff' }),
                session({ id: 's2', title: 'Session 2', sessionDate: '2026-02-01', looseEnds: '  The bridge is out.  ', relatedPlotIds: ['p'] }),
            ],
        });
        const threads = computeContinuityThreads(c);
        expect(threads[0]).toMatchObject({
            kind: 'session-loose-ends',
            entityId: 's2',
            title: 'Loose ends from "Session 2"',
            summary: 'The bridge is out.',
            lastTouchedSessionId: 's2',
            navigateTo: { type: 'session-log', id: 's2' },
        });
        expect(threads[1].entityId).toBe('p');
        expect(threads.filter(t => t.kind === 'session-loose-ends')).toHaveLength(1);
    });

    it('skips blank looseEnds', () => {
        const c = makeCampaign({ sessionLogs: [session({ id: 's1', sessionDate: '2026-01-01', looseEnds: '   ' })] });
        expect(computeContinuityThreads(c)).toEqual([]);
    });
});

describe('computeContinuityThreads — scenes and adventures', () => {
    const adventure = (scenes: Scene[]): Adventure => ({ id: 'adv', title: 'The Vault', level: 1, hook: '', theme: '', scenes });

    it('lists in-progress scenes and part-way adventures', () => {
        const c = makeCampaign({
            adventures: [adventure([
                scene({ id: 'sc1', status: 'completed' }),
                scene({ id: 'sc2', title: 'The Gate', status: 'in-progress', gmNotes: 'Guards are nervous.' }),
                scene({ id: 'sc3' }),
            ])],
            sessionLogs: [session({ id: 's1', sessionDate: '2026-01-01', adventureId: 'adv', plannedSceneIds: ['sc2'] })],
        });
        const threads = computeContinuityThreads(c);
        const sceneT = threads.find(t => t.kind === 'scene');
        expect(sceneT).toMatchObject({
            entityId: 'sc2',
            title: 'The Gate',
            lastTouchedSessionId: 's1',
            navigateTo: { type: 'scene', id: 'sc2' },
        });
        expect(sceneT?.summary).toBe('Left in progress in "The Vault". Guards are nervous.');
        const advT = threads.find(t => t.kind === 'adventure');
        expect(advT).toMatchObject({ entityId: 'adv', summary: '1 of 3 scenes completed.', lastTouchedSessionId: 's1' });
        // Same recency → scene before adventure.
        expect(threads.map(t => t.kind)).toEqual(['scene', 'adventure']);
    });

    it('does not list untouched or finished adventures', () => {
        const c = makeCampaign({
            adventures: [
                { ...adventure([scene({ id: 'x' })]), id: 'fresh' },
                { ...adventure([scene({ id: 'y', status: 'completed' })]), id: 'done' },
            ],
        });
        expect(computeContinuityThreads(c)).toEqual([]);
    });
});

describe('computeContinuityThreads — secrets (loaded guns)', () => {
    const base = () => makeCampaign({
        npcs: [{ id: 'npc-1', name: 'Angus' } as Campaign['npcs'][number]],
        locations: [{ id: 'loc-1', name: 'The Docks' } as Campaign['locations'][number]],
        adventures: [{ id: 'adv', title: 'A', level: 1, hook: '', theme: '', scenes: [scene({ id: 'sc', locationId: 'loc-1' })] }],
    });

    it('includes unrevealed secrets linked to an entity tagged in the last completed session', () => {
        const c = base();
        c.sessionLogs = [session({
            id: 's1', sessionDate: '2026-01-01',
            structuredNotes: [{ id: 'n', timestamp: '', content: '', taggedEntityIds: ['npc-1'] }],
        })];
        c.secrets = [
            secret({ id: 'sec', title: 'Angus is a spy', category: 'clue', linkedEntityIds: ['npc-1', 'ghost'] }),
            secret({ id: 'revealed', linkedEntityIds: ['npc-1'], isRevealed: true }),
            secret({ id: 'unrelated', linkedEntityIds: ['someone-else'] }),
            secret({ id: 'unlinked' }),
        ];
        const threads = computeContinuityThreads(c);
        expect(threads.map(t => t.id)).toEqual(['secret:sec']);
        expect(threads[0]).toMatchObject({
            kind: 'secret',
            lastTouchedSessionId: 's1',
            summary: 'Primed from last session: unrevealed clue tied to Angus.',
            navigateTo: { type: 'npc', id: 'npc-1' },
        });
    });

    it('counts entities reached via planned scenes (scene location)', () => {
        const c = base();
        c.sessionLogs = [session({ id: 's1', sessionDate: '2026-01-01', plannedSceneIds: ['sc'] })];
        c.secrets = [secret({ id: 'sec', linkedEntityIds: ['loc-1'] })];
        const [t] = computeContinuityThreads(c);
        expect(t.navigateTo).toEqual({ type: 'location', id: 'loc-1' });
    });

    it('flags secrets on stage in a planned session, untouched in play', () => {
        const c = base();
        c.sessionLogs = [session({ id: 'next', sessionDate: '2026-05-01', status: 'planned', plannedNpcIds: ['npc-1'] })];
        c.secrets = [secret({ id: 'sec', linkedEntityIds: ['npc-1'] })];
        const [t] = computeContinuityThreads(c);
        expect(t.summary).toMatch(/^On stage tonight: /);
        expect(t.lastTouchedSessionId).toBeUndefined();
    });

    it('ignores secrets only seen in older sessions', () => {
        const c = base();
        c.sessionLogs = [
            session({ id: 's1', sessionDate: '2026-01-01', plannedNpcIds: ['npc-1'] }),
            session({ id: 's2', sessionDate: '2026-02-01' }),
        ];
        c.secrets = [secret({ id: 'sec', linkedEntityIds: ['npc-1'] })];
        expect(computeContinuityThreads(c)).toEqual([]);
    });

    it('tolerates a campaign without a secrets array', () => {
        const c = base();
        delete c.secrets;
        expect(computeContinuityThreads(c)).toEqual([]);
    });
});

describe('resolveContinuityEntity', () => {
    it('resolves player characters and scenes, returns null for unknown ids', () => {
        const c = makeCampaign({
            playerCharacters: [{ id: 'pc', playerName: 'Sam', characterSocial: { characterName: 'Brin' } } as unknown as Campaign['playerCharacters'][number]],
            adventures: [{ id: 'adv', title: 'A', level: 1, hook: '', theme: '', scenes: [scene({ id: 'sc', title: 'Gate' })] }],
        });
        expect(resolveContinuityEntity(c, 'pc')).toEqual({ type: 'player-character', name: 'Brin' });
        expect(resolveContinuityEntity(c, 'sc')).toEqual({ type: 'scene', name: 'Gate' });
        expect(resolveContinuityEntity(c, 'adv')).toEqual({ type: 'adventure', name: 'A' });
        expect(resolveContinuityEntity(c, 'nope')).toBeNull();
    });
});

describe('formatThreadsForPrep', () => {
    it('returns empty string for no threads', () => {
        expect(formatThreadsForPrep([])).toBe('');
    });

    it('renders a labelled bullet list', () => {
        const text = formatThreadsForPrep([
            { id: 'plot:p', kind: 'plot', entityId: 'p', title: 'The Heir', summary: 'Last session: advanced.' },
            { id: 'secret:s', kind: 'secret', entityId: 's', title: 'Spy', summary: '' },
        ]);
        expect(text).toBe(
            'Carried forward from previous sessions:\n- [Plot] The Heir — Last session: advanced.\n- [Secret] Spy'
        );
    });
});
