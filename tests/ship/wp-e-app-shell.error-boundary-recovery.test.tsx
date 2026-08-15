// @vitest-environment jsdom
/**
 * wp-e-app-shell — finding #61
 *
 * ErrorBoundary's recovery screen tells the GM "Your campaign data is safe" and
 * offers a secondary button labelled "Return Home" that simply calls
 * window.location.reload(). campaignService debounces every write by
 * AUTO_SAVE_DELAY_MS = 2000, so an edit made ~1s before the throw is still
 * sitting in the pending debounce and is discarded by the reload. The label is
 * also wrong: nothing "returns home", the page is reloaded.
 *
 * Contract:
 *   1. the secondary recovery action is labelled as a reload ("Reload App"),
 *      not "Return Home";
 *   2. clicking it flushes the pending campaign save (campaignService.saveCampaign()
 *      or an equivalent synchronous flush) BEFORE window.location.reload() runs.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';

const h = vi.hoisted(() => ({
    calls: [] as string[],
}));

vi.mock('../../services/campaignService', () => ({
    campaignService: {
        saveCampaign: () => { h.calls.push('saveCampaign'); },
        flushPendingSave: () => { h.calls.push('flushPendingSave'); },
        subscribe: () => () => {},
        getState: () => ({ campaigns: [], activeCampaignId: null, appStatus: 'editing', saveStatus: 'idle', lastSavedAt: null }),
    },
}));

import { ErrorBoundary } from '../../components/common/ErrorBoundary';

const Boom: React.FC = () => { throw new Error('scene panel exploded'); };

let reloadCalls = 0;

beforeEach(() => {
    h.calls.length = 0;
    reloadCalls = 0;
    // jsdom's location.reload is a no-op that logs "Not implemented"; replace it
    // so we can observe ordering without noise.
    Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: {
            ...window.location,
            reload: () => { reloadCalls += 1; h.calls.push('reload'); },
        },
    });
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe('wp-e-app-shell #61 — the recovery screen must not discard the pending autosave', () => {
    it('labels the secondary action as a reload', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        render(<ErrorBoundary><Boom /></ErrorBoundary>);

        expect(screen.getByRole('button', { name: /reload app/i })).toBeTruthy();
        expect(screen.queryByRole('button', { name: /return home/i })).toBeNull();
    });

    it('keeps the "isolated to the current view" copy for the default (view-scoped) boundary', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        render(<ErrorBoundary><Boom /></ErrorBoundary>);

        expect(document.body.textContent ?? '').toMatch(/isolated to the current view/i);
    });

    it('flushes the pending save before reloading the page', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        render(<ErrorBoundary><Boom /></ErrorBoundary>);

        fireEvent.click(screen.getByRole('button', { name: /reload app/i }));

        expect(reloadCalls).toBe(1);
        const flushIndex = h.calls.findIndex(c => c === 'saveCampaign' || c === 'flushPendingSave');
        expect(flushIndex).toBeGreaterThanOrEqual(0);
        expect(flushIndex).toBeLessThan(h.calls.indexOf('reload'));
    });
});
