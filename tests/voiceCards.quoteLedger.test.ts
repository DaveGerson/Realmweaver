/**
 * SPEC — the quote ledger (Wave 2, lane VOICE / P3).
 *
 * Source: docs/design/storyteller-first-design.md §P3 — "a 'log a line' action
 * ... appends the spoken line to the NPC's existing `history: HistoryEntry[]`
 * with `referenceType: 'session'`. No new collection: the history mechanism
 * already exists and already survives the purge sweep."
 *
 * THE CONTRACT
 *
 * 1. ZERO NEW SCHEMA. A logged line is an ordinary `HistoryEntry` on the NPC's
 *    existing `history[]`. What makes it a ledger row is the shape of its
 *    `summary`: the prefix `Said: ` followed by the spoken words in double
 *    quotes. Nothing else about `HistoryEntry`, `NPC`, or `Campaign` changes.
 *
 * 2. THE FORMAT ROUND-TRIPS. `formatQuoteLedgerSummary` trims the DM's input
 *    and wraps it; `extractQuoteLine` gives the same words back. A line that
 *    itself contains double quotes survives verbatim — the DM's punctuation is
 *    theirs, and the ledger is a record, not a parser's plaything.
 *
 * 3. IT NEVER MISTAKES A HISTORY ROW FOR A QUOTE. Rows written by
 *    `EntityHistoryManager` ("Met the party at the docks") are not ledger rows;
 *    `isQuoteLedgerEntry` is false for them, `extractQuoteLine` returns null,
 *    and they never appear among the recent lines.
 *
 * 4. RECENT MEANS NEWEST-FIRST, CAPPED. `selectRecentQuoteLines` returns at
 *    most `limit` (default 3) lines, most recently logged first, drawn only
 *    from ledger rows and in append order. An NPC that is undefined, or an old
 *    save whose `history` array is missing entirely, yields `[]` — never a
 *    throw.
 *
 * 5. LOGGING READS THE LIVE STORE. `logNpcQuote` looks the NPC up through the
 *    store's `getActiveCampaign()` at call time and appends to THAT history —
 *    never to a copy captured when a panel rendered. A line logged from a
 *    second surface in between must not be lost.
 *
 * 6. IT IS TAGGED TO THE LIVE SESSION, AND IS UNDEFINED-SAFE WHEN THERE ISN'T
 *    ONE. With `campaign.activeSessionId` set, the row is
 *    `referenceType: 'session'` + `referenceId: <that id>`. With no live
 *    session, it falls back to `referenceType: 'manual'` and carries no
 *    `referenceId` — it never invents one and never writes `undefined` as a
 *    reference *type*.
 *
 * 7. ONE CLICK, ONE LINE. Logging is idempotent against a fumbled double
 *    press: an empty or whitespace-only line writes nothing, and re-logging a
 *    line identical to the ledger's most recent entry under the same reference
 *    writes nothing. `logNpcQuote` reports what it did by returning true only
 *    when a row was actually appended. Logging the same words again *later*
 *    (after another line intervened, or in a different session) is a real
 *    second utterance and IS recorded.
 *
 * 8. A MISSING TARGET IS A NO-OP, NOT A CRASH. No active campaign, or an npcId
 *    that matches nothing, writes nothing and returns false.
 *
 * 9. IT SURVIVES THE PURGE SWEEP. Deleting the session a line was tagged to
 *    must not delete the words: `_purgeEntityReferences` blanks the dangling
 *    `referenceId` and demotes the row to `referenceType: 'manual'`, and the
 *    line still reads back out of the ledger. Deleting the NPC removes their
 *    ledger with them, because the ledger IS their history.
 *
 * The `voiceNotes` field is deliberately absent from all of this: it is
 * non-id-bearing, nothing points at it, and it joins no integrity contract.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { setupTestEnvironment, makeTestStore, type CreateCampaignStoreFn } from './helpers/testStoreFactory';
import type { HistoryEntry, NPC } from '../types/index';
import { createDefaultNpc, createDefaultSession } from '../utils/entityUtils';

// ActiveScenePanel imports the campaignService singleton, which touches
// localStorage at module load.
setupTestEnvironment();

let createCampaignStore: CreateCampaignStoreFn;
let ledger: typeof import('../components/views/session/ActiveScenePanel');

beforeAll(async () => {
    createCampaignStore = (await import('../services/campaignService')).createCampaignStore;
    ledger = await import('../components/views/session/ActiveScenePanel');
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const quoteRow = (line: string, referenceId?: string): HistoryEntry => ({
    id: `h-${line.slice(0, 8)}-${referenceId ?? 'none'}`,
    summary: `Said: "${line}"`,
    referenceType: referenceId ? 'session' : 'manual',
    referenceId,
});

const plainRow = (summary: string): HistoryEntry => ({
    id: `h-plain-${summary.slice(0, 8)}`,
    summary,
    referenceType: 'manual',
});

const npcWithHistory = (history: HistoryEntry[]): NPC =>
    ({ ...createDefaultNpc(), id: 'npc-1', name: 'Serah Vantt', history }) as NPC;

// ── 2. The format round-trips ─────────────────────────────────────────────────

describe('quote ledger — the summary format', () => {
    it('wraps a spoken line with the ledger prefix and quotes', () => {
        expect(ledger.formatQuoteLedgerSummary('Hold the line.')).toBe('Said: "Hold the line."');
    });

    it('starts with the exported prefix', () => {
        expect(ledger.formatQuoteLedgerSummary('Hold the line.')).toContain(ledger.QUOTE_LEDGER_PREFIX);
        expect(ledger.formatQuoteLedgerSummary('Hold the line.').startsWith(ledger.QUOTE_LEDGER_PREFIX)).toBe(true);
    });

    it('trims the surrounding whitespace the DM typed', () => {
        expect(ledger.formatQuoteLedgerSummary('   Hold the line.  \n')).toBe('Said: "Hold the line."');
    });

    it.each([
        ['plain words', 'Hold the line.'],
        ['inner double quotes', 'He called it "the drowning" and laughed.'],
        ['an apostrophe and an em dash', "Don't — and I mean this — open that door."],
        ['a newline the DM typed mid-line', 'Wait.\nDid you hear that?'],
        ['a colon, which the prefix also uses', 'Rule one: nobody goes below.'],
        ['non-Latin script', 'Мы уже здесь.'],
    ])('round-trips %s', (_label, line) => {
        const entry = plainRow(ledger.formatQuoteLedgerSummary(line));
        expect(ledger.isQuoteLedgerEntry(entry)).toBe(true);
        expect(ledger.extractQuoteLine(entry)).toBe(line);
    });
});

// ── 3. It never mistakes a history row for a quote ────────────────────────────

describe('quote ledger — telling ledger rows from ordinary history', () => {
    const notQuotes = [
        'Met the party at the docks',
        'Said nothing at all',
        'Said: nothing at all',
        '',
        'The captain Said: "run" — but nobody moved',
    ];

    it.each(notQuotes)('does not treat %j as a logged line', summary => {
        const entry = plainRow(summary);
        expect(ledger.isQuoteLedgerEntry(entry)).toBe(false);
        expect(ledger.extractQuoteLine(entry)).toBeNull();
    });

    it('does not treat an empty quotation as a logged line', () => {
        expect(ledger.isQuoteLedgerEntry(plainRow('Said: ""'))).toBe(false);
    });
});

// ── 4. Recent means newest-first, capped ──────────────────────────────────────

describe('quote ledger — the recent lines an NPC card shows', () => {
    it('returns the most recently logged lines first', () => {
        const npc = npcWithHistory([
            quoteRow('First.'),
            quoteRow('Second.'),
            quoteRow('Third.'),
        ]);

        expect(ledger.selectRecentQuoteLines(npc)).toEqual(['Third.', 'Second.', 'First.']);
    });

    it('caps at three by default, dropping the oldest', () => {
        const npc = npcWithHistory([
            quoteRow('Oldest.'),
            quoteRow('Older.'),
            quoteRow('Newer.'),
            quoteRow('Newest.'),
        ]);

        const lines = ledger.selectRecentQuoteLines(npc);
        expect(lines).toEqual(['Newest.', 'Newer.', 'Older.']);
        expect(lines).not.toContain('Oldest.');
        expect(ledger.QUOTE_LEDGER_DISPLAY_LIMIT).toBe(3);
    });

    it('honours an explicit limit', () => {
        const npc = npcWithHistory([quoteRow('A.'), quoteRow('B.'), quoteRow('C.')]);

        expect(ledger.selectRecentQuoteLines(npc, 1)).toEqual(['C.']);
        expect(ledger.selectRecentQuoteLines(npc, 0)).toEqual([]);
        expect(ledger.selectRecentQuoteLines(npc, 10)).toEqual(['C.', 'B.', 'A.']);
    });

    it('ignores ordinary history rows interleaved with the ledger', () => {
        const npc = npcWithHistory([
            plainRow('Met the party at the docks'),
            quoteRow('Only spoken line.'),
            plainRow('Was promoted to harbourmaster'),
        ]);

        expect(ledger.selectRecentQuoteLines(npc)).toEqual(['Only spoken line.']);
    });

    it.each([
        ['an NPC with no history at all', () => npcWithHistory([])],
        ['an old save whose history array is missing', () => ({ ...npcWithHistory([]), history: undefined } as unknown as NPC)],
        ['an NPC whose history holds only ordinary rows', () => npcWithHistory([plainRow('Met the party')])],
    ])('returns nothing for %s', (_label, make) => {
        expect(ledger.selectRecentQuoteLines(make())).toEqual([]);
    });

    it.each([
        ['undefined', undefined],
        ['null', null],
    ])('returns nothing for %s rather than throwing', (_label, npc) => {
        expect(ledger.selectRecentQuoteLines(npc as unknown as NPC)).toEqual([]);
    });
});

// ── 5–9. Logging against a real store ─────────────────────────────────────────

describe('quote ledger — logging a line through the store', () => {
    let service: ReturnType<typeof makeTestStore>['service'];
    let campaign: ReturnType<typeof makeTestStore>['campaign'];
    let npcId: string;

    const npcNow = (): NPC => campaign().npcs.find(n => n.id === npcId)!;
    const linesNow = (): string[] => ledger.selectRecentQuoteLines(npcNow(), 50);

    beforeEach(() => {
        ({ service, campaign } = makeTestStore(createCampaignStore));
        npcId = service.createNpc({ ...createDefaultNpc(), name: 'Serah Vantt' });
    });

    const goLive = (): string => {
        const sessionId = service.createSessionLog({ ...createDefaultSession(), title: 'Session 4' });
        service.goLive(sessionId);
        return sessionId;
    };

    it('appends the line to the NPC history and reports that it wrote', () => {
        expect(ledger.logNpcQuote(npcId, 'Hold the line.', service)).toBe(true);

        expect(npcNow().history).toHaveLength(1);
        expect(npcNow().history[0].summary).toBe('Said: "Hold the line."');
        expect(linesNow()).toEqual(['Hold the line.']);
    });

    it('mints a real id for the row so history rendering and deletion keep working', () => {
        ledger.logNpcQuote(npcId, 'Hold the line.', service);

        const row = npcNow().history[0];
        expect(typeof row.id).toBe('string');
        expect(row.id.length).toBeGreaterThan(0);
    });

    // ── 6. Session tagging ────────────────────────────────────────────────────

    it('tags the row to the live session when one is running', () => {
        const sessionId = goLive();

        ledger.logNpcQuote(npcId, 'Hold the line.', service);

        const row = npcNow().history[0];
        expect(row.referenceType).toBe('session');
        expect(row.referenceId).toBe(sessionId);
    });

    it('falls back to a manual row when no session is live', () => {
        expect(campaign().activeSessionId).toBeFalsy();

        ledger.logNpcQuote(npcId, 'Hold the line.', service);

        const row = npcNow().history[0];
        expect(row.referenceType).toBe('manual');
        expect(row.referenceId).toBeUndefined();
    });

    it('leaves rows logged before go-live alone and tags only the new one', () => {
        ledger.logNpcQuote(npcId, 'Before the session.', service);
        const sessionId = goLive();
        ledger.logNpcQuote(npcId, 'During the session.', service);

        const [before, during] = npcNow().history;
        expect(before.referenceType).toBe('manual');
        expect(before.referenceId).toBeUndefined();
        expect(during.referenceType).toBe('session');
        expect(during.referenceId).toBe(sessionId);
    });

    // ── 5. Live-store reads ───────────────────────────────────────────────────

    it('appends to the history in the store, not to a snapshot taken earlier', () => {
        // A stale snapshot, exactly as a rendered panel would be holding.
        const staleNpc = npcNow();
        expect(staleNpc.history).toHaveLength(0);

        // Another surface logs first (the DM Coach roleplay tool, say).
        ledger.logNpcQuote(npcId, 'Logged from the coach.', service);

        // The card, still rendering the stale snapshot, logs its own line.
        ledger.logNpcQuote(npcId, 'Logged from the card.', service);

        expect(npcNow().history).toHaveLength(2);
        expect(linesNow()).toEqual(['Logged from the card.', 'Logged from the coach.']);
    });

    it('does not disturb history rows the DM wrote by hand', () => {
        service.updateNpc(npcId, { history: [plainRow('Met the party at the docks')] });

        ledger.logNpcQuote(npcId, 'Hold the line.', service);

        expect(npcNow().history).toHaveLength(2);
        expect(npcNow().history[0].summary).toBe('Met the party at the docks');
        expect(linesNow()).toEqual(['Hold the line.']);
    });

    // ── 7. One click, one line ────────────────────────────────────────────────

    it.each([
        ['an empty string', ''],
        ['spaces only', '   '],
        ['a newline only', '\n'],
        ['a tab only', '\t'],
    ])('writes nothing for %s', (_label, line) => {
        expect(ledger.logNpcQuote(npcId, line, service)).toBe(false);
        expect(npcNow().history).toHaveLength(0);
    });

    it('ignores an immediate repeat of the same line — a double press logs once', () => {
        expect(ledger.logNpcQuote(npcId, 'Hold the line.', service)).toBe(true);
        expect(ledger.logNpcQuote(npcId, 'Hold the line.', service)).toBe(false);

        expect(npcNow().history).toHaveLength(1);
    });

    it('treats a repeat that differs only by surrounding whitespace as the same press', () => {
        ledger.logNpcQuote(npcId, 'Hold the line.', service);
        expect(ledger.logNpcQuote(npcId, '  Hold the line.  ', service)).toBe(false);

        expect(npcNow().history).toHaveLength(1);
    });

    it('records the same words again once another line has intervened', () => {
        ledger.logNpcQuote(npcId, 'Hold the line.', service);
        ledger.logNpcQuote(npcId, 'They are through the gate.', service);
        expect(ledger.logNpcQuote(npcId, 'Hold the line.', service)).toBe(true);

        expect(npcNow().history).toHaveLength(3);
        expect(linesNow()).toEqual(['Hold the line.', 'They are through the gate.', 'Hold the line.']);
    });

    it('records the same words again in a different session', () => {
        ledger.logNpcQuote(npcId, 'Hold the line.', service);
        goLive();

        expect(ledger.logNpcQuote(npcId, 'Hold the line.', service)).toBe(true);
        expect(npcNow().history).toHaveLength(2);
    });

    it('is not confused by an ordinary history row appended after the last quote', () => {
        ledger.logNpcQuote(npcId, 'Hold the line.', service);
        service.updateNpc(npcId, {
            history: [...npcNow().history, plainRow('Was promoted to harbourmaster')],
        });

        // The most recent LEDGER row is still the same line — still a repeat.
        expect(ledger.logNpcQuote(npcId, 'Hold the line.', service)).toBe(false);
        expect(npcNow().history).toHaveLength(2);
    });

    // ── 8. Missing targets ────────────────────────────────────────────────────

    it('writes nothing when the npc id matches no NPC', () => {
        expect(ledger.logNpcQuote('npc-does-not-exist', 'Hold the line.', service)).toBe(false);
        expect(npcNow().history).toHaveLength(0);
    });

    it('writes nothing when there is no active campaign', () => {
        const emptyStore = createCampaignStore({ persist: false });
        emptyStore.init();

        expect(emptyStore.getActiveCampaign()).toBeNull();
        expect(() => ledger.logNpcQuote(npcId, 'Hold the line.', emptyStore)).not.toThrow();
        expect(ledger.logNpcQuote(npcId, 'Hold the line.', emptyStore)).toBe(false);
    });

    it('handles an old save whose NPC has no history array at all', () => {
        service.updateNpc(npcId, { history: undefined as unknown as HistoryEntry[] });

        expect(ledger.logNpcQuote(npcId, 'Hold the line.', service)).toBe(true);
        expect(npcNow().history).toHaveLength(1);
        expect(linesNow()).toEqual(['Hold the line.']);
    });

    // ── 9. The purge sweep ────────────────────────────────────────────────────

    it('keeps the words when the session they were logged in is deleted', () => {
        const sessionId = goLive();
        ledger.logNpcQuote(npcId, 'Hold the line.', service);

        service.deleteSessionLog(sessionId);

        const row = npcNow().history[0];
        expect(row.summary).toBe('Said: "Hold the line."');
        expect(row.referenceId).toBeUndefined();
        expect(row.referenceType).toBe('manual');
        expect(linesNow()).toEqual(['Hold the line.']);
    });

    it('takes the ledger with the NPC when the NPC is deleted', () => {
        ledger.logNpcQuote(npcId, 'Hold the line.', service);

        service.deleteNpc(npcId);

        expect(campaign().npcs.find(n => n.id === npcId)).toBeUndefined();
    });
});
