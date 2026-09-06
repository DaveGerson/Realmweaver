/**
 * SPEC — the Stage & the scene menu in services/campaignService.ts
 * (docs/design/unstructured-play.md)
 *
 * A session does not have to be a track of scenes. The Stage is the live
 * where/who/what of the table, independent of any prepped Scene; the scene
 * list is a MENU that may draw from any adventure; and prep the DM does not
 * use goes back on the shelf, never flagged. The store contract:
 *
 *  1. The Stage is session-scoped and edited through dedicated methods that
 *     auto-log what changed at the table (moved to, enters, leaves, now).
 *  2. Entering a scene leaves the previous one started (not finished) and
 *     clears the Stage; leaving a scene ("Done" or "Set Aside") seeds the
 *     Stage from that scene so the room persists past the script.
 *  3. Tonight's list can hold scenes from several adventures; advanceScene,
 *     goLive and the Stage helpers resolve scenes campaign-wide.
 *  4. Put back on the shelf: removePlannedScene drops the scene from tonight,
 *     reopens a started scene as planned, and steps out of it if it was live.
 *  5. The Stage's ids are in the integrity contract: purge on delete, remap
 *     on duplicate.
 *  6. createFreeformSession mints a planned freeform session without going
 *     live (one goLive path), and goLive is idempotent for the live session.
 *  7. tickPlotClock clamps to [0, segments] and logs a `world-moved` entry.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestEnvironment, type CreateCampaignStoreFn } from './helpers/testStoreFactory';
import type { AdventureForBatchAdd } from '../types/index';

setupTestEnvironment();

let createCampaignStore: CreateCampaignStoreFn;

beforeAll(async () => {
    const mod = await import('../services/campaignService');
    createCampaignStore = mod.createCampaignStore;
});

function scene(title: string, over: Partial<AdventureForBatchAdd['scenes'][number]> = {}): AdventureForBatchAdd['scenes'][number] {
    return {
        title,
        type: 'social',
        status: 'planned',
        readAloudText: '',
        gmNotes: '',
        skillChecks: [],
        rewards: '',
        npcIds: [],
        locationId: undefined,
        ...over,
    };
}

function setup() {
    const service = createCampaignStore({ persist: false });
    service.init();
    service.prepareNewCampaign();
    service.createCampaign('The Drowned Coast', 'Salt marshes and sunken chapels.', 'custom');
    const campaign = () => service.getState().campaigns[0];
    const activeSession = () => campaign().sessionLogs.find(s => s.id === campaign().activeSessionId)!;

    const tavernId = service.createLocation({
        name: 'The Gull and Gallows', description: 'A crooked tavern on stilts.', secrets: '', subLocationIds: [], history: [],
    });
    const chapelId = service.createLocation({
        name: 'The Drowned Chapel', description: 'Half underwater at high tide.', secrets: '', subLocationIds: [], history: [],
    });
    const serahId = service.createNpc({
        name: 'Serah Vane', description: '', traits: 'clipped, watchful', backstory: '', motivations: '', secrets: '', stats: '',
        exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
    });
    const gundrenId = service.createNpc({
        name: 'Gundren Mott', description: '', traits: 'loud', backstory: '', motivations: '', secrets: '', stats: '',
        exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
    });

    const advA = service.createFullAdventure({
        title: 'Tides of Ash', hook: '', theme: '', level: 3,
        scenes: [
            scene('Arrival at the Gull', { locationId: tavernId, npcIds: [gundrenId] }),
            scene('The Chapel Bell', { locationId: chapelId, npcIds: [] }),
        ],
    });
    const advB = service.createFullAdventure({
        title: 'Side Roads', hook: '', theme: '', level: 3,
        scenes: [scene('Ambush on the Causeway', { npcIds: [serahId] })],
    });

    const sceneIdsA = campaign().adventures.find(a => a.id === advA)!.scenes.map(s => s.id);
    const sceneIdsB = campaign().adventures.find(a => a.id === advB)!.scenes.map(s => s.id);

    return { service, campaign, activeSession, tavernId, chapelId, serahId, gundrenId, advA, advB, sceneIdsA, sceneIdsB };
}

function liveSession(service: ReturnType<CreateCampaignStoreFn>, over: Partial<Parameters<ReturnType<CreateCampaignStoreFn>['createSessionLog']>[0]> = {}) {
    const id = service.createSessionLog({
        title: 'Session 1', status: 'planned', sessionDate: '2026-02-01', plannedSceneIds: [], prepNotes: '',
        runningNotes: '', structuredNotes: [], relatedPlotIds: [], encounterLog: [], recap: '', notableEvents: '', looseEnds: '',
        ...over,
    });
    service.goLive(id);
    return id;
}

describe('The Stage — live where/who/what on the active session', () => {
    it('starts empty on a freeform session and puts the party somewhere with one call, logging the move', () => {
        const { service, activeSession, tavernId } = setup();
        liveSession(service);
        expect(activeSession().stage).toBeUndefined();

        service.setStageLocation(tavernId);
        expect(activeSession().stage?.locationId).toBe(tavernId);
        expect(activeSession().stage?.place).toBeUndefined();
        const logged = activeSession().structuredNotes.filter(n => n.type === 'scene-transition');
        expect(logged.map(n => n.content)).toContain('Moved to: The Gull and Gallows');
    });

    it('accepts a freeform place when nothing is linked, and clears it when a location is linked', () => {
        const { service, activeSession, chapelId } = setup();
        liveSession(service);

        service.setStageLocation(null, 'a nameless roadside shrine');
        expect(activeSession().stage?.place).toBe('a nameless roadside shrine');
        expect(activeSession().stage?.locationId).toBeUndefined();
        expect(activeSession().structuredNotes.some(n => n.content === 'Moved to: a nameless roadside shrine')).toBe(true);

        service.setStageLocation(chapelId);
        expect(activeSession().stage?.locationId).toBe(chapelId);
        expect(activeSession().stage?.place).toBeUndefined();
    });

    it('does not log a move when the place did not change, and ignores an unknown location id', () => {
        const { service, activeSession, tavernId } = setup();
        liveSession(service);
        service.setStageLocation(tavernId);
        const before = activeSession().structuredNotes.length;
        service.setStageLocation(tavernId);
        expect(activeSession().structuredNotes.length).toBe(before);

        service.setStageLocation('not-a-location');
        expect(activeSession().stage?.locationId).toBeUndefined();
    });

    it('puts NPCs on stage once each, logs enters and leaves, and refuses unknown ids', () => {
        const { service, activeSession, serahId } = setup();
        liveSession(service);

        expect(service.addNpcToStage(serahId)).toBe(true);
        expect(service.addNpcToStage(serahId)).toBe(false);
        expect(service.addNpcToStage('ghost')).toBe(false);
        expect(activeSession().stage?.npcIds).toEqual([serahId]);
        expect(activeSession().structuredNotes.filter(n => n.content === 'Serah Vane enters the scene')).toHaveLength(1);

        service.removeNpcFromStage(serahId);
        expect(activeSession().stage?.npcIds).toEqual([]);
        expect(activeSession().structuredNotes.some(n => n.content === 'Serah Vane leaves the scene')).toBe(true);
    });

    it('records what is happening now and logs it only when it changes to something', () => {
        const { service, activeSession } = setup();
        liveSession(service);

        service.setStageFocus('The party haggles over passage north');
        service.setStageFocus('The party haggles over passage north');
        expect(activeSession().stage?.focus).toBe('The party haggles over passage north');
        expect(activeSession().structuredNotes.filter(n => n.content.startsWith('Now: '))).toHaveLength(1);

        service.setStageFocus('   ');
        expect(activeSession().stage?.focus).toBeUndefined();
        expect(activeSession().structuredNotes.filter(n => n.content.startsWith('Now: '))).toHaveLength(1);
    });

    it('does nothing when no session is live', () => {
        const { service, campaign, serahId, tavernId } = setup();
        service.setStageLocation(tavernId);
        expect(service.addNpcToStage(serahId)).toBe(false);
        service.setStageFocus('nothing');
        expect(campaign().sessionLogs).toHaveLength(0);
    });
});

describe('The scene menu — enter, leave, pull from the shelf, put back', () => {
    it('entering a scene leaves the previous one started, not finished, and clears the Stage', () => {
        const { service, campaign, activeSession, sceneIdsA, serahId } = setup();
        liveSession(service, { plannedSceneIds: sceneIdsA });
        // goLive opened the first scene.
        expect(campaign().activeSceneId).toBe(sceneIdsA[0]);
        service.addNpcToStage(serahId);

        service.enterScene(sceneIdsA[1]);
        const scenes = campaign().adventures[0].scenes;
        expect(scenes[0].status).toBe('in-progress');
        expect(scenes[1].status).toBe('in-progress');
        expect(campaign().activeSceneId).toBe(sceneIdsA[1]);
        expect(activeSession().stage).toEqual({ npcIds: [] });
        expect(activeSession().structuredNotes.some(n => n.content === 'Scene: "The Chapel Bell"')).toBe(true);
    });

    it('re-entering a completed scene reopens it', () => {
        const { service, campaign, sceneIdsA } = setup();
        liveSession(service, { plannedSceneIds: sceneIdsA });
        service.leaveScene({ complete: true });
        expect(campaign().adventures[0].scenes[0].status).toBe('completed');
        service.enterScene(sceneIdsA[0]);
        expect(campaign().adventures[0].scenes[0].status).toBe('in-progress');
    });

    it('"Done" completes the scene and seeds the Stage with its place and cast plus whoever was already there', () => {
        const { service, campaign, activeSession, sceneIdsA, tavernId, gundrenId, serahId } = setup();
        liveSession(service, { plannedSceneIds: sceneIdsA });
        service.addNpcToStage(serahId);

        service.leaveScene({ complete: true });
        expect(campaign().activeSceneId).toBeUndefined();
        expect(campaign().adventures[0].scenes[0].status).toBe('completed');
        const stage = activeSession().stage!;
        expect(stage.locationId).toBe(tavernId);
        expect(new Set(stage.npcIds)).toEqual(new Set([gundrenId, serahId]));
        expect(activeSession().structuredNotes.some(n => n.content === 'Scene completed: "Arrival at the Gull"')).toBe(true);
    });

    it('"Set Aside" steps out without finishing and still seeds the Stage', () => {
        const { service, campaign, activeSession, sceneIdsA, tavernId } = setup();
        liveSession(service, { plannedSceneIds: sceneIdsA });

        service.leaveScene({ complete: false });
        expect(campaign().activeSceneId).toBeUndefined();
        expect(campaign().adventures[0].scenes[0].status).toBe('in-progress');
        expect(activeSession().stage?.locationId).toBe(tavernId);
        expect(activeSession().structuredNotes.some(n => n.content === 'Set aside: "Arrival at the Gull"')).toBe(true);
    });

    it('honours the prep roster when seeding the Stage (finding #26: plannedNpcIds / plannedLocationIds win)', () => {
        const { service, activeSession, sceneIdsA, serahId } = setup();
        liveSession(service, { plannedSceneIds: sceneIdsA, plannedNpcIds: [serahId], plannedLocationIds: [] });
        service.leaveScene({ complete: true });
        const stage = activeSession().stage!;
        expect(stage.npcIds).toEqual([serahId]);
        expect(stage.locationId).toBeUndefined();
    });

    it('pulls a scene from another adventure into tonight and advances into it', () => {
        const { service, campaign, activeSession, sceneIdsA, sceneIdsB, advB } = setup();
        liveSession(service, { plannedSceneIds: [sceneIdsA[0]] });

        expect(service.addPlannedScene(sceneIdsB[0])).toBe(true);
        expect(service.addPlannedScene(sceneIdsB[0])).toBe(false);
        expect(service.addPlannedScene('no-such-scene')).toBe(false);
        expect(activeSession().plannedSceneIds).toEqual([sceneIdsA[0], sceneIdsB[0]]);

        service.advanceScene();
        expect(campaign().activeSceneId).toBe(sceneIdsB[0]);
        const foreign = campaign().adventures.find(a => a.id === advB)!.scenes[0];
        expect(foreign.status).toBe('in-progress');
        expect(campaign().adventures[0].scenes[0].status).toBe('completed');
        expect(activeSession().structuredNotes.some(n => n.content === 'Scene transition: moved to "Ambush on the Causeway"')).toBe(true);
    });

    it('advancing past the last scene seeds the Stage instead of leaving the table nowhere', () => {
        const { service, campaign, activeSession, sceneIdsA, tavernId, gundrenId } = setup();
        liveSession(service, { plannedSceneIds: [sceneIdsA[0]] });
        service.advanceScene();
        expect(campaign().activeSceneId).toBeUndefined();
        expect(activeSession().stage?.locationId).toBe(tavernId);
        expect(activeSession().stage?.npcIds).toEqual([gundrenId]);
    });

    it('goLive opens the first planned scene even when it lives in another adventure', () => {
        const { service, campaign, sceneIdsB, advB } = setup();
        const id = service.createSessionLog({
            title: 'Freeform with a borrowed scene', status: 'planned', sessionDate: '2026-02-01',
            plannedSceneIds: [sceneIdsB[0]], prepNotes: '', runningNotes: '', structuredNotes: [], relatedPlotIds: [],
            encounterLog: [], recap: '', notableEvents: '', looseEnds: '',
        });
        service.goLive(id);
        expect(campaign().activeSceneId).toBe(sceneIdsB[0]);
        expect(campaign().adventures.find(a => a.id === advB)!.scenes[0].status).toBe('in-progress');
    });

    it('puts a scene back on the shelf: dropped from tonight, reopened as planned, no longer active', () => {
        const { service, campaign, activeSession, sceneIdsA } = setup();
        liveSession(service, { plannedSceneIds: sceneIdsA });
        expect(campaign().adventures[0].scenes[0].status).toBe('in-progress');

        service.removePlannedScene(sceneIdsA[0]);
        expect(activeSession().plannedSceneIds).toEqual([sceneIdsA[1]]);
        expect(campaign().adventures[0].scenes[0].status).toBe('planned');
        expect(campaign().activeSceneId).toBeUndefined();
        // The scene itself is untouched — unused prep is inventory, not a failure.
        expect(campaign().adventures[0].scenes).toHaveLength(2);
    });
});

describe('Integrity — the Stage joins the purge and remap contracts', () => {
    it('deleting an NPC takes them off the Stage; deleting the location clears the place', () => {
        const { service, activeSession, tavernId, serahId } = setup();
        liveSession(service);
        service.setStageLocation(tavernId);
        service.addNpcToStage(serahId);

        service.deleteNpc(serahId);
        expect(activeSession().stage?.npcIds).toEqual([]);
        service.deleteLocation(tavernId);
        expect(activeSession().stage?.locationId).toBeUndefined();
    });

    it('duplicating a campaign remaps the Stage onto the copy\'s own entities', () => {
        const { service, campaign, tavernId, serahId } = setup();
        liveSession(service);
        service.setStageLocation(tavernId);
        service.addNpcToStage(serahId);
        service.setStageFocus('Haggling');

        const source = campaign();
        const copyId = service.duplicateCampaign(source.id);
        const copy = service.getState().campaigns.find(c => c.id === copyId)!;
        const copiedLog = copy.sessionLogs[0];
        expect(copiedLog.stage).toBeDefined();
        expect(copiedLog.stage!.focus).toBe('Haggling');
        expect(copiedLog.stage!.locationId).not.toBe(tavernId);
        expect(copy.locations.some(l => l.id === copiedLog.stage!.locationId)).toBe(true);
        expect(copiedLog.stage!.npcIds).toHaveLength(1);
        expect(copiedLog.stage!.npcIds[0]).not.toBe(serahId);
        expect(copy.npcs.some(n => n.id === copiedLog.stage!.npcIds[0])).toBe(true);
    });
});

describe('The on-ramp — createFreeformSession and an idempotent goLive', () => {
    it('mints a planned freeform session with an empty Stage and does not go live by itself', () => {
        const { service, campaign } = setup();
        const id = service.createFreeformSession();
        expect(id).toBeTruthy();
        const log = campaign().sessionLogs.find(s => s.id === id)!;
        expect(log.status).toBe('planned');
        expect(log.title).toBe('Session 1');
        expect(log.adventureId).toBeUndefined();
        expect(log.plannedSceneIds).toEqual([]);
        expect(log.stage).toEqual({ npcIds: [] });
        expect(campaign().activeSessionId).toBeUndefined();

        service.goLive(id!);
        expect(campaign().activeSessionId).toBe(id);
        expect(campaign().activeSceneId).toBeUndefined();
    });

    it('numbers the next freeform session after the sessions that exist and accepts a title', () => {
        const { service, campaign } = setup();
        service.createFreeformSession();
        const second = service.createFreeformSession('  The Night Market  ');
        expect(campaign().sessionLogs.find(s => s.id === second)!.title).toBe('The Night Market');
        const third = service.createFreeformSession();
        expect(campaign().sessionLogs.find(s => s.id === third)!.title).toBe('Session 3');
    });

    it('returns null with no active campaign', () => {
        const service = createCampaignStore({ persist: false });
        service.init();
        expect(service.createFreeformSession()).toBeNull();
    });

    it('a second goLive for the session already live logs nothing new', () => {
        const { service, activeSession } = setup();
        const id = liveSession(service);
        const before = activeSession().structuredNotes.length;
        service.goLive(id);
        expect(activeSession().structuredNotes.length).toBe(before);
        expect(activeSession().structuredNotes.filter(n => n.content.startsWith('Session started')).length).toBe(1);
    });
});

describe('Plot clocks — tickPlotClock', () => {
    it('ticks by one, clamps at the top, and logs a world-moved entry naming the count', () => {
        const { service, campaign, activeSession } = setup();
        const plotId = service.createPlot({
            title: 'The Tide Cult', description: '', status: 'active', relatedEntityIds: [],
            clock: { segments: 4, filled: 2 }, ifIgnored: 'The chapel floods for good.',
        });
        liveSession(service);

        service.tickPlotClock(plotId);
        expect(campaign().plots.find(p => p.id === plotId)!.clock).toEqual({ segments: 4, filled: 3 });
        service.tickPlotClock(plotId);
        service.tickPlotClock(plotId);
        expect(campaign().plots.find(p => p.id === plotId)!.clock).toEqual({ segments: 4, filled: 4 });

        const moves = activeSession().structuredNotes.filter(n => n.type === 'world-moved');
        expect(moves.map(n => n.content)).toEqual([
            'Clock: "The Tide Cult" 3/4',
            'Clock: "The Tide Cult" 4/4 — the clock has run out',
        ]);
    });

    it('ticks backwards with a negative delta, floors at zero, and ignores plots without a clock', () => {
        const { service, campaign } = setup();
        const clocked = service.createPlot({ title: 'A', description: '', status: 'active', relatedEntityIds: [], clock: { segments: 6, filled: 1 } });
        const bare = service.createPlot({ title: 'B', description: '', status: 'active', relatedEntityIds: [] });
        service.tickPlotClock(clocked, -1);
        service.tickPlotClock(clocked, -1);
        expect(campaign().plots.find(p => p.id === clocked)!.clock).toEqual({ segments: 6, filled: 0 });
        service.tickPlotClock(bare);
        expect(campaign().plots.find(p => p.id === bare)!.clock).toBeUndefined();
    });

    it('works with no live session (no log entry, clock still moves)', () => {
        const { service, campaign } = setup();
        const plotId = service.createPlot({ title: 'A', description: '', status: 'active', relatedEntityIds: [], clock: { segments: 4, filled: 0 } });
        service.tickPlotClock(plotId);
        expect(campaign().plots.find(p => p.id === plotId)!.clock).toEqual({ segments: 4, filled: 1 });
    });
});
