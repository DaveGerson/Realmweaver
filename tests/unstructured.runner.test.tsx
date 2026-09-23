// @vitest-environment jsdom
/**
 * SPEC — components/views/SessionRunner.tsx wiring for unstructured play
 * (docs/design/unstructured-play.md)
 *
 * The runner derives everything the panels need from the session's Stage as
 * well as the active scene, and routes every table action to the store
 * method that owns it. Rendered against a mocked store so each assertion is
 * about the wiring; store behaviour is pinned in unstructured.stage.store.
 *
 *  1. A freeform session (no adventure, no scenes) opens on the Stage: no
 *     "No active scene" copy, the invitation instead, and the Quick Tools and
 *     running log all present.
 *  2. Stage actions route to the store: place → setStageLocation, cast →
 *     addNpcToStage / removeNpcFromStage, focus → setStageFocus, beat play →
 *     setStageFocus with the beat's title.
 *  3. Scene-menu actions route to the store: pick a scene → enterScene, Done →
 *     leaveScene({complete:true}), Set Aside → leaveScene({complete:false}),
 *     shelf → addPlannedScene, put back → removePlannedScene.
 *  4. Tonight's list resolves scenes across adventures; the active scene's
 *     foreign adventure is labelled.
 *  5. Everyone present (scene cast ∪ Stage cast) gets an NPC card, and the
 *     Stage's place wins over the scene's.
 *  6. A plot clock tick routes to tickPlotClock.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';
import type { Campaign, SessionLog } from '../types/index';
import { ToastProvider } from '../hooks/useToast';
import { ConfirmDialogProvider } from '../hooks/useConfirmDialog';
import { createDefaultScene, createDefaultSession } from '../utils/entityUtils';

const h = vi.hoisted(() => ({
    store: {
        setSessionStartedAt: vi.fn(),
        updateEncounter: vi.fn(),
        addAutoEvent: vi.fn(() => true),
        addSessionRunnerNote: vi.fn(),
        addDiceRollToSession: vi.fn(),
        updatePlotProgression: vi.fn(),
        enterScene: vi.fn(),
        leaveScene: vi.fn(),
        advanceScene: vi.fn(),
        addPlannedScene: vi.fn(() => true),
        removePlannedScene: vi.fn(),
        setStageLocation: vi.fn(),
        addNpcToStage: vi.fn(() => true),
        removeNpcFromStage: vi.fn(),
        setStageFocus: vi.fn(),
        tickPlotClock: vi.fn(),
        createLocation: vi.fn(() => 'loc-new'),
        addBeat: vi.fn(),
        toggleBeatComplete: vi.fn(),
        deleteBeat: vi.fn(),
        updateNpc: vi.fn(),
        createNpc: vi.fn(),
        updateScene: vi.fn(),
        revealSecret: vi.fn(),
        getActiveCampaign: vi.fn(),
        subscribe: () => () => {},
        getState: () => ({ campaigns: [], activeCampaignId: null, appStatus: 'editing', saveStatus: 'idle', lastSavedAt: null }),
    },
}));

vi.mock('@/services/campaignService', () => ({ campaignService: h.store }));

const { SessionRunner } = await import('../components/views/SessionRunner');

const npc = (id: string, name: string) => ({
    id, name, description: '', traits: '', backstory: '', motivations: '', secrets: '', stats: '',
    exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
});

const tavern = { id: 'loc-1', name: 'The Gull and Gallows', description: 'A crooked tavern on stilts.', secrets: '', subLocationIds: [], history: [] };
const causeway = { id: 'loc-2', name: 'The Causeway', description: 'A drowned road.', secrets: '', subLocationIds: [], history: [] };

const arrival = { ...createDefaultScene(), id: 's-a1', title: 'Arrival at the Gull', status: 'in-progress' as const, npcIds: ['npc-2'], locationId: 'loc-1' };
const bell = { ...createDefaultScene(), id: 's-a2', title: 'The Chapel Bell', status: 'planned' as const };
const ambush = { ...createDefaultScene(), id: 's-b1', title: 'Ambush on the Causeway', status: 'planned' as const, npcIds: ['npc-1'], locationId: 'loc-2' };

const makeCampaign = (over: Partial<Campaign> = {}): Campaign => ({
    id: 'camp-1', title: 'Ashfall', setting: 'A dying empire', settingType: 'custom', dmStyle: 'power',
    featureOverrides: { 'combat-tracker': true, 'secrets-tracker': true },
    npcs: [npc('npc-1', 'Serah Vane'), npc('npc-2', 'Gundren Mott'), npc('npc-3', 'Old Pell')],
    locations: [tavern, causeway],
    factions: [], items: [],
    adventures: [
        { id: 'adv-a', title: 'Tides of Ash', level: 3, hook: '', theme: '', scenes: [arrival, bell] },
        { id: 'adv-b', title: 'Side Roads', level: 3, hook: '', theme: '', scenes: [ambush] },
    ],
    articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
    ...over,
} as unknown as Campaign);

const makeSession = (over: Partial<SessionLog> = {}): SessionLog => ({
    ...createDefaultSession(),
    id: 'log-1', title: 'Session 1', status: 'active', startedAt: new Date().toISOString(),
    ...over,
} as SessionLog);

const renderRunner = (campaign: Campaign, sessionLog: SessionLog) =>
    render(
        <ToastProvider>
            <ConfirmDialogProvider>
                <SessionRunner campaign={campaign} sessionLog={sessionLog} isMockMode onEndSession={() => {}} onOpenCoach={() => {}} />
            </ConfirmDialogProvider>
        </ToastProvider>
    );

beforeEach(() => {
    Object.values(h.store).forEach(fn => { if (typeof fn === 'function' && 'mockClear' in fn) (fn as ReturnType<typeof vi.fn>).mockClear(); });
});
afterEach(cleanup);

describe('1. A freeform session opens on the Stage', () => {
    it('shows the invitation, never the old empty state, with tools and the log around it', () => {
        const campaign = makeCampaign({ activeSessionId: 'log-1' });
        renderRunner(campaign, makeSession());
        expect(screen.queryByText(/No active scene/)).toBeNull();
        expect(screen.getByText(/Set the stage: where is the party/)).toBeTruthy();
        expect(screen.getByRole('button', { name: /Complicate This/ })).toBeTruthy();
        expect(screen.getByRole('heading', { name: /Running Log/i })).toBeTruthy();
        expect(screen.getByText('No scenes planned')).toBeTruthy();
    });
});

describe('2. Stage actions route to the store', () => {
    it('place, cast, focus and beat play', () => {
        const campaign = makeCampaign({ activeSessionId: 'log-1' });
        const session = makeSession({
            stage: { npcIds: ['npc-1'] },
            beats: [{ id: 'b1', title: 'The barkeep names a price', isCompleted: false }],
        });
        renderRunner(campaign, session);

        fireEvent.click(screen.getByRole('button', { name: 'Set the place' }));
        fireEvent.click(screen.getByRole('button', { name: 'The Causeway' }));
        expect(h.store.setStageLocation).toHaveBeenCalledWith('loc-2', undefined);

        fireEvent.click(screen.getByRole('button', { name: /Add someone/ }));
        const list = screen.getByLabelText('Search NPCs').parentElement as HTMLElement;
        fireEvent.click(within(list).getByRole('button', { name: /Old Pell/ }));
        expect(h.store.addNpcToStage).toHaveBeenCalledWith('npc-3');

        fireEvent.click(screen.getByRole('button', { name: 'Take Serah Vane off stage' }));
        expect(h.store.removeNpcFromStage).toHaveBeenCalledWith('npc-1');

        const focus = screen.getByLabelText("What's happening right now");
        fireEvent.change(focus, { target: { value: 'A knife comes out' } });
        fireEvent.blur(focus);
        expect(h.store.setStageFocus).toHaveBeenCalledWith('A knife comes out');

        fireEvent.click(screen.getByRole('button', { name: 'Play beat: The barkeep names a price' }));
        expect(h.store.setStageFocus).toHaveBeenLastCalledWith('The barkeep names a price');
    });

    it('saving a freeform place creates a location and points the Stage at it', () => {
        const campaign = makeCampaign({ activeSessionId: 'log-1' });
        renderRunner(campaign, makeSession({ stage: { npcIds: [], place: 'a nameless roadside shrine', focus: 'Rain' } }));
        fireEvent.click(screen.getByRole('button', { name: /Save as a location/ }));
        expect(h.store.createLocation).toHaveBeenCalledWith(expect.objectContaining({ name: 'a nameless roadside shrine', description: 'Rain' }));
        expect(h.store.setStageLocation).toHaveBeenCalledWith('loc-new');
    });
});

describe('3. Scene-menu actions route to the store', () => {
    it('enter, Done, Set Aside, shelf and put back', () => {
        const campaign = makeCampaign({ activeSessionId: 'log-1', activeSceneId: 's-a1' });
        const session = makeSession({ adventureId: 'adv-a', plannedSceneIds: ['s-a1', 's-a2'] });
        renderRunner(campaign, session);

        // Exact name: the put-back control's label also contains the title.
        fireEvent.click(screen.getByRole('button', { name: 'The Chapel Bell' }));
        expect(h.store.enterScene).toHaveBeenCalledWith('s-a2');

        fireEvent.click(screen.getByRole('button', { name: /^Done$/ }));
        expect(h.store.leaveScene).toHaveBeenCalledWith({ complete: true });
        fireEvent.click(screen.getByRole('button', { name: /Set Aside/ }));
        expect(h.store.leaveScene).toHaveBeenCalledWith({ complete: false });
        fireEvent.click(screen.getByRole('button', { name: /Next Scene/ }));
        expect(h.store.advanceScene).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('button', { name: /Pull a scene from the shelf/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Add "Ambush on the Causeway" to tonight' }));
        expect(h.store.addPlannedScene).toHaveBeenCalledWith('s-b1');

        fireEvent.click(screen.getByRole('button', { name: 'Put "The Chapel Bell" back on the shelf' }));
        expect(h.store.removePlannedScene).toHaveBeenCalledWith('s-a2');
    });
});

describe('4 & 5. Cross-adventure resolution and the present set', () => {
    it('resolves a borrowed active scene, labels its adventure, unions the casts and lets the Stage place win', () => {
        const campaign = makeCampaign({ activeSessionId: 'log-1', activeSceneId: 's-b1' });
        const session = makeSession({ adventureId: 'adv-a', plannedSceneIds: ['s-a1', 's-b1'], stage: { npcIds: ['npc-3'], locationId: 'loc-1' } });
        renderRunner(campaign, session);

        expect(screen.getByRole('heading', { name: 'Ambush on the Causeway' })).toBeTruthy();
        expect(screen.getByTitle("Pulled from another adventure's shelf").textContent).toBe('Side Roads');
        // Cast: Serah from the scene, Old Pell from the Stage.
        expect(screen.getByRole('button', { name: 'Log a line for Serah Vane' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Log a line for Old Pell' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Log a line for Gundren Mott' })).toBeNull();
        // Place: the Stage's tavern, not the scene's causeway.
        expect(screen.getByText('A crooked tavern on stilts.')).toBeTruthy();
        expect(screen.queryByText('A drowned road.')).toBeNull();
        // The last scene in tonight's list has no "Next Scene".
        expect(screen.queryByRole('button', { name: /Next Scene/ })).toBeNull();
    });
});

describe('6. Plot clocks in Quick Tools', () => {
    it('ticks through the store and reads the count', () => {
        const campaign = makeCampaign({
            activeSessionId: 'log-1',
            plots: [{ id: 'p-1', title: 'The Tide Cult', description: '', status: 'active', relatedEntityIds: [], clock: { segments: 4, filled: 1 }, ifIgnored: 'The chapel floods.' }],
        });
        renderRunner(campaign, makeSession({ relatedPlotIds: ['p-1'] }));
        expect(screen.getByRole('img', { name: 'The Tide Cult: clock 1 of 4' })).toBeTruthy();
        expect(screen.getByText('The chapel floods.')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Tick the clock for The Tide Cult' }));
        expect(h.store.tickPlotClock).toHaveBeenCalledWith('p-1');
    });
});
