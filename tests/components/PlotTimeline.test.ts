import { describe, it, expect } from 'vitest';
import { getEffectiveSessionStatus, getPlotSessionStatus } from '../../components/visualizers/PlotTimeline';
import type { Plot } from '../../types/Plot';
import type { SessionLog } from '../../types/SessionLog';

const makePlot = (overrides: Partial<Plot> = {}): Plot => ({
    id: 'plot1',
    title: 'The Missing Heir',
    description: '',
    status: 'active',
    relatedEntityIds: [],
    ...overrides,
});

const makeSession = (overrides: Partial<SessionLog> = {}): SessionLog => ({
    id: 's1',
    title: 'Session 1',
    status: 'completed',
    sessionDate: '2026-01-01',
    plannedSceneIds: [],
    prepNotes: '',
    relatedPlotIds: [],
    runningNotes: '',
    structuredNotes: [],
    encounterLog: [],
    recap: '',
    notableEvents: '',
    looseEnds: '',
    ...overrides,
});

describe('getPlotSessionStatus', () => {
    it('never returns "resolved" — that value does not exist on PlotSessionStatus', () => {
        // plotProgressions is typed Record<string, PlotSessionStatus>, which structurally
        // cannot contain 'resolved'; this pins down that getPlotSessionStatus is purely
        // session-data-driven and ignorant of the plot's own status field.
        const session = makeSession({ plotProgressions: { plot1: 'stalled' } });
        expect(getPlotSessionStatus(session, 'plot1')).toBe('stalled');
    });
});

describe('getEffectiveSessionStatus', () => {
    it('reports "resolved" on the most recent session column when the plot is resolved', () => {
        const plot = makePlot({ status: 'resolved' });
        const session = makeSession({ plotProgressions: { plot1: 'stalled' } });
        expect(getEffectiveSessionStatus(session, plot, true)).toBe('resolved');
    });

    it('reports "resolved" even when the most recent session never mentioned the plot', () => {
        const plot = makePlot({ status: 'resolved' });
        const session = makeSession(); // no plotProgressions, no relatedPlotIds entry
        expect(getEffectiveSessionStatus(session, plot, true)).toBe('resolved');
    });

    it('does not override earlier (non-most-recent) session columns for a resolved plot', () => {
        const plot = makePlot({ status: 'resolved' });
        const session = makeSession({ plotProgressions: { plot1: 'advanced' } });
        expect(getEffectiveSessionStatus(session, plot, false)).toBe('advanced');
    });

    it('falls through to the normal per-session status when the plot is not resolved', () => {
        const plot = makePlot({ status: 'active' });
        const session = makeSession({ plotProgressions: { plot1: 'unchanged' } });
        expect(getEffectiveSessionStatus(session, plot, true)).toBe('unchanged');
        expect(getEffectiveSessionStatus(session, plot, false)).toBe('unchanged');
    });

    it('returns null for a resolved plot on a non-final session with no data', () => {
        const plot = makePlot({ status: 'resolved' });
        const session = makeSession();
        expect(getEffectiveSessionStatus(session, plot, false)).toBeNull();
    });
});
