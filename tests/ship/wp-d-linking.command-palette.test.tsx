// @vitest-environment jsdom
/**
 * wp-d-linking — findings #49, #58, #98, #99
 *
 *   #49 the Recent list is built from snapshots {type,id,name} captured at
 *       visit time. The palette looks the entity up but then filters with
 *       `.filter(r => r.data.name)` — the SNAPSHOT name, always truthy — so the
 *       comment "filter out stale items where entity was deleted" is a lie and
 *       deleted entities stay selectable (and renamed ones keep the old name).
 *   #58 scenes are indexed as first-class results but handleSelect's 'scene'
 *       case navigates to the parent ADVENTURE; there is no onSelectScene prop
 *       even though App.handleSelect already supports type 'scene'.
 *   #98 the palette has no combobox/listbox/option semantics and no live
 *       region, so a screen-reader user gets no announcement of the active row
 *       or the result count.
 *   #99 the scene badge is hardcoded red; scenes are blue everywhere else and
 *       CLAUDE.md names ENTITY_TYPE_CONFIG the single source for entity colours.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { CommandPalette } from '../../components/common/CommandPalette';
import { ENTITY_TYPE_CONFIG } from '../../utils/entityUtils';

const scene = {
    id: 'scene-7', title: 'The Gatehouse Ambush', type: 'combat', status: 'planned',
    readAloudText: '', gmNotes: '', skillChecks: [], rewards: '', npcIds: [],
};

const adventure = {
    id: 'adv-1', title: 'Curse of the Crimson Throne', level: 3, hook: '', theme: '',
    scenes: [scene],
};

type Handlers = ReturnType<typeof makeHandlers>;

function makeHandlers() {
    return {
        onClose: vi.fn(),
        onSelectNpc: vi.fn(),
        onSelectLocation: vi.fn(),
        onSelectFaction: vi.fn(),
        onSelectItem: vi.fn(),
        onSelectAdventure: vi.fn(),
        onSelectArticle: vi.fn(),
        onSelectSessionLog: vi.fn(),
        onSelectPlot: vi.fn(),
        onSelectPlayerCharacter: vi.fn(),
        onSelectScene: vi.fn(),
        onNavigateTo: vi.fn(),
        onOpenCoach: vi.fn(),
    };
}

function renderPalette(overrides: Record<string, any> = {}): Handlers {
    const handlers = makeHandlers();
    render(
        <CommandPalette
            isOpen
            npcs={[]}
            locations={[]}
            factions={[]}
            items={[]}
            adventures={[adventure] as any}
            articles={[]}
            sessionLogs={[]}
            plots={[]}
            playerCharacters={[]}
            recentItems={[]}
            {...(handlers as any)}
            {...overrides}
        />,
    );
    return handlers;
}

function searchInput(): HTMLInputElement {
    return screen.getByPlaceholderText(/Search entities/i) as HTMLInputElement;
}

beforeEach(() => {
    // jsdom has no layout engine
    (Element.prototype as any).scrollIntoView = vi.fn();
});

afterEach(() => cleanup());

// ── #49 — Recent must reflect the live campaign ─────────────────────────────

describe('wp-d-linking #49 — Recent list must drop deleted entities', () => {
    it('does not offer an entity that no longer exists in the campaign', () => {
        renderPalette({
            npcs: [],
            recentItems: [{ type: 'npc', id: 'npc-dead', name: 'Sera' }],
        });

        expect(screen.queryByText('Sera')).toBeNull();
        // Nothing recent survives ⇒ the empty-state copy is shown instead.
        expect(screen.queryByText(/No recent items/i)).not.toBeNull();
    });

    it('shows the current name for a renamed entity, not the stale snapshot', () => {
        renderPalette({
            npcs: [{ id: 'npc-1', name: 'Seraphine', description: '' }] as any,
            recentItems: [{ type: 'npc', id: 'npc-1', name: 'Sera' }],
        });

        expect(screen.queryByText('Seraphine')).not.toBeNull();
        expect(screen.queryByText('Sera')).toBeNull();
    });
});

// ── #58 — scene results must navigate to the scene ──────────────────────────

describe('wp-d-linking #58 — selecting a scene result opens that scene', () => {
    it('dispatches to onSelectScene instead of the parent adventure', () => {
        const handlers = renderPalette();

        fireEvent.change(searchInput(), { target: { value: 'Gatehouse Ambush' } });
        fireEvent.keyDown(searchInput(), { key: 'Enter' });

        expect(handlers.onSelectScene).toHaveBeenCalledWith('scene-7');
        expect(handlers.onSelectAdventure).not.toHaveBeenCalled();
        expect(handlers.onClose).toHaveBeenCalled();
    });
});

// ── #98 — combobox semantics + result-count announcement ────────────────────

describe('wp-d-linking #98 — palette results need listbox semantics', () => {
    it('marks the input as a combobox controlling a listbox of options', () => {
        renderPalette();
        fireEvent.change(searchInput(), { target: { value: 'Gatehouse' } });

        const input = searchInput();
        const listbox = screen.getByRole('listbox');

        expect(input.getAttribute('role')).toBe('combobox');
        expect(listbox.id).toBeTruthy();
        expect(input.getAttribute('aria-controls')).toBe(listbox.id);
        expect(input.getAttribute('aria-expanded')).toBe('true');

        const options = screen.getAllByRole('option');
        expect(options.length).toBeGreaterThan(0);

        const activeId = input.getAttribute('aria-activedescendant');
        expect(activeId).toBeTruthy();
        const active = document.getElementById(activeId!);
        expect(active).not.toBeNull();
        expect(active!.getAttribute('aria-selected')).toBe('true');
    });

    it('announces the result count in a polite live region', () => {
        renderPalette();
        fireEvent.change(searchInput(), { target: { value: 'Gatehouse' } });

        const live = document.querySelector('[aria-live="polite"]');
        expect(live).not.toBeNull();
        expect(live!.textContent).toMatch(/\d/);
    });
});

// ── #99 — scenes are blue, from ENTITY_TYPE_CONFIG ──────────────────────────

describe('wp-d-linking #99 — scene colour comes from ENTITY_TYPE_CONFIG', () => {
    it('registers scene in the central entity config as blue', () => {
        expect(ENTITY_TYPE_CONFIG.scene).toBeDefined();
        expect(ENTITY_TYPE_CONFIG.scene.color).toBe('blue');
    });

    it('renders the Scene badge in blue, never red', () => {
        renderPalette();
        fireEvent.change(searchInput(), { target: { value: 'Gatehouse' } });

        const badge = screen.getByText('Scene');
        expect(badge.className).not.toMatch(/red/);
        expect(badge.className).toMatch(/blue/);
    });
});
