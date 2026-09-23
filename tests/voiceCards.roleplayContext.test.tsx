// @vitest-environment jsdom
/**
 * SPEC — voice-aware roleplay in the DM Coach (Wave 2, lane VOICE / P3).
 *
 * Source: docs/design/storyteller-first-design.md §P3 — "`generateNpcRoleplay`
 * ... then receives voiceNotes + recent ledger quotes — the AI stays in the
 * voice the *table has actually heard*, not the voice from the character sheet
 * written six months ago."
 *
 * WHERE THE ENRICHMENT LIVES. `generateNpcRoleplay`'s signature does not
 * change, and neither `services/aiService.ts` nor `services/ai/mockService.ts`
 * gains anything. The NPC brief handed to it is hand-built at the call site,
 * and that is the one thing this lane widens: `buildNpcRoleplayContext`,
 * exported from `components/dialogs/DmCoach.tsx`.
 *
 * THE CONTRACT
 *
 * 1. THE BRIEF STILL SAYS EVERYTHING IT SAID. Name, description, traits,
 *    motivations, secrets, example quote, faction, backstory — all still there,
 *    still omitted when empty.
 *
 * 2. THE BRIEF CARRIES THE VOICE. When the NPC has `voiceNotes`, the brief
 *    carries them under a label the model can act on, ahead of the backstory.
 *
 * 3. THE BRIEF CARRIES WHAT THE TABLE HAS HEARD. Up to three logged lines from
 *    the quote ledger, newest first, marked as lines actually spoken — distinct
 *    from the aspirational `exampleQuote`. Ordinary history rows are never
 *    smuggled in as dialogue.
 *
 * 4. ABSENCE IS SILENT. An NPC with no voice and no ledger produces the brief
 *    exactly as it was before this lane: no empty "Voice:" label, no header for
 *    an empty list of lines. Old saves must not teach the model that the
 *    character has nothing to say.
 *
 * 5. THE CALL SITE ACTUALLY USES IT. Sending a roleplay message passes the
 *    enriched brief as `generateNpcRoleplay`'s first argument, with the
 *    facade's argument list unchanged (npcContext, history, userMessage,
 *    isMockMode, campaignContext).
 *
 * 6. THE COACH CAN LOG A LINE. Every NPC reply carries a "Log this line"
 *    action that appends that reply to the NPC's ledger through
 *    `campaignService.updateNpc`, tagged to the live session. Once pressed, the
 *    action reports itself done and is disabled, so a reply cannot be logged
 *    twice by a fumbled second press. The DM's own messages carry no such
 *    action — the ledger records what the NPC said.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { setupTestEnvironment } from './helpers/testStoreFactory';
import type { Campaign, Faction, HistoryEntry, NPC } from '../types/index';

setupTestEnvironment();

const h = vi.hoisted(() => ({
    generateNarration: vi.fn(),
    generateImprovisation: vi.fn(),
    generateRollableTable: vi.fn(),
    generateNpcRoleplay: vi.fn(),
    updateNpc: vi.fn(),
    getActiveCampaign: vi.fn(),
}));

vi.mock('../services/aiService', () => ({
    generateNarration: h.generateNarration,
    generateImprovisation: h.generateImprovisation,
    generateRollableTable: h.generateRollableTable,
    generateNpcRoleplay: h.generateNpcRoleplay,
}));

vi.mock('../services/contextBuilder', () => ({
    buildCampaignContext: vi.fn(() => 'CTX'),
}));

const storeState = { campaigns: [], activeCampaignId: null, saveStatus: 'idle', lastSavedAt: null, appStatus: 'editing' };
vi.mock('@/services/campaignService', () => ({
    campaignService: {
        subscribe: () => () => {},
        getState: () => storeState,
        getActiveCampaign: h.getActiveCampaign,
        updateNpc: h.updateNpc,
        isPinned: () => false,
    },
}));

const { DmCoach, buildNpcRoleplayContext } = await import('../components/dialogs/DmCoach');

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
        description: 'Harbourmaster, salt-bleached coat.',
        traits: 'Counts on her fingers when lying.',
        motivations: 'Keep the harbour open at any cost.',
        secrets: 'She sank the Kestrel herself.',
        backstory: 'Twenty years on the water.',
        stats: '',
        exampleQuote: EXAMPLE_QUOTE,
        knowsPlayerHistory: [],
        relationships: [],
        history: [],
        ...overrides,
    }) as NPC;

const faction = { id: 'fac-1', name: 'The Harbour Guild' } as unknown as Faction;

const makeCampaign = (npc: NPC): Campaign =>
    ({
        id: 'camp-1',
        title: 'Ashfall',
        settingType: 'custom',
        setting: 'A dying empire',
        npcs: [npc],
        locations: [],
        factions: [faction],
        items: [],
        adventures: [],
        articles: [],
        sessionLogs: [{ id: SESSION_ID, title: 'Session 4' }],
        playerCharacters: [],
        plots: [],
        notes: [],
        activeSessionId: SESSION_ID,
    }) as unknown as Campaign;

// jsdom implements no layout, so the roleplay panel's auto-scroll would throw.
Element.prototype.scrollIntoView = function scrollIntoView() {};

beforeEach(() => {
    h.generateNpcRoleplay.mockReset();
    h.updateNpc.mockReset();
    h.getActiveCampaign.mockReset();
});

afterEach(cleanup);

// ── 1–4. The brief itself ─────────────────────────────────────────────────────

describe('buildNpcRoleplayContext — everything the brief always carried', () => {
    it('still names every populated field', () => {
        const ctx = buildNpcRoleplayContext(makeNpc({ factionId: 'fac-1' }), faction);

        expect(ctx).toContain('Serah Vantt');
        expect(ctx).toContain('Harbourmaster, salt-bleached coat.');
        expect(ctx).toContain('Counts on her fingers when lying.');
        expect(ctx).toContain('Keep the harbour open at any cost.');
        expect(ctx).toContain('She sank the Kestrel herself.');
        expect(ctx).toContain(EXAMPLE_QUOTE);
        expect(ctx).toContain('The Harbour Guild');
        expect(ctx).toContain('Twenty years on the water.');
    });

    it('omits the fields the NPC has not filled in', () => {
        const sparse = makeNpc({
            description: '', traits: '', motivations: '', secrets: '', exampleQuote: '', backstory: '',
        });

        const ctx = buildNpcRoleplayContext(sparse);

        expect(ctx).toContain('Serah Vantt');
        expect(ctx).not.toMatch(/Description:/);
        expect(ctx).not.toMatch(/Backstory:/);
        expect(ctx).not.toMatch(/Faction:/);
    });
});

describe('buildNpcRoleplayContext — the voice', () => {
    it('carries the voice notes', () => {
        const ctx = buildNpcRoleplayContext(makeNpc({ voiceNotes: VOICE }));

        expect(ctx).toContain(VOICE);
    });

    it('labels them as voice so the model knows what they are for', () => {
        const ctx = buildNpcRoleplayContext(makeNpc({ voiceNotes: VOICE }));

        expect(ctx).toMatch(/voice/i);
    });

    it('puts the voice ahead of the backstory — how they sound before what happened to them', () => {
        const ctx = buildNpcRoleplayContext(makeNpc({ voiceNotes: VOICE }));

        expect(ctx.indexOf(VOICE)).toBeLessThan(ctx.indexOf('Twenty years on the water.'));
    });

    it.each([
        ['absent', undefined],
        ['an empty string', ''],
        ['whitespace only', '   '],
    ])('says nothing about voice when voiceNotes is %s', (_label, voiceNotes) => {
        const ctx = buildNpcRoleplayContext(makeNpc({ voiceNotes }));

        expect(ctx).not.toMatch(/voice/i);
    });
});

describe('buildNpcRoleplayContext — what the table has actually heard', () => {
    const withLedger = makeNpc({
        history: [
            quoteRow('Oldest line.', 'h1'),
            quoteRow('Third line.', 'h2'),
            quoteRow('Second line.', 'h3'),
            quoteRow('Newest line.', 'h4'),
        ],
    });

    it('carries the three most recent logged lines', () => {
        const ctx = buildNpcRoleplayContext(withLedger);

        expect(ctx).toContain('Newest line.');
        expect(ctx).toContain('Second line.');
        expect(ctx).toContain('Third line.');
    });

    it('leaves out the older ones', () => {
        expect(buildNpcRoleplayContext(withLedger)).not.toContain('Oldest line.');
    });

    it('lists them newest first', () => {
        const ctx = buildNpcRoleplayContext(withLedger);

        expect(ctx.indexOf('Newest line.')).toBeLessThan(ctx.indexOf('Second line.'));
        expect(ctx.indexOf('Second line.')).toBeLessThan(ctx.indexOf('Third line.'));
    });

    it('marks them as lines actually spoken, distinct from the example quote', () => {
        const ctx = buildNpcRoleplayContext(withLedger);

        expect(ctx).toMatch(/spoken|said|heard/i);
        expect(ctx).toContain(EXAMPLE_QUOTE);
    });

    it('never smuggles an ordinary history row in as dialogue', () => {
        const ctx = buildNpcRoleplayContext(
            makeNpc({ history: [plainRow('Met the party at the docks', 'h1'), quoteRow('Only line.', 'h2')] })
        );

        expect(ctx).not.toContain('Met the party at the docks');
        expect(ctx).toContain('Only line.');
    });

    it.each([
        ['an empty history', [] as HistoryEntry[]],
        ['only ordinary history rows', [plainRow('Met the party at the docks', 'h1')]],
    ])('adds no ledger section for an NPC with %s', (_label, history) => {
        const bare = buildNpcRoleplayContext(makeNpc({ history: [] }));
        const ctx = buildNpcRoleplayContext(makeNpc({ history }));

        expect(ctx).toBe(bare);
    });

    it('survives an old save whose NPC has no history array at all', () => {
        const legacy = { ...makeNpc(), history: undefined } as unknown as NPC;

        expect(() => buildNpcRoleplayContext(legacy)).not.toThrow();
    });
});

// ── 5 & 6. The call site ──────────────────────────────────────────────────────

describe('DM Coach roleplay — the enriched brief reaches the model', () => {
    const NPC_REPLY = 'Tide is in, pet. Come back when it is not.';

    const renderCoach = (npc: NPC) => {
        const campaign = makeCampaign(npc);
        h.getActiveCampaign.mockReturnValue(campaign);
        return render(
            <DmCoach campaign={campaign} onClose={() => {}} isMockMode={true} />
        );
    };

    const openRoleplayWith = (npc: NPC) => {
        renderCoach(npc);
        fireEvent.click(screen.getByRole('button', { name: 'Roleplay' }));
        fireEvent.change(screen.getByLabelText(/select npc to roleplay/i), { target: { value: npc.id } });
    };

    const send = async (text: string) => {
        fireEvent.change(screen.getByLabelText('Roleplay message input'), { target: { value: text } });
        fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
        await waitFor(() => expect(h.generateNpcRoleplay).toHaveBeenCalled());
    };

    it('passes the voice and the recent lines as the npcContext', async () => {
        h.generateNpcRoleplay.mockResolvedValue({ dialogue: NPC_REPLY, moodCue: 'does not look up' });
        openRoleplayWith(makeNpc({ voiceNotes: VOICE, history: [quoteRow('A line from last week.', 'h1')] }));

        await send('Is the harbour open?');

        const npcContext = h.generateNpcRoleplay.mock.calls[0][0] as string;
        expect(npcContext).toContain(VOICE);
        expect(npcContext).toContain('A line from last week.');
    });

    it('leaves the facade signature alone', async () => {
        h.generateNpcRoleplay.mockResolvedValue({ dialogue: NPC_REPLY, moodCue: 'does not look up' });
        openRoleplayWith(makeNpc({ voiceNotes: VOICE }));

        await send('Is the harbour open?');

        const call = h.generateNpcRoleplay.mock.calls[0];
        expect(call).toHaveLength(5);
        expect(typeof call[0]).toBe('string');
        expect(Array.isArray(call[1])).toBe(true);
        expect(call[2]).toBe('Is the harbour open?');
        expect(call[3]).toBe(true);
        expect(typeof call[4]).toBe('string');
    });

    it('offers a log action on the NPC\'s reply', async () => {
        h.generateNpcRoleplay.mockResolvedValue({ dialogue: NPC_REPLY, moodCue: 'does not look up' });
        openRoleplayWith(makeNpc());

        await send('Is the harbour open?');
        await screen.findByText(NPC_REPLY);

        expect(screen.getAllByRole('button', { name: /log this line/i })).toHaveLength(1);
    });

    it('appends the reply to the NPC ledger, tagged to the live session', async () => {
        h.generateNpcRoleplay.mockResolvedValue({ dialogue: NPC_REPLY, moodCue: 'does not look up' });
        openRoleplayWith(makeNpc());

        await send('Is the harbour open?');
        await screen.findByText(NPC_REPLY);
        fireEvent.click(screen.getByRole('button', { name: /log this line/i }));

        expect(h.updateNpc).toHaveBeenCalledTimes(1);
        const [npcId, changes] = h.updateNpc.mock.calls[0] as [string, Partial<NPC>];
        expect(npcId).toBe('npc-1');
        const history = changes.history as HistoryEntry[];
        expect(history[history.length - 1].summary).toBe(`Said: "${NPC_REPLY}"`);
        expect(history[history.length - 1].referenceType).toBe('session');
        expect(history[history.length - 1].referenceId).toBe(SESSION_ID);
    });

    it('does not offer to log the DM\'s own messages', async () => {
        h.generateNpcRoleplay.mockResolvedValue({ dialogue: NPC_REPLY, moodCue: 'does not look up' });
        openRoleplayWith(makeNpc());

        await send('Is the harbour open?');
        await screen.findByText(NPC_REPLY);

        // Two messages on screen (the DM's and the NPC's); only one is loggable.
        expect(screen.getByText('Is the harbour open?')).toBeTruthy();
        expect(screen.getAllByRole('button', { name: /log this line/i })).toHaveLength(1);
    });

    it('logs the same reply only once, however many times it is pressed', async () => {
        h.generateNpcRoleplay.mockResolvedValue({ dialogue: NPC_REPLY, moodCue: 'does not look up' });
        openRoleplayWith(makeNpc());

        await send('Is the harbour open?');
        await screen.findByText(NPC_REPLY);

        const button = screen.getByRole('button', { name: /log this line/i }) as HTMLButtonElement;
        fireEvent.click(button);

        // The action reports itself done rather than staying armed.
        const after = screen.getByRole('button', { name: /line/i }) as HTMLButtonElement;
        expect(after.disabled).toBe(true);

        fireEvent.click(after);
        expect(h.updateNpc).toHaveBeenCalledTimes(1);
    });

    it('writes nothing to the ledger just by opening the roleplay tool', () => {
        openRoleplayWith(makeNpc({ voiceNotes: VOICE }));

        expect(h.updateNpc).not.toHaveBeenCalled();
    });
});
