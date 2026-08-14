// @vitest-environment jsdom
/**
 * wp-e-app-shell — findings #57 and #56
 *
 *   #57 The mobile FAB toggles a role="menu" popover whose arrow-key/Escape
 *       handler is attached to the menu <div> via onKeyDown, so it only fires
 *       when focus is already INSIDE the menu. Nothing moves focus there when
 *       it opens — focus stays on the FAB button, a sibling outside the menu —
 *       so the menu is pointer-only. Header.tsx does this correctly (a
 *       requestAnimationFrame effect focuses the first [role="menuitem"]).
 *
 *   #56 The Combat Tracker slide-out is a full modal (fixed inset-0 backdrop +
 *       fixed right-hand panel) built from raw divs: no role="dialog", no
 *       aria-modal, no focus trap, no scroll lock, no Escape handler. CLAUDE.md
 *       mandates DialogShell for all modals, and App's global Escape handler
 *       (useModalState.closeTopModal) knows nothing about showCombatPanel.
 *
 * Contract:
 *   - opening the FAB menu moves focus to its first menuitem (so ArrowDown /
 *     Escape reach the menu's keydown handler);
 *   - the combat slide-out exposes role="dialog" + aria-modal="true" and closes
 *     on Escape.
 */

import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react';

vi.mock('../../services/campaignService', () => ({
    campaignService: {
        setSessionStartedAt: () => {},
        updateEncounter: () => {},
        startEncounter: () => {},
        endEncounter: () => {},
        appendSessionNote: () => {},
        setActiveScene: () => {},
        advanceScene: () => {},
        updateSessionLog: () => {},
        setPlotSessionStatus: () => {},
        subscribe: () => () => {},
        getState: () => ({ campaigns: [], activeCampaignId: null, appStatus: 'editing', saveStatus: 'idle', lastSavedAt: null }),
    },
}));

import { ToastProvider } from '../../hooks/useToast';
import { ConfirmDialogProvider } from '../../hooks/useConfirmDialog';
import { SessionRunner } from '../../components/views/SessionRunner';
import { createDefaultScene, createDefaultSession } from '../../utils/entityUtils';
import type { Campaign, SessionLog } from '../../types/index';

afterEach(cleanup);

const scene = {
    ...createDefaultScene(),
    id: 'scene-1',
    title: 'The Drowned Gate',
    type: 'combat',
    description: 'Water pours through the portcullis.',
    npcIds: ['npc-1'],
};

const campaign = {
    id: 'camp-1',
    title: 'Test Campaign',
    setting: 'A world',
    settingType: 'custom',
    dmStyle: 'power',
    featureOverrides: { 'combat-tracker': true, 'secrets-tracker': true },
    npcs: [{ id: 'npc-1', name: 'Aldric', stats: 'HP: 12', traits: 'gruff', relationships: [] }],
    locations: [],
    factions: [],
    items: [],
    adventures: [{ id: 'adv-1', title: 'The Sunken Vault', scenes: [scene] }],
    articles: [],
    sessionLogs: [],
    playerCharacters: [],
    plots: [],
    notes: [],
    secrets: [],
    activeSceneId: 'scene-1',
    activeEncounter: {
        id: 'enc-1',
        name: 'Gate Fight',
        round: 1,
        activeCombatantIndex: 0,
        combatants: [
            { id: 'c-1', name: 'Aldric', type: 'npc', initiative: 12, hp: 12, maxHp: 12, notes: '' },
        ],
    },
} as unknown as Campaign;

const sessionLog = {
    ...createDefaultSession(),
    id: 'log-1',
    title: 'Session 1',
    date: new Date().toISOString(),
    adventureId: 'adv-1',
    plannedSceneIds: ['scene-1'],
    structuredNotes: [],
    relatedPlotIds: [],
    encounterLog: [],
    summary: '',
    startedAt: new Date().toISOString(),
} as unknown as SessionLog;

function renderRunner() {
    return render(
        <ToastProvider>
        <ConfirmDialogProvider>
        <SessionRunner
            campaign={campaign}
            sessionLog={sessionLog}
            isMockMode={true}
            onEndSession={() => {}}
            onOpenCoach={() => {}}
        />
        </ConfirmDialogProvider>
        </ToastProvider>
    );
}

const openFabMenu = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Quick tools' }));
    // Header's equivalent focuses on the next animation frame.
    await act(async () => { await new Promise(r => setTimeout(r, 20)); });
};

describe('wp-e-app-shell #57 — the SessionRunner FAB menu is keyboard operable', () => {
    it('moves focus into the menu when it opens', async () => {
        renderRunner();
        await openFabMenu();

        const menu = screen.getByRole('menu', { name: 'Quick tools' });
        const firstItem = menu.querySelector('[role="menuitem"]') as HTMLElement;
        expect(firstItem).toBeTruthy();
        // Compare identity via a cheap descriptor so a failure prints the focused
        // element's role rather than the whole document.
        expect(document.activeElement?.getAttribute('role') ?? 'none').toBe('menuitem');
        expect(document.activeElement === firstItem).toBe(true);
    });

    it('closes on Escape once opened (the handler is reachable)', async () => {
        renderRunner();
        await openFabMenu();

        fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape', bubbles: true });
        expect(screen.queryByRole('menu', { name: 'Quick tools' })).toBeNull();
    });
});

describe('wp-e-app-shell #56 — the Combat Tracker slide-out is a real dialog', () => {
    it('exposes role="dialog" + aria-modal and closes on Escape', async () => {
        renderRunner();
        await openFabMenu();

        fireEvent.click(screen.getByRole('menuitem', { name: /combat tracker/i }));

        const dialog = screen.getByRole('dialog');
        expect(dialog.getAttribute('aria-modal')).toBe('true');

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
