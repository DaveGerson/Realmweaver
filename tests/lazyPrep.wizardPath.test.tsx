// @vitest-environment jsdom
/**
 * SPEC — components/dialogs/SessionPrepWizard.tsx (Wave 1, lane R1: the lazy prep path)
 *
 * Source: docs/design/lazy-dm-lens.md §4 R1 and §2 steps 2–3. Shea's method preps a
 * session in four moves — a strong start, a loose list of scenes, a glance at the
 * secrets, then go. Realmweaver already ships the third and fourth of those
 * (`SessionLog.beats`, the Secrets & Clues Tracker) but the prep wizard surfaces
 * neither, so a DM who wants to outline five loose beats before the table sits down
 * has to open the LIVE Session Runner to do it.
 *
 * THE CONTRACT
 *
 * 1. THE PATH IS A MODIFIER, NOT A FORK.
 *    The first step gains one toggle, sitting alongside the existing "No adventure
 *    (freeform session)" choice and the adventure cards. Its accessible name says
 *    "lazy"; it carries its state in `aria-pressed`, and it is OFF on mount, so a
 *    wizard nobody touches behaves exactly as it always has.
 *    It COMPOSES with the adventure choice rather than replacing it — an adventure
 *    picked before or after the toggle stays picked, its planned scenes stay
 *    auto-selected, and its scene-linked cast stays auto-gathered. That is what
 *    gives the Secrets Check step (lazyPrep.secretsCheck.test.tsx) a real roster to
 *    filter against; a freeform lazy session simply has an empty one.
 *
 * 2. ON, THE STEP ORDER IS EXACTLY:
 *       Adventure → Strong Start → Beats → Secrets Check → Go Live
 *    Scenes, NPCs & Locations and Plot Threads are not in the lazy flow. Turning the
 *    toggle back off restores the standard order (five steps with an adventure,
 *    three without) with the adventure selection intact.
 *
 * 3. STRONG START — one textarea, plain copy, no field name shown, per
 *    docs/design/schema-presentation-guide.md §6/§7. Its accessible name IS the
 *    invitation: "Write the first thing you'll say when the session starts". It is
 *    the only text field on its step, it is optional, and what is typed survives
 *    stepping away and back.
 *
 * 4. BEATS — add, edit and remove beat titles at prep time. The add field is named
 *    "Add a beat" and commits on Enter or on the "Add beat" button; each beat is an
 *    editable textbox named "Beat 1", "Beat 2", … in order, with a "Remove beat N"
 *    button beside it. A blank or whitespace-only title never becomes a beat, and a
 *    successful add clears the field so a second click cannot duplicate it.
 *
 * 5. GO LIVE — zero new schema. The wizard already mints the SessionLog, so:
 *      - `prepNotes` is the strong start encoded as a leading delimited section of
 *        the prep notes (see tests/helpers/strongStartFormat.ts). No strong start
 *        means no markers at all.
 *      - `beats` is a real `Beat[]` attached to the created log — the same array the
 *        Session Runner's SceneListPanel already renders and checks off — with
 *        trimmed titles, unique ids and `isCompleted: false`. Blank titles are dropped.
 *      - Everything the standard path already persisted (adventureId,
 *        plannedSceneIds, plannedNpcIds, plannedLocationIds, relatedPlotIds) is
 *        unchanged.
 *      - With the lazy path OFF, neither output ships: `beats` is `[]` and
 *        `prepNotes` carries no markers, even if the fields were filled in earlier.
 *      - Go Live is idempotent: clicking it twice creates one session, not two.
 *
 * 6. The review step keeps its Session Title and Prep Notes fields. Both gain a real
 *    accessible name (they have bare, unassociated <label>s today). The Prep Notes
 *    textarea shows ONLY the notes — the strong start is merged in at Go Live, never
 *    echoed back into the field the DM is typing other notes into.
 *
 * 7. Empty campaign, no adventures, no plots, no secrets: the lazy path still runs
 *    end to end and Go Live still produces a session.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';
import type { Campaign, SessionLog, Beat } from '../types/index';
import { composeStrongStartPrepNotes, STRONG_START_OPEN, STRONG_START_CLOSE } from './helpers/strongStartFormat';

const h = vi.hoisted(() => ({
    createSessionLog: vi.fn((_newLogData: Omit<SessionLog, 'id'>) => 'sess-new'),
    goLive: vi.fn(),
}));

vi.mock('../services/campaignService', () => ({
    campaignService: {
        createSessionLog: h.createSessionLog,
        goLive: h.goLive,
    },
}));

import { SessionPrepWizard } from '../components/dialogs/SessionPrepWizard';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const scene = {
    id: 'scene-1',
    title: 'The Ashen Gate',
    type: 'social',
    status: 'planned',
    readAloudText: '',
    gmNotes: '',
    skillChecks: [],
    rewards: '',
    locationId: 'loc-auto',
    npcIds: ['npc-auto'],
};

const campaign = {
    id: 'c1',
    title: 'Ashfall',
    settingType: 'custom',
    setting: 'A dying empire',
    articles: [],
    adventures: [{ id: 'adv-1', title: 'The Ashen Vault', hook: '', theme: '', scenes: [scene] }],
    npcs: [{ id: 'npc-auto', name: 'Auto Linked Npc', description: '' }],
    locations: [{ id: 'loc-auto', name: 'Auto Linked Location', description: '' }],
    factions: [],
    items: [],
    sessionLogs: [],
    playerCharacters: [],
    plots: [{ id: 'plot-1', title: 'The Cinder Crown', description: '', status: 'active', relatedEntityIds: [] }],
    notes: [],
    secrets: [
        {
            id: 'sec-1',
            title: 'The steward is an ashling',
            content: 'He burns cold.',
            category: 'secret',
            isRevealed: false,
            linkedEntityIds: ['npc-auto'],
            createdAt: '2026-01-01T00:00:00.000Z',
        },
    ],
} as unknown as Campaign;

const emptyCampaign = {
    id: 'c-empty',
    title: 'Blank Slate',
    settingType: 'custom',
    setting: '',
    articles: [],
    adventures: [],
    npcs: [],
    locations: [],
    factions: [],
    items: [],
    sessionLogs: [],
    playerCharacters: [],
    plots: [],
    notes: [],
} as unknown as Campaign;

// ── Helpers ───────────────────────────────────────────────────────────────────

const nav = () => screen.getByRole('navigation', { name: /wizard steps/i });

/** Ordered step labels as shown in the indicator, with the sr-only position suffix stripped. */
const stepLabels = (): string[] =>
    within(nav())
        .getAllByRole('button')
        .map(b => (b.textContent ?? '').replace(/,\s*Step \d+ of \d+/i, '').trim());

const gotoStep = (label: RegExp) => fireEvent.click(within(nav()).getByRole('button', { name: label }));

const lazyToggle = () => screen.getByRole('button', { name: /lazy/i });

const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

// No jest-dom in this repo (there is no vitest setup file) — plain DOM reads instead.
const pressed = (el: HTMLElement): string | null => el.getAttribute('aria-pressed');
const valueOf = (el: HTMLElement): string => (el as HTMLInputElement | HTMLTextAreaElement).value;

/** Advances to the review step and presses the footer Go Live button. */
const pressGoLive = () => {
    gotoStep(/^Go Live/);
    // Once "Go Live" is the current step its indicator button gains a ", Step N of M"
    // suffix, so the anchored name matches the footer button alone.
    fireEvent.click(screen.getByRole('button', { name: /^Go Live$/ }));
};

const payload = () => h.createSessionLog.mock.calls[0][0] as unknown as Omit<SessionLog, 'id'>;

beforeEach(() => {
    h.createSessionLog.mockClear();
    h.goLive.mockClear();
});

afterEach(cleanup);

// ── 1. The toggle ─────────────────────────────────────────────────────────────

describe('SessionPrepWizard — the lazy prep path is offered alongside the existing choices', () => {
    it('offers a lazy toggle on the first step, off by default, leaving the standard flow untouched', () => {
        render(<SessionPrepWizard campaign={campaign} onComplete={() => {}} onClose={() => {}} />);

        const toggle = lazyToggle();
        expect(pressed(toggle)).toBe('false');

        // Untouched wizard = today's adventure-free flow.
        expect(stepLabels()).toEqual(['Adventure', 'Plot Threads', 'Go Live']);
    });

    it('rewrites the step order to Strong Start → Beats → Secrets Check → Go Live when turned on', () => {
        render(<SessionPrepWizard campaign={campaign} onComplete={() => {}} onClose={() => {}} />);

        fireEvent.click(lazyToggle());

        expect(pressed(lazyToggle())).toBe('true');
        expect(stepLabels()).toEqual(['Adventure', 'Strong Start', 'Beats', 'Secrets Check', 'Go Live']);
        expect(stepLabels()).not.toContain('Scenes');
        expect(stepLabels()).not.toContain('NPCs & Locations');
        expect(stepLabels()).not.toContain('Plot Threads');
    });

    it('composes with an adventure instead of replacing it — order and selection both hold', () => {
        render(<SessionPrepWizard campaign={campaign} onComplete={() => {}} onClose={() => {}} />);

        fireEvent.click(screen.getByRole('button', { name: /The Ashen Vault/ }));
        fireEvent.click(lazyToggle());

        expect(stepLabels()).toEqual(['Adventure', 'Strong Start', 'Beats', 'Secrets Check', 'Go Live']);

        pressGoLive();

        expect(h.createSessionLog).toHaveBeenCalledTimes(1);
        // The adventure and its auto-selected scene / auto-gathered cast survive the lazy path.
        expect(payload().adventureId).toBe('adv-1');
        expect(payload().plannedSceneIds).toEqual(['scene-1']);
        expect(payload().plannedNpcIds).toEqual(['npc-auto']);
        expect(payload().plannedLocationIds).toEqual(['loc-auto']);
    });

    it('restores the standard step order when turned back off, keeping the adventure', () => {
        render(<SessionPrepWizard campaign={campaign} onComplete={() => {}} onClose={() => {}} />);

        fireEvent.click(screen.getByRole('button', { name: /The Ashen Vault/ }));
        fireEvent.click(lazyToggle());
        fireEvent.click(lazyToggle());

        expect(pressed(lazyToggle())).toBe('false');
        expect(stepLabels()).toEqual(['Adventure', 'Scenes', 'NPCs & Locations', 'Plot Threads', 'Go Live']);
    });

    it('restores the adventure-free order when turned off with no adventure chosen', () => {
        render(<SessionPrepWizard campaign={campaign} onComplete={() => {}} onClose={() => {}} />);

        fireEvent.click(lazyToggle());
        fireEvent.click(screen.getByRole('button', { name: /No adventure/i }));
        fireEvent.click(lazyToggle());

        expect(stepLabels()).toEqual(['Adventure', 'Plot Threads', 'Go Live']);
    });
});

// ── 2. Strong Start ───────────────────────────────────────────────────────────

describe('SessionPrepWizard — the Strong Start step', () => {
    const openStrongStart = () => {
        render(<SessionPrepWizard campaign={campaign} onComplete={() => {}} onClose={() => {}} />);
        fireEvent.click(lazyToggle());
        gotoStep(/^Strong Start/);
    };

    const strongStartField = () =>
        screen.getByRole('textbox', { name: /first thing you['’]ll say when the session starts/i });

    it('is a single field whose label is the invitation, not the field name', () => {
        openStrongStart();

        const field = strongStartField();
        expect(field.tagName).toBe('TEXTAREA');

        // Exactly one text field on this step — a strong start is one thing to write.
        expect(screen.getAllByRole('textbox')).toHaveLength(1);

        // The machinery is never shown to the DM.
        expect(document.body.textContent).not.toContain(STRONG_START_OPEN);
        expect(document.body.textContent).not.toMatch(/prepNotes|strongStart/);
    });

    it('keeps what was typed when the DM steps away and comes back', () => {
        openStrongStart();

        type(strongStartField(), 'The bell in the drowned chapel starts ringing by itself.');
        gotoStep(/^Beats/);
        gotoStep(/^Strong Start/);

        expect(valueOf(strongStartField())).toBe('The bell in the drowned chapel starts ringing by itself.');
    });
});

// ── 3. Beats ──────────────────────────────────────────────────────────────────

describe('SessionPrepWizard — the Beats step', () => {
    const openBeats = () => {
        render(<SessionPrepWizard campaign={campaign} onComplete={() => {}} onClose={() => {}} />);
        fireEvent.click(lazyToggle());
        gotoStep(/^Beats/);
    };

    const addField = () => screen.getByRole('textbox', { name: /add a beat/i });
    const addButton = () => screen.getByRole('button', { name: /^Add beat$/i });
    const beatField = (n: number) => screen.getByRole('textbox', { name: new RegExp(`^Beat ${n}$`) });
    const beatFields = () => screen.queryAllByRole('textbox', { name: /^Beat \d+$/ });

    const addBeat = (title: string) => {
        type(addField(), title);
        fireEvent.click(addButton());
    };

    it('starts empty and adds a beat from the field', () => {
        openBeats();

        expect(beatFields()).toHaveLength(0);

        addBeat('Ambush at the ford');

        expect(beatFields()).toHaveLength(1);
        expect(valueOf(beatField(1))).toBe('Ambush at the ford');
        // A successful add clears the field, so a second press cannot duplicate it.
        expect(valueOf(addField())).toBe('');
        fireEvent.click(addButton());
        expect(beatFields()).toHaveLength(1);
    });

    it('adds on Enter as well', () => {
        openBeats();

        type(addField(), 'The steward asks for a private word');
        fireEvent.keyDown(addField(), { key: 'Enter' });

        expect(beatFields()).toHaveLength(1);
        expect(valueOf(beatField(1))).toBe('The steward asks for a private word');
    });

    it('never creates a beat from a blank or whitespace-only title', () => {
        openBeats();

        fireEvent.click(addButton());
        addBeat('   ');
        type(addField(), '   ');
        fireEvent.keyDown(addField(), { key: 'Enter' });

        expect(beatFields()).toHaveLength(0);
    });

    it('edits a beat title in place', () => {
        openBeats();

        addBeat('Ambush at the fork');
        type(beatField(1), 'Ambush at the ford');

        expect(valueOf(beatField(1))).toBe('Ambush at the ford');
    });

    it('removes a beat and renumbers the rest', () => {
        openBeats();

        addBeat('One');
        addBeat('Two');
        addBeat('Three');
        expect(beatFields()).toHaveLength(3);

        fireEvent.click(screen.getByRole('button', { name: /^Remove beat 2$/ }));

        expect(beatFields()).toHaveLength(2);
        expect(valueOf(beatField(1))).toBe('One');
        expect(valueOf(beatField(2))).toBe('Three');
    });

    it('keeps the beats when the DM steps away and comes back', () => {
        openBeats();

        addBeat('Ambush at the ford');
        gotoStep(/^Strong Start/);
        gotoStep(/^Beats/);

        expect(beatFields()).toHaveLength(1);
        expect(valueOf(beatField(1))).toBe('Ambush at the ford');
    });
});

// ── 4. Go Live ────────────────────────────────────────────────────────────────

describe('SessionPrepWizard — what the lazy path persists at Go Live', () => {
    const prep = (opts: { strongStart?: string; beats?: string[]; notes?: string; adventure?: boolean }) => {
        render(<SessionPrepWizard campaign={campaign} onComplete={() => {}} onClose={() => {}} />);
        if (opts.adventure) fireEvent.click(screen.getByRole('button', { name: /The Ashen Vault/ }));
        fireEvent.click(lazyToggle());

        if (opts.strongStart !== undefined) {
            gotoStep(/^Strong Start/);
            type(
                screen.getByRole('textbox', { name: /first thing you['’]ll say when the session starts/i }),
                opts.strongStart
            );
        }
        if (opts.beats?.length) {
            gotoStep(/^Beats/);
            for (const title of opts.beats) {
                type(screen.getByRole('textbox', { name: /add a beat/i }), title);
                fireEvent.click(screen.getByRole('button', { name: /^Add beat$/i }));
            }
        }
        if (opts.notes !== undefined) {
            gotoStep(/^Go Live/);
            type(screen.getByRole('textbox', { name: /prep notes/i }), opts.notes);
        }
    };

    it('folds the strong start into prepNotes as a leading delimited section', () => {
        prep({ strongStart: 'The bell in the drowned chapel starts ringing by itself.', notes: 'Scottish accent for Angus.' });
        pressGoLive();

        expect(h.createSessionLog).toHaveBeenCalledTimes(1);
        expect(payload().prepNotes).toBe(
            composeStrongStartPrepNotes(
                'The bell in the drowned chapel starts ringing by itself.',
                'Scottish accent for Angus.'
            )
        );
        // Stated concretely, so the encoding cannot drift without this failing.
        expect(payload().prepNotes).toBe(
            [
                STRONG_START_OPEN,
                'The bell in the drowned chapel starts ringing by itself.',
                STRONG_START_CLOSE,
                '',
                'Scottish accent for Angus.',
            ].join('\n')
        );
    });

    it('writes a bare delimited block when there are no other prep notes', () => {
        prep({ strongStart: 'The bell starts ringing by itself.' });
        pressGoLive();

        expect(payload().prepNotes).toBe(
            `${STRONG_START_OPEN}\nThe bell starts ringing by itself.\n${STRONG_START_CLOSE}`
        );
    });

    it('writes no markers at all when the strong start is left empty', () => {
        prep({ strongStart: '   ', notes: 'Scottish accent for Angus.' });
        pressGoLive();

        expect(payload().prepNotes).toBe('Scottish accent for Angus.');
        expect(payload().prepNotes).not.toContain(STRONG_START_OPEN);
        expect(payload().prepNotes).not.toContain(STRONG_START_CLOSE);
    });

    it('preserves the line breaks inside a multi-line strong start', () => {
        prep({ strongStart: 'The bell rings.\n\nNobody is in the chapel.' });
        pressGoLive();

        expect(payload().prepNotes).toBe(
            `${STRONG_START_OPEN}\nThe bell rings.\n\nNobody is in the chapel.\n${STRONG_START_CLOSE}`
        );
    });

    it('attaches the prepped beats to the created session log', () => {
        prep({ beats: ['Ambush at the ford', 'The steward asks for a private word'] });
        pressGoLive();

        const beats = payload().beats as Beat[];
        expect(beats).toHaveLength(2);
        expect(beats.map(b => b.title)).toEqual(['Ambush at the ford', 'The steward asks for a private word']);
        expect(beats.every(b => b.isCompleted === false)).toBe(true);
        expect(beats.every(b => typeof b.id === 'string' && b.id.length > 0)).toBe(true);
        expect(new Set(beats.map(b => b.id)).size).toBe(2);
    });

    it('trims beat titles and drops any that are edited down to nothing', () => {
        prep({ beats: ['  Ambush at the ford  ', 'Doomed'] });
        // Edit the second beat down to whitespace — it must not survive Go Live.
        type(screen.getByRole('textbox', { name: /^Beat 2$/ }), '   ');
        pressGoLive();

        const beats = payload().beats as Beat[];
        expect(beats.map(b => b.title)).toEqual(['Ambush at the ford']);
    });

    it('ships neither the strong start nor the beats when the lazy path is switched back off', () => {
        prep({ strongStart: 'The bell starts ringing.', beats: ['Ambush at the ford'], notes: 'Angus is Scottish.' });
        gotoStep(/^Adventure/);
        fireEvent.click(lazyToggle());
        pressGoLive();

        expect(payload().prepNotes).toBe('Angus is Scottish.');
        expect(payload().beats ?? []).toEqual([]);
    });

    it('creates exactly one session log when Go Live is clicked twice', () => {
        const onComplete = vi.fn();
        render(<SessionPrepWizard campaign={campaign} onComplete={onComplete} onClose={() => {}} />);
        fireEvent.click(lazyToggle());
        gotoStep(/^Go Live/);

        const button = screen.getByRole('button', { name: /^Go Live$/ });
        fireEvent.click(button);
        fireEvent.click(button);

        expect(h.createSessionLog).toHaveBeenCalledTimes(1);
        expect(h.goLive).toHaveBeenCalledTimes(1);
        expect(h.goLive).toHaveBeenCalledWith('sess-new');
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(onComplete).toHaveBeenCalledWith('sess-new');
    });
});

// ── 5. The review step and the empty campaign ─────────────────────────────────

describe('SessionPrepWizard — the lazy path reaches the same Go Live step', () => {
    it('keeps the session title and prep notes fields, and never echoes the strong start into them', () => {
        render(<SessionPrepWizard campaign={campaign} onComplete={() => {}} onClose={() => {}} />);
        fireEvent.click(lazyToggle());

        gotoStep(/^Strong Start/);
        type(
            screen.getByRole('textbox', { name: /first thing you['’]ll say when the session starts/i }),
            'The bell starts ringing.'
        );

        gotoStep(/^Go Live/);
        const title = screen.getByRole('textbox', { name: /session title/i });
        const notes = screen.getByRole('textbox', { name: /prep notes/i });

        expect(valueOf(title)).toBe('');
        expect(valueOf(notes)).toBe('');
        expect(document.body.textContent).not.toContain(STRONG_START_OPEN);
    });

    it('runs end to end on a campaign with nothing in it', () => {
        render(<SessionPrepWizard campaign={emptyCampaign} onComplete={() => {}} onClose={() => {}} />);

        fireEvent.click(lazyToggle());
        expect(stepLabels()).toEqual(['Adventure', 'Strong Start', 'Beats', 'Secrets Check', 'Go Live']);

        gotoStep(/^Strong Start/);
        type(
            screen.getByRole('textbox', { name: /first thing you['’]ll say when the session starts/i }),
            'You wake up in a cell.'
        );
        gotoStep(/^Beats/);
        type(screen.getByRole('textbox', { name: /add a beat/i }), 'Escape');
        fireEvent.click(screen.getByRole('button', { name: /^Add beat$/i }));
        gotoStep(/^Secrets Check/);
        pressGoLive();

        expect(h.createSessionLog).toHaveBeenCalledTimes(1);
        expect(payload().adventureId).toBeUndefined();
        expect(payload().plannedSceneIds).toEqual([]);
        expect((payload().beats as Beat[]).map(b => b.title)).toEqual(['Escape']);
        expect(payload().prepNotes).toBe(
            `${STRONG_START_OPEN}\nYou wake up in a cell.\n${STRONG_START_CLOSE}`
        );
    });
});
