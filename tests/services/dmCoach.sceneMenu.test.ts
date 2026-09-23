/**
 * SPEC — the Scene Menu Generator (Wave 2, lane 2: SessionPrepWizard bundle)
 * =============================================================================
 * Source: docs/design/lazy-dm-lens.md §4 R1 / the "scene menu" (Shea step 3,
 * "outline potential scenes"). Files under test: services/ai/dmCoach.ts
 * (`generateSceneMenu`), services/aiService.ts (the facade),
 * services/ai/mockService.ts (the mock).
 *
 * WHAT THIS FUNCTION IS
 * ---------------------
 * The lazy path's Beats step ships with zero AI assist: every beat is
 * hand-typed. This widens it with the exact generate -> preview -> keep-some
 * idiom R2 already shipped for the Secrets Tracker (`generateSecretBatch`),
 * one step down in scale — 5-6 scene drafts instead of ten secrets.
 *
 * THE CONTRACT, IN PLAIN SENTENCES
 * --------------------------------
 * 1. **Zero-prompt by construction.** The only argument is an optional
 *    campaign context string; there is no `prompt` parameter, because the DM
 *    never types one. The text handed to the model is a FIXED constant that
 *    never varies with the campaign or the caller.
 * 2. **It is a schema call, not freeform text**, and it never throws on
 *    malformed model output — normalization happens inside this function,
 *    not downstream.
 * 3. **Every draft needs a title; a hook is optional.** A blank title drops
 *    the entry; a blank hook is omitted rather than stored as `''`.
 * 4. **A runaway model cannot flood the preview panel** — the result is
 *    capped at 8 entries.
 * 5. **The facade owns the mock switch**, and the mock is usable, not
 *    decorative — non-empty, well-formed drafts, same shape as the real path.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/ai/core', () => ({
  generateWithSchema: vi.fn(async () => ({ scenes: [] })),
  generateText: vi.fn(async () => 'ok'),
  generateChatCompletion: vi.fn(async () => 'ok'),
}));

vi.mock('../../services/contextBuilder', () => ({ buildCampaignContext: vi.fn(() => 'BUILT-CONTEXT') }));

import * as core from '../../services/ai/core';
import * as dmCoach from '../../services/ai/dmCoach';
import * as aiService from '../../services/aiService';
import * as mockService from '../../services/ai/mockService';

/** The full prompt string handed to core.generateWithSchema on the Nth call. */
const sentPrompt = (call = 0) => String(vi.mocked(core.generateWithSchema).mock.calls[call][0]);
/** The instructions string of the Nth call. */
const sentInstructions = (call = 0) => String(vi.mocked(core.generateWithSchema).mock.calls[call][2]);
/** The model/tier argument of the Nth call. */
const sentModel = (call = 0) => vi.mocked(core.generateWithSchema).mock.calls[call][4];
/** The campaignContext argument of the Nth call. */
const sentContext = (call = 0) => vi.mocked(core.generateWithSchema).mock.calls[call][5];

beforeEach(() => {
  vi.mocked(core.generateWithSchema).mockClear();
  vi.mocked(core.generateWithSchema).mockResolvedValue({ scenes: [] });
  vi.mocked(core.generateText).mockClear();
});

// --- 1. zero-prompt by construction ----------------------------------------

describe('the DM types nothing', () => {
  it('takes no prompt argument — only an optional campaign context', async () => {
    await dmCoach.generateSceneMenu();
    expect(core.generateWithSchema).toHaveBeenCalledTimes(1);
    // A schema call, never freeform text.
    expect(core.generateText).not.toHaveBeenCalled();
  });

  it('sends the exact same fixed prompt regardless of the campaign context supplied', async () => {
    await dmCoach.generateSceneMenu('context A');
    await dmCoach.generateSceneMenu('a wildly different context B');
    expect(sentPrompt(0)).toBe(sentPrompt(1));
  });

  it('asks for a menu of 5-6 scenes, not a fixed sequence', async () => {
    await dmCoach.generateSceneMenu();
    const prompt = sentPrompt().toLowerCase();
    const instructions = sentInstructions().toLowerCase();
    expect(prompt).toMatch(/5-6|five.*six/);
    expect(instructions).toContain('menu');
    expect(instructions).toContain('not all of them will be used');
  });

  it('forwards the caller context untouched and never builds one itself', async () => {
    await dmCoach.generateSceneMenu('GEN-CONTEXT');
    expect(sentContext()).toBe('GEN-CONTEXT');
  });

  it('passes no context at all rather than inventing one', async () => {
    await dmCoach.generateSceneMenu();
    expect(sentContext()).toBeUndefined();
  });

  it('runs at the standard tier', async () => {
    await dmCoach.generateSceneMenu();
    expect(sentModel()).toBe('standard');
  });
});

// --- 2 & 3. normalization ----------------------------------------------------

describe('model output is made structurally safe here', () => {
  it('accepts a { scenes: [...] } envelope', async () => {
    vi.mocked(core.generateWithSchema).mockResolvedValueOnce({
      scenes: [{ title: 'Ambush at the ford', hook: 'A rope bridge, half-cut.' }],
    });
    const result = await dmCoach.generateSceneMenu();
    expect(result).toEqual([{ title: 'Ambush at the ford', hook: 'A rope bridge, half-cut.' }]);
  });

  it('accepts a bare array too', async () => {
    vi.mocked(core.generateWithSchema).mockResolvedValueOnce([{ title: 'A stranger at the door' }]);
    const result = await dmCoach.generateSceneMenu();
    expect(result).toEqual([{ title: 'A stranger at the door' }]);
  });

  it('drops any entry with a blank or missing title', async () => {
    vi.mocked(core.generateWithSchema).mockResolvedValueOnce({
      scenes: [{ title: '   ' }, { hook: 'no title at all' }, { title: 'Keeps this one' }],
    });
    const result = await dmCoach.generateSceneMenu();
    expect(result).toEqual([{ title: 'Keeps this one' }]);
  });

  it('trims a title and omits a blank hook rather than storing ""', async () => {
    vi.mocked(core.generateWithSchema).mockResolvedValueOnce({
      scenes: [{ title: '  Spaced title  ', hook: '   ' }],
    });
    const result = await dmCoach.generateSceneMenu();
    expect(result).toEqual([{ title: 'Spaced title' }]);
    expect('hook' in result[0]).toBe(false);
  });

  it('caps the result at 8 entries', async () => {
    vi.mocked(core.generateWithSchema).mockResolvedValueOnce({
      scenes: Array.from({ length: 12 }, (_, i) => ({ title: `Scene ${i}` })),
    });
    const result = await dmCoach.generateSceneMenu();
    expect(result).toHaveLength(8);
    expect(result[0].title).toBe('Scene 0');
    expect(result[7].title).toBe('Scene 7');
  });

  it('never throws on malformed model output — always an array, possibly empty', async () => {
    vi.mocked(core.generateWithSchema).mockResolvedValueOnce(null);
    await expect(dmCoach.generateSceneMenu()).resolves.toEqual([]);

    vi.mocked(core.generateWithSchema).mockResolvedValueOnce('not an object at all');
    await expect(dmCoach.generateSceneMenu()).resolves.toEqual([]);

    vi.mocked(core.generateWithSchema).mockResolvedValueOnce({ scenes: ['just a string', 42, null] });
    await expect(dmCoach.generateSceneMenu()).resolves.toEqual([]);
  });

  it('lets a real generation failure propagate rather than resolving to []', async () => {
    vi.mocked(core.generateWithSchema).mockRejectedValueOnce(new Error('504 gateway timeout'));
    await expect(dmCoach.generateSceneMenu()).rejects.toThrow('504 gateway timeout');
  });
});

// --- 4. the facade -----------------------------------------------------------

describe('the facade owns the mock switch', () => {
  it('routes to the real module when mock mode is off', async () => {
    vi.mocked(core.generateWithSchema).mockResolvedValueOnce({ scenes: [{ title: 'From the real path' }] });
    const result = await aiService.generateSceneMenu('GEN-CONTEXT', false);
    expect(core.generateWithSchema).toHaveBeenCalledTimes(1);
    expect(sentContext()).toBe('GEN-CONTEXT');
    expect(result).toEqual([{ title: 'From the real path' }]);
  });

  it('defaults to the real path when the flag is left off', async () => {
    await aiService.generateSceneMenu();
    expect(core.generateWithSchema).toHaveBeenCalledTimes(1);
  });

  it('routes to the mock when mock mode is on, and never touches the model', async () => {
    const result = await aiService.generateSceneMenu('GEN-CONTEXT', true);
    expect(core.generateWithSchema).not.toHaveBeenCalled();
    expect(result.length).toBeGreaterThan(0);
  });
});

// --- 5. the mock ---------------------------------------------------------------

describe('the mock is usable, not decorative', () => {
  it('resolves a well-formed roster of distinct scene drafts', async () => {
    const result = await mockService.generateSceneMenu('any context');
    expect(result.length).toBeGreaterThanOrEqual(5);
    for (const draft of result) {
      expect(draft.title.length).toBeGreaterThan(0);
      if (draft.hook !== undefined) expect(draft.hook.length).toBeGreaterThan(0);
    }
    const titles = new Set(result.map(d => d.title));
    expect(titles.size).toBe(result.length);
  });

  it('never has a material precondition — it always has something to offer', async () => {
    await expect(mockService.generateSceneMenu()).resolves.not.toEqual([]);
  });
});
