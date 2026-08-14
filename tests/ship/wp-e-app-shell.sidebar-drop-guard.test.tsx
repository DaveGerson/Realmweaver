// @vitest-environment jsdom
/**
 * wp-e-app-shell — finding #19 (the concrete crash it names)
 *
 * CampaignSidebar.handleDrop does
 * `JSON.parse(e.dataTransfer.getData('application/json'))` with no try/catch.
 * Dropping content from another app that advertises an application/json type
 * with a non-JSON payload throws during the event. Because no ErrorBoundary
 * wraps the sidebar (see the companion index-root-boundary test), that throw
 * takes down the whole React tree and the GM gets a white page.
 *
 * Contract: a malformed drop payload is ignored — no exception escapes the
 * handler and no reorder is attempted. Well-formed payloads still reorder.
 */

import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { CampaignSidebar } from '../../components/layout/CampaignSidebar';
import { createDefaultScene } from '../../utils/entityUtils';
import type { Campaign } from '../../types/index';

afterEach(cleanup);

const sceneA = { ...createDefaultScene(), id: 'scene-a', title: 'The Drowned Gate' };
const sceneB = { ...createDefaultScene(), id: 'scene-b', title: 'The Drowned Vault' };

const campaign = {
    id: 'camp-1',
    title: 'Test Campaign',
    setting: 'A world',
    settingType: 'custom',
    dmStyle: 'power',
    featureOverrides: {},
    npcs: [], locations: [], factions: [], items: [],
    adventures: [{ id: 'adv-1', title: 'The Sunken Vault', scenes: [sceneA, sceneB] }],
    articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

const emptyIds = {
    adventure: null, scene: null, npc: null, location: null, faction: null,
    item: null, article: null, sessionLog: null, playerCharacter: null, plot: null, note: null,
};

let errors: unknown[] = [];
const onWindowError = (e: ErrorEvent) => { errors.push(e.error ?? e.message); };

beforeEach(() => {
    errors = [];
    window.addEventListener('error', onWindowError);
});

afterEach(() => {
    window.removeEventListener('error', onWindowError);
});

async function renderSidebar(onReorderScene: (a: string, b: string, c: string) => void) {
    render(
        <CampaignSidebar
            campaign={campaign}
            activeView="setting"
            onSelectView={() => {}}
            selectedIds={emptyIds}
            onSelect={() => {}}
            onShowGenerator={() => {}}
            onReorderScene={onReorderScene}
        />
    );
    // Scenes render collapsed by default; the filter box expands every adventure.
    const search = screen.getByPlaceholderText(/filter/i);
    fireEvent.change(search, { target: { value: 'Drowned' } });
    return waitFor(() => screen.getByTitle('The Drowned Vault'));
}

describe('wp-e-app-shell #19 — a malformed sidebar drop must not take down the app', () => {
    it('ignores a drop payload that is not JSON', async () => {
        const onReorderScene = vi.fn();
        const target = await renderSidebar(onReorderScene);

        fireEvent.drop(target, {
            dataTransfer: {
                getData: () => '<html>dragged from another app</html>',
                dropEffect: 'move',
            },
        });

        expect(errors).toEqual([]);
        expect(onReorderScene).not.toHaveBeenCalled();
    });

    it('still reorders on a well-formed payload', async () => {
        const onReorderScene = vi.fn();
        const target = await renderSidebar(onReorderScene);

        fireEvent.drop(target, {
            dataTransfer: {
                getData: () => JSON.stringify({ adventureId: 'adv-1', sceneId: 'scene-a' }),
                dropEffect: 'move',
            },
        });

        expect(onReorderScene).toHaveBeenCalledWith('adv-1', 'scene-a', 'scene-b');
    });
});
