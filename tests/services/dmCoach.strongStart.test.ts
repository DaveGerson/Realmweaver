/**
 * SPEC — Strong Start Styles: 'action' and 'reincorporate' (Wave 2, lane 2:
 * SessionPrepWizard bundle)
 * =============================================================================
 * Source: docs/design/lazy-dm-lens.md §4.6, widening the shipped "Previously
 * on…" cold open (R1/P4). Files under test: services/ai/dmCoach.ts
 * (`generateStrongStart`), services/aiService.ts (the facade),
 * services/ai/mockService.ts (the mock).
 *
 * WHAT THIS FUNCTION IS
 * ---------------------
 * The shipped cold open is one drafting angle for Shea's step 2, and it needs
 * a prior session to recap. `generateStrongStart` covers what it cannot:
 * 'action' needs no history at all (works in a session-1 campaign); 'reincorporate'
 * builds around exactly ONE sampled piece of the campaign's own dormant
 * material. The 'previously-on' style is NOT this function's job — callers
 * keep calling `generateColdOpen` verbatim for that.
 *
 * THE CONTRACT, IN PLAIN SENTENCES
 * --------------------------------
 * 1. **The DM types nothing in either style.** The request carries a style,
 *    the campaign, an optional context string, an optional dormant piece and
 *    an optional tier flag — no `prompt` field anywhere.
 * 2. **'reincorporate' needs a sampled piece to build around.** Asking for it
 *    without one is a caller mistake this refuses rather than papering over —
 *    same posture as `generateCallbackComplication`'s empty-material guard.
 * 3. **'action' asks for a drop-straight-into-motion opener**, no recap, no
 *    setup — and never mentions dormant material, because it has none.
 * 4. **'reincorporate' names the sampled piece's label and reason**, literally.
 * 5. **The campaign's style guide is matched when there is one**, exactly the
 *    cold open's own precedent — and no orphaned heading when there isn't.
 * 6. **Context comes from the caller, verbatim** — never built here.
 * 7. **It is freeform text, not a schema call** — one `generateText` call,
 *    standard tier by default, lite on request, trimmed output.
 * 8. **The facade owns the mock switch**, and the mock is usable, not
 *    decorative — it carries the identical reincorporate-needs-a-piece guard.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Campaign } from '../../types/index';
import type { DormantPiece } from '../../utils/dormantMaterial';

vi.mock('../../services/ai/core', () => ({
  generateWithSchema: vi.fn(async () => ({})),
  generateText: vi.fn(async () => '  A strong start.  '),
  generateChatCompletion: vi.fn(async () => 'ok'),
}));

vi.mock('../../services/contextBuilder', () => ({ buildCampaignContext: vi.fn(() => 'BUILT-CONTEXT') }));

import * as core from '../../services/ai/core';
import * as dmCoach from '../../services/ai/dmCoach';
import * as aiService from '../../services/aiService';
import * as mockService from '../../services/ai/mockService';

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

const PIECE: DormantPiece = { kind: 'npc', id: 'npc-serah', label: 'Serah Vane', reason: 'Last seen 3 sessions ago' };
const STYLE = 'Short, cold sentences. Concrete nouns. Never a simile.';

/** The full prompt string handed to core.generateText on the Nth call. */
const sentPrompt = (call = 0) => String(vi.mocked(core.generateText).mock.calls[call][0]);
/** The tier argument of the Nth core.generateText call. */
const sentTier = (call = 0) => vi.mocked(core.generateText).mock.calls[call][1];
/** The campaignContext argument of the Nth core.generateText call. */
const sentContext = (call = 0) => vi.mocked(core.generateText).mock.calls[call][2];

beforeEach(() => {
  vi.mocked(core.generateText).mockClear();
  vi.mocked(core.generateText).mockResolvedValue('  A strong start.  ');
  vi.mocked(core.generateWithSchema).mockClear();
});

// --- 1 & 2. the DM types nothing / the precondition for 'reincorporate' ------

describe('the DM types nothing', () => {
  it('refuses "reincorporate" with no sampled piece, and calls no model', async () => {
    await expect(
      dmCoach.generateStrongStart({ style: 'reincorporate', campaign: makeCampaign() })
    ).rejects.toThrow(/dormant piece/i);
    expect(core.generateText).not.toHaveBeenCalled();
  });

  it('never needs a piece for "action"', async () => {
    await expect(
      dmCoach.generateStrongStart({ style: 'action', campaign: makeCampaign() })
    ).resolves.toBeTruthy();
  });
});

// --- 3 & 4. what each style asks for -----------------------------------------

describe('what "action" asks for', () => {
  it('asks for an in-medias-res opener, no recap, no setup', async () => {
    await dmCoach.generateStrongStart({ style: 'action', campaign: makeCampaign() });
    const prompt = sentPrompt().toLowerCase();
    expect(prompt).toContain('in-medias-res');
    expect(prompt).toContain('no recap');
    expect(prompt).toMatch(/50-80/);
  });

  it('never mentions a dormant piece — it has none', async () => {
    await dmCoach.generateStrongStart({ style: 'action', campaign: makeCampaign(), dormantPiece: PIECE });
    expect(sentPrompt()).not.toContain('Serah Vane');
  });
});

describe('what "reincorporate" asks for', () => {
  it('names the sampled piece\'s label and reason, literally', async () => {
    await dmCoach.generateStrongStart({ style: 'reincorporate', campaign: makeCampaign(), dormantPiece: PIECE });
    const prompt = sentPrompt();
    expect(prompt).toContain('Serah Vane');
    expect(prompt).toContain('Last seen 3 sessions ago');
  });

  it('asks for the same read-aloud length and register as "action"', async () => {
    await dmCoach.generateStrongStart({ style: 'reincorporate', campaign: makeCampaign(), dormantPiece: PIECE });
    const prompt = sentPrompt().toLowerCase();
    expect(prompt).toMatch(/50-80/);
    expect(prompt).toContain('read aloud');
  });

  it('inserts a tricky label and reason literally, replacement patterns and all', async () => {
    const tricky: DormantPiece = { kind: 'plot', id: 'p1', label: "The $$500 Debt", reason: "Hasn't moved $& yet" };
    await dmCoach.generateStrongStart({ style: 'reincorporate', campaign: makeCampaign(), dormantPiece: tricky });
    const prompt = sentPrompt();
    expect(prompt).toContain('The $$500 Debt');
    expect(prompt).toContain("Hasn't moved $& yet");
    expect(prompt).not.toContain('{{');
  });
});

// --- 5. the voice guide -------------------------------------------------------

describe('the campaign voice, when there is one', () => {
  it('hands over the campaign style guide for both styles', async () => {
    await dmCoach.generateStrongStart({ style: 'action', campaign: makeCampaign({ styleProfile: STYLE }) });
    expect(sentPrompt()).toContain(STYLE);

    await dmCoach.generateStrongStart({
      style: 'reincorporate',
      campaign: makeCampaign({ styleProfile: STYLE }),
      dormantPiece: PIECE,
    });
    expect(sentPrompt(1)).toContain(STYLE);
  });

  it('leaves no orphaned heading or run of blank lines without one', async () => {
    await dmCoach.generateStrongStart({ style: 'action', campaign: makeCampaign() });
    const prompt = sentPrompt();
    expect(prompt).not.toContain('undefined');
    expect(prompt.trim()).toBe(prompt.trim().replace(/\n{3,}/g, '\n\n'));
  });

  it('treats a blank style profile as no style profile', async () => {
    await dmCoach.generateStrongStart({ style: 'action', campaign: makeCampaign({ styleProfile: '   ' }) });
    const prompt = sentPrompt();
    expect(prompt.trim()).toBe(prompt.trim().replace(/\n{3,}/g, '\n\n'));
  });

  it('inserts a tricky style profile literally', async () => {
    await dmCoach.generateStrongStart({ style: 'action', campaign: makeCampaign({ styleProfile: 'Terse. $& is a word here.' }) });
    expect(sentPrompt()).toContain('Terse. $& is a word here.');
  });
});

// --- 6. context ----------------------------------------------------------------

describe('context comes from the caller and stays GM-facing', () => {
  it('forwards the caller context untouched', async () => {
    await dmCoach.generateStrongStart({ style: 'action', campaign: makeCampaign(), campaignContext: 'GEN-CONTEXT' });
    expect(sentContext()).toBe('GEN-CONTEXT');
  });

  it('passes no context at all rather than inventing one', async () => {
    await dmCoach.generateStrongStart({ style: 'action', campaign: makeCampaign() });
    expect(sentContext()).toBeUndefined();
  });
});

// --- 7. shape of the call -------------------------------------------------------

describe('one freeform call per press', () => {
  it('makes exactly one generateText call and no schema call', async () => {
    await dmCoach.generateStrongStart({ style: 'action', campaign: makeCampaign() });
    expect(core.generateText).toHaveBeenCalledTimes(1);
    expect(core.generateWithSchema).not.toHaveBeenCalled();
  });

  it('runs at the standard tier by default and the lite tier on request', async () => {
    await dmCoach.generateStrongStart({ style: 'action', campaign: makeCampaign() });
    expect(sentTier()).toBe('standard');

    await dmCoach.generateStrongStart({ style: 'action', campaign: makeCampaign(), useLiteModel: true });
    expect(sentTier(1)).toBe('lite');
  });

  it('returns the model text trimmed and otherwise unedited', async () => {
    vi.mocked(core.generateText).mockResolvedValueOnce('\n  The door bursts open first.  \n');
    const result = await dmCoach.generateStrongStart({ style: 'action', campaign: makeCampaign() });
    expect(result).toBe('The door bursts open first.');
  });

  it('lets a generation failure propagate rather than returning a fake draft', async () => {
    vi.mocked(core.generateText).mockRejectedValueOnce(new Error('504 gateway timeout'));
    await expect(dmCoach.generateStrongStart({ style: 'action', campaign: makeCampaign() })).rejects.toThrow('504 gateway timeout');
  });
});

// --- 8. the facade ---------------------------------------------------------------

describe('the facade owns the mock switch', () => {
  it('routes to the real module when mock mode is off, request unchanged', async () => {
    const text = await aiService.generateStrongStart(
      { style: 'reincorporate', campaign: makeCampaign(), campaignContext: 'GEN-CONTEXT', dormantPiece: PIECE },
      false
    );
    expect(core.generateText).toHaveBeenCalledTimes(1);
    expect(sentContext()).toBe('GEN-CONTEXT');
    expect(sentPrompt()).toContain('Serah Vane');
    expect(text).toBe('A strong start.');
  });

  it('defaults to the real path when the flag is left off', async () => {
    await aiService.generateStrongStart({ style: 'action', campaign: makeCampaign() });
    expect(core.generateText).toHaveBeenCalledTimes(1);
  });

  it('routes to the mock when mock mode is on, and never touches the model', async () => {
    const text = await aiService.generateStrongStart({ style: 'action', campaign: makeCampaign() }, true);
    expect(core.generateText).not.toHaveBeenCalled();
    expect(text.trim().length).toBeGreaterThan(0);
  });

  it('refuses "reincorporate" with no piece on both paths', async () => {
    await expect(
      aiService.generateStrongStart({ style: 'reincorporate', campaign: makeCampaign() }, false)
    ).rejects.toThrow(/dormant piece/i);
    await expect(
      aiService.generateStrongStart({ style: 'reincorporate', campaign: makeCampaign() }, true)
    ).rejects.toThrow(/dormant piece/i);
    expect(core.generateText).not.toHaveBeenCalled();
  });
});

// --- 9. the mock -------------------------------------------------------------------

describe('the mock is usable, not decorative', () => {
  it('resolves non-empty text for "action"', async () => {
    const text = await mockService.generateStrongStart({ style: 'action', campaign: makeCampaign() });
    expect(text.trim().length).toBeGreaterThan(0);
  });

  it('resolves non-empty text naming the sampled piece for "reincorporate"', async () => {
    const text = await mockService.generateStrongStart({ style: 'reincorporate', campaign: makeCampaign(), dormantPiece: PIECE });
    expect(text).toContain('Serah Vane');
  });

  it('refuses "reincorporate" with no piece exactly as the real path does', async () => {
    await expect(
      mockService.generateStrongStart({ style: 'reincorporate', campaign: makeCampaign() })
    ).rejects.toThrow(/dormant piece/i);
  });
});
