/**
 * SPEC — GM Intrusion, the zero-precondition live complication (§4.2 of the
 * lazy-dm-lens research report; Monte Cook / Cypher System)
 * =============================================================================
 * Files under test: services/ai/dmCoach.ts (`generateGmIntrusion`),
 * services/aiService.ts (the facade), services/ai/mockService.ts (the mock).
 *
 * WHAT THIS FUNCTION IS
 * ---------------------
 * Structurally a sibling of `generateCallbackComplication` (the Callback
 * Machine): both ask the model for exactly one forward-facing complication
 * the DM can read at the table. The one deliberate difference is the whole
 * point of this feature — `generateCallbackComplication` REQUIRES at least
 * one piece of dormant material and throws without it; `generateGmIntrusion`
 * has no material parameter at all, so there is nothing for it to require,
 * and it never throws because a campaign is "empty". That is what makes it
 * usable in a session-1 campaign with nothing dormant established yet.
 *
 * THE CONTRACT, IN PLAIN SENTENCES
 * --------------------------------
 * 1. **No crafted prompt, ever.** The signature carries only an optional
 *    context string, an optional derived scene summary, and an optional tier
 *    flag — nothing that could be a DM-typed prompt.
 * 2. **Never throws, with or without a scene, with or without a context.**
 *    Unlike the Callback Machine there is no precondition to fail.
 * 3. **Asks for exactly one complication, not a menu**, and names the Cypher
 *    System's GM Intrusion technique so the model plays the right craft move
 *    (unprompted, forward-looking, raises the stakes).
 * 4. **The scene summary is optional and never faked** — present when
 *    supplied, no empty heading when it is not.
 * 5. **Context comes from the caller, verbatim** — the function never builds
 *    context itself.
 * 6. **One freeform `generateText` call per invocation**, standard tier by
 *    default, lite on request; the result comes back trimmed.
 * 7. **The facade owns the mock switch**, and the design's own sketch orders
 *    the flag first: `generateGmIntrusion(isMockMode, campaignContext?, sceneSummary?)`.
 * 8. **The mock is usable and never rejects** — same non-throwing contract as
 *    the real path, so a test or a session-1 mock-mode DM sees the same
 *    always-available button the design promises.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../services/ai/core', () => ({
  generateWithSchema: vi.fn(async () => ({})),
  generateText: vi.fn(async () => '  A stranger bursts in, already mid-sentence.  '),
  generateChatCompletion: vi.fn(async () => 'ok'),
}));

import * as core from '../../services/ai/core';
import * as dmCoach from '../../services/ai/dmCoach';
import * as aiService from '../../services/aiService';
import * as mockService from '../../services/ai/mockService';

const sentPrompt = (call = 0) => String(vi.mocked(core.generateText).mock.calls[call][0]);
const sentTier = (call = 0) => vi.mocked(core.generateText).mock.calls[call][1];
const sentContext = (call = 0) => vi.mocked(core.generateText).mock.calls[call][2];

beforeEach(() => {
  vi.mocked(core.generateText).mockClear();
  vi.mocked(core.generateText).mockResolvedValue('  A stranger bursts in, already mid-sentence.  ');
  vi.mocked(core.generateWithSchema).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- 1 & 2. zero-prompt, zero-precondition ---------------------------------

describe('zero-prompt and zero-precondition', () => {
  it('never throws with no arguments at all', async () => {
    await expect(dmCoach.generateGmIntrusion()).resolves.toBeTruthy();
    expect(core.generateText).toHaveBeenCalledTimes(1);
  });

  it('never throws on what would be an "empty campaign" for the Callback Machine (no context, no scene)', async () => {
    await expect(dmCoach.generateGmIntrusion(undefined, undefined)).resolves.toBeTruthy();
  });

  it('works just as well with a context and a scene supplied', async () => {
    await expect(dmCoach.generateGmIntrusion('CONTEXT', 'A tense standoff at the gate.')).resolves.toBeTruthy();
  });
});

// --- 3. what the model is asked --------------------------------------------

describe('the prompt asks for one forward-looking complication', () => {
  it('names the GM Intrusion technique and asks for exactly one, not a menu', async () => {
    await dmCoach.generateGmIntrusion();
    const prompt = sentPrompt().toLowerCase();
    expect(prompt).toContain('gm intrusion');
    expect(prompt).toContain('cypher system');
    expect(prompt).toContain('one unexpected complication');
  });

  it('is explicitly forward-looking, not a reincorporation instruction', async () => {
    await dmCoach.generateGmIntrusion();
    const prompt = sentPrompt().toLowerCase();
    expect(prompt).toContain('introduce something new');
  });

  it('stays unprompted by any roll or trigger, per the Cypher System technique', async () => {
    await dmCoach.generateGmIntrusion();
    expect(sentPrompt().toLowerCase()).toContain('unprompted');
  });
});

// --- 4. the scene summary ---------------------------------------------------

describe('the scene summary is optional and never faked', () => {
  it('includes the scene summary when supplied', async () => {
    await dmCoach.generateGmIntrusion(undefined, 'The party is arguing with a toll clerk.');
    expect(sentPrompt()).toContain('The party is arguing with a toll clerk.');
  });

  it('leaves no empty heading behind when there is no scene summary', async () => {
    await dmCoach.generateGmIntrusion();
    const prompt = sentPrompt();
    expect(prompt).not.toMatch(/:\s*\n\s*\n\s*\n/);
  });
});

// --- 5. context --------------------------------------------------------------

describe('context comes from the caller, verbatim', () => {
  it('forwards the caller campaign context untouched', async () => {
    await dmCoach.generateGmIntrusion('COACH-CONTEXT');
    expect(sentContext()).toBe('COACH-CONTEXT');
  });

  it('passes no context at all rather than inventing one', async () => {
    await dmCoach.generateGmIntrusion();
    expect(sentContext()).toBeUndefined();
  });
});

// --- 6. shape of the call ----------------------------------------------------

describe('one freeform call per press', () => {
  it('makes exactly one generateText call and no schema call', async () => {
    await dmCoach.generateGmIntrusion();
    expect(core.generateText).toHaveBeenCalledTimes(1);
    expect(core.generateWithSchema).not.toHaveBeenCalled();
  });

  it('runs at the standard tier by default and the lite tier on request', async () => {
    await dmCoach.generateGmIntrusion();
    expect(sentTier()).toBe('standard');

    await dmCoach.generateGmIntrusion(undefined, undefined, true);
    expect(sentTier(1)).toBe('lite');
  });

  it('returns the model text trimmed and otherwise unedited', async () => {
    vi.mocked(core.generateText).mockResolvedValueOnce('\n  The lamp gutters and dies.  \n');
    const result = await dmCoach.generateGmIntrusion();
    expect(result).toBe('The lamp gutters and dies.');
  });

  it('lets a generation failure propagate rather than returning a fake intrusion', async () => {
    vi.mocked(core.generateText).mockRejectedValueOnce(new Error('504 gateway timeout'));
    await expect(dmCoach.generateGmIntrusion()).rejects.toThrow('504 gateway timeout');
  });
});

// --- 7. the facade -----------------------------------------------------------

describe('the facade owns the mock switch, isMockMode first', () => {
  it('routes to the real module when mock mode is off', async () => {
    const text = await aiService.generateGmIntrusion(false, 'COACH-CONTEXT', 'A toll booth.');
    expect(core.generateText).toHaveBeenCalledTimes(1);
    expect(sentContext()).toBe('COACH-CONTEXT');
    expect(sentPrompt()).toContain('A toll booth.');
    expect(text.length).toBeGreaterThan(0);
  });

  it('defaults to the real path when the flag is left off', async () => {
    await aiService.generateGmIntrusion();
    expect(core.generateText).toHaveBeenCalledTimes(1);
  });

  it('routes to the mock when mock mode is on, and never touches the model', async () => {
    const text = await aiService.generateGmIntrusion(true, 'COACH-CONTEXT');
    expect(core.generateText).not.toHaveBeenCalled();
    expect(text.trim().length).toBeGreaterThan(0);
  });
});

// --- 8. the mock ---------------------------------------------------------------

describe('the mock is usable and never rejects', () => {
  it('resolves a non-empty complication with no arguments at all', async () => {
    const text = await mockService.generateGmIntrusion();
    expect(text.trim().length).toBeGreaterThan(0);
  });

  it('folds the scene summary into the mock text when supplied', async () => {
    const text = await mockService.generateGmIntrusion(undefined, 'a crowded market square');
    expect(text).toContain('a crowded market square');
  });
});
