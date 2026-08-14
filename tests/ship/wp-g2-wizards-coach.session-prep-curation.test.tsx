// @vitest-environment jsdom
/**
 * wp-g2-wizards-coach — finding #26
 *
 * SessionPrepWizard step 3 ("NPCs & Locations") maintains
 * extraNpcIds / removedNpcIds / extraLocationIds / removedLocationIds, folds
 * them into `activeNpcIds` / `activeLocationIds`, and the Review step advertises
 * the curated result as headline counts. But `handleGoLive`
 * (SessionPrepWizard.tsx:270) builds a `sessionData` containing only
 * adventureId / plannedSceneIds / prepNotes / relatedPlotIds — the curated
 * entity sets are dropped on the floor and `SessionLog` has no field to hold
 * them, so the whole step has zero effect on the live session.
 *
 * Contract for the fix:
 *   1. Add `plannedNpcIds?: string[]` and `plannedLocationIds?: string[]` to
 *      `SessionLog` (types/SessionLog.ts).
 *   2. `handleGoLive` must persist `Array.from(activeNpcIds)` /
 *      `Array.from(activeLocationIds)` into those fields.
 *   3. The curation must be honoured: manually-added ids are present,
 *      manually-removed auto-linked ids are absent.
 *   (If instead the step is deleted, delete the review counts too — but then
 *   this test should be removed rather than made to pass by another route.)
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';
import type { Campaign } from '../../types/index';

const h = vi.hoisted(() => ({
    createSessionLog: vi.fn(() => 'sess-new'),
    goLive: vi.fn(),
}));

vi.mock('../../services/campaignService', () => ({
    campaignService: {
        createSessionLog: h.createSessionLog,
        goLive: h.goLive,
    },
}));

import { SessionPrepWizard } from '../../components/dialogs/SessionPrepWizard';

const scene = {
    id: 'scene-1',
    title: 'The Ashen Gate',
    type: 'social',
    status: 'planned',
    readAloudText: '',
    gmNotes: '',
    skillChecks: [],
    rewards: '',
    locationId: 'loc-auto',
    npcIds: ['npc-auto'],
};

const campaign = {
    id: 'c1',
    title: 'Ashfall',
    settingType: 'custom',
    setting: 'A dying empire',
    articles: [],
    adventures: [{ id: 'adv-1', title: 'The Ashen Vault', hook: '', theme: '', scenes: [scene] }],
    npcs: [
        { id: 'npc-auto', name: 'Auto Linked Npc', description: '' },
        { id: 'npc-extra', name: 'Extra Curated Npc', description: '' },
    ],
    locations: [{ id: 'loc-auto', name: 'Auto Linked Location', description: '' }],
    factions: [], items: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [],
} as unknown as Campaign;

beforeEach(() => {
    h.createSessionLog.mockClear();
    h.goLive.mockClear();
});

afterEach(cleanup);

describe('SessionPrepWizard — the NPCs & Locations curation must survive Go Live (#26)', () => {
    it('persists the curated NPC and location sets on the created session log', () => {
        render(<SessionPrepWizard campaign={campaign} onComplete={() => {}} onClose={() => {}} />);

        // Step 1 — pick the adventure (auto-selects its planned scene).
        fireEvent.click(screen.getByRole('button', { name: /The Ashen Vault/ }));

        // Step 3 — curate: add an off-scene NPC, drop the auto-linked one.
        fireEvent.click(screen.getByRole('button', { name: /NPCs & Locations/i }));
        fireEvent.click(screen.getByRole('button', { name: /Extra Curated Npc/ }));
        const autoNpcRow = screen.getByText('Auto Linked Npc').closest('div.rounded-lg') as HTMLElement;
        fireEvent.click(within(autoNpcRow).getByTitle('Remove from session'));

        // Step 5 — Go Live (the nav button's name gains ", Step N of M" once current).
        fireEvent.click(screen.getByRole('button', { name: /^Go Live$/ }));
        fireEvent.click(screen.getByRole('button', { name: /^Go Live$/ }));

        expect(h.createSessionLog).toHaveBeenCalledTimes(1);
        const payload = h.createSessionLog.mock.calls[0][0] as Record<string, unknown>;

        expect(payload.plannedNpcIds).toEqual(['npc-extra']);
        expect(payload.plannedLocationIds).toEqual(['loc-auto']);
        // The existing planning payload must be unchanged.
        expect(payload.adventureId).toBe('adv-1');
        expect(payload.plannedSceneIds).toEqual(['scene-1']);
        expect(h.goLive).toHaveBeenCalledWith('sess-new');
    });
});
