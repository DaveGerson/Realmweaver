// @vitest-environment jsdom
/**
 * wp-e-app-shell — findings #21, #54 and #62
 *
 *   #21 handleSelect's 'scene' branch is the ONLY branch that does not call
 *       resetSelections() first. ViewRouter checks selectedNote /
 *       selectedSessionLog / selectedPlot / selectedPlayerCharacter BEFORE
 *       `selectedScene && selectedAdventure`, so navigating to a scene from a
 *       note's BacklinksPanel leaves selectedNoteId set and the NoteEditor
 *       stays on screen — the click appears to do nothing.
 *
 *   #54 CampaignSidebar's scene button fires two selections in one click
 *       (`onSelect('adventure', …); onSelect('scene', …)`). pushNavStack reads
 *       activeView/selectedXId from its render closure, so both pushes capture
 *       the identical pre-click state and navStack grows by 2 — the user has to
 *       press Back twice to undo one navigation.
 *
 *   #62 useEntitySelection — the hook every navigation funnels through — had no
 *       unit tests at all. This file is the missing coverage.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEntitySelection } from '../../hooks/useEntitySelection';
import type { Campaign } from '../../types/Campaign';

const campaign = {
    id: 'camp-1',
    title: 'Test Campaign',
    setting: 'A world',
    settingType: 'custom',
    npcs: [{ id: 'npc-1', name: 'Aldric' }],
    locations: [],
    factions: [],
    items: [],
    adventures: [
        {
            id: 'adv-1',
            title: 'The Sunken Vault',
            scenes: [{ id: 'scene-1', title: 'The Drowned Gate', type: 'exploration', npcIds: [] }],
        },
    ],
    articles: [],
    sessionLogs: [],
    playerCharacters: [],
    plots: [],
    notes: [{ id: 'note-1', title: 'Table rules' }],
    secrets: [],
} as unknown as Campaign;

function setup() {
    return renderHook(() =>
        useEntitySelection({ activeCampaign: campaign, onSidebarClose: () => {} })
    );
}

describe('wp-e-app-shell #21 — selecting a scene clears every other selection', () => {
    it('drops a stale note selection so ViewRouter can reach the scene editor', () => {
        const { result } = setup();

        act(() => { result.current.handleSelect('note', 'note-1'); });
        expect(result.current.selectedNoteId).toBe('note-1');

        // A scene backlink inside the NoteEditor -> handleEntityNavigate('scene', id)
        act(() => { result.current.handleEntityNavigate('scene', 'scene-1'); });

        expect(result.current.activeView).toBe('adventures');
        expect(result.current.selectedAdventureId).toBe('adv-1');
        expect(result.current.selectedSceneId).toBe('scene-1');
        // The bug: the note selection survives and ViewRouter keeps rendering NoteEditor.
        expect(result.current.selectedNoteId).toBeNull();
        expect(result.current.selectedNote).toBeNull();
    });

    it('leaves breadcrumbs pointing at the scene, not the previously open note', () => {
        const { result } = setup();

        act(() => { result.current.handleSelect('note', 'note-1'); });
        act(() => { result.current.handleSelect('scene', 'scene-1'); });

        const labels = result.current.breadcrumbSegments.map(s => s.label);
        expect(labels).toContain('The Drowned Gate');
        expect(labels).not.toContain('Table rules');
    });
});

describe('wp-e-app-shell #54 — a sidebar scene click is a single navigation', () => {
    it('pushes exactly one nav-stack entry for the adventure-then-scene pair the sidebar emits', () => {
        const { result } = setup();

        act(() => { result.current.handleSelect('npc', 'npc-1'); });
        const depthBefore = result.current.navStack.length;

        // Exactly what CampaignSidebar's scene button does, in one click.
        act(() => {
            result.current.handleSelect('adventure', 'adv-1');
            result.current.handleSelect('scene', 'scene-1');
        });

        expect(result.current.navStack.length - depthBefore).toBe(1);
    });

    it('returns to the previous view after a single Back press', () => {
        const { result } = setup();

        act(() => { result.current.handleSelect('npc', 'npc-1'); });
        act(() => {
            result.current.handleSelect('adventure', 'adv-1');
            result.current.handleSelect('scene', 'scene-1');
        });

        act(() => { result.current.handleGoBack(); });

        expect(result.current.activeView).toBe('npcs');
        expect(result.current.selectedNpcId).toBe('npc-1');
        // canGoBack in Breadcrumbs is `navStack.length > 0` — one more entry here
        // means the user must press Back a second time to escape one navigation.
        expect(result.current.navStack).toHaveLength(1);
    });
});
