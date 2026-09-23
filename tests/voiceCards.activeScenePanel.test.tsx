// @vitest-environment jsdom
/**
 * SPEC — NPC voice cards in the Session Runner (Wave 2, lane VOICE / P3).
 *
 * Source: docs/design/storyteller-first-design.md §P3 — voiceNotes "rendered at
 * the top of the NPC card in the Session Runner's active scene panel", and
 * "the NPC's card then shows their 3 most recent actual lines next to
 * `exampleQuote`".
 *
 * THE CONTRACT
 *
 * 1. THE VOICE LEADS THE CARD. When an NPC has `voiceNotes`, it renders inside
 *    their card ahead of traits, motivations, the example quote, and the
 *    relationship badges. Mid-scene the DM needs to know how she sounds before
 *    they need to know who she hates.
 *
 * 2. NO VOICE, NO CHROME. An NPC without `voiceNotes` — every NPC in every save
 *    written before this shipped — renders exactly as before: no label, no
 *    empty line, no crash.
 *
 * 3. THE LEDGER SITS WITH THE EXAMPLE QUOTE. Up to three logged lines render
 *    after `exampleQuote`, most recent first — the written-down voice and the
 *    heard voice side by side. Older lines are not shown, ordinary history rows
 *    are never mistaken for lines, and an NPC with an empty (or absent) history
 *    shows no quote chrome at all.
 *
 * 4. LOGGING A LINE IS ONE PRESS AND A TYPE. Each card carries a button named
 *    "Log a line for <NPC>". Pressing it opens a composer on that card — and
 *    only that card — whose input is named "Line spoken by <NPC>", with a
 *    "Save line for <NPC>" button. Saving appends to the NPC's history through
 *    `campaignService.updateNpc`, tagged to the live session.
 *
 * 5. IT READS THE STORE, NOT THE RENDER. The appended history is built from the
 *    NPC as the store holds it at press time, not from the `campaign` prop this
 *    panel rendered with. A line logged elsewhere between render and press
 *    survives.
 *
 * 6. NO EMPTY LINES, NO DOUBLE LINES. Save is disabled while the composer is
 *    blank, and pressing it anyway writes nothing. A successful save closes the
 *    composer and clears it, so a fumbled second press cannot log the line
 *    twice.
 *
 * 7. IT IS A CARD, NOT A DIALOG. Nothing about the scene panel's existing
 *    content — read-aloud text, GM notes, skill checks — changes, and the card
 *    uses no indigo.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';
import type { Campaign, NPC, Scene, HistoryEntry } from '../types/index';

const h = vi.hoisted(() => ({
    updateNpc: vi.fn(),
    addDiceRollToSession: vi.fn(),
    getActiveCampaign: vi.fn(),
}));

const storeState = { campaigns: [], activeCampaignId: null, saveStatus: 'idle', lastSavedAt: null, appStatus: 'editing' };
vi.mock('@/services/campaignService', () => ({
    campaignService: {
        subscribe: () => () => {},
        getState: () => storeState,
        getActiveCampaign: h.getActiveCampaign,
        updateNpc: h.updateNpc,
        addDiceRollToSession: h.addDiceRollToSession,
        isPinned: () => false,
    },
}));

const { ActiveScenePanel } = await import('../components/views/session/ActiveScenePanel');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SESSION_ID = 'sess-4';
const VOICE = "Clipped sentences, never uses contractions, calls everyone 'pet'.";
const EXAMPLE_QUOTE = 'The tide does not negotiate.';

const quoteRow = (line: string, id: string): HistoryEntry => ({
    id,
    summary: `Said: "${line}"`,
    referenceType: 'session',
    referenceId: SESSION_ID,
});

const plainRow = (summary: string, id: string): HistoryEntry => ({
    id,
    summary,
    referenceType: 'manual',
});

const makeNpc = (overrides: Partial<NPC> = {}): NPC =>
    ({
        id: 'npc-1',
        name: 'Serah Vantt',
        description: '',
        traits: 'Counts on her fingers when lying.',
        motivations: 'Keep the harbour open at any cost.',
        secrets: '',
        backstory: '',
        stats: '',
        exampleQuote: EXAMPLE_QUOTE,
        knowsPlayerHistory: [],
        relationships: [],
        history: [],
        ...overrides,
    }) as NPC;

const scene = {
    id: 'scene-1',
    title: 'The Harbour Office',
    type: 'social',
    status: 'active',
    readAloudText: 'Rain sheets off the awning.',
    gmNotes: 'Serah is stalling.',
    skillChecks: [],
    rewards: '',
    npcIds: ['npc-1'],
} as unknown as Scene;

const makeCampaign = (npcs: NPC[], activeSessionId: string | undefined = SESSION_ID): Campaign =>
    ({
        id: 'camp-1',
        title: 'Ashfall',
        npcs,
        locations: [],
        factions: [],
        items: [],
        adventures: [],
        articles: [],
        sessionLogs: [{ id: SESSION_ID, title: 'Session 4' }],
        playerCharacters: [],
        plots: [],
        notes: [],
        activeSessionId,
    }) as unknown as Campaign;

const renderPanel = (npcs: NPC[], activeSessionId: string | undefined = SESSION_ID) => {
    const campaign = makeCampaign(npcs, activeSessionId);
    h.getActiveCampaign.mockReturnValue(campaign);
    return render(
        <ActiveScenePanel
            activeScene={scene}
            activeSceneLocation={null}
            activeSceneNpcs={npcs}
            sceneNpcRelationshipMap={new Map()}
            castDynamicsSummary={null}
            campaign={campaign}
            previousSession={null}
            mobileTab="active"
            onAdvanceScene={() => {}}
        />
    );
};

/** The deepest element whose text contains `text` — for document-order checks. */
const nodeWith = (container: HTMLElement, text: string): HTMLElement => {
    const matches = Array.from(container.querySelectorAll<HTMLElement>('*'))
        .filter(el => (el.textContent ?? '').includes(text));
    expect(matches.length, `nothing rendered containing ${JSON.stringify(text)}`).toBeGreaterThan(0);
    return matches[matches.length - 1];
};

const isBefore = (container: HTMLElement, first: string, second: string): boolean => {
    const relation = nodeWith(container, first).compareDocumentPosition(nodeWith(container, second));
    return Boolean(relation & Node.DOCUMENT_POSITION_FOLLOWING);
};

const historyWrittenFor = (npcId: string): HistoryEntry[] => {
    const call = [...h.updateNpc.mock.calls].reverse().find(c => c[0] === npcId);
    expect(call, `no updateNpc write for ${npcId}`).toBeTruthy();
    return (call![1] as Partial<NPC>).history as HistoryEntry[];
};

beforeEach(() => {
    h.updateNpc.mockReset();
    h.addDiceRollToSession.mockReset();
    h.getActiveCampaign.mockReset();
});

afterEach(cleanup);

// ── 1 & 2. The voice leads the card ───────────────────────────────────────────

describe('ActiveScenePanel — the NPC card leads with the voice', () => {
    it('renders voiceNotes on the card', () => {
        const { container } = renderPanel([makeNpc({ voiceNotes: VOICE })]);

        expect(container.textContent).toContain(VOICE);
    });

    it.each([
        ['the personality traits', 'Counts on her fingers when lying.'],
        ['the motivations', 'Keep the harbour open at any cost.'],
        ['the example quote', EXAMPLE_QUOTE],
    ])('renders the voice above %s', (_label, later) => {
        const { container } = renderPanel([makeNpc({ voiceNotes: VOICE })]);

        expect(isBefore(container, VOICE, later)).toBe(true);
    });

    it('renders the voice below the NPC name — it is their card, not a heading', () => {
        const { container } = renderPanel([makeNpc({ voiceNotes: VOICE })]);

        expect(isBefore(container, 'Serah Vantt', VOICE)).toBe(true);
    });

    it('renders nothing extra for an NPC with no voiceNotes', () => {
        const { container } = renderPanel([makeNpc()]);

        expect(container.textContent).not.toMatch(/voice/i);
        expect(container.textContent).toContain('Counts on her fingers when lying.');
    });

    it.each([
        ['an empty string', ''],
        ['whitespace only', '   '],
    ])('renders no voice chrome when voiceNotes is %s', (_label, voiceNotes) => {
        const { container } = renderPanel([makeNpc({ voiceNotes })]);

        expect(container.textContent).not.toMatch(/voice/i);
    });
});

// ── 3. The ledger sits with the example quote ─────────────────────────────────

describe('ActiveScenePanel — the quote ledger on the card', () => {
    const fourLines = makeNpc({
        history: [
            quoteRow('Oldest line.', 'h1'),
            quoteRow('Third line.', 'h2'),
            quoteRow('Second line.', 'h3'),
            quoteRow('Newest line.', 'h4'),
        ],
    });

    it('shows the three most recent logged lines', () => {
        const { container } = renderPanel([fourLines]);

        expect(container.textContent).toContain('Newest line.');
        expect(container.textContent).toContain('Second line.');
        expect(container.textContent).toContain('Third line.');
    });

    it('does not show the fourth-oldest line', () => {
        const { container } = renderPanel([fourLines]);

        expect(container.textContent).not.toContain('Oldest line.');
    });

    it('shows them newest first', () => {
        const { container } = renderPanel([fourLines]);

        expect(isBefore(container, 'Newest line.', 'Second line.')).toBe(true);
        expect(isBefore(container, 'Second line.', 'Third line.')).toBe(true);
    });

    it('keeps the written example quote and puts the heard lines beside it', () => {
        const { container } = renderPanel([fourLines]);

        expect(container.textContent).toContain(EXAMPLE_QUOTE);
        expect(isBefore(container, EXAMPLE_QUOTE, 'Newest line.')).toBe(true);
    });

    it('puts the ledger below the voice notes', () => {
        const { container } = renderPanel([
            makeNpc({ voiceNotes: VOICE, history: [quoteRow('Newest line.', 'h1')] }),
        ]);

        expect(isBefore(container, VOICE, 'Newest line.')).toBe(true);
    });

    it('never mistakes an ordinary history row for a spoken line', () => {
        const { container } = renderPanel([
            makeNpc({
                history: [plainRow('Met the party at the docks', 'h1'), quoteRow('Only line.', 'h2')],
            }),
        ]);

        expect(container.textContent).not.toContain('Met the party at the docks');
        expect(container.textContent).toContain('Only line.');
    });

    it.each([
        ['an empty history', [] as HistoryEntry[]],
        ['only ordinary history rows', [plainRow('Met the party at the docks', 'h1')]],
    ])('renders no ledger chrome for an NPC with %s', (_label, history) => {
        const { container } = renderPanel([makeNpc({ history })]);

        // No stray empty quotation left behind by an unconditional render.
        expect(container.textContent).not.toContain('""');
        expect(container.textContent).toContain(EXAMPLE_QUOTE);
    });

    it('survives an old save whose NPC has no history array at all', () => {
        const legacy = { ...makeNpc(), history: undefined } as unknown as NPC;

        expect(() => renderPanel([legacy])).not.toThrow();
        expect(screen.getByText(/Serah Vantt/)).toBeTruthy();
    });
});

// ── 4–6. Logging a line ───────────────────────────────────────────────────────

describe('ActiveScenePanel — logging a line from the card', () => {
    const openComposer = (npcName = 'Serah Vantt') => {
        fireEvent.click(screen.getByRole('button', { name: new RegExp(`log a line for ${npcName}`, 'i') }));
        return screen.getByRole('textbox', { name: new RegExp(`line spoken by ${npcName}`, 'i') }) as HTMLTextAreaElement;
    };

    const saveButton = (npcName = 'Serah Vantt') =>
        screen.getByRole('button', { name: new RegExp(`save line for ${npcName}`, 'i') }) as HTMLButtonElement;

    it('offers a log action on every NPC card in the scene', () => {
        renderPanel([makeNpc(), makeNpc({ id: 'npc-2', name: 'Harl Dunn' })]);

        expect(screen.getByRole('button', { name: /log a line for Serah Vantt/i })).toBeTruthy();
        expect(screen.getByRole('button', { name: /log a line for Harl Dunn/i })).toBeTruthy();
    });

    it('opens a composer only on the card that was pressed', () => {
        renderPanel([makeNpc(), makeNpc({ id: 'npc-2', name: 'Harl Dunn' })]);
        openComposer('Serah Vantt');

        expect(screen.queryByRole('textbox', { name: /line spoken by Harl Dunn/i })).toBeNull();
    });

    it('appends the typed line to the NPC history through updateNpc', () => {
        renderPanel([makeNpc()]);
        const input = openComposer();

        fireEvent.change(input, { target: { value: 'The tide came in early, pet.' } });
        fireEvent.click(saveButton());

        const history = historyWrittenFor('npc-1');
        expect(history).toHaveLength(1);
        expect(history[0].summary).toBe('Said: "The tide came in early, pet."');
    });

    it('tags the logged line to the live session', () => {
        renderPanel([makeNpc()]);
        const input = openComposer();

        fireEvent.change(input, { target: { value: 'The tide came in early, pet.' } });
        fireEvent.click(saveButton());

        const row = historyWrittenFor('npc-1')[0];
        expect(row.referenceType).toBe('session');
        expect(row.referenceId).toBe(SESSION_ID);
    });

    it('logs against a manual reference when no session is live', () => {
        // FLAG (lane VOICE, minimal test fix): `renderPanel(npcs, undefined)`
        // cannot express "no session" — `activeSessionId` has a default
        // parameter of SESSION_ID, and JS applies a default parameter to an
        // explicitly-passed `undefined` exactly as it would to an omitted
        // argument, so this silently rendered WITH a live session instead of
        // without one. Building the no-session campaign inline sidesteps the
        // shared `renderPanel`/`makeCampaign` default-parameter footgun
        // without changing either helper (both are relied on elsewhere with
        // the SESSION_ID default intact).
        const npc = makeNpc();
        const campaign = { ...makeCampaign([npc]), activeSessionId: undefined };
        h.getActiveCampaign.mockReturnValue(campaign);
        render(
            <ActiveScenePanel
                activeScene={scene}
                activeSceneLocation={null}
                activeSceneNpcs={[npc]}
                sceneNpcRelationshipMap={new Map()}
                castDynamicsSummary={null}
                campaign={campaign}
                previousSession={null}
                mobileTab="active"
                onAdvanceScene={() => {}}
            />
        );
        const input = openComposer();

        fireEvent.change(input, { target: { value: 'The tide came in early, pet.' } });
        fireEvent.click(saveButton());

        const row = historyWrittenFor('npc-1')[0];
        expect(row.referenceType).toBe('manual');
        expect(row.referenceId).toBeUndefined();
    });

    it('keeps the lines the NPC already had', () => {
        renderPanel([makeNpc({ history: [quoteRow('An older line.', 'h1')] })]);
        const input = openComposer();

        fireEvent.change(input, { target: { value: 'A newer line.' } });
        fireEvent.click(saveButton());

        const history = historyWrittenFor('npc-1');
        expect(history).toHaveLength(2);
        expect(history[0].summary).toBe('Said: "An older line."');
        expect(history[1].summary).toBe('Said: "A newer line."');
    });

    // ── 5. Reads the store, not the render ────────────────────────────────────

    it('appends to the store\'s history, not to the campaign prop it rendered with', () => {
        renderPanel([makeNpc()]);

        // Another surface logs a line after this panel rendered.
        h.getActiveCampaign.mockReturnValue(
            makeCampaign([makeNpc({ history: [quoteRow('Logged from the coach.', 'h9')] })])
        );

        const input = openComposer();
        fireEvent.change(input, { target: { value: 'Logged from the card.' } });
        fireEvent.click(saveButton());

        const history = historyWrittenFor('npc-1');
        expect(history.map(r => r.summary)).toEqual([
            'Said: "Logged from the coach."',
            'Said: "Logged from the card."',
        ]);
    });

    // ── 6. No empty lines, no double lines ────────────────────────────────────

    it('disables save while the composer is blank', () => {
        renderPanel([makeNpc()]);
        openComposer();

        expect(saveButton().disabled).toBe(true);
    });

    it.each([
        ['blank', ''],
        ['whitespace only', '   '],
    ])('writes nothing when the composer is %s', (_label, value) => {
        renderPanel([makeNpc()]);
        const input = openComposer();

        fireEvent.change(input, { target: { value } });
        fireEvent.click(saveButton());

        expect(h.updateNpc).not.toHaveBeenCalled();
    });

    it('closes and clears the composer after a successful save', () => {
        renderPanel([makeNpc()]);
        const input = openComposer();

        fireEvent.change(input, { target: { value: 'The tide came in early, pet.' } });
        fireEvent.click(saveButton());

        expect(screen.queryByRole('textbox', { name: /line spoken by Serah Vantt/i })).toBeNull();

        // Reopening starts empty — the previous line is not sitting there to be re-sent.
        expect(openComposer().value).toBe('');
    });

    it('logs once per press, not once per render', () => {
        renderPanel([makeNpc()]);
        const input = openComposer();

        fireEvent.change(input, { target: { value: 'The tide came in early, pet.' } });
        fireEvent.click(saveButton());

        expect(h.updateNpc).toHaveBeenCalledTimes(1);
    });
});

// ── 7. Nothing else changed ───────────────────────────────────────────────────

describe('ActiveScenePanel — the rest of the panel is untouched', () => {
    it('still renders the read-aloud text and GM notes', () => {
        const { container } = renderPanel([makeNpc({ voiceNotes: VOICE })]);

        expect(container.textContent).toContain('Rain sheets off the awning.');
        expect(container.textContent).toContain('Serah is stalling.');
    });

    it('writes nothing to the store simply by rendering', () => {
        renderPanel([makeNpc({ voiceNotes: VOICE, history: [quoteRow('A line.', 'h1')] })]);

        expect(h.updateNpc).not.toHaveBeenCalled();
    });

    it('uses no indigo — that accent belongs to RealmChat', () => {
        const { container } = renderPanel([makeNpc({ voiceNotes: VOICE, history: [quoteRow('A line.', 'h1')] })]);

        expect(container.innerHTML).not.toContain('indigo');
    });
});
