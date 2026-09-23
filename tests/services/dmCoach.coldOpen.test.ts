/**
 * SPEC — the "Previously on…" cold open (Wave 2, lane MOMENTS / P4)
 * =============================================================================
 * Source: docs/design/storyteller-first-design.md P4, consumer 2 ("the cold
 * open"). Files under test: services/ai/dmCoach.ts (`generateColdOpen`,
 * `hasColdOpenMaterial`), services/aiService.ts (the facade),
 * services/ai/mockService.ts (the mock).
 *
 * WHAT THIS FUNCTION IS
 * ---------------------
 * Opening narration is the highest-leverage sixty seconds of any session, and
 * a recap written after last session is a *record*, not *performance material*.
 * This turns one into the other. The DM types nothing: everything the draft is
 * built from is already in the campaign — the last completed session's recap
 * and loose ends, and the moments the DM starred at the table while they were
 * happening (`SessionLogEntry.isImportant`, reused deliberately rather than
 * minting a second "engraved" flag).
 *
 * THE CONTRACT, IN PLAIN SENTENCES
 * --------------------------------
 * 1. **It reads the campaign, and nothing else.** The request carries the
 *    campaign, an optional caller-built context string and an optional tier
 *    flag. There is no `prompt` parameter, because the DM never writes one.
 *
 * 2. **It refuses to invent a past that isn't there.** With no words in the
 *    last completed session and no starred moment anywhere, there is nothing to
 *    open with: the call rejects, the error says so, and no model is called.
 *    `hasColdOpenMaterial(campaign)` answers the same question ahead of time so
 *    a caller can decline to offer the action at all — the two agree, always.
 *
 * 3. **The material is the last session plus the starred moments.** The prompt
 *    carries the last COMPLETED session's recap and loose ends verbatim — an
 *    earlier session's recap is stale and must not appear — and the most recent
 *    engraved moments, newest first, capped at five so the model is given a
 *    spine rather than a transcript. An unstarred entry is never a moment; a
 *    starred entry with no words in it is not one either.
 *
 * 4. **It is read-aloud performance material, and the prompt says so.** The
 *    prompt asks for a "Previously on" cold open the DM can read aloud, of
 *    roughly 150 words.
 *
 * 5. **It speaks in the DM's voice when the DM has one.** A campaign with a
 *    `styleProfile` has that style guide handed to the model as the voice to
 *    match. Without one, no empty heading is left behind and nothing is faked.
 *
 * 6. **Campaign text is inserted literally.** A recap containing `$&` or a
 *    moment containing `$$` reaches the model exactly as written (the
 *    replacement-pattern hazard finding #96 pinned for the freeform tools), and
 *    no unfilled `{{…}}` placeholder survives.
 *
 * 7. **Context comes from the caller, verbatim.** The function forwards the
 *    `campaignContext` it was handed and never builds one itself — in
 *    particular never the player-safe variant. The output is GM-facing
 *    performance material; it is not a player recap.
 *
 * 8. **It is freeform text, not a schema call.** One `generateText` call per
 *    invocation at the standard tier, dropping to lite only when asked. The
 *    model's text comes back trimmed and otherwise unedited, and a generation
 *    failure propagates rather than resolving to a fake cold open.
 *
 * 9. **The facade owns the mock switch**, and defaults to the real path when
 *    the flag is omitted.
 *
 * 10. **The mock is usable, not decorative.** It resolves a real "Previously
 *     on" paragraph naming the campaign, and refuses an empty campaign exactly
 *     as the real path does, so the two cannot drift.
 *
 * 11. **Old saves do not crash it.** A session log written before
 *     `structuredNotes` / `recap` / `looseEnds` were always present is read as
 *     "nothing here", never dereferenced.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Campaign, SessionLog, SessionLogEntry } from '../../types/index';

const h = vi.hoisted(() => ({ buildCampaignContext: vi.fn(() => 'BUILT-CONTEXT') }));

vi.mock('../../services/ai/core', () => ({
  generateWithSchema: vi.fn(async () => ({})),
  generateText: vi.fn(async () => '  Previously, on Ashfall.  '),
  generateChatCompletion: vi.fn(async () => 'ok'),
}));

vi.mock('../../services/contextBuilder', () => ({ buildCampaignContext: h.buildCampaignContext }));

import * as core from '../../services/ai/core';
import * as dmCoach from '../../services/ai/dmCoach';
import * as aiService from '../../services/aiService';
import * as mockService from '../../services/ai/mockService';

// --- fixtures -------------------------------------------------------------

function entry(over: Partial<SessionLogEntry> & { id: string }): SessionLogEntry {
  return {
    timestamp: '2026-01-01T20:00:00.000Z',
    content: 'Something happened.',
    taggedEntityIds: [],
    ...over,
  } as SessionLogEntry;
}

function session(over: Partial<SessionLog> & { id: string }): SessionLog {
  return {
    title: `Session ${over.id}`,
    status: 'completed',
    sessionDate: '2026-01-01',
    plannedSceneIds: [],
    prepNotes: '',
    relatedPlotIds: [],
    runningNotes: '',
    structuredNotes: [],
    encounterLog: [],
    recap: '',
    notableEvents: '',
    looseEnds: '',
    ...over,
  } as SessionLog;
}

function makeCampaign(over: Record<string, unknown> = {}): Campaign {
  return {
    id: 'camp-1',
    title: 'Ashfall',
    setting: 'A dying empire',
    settingType: 'custom',
    npcs: [],
    locations: [],
    factions: [],
    items: [],
    adventures: [],
    articles: [],
    sessionLogs: [],
    playerCharacters: [],
    plots: [],
    notes: [],
    secrets: [],
    ...over,
  } as unknown as Campaign;
}

const RECAP = 'The party burned the ledger and walked out of the Ashen Gate before dawn.';
const LOOSE_ENDS = 'Nobody has explained where Brannock went, and the seal is still missing.';
const OLD_RECAP = 'Three months ago they were still arguing about a toll.';
const STYLE = 'Short, cold sentences. Concrete nouns. Never a simile.';

const MOMENT_OLD = 'The bridge went down with Ivet still on it.';
const MOMENT_NEW = 'Brannock swore on the ledger, and lied.';
const CHATTER = 'Bought three torches and a length of rope.';

/** A campaign with a written-up last session and two engraved moments. */
const full = makeCampaign({
  styleProfile: STYLE,
  sessionLogs: [
    session({ id: 's0', title: 'The Toll Road', sessionDate: '2025-12-01', recap: OLD_RECAP }),
    session({
      id: 's1',
      title: 'The Drowned Gate',
      sessionDate: '2026-01-01',
      structuredNotes: [
        entry({ id: 'n1', content: MOMENT_OLD, isImportant: true }),
        entry({ id: 'n2', content: CHATTER }),
      ],
    }),
    session({
      id: 's2',
      title: 'The Ashen Vault',
      sessionDate: '2026-02-01',
      recap: RECAP,
      looseEnds: LOOSE_ENDS,
      structuredNotes: [entry({ id: 'n3', content: MOMENT_NEW, isImportant: true })],
    }),
    session({ id: 's3', title: 'The Salt Stair', sessionDate: '2026-04-01', status: 'planned' }),
  ],
});

// --- helpers --------------------------------------------------------------

/** The full prompt string handed to core.generateText on the Nth call. */
const sentPrompt = (call = 0) => String(vi.mocked(core.generateText).mock.calls[call][0]);
/** The tier argument of the Nth core.generateText call. */
const sentTier = (call = 0) => vi.mocked(core.generateText).mock.calls[call][1];
/** The campaignContext argument of the Nth core.generateText call. */
const sentContext = (call = 0) => vi.mocked(core.generateText).mock.calls[call][2];

/** Runs a mock-service call with fake timers so MOCK_DELAY does not cost 500 ms. */
async function withTimers<T>(run: () => Promise<T>): Promise<T> {
  vi.useFakeTimers();
  try {
    const pending = run();
    // Keep a rejection from being "unhandled" while the fake clock is advanced;
    // the real assertion still happens at the `await` below.
    pending.catch(() => undefined);
    await vi.runAllTimersAsync();
    return await pending;
  } finally {
    vi.useRealTimers();
  }
}

beforeEach(() => {
  vi.mocked(core.generateText).mockClear();
  vi.mocked(core.generateText).mockResolvedValue('  Previously, on Ashfall.  ');
  vi.mocked(core.generateWithSchema).mockClear();
  h.buildCampaignContext.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

// --- 1 & 2. nothing to open with ------------------------------------------

describe('a cold open needs a past to open on', () => {
  it('refuses an empty campaign, and calls no model', async () => {
    await expect(dmCoach.generateColdOpen({ campaign: makeCampaign() })).rejects.toThrow(/nothing/i);
    expect(core.generateText).not.toHaveBeenCalled();
  });

  it('refuses when the last session was left blank and nothing was starred', async () => {
    const campaign = makeCampaign({
      sessionLogs: [session({ id: 's1', structuredNotes: [entry({ id: 'n1', content: CHATTER })] })],
    });
    await expect(dmCoach.generateColdOpen({ campaign })).rejects.toThrow(/nothing/i);
    expect(core.generateText).not.toHaveBeenCalled();
  });

  it('says up front whether there is anything to draft from', () => {
    expect(dmCoach.hasColdOpenMaterial(full)).toBe(true);
    expect(dmCoach.hasColdOpenMaterial(makeCampaign())).toBe(false);
  });

  it('counts a recap alone, loose ends alone, or a starred moment alone', () => {
    const recapOnly = makeCampaign({ sessionLogs: [session({ id: 's1', recap: RECAP })] });
    const looseOnly = makeCampaign({ sessionLogs: [session({ id: 's1', looseEnds: LOOSE_ENDS })] });
    const momentOnly = makeCampaign({
      sessionLogs: [
        session({
          id: 's1',
          status: 'active',
          structuredNotes: [entry({ id: 'n1', content: MOMENT_NEW, isImportant: true })],
        }),
      ],
    });

    expect(dmCoach.hasColdOpenMaterial(recapOnly)).toBe(true);
    expect(dmCoach.hasColdOpenMaterial(looseOnly)).toBe(true);
    expect(dmCoach.hasColdOpenMaterial(momentOnly)).toBe(true);
  });

  it('does not count a session the table has not played yet', () => {
    const plannedOnly = makeCampaign({
      sessionLogs: [session({ id: 's1', status: 'planned', recap: RECAP, looseEnds: LOOSE_ENDS })],
    });
    expect(dmCoach.hasColdOpenMaterial(plannedOnly)).toBe(false);
  });

  it('does not count whitespace as words', () => {
    const blank = makeCampaign({
      sessionLogs: [
        session({
          id: 's1',
          recap: '   \n  ',
          looseEnds: '\t',
          structuredNotes: [entry({ id: 'n1', content: '   ', isImportant: true })],
        }),
      ],
    });
    expect(dmCoach.hasColdOpenMaterial(blank)).toBe(false);
  });

  it('agrees with itself: whatever the predicate refuses, the generator refuses too', async () => {
    const blank = makeCampaign({ sessionLogs: [session({ id: 's1' })] });
    expect(dmCoach.hasColdOpenMaterial(blank)).toBe(false);
    await expect(dmCoach.generateColdOpen({ campaign: blank })).rejects.toThrow(/nothing/i);
  });
});

// --- 3. the material ------------------------------------------------------

describe('what the model is given to work from', () => {
  it('carries the last session\'s recap and loose ends, word for word', async () => {
    await dmCoach.generateColdOpen({ campaign: full });
    const prompt = sentPrompt();
    expect(prompt).toContain(RECAP);
    expect(prompt).toContain(LOOSE_ENDS);
  });

  it('leaves an older session\'s recap out — last session is the one being recalled', async () => {
    await dmCoach.generateColdOpen({ campaign: full });
    expect(sentPrompt()).not.toContain(OLD_RECAP);
  });

  it('carries the starred moments, newest first', async () => {
    await dmCoach.generateColdOpen({ campaign: full });
    const prompt = sentPrompt();
    expect(prompt).toContain(MOMENT_NEW);
    expect(prompt).toContain(MOMENT_OLD);
    expect(prompt.indexOf(MOMENT_NEW)).toBeLessThan(prompt.indexOf(MOMENT_OLD));
  });

  it('never treats an unstarred note as a moment', async () => {
    await dmCoach.generateColdOpen({ campaign: full });
    expect(sentPrompt()).not.toContain(CHATTER);
  });

  it('ignores a starred note with no words in it', async () => {
    const campaign = makeCampaign({
      sessionLogs: [
        session({
          id: 's1',
          recap: RECAP,
          structuredNotes: [
            entry({ id: 'n1', content: '   ', isImportant: true }),
            entry({ id: 'n2', content: MOMENT_NEW, isImportant: true }),
          ],
        }),
      ],
    });
    await dmCoach.generateColdOpen({ campaign });
    const prompt = sentPrompt();
    expect(prompt).toContain(MOMENT_NEW);
    // The blank star contributes no bullet, and leaves no empty one behind.
    expect(prompt).not.toMatch(/-\s*\n/);
  });

  it('keeps at most the five most recent moments', async () => {
    const notes = Array.from({ length: 7 }, (_, i) =>
      entry({ id: `n${i}`, content: `Moment number ${i}`, isImportant: true })
    );
    const campaign = makeCampaign({
      sessionLogs: [session({ id: 's1', recap: RECAP, structuredNotes: notes })],
    });

    await dmCoach.generateColdOpen({ campaign });
    const prompt = sentPrompt();

    for (const i of [6, 5, 4, 3, 2]) expect(prompt).toContain(`Moment number ${i}`);
    for (const i of [1, 0]) expect(prompt).not.toContain(`Moment number ${i}`);
  });

  it('gathers moments from every session, in the order the table lived them', async () => {
    await dmCoach.generateColdOpen({ campaign: full });
    const prompt = sentPrompt();
    // s1's moment is older than s2's, so it comes second in a newest-first list.
    expect(prompt.indexOf(MOMENT_NEW)).toBeLessThan(prompt.indexOf(MOMENT_OLD));
  });
});

// --- 4 & 5. what is being asked for ---------------------------------------

describe('the ask: read-aloud performance material, in the DM voice', () => {
  it('asks for a "Previously on" cold open of about 150 words, to be read aloud', async () => {
    await dmCoach.generateColdOpen({ campaign: full });
    const prompt = sentPrompt();
    expect(prompt.toLowerCase()).toContain('previously on');
    expect(prompt.toLowerCase()).toMatch(/read[- ]aloud|read it aloud|read aloud/);
    expect(prompt).toContain('150');
  });

  it('hands over the campaign style guide as the voice to match', async () => {
    await dmCoach.generateColdOpen({ campaign: full });
    expect(sentPrompt()).toContain(STYLE);
  });

  it('says nothing about voice when the campaign has no style of its own', async () => {
    const campaign = makeCampaign({ sessionLogs: [session({ id: 's1', recap: RECAP })] });
    await dmCoach.generateColdOpen({ campaign });
    const prompt = sentPrompt();
    expect(prompt).not.toContain('undefined');
    // No orphaned heading and no run of blank lines where the style would have gone.
    expect(prompt.trim()).toBe(prompt.trim().replace(/\n{3,}/g, '\n\n'));
  });

  it('treats a blank style profile as no style profile', async () => {
    const campaign = makeCampaign({
      styleProfile: '   ',
      sessionLogs: [session({ id: 's1', recap: RECAP })],
    });
    await dmCoach.generateColdOpen({ campaign });
    expect(sentPrompt().trim()).toBe(sentPrompt().trim().replace(/\n{3,}/g, '\n\n'));
  });
});

// --- 6. literal insertion --------------------------------------------------

describe('campaign text reaches the model exactly as the DM wrote it', () => {
  it('survives replacement patterns in a recap, a loose end and a moment', async () => {
    const campaign = makeCampaign({
      styleProfile: 'Terse. $& is a word here.',
      sessionLogs: [
        session({
          id: 's1',
          recap: "They paid the $$500 toll and said $' about it.",
          looseEnds: 'The $& ledger is still missing.',
          structuredNotes: [entry({ id: 'n1', content: 'Ivet shouted "$`" as the bridge fell.', isImportant: true })],
        }),
      ],
    });

    await dmCoach.generateColdOpen({ campaign });
    const prompt = sentPrompt();

    expect(prompt).toContain("They paid the $$500 toll and said $' about it.");
    expect(prompt).toContain('The $& ledger is still missing.');
    expect(prompt).toContain('Ivet shouted "$`" as the bridge fell.');
    expect(prompt).toContain('Terse. $& is a word here.');
    expect(prompt).not.toContain('{{');
  });
});

// --- 7. context ------------------------------------------------------------

describe('context comes from the caller and stays GM-facing', () => {
  it('forwards the caller context untouched', async () => {
    await dmCoach.generateColdOpen({ campaign: full, campaignContext: 'GEN-CONTEXT' });
    expect(sentContext()).toBe('GEN-CONTEXT');
  });

  it('passes no context at all rather than inventing one', async () => {
    await dmCoach.generateColdOpen({ campaign: full });
    expect(sentContext()).toBeUndefined();
  });

  it('never builds a context itself — least of all the player-safe one', async () => {
    await dmCoach.generateColdOpen({ campaign: full, campaignContext: 'GEN-CONTEXT' });
    expect(h.buildCampaignContext).not.toHaveBeenCalled();
  });
});

// --- 8. shape of the call --------------------------------------------------

describe('one freeform call per press', () => {
  it('makes exactly one generateText call and no schema call', async () => {
    await dmCoach.generateColdOpen({ campaign: full });
    expect(core.generateText).toHaveBeenCalledTimes(1);
    expect(core.generateWithSchema).not.toHaveBeenCalled();
  });

  it('runs at the standard tier by default and the lite tier on request', async () => {
    await dmCoach.generateColdOpen({ campaign: full });
    expect(sentTier()).toBe('standard');

    await dmCoach.generateColdOpen({ campaign: full, useLiteModel: true });
    expect(sentTier(1)).toBe('lite');
  });

  it('returns the model text trimmed and otherwise unedited', async () => {
    vi.mocked(core.generateText).mockResolvedValueOnce('\n  Previously, on Ashfall: the gate burned.  \n');
    const result = await dmCoach.generateColdOpen({ campaign: full });
    expect(result).toBe('Previously, on Ashfall: the gate burned.');
  });

  it('lets a generation failure propagate rather than returning a fake cold open', async () => {
    vi.mocked(core.generateText).mockRejectedValueOnce(new Error('504 gateway timeout'));
    await expect(dmCoach.generateColdOpen({ campaign: full })).rejects.toThrow('504 gateway timeout');
  });
});

// --- 9. the facade ---------------------------------------------------------

describe('the facade owns the mock switch', () => {
  it('routes to the real module when mock mode is off, request unchanged', async () => {
    const text = await aiService.generateColdOpen({ campaign: full, campaignContext: 'GEN-CONTEXT' }, false);

    expect(core.generateText).toHaveBeenCalledTimes(1);
    expect(sentContext()).toBe('GEN-CONTEXT');
    expect(sentPrompt()).toContain(RECAP);
    expect(text).toBe('Previously, on Ashfall.');
  });

  it('defaults to the real path when the flag is left off', async () => {
    await aiService.generateColdOpen({ campaign: full });
    expect(core.generateText).toHaveBeenCalledTimes(1);
  });

  it('routes to the mock when mock mode is on, and never touches the model', async () => {
    const text = await withTimers(() => aiService.generateColdOpen({ campaign: full }, true));
    expect(core.generateText).not.toHaveBeenCalled();
    expect(text.trim().length).toBeGreaterThan(0);
  });

  it('refuses an empty campaign on both paths', async () => {
    const empty = makeCampaign();
    await expect(aiService.generateColdOpen({ campaign: empty }, false)).rejects.toThrow(/nothing/i);
    await expect(aiService.generateColdOpen({ campaign: empty }, true)).rejects.toThrow(/nothing/i);
    expect(core.generateText).not.toHaveBeenCalled();
  });

  it('re-exports the predicate so callers never reach into services/ai', () => {
    expect(typeof aiService.hasColdOpenMaterial).toBe('function');
    expect(aiService.hasColdOpenMaterial).toBe(dmCoach.hasColdOpenMaterial);
    expect(aiService.hasColdOpenMaterial(full)).toBe(true);
    expect(aiService.hasColdOpenMaterial(makeCampaign())).toBe(false);
  });
});

// --- 10. the mock ----------------------------------------------------------

describe('the mock is usable, not decorative', () => {
  it('resolves a real "Previously on" paragraph naming the campaign', async () => {
    const text = await withTimers(() => mockService.generateColdOpen({ campaign: full }));
    expect(text.toLowerCase()).toContain('previously on');
    expect(text).toContain('Ashfall');
    expect(text.trim().length).toBeGreaterThan(0);
  });

  it('refuses an empty campaign exactly as the real path does', async () => {
    await expect(mockService.generateColdOpen({ campaign: makeCampaign() })).rejects.toThrow(/nothing/i);
  });
});

// --- 11. old saves ---------------------------------------------------------

describe('a save written by an older build', () => {
  it('reads a session missing structuredNotes / recap / looseEnds as nothing at all', async () => {
    const legacy = session({ id: 's1', title: 'The Drowned Gate' });
    delete (legacy as Partial<SessionLog>).structuredNotes;
    delete (legacy as Partial<SessionLog>).recap;
    delete (legacy as Partial<SessionLog>).looseEnds;
    const campaign = makeCampaign({ sessionLogs: [legacy] });

    expect(() => dmCoach.hasColdOpenMaterial(campaign)).not.toThrow();
    expect(dmCoach.hasColdOpenMaterial(campaign)).toBe(false);
    await expect(dmCoach.generateColdOpen({ campaign })).rejects.toThrow(/nothing/i);
  });

  it('still drafts from a legacy session that does carry a recap', async () => {
    const legacy = session({ id: 's1', recap: RECAP });
    delete (legacy as Partial<SessionLog>).structuredNotes;
    const campaign = makeCampaign({ sessionLogs: [legacy] });

    await expect(dmCoach.generateColdOpen({ campaign })).resolves.toBe('Previously, on Ashfall.');
    expect(sentPrompt()).toContain(RECAP);
  });

  it('survives a campaign with no sessionLogs array at all', () => {
    const campaign = makeCampaign();
    delete (campaign as Partial<Campaign>).sessionLogs;
    expect(dmCoach.hasColdOpenMaterial(campaign)).toBe(false);
  });
});
