// @vitest-environment jsdom
/**
 * wp-e-app-shell — EXTRA #1 (multi-tab conflict banner)
 *
 * wp-a-persistence's init() sets `state.conflictDetected` when a `storage`
 * event shows another browser tab wrote fresh campaign data; while that flag
 * is set, `persistToStorage` refuses to write, so this tab's autosave is
 * silently paused. `campaignService.resolveConflict('reload' | 'overwrite')`
 * is the documented way to clear it (see its docblock: "Intended to be
 * called from a banner (owned by wp-e-app-shell)").
 *
 * Also covers finding idx7's sibling flag, `recoveredFromBackup`, whose
 * docblock likewise names wp-e-app-shell as the banner owner.
 *
 * Contract:
 *   - conflictDetected renders a visible banner with Reload / Keep mine
 *     actions that call campaignService.resolveConflict('reload' | 'overwrite');
 *   - recoveredFromBackup renders a dismissible banner that calls
 *     campaignService.dismissBackupRecoveryNotice();
 *   - neither banner renders when its flag is false.
 */

import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';

const h = vi.hoisted(() => ({
    state: {
        campaigns: [{
            id: 'camp-1',
            title: 'Test Campaign',
            setting: 'A world',
            settingType: 'custom',
            npcs: [], locations: [], factions: [], items: [], adventures: [],
            articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
        }] as unknown[],
        activeCampaignId: 'camp-1' as string | null,
        appStatus: 'editing' as string,
        saveStatus: 'idle' as string,
        lastSavedAt: null as string | null,
        conflictDetected: false,
        recoveredFromBackup: false,
    },
    calls: [] as string[],
}));

vi.mock('../../services/campaignService', () => ({
    campaignService: new Proxy({
        subscribe: () => () => {},
        getState: () => h.state,
        resolveConflict: (choice: 'reload' | 'overwrite') => { h.calls.push(`resolveConflict:${choice}`); },
        dismissBackupRecoveryNotice: () => { h.calls.push('dismissBackupRecoveryNotice'); },
    } as Record<string, unknown>, {
        get(target, prop: string) {
            if (prop in target) return target[prop];
            return () => {};
        },
    }),
}));

vi.mock('../../smokeTest', () => ({ runSmokeTests: async () => {} }));
vi.mock('../../services/aiService', () => ({ analyzeWritingStyle: async () => null }));

import App from '../../App';
import { ToastProvider } from '../../hooks/useToast';
import { ConfirmDialogProvider } from '../../hooks/useConfirmDialog';

afterEach(() => {
    cleanup();
    h.calls.length = 0;
    h.state.conflictDetected = false;
    h.state.recoveredFromBackup = false;
});

function renderApp() {
    return render(
        <ToastProvider>
            <ConfirmDialogProvider>
                <App />
            </ConfirmDialogProvider>
        </ToastProvider>
    );
}

describe('wp-e-app-shell EXTRA #1 — the multi-tab conflict banner', () => {
    it('renders nothing when there is no conflict', () => {
        renderApp();
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('shows a banner and resolves via resolveConflict("reload")', () => {
        h.state.conflictDetected = true;
        renderApp();

        const banner = screen.getByRole('alert');
        expect(banner.textContent ?? '').toMatch(/another (browser )?tab/i);

        fireEvent.click(screen.getByRole('button', { name: /reload/i }));
        expect(h.calls).toContain('resolveConflict:reload');
    });

    it('shows a banner and resolves via resolveConflict("overwrite")', () => {
        h.state.conflictDetected = true;
        renderApp();

        fireEvent.click(screen.getByRole('button', { name: /keep mine/i }));
        expect(h.calls).toContain('resolveConflict:overwrite');
    });
});

describe('wp-e-app-shell — backup-recovery notice (idx7 sibling flag)', () => {
    it('renders nothing when nothing was recovered', () => {
        renderApp();
        expect(screen.queryByText(/recovered from a recent backup/i)).toBeNull();
    });

    it('shows a dismissible notice and calls dismissBackupRecoveryNotice()', () => {
        h.state.recoveredFromBackup = true;
        renderApp();

        expect(screen.getByText(/recovered from a recent backup/i)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
        expect(h.calls).toContain('dismissBackupRecoveryNotice');
    });
});
