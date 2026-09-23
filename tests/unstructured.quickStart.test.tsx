// @vitest-environment jsdom
/**
 * SPEC — the near-zero-prep on-ramp and the pressure/spotlight surfaces on
 * Tonight's Table and the Session Manager (docs/design/unstructured-play.md)
 *
 *  1. Tonight's Table offers "Just start playing" next to the prep button;
 *     it calls onQuickStart, is disabled while a session is live, and is
 *     absent when no handler is wired.
 *  2. The Session Manager offers "Start Now" under the same rules.
 *  3. Tonight's Table shows a Spotlight panel — quietest character first —
 *     with an invitation when there are no characters.
 *  4. Open threads carry the plot's clock reading, "Time's up" when it has
 *     run out, and the "if ignored" move.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';
import type { Campaign, SessionLog, PlayerCharacter } from '../types/index';
import { ToastProvider } from '../hooks/useToast';
import { ConfirmDialogProvider } from '../hooks/useConfirmDialog';
import { createDefaultPlayerCharacter } from '../utils/entityUtils';

vi.mock('@/components/dialogs/SessionPrepWizard', () => ({
    SessionPrepWizard: () => <div role="dialog" aria-label="Session Prep Wizard" />,
}));

const { TonightsTable } = await import('../components/views/TonightsTable');
const { SessionLogDashboard } = await import('../components/dashboards/SessionLogDashboard');

function session(over: Partial<SessionLog> & { id: string }): SessionLog {
    return {
        title: `Session ${over.id}`, status: 'completed', sessionDate: '2026-01-01', plannedSceneIds: [], prepNotes: '',
        relatedPlotIds: [], runningNotes: '', structuredNotes: [], encounterLog: [], recap: '', notableEvents: '', looseEnds: '',
        ...over,
    } as SessionLog;
}

function pc(id: string, characterName: string, playerName: string): PlayerCharacter {
    const base = createDefaultPlayerCharacter();
    return { ...base, id, playerName, characterSocial: { ...base.characterSocial, characterName } };
}

function makeCampaign(over: Partial<Campaign> = {}): Campaign {
    return {
        id: 'camp-1', title: 'Ashfall', setting: 'A dying empire', settingType: 'custom',
        npcs: [], locations: [], factions: [], items: [], adventures: [], articles: [], sessionLogs: [],
        playerCharacters: [], plots: [], notes: [], secrets: [],
        ...over,
    } as Campaign;
}

const wrap = (node: React.ReactElement) => (
    <ToastProvider><ConfirmDialogProvider>{node}</ConfirmDialogProvider></ToastProvider>
);

afterEach(cleanup);

describe('1. Tonight\'s Table — Just start playing', () => {
    it('calls onQuickStart and sits beside the prep button', () => {
        const onQuickStart = vi.fn();
        render(wrap(<TonightsTable campaign={makeCampaign()} onNavigate={() => {}} onGoLive={() => {}} onQuickStart={onQuickStart} />));
        fireEvent.click(screen.getByRole('button', { name: 'Just start playing' }));
        expect(onQuickStart).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('button', { name: "Prep tonight's session" })).toBeTruthy();
    });

    it('is disabled while a session is live', () => {
        const campaign = makeCampaign({ sessionLogs: [session({ id: 'live', status: 'active' })], activeSessionId: 'live' });
        render(wrap(<TonightsTable campaign={campaign} onNavigate={() => {}} onGoLive={() => {}} onQuickStart={() => {}} />));
        expect((screen.getByRole('button', { name: 'Just start playing' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('is absent when no handler is wired', () => {
        render(wrap(<TonightsTable campaign={makeCampaign()} onNavigate={() => {}} onGoLive={() => {}} />));
        expect(screen.queryByRole('button', { name: 'Just start playing' })).toBeNull();
    });
});

describe('2. Session Manager — Start Now', () => {
    const renderDashboard = (sessionLogs: SessionLog[], onQuickStart?: () => void) =>
        render(wrap(
            <SessionLogDashboard
                campaign={makeCampaign({ sessionLogs })}
                sessionLogs={sessionLogs}
                onSessionLogCreated={() => {}}
                onSelectSessionLog={() => {}}
                onGoLive={() => {}}
                onQuickStart={onQuickStart}
                isMockMode
            />
        ));

    it('calls onQuickStart when nothing is live', () => {
        const onQuickStart = vi.fn();
        renderDashboard([], onQuickStart);
        fireEvent.click(screen.getByRole('button', { name: /Start Now/ }));
        expect(onQuickStart).toHaveBeenCalledTimes(1);
    });

    it('is disabled while a session is live and absent without a handler', () => {
        const { unmount } = renderDashboard([session({ id: 'live', status: 'active' })], () => {});
        expect((screen.getByRole('button', { name: /Start Now/ }) as HTMLButtonElement).disabled).toBe(true);
        unmount();
        renderDashboard([]);
        expect(screen.queryByRole('button', { name: /Start Now/ })).toBeNull();
    });
});

describe('3. Tonight\'s Table — Spotlight', () => {
    it('lists characters quietest first with their player and a session-ordinal label', () => {
        const campaign = makeCampaign({
            playerCharacters: [pc('pc-1', 'Torvald Ironfist', 'Dana'), pc('pc-2', 'Mira', 'Lee')],
            sessionLogs: [
                session({ id: 's1', sessionDate: '2026-01-01', structuredNotes: [{ id: 'n', timestamp: '', content: 'Mira wins the duel.', taggedEntityIds: [] }] }),
            ],
        });
        const onNavigate = vi.fn();
        render(wrap(<TonightsTable campaign={campaign} onNavigate={onNavigate} onGoLive={() => {}} />));
        const region = screen.getByRole('region', { name: 'Spotlight' });
        const buttons = within(region).getAllByRole('button');
        expect(buttons[0].textContent).toContain('Torvald Ironfist');
        expect(buttons[0].textContent).toContain('Dana');
        expect(buttons[0].textContent).toContain("Hasn't had a moment yet");
        expect(buttons[1].textContent).toContain('In the spotlight last session');
        fireEvent.click(buttons[0]);
        expect(onNavigate).toHaveBeenCalledWith('player-character', 'pc-1');
    });

    it('invites the GM to bring in characters when there are none', () => {
        render(wrap(<TonightsTable campaign={makeCampaign()} onNavigate={() => {}} onGoLive={() => {}} />));
        const region = screen.getByRole('region', { name: 'Spotlight' });
        expect(within(region).getByText(/Bring in your players' characters/)).toBeTruthy();
    });
});

describe('4. Open threads carry the pressure', () => {
    it('shows the clock, Time\'s up, and the if-ignored move', () => {
        const campaign = makeCampaign({
            plots: [
                { id: 'p-1', title: 'The Tide Cult', description: '', status: 'active', relatedEntityIds: [], clock: { segments: 4, filled: 4 }, ifIgnored: 'The chapel floods for good.' },
                { id: 'p-2', title: 'Quiet Debt', description: '', status: 'active', relatedEntityIds: [] },
            ],
        });
        render(wrap(<TonightsTable campaign={campaign} onNavigate={() => {}} onGoLive={() => {}} />));
        const region = screen.getByRole('region', { name: 'Open threads' });
        expect(within(region).getByRole('img', { name: 'The Tide Cult: clock 4 of 4' })).toBeTruthy();
        expect(within(region).getByText("Time's up")).toBeTruthy();
        expect(within(region).getByText('If ignored: The chapel floods for good.')).toBeTruthy();
        expect(within(region).queryByRole('img', { name: /Quiet Debt: clock/ })).toBeNull();
    });
});
