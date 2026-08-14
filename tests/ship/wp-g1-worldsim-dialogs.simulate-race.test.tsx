// @vitest-environment jsdom
/**
 * wp-g1-worldsim-dialogs — finding #23
 *
 * `handleSimulate` (components/dialogs/WorldSimulationWizard.tsx:114) resets the
 * shared `cancelledRef.current = false` at the top of every run, so the guard
 * belonging to an earlier, cancelled request is disarmed the moment a new run
 * starts. A cancelled "A week" request that settles after the user restarts
 * with "Six months" therefore populates the review list with events generated
 * for the wrong time span.
 *
 * Contract: each run must be identified (monotonic request id captured at the
 * top of handleSimulate); both the resolve and the reject paths must bail out
 * unless they are still the newest run.
 */

import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { Campaign } from '../../types/index';

type Deferred = { promise: Promise<any>; resolve: (v: any) => void; reject: (e: any) => void };

const h = vi.hoisted(() => ({ deferreds: [] as any[] }));

vi.mock('../../services/aiService', () => ({
    generateWorldEvents: vi.fn(() => {
        let resolve!: (v: any) => void;
        let reject!: (e: any) => void;
        const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
        h.deferreds.push({ promise, resolve, reject });
        return promise;
    }),
}));

vi.mock('../../services/campaignService', () => ({
    campaignService: {
        updateNpc: vi.fn(), updateFaction: vi.fn(), updateLocation: vi.fn(),
        updatePlot: vi.fn(), updateAdventure: vi.fn(),
    },
}));

import { WorldSimulationWizard } from '../../components/dialogs/WorldSimulationWizard';

const campaign = {
    id: 'c1', title: 'Ashfall', settingType: 'custom', setting: 'A dying empire',
    articles: [], adventures: [], npcs: [], locations: [], factions: [], items: [],
    sessionLogs: [], playerCharacters: [], plots: [], notes: [],
} as unknown as Campaign;

function evt(id: string, title: string) {
    return {
        id, title, description: 'desc', affectedEntityIds: [], affectedEntityTypes: [],
        suggestedUpdates: [], severity: 'minor', category: 'world',
    };
}

afterEach(() => {
    h.deferreds.length = 0;
    cleanup();
});

describe('WorldSimulationWizard discards results from superseded runs', () => {
    it('a cancelled run that settles after a restart does not populate the review list', async () => {
        render(
            <WorldSimulationWizard campaign={campaign} isMockMode={true} onClose={() => {}} onApplyEvents={() => {}} />
        );

        // Run 1 — "A week"
        fireEvent.click(screen.getByRole('button', { name: /^A week$/i }));
        fireEvent.click(screen.getByRole('button', { name: /Simulate World/i }));
        await waitFor(() => expect(h.deferreds).toHaveLength(1));

        // User cancels mid-generation, then restarts with a different span
        fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));
        fireEvent.click(screen.getByRole('button', { name: /^Six months$/i }));
        fireEvent.click(screen.getByRole('button', { name: /Simulate World/i }));
        await waitFor(() => expect(h.deferreds).toHaveLength(2));

        // The abandoned 7-day request settles first.
        await act(async () => {
            h.deferreds[0].resolve([evt('stale-1', 'STALE seven-day event')]);
            await Promise.resolve();
        });

        expect(screen.queryByText(/STALE seven-day event/i)).toBeNull();

        // The current run then settles and is shown.
        await act(async () => {
            h.deferreds[1].resolve([evt('fresh-1', 'FRESH six-month event')]);
            await Promise.resolve();
        });

        expect(await screen.findByText(/FRESH six-month event/i)).toBeTruthy();
    });

    it('a rejection from a superseded run does not surface an error over the current run', async () => {
        render(
            <WorldSimulationWizard campaign={campaign} isMockMode={true} onClose={() => {}} onApplyEvents={() => {}} />
        );

        fireEvent.click(screen.getByRole('button', { name: /Simulate World/i }));
        await waitFor(() => expect(h.deferreds).toHaveLength(1));
        fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));
        fireEvent.click(screen.getByRole('button', { name: /Simulate World/i }));
        await waitFor(() => expect(h.deferreds).toHaveLength(2));

        await act(async () => {
            h.deferreds[0].reject(new Error('stale request blew up'));
            await Promise.resolve();
        });

        expect(screen.queryByText(/stale request blew up/i)).toBeNull();
    });
});
