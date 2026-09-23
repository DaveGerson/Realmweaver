// @vitest-environment jsdom
/**
 * SPEC — components/views/session/SceneListPanel.tsx as a scene MENU
 * (docs/design/unstructured-play.md)
 *
 *  1. Tonight's scenes may come from any adventure; a scene pulled from a
 *     different adventure than tonight's shows where it came from.
 *  2. A started scene that is not the one on stage reads as paused (come back
 *     any time), never as done.
 *  3. "Pull a scene from the shelf" lists every runnable scene not already in
 *     tonight's list, across all adventures, and adds one on click; an empty
 *     shelf says so in a sentence.
 *  4. Every unfinished scene can be put back on the shelf; a completed one
 *     cannot (there is nothing to shelve).
 *  5. A beat can be played — it becomes what's happening right now.
 *  6. "Spotlight tonight" shows every character with tonight's count, and
 *     says "quiet so far" for a zero rather than hiding the row.
 *  7. None of the new controls render for a legacy caller that passes no
 *     handlers, so the panel's original tests keep their surface.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';
import type { Campaign, SessionLog, Scene } from '../types/index';

vi.mock('@/services/campaignService', () => ({
    campaignService: {
        addBeat: vi.fn(),
        toggleBeatComplete: vi.fn(),
        deleteBeat: vi.fn(),
        subscribe: () => () => {},
        getState: () => ({ campaigns: [], activeCampaignId: null, appStatus: 'editing', saveStatus: 'idle', lastSavedAt: null }),
        getActiveCampaign: () => undefined,
    },
}));

const { SceneListPanel } = await import('../components/views/session/SceneListPanel');

const mkScene = (id: string, title: string, status: Scene['status'] = 'planned'): Scene =>
    ({ id, title, type: 'social', status, readAloudText: '', gmNotes: '', skillChecks: [], rewards: '', npcIds: [] }) as unknown as Scene;

const arrival = mkScene('s-a1', 'Arrival at the Gull', 'in-progress');
const bell = mkScene('s-a2', 'The Chapel Bell');
const done = mkScene('s-a3', 'The Wake', 'completed');
const ambush = mkScene('s-b1', 'Ambush on the Causeway');
const lantern = mkScene('s-b2', 'The Lantern Market', 'in-progress');

const campaign = {
    id: 'c1', title: 'Ashfall', settingType: 'custom', setting: 'A dying empire',
    articles: [], npcs: [], locations: [], factions: [], items: [], sessionLogs: [], notes: [], plots: [],
    playerCharacters: [],
    adventures: [
        { id: 'adv-a', title: 'Tides of Ash', level: 3, hook: '', theme: '', scenes: [arrival, bell, done] },
        { id: 'adv-b', title: 'Side Roads', level: 3, hook: '', theme: '', scenes: [ambush, lantern] },
    ],
} as unknown as Campaign;

const makeSession = (over: Partial<SessionLog> = {}): SessionLog =>
    ({
        id: 'sess-1', title: 'Session 4', status: 'active', sessionDate: '2026-08-26T18:00:00.000Z',
        adventureId: 'adv-a', plannedSceneIds: ['s-a1', 's-a2', 's-a3', 's-b1'], prepNotes: '', relatedPlotIds: [],
        runningNotes: '', structuredNotes: [], encounterLog: [], beats: [], recap: '', notableEvents: '', looseEnds: '',
        ...over,
    }) as unknown as SessionLog;

const handlers = () => ({
    onSelectScene: vi.fn(),
    onAddScene: vi.fn(),
    onRemoveScene: vi.fn(),
    onPlayBeat: vi.fn(),
});

const renderMenu = (
    h = handlers(),
    session = makeSession(),
    plannedScenes: Scene[] = [arrival, bell, done, ambush],
    activeSceneId: string | null = 's-a2',
    spotlightTonight?: { pcId: string; pcName: string; count: number }[],
) =>
    render(
        <SceneListPanel
            plannedScenes={plannedScenes}
            activeSceneId={activeSceneId}
            campaign={campaign}
            sessionLog={session}
            previousSessionRecap={null}
            mobileTab="scenes"
            onSelectScene={h.onSelectScene}
            onAddScene={h.onAddScene}
            onRemoveScene={h.onRemoveScene}
            onPlayBeat={h.onPlayBeat}
            spotlightTonight={spotlightTonight}
        />
    );

afterEach(cleanup);

describe('1. Scenes from any adventure', () => {
    it('labels a scene borrowed from another adventure with its origin', () => {
        renderMenu();
        expect(screen.getByTitle('From Side Roads')).toBeTruthy();
        expect(screen.queryByTitle('From Tides of Ash')).toBeNull();
    });
    it('says the list plays in any order', () => {
        renderMenu();
        expect(screen.getByText('Play them in any order')).toBeTruthy();
    });
});

describe('2. Started but not on stage reads as paused', () => {
    it('marks the started, non-active scene as come-back-any-time', () => {
        const { container } = renderMenu();
        const paused = container.querySelector('svg[aria-label="Started — come back any time"]');
        expect(paused).toBeTruthy();
    });
});

describe('3. The shelf', () => {
    it('lists runnable scenes not already in tonight, across adventures, and adds one on click', () => {
        const h = handlers();
        renderMenu(h);
        fireEvent.click(screen.getByRole('button', { name: /Pull a scene from the shelf/ }));
        const add = screen.getByRole('button', { name: 'Add "The Lantern Market" to tonight' });
        expect(within(add).getByText('Side Roads')).toBeTruthy();
        // Already planned or completed scenes are not on the shelf.
        expect(screen.queryByRole('button', { name: 'Add "The Chapel Bell" to tonight' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Add "The Wake" to tonight' })).toBeNull();
        fireEvent.click(add);
        expect(h.onAddScene).toHaveBeenCalledWith('s-b2');
    });

    it('an empty shelf is a sentence, not an error', () => {
        const h = handlers();
        renderMenu(h, makeSession({ plannedSceneIds: ['s-a1', 's-a2', 's-b1', 's-b2'] }), [arrival, bell, ambush, lantern]);
        fireEvent.click(screen.getByRole('button', { name: /Pull a scene from the shelf/ }));
        expect(screen.getByText(/Nothing on the shelf/)).toBeTruthy();
    });
});

describe('4. Put back on the shelf', () => {
    it('offers put-back for unfinished scenes only and reports the id', () => {
        const h = handlers();
        renderMenu(h);
        fireEvent.click(screen.getByRole('button', { name: 'Put "Ambush on the Causeway" back on the shelf' }));
        expect(h.onRemoveScene).toHaveBeenCalledWith('s-b1');
        expect(screen.queryByRole('button', { name: 'Put "The Wake" back on the shelf' })).toBeNull();
    });
});

describe('5. Play a beat', () => {
    it('hands the beat to onPlayBeat and offers no play control on a finished beat', () => {
        const h = handlers();
        const session = makeSession({
            beats: [
                { id: 'b1', title: 'The barkeep names a price', isCompleted: false },
                { id: 'b2', title: 'Already done', isCompleted: true },
            ],
        });
        renderMenu(h, session);
        fireEvent.click(screen.getByRole('button', { name: 'Play beat: The barkeep names a price' }));
        expect(h.onPlayBeat).toHaveBeenCalledWith(expect.objectContaining({ id: 'b1' }));
        expect(screen.queryByRole('button', { name: 'Play beat: Already done' })).toBeNull();
    });
});

describe('6. Spotlight tonight', () => {
    it('lists every character with a count and calls out the quiet ones', () => {
        renderMenu(handlers(), makeSession(), [arrival], 's-a1', [
            { pcId: 'pc-1', pcName: 'Torvald', count: 2 },
            { pcId: 'pc-2', pcName: 'Mira', count: 0 },
        ]);
        const list = screen.getByRole('list', { name: 'Spotlight tonight' });
        expect(within(list).getByText('Torvald')).toBeTruthy();
        expect(within(list).getByText('2 moments')).toBeTruthy();
        expect(within(list).getByText('quiet so far')).toBeTruthy();
    });
});

describe('7. Legacy surface', () => {
    it('renders no shelf, put-back, play or spotlight controls when no handlers are passed', () => {
        render(
            <SceneListPanel
                plannedScenes={[arrival]}
                activeSceneId={null}
                campaign={campaign}
                sessionLog={makeSession({ beats: [{ id: 'b1', title: 'A beat', isCompleted: false }] })}
                previousSessionRecap={null}
                mobileTab="scenes"
                onSelectScene={() => {}}
            />
        );
        expect(screen.queryByRole('button', { name: /Pull a scene from the shelf/ })).toBeNull();
        expect(screen.queryByRole('button', { name: /back on the shelf/ })).toBeNull();
        expect(screen.queryByRole('button', { name: /Play beat/ })).toBeNull();
        expect(screen.queryByRole('list', { name: 'Spotlight tonight' })).toBeNull();
    });
});
