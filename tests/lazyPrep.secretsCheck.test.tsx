// @vitest-environment jsdom
/**
 * SPEC — components/dialogs/SessionPrepWizard.tsx, the Secrets Check step
 * (Wave 1, lane R1).
 *
 * Source: docs/design/lazy-dm-lens.md §2 step 4 and §4 R1. Shea's step 4 is
 * "define secrets and clues"; Realmweaver already has the Secrets & Clues
 * Tracker, so the lazy prep path does not need to re-implement it. What it needs
 * is a GLANCE — the last thing you look at before the table sits down.
 *
 * THE CONTRACT
 *
 * 1. IT IS A LENS, NOT AN EDITOR. The step lists secrets and nothing else: no
 *    reveal, no edit, no delete, no create. Visiting it writes nothing to the
 *    store — not one campaignService call.
 *
 * 2. UNREVEALED ONLY. A secret already revealed to the party is spent; it never
 *    appears here, whatever it is linked to.
 *
 * 3. IT NARROWS TO TONIGHT'S ROSTER WHEN THERE IS ONE. The roster is the
 *    wizard's own curated cast and places — the same `activeNpcIds` /
 *    `activeLocationIds` sets the standard path persists as
 *    `plannedNpcIds` / `plannedLocationIds`, auto-gathered from the chosen
 *    adventure's selected scenes. A secret survives when its `linkedEntityIds`
 *    intersects that roster. A secret linked only elsewhere, or linked to
 *    nothing at all, is not in the room and is not shown.
 *
 * 4. WITH NO ROSTER, THE WHOLE DECK IS ON THE TABLE. A freeform lazy session —
 *    or an adventure whose scenes have no cast and no place — has an empty
 *    roster, and filtering by it would show a blank panel. Instead every
 *    unrevealed secret is listed: with nothing planned, anything is deployable.
 *
 * 5. NO SECRETS, NO CRASH. `campaign.secrets` is the one entity array that can
 *    legitimately be `undefined` on an older save (types/CLAUDE.md). That, and a
 *    campaign whose secrets are all revealed, both render a plain empty state.
 *
 * 6. No AI is involved at any point in this step.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';
import type { Campaign, SessionLog } from '../types/index';

const h = vi.hoisted(() => ({
    createSessionLog: vi.fn((_newLogData: Omit<SessionLog, 'id'>) => 'sess-new'),
    goLive: vi.fn(),
    createSecret: vi.fn(),
    updateSecret: vi.fn(),
    revealSecret: vi.fn(),
    deleteSecret: vi.fn(),
}));

vi.mock('../services/campaignService', () => ({
    campaignService: {
        createSessionLog: h.createSessionLog,
        goLive: h.goLive,
        createSecret: h.createSecret,
        updateSecret: h.updateSecret,
        revealSecret: h.revealSecret,
        deleteSecret: h.deleteSecret,
    },
}));

import { SessionPrepWizard } from '../components/dialogs/SessionPrepWizard';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const peopledScene = {
    id: 'scene-1',
    title: 'The Ashen Gate',
    type: 'social',
    status: 'planned',
    readAloudText: '',
    gmNotes: '',
    skillChecks: [],
    rewards: '',
    locationId: 'loc-here',
    npcIds: ['npc-here'],
};

const bareScene = {
    id: 'scene-2',
    title: 'Somewhere, Someday',
    type: 'social',
    status: 'planned',
    readAloudText: '',
    gmNotes: '',
    skillChecks: [],
    rewards: '',
    npcIds: [],
};

const SECRET_HERE_NPC = 'The steward is an ashling';
const SECRET_HERE_PLACE = 'The gate was built over a well';
const SECRET_ELSEWHERE = 'The duchess poisons her own wine';
const SECRET_UNLINKED = 'Someone is counting the days';
const SECRET_SPENT = 'The bell was cast from a stolen crown';

const secrets = [
    {
        id: 'sec-here-npc', title: SECRET_HERE_NPC, content: 'He burns cold.', category: 'secret',
        isRevealed: false, linkedEntityIds: ['npc-here'], createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
        id: 'sec-here-place', title: SECRET_HERE_PLACE, content: 'It still has water.', category: 'clue',
        isRevealed: false, linkedEntityIds: ['loc-here'], createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
        id: 'sec-elsewhere', title: SECRET_ELSEWHERE, content: 'A slow one.', category: 'rumor',
        isRevealed: false, linkedEntityIds: ['npc-far'], createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
        id: 'sec-unlinked', title: SECRET_UNLINKED, content: 'Chalk marks on the doors.', category: 'clue',
        isRevealed: false, createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
        id: 'sec-spent', title: SECRET_SPENT, content: 'They already know.', category: 'revelation',
        isRevealed: true, linkedEntityIds: ['npc-here', 'loc-here'], createdAt: '2026-01-01T00:00:00.000Z',
    },
];

const baseCampaign = {
    id: 'c1',
    title: 'Ashfall',
    settingType: 'custom',
    setting: 'A dying empire',
    articles: [],
    adventures: [
        { id: 'adv-peopled', title: 'The Ashen Vault', hook: '', theme: '', scenes: [peopledScene] },
        { id: 'adv-bare', title: 'The Empty Road', hook: '', theme: '', scenes: [bareScene] },
    ],
    npcs: [
        { id: 'npc-here', name: 'Steward Angus', description: '' },
        { id: 'npc-far', name: 'Duchess Vell', description: '' },
    ],
    locations: [{ id: 'loc-here', name: 'The Ashen Gate', description: '' }],
    factions: [],
    items: [],
    sessionLogs: [],
    playerCharacters: [],
    plots: [],
    notes: [],
    secrets,
} as unknown as Campaign;

const withSecrets = (next: unknown): Campaign =>
    ({ ...(baseCampaign as unknown as Record<string, unknown>), secrets: next }) as unknown as Campaign;

// ── Helpers ───────────────────────────────────────────────────────────────────

const nav = () => screen.getByRole('navigation', { name: /wizard steps/i });
const gotoStep = (label: RegExp) => fireEvent.click(within(nav()).getByRole('button', { name: label }));
const lazyToggle = () => screen.getByRole('button', { name: /lazy/i });

/** Renders the wizard, optionally picks an adventure, turns the lazy path on, opens Secrets Check. */
const openSecretsCheck = (campaign: Campaign, adventureName?: RegExp) => {
    render(<SessionPrepWizard campaign={campaign} onComplete={() => {}} onClose={() => {}} />);
    if (adventureName) fireEvent.click(screen.getByRole('button', { name: adventureName }));
    fireEvent.click(lazyToggle());
    gotoStep(/^Secrets Check/);
};

const mutators = () => [h.createSecret, h.updateSecret, h.revealSecret, h.deleteSecret, h.createSessionLog, h.goLive];

beforeEach(() => {
    mutators().forEach(m => m.mockClear());
});

afterEach(cleanup);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SessionPrepWizard — the Secrets Check step narrows to tonight', () => {
    it('shows the unrevealed secrets that concern tonight\'s cast and places', () => {
        openSecretsCheck(baseCampaign, /The Ashen Vault/);

        expect(screen.getByText(SECRET_HERE_NPC)).toBeTruthy();
        expect(screen.getByText(SECRET_HERE_PLACE)).toBeTruthy();
    });

    it('hides a secret that concerns only entities who are not in tonight\'s session', () => {
        openSecretsCheck(baseCampaign, /The Ashen Vault/);

        expect(screen.queryByText(SECRET_ELSEWHERE)).toBeNull();
    });

    it('hides a secret linked to nothing at all while there is a roster to compare against', () => {
        openSecretsCheck(baseCampaign, /The Ashen Vault/);

        expect(screen.queryByText(SECRET_UNLINKED)).toBeNull();
    });

    it('never shows a secret the party has already been told, however well linked', () => {
        openSecretsCheck(baseCampaign, /The Ashen Vault/);
        expect(screen.queryByText(SECRET_SPENT)).toBeNull();

        cleanup();

        openSecretsCheck(baseCampaign);
        expect(screen.queryByText(SECRET_SPENT)).toBeNull();
    });
});

describe('SessionPrepWizard — the Secrets Check step with no roster', () => {
    it('lists every unrevealed secret for a freeform lazy session', () => {
        openSecretsCheck(baseCampaign);

        expect(screen.getByText(SECRET_HERE_NPC)).toBeTruthy();
        expect(screen.getByText(SECRET_HERE_PLACE)).toBeTruthy();
        expect(screen.getByText(SECRET_ELSEWHERE)).toBeTruthy();
        expect(screen.getByText(SECRET_UNLINKED)).toBeTruthy();
    });

    it('lists every unrevealed secret when the chosen adventure has no cast and no place', () => {
        openSecretsCheck(baseCampaign, /The Empty Road/);

        expect(screen.getByText(SECRET_HERE_NPC)).toBeTruthy();
        expect(screen.getByText(SECRET_ELSEWHERE)).toBeTruthy();
        expect(screen.getByText(SECRET_UNLINKED)).toBeTruthy();
    });
});

describe('SessionPrepWizard — the Secrets Check step on a campaign with nothing to show', () => {
    it('renders an empty state when the campaign has no secrets array at all', () => {
        openSecretsCheck(withSecrets(undefined));

        expect(screen.getByText(/no secrets/i)).toBeTruthy();
    });

    it('renders an empty state when the campaign has an empty secrets array', () => {
        openSecretsCheck(withSecrets([]));

        expect(screen.getByText(/no secrets/i)).toBeTruthy();
    });

    it('renders an empty state when every secret has already been revealed', () => {
        openSecretsCheck(withSecrets(secrets.map(s => ({ ...s, isRevealed: true }))));

        expect(screen.getByText(/no secrets/i)).toBeTruthy();
        expect(screen.queryByText(SECRET_HERE_NPC)).toBeNull();
    });

    it('renders an empty state, not a crash, when nothing in the deck touches tonight', () => {
        const orphaned = secrets
            .filter(s => !s.isRevealed)
            .map(s => ({ ...s, linkedEntityIds: ['npc-far'] }));

        openSecretsCheck(withSecrets(orphaned), /The Ashen Vault/);

        expect(screen.getByText(/no secrets/i)).toBeTruthy();
    });
});

describe('SessionPrepWizard — the Secrets Check step is read-only', () => {
    it('offers no reveal, edit, delete or create control', () => {
        openSecretsCheck(baseCampaign, /The Ashen Vault/);

        expect(screen.queryByRole('button', { name: /reveal/i })).toBeNull();
        expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
        expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
        expect(screen.queryByRole('button', { name: /new secret|add secret/i })).toBeNull();
    });

    it('writes nothing to the store just by being looked at', () => {
        openSecretsCheck(baseCampaign, /The Ashen Vault/);

        expect(h.createSecret).not.toHaveBeenCalled();
        expect(h.updateSecret).not.toHaveBeenCalled();
        expect(h.revealSecret).not.toHaveBeenCalled();
        expect(h.deleteSecret).not.toHaveBeenCalled();
        expect(h.createSessionLog).not.toHaveBeenCalled();
        expect(h.goLive).not.toHaveBeenCalled();
    });
});
