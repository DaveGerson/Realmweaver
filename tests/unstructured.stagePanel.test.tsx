// @vitest-environment jsdom
/**
 * SPEC — components/views/session/StagePanel.tsx via ActiveScenePanel.tsx
 * (docs/design/unstructured-play.md)
 *
 * The centre column no longer needs a prepped scene to be useful. When the
 * runner hands it a Stage, the panel:
 *
 *  1. Opens on an invitation, not an error, when nothing is set and no scene
 *     is active — the old "No active scene" empty state is gone for it.
 *  2. Lets the DM put the party somewhere: a linked place picked from a
 *     search, or three words typed at the table (kept as a freeform place),
 *     with a way to clear it.
 *  3. Shows who is here as chips — the scene's own cast fixed, the DM's
 *     additions removable — and adds someone from a search.
 *  4. Takes a one-line "what's happening" that commits on Enter or blur and
 *     never fires when unchanged.
 *  5. With a scene active, offers Done / Next Scene / Set Aside, hides Next
 *     Scene when nothing follows, and still shows the Stage.
 *  6. Renders the NPC cards and the location card for everyone and everywhere
 *     present, scene or Stage.
 *  7. Legacy callers (no Stage props) get exactly the old scene-only panel,
 *     including its empty state.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach, type Mock } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';
import type { Campaign, NPC, Location, Scene, SessionStage } from '../types/index';

const h = vi.hoisted(() => ({
    getActiveCampaign: vi.fn(),
    updateNpc: vi.fn(),
    addDiceRollToSession: vi.fn(),
}));

vi.mock('@/services/campaignService', () => ({
    campaignService: {
        getActiveCampaign: h.getActiveCampaign,
        updateNpc: h.updateNpc,
        addDiceRollToSession: h.addDiceRollToSession,
        subscribe: () => () => {},
        getState: () => ({ campaigns: [], activeCampaignId: null, appStatus: 'editing', saveStatus: 'idle', lastSavedAt: null }),
    },
}));

const { ActiveScenePanel } = await import('../components/views/session/ActiveScenePanel');

const npc = (id: string, name: string, traits = ''): NPC => ({
    id, name, description: '', traits, backstory: '', motivations: '', secrets: '', stats: '',
    exampleQuote: '', knowsPlayerHistory: [], relationships: [], history: [],
});
const loc = (id: string, name: string, description = ''): Location => ({
    id, name, description, secrets: '', subLocationIds: [], history: [],
});

const serah = npc('npc-1', 'Serah Vane', 'clipped');
const gundren = npc('npc-2', 'Gundren Mott', 'loud');
const barkeep = npc('npc-3', 'Old Pell', 'deaf in one ear');
const tavern = loc('loc-1', 'The Gull and Gallows', 'A crooked tavern on stilts.');
const chapel = loc('loc-2', 'The Drowned Chapel');

const campaign = {
    id: 'camp-1', title: 'Ashfall', setting: 'A dying empire', settingType: 'custom',
    npcs: [serah, gundren, barkeep], locations: [tavern, chapel], factions: [], items: [], adventures: [],
    articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

const scene = {
    id: 'scene-1', title: 'Arrival at the Gull', type: 'social', status: 'in-progress',
    readAloudText: 'Rain sheets off the awning.', gmNotes: 'Gundren is stalling.', skillChecks: [], rewards: '',
    npcIds: ['npc-2'], locationId: 'loc-1',
} as unknown as Scene;

const EMPTY: SessionStage = { npcIds: [] };

type Handlers = {
    onSetStageLocation: Mock<(locationId: string | null, place?: string) => void>;
    onAddNpcToStage: Mock<(npcId: string) => void>;
    onRemoveNpcFromStage: Mock<(npcId: string) => void>;
    onSetStageFocus: Mock<(focus: string) => void>;
    onFinishScene: Mock<() => void>;
    onSetAsideScene: Mock<() => void>;
    onAdvanceScene: Mock<() => void>;
    onSaveFreeformPlace: Mock<() => void>;
};

const makeHandlers = (): Handlers => ({
    onSetStageLocation: vi.fn<(locationId: string | null, place?: string) => void>(),
    onAddNpcToStage: vi.fn<(npcId: string) => void>(),
    onRemoveNpcFromStage: vi.fn<(npcId: string) => void>(),
    onSetStageFocus: vi.fn<(focus: string) => void>(),
    onFinishScene: vi.fn<() => void>(),
    onSetAsideScene: vi.fn<() => void>(),
    onAdvanceScene: vi.fn<() => void>(),
    onSaveFreeformPlace: vi.fn<() => void>(),
});

interface RenderOptions {
    activeScene?: Scene | null;
    stage?: SessionStage;
    stageNpcs?: NPC[];
    presentNpcs?: NPC[];
    presentLocation?: Location | null;
    hasNextScene?: boolean;
}

const renderStaged = (handlers: Handlers, opts: RenderOptions = {}) => {
    const activeScene = opts.activeScene ?? null;
    const sceneCast = activeScene ? [gundren] : [];
    const stageNpcs = opts.stageNpcs ?? [];
    return render(
        <ActiveScenePanel
            activeScene={activeScene}
            activeSceneLocation={activeScene ? tavern : null}
            activeSceneNpcs={sceneCast}
            sceneNpcRelationshipMap={new Map()}
            castDynamicsSummary={null}
            campaign={campaign}
            previousSession={null}
            mobileTab="active"
            onAdvanceScene={handlers.onAdvanceScene}
            stage={opts.stage ?? EMPTY}
            stageNpcs={stageNpcs}
            presentNpcs={opts.presentNpcs ?? [...sceneCast, ...stageNpcs]}
            presentLocation={opts.presentLocation === undefined ? (activeScene ? tavern : null) : opts.presentLocation}
            hasNextScene={opts.hasNextScene ?? true}
            onFinishScene={handlers.onFinishScene}
            onSetAsideScene={handlers.onSetAsideScene}
            onSetStageLocation={handlers.onSetStageLocation}
            onAddNpcToStage={handlers.onAddNpcToStage}
            onRemoveNpcFromStage={handlers.onRemoveNpcFromStage}
            onSetStageFocus={handlers.onSetStageFocus}
            onSaveFreeformPlace={handlers.onSaveFreeformPlace}
        />
    );
};

beforeEach(() => {
    h.getActiveCampaign.mockReturnValue(campaign);
});
afterEach(cleanup);

describe('1. An empty Stage is an invitation', () => {
    it('shows the invitation and never the old "No active scene" empty state', () => {
        renderStaged(makeHandlers());
        expect(screen.getByRole('region', { name: 'On stage' })).toBeTruthy();
        expect(screen.getByText(/Set the stage: where is the party/)).toBeTruthy();
        expect(screen.queryByText(/No active scene/)).toBeNull();
        expect(screen.getByText('Nowhere in particular yet')).toBeTruthy();
        expect(screen.getByText('No one here yet')).toBeTruthy();
    });
});

describe('2. Putting the party somewhere', () => {
    it('picks a linked place from the search', () => {
        const handlers = makeHandlers();
        renderStaged(handlers);
        fireEvent.click(screen.getByRole('button', { name: 'Set the place' }));
        fireEvent.change(screen.getByLabelText('Search places'), { target: { value: 'chapel' } });
        expect(screen.queryByRole('button', { name: 'The Gull and Gallows' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'The Drowned Chapel' }));
        expect(handlers.onSetStageLocation).toHaveBeenCalledWith('loc-2');
        // The picker closes after a choice.
        expect(screen.queryByLabelText('Search places')).toBeNull();
    });

    it('takes a freeform place with Enter and offers to save it as a location', () => {
        const handlers = makeHandlers();
        const { rerender } = renderStaged(handlers);
        fireEvent.click(screen.getByRole('button', { name: 'Set the place' }));
        const nameInput = screen.getByLabelText('Name a place');
        fireEvent.change(nameInput, { target: { value: 'a nameless roadside shrine' } });
        fireEvent.keyDown(nameInput, { key: 'Enter' });
        expect(handlers.onSetStageLocation).toHaveBeenCalledWith(null, 'a nameless roadside shrine');

        // Once the store reflects it, the place reads back as typed with a save affordance.
        rerender(
            <ActiveScenePanel
                activeScene={null} activeSceneLocation={null} activeSceneNpcs={[]}
                sceneNpcRelationshipMap={new Map()} castDynamicsSummary={null} campaign={campaign}
                previousSession={null} mobileTab="active" onAdvanceScene={handlers.onAdvanceScene}
                stage={{ npcIds: [], place: 'a nameless roadside shrine' }} stageNpcs={[]} presentNpcs={[]} presentLocation={null}
                onFinishScene={handlers.onFinishScene} onSetAsideScene={handlers.onSetAsideScene}
                onSetStageLocation={handlers.onSetStageLocation} onAddNpcToStage={handlers.onAddNpcToStage}
                onRemoveNpcFromStage={handlers.onRemoveNpcFromStage} onSetStageFocus={handlers.onSetStageFocus}
                onSaveFreeformPlace={handlers.onSaveFreeformPlace}
            />
        );
        expect(screen.getByText('a nameless roadside shrine')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /Save as a location/ }));
        expect(handlers.onSaveFreeformPlace).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('button', { name: 'Change place' })).toBeTruthy();
    });

    it('clears the place from inside the picker', () => {
        const handlers = makeHandlers();
        renderStaged(handlers, { stage: { npcIds: [], locationId: 'loc-1' }, presentLocation: tavern });
        fireEvent.click(screen.getByRole('button', { name: 'Change place' }));
        fireEvent.click(screen.getByRole('button', { name: 'Clear the place' }));
        expect(handlers.onSetStageLocation).toHaveBeenCalledWith(null);
    });

    it('hands focus back to the place control when the picker closes, so keyboard navigation continues from the Stage', () => {
        const handlers = makeHandlers();
        renderStaged(handlers);
        fireEvent.click(screen.getByRole('button', { name: 'Set the place' }));
        // The chosen option unmounts with the picker — focus must not fall to <body>.
        fireEvent.click(screen.getByRole('button', { name: 'The Drowned Chapel' }));
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Set the place' }));

        fireEvent.click(screen.getByRole('button', { name: 'Set the place' }));
        const nameInput = screen.getByLabelText('Name a place');
        fireEvent.change(nameInput, { target: { value: 'a nameless roadside shrine' } });
        fireEvent.keyDown(nameInput, { key: 'Enter' });
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Set the place' }));
    });

    it('hands focus back to the place control after Clear the place', () => {
        const handlers = makeHandlers();
        renderStaged(handlers, { stage: { npcIds: [], locationId: 'loc-1' }, presentLocation: tavern });
        fireEvent.click(screen.getByRole('button', { name: 'Change place' }));
        fireEvent.click(screen.getByRole('button', { name: 'Clear the place' }));
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Change place' }));
    });

    it('renders the location card for the place in effect even with no scene', () => {
        renderStaged(makeHandlers(), { stage: { npcIds: [], locationId: 'loc-1' }, presentLocation: tavern });
        expect(screen.getByText('A crooked tavern on stilts.')).toBeTruthy();
    });

    it('leads the location card with its aspects when it has any, and omits the list when it does not', () => {
        const withAspects: Location = { ...tavern, aspects: ['Salt-rot in every plank', '  ', 'A gull that never blinks'] };
        const { unmount } = renderStaged(makeHandlers(), { stage: { npcIds: [], locationId: 'loc-1' }, presentLocation: withAspects });
        const list = screen.getByRole('list', { name: 'Aspects of The Gull and Gallows' });
        expect(within(list).getAllByRole('listitem').map(li => li.textContent)).toEqual(['•Salt-rot in every plank', '•A gull that never blinks']);
        unmount();
        renderStaged(makeHandlers(), { stage: { npcIds: [], locationId: 'loc-1' }, presentLocation: tavern });
        expect(screen.queryByRole('list', { name: /Aspects of/ })).toBeNull();
    });
});

describe('3. Who is here', () => {
    it('adds someone from the search and hides people already present', () => {
        const handlers = makeHandlers();
        renderStaged(handlers, { stage: { npcIds: ['npc-1'] }, stageNpcs: [serah] });
        fireEvent.click(screen.getByRole('button', { name: /Add someone/ }));
        const list = screen.getByLabelText('Search NPCs').parentElement as HTMLElement;
        expect(within(list).queryByRole('button', { name: /Serah Vane/ })).toBeNull();
        fireEvent.change(screen.getByLabelText('Search NPCs'), { target: { value: 'pell' } });
        fireEvent.click(within(list).getByRole('button', { name: /Old Pell/ }));
        expect(handlers.onAddNpcToStage).toHaveBeenCalledWith('npc-3');
        // The clicked row leaves the list once they are present; focus returns to
        // the search so the DM can keep adding people without reaching for the mouse.
        expect(document.activeElement).toBe(screen.getByLabelText('Search NPCs'));
    });

    it('scene cast chips are fixed; Stage chips can be taken off stage', () => {
        const handlers = makeHandlers();
        renderStaged(handlers, { activeScene: scene, stage: { npcIds: ['npc-1'] }, stageNpcs: [serah] });
        expect(screen.queryByRole('button', { name: 'Take Gundren Mott off stage' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Take Serah Vane off stage' }));
        expect(handlers.onRemoveNpcFromStage).toHaveBeenCalledWith('npc-1');
    });

    it('renders NPC cards for everyone present — scene cast and Stage cast alike', () => {
        renderStaged(makeHandlers(), { activeScene: scene, stage: { npcIds: ['npc-1'] }, stageNpcs: [serah] });
        expect(screen.getByRole('button', { name: 'Log a line for Serah Vane' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Log a line for Gundren Mott' })).toBeTruthy();
    });
});

describe('4. What is happening right now', () => {
    it('commits on Enter and on blur, only when changed', () => {
        const handlers = makeHandlers();
        renderStaged(handlers, { stage: { npcIds: [], focus: 'Haggling' } });
        const input = screen.getByLabelText("What's happening right now") as HTMLInputElement;
        expect(input.value).toBe('Haggling');
        fireEvent.blur(input);
        expect(handlers.onSetStageFocus).not.toHaveBeenCalled();
        fireEvent.change(input, { target: { value: 'The barkeep draws a knife' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(handlers.onSetStageFocus).toHaveBeenCalledWith('The barkeep draws a knife');
    });
});

describe('5. Scene controls read the menu, not the track', () => {
    it('Done, Next Scene and Set Aside call their handlers; the Stage stays visible', () => {
        const handlers = makeHandlers();
        renderStaged(handlers, { activeScene: scene });
        expect(screen.getByRole('region', { name: 'On stage' })).toBeTruthy();
        expect(screen.getByText('Anything you add here joins the scene')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /^Done$/ }));
        expect(handlers.onFinishScene).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: /Next Scene/ }));
        expect(handlers.onAdvanceScene).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: /Set Aside/ }));
        expect(handlers.onSetAsideScene).toHaveBeenCalledTimes(1);
    });

    it('hides Next Scene when nothing follows in tonight\'s list', () => {
        renderStaged(makeHandlers(), { activeScene: scene, hasNextScene: false });
        expect(screen.queryByRole('button', { name: /Next Scene/ })).toBeNull();
        expect(screen.getByRole('button', { name: /^Done$/ })).toBeTruthy();
    });
});

describe('7. Legacy callers are untouched', () => {
    it('with no Stage props the old scene-only panel renders, empty state included', () => {
        render(
            <ActiveScenePanel
                activeScene={null}
                activeSceneLocation={null}
                activeSceneNpcs={[]}
                sceneNpcRelationshipMap={new Map()}
                castDynamicsSummary={null}
                campaign={campaign}
                previousSession={null}
                mobileTab="active"
                onAdvanceScene={() => {}}
            />
        );
        expect(screen.getByText(/No active scene/)).toBeTruthy();
        expect(screen.queryByRole('region', { name: 'On stage' })).toBeNull();
    });
});
