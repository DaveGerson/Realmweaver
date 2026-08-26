/**
 * SPEC — the Callback Machine's AI call (Wave 1, lane P2)
 * =============================================================================
 * Source: docs/design/storyteller-first-design.md P2 ·
 *         docs/design/lazy-dm-lens.md §3 rank 1 and §5's no-crafted-prompt rule.
 *
 * Files under test: services/ai/dmCoach.ts (`generateCallbackComplication`),
 * services/aiService.ts (the facade), services/ai/mockService.ts (the mock).
 *
 * WHAT THIS FUNCTION IS
 * ---------------------
 * `generateImprovisation` looks *forward* from a situation the DM types out.
 * This looks *backward* into the world's own idle inventory and asks for one
 * complication that reincorporates it. That difference is the whole feature,
 * and it shows up in the signature: there is no `prompt` parameter, because
 * the DM never writes one. The caller hands over sampled dormant material, a
 * derived line about what is on stage, and a coach-variant campaign context.
 *
 * THE CONTRACT, IN PLAIN SENTENCES
 * --------------------------------
 * 1. **No crafted prompt, ever.** The request carries material, an optional
 *    derived scene summary, an optional context string and an optional tier
 *    flag — and nothing that could be a DM-typed prompt. Asking for a
 *    complication with nothing to reincorporate is a mistake the function
 *    refuses rather than papers over: an empty (or missing) material list
 *    rejects, and no model call is made.
 *
 * 2. **It asks for exactly one complication, and it says so.** The prompt
 *    names the job (reincorporate the material listed below into what is
 *    happening now), asks for ONE complication rather than a menu, and keeps
 *    it short enough to read at the table.
 *
 * 3. **Every sampled piece reaches the model, labelled and explained.** The
 *    prompt contains each piece's label and each piece's dormancy reason, so
 *    the model reincorporates the DM's own material instead of inventing a
 *    stranger. Text from campaign labels is inserted literally — a title
 *    containing `$&` or `$'` must survive into the prompt exactly as written
 *    (the same replacement-pattern hazard finding #96 pinned for the freeform
 *    tools), and no unfilled `{{...}}` placeholder may survive.
 *
 * 4. **The scene summary is optional and never faked.** When the caller
 *    supplies one it appears in the prompt; when it does not, no empty
 *    heading is left behind.
 *
 * 5. **Context comes from the caller, verbatim.** The function forwards the
 *    `campaignContext` string it was given to the model adapter untouched. It
 *    never builds context itself, and in particular never touches the
 *    player-safe variant — this output is GM-private and belongs in the
 *    running log, never in anything the players read.
 *
 * 6. **It is freeform text, not a schema call.** One `generateText` call per
 *    invocation, at the standard tier, dropping to the lite tier only when
 *    the caller asks. The model's text comes back trimmed and otherwise
 *    unedited.
 *
 * 7. **The facade owns the mock switch.** `aiService.generateCallbackComplication`
 *    routes to `mockService` when `isMockMode` is true and to `dmCoach`
 *    otherwise, passing the request through unchanged, and defaults to the
 *    real path when the flag is omitted.
 *
 * 8. **The mock is usable, not decorative.** It resolves a non-empty string
 *    that names every sampled piece, so mock mode exercises the card the same
 *    way a real generation does — and it refuses an empty material list for
 *    the same reason the real one does, so the two paths cannot drift.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({ buildCampaignContext: vi.fn(() => 'BUILT-CONTEXT') }));

vi.mock('../../services/ai/core', () => ({
  generateWithSchema: vi.fn(async () => ({})),
  generateText: vi.fn(async () => '  A complication.  '),
  generateChatCompletion: vi.fn(async () => 'ok'),
}));

vi.mock('../../services/contextBuilder', () => ({ buildCampaignContext: h.buildCampaignContext }));

import * as core from '../../services/ai/core';
import * as dmCoach from '../../services/ai/dmCoach';
import * as aiService from '../../services/aiService';
import * as mockService from '../../services/ai/mockService';
import type { DormantPiece } from '../../utils/dormantMaterial';

const MATERIAL: DormantPiece[] = [
  { kind: 'npc', id: 'npc-serah', label: 'Serah Vane', reason: 'Last seen 3 sessions ago' },
  { kind: 'secret', id: 'sec-key', label: 'The Ashen Key', reason: 'Still unrevealed, and tonight touches what it points at' },
  { kind: 'plot', id: 'plot-hollow', label: 'The Hollow Crown', reason: "Hasn't moved in 4 sessions" },
];

/** The full prompt string handed to core.generateText on the Nth call. */
const sentPrompt = (call = 0) => String(vi.mocked(core.generateText).mock.calls[call][0]);
/** The tier argument of the Nth core.generateText call. */
const sentTier = (call = 0) => vi.mocked(core.generateText).mock.calls[call][1];
/** The campaignContext argument of the Nth core.generateText call. */
const sentContext = (call = 0) => vi.mocked(core.generateText).mock.calls[call][2];

beforeEach(() => {
  vi.mocked(core.generateText).mockClear();
  vi.mocked(core.generateText).mockResolvedValue('  A complication.  ');
  vi.mocked(core.generateWithSchema).mockClear();
  h.buildCampaignContext.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- 1. no crafted prompt -------------------------------------------------

describe('the DM types nothing', () => {
  it('refuses to generate with nothing to reincorporate, and calls no model', async () => {
    await expect(dmCoach.generateCallbackComplication({ material: [] })).rejects.toThrow(/dormant material/i);
    expect(core.generateText).not.toHaveBeenCalled();
  });

  it('refuses the same way when the material list is missing entirely', async () => {
    await expect(
      dmCoach.generateCallbackComplication({} as unknown as dmCoach.CallbackComplicationRequest)
    ).rejects.toThrow(/dormant material/i);
    expect(core.generateText).not.toHaveBeenCalled();
  });
});

// --- 2 & 3. what the model is asked ---------------------------------------

describe('the prompt asks for one complication built from the DM own material', () => {
  it('asks for exactly one complication rather than a menu of options', async () => {
    await dmCoach.generateCallbackComplication({ material: MATERIAL });
    const prompt = sentPrompt();
    expect(prompt.toLowerCase()).toContain('one complication');
    expect(prompt.toLowerCase()).toContain('reincorporat');
  });

  it('carries every sampled label and every dormancy reason', async () => {
    await dmCoach.generateCallbackComplication({ material: MATERIAL });
    const prompt = sentPrompt();
    for (const piece of MATERIAL) {
      expect(prompt).toContain(piece.label);
      expect(prompt).toContain(piece.reason);
    }
  });

  it('works from a two-piece sample as happily as a three-piece one', async () => {
    await dmCoach.generateCallbackComplication({ material: MATERIAL.slice(0, 2) });
    const prompt = sentPrompt();
    expect(prompt).toContain('Serah Vane');
    expect(prompt).toContain('The Ashen Key');
    expect(prompt).not.toContain('The Hollow Crown');
  });

  it('inserts campaign text literally, replacement patterns and all', async () => {
    const tricky: DormantPiece[] = [
      { kind: 'npc', id: 'n1', label: "Sergeant $& O'Dell", reason: "Last seen 2 sessions ago $' " },
      { kind: 'plot', id: 'p1', label: 'The $$500 Debt', reason: "Hasn't moved yet" },
    ];
    await dmCoach.generateCallbackComplication({ material: tricky });
    const prompt = sentPrompt();
    expect(prompt).toContain("Sergeant $& O'Dell");
    expect(prompt).toContain('The $$500 Debt');
    expect(prompt).not.toContain('{{');
  });
});

// --- 4. the scene summary -------------------------------------------------

describe('what is happening right now', () => {
  it('includes the derived scene summary when the caller supplies one', async () => {
    await dmCoach.generateCallbackComplication({
      material: MATERIAL,
      sceneSummary: 'The party is arguing with a toll clerk at the Ashen Gate.',
    });
    expect(sentPrompt()).toContain('The party is arguing with a toll clerk at the Ashen Gate.');
  });

  it('leaves no empty heading behind when there is no scene summary', async () => {
    await dmCoach.generateCallbackComplication({ material: MATERIAL });
    const prompt = sentPrompt();
    expect(prompt).not.toMatch(/:\s*\n\s*\n\s*\n/);
    expect(prompt.trim()).toBe(prompt.trim().replace(/\n{3,}/g, '\n\n'));
  });
});

// --- 5. context ------------------------------------------------------------

describe('context comes from the caller and stays GM-private', () => {
  it('forwards the caller campaign context untouched', async () => {
    await dmCoach.generateCallbackComplication({ material: MATERIAL, campaignContext: 'COACH-CONTEXT' });
    expect(sentContext()).toBe('COACH-CONTEXT');
  });

  it('passes no context at all rather than inventing one', async () => {
    await dmCoach.generateCallbackComplication({ material: MATERIAL });
    expect(sentContext()).toBeUndefined();
  });

  it('never builds a context itself — least of all the player-safe one', async () => {
    await dmCoach.generateCallbackComplication({ material: MATERIAL, campaignContext: 'COACH-CONTEXT' });
    expect(h.buildCampaignContext).not.toHaveBeenCalled();
  });
});

// --- 6. shape of the call --------------------------------------------------

describe('one freeform call per press', () => {
  it('makes exactly one generateText call and no schema call', async () => {
    await dmCoach.generateCallbackComplication({ material: MATERIAL });
    expect(core.generateText).toHaveBeenCalledTimes(1);
    expect(core.generateWithSchema).not.toHaveBeenCalled();
  });

  it('runs at the standard tier by default and the lite tier on request', async () => {
    await dmCoach.generateCallbackComplication({ material: MATERIAL });
    expect(sentTier()).toBe('standard');

    await dmCoach.generateCallbackComplication({ material: MATERIAL, useLiteModel: true });
    expect(sentTier(1)).toBe('lite');
  });

  it('returns the model text trimmed and otherwise unedited', async () => {
    vi.mocked(core.generateText).mockResolvedValueOnce('\n  The toll clerk is Serah Vane in a borrowed coat.  \n');
    const result = await dmCoach.generateCallbackComplication({ material: MATERIAL });
    expect(result).toBe('The toll clerk is Serah Vane in a borrowed coat.');
  });

  it('lets a generation failure propagate rather than returning a fake complication', async () => {
    vi.mocked(core.generateText).mockRejectedValueOnce(new Error('504 gateway timeout'));
    await expect(dmCoach.generateCallbackComplication({ material: MATERIAL })).rejects.toThrow('504 gateway timeout');
  });
});

// --- 7. the facade ---------------------------------------------------------

describe('the facade owns the mock switch', () => {
  it('routes to the real module when mock mode is off, request unchanged', async () => {
    const text = await aiService.generateCallbackComplication(
      { material: MATERIAL, sceneSummary: 'A toll booth.', campaignContext: 'COACH-CONTEXT' },
      false
    );

    // The real path is the only one that reaches the model adapter.
    expect(core.generateText).toHaveBeenCalledTimes(1);
    expect(sentContext()).toBe('COACH-CONTEXT');
    expect(sentPrompt()).toContain('A toll booth.');
    expect(sentPrompt()).toContain('Serah Vane');
    expect(text).toBe('A complication.');
  });

  it('defaults to the real path when the flag is left off', async () => {
    await aiService.generateCallbackComplication({ material: MATERIAL });
    expect(core.generateText).toHaveBeenCalledTimes(1);
  });

  it('routes to the mock when mock mode is on, and never touches the model', async () => {
    const text = await aiService.generateCallbackComplication({ material: MATERIAL, campaignContext: 'COACH-CONTEXT' }, true);

    expect(core.generateText).not.toHaveBeenCalled();
    expect(text.trim().length).toBeGreaterThan(0);
    for (const piece of MATERIAL) expect(text).toContain(piece.label);
  });

  it('refuses an empty sample through the facade on both paths', async () => {
    await expect(aiService.generateCallbackComplication({ material: [] }, false)).rejects.toThrow(/dormant material/i);
    await expect(aiService.generateCallbackComplication({ material: [] }, true)).rejects.toThrow(/dormant material/i);
    expect(core.generateText).not.toHaveBeenCalled();
  });
});

// --- 8. the mock -----------------------------------------------------------

describe('the mock is usable, not decorative', () => {
  it('resolves a non-empty complication naming every sampled piece', async () => {
    const text = await mockService.generateCallbackComplication({ material: MATERIAL });
    expect(text.trim().length).toBeGreaterThan(0);
    for (const piece of MATERIAL) expect(text).toContain(piece.label);
  });

  it('refuses an empty material list exactly as the real path does', async () => {
    await expect(mockService.generateCallbackComplication({ material: [] })).rejects.toThrow(/dormant material/i);
  });
});
