// @vitest-environment jsdom
/**
 * wp-g2-wizards-coach — finding #76
 *
 * `DmCoach` renders a raw `<aside role="dialog" aria-modal="true">`
 * (DmCoach.tsx:290) and hand-rolls Escape with a *document*-level keydown
 * listener (lines 101-107) instead of using `DialogShell`, which CLAUDE.md
 * mandates for all modals. Because the listener is global, Escape pressed
 * anywhere on the page — including while dismissing an unrelated popover such
 * as the MentionInput autocomplete, or while the DM is typing in the session
 * runner behind the panel — tears down the whole coach panel along with its
 * in-progress roleplay transcript.
 *
 * Contract for the fix (wrap the panel in `DialogShell`, or otherwise scope the
 * listener to the panel; if the panel is intentionally non-modal, also drop
 * `aria-modal="true"`):
 *   1. Escape originating from OUTSIDE the coach panel must not close it.
 *   2. Escape from inside the panel still closes it.
 *   3. DialogShell additionally supplies the focus trap, focus restore and body
 *      scroll lock that `aria-modal="true"` currently promises but does not
 *      deliver (not asserted here — see the DmStylePanel test for that shape).
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { setupTestEnvironment } from '../helpers/testStoreFactory';
import type { Campaign } from '../../types/index';

setupTestEnvironment();

vi.mock('../../services/aiService', () => ({
    generateNarration: vi.fn(),
    generateImprovisation: vi.fn(),
    generateRollableTable: vi.fn(),
    generateNpcRoleplay: vi.fn(),
}));

vi.mock('../../services/contextBuilder', () => ({
    buildCampaignContext: vi.fn(() => 'CTX'),
}));

let DmCoach: typeof import('../../components/dialogs/DmCoach').DmCoach;

const campaign = {
    id: 'c1',
    title: 'Ashfall',
    settingType: 'custom',
    setting: 'A dying empire',
    articles: [], adventures: [], npcs: [], locations: [], factions: [], items: [],
    sessionLogs: [], playerCharacters: [], plots: [], notes: [],
} as unknown as Campaign;

beforeEach(async () => {
    if (!DmCoach) {
        DmCoach = (await import('../../components/dialogs/DmCoach')).DmCoach;
    }
});

afterEach(cleanup);

describe('DM Coach — Escape handling must be scoped to the panel (#76)', () => {
    it('does not close when Escape is pressed outside the panel', () => {
        const onClose = vi.fn();

        // A control that lives behind the coach panel, as in the Session Runner.
        const outside = document.createElement('button');
        outside.textContent = 'Session notes';
        document.body.appendChild(outside);

        render(<DmCoach campaign={campaign} onClose={onClose} isMockMode={true} />);

        fireEvent.keyDown(outside, { key: 'Escape' });

        expect(onClose).not.toHaveBeenCalled();

        outside.remove();
    });

    it('closes when Escape is pressed inside the panel', () => {
        const onClose = vi.fn();
        render(<DmCoach campaign={campaign} onClose={onClose} isMockMode={true} />);

        fireEvent.keyDown(screen.getByLabelText('DM Coach prompt'), { key: 'Escape' });

        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
