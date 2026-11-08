// @vitest-environment jsdom
/**
 * The loose lists on a saved campaign (`PlayerCharacter.playerFlags`,
 * `Location.aspects`, and a session's beats and planned / related id lists)
 * have their shape settled once, where data enters the store
 * (`migrateCampaignsData`, shared by startup, backup recovery, conflict reload
 * and file import), so every reader can use a plain `?? []`. The Session Log
 * editor builds its prep sheet on every render, so a list that slipped past
 * this check would take the whole editor down.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { setupTestEnvironment, type CreateCampaignStoreFn } from './helpers/testStoreFactory';
import { buildCampaignContext } from '../services/contextBuilder';
import { generateSessionPrepSheetMarkdown } from '../services/importExportService';
import type { Campaign } from '../types/index';

setupTestEnvironment();

let createCampaignStore: CreateCampaignStoreFn;
beforeAll(async () => {
    createCampaignStore = (await import('../services/campaignService')).createCampaignStore;
});

const liveStores: Array<{ destroy: () => void }> = [];
afterEach(() => {
    liveStores.splice(0).forEach(service => service.destroy());
    localStorage.clear();
});

const flushMicrotasks = () => new Promise(resolve => setTimeout(resolve, 0));

const sessionBase = (id: string) => ({
    id,
    title: `Session ${id}`,
    status: 'planned',
    sessionDate: '2026-01-01',
    prepNotes: '',
    runningNotes: '',
    structuredNotes: [],
    encounterLog: [],
    recap: '',
    notableEvents: '',
    looseEnds: '',
});

const campaignWithBadLists = {
    id: 'camp-lists',
    title: 'Bad Lists',
    setting: 'A world',
    npcs: [],
    factions: [],
    items: [],
    adventures: [],
    plots: [],
    notes: [],
    secrets: [],
    articles: [],
    sessionLogs: [
        {
            ...sessionBase('log-mixed'),
            beats: [null, 'loose', { id: 'b-num', title: 7, isCompleted: false }, { id: 'b-ok', title: 'Open on the bridge', isCompleted: false }],
            relatedPlotIds: 'plot-1',
            plannedSceneIds: ['scene-1', 3],
            plannedNpcIds: 'npc-1',
            plannedLocationIds: ['loc-mixed', null],
        },
        { ...sessionBase('log-bare'), beats: 'x', plannedNpcIds: {}, plannedLocationIds: 'loc-mixed' },
    ],
    locations: [
        { id: 'loc-bare', name: 'Bare String', description: '', secrets: '', subLocationIds: [], history: [], aspects: 'cold' },
        { id: 'loc-mixed', name: 'Mixed', description: '', secrets: '', subLocationIds: [], history: [], aspects: ['damp', 7, null] },
        { id: 'loc-none', name: 'Unset', description: '', secrets: '', subLocationIds: [], history: [] },
    ],
    playerCharacters: [
        { id: 'pc-bare', playerName: 'A', characterSocial: { characterName: 'Torvald' }, playerFlags: 'more combat' },
        { id: 'pc-mixed', playerName: 'B', characterSocial: { characterName: 'Mira' }, playerFlags: ['mystery', 42, null] },
        { id: 'pc-none', playerName: 'C', characterSocial: { characterName: 'Ash' } },
    ],
};

function expectCleanLists(campaign: Campaign) {
    const location = (id: string) => campaign.locations.find(l => l.id === id)!;
    const pc = (name: string) => campaign.playerCharacters.find(p => p.characterSocial?.characterName === name)!;

    expect(location('loc-bare')).not.toHaveProperty('aspects');
    expect(location('loc-mixed').aspects).toEqual(['damp']);
    expect(location('loc-none')).not.toHaveProperty('aspects');

    expect(pc('Torvald')).not.toHaveProperty('playerFlags');
    expect(pc('Mira').playerFlags).toEqual(['mystery']);
    expect(pc('Ash')).not.toHaveProperty('playerFlags');

    expect(buildCampaignContext({ variant: 'generation', campaign })).toContain(
        'Player Characters: Torvald, Mira (player wants more of: mystery), Ash',
    );

    const log = (id: string) => campaign.sessionLogs.find(l => l.id === id)!;
    expect(log('log-mixed').beats).toEqual([{ id: 'b-ok', title: 'Open on the bridge', isCompleted: false }]);
    expect(log('log-mixed').relatedPlotIds).toEqual([]);
    expect(log('log-mixed').plannedSceneIds).toEqual(['scene-1']);
    expect(log('log-mixed')).not.toHaveProperty('plannedNpcIds');
    expect(log('log-mixed').plannedLocationIds).toEqual(['loc-mixed']);
    expect(log('log-bare')).not.toHaveProperty('beats');
    expect(log('log-bare')).not.toHaveProperty('plannedNpcIds');
    expect(log('log-bare')).not.toHaveProperty('plannedLocationIds');

    const sheet = generateSessionPrepSheetMarkdown(log('log-mixed'), campaign);
    expect(sheet).toContain('Open on the bridge');
    expect(sheet).toContain('Aspects: damp');
    expect(() => generateSessionPrepSheetMarkdown(log('log-bare'), campaign)).not.toThrow();
}

describe('optional string lists are settled when data enters the store', () => {
    it('on startup, from a saved campaign', async () => {
        localStorage.setItem('realmweaver-campaigns', JSON.stringify([campaignWithBadLists]));
        localStorage.setItem('realmweaver-active-campaign-id', 'camp-lists');

        const service = createCampaignStore({ persist: true });
        liveStores.push(service);
        await flushMicrotasks();

        expectCleanLists(service.getState().campaigns.find(c => c.id === 'camp-lists')!);
    });

    it('on file import', async () => {
        const service = createCampaignStore({ persist: false });
        liveStores.push(service);
        const file = new File([JSON.stringify(campaignWithBadLists)], 'campaign.json', { type: 'application/json' });

        await service.importCampaign(file);

        expectCleanLists(service.getState().campaigns.find(c => c.title === 'Bad Lists')!);
    });

    it('leaves well-formed lists exactly as they were', async () => {
        const service = createCampaignStore({ persist: false });
        liveStores.push(service);
        const file = new File(
            [JSON.stringify({
                ...campaignWithBadLists,
                locations: [{ id: 'loc-ok', name: 'Fine', description: '', secrets: '', subLocationIds: [], history: [], aspects: ['cold', 'damp'] }],
                playerCharacters: [{ id: 'pc-ok', playerName: 'A', characterSocial: { characterName: 'Torvald' }, playerFlags: ['more combat'] }],
                sessionLogs: [{
                    ...sessionBase('log-ok'),
                    beats: [{ id: 'b-1', title: 'Open on the bridge', isCompleted: true }],
                    relatedPlotIds: ['plot-1'],
                    plannedSceneIds: ['scene-1'],
                    plannedNpcIds: ['npc-1'],
                    plannedLocationIds: ['loc-ok'],
                }],
            })],
            'campaign.json',
            { type: 'application/json' },
        );

        await service.importCampaign(file);

        const campaign = service.getState().campaigns.find(c => c.title === 'Bad Lists')!;
        expect(campaign.locations[0].aspects).toEqual(['cold', 'damp']);
        expect(campaign.playerCharacters[0].playerFlags).toEqual(['more combat']);
        expect(campaign.sessionLogs[0]).toMatchObject({
            beats: [{ id: 'b-1', title: 'Open on the bridge', isCompleted: true }],
            relatedPlotIds: ['plot-1'],
            plannedSceneIds: ['scene-1'],
            plannedNpcIds: ['npc-1'],
            plannedLocationIds: ['loc-ok'],
        });
    });
});
