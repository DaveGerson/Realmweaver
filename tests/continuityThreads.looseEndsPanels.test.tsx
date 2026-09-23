// @vitest-environment jsdom
/**
 * Roadmap L3 — Prep-to-Play Continuity Bridge.
 *
 * SessionPrepWizard's opening step shows a "Previously on… Loose ends" panel
 * computed by utils/continuityThreads.ts. Checked threads are appended to the
 * new session's prepNotes and their plot ids merged into relatedPlotIds.
 * The Session Runner's LooseEndsPanel lists the same threads with
 * click-to-navigate.
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import type { Campaign, SessionLog } from '../types/index';

const h = vi.hoisted(() => ({
    createSessionLog: vi.fn((_data: Omit<SessionLog, 'id'>) => 'sess-new'),
    goLive: vi.fn(),
}));

vi.mock('../services/campaignService', () => ({
    campaignService: {
        createSessionLog: h.createSessionLog,
        goLive: h.goLive,
    },
}));

import { SessionPrepWizard } from '../components/dialogs/SessionPrepWizard';
import { LooseEndsPanel } from '../components/views/session/LooseEndsPanel';

const prevSession = {
    id: 'sess-11',
    title: 'Session 11',
    status: 'completed',
    sessionDate: '2026-09-01T00:00:00.000Z',
    plannedSceneIds: [],
    prepNotes: '',
    relatedPlotIds: ['plot-heir'],
    plotProgressions: { 'plot-heir': 'advanced' },
    runningNotes: '',
    structuredNotes: [],
    encounterLog: [],
    recap: '',
    notableEvents: '',
    looseEnds: 'The bridge collapsed behind the party.',
} as SessionLog;

const campaign = {
    id: 'c1',
    title: 'Ashfall',
    settingType: 'custom',
    setting: '',
    articles: [],
    adventures: [],
    npcs: [],
    locations: [],
    factions: [],
    items: [],
    sessionLogs: [prevSession],
    playerCharacters: [],
    plots: [
        { id: 'plot-heir', title: 'The Missing Heir', description: '', status: 'active', relatedEntityIds: [] },
        { id: 'plot-cult', title: 'The Ember Cult', description: '', status: 'dormant', relatedEntityIds: [] },
        { id: 'plot-done', title: 'Old War', description: '', status: 'resolved', relatedEntityIds: [] },
    ],
    notes: [],
} as unknown as Campaign;

beforeEach(() => {
    h.createSessionLog.mockClear();
    h.goLive.mockClear();
});

afterEach(cleanup);

const goToReviewAndGoLive = () => {
    fireEvent.click(screen.getByRole('button', { name: /Go Live/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /Go Live/i }).at(-1)!);
};

describe('SessionPrepWizard — Previously on… / Loose ends panel', () => {
    it('lists unresolved threads, none checked by default, on the opening step', () => {
        render(<SessionPrepWizard campaign={campaign} onComplete={() => {}} onClose={() => {}} />);
        const panel = screen.getByRole('region', { name: /Loose ends/i });
        expect(panel).toBeTruthy();
        const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
        // session loose ends + 2 unresolved plots (resolved plot excluded)
        expect(boxes).toHaveLength(3);
        expect(boxes.every(b => !b.checked)).toBe(true);
        expect(screen.queryByText('Old War')).toBeNull();
        expect(screen.getByText('The Missing Heir')).toBeTruthy();
        expect(screen.getByText('The bridge collapsed behind the party.')).toBeTruthy();
    });

    it('carries checked threads into prepNotes and relatedPlotIds on Go Live', () => {
        const onComplete = vi.fn();
        render(<SessionPrepWizard campaign={campaign} onComplete={onComplete} onClose={() => {}} />);

        // Carry everything, then uncheck the dormant cult plot.
        fireEvent.click(screen.getByRole('button', { name: 'Carry all loose ends' }));
        fireEvent.click(screen.getByRole('checkbox', { name: /The Ember Cult/ }));
        goToReviewAndGoLive();

        expect(h.createSessionLog).toHaveBeenCalledTimes(1);
        const data = h.createSessionLog.mock.calls[0][0];
        expect(data.prepNotes).toContain('Carried forward from previous sessions:');
        expect(data.prepNotes).toContain('[Loose ends] Loose ends from "Session 11" — The bridge collapsed behind the party.');
        expect(data.prepNotes).toContain('[Plot] The Missing Heir — Last session: advanced.');
        expect(data.prepNotes).not.toContain('The Ember Cult');
        expect(data.relatedPlotIds).toEqual(['plot-heir']);
        expect(onComplete).toHaveBeenCalledWith('sess-new');
    });

    it('carries nothing by default, or after All then None', () => {
        render(<SessionPrepWizard campaign={campaign} onComplete={() => {}} onClose={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: 'Carry all loose ends' }));
        fireEvent.click(screen.getByRole('button', { name: 'Carry no loose ends' }));
        goToReviewAndGoLive();
        const data = h.createSessionLog.mock.calls[0][0];
        expect(data.prepNotes).toBe('');
        expect(data.relatedPlotIds).toEqual([]);
    });

    it('leaves the Go Live payload untouched when the panel is ignored', () => {
        render(<SessionPrepWizard campaign={campaign} onComplete={() => {}} onClose={() => {}} />);
        goToReviewAndGoLive();
        const data = h.createSessionLog.mock.calls[0][0];
        expect(data.prepNotes).toBe('');
        expect(data.relatedPlotIds).toEqual([]);
    });

    it('keeps a strong-start/cold-open block first and appends carried threads after the DM notes', () => {
        render(<SessionPrepWizard campaign={campaign} onComplete={() => {}} onClose={() => {}} />);
        fireEvent.click(screen.getByRole('checkbox', { name: /The Missing Heir/ }));
        fireEvent.click(screen.getByRole('button', { name: /Go Live/i }));
        fireEvent.change(screen.getByLabelText(/Prep Notes/i), { target: { value: 'Use the accent.' } });
        fireEvent.click(screen.getAllByRole('button', { name: /Go Live/i }).at(-1)!);
        const data = h.createSessionLog.mock.calls[0][0];
        expect(data.prepNotes).toBe('Use the accent.\n\nCarried forward from previous sessions:\n- [Plot] The Missing Heir — Last session: advanced.');
        expect(data.relatedPlotIds).toEqual(['plot-heir']);
    });

    it('hides the panel when there are no loose ends', () => {
        const empty = { ...campaign, sessionLogs: [], plots: [] } as Campaign;
        render(<SessionPrepWizard campaign={empty} onComplete={() => {}} onClose={() => {}} />);
        expect(screen.queryByRole('region', { name: /Loose ends/i })).toBeNull();
    });
});

describe('LooseEndsPanel (Session Runner)', () => {
    it('lists threads, navigates on click, and collapses', () => {
        const onNavigate = vi.fn();
        render(<LooseEndsPanel campaign={campaign} onNavigate={onNavigate} />);
        fireEvent.click(screen.getByRole('button', { name: /The Missing Heir/ }));
        expect(onNavigate).toHaveBeenCalledWith('plot', 'plot-heir');

        fireEvent.click(screen.getByRole('button', { name: /Loose ends from "Session 11"/ }));
        expect(onNavigate).toHaveBeenCalledWith('session-log', 'sess-11');

        const toggle = screen.getByRole('button', { name: /^Loose ends/ , expanded: true });
        fireEvent.click(toggle);
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(screen.queryByText('The Missing Heir')).toBeNull();
    });

    it('caps the list and offers Show all', () => {
        render(<LooseEndsPanel campaign={campaign} limit={1} />);
        expect(screen.queryByText('The Ember Cult')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Show all 3' }));
        expect(screen.getByText('The Ember Cult')).toBeTruthy();
    });

    it('renders nothing without threads', () => {
        const { container } = render(<LooseEndsPanel campaign={{ ...campaign, sessionLogs: [], plots: [] } as Campaign} />);
        expect(container.innerHTML).toBe('');
    });
});
