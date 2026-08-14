// @vitest-environment jsdom
/**
 * wp-e-app-shell — finding #60
 *
 * SaveStatus is 'idle' | 'saved' | 'saving' | 'error' | 'quota-warning'
 * (services/campaignService.ts). persistToStorage sets 'quota-warning' when the
 * localStorage quota was exceeded and the write only succeeded via the
 * IndexedDB fallback. Header's indicator renders branches for 'saving',
 * 'saved' and 'error' only — 'quota-warning' renders NOTHING, so the one
 * condition that most warrants a warning is the one with no UI: every save
 * flips "Saving..." to an empty gap and the GM cannot tell whether the
 * campaign is still being persisted.
 *
 * Contract: the save indicator must render a visible, distinct status for
 * 'quota-warning' (e.g. amber "Saved (fallback storage)") — not a blank, and
 * not indistinguishable from the plain 'saved' state.
 */

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { Header } from '../../components/layout/Header';
import type { Campaign } from '../../types/index';
import type { SaveStatus } from '../../services/campaignService';

afterEach(cleanup);

const campaign = {
    id: 'camp-1',
    title: 'Test Campaign',
    setting: 'A world',
    settingType: 'custom',
    npcs: [], locations: [], factions: [], items: [], adventures: [],
    articles: [], sessionLogs: [], playerCharacters: [], plots: [], notes: [], secrets: [],
} as unknown as Campaign;

const noop = () => {};

function renderHeader(saveStatus: SaveStatus) {
    const { container } = render(
        <Header
            activeCampaign={campaign}
            isMockMode={true}
            onToggleMockMode={noop}
            onToggleCoach={noop}
            onToggleWizard={noop}
            onToggleWorldSim={noop}
            onToggleContinuityChecker={noop}
            onSaveCampaign={noop}
            onSwitchCampaign={noop}
            onCreateNew={noop}
            onImportCampaign={noop}
            onShowExportModal={noop}
            saveStatus={saveStatus}
            lastSavedAt={new Date().toISOString()}
        />
    );
    // The auto-save indicator block is the element whose tooltip starts with "Force save".
    const indicator = container.querySelector('[title^="Force save"]');
    return { indicator, container };
}

describe('wp-e-app-shell #60 — the save indicator has a quota-warning state', () => {
    it('renders a visible status when the write fell back to IndexedDB', () => {
        const { indicator } = renderHeader('quota-warning');
        expect(indicator).not.toBeNull();
        expect((indicator!.textContent ?? '').trim()).not.toBe('');
    });

    it('distinguishes the fallback state from an ordinary successful save', () => {
        const { indicator: warning } = renderHeader('quota-warning');
        const warningText = (warning!.textContent ?? '').trim();
        cleanup();
        const { indicator: saved } = renderHeader('saved');
        const savedText = (saved!.textContent ?? '').trim();

        expect(savedText).toMatch(/saved/i);
        expect(warningText).not.toBe(savedText);
    });

    it('keeps the existing saving/saved/error states intact', () => {
        renderHeader('saving');
        expect(screen.getByText(/saving/i)).toBeTruthy();
        cleanup();
        renderHeader('error');
        expect(screen.getByText(/save failed/i)).toBeTruthy();
    });
});
