import { describe, it, expect, beforeAll, vi } from 'vitest';

// Provide a minimal localStorage polyfill before importing campaignService.
// The module-level singleton (persist: true) accesses localStorage on init.
// ES import statements are hoisted, so we must use dynamic import().
const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
});

// Dynamic import so localStorage polyfill is in place first
let createCampaignStore: typeof import('../services/campaignService').createCampaignStore;

beforeAll(async () => {
    const mod = await import('../services/campaignService');
    createCampaignStore = mod.createCampaignStore;
});

// Helper to create a fully populated test store
function createTestStore() {
    const service = createCampaignStore({ persist: false });
    service.init();
    service.prepareNewCampaign();
    service.createCampaign('Test Campaign', 'A fantasy world', 'custom');

    const campaign = () => service.getState().campaigns[0];

    return { service, campaign };
}

describe('Sprint 1: Session Runner Service Methods', () => {

    describe('goLive', () => {
        it('sets session status to active', () => {
            const { service, campaign } = createTestStore();

            const advId = service.createFullAdventure({
                title: 'Adventure',
                theme: 'test',
                hook: '',
                level: 1,
                scenes: [
                    { title: 'Scene 1', type: 'exploration', readAloudText: '', gmNotes: '', rewards: '', skillChecks: [], npcIds: [], status: 'planned' },
                ]
            });

            const adv = campaign().adventures[0];
            const sessionId = service.createSessionLog({
                title: 'Session 1',
                status: 'planned',
                sessionDate: '',
                adventureId: advId,
                plannedSceneIds: [adv.scenes[0].id],
                prepNotes: '',
                relatedPlotIds: [],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
            });

            service.goLive(sessionId);

            const session = campaign().sessionLogs.find(s => s.id === sessionId)!;
            expect(session.status).toBe('active');
            expect(campaign().activeSessionId).toBe(sessionId);
        });

        it('activates the first planned scene', () => {
            const { service, campaign } = createTestStore();

            const advId = service.createFullAdventure({
                title: 'Adventure',
                theme: 'test',
                hook: '',
                level: 1,
                scenes: [
                    { title: 'Scene 1', type: 'exploration', readAloudText: '', gmNotes: '', rewards: '', skillChecks: [], npcIds: [], status: 'planned' },
                    { title: 'Scene 2', type: 'combat', readAloudText: '', gmNotes: '', rewards: '', skillChecks: [], npcIds: [], status: 'planned' },
                ]
            });

            const adv = campaign().adventures[0];
            const sessionId = service.createSessionLog({
                title: 'Session 1',
                status: 'planned',
                sessionDate: '',
                adventureId: advId,
                plannedSceneIds: adv.scenes.map(s => s.id),
                prepNotes: '',
                relatedPlotIds: [],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
            });

            service.goLive(sessionId);

            expect(campaign().activeSceneId).toBe(adv.scenes[0].id);
            const scene1 = campaign().adventures[0].scenes[0];
            expect(scene1.status).toBe('in-progress');
        });

        it('sets sessionDate if not already set', () => {
            const { service, campaign } = createTestStore();

            const sessionId = service.createSessionLog({
                title: 'Session',
                status: 'planned',
                sessionDate: '',
                plannedSceneIds: [],
                prepNotes: '',
                relatedPlotIds: [],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
            });

            service.goLive(sessionId);

            const session = campaign().sessionLogs.find(s => s.id === sessionId)!;
            expect(session.sessionDate).not.toBe('');
        });

        it('preserves existing sessionDate', () => {
            const { service, campaign } = createTestStore();

            const existingDate = '2026-01-15';
            const sessionId = service.createSessionLog({
                title: 'Session',
                status: 'planned',
                sessionDate: existingDate,
                plannedSceneIds: [],
                prepNotes: '',
                relatedPlotIds: [],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
            });

            service.goLive(sessionId);

            const session = campaign().sessionLogs.find(s => s.id === sessionId)!;
            expect(session.sessionDate).toBe(existingDate);
        });

        it('logs session start event in structuredNotes', () => {
            const { service, campaign } = createTestStore();

            const sessionId = service.createSessionLog({
                title: 'My Session',
                status: 'planned',
                sessionDate: '2026-01-15',
                plannedSceneIds: [],
                prepNotes: '',
                relatedPlotIds: [],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
            });

            service.goLive(sessionId);

            const session = campaign().sessionLogs.find(s => s.id === sessionId)!;
            expect(session.structuredNotes.length).toBeGreaterThan(0);
            const startNote = session.structuredNotes.find(n => n.content.includes('Session started'));
            expect(startNote).toBeDefined();
            expect(startNote!.content).toContain('My Session');
        });

        it('deactivates previously active session', () => {
            const { service, campaign } = createTestStore();

            const session1Id = service.createSessionLog({
                title: 'Session 1',
                status: 'planned',
                sessionDate: '2026-01-15',
                plannedSceneIds: [],
                prepNotes: '',
                relatedPlotIds: [],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
            });

            service.goLive(session1Id);
            expect(campaign().sessionLogs.find(s => s.id === session1Id)!.status).toBe('active');

            const session2Id = service.createSessionLog({
                title: 'Session 2',
                status: 'planned',
                sessionDate: '',
                plannedSceneIds: [],
                prepNotes: '',
                relatedPlotIds: [],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
            });

            service.goLive(session2Id);

            const session1 = campaign().sessionLogs.find(s => s.id === session1Id)!;
            expect(session1.status).toBe('planned');
            expect(campaign().activeSessionId).toBe(session2Id);
        });
    });

    describe('advanceScene', () => {
        function setupLiveSession() {
            const { service, campaign } = createTestStore();

            const advId = service.createFullAdventure({
                title: 'Adventure',
                theme: 'test',
                hook: '',
                level: 1,
                scenes: [
                    { title: 'Scene 1', type: 'exploration', readAloudText: '', gmNotes: '', rewards: '', skillChecks: [], npcIds: [], status: 'planned' },
                    { title: 'Scene 2', type: 'combat', readAloudText: '', gmNotes: '', rewards: '', skillChecks: [], npcIds: [], status: 'planned' },
                    { title: 'Scene 3', type: 'social', readAloudText: '', gmNotes: '', rewards: '', skillChecks: [], npcIds: [], status: 'planned' },
                ]
            });

            const adv = campaign().adventures[0];
            const sceneIds = adv.scenes.map(s => s.id);

            const sessionId = service.createSessionLog({
                title: 'Session 1',
                status: 'planned',
                sessionDate: '2026-01-15',
                adventureId: advId,
                plannedSceneIds: sceneIds,
                prepNotes: '',
                relatedPlotIds: [],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
            });

            service.goLive(sessionId);

            return { service, campaign, sceneIds, sessionId, advId };
        }

        it('marks current scene as completed and moves to next', () => {
            const { service, campaign, sceneIds } = setupLiveSession();

            service.advanceScene();

            const adv = campaign().adventures[0];
            expect(adv.scenes[0].status).toBe('completed');
            expect(adv.scenes[1].status).toBe('in-progress');
            expect(campaign().activeSceneId).toBe(sceneIds[1]);
        });

        it('logs scene transition auto-event', () => {
            const { service, campaign, sessionId } = setupLiveSession();

            const notesBefore = campaign().sessionLogs.find(s => s.id === sessionId)!.structuredNotes.length;

            service.advanceScene();

            const session = campaign().sessionLogs.find(s => s.id === sessionId)!;
            const newNotes = session.structuredNotes.slice(notesBefore);
            expect(newNotes.length).toBe(1);
            expect(newNotes[0].type).toBe('scene-transition');
            expect(newNotes[0].content).toContain('Scene 2');
        });

        it('clears activeSceneId when last scene is advanced', () => {
            const { service, campaign } = setupLiveSession();

            service.advanceScene(); // Scene 1 -> 2
            service.advanceScene(); // Scene 2 -> 3
            service.advanceScene(); // Scene 3 -> no more

            expect(campaign().activeSceneId).toBeUndefined();
        });

        it('does nothing when no active session', () => {
            const { service } = createTestStore();
            service.advanceScene();
        });
    });

    describe('setSceneStatus', () => {
        it('sets scene status correctly', () => {
            const { service, campaign } = createTestStore();

            const advId = service.createFullAdventure({
                title: 'Adventure',
                theme: 'test',
                hook: '',
                level: 1,
                scenes: [
                    { title: 'Scene 1', type: 'exploration', readAloudText: '', gmNotes: '', rewards: '', skillChecks: [], npcIds: [], status: 'planned' },
                ]
            });

            const adv = campaign().adventures[0];
            service.setSceneStatus(advId, adv.scenes[0].id, 'completed');

            expect(campaign().adventures[0].scenes[0].status).toBe('completed');
        });

        it('auto-logs scene completion when active session exists', () => {
            const { service, campaign } = createTestStore();

            const advId = service.createFullAdventure({
                title: 'Adventure',
                theme: 'test',
                hook: '',
                level: 1,
                scenes: [
                    { title: 'Scene 1', type: 'exploration', readAloudText: '', gmNotes: '', rewards: '', skillChecks: [], npcIds: [], status: 'planned' },
                ]
            });

            const adv = campaign().adventures[0];
            const sessionId = service.createSessionLog({
                title: 'Session',
                status: 'planned',
                sessionDate: '',
                adventureId: advId,
                plannedSceneIds: [adv.scenes[0].id],
                prepNotes: '',
                relatedPlotIds: [],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
            });

            service.goLive(sessionId);

            const notesBefore = campaign().sessionLogs.find(s => s.id === sessionId)!.structuredNotes.length;

            service.setSceneStatus(advId, adv.scenes[0].id, 'completed');

            const session = campaign().sessionLogs.find(s => s.id === sessionId)!;
            const newNotes = session.structuredNotes.slice(notesBefore);
            expect(newNotes.length).toBe(1);
            expect(newNotes[0].type).toBe('scene-transition');
            expect(newNotes[0].content).toContain('completed');
        });
    });

    describe('endSession', () => {
        it('marks session as completed', () => {
            const { service, campaign } = createTestStore();

            const sessionId = service.createSessionLog({
                title: 'Session',
                status: 'planned',
                sessionDate: '',
                plannedSceneIds: [],
                prepNotes: '',
                relatedPlotIds: [],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
            });

            service.goLive(sessionId);
            service.endSession();

            const session = campaign().sessionLogs.find(s => s.id === sessionId)!;
            expect(session.status).toBe('completed');
        });

        it('clears activeSessionId and activeSceneId', () => {
            const { service, campaign } = createTestStore();

            const advId = service.createFullAdventure({
                title: 'Adventure',
                theme: 'test',
                hook: '',
                level: 1,
                scenes: [
                    { title: 'Scene 1', type: 'exploration', readAloudText: '', gmNotes: '', rewards: '', skillChecks: [], npcIds: [], status: 'planned' },
                ]
            });

            const adv = campaign().adventures[0];
            const sessionId = service.createSessionLog({
                title: 'Session',
                status: 'planned',
                sessionDate: '',
                adventureId: advId,
                plannedSceneIds: [adv.scenes[0].id],
                prepNotes: '',
                relatedPlotIds: [],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
            });

            service.goLive(sessionId);
            expect(campaign().activeSessionId).toBe(sessionId);
            expect(campaign().activeSceneId).toBe(adv.scenes[0].id);

            service.endSession();

            expect(campaign().activeSessionId).toBeUndefined();
            expect(campaign().activeSceneId).toBeUndefined();
        });

        it('archives active encounter to session encounterLog', () => {
            const { service, campaign } = createTestStore();

            const sessionId = service.createSessionLog({
                title: 'Session',
                status: 'planned',
                sessionDate: '',
                plannedSceneIds: [],
                prepNotes: '',
                relatedPlotIds: [],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
            });

            service.goLive(sessionId);

            service.updateEncounter({
                id: 'enc-1',
                round: 3,
                turnIndex: 1,
                combatants: [{ id: 'c1', name: 'Goblin', type: 'monster', initiative: 15, hp: 5, maxHp: 7 }],
            });

            service.endSession();

            const session = campaign().sessionLogs.find(s => s.id === sessionId)!;
            expect(session.encounterLog.length).toBe(1);
            expect(session.encounterLog[0].combatants[0].name).toBe('Goblin');
            expect(campaign().activeEncounter).toBeUndefined();
        });

        it('does nothing when no active session', () => {
            const { service } = createTestStore();
            service.endSession();
        });
    });

    describe('addSessionRunnerNote', () => {
        it('adds a manual note to the active session', () => {
            const { service, campaign } = createTestStore();

            const sessionId = service.createSessionLog({
                title: 'Session',
                status: 'planned',
                sessionDate: '',
                plannedSceneIds: [],
                prepNotes: '',
                relatedPlotIds: [],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
            });

            service.goLive(sessionId);

            service.addSessionRunnerNote('The party enters the tavern');

            const session = campaign().sessionLogs.find(s => s.id === sessionId)!;
            const note = session.structuredNotes[session.structuredNotes.length - 1];
            expect(note.content).toBe('The party enters the tavern');
            expect(note.type).toBe('manual');
            expect(note.isImportant).toBe(false);
        });

        it('adds note with custom type and tags', () => {
            const { service, campaign } = createTestStore();

            const sessionId = service.createSessionLog({
                title: 'Session',
                status: 'planned',
                sessionDate: '',
                plannedSceneIds: [],
                prepNotes: '',
                relatedPlotIds: [],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
            });

            service.goLive(sessionId);
            service.addSessionRunnerNote('Combat begins', [], 'combat', ['Combat', 'NPC']);

            const session = campaign().sessionLogs.find(s => s.id === sessionId)!;
            const note = session.structuredNotes[session.structuredNotes.length - 1];
            expect(note.type).toBe('combat');
            expect(note.tags).toEqual(['Combat', 'NPC']);
        });

        it('does nothing when no active session', () => {
            const { service } = createTestStore();
            service.addSessionRunnerNote('This should not crash');
        });
    });

    describe('addDiceRollToSession', () => {
        it('adds dice roll to active session', () => {
            const { service, campaign } = createTestStore();

            const sessionId = service.createSessionLog({
                title: 'Session',
                status: 'planned',
                sessionDate: '',
                plannedSceneIds: [],
                prepNotes: '',
                relatedPlotIds: [],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
            });

            service.goLive(sessionId);
            service.addDiceRollToSession({
                id: 'roll-1',
                formula: '2d6+4',
                results: [3, 5],
                total: 12,
                timestamp: new Date().toISOString(),
                note: 'Attack roll',
            });

            const session = campaign().sessionLogs.find(s => s.id === sessionId)!;
            expect(session.diceRolls).toHaveLength(1);
            expect(session.diceRolls![0].formula).toBe('2d6+4');
            expect(session.diceRolls![0].total).toBe(12);
            expect(session.diceRolls![0].note).toBe('Attack roll');
        });

        it('does nothing when no active session', () => {
            const { service } = createTestStore();
            service.addDiceRollToSession({
                id: 'roll-1',
                formula: '1d20',
                results: [15],
                total: 15,
                timestamp: new Date().toISOString(),
            });
        });
    });

    describe('addAutoEvent', () => {
        it('adds auto-generated event to active session', () => {
            const { service, campaign } = createTestStore();

            const sessionId = service.createSessionLog({
                title: 'Session',
                status: 'planned',
                sessionDate: '',
                plannedSceneIds: [],
                prepNotes: '',
                relatedPlotIds: [],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
            });

            service.goLive(sessionId);

            service.addAutoEvent('combat', 'Combat ended: Party vs Goblins');

            const session = campaign().sessionLogs.find(s => s.id === sessionId)!;
            const note = session.structuredNotes[session.structuredNotes.length - 1];
            expect(note.type).toBe('combat');
            expect(note.content).toBe('Combat ended: Party vs Goblins');
            expect(note.isImportant).toBe(false);
        });

        it('does nothing when no active session', () => {
            const { service } = createTestStore();
            service.addAutoEvent('combat', 'This should not crash');
        });
    });

    describe('toggleNoteImportance', () => {
        it('toggles isImportant flag on a note', () => {
            const { service, campaign } = createTestStore();

            const sessionId = service.createSessionLog({
                title: 'Session',
                status: 'planned',
                sessionDate: '',
                plannedSceneIds: [],
                prepNotes: '',
                relatedPlotIds: [],
                runningNotes: '',
                structuredNotes: [],
                encounterLog: [],
                recap: '',
                notableEvents: '',
                looseEnds: '',
            });

            service.goLive(sessionId);
            service.addSessionRunnerNote('Important event');

            const session = campaign().sessionLogs.find(s => s.id === sessionId)!;
            const noteId = session.structuredNotes[session.structuredNotes.length - 1].id;

            // Initially not important
            expect(session.structuredNotes[session.structuredNotes.length - 1].isImportant).toBe(false);

            // Toggle to important
            service.toggleNoteImportance(noteId);

            const updated = campaign().sessionLogs.find(s => s.id === sessionId)!;
            const note = updated.structuredNotes.find(n => n.id === noteId)!;
            expect(note.isImportant).toBe(true);

            // Toggle back
            service.toggleNoteImportance(noteId);

            const updated2 = campaign().sessionLogs.find(s => s.id === sessionId)!;
            const note2 = updated2.structuredNotes.find(n => n.id === noteId)!;
            expect(note2.isImportant).toBe(false);
        });

        it('does nothing when no active session', () => {
            const { service } = createTestStore();
            service.toggleNoteImportance('nonexistent-id');
        });
    });
});
